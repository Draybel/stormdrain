import { describe, expect, it } from 'vitest';
import { Rng, floorRng, hashString, seedToU32 } from '../src/engine/rng';

function take(r: Rng, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(r.nextU32());
  return out;
}

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    expect(take(new Rng(12345), 50)).toEqual(take(new Rng(12345), 50));
    expect(take(new Rng('stormdrain'), 50)).toEqual(take(new Rng('stormdrain'), 50));
  });

  it('differs for different seeds', () => {
    expect(take(new Rng(1), 20)).not.toEqual(take(new Rng(2), 20));
    expect(take(new Rng('a'), 20)).not.toEqual(take(new Rng('b'), 20));
  });

  it('produces floats in [0,1) and ints within inclusive bounds', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 5000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-2, 3);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(3);
      expect(Number.isInteger(n)).toBe(true);
      seen.add(n);
      const g = r.range(10, 20);
      expect(g).toBeGreaterThanOrEqual(10);
      expect(g).toBeLessThan(20);
    }
    expect(seen.size).toBe(6);
  });

  it('is roughly uniform', () => {
    const r = new Rng(99);
    const buckets = new Array(10).fill(0);
    const n = 100000;
    for (let i = 0; i < n; i++) buckets[Math.floor(r.next() * 10)]++;
    for (const b of buckets) expect(Math.abs(b - n / 10)).toBeLessThan(n / 10 * 0.05);
  });

  it('serializes and restores state exactly', () => {
    const a = new Rng('save-me');
    take(a, 37);
    const state = a.getState();
    const json = JSON.parse(JSON.stringify(state)) as typeof state;
    const b = Rng.fromState(json);
    expect(take(b, 100)).toEqual(take(a, 100));
    // setState rewinds an existing instance too.
    const c = new Rng(0);
    c.setState(state);
    const d = Rng.fromState(state);
    expect(take(c, 10)).toEqual(take(d, 10));
  });

  it('fork does not advance or disturb the parent', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const child = a.fork('loot');
    take(child, 100);
    expect(take(a, 30)).toEqual(take(b, 30));
  });

  it('forks are deterministic per label and independent across labels', () => {
    const p1 = new Rng(5);
    const p2 = new Rng(5);
    expect(take(p1.fork('x'), 20)).toEqual(take(p2.fork('x'), 20));
    const x = take(new Rng(5).fork('x'), 20);
    const y = take(new Rng(5).fork('y'), 20);
    expect(x).not.toEqual(y);
    // Fork streams must not be a shifted copy of the parent stream.
    const parent = take(new Rng(5), 200);
    expect(parent.join(',')).not.toContain(x.slice(0, 3).join(','));
    // Low correlation between sibling forks.
    const fx = new Rng(5).fork('x');
    const fy = new Rng(5).fork('y');
    let same = 0;
    for (let i = 0; i < 2000; i++) if ((fx.next() < 0.5) === (fy.next() < 0.5)) same++;
    expect(Math.abs(same - 1000)).toBeLessThan(120);
  });

  it('floorRng depends only on (seed, floor, track)', () => {
    expect(take(floorRng(1234, 3, 'main'), 10)).toEqual(take(floorRng(1234, 3, 'main'), 10));
    expect(take(floorRng(1234, 3, 'main'), 10)).not.toEqual(take(floorRng(1234, 4, 'main'), 10));
    expect(take(floorRng(1234, 3, 'main'), 10)).not.toEqual(take(floorRng(1234, 3, 'alt'), 10));
  });

  it('pick / weightedPick / weightedIndex / shuffle behave', () => {
    const r = new Rng(3);
    const arr = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) expect(arr).toContain(r.pick(arr));
    expect(() => r.pick([])).toThrow();

    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const weights: Record<string, number> = { a: 1, b: 0, c: 3 };
    for (let i = 0; i < 4000; i++) counts[r.weightedPick(arr, (s) => weights[s]!)]!++;
    expect(counts.b).toBe(0);
    expect(counts.c! / counts.a!).toBeGreaterThan(2.4);
    expect(counts.c! / counts.a!).toBeLessThan(3.6);
    expect(r.weightedIndex([0, 0, 0])).toBe(-1);
    expect(r.weightedIndex([0, 5, 0])).toBe(1);

    const deck = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = new Rng(11).shuffle([...deck]);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(deck);
    expect(new Rng(11).shuffle([...deck])).toEqual(shuffled);
  });

  it('hashes strings and normalizes seeds to u32', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    for (const s of [0, 1, -1, 2 ** 40 + 7, Date.now(), NaN, 'seed']) {
      const u = seedToU32(s as number | string);
      expect(Number.isInteger(u)).toBe(true);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(2 ** 32);
    }
  });
});
