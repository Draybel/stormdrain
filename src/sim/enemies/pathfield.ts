/**
 * Grid flow field for path-finding walkers (the `chasePath` behaviour). One field per room is shared
 * by every enemy: a Dijkstra distance map (orthogonal step 2, diagonal 3, no corner cutting) over the
 * 13×7 walkable cells, seeded at the target's cell. It is recomputed at most every few ticks, or when
 * the target changes cell or the grid changes (a rock was bombed). Allocation-free.
 */

import type { Vec2 } from '../../engine/math';
import { circleOverlapsGrid, type CollideMode } from '../collision';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../constants';
import type { RoomGrid } from '../room';
import { blocksWalk } from '../tiles';

const N = ROOM_COLS * ROOM_ROWS;
export const UNREACHABLE = 0x7fff;

const DC = [1, -1, 0, 0, 1, 1, -1, -1] as const;
const DR = [0, 0, 1, -1, 1, -1, 1, -1] as const;
const COST = [2, 2, 2, 2, 3, 3, 3, 3] as const;

export class FlowField {
  /** Path cost from each cell to the target (UNREACHABLE for walls / cut-off cells). */
  readonly dist = new Int16Array(N);
  private readonly done = new Uint8Array(N);
  private readonly walk = new Uint8Array(N);
  targetCell = -1;
  roomVersion = -1;
  /** World tick of the last recompute. */
  tick = -1e9;
  /** Recomputes performed (diagnostics / tests). */
  computes = 0;

  /** Recomputes if older than `every` ticks, the target moved to another cell, or the grid changed. */
  refresh(room: RoomGrid, tick: number, tx: number, ty: number, every: number): void {
    const col = clampInt(Math.floor(tx / TILE), 0, ROOM_COLS - 1);
    const row = clampInt(Math.floor(ty / TILE), 0, ROOM_ROWS - 1);
    const cell = row * ROOM_COLS + col;
    if (room.version === this.roomVersion && tick - this.tick < every && cell === this.targetCell) return;
    this.compute(room, cell);
    this.tick = tick;
  }

  /** Forces the next refresh to recompute (new room). */
  invalidate(): void {
    this.roomVersion = -1;
    this.targetCell = -1;
  }

  compute(room: RoomGrid, target: number): void {
    this.computes++;
    this.targetCell = target;
    this.roomVersion = room.version;
    const dist = this.dist;
    const done = this.done;
    const walk = this.walk;
    for (let i = 0; i < N; i++) {
      dist[i] = UNREACHABLE;
      done[i] = 0;
      walk[i] = blocksWalk(room.tiles[i]!) ? 0 : 1;
    }
    // The target stands on a walkable cell in practice; if not, seed its walkable neighbours.
    if (walk[target]) {
      dist[target] = 0;
    } else {
      const tc = target % ROOM_COLS;
      const tr = (target / ROOM_COLS) | 0;
      for (let k = 0; k < 8; k++) {
        const c = tc + DC[k]!;
        const r = tr + DR[k]!;
        if (c < 0 || r < 0 || c >= ROOM_COLS || r >= ROOM_ROWS) continue;
        const j = r * ROOM_COLS + c;
        if (walk[j]) dist[j] = COST[k]!;
      }
    }
    // O(n²) Dijkstra: n = 91, cheaper than any heap here.
    for (;;) {
      let best = -1;
      let bestD = UNREACHABLE;
      for (let i = 0; i < N; i++) {
        if (!done[i] && dist[i]! < bestD) {
          bestD = dist[i]!;
          best = i;
        }
      }
      if (best < 0) break;
      done[best] = 1;
      const bc = best % ROOM_COLS;
      const br = (best / ROOM_COLS) | 0;
      for (let k = 0; k < 8; k++) {
        const c = bc + DC[k]!;
        const r = br + DR[k]!;
        if (c < 0 || r < 0 || c >= ROOM_COLS || r >= ROOM_ROWS) continue;
        const j = r * ROOM_COLS + c;
        if (!walk[j] || done[j]) continue;
        // No corner cutting: a diagonal step needs both orthogonal neighbours open.
        if (k >= 4 && (!walk[br * ROOM_COLS + c] || !walk[r * ROOM_COLS + bc])) continue;
        const nd = bestD + COST[k]!;
        if (nd < dist[j]!) dist[j] = nd;
      }
    }
  }

  /**
   * Direction to walk from (x, y) toward the target: to the centre of the cheapest neighbouring
   * cell. Writes a unit vector into `out`; returns false when there is no path from here.
   */
  dirAt(x: number, y: number, out: Vec2): boolean {
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || row < 0 || col >= ROOM_COLS || row >= ROOM_ROWS) return false;
    const here = row * ROOM_COLS + col;
    const dHere = this.dist[here]!;
    if (dHere === 0) return false;
    let best = -1;
    let bestD = dHere === UNREACHABLE ? UNREACHABLE : dHere;
    for (let k = 0; k < 8; k++) {
      const c = col + DC[k]!;
      const r = row + DR[k]!;
      if (c < 0 || r < 0 || c >= ROOM_COLS || r >= ROOM_ROWS) continue;
      const j = r * ROOM_COLS + c;
      const d = this.dist[j]!;
      if (d >= bestD) continue;
      if (k >= 4 && (this.dist[row * ROOM_COLS + c] === UNREACHABLE || this.dist[r * ROOM_COLS + col] === UNREACHABLE)) continue;
      bestD = d;
      best = j;
    }
    if (best < 0) return false;
    const tx = (best % ROOM_COLS) * TILE + TILE / 2;
    const ty = ((best / ROOM_COLS) | 0) * TILE + TILE / 2;
    const dx = tx - x;
    const dy = ty - y;
    const l = Math.sqrt(dx * dx + dy * dy);
    if (l < 1e-4) return false;
    out.x = dx / l;
    out.y = dy / l;
    return true;
  }
}

function clampInt(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * True if a circle of radius r can slide straight from (x0, y0) to (x1, y1) without touching
 * anything that blocks in `mode` (sampled every 4 px).
 */
export function lineClear(room: RoomGrid, x0: number, y0: number, x1: number, y1: number, r: number, mode: CollideMode): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.max(1, Math.ceil(len / 4));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (circleOverlapsGrid(room, x0 + dx * t, y0 + dy * t, r, mode)) return false;
  }
  return true;
}
