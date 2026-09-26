/**
 * Headless simulation entry point. No DOM, canvas or audio: `new Sim(opts).step(input)` runs in
 * node (tests, bots, stress) exactly as in the browser. Output flows through `sim.events`.
 */

import type { EventQueue } from '../engine/events';
import type { InputState } from '../engine/inputState';
import { Rng, seedToU32 } from '../engine/rng';
import { WREN } from '../content/characters/wren';
import { TEST_ROOM } from '../content/testRoom';
import { DT } from './constants';
import { spawnDummy, updateDummies } from './dummies';
import { hurtPlayer, killPlayer, updatePlayer } from './player';
import { updateProjectiles } from './projectiles';
import { cellCenterX, cellCenterY, parseRoomLayout } from './room';
import type { CharacterDef } from './types';
import { World } from './world';

export interface SimOptions {
  seed?: number | string;
  character?: CharacterDef;
  /** 7 rows × 13 chars (see content/testRoom.ts for the markers). */
  room?: readonly string[];
}

export interface SimSummary {
  tick: number;
  player: { x: number; y: number; vx: number; vy: number; red: number; dead: boolean };
  projectiles: number;
  dummies: { x: number; y: number; hp: number; popped: boolean }[];
  counters: { shots: number; hits: number; pops: number };
}

export class Sim {
  readonly seed: number;
  readonly world: World;
  /** Queue size / drop counter at the end of the last step (what consumers have drained). */
  private seenCount = 0;
  private seenDropped = 0;

  constructor(opts: SimOptions = {}) {
    this.seed = seedToU32(opts.seed ?? 1);
    const root = new Rng(this.seed);
    this.world = new World(opts.character ?? WREN, root.fork('combat'));
    this.world.room.styleSeed = root.fork('room-style').nextU32();
    this.loadRoom(opts.room ?? TEST_ROOM);
  }

  get events(): EventQueue {
    return this.world.events;
  }

  get tick(): number {
    return this.world.tick;
  }

  /** Replaces the room layout and (re)places the player and dummies from its markers. */
  loadRoom(layout: readonly string[]): void {
    const w = this.world;
    const markers = parseRoomLayout(layout, w.room);
    w.projectiles.clear();
    w.dummies.clear();
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
    updatePlayer(w, input, DT);
    updateProjectiles(w, DT);
    updateDummies(w, DT);
    this.seenCount = q.count;
    this.seenDropped = q.dropped;
  }

  // ── Debug hooks (used by __SD.debug and tests) ────────────────────────────
  hurtPlayer(halfHearts = 1): void {
    hurtPlayer(this.world, halfHearts);
  }

  killPlayer(): void {
    killPlayer(this.world);
  }

  summary(): SimSummary {
    const w = this.world;
    const p = w.player;
    const dummies: SimSummary['dummies'] = [];
    for (let i = 0; i < w.dummies.count; i++) {
      const d = w.dummies.items[i]!;
      dummies.push({ x: d.x, y: d.y, hp: d.hp, popped: d.popped });
    }
    return {
      tick: w.tick,
      player: { x: p.x, y: p.y, vx: p.vx, vy: p.vy, red: p.red, dead: p.dead },
      projectiles: w.projectiles.count,
      dummies,
      counters: { ...w.counters },
    };
  }
}
