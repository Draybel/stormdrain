/**
 * Special-room furniture for floor runs (ARCHITECTURE §6b): where the room's props go and the lines the
 * NPCs say. Placement is deterministic (from the mirrored template grid and the markers only) and never
 * cuts a room in two: a solid prop only goes on plain floor away from the doors and the markers, and
 * only where the room stays connected without that cell.
 *
 * - Magpie's Stall: Magpie perches on the top wall; the donation jar stands on the floor.
 * - Broker's Nook: the Moth Broker hangs on the top wall.
 * - Rain Barrel Arena: the pressure plate in the middle.
 * - Normal rooms: a Gumball Gambler or Old Pell (pre-rolled per floor) in a quiet corner.
 * - The hidden-route grate (secret room, or the boss room after the boss) and, after a final boss, the
 *   whirlpool and the skylight: floor objects on free floor.
 */

import { ROOM_COLS, ROOM_ROWS, TILE } from '../constants';
import type { RoomMarker } from '../room';
import { Tile, blocksWalk } from '../tiles';
import type { World } from '../world';

const CELLS = ROOM_COLS * ROOM_ROWS;
const blocked = new Uint8Array(CELLS);
const seenCell = new Uint8Array(CELLS);
const queue = new Int16Array(CELLS);

/** Door fronts (the tile just inside each door) as cell indices: N, E, S, W. */
const DOOR_FRONTS = [0 * ROOM_COLS + 6, 3 * ROOM_COLS + 12, 6 * ROOM_COLS + 6, 3 * ROOM_COLS + 0];

export function cellOf(col: number, row: number): number {
  return row * ROOM_COLS + col;
}

export function cellX(cell: number): number {
  return (cell % ROOM_COLS) * TILE + TILE / 2;
}

export function cellY(cell: number): number {
  return Math.floor(cell / ROOM_COLS) * TILE + TILE / 2;
}

function nearDoor(cell: number): boolean {
  const c = cell % ROOM_COLS;
  const r = Math.floor(cell / ROOM_COLS);
  for (const d of DOOR_FRONTS) {
    const dc = d % ROOM_COLS;
    const dr = Math.floor(d / ROOM_COLS);
    if (Math.abs(dc - c) + Math.abs(dr - r) <= 1) return true;
  }
  return false;
}

function isMarker(markers: readonly RoomMarker[], cell: number): boolean {
  const c = cell % ROOM_COLS;
  const r = Math.floor(cell / ROOM_COLS);
  for (const m of markers) if (m.col === c && m.row === r) return true;
  return false;
}

/** Walkable cells reachable from the first free door front (blocked cells excluded). */
function reachable(w: World): number {
  seenCell.fill(0);
  let start = -1;
  for (const d of DOOR_FRONTS) {
    if (!blocked[d] && !blocksWalk(w.room.tiles[d]!)) {
      start = d;
      break;
    }
  }
  if (start < 0) return 0;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seenCell[start] = 1;
  let n = 0;
  while (head < tail) {
    const cell = queue[head++]!;
    n++;
    const c = cell % ROOM_COLS;
    const r = Math.floor(cell / ROOM_COLS);
    for (let k = 0; k < 4; k++) {
      const nc = c + (k === 1 ? 1 : k === 3 ? -1 : 0);
      const nr = r + (k === 0 ? -1 : k === 2 ? 1 : 0);
      if (nc < 0 || nr < 0 || nc >= ROOM_COLS || nr >= ROOM_ROWS) continue;
      const ni = nr * ROOM_COLS + nc;
      if (seenCell[ni] || blocked[ni] || blocksWalk(w.room.tiles[ni]!)) continue;
      seenCell[ni] = 1;
      queue[tail++] = ni;
    }
  }
  return n;
}

/**
 * A cell for a SOLID prop (jar, gambler, trader): plain floor, not a marker, not next to a door front,
 * not in `taken`, and the room stays connected without it. Tries `prefs` in order, then every cell by
 * distance to the first preference. -1 when nothing fits.
 */
export function solidPropCell(w: World, markers: readonly RoomMarker[], prefs: readonly number[], taken: readonly number[]): number {
  blocked.fill(0);
  // Pedestals and chests at their markers are solid too.
  for (const m of markers) if (m.ch === 'i' || m.ch === 'S' || m.ch === 'c') blocked[cellOf(m.col, m.row)] = 1;
  for (const t of taken) if (t >= 0) blocked[t] = 1;
  const before = reachable(w);
  const ok = (cell: number): boolean => {
    if (cell < 0 || cell >= CELLS || blocked[cell] || w.room.tiles[cell] !== Tile.Floor) return false;
    if (nearDoor(cell) || isMarker(markers, cell)) return false;
    blocked[cell] = 1;
    const after = reachable(w);
    blocked[cell] = 0;
    return after === before - 1;
  };
  for (const p of prefs) if (ok(p)) return p;
  const ref = prefs[0] ?? cellOf(6, 3);
  const rc = ref % ROOM_COLS;
  const rr = Math.floor(ref / ROOM_COLS);
  let best = -1;
  let bestD = Infinity;
  for (let cell = 0; cell < CELLS; cell++) {
    const d = Math.abs((cell % ROOM_COLS) - rc) + Math.abs(Math.floor(cell / ROOM_COLS) - rr) * 1.3;
    if (d >= bestD || !ok(cell)) continue;
    bestD = d;
    best = cell;
  }
  return best;
}

/** A cell for a FLAT floor object (grate, whirlpool, skylight): plain floor, not a marker or a door front. */
export function floorCell(w: World, markers: readonly RoomMarker[], prefs: readonly number[], taken: readonly number[]): number {
  const ok = (cell: number): boolean =>
    cell >= 0 && cell < CELLS && w.room.tiles[cell] === Tile.Floor && !DOOR_FRONTS.includes(cell) && !isMarker(markers, cell) && !taken.includes(cell);
  for (const p of prefs) if (ok(p)) return p;
  const ref = prefs[0] ?? cellOf(6, 3);
  let best = -1;
  let bestD = Infinity;
  for (let cell = 0; cell < CELLS; cell++) {
    const d = Math.abs((cell % ROOM_COLS) - (ref % ROOM_COLS)) + Math.abs(Math.floor(cell / ROOM_COLS) - Math.floor(ref / ROOM_COLS));
    if (d < bestD && ok(cell)) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

/** Preferred corners for a gambler / trader (quiet spots away from the doors). */
export const CORNER_PREFS: readonly (readonly number[])[] = [
  [cellOf(2, 1), cellOf(10, 1), cellOf(2, 5), cellOf(10, 5)],
  [cellOf(10, 1), cellOf(2, 5), cellOf(10, 5), cellOf(2, 1)],
  [cellOf(2, 5), cellOf(10, 5), cellOf(2, 1), cellOf(10, 1)],
  [cellOf(10, 5), cellOf(2, 1), cellOf(10, 1), cellOf(2, 5)],
];
export const JAR_PREFS: readonly number[] = [cellOf(10, 1), cellOf(2, 1), cellOf(11, 5), cellOf(1, 5), cellOf(9, 5)];
export const GRATE_PREFS: readonly number[] = [cellOf(6, 5), cellOf(3, 3), cellOf(9, 3), cellOf(6, 1), cellOf(3, 5), cellOf(9, 5)];
export const WHIRLPOOL_PREFS: readonly number[] = [cellOf(9, 3), cellOf(9, 2), cellOf(9, 4), cellOf(10, 3)];
export const SKYLIGHT_PREFS: readonly number[] = [cellOf(3, 3), cellOf(3, 2), cellOf(3, 4), cellOf(2, 3)];

/** Where Magpie / the Moth Broker perch on the top wall (room px along the wall). */
export const NPC_WALL_X = TILE * 3 + 8;

const MAGPIE_LINES = [
  'MAGPIE: SHINY THINGS FOR SHINY COINS!',
  'MAGPIE: NO TOUCHING UNLESS BUYING, DEAR.',
  'MAGPIE: FOUND IT ALL IN THE RAIN. HONEST.',
  'MAGPIE: EVERYTHING MUST GO. EXCEPT ME.',
];
const BROKER_LINES = [
  'THE MOTH BROKER: A LITTLE HEART FOR A LOT OF POWER...',
  'THE MOTH BROKER: CHOOSE ONE. THE OTHER FLUTTERS AWAY.',
];
const PELL_LINES = ['OLD PELL: THREE KEYS, AND IT IS YOURS. NO RUSH...', 'OLD PELL: SLOW TRADES ARE THE BEST TRADES.'];

/** A greeting for a room's NPC (deterministic per floor). */
export function npcLine(kind: 'magpie' | 'broker' | 'pell', salt: number): string {
  const list = kind === 'magpie' ? MAGPIE_LINES : kind === 'broker' ? BROKER_LINES : PELL_LINES;
  return list[Math.abs(salt) % list.length]!;
}
