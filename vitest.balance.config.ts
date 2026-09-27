/// <reference types="vitest/config" />
/**
 * The balance harness (polish batch 4): `npm run balance` — not part of `npm test`. Whole runs played by the play-bot
 * in human mode, one worker per shard file (tests/balance/*.balance.ts), the report printed by the global teardown.
 * Switches: tests/helpers/balance.ts (BALANCE_SEEDS, BALANCE_SAVE, BALANCE_TRACK, BALANCE_UNTIL, BALANCE_CHARS).
 */
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/balance/**/*.balance.ts'],
    globalSetup: ['tests/balance/report.ts'],
    testTimeout: 4 * 3600_000,
    hookTimeout: 60_000,
    maxWorkers: 16,
    env: { BALANCE: '1' },
  },
});
