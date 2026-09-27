/**
 * The career simulation (polish batch 4, B4-4): a brand-new player's first runs, one after another, through the real
 * meta layer — GameSave (MetaStore + the achievement engine + MetaTracker), each run started with the unlocks the
 * save has earned so far (`unlockedForRun`) and played by the balance harness's bot (human mode). The character is
 * the next one of the unlocked roster in turn, as a player trying out each new arrival would.
 *
 * It checks the unlock pacing: Marrow (SOAKED THROUGH, 3 deaths) arrives by run 12 (she used to come last, at runs 22-31),
 * and the first win opens at most 4 characters (it opened 5 of 7). The audit's target — at most ~12 achievements and 2
 * characters from the first win — is printed, not asserted: this bot wins its very first run, and a first win always
 * beats chapter 2's boss (Pip) and Old Thunderhead (Mosswick) and meets every in-run milestone at once (26 of 53
 * achievements; DECISIONS "Polish batch 4"). The run-by-run log goes to balance-results/career.txt.
 *
 * Opt-in and slow (the runs are sequential): `BALANCE_CAREER=1 npm run balance -- career` (BALANCE_CAREER_RUNS, default
 * 40). Not part of `npm test`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GameSave } from '../../src/meta/save';
import { MemoryStorage } from '../../src/meta/storage';
import { unlockedCharacters } from '../../src/meta/unlocks';
import { Sim } from '../../src/sim/sim';
import { RESULTS_DIR } from '../helpers/balance';
import { playRun } from '../helpers/bot';

const RUNS = Math.max(1, Number(process.env.BALANCE_CAREER_RUNS ?? 40) | 0);

describe('career simulation', () => {
  it.skipIf(!process.env.BALANCE_CAREER)(`${RUNS} runs from a fresh save: unlock pacing`, () => {
    const save = new GameSave(new MemoryStorage());
    const lines: string[] = [];
    let firstWin = -1;
    let firstWinAch = 0;
    let firstWinChars: string[] = [];
    let marrowAt = -1;
    let wins = 0;
    for (let k = 1; k <= RUNS; k++) {
      const roster = unlockedCharacters(save.meta.state);
      const ch = roster[(k - 1) % roster.length]!;
      const achBefore = new Set(Object.keys(save.meta.state.achievements));
      const charsBefore = new Set(roster.map((c) => c.id));
      const sim = Sim.newRun(`career-${k}`, { unlocked: save.unlockedForRun() }, ch);
      save.tracker.startRun(sim);
      playRun(sim, {
        untilFloor: 14,
        human: true,
        roomLimit: 90,
        bossLimit: 240,
        onTick: () => {
          save.tracker.afterStep();
          save.endTick();
        },
      });
      if (save.tracker.tracking) save.tracker.endRun('quit');
      save.endTick();
      const d = sim.run!.data;
      const won = d.won === 1;
      const newAch = Object.keys(save.meta.state.achievements).filter((a) => !achBefore.has(a));
      const newChars = unlockedCharacters(save.meta.state)
        .map((c) => c.id)
        .filter((c) => !charsBefore.has(c));
      if (won) wins++;
      if (won && firstWin < 0) {
        firstWin = k;
        firstWinAch = newAch.length;
        firstWinChars = newChars;
      }
      if (marrowAt < 0 && newChars.includes('marrow')) marrowAt = k;
      lines.push(
        `run ${String(k).padStart(2)} ${ch.id.padEnd(9)} ${won ? `WON (ending ${d.ending})` : `died on floor ${d.floor}`}` +
          ` · +${newAch.length} achievements${newAch.length ? ` (${newAch.join(', ')})` : ''}${newChars.length ? ` · NEW: ${newChars.join(', ')}` : ''}` +
          ` · ${Object.keys(save.meta.state.achievements).length} total, roster ${unlockedCharacters(save.meta.state).length}`,
      );
    }
    const summary =
      `CAREER: ${RUNS} runs, ${wins} won; first win on run ${firstWin} unlocked ${firstWinAch} achievements and ` +
      `${firstWinChars.length} characters (${firstWinChars.join(', ') || '-'}); Marrow on run ${marrowAt}; ` +
      `${Object.keys(save.meta.state.achievements).length} achievements and ${unlockedCharacters(save.meta.state).length} characters in all`;
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, 'career.txt'), [summary, ...lines].join('\n') + '\n');
    console.log(`\n${summary}\n${lines.join('\n')}\n`);
    expect(firstWin, 'a win in the career').toBeGreaterThan(0);
    // (Target ≤ ~12 achievements / 2 characters — see the header: reported in the summary line.)
    expect(firstWinChars.length, 'characters unlocked by the first win').toBeLessThanOrEqual(4);
    expect(marrowAt, 'Marrow arrives').toBeGreaterThan(0);
    expect(marrowAt, 'Marrow arrives before run 12').toBeLessThanOrEqual(12);
  }, 4 * 3600_000);
});
