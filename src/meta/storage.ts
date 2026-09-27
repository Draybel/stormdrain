/**
 * Storage abstraction + versioned save slots (ARCHITECTURE §7).
 *
 * - {@link SaveStorage}: a string key/value store that never throws. `WebStorage` wraps
 *   `localStorage` (quota errors, disabled storage and private mode become `false`/`null`);
 *   `MemoryStorage` is the fallback and the test double (with an optional quota).
 * - {@link SaveSlot}: one save key holding an envelope `{ v, data, sum }`. Loads verify the
 *   checksum and migrate step by step; writes keep the previous good save under `<key>.bak` and
 *   loads fall back to it when the primary is damaged.
 *
 * No DOM access beyond an optional `localStorage` probe in {@link createStorage} and the
 * `navigator.storage` call in {@link requestPersistentStorage}.
 */

import { decodeEnvelope, encodeEnvelopeJson } from './saveCodec';
import { migrate, type MigrationSet } from './migrations';

// ── Key/value backends ──────────────────────────────────────────────────────

export interface SaveStorage {
  readonly kind: 'local' | 'memory';
  /** False for the in-memory fallback: nothing survives a reload (show a warning in Settings). */
  readonly persistent: boolean;
  /** Last failure reason (quota, security...), null after a successful write. */
  readonly lastError: string | null;
  get(key: string): string | null;
  /** False when the write failed (quota exceeded, storage disabled). Never throws. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

/** Minimal `Storage` surface we use (so tests can pass a fake). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class WebStorage implements SaveStorage {
  readonly kind = 'local' as const;
  readonly persistent = true;
  lastError: string | null = null;

  constructor(private readonly ls: StorageLike) {}

  get(key: string): string | null {
    try {
      return this.ls.getItem(key);
    } catch (err) {
      this.lastError = describeError(err);
      return null;
    }
  }

  set(key: string, value: string): boolean {
    try {
      this.ls.setItem(key, value);
      this.lastError = null;
      return true;
    } catch (err) {
      this.lastError = describeError(err);
      return false;
    }
  }

  remove(key: string): void {
    try {
      this.ls.removeItem(key);
    } catch (err) {
      this.lastError = describeError(err);
    }
  }
}

export interface MemoryStorageOptions {
  /** Total characters (keys + values) allowed; writes beyond it fail like a full localStorage. */
  quotaChars?: number;
  /** Treat as persistent (tests that simulate a reload by reusing the instance). Default true. */
  persistent?: boolean;
}

export class MemoryStorage implements SaveStorage {
  readonly kind = 'memory' as const;
  readonly persistent: boolean;
  lastError: string | null = null;
  readonly map = new Map<string, string>();
  /** Test hook: make every write fail (e.g. storage disabled). */
  failWrites = false;
  /** Number of successful set() calls (tests use it to observe debouncing). */
  writes = 0;
  private readonly quota: number;

  constructor(opts: MemoryStorageOptions = {}) {
    this.quota = opts.quotaChars ?? Infinity;
    this.persistent = opts.persistent ?? true;
  }

  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): boolean {
    if (this.failWrites) {
      this.lastError = 'storage disabled';
      return false;
    }
    if (this.quota !== Infinity) {
      let used = 0;
      for (const [k, v] of this.map) if (k !== key) used += k.length + v.length;
      if (used + key.length + value.length > this.quota) {
        this.lastError = 'QuotaExceededError';
        return false;
      }
    }
    this.map.set(key, value);
    this.writes++;
    this.lastError = null;
    return true;
  }

  remove(key: string): void {
    this.map.delete(key);
  }
}

const PROBE_KEY = 'stormdrain.probe';

/**
 * The browser's localStorage when it works (a probe write succeeds), else an in-memory store
 * with `persistent = false`. Pass `candidate` to test the fallback; by default it reads
 * `globalThis.localStorage` (reading it can itself throw when storage is blocked).
 */
export function createStorage(candidate?: StorageLike | null): SaveStorage {
  try {
    const ls = candidate === undefined ? defaultLocalStorage() : candidate;
    if (ls) {
      ls.setItem(PROBE_KEY, '1');
      ls.removeItem(PROBE_KEY);
      return new WebStorage(ls);
    }
  } catch {
    // blocked storage / private mode quota 0: fall through
  }
  return new MemoryStorage({ persistent: false });
}

/**
 * Ask the browser not to evict our storage under pressure (`navigator.storage.persist()`).
 * Safari may clear a plain website's storage after ~7 days without a visit; home-screen apps are
 * exempt, and a granted request adds protection elsewhere. Resolves false when unsupported.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    const sm = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!sm?.persist) return false;
    if (sm.persisted && (await sm.persisted())) return true;
    return await sm.persist();
  } catch {
    return false;
  }
}

function defaultLocalStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null; // node / workers
  return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object' && 'name' in err) {
    const e = err as { name?: unknown; message?: unknown };
    return `${String(e.name)}: ${String(e.message ?? '')}`;
  }
  return String(err);
}

// ── Versioned slots ─────────────────────────────────────────────────────────

/**
 * - `ok`: primary save loaded (possibly migrated: see `migratedFrom`).
 * - `empty`: nothing saved yet.
 * - `restored`: the primary was missing/damaged; the `.bak` copy was loaded (and put back).
 * - `corrupt`: primary and backup unusable; defaults are used and the damaged text is kept under
 *   `<key>.corrupt` for manual recovery.
 * - `future`: written by a newer build. Nothing is loaded and the slot turns read-only so this
 *   (older) build never overwrites newer progress.
 */
export type SlotStatus = 'ok' | 'empty' | 'restored' | 'corrupt' | 'future';

export interface SlotLoad {
  status: SlotStatus;
  /** Data at the current version, or null (empty/corrupt/future). */
  data: unknown;
  /** Version found in storage before migration (null when nothing loaded). */
  migratedFrom: number | null;
  /** Human-readable reason for restored/corrupt/future. */
  error: string | null;
}

export type SlotWriteResult =
  | { ok: true; chars: number; skipped: boolean }
  | { ok: false; error: 'readonly' | 'unserializable' | 'storage'; message: string };

type Attempt = { ok: true; data: unknown; from: number } | { ok: false; future: boolean; message: string };

export class SaveSlot {
  readonly bakKey: string;
  readonly corruptKey: string;
  /** Set when a newer build's save was found; writes are refused. */
  readOnly = false;
  /** Text of the last save known to be good (loaded or written) — becomes the next `.bak`. */
  private lastGood: string | null = null;
  /** lastGood reflects storage (set by load/clear/the first write). */
  private primed = false;

  constructor(
    readonly storage: SaveStorage,
    readonly key: string,
    readonly migrations: MigrationSet,
  ) {
    this.bakKey = `${key}.bak`;
    this.corruptKey = `${key}.corrupt`;
  }

  load(): SlotLoad {
    this.lastGood = null;
    this.readOnly = false;
    this.primed = true;
    const raw = this.storage.get(this.key);
    let primaryError: string | null = null;
    if (raw !== null) {
      const r = this.attempt(raw);
      if (r.ok) {
        this.lastGood = raw;
        return { status: 'ok', data: r.data, migratedFrom: r.from, error: null };
      }
      if (r.future) {
        this.readOnly = true;
        return { status: 'future', data: null, migratedFrom: null, error: r.message };
      }
      primaryError = r.message;
      this.storage.set(this.corruptKey, raw); // best effort; may fail on quota
    }
    const bak = this.storage.get(this.bakKey);
    if (bak !== null) {
      const r = this.attempt(bak);
      if (r.ok) {
        this.lastGood = bak;
        this.storage.set(this.key, bak); // repair the primary so the next launch loads cleanly
        return {
          status: 'restored',
          data: r.data,
          migratedFrom: r.from,
          error: primaryError ?? 'main save missing; restored the backup',
        };
      }
      if (r.future && raw === null) {
        this.readOnly = true;
        return { status: 'future', data: null, migratedFrom: null, error: r.message };
      }
      primaryError ??= r.message;
    }
    if (raw === null && bak === null) return { status: 'empty', data: null, migratedFrom: null, error: null };
    return { status: 'corrupt', data: null, migratedFrom: null, error: primaryError };
  }

  /**
   * Write `data` at the current version. The previous good save moves to `.bak` first. When the
   * write fails (quota), the backup and corrupt copies are dropped and the write retried once.
   */
  write(data: unknown): SlotWriteResult {
    let json: string | undefined;
    try {
      json = JSON.stringify(data);
    } catch (err) {
      return { ok: false, error: 'unserializable', message: String(err) };
    }
    if (json === undefined) return { ok: false, error: 'unserializable', message: 'save data is not JSON-serializable' };
    return this.writeJson(json);
  }

  /** {@link write} for data the caller already `JSON.stringify`-ed (avoids a second pass). */
  writeJson(json: string): SlotWriteResult {
    if (!this.primed) {
      // Written without a load(): back up whatever valid save is already there (and never
      // overwrite one from a newer build).
      this.primed = true;
      const current = this.storage.get(this.key);
      const d = decodeEnvelope(current);
      if (d.ok && d.v > this.migrations.current) this.readOnly = true;
      else if (d.ok) this.lastGood = current;
    }
    if (this.readOnly) {
      return { ok: false, error: 'readonly', message: 'save is from a newer version of the game; not overwriting it' };
    }
    const text = encodeEnvelopeJson(this.migrations.current, json);
    if (text === this.lastGood) return { ok: true, chars: text.length, skipped: true };
    if (this.lastGood !== null) this.storage.set(this.bakKey, this.lastGood);
    let ok = this.storage.set(this.key, text);
    if (!ok) {
      this.storage.remove(this.corruptKey);
      this.storage.remove(this.bakKey);
      ok = this.storage.set(this.key, text);
    }
    if (!ok) {
      return { ok: false, error: 'storage', message: this.storage.lastError ?? 'storage write failed' };
    }
    this.lastGood = text;
    return { ok: true, chars: text.length, skipped: false };
  }

  /** Remove the save and its backup (e.g. a finished run must not come back as Continue). */
  clear(): void {
    this.storage.remove(this.key);
    this.storage.remove(this.bakKey);
    this.lastGood = null;
    this.readOnly = false;
    this.primed = true;
  }

  /**
   * Another writer's save (polish batch 3: another tab of the game): the primary's text when it differs from what this
   * slot last loaded or wrote, decoded and migrated; null when unchanged, missing or unreadable. A save from a NEWER
   * version makes the slot read-only, exactly as finding one at load would.
   */
  readExternal(): { text: string; data: unknown } | null {
    const raw = this.storage.get(this.key);
    if (raw === null || raw === this.lastGood) return null;
    const r = this.attempt(raw);
    if (!r.ok) {
      if (r.future) this.readOnly = true;
      return null;
    }
    return { text: raw, data: r.data };
  }

  /** The primary holds `text` now (merged from another writer): it is the next `.bak`, and no longer "external". */
  adopt(text: string): void {
    this.lastGood = text;
    this.primed = true;
  }

  /** Cheap presence test (primary or backup text exists; not validated). */
  exists(): boolean {
    return this.storage.get(this.key) !== null || this.storage.get(this.bakKey) !== null;
  }

  private attempt(text: string): Attempt {
    const d = decodeEnvelope(text);
    if (!d.ok) return { ok: false, future: false, message: d.message };
    const m = migrate(this.migrations, d.v, d.data);
    if (!m.ok) return { ok: false, future: m.error === 'future', message: m.message };
    return { ok: true, data: m.data, from: d.v };
  }
}
