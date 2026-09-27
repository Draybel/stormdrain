/**
 * Meta progression (`stormdrain.meta`, ARCHITECTURE §7): settings, unlocks, achievements,
 * collection, bestiary and lifetime stats — the data that outlives runs.
 *
 * - {@link MetaState} is the in-memory shape (unlock lists are `Set`s); {@link serializeMeta} /
 *   {@link normalizeMeta} convert to/from the JSON stored in the envelope (sets as sorted arrays).
 * - {@link normalizeMeta} accepts anything (old, partial, hand-edited) and returns a valid state:
 *   defaults fill gaps, numbers are clamped, junk entries dropped, UNKNOWN fields kept (root keys
 *   in `extra`, nested keys ride along on their objects) and written back on the next save.
 * - {@link MetaStore} owns the state: mutators mark it dirty, `endTick()` saves (urgent changes at
 *   the end of the tick, soft ones like kill counts at most every `softSaveMs`), `flush()` saves
 *   now, `subscribe()` notifies UI once per tick with a summary of what changed.
 *
 * No DOM access; storage comes in through {@link SaveStorage}.
 */

import { META_MIGRATIONS } from './migrations';
import { isRecord } from './saveCodec';
import { SaveSlot, type SaveStorage, type SlotLoad } from './storage';

export const META_KEY = 'stormdrain.meta';

// ── Schema (v1) ─────────────────────────────────────────────────────────────

export interface MetaSettings {
  /** 0..1 */
  masterVol: number;
  musicVol: number;
  sfxVol: number;
  /** Free 360° aim on the shoot stick instead of 4-way snapping. */
  aim360: boolean;
  /** Screen-shake multiplier 0..1 (0 = off). */
  screenShake: number;
  /** On-screen button size multiplier 0.5..2. */
  buttonScale: number;
  showFps: boolean;
  /** Mirror the touch layout (move stick on the right, shoot stick on the left). */
  leftHanded: boolean;
}

export const UNLOCK_KINDS = ['characters', 'items', 'routes', 'endings', 'challenges'] as const;
export type UnlockKind = (typeof UNLOCK_KINDS)[number];
/** Known kinds always exist; kinds written by newer builds (arrays of ids) are kept too. */
export type UnlockSets = Record<UnlockKind, Set<string>> & { [kind: string]: Set<string> };

export interface CollectionEntry {
  /** Times the item was seen (pedestal, shop, pickup banner). Discovered = seen > 0. */
  seen: number;
  collected: number;
}

export interface BestiaryEntry {
  seen: number;
  killed: number;
}

/** One entry per UTC date: the daily run is a single attempt per day. */
export interface DailyResult {
  seed: string;
  character: string;
  won: boolean;
  /** Deepest floor reached (1-based). */
  floor: number;
  kills: number;
  timeSec: number;
  score: number;
  /** Epoch ms when recorded. */
  at: number;
  /**
   * Phase 4B: false while the day's attempt is still being played (it is claimed when the daily run starts,
   * updated as it goes and finished at death / victory); absent on older entries (= done).
   */
  done?: boolean;
}

export const STAT_KEYS = [
  'runs',
  'wins',
  'deaths',
  'kills',
  'bossKills',
  'itemsCollected',
  'floorsCleared',
  'playTimeSec',
  'bestFloor',
  'winStreak',
  'bestWinStreak',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];

/**
 * Counters read by achievements. Any string id works (`bump('myNewCounter')`); the listed ones
 * always exist (default 0) so UI can show them. `max*` counters hold a record, not a sum:
 * update them with `maxCounter`.
 */
export const COUNTER_IDS = [
  'activesUsed',
  'bombsUsed',
  'coinsSpent',
  'coinsCollected',
  'maxCoinsHeld',
  'maxFamiliars',
  'maxItemsHeld',
  'damageTakenFloors',
  'noDamageFloors',
  'secretsFound',
  'deepSecretsFound',
  'chestsOpened',
  'keysUsed',
  'itemsBought',
  'tonicsDrunk',
  'stickersUsed',
  'trinketsFound',
  'donations',
  'slotPlays',
  'brokerDeals',
  'altRoutesTaken',
  'challengeRoomsCleared',
  'cursedRoomsEntered',
  'minibossKills',
  'transformations',
  'synergiesFound',
  'tinHeartsGained',
  'emberNovas',
  'shopsDestroyed',
  'consumablesUsed',
  'trades',
] as const;
export type CounterId = (typeof COUNTER_IDS)[number];

export type LifetimeStats = Record<StatKey, number> & {
  /** UTC date `YYYY-MM-DD` → result. Pruned to the newest {@link DAILY_KEEP} days. */
  daily: Record<string, DailyResult>;
  /** Character id → wins / runs started. */
  charWins: Record<string, number>;
  charRuns: Record<string, number>;
  counters: Record<string, number>;
};

export interface MetaState {
  settings: MetaSettings;
  unlocks: UnlockSets;
  /** Achievement id → unlock time (epoch ms; 0 = unknown, e.g. migrated from v0). */
  achievements: Record<string, number>;
  /** Item id → counts. */
  collection: Record<string, CollectionEntry>;
  /** Enemy/boss id → counts. */
  bestiary: Record<string, BestiaryEntry>;
  stats: LifetimeStats;
  /** Unknown top-level fields from the save (newer/parallel builds); written back untouched. */
  extra: Record<string, unknown>;
}

/** JSON shape stored inside the `stormdrain.meta` envelope (v1). */
export interface MetaDataV1 {
  settings: MetaSettings;
  unlocks: Record<string, string[]>;
  achievements: Record<string, number>;
  collection: Record<string, CollectionEntry>;
  bestiary: Record<string, BestiaryEntry>;
  stats: LifetimeStats;
  [unknownField: string]: unknown;
}

export const DAILY_KEEP = 400;
const MAX_COUNT = 1e12;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const ROOT_KEYS = new Set(['settings', 'unlocks', 'achievements', 'collection', 'bestiary', 'stats']);

export const SETTINGS_RANGE = {
  masterVol: [0, 1],
  musicVol: [0, 1],
  sfxVol: [0, 1],
  screenShake: [0, 1],
  buttonScale: [0.5, 2],
} as const satisfies Partial<Record<keyof MetaSettings, readonly [number, number]>>;

export function defaultMetaSettings(): MetaSettings {
  return {
    masterVol: 0.8,
    musicVol: 0.7,
    sfxVol: 0.9,
    aim360: false,
    screenShake: 1,
    buttonScale: 1,
    showFps: false,
    leftHanded: false,
  };
}

export function defaultMeta(): MetaState {
  const unlocks = dict<Set<string>>() as UnlockSets;
  for (const k of UNLOCK_KINDS) unlocks[k] = new Set<string>();
  unlocks.characters.add('wren'); // the starting character is always available
  const stats = { daily: dict(), charWins: dict(), charRuns: dict(), counters: dict() } as LifetimeStats;
  for (const k of STAT_KEYS) stats[k] = 0;
  for (const c of COUNTER_IDS) stats.counters[c] = 0;
  return {
    settings: defaultMetaSettings(),
    unlocks,
    achievements: dict(),
    collection: dict(),
    bestiary: dict(),
    stats,
    extra: dict(),
  };
}

// ── Normalize / serialize ───────────────────────────────────────────────────

/** Null-prototype record: ids like `__proto__` or `constructor` are just keys. */
function dict<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

function num(v: unknown, def: number, min: number, max: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def;
}

function count(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(MAX_COUNT, Math.floor(v)) : 0;
}

function bool(v: unknown, def: boolean): boolean {
  return typeof v === 'boolean' ? v : def;
}

function rec(v: unknown): Record<string, unknown> {
  return isRecord(v) ? v : {};
}

function countDict(v: unknown): Record<string, number> {
  const out = dict<number>();
  for (const [k, x] of Object.entries(rec(v))) {
    const n = count(x);
    if (n > 0) out[k] = n;
  }
  return out;
}

export function normalizeSettings(v: unknown): MetaSettings {
  const s = rec(v);
  const d = defaultMetaSettings();
  const R = SETTINGS_RANGE;
  return {
    ...s, // unknown settings from newer builds ride along
    masterVol: num(s.masterVol, d.masterVol, R.masterVol[0], R.masterVol[1]),
    musicVol: num(s.musicVol, d.musicVol, R.musicVol[0], R.musicVol[1]),
    sfxVol: num(s.sfxVol, d.sfxVol, R.sfxVol[0], R.sfxVol[1]),
    aim360: bool(s.aim360, d.aim360),
    screenShake: num(s.screenShake, d.screenShake, R.screenShake[0], R.screenShake[1]),
    buttonScale: num(s.buttonScale, d.buttonScale, R.buttonScale[0], R.buttonScale[1]),
    showFps: bool(s.showFps, d.showFps),
    leftHanded: bool(s.leftHanded, d.leftHanded),
  };
}

function normalizeDaily(v: unknown): DailyResult | null {
  if (!isRecord(v)) return null;
  return {
    ...v,
    seed: typeof v.seed === 'string' ? v.seed : typeof v.seed === 'number' ? String(v.seed) : '',
    character: typeof v.character === 'string' ? v.character : 'wren',
    won: bool(v.won, false),
    floor: count(v.floor),
    kills: count(v.kills),
    timeSec: num(v.timeSec, 0, 0, MAX_COUNT),
    score: num(v.score, 0, -MAX_COUNT, MAX_COUNT),
    at: num(v.at, 0, 0, MAX_COUNT * 1000),
    ...(v.done === false ? { done: false } : {}),
  };
}

/** Anything → a valid MetaState (never throws). */
export function normalizeMeta(raw: unknown): MetaState {
  const r = rec(raw);
  const m = defaultMeta();

  for (const [k, v] of Object.entries(r)) if (!ROOT_KEYS.has(k)) m.extra[k] = v;

  m.settings = normalizeSettings(r.settings);

  for (const [kind, list] of Object.entries(rec(r.unlocks))) {
    if (!Array.isArray(list)) continue;
    const set = m.unlocks[kind] ?? (m.unlocks[kind] = new Set<string>());
    for (const id of list) if (typeof id === 'string' && id.length > 0) set.add(id);
  }

  for (const [id, t] of Object.entries(rec(r.achievements))) {
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) m.achievements[id] = t;
    else if (t === true) m.achievements[id] = 0;
  }

  for (const [id, e] of Object.entries(rec(r.collection))) {
    if (!isRecord(e)) continue;
    const collected = count(e.collected);
    m.collection[id] = { ...e, seen: Math.max(count(e.seen), collected), collected };
  }

  for (const [id, e] of Object.entries(rec(r.bestiary))) {
    if (!isRecord(e)) continue;
    const killed = count(e.killed);
    m.bestiary[id] = { ...e, seen: Math.max(count(e.seen), killed), killed };
  }

  const st = rec(r.stats);
  const stats = m.stats;
  for (const [k, v] of Object.entries(st)) {
    if (!(k in stats)) (stats as Record<string, unknown>)[k] = v; // unknown stats ride along
  }
  for (const k of STAT_KEYS) stats[k] = k === 'playTimeSec' ? num(st[k], 0, 0, MAX_COUNT) : count(st[k]);
  stats.bestWinStreak = Math.max(stats.bestWinStreak, stats.winStreak);
  for (const [date, v] of Object.entries(rec(st.daily))) {
    const d = DATE_KEY.test(date) ? normalizeDaily(v) : null;
    if (d) stats.daily[date] = d;
  }
  stats.charWins = countDict(st.charWins);
  stats.charRuns = countDict(st.charRuns);
  const counters = countDict(st.counters);
  for (const c of COUNTER_IDS) counters[c] ??= 0;
  stats.counters = counters;

  return m;
}

/** MetaState → the JSON stored in the envelope. Deterministic (sorted unlock lists). */
export function serializeMeta(m: MetaState): MetaDataV1 {
  const unlocks = dict<string[]>();
  for (const [kind, set] of Object.entries(m.unlocks)) unlocks[kind] = [...set].sort();
  return {
    ...m.extra,
    settings: m.settings,
    unlocks,
    achievements: m.achievements,
    collection: m.collection,
    bestiary: m.bestiary,
    stats: m.stats,
  };
}

/** Deep copy through the serialized form (for import previews, tests, undo). */
export function cloneMeta(m: MetaState): MetaState {
  return normalizeMeta(JSON.parse(JSON.stringify(serializeMeta(m))));
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** UTC calendar date `YYYY-MM-DD` (the daily run's key). */
export function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * The Phase-1 runtime settings shape (`src/meta/settings.ts` `Settings`), without importing it
 * so the two can evolve independently: `settingsStore.update(toRuntimeSettings(meta.settings))`.
 */
export interface RuntimeSettingsLike {
  aim360: boolean;
  buttonScale: number;
  shake: number;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  leftHanded: boolean;
  showFps: boolean;
}

export function toRuntimeSettings(s: MetaSettings): RuntimeSettingsLike {
  return {
    aim360: s.aim360,
    buttonScale: s.buttonScale,
    shake: s.screenShake,
    masterVolume: s.masterVol,
    musicVolume: s.musicVol,
    sfxVolume: s.sfxVol,
    leftHanded: s.leftHanded,
    showFps: s.showFps,
  };
}

export function fromRuntimeSettings(r: Partial<RuntimeSettingsLike>): Partial<MetaSettings> {
  const p: Partial<MetaSettings> = {};
  if (r.aim360 !== undefined) p.aim360 = r.aim360;
  if (r.buttonScale !== undefined) p.buttonScale = r.buttonScale;
  if (r.shake !== undefined) p.screenShake = r.shake;
  if (r.masterVolume !== undefined) p.masterVol = r.masterVolume;
  if (r.musicVolume !== undefined) p.musicVol = r.musicVolume;
  if (r.sfxVolume !== undefined) p.sfxVol = r.sfxVolume;
  if (r.leftHanded !== undefined) p.leftHanded = r.leftHanded;
  if (r.showFps !== undefined) p.showFps = r.showFps;
  return p;
}

// ── Store ───────────────────────────────────────────────────────────────────

export interface MetaStoreOptions {
  storage: SaveStorage;
  key?: string;
  /** Clock in epoch ms (achievement timestamps, save throttling). Default `Date.now`. */
  now?: () => number;
  /** Soft changes (stats, collection, bestiary, play time) are written at most this often. Default 5000. */
  softSaveMs?: number;
  /** After a failed write, wait this long before trying again. Default 10000. */
  retryMs?: number;
}

/** What changed since the previous notification. The object is reused: copy what you keep. */
export interface MetaChange {
  settings: boolean;
  /** `kind:id` of things unlocked this tick, e.g. `characters:pip`. */
  unlocked: string[];
  /** Achievement ids unlocked this tick (achievement toasts). */
  achievements: string[];
  /** Anything else (stats, collection, bestiary, daily, reset, import). */
  other: boolean;
}

export type MetaListener = (state: Readonly<MetaState>, change: Readonly<MetaChange>) => void;

export interface RunEndSummary {
  character: string;
  outcome: 'win' | 'death' | 'quit';
  /** Deepest floor reached (1-based). */
  floor: number;
}

export class MetaStore {
  /** Result of the initial load: show a notice when `restored`, `corrupt` or `future`. */
  readonly loaded: SlotLoad;
  /** Successful writes so far (diagnostics/tests). */
  saves = 0;
  /** Last write failure (quota, read-only...), null after a successful write. */
  lastError: string | null = null;

  private meta: MetaState;
  private readonly slot: SaveSlot;
  private readonly now: () => number;
  private readonly softSaveMs: number;
  private readonly retryMs: number;
  private dirtyFlag = false;
  private urgentFlag = false;
  private lastSaveAt = -Infinity;
  private retryAt = -Infinity;
  private changed = false;
  private readonly change: MetaChange = { settings: false, unlocked: [], achievements: [], other: false };
  private readonly listeners = new Set<MetaListener>();

  constructor(opts: MetaStoreOptions) {
    this.slot = new SaveSlot(opts.storage, opts.key ?? META_KEY, META_MIGRATIONS);
    this.now = opts.now ?? Date.now;
    this.softSaveMs = opts.softSaveMs ?? 5000;
    this.retryMs = opts.retryMs ?? 10000;
    this.loaded = this.slot.load();
    this.meta = this.loaded.data === null ? defaultMeta() : normalizeMeta(this.loaded.data);
    // Write the repaired / upgraded state back at the end of the first tick: a damaged save starting fresh
    // (its text is kept as `.corrupt`) must not greet the player again on every launch, and an older
    // version is stored in the current format once (the old text becomes the `.bak`).
    const st = this.loaded.status;
    if (st === 'corrupt' || (st === 'ok' && this.loaded.migratedFrom !== null && this.loaded.migratedFrom < META_MIGRATIONS.current)) {
      this.touch(true, true);
    }
  }

  /** The live state. Prefer the mutators; after editing it directly call `markDirty()`. */
  get state(): MetaState {
    return this.meta;
  }

  get settings(): Readonly<MetaSettings> {
    return this.meta.settings;
  }

  get dirty(): boolean {
    return this.dirtyFlag;
  }

  /** False when progress cannot be kept (in-memory fallback storage or a newer build's save). */
  get persistent(): boolean {
    return this.slot.storage.persistent && !this.slot.readOnly;
  }

  // ── Mutators ──

  /** Apply a settings patch (values are clamped). Returns true if anything changed. */
  updateSettings(patch: Partial<MetaSettings>): boolean {
    const merged: Record<string, unknown> = { ...this.meta.settings };
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) merged[k] = v;
    const next = normalizeSettings(merged);
    let diff = false;
    for (const k of Object.keys(patch) as (keyof MetaSettings)[]) {
      if (next[k] !== this.meta.settings[k]) diff = true;
    }
    if (!diff) return false;
    this.meta.settings = next;
    this.change.settings = true;
    this.touch(true, false);
    return true;
  }

  /** `kind`: a known UnlockKind, or any other kind (kept as its own set, e.g. 'chapters'). */
  isUnlocked(kind: UnlockKind | (string & {}), id: string): boolean {
    return this.meta.unlocks[kind]?.has(id) ?? false;
  }

  /** Returns true when newly unlocked. Unknown kinds get their own set (saved like the known ones). */
  unlock(kind: UnlockKind | (string & {}), id: string): boolean {
    const set = this.meta.unlocks[kind] ?? (this.meta.unlocks[kind] = new Set<string>());
    if (!id || set.has(id)) return false;
    set.add(id);
    this.change.unlocked.push(`${kind}:${id}`);
    this.touch(true, false);
    return true;
  }

  hasAchievement(id: string): boolean {
    return id in this.meta.achievements;
  }

  /** Returns true when newly unlocked (show the toast). */
  unlockAchievement(id: string): boolean {
    if (!id || id in this.meta.achievements) return false;
    this.meta.achievements[id] = this.now();
    this.change.achievements.push(id);
    this.touch(true, false);
    return true;
  }

  /** An item was shown (pedestal, shop, banner). */
  seeItem(id: string): void {
    const e = (this.meta.collection[id] ??= { seen: 0, collected: 0 });
    e.seen++;
    this.touch(false);
  }

  /** An item was picked up. Also counts toward `stats.itemsCollected`. */
  collectItem(id: string): void {
    const e = (this.meta.collection[id] ??= { seen: 0, collected: 0 });
    e.collected++;
    if (e.seen < e.collected) e.seen = e.collected;
    this.meta.stats.itemsCollected++;
    this.touch(false);
  }

  isDiscovered(itemId: string): boolean {
    return (this.meta.collection[itemId]?.seen ?? 0) > 0;
  }

  seeEnemy(id: string): void {
    const e = (this.meta.bestiary[id] ??= { seen: 0, killed: 0 });
    e.seen++;
    this.touch(false);
  }

  /** An enemy/boss died. Also counts toward `stats.kills` (+ `bossKills` when `boss`). */
  killEnemy(id: string, boss = false): void {
    const e = (this.meta.bestiary[id] ??= { seen: 0, killed: 0 });
    e.killed++;
    if (e.seen < e.killed) e.seen = e.killed;
    this.meta.stats.kills++;
    if (boss) this.meta.stats.bossKills++;
    this.touch(false);
  }

  addStat(key: StatKey, n = 1): void {
    this.meta.stats[key] += n;
    if (this.meta.stats[key] < 0) this.meta.stats[key] = 0;
    this.touch(false);
  }

  /** Keep the record: `stat = max(stat, value)`. */
  maxStat(key: StatKey, value: number): void {
    if (value > this.meta.stats[key]) {
      this.meta.stats[key] = value;
      this.touch(false);
    }
  }

  counter(id: CounterId | (string & {})): number {
    return this.meta.stats.counters[id] ?? 0;
  }

  bump(id: CounterId | (string & {}), n = 1): void {
    const c = this.meta.stats.counters;
    c[id] = Math.max(0, (c[id] ?? 0) + n);
    this.touch(false);
  }

  /** For record counters (`maxCoinsHeld`, `maxFamiliars`...): keeps the highest value seen. */
  maxCounter(id: CounterId | (string & {}), value: number): void {
    const c = this.meta.stats.counters;
    if (value > (c[id] ?? 0)) {
      c[id] = value;
      this.touch(false);
    }
  }

  addPlayTime(sec: number): void {
    if (!(sec > 0) || !Number.isFinite(sec)) return;
    this.meta.stats.playTimeSec += sec;
    this.touch(false);
  }

  recordRunStart(character: string): void {
    this.meta.stats.runs++;
    const r = this.meta.stats.charRuns;
    r[character] = (r[character] ?? 0) + 1;
    this.touch(true);
  }

  /** Win/death/quit bookkeeping (streaks, per-character wins, best floor). */
  recordRunEnd(s: RunEndSummary): void {
    const st = this.meta.stats;
    if (s.outcome === 'win') {
      st.wins++;
      st.winStreak++;
      st.bestWinStreak = Math.max(st.bestWinStreak, st.winStreak);
      st.charWins[s.character] = (st.charWins[s.character] ?? 0) + 1;
    } else {
      if (s.outcome === 'death') st.deaths++;
      st.winStreak = 0;
    }
    st.bestFloor = Math.max(st.bestFloor, count(s.floor));
    this.touch(true);
  }

  hasDaily(date: string): boolean {
    return date in this.meta.stats.daily;
  }

  /** One attempt per UTC day: returns false (and changes nothing) if `date` is already recorded. */
  recordDaily(date: string, result: Omit<DailyResult, 'at'> & { at?: number }): boolean {
    if (!DATE_KEY.test(date) || this.hasDaily(date)) return false;
    const daily = this.meta.stats.daily;
    daily[date] = normalizeDaily({ ...result, at: result.at ?? this.now() })!;
    const dates = Object.keys(daily);
    if (dates.length > DAILY_KEEP) {
      dates.sort();
      for (let i = 0; i < dates.length - DAILY_KEEP; i++) delete daily[dates[i]!];
    }
    this.touch(true);
    return true;
  }

  /**
   * Updates the day's recorded attempt (the daily run in progress, then its final result). Only an existing
   * entry changes (the attempt was claimed by `recordDaily` when it started); its `at` is kept.
   */
  updateDaily(date: string, patch: Partial<Omit<DailyResult, 'at'>>): boolean {
    const cur = this.meta.stats.daily[date];
    if (!cur) return false;
    const next = normalizeDaily({ ...cur, ...patch, at: cur.at })!;
    if (patch.done === true) delete next.done;
    this.meta.stats.daily[date] = next;
    this.touch(true);
    return true;
  }

  /** Wipe progress (unlocks, achievements, collection, bestiary, stats); settings stay. */
  resetProgress(): void {
    const settings = this.meta.settings;
    this.meta = defaultMeta();
    this.meta.settings = settings;
    this.change.other = true;
    this.touch(true);
  }

  /** Replace everything (save import). Saved at the end of the tick; call `flush()` to save now. */
  replaceState(next: MetaState): void {
    this.meta = next;
    this.change.settings = true;
    this.change.other = true;
    this.touch(true);
  }

  /** For code that edited `state` directly. `urgent` = save at the end of this tick. */
  markDirty(urgent = false): void {
    this.touch(urgent);
  }

  // ── Saving & notifications ──

  /**
   * Call once per update (end of the loop tick). Notifies subscribers if anything changed, then
   * saves: urgent changes (settings, unlocks, achievements, run start/end, daily, import) right
   * away; soft changes at most every `softSaveMs`.
   */
  endTick(): void {
    if (this.changed) this.notify();
    if (!this.dirtyFlag) return;
    const t = this.now();
    if (t < this.retryAt) return;
    if (this.urgentFlag || t - this.lastSaveAt >= this.softSaveMs) this.save(t);
  }

  /** Save now if anything is pending (room transitions, pause, going to the background). */
  flush(): boolean {
    if (this.changed) this.notify();
    if (!this.dirtyFlag) return this.lastError === null;
    return this.save(this.now());
  }

  /** `fn(state, change)` after each tick with changes. Returns an unsubscribe function. */
  subscribe(fn: MetaListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Mark dirty. `other` = report it as `change.other` (settings/unlock/achievement report themselves). */
  private touch(urgent: boolean, other = true): void {
    this.dirtyFlag = true;
    if (urgent) this.urgentFlag = true;
    if (other) this.change.other = true;
    this.changed = true;
  }

  private save(t: number): boolean {
    const r = this.slot.write(serializeMeta(this.meta));
    if (r.ok) {
      if (!r.skipped) this.saves++;
      this.dirtyFlag = false;
      this.urgentFlag = false;
      this.lastSaveAt = t;
      this.retryAt = -Infinity;
      this.lastError = null;
      return true;
    }
    this.lastError = r.message;
    if (r.error === 'readonly' || r.error === 'unserializable') {
      // Retrying cannot help; keep playing in memory.
      this.dirtyFlag = false;
      this.urgentFlag = false;
      this.retryAt = Infinity;
    } else {
      this.retryAt = t + this.retryMs;
    }
    return false;
  }

  private notify(): void {
    this.changed = false;
    const c = this.change;
    for (const fn of this.listeners) {
      try {
        fn(this.meta, c);
      } catch (err) {
        console.error('meta listener failed', err);
      }
    }
    c.settings = false;
    c.other = false;
    c.unlocked.length = 0;
    c.achievements.length = 0;
  }
}
