/**
 * Polish batch 4 (B4-4): item gating and unlock pacing. Every attack type and every modifier can turn up in a brand-new
 * player's runs (the Firecracker Pouch and the Neon Tube were locked behind wins with Pip and Bolt, and explode, extra
 * shots, split, freeze, charm, shrink and decelerate had no ungated item); the strongest plain boosts are re-rated; the
 * Broker's Nook has quality-3 deals of its own; the character unlocks take several runs (tests/balance/career.balance.ts
 * plays a whole career).
 */

import { describe, expect, it } from 'vitest';
import { allItems, allSynergies, findAchievement, getItem } from '../src/content/registry';
import { MetaStore } from '../src/meta/metaState';
import { MemoryStorage } from '../src/meta/storage';
import { lockedItems } from '../src/meta/unlocks';
import { CARRIER_IDS, MOD_IDS, type Effect, type ItemDef, type PoolId, type Requirement } from '../src/sim/types';

const FRESH_LOCKED = new Set(lockedItems(new MetaStore({ storage: new MemoryStorage() }).state));
const ROLLING: readonly PoolId[] = ['treasure', 'shop', 'boss'];

/** Everything an item grants (held effects and, for actives, what a use does). */
function effectsOf(d: ItemDef): readonly Effect[] {
  return [...d.effects, ...(d.active?.use ?? [])];
}

/** Ungated items that roll from the treasure, shop or boss pools. */
function freshRolling(): ItemDef[] {
  return allItems().filter((d) => !d.tags.includes('test') && !FRESH_LOCKED.has(d.id) && d.pools.some((p) => ROLLING.includes(p)));
}

describe('a fresh save can roll every attack type and every modifier', () => {
  it('every carrier has an item a brand-new player can find (treasure, shop or boss pool)', () => {
    const fresh = freshRolling();
    // (The marble is everyone's own attack: no item grants it.)
    for (const c of CARRIER_IDS.filter((id) => id !== 'marble')) {
      const carriers = fresh.filter((d) => effectsOf(d).some((e) => e.type === 'carrier' && e.carrier === c));
      expect(carriers.map((d) => d.id), `carrier ${c}`).not.toEqual([]);
    }
    // The two that used to wait on a character's win.
    for (const id of ['firecracker-pouch', 'neon-tube']) expect(FRESH_LOCKED.has(id), id).toBe(false);
  });

  it('every modifier has a passive a brand-new player can find (not only an active use)', () => {
    const fresh = freshRolling().filter((d) => d.kind === 'passive');
    for (const m of MOD_IDS) {
      const items = fresh.filter((d) => d.effects.some((e) => e.type === 'mod' && e.mod === m));
      expect(items.map((d) => d.id), `modifier ${m}`).not.toEqual([]);
    }
  });

  it('the fresh treasure pool has a real top end: 15+ quality-3 passives, and the Nook 8+ ungated deals', () => {
    const treasure = allItems().filter((d) => d.pools.includes('treasure') && !FRESH_LOCKED.has(d.id) && d.kind === 'passive');
    const top = treasure.filter((d) => d.quality >= 3);
    expect(top.length).toBeGreaterThanOrEqual(15);
    const broker = allItems().filter((d) => d.pools.includes('broker') && !FRESH_LOCKED.has(d.id) && d.quality >= 3);
    expect(broker.length).toBeGreaterThanOrEqual(8);
    expect(broker.length).toBeLessThanOrEqual(12);
  });
});

describe('re-rated outliers', () => {
  const stat = (id: string, s: string, k: 'add' | 'mul'): number | undefined => {
    for (const e of getItem(id).effects) if (e.type === 'stat' && e.stat === s) return e[k];
    return undefined;
  };

  it('the biggest plain boosts are no longer common quality-1 items', () => {
    expect(getItem('brick-chip').quality).toBe(3);
    expect(stat('brick-chip', 'damage', 'add')).toBe(1);
    expect(getItem('snail-mail-stamp').quality).toBe(3);
    expect(stat('wind-up-crank', 'fireRate', 'add')).toBeCloseTo(0.45, 6);
    expect(getItem('paperweight').quality).toBe(2);
  });
});

describe('unlock pacing (the thresholds a career has to reach)', () => {
  it('the character milestones take more than one good run', () => {
    const at = (id: string): number => {
      const c = findAchievement(id)!.condition as { atLeast?: number };
      return c.atLeast ?? 0;
    };
    expect(at('wound-up')).toBe(150);
    expect(at('deep-pockets')).toBe(75);
    expect(at('gumball-wizard')).toBe(60);
    expect(at('boss-hunter')).toBe(25);
    expect(at('soaked-through')).toBe(3);
    expect(at('little-parade')).toBe(5);
  });

  it('a brand-new player can make more of the special synergies (most of them)', () => {
    const open = (id: string): boolean => !FRESH_LOCKED.has(id) && getItem(id).pools.length > 0;
    const ok = (r: Requirement): boolean =>
      typeof r === 'string' ? open(r) : allItems().filter((d) => d.tags.includes(r.tag) && open(d.id)).length >= (r.count ?? 1);
    const syns = allSynergies();
    const makeable = syns.filter((s) => s.requires.every(ok));
    // 34 of 63 before polish batch 4, 41 after.
    expect(makeable.length).toBeGreaterThanOrEqual(40);
  });
});
