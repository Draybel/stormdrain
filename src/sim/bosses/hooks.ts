/**
 * Per-boss code hooks: for the odd boss that needs something the pattern library can't express. A boss
 * names one in `BossDef.hook` (called every tick and when a phase begins) and patterns of kind 'hook'
 * name one in `BossPatternSpec.hook` (its `pattern` runs every tick until it returns true).
 *
 * Content registers hooks from its boss files (a side effect at module load, like content/hooks). The
 * context hands over the World, the boss Enemy, its BossState and a small API, so hook code never has
 * to import sim modules (no import cycles).
 */

import type { Enemy } from '../enemies/enemy';
import type { EnemyShotStyle } from '../types';
import type { World } from '../world';
import type { BossState } from './state';

export interface BossHookApi {
  /** One shot from (x, y) at `angle` (rad) and `speed` (px/s); half-heart damage `dmg`. */
  shoot(x: number, y: number, angle: number, speed: number, dmg?: number, size?: number, style?: EnemyShotStyle): void;
  /** A ring of `n` shots around the boss. */
  ring(n: number, speed: number, offset?: number): void;
  /** A marked drop (debris / lightning) on (x, y) after `air` s. */
  drop(x: number, y: number, air: number, bolt?: boolean): void;
  /** Spawns an add next to the boss (returns false at the cap / for unknown ids). */
  summon(enemyId: string, x: number, y: number): boolean;
  /** Seeded random 0..1 (the room's combat stream). */
  random(): number;
}

/** One context object is reused for every call (read it during the call; don't keep it). */
export interface BossHookCtx {
  w: World;
  e: Enemy;
  b: BossState;
  readonly api: BossHookApi;
  dt: number;
  /** Pattern hooks: seconds since the pattern's telegraph ended; its numeric params. */
  t: number;
  params: Readonly<Record<string, number>>;
}

export interface BossHook {
  /** Every tick of the fight (not during the intro / death sequence). */
  tick?(ctx: BossHookCtx): void;
  /** A phase began (after the roar). */
  phase?(ctx: BossHookCtx, phase: number): void;
  /** A 'hook' pattern: runs each tick, return true when done. */
  pattern?(ctx: BossHookCtx): boolean;
  /**
   * Every tick of the death sequence (a final's special send-off): `ctx.t` = seconds left. The first call
   * comes right after the room was swept (adds dead, shots fizzled); it may lengthen `ctx.b.dieT`.
   */
  dying?(ctx: BossHookCtx): void;
}

const hooks = new Map<string, BossHook>();

/** Registers a boss hook. Throws on duplicate names. */
export function registerBossHook(name: string, hook: BossHook): void {
  if (hooks.has(name)) throw new Error(`duplicate boss hook "${name}"`);
  hooks.set(name, hook);
}

export function getBossHook(name: string): BossHook | undefined {
  return hooks.get(name);
}

export function hasBossHook(name: string): boolean {
  return hooks.has(name);
}
