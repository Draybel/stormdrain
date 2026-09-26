/**
 * In-progress run save (`stormdrain.run`, ARCHITECTURE §7). Separate from meta so a damaged or
 * outdated run never costs the player their unlocks.
 *
 * The snapshot type belongs to the main track (sim run state); this module only guarantees it is
 * stored safely: JSON-safe (no NaN/Infinity, cycles, class instances...), under a size limit,
 * checksummed, versioned + migrated, with a `.bak` of the previous save (the previous room).
 *
 * Call sites (see docs/saving.md): `save()` on every room transition, on pause and on
 * background; `clear()` when the run ends (win, death, abandon); `hasRun()` for the title
 * screen's Continue button; `load()` when Continue is pressed.
 */

import { RUN_MIGRATIONS, RUN_VERSION, migrate, type Migration, type MigrationSet } from './migrations';
import { checkJsonSafe, decodeEnvelope } from './saveCodec';
import { SaveSlot, type SaveStorage } from './storage';

export const RUN_KEY = 'stormdrain.run';

/** ~1 M UTF-16 chars (≈2 MB of the ~5 MB WebKit gives an origin), leaving room for meta + backups. */
export const RUN_MAX_CHARS = 1_000_000;

export interface RunSaveOptions {
  storage: SaveStorage;
  key?: string;
  /** Version of the snapshot shape this build writes. Default {@link RUN_VERSION}. */
  version?: number;
  /** `steps[v]`: upgrade a snapshot from v to v + 1. */
  migrations?: Readonly<Record<number, Migration>>;
  maxChars?: number;
}

export type RunSaveError = 'unsafe' | 'size' | 'storage' | 'readonly';

export type RunSaveResult =
  | { ok: true; chars: number }
  | { ok: false; error: RunSaveError; message: string; path?: string };

export type RunLoadResult<T> =
  | {
      ok: true;
      data: T;
      /** Version found in storage before migration. */
      migratedFrom: number;
      /** True when the latest save was damaged and the previous one (`.bak`) was used. */
      restored: boolean;
    }
  | {
      ok: false;
      /**
       * `empty`: no run saved. `corrupt`: unreadable or not migratable (offer New Run, then
       * `clear()`). `future`: written by a newer build (leave it alone; do not clear).
       */
      reason: 'empty' | 'corrupt' | 'future';
      message: string;
    };

export type RunSnapshotIssue = { error: 'unsafe' | 'size'; message: string; path?: string };

/** Validate a snapshot without saving it (tests, debug). Returns null when it can be saved. */
export function checkRunSnapshot(snapshot: unknown, maxChars = RUN_MAX_CHARS): RunSnapshotIssue | null {
  const r = serializeSnapshot(snapshot, maxChars);
  return typeof r === 'string' ? null : r;
}

/** Validated JSON text of the snapshot, or the issue that prevents saving it. */
function serializeSnapshot(snapshot: unknown, maxChars: number): string | RunSnapshotIssue {
  if (typeof snapshot !== 'object' || snapshot === null) {
    return { error: 'unsafe', message: 'run snapshot must be an object or array', path: '$' };
  }
  const issue = checkJsonSafe(snapshot);
  if (issue) return { error: 'unsafe', message: `run snapshot is not JSON-safe: ${issue.message}`, path: issue.path };
  const json = JSON.stringify(snapshot);
  if (json.length > maxChars) {
    return { error: 'size', message: `run snapshot is too large (${json.length} > ${maxChars} chars)` };
  }
  return json;
}

export class RunSaveStore {
  readonly slot: SaveSlot;
  readonly maxChars: number;
  /** Successful writes (diagnostics). */
  saves = 0;

  constructor(opts: RunSaveOptions) {
    const set: MigrationSet = opts.migrations
      ? { name: 'run', current: opts.version ?? RUN_VERSION, steps: opts.migrations }
      : opts.version !== undefined && opts.version !== RUN_VERSION
        ? { name: 'run', current: opts.version, steps: {} }
        : RUN_MIGRATIONS;
    this.slot = new SaveSlot(opts.storage, opts.key ?? RUN_KEY, set);
    this.maxChars = opts.maxChars ?? RUN_MAX_CHARS;
  }

  /** Validate and write the snapshot (the previous one becomes the backup). Never throws. */
  save(snapshot: unknown): RunSaveResult {
    const json = serializeSnapshot(snapshot, this.maxChars);
    if (typeof json !== 'string') return { ok: false, ...json };
    const r = this.slot.writeJson(json);
    if (!r.ok) {
      const error: RunSaveError = r.error === 'readonly' ? 'readonly' : r.error === 'storage' ? 'storage' : 'unsafe';
      return { ok: false, error, message: r.message };
    }
    if (!r.skipped) this.saves++;
    return { ok: true, chars: r.chars };
  }

  load<T = unknown>(): RunLoadResult<T> {
    const r = this.slot.load();
    switch (r.status) {
      case 'ok':
      case 'restored':
        return { ok: true, data: r.data as T, migratedFrom: r.migratedFrom ?? this.slot.migrations.current, restored: r.status === 'restored' };
      case 'empty':
        return { ok: false, reason: 'empty', message: 'no run in progress' };
      case 'future':
        return { ok: false, reason: 'future', message: r.error ?? 'run was saved by a newer version' };
      default:
        return { ok: false, reason: 'corrupt', message: r.error ?? 'run save is damaged' };
    }
  }

  /** The run ended (or was abandoned): drop the save and its backup. */
  clear(): void {
    this.slot.clear();
  }

  /**
   * True when a readable run exists (title screen → Continue). Verifies the checksum of the
   * primary (or the backup), without migrating.
   */
  hasRun(): boolean {
    const s = this.slot.storage;
    return decodeEnvelope(s.get(this.slot.key)).ok || decodeEnvelope(s.get(this.slot.bakKey)).ok;
  }

  /** The saved run as stored (`{ v, data }`, not migrated), for an export code; null if none. */
  peek(): RunPayload | null {
    const s = this.slot.storage;
    for (const key of [this.slot.key, this.slot.bakKey]) {
      const d = decodeEnvelope(s.get(key));
      if (d.ok) return { v: d.v, data: d.data };
    }
    return null;
  }

  /** Store a run that came from an import code: migrate it to this build's version, then save. */
  restore(payload: RunPayload): RunSaveResult {
    const m = migrate(this.slot.migrations, payload.v, payload.data);
    if (!m.ok) return { ok: false, error: 'unsafe', message: m.message };
    return this.save(m.data);
  }
}

/** A run snapshot with the version it was written at (export/import). */
export interface RunPayload {
  v: number;
  data: unknown;
}
