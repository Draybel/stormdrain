/**
 * Global setup / teardown of `npm run balance` (vitest.balance.config.ts): clears the previous per-character results,
 * and once every shard has played, prints the balance report and writes it (balance-results/report-<save>-<track>.txt
 * and summary-<save>-<track>.json).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RESULTS_DIR, balanceConfig, balanceReport, clearResults, readResults } from '../helpers/balance';

export function setup(): () => void {
  clearResults();
  return () => {
    const runs = readResults();
    if (runs.length === 0) return;
    const cfg = balanceConfig();
    const { text, summary } = balanceReport(runs);
    mkdirSync(RESULTS_DIR, { recursive: true });
    writeFileSync(join(RESULTS_DIR, `report-${cfg.save}-${cfg.track}.txt`), text + '\n');
    writeFileSync(join(RESULTS_DIR, `summary-${cfg.save}-${cfg.track}.json`), JSON.stringify(summary, null, 1));
    console.log('\n' + text + '\n');
  };
}
