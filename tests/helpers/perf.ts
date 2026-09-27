/**
 * Timing budgets for the performance assertions in the unit tests.
 *
 * The budgets are written for a desktop dev machine. Shared CI runners (GitHub Actions: 2-4 slow vCPUs,
 * noisy neighbours) and a busy local machine run the same code several times slower, so every budget
 * goes through `perfBudget(ms)`:
 *   - `PERF_SLACK=<n>` multiplies every budget by n (e.g. `PERF_SLACK=2 npm test` on a slow laptop);
 *   - on CI (`CI` set, as GitHub Actions does) the default slack is 3;
 *   - otherwise 1.
 * The budgets are there to catch pathological regressions (an O(n²) loop, a leak that snowballs), which
 * blow through any sane multiple — not to benchmark the machine.
 */

const env = typeof process !== 'undefined' ? process.env : {};

function readSlack(): number {
  const raw = Number(env.PERF_SLACK);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return env.CI ? 3 : 1;
}

/** The multiplier applied to every timing budget. */
export const PERF_SLACK = readSlack();

/** A timing budget in ms, scaled for the machine the tests run on. */
export function perfBudget(ms: number): number {
  return ms * PERF_SLACK;
}

/** Summary of a list of step times (ms). */
export interface TimingStats {
  n: number;
  avg: number;
  p50: number;
  p99: number;
  max: number;
}

/** avg / p50 / p99 / max of the first `n` entries of `times` (sorts a copy). */
export function timingStats(times: ArrayLike<number>, n = times.length): TimingStats {
  if (n <= 0) return { n: 0, avg: 0, p50: 0, p99: 0, max: 0 };
  const a = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    a[i] = times[i]!;
    sum += a[i]!;
  }
  a.sort();
  const at = (q: number): number => a[Math.min(n - 1, Math.max(0, Math.ceil(q * n) - 1))]!;
  return { n, avg: sum / n, p50: at(0.5), p99: at(0.99), max: a[n - 1]! };
}

/**
 * A timing that must stay under `budget` ms. `first` was measured already; while it is over budget,
 * `again()` measures a fresh, identical run (the sim is deterministic) — up to `tries` runs in all — and
 * the best one is returned. Only SUSTAINED slowness fails; a GC pause or a machine busy with the other
 * test files (vitest runs them in parallel) during one run doesn't.
 */
export function steadyTiming(first: number, budget: number, again: () => number, tries = 3): number {
  let best = first;
  for (let i = 1; i < tries && best >= budget; i++) best = Math.min(best, again());
  return best;
}
