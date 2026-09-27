/**
 * One balance-harness shard (tests/helpers/balance.ts): a character's runs, one worker per `*.balance.ts` file so the
 * characters play in parallel. Each shard writes its runs to balance-results/; the global teardown (report.ts)
 * prints the report once every shard is done.
 */

import { describe, it } from 'vitest';
import { getCharacter } from '../../src/content/registry';
import { balanceConfig, playBalanceRun, writeResults, type BalanceRun } from '../helpers/balance';

export function runShard(id: string, part = 0, parts = 1): void {
  const cfg = balanceConfig();
  describe(`balance harness: ${id}${parts > 1 ? ` (part ${part + 1}/${parts})` : ''}`, () => {
    const skip = cfg.chars !== null && !cfg.chars.includes(id);
    it.skipIf(skip)(`${cfg.save} save, ${cfg.track} track`, () => {
      const ch = getCharacter(id);
      const runs: BalanceRun[] = [];
      for (let i = 1 + part; i <= cfg.seeds; i += parts) runs.push(playBalanceRun(ch, i, cfg));
      writeResults(cfg, parts > 1 ? `${id}.${part}` : id, runs);
      const wins = runs.filter((r) => r.won).length;
      const deaths = runs.map((r) => r.deathFloor).filter((f) => f > 0);
      console.log(`[balance] ${id}: ${wins}/${runs.length} won; deaths on floors ${deaths.join(' ') || '-'}; ${(runs.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(0)} s`);
    }, 4 * 3600_000);
  });
}
