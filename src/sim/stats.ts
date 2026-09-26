/**
 * Stat computation (ARCHITECTURE §3 Stats): character base + every stat effect held.
 *   value = (base + Σ add) × Π mul, then clamped per stat.
 * Fire rate has diminishing returns past a knee (soft cap) so it keeps growing, just slower.
 * Move speed may never exceed 2× the character's base.
 * Pure functions: recomputed only when items change, never per tick.
 */

import { STAT_IDS, type StatId, type Stats } from './types';

/** Anything with a stat, an optional add and an optional mul (StatEffect fits). */
export interface StatMod {
  readonly stat: StatId;
  readonly add?: number;
  readonly mul?: number;
}

export interface StatRule {
  min: number;
  max: number;
}

/** Hard clamps (after adds, muls and the fire-rate soft cap). */
export const STAT_RULES: Readonly<Record<StatId, StatRule>> = {
  damage: { min: 0.5, max: 999 },
  fireRate: { min: 0.33, max: 30 },
  shotSpeed: { min: 60, max: 600 },
  range: { min: 30, max: 600 },
  moveSpeed: { min: 40, max: 400 },
  luck: { min: -10, max: 50 },
  shotSize: { min: 1, max: 16 },
  knockback: { min: 0, max: 600 },
};

/** Move speed may never exceed this multiple of the character's base. */
export const MOVE_SPEED_MAX_MULT = 2;

/** Fire-rate soft cap: linear up to `knee` shots/s, logarithmic after (slope 1 at the knee). */
export const FIRE_RATE_SOFTCAP = { knee: 5, scale: 4 } as const;

export function softCapFireRate(raw: number): number {
  const { knee, scale } = FIRE_RATE_SOFTCAP;
  if (raw <= knee) return raw;
  return knee + scale * Math.log1p((raw - knee) / scale);
}

export function makeStats(init?: Partial<Stats>): Stats {
  return {
    damage: 0,
    fireRate: 0,
    shotSpeed: 0,
    range: 0,
    moveSpeed: 0,
    luck: 0,
    shotSize: 0,
    knockback: 0,
    ...init,
  };
}

export function copyStats(out: Stats, src: Readonly<Stats>): Stats {
  for (let i = 0; i < STAT_IDS.length; i++) {
    const k = STAT_IDS[i]!;
    out[k] = src[k];
  }
  return out;
}

// Scratch accumulators (recompute is not re-entrant, so module-level scratch is safe).
const adds = makeStats();
const muls = makeStats();

/**
 * Computes the final stats into `out` (its identity is kept, so references stay valid).
 * `mods` may contain any objects with `stat` + `add`/`mul`; entries lacking both are ignored.
 */
export function computeStats(base: Readonly<Stats>, mods: readonly StatMod[], out: Stats): Stats {
  for (let i = 0; i < STAT_IDS.length; i++) {
    const k = STAT_IDS[i]!;
    adds[k] = 0;
    muls[k] = 1;
  }
  for (let i = 0; i < mods.length; i++) {
    const m = mods[i]!;
    if (m.add !== undefined && Number.isFinite(m.add)) adds[m.stat] += m.add;
    if (m.mul !== undefined && Number.isFinite(m.mul)) muls[m.stat] *= m.mul;
  }
  for (let i = 0; i < STAT_IDS.length; i++) {
    const k = STAT_IDS[i]!;
    let v = (base[k] + adds[k]) * muls[k];
    if (k === 'fireRate') v = softCapFireRate(v);
    const rule = STAT_RULES[k];
    let max = rule.max;
    if (k === 'moveSpeed') max = Math.min(max, base.moveSpeed * MOVE_SPEED_MAX_MULT);
    out[k] = v < rule.min ? rule.min : v > max ? max : v;
  }
  return out;
}
