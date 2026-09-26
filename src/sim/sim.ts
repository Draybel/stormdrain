/**
 * Headless simulation entry point. No DOM, canvas or audio: `new Sim(opts).step(input)` runs in
 * node (tests, bots, stress) exactly as in the browser. Output flows through `sim.events`.
 */

import type { EventQueue } from '../engine/events';
import type { InputState } from '../engine/inputState';
import { Rng, seedToU32 } from '../engine/rng';
import { WREN } from '../content/characters/wren';
import { TEST_ROOM, TEST_ROOM_SPAWNS } from '../content/testRoom';
import { explode, placeBomb, updateBombs } from './bombs';
import { hurtPlayer, killPlayer } from './combat';
import { DT } from './constants';
import { spawnDummy, updateDummies } from './dummies';
import { floorStarted, giveItem, leftRoom, recomputePlayer, roomCleared, updateEffects } from './effects';
import { describeHealth } from './health';
import { pickItem } from './itemPools';
import { spawnPedestal, updatePedestals } from './pedestals';
import { pickupKindOf, pickupName } from './pickupKinds';
import { spawnPickup, updatePickups } from './pickups';
import { updatePlayer } from './player';
import { updateProjectiles } from './projectiles';
import { cellCenterX, cellCenterY, parseRoomLayout } from './room';
import type { RoomSpawn } from './roomSpawns';
import { updateHazards } from './tileFx';
import type { CharacterDef, PickupName } from './types';
import { World } from './world';

export interface SimOptions {
  seed?: number | string;
  character?: CharacterDef;
  /** 7 rows × 13 chars (see content/testRoom.ts for the markers). */
  room?: readonly string[];
  /** Entities to place (pickups, chests, pedestals). Defaults to the test room's when `room` is omitted. */
  spawns?: readonly RoomSpawn[];
}

export interface SimSummary {
  tick: number;
  player: { x: number; y: number; vx: number; vy: number; red: number; dead: boolean };
  health: string;
  projectiles: number;
  dummies: { x: number; y: number; hp: number; popped: boolean }[];
  pickups: { kind: string; x: number; y: number; opened: boolean; item: string }[];
  pedestals: { x: number; y: number; item: string }[];
  bombs: number;
  inv: {
    coins: number;
    bombs: number;
    keys: number;
    passives: string[];
    active: { id: string; charge: number; max: number } | null;
    trinkets: string[];
    consumables: string[];
  };
  stats: Record<string, number>;
  counters: {
    shots: number;
    hits: number;
    pops: number;
    pickups: number;
    items: number;
    bombsPlaced: number;
    explosions: number;
    tilesBroken: number;
    chestsOpened: number;
    hurts: number;
    roomsCleared: number;
  };
}

export class Sim {
  readonly seed: number;
  readonly world: World;
  /** Room contents (random pedestal items) — separate from loot so play never shifts them. */
  private readonly roomRng: Rng;
  /** Training-room rule: popping every dummy at once counts as clearing the room. */
  private trainingRoom = false;
  private allPopped = false;
  /** Queue size / drop counter at the end of the last step (what consumers have drained). */
  private seenCount = 0;
  private seenDropped = 0;

  constructor(opts: SimOptions = {}) {
    this.seed = seedToU32(opts.seed ?? 1);
    const root = new Rng(this.seed);
    this.roomRng = root.fork('room-items');
    const character = opts.character ?? WREN;
    this.world = new World(character, root.fork('combat'), root.fork('loot'));
    this.world.room.styleSeed = root.fork('room-style').nextU32();
    recomputePlayer(this.world);
    for (const id of character.startItems) giveItem(this.world, id);
    this.world.player.holdItem = '';
    this.world.player.holdTime = 0;
    this.trainingRoom = !opts.room;
    this.loadRoom(opts.room ?? TEST_ROOM, opts.spawns ?? (opts.room ? [] : TEST_ROOM_SPAWNS));
    // Setup noise (start-item banners etc.) is not news.
    this.world.events.clear();
  }

  get events(): EventQueue {
    return this.world.events;
  }

  get tick(): number {
    return this.world.tick;
  }

  /** Replaces the room layout and (re)places the player, dummies and spawns. */
  loadRoom(layout: readonly string[], spawns: readonly RoomSpawn[] = []): void {
    const w = this.world;
    const markers = parseRoomLayout(layout, w.room);
    w.projectiles.clear();
    w.dummies.clear();
    w.pickups.clear();
    w.bombs.clear();
    w.pedestals.clear();
    leftRoom(w);
    let placed = false;
    for (const m of markers) {
      const x = cellCenterX(m.col);
      const y = cellCenterY(m.row);
      if (m.ch === '@') {
        w.player.placeAt(x, y);
        placed = true;
      } else if (m.ch === 'D') {
        spawnDummy(w, x, y + 3);
      }
    }
    if (!placed) w.player.placeAt(cellCenterX(6), cellCenterY(3));
    this.placeSpawns(spawns);
    this.allPopped = false;
  }

  private placeSpawns(spawns: readonly RoomSpawn[]): void {
    const w = this.world;
    const chosen = new Set<string>();
    for (const s of spawns) {
      const x = cellCenterX(s.col) + (s.dx ?? 0);
      const y = cellCenterY(s.row) + (s.dy ?? 0);
      if (s.kind === 'pickup') {
        const pk = spawnPickup(w, pickupKindOf(s.pickup), x, y, false, s.item ?? '');
        if (pk && s.item === undefined && (s.pickup === 'trinket' || s.pickup === 'consumable')) {
          const def = pickItem(this.roomRng, { kind: s.pickup, tag: s.tag, exclude: chosen });
          if (def) {
            pk.itemId = def.id;
            chosen.add(def.id);
          } else {
            w.pickups.release(pk);
          }
        }
      } else {
        let item = s.item ?? '';
        if (!item) {
          const def = pickItem(this.roomRng, { tag: s.tag, kind: s.itemKind, exclude: chosen });
          item = def?.id ?? '';
        }
        if (item) chosen.add(item);
        spawnPedestal(w, x, y, item);
      }
    }
  }

  /**
   * Advances one fixed tick (1/60 s). First drops the events that were already in the queue
   * after the previous step (consumers drain after every step); events emitted between steps
   * by the debug hooks below survive, so render/audio still see e.g. a debug hurt.
   */
  step(input: InputState): void {
    const w = this.world;
    const q = w.events;
    // Events overwritten since then were among the already-seen ones.
    q.discard(this.seenCount - (q.dropped - this.seenDropped));
    w.tick++;
    w.time += DT;
    updateEffects(w, DT);
    updatePlayer(w, input, DT);
    updateProjectiles(w, DT);
    updateBombs(w, DT);
    updatePickups(w, DT);
    updatePedestals(w, DT);
    updateHazards(w);
    updateDummies(w, DT);
    if (this.trainingRoom) this.trainingRoomRules();
    this.seenCount = q.count;
    this.seenDropped = q.dropped;
  }

  private trainingRoomRules(): void {
    const d = this.world.dummies;
    if (d.count === 0) return;
    let all = true;
    for (let i = 0; i < d.count; i++) {
      if (!d.items[i]!.popped) {
        all = false;
        break;
      }
    }
    if (all && !this.allPopped) roomCleared(this.world);
    this.allPopped = all;
  }

  // ── Room / floor hooks (called by the room & floor code) ─────────────────────
  /** The current room was cleared: recharge actives, fire 'roomClear' triggers. */
  roomCleared(): void {
    roomCleared(this.world);
  }

  floorStarted(): void {
    floorStarted(this.world);
  }

  // ── Debug hooks (used by __SD.debug and tests) ────────────────────────────
  hurtPlayer(halfHearts = 1): void {
    hurtPlayer(this.world, halfHearts);
  }

  killPlayer(): void {
    killPlayer(this.world);
  }

  giveItem(id: string): void {
    giveItem(this.world, id);
  }

  /** Pops a pickup out at room px (defaults: just below the player). */
  spawnPickup(name: PickupName, x?: number, y?: number): void {
    const p = this.world.player;
    spawnPickup(this.world, pickupKindOf(name), x ?? p.x, y ?? p.y + 14, true);
  }

  placeBomb(): boolean {
    return placeBomb(this.world);
  }

  explode(x: number, y: number): void {
    explode(this.world, x, y);
  }

  summary(): SimSummary {
    const w = this.world;
    const p = w.player;
    const inv = p.inv;
    const dummies: SimSummary['dummies'] = [];
    for (let i = 0; i < w.dummies.count; i++) {
      const d = w.dummies.items[i]!;
      dummies.push({ x: d.x, y: d.y, hp: d.hp, popped: d.popped });
    }
    const pickups: SimSummary['pickups'] = [];
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i]!;
      pickups.push({ kind: pickupName(k.kind), x: k.x, y: k.y, opened: k.opened, item: k.itemId });
    }
    const pedestals: SimSummary['pedestals'] = [];
    for (let i = 0; i < w.pedestals.count; i++) {
      const s = w.pedestals.items[i]!;
      pedestals.push({ x: s.x, y: s.y, item: s.item });
    }
    return {
      tick: w.tick,
      player: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, red: p.red, dead: p.dead },
      health: describeHealth(p.health),
      projectiles: w.projectiles.count,
      dummies,
      pickups,
      pedestals,
      bombs: w.bombs.count,
      inv: {
        coins: inv.coins,
        bombs: inv.bombs,
        keys: inv.keys,
        passives: [...inv.passives],
        active: inv.active ? { id: inv.active.id, charge: inv.active.charge, max: inv.active.max } : null,
        trinkets: [...inv.trinkets],
        consumables: [...inv.consumables],
      },
      stats: { ...p.stats },
      counters: { ...w.counters },
    };
  }
}
