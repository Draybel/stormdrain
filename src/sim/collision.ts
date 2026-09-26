/**
 * Circle-vs-grid collision. Uses the closest point on each blocking tile's box, which gives smooth
 * sliding along flat walls (no seams between tiles) and rounds you around rock corners.
 */

import { TILE } from './constants';
import type { RoomGrid } from './room';
import { MODE_MASK, blocksMask, walkInset } from './tiles';
import { normalize, type Vec2 } from '../engine/math';

/** Collision mode: numeric so hot loops avoid string compares (see the masks in tiles.ts). */
export type CollideMode = 0 | 1 | 2 | 3;
/** On foot: pits block (with their lip inset). */
export const WALK_MODE: CollideMode = 0;
/** Marbles: fly over pits. */
export const SHOT_MODE: CollideMode = 1;
/** Flying players: cross pits, props still block (walk insets apply). */
export const FLY_MODE: CollideMode = 2;
/** Phasing shots: only walls block. */
export const PHASE_MODE: CollideMode = 3;

function insetFor(t: number, mode: CollideMode): number {
  return mode === WALK_MODE || mode === FLY_MODE ? walkInset(t) : 0;
}

/**
 * Pushes a circle out of every blocking tile (and the room walls). Mutates `pos`.
 * Returns true on contact; `normal` receives the unit push direction (zero if none).
 */
export function resolveCircleVsGrid(
  room: RoomGrid,
  pos: Vec2,
  r: number,
  mode: CollideMode,
  normal: Vec2,
): boolean {
  let hit = false;
  let nx = 0;
  let ny = 0;
  const r2 = r * r;
  const mask = MODE_MASK[mode]!;
  for (let iter = 0; iter < 4; iter++) {
    let moved = false;
    const c0 = Math.floor((pos.x - r) / TILE);
    const c1 = Math.floor((pos.x + r) / TILE);
    const r0 = Math.floor((pos.y - r) / TILE);
    const r1 = Math.floor((pos.y + r) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = room.get(col, row);
        if (!blocksMask(t, mask)) continue;
        const inset = insetFor(t, mode);
        const left = col * TILE + inset;
        const right = (col + 1) * TILE - inset;
        const top = row * TILE + inset;
        const bottom = (row + 1) * TILE - inset;
        const cx = pos.x < left ? left : pos.x > right ? right : pos.x;
        const cy = pos.y < top ? top : pos.y > bottom ? bottom : pos.y;
        let dx = pos.x - cx;
        let dy = pos.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        if (d2 > 1e-10) {
          const d = Math.sqrt(d2);
          const push = r - d;
          dx /= d;
          dy /= d;
          pos.x += dx * push;
          pos.y += dy * push;
          nx += dx;
          ny += dy;
        } else {
          // Centre is inside the box: leave along the axis of least penetration.
          const pl = pos.x - left + r;
          const pr = right - pos.x + r;
          const pt = pos.y - top + r;
          const pb = bottom - pos.y + r;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) {
            pos.x -= pl;
            nx -= 1;
          } else if (m === pr) {
            pos.x += pr;
            nx += 1;
          } else if (m === pt) {
            pos.y -= pt;
            ny -= 1;
          } else {
            pos.y += pb;
            ny += 1;
          }
        }
        hit = true;
        moved = true;
      }
    }
    if (!moved) break;
  }
  normalize(normal, nx, ny);
  return hit;
}

/** True if a circle overlaps any tile that blocks in `mode` (or the walls). No mutation. */
export function circleOverlapsGrid(room: RoomGrid, x: number, y: number, r: number, mode: CollideMode): boolean {
  return firstBlockingCell(room, x, y, r, mode) !== NO_CELL;
}

/** Returned by firstBlockingCell when nothing blocks. */
export const NO_CELL = -1;
/** Returned by firstBlockingCell when the circle touches the room's outer walls. */
export const WALL_CELL = -2;

/**
 * The first blocking cell a circle overlaps: an interior cell index (row * cols + col), WALL_CELL for
 * the room walls, or NO_CELL. Interior cells are preferred over walls when both touch.
 */
export function firstBlockingCell(room: RoomGrid, x: number, y: number, r: number, mode: CollideMode): number {
  const r2 = r * r;
  const mask = MODE_MASK[mode]!;
  let wall = false;
  const c0 = Math.floor((x - r) / TILE);
  const c1 = Math.floor((x + r) / TILE);
  const r0 = Math.floor((y - r) / TILE);
  const r1 = Math.floor((y + r) / TILE);
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      const t = room.get(col, row);
      if (!blocksMask(t, mask)) continue;
      const inset = insetFor(t, mode);
      const left = col * TILE + inset;
      const right = (col + 1) * TILE - inset;
      const top = row * TILE + inset;
      const bottom = (row + 1) * TILE - inset;
      const cx = x < left ? left : x > right ? right : x;
      const cy = y < top ? top : y > bottom ? bottom : y;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r2) {
        if (!room.inBounds(col, row)) wall = true;
        else return row * room.cols + col;
      }
    }
  }
  return wall ? WALL_CELL : NO_CELL;
}

/**
 * Pushes circle A (pos, ra) out of circle B (bx, by, rb). Returns true on contact and writes the
 * push normal (from B to A) into `normal`.
 */
export function resolveCircleVsCircle(
  pos: Vec2,
  ra: number,
  bx: number,
  by: number,
  rb: number,
  normal: Vec2,
): boolean {
  let dx = pos.x - bx;
  let dy = pos.y - by;
  const rr = ra + rb;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  const d = Math.sqrt(d2);
  if (d < 1e-6) {
    // Perfectly stacked: push straight down (deterministic).
    dx = 0;
    dy = 1;
  } else {
    dx /= d;
    dy /= d;
  }
  const push = rr - d;
  pos.x += dx * push;
  pos.y += dy * push;
  normal.x = dx;
  normal.y = dy;
  return true;
}
