/**
 * Status effects on hittables (enemies, training dummies): poison and burn (damage over time),
 * freeze (frozen solid), slow, charm (fights for you), fear (flees you). Knockback is an impulse and
 * is handled by the target's `applyStatus` (see enemy.ts), not stored here.
 *
 * Stacking rules (documented in ARCHITECTURE §3 "Status effects"):
 * - re-applying refreshes the timer to the LONGER of the two, the power to the STRONGER of the two
 *   (no intensity stacking: many poison shots keep poison up, they don't multiply it);
 * - burn thaws a frozen target and freeze puts out a burning one; charm and fear replace each other;
 * - every duration is scaled by the target's `resist` (bosses < 1) and capped at maxDuration;
 *   targets with resist below `freezeImmuneBelow` are never frozen solid: freeze becomes a slow.
 * Allocation-free: fixed typed arrays per target, a module-level result for DOT ticks.
 */

import { STATUS_TUNING } from '../tuning';
import type { StatusKind } from '../types';

export const ST_POISON = 0;
export const ST_BURN = 1;
export const ST_FREEZE = 2;
export const ST_SLOW = 3;
export const ST_CHARM = 4;
export const ST_FEAR = 5;
export const ST_COUNT = 6;
/** Not a timed status: `applyStatus('knockback', …)` is an impulse. */
export const ST_KNOCKBACK = 6;

/** Status index for a public kind name (ST_KNOCKBACK for 'knockback'). */
export function statusIndex(kind: StatusKind): number {
  switch (kind) {
    case 'poison':
      return ST_POISON;
    case 'burn':
      return ST_BURN;
    case 'freeze':
      return ST_FREEZE;
    case 'slow':
      return ST_SLOW;
    case 'charm':
      return ST_CHARM;
    case 'fear':
      return ST_FEAR;
    default:
      return ST_KNOCKBACK;
  }
}

export class StatusSet {
  /** Seconds left per status (0 = off). */
  readonly t = new Float32Array(ST_COUNT);
  /** Power per status: DOT damage per tick (poison, burn), speed reduction (slow). */
  readonly power = new Float32Array(ST_COUNT);
  /** Damage source of the latest application (kill credit for DOT kills). */
  readonly src = new Uint8Array(ST_COUNT);
  /** Seconds to the next DOT tick. */
  poisonT = 0;
  burnT = 0;
  /** Bit per active status (1 << ST_*), refreshed on every change. */
  mask = 0;
}

export function clearStatuses(s: StatusSet): void {
  s.t.fill(0);
  s.power.fill(0);
  s.src.fill(0);
  s.poisonT = s.burnT = 0;
  s.mask = 0;
}

function refreshMask(s: StatusSet): void {
  let m = 0;
  for (let i = 0; i < ST_COUNT; i++) if (s.t[i]! > 0) m |= 1 << i;
  s.mask = m;
}

export function hasStatus(s: StatusSet, idx: number): boolean {
  return (s.mask & (1 << idx)) !== 0;
}

function defaultPower(idx: number): number {
  switch (idx) {
    case ST_POISON:
      return STATUS_TUNING.poisonDamage;
    case ST_BURN:
      return STATUS_TUNING.burnDamage;
    case ST_SLOW:
      return STATUS_TUNING.slowPower;
    default:
      return 1;
  }
}

/**
 * Applies a timed status (idx = ST_*) with the stacking rules above. `power` <= 0 uses the default.
 * Returns the status index actually applied (freeze may become slow), or -1 if nothing happened.
 */
export function addStatus(s: StatusSet, idx: number, duration: number, power: number, source: number, resist = 1): number {
  if (idx < 0 || idx >= ST_COUNT || !(duration > 0)) return -1;
  const T = STATUS_TUNING;
  if (idx === ST_FREEZE && resist < T.freezeImmuneBelow) {
    idx = ST_SLOW;
    power = T.slowPower;
  }
  const d = Math.min(T.maxDuration, duration * Math.max(0, resist));
  if (!(d > 0)) return -1;
  if (idx === ST_BURN) s.t[ST_FREEZE] = 0;
  else if (idx === ST_FREEZE) s.t[ST_BURN] = 0;
  else if (idx === ST_CHARM) s.t[ST_FEAR] = 0;
  else if (idx === ST_FEAR) s.t[ST_CHARM] = 0;
  const fresh = s.t[idx]! <= 0;
  const p = power > 0 ? power : defaultPower(idx);
  s.t[idx] = Math.max(s.t[idx]!, d);
  s.power[idx] = fresh ? p : Math.max(s.power[idx]!, p);
  s.src[idx] = source;
  if (fresh) {
    if (idx === ST_POISON) s.poisonT = T.poisonTick;
    else if (idx === ST_BURN) s.burnT = T.burnTick;
  }
  refreshMask(s);
  return idx;
}

/** DOT result of `tickStatuses` (reused; read right away). */
export interface DotResult {
  /** Total damage to deal this tick (0 = none). */
  damage: number;
  /** Source to attribute it to. */
  source: number;
  /** Which DOT ticked (ST_POISON / ST_BURN, or -1) — the last one if both did. */
  kind: number;
}

const dot: DotResult = { damage: 0, source: 0, kind: -1 };

/** Advances every timer by dt; returns the damage-over-time due this tick. */
export function tickStatuses(s: StatusSet, dt: number): DotResult {
  dot.damage = 0;
  dot.kind = -1;
  if (s.mask === 0) return dot;
  const T = STATUS_TUNING;
  if (s.t[ST_POISON]! > 0) {
    s.poisonT -= dt;
    // (epsilon: 0.5 s must be exactly 30 ticks despite float drift)
    if (s.poisonT <= 1e-6) {
      s.poisonT += T.poisonTick;
      dot.damage += s.power[ST_POISON]!;
      dot.source = s.src[ST_POISON]!;
      dot.kind = ST_POISON;
    }
  }
  if (s.t[ST_BURN]! > 0) {
    s.burnT -= dt;
    if (s.burnT <= 1e-6) {
      s.burnT += T.burnTick;
      dot.damage += s.power[ST_BURN]!;
      dot.source = s.src[ST_BURN]!;
      dot.kind = ST_BURN;
    }
  }
  let changed = false;
  for (let i = 0; i < ST_COUNT; i++) {
    const t = s.t[i]!;
    if (t <= 0) continue;
    const n = t - dt;
    if (n <= 0) {
      s.t[i] = 0;
      s.power[i] = 0;
      changed = true;
    } else {
      s.t[i] = n;
    }
  }
  if (changed) refreshMask(s);
  return dot;
}

/** Speed multiplier from statuses (frozen = 0, slowed = 1 − power). */
export function statusSpeedMul(s: StatusSet): number {
  if (s.mask === 0) return 1;
  if (s.t[ST_FREEZE]! > 0) return 0;
  if (s.t[ST_SLOW]! > 0) return Math.max(0.1, 1 - s.power[ST_SLOW]!);
  return 1;
}
