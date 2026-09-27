/**
 * Save export/import codes (ARCHITECTURE §7): `SD1:` + base64url(UTF-8 JSON envelope).
 *
 * The envelope is the same `{ v, data, sum }` used in storage (`v` = export format, the checksum
 * covers everything), and its data carries each part with its own version:
 * `{ app: 'stormdrain', at, meta: { v, data }, run?: { v, data } }`.
 * Import validates prefix → base64 → UTF-8 → JSON → checksum → versions, migrates meta (and the
 * run when given the run migrations), and returns a typed result with a player-facing message.
 *
 * Codes are plain ASCII (A–Z a–z 0–9 - _), safe to paste into notes or messages; whitespace and
 * line breaks added by other apps are ignored on import.
 */

import { META_MIGRATIONS, META_VERSION, migrate, type MigrationSet } from './migrations';
import { normalizeMeta, serializeMeta, type MetaState } from './metaState';
import type { RunPayload } from './runSave';
import { base64UrlToBytes, bytesToBase64Url, decodeEnvelope, encodeEnvelope, isRecord, utf8Decode, utf8Encode } from './saveCodec';

export const EXPORT_PREFIX = 'SD1:';
/** Layout version of the export body (the envelope's `v`). */
export const EXPORT_FORMAT = 1;
/** Anything longer is rejected before decoding. */
export const EXPORT_MAX_CHARS = 4_000_000;

interface ExportBody {
  app: 'stormdrain';
  /** Epoch ms when the code was made. */
  at: number;
  meta: { v: number; data: unknown };
  run?: { v: number; data: unknown };
}

export interface ExportOptions {
  /** Include the run in progress (`runSave.peek()`), so a player can move devices mid-run. */
  run?: RunPayload | null;
  /** Timestamp to embed (tests). Default `Date.now()`. */
  now?: number;
}

export function exportCode(meta: MetaState, opts: ExportOptions = {}): string {
  const body: ExportBody = {
    app: 'stormdrain',
    at: opts.now ?? Date.now(),
    meta: { v: META_VERSION, data: serializeMeta(meta) },
  };
  if (opts.run) body.run = { v: opts.run.v, data: opts.run.data };
  return EXPORT_PREFIX + bytesToBase64Url(utf8Encode(encodeEnvelope(EXPORT_FORMAT, body)));
}

export type ImportErrorCode = 'empty' | 'prefix' | 'version' | 'encoding' | 'damaged' | 'shape' | 'migration';

export const IMPORT_MESSAGES: Readonly<Record<ImportErrorCode, string>> = {
  empty: 'Paste a save code first.',
  prefix: "That isn't a Stormdrain save code. Save codes start with SD1:",
  version: 'This save code comes from a newer version of Stormdrain. Update the game, then try again.',
  encoding: 'This save code contains characters that do not belong in it. Copy the whole code again, without extra text.',
  damaged: 'This save code is incomplete or was changed. Copy the whole code again.',
  shape: "This code doesn't contain Stormdrain progress.",
  migration: 'This save code could not be converted to the current version of the game.',
};

export type ImportResult =
  | {
      ok: true;
      meta: MetaState;
      /** Meta version inside the code (before migration). */
      metaVersion: number;
      /** When the code was made (epoch ms), if known. */
      exportedAt: number | null;
      /** Run in progress, migrated when `runMigrations` was given; null if absent/unusable. */
      run: RunPayload | null;
      /** Player-facing notes (e.g. the run was skipped). Meta still imported. */
      warnings: string[];
    }
  | { ok: false; error: ImportErrorCode; message: string; detail?: string };

export interface ImportOptions {
  /** Migrate the run to this build's version (`runSave.slot.migrations`); runs that can't be are dropped with a warning. */
  runMigrations?: MigrationSet;
}

function fail(error: ImportErrorCode, detail?: string): ImportResult {
  return detail === undefined
    ? { ok: false, error, message: IMPORT_MESSAGES[error] }
    : { ok: false, error, message: IMPORT_MESSAGES[error], detail };
}

export function importCode(code: string, opts: ImportOptions = {}): ImportResult {
  const text = typeof code === 'string' ? code.replace(/\s+/g, '') : '';
  if (!text) return fail('empty');
  if (text.length > EXPORT_MAX_CHARS) return fail('damaged', 'code too long');
  const prefix = /^SD(\d+):/i.exec(text);
  if (!prefix) return fail('prefix');
  const format = Number(prefix[1]);
  if (format > EXPORT_FORMAT) return fail('version', `code format SD${format}`);
  if (format !== EXPORT_FORMAT) return fail('prefix');

  const bytes = base64UrlToBytes(text.slice(prefix[0].length));
  if (!bytes || bytes.length === 0) return fail('encoding');
  const json = utf8Decode(bytes);
  if (json === null) return fail('encoding', 'not UTF-8');

  const env = decodeEnvelope(json);
  if (!env.ok) return fail(env.error === 'shape' ? 'shape' : 'damaged', env.message);
  if (env.v > EXPORT_FORMAT) return fail('version', `export body v${env.v}`);

  const body = env.data;
  if (!isRecord(body) || (body.app !== undefined && body.app !== 'stormdrain')) return fail('shape');
  const metaPart = body.meta;
  if (!isRecord(metaPart) || typeof metaPart.v !== 'number' || !('data' in metaPart)) return fail('shape', 'no meta');

  const mm = migrate(META_MIGRATIONS, metaPart.v, metaPart.data);
  if (!mm.ok) return fail(mm.error === 'future' ? 'version' : 'migration', mm.message);
  const meta = normalizeMeta(mm.data);

  const warnings: string[] = [];
  let run: RunPayload | null = null;
  const runPart = body.run;
  if (runPart !== undefined && runPart !== null) {
    if (isRecord(runPart) && typeof runPart.v === 'number' && 'data' in runPart) {
      if (opts.runMigrations) {
        const rm = migrate(opts.runMigrations, runPart.v, runPart.data);
        if (rm.ok) run = { v: rm.to, data: rm.data };
        else if (rm.error === 'future') warnings.push('The run in progress needs a newer version of the game and was skipped.');
        else warnings.push('The run in progress is from an older version and could not be continued; your progress was imported.');
      } else {
        run = { v: runPart.v, data: runPart.data };
      }
    } else {
      warnings.push('The run in progress in this code is damaged and was skipped.');
    }
  }

  return {
    ok: true,
    meta,
    metaVersion: metaPart.v,
    exportedAt: typeof body.at === 'number' && Number.isFinite(body.at) ? body.at : null,
    run,
    warnings,
  };
}

/** Headline numbers for an import confirmation ("Replace your progress with ...?"). */
export interface MetaSummary {
  achievements: number;
  itemsDiscovered: number;
  enemiesSeen: number;
  charactersUnlocked: number;
  runs: number;
  wins: number;
  playTimeSec: number;
}

export function summarizeMeta(m: MetaState): MetaSummary {
  let items = 0;
  for (const id in m.collection) if (m.collection[id]!.seen > 0) items++;
  let enemies = 0;
  for (const id in m.bestiary) if (m.bestiary[id]!.seen > 0) enemies++;
  return {
    achievements: Object.keys(m.achievements).length,
    itemsDiscovered: items,
    enemiesSeen: enemies,
    charactersUnlocked: m.unlocks.characters.size,
    runs: m.stats.runs,
    wins: m.stats.wins,
    playTimeSec: m.stats.playTimeSec,
  };
}
