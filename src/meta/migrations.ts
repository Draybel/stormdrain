/**
 * Save-data migrations (ARCHITECTURE §7). `steps[v]` upgrades data from version `v` to `v + 1`;
 * the loader applies them one at a time until the data reaches `current`.
 *
 * Rules for writing a migration:
 * - It receives freshly parsed JSON (you may mutate it) and returns the upgraded data.
 * - It must keep every field it does not understand (spread the old object into the new one), so a
 *   save touched by a newer or parallel build never loses data.
 * - It only reshapes. Missing/invalid values are fixed later by the normalizer (`normalizeMeta`),
 *   so a migration never has to invent defaults.
 * - Never edit a published step; add a new one and bump `current`.
 */

import { isRecord } from './saveCodec';

/** Migrations transform untyped JSON by nature, hence `any`. */
export type Migration = (old: any) => unknown;

export interface MigrationSet {
  /** For messages only ('meta', 'run', ...). */
  readonly name: string;
  /** The version this build writes. */
  readonly current: number;
  /** `steps[v]`: v → v + 1. */
  readonly steps: Readonly<Record<number, Migration>>;
}

export type MigrateError = 'version' | 'future' | 'missing' | 'failed';

export type MigrateResult =
  | { ok: true; data: unknown; from: number; to: number }
  | { ok: false; error: MigrateError; message: string };

export function migrate(set: MigrationSet, fromVersion: number, data: unknown): MigrateResult {
  if (!Number.isInteger(fromVersion) || fromVersion < 0) {
    return { ok: false, error: 'version', message: `${set.name} save has an invalid version (${String(fromVersion)})` };
  }
  if (fromVersion > set.current) {
    return {
      ok: false,
      error: 'future',
      message: `${set.name} save is from a newer version of the game (v${fromVersion}, this build reads up to v${set.current})`,
    };
  }
  let d = data;
  for (let v = fromVersion; v < set.current; v++) {
    const step = set.steps[v];
    if (!step) {
      return { ok: false, error: 'missing', message: `no ${set.name} migration from v${v} to v${v + 1}` };
    }
    try {
      d = step(d);
    } catch (err) {
      return { ok: false, error: 'failed', message: `${set.name} migration v${v}→v${v + 1} failed: ${String(err)}` };
    }
    if (d === undefined) {
      return { ok: false, error: 'failed', message: `${set.name} migration v${v}→v${v + 1} returned nothing` };
    }
  }
  return { ok: true, data: d, from: fromVersion, to: set.current };
}

/** Lowest version the set can upgrade from (every step from there to `current` exists). */
export function oldestSupported(set: MigrationSet): number {
  let v = set.current;
  while (v > 0 && set.steps[v - 1]) v--;
  return v;
}

// ── Meta (stormdrain.meta) ──────────────────────────────────────────────────

/** Version of the `stormdrain.meta` data this build writes. */
export const META_VERSION = 1;

/**
 * v0 → v1. v0 is the Phase-1 prototype layout (never shipped): a flat object holding the
 * Phase-1 `Settings` fields plus optional flat unlock/achievement lists. It exists so the
 * migration path is exercised from day one.
 */
function metaV0toV1(old: unknown): unknown {
  const o: Record<string, unknown> = isRecord(old) ? old : {};
  const {
    masterVolume,
    musicVolume,
    sfxVolume,
    aim360,
    shake,
    buttonScale,
    unlockedCharacters,
    unlockedItems,
    achievements,
    stats,
    ...rest
  } = o;
  const achieved: Record<string, number> = {};
  if (Array.isArray(achievements)) {
    // v0 stored ids only; 0 = "unlocked at an unknown time".
    for (const id of achievements) if (typeof id === 'string') achieved[id] = 0;
  }
  return {
    ...rest, // unknown fields survive
    settings: { masterVol: masterVolume, musicVol: musicVolume, sfxVol: sfxVolume, aim360, screenShake: shake, buttonScale },
    unlocks: {
      characters: Array.isArray(unlockedCharacters) ? unlockedCharacters : [],
      items: Array.isArray(unlockedItems) ? unlockedItems : [],
    },
    achievements: achieved,
    stats: isRecord(stats) ? stats : {},
  };
}

export const META_MIGRATIONS: MigrationSet = {
  name: 'meta',
  current: META_VERSION,
  steps: {
    0: metaV0toV1,
  },
};

// ── Run (stormdrain.run) ────────────────────────────────────────────────────

/**
 * Default version of the run snapshot. The snapshot's shape belongs to the main track
 * (`src/sim` run state); when it changes, bump the version passed to `RunSaveStore` and add a
 * step (or accept that older in-progress runs are discarded: see docs/saving.md).
 */
export const RUN_VERSION = 1;

export const RUN_MIGRATIONS: MigrationSet = {
  name: 'run',
  current: RUN_VERSION,
  steps: {},
};
