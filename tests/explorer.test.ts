/**
 * Soak test (Phase 3-4 verification): a god-mode explorer plays floors 1-4 of many seeds through the real
 * doors, secret walls, locks, arena plates, bosses (phases + death sequence), shops, the nook, the
 * trapdoor and (on some seeds) the hidden-route grate. No exceptions, no soft-locks (a room that can't
 * be cleared, a door that never opens), the boss always spawns and dies, the trapdoor always appears.
 *
 * At one room entry per seed the run is snapshotted and restored; an explorer on the restored copy must
 * retrace exactly what the original did from there (same rooms in the same order, the same floors, the
 * same final state).
 *
 * `EXPLORE_SEEDS=200 npx vitest run tests/explorer.test.ts` runs the full verification soak.
 */

import { describe, expect, it } from 'vitest';
import { hashString } from '../src/engine/rng';
import { Sim } from '../src/sim/sim';
import { Explorer, type ExploreReport } from './helpers/explorer';

const SEEDS = Number(process.env.EXPLORE_SEEDS ?? 12);
const FIRST = Number(process.env.EXPLORE_FIRST ?? 1);
const UNTIL = 5;

interface Fork {
  at: number;
  clone: Sim;
  data: string;
  summary: string;
}

function playSeed(seed: number): { report: ExploreReport; problems: string[] } {
  const problems: string[] = [];
  const sim = Sim.newRun(seed * 7919 + 13, {});
  const forkAt = 2 + (hashString(`fork${seed}`) % 24);
  let entries = 0;
  let fork: Fork | null = null;
  const ex = new Explorer(sim, {
    untilFloor: UNTIL,
    takeGrate: seed % 3 === 0,
    collect: true,
    onEnter: (s) => {
      entries++;
      if (entries !== forkAt || fork) return;
      const snap = s.snapshot();
      const text = JSON.stringify(snap);
      if (JSON.stringify(JSON.parse(text)) !== text) problems.push(`seed ${seed}: snapshot is not JSON-stable`);
      const clone = Sim.fromSnapshot(snap);
      fork = { at: entries - 1, clone, data: JSON.stringify(s.run!.data), summary: JSON.stringify(s.summary()) };
      if (JSON.stringify(clone.run!.data) !== fork.data) problems.push(`seed ${seed}: restored run data differs at entry ${entries}`);
      if (JSON.stringify(clone.summary()) !== fork.summary) {
        const a = JSON.parse(fork.summary);
        const b = clone.summary() as unknown as Record<string, unknown>;
        const diff = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
        problems.push(`seed ${seed}: restored summary differs at entry ${entries} in ${diff.join(', ')}`);
      }
    },
  });
  const report = ex.explore();
  problems.push(...report.problems);
  const f = fork as Fork | null;
  if (f) {
    const again = new Explorer(f.clone, { untilFloor: UNTIL, takeGrate: seed % 3 === 0, collect: true }).explore();
    problems.push(...again.problems.map((p) => `(restored) ${p}`));
    const tail = report.trace.slice(f.at);
    if (JSON.stringify(again.trace) !== JSON.stringify(tail)) {
      let k = 0;
      while (k < tail.length && again.trace[k] === tail[k]) k++;
      problems.push(`seed ${seed}: the restored run went elsewhere after ${k} rooms (${tail[k]} vs ${again.trace[k]})`);
    } else if (again.final !== report.final) {
      const a = JSON.parse(report.final);
      const b = JSON.parse(again.final);
      const diff = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      problems.push(`seed ${seed}: the restored run ended differently in ${diff.join(', ')}`);
    }
    const printsA = report.floors.map((r) => `${r.floor}${r.track}:${r.print}`);
    const printsB = again.floors.map((r) => `${r.floor}${r.track}:${r.print}`);
    // The first floor's print is taken mid-floor on the copy (the nook may have opened): skip it.
    for (const pb of printsB.slice(1)) if (!printsA.includes(pb)) problems.push(`seed ${seed}: the restored run generated a different floor ${pb}`);
  }
  // Every floor: boss spawned and died, trapdoor (unless the grate / an ending took her on).
  for (const r of report.floors) {
    if (r.floor >= UNTIL) continue;
    if (!r.bossSpawned) problems.push(`seed ${seed} floor ${r.floor}: the boss never spawned`);
    if (!r.bossDied) problems.push(`seed ${seed} floor ${r.floor}: the boss never died`);
    if (!r.trapdoor) problems.push(`seed ${seed} floor ${r.floor}: no trapdoor`);
    if (r.visited < r.rooms) problems.push(`seed ${seed} floor ${r.floor}: visited ${r.visited} of ${r.rooms} rooms`);
  }
  if (report.floors.length === 0 || report.floors[report.floors.length - 1]!.floor < UNTIL) {
    problems.push(`seed ${seed}: stopped on floor ${report.floors[report.floors.length - 1]?.floor}`);
  }
  return { report, problems };
}

describe('god-mode explorer soak (floors 1-4)', () => {
  it(`${SEEDS} seeds: no exceptions, no soft-locks, bosses and trapdoors, snapshots replay exactly`, () => {
    const all: string[] = [];
    let ticks = 0;
    let grates = 0;
    for (let s = FIRST; s < FIRST + SEEDS; s++) {
      const { report, problems } = playSeed(s);
      ticks += report.ticks;
      grates += report.floors.filter((f) => f.track === 'alt').length;
      all.push(...problems);
    }
    if (all.length > 0) console.log(all.slice(0, 60).join('\n'));
    if (process.env.EXPLORE_VERBOSE) console.log(`ticks ${ticks}, alt floors ${grates}`);
    expect(all).toEqual([]);
  }, 600_000);
});

describe('god-mode explorer: whole runs', () => {
  it('every floor of both tracks and all three endings, with no problems', () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    for (let s = 1; s <= Number(process.env.EXPLORE_FULL ?? 2); s++) {
      const cases: [string, string[], boolean, number][] = [
        // Main track all the way: Old Thunderhead, Ending 1.
        ['main', [], false, 1],
        // The hidden route (grates) with Ending 1 unlocked: The Nestmother, Ending 2.
        ['alt', ['ending1'], true, 2],
        // Endings 1 + 2 unlocked: the whirlpool after the floor-12 final, floor 13, The Undertow, Ending 3.
        ['deep', ['ending1', 'ending2'], false, 3],
      ];
      for (const [name, unlocked, grate, ending] of cases) {
        const sim = Sim.newRun(`full-${name}-${s}`, { unlocked });
        const report = new Explorer(sim, { untilFloor: 14, takeGrate: grate, collect: s === 1 }).explore();
        problems.push(...report.problems.map((p) => `${name}: ${p}`));
        const d = sim.run!.data;
        if (!d.won || d.ending !== ending) problems.push(`${name} seed ${s}: ended with won ${d.won} ending ${d.ending} on floor ${d.floor}`);
        for (const f of report.floors) {
          seen.add(`${f.floor}${f.track}`);
          if (f.floor < 12 && (!f.bossSpawned || !f.bossDied)) problems.push(`${name} seed ${s} floor ${f.floor}${f.track}: boss ${f.bossSpawned}/${f.bossDied}`);
        }
      }
    }
    if (problems.length > 0) console.log(problems.join('\n'));
    expect(problems).toEqual([]);
    // Every floor 1-12 of the main track, the alt track's floors, and floor 13.
    for (let f = 1; f <= 12; f++) expect(seen.has(`${f}main`), `floor ${f} main`).toBe(true);
    expect(seen.has('13main') || seen.has('13alt')).toBe(true);
    expect([...seen].filter((k) => k.endsWith('alt')).length).toBeGreaterThanOrEqual(6);
  }, 600_000);
});
