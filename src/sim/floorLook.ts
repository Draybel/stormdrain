/**
 * Which floor frame a room cell shows (plain, split, cracked, mossy or a decorative drain grate). Pure — it
 * depends only on the room's style seed, the cell and what lies on it — so the renderer (render/roomBg.ts)
 * draws it and the sim can ask it: the hidden-route grate must never sit on a cell that already shows a
 * decorative grate, or the cracked one would not read as different.
 */

import { fmix32 } from '../engine/rng';
import { ROOM_COLS, ROOM_ROWS } from './constants';
import { Deco, Tile } from './tiles';

/** Floor frame indices (the chapter floor sprites use this frame order; content/sprites FLOOR_VARIANT). */
export const FLOOR_LOOK = { plain: 0, split: 1, cracked: 2, mossy: 3, grate: 4 } as const;

/** Deterministic 0..1 value for a cell (+ salt), independent of every other cell. */
export function cellRand(seed: number, c: number, r: number, salt: number): number {
  return fmix32((seed ^ Math.imul(c + 11, 0x9e3779b1) ^ Math.imul(r + 7, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0) / 4294967296;
}

/** Index picked by `u` (0..1) from relative weights. */
export function weightedPick(u: number, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let x = u * total;
  for (let i = 0; i < weights.length; i++) {
    if (x < weights[i]!) return i;
    x -= weights[i]!;
  }
  return weights.length - 1;
}

const weights = [45, 30, 12, 6, 0];

/**
 * The floor frame (FLOOR_LOOK) of cell (c, r): moss likes the edges, the decorative grate only shows on plain
 * floor without debris. `tile` / `deco` are the cell's RoomGrid values.
 */
export function floorLookAt(seed: number, c: number, r: number, tile: number, deco: number): number {
  const edge = r === 0 || c === 0 || r === ROOM_ROWS - 1 || c === ROOM_COLS - 1;
  weights[3] = edge ? 22 : 6;
  weights[4] = tile === Tile.Floor && deco === Deco.None ? 2.5 : 0;
  return weightedPick(cellRand(seed, c, r, 1), weights);
}
