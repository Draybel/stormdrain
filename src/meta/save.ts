/**
 * The game's save service (ARCHITECTURE §7, docs/saving.md): one place that owns the storage, the meta
 * progress (MetaStore), the run save (RunSaveStore), the achievements and the meta tracker.
 *
 * - META saves itself: important changes (settings, unlocks, achievements, run start / end) at the end of
 *   the tick, frequent ones (kills, collection, play time) at most every 5 s — `endTick()` once per loop
 *   tick; `saveRunNow()` / `flush()` write at once (background, pause, room transitions).
 * - The RUN save is `Sim.snapshot()` (the run as it was when the player entered the current room),
 *   written on every room transition, on pause and when the page is hidden (`saveRunNow()`; the host
 *   says which run may be saved — a floor run in progress, never the yard, never a finished run), and
 *   cleared when the run ends (death, victory) or is abandoned (a New Run over it).
 * - `loadRun()` for Continue: the snapshot (migrated; the previous room's copy when the latest save is
 *   damaged) or a plain-language reason it can't be continued.
 *
 * DOM-free apart from what `createStorage()` probes; tests pass a MemoryStorage.
 */

import type { Sim } from '../sim/sim';
import { RUN_SNAPSHOT_VERSION, type RunSnapshot } from '../sim/run/types';
import { AchievementEngine } from './achievements';
import { MetaStore } from './metaState';
import type { Migration } from './migrations';
import { RunSaveStore } from './runSave';
import { createStorage, type SaveStorage } from './storage';
import { MetaTracker } from './tracker';
import { runUnlocks } from './unlocks';

/**
 * Run snapshot migrations: `steps[v]` upgrades a snapshot from version v to v + 1 (sim/run/types
 * RUN_SNAPSHOT_VERSION). None yet: v2 is the first version ever saved; an older / unknown one loads as
 * damaged, and Continue explains it (meta progress is never affected).
 */
export const RUN_SNAPSHOT_MIGRATIONS: Readonly<Record<number, Migration>> = {};

/** What the game shows when the meta save needed attention at boot: [title, line]. */
export const SAVE_NOTICES = {
  restored: ['SAVE RESTORED', 'THE LATEST SAVE WAS DAMAGED · USED THE BACKUP'],
  corrupt: ['SAVE DAMAGED', 'IT COULD NOT BE RESTORED · STARTING FRESH'],
  future: ['NEWER SAVE FOUND', "PROGRESS WON'T BE SAVED UNTIL THE GAME UPDATES"],
  memory: ['PROGRESS NOT SAVED', "THIS BROWSER MODE CAN'T KEEP SAVES"],
} as const satisfies Record<string, readonly [string, string]>;

export interface SaveNotice {
  title: string;
  line: string;
  /** Still true for the whole session (newer version / no storage): the title keeps showing it. */
  lasting: boolean;
}

/** Who knows the run that may be saved right now (the run scene; null on menus / in the yard / at the end). */
export interface SaveHost {
  savableRun(): Sim | null;
}

export type ContinueResult =
  | { ok: true; snapshot: RunSnapshot; restored: boolean }
  | { ok: false; reason: 'empty' | 'corrupt' | 'future'; message: string };

export interface GameSaveOptions {
  /** Clock in epoch ms (achievement timestamps, save throttling). */
  now?: () => number;
}

export class GameSave {
  readonly storage: SaveStorage;
  readonly meta: MetaStore;
  readonly runs: RunSaveStore;
  readonly achievements: AchievementEngine;
  readonly tracker: MetaTracker;
  host: SaveHost | null = null;
  /** Run saves written this session, and the last failure (diagnostics / __SD). */
  runSaves = 0;
  lastRunError: string | null = null;

  constructor(storage: SaveStorage = createStorage(), opts: GameSaveOptions = {}) {
    this.storage = storage;
    this.meta = new MetaStore({ storage, now: opts.now });
    this.runs = new RunSaveStore({ storage, version: RUN_SNAPSHOT_VERSION, migrations: RUN_SNAPSHOT_MIGRATIONS });
    this.achievements = new AchievementEngine(this.meta);
    this.tracker = new MetaTracker(this.meta, this.achievements);
    // Content may have grown since the last session: rewards of achievements already earned, and
    // counter achievements the lifetime stats already satisfy (those toast on the title).
    this.achievements.syncRewards();
    this.achievements.checkCounters();
  }

  /** A notice about the meta save (restored / damaged / newer version / not kept), or null. */
  get notice(): SaveNotice | null {
    const s = this.meta.loaded.status;
    const n = (k: keyof typeof SAVE_NOTICES, lasting: boolean): SaveNotice => ({ title: SAVE_NOTICES[k][0], line: SAVE_NOTICES[k][1], lasting });
    if (s === 'future') return n('future', true);
    if (s === 'corrupt') return n('corrupt', false);
    if (s === 'restored') return n('restored', false);
    if (!this.storage.persistent) return n('memory', true);
    return null;
  }

  /** Is there a run to continue (a readable save; the title's Continue button)? */
  hasRun(): boolean {
    return this.runs.hasRun();
  }

  /**
   * Saves the host's run now (if one may be saved) and flushes meta. Called on room transitions, pause,
   * backgrounding and before leaving the run for the title. Returns false when a write failed.
   */
  saveRunNow(): boolean {
    const sim = this.host?.savableRun() ?? null;
    let ok = true;
    if (sim?.run) {
      const r = this.runs.save(sim.snapshot());
      if (r.ok) {
        this.runSaves++;
        this.lastRunError = null;
      } else {
        ok = false;
        this.lastRunError = r.message;
        if (r.error !== 'readonly') console.warn('run save failed', r.error, r.path ?? '', r.message);
      }
    }
    return this.meta.flush() && ok;
  }

  /** The saved run for Continue (or why there is none / it can't be used). */
  loadRun(): ContinueResult {
    const r = this.runs.load<RunSnapshot>();
    if (!r.ok) {
      const message =
        r.reason === 'future'
          ? 'THAT RUN WAS SAVED BY A NEWER VERSION'
          : r.reason === 'corrupt'
            ? "THE SAVED RUN COULDN'T BE RESTORED"
            : 'NO RUN TO CONTINUE';
      return { ok: false, reason: r.reason, message };
    }
    const s = r.data;
    if (!s || typeof s !== 'object' || s.v !== RUN_SNAPSHOT_VERSION || !s.run || !s.world || !s.player) {
      return { ok: false, reason: 'corrupt', message: "THE SAVED RUN COULDN'T BE RESTORED" };
    }
    return { ok: true, snapshot: s, restored: r.restored };
  }

  /** The run ended (death, victory) or can't be continued: drop the save and its backup. */
  clearRun(): void {
    this.runs.clear();
    this.meta.flush();
  }

  /**
   * A New Run over a saved one: the saved run counts as abandoned (a 'quit' — it ends the win streak),
   * then the save is dropped.
   */
  abandonSavedRun(): void {
    if (!this.runs.hasRun()) return;
    const r = this.runs.load<RunSnapshot>();
    if (r.ok && r.data?.run) {
      this.meta.recordRunEnd({ character: r.data.run.character, outcome: 'quit', floor: r.data.run.floor });
    }
    this.clearRun();
  }

  /** The unlock snapshot a new run carries (RunOptions.unlocked). */
  unlockedForRun(): string[] {
    return runUnlocks(this.meta.state);
  }

  /** Once per loop tick: counter achievements, then meta's end-of-tick save. */
  endTick(): void {
    this.tracker.endTick();
    this.meta.endTick();
  }
}

// ── The live service for code without a handle on it (lifecycle hooks) ──────

let active: GameSave | null = null;
let saveCalls = 0;

/** main.ts installs the game's save service once at boot. */
export function installGameSave(s: GameSave | null): void {
  active = s;
}

export function gameSave(): GameSave | null {
  return active;
}

/**
 * Persist the current run (if any) and meta immediately: on room transitions, pause, background
 * (visibilitychange / pagehide / blur) and before leaving a run for the title.
 */
export function saveRunNow(): void {
  saveCalls++;
  active?.saveRunNow();
}

/** Diagnostics for tests / the debug overlay. */
export function saveRunCalls(): number {
  return saveCalls;
}
