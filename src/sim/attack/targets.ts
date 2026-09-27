/**
 * Per-tick snapshot of everything player attacks can hit (hittable enemies, then standing dummies):
 * flat arrays so homing, beam traces, chains and swipes scan a short list without touching the pools.
 * Taken once at the start of the attack update; `hittable` is re-checked on use (things die mid-tick).
 */

import type { Hittable } from '../hittable';
import { ST_CHARM } from '../enemies/status';
import type { World } from '../world';

const CAP = 96;

export class TargetSnapshot {
  readonly refs: Hittable[] = new Array<Hittable>(CAP);
  readonly x = new Float64Array(CAP);
  readonly y = new Float64Array(CAP);
  readonly r = new Float64Array(CAP);
  n = 0;
}

export function snapshotTargets(w: World, t: TargetSnapshot): void {
  let n = 0;
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count && n < CAP; i++) {
    const e = enemies.items[i]!;
    if (!e.hittable) continue;
    // Charmed enemies fight for you: your attacks leave them alone.
    if ((e.status.mask & (1 << ST_CHARM)) !== 0) continue;
    t.refs[n] = e;
    t.x[n] = e.x;
    t.y[n] = e.y;
    t.r[n] = e.r;
    n++;
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count && n < CAP; i++) {
    const d = dummies.items[i]!;
    if (!d.hittable) continue;
    t.refs[n] = d;
    t.x[n] = d.x;
    t.y[n] = d.y;
    t.r[n] = d.r;
    n++;
  }
  t.n = n;
}

/**
 * The nearest live target within `maxDist` of (x, y) (edge distance), skipping up to two refs.
 * Returns its snapshot index or -1.
 */
export function nearestTarget(
  t: TargetSnapshot,
  x: number,
  y: number,
  maxDist: number,
  skipA: Hittable | null = null,
  skipB: Hittable | null = null,
): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < t.n; i++) {
    const h = t.refs[i]!;
    if (h === skipA || h === skipB || !h.hittable) continue;
    const dx = h.x - x;
    const dy = h.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) - h.r;
    if (d < bestD && d <= maxDist) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Index of the first live target overlapping the circle (x, y, r), or -1. */
export function overlapTarget(t: TargetSnapshot, x: number, y: number, r: number, from = 0): number {
  for (let i = from; i < t.n; i++) {
    const h = t.refs[i]!;
    const dx = h.x - x;
    const dy = h.y - y;
    const rr = h.r + r;
    if (dx * dx + dy * dy < rr * rr && h.hittable) return i;
  }
  return -1;
}
