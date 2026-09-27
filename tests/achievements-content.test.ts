/**
 * The achievement roster (content/achievements/*): about fifty achievements, each with a name, a one-line
 * description, an icon and a reward; they unlock from their conditions (reported by real play through the meta
 * tracker), persist across a reload, and gate items (the pool grows as you play), characters and routes. The
 * starting pool stays rich enough for fun early runs.
 */

import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, allAchievements, allCharacters, allItems, getCharacter, getItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { ACHIEVEMENT_BADGES } from '../src/content/sprites/achievementIcons';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { AchievementEngine, rewardLines } from '../src/meta/achievements';
import { MetaStore } from '../src/meta/metaState';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { characterUnlocked, itemUnlocked, lockedItems, runUnlocks, unlockedCharacters } from '../src/meta/unlocks';
import { altRouteAllowed } from '../src/sim/run/run';
import { PROP_JAR, PROP_SLOTS, breakSlots } from '../src/sim/shopProps';
import { Sim } from '../src/sim/sim';
import type { PoolId } from '../src/sim/types';
import { fightBoss } from './helpers/bossBot';
import { makeInput } from './helpers/sim';

const FONT = /^[A-Z0-9 .,!?:;'"\-+=/()[\]%*#<>&°·♥¤←→↑↓]*$/;

function fresh(): { meta: MetaStore; engine: AchievementEngine } {
  const meta = new MetaStore({ storage: new MemoryStorage() });
  return { meta, engine: new AchievementEngine(meta) };
}

/** Steps a tracked run like the run scene does. */
function play(save: GameSave, sim: Sim, n: number, input = makeInput()): void {
  for (let i = 0; i < n; i++) {
    sim.step(input);
    save.tracker.afterStep();
    save.endTick();
  }
}

describe('the roster', () => {
  it('about fifty achievements: a name, a one-line description, an icon and a reward each', () => {
    expect(validateContent()).toEqual([]);
    const all = allAchievements();
    expect(all.length).toBeGreaterThanOrEqual(48);
    expect(all.length).toBeLessThanOrEqual(70);
    const names = new Set<string>();
    for (const a of all) {
      expect(a.name.length, a.id).toBeLessThanOrEqual(24);
      expect(a.name, a.id).toMatch(FONT);
      expect(a.desc.length, a.id).toBeLessThanOrEqual(52);
      expect(a.desc.toUpperCase(), a.id).toMatch(FONT);
      expect(a.icon, a.id).toBeTruthy();
      expect(rewardLines(a).length, a.id).toBeGreaterThan(0);
      for (const r of rewardLines(a)) expect(r, a.id).toMatch(FONT);
      names.add(a.name);
    }
    expect(names.size).toBe(all.length);
    for (const b of Object.values(ACHIEVEMENT_BADGES)) expect(validateSpriteDef(b)).toEqual([]);
  });

  it('every character but Wren is unlocked by an achievement, with a readable hint', () => {
    for (const c of allCharacters()) {
      if (c.id === 'wren') continue;
      const a = ACHIEVEMENTS.get(c.unlock!)!;
      expect(a, c.id).toBeTruthy();
      // Only the secret character hides how to get it.
      expect(a.hidden ?? false, c.id).toBe(c.id === 'drizzle');
      expect(rewardLines(a)).toContain(`NEW CHARACTER: ${c.name.toUpperCase()}`);
    }
    // A win with every character.
    for (const c of allCharacters()) {
      expect(allAchievements().some((a) => a.condition.kind === 'event' && a.condition.event === 'characterWin' && a.condition.id === c.id), c.id).toBe(true);
    }
  });

  it('~40 items grow the pool as you play; the Storm Lance and a rich starting pool are there from the start', () => {
    const gated = allItems().filter((d) => d.unlock !== undefined);
    expect(gated.length).toBeGreaterThanOrEqual(38);
    // Most of them are strong (quality 3+) or weird.
    expect(gated.filter((d) => d.quality >= 3 || d.tags.includes('weird')).length).toBeGreaterThanOrEqual(15);
    // Every item-gating achievement has a real condition and is reachable (not hidden).
    for (const d of gated) expect(ACHIEVEMENTS.has(d.unlock!), d.id).toBe(true);
    const lance = getItem('storm-lance');
    expect(lance.unlock).toBeUndefined();
    expect(lance.pools).toContain('treasure');
    // A brand-new player's pools.
    const { meta } = fresh();
    const locked = new Set(lockedItems(meta.state));
    expect(locked.size).toBe(gated.length);
    const open = (pool: PoolId, pedestal = false): number =>
      allItems().filter((d) => d.pools.includes(pool) && !locked.has(d.id) && (!pedestal || d.kind === 'passive' || d.kind === 'active')).length;
    expect(open('treasure', true)).toBeGreaterThanOrEqual(40);
    expect(open('shop')).toBeGreaterThanOrEqual(20);
    expect(open('boss', true)).toBeGreaterThanOrEqual(10);
    expect(open('secret')).toBeGreaterThanOrEqual(8);
    expect(open('chest')).toBeGreaterThanOrEqual(20);
  });
});

describe('conditions → unlocks', () => {
  it('each character unlocks from its condition (and only then)', () => {
    const cases: [string, (m: MetaStore, e: AchievementEngine) => void][] = [
      ['pip', (_m, e) => e.event('chapterBossKilled', 'rootcellar', 2)],
      [
        'marrow',
        (m, e) => {
          m.addStat('deaths', 10);
          e.checkCounters();
        },
      ],
      ['juniper', (_m, e) => e.event('familiars', '', 3)],
      [
        'bolt',
        (m, e) => {
          m.bump('activesUsed', 50);
          e.checkCounters();
        },
      ],
      ['sable', (_m, e) => e.event('coinsHeld', '', 60)],
      ['mosswick', (_m, e) => e.event('endingReached', '', 1)],
    ];
    for (const [id, earn] of cases) {
      const { meta, engine } = fresh();
      const c = getCharacter(id);
      expect(characterUnlocked(meta.state, c), id).toBe(false);
      expect(unlockedCharacters(meta.state).map((d) => d.id)).toEqual(['wren']);
      earn(meta, engine);
      expect(characterUnlocked(meta.state, c), id).toBe(true);
      // The toast of the achievement that brought the character leads with it (other feats may come too).
      expect(engine.earned.some((a) => a.rewards[0] === `NEW CHARACTER: ${c.name.toUpperCase()}`), id).toBe(true);
    }
  });

  it('near misses unlock nothing: chapter 1 boss, 49 actives, 59 coins, 2 familiars', () => {
    const { meta, engine } = fresh();
    engine.event('chapterBossKilled', 'gutterways', 1);
    meta.bump('activesUsed', 49);
    engine.checkCounters();
    engine.event('coinsHeld', '', 59);
    engine.event('familiars', '', 2);
    expect(unlockedCharacters(meta.state).map((d) => d.id)).toEqual(['wren']);
  });

  it('Sable has a second way in: rob a shop', () => {
    const { meta, engine } = fresh();
    meta.bump('shopsDestroyed');
    engine.checkCounters();
    expect(meta.hasAchievement('smash-and-grab')).toBe(true);
    expect(characterUnlocked(meta.state, getCharacter('sable'))).toBe(true);
  });

  it('milestones unlock their items', () => {
    const { meta, engine } = fresh();
    const kettle = getItem('cast-iron-kettle');
    expect(itemUnlocked(meta.state, kettle)).toBe(false);
    meta.addStat('bossKills', 10);
    engine.checkCounters();
    expect(itemUnlocked(meta.state, kettle)).toBe(true);
    expect(runUnlocks(meta.state)).toContain('cast-iron-kettle');
    // Deeper chapters, a clean deep floor, the collection.
    engine.event('chapterReached', 'eye_of_storm', 6);
    for (const id of ['tracing-paper', 'geode', 'lantern-moth', 'static-cling', 'storm-kite']) expect(runUnlocks(meta.state), id).toContain(id);
    engine.event('noDamageFloor', '', 7);
    expect(runUnlocks(meta.state)).toContain('bomb-parasol');
    expect(runUnlocks(meta.state)).toContain('rooftop-rod');
  });

  it('routes: Ending 1 opens the alt route into chapter 6, Endings 1 + 2 the Undertow', () => {
    const { meta, engine } = fresh();
    const has = (): Set<string> => new Set(runUnlocks(meta.state));
    expect(altRouteAllowed(10, 'main', has())).toBe(false);
    engine.event('endingReached', '', 1);
    expect(has().has('ending1')).toBe(true);
    expect(altRouteAllowed(10, 'main', has())).toBe(true);
    expect(has().has('ending2')).toBe(false);
    engine.event('endingReached', '', 2);
    expect(has().has('ending1') && has().has('ending2')).toBe(true);
    // (The whirlpool itself needs both: tests/special-rooms.test.ts plays it from a run's unlock snapshot.)
    expect(runUnlocks(meta.state)).toContain('stormglass');
  });
});

describe('real play reports the new conditions', () => {
  it("beating chapter 2's boss unlocks Pip; a chapter 1 boss doesn't", () => {
    const save = new GameSave(new MemoryStorage());
    const one = Sim.newRun('ROOTS1AB', { curse: null });
    save.tracker.startRun(one);
    one.run!.teleport(one.run!.data.layout.boss);
    expect(fightBoss(one, 60 * 150, () => save.tracker.afterStep()).won).toBe(true);
    save.endTick();
    expect(save.meta.hasAchievement('under-the-roots')).toBe(false);
    const sim = Sim.newRun('ROOTS2AB', { curse: null, floor: 3 });
    save.tracker.startRun(sim);
    sim.run!.teleport(sim.run!.data.layout.boss);
    expect(sim.world.boss.kind).toBe(0);
    expect(fightBoss(sim, 60 * 150, () => save.tracker.afterStep()).won).toBe(true);
    save.endTick();
    expect(save.meta.hasAchievement('under-the-roots')).toBe(true);
    expect(characterUnlocked(save.meta.state, getCharacter('pip'))).toBe(true);
  });

  it("blasting Magpie's jar (or a gambler) open robs the shop: SMASH AND GRAB unlocks Sable", () => {
    const save = new GameSave(new MemoryStorage());
    let sim: Sim | null = null;
    let shop = -1;
    for (let s = 0; s < 40 && shop < 0; s++) {
      sim = Sim.newRun(`SHOP${s}XYZ`, { curse: null });
      shop = sim.run!.data.layout.rooms.findIndex((r) => r.type === 'shop');
    }
    expect(shop).toBeGreaterThanOrEqual(0);
    save.tracker.startRun(sim!);
    sim!.run!.teleport(shop);
    play(save, sim!, 5);
    const w = sim!.world;
    let jar = null;
    for (let i = 0; i < w.pedestals.count; i++) if (w.pedestals.items[i]!.prop === PROP_JAR) jar = w.pedestals.items[i]!;
    expect(jar).not.toBeNull();
    w.godMode = true;
    const coins = w.player.inv.coins;
    sim!.explode(jar!.x, jar!.y);
    play(save, sim!, 90);
    expect(jar!.broken).toBe(true);
    expect(save.meta.counter('shopsDestroyed')).toBe(1);
    expect(save.meta.hasAchievement('smash-and-grab')).toBe(true);
    expect(characterUnlocked(save.meta.state, getCharacter('sable'))).toBe(true);
    // The wreck takes no more donations; coins spilled out.
    let loose = 0;
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i]!.kind <= 3) loose++;
    expect(loose + w.player.inv.coins - coins).toBeGreaterThan(0);
    // A wrecked gambler counts too (the event, straight from the sim).
    const other = Sim.newRun('GAMBLE12', { curse: null });
    const save2 = new GameSave(new MemoryStorage());
    save2.tracker.startRun(other);
    const ped = other.world.pedestals.alloc()!;
    ped.prop = PROP_SLOTS;
    ped.broken = false;
    ped.x = 60;
    ped.y = 60;
    breakSlots(other.world, ped);
    save2.tracker.afterStep();
    save2.endTick();
    expect(save2.meta.counter('shopsDestroyed')).toBe(1);
  });

  it('a scored daily run counts for RAIN CHECK; using actives counts toward Bolt', () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun('DAILY123', { curse: null, seedInfo: { code: 'DAILY123', kind: 'daily', date: '2026-09-27', scored: true } });
    save.tracker.startRun(sim);
    save.endTick();
    expect(save.meta.counter('dailyRuns')).toBe(1);
    expect(save.meta.hasAchievement('rain-check')).toBe(true);
    expect(runUnlocks(save.meta.state)).toContain('wind-up-key');
    // Actives.
    sim.giveItem('crank-radio');
    for (let i = 0; i < 3; i++) {
      sim.world.player.inv.active!.charge = sim.world.player.inv.active!.max;
      play(save, sim, 1, makeInput({ active: true }));
    }
    expect(save.meta.counter('activesUsed')).toBe(3);
  });
});

describe('persistence', () => {
  it('earned achievements, unlocked characters and items survive a reload', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    save.achievements.event('chapterBossKilled', 'rootcellar', 2);
    save.achievements.event('endingReached', '', 1);
    save.meta.bump('bombsUsed', 50);
    save.endTick();
    save.meta.flush();
    const again = new GameSave(storage);
    const m = again.meta.state;
    for (const id of ['under-the-roots', 'clear-skies', 'demolition']) expect(again.meta.hasAchievement(id), id).toBe(true);
    expect(characterUnlocked(m, getCharacter('pip'))).toBe(true);
    expect(characterUnlocked(m, getCharacter('mosswick'))).toBe(true);
    expect(characterUnlocked(m, getCharacter('bolt'))).toBe(false);
    expect(runUnlocks(m)).toEqual(expect.arrayContaining(['ending1', 'earplugs']));
    // No second toast for them.
    expect(again.achievements.earned).toEqual([]);
  });

  it("a new run carries the unlock snapshot: locked items never show up on a fresh player's floors", () => {
    const { meta } = fresh();
    const locked = new Set(lockedItems(meta.state));
    for (let s = 0; s < 6; s++) {
      for (const floor of [1, 3, 5, 7]) {
        const sim = Sim.newRun(`GATE${s}F${floor}`, { floor, unlocked: runUnlocks(meta.state) });
        const text = JSON.stringify(sim.run!.data.rooms);
        for (const id of locked) expect(text.includes(`"${id}"`), `${id} on seed ${s} floor ${floor}`).toBe(false);
      }
    }
  });
});
