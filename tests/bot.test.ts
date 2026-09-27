/**
 * The headless play-bot (Phase 5; tests/helpers/bot.ts): god mode, sim only. It walks every room of every
 * floor through the doors on a grid path (a teleport only when stuck, logged), fights with the real attack
 * pipeline and a build that grows by random items each floor, opens chests, buys in shops, bombs secret
 * walls with real bombs, fights the boss and takes the trapdoor — catching crashes, soft-locks (a room that
 * never clears, a door that never opens, a boss that never dies) and invalid states on every tick.
 *
 * Runs (all characters, several seeds):
 * - main:   floors 1-12 of the main track, Old Thunderhead, then (Endings 1 + 2 unlocked) the whirlpool to
 *           floor 13, The Undertow → Ending 3;
 * - alt:    floors 1-12 of the alt track (Ending 1 unlocked, so it stays on it), The Nestmother → Ending 2;
 * - routes: the hidden routes forced (every grate there), taking the grate: floor 1 main → the alt track →
 *           rejoining the main track at chapter 6 (no Ending 1) → Old Thunderhead → Ending 1.
 * Plus a single floor per main-track floor 1-11 with its grate forced, so every hidden route gets used.
 *
 * Default: each of the 8 characters plays one whole run (the three kinds in turn, a seed each) ≈ 50 s.
 * `BOT_FULL=1`: every character × every kind × `BOT_SEEDS` seeds (default 3). `BOT_VERBOSE=1` prints each
 * run's notes (teleport fallbacks, fight time-outs, top-ups); `BOT_DEBUG=1` adds per-fight stats and a map of every
 * teleport's room. Guide: docs/testing.md.
 */

import { afterAll, describe, expect, it } from 'vitest';
import { allCharacters } from '../src/content/registry';
import type { RunOptions } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';
import type { CharacterDef } from '../src/sim/types';
import { playRun, type BotFloor, type BotReport } from './helpers/bot';

const FULL = !!process.env.BOT_FULL;
const SEEDS = Number(process.env.BOT_SEEDS ?? 3);
const VERBOSE = !!process.env.BOT_VERBOSE;

type Kind = 'main' | 'alt' | 'routes';

interface RunCase {
  kind: Kind;
  opts: RunOptions;
  grate: boolean;
  ending: number;
  /** Floors (`<floor><track>`) the run must pass through, in order. */
  floors: string[];
  /** How each floor is left (by floor key), 'trapdoor' when not listed. */
  exits: Record<string, BotFloor['exit']>;
}

function range(a: number, b: number, track: string): string[] {
  const out: string[] = [];
  for (let f = a; f <= b; f++) out.push(`${f}${track}`);
  return out;
}

const CASES: Record<Kind, RunCase> = {
  main: {
    kind: 'main',
    opts: { unlocked: ['ending1', 'ending2'] },
    grate: false,
    ending: 3,
    floors: [...range(1, 12, 'main'), '13main'],
    exits: { '12main': 'whirlpool', '13main': 'won' },
  },
  alt: {
    kind: 'alt',
    opts: { track: 'alt', unlocked: ['ending1'] },
    grate: false,
    ending: 2,
    floors: range(1, 12, 'alt'),
    exits: { '12alt': 'won' },
  },
  routes: {
    kind: 'routes',
    opts: { hiddenRouteChance: 1 },
    grate: true,
    ending: 1,
    floors: ['1main', ...range(2, 10, 'alt'), '11main', '12main'],
    exits: { '1main': 'grate', '12main': 'won' },
  },
};

const KINDS: Kind[] = ['main', 'alt', 'routes'];

interface Played {
  label: string;
  report: BotReport;
  ms: number;
}

const PLAYED: Played[] = [];

/** Plays one whole run and returns what's wrong with it (empty = clean). */
function playCase(ch: CharacterDef, c: RunCase, seed: number): string[] {
  const label = `${c.kind} ${ch.id} seed ${seed}`;
  const t0 = performance.now();
  const sim = Sim.newRun(`bot-${c.kind}-${ch.id}-${seed}`, c.opts, ch);
  const report = playRun(sim, { untilFloor: 14, takeGrate: c.grate, itemsPerFloor: 2 });
  const ms = performance.now() - t0;
  PLAYED.push({ label, report, ms });
  const out: string[] = report.problems.map((p) => `${label}: ${p}`);
  const d = sim.run!.data;
  if (!d.won || d.ending !== c.ending) out.push(`${label}: ended with won ${d.won}, ending ${d.ending} on floor ${d.floor} ${d.track} (expected ending ${c.ending})`);
  const seen = report.floors.map((f) => `${f.floor}${f.track}`);
  if (JSON.stringify(seen) !== JSON.stringify(c.floors)) out.push(`${label}: floors ${seen.join(' ')} (expected ${c.floors.join(' ')})`);
  for (const f of report.floors) {
    const key = `${f.floor}${f.track}`;
    if (!f.bossSpawned) out.push(`${label}: floor ${key}: the boss '${f.boss}' never spawned`);
    if (!f.bossKilledBy) out.push(`${label}: floor ${key}: the boss '${f.boss}' never died`);
    if (f.visited < f.rooms) out.push(`${label}: floor ${key}: visited ${f.visited} of ${f.rooms} rooms`);
    const exit = c.exits[key] ?? 'trapdoor';
    if (f.exit !== exit) out.push(`${label}: floor ${key}: left by ${f.exit} (expected ${exit})`);
  }
  // Teleports are the stuck fallback: a handful per run at most (loot in awkward corners), never a habit.
  const allowed = Math.max(10, Math.ceil(report.walks * 0.01));
  if (report.teleports > allowed) out.push(`${label}: ${report.teleports} teleport fallbacks in ${report.walks} walks (> ${allowed})`);
  if (VERBOSE || out.length > 0) console.log(`${label}:\n  ${report.notes.slice(0, 40).join('\n  ')}`);
  return out;
}

describe('play-bot: whole runs on every track, every character', () => {
  const chars = allCharacters();
  const plan: { ch: CharacterDef; kind: Kind; seed: number }[] = [];
  if (FULL) {
    for (let s = 1; s <= SEEDS; s++) for (const ch of chars) for (const kind of KINDS) plan.push({ ch, kind, seed: s });
  } else {
    chars.forEach((ch, i) => plan.push({ ch, kind: KINDS[i % KINDS.length]!, seed: i + 1 }));
  }
  for (const { ch, kind, seed } of plan) {
    it(`${ch.name}: ${kind} (seed ${seed})`, () => {
      expect(playCase(ch, CASES[kind], seed)).toEqual([]);
    });
  }

  it('together the runs cover every floor and every kind of room business', () => {
    const floors = new Set<string>();
    let secrets = 0;
    let bought = 0;
    let chests = 0;
    let items = 0;
    let grates = 0;
    let bosses = 0;
    let fought = 0;
    let doors = 0;
    let locks = 0;
    let bossFights = 0;
    let bossPhases = 0;
    let entries = 0;
    for (const p of PLAYED) {
      doors += p.report.doors;
      locks += p.report.locksOpened;
      bossFights += p.report.bossFights;
      bossPhases += p.report.bossPhases;
      entries += p.report.roomsEntered;
      for (const f of p.report.floors) {
        floors.add(`${f.floor}${f.track}`);
        secrets += f.secretsBombed;
        bought += f.bought;
        chests += f.chests;
        items += f.itemsTaken;
        if (f.exit === 'grate') grates++;
        if (f.bossKilledBy) bosses++;
        if (f.bossKilledBy === 'fight') fought++;
      }
    }
    for (let f = 1; f <= 12; f++) {
      expect(floors.has(`${f}main`), `floor ${f} main`).toBe(true);
      expect(floors.has(`${f}alt`), `floor ${f} alt`).toBe(true);
    }
    expect(floors.has('13main'), 'floor 13').toBe(true);
    // Rooms are entered by walking through doors (the rest: floor starts and the odd teleport item).
    expect(doors / Math.max(1, entries), `${doors} doors walked for ${entries} room entries`).toBeGreaterThan(0.75);
    expect(locks, 'locked doors opened with a key').toBeGreaterThan(0);
    expect(secrets, 'secret walls bombed').toBeGreaterThan(PLAYED.length);
    expect(bought, 'things bought (paid for and handed over)').toBeGreaterThan(PLAYED.length);
    // Every boss / miniboss fight went through all its phases (checked per fight); they have two or more each.
    expect(bossFights, 'boss fights seen to the end').toBeGreaterThan(PLAYED.length);
    expect(bossPhases, 'boss phases fought through').toBeGreaterThanOrEqual(2 * bossFights);
    expect(chests, 'chests opened').toBeGreaterThan(0);
    expect(items, 'items taken').toBeGreaterThan(0);
    expect(grates, 'hidden-route grates taken').toBeGreaterThan(0);
    // Most bosses fall to the real attack pipeline (the rest are finished after the time limit, logged).
    expect(fought / Math.max(1, bosses), `bosses killed by real fighting: ${fought} of ${bosses}`).toBeGreaterThan(0.6);
  });
});

describe('play-bot: every hidden route', () => {
  it('floors 1-11 of the main track, each with its grate forced: blast it open, drop to the alt track', () => {
    const problems: string[] = [];
    const chars = allCharacters();
    for (let floor = 1; floor <= 11; floor++) {
      const ch = chars[floor % chars.length]!;
      const sim = Sim.newRun(`bot-grate-${floor}`, { floor, hiddenRouteChance: 1, unlocked: ['ending1'] }, ch);
      const report = playRun(sim, { untilFloor: floor + 1, takeGrate: true, itemsPerFloor: 2 + floor });
      PLAYED.push({ label: `grate floor ${floor}`, report, ms: 0 });
      problems.push(...report.problems.map((p) => `grate floor ${floor}: ${p}`));
      const d = sim.run!.data;
      if (d.floor !== floor + 1 || d.track !== 'alt') problems.push(`grate floor ${floor}: ended on floor ${d.floor} ${d.track} (expected ${floor + 1} alt)`);
      const rec = report.floors.find((f) => f.floor === floor);
      if (rec?.exit !== 'grate') problems.push(`grate floor ${floor}: left by ${rec?.exit}`);
    }
    expect(problems).toEqual([]);
  });
});

afterAll(() => {
  if (PLAYED.length === 0) return;
  let ticks = 0;
  let walks = 0;
  let teleports = 0;
  let fights = 0;
  let bossFb = 0;
  let topUps = 0;
  let doors = 0;
  let buys = 0;
  let ms = 0;
  let simMs = 0;
  for (const p of PLAYED) {
    simMs += p.report.simMs;
    ticks += p.report.ticks;
    walks += p.report.walks;
    teleports += p.report.teleports;
    fights += p.report.fightFallbacks;
    bossFb += p.report.bossFallbacks;
    topUps += p.report.topUps;
    doors += p.report.doors;
    for (const f of p.report.floors) buys += f.bought;
    ms += p.ms;
  }
  console.log(
    `[bot] ${PLAYED.length} runs, ${ticks} ticks (${((ticks / 60) / 60).toFixed(0)} min of play) in ${(ms / 1000).toFixed(1)} s (sim ${(simMs / 1000).toFixed(1)} s) — ` +
      `${walks} walks, ${doors} doors, ${buys} purchases, ${teleports} teleport fallbacks, ${fights} room / ${bossFb} boss fights finished after the time limit, ${topUps} top-ups`,
  );
});
