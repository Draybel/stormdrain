/**
 * Per-tick snapshot of everything player attacks can hit (hittable enemies, then standing dummies):
 * flat arrays so homing, beam traces, chains and swipes scan a short list without touching the pools.
 * Taken once at the start of the attack update; `hittable` is re-checked on use (things die mid-tick).
 */

import type { Hittable } from '../hittable';
import { ST_CHARM } from '../enemies/status';
import type { World } from '../world';
import { recentlyHit, type ShotState } from './state';

/** Most targets a snapshot holds (enemies 64 + dummies 16, with room to spare). */
export const TARGET_CAP = 96;
const CAP = TARGET_CAP;

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

/**
 * The target a homing shot heading `heading` (rad) can actually reach, or -1. A shot turning at most
 * `turnR` px of radius can't reach anything deep inside its two turning circles (it would orbit it
 * forever), so those are skipped (θ = the bearing off the heading; `slack` = the shot's own radius
 * counts as reach). Among the reachable ones within `maxDist` (edge distance) the
 * cheapest path wins: distance + turnR·|θ| (the arc it has to turn), so targets ahead beat closer
 * ones beside or behind — and with nothing ahead a shot still U-turns into what's behind it.
 * Targets `shot` hit within its re-hit window (a piercing shot moving on) are skipped.
 */
export function seekTarget(
  t: TargetSnapshot,
  x: number,
  y: number,
  heading: number,
  maxDist: number,
  turnR: number,
  slack: number,
  shot: ShotState | null,
  tick: number,
): number {
  let best = -1;
  let bestCost = Infinity;
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  for (let i = 0; i < t.n; i++) {
    const h = t.refs[i]!;
    if (!h.hittable) continue;
    const dx = h.x - x;
    const dy = h.y - y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d - h.r > maxDist) continue;
    if (d < 1e-6) return i;
    const c = (dx * hx + dy * hy) / d; // cos θ
    const sn = Math.abs(dx * hy - dy * hx) / d; // |sin θ|
    // Inside the turning circle on its side (centre turnR px to that side), deeper than the shot can
    // clip from the circle's rim: it would only ever orbit it.
    const inner = turnR - h.r - slack;
    if (inner > 0 && d * d - 2 * d * turnR * sn + turnR * turnR < inner * inner) continue;
    const cost = d + turnR * Math.acos(c < -1 ? -1 : c > 1 ? 1 : c);
    if (cost >= bestCost) continue;
    if (shot !== null && recentlyHit(shot, h, tick)) continue;
    bestCost = cost;
    best = i;
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
