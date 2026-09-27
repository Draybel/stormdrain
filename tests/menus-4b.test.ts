/**
 * Phase 4B (menus & screens) — the DOM-free parts: seed codes, seeded / daily runs (the one scored attempt,
 * practice runs skipping run feats), who killed the player (the game-over screen), save export → import through
 * the save service, the achievements page's reward lines, the left-handed HUD layout and the menu art.
 */

import { describe, expect, it } from 'vitest';
import { hashString, seedToU32 } from '../src/engine/rng';
import { MENU_ICONS } from '../src/content/sprites/menuIcons';
import { allAchievements, findAchievement } from '../src/content/registry';
import { rewardLines } from '../src/meta/achievements';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { SEED_ALPHABET, dailySeedCode, formatSeed, normalizeSeedInput, numericSeedLabel, randomSeedCode, validateSeed } from '../src/meta/seedCode';
import { isPracticeSeed } from '../src/meta/tracker';
import { Sim } from '../src/sim/sim';
import { layoutRunButtons, createRunButtons } from '../src/ui/touchControls';
import { retrySeed } from '../src/ui/gameOver';
import { GAME_W } from '../src/engine/screen';
import { makeInput, makeSim, stepN } from './helpers/sim';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';

describe('seed codes', () => {
  it('normalizes, validates and formats', () => {
    expect(normalizeSeedInput(' abcd-1234 ')).toBe('ABCD1234');
    expect(validateSeed('abcd 1234')).toEqual({ ok: true, code: 'ABCD1234' });
    expect(validateSeed('')).toMatchObject({ ok: false });
    const short = validateSeed('abc');
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toContain('3 OF 8');
    const long = validateSeed('abcd12345');
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.error).toContain('TOO LONG');
    const bad = validateSeed('abcd!234');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toContain('ONLY LETTERS');
    expect(formatSeed('ABCD1234')).toBe('ABCD 1234');
    expect(numericSeedLabel(0x2a)).toBe('#0000002A');
  });

  it('random and daily codes use the look-alike-free alphabet; the daily code depends only on the date', () => {
    let n = 0;
    const rand = () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 200; i++) {
      const c = randomSeedCode(rand);
      expect(c).toHaveLength(8);
      for (const ch of c) expect(SEED_ALPHABET).toContain(ch);
      expect(validateSeed(c).ok).toBe(true);
    }
    expect(dailySeedCode('2026-09-27')).toBe(dailySeedCode('2026-09-27'));
    expect(dailySeedCode('2026-09-27')).not.toBe(dailySeedCode('2026-09-28'));
    expect(validateSeed(dailySeedCode('2026-01-01')).ok).toBe(true);
  });

  it('a code is the run: the sim seed is the code hash and the code rides in RunData (and the snapshot)', () => {
    const a = Sim.newRun('ABCD1234', { curse: null, seedInfo: { code: 'ABCD1234', kind: 'custom' } });
    const b = Sim.newRun('ABCD1234', { curse: null, seedInfo: { code: 'ABCD1234', kind: 'custom' } });
    expect(a.seed).toBe(seedToU32('ABCD1234'));
    expect(a.seed).toBe(hashString('ABCD1234'));
    expect(JSON.stringify(a.run!.data.layout)).toBe(JSON.stringify(b.run!.data.layout));
    expect(a.run!.data.seedInfo).toEqual({ code: 'ABCD1234', kind: 'custom' });
    const back = Sim.fromSnapshot(a.snapshot());
    expect(back.run!.data.seedInfo).toEqual({ code: 'ABCD1234', kind: 'custom' });
    // Runs without seed info (debug runAt) don't get the field at all.
    expect('seedInfo' in Sim.newRun(5).run!.data).toBe(false);
  });

  it('practice runs: typed seeds, restarts and unscored daily replays; retry keeps the code', () => {
    expect(isPracticeSeed(undefined)).toBe(false);
    expect(isPracticeSeed({ code: 'X', kind: 'random' })).toBe(false);
    expect(isPracticeSeed({ code: 'X', kind: 'custom' })).toBe(true);
    expect(isPracticeSeed({ code: 'X', kind: 'daily', date: '2026-09-27', scored: true })).toBe(false);
    expect(isPracticeSeed({ code: 'X', kind: 'daily', date: '2026-09-27', scored: false })).toBe(true);
    expect(retrySeed({ code: 'ABCD1234', kind: 'random' }, 'ABCD1234')).toEqual({ code: 'ABCD1234', kind: 'custom' });
    expect(retrySeed({ code: 'DAYC0DE2', kind: 'daily', date: '2026-09-27', scored: true }, 'DAYC0DE2')).toEqual({
      code: 'DAYC0DE2',
      kind: 'daily',
      date: '2026-09-27',
      scored: false,
    });
  });
});

describe('daily and seeded runs in the meta tracker', () => {
  const date = '2026-09-27';

  it('the day is claimed when the scored daily starts; a second start is not scored; the result is finished at death', () => {
    const save = new GameSave(new MemoryStorage(), { now: () => Date.UTC(2026, 8, 27, 12) });
    const code = dailySeedCode(date);
    const sim = Sim.newRun(code, { seedInfo: { code, kind: 'daily', date, scored: true } });
    save.tracker.startRun(sim);
    const claimed = save.meta.state.stats.daily[date]!;
    expect(claimed).toMatchObject({ seed: code, floor: 1, done: false });
    expect(save.tracker.scoredDaily).toBe(true);
    // A second daily start the same day: not scored, the entry keeps the first attempt.
    const again = Sim.newRun(code, { seedInfo: { code, kind: 'daily', date, scored: true } });
    save.tracker.startRun(again);
    expect(save.tracker.scoredDaily).toBe(false);
    // The first attempt, resumed (Continue), then dies: the entry is finished.
    save.tracker.resumeRun(sim);
    expect(save.tracker.scoredDaily).toBe(true);
    sim.world.godMode = false;
    sim.killPlayer();
    stepN(sim, makeInput(), 2);
    save.tracker.afterStep();
    const done = save.meta.state.stats.daily[date]!;
    expect(done.done).toBeUndefined();
    expect(done.won).toBe(false);
    expect(done.score).toBeGreaterThanOrEqual(1000);
  });

  it('a seeded (practice) run skips run feats and ending unlocks; lifetime stats still count', () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun('PRACTICE', { floor: 12, curse: null, seedInfo: { code: 'PRACTICE', kind: 'custom' } });
    save.tracker.startRun(sim);
    expect(save.tracker.featsCount).toBe(false);
    save.tracker.endRun('win', 1);
    expect(save.meta.state.stats.wins).toBe(1);
    expect(save.meta.isUnlocked('endings', 'ending1')).toBe(false);
    expect(save.meta.hasAchievement('clear-skies')).toBe(false);
    expect(save.meta.hasAchievement('deeper-still')).toBe(false);
    // The same win on a random seed counts.
    const real = Sim.newRun('REALRUN1', { floor: 12, curse: null, seedInfo: { code: 'REALRUN1', kind: 'random' } });
    save.tracker.startRun(real);
    expect(save.tracker.featsCount).toBe(true);
    save.tracker.endRun('win', 1);
    expect(save.meta.isUnlocked('endings', 'ending1')).toBe(true);
    expect(save.meta.hasAchievement('clear-skies')).toBe(true);
  });
});

describe('who took her (game over)', () => {
  it('enemy contact records the enemy id; debug kills record nothing', () => {
    const sim = makeSim('killer', { room: OPEN_ROOM });
    testEnemy('t-biter', { move: { kind: 'idle' }, hp: 100, contact: 99 });
    const p = sim.world.player;
    const e = sim.spawnEnemy('t-biter', p.x + 4, p.y, { champion: false })!;
    e.spawnT = 0;
    sim.world.safeT = 0;
    stepN(sim, makeInput(), 30);
    expect(p.dead).toBe(true);
    expect(sim.world.killer).toBe('t-biter');
    const other = makeSim('killer-2', { room: OPEN_ROOM });
    other.killPlayer();
    expect(other.world.killer).toBe('');
  });
});

describe('save export → import through the save service', () => {
  it('a code carries progress and the saved run to another device; a bad code is refused', () => {
    const a = new GameSave(new MemoryStorage());
    a.achievements.grant(findAchievement('first-splash')!);
    const sim = Sim.newRun('EXPORTME', { seedInfo: { code: 'EXPORTME', kind: 'random' } });
    a.host = { savableRun: () => sim };
    a.saveRunNow();
    const code = a.exportCode();
    expect(code.startsWith('SD1:')).toBe(true);

    const b = new GameSave(new MemoryStorage());
    expect(b.checkImport('SD1:nope').ok).toBe(false);
    expect(b.checkImport('hello').ok).toBe(false);
    const r = b.checkImport(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    b.applyImport(r);
    expect(b.meta.hasAchievement('first-splash')).toBe(true);
    expect(b.hasRun()).toBe(true);
    const run = b.loadRun();
    expect(run.ok).toBe(true);
    if (run.ok) expect(run.snapshot.run.seedInfo?.code).toBe('EXPORTME');
    // The achievement engine was rebuilt: the imported achievement isn't earned twice.
    expect(b.achievements.grant(findAchievement('first-splash')!)).toBe(false);
  });
});

describe('achievements page', () => {
  it('reward lines list unlock refs and the items / characters naming the achievement', () => {
    expect(rewardLines(findAchievement('clear-skies')!)).toContain('THE HIDDEN ROUTE RUNS DEEPER');
    expect(rewardLines(findAchievement('drain-cleaner')!)).toContain('NEW ITEM: CHIPPED PIGGY BANK');
    for (const a of allAchievements()) expect(Array.isArray(rewardLines(a))).toBe(true);
  });
});

describe('left-handed HUD layout', () => {
  it('swaps the thumb columns and keeps pause + minimap top-right, at every button size', () => {
    for (const scale of [0.75, 1, 1.25, 1.5]) {
      const r = createRunButtons();
      layoutRunButtons(r, scale, false);
      expect(r.active.x).toBeGreaterThan(GAME_W / 2);
      expect(r.consumable.x).toBeLessThan(GAME_W / 2);
      const pause = { x: r.pause.x, y: r.pause.y };
      layoutRunButtons(r, scale, true);
      expect(r.active.x).toBeLessThan(GAME_W / 2);
      expect(r.bomb.x).toBeLessThan(GAME_W / 2);
      expect(r.consumable.x).toBeGreaterThan(GAME_W / 2);
      expect({ x: r.pause.x, y: r.pause.y }).toEqual(pause);
      // The left column starts below the hearts and counters and stays on screen.
      expect(r.active.y).toBeGreaterThanOrEqual(56);
      expect(r.bomb.y + r.bomb.h).toBeLessThanOrEqual(192);
      // Nothing overlaps.
      const all = [r.pause, r.map, r.active, r.bomb, r.consumable];
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a = all[i]!;
          const b = all[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(overlap, `${a.id} / ${b.id} at ${scale}`).toBe(false);
        }
      }
    }
  });
});

describe('menu art', () => {
  it('every menu icon has rows of its width and only palette characters', () => {
    for (const s of MENU_ICONS) {
      expect(s.frames.length).toBeGreaterThan(0);
      for (const f of s.frames) {
        expect(f.length, s.id).toBe(s.h);
        for (const row of f) {
          expect(row.length, `${s.id}: ${row}`).toBe(s.w);
          for (const ch of row) if (ch !== '.' && ch !== ' ') expect(s.palette[ch], `${s.id} '${ch}'`).toBeDefined();
        }
      }
    }
  });
});
