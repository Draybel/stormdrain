/**
 * Pooled presentation-only particles (cap 1500, ARCHITECTURE §4.5). Screen-space game pixels.
 * Randomness here is cosmetic, so Math.random is fine (never feeds back into the sim).
 */

import { Pool, type Poolable } from '../engine/pool';

export const PARTICLE_CAP = 1500;

/** Particle shapes. */
export const P_SQUARE = 0; // size×size block
export const P_STREAK = 1; // falling rain streak (1 px wide, `size` tall, slanted by vx)
export const P_RING = 2; // expanding hollow ring (splash) — size grows over life
export type ParticleKind = 0 | 1 | 2;

export class Particle implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  /** Seconds left and total lifetime. */
  life = 0;
  maxLife = 1;
  size = 1;
  /** Size at end of life (squares shrink toward it; rings grow toward it). */
  endSize = 1;
  gravity = 0;
  /** Velocity damping per second (0 = none). */
  drag = 0;
  color = '#ffffff';
  kind: ParticleKind = P_SQUARE;
  /** Fade out over the last part of life. */
  fade = true;
  /** Optional floor line: particles bounce/settle when they fall below it. */
  floorY = Infinity;
}

export class ParticleSystem {
  readonly pool = new Pool<Particle>(PARTICLE_CAP, () => new Particle());

  get count(): number {
    return this.pool.count;
  }

  /** Returns the particle for further tweaking, or null if the cap is reached (it just drops). */
  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size = 1,
    kind: ParticleKind = P_SQUARE,
  ): Particle | null {
    const p = this.pool.alloc();
    if (!p) return null;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.maxLife = life;
    p.color = color;
    p.size = p.endSize = size;
    p.kind = kind;
    p.gravity = 0;
    p.drag = 0;
    p.fade = true;
    p.floorY = Infinity;
    return p;
  }

  /** Radial burst of squares. */
  burst(
    x: number,
    y: number,
    count: number,
    speedMin: number,
    speedMax: number,
    life: number,
    colors: readonly string[],
    size = 1,
    gravity = 0,
    drag = 3,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speedMin + Math.random() * (speedMax - speedMin);
      const p = this.spawn(
        x,
        y,
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        life * (0.6 + Math.random() * 0.6),
        colors[(Math.random() * colors.length) | 0]!,
        size,
      );
      if (!p) return;
      p.gravity = gravity;
      p.drag = drag;
      p.endSize = size > 1 ? 1 : size;
    }
  }

  update(dt: number): void {
    const pool = this.pool;
    for (let i = pool.count - 1; i >= 0; i--) {
      const p = pool.items[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        pool.release(p);
        continue;
      }
      if (p.drag > 0) {
        const k = Math.max(0, 1 - p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > p.floorY) {
        p.y = p.floorY;
        p.vy *= -0.3;
        p.vx *= 0.6;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const pool = this.pool;
    let lastColor = '';
    let lastAlpha = 1;
    for (let i = 0; i < pool.count; i++) {
      const p = pool.items[i]!;
      const t = p.life / p.maxLife; // 1 → 0
      const alpha = p.fade ? (t < 0.4 ? t / 0.4 : 1) : 1;
      if (alpha !== lastAlpha) {
        ctx.globalAlpha = alpha;
        lastAlpha = alpha;
      }
      if (p.color !== lastColor) {
        ctx.fillStyle = p.color;
        lastColor = p.color;
      }
      const x = Math.round(p.x + ox);
      const y = Math.round(p.y + oy);
      if (p.kind === P_SQUARE) {
        const s = Math.max(1, Math.round(p.endSize + (p.size - p.endSize) * t));
        const h = s >> 1;
        ctx.fillRect(x - h, y - h, s, s);
      } else if (p.kind === P_STREAK) {
        // Two stacked pixels runs, offset by the wind direction, read as a slanted streak.
        const len = Math.max(1, Math.round(p.size));
        const half = len >> 1;
        const lean = p.vx < -1 ? 1 : p.vx > 1 ? -1 : 0;
        ctx.fillRect(x, y, 1, len - half);
        ctx.fillRect(x + lean, y - half, 1, half);
      } else {
        const r = Math.round(p.endSize + (p.size - p.endSize) * t);
        drawPixelRing(ctx, x, y, r);
      }
    }
    if (lastAlpha !== 1) ctx.globalAlpha = 1;
  }

  clear(): void {
    this.pool.clear();
  }
}

/** Unit circle sampled at 16 points (precomputed so rings cost no trig per frame). */
const RING_N = 16;
const RING_COS = new Float32Array(RING_N);
const RING_SIN = new Float32Array(RING_N);
for (let i = 0; i < RING_N; i++) {
  RING_COS[i] = Math.cos((i / RING_N) * Math.PI * 2);
  RING_SIN[i] = Math.sin((i / RING_N) * Math.PI * 2);
}

/** A flat (2:1 perspective) pixel ellipse outline — a splash ring on the floor. */
function drawPixelRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  if (r <= 0) {
    ctx.fillRect(x, y, 1, 1);
    return;
  }
  const n = r < 3 ? 8 : RING_N;
  const step = RING_N / n;
  for (let i = 0; i < RING_N; i += step) {
    ctx.fillRect(x + Math.round(RING_COS[i]! * r), y + Math.round(RING_SIN[i]! * r * 0.5), 1, 1);
  }
}
