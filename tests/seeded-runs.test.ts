/**
 * Polish batch 1 (B1-6): the same seed recreates the same run. Typed codes and dailies roll their floors against
 * the canonical fresh-save unlock snapshot (not the player's), a retry replays its original's snapshot, and a
 * daily picked before UTC midnight but started after it becomes the new day's daily.
 */

import { describe, expect, it } from 'vitest';
import { GameSave } from '../src/meta/save';
import { dailySeedCode, dailySeedInfo, rolledOverDaily } from '../src/meta/seedCode';
import { MemoryStorage } from '../src/meta/storage';
import { runUnlocks, unlocksForRun } from '../src/meta/unlocks';
import type { RunData, RunSeedInfo } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';

function freshSave(): GameSave {
  return new GameSave(new MemoryStorage(), { now: () => 1_000_000 });
}

function fullSave(): GameSave {
  const s = freshSave();
  s.debugUnlockAll();
  return s;
}

/** A run started the way the run scene starts one (RunScene.makeSim): the save picks the unlock snapshot. */
function startRun(save: GameSave, seed: RunSeedInfo, fixed?: readonly string[]): Sim {
  return Sim.newRun(seed.code, { unlocked: save.unlockedForRun(seed, fixed), seedInfo: seed });
}

/** What a floor offers: the layout, every room's pre-rolls and the nook's. */
function floorJson(d: RunData): string {
  return JSON.stringify({ layout: d.layout, rooms: d.rooms, nook: d.nook });
}

const CODES = ['ABCD2345', 'RAIN9876', 'DRAINPIP', 'GUTTERS2', 'MARBLE77', 'STORMY42', 'PUDDLE88', 'WRENWREN'];

describe('the unlock snapshot a run starts with', () => {
  it('random runs use the player’s unlocks, typed codes and dailies the fresh-save set, retries their own', () => {
    const full = fullSave().meta.state;
    const mine = runUnlocks(full);
    expect(mine.length).toBeGreaterThan(20);
    expect(unlocksForRun(full, { code: 'ABCD2345', kind: 'random' })).toEqual(mine);
    expect(unlocksForRun(full, null)).toEqual(mine);
    expect(unlocksForRun(full, { code: 'ABCD2345', kind: 'custom' })).toEqual([]);
    expect(unlocksForRun(full, dailySeedInfo('2026-09-27', false))).toEqual([]);
    expect(unlocksForRun(full, { code: 'ABCD2345', kind: 'custom' }, ['b', 'a', 'a'])).toEqual(['a', 'b']);
    // Debug starts (no seed info) keep the player's own.
    expect(fullSave().unlockedForRun()).toEqual(mine);
  });

  it('a typed code gives the same floors on an empty save and on one with everything unlocked', () => {
    for (const code of CODES) {
      const seed: RunSeedInfo = { code, kind: 'custom' };
      const a = startRun(freshSave(), seed);
      const b = startRun(fullSave(), seed);
      expect(floorJson(b.run!.data)).toBe(floorJson(a.run!.data));
      // …and the next floors too (same route).
      for (let f = 0; f < 2; f++) {
        a.run!.skipFloor();
        b.run!.skipFloor();
        expect(floorJson(b.run!.data)).toBe(floorJson(a.run!.data));
      }
    }
  });

  it('so does a daily (the same code for everyone that day)', () => {
    const seed = dailySeedInfo('2026-09-27', false);
    expect(seed.code).toBe(dailySeedCode('2026-09-27'));
    const a = startRun(freshSave(), seed);
    const b = startRun(fullSave(), { ...seed, scored: false });
    expect(floorJson(b.run!.data)).toBe(floorJson(a.run!.data));
  });

  it('random runs still roll against the player’s own unlocks (the snapshot matters)', () => {
    let differ = 0;
    for (const code of CODES) {
      const seed: RunSeedInfo = { code, kind: 'random' };
      if (floorJson(startRun(freshSave(), seed).run!.data) !== floorJson(startRun(fullSave(), seed).run!.data)) differ++;
    }
    expect(differ).toBeGreaterThan(3);
  });

  it('RETRY SEED after a new unlock replays the original run (its stored snapshot)', () => {
    let checked = 0;
    for (const code of CODES) {
      const save = freshSave();
      const original = startRun(save, { code, kind: 'random' });
      const d = original.run!.data;
      // Something new gets unlocked before the retry.
      save.debugUnlockAll();
      // The game-over screen's RETRY SEED: the same code as practice, with the run's own snapshot.
      const retry = startRun(save, { code, kind: 'custom' }, d.unlocked);
      expect(retry.run!.data.unlocked).toEqual(d.unlocked);
      expect(floorJson(retry.run!.data)).toBe(floorJson(d));
      // Without the stored snapshot it would not be the same run (on most codes).
      if (floorJson(Sim.newRun(code, { unlocked: save.unlockedForRun() }).run!.data) !== floorJson(d)) checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
});

describe('the daily across UTC midnight', () => {
  it('a daily picked yesterday becomes today’s (code and scored flag); today’s is left alone', () => {
    const played = new Set(['2026-09-28']);
    const y = dailySeedInfo('2026-09-27', false);
    expect(rolledOverDaily(y, '2026-09-27', (d) => played.has(d))).toBeNull();
    const t = rolledOverDaily(y, '2026-09-28', () => false)!;
    expect(t).toEqual({ code: dailySeedCode('2026-09-28'), kind: 'daily', date: '2026-09-28', scored: true });
    expect(t.code).not.toBe(y.code);
    expect(rolledOverDaily(y, '2026-09-28', (d) => played.has(d))!.scored).toBe(false);
    expect(rolledOverDaily({ code: 'ABCD2345', kind: 'custom' }, '2026-09-28', () => false)).toBeNull();
  });
});
