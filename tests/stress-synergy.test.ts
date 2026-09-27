/**
 * Synergy stress test (Phase 5): the attack pipeline and the whole item pool under load, with real
 * enemies (tests/helpers/stress.ts has the harness and the invariants).
 *
 * (a) Every carrier as the primary × every shot modifier, and every pair of carriers, fired for a few
 *     seconds in a room full of real chapter enemies (waves keep coming; every tenth build also fights a
 *     boss).
 * (b) Random stacks of 10-30 items drawn from ALL items (seeded, reproducible, duplicates allowed), handed
 *     over through the real pickup flow, played for ~5 s each by every character in turn while waves (and
 *     now and then a boss) keep spawning; actives, consumables, bombs and the dash get used.
 *
 * Checked on every tick: no exceptions, no NaN / Infinity, every pool within its cap (projectiles, beams,
 * swipes, chain arcs, explosions, puddles, enemies, enemy shots, shockwaves, pickups, bombs, pedestals,
 * the event queue, the presentation particles), nothing outside the room (+16 px). After each fight the
 * room clears and every transient pool must fall back to its at-rest level (no leaks). Sim step times are
 * reported (avg / p99 / max); a build whose p99 stays above 8 ms (× PERF_SLACK — see helpers/perf.ts) on
 * three deterministic replays fails.
 *
 * Default (≈ 10 s on a desktop): the whole carrier matrix at 3 s per build + 120 random stacks. `STRESS=full`
 * runs the exhaustive version (≈ 40 s: the matrix at 1 and 3 modifier stacks, 5 s per build, and 1000 random
 * stacks); `STRESS_STACKS=<n>` sets the stack count; `STRESS_VERBOSE=1` prints every build.
 */

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { BOSSES, CHAPTERS, allCharacters, allItems } from '../src/content/registry';
import type { Sim } from '../src/sim/sim';
import { CARRIER_IDS, MOD_IDS, type CarrierId, type ModId } from '../src/sim/types';
import { carrierItem, give, modItem } from './helpers/attack';
import { perfBudget, timingStats } from './helpers/perf';
import { describeResult, runStress, type StressBuild, type StressResult } from './helpers/stress';

const FULL = process.env.STRESS === 'full';
const VERBOSE = !!process.env.STRESS_VERBOSE;
const MATRIX_TICKS = FULL ? 300 : 180;
const STACKS = Number(process.env.STRESS_STACKS ?? (FULL ? 1000 : 120));
/** Modifier stack counts in the carrier matrix. */
const MATRIX_STACKS = FULL ? [1, 3] : [1];
const STACK_TICKS = 300;
/** Sustained slow steps: a build whose p99 step stays above this fails (node, desktop). */
const P99_BUDGET = perfBudget(8);

const CHAPTER_IDS = [...CHAPTERS.keys()].sort();
const BOSS_IDS = [...BOSSES.keys()];

/** Every result, for the final report. */
const ALL: StressResult[] = [];

/**
 * Runs a build; a p99 over the budget is replayed (the run is deterministic) up to twice and the best
 * p99 kept, so only SUSTAINED slowness fails — not a GC pause or a busy machine.
 */
function play(build: StressBuild): { res: StressResult; problems: string[] } {
  let res = runStress(build);
  const problems: string[] = [];
  for (let again = 0; again < 2 && !res.error && res.stats.p99 > P99_BUDGET; again++) {
    const retry = runStress(build);
    if (retry.error) {
      res = retry;
      break;
    }
    if (retry.stats.p99 < res.stats.p99) res = retry;
  }
  ALL.push(res);
  if (VERBOSE) console.log(describeResult(res));
  if (res.error) problems.push(`${build.label} (seed ${build.seed}): ${res.error}`);
  for (const l of res.leaks) problems.push(`${build.label} (seed ${build.seed}): not back to rest after the clear: ${l}`);
  if (!res.error && res.stats.p99 > P99_BUDGET) {
    problems.push(`${build.label} (seed ${build.seed}): sustained slow steps — p99 ${res.stats.p99.toFixed(2)} ms > ${P99_BUDGET} ms (avg ${res.stats.avg.toFixed(2)}, max ${res.stats.max.toFixed(2)})`);
  }
  return { res, problems };
}

function withCarrier(sim: Sim, c: CarrierId): void {
  if (c !== 'marble') give(sim, carrierItem(c));
}

function report(title: string, results: readonly StressResult[]): void {
  if (results.length === 0) return;
  let ticks = 0;
  for (const r of results) ticks += r.ticks;
  const all = new Float64Array(ticks);
  let k = 0;
  for (const r of results) for (let i = 0; i < Math.min(r.ticks, r.times.length); i++) all[k++] = r.times[i]!;
  const s = timingStats(all, k);
  const peak = (f: (r: StressResult) => number): number => results.reduce((m, r) => Math.max(m, f(r)), 0);
  const worst = [...results].sort((a, b) => b.stats.p99 - a.stats.p99).slice(0, 3);
  const fx = results.reduce((m, r) => m + r.fxAvg, 0) / results.length;
  console.log(
    [
      `[stress] ${title}: ${results.length} builds, ${ticks} ticks — sim step avg ${s.avg.toFixed(3)} ms, p50 ${s.p50.toFixed(3)}, p99 ${s.p99.toFixed(2)}, max ${s.max.toFixed(2)} (budget p99 ${P99_BUDGET}); particle layer avg ${fx.toFixed(3)} ms`,
      `  peaks: projectiles ${peak((r) => r.peaks.projectiles)}, beams ${peak((r) => r.peaks.beams)}, swipes ${peak((r) => r.peaks.swipes)}, enemies ${peak((r) => r.peaks.enemies)}, enemy shots ${peak((r) => r.peaks.enemyShots)}, puddles ${peak((r) => r.peaks.creep)}, live explosions ${peak((r) => r.peaks.explosionsLive)}, pickups ${peak((r) => r.peaks.pickups)}, particles ${peak((r) => r.peaks.particles)}, events/tick ${peak((r) => r.peaks.events)}, chain arcs/tick ${peak((r) => r.peaks.chainArcs)}`,
      `  slowest (p99): ${worst.map((r) => `${r.label} ${r.stats.p99.toFixed(2)} ms`).join(' · ')}`,
    ].join('\n'),
  );
}

// ── (a) the carrier matrix ─────────────────────────────────────────────────────

describe('stress (a): every carrier × every modifier, every carrier pair — real enemies', () => {
  for (const c of CARRIER_IDS) {
    it(`${c} as the primary × all ${MOD_IDS.length} modifiers`, () => {
      const problems: string[] = [];
      const results: StressResult[] = [];
      for (const k of MATRIX_STACKS) {
        for (const m of MOD_IDS) {
          // Fixed per build (not per run order), so a filtered run replays the very same build.
          const i = CARRIER_IDS.indexOf(c) * MOD_IDS.length + MOD_IDS.indexOf(m as ModId) + (k - 1) * 7;
          const { res, problems: p } = play({
            label: `${c} + ${m}${k > 1 ? ` ×${k}` : ''}`,
            seed: `stress-${c}-${m}${k > 1 ? `-x${k}` : ''}`,
            setup: (sim) => {
              withCarrier(sim, c);
              give(sim, modItem(m as ModId), k);
            },
            chapter: CHAPTER_IDS[i % CHAPTER_IDS.length]!,
            waveSize: 8,
            boss: i % 10 === 9 && BOSS_IDS.length > 0 ? BOSS_IDS[Math.floor(i / 10) % BOSS_IDS.length] : undefined,
            fightTicks: MATRIX_TICKS,
          });
          results.push(res);
          problems.push(...p);
        }
      }
      report(`${c} × modifiers`, results);
      expect(problems).toEqual([]);
      expect(results.reduce((k, r) => k + r.kills, 0), 'the builds kill things').toBeGreaterThan(MOD_IDS.length);
    });
  }

  it(`every pair of carriers (${(CARRIER_IDS.length * (CARRIER_IDS.length - 1)) / 2})`, () => {
    const problems: string[] = [];
    const results: StressResult[] = [];
    let i = 0;
    for (let a = 0; a < CARRIER_IDS.length; a++) {
      for (let b = a + 1; b < CARRIER_IDS.length; b++) {
        const ca = CARRIER_IDS[a]!;
        const cb = CARRIER_IDS[b]!;
        const { res, problems: p } = play({
          label: `${ca} + ${cb}`,
          seed: `stress-pair-${ca}-${cb}`,
          setup: (sim) => {
            give(sim, carrierItem(ca));
            give(sim, carrierItem(cb));
          },
          chapter: CHAPTER_IDS[i % CHAPTER_IDS.length]!,
          waveSize: 8,
          fightTicks: MATRIX_TICKS,
        });
        i++;
        results.push(res);
        problems.push(...p);
      }
    }
    report('carrier pairs', results);
    expect(problems).toEqual([]);
  });
});

// ── (b) random stacks from the whole item pool ──────────────────────────────────

/** The seeded stack for index `i`: 10-30 item ids from every item there is, duplicates allowed. */
function randomStack(i: number): string[] {
  const pool = allItems().filter((d) => !d.tags.includes('test'));
  const rng = new Rng(`stress-stack-${i}`);
  const n = rng.int(10, 30);
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(pool[rng.int(0, pool.length - 1)]!.id);
  return out;
}

describe(`stress (b): ${STACKS} random stacks of 10-30 items from every item`, () => {
  it('no exceptions, NaN, escapes, cap breaches or leaks; bounded step times', () => {
    const chars = allCharacters().map((c) => c.id);
    const problems: string[] = [];
    const results: StressResult[] = [];
    const seenItems = new Set<string>();
    for (let i = 0; i < STACKS; i++) {
      const items = randomStack(i);
      for (const id of items) seenItems.add(id);
      const rng = new Rng(`stress-stack-room-${i}`);
      const { res, problems: p } = play({
        label: `stack #${i} (${chars[i % chars.length]}, ${items.length} items)`,
        seed: `stress-stack-${i}`,
        character: chars[i % chars.length],
        setup: (sim) => {
          sim.addPickups(20, 10, 5);
          for (const id of items) sim.giveItem(id);
        },
        chapter: CHAPTER_IDS[rng.int(0, CHAPTER_IDS.length - 1)]!,
        waveSize: rng.int(6, 10),
        boss: i % 8 === 5 && BOSS_IDS.length > 0 ? BOSS_IDS[rng.int(0, BOSS_IDS.length - 1)] : undefined,
        fightTicks: STACK_TICKS,
        useItems: true,
      });
      results.push(res);
      if (p.length > 0) problems.push(...p.map((x) => `${x}\n    items: ${items.join(', ')}`));
    }
    report('random stacks', results);
    if (problems.length > 0) console.log(problems.slice(0, 20).join('\n'));
    expect(problems).toEqual([]);
    // The stacks really do sample the pool widely.
    expect(seenItems.size).toBeGreaterThan(Math.min(allItems().length * 0.5, STACKS * 5));
  });
});

describe('stress report', () => {
  it('prints the overall step-time summary', () => {
    report('all builds', ALL);
    expect(ALL.length).toBeGreaterThan(0);
  });
});
