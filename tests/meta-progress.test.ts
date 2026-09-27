/**
 * Phase 4A: meta tracking — a run's events become lifetime progress (collection, bestiary, stats,
 * counters, achievements), and all of it survives a simulated reload (a new GameSave on the same
 * storage).
 */

import { describe, expect, it } from 'vitest';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { dailyScore } from '../src/meta/tracker';
import { Sim } from '../src/sim/sim';
import type { Sim as SimT } from '../src/sim/sim';
import { fightBoss } from './helpers/bossBot';
import { makeInput } from './helpers/sim';

/** Steps the tracked run `n` ticks, feeding the tracker like the run scene does. */
function play(save: GameSave, sim: SimT, n: number, input = makeInput()): void {
  for (let i = 0; i < n; i++) {
    sim.step(input);
    save.tracker.afterStep();
    save.tracker.playTime(1 / 60);
    save.endTick();
  }
}

/** Pops a pickup next to the player, lets it land, then steps her onto it. */
function grab(save: GameSave, sim: SimT, kind: 'satchel' | 'coin'): void {
  const p = sim.world.player;
  sim.spawnPickup(kind, p.x + 20, p.y);
  play(save, sim, 45);
  const k = sim.world.pickups.items[sim.world.pickups.count - 1]!;
  p.placeAt(k.x, k.y);
  play(save, sim, 6);
}

describe('meta tracking', () => {
  it('collection, bestiary, stats and achievements from a run — and they survive a reload', () => {
    const storage = new MemoryStorage();
    let t = 1_000_000;
    const save = new GameSave(storage, { now: () => (t += 16) });
    const sim = Sim.newRun('meta-1', { curse: null });
    save.tracker.startRun(sim);
    expect(save.meta.state.stats.runs).toBe(1);
    expect(save.meta.state.stats.charRuns.wren).toBe(1);
    expect(save.meta.state.stats.bestFloor).toBe(1);

    // An item (fresh pickup) and a kill.
    sim.giveItem('brick-chip');
    play(save, sim, 1);
    const foe = sim.spawnEnemy('scurrier', undefined, undefined, { champion: false })!;
    expect(foe).not.toBeNull();
    play(save, sim, 1);
    sim.killEnemies();
    play(save, sim, 1);
    // A chest.
    grab(save, sim, 'satchel');
    // Collected coins count too.
    grab(save, sim, 'coin');

    const m = save.meta.state;
    expect(m.collection['brick-chip']).toMatchObject({ collected: 1 });
    expect(m.bestiary.scurrier).toMatchObject({ seen: 1, killed: 1 });
    expect(m.stats.kills).toBe(1);
    expect(m.stats.itemsCollected).toBe(1);
    expect(m.stats.counters.chestsOpened).toBe(1);
    expect(m.stats.counters.coinsCollected).toBeGreaterThanOrEqual(1);
    expect(m.stats.playTimeSec).toBeGreaterThan(1);
    expect(m.achievements['first-splash']).toBeGreaterThan(0);
    expect('finders-keepers' in m.achievements).toBe(true);
    const toasts = save.achievements.earned.map((a) => a.id);
    expect(toasts).toEqual(expect.arrayContaining(['first-splash', 'finders-keepers']));

    // The next floor (the debug skip counts as finishing this one), then the rain takes her.
    sim.run!.skipFloor();
    play(save, sim, 2);
    expect(m.stats.floorsCleared).toBe(1);
    expect(m.stats.bestFloor).toBe(2);
    sim.killPlayer();
    play(save, sim, 2);
    expect(m.stats.deaths).toBe(1);
    expect(save.tracker.tracking).toBeNull();
    // Nothing more is recorded for a finished run.
    play(save, sim, 5);
    expect(m.stats.deaths).toBe(1);

    // Reload: every bit of it was saved.
    save.saveRunNow();
    const again = new GameSave(storage);
    const r = again.meta.state;
    expect(again.meta.loaded.status).toBe('ok');
    expect(r.collection['brick-chip']).toMatchObject({ collected: 1 });
    expect(r.bestiary.scurrier).toMatchObject({ seen: 1, killed: 1 });
    expect(r.stats).toMatchObject({ runs: 1, deaths: 1, kills: 1, floorsCleared: 1, bestFloor: 2, itemsCollected: 1 });
    expect(r.stats.counters.chestsOpened).toBe(1);
    expect(r.stats.playTimeSec).toBeCloseTo(m.stats.playTimeSec, 3);
    expect(Object.keys(r.achievements).sort()).toEqual(Object.keys(m.achievements).sort());
    // Already earned: a reload doesn't toast them again.
    expect(again.achievements.earned).toEqual([]);
  });

  it('a boss fight counts once (bestiary, boss kills, Drain Cleaner) and unlocks what it gates', () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun(55, { curse: null });
    save.tracker.startRun(sim);
    sim.giveItem('brick-chip');
    sim.run!.teleport(sim.run!.data.layout.boss);
    const boss = sim.world.boss.id;
    expect(boss).not.toBe('');
    const res = fightBoss(sim, 60 * 150, () => save.tracker.afterStep());
    save.endTick();
    expect(res.won).toBe(true);
    const m = save.meta.state;
    expect(m.stats.bossKills).toBe(1);
    expect(m.bestiary[boss]).toMatchObject({ seen: 1, killed: 1 });
    expect('drain-cleaner' in m.achievements).toBe(true);
    // Its reward: an item that only rolls once unlocked.
    expect(m.unlocks.items.has('chipped-piggy-bank')).toBe(true);
    expect(save.unlockedForRun()).toContain('chipped-piggy-bank');
    const earned = save.achievements.earned.find((a) => a.id === 'drain-cleaner')!;
    expect(earned.rewards).toContain('NEW ITEM: CHIPPED PIGGY BANK');
  });

  it('a Continue is not a new run; a finished floor without damage counts as clean', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    const a = Sim.newRun('meta-2', { curse: null });
    a.world.godMode = true;
    save.tracker.startRun(a);
    save.host = { savableRun: () => a };
    save.saveRunNow();
    const r = save.loadRun();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = Sim.fromSnapshot(r.snapshot);
    save.tracker.resumeRun(b);
    expect(save.meta.state.stats.runs).toBe(1);
    b.run!.skipFloor();
    play(save, b, 1);
    expect(save.meta.state.stats.counters.noDamageFloors).toBe(1);
    expect('dry-socks' in save.meta.state.achievements).toBe(true);
    // A hurt floor is not clean.
    b.world.godMode = false;
    b.world.safeT = 0;
    b.hurtPlayer(1);
    b.run!.skipFloor();
    play(save, b, 1);
    expect(save.meta.state.stats.counters.damageTakenFloors).toBe(1);
  });

  it('winning a run: wins, streak, per-character wins, the ending unlocked, Clear Skies', () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun('meta-3', { floor: 12, curse: null });
    save.tracker.startRun(sim);
    sim.run!.skipFloor(); // floor 12 without Ending 1 + 2: the floor's ending (1)
    play(save, sim, 1);
    const m = save.meta.state;
    expect(sim.run!.data.won).toBe(1);
    expect(m.stats.wins).toBe(1);
    expect(m.stats.winStreak).toBe(1);
    expect(m.stats.charWins.wren).toBe(1);
    expect(m.unlocks.endings.has('ending1')).toBe(true);
    expect(save.unlockedForRun()).toContain('ending1');
    expect(Object.keys(m.achievements)).toEqual(expect.arrayContaining(['clear-skies', 'homeward-wren']));
    // The next run takes the new route flag with it.
    const next = Sim.newRun('meta-4', { unlocked: save.unlockedForRun() });
    expect(next.run!.unlocked('ending1')).toBe(true);
  });

  it('records held-at-once values and daily results', () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun('meta-5', { curse: null });
    save.tracker.startRun(sim, { date: '2026-09-26', seed: 'meta-5' });
    sim.addPickups(55, 0, 0);
    // Five familiars at once: LITTLE PARADE (polish batch 4: 3).
    for (const id of ['lamplet', 'paper-boat', 'dustwing', 'gloamwing', 'blinkbug']) sim.giveItem(id);
    play(save, sim, 3);
    const m = save.meta.state;
    expect(m.stats.counters.maxCoinsHeld).toBeGreaterThanOrEqual(55);
    expect(m.stats.counters.maxFamiliars).toBe(5);
    expect(Object.keys(m.achievements)).toEqual(expect.arrayContaining(['magpies-envy', 'little-parade']));
    expect(m.unlocks.items.has('wick-wisp')).toBe(true);
    sim.killPlayer();
    play(save, sim, 1);
    const d = m.stats.daily['2026-09-26']!;
    expect(d).toMatchObject({ seed: 'meta-5', character: 'wren', won: false, floor: 1 });
    expect(d.score).toBe(dailyScore(1, 0, false, d.timeSec));
  });
});
