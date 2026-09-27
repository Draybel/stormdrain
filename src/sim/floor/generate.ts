/**
 * Floor layout generator (ARCHITECTURE §6). Pure and deterministic: the layout depends ONLY on
 * (seed, floorIndex, track, opts) through `floorRng` (engine/rng.ts) and a set of labelled forks,
 * so floors never depend on how the run was played.
 *
 * Growth (tree-shaped, dungeon style): the start room sits in the middle of an 11×11 grid; a BFS
 * queue grows rooms into empty neighbour cells with a 50 % give-up chance, and a cell is only
 * filled when it touches exactly one existing room (no loops, no 2×2 blobs). Too few rooms, too
 * few dead ends, or an unplaceable boss / nook / secret / deep secret means: try again.
 *
 * Streams (forks of floorRng(seed, floor, track)):
 *   'plan'   room count + which optional special rooms exist
 *   'layout' growth attempts and placement
 *   'curse'  floor curse          'hints'  secret wall hints
 *   'route'  hidden-route grate   'templates' (pickTemplates, see templateRng)
 * Adding a fork never shifts the others, so e.g. turning curses off keeps the same map.
 *
 * Hot path notes: attempts reuse module-level typed scratch buffers; objects are built only once
 * for the successful attempt.
 */

import { Rng, floorRng } from '../../engine/rng';
import {
  DIR_BITS,
  DIR_DX,
  DIR_DY,
  DIR_OPPOSITE,
  FLOOR_CURSES,
  ROOM_TYPES,
  type FinalBossKey,
  type FloorCurse,
  type FloorGenOptions,
  type FloorLayout,
  type FloorRoom,
  type FloorTrack,
  type RoomType,
} from './types';

/** Bump when a change alters the layouts produced for existing seeds (saves can detect it). */
export const FLOORGEN_VERSION = 1;

export const FLOOR_W = 11;
export const FLOOR_H = 11;
export const START_GX = 5;
export const START_GY = 5;
/** Last floor of the main and alt routes (Old Thunderhead / The Nestmother). */
export const FINAL_ROUTE_FLOOR = 12;
/** The Undertow (true ending floor). */
export const UNDERTOW_FLOOR = 13;
export const MAX_FLOOR = 13;

/** Treasure rooms are locked from chapter 2 (floor 3) on. */
export const TREASURE_LOCK_FLOOR = 3;
export const MINIBOSS_CHANCE = 0.35;
export const CHALLENGE_CHANCE = 0.3;
export const CHALLENGE_MIN_FLOOR = 2;
export const CURSED_ROOM_CHANCE = 0.25;
export const SECRET_HINT_CHANCE = 0.4;
export const DEEP_SECRET_HINT_CHANCE = 0.25;
export const HIDDEN_ROUTE_CHANCE = 0.4;
/** Share of hidden-route grates placed in the secret room (the rest go in the boss room). */
export const HIDDEN_ROUTE_IN_SECRET = 0.55;

const CELLS = FLOOR_W * FLOOR_H;
const START_CELL = START_GY * FLOOR_W + START_GX;
const MAX_ATTEMPTS = 20000;

/** Base room count (start + normal + dead-end specials; secret rooms and the nook not counted). */
export function baseRoomCount(floorIndex: number): number {
  return 8 + Math.floor(((floorIndex - 1) * 10) / 12);
}

/** Chance of a floor curse on this floor: rises with depth (≈4 % on floor 1, ≈46 % on 13). */
export function curseChance(floorIndex: number): number {
  return Math.min(0.5, 0.04 + 0.035 * (floorIndex - 1));
}

/** 1..6 for floors 1..12, 7 for floor 13 (The Undertow). */
export function chapterOfFloor(floorIndex: number): number {
  return floorIndex >= UNDERTOW_FLOOR ? 7 : Math.ceil(floorIndex / 2);
}

export function isFinalFloor(floorIndex: number): boolean {
  return floorIndex >= FINAL_ROUTE_FLOOR;
}

export function finalBossFor(floorIndex: number, track: FloorTrack): FinalBossKey | null {
  if (floorIndex >= UNDERTOW_FLOOR) return 'undertow';
  if (floorIndex === FINAL_ROUTE_FLOOR) return track === 'alt' ? 'nestmother' : 'thunderhead';
  return null;
}

/** Stream for pickTemplates, independent of the layout streams. */
export function templateRng(seed: number, floorIndex: number, track: FloorTrack): Rng {
  return floorRng(seed, floorIndex, track).fork('templates');
}

// ── Scratch state (generation is synchronous; reused across attempts and calls) ──────────────
/** Room order index occupying each cell, or -1. */
const occ = new Int16Array(CELLS);
/** Cells in growth (BFS) order; doubles as the BFS queue. */
const order = new Int16Array(CELLS);
const dist = new Int16Array(CELLS);
/** RoomType index (into ROOM_TYPES) per growth-order room. */
const kind = new Uint8Array(CELLS);
const leafBuf = new Int16Array(CELLS);
const candBuf = new Int16Array(CELLS);
const candBuf2 = new Int16Array(CELLS);

const T_NORMAL = ROOM_TYPES.indexOf('normal');
const T_START = ROOM_TYPES.indexOf('start');
const T_BOSS = ROOM_TYPES.indexOf('boss');

interface Plan {
  target: number;
  /** Dead-end specials other than the boss, in placement order. */
  specials: RoomType[];
  minBossDist: number;
}

interface Attempt {
  count: number;
  boss: number;
  nookCell: number;
  nookSide: number;
  secretCell: number;
  deepCell: number;
}

const attemptOut: Attempt = { count: 0, boss: -1, nookCell: -1, nookSide: -1, secretCell: -1, deepCell: -1 };

function rollPlan(rng: Rng, floorIndex: number): Plan {
  const final = isFinalFloor(floorIndex);
  const specials: RoomType[] = ['treasure'];
  if (!final) specials.push('shop');
  // Always consume the same rolls so the stream shape never depends on the floor.
  const mini = rng.chance(MINIBOSS_CHANCE);
  const challenge = rng.chance(CHALLENGE_CHANCE);
  const cursed = rng.chance(CURSED_ROOM_CHANCE);
  const extra = rng.int(0, 1);
  if (mini) specials.push('miniboss');
  if (challenge && floorIndex >= CHALLENGE_MIN_FLOOR) specials.push('challenge');
  if (cursed) specials.push('cursed');
  // Enough rooms that the specials never crowd out the normal rooms (1 start + boss + specials + 4).
  const target = Math.max(baseRoomCount(floorIndex) + extra, specials.length + 6);
  return { target, specials, minBossDist: target >= 13 ? 4 : 3 };
}

function filledNeighbours(cell: number): number {
  const x = cell % FLOOR_W;
  const y = (cell - x) / FLOOR_W;
  let n = 0;
  if (y > 0 && occ[cell - FLOOR_W]! >= 0) n++;
  if (x < FLOOR_W - 1 && occ[cell + 1]! >= 0) n++;
  if (y < FLOOR_H - 1 && occ[cell + FLOOR_W]! >= 0) n++;
  if (x > 0 && occ[cell - 1]! >= 0) n++;
  return n;
}

/** Neighbour cell of `cell` on side d (0 N, 1 E, 2 S, 3 W), or -1 outside the grid. */
function stepCell(cell: number, d: number): number {
  const x = (cell % FLOOR_W) + DIR_DX[d]!;
  const y = Math.floor(cell / FLOOR_W) + DIR_DY[d]!;
  if (x < 0 || y < 0 || x >= FLOOR_W || y >= FLOOR_H) return -1;
  return y * FLOOR_W + x;
}

/** BFS growth. Returns the number of rooms grown (≤ target). */
function grow(rng: Rng, target: number): number {
  occ.fill(-1);
  occ[START_CELL] = 0;
  order[0] = START_CELL;
  dist[START_CELL] = 0;
  let count = 1;
  let head = 0;
  while (head < count && count < target) {
    const c = order[head++]!;
    const d0 = rng.nextU32() & 3;
    for (let k = 0; k < 4 && count < target; k++) {
      const n = stepCell(c, (d0 + k) & 3);
      if (n < 0 || occ[n]! >= 0) continue;
      if (filledNeighbours(n) > 1) continue;
      if (rng.next() < 0.5) continue;
      occ[n] = count;
      order[count++] = n;
      dist[n] = dist[c]! + 1;
    }
  }
  return count;
}

/** True when `cell` is empty and none of its neighbours other than `except` holds a room. */
function isIsolatedFree(cell: number, except: number): boolean {
  if (occ[cell]! >= 0) return false;
  for (let d = 0; d < 4; d++) {
    const n = stepCell(cell, d);
    if (n >= 0 && n !== except && occ[n]! >= 0) return false;
  }
  return true;
}

function adjacent(a: number, b: number): boolean {
  if (a < 0 || b < 0) return false;
  const ax = a % FLOOR_W;
  const bx = b % FLOOR_W;
  const ay = (a - ax) / FLOOR_W;
  const by = (b - bx) / FLOOR_W;
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

/** One full attempt: grow, then place boss, nook, specials, secret and deep secret. */
function tryAttempt(rng: Rng, plan: Plan): boolean {
  const count = grow(rng, plan.target);
  if (count < plan.target) return false;
  const out = attemptOut;
  out.count = count;

  // Dead ends (never the start room), and the farthest distance among them.
  let leaves = 0;
  let maxDist = 0;
  for (let i = 1; i < count; i++) {
    const c = order[i]!;
    kind[i] = T_NORMAL;
    if (filledNeighbours(c) === 1) {
      leafBuf[leaves++] = c;
      if (dist[c]! > maxDist) maxDist = dist[c]!;
    }
  }
  kind[0] = T_START;
  if (maxDist < plan.minBossDist) return false;
  if (leaves < plan.specials.length + 1) return false;

  // Boss: one of the farthest dead ends that has a free nook cell (touching only the boss room).
  let ties = 0;
  for (let i = 0; i < leaves; i++) if (dist[leafBuf[i]!] === maxDist) candBuf[ties++] = leafBuf[i]!;
  let boss = -1;
  let nookCell = -1;
  let nookSide = -1;
  const start = rng.int(0, ties - 1);
  for (let t = 0; t < ties && boss < 0; t++) {
    const b = candBuf[(start + t) % ties]!;
    let opts = 0;
    for (let d = 0; d < 4; d++) {
      const n = stepCell(b, d);
      if (n >= 0 && isIsolatedFree(n, b)) candBuf2[opts++] = d;
    }
    if (opts > 0) {
      boss = b;
      nookSide = candBuf2[rng.int(0, opts - 1)]!;
      nookCell = stepCell(b, nookSide);
    }
  }
  if (boss < 0) return false;
  kind[occ[boss]!] = T_BOSS;

  // Other specials on the remaining dead ends (shuffled).
  let free = 0;
  for (let i = 0; i < leaves; i++) if (leafBuf[i] !== boss) candBuf[free++] = leafBuf[i]!;
  for (let i = free - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const t = candBuf[i]!;
    candBuf[i] = candBuf[j]!;
    candBuf[j] = t;
  }
  for (let s = 0; s < plan.specials.length; s++) {
    kind[occ[candBuf[s]!]!] = ROOM_TYPES.indexOf(plan.specials[s]!);
  }

  // Secret room: empty cell touching ≥ 2 rooms (prefer 3+), never the boss room or the nook.
  let n2 = 0;
  let n3 = 0;
  for (let c = 0; c < CELLS; c++) {
    if (occ[c]! >= 0 || c === nookCell || adjacent(c, nookCell)) continue;
    let rooms = 0;
    let touchesBoss = false;
    for (let d = 0; d < 4; d++) {
      const n = stepCell(c, d);
      if (n < 0 || occ[n]! < 0) continue;
      rooms++;
      if (n === boss) touchesBoss = true;
    }
    if (touchesBoss || rooms < 2) continue;
    if (rooms >= 3) candBuf2[n3++] = c;
    else candBuf[n2++] = c;
  }
  let secretCell: number;
  if (n3 > 0) secretCell = candBuf2[rng.int(0, n3 - 1)]!;
  else if (n2 > 0) secretCell = candBuf[rng.int(0, n2 - 1)]!;
  else return false;

  // Deep secret: empty cell touching exactly one room, which is a normal room, and nothing special
  // (not the secret room, not the nook).
  let nd = 0;
  for (let c = 0; c < CELLS; c++) {
    if (occ[c]! >= 0 || c === secretCell || c === nookCell) continue;
    if (adjacent(c, secretCell) || adjacent(c, nookCell)) continue;
    let rooms = 0;
    let only = -1;
    for (let d = 0; d < 4; d++) {
      const n = stepCell(c, d);
      if (n < 0 || occ[n]! < 0) continue;
      rooms++;
      only = n;
    }
    if (rooms === 1 && kind[occ[only]!] === T_NORMAL) candBuf[nd++] = c;
  }
  if (nd === 0) return false;
  const deepCell = candBuf[rng.int(0, nd - 1)]!;

  out.boss = boss;
  out.nookCell = nookCell;
  out.nookSide = nookSide;
  out.secretCell = secretCell;
  out.deepCell = deepCell;
  return true;
}

function makeRoom(index: number, cell: number, type: RoomType, d: number): FloorRoom {
  return {
    index,
    gx: cell % FLOOR_W,
    gy: Math.floor(cell / FLOOR_W),
    type,
    doors: 0,
    secretDoors: 0,
    hints: 0,
    lockedDoors: 0,
    locked: false,
    secret: type === 'secret' || type === 'deepSecret',
    dist: d,
    templateId: null,
    flip: 0,
    hiddenRoute: false,
    finalBoss: null,
  };
}

function rollCurse(rng: Rng, floorIndex: number, opts: FloorGenOptions): FloorCurse | null {
  if (opts.forceCurse !== undefined) return opts.forceCurse;
  const roll = rng.next();
  const pool = opts.cursePool ?? FLOOR_CURSES;
  const which = rng.nextU32();
  if (opts.curses === false || pool.length === 0) return null;
  if (roll >= curseChance(floorIndex)) return null;
  return pool[which % pool.length]!;
}

/**
 * Builds the floor layout for (seed, floorIndex 1..13, track). Deterministic.
 * Throws RangeError on a bad floor index or track.
 */
export function generateFloor(
  seed: number,
  floorIndex: number,
  track: FloorTrack,
  opts: FloorGenOptions = {},
): FloorLayout {
  if (!Number.isInteger(floorIndex) || floorIndex < 1 || floorIndex > MAX_FLOOR) {
    throw new RangeError(`generateFloor: floorIndex must be 1..${MAX_FLOOR}, got ${floorIndex}`);
  }
  if (track !== 'main' && track !== 'alt') throw new RangeError(`generateFloor: bad track "${String(track)}"`);

  const root = floorRng(seed, floorIndex, track);
  const plan = rollPlan(root.fork('plan'), floorIndex);
  const rng = root.fork('layout');

  // Attempt until every constraint holds. Every 400 failures the plan relaxes a little (one more
  // room, then fewer optional specials) so generation always terminates; in practice a few dozen
  // attempts suffice.
  let attempts = 0;
  for (;;) {
    attempts++;
    if (tryAttempt(rng, plan)) break;
    if (attempts % 400 === 0) {
      if (plan.target < baseRoomCount(floorIndex) + 4) plan.target++;
      else if (plan.specials.length > (isFinalFloor(floorIndex) ? 1 : 2)) plan.specials.pop();
    }
    if (attempts >= MAX_ATTEMPTS) throw new Error(`generateFloor: no layout after ${attempts} attempts`);
  }

  const a = attemptOut;
  const count = a.count;
  const rooms: FloorRoom[] = [];
  const cells: number[] = new Array<number>(CELLS).fill(-1);
  for (let i = 0; i < count; i++) {
    const c = order[i]!;
    rooms.push(makeRoom(i, c, ROOM_TYPES[kind[i]!]!, dist[c]!));
    cells[c] = i;
  }
  // Regular doors: in a tree grown this way every pair of adjacent rooms is a parent/child edge.
  for (let i = 0; i < count; i++) {
    const r = rooms[i]!;
    const c = order[i]!;
    for (let d = 0; d < 4; d++) {
      const n = stepCell(c, d);
      if (n >= 0 && cells[n]! >= 0) r.doors |= DIR_BITS[d]!;
    }
  }

  // Secret rooms: bombable walls to every neighbouring room.
  const addHidden = (cell: number, type: RoomType): number => {
    const idx = rooms.length;
    let best = 1 << 14;
    const room = makeRoom(idx, cell, type, 0);
    for (let d = 0; d < 4; d++) {
      const n = stepCell(cell, d);
      if (n < 0 || cells[n]! < 0) continue;
      const nb = rooms[cells[n]!]!;
      const bit = DIR_BITS[d]!;
      const back = DIR_BITS[DIR_OPPOSITE[d]!]!;
      room.doors |= bit;
      room.secretDoors |= bit;
      nb.doors |= back;
      nb.secretDoors |= back;
      if (nb.dist + 1 < best) best = nb.dist + 1;
    }
    room.dist = best;
    rooms.push(room);
    cells[cell] = idx;
    return idx;
  };
  const secret = addHidden(a.secretCell, 'secret');
  const deepSecret = addHidden(a.deepCell, 'deepSecret');

  const boss = cells[a.boss]!;
  const bossRoom = rooms[boss]!;
  const final = finalBossFor(floorIndex, track);
  bossRoom.finalBoss = final;

  // Locked treasure rooms (both sides of the single door).
  if (floorIndex >= TREASURE_LOCK_FLOOR) {
    for (const r of rooms) {
      if (r.type !== 'treasure') continue;
      r.locked = true;
      for (let d = 0; d < 4; d++) {
        const bit = DIR_BITS[d]!;
        if ((r.doors & bit) === 0 || (r.secretDoors & bit) !== 0) continue;
        r.lockedDoors |= bit;
        const nb = rooms[cells[(r.gy + DIR_DY[d]!) * FLOOR_W + r.gx + DIR_DX[d]!]!]!;
        nb.lockedDoors |= DIR_BITS[DIR_OPPOSITE[d]!]!;
      }
    }
  }

  // Subtle hints on the visible side of secret walls.
  const hintRng = root.fork('hints');
  for (const [idx, chance] of [
    [secret, SECRET_HINT_CHANCE],
    [deepSecret, DEEP_SECRET_HINT_CHANCE],
  ] as const) {
    const s = rooms[idx]!;
    for (let d = 0; d < 4; d++) {
      if ((s.doors & DIR_BITS[d]!) === 0) continue;
      const hit = hintRng.chance(chance);
      if (!hit) continue;
      const nb = rooms[cells[(s.gy + DIR_DY[d]!) * FLOOR_W + s.gx + DIR_DX[d]!]!]!;
      nb.hints |= DIR_BITS[DIR_OPPOSITE[d]!]!;
    }
  }

  // Hidden route to the ALT track for the next floor (main track, before the final floor).
  let hiddenRoute = -1;
  const routeRng = root.fork('route');
  const routeRoll = routeRng.next();
  const routeWhere = routeRng.next();
  if (opts.allowAltNext && track === 'main' && floorIndex < FINAL_ROUTE_FLOOR) {
    if (routeRoll < (opts.hiddenRouteChance ?? HIDDEN_ROUTE_CHANCE)) {
      hiddenRoute = routeWhere < HIDDEN_ROUTE_IN_SECRET ? secret : boss;
      rooms[hiddenRoute]!.hiddenRoute = true;
    }
  }

  const curse = rollCurse(root.fork('curse'), floorIndex, opts);

  return {
    version: FLOORGEN_VERSION,
    seed,
    floorIndex,
    track,
    chapter: chapterOfFloor(floorIndex),
    width: FLOOR_W,
    height: FLOOR_H,
    cells,
    rooms,
    start: 0,
    boss,
    secret,
    deepSecret,
    bossDist: bossRoom.dist,
    nook: {
      gx: a.nookCell % FLOOR_W,
      gy: Math.floor(a.nookCell / FLOOR_W),
      side: a.nookSide,
      templateId: null,
      flip: 0,
      room: -1,
    },
    curse,
    finalBoss: final,
    hiddenRoute,
    attempts,
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────────────────

/** Room index at a grid cell, or -1 (also for cells outside the grid). */
export function roomAt(layout: FloorLayout, gx: number, gy: number): number {
  if (gx < 0 || gy < 0 || gx >= layout.width || gy >= layout.height) return -1;
  return layout.cells[gy * layout.width + gx]!;
}

/** Room index behind side `side` (0 N, 1 E, 2 S, 3 W) of a room, or -1 when there is no door. */
export function neighborRoom(layout: FloorLayout, room: number, side: number): number {
  const r = layout.rooms[room];
  if (!r || (r.doors & DIR_BITS[side]!) === 0) return -1;
  return roomAt(layout, r.gx + DIR_DX[side]!, r.gy + DIR_DY[side]!);
}

/** Number of regular (non-secret) doors of a room. */
export function regularDoorCount(room: FloorRoom): number {
  let m = room.doors & ~room.secretDoors;
  let n = 0;
  while (m) {
    n += m & 1;
    m >>= 1;
  }
  return n;
}

/**
 * Opens the Broker's Nook next to the boss room (call after the boss when the nook appears).
 * Adds a 'nook' room at the reserved cell with a regular door to the boss room and returns its
 * index. Idempotent.
 */
export function openNook(layout: FloorLayout): number {
  const nook = layout.nook;
  if (nook.room >= 0) return nook.room;
  const boss = layout.rooms[layout.boss]!;
  const idx = layout.rooms.length;
  const room = makeRoom(idx, nook.gy * layout.width + nook.gx, 'nook', boss.dist + 1);
  room.gx = nook.gx;
  room.gy = nook.gy;
  room.templateId = nook.templateId;
  room.flip = nook.flip;
  room.doors = DIR_BITS[DIR_OPPOSITE[nook.side]!]!;
  boss.doors |= DIR_BITS[nook.side]!;
  layout.rooms.push(room);
  layout.cells[nook.gy * layout.width + nook.gx] = idx;
  nook.room = idx;
  return idx;
}

/** Bounding box of all rooms (secret rooms included), for centring a minimap. */
export function layoutBounds(layout: FloorLayout): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = layout.width;
  let minY = layout.height;
  let maxX = -1;
  let maxY = -1;
  for (const r of layout.rooms) {
    if (r.gx < minX) minX = r.gx;
    if (r.gy < minY) minY = r.gy;
    if (r.gx > maxX) maxX = r.gx;
    if (r.gy > maxY) maxY = r.gy;
  }
  return { minX, minY, maxX, maxY };
}
