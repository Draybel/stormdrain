/**
 * Phase 4A: the achievements framework — counter and event conditions (id / value / at-least filters),
 * rewards (unlock entries + items and characters naming the achievement), the toast queue — and item
 * pool gating: `unlock`-flagged items never roll (pedestals, shops, drop tables) until unlocked, from
 * the unlock snapshot a run takes at its start.
 */

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { ACHIEVEMENTS, allAchievements, allItems, getItem, ITEMS, registerAchievement, registerItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { AchievementEngine, counterValue } from '../src/meta/achievements';
import { MetaStore } from '../src/meta/metaState';
import { MemoryStorage } from '../src/meta/storage';
import { itemUnlocked, lockedItems, runUnlocks } from '../src/meta/unlocks';
import { PK } from '../src/sim/pickupKinds';
import { spawnLoot } from '../src/sim/pickups';
import { rollItem } from '../src/sim/run/pools';
import { Sim } from '../src/sim/sim';
import type { AchievementDef, ItemDef } from '../src/sim/types';

// Test fixtures (registered before any engine is built).
const FIXTURES: AchievementDef[] = [
  { id: 't-brimwell', name: 'T BRIMWELL', desc: 'x', condition: { kind: 'event', event: 'bossKilled', id: 'brimwell' }, unlocks: [] },
  { id: 't-ending-2', name: 'T ENDING 2', desc: 'x', condition: { kind: 'event', event: 'endingReached', value: 2 }, unlocks: [{ kind: 'route', id: 't-route' }] },
  { id: 't-hoard', name: 'T HOARD', desc: 'x', condition: { kind: 'event', event: 'itemsHeld', atLeast: 10 }, unlocks: [{ kind: 'challenge', id: 't-challenge' }] },
  { id: 't-scurriers', name: 'T SCURRIERS', desc: 'x', condition: { counter: 'killed.scurrier', atLeast: 3 }, unlocks: [] },
  { id: 't-gate', name: 'T GATE', desc: 'x', condition: { counter: 't-gate-counter', atLeast: 2 }, unlocks: [{ kind: 'feature', id: 't-feature' }] },
];
for (const d of FIXTURES) registerAchievement(d);

const icon = getItem('brick-chip').sprite;
function item(def: Partial<ItemDef> & { id: string }): ItemDef {
  const d: ItemDef = { name: def.id.toUpperCase(), desc: 'TEST', kind: 'passive', quality: 1, pools: [], tags: ['test-gate'], effects: [], sprite: icon, ...def };
  if (!ITEMS.has(d.id)) registerItem(d);
  return ITEMS.get(d.id)!;
}
const GATED = item({ id: 't-gated', pools: ['treasure'], unlock: 't-gate' });
const GATED_TRINKET = item({ id: 't-gated-trinket', kind: 'trinket', pools: ['chest'], unlock: 't-gate' });

function fresh(): { meta: MetaStore; engine: AchievementEngine } {
  const meta = new MetaStore({ storage: new MemoryStorage() });
  return { meta, engine: new AchievementEngine(meta) };
}

describe('achievement content', () => {
  it('the core list validates, with short one-line descriptions and unique ids', () => {
    expect(validateContent()).toEqual([]);
    const core = allAchievements().filter((a) => !a.id.startsWith('t-'));
    expect(core.length).toBeGreaterThanOrEqual(12);
    for (const a of core) {
      expect(a.desc.length, a.id).toBeLessThanOrEqual(52);
      expect(a.name.length, a.id).toBeLessThanOrEqual(24);
    }
    // The endings and the first steps are there.
    for (const id of ['first-splash', 'drain-cleaner', 'finders-keepers', 'pack-rat', 'clear-skies', 'the-quiet-hive', 'what-the-rain-kept', 'deeper-still', 'soaked-through']) {
      expect(ACHIEVEMENTS.has(id), id).toBe(true);
    }
    // Every item locked by an achievement names a real one.
    for (const d of allItems()) if (d.unlock) expect(ACHIEVEMENTS.has(d.unlock), d.id).toBe(true);
  });
});

describe('conditions', () => {
  it('counter achievements unlock once their counter reaches the value', () => {
    const { meta, engine } = fresh();
    expect(engine.checkCounters()).toBe(0);
    meta.killEnemy('scurrier');
    meta.killEnemy('scurrier');
    engine.checkCounters();
    expect(meta.hasAchievement('t-scurriers')).toBe(false);
    expect(meta.hasAchievement('first-splash')).toBe(true);
    meta.killEnemy('scurrier');
    engine.checkCounters();
    expect(meta.hasAchievement('t-scurriers')).toBe(true);
    // Stats, keyed counts and open-ended counters all resolve.
    expect(counterValue(meta.state, 'kills')).toBe(3);
    expect(counterValue(meta.state, 'killed.scurrier')).toBe(3);
    expect(counterValue(meta.state, 'achievements')).toBe(2);
    expect(counterValue(meta.state, 'nothing-like-this')).toBe(0);
    // Die 10 times.
    for (let i = 0; i < 10; i++) meta.recordRunEnd({ character: 'wren', outcome: 'death', floor: 1 });
    engine.checkCounters();
    expect(meta.hasAchievement('soaked-through')).toBe(true);
  });

  it('event achievements match their id / exact value / minimum value', () => {
    const { meta, engine } = fresh();
    engine.event('bossKilled', 'sodden-snarl', 0);
    expect(meta.hasAchievement('t-brimwell')).toBe(false);
    engine.event('bossKilled', 'brimwell', 0);
    expect(meta.hasAchievement('t-brimwell')).toBe(true);

    engine.event('endingReached', '', 1);
    expect(meta.hasAchievement('clear-skies')).toBe(true);
    expect(meta.hasAchievement('t-ending-2')).toBe(false);
    engine.event('endingReached', '', 3);
    expect(meta.hasAchievement('t-ending-2')).toBe(false);
    expect(meta.hasAchievement('what-the-rain-kept')).toBe(true);

    engine.event('itemsHeld', '', 9);
    expect(meta.hasAchievement('t-hoard')).toBe(false);
    engine.event('itemsHeld', '', 12);
    expect(meta.hasAchievement('t-hoard')).toBe(true);
    expect(meta.hasAchievement('pack-rat')).toBe(true);

    engine.event('chapterReached', 'grinding_works', 3);
    expect(meta.hasAchievement('deeper-still')).toBe(true);
  });

  it('rewards: unlock entries, items and characters naming it; toasts once, in order; rebuild after an import', () => {
    const { meta, engine } = fresh();
    const pending = engine.pending;
    engine.event('endingReached', '', 2);
    expect(meta.isUnlocked('routes', 't-route')).toBe(true);
    expect(meta.isUnlocked('endings', 'ending2')).toBe(true);
    // Registry order: the core achievement first, then the fixture.
    const hive = engine.drain()!;
    expect(hive.id).toBe('the-quiet-hive');
    expect(hive.rewards).toEqual(['THE WATER BEGINS TO TURN...']);
    const e2 = engine.drain()!;
    expect(e2.id).toBe('t-ending-2');
    expect(e2.rewards).toEqual(['NEW ROUTE: T-ROUTE']);
    expect(engine.drain()).toBeUndefined();
    // Granting again does nothing.
    expect(engine.grant(ACHIEVEMENTS.get('the-quiet-hive')!)).toBe(false);
    engine.event('endingReached', '', 2);
    expect(engine.earned).toEqual([]);
    expect(engine.pending).toBe(pending - 2);

    // An achievement unlocks every item that names it, and its unlock entries of any kind.
    meta.bump('t-gate-counter', 2);
    engine.checkCounters();
    expect(meta.isUnlocked('items', 't-gated')).toBe(true);
    expect(meta.isUnlocked('items', 't-gated-trinket')).toBe(true);
    expect(meta.isUnlocked('features', 't-feature')).toBe(true);
    const gate = engine.drain()!;
    expect(gate.rewards).toEqual(expect.arrayContaining(['UNLOCKED: T-FEATURE', 'NEW ITEM: T-GATED', 'NEW ITEM: T-GATED-TRINKET']));

    // An import brings achievements without their unlocks: syncRewards restores them quietly.
    const other = fresh();
    other.meta.state.achievements['t-gate'] = 5;
    other.engine.rebuild();
    other.engine.syncRewards();
    expect(other.meta.isUnlocked('items', 't-gated')).toBe(true);
    expect(other.engine.earned).toEqual([]);
  });
});

describe('item pool gating', () => {
  it("an item flagged `unlock` is locked until its achievement is earned (or it's in the unlock set)", () => {
    const { meta, engine } = fresh();
    expect(itemUnlocked(meta.state, GATED)).toBe(false);
    expect(lockedItems(meta.state)).toEqual(expect.arrayContaining(['t-gated', 't-gated-trinket', 'party-popper']));
    expect(runUnlocks(meta.state)).not.toContain('t-gated');
    // Earning the achievement unlocks it — even content added later that names an earned achievement.
    meta.state.achievements['t-gate'] = 1;
    expect(itemUnlocked(meta.state, GATED)).toBe(true);
    expect(runUnlocks(meta.state)).toEqual(expect.arrayContaining(['t-gated', 't-gated-trinket']));
    expect(engine.pending).toBeGreaterThan(0);
  });

  it('locked items never roll on pedestals; unlocked ones do', () => {
    const run = Sim.newRun('gate-1', { curse: null }).run!;
    expect(run.data.locked).toEqual(expect.arrayContaining(['t-gated', 'party-popper']));
    const unlockedRun = Sim.newRun('gate-1', { curse: null, unlocked: ['t-gated'] }).run!;
    expect(unlockedRun.data.locked).not.toContain('t-gated');
    // Every other treasure item "seen": the gated one is the only fresh candidate left.
    const used = new Set(allItems().filter((d) => d.pools.includes('treasure') && d.id !== 't-gated').map((d) => d.id));
    for (let s = 0; s < 20; s++) {
      expect(rollItem(new Rng(s), ['treasure'], new Set(used), new Set(run.data.locked), false)).not.toBe('t-gated');
      expect(rollItem(new Rng(s), ['treasure'], new Set(used), new Set(unlockedRun.data.locked), false)).toBe('t-gated');
    }
  });

  it('locked trinkets never drop from tables in a run (world.lockedItems); unlocked ones do', () => {
    const count = (unlocked: string[]): number => {
      const sim = Sim.newRun('gate-2', { curse: null, unlocked });
      const w = sim.world;
      expect(w.lockedItems).not.toBeNull();
      let n = 0;
      for (let i = 0; i < 300; i++) {
        w.pickups.clear();
        const pk = spawnLoot(w, PK.Trinket, 'chest', 50, 50);
        if (pk?.itemId === 't-gated-trinket') n++;
      }
      return n;
    };
    expect(count([])).toBe(0);
    expect(count(['t-gated-trinket'])).toBeGreaterThan(10);
    // The training yard offers everything (no meta snapshot there).
    expect(new Sim({ seed: 1 }).world.lockedItems).toBeNull();
  });
});
