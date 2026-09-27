/**
 * A real run (ARCHITECTURE §6b): floors from the generator, rooms from templates, doors, room
 * transitions, clears, the trapdoor, curses and run snapshots. Headless, owned by the Sim
 * (`sim.run`), stepped at the end of every Sim tick.
 *
 * Flow of a room change (walking into an open door, the trapdoor, debug teleports):
 *   decide the destination (Curse of the Maze may reroute) → pay a Thorn Room toll → save the room
 *   being left (tiles, pickups, pedestals) → `data.current` = destination → CHECKPOINT → enterCurrent().
 * The checkpoint (a JSON string of RunData + world + player) is what `snapshot()` returns: restoring
 * runs the very same enterCurrent() from the very same state, so play continues identically.
 * Everything that happens on entry (spawns, the floorStart trigger…) therefore lives in enterCurrent.
 */

import type { InputState } from '../../engine/inputState';
import { floorRng, hashString } from '../../engine/rng';
import { findEnemy } from '../../content/registry';
import { startWave, type FixedSpawn } from '../arena';
import { respawnFamiliars } from '../attack/familiars';
import { DMG_SPIKES, damagePlayer } from '../combat';
import { ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W, TILE } from '../constants';
import {
  DK,
  DOOR_FRONT_X,
  DOOR_FRONT_Y,
  DOOR_X,
  DOOR_Y,
  DS,
  TRAPDOOR_OPEN_TIME,
  type DoorKind,
} from '../doors';
import { floorStarted } from '../effects';
import { generateFloor, neighborRoom, openNook, templateRng } from '../floor/generate';
import { ROOM_TEMPLATES } from '../floor/library';
import { createMinimap, discoverRoom, enterRoom as mapEnterRoom, revealMap, setLostMap } from '../floor/minimap';
import { pickTemplates, templateGrid } from '../floor/templates';
import {
  DIR_BITS,
  DIR_OPPOSITE,
  type FloorCurse,
  type FloorGenOptions,
  type FloorRoom,
  type FloorTrack,
  type RoomType,
} from '../floor/types';
import { addCounter } from '../inventory';
import { spawnPedestal } from '../pedestals';
import { pickupKindOf, type PickupKind } from '../pickupKinds';
import { spawnPickup } from '../pickups';
import { cellCenterX, cellCenterY, type RoomGrid, type RoomMarker } from '../room';
import type { RoomSpawn } from '../roomSpawns';
import { Tile } from '../tiles';
import { RUN_TUNING } from '../tuning';
import type { World } from '../world';
import { chapterFor, chapterNumber } from './chapters';
import { EMPTY_ROOM, emptyRoomState, rollFloorContents, templateById } from './contents';
import { capturePlayer, captureWorld } from './snapshot';
import { RUN_SNAPSHOT_VERSION, type RoomState, type RunData, type RunOptions, type RunSnapshot, type RunStats } from './types';

/** What the run needs from the Sim (a type-only dependency, no import cycle). */
export interface RunHost {
  readonly world: World;
  /** Parses a 7×13 layout into the room, clears every pool, returns the non-tile markers. */
  loadRoom(layout: readonly string[], spawns?: readonly RoomSpawn[]): RoomMarker[];
}

/** Compact run info for summaries / tests / the HUD. */
export interface RunSummary {
  floor: number;
  track: FloorTrack;
  chapter: string;
  room: number;
  roomType: RoomType;
  cleared: boolean;
  curse: FloorCurse | null;
  rooms: number;
  visited: number;
  doors: { side: number; kind: number; state: number; to: number }[];
  trapdoor: boolean;
  won: boolean;
  time: number;
  stats: RunStats;
}

/** Last floor of a route: its boss ends the run (the Undertow comes later). */
const LAST_FLOOR = 12;

const TRAPDOOR_X = cellCenterX(6);
const TRAPDOOR_Y = cellCenterY(3);

// ── Grid persistence ──────────────────────────────────────────────────────────

const CELLS = ROOM_COLS * ROOM_ROWS;

/** Tiles, hits left and debris as one short string (3 × 91 chars, '0' + value). */
export function encodeGrid(g: RoomGrid): string {
  let s = '';
  for (let i = 0; i < CELLS; i++) s += String.fromCharCode(48 + g.tiles[i]!);
  for (let i = 0; i < CELLS; i++) s += String.fromCharCode(48 + g.hp[i]!);
  for (let i = 0; i < CELLS; i++) s += String.fromCharCode(48 + g.deco[i]!);
  return s;
}

export function decodeGrid(s: string, g: RoomGrid): void {
  if (s.length !== CELLS * 3) return;
  for (let i = 0; i < CELLS; i++) {
    g.tiles[i] = s.charCodeAt(i) - 48;
    g.hp[i] = s.charCodeAt(CELLS + i) - 48;
    g.deco[i] = s.charCodeAt(CELLS * 2 + i) - 48;
  }
  g.version++;
}

// ── Doors ───────────────────────────────────────────────────────────────────

function specialKind(t: RoomType): DoorKind {
  switch (t) {
    case 'boss':
      return DK.Boss;
    case 'treasure':
      return DK.Treasure;
    case 'shop':
      return DK.Shop;
    case 'challenge':
      return DK.Challenge;
    case 'cursed':
      return DK.Cursed;
    case 'miniboss':
      return DK.Miniboss;
    case 'nook':
      return DK.Nook;
    default:
      return DK.Normal;
  }
}

/**
 * A regular door's frame: the neighbour's special type (a boss door looks like one from both sides),
 * else this room's own (inside the boss room every plain door is a boss door; the nook's is the nook's).
 */
export function doorKindBetween(own: RoomType, other: RoomType): DoorKind {
  const k = specialKind(other);
  return k !== DK.Normal ? k : specialKind(own);
}

function curseModeOf(c: FloorCurse | null | undefined): string {
  return c === undefined ? 'roll' : c === null ? 'none' : c;
}

// ── The run ──────────────────────────────────────────────────────────────────

export class Run {
  readonly data: RunData;
  private readonly host: RunHost;
  private readonly lockedSet: ReadonlySet<string>;
  /** The state at the last room entry (JSON). */
  private checkpointJson = '';
  /** Door transitions wait this long after an entry (s). */
  private doorCooldown = 0;
  /** "Needs a key" notice cooldown (s). */
  private deniedT = 0;
  /** A wave is running in this room (its end = a clear, or the next challenge wave). */
  private fighting = false;
  /** Markers of the current room (parseRoomLayout order). */
  private markers: RoomMarker[] = [];

  private constructor(host: RunHost, data: RunData) {
    this.host = host;
    this.data = data;
    this.lockedSet = new Set(data.locked);
    host.world.onSecretWallBombed = (x, y) => this.onBombed(x, y);
  }

  /** A new run on its first floor. */
  static start(host: RunHost, seed: number, character: string, opts: RunOptions = {}): Run {
    const floor = Math.max(1, Math.min(LAST_FLOOR, Math.floor(opts.floor ?? 1)));
    const track = opts.track ?? 'main';
    const curseMode = curseModeOf(opts.curse);
    const locked = [...(opts.lockedItems ?? [])].sort();
    const f = makeFloor(seed, floor, track, curseMode, new Set(locked));
    const data: RunData = {
      v: RUN_SNAPSHOT_VERSION,
      seed,
      character,
      floor,
      track,
      chapter: f.chapter,
      curseMode,
      locked,
      layout: f.layout,
      map: f.map,
      rooms: f.rooms,
      nook: f.nook,
      current: f.layout.start,
      entrySide: -1,
      floorStartPending: true,
      tookDamage: false,
      hurtsAtFloor: host.world.counters.hurts,
      time: 0,
      stats: { roomsVisited: 0, roomsCleared: 0, floorsCleared: 0, secretsFound: 0, keysUsed: 0 },
      won: 0,
    };
    const run = new Run(host, data);
    run.checkpoint();
    run.enterCurrent();
    return run;
  }

  /**
   * Resumes from a snapshot. The world and player must already be restored from it (the Sim does
   * that); this re-enters the room exactly as the original did.
   */
  static restore(host: RunHost, snap: RunSnapshot): Run {
    const run = new Run(host, snap.run);
    run.checkpointJson = JSON.stringify(snap);
    run.enterCurrent();
    return run;
  }

  get world(): World {
    return this.host.world;
  }

  get room(): FloorRoom {
    return this.data.layout.rooms[this.data.current]!;
  }

  get state(): RoomState {
    return this.data.rooms[this.data.current]!;
  }

  /** The run as it was when the player entered the current room (JSON-safe, a fresh copy). */
  snapshot(): RunSnapshot {
    return JSON.parse(this.checkpointJson) as RunSnapshot;
  }

  private checkpoint(): void {
    const w = this.host.world;
    const snap: RunSnapshot = { v: RUN_SNAPSHOT_VERSION, run: this.data, world: captureWorld(w), player: capturePlayer(w) };
    this.checkpointJson = JSON.stringify(snap);
  }

  // ── Floors ────────────────────────────────────────────────────────────────

  private startFloor(floor: number, track: FloorTrack): void {
    const d = this.data;
    const f = makeFloor(d.seed, floor, track, d.curseMode, this.lockedSet);
    d.floor = floor;
    d.track = track;
    d.chapter = f.chapter;
    d.layout = f.layout;
    d.map = f.map;
    d.rooms = f.rooms;
    d.nook = f.nook;
    d.current = f.layout.start;
    d.entrySide = -1;
    d.floorStartPending = true;
    d.tookDamage = false;
    d.hurtsAtFloor = this.host.world.counters.hurts;
    this.checkpoint();
    this.enterCurrent();
  }

  /** Drops through the trapdoor: the next floor on the same track (the last floor's boss wins the run). */
  private descend(): void {
    const w = this.host.world;
    const d = this.data;
    d.stats.floorsCleared++;
    w.events.emit('trapdoor', w.trapdoor.x, w.trapdoor.y, 1, d.floor);
    w.events.emit('sfx', w.trapdoor.x, w.trapdoor.y, 0, 0, 'trapdoor');
    if (d.floor >= LAST_FLOOR) {
      d.won = 1;
      w.trapdoor.reset();
      w.events.emit('runEnd', w.player.x, w.player.y, 1, d.floor);
      return;
    }
    this.saveRoom();
    this.startFloor(d.floor + 1, d.track);
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  /** Builds the current room from its template and state, places the player, starts its wave. */
  private enterCurrent(): void {
    const w = this.host.world;
    const d = this.data;
    const idx = d.current;
    const room = this.room;
    const st = this.state;
    w.chapter = d.chapter;
    w.curse = d.layout.curse;
    w.room.styleSeed = hashString(`${d.seed}:${d.floor}:${idx}`);
    const tpl = templateById(room.templateId);
    this.markers = this.host.loadRoom(tpl ? templateGrid(tpl, room.flip) : EMPTY_ROOM, []);
    if (st.grid) decodeGrid(st.grid, w.room);

    const p = w.player;
    const side = d.entrySide;
    if (side >= 0) p.placeAt(DOOR_FRONT_X[side]!, DOOR_FRONT_Y[side]!);
    else this.placeNearCentre();
    respawnFamiliars(w);
    // First, so presentation can reset (particles, camera) before the room's own spawn events.
    w.events.emit('roomEnter', p.x, p.y, idx, side, room.type);

    // Inside a secret room every hidden wall is a door you know about.
    if (room.secret) {
      for (let s = 0; s < 4; s++) if ((room.secretDoors & DIR_BITS[s]!) !== 0) this.openDoorBit(idx, s);
    }

    if (st.pickups === null) this.spawnContents(room, st);
    else this.restoreEntities(st);

    w.trapdoor.reset();
    if (st.trapdoor) this.placeTrapdoor(TRAPDOOR_OPEN_TIME);

    this.fighting = false;
    if (!st.cleared) this.startRoomWave(room, st);

    this.updateDoors();
    for (const s of w.doors.slots) s.anim = 1;
    if (!st.visited) {
      st.visited = true;
      d.stats.roomsVisited++;
    }
    mapEnterRoom(d.map, d.layout, idx);
    w.safeT = RUN_TUNING.entrySafe;
    this.doorCooldown = RUN_TUNING.doorCooldown;
    if (d.floorStartPending) {
      d.floorStartPending = false;
      floorStarted(w);
      w.events.emit('floorStart', p.x, p.y, d.floor, chapterNumber(chapterFor(d.floor, d.track)), d.chapter);
    }
  }

  /** The player in the middle of the room (the nearest walkable tile to the centre). */
  private placeNearCentre(): void {
    const w = this.host.world;
    let best = Infinity;
    let bx = cellCenterX(6);
    let by = cellCenterY(3);
    for (let row = 0; row < ROOM_ROWS; row++) {
      for (let col = 0; col < ROOM_COLS; col++) {
        if (w.room.get(col, row) !== Tile.Floor) continue;
        const dd = Math.abs(col - 6) + Math.abs(row - 3) * 1.2;
        if (dd < best) {
          best = dd;
          bx = cellCenterX(col);
          by = cellCenterY(row);
        }
      }
    }
    w.player.placeAt(bx, by);
  }

  /** First visit: pickups, chests, pedestals and shop stock from the pre-rolls. */
  private spawnContents(room: FloorRoom, st: RoomState): void {
    const w = this.host.world;
    let pi = 0;
    let ci = 0;
    let ii = 0;
    let si = 0;
    const deferRewards = room.type === 'challenge';
    for (const m of this.markers) {
      const x = cellCenterX(m.col);
      const y = cellCenterY(m.row);
      if (m.ch === 'p') {
        const name = st.loot[pi++];
        if (name) spawnPickup(w, pickupKindOf(name), x, y, false);
      } else if (m.ch === 'c') {
        const name = st.chests[ci++];
        if (name && !deferRewards) spawnPickup(w, pickupKindOf(name), x, y, false);
      } else if (m.ch === 'i') {
        const i = ii++;
        if (!deferRewards) this.itemPedestal(x, y, st.items[i] ?? '', 0, st.hearts[i] ?? 0);
      } else if (m.ch === 'S') {
        const i = si++;
        this.itemPedestal(x, y, st.shop[i] ?? '', st.prices[i] ?? 0, 0);
      }
    }
  }

  /** Challenge rooms: the reward appears once the last wave falls. */
  private spawnRewards(st: RoomState): void {
    const w = this.host.world;
    let ci = 0;
    let ii = 0;
    for (const m of this.markers) {
      const x = cellCenterX(m.col);
      const y = cellCenterY(m.row);
      if (m.ch === 'c') {
        const name = st.chests[ci++];
        if (name) spawnPickup(w, pickupKindOf(name), x, y, true);
      } else if (m.ch === 'i') {
        const i = ii++;
        if (this.itemPedestal(x, y, st.items[i] ?? '', 0, 0)) w.events.emit('pedestalRoll', x, y - 16, 1, 0, st.items[i] ?? '');
      }
    }
  }

  private itemPedestal(x: number, y: number, item: string, price: number, hearts: number): boolean {
    if (!item) return false;
    const ped = spawnPedestal(this.host.world, x, y, item);
    if (!ped) return false;
    ped.price = price;
    ped.hearts = hearts;
    return true;
  }

  /** Revisit: what was left lying around when the player walked out. */
  private restoreEntities(st: RoomState): void {
    const w = this.host.world;
    for (const s of st.pickups ?? []) {
      const pk = spawnPickup(w, s.k as PickupKind, s.x, s.y, false, s.item, s.fresh);
      if (pk) pk.opened = s.opened;
    }
    for (const s of st.pedestals ?? []) {
      const ped = spawnPedestal(w, s.x, s.y, s.item);
      if (!ped) continue;
      ped.charge = s.charge;
      ped.fresh = s.fresh;
      ped.price = s.price;
      ped.hearts = s.hearts;
    }
  }

  /** Remembers the room being left: tiles, pickups, pedestals. */
  private saveRoom(): void {
    const w = this.host.world;
    const st = this.state;
    st.grid = encodeGrid(w.room);
    st.pickups = [];
    for (let i = 0; i < w.pickups.count; i++) {
      const k = w.pickups.items[i]!;
      st.pickups.push({ k: k.kind, x: k.x, y: k.y, item: k.itemId, fresh: k.fresh, opened: k.opened });
    }
    st.pedestals = [];
    for (let i = 0; i < w.pedestals.count; i++) {
      const s = w.pedestals.items[i]!;
      if (s.bell) continue;
      st.pedestals.push({ x: s.x, y: s.y, item: s.item, charge: s.charge, fresh: s.fresh, price: s.price, hearts: s.hearts });
    }
  }

  /** Spawns the room's next wave (placeholder boss in boss / miniboss rooms). None = the room is clear. */
  private startRoomWave(room: FloorRoom, st: RoomState): void {
    const w = this.host.world;
    const R = RUN_TUNING;
    const spawns: FixedSpawn[] = [];
    const bossRoom = room.type === 'boss' || room.type === 'miniboss';
    if (bossRoom) {
      const def = st.boss ? findEnemy(st.boss) : undefined;
      if (def) {
        let x = TRAPDOOR_X;
        let y = TRAPDOOR_Y;
        for (const m of this.markers) {
          if (m.ch === 'B') {
            x = cellCenterX(m.col);
            y = cellCenterY(m.row);
          }
        }
        const big = room.type === 'boss';
        const raw = def.hp * (big ? R.bossHpMul : R.minibossHpMul);
        const hp = Math.max(big ? R.bossHpMin : R.minibossHpMin, Math.min(big ? R.bossHpMax : R.minibossHpMax, raw));
        spawns.push({
          id: def.id,
          x,
          y,
          champion: false,
          hp: Math.round(hp * (1 + R.bossHpPerFloor * (this.data.floor - 1))),
          scale: big ? R.bossScale : R.minibossScale,
        });
      }
    } else if (st.wave < st.waves.length) {
      const ids = st.waves[st.wave]!;
      const champs = st.champs[st.wave] ?? [];
      let k = 0;
      for (const m of this.markers) {
        if (m.ch !== 'e' && m.ch !== 'E') continue;
        const id = ids[k];
        const champ = champs[k];
        k++;
        if (id) spawns.push({ id, x: cellCenterX(m.col), y: cellCenterY(m.row), champion: champ ? champ : true });
      }
    }
    if (spawns.length === 0) {
      st.cleared = true;
      return;
    }
    w.arena.reward = bossRoom || st.wave >= st.waves.length - 1;
    if (startWave(w, { spawns }) === 0) {
      st.cleared = true;
      return;
    }
    this.fighting = true;
  }

  /** The running wave died out: the next challenge wave, or the room is clear. */
  private onWaveCleared(): void {
    const room = this.room;
    const st = this.state;
    const bossRoom = room.type === 'boss' || room.type === 'miniboss';
    if (!bossRoom && st.wave + 1 < st.waves.length) {
      st.wave++;
      this.startRoomWave(room, st);
      if (this.fighting) return;
    }
    st.wave = st.waves.length;
    st.cleared = true;
    this.data.stats.roomsCleared++;
    if (room.type === 'challenge') this.spawnRewards(st);
    if (room.type === 'boss') this.bossDefeated(st);
    this.updateDoors();
  }

  private placeTrapdoor(age: number): void {
    const t = this.host.world.trapdoor;
    t.active = true;
    t.x = TRAPDOOR_X;
    t.y = TRAPDOOR_Y;
    t.t = age;
  }

  /** The boss fell: trapdoor, reward item, maybe the Broker's Nook. */
  private bossDefeated(st: RoomState): void {
    const w = this.host.world;
    const d = this.data;
    st.trapdoor = true;
    this.placeTrapdoor(0);
    w.events.emit('trapdoor', TRAPDOOR_X, TRAPDOOR_Y, 0, d.floor);
    w.events.emit('sfx', TRAPDOOR_X, TRAPDOOR_Y, 0, 0, 'stairs');
    if (st.reward) {
      const spot = this.rewardSpot();
      if (this.itemPedestal(spot.x, spot.y, st.reward, 0, 0)) {
        w.events.emit('pedestalRoll', spot.x, spot.y - 16, 1, 0, st.reward);
      }
      st.reward = '';
    }
    // The Broker's Nook (likelier after a clean floor).
    const layout = d.layout;
    const roll = floorRng(d.seed, d.floor, d.track).fork('nook').next();
    const chance = d.tookDamage ? RUN_TUNING.nookChanceHurt : RUN_TUNING.nookChanceClean;
    if (layout.nook.room < 0 && layout.nook.templateId && roll < chance) {
      const n = openNook(layout);
      while (d.rooms.length < n) d.rooms.push(emptyRoomState());
      d.rooms[n] = d.nook;
      discoverRoom(d.map, layout, n);
      const side = layout.nook.side;
      w.events.emit('secretFound', DOOR_X[side]!, DOOR_Y[side]!, side, 2);
      w.events.emit('sfx', DOOR_X[side]!, DOOR_Y[side]!, 0, 0, 'secret_found');
    }
  }

  /** Free plain floor near the top of the centre (never the trapdoor tile), its upper cell free for the icon. */
  private rewardSpot(): { x: number; y: number } {
    const g = this.host.world.room;
    let best = Infinity;
    let bx = cellCenterX(6);
    let by = cellCenterY(1);
    for (let row = 1; row < ROOM_ROWS; row++) {
      for (let col = 0; col < ROOM_COLS; col++) {
        if (col === 6 && row === 3) continue;
        if (g.get(col, row) !== Tile.Floor || g.get(col, row - 1) === Tile.Rock) continue;
        const dd = Math.abs(col - 6) * 1.1 + Math.abs(row - 2);
        if (dd < best) {
          best = dd;
          bx = cellCenterX(col);
          by = cellCenterY(row);
        }
      }
    }
    return { x: bx, y: by };
  }

  // ── Doors ─────────────────────────────────────────────────────────────────

  /** Rebuilds the four door slots from the layout and the room state. */
  private updateDoors(): void {
    const w = this.host.world;
    const d = this.data;
    const idx = d.current;
    const room = this.room;
    const st = this.state;
    const seeAll = w.player.flags.seeSecrets;
    w.doors.enabled = true;
    for (let side = 0; side < 4; side++) {
      const slot = w.doors.slots[side]!;
      const bit = DIR_BITS[side]!;
      const to = (room.doors & bit) !== 0 ? neighborRoom(d.layout, idx, side) : -1;
      if (to < 0) {
        slot.kind = DK.None;
        slot.to = -1;
        slot.state = DS.Open;
        slot.hint = false;
        slot.deep = false;
        continue;
      }
      const other = d.layout.rooms[to]!;
      const secret = (room.secretDoors & bit) !== 0;
      const opened = (st.opened & bit) !== 0;
      slot.to = to;
      slot.kind = secret ? DK.Secret : doorKindBetween(room.type, other.type);
      slot.state = secret && !opened ? DS.Hidden : (room.lockedDoors & bit) !== 0 && !opened ? DS.Locked : DS.Open;
      slot.hint = secret && !opened && ((room.hints & bit) !== 0 || seeAll);
      slot.deep = other.type === 'deepSecret';
    }
    w.doors.version++;
  }

  /** Opens a door for good on both sides (a lock opened, a secret wall blasted). */
  private openDoorBit(idx: number, side: number): void {
    const d = this.data;
    d.rooms[idx]!.opened |= DIR_BITS[side]!;
    const nb = neighborRoom(d.layout, idx, side);
    if (nb >= 0 && d.rooms[nb]) d.rooms[nb]!.opened |= DIR_BITS[DIR_OPPOSITE[side]!]!;
  }

  /** Is the player walking into the doorway of `side`? */
  private pushing(side: number, input: InputState): boolean {
    const p = this.host.world.player;
    const R = RUN_TUNING;
    const edge = p.r + 1.5;
    switch (side) {
      case 0:
        return input.moveY < -R.doorPush && p.y <= edge && Math.abs(p.x - DOOR_X[0]!) <= R.doorReach;
      case 1:
        return input.moveX > R.doorPush && p.x >= ROOM_W - edge && Math.abs(p.y - DOOR_Y[1]!) <= R.doorReach;
      case 2:
        return input.moveY > R.doorPush && p.y >= ROOM_H - edge && Math.abs(p.x - DOOR_X[2]!) <= R.doorReach;
      default:
        return input.moveX < -R.doorPush && p.x <= edge && Math.abs(p.y - DOOR_Y[3]!) <= R.doorReach;
    }
  }

  /**
   * Uses the door on `side` as if the player walked into it: a locked door takes a key (and stays
   * shut this call), an open one leads to the next room. Returns true if the room changed.
   */
  goThroughDoor(side: number): boolean {
    const w = this.host.world;
    if (w.arena.active || w.player.dead || this.data.won) return false;
    const slot = w.doors.slots[side];
    if (!slot || slot.kind === DK.None || slot.state === DS.Hidden) return false;
    if (slot.state === DS.Locked) {
      this.tryUnlock(side);
      return false;
    }
    return this.transition(side);
  }

  private tryUnlock(side: number): boolean {
    const w = this.host.world;
    const inv = w.player.inv;
    const slot = w.doors.slots[side]!;
    const x = DOOR_X[side]!;
    const y = DOOR_Y[side]!;
    if (inv.keys <= 0) {
      if (this.deniedT <= 0) {
        this.deniedT = RUN_TUNING.deniedCooldown;
        w.events.emit('denied', x, y, 0, 0, 'locked');
      }
      return false;
    }
    addCounter(inv, 'keys', -1);
    inv.version++;
    this.openDoorBit(this.data.current, side);
    slot.state = DS.Open;
    slot.anim = 0;
    w.doors.version++;
    this.data.stats.keysUsed++;
    w.events.emit('doorUnlock', x, y, side);
    w.events.emit('sfx', x, y, 0, 0, 'door_unlock');
    return true;
  }

  private transition(side: number): boolean {
    const w = this.host.world;
    const d = this.data;
    const slot = w.doors.slots[side]!;
    let dest = slot.to;
    let destSide = DIR_OPPOSITE[side]!;
    if (dest < 0) return false;
    // Curse of the Maze: now and then a door leads somewhere else you've been.
    if (w.curse === 'maze' && slot.kind !== DK.Secret && w.combatRng.next() < RUN_TUNING.mazeChance) {
      const options: number[] = [];
      for (let i = 0; i < d.rooms.length; i++) {
        const r = d.layout.rooms[i];
        if (i !== d.current && i !== dest && r && !r.secret && d.rooms[i]!.visited) options.push(i);
      }
      if (options.length > 0) {
        dest = options[w.combatRng.int(0, options.length - 1)]!;
        destSide = firstDoorSide(d.layout.rooms[dest]!);
        w.events.emit('say', w.player.x, w.player.y, 0, 0, 'THE MAZE SHIFTS...');
        w.events.emit('sfx', w.player.x, w.player.y, 0, 0, 'teleport');
      }
    }
    // Thorn Room doors bite (both ways).
    if (slot.kind === DK.Cursed) {
      this.payToll();
      if (w.player.dead) return false;
    }
    this.saveRoom();
    d.current = dest;
    d.entrySide = destSide;
    this.checkpoint();
    this.enterCurrent();
    return true;
  }

  /** Half a heart for passing a spiked Thorn Room door (i-frames don't help; god mode does). */
  private payToll(): void {
    const w = this.host.world;
    if (w.godMode) return;
    w.player.invuln = 0;
    w.safeT = 0;
    damagePlayer(w, 1, DMG_SPIKES);
    w.events.emit('sfx', w.player.x, w.player.y, 0, 0, 'spikes');
  }

  /** World.onSecretWallBombed: an explosion reached a wall slot. */
  private onBombed(x: number, y: number): void {
    const w = this.host.world;
    const side = y <= 0 ? 0 : y >= ROOM_H ? 2 : x <= 0 ? 3 : x >= ROOM_W ? 1 : -1;
    if (side < 0) return;
    const slot = w.doors.slots[side]!;
    if (slot.kind === DK.None || slot.state !== DS.Hidden) return;
    const d = this.data;
    this.openDoorBit(d.current, side);
    slot.state = DS.Open;
    slot.hint = false;
    slot.anim = 0;
    w.doors.version++;
    discoverRoom(d.map, d.layout, slot.to);
    d.stats.secretsFound++;
    w.events.emit('secretFound', DOOR_X[side]!, DOOR_Y[side]!, side, slot.deep ? 1 : 0);
    w.events.emit('sfx', DOOR_X[side]!, DOOR_Y[side]!, 0, 0, 'secret_found');
  }

  // ── Per tick ──────────────────────────────────────────────────────────────

  /** End of every Sim tick: clears, trapdoor, doors. */
  update(input: InputState, dt: number): void {
    const w = this.host.world;
    const d = this.data;
    const p = w.player;
    d.time += dt;
    w.doors.update(dt);
    if (w.trapdoor.active) w.trapdoor.t += dt;
    if (this.deniedT > 0) this.deniedT -= dt;
    if (this.doorCooldown > 0) this.doorCooldown -= dt;
    if (!d.tookDamage && w.counters.hurts !== d.hurtsAtFloor) d.tookDamage = true;
    if (p.dead || d.won) return;
    if (this.fighting && !w.arena.active) {
      this.fighting = false;
      this.onWaveCleared();
    }
    const t = w.trapdoor;
    if (t.active && !w.arena.active) {
      const R = RUN_TUNING.trapdoorReach;
      const d2 = (p.x - t.x) * (p.x - t.x) + (p.y - t.y) * (p.y - t.y);
      if (!t.armed) {
        if (d2 > (R + 6) * (R + 6)) t.armed = true;
      } else if (t.t >= TRAPDOOR_OPEN_TIME && d2 < R * R) {
        this.descend();
        return;
      }
    }
    if (w.arena.active || this.doorCooldown > 0) return;
    for (let side = 0; side < 4; side++) {
      if (this.pushing(side, input)) {
        this.goThroughDoor(side);
        return;
      }
    }
  }

  // ── Debug / tools ─────────────────────────────────────────────────────────

  /** Debug: jumps into any room (walking in through its first door, like a visitor would). */
  teleport(room: number): void {
    const d = this.data;
    const r = d.layout.rooms[room];
    if (!r || !d.rooms[room]) return;
    this.saveRoom();
    d.current = room;
    d.entrySide = firstDoorSide(r);
    this.checkpoint();
    this.enterCurrent();
  }

  /** Debug: straight to the next floor. */
  skipFloor(): void {
    if (this.data.won) return;
    this.descend();
  }

  /** Debug: the whole map (secret rooms included). */
  revealMap(): void {
    revealMap(this.data.map, this.data.layout, 'full');
  }

  /** Debug: sets (or lifts, null) the current floor's curse. */
  setCurse(c: FloorCurse | null): void {
    const d = this.data;
    d.layout.curse = c;
    this.host.world.curse = c;
    setLostMap(d.map, c === 'lostMap');
  }

  summary(): RunSummary {
    const d = this.data;
    const w = this.host.world;
    let visited = 0;
    for (const r of d.rooms) if (r.visited) visited++;
    return {
      floor: d.floor,
      track: d.track,
      chapter: d.chapter,
      room: d.current,
      roomType: this.room.type,
      cleared: this.state.cleared,
      curse: d.layout.curse,
      rooms: d.layout.rooms.length,
      visited,
      doors: w.doors.slots.map((s, side) => ({ side, kind: s.kind, state: s.state, to: s.to })),
      trapdoor: w.trapdoor.active,
      won: d.won === 1,
      time: d.time,
      stats: { ...d.stats },
    };
  }
}

/** The first side with a regular (not hidden) door: where a maze-shuffled player walks in. */
function firstDoorSide(r: FloorRoom): number {
  for (let s = 0; s < 4; s++) {
    const bit = DIR_BITS[s]!;
    if ((r.doors & bit) !== 0 && (r.secretDoors & bit) === 0) return s;
  }
  return -1;
}

/** Generates and fills one floor: layout, templates, contents, minimap. */
function makeFloor(seed: number, floor: number, track: FloorTrack, curseMode: string, locked: ReadonlySet<string>) {
  const chapter = chapterFor(floor, track);
  const opts: FloorGenOptions = { allowAltNext: false };
  if (curseMode === 'roll') {
    opts.curses = true;
    if (chapter.curses && chapter.curses.length > 0) opts.cursePool = chapter.curses;
  } else {
    opts.forceCurse = curseMode === 'none' ? null : (curseMode as FloorCurse);
  }
  const layout = generateFloor(seed, floor, track, opts);
  pickTemplates(layout, ROOM_TEMPLATES, chapter.id, templateRng(seed, floor, track));
  const { rooms, nook } = rollFloorContents(layout, chapter.id, locked, RUN_TUNING.challengeWaves);
  return { chapter: chapter.id, layout, map: createMinimap(layout), rooms, nook };
}
