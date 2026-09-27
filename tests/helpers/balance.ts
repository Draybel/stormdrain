/**
 * The balance harness (polish batch 4, B4-1): whole runs played by the play-bot in `human` mode (tests/helpers/bot.ts —
 * no god mode, no top-ups, dodging, buying what it can afford) and the numbers a balance pass needs, per run and
 * summed up. Opt-in: `npm run balance` (vitest.balance.config.ts runs tests/balance/*.balance.ts, one worker per
 * character, and prints the report at the end). Guide: docs/testing.md "The balance harness".
 *
 * Switches: BALANCE_SEEDS (runs per character, default 20), BALANCE_SAVE ('fresh' = a new player's unlocks, the
 * default; 'unlocked' = every item and both route endings), BALANCE_TRACK ('main' default | 'alt'), BALANCE_UNTIL (stop
 * at this floor; default 14 = the whole run), BALANCE_CHARS (comma-separated character ids).
 *
 * The bot aims almost perfectly and never panics, so its win rates are optimistic: read them as a ceiling and as a
 * way to compare two builds of the game, not as what players will see.
 */

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { allItems } from '../../src/content/registry';
import { Sim } from '../../src/sim/sim';
import type { CharacterDef } from '../../src/sim/types';
import { HURT_SOURCES, playRun, type BotFloor } from './bot';

export const RESULTS_DIR = join(process.cwd(), 'balance-results');

export interface BalanceConfig {
  seeds: number;
  save: 'fresh' | 'unlocked';
  track: 'main' | 'alt';
  until: number;
  chars: string[] | null;
}

export function balanceConfig(): BalanceConfig {
  const env = process.env;
  const save = env.BALANCE_SAVE === 'unlocked' ? 'unlocked' : 'fresh';
  return {
    seeds: Math.max(1, Number(env.BALANCE_SEEDS ?? 20) | 0),
    save,
    track: env.BALANCE_TRACK === 'alt' ? 'alt' : 'main',
    until: Math.max(2, Number(env.BALANCE_UNTIL ?? 14) | 0),
    chars: env.BALANCE_CHARS ? env.BALANCE_CHARS.split(',').map((s) => s.trim()) : null,
  };
}

/** One floor of a harness run (a trimmed BotFloor). */
export interface BalanceFloor {
  floor: number;
  track: string;
  chapter: string;
  hurt: number[];
  fights: number[];
  boss: string;
  bossHp: number;
  bossSeconds: number;
  bossBy: string;
  items: number;
  itemsBy: Record<string, number>;
  coins: number;
  keys: number;
  bombs: number;
  coinsIn: number;
  keysIn: number;
  bombsIn: number;
  spawned: number;
  champions: number;
  shop: boolean;
  died: boolean;
  lance: boolean;
}

export interface BalanceRun {
  char: string;
  seed: string;
  save: string;
  won: boolean;
  deathFloor: number;
  killer: string;
  killedBy: number;
  floors: BalanceFloor[];
  problems: string[];
  /** The bot's notes (fight time-outs, teleport fallbacks), first few. */
  notes: string[];
  fallbacks: number;
  teleports: number;
  ticks: number;
  ms: number;
}

/** Everything a fresh save lacks: every gated item and both route endings. */
export function unlockAll(): string[] {
  const ids = allItems()
    .filter((d) => d.unlock !== undefined)
    .map((d) => d.id);
  return [...ids, 'ending1', 'ending2'];
}

function trimFloor(f: BotFloor): BalanceFloor {
  return {
    floor: f.floor,
    track: f.track,
    chapter: f.chapter,
    hurt: f.hurt,
    fights: f.fights.map((t) => Math.round(t * 100) / 100),
    boss: f.boss,
    bossHp: f.bossHp,
    bossSeconds: Math.round(f.bossSeconds * 100) / 100,
    bossBy: f.bossKilledBy,
    items: f.pedestalItems,
    itemsBy: f.itemsBy,
    coins: f.coins,
    keys: f.keys,
    bombs: f.bombs,
    coinsIn: f.coinsIn,
    keysIn: f.keysIn,
    bombsIn: f.bombsIn,
    spawned: f.spawned,
    champions: f.champions,
    shop: f.shop,
    died: f.died,
    lance: f.held.includes('storm-lance'),
  };
}

/** Plays one harness run. */
export function playBalanceRun(ch: CharacterDef, index: number, cfg: BalanceConfig): BalanceRun {
  const seed = `balance-${cfg.track}-${ch.id}-${index}`;
  const unlocked = cfg.save === 'unlocked' ? unlockAll() : [];
  const t0 = performance.now();
  // No hidden-route grates: the run stays on its track (a player could take them; the harness measures the track).
  const sim = Sim.newRun(seed, { track: cfg.track, unlocked, hiddenRouteChance: 0, startRouteChance: 0 }, ch);
  const report = playRun(sim, { untilFloor: cfg.until, human: true, roomLimit: 90, bossLimit: 240, maxTicks: 2_500_000 });
  const d = sim.run!.data;
  return {
    char: ch.id,
    seed,
    save: cfg.save,
    won: !!d.won,
    deathFloor: report.died ? report.deathFloor : 0,
    killer: report.killer,
    killedBy: report.killedBy,
    floors: report.floors.map(trimFloor),
    problems: report.problems.slice(0, 5),
    notes: report.notes.slice(0, 12),
    fallbacks: report.fightFallbacks + report.bossFallbacks,
    teleports: report.teleports,
    ticks: report.ticks,
    ms: Math.round(performance.now() - t0),
  };
}

export function resultFile(cfg: BalanceConfig, char: string): string {
  return join(RESULTS_DIR, `${cfg.save}-${cfg.track}-${char}.json`);
}

export function writeResults(cfg: BalanceConfig, char: string, runs: BalanceRun[]): void {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(resultFile(cfg, char), JSON.stringify(runs));
}

/** Removes a previous run's per-character files (the report must only read this run's). */
export function clearResults(): void {
  try {
    for (const f of readdirSync(RESULTS_DIR)) if (f.endsWith('.json') && !f.startsWith('summary')) rmSync(join(RESULTS_DIR, f));
  } catch {
    // no folder yet
  }
}

export function readResults(): BalanceRun[] {
  const out: BalanceRun[] = [];
  try {
    for (const f of readdirSync(RESULTS_DIR)) {
      if (!f.endsWith('.json') || f.startsWith('summary')) continue;
      out.push(...(JSON.parse(readFileSync(join(RESULTS_DIR, f), 'utf8')) as BalanceRun[]));
    }
  } catch {
    // nothing
  }
  return out;
}

// ── The report ────────────────────────────────────────────────────────────────

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

function pct(n: number, d: number): string {
  return d > 0 ? `${((100 * n) / d).toFixed(0)}%` : '-';
}

function f1(x: number): string {
  return Number.isFinite(x) ? x.toFixed(1) : '-';
}

function pad(s: string | number, n: number): string {
  const t = String(s);
  return t.length >= n ? t : ' '.repeat(n - t.length) + t;
}

/** The numbers the balance targets are checked against (also written as summary JSON). */
export interface BalanceSummary {
  runs: number;
  winRate: number;
  byChar: Record<string, { runs: number; wins: number; floor1Deaths: number }>;
  deathsByFloor: number[];
  deathsAfter4: number;
  medianBoss: number[];
  medianFight: number[];
  items: number[];
  enemyHurt: number[];
  coinsAt99Floor12: number;
  keysFloor12: number;
  shopEntered: number[];
  lanceBy4: number;
  championRate: number[];
}

/** Summarises the runs (one save / track) and returns the printable report. */
export function balanceReport(runs: BalanceRun[]): { text: string; summary: BalanceSummary } {
  const lines: string[] = [];
  const n = runs.length;
  const wins = runs.filter((r) => r.won).length;
  const save = runs[0]?.save ?? '?';
  const ms = runs.reduce((a, r) => a + r.ms, 0);
  lines.push(`BALANCE HARNESS — ${n} runs (${save} save), ${wins} won (${pct(wins, n)}); ${(ms / 1000).toFixed(0)} s of bot time`);
  const probs = runs.filter((r) => r.problems.length > 0);
  if (probs.length) lines.push(`  runs with problems: ${probs.length} — e.g. ${probs[0]!.char} ${probs[0]!.seed}: ${probs[0]!.problems[0]}`);
  if (process.env.BALANCE_VERBOSE) for (const r of runs) for (const t of [...r.problems, ...r.notes]) lines.push(`  ${r.char} ${r.seed}: ${t}`);
  const fb = runs.reduce((a, r) => a + r.fallbacks, 0);
  const tp = runs.reduce((a, r) => a + r.teleports, 0);
  lines.push(`  fight time-outs finished by the fallback: ${fb}; teleport fallbacks: ${tp}`);

  // Per character.
  const byChar: BalanceSummary['byChar'] = {};
  for (const r of runs) {
    const c = (byChar[r.char] ??= { runs: 0, wins: 0, floor1Deaths: 0 });
    c.runs++;
    if (r.won) c.wins++;
    if (r.deathFloor === 1) c.floor1Deaths++;
  }
  lines.push('', 'WIN RATE BY CHARACTER            runs  wins  win%  died on floor 1');
  for (const [id, c] of Object.entries(byChar)) {
    lines.push(`  ${id.padEnd(30)}${pad(c.runs, 5)}${pad(c.wins, 6)}${pad(pct(c.wins, c.runs), 6)}${pad(pct(c.floor1Deaths, c.runs), 9)}`);
  }

  // Deaths by floor and killers.
  const maxFloor = 13;
  const deaths = new Array<number>(maxFloor + 1).fill(0);
  for (const r of runs) if (r.deathFloor > 0) deaths[r.deathFloor]!++;
  const died = runs.filter((r) => r.deathFloor > 0).length;
  lines.push('', `DEATHS BY FLOOR (${died} of ${n} runs died)`);
  lines.push(`  ${deaths.slice(1).map((d, i) => `F${i + 1}:${d} (${pct(d, n)})`).join('  ')}`);
  const after4 = runs.filter((r) => r.deathFloor > 4).length;
  lines.push(`  deaths after floor 4: ${after4} (${pct(after4, n)} of runs)`);
  const killers = new Map<string, number>();
  for (const r of runs) if (r.deathFloor > 0) killers.set(r.killer || `source ${r.killedBy}`, (killers.get(r.killer || `source ${r.killedBy}`) ?? 0) + 1);
  lines.push(`  killers: ${[...killers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}`);

  // Per floor tables.
  const floors: BalanceFloor[][] = [];
  for (const r of runs) for (const f of r.floors) (floors[f.floor] ??= []).push(f);
  lines.push('', 'PER FLOOR (means over the runs that played the floor; fights = median seconds)');
  lines.push(
    '  floor  runs  | hurt: enemy  boss spikes fire blast toll other | fight  boss  bossDPS | items | coins keys bombs  (in: c  k  b) @99 | champ%  shop%',
  );
  const medianBoss: number[] = [];
  const medianFight: number[] = [];
  const items: number[] = [];
  const enemyHurt: number[] = [];
  const shopEntered: number[] = [];
  const championRate: number[] = [];
  let coinsAt99Floor12 = NaN;
  let keysFloor12 = NaN;
  for (let fl = 1; fl <= maxFloor; fl++) {
    const fs = floors[fl];
    if (!fs || fs.length === 0) continue;
    const hurt = HURT_SOURCES.map((_, i) => mean(fs.map((f) => f.hurt[i] ?? 0)));
    const fights = fs.flatMap((f) => f.fights);
    const bosses = fs.filter((f) => f.bossHp > 0 && f.bossSeconds > 0 && f.bossBy === 'fight');
    const bossT = median(bosses.map((f) => f.bossSeconds));
    const dps = median(bosses.map((f) => f.bossHp / f.bossSeconds));
    const done = fs.filter((f) => !f.died);
    const it = mean(done.map((f) => f.items));
    const coins = mean(done.map((f) => f.coins));
    const keys = mean(done.map((f) => f.keys));
    const bombs = mean(done.map((f) => f.bombs));
    const cin = mean(fs.map((f) => f.coinsIn));
    const kin = mean(fs.map((f) => f.keysIn));
    const bin = mean(fs.map((f) => f.bombsIn));
    const at99 = done.filter((f) => f.coins >= 99).length;
    const spawned = fs.reduce((a, f) => a + f.spawned, 0);
    const champs = fs.reduce((a, f) => a + f.champions, 0);
    const shops = fs.filter((f) => f.shop).length;
    medianBoss[fl] = bossT;
    medianFight[fl] = median(fights);
    items[fl] = it;
    enemyHurt[fl] = (hurt[0] ?? 0) + (hurt[1] ?? 0);
    shopEntered[fl] = fs.length ? shops / fs.length : NaN;
    championRate[fl] = spawned ? champs / spawned : NaN;
    if (fl === 12) {
      coinsAt99Floor12 = done.length ? at99 / done.length : NaN;
      keysFloor12 = keys;
    }
    lines.push(
      `  ${pad(fl, 5)} ${pad(fs.length, 5)}  |      ${hurt.map((h) => pad(f1(h), 5)).join(' ')} | ${pad(f1(median(fights)), 5)} ${pad(f1(bossT), 5)} ${pad(f1(dps), 8)} | ${pad(f1(it), 5)} | ${pad(f1(coins), 5)} ${pad(f1(keys), 4)} ${pad(f1(bombs), 5)}  (${pad(f1(cin), 4)} ${pad(f1(kin), 3)} ${pad(f1(bin), 3)}) ${pad(pct(at99, done.length), 4)} | ${pad(pct(champs, spawned), 5)} ${pad(pct(shops, fs.length), 6)}`,
    );
  }
  const lanceRuns = runs.filter((r) => r.floors.some((f) => f.floor <= 4 && f.lance)).length;
  const first = floors[1]?.filter((f) => !f.died) ?? [];
  const keyed = first.filter((f) => f.keys >= 1).length;
  lines.push('', `Floor 1 ended with a key for the floor-2 shop: ${keyed} of ${first.length} (${pct(keyed, first.length)})`);
  lines.push(`Storm Lance held by the end of floor 4: ${lanceRuns} of ${n} runs (${pct(lanceRuns, n)})`);
  const by = new Map<string, number>();
  let played = 0;
  for (const r of runs) {
    for (const f of r.floors) {
      played++;
      for (const [k, v] of Object.entries(f.itemsBy ?? {})) by.set(k, (by.get(k) ?? 0) + v);
    }
  }
  lines.push(`Pedestal items per floor by room: ${[...by.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / Math.max(1, played)).toFixed(2)}`).join(', ')}`);
  const totalItems = runs.map((r) => r.floors.reduce((a, f) => a + f.items, 0));
  lines.push(`Pedestal items per run: median ${f1(median(totalItems))}; per floor (all floors played) ${f1(mean(runs.flatMap((r) => r.floors.map((f) => f.items))))}`);
  const summary: BalanceSummary = {
    runs: n,
    winRate: n ? wins / n : 0,
    byChar,
    deathsByFloor: deaths,
    deathsAfter4: n ? after4 / n : 0,
    medianBoss,
    medianFight,
    items,
    enemyHurt,
    coinsAt99Floor12,
    keysFloor12,
    shopEntered,
    lanceBy4: n ? lanceRuns / n : 0,
    championRate,
  };
  return { text: lines.join('\n'), summary };
}
