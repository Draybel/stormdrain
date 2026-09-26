/**
 * Small numeric helpers. Everything here works on plain numbers or writes into a caller-provided
 * `out` vector so hot loops never allocate.
 */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Mutable 2D vector. Allocate once (e.g. module-level scratch) and reuse. */
export interface Vec2 {
  x: number;
  y: number;
}

export function vec2(x = 0, y = 0): Vec2 {
  return { x, y };
}

export function setVec(out: Vec2, x: number, y: number): Vec2 {
  out.x = x;
  out.y = y;
  return out;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/** Move `cur` toward `target` by at most `maxDelta` (never overshoots). */
export function approach(cur: number, target: number, maxDelta: number): number {
  if (cur < target) return cur + maxDelta >= target ? target : cur + maxDelta;
  return cur - maxDelta <= target ? target : cur - maxDelta;
}

/** Frame-rate independent exponential smoothing toward `target` (lambda = 1/seconds-ish). */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  return lerp(cur, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function len(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function len2(x: number, y: number): number {
  return x * x + y * y;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/**
 * Writes the unit vector of (x, y) into `out` and returns the original length.
 * A zero vector stays zero.
 */
export function normalize(out: Vec2, x: number, y: number): number {
  const l = Math.sqrt(x * x + y * y);
  if (l > 1e-9) {
    out.x = x / l;
    out.y = y / l;
  } else {
    out.x = 0;
    out.y = 0;
  }
  return l;
}

/** Writes (x, y) into `out`, shortened to at most `max` length. */
export function clampLength(out: Vec2, x: number, y: number, max: number): Vec2 {
  const l2 = x * x + y * y;
  if (l2 > max * max) {
    const s = max / Math.sqrt(l2);
    out.x = x * s;
    out.y = y * s;
  } else {
    out.x = x;
    out.y = y;
  }
  return out;
}

export function rotate(out: Vec2, x: number, y: number, angle: number): Vec2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out.x = x * c - y * s;
  out.y = x * s + y * c;
  return out;
}

export function fromAngle(out: Vec2, angle: number, length = 1): Vec2 {
  out.x = Math.cos(angle) * length;
  out.y = Math.sin(angle) * length;
  return out;
}

export function angleOf(x: number, y: number): number {
  return Math.atan2(y, x);
}

/** Wraps an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

/** Signed shortest difference b - a in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  return wrapAngle(b - a);
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}

/**
 * Snaps a direction to the dominant axis (4-way). Writes a unit vector (or zero) into `out`.
 * Ties favour the horizontal axis.
 */
export function snap4(out: Vec2, x: number, y: number): Vec2 {
  if (x === 0 && y === 0) return setVec(out, 0, 0);
  if (Math.abs(x) >= Math.abs(y)) return setVec(out, x > 0 ? 1 : -1, 0);
  return setVec(out, 0, y > 0 ? 1 : -1);
}

export function isFiniteNumber(v: number): boolean {
  return v === v && v !== Infinity && v !== -Infinity;
}
