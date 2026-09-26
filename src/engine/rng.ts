/**
 * Seeded, serializable random numbers (sfc32 core, splitmix32 seeding).
 *
 * - `new Rng(seed)` accepts a number or a string (strings are hashed).
 * - `getState()` / `Rng.fromState()` round-trip exactly (plain JSON-able tuple).
 * - `fork(label)` derives an independent child stream from the current state + label WITHOUT
 *   advancing the parent, so adding a fork never shifts the parent's sequence.
 */

export type RngState = [number, number, number, number];

/** 32-bit string hash (FNV-1a followed by a murmur3 finalizer for good avalanche). */
export function hashString(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return fmix32(h);
}

/** murmur3 32-bit finalizer. */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Normalizes a user seed (number or text) to an unsigned 32-bit integer. */
export function seedToU32(seed: number | string): number {
  if (typeof seed === 'string') return hashString(seed);
  if (!Number.isFinite(seed)) return 0;
  // Fold in the high bits of large integers (e.g. Date.now()).
  const hi = Math.floor(seed / 4294967296);
  return (fmix32((seed >>> 0) ^ Math.imul(hi | 0, 0x9e3779b1))) >>> 0;
}

export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: number | string = 0) {
    this.reseed(seed);
  }

  static fromState(state: RngState): Rng {
    const r = new Rng(0);
    r.setState(state);
    return r;
  }

  reseed(seed: number | string): void {
    let s = seedToU32(seed);
    // splitmix32 expands one word into four well-mixed state words.
    const next = (): number => {
      s = (s + 0x9e3779b9) | 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
      return (z ^ (z >>> 16)) >>> 0;
    };
    this.a = next();
    this.b = next();
    this.c = next();
    this.d = next();
    for (let i = 0; i < 12; i++) this.nextU32();
  }

  getState(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  setState(state: RngState): void {
    this.a = state[0] | 0;
    this.b = state[1] | 0;
    this.c = state[2] | 0;
    this.d = state[3] | 0;
  }

  /** Uniform unsigned 32-bit integer. */
  nextU32(): number {
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const t = (((a + b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = b ^ (b >>> 9);
    this.b = (c + (c << 3)) | 0;
    const cr = (c << 21) | (c >>> 11);
    this.c = (cr + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number {
    if (max < min) {
      const t = min;
      min = max;
      max = t;
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** -1 or +1. */
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[Math.floor(this.next() * arr.length)] as T;
  }

  /** Index chosen proportionally to non-negative weights; -1 if all weights are zero. */
  weightedIndex(weights: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += Math.max(0, weights[i] ?? 0);
    if (total <= 0) return -1;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i] ?? 0);
      if (r < w) return i;
      r -= w;
    }
    // Floating point edge: return the last positive weight.
    for (let i = weights.length - 1; i >= 0; i--) if ((weights[i] ?? 0) > 0) return i;
    return -1;
  }

  /** Picks an item proportionally to `weight(item)`. Throws if nothing has positive weight. */
  weightedPick<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of items) total += Math.max(0, weight(it));
    if (total <= 0) throw new Error('Rng.weightedPick: no positive weights');
    let r = this.next() * total;
    let last: T | undefined;
    for (const it of items) {
      const w = Math.max(0, weight(it));
      if (w <= 0) continue;
      last = it;
      if (r < w) return it;
      r -= w;
    }
    return last as T;
  }

  /** In-place Fisher-Yates shuffle. Returns the same array. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = arr[i] as T;
      arr[i] = arr[j] as T;
      arr[j] = t;
    }
    return arr;
  }

  /**
   * Independent child stream derived from (current state, label). Does not advance this Rng.
   * Same state + same label => same child; different labels => unrelated streams.
   */
  fork(label: string): Rng {
    const h = hashString(label);
    const child = new Rng(0);
    child.a = fmix32(this.a ^ h) | 0;
    child.b = fmix32((this.b + Math.imul(h, 0x9e3779b1)) | 0) | 0;
    child.c = fmix32(this.c ^ fmix32(h ^ 0x68e31da4)) | 0;
    child.d = fmix32((this.d + 0x1b56c4e9) ^ h) | 0;
    if ((child.a | child.b | child.c | child.d) === 0) child.d = 1;
    for (let i = 0; i < 12; i++) child.nextU32();
    return child;
  }
}

/**
 * The floor stream: depends ONLY on (run seed, floor index, track) so floor contents never
 * depend on how the run was played (ARCHITECTURE §3).
 */
export function floorRng(runSeed: number, floorIndex: number, track: string): Rng {
  return new Rng(runSeed).fork(`floor:${floorIndex}:${track}`);
}

/** A fresh random 32-bit seed for new runs (not deterministic; UI only). */
export function randomSeed(): number {
  return seedToU32(Date.now() ^ Math.floor(Math.random() * 4294967296));
}
