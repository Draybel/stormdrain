/**
 * A real run (ARCHITECTURE §6b): floors from the generator, rooms from templates, doors, room
 * transitions, clears, bosses, special rooms, the trapdoor, hidden routes, endings, curses and run
 * snapshots. Headless, owned by the Sim (`sim.run`), stepped at the end of every Sim tick.
 *
 * Flow of a room change (walking into an open door, the trapdoor, debug teleports):
 *   decide the destination (Curse of the Maze may reroute) → pay a Thorn Room toll → save the room
 *   being left (tiles, pickups, pedestals) → `data.current` = destination → CHECKPOINT → enterCurrent().
 * The checkpoint (a JSON string of RunData + world + player) is what `snapshot()` returns: restoring
 * runs the very same enterCurrent() from the very same state, so play continues identically.
 * Everything that happens on entry (spawns, the floorStart trigger…) therefore lives in enterCurrent.
 *
 * Routes (DESIGN "Hidden routes"): boss trapdoors keep the track; a cracked drain grate (secret room,
 * or the boss room after the boss — bomb it open) drops to the ALT track. The alt route into chapter 6
 * needs 'ending1' unlocked (without it the alt track rejoins the main one there). A final boss ends the
 * run with its ending — unless 'ending1' and 'ending2' are unlocked: then a whirlpool (floor 13, The
 * Undertow) and a skylight (the ending) appear.
 */

import type { InputState } from '../../engine/inputState';
import { floorRng, hashString } from '../../engine/rng';
import { BOSSES, findEnemy } from '../../content/registry';
import { beginWave, startWave, type FixedSpawn } from '../arena';
import { respawnFamiliars } from '../attack/familiars';
import { spawnBoss } from '../bosses/brain';
import { DMG_SPIKES, damagePlayer } from '../combat';
import { ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W } from '../constants';
import { DK, DOOR_FRONT_X, DOOR_FRONT_Y, DOOR_X, DOOR_Y, DS, TRAPDOOR_OPEN_TIME, type DoorKind } from '../doors';
import { floorStarted } from '../effects';
import { UNDERTOW_FLOOR, generateFloor, neighborRoom, openNook, templateRng } from '../floor/generate';
import { ROOM_TEMPLATES } from '../floor/library';
import { createMinimap, discoverRoom, enterRoom as mapEnterRoom, revealMap, setLostMap } from '../floor/minimap';
import { pickTemplates, templateGrid } from '../floor/templates';
import {
  DIR_BITS,
  DIR_OPPOSITE,
  type FinalBossKey,
  type FloorCurse,
  type FloorGenOptions,
  type FloorRoom,
  type FloorTrack,
  type RoomType,
} from '../floor/types';
import { addCounter } from '../inventory';
import { spawnGoods, spawnPedestal, spawnProp, type Pedestal } from '../pedestals';
import { PK, pickupKindOf, type PickupKind } from '../pickupKinds';
import { spawnDrops, spawnPickup } from '../pickups';
import { cellCenterX, cellCenterY, type RoomGrid, type RoomMarker } from '../room';
import type { RoomSpawn } from '../roomSpawns';
import type { FloorThing } from '../roomProps';
import { NPC_BROKER, NPC_MAGPIE } from '../roomProps';
import { PROP_JAR, PROP_SLOTS, PROP_TRADER, breakSlots } from '../shopProps';
import { Tile } from '../tiles';
import { RUN_TUNING, SHOP_TUNING } from '../tuning';
import type { World } from '../world';
import { chapterFor, chapterNumber } from './chapters';
import { EMPTY_ROOM, emptyRoomState, rollFloorContents, templateById } from './contents';
import { lockedItemIds } from './pools';
import { capturePlayer, captureWorld } from './snapshot';
import {
  CORNER_PREFS,
  GRATE_PREFS,
  JAR_PREFS,
  NPC_WALL_X,
  SKYLIGHT_PREFS,
  WHIRLPOOL_PREFS,
  cellX,
  cellY,
  floorCell,
  npcLine,
  solidPropCell,
} from './special';
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
  /** The ending reached (0 none). */
  ending: number;
  time: number;
  stats: RunStats;
  /** This room's special state: the arena plate (0 wait / 1 fighting / 2 done), the grate, the exits. */
  plate: number;
  grate: number;
  exits: number;
  /** The room's boss id ('' none). */
  boss: string;
}

/** Last floor of a route; floor 13 (The Undertow) comes after it through the whirlpool. */
const LAST_FLOOR = 12;

const TRAPDOOR_X = cellCenterX(6);
const TRAPDOOR_Y = cellCenterY(3);

/** The ending each final boss gives. */
export const ENDING_OF: Readonly<Record<FinalBossKey, number>> = { thunderhead: 1, nestmother: 2, undertow: 3 };

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
  private readonly unlockedSet: ReadonlySet<string>;
  /** Mirror of data.seen for quick lookups. */
  private readonly seenSet: Set<string>;
  /** The state at the last room entry (JSON). */
  private checkpointJson = '';
  /** Door transitions wait this long after an entry (s). */
  private doorCooldown = 0;
  /** "Needs a key" notice cooldown (s). */
  private deniedT = 0;
  /** A wave is running in this room (its end = a clear, or the next challenge wave). */
  private fighting = false;
  /** Rain Barrel Arena: seconds until the next wave. */
  private pendingWaveT = 0;
  /** Markers of the current room (parseRoomLayout order). */
  private markers: RoomMarker[] = [];

  private constructor(host: RunHost, data: RunData) {
    this.host = host;
    this.data = data;
    this.lockedSet = new Set(data.locked);
    this.unlockedSet = new Set(data.unlocked);
    this.seenSet = new Set(data.seen);
    host.world.lockedItems = this.lockedSet;
    host.world.onSecretWallBombed = (x, y) => this.onBombed(x, y);
    host.world.onExplosion = (x, y, r) => this.onExplosion(x, y, r);
  }

  /** A new run on its first floor. */
  static start(host: RunHost, seed: number, character: string, opts: RunOptions = {}): Run {
    const floor = Math.max(1, Math.min(UNDERTOW_FLOOR, Math.floor(opts.floor ?? 1)));
    const track = opts.track ?? 'main';
    const curseMode = curseModeOf(opts.curse);
    const unlocked = [...new Set(opts.unlocked ?? [])].sort();
    const locked = lockedItemIds(new Set(unlocked), opts.lockedItems ?? []);
    // What she starts with is already "seen" (never offered again).
    const inv = host.world.player.inv;
    const seen = [...new Set([...inv.passives, ...(inv.active ? [inv.active.id] : []), ...inv.trinkets, ...inv.consumables])];
    const f = makeFloor(seed, floor, track, curseMode, new Set(locked), new Set(seen), new Set(unlocked));
    const data: RunData = {
      v: RUN_SNAPSHOT_VERSION,
      seed,
      character,
      floor,
      track,
      chapter: f.chapter,
      curseMode,
      locked,
      unlocked,
      seen,
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
      stats: { roomsVisited: 0, roomsCleared: 0, floorsCleared: 0, secretsFound: 0, keysUsed: 0, bossesBeaten: 0 },
      won: 0,
      ending: 0,
    };
    if (opts.seedInfo) data.seedInfo = { ...opts.seedInfo };
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

  /** Is an unlock (item id, 'ending1', 'ending2'…) in the run's meta snapshot? */
  unlocked(id: string): boolean {
    return this.unlockedSet.has(id);
  }

  /** The whirlpool to floor 13 opens after a final boss once both route endings are unlocked. */
  get whirlpoolOpen(): boolean {
    return this.unlockedSet.has('ending1') && this.unlockedSet.has('ending2');
  }

  /** Has this item been shown / taken this run (pools leave it out)? */
  seen(id: string): boolean {
    return this.seenSet.has(id);
  }

  private markSeen(id: string): void {
    if (!id || this.seenSet.has(id)) return;
    this.seenSet.add(id);
    this.data.seen.push(id);
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
    const f = makeFloor(d.seed, floor, track, d.curseMode, this.lockedSet, this.seenSet, this.unlockedSet);
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

  /** The track of the next floor for a trapdoor (the alt route rejoins the main one at chapter 6 without Ending 1). */
  trackAfter(floor: number, track: FloorTrack): FloorTrack {
    if (track === 'alt' && floor + 1 >= 11 && floor + 1 <= LAST_FLOOR && !this.unlockedSet.has('ending1')) return 'main';
    return track;
  }

  /** Drops to the next floor (the trapdoor keeps the track, the grate goes to the alt one). */
  private descend(track: FloorTrack, x: number, y: number, via: string): void {
    const w = this.host.world;
    const d = this.data;
    d.stats.floorsCleared++;
    w.events.emit('trapdoor', x, y, 1, d.floor, via);
    w.events.emit('sfx', x, y, 0, 0, 'trapdoor');
    this.saveRoom();
    this.startFloor(d.floor + 1, track);
  }

  /** The run is won with an ending (a final boss fell / the skylight). */
  private win(ending: number): void {
    const w = this.host.world;
    const d = this.data;
    if (d.won) return;
    d.won = 1;
    d.ending = ending;
    w.trapdoor.reset();
    w.events.emit('runEnd', w.player.x, w.player.y, 1, ending);
  }

  /** The ending this floor's final boss gives (floor 13: 3). */
  private floorEnding(): number {
    const key = this.data.layout.finalBoss;
    return key ? ENDING_OF[key] : this.data.floor >= UNDERTOW_FLOOR ? 3 : 1;
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  /** Builds the current room from its template and state, places the player, starts its wave. */
  private enterCurrent(): void {
    const w = this.host.world;
    const d = this.data;
    const idx = d.current;
    const room = this.room;
    const st = this.state;
    const first = !st.visited;
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
    this.placeFixtures(room, st, first);

    w.trapdoor.reset();
    if (st.trapdoor) this.placeTrapdoor(TRAPDOOR_OPEN_TIME);

    this.fighting = false;
    this.pendingWaveT = 0;
    if (!st.cleared) {
      // The Rain Barrel Arena waits for its pressure plate.
      if (room.type === 'challenge') st.plate = 0;
      else this.startRoomWave(room, st);
    }

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

  /** First visit: pickups, chests, pedestals, shop stock and the room's props from the pre-rolls. */
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
        if (!deferRewards) this.markerItem(x, y, st, i, false);
      } else if (m.ch === 'S') {
        const i = si++;
        const goods = st.goods[i] ?? '';
        if (goods) spawnGoods(w, x, y, pickupKindOf(goods), st.prices[i] ?? 5);
        else if (this.itemPedestal(x, y, st.shop[i] ?? '', st.prices[i] ?? 0, 0)) this.markSeen(st.shop[i] ?? '');
      }
    }
    // A Forgotten Pocket's big loot: scattered around the middle.
    for (let i = 0; i < st.bonus.length; i++) {
      const a = (i / st.bonus.length) * Math.PI * 2;
      spawnPickup(w, pickupKindOf(st.bonus[i]!), cellCenterX(6) + Math.cos(a) * 20, cellCenterY(3) + Math.sin(a) * 14, false);
    }
    // Props on pedestal slots (saved with the room from now on).
    const taken: number[] = [];
    if (room.type === 'shop') {
      const cell = solidPropCell(w, this.markers, JAR_PREFS, taken);
      if (cell >= 0) {
        spawnProp(w, cellX(cell), cellY(cell), PROP_JAR);
        taken.push(cell);
      }
    }
    const corners = CORNER_PREFS[(this.data.current + this.data.floor) & 3]!;
    if (st.trader) {
      const cell = solidPropCell(w, this.markers, corners, taken);
      if (cell >= 0) {
        const ped = spawnProp(w, cellX(cell), cellY(cell), PROP_TRADER, st.trader);
        if (ped) ped.keys = SHOP_TUNING.traderKeys;
        taken.push(cell);
        this.markSeen(st.trader);
      }
    }
    if (st.slots) {
      const cell = solidPropCell(w, this.markers, corners, taken);
      if (cell >= 0) spawnProp(w, cellX(cell), cellY(cell), PROP_SLOTS);
    }
  }

  /** The i-th 'i' marker's offer: its item (priced in hearts in the nook), or the chest replacing it. */
  private markerItem(x: number, y: number, st: RoomState, i: number, pop: boolean): void {
    const w = this.host.world;
    const alt = st.alts[i] ?? '';
    if (alt) {
      spawnPickup(w, pickupKindOf(alt), x, y, pop);
      return;
    }
    const item = st.items[i] ?? '';
    const ped = this.itemPedestal(x, y, item, 0, st.hearts[i] ?? 0);
    if (!ped) return;
    this.markSeen(item);
    if (st.choice) ped.group = 1;
    if (pop) w.events.emit('pedestalRoll', x, y - 16, 1, 0, item);
  }

  /**
   * Every entry: the room's non-pedestal fixtures — wall NPCs, the arena's plate, the hidden-route
   * grate, the whirlpool / skylight after a final boss — and the NPC's greeting on the first visit.
   */
  private placeFixtures(room: FloorRoom, st: RoomState, first: boolean): void {
    const w = this.host.world;
    const pr = w.props;
    const salt = this.data.seed + this.data.floor * 7 + this.data.current;
    if (room.type === 'shop') {
      pr.npc = NPC_MAGPIE;
      pr.npcX = NPC_WALL_X;
      if (first) w.events.emit('npcSay', pr.npcX, -8, 0, 0, npcLine('magpie', salt));
    } else if (room.type === 'nook') {
      pr.npc = NPC_BROKER;
      pr.npcX = NPC_WALL_X;
      if (first) w.events.emit('npcSay', pr.npcX, -8, 0, 0, npcLine('broker', salt));
    } else if (st.trader && first) {
      w.events.emit('npcSay', ROOM_W / 2, 0, 0, 0, npcLine('pell', salt));
    }
    if (room.type === 'challenge' && !st.cleared) pr.plate.place(cellCenterX(6), cellCenterY(3), 0);
    else if (room.type === 'challenge') pr.plate.place(cellCenterX(6), cellCenterY(3), 1);
    // The grate: in a secret room at once, in the boss room once the boss is down.
    if (st.grate > 0 && (room.type !== 'boss' || st.trapdoor)) this.placeGrate(st);
    if (st.exits > 0) this.placeExits();
  }

  private placeGrate(st: RoomState): void {
    const w = this.host.world;
    const cell = floorCell(w, this.markers, GRATE_PREFS, [ROOM_COLS * 3 + 6]);
    if (cell < 0) return;
    w.props.grate.place(cellX(cell), cellY(cell), st.grate === 2 ? 1 : 0);
  }

  private placeExits(): void {
    const w = this.host.world;
    const trap = ROOM_COLS * 3 + 6;
    const a = floorCell(w, this.markers, WHIRLPOOL_PREFS, [trap]);
    const b = floorCell(w, this.markers, SKYLIGHT_PREFS, [trap, a]);
    if (a >= 0) w.props.whirlpool.place(cellX(a), cellY(a));
    if (b >= 0) w.props.skylight.place(cellX(b), cellY(b));
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
        this.markerItem(x, y, st, ii++, true);
      }
    }
  }

  private itemPedestal(x: number, y: number, item: string, price: number, hearts: number): Pedestal | null {
    if (!item) return null;
    const ped = spawnPedestal(this.host.world, x, y, item);
    if (!ped) return null;
    ped.price = price;
    ped.hearts = hearts;
    return ped;
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
      ped.keys = s.keys ?? 0;
      ped.goods = s.goods ?? -1;
      ped.group = s.group ?? 0;
      ped.prop = s.prop ?? 0;
      ped.broken = s.broken ?? false;
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
      if (s.bell || s.gone) continue;
      st.pedestals.push({
        x: s.x,
        y: s.y,
        item: s.item,
        charge: s.charge,
        fresh: s.fresh,
        price: s.price,
        hearts: s.hearts,
        keys: s.keys,
        goods: s.goods,
        group: s.group,
        prop: s.prop,
        broken: s.broken,
      });
    }
  }

  /** Spawns the room's next wave (the boss in boss / miniboss rooms). None = the room is clear. */
  private startRoomWave(room: FloorRoom, st: RoomState): void {
    const w = this.host.world;
    const R = RUN_TUNING;
    const spawns: FixedSpawn[] = [];
    const bossRoom = room.type === 'boss' || room.type === 'miniboss';
    if (bossRoom) {
      let x = TRAPDOOR_X;
      let y = TRAPDOOR_Y;
      for (const m of this.markers) {
        if (m.ch === 'B') {
          x = cellCenterX(m.col);
          y = cellCenterY(m.row);
        }
      }
      const bdef = st.boss ? BOSSES.get(st.boss) : undefined;
      if (bdef) {
        // A real boss (sim/bosses): intro card, phases, patterns, HP bar.
        if (spawnBoss(w, bdef, x, y, { hp: st.bossHp > 0 ? st.bossHp : bdef.hp })) {
          w.arena.reward = true;
          beginWave(w);
          this.fighting = true;
          return;
        }
      }
      const def = st.boss ? findEnemy(st.boss) : undefined;
      if (def) {
        // Placeholder (no boss content at all): a big sturdy chapter enemy.
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
      if (room.type === 'challenge') this.challengeDone(st);
      return;
    }
    w.arena.reward = bossRoom || st.wave >= st.waves.length - 1;
    if (startWave(w, { spawns }) === 0) {
      st.cleared = true;
      if (room.type === 'challenge') this.challengeDone(st);
      return;
    }
    this.fighting = true;
  }

  /** The Rain Barrel Arena's plate: the doors lock and the first wave comes. */
  private pressPlate(st: RoomState): void {
    const w = this.host.world;
    const plate = w.props.plate;
    plate.state = 1;
    plate.t = 0;
    st.plate = 1;
    st.wave = 0;
    w.arena.locked = true;
    w.events.emit('plate', plate.x, plate.y, 1);
    w.events.emit('npcSay', plate.x, plate.y, 0, 0, `WAVE 1 OF ${Math.max(1, st.waves.length)}`);
    this.startRoomWave(this.room, st);
  }

  private challengeDone(st: RoomState): void {
    const w = this.host.world;
    st.plate = 2;
    w.arena.locked = false;
  }

  /** The running wave died out: the next challenge wave, or the room is clear. */
  private onWaveCleared(): void {
    const w = this.host.world;
    const room = this.room;
    const st = this.state;
    const bossRoom = room.type === 'boss' || room.type === 'miniboss';
    if (!bossRoom && st.wave + 1 < st.waves.length) {
      st.wave++;
      if (room.type === 'challenge') {
        // A breather, then the next wave (the doors stay locked).
        this.pendingWaveT = RUN_TUNING.challengeGap;
        w.events.emit('npcSay', w.player.x, w.player.y, 0, 0, `WAVE ${st.wave + 1} OF ${st.waves.length}`);
        return;
      }
      this.startRoomWave(room, st);
      if (this.fighting) return;
    }
    st.wave = st.waves.length;
    st.cleared = true;
    this.data.stats.roomsCleared++;
    if (room.type === 'challenge') {
      this.challengeDone(st);
      this.spawnRewards(st);
    }
    if (room.type === 'boss') this.bossDefeated(st);
    if (room.type === 'miniboss') this.minibossDefeated();
    this.updateDoors();
  }

  private placeTrapdoor(age: number): void {
    const t = this.host.world.trapdoor;
    t.active = true;
    t.x = TRAPDOOR_X;
    t.y = TRAPDOOR_Y;
    t.t = age;
  }

  /** A miniboss fell: its own reward (a drop table) and a heart. */
  private minibossDefeated(): void {
    const w = this.host.world;
    this.data.stats.bossesBeaten++;
    spawnDrops(w, 'minibossReward', TRAPDOOR_X, TRAPDOOR_Y);
    spawnPickup(w, PK.Heart, TRAPDOOR_X, TRAPDOOR_Y, true);
  }

  /** The boss fell: trapdoor, reward item + a heart, maybe the Broker's Nook and the grate — or an ending. */
  private bossDefeated(st: RoomState): void {
    const w = this.host.world;
    const d = this.data;
    d.stats.bossesBeaten++;
    const def = st.boss ? BOSSES.get(st.boss) : undefined;
    if (d.layout.finalBoss || (def && def.kind === 'final')) {
      this.finalDefeated(st);
      return;
    }
    st.trapdoor = true;
    this.placeTrapdoor(0);
    w.events.emit('trapdoor', TRAPDOOR_X, TRAPDOOR_Y, 0, d.floor);
    w.events.emit('sfx', TRAPDOOR_X, TRAPDOOR_Y, 0, 0, 'stairs');
    if (st.reward) {
      const spot = this.rewardSpot();
      if (this.itemPedestal(spot.x, spot.y, st.reward, 0, 0)) {
        w.events.emit('pedestalRoll', spot.x, spot.y - 16, 1, 0, st.reward);
        this.markSeen(st.reward);
      }
      st.reward = '';
    }
    spawnPickup(w, PK.Heart, TRAPDOOR_X + 18, TRAPDOOR_Y + 4, true);
    if (st.grate > 0) {
      this.placeGrate(st);
      w.events.emit('grate', w.props.grate.x, w.props.grate.y, 0);
    }
    // The Broker's Nook (likelier after a floor without damage).
    const layout = d.layout;
    const roll = floorRng(d.seed, d.floor, d.track).fork('nook').next();
    if (layout.nook.room < 0 && layout.nook.templateId && roll < this.nookChance()) {
      const n = openNook(layout);
      while (d.rooms.length < n) d.rooms.push(emptyRoomState());
      d.rooms[n] = d.nook;
      discoverRoom(d.map, layout, n);
      const side = layout.nook.side;
      w.events.emit('secretFound', DOOR_X[side]!, DOOR_Y[side]!, side, 2);
      w.events.emit('sfx', DOOR_X[side]!, DOOR_Y[side]!, 0, 0, 'secret_found');
    }
  }

  /** Chance of the Broker's Nook after this floor's boss: base, more with no damage taken. */
  nookChance(): number {
    return this.data.tookDamage ? RUN_TUNING.nookChance : RUN_TUNING.nookChance + RUN_TUNING.nookCleanBonus;
  }

  /** A final boss fell: its ending — or, with Endings 1 and 2 unlocked, the whirlpool and the skylight. */
  private finalDefeated(st: RoomState): void {
    const w = this.host.world;
    if (this.data.floor < UNDERTOW_FLOOR && this.whirlpoolOpen) {
      st.exits = 1;
      this.placeExits();
      w.events.emit('whirlpool', w.props.whirlpool.x, w.props.whirlpool.y, 0);
      w.events.emit('npcSay', w.player.x, w.player.y, 0, 0, 'THE WATER BEGINS TO TURN...');
      return;
    }
    this.win(this.floorEnding());
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
    if (w.arena.active || w.arena.locked || w.player.dead || this.data.won) return false;
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

  /** World.onExplosion: blasts break Gumball Gamblers open and crack the hidden-route grate. */
  private onExplosion(x: number, y: number, radius: number): void {
    const w = this.host.world;
    const reach = radius + SHOP_TUNING.blastReach;
    const peds = w.pedestals;
    for (let i = 0; i < peds.count; i++) {
      const ped = peds.items[i]!;
      if (ped.prop !== PROP_SLOTS || ped.broken) continue;
      const dx = ped.x - x;
      const dy = ped.y - y;
      if (dx * dx + dy * dy < reach * reach) breakSlots(w, ped);
    }
    const g = w.props.grate;
    if (g.active && g.state === 0) {
      const dx = g.x - x;
      const dy = g.y - y;
      if (dx * dx + dy * dy < reach * reach) {
        g.state = 1;
        g.t = 0;
        g.armed = false;
        this.state.grate = 2;
        w.events.emit('grate', g.x, g.y, 1);
        w.events.emit('sfx', g.x, g.y, 0, 0, 'secret_found');
      }
    }
  }

  // ── Per tick ──────────────────────────────────────────────────────────────

  /** Stepping onto a floor exit (armed once the player has been off it). */
  private steppedOn(t: FloorThing, reach: number): boolean {
    if (!t.active) return false;
    const p = this.host.world.player;
    const d2 = (p.x - t.x) * (p.x - t.x) + (p.y - t.y) * (p.y - t.y);
    if (!t.armed) {
      if (d2 > (reach + 6) * (reach + 6)) t.armed = true;
      return false;
    }
    return d2 < reach * reach;
  }

  /** End of every Sim tick: clears, waves, the trapdoor and other exits, doors. */
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
    this.scanEvents();
    if (p.dead || d.won) return;
    if (this.fighting && !w.arena.active) {
      this.fighting = false;
      this.onWaveCleared();
    }
    const st = this.state;
    if (this.pendingWaveT > 0) {
      this.pendingWaveT -= dt;
      if (this.pendingWaveT <= 0) this.startRoomWave(this.room, st);
    }
    // The Rain Barrel Arena's plate.
    const plate = w.props.plate;
    if (plate.active && plate.state === 0 && st.plate === 0 && !st.cleared) {
      const R = RUN_TUNING.plateReach;
      if ((p.x - plate.x) * (p.x - plate.x) + (p.y - plate.y) * (p.y - plate.y) < R * R) this.pressPlate(st);
    }
    const t = w.trapdoor;
    if (t.active && !w.arena.active) {
      const R = RUN_TUNING.trapdoorReach;
      const d2 = (p.x - t.x) * (p.x - t.x) + (p.y - t.y) * (p.y - t.y);
      if (!t.armed) {
        if (d2 > (R + 6) * (R + 6)) t.armed = true;
      } else if (t.t >= TRAPDOOR_OPEN_TIME && d2 < R * R) {
        this.descendTrapdoor();
        return;
      }
    }
    // The hidden-route grate (once blasted open) → the alt track.
    const g = w.props.grate;
    if (g.active && g.state === 1 && !w.arena.active && this.steppedOn(g, RUN_TUNING.trapdoorReach)) {
      w.events.emit('grate', g.x, g.y, 2);
      this.descend('alt', g.x, g.y, 'grate');
      return;
    }
    // After a final boss: the whirlpool (floor 13) or the skylight (the ending).
    if (this.steppedOn(w.props.whirlpool, RUN_TUNING.trapdoorReach + 2)) {
      w.events.emit('whirlpool', w.props.whirlpool.x, w.props.whirlpool.y, 1);
      this.descend(d.track, w.props.whirlpool.x, w.props.whirlpool.y, 'whirlpool');
      return;
    }
    if (this.steppedOn(w.props.skylight, RUN_TUNING.trapdoorReach + 2)) {
      w.events.emit('whirlpool', w.props.skylight.x, w.props.skylight.y, 2);
      this.win(this.floorEnding());
      return;
    }
    if (w.arena.active || w.arena.locked || this.doorCooldown > 0) return;
    for (let side = 0; side < 4; side++) {
      if (this.pushing(side, input)) {
        this.goThroughDoor(side);
        return;
      }
    }
  }

  /** The trapdoor: the next floor on the same track (see trackAfter). */
  private descendTrapdoor(): void {
    const d = this.data;
    const t = this.host.world.trapdoor;
    this.descend(this.trackAfter(d.floor, d.track), t.x, t.y, 'trapdoor');
  }

  /** This tick's events: items taken are seen; the shop's Magpie reacts to sales and empty purses. */
  private scanEvents(): void {
    const w = this.host.world;
    const q = w.events;
    const pr = w.props;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      if (e.type === 'item') this.markSeen(e.id);
      else if (pr.npc !== 0 && e.type === 'buy') {
        pr.npcMood = 1;
        pr.npcT = 0;
      } else if (pr.npc !== 0 && e.type === 'denied' && (e.id === 'poor' || e.id === 'noHearts')) {
        pr.npcMood = 2;
        pr.npcT = 0;
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

  /**
   * Debug: straight to the next floor (keeping the track). On a final floor: the whirlpool's floor 13
   * when it is open, else the floor's ending.
   */
  skipFloor(): void {
    const d = this.data;
    if (d.won) return;
    const w = this.host.world;
    if (d.floor >= UNDERTOW_FLOOR || (d.floor >= LAST_FLOOR && !this.whirlpoolOpen)) {
      d.stats.floorsCleared++;
      this.win(this.floorEnding());
      return;
    }
    this.descend(d.floor >= LAST_FLOOR ? d.track : this.trackAfter(d.floor, d.track), w.player.x, w.player.y, 'debug');
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
    const st = this.state;
    return {
      floor: d.floor,
      track: d.track,
      chapter: d.chapter,
      room: d.current,
      roomType: this.room.type,
      cleared: st.cleared,
      curse: d.layout.curse,
      rooms: d.layout.rooms.length,
      visited,
      doors: w.doors.slots.map((s, side) => ({ side, kind: s.kind, state: s.state, to: s.to })),
      trapdoor: w.trapdoor.active,
      won: d.won === 1,
      ending: d.ending,
      time: d.time,
      stats: { ...d.stats },
      plate: st.plate,
      grate: st.grate,
      exits: st.exits,
      boss: st.boss,
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

/** May this floor place a hidden-route grate? (The route into chapter 6's alt floors needs Ending 1.) */
export function altRouteAllowed(floor: number, track: FloorTrack, unlocked: ReadonlySet<string>): boolean {
  if (track !== 'main' || floor >= LAST_FLOOR) return false;
  return floor + 1 < 11 || unlocked.has('ending1');
}

/** Generates and fills one floor: layout, templates, contents, minimap. */
function makeFloor(
  seed: number,
  floor: number,
  track: FloorTrack,
  curseMode: string,
  locked: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  unlocked: ReadonlySet<string>,
) {
  const chapter = chapterFor(floor, track);
  const opts: FloorGenOptions = { allowAltNext: altRouteAllowed(floor, track, unlocked) };
  if (curseMode === 'roll') {
    opts.curses = true;
    if (chapter.curses && chapter.curses.length > 0) opts.cursePool = chapter.curses;
  } else {
    opts.forceCurse = curseMode === 'none' ? null : (curseMode as FloorCurse);
  }
  const layout = generateFloor(seed, floor, track, opts);
  pickTemplates(layout, ROOM_TEMPLATES, chapter.id, templateRng(seed, floor, track));
  const { rooms, nook } = rollFloorContents(layout, chapter.id, { locked, seen, challengeWaves: RUN_TUNING.challengeWaves });
  return { chapter: chapter.id, layout, map: createMinimap(layout), rooms, nook };
}
