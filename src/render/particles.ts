/**
 * Pooled presentation-only particles (cap 800, ARCHITECTURE §4.5). Screen-space game pixels.
 * Randomness here is cosmetic, so Math.random is fine (never feeds back into the sim).
 *
 * Budget (polish batch 2): every spawn has a priority. COSMETIC ones (shot trails, ambience, hit sparks) are refused
 * once the pool is COSMETIC_SHARE full; IMPORTANT ones (the default: kills, hurts, explosions, room clears, items,
 * pickups…) are never refused — at the cap they recycle the oldest cosmetic particle, else the oldest important one
 * (two spawn-order rings of (particle, serial), no scanning, no allocation). So a big build's sparks can't crowd out
 * the bursts that say something happened.
 *
 * Drawing (polish batch 2): colours are interned into a palette index at spawn; each frame the particles are
 * bucketed by (alpha level, colour) with a counting sort over preallocated index arrays — alpha is quantised to
 * ALPHA_LEVELS steps — so the canvas state changes once per bucket (≤ colours × levels) instead of per particle.
 */

import { Pool, type Poolable } from '../engine/pool';

export const PARTICLE_CAP = 800;
/** Cosmetic spawns are refused once the pool is this full. */
export const COSMETIC_SHARE = 0.7;
export const COSMETIC_LIMIT = Math.floor(PARTICLE_CAP * COSMETIC_SHARE);
/** Fade alpha is drawn in this many steps (1/6 … 6/6). */
export const ALPHA_LEVELS = 6;

/** Particle shapes. */
export const P_SQUARE = 0; // size×size block
export const P_STREAK = 1; // falling rain streak (1 px wide, `size` tall, slanted by vx)
export const P_RING = 2; // expanding hollow ring (splash) — size grows over life
export type ParticleKind = 0 | 1 | 2;

/** Spawn priority: 'cosmetic' (trails, ambience, hit sparks) yields to 'important' (the default). */
export type ParticlePriority = 'cosmetic' | 'important';

// ── Colour palette (interned once per distinct colour string) ──
const PALETTE: string[] = [];
const PALETTE_INDEX = new Map<string, number>();

/** The palette index of a colour string (interned on first use). */
export function colorIndex(color: string): number {
  let i = PALETTE_INDEX.get(color);
  if (i === undefined) {
    i = PALETTE.length;
    PALETTE.push(color);
    PALETTE_INDEX.set(color, i);
  }
  return i;
}
// Index 0 is white: a fresh Particle starts as '#ffffff' with ci 0.
colorIndex('#ffffff');

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
  /** Palette index of `color` (set at spawn). */
  ci = 0;
  kind: ParticleKind = P_SQUARE;
  /** Fade out over the last part of life. */
  fade = true;
  /** Optional floor line: particles bounce/settle when they fall below it. */
  floorY = Infinity;
  /** Spawned as important (never refused; recycles cosmetic ones at the cap). */
  important = true;
  /** Spawn serial (the recycle rings tell a live entry from a reused slot by it). */
  serial = 0;
}

/** A ring of (particle, serial) in spawn order: its head is the oldest entry still possibly alive. */
class SpawnRing {
  private readonly ps: (Particle | null)[];
  private readonly serials: Float64Array;
  private head = 0;
  private size = 0;

  constructor(private readonly cap: number) {
    this.ps = new Array<Particle | null>(cap).fill(null);
    this.serials = new Float64Array(cap);
  }

  push(p: Particle): void {
    if (this.size === this.cap) {
      // Full: forget the oldest entry (almost always long dead).
      this.head = (this.head + 1) % this.cap;
      this.size--;
    }
    const i = (this.head + this.size) % this.cap;
    this.ps[i] = p;
    this.serials[i] = p.serial;
    this.size++;
  }

  /** The oldest particle of this ring still alive as that spawn (its entry is used up), or null. */
  popOldest(important: boolean): Particle | null {
    while (this.size > 0) {
      const i = this.head;
      const p = this.ps[i]!;
      const serial = this.serials[i]!;
      this.ps[i] = null;
      this.head = (this.head + 1) % this.cap;
      this.size--;
      if (p.alive && p.serial === serial && p.important === important) return p;
    }
    return null;
  }

  clear(): void {
    this.ps.fill(null);
    this.head = 0;
    this.size = 0;
  }
}

export class ParticleSystem {
  readonly pool = new Pool<Particle>(PARTICLE_CAP, () => new Particle());
  /** Cosmetic spawns refused (over COSMETIC_LIMIT or at the cap). */
  refusedCosmetic = 0;
  /** Important spawns refused (only possible if nothing at all could be recycled). */
  refusedImportant = 0;
  /** Particles recycled for an important spawn at the cap. */
  recycled = 0;
  private serial = 0;
  private readonly cosmeticRing = new SpawnRing(PARTICLE_CAP * 2);
  private readonly importantRing = new SpawnRing(PARTICLE_CAP * 2);
  // Draw buckets (counting sort): per particle its bucket key and the draw order; per key its range.
  private readonly keyOf = new Int32Array(PARTICLE_CAP);
  private readonly order = new Int32Array(PARTICLE_CAP);
  private readonly usedKeys = new Int32Array(PARTICLE_CAP);
  private bucketCount = new Int32Array(64 * ALPHA_LEVELS);
  private bucketStart = new Int32Array(64 * ALPHA_LEVELS);
  private bucketEnd = new Int32Array(64 * ALPHA_LEVELS);

  get count(): number {
    return this.pool.count;
  }

  /**
   * A particle, or null when it was refused (a cosmetic spawn over its share of the pool). Important spawns (the
   * default) are never refused: at the cap they take over the oldest cosmetic particle, else the oldest important one.
   */
  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    color: string,
    size = 1,
    kind: ParticleKind = P_SQUARE,
    priority: ParticlePriority = 'important',
  ): Particle | null {
    const important = priority !== 'cosmetic';
    let p: Particle | null;
    if (!important) {
      if (this.pool.count >= COSMETIC_LIMIT) {
        this.refusedCosmetic++;
        return null;
      }
      p = this.pool.alloc();
    } else {
      p = this.pool.count < this.pool.capacity ? this.pool.alloc() : this.recycle();
      if (!p) {
        this.refusedImportant++;
        return null;
      }
    }
    if (!p) {
      this.refusedCosmetic++;
      return null;
    }
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = p.maxLife = life;
    if (p.color !== color) {
      p.color = color;
      p.ci = colorIndex(color);
    }
    p.size = p.endSize = size;
    p.kind = kind;
    p.gravity = 0;
    p.drag = 0;
    p.fade = true;
    p.floorY = Infinity;
    p.important = important;
    p.serial = ++this.serial;
    (important ? this.importantRing : this.cosmeticRing).push(p);
    return p;
  }

  /** spawn(…, 'cosmetic'): trails, ambience and hit sparks — refused once the pool is COSMETIC_SHARE full. */
  spawnCosmetic(x: number, y: number, vx: number, vy: number, life: number, color: string, size = 1, kind: ParticleKind = P_SQUARE): Particle | null {
    return this.spawn(x, y, vx, vy, life, color, size, kind, 'cosmetic');
  }

  /** burst(…, 'cosmetic'). */
  burstCosmetic(x: number, y: number, count: number, speedMin: number, speedMax: number, life: number, colors: readonly string[], size = 1, gravity = 0, drag = 3): void {
    this.burst(x, y, count, speedMin, speedMax, life, colors, size, gravity, drag, 'cosmetic');
  }

  /** The oldest cosmetic particle, else the oldest important one — reused in place (keeps its pool slot). */
  private recycle(): Particle | null {
    const p = this.cosmeticRing.popOldest(false) ?? this.importantRing.popOldest(true);
    if (p) this.recycled++;
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
    priority: ParticlePriority = 'important',
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
        P_SQUARE,
        priority,
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

  /** Grows the per-key bucket arrays when the palette outgrew them (only when a new colour appeared). */
  private ensureBuckets(): void {
    const need = PALETTE.length * ALPHA_LEVELS;
    if (need <= this.bucketCount.length) return;
    let n = this.bucketCount.length;
    while (n < need) n *= 2;
    this.bucketCount = new Int32Array(n);
    this.bucketStart = new Int32Array(n);
    this.bucketEnd = new Int32Array(n);
  }

  /**
   * Draws every particle bucketed by (alpha level, colour): globalAlpha changes at most once per level and
   * fillStyle once per bucket, whatever the particle count. Nothing allocates.
   */
  draw(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
    const pool = this.pool;
    const n = pool.count;
    if (n === 0) return;
    this.ensureBuckets();
    const L = ALPHA_LEVELS;
    const keyOf = this.keyOf;
    const count = this.bucketCount;
    const start = this.bucketStart;
    const end = this.bucketEnd;
    const used = this.usedKeys;
    let usedN = 0;
    // 1. Bucket keys (colour × level) and their sizes.
    for (let i = 0; i < n; i++) {
      const p = pool.items[i]!;
      let q = L;
      if (p.fade) {
        const t = p.life / p.maxLife; // 1 → 0
        if (t < 0.4) q = Math.max(1, Math.min(L, Math.ceil((t / 0.4) * L)));
      }
      const key = p.ci * L + (q - 1);
      keyOf[i] = key;
      if (count[key]++ === 0) used[usedN++] = key;
    }
    // 2. Ranges, then the draw order (each bucket's slice filled from its end; count returns to 0).
    let sum = 0;
    for (let u = 0; u < usedN; u++) {
      const key = used[u]!;
      start[key] = sum;
      sum += count[key]!;
      end[key] = sum;
    }
    for (let i = 0; i < n; i++) {
      const key = keyOf[i]!;
      this.order[start[key]! + --count[key]!] = i;
    }
    // 3. Draw level by level (one globalAlpha each), bucket by bucket (one fillStyle each).
    let alphaSet = false;
    for (let lv = 0; lv < L; lv++) {
      let levelOn = false;
      for (let u = 0; u < usedN; u++) {
        const key = used[u]!;
        if (key % L !== lv) continue;
        if (!levelOn) {
          ctx.globalAlpha = (lv + 1) / L;
          levelOn = true;
          alphaSet = true;
        }
        ctx.fillStyle = PALETTE[(key / L) | 0]!;
        const e = end[key]!;
        for (let j = start[key]!; j < e; j++) this.drawOne(ctx, pool.items[this.order[j]!]!, ox, oy);
      }
    }
    if (alphaSet) ctx.globalAlpha = 1;
  }

  private drawOne(ctx: CanvasRenderingContext2D, p: Particle, ox: number, oy: number): void {
    const t = p.life / p.maxLife; // 1 → 0
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

  clear(): void {
    this.pool.clear();
    this.cosmeticRing.clear();
    this.importantRing.clear();
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
