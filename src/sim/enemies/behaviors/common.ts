/**
 * Shared types and helpers of the enemy behaviour library. A behaviour declares its numeric params
 * as `name: [default, min, max]`; defs are compiled once (see index.ts) into plain param objects so
 * the per-tick code reads `p.speed` without lookups or allocation.
 */

import { circleOverlapsGrid, WALK_MODE } from '../../collision';
import { ROOM_H, ROOM_W, TILE } from '../../constants';
import type { AttackKind, DeathKind, EnemyDef, MoveKind } from '../../types';
import type { World } from '../../world';
import type { Enemy } from '../enemy';
import { ST_FEAR, hasStatus } from '../status';

export type Params = Readonly<Record<string, number>>;
/** name → [default, min, max]. */
export type ParamSpec = Readonly<Record<string, readonly [number, number, number]>>;

/** When an attack is used (AttackSpec param `on`). */
export const ON_TIMER = 0;
/** Hop landing. */
export const ON_LAND = 1;
/** Burrower surfacing. */
export const ON_EMERGE = 2;
/** Teleporter reappearing. */
export const ON_APPEAR = 3;
/** Dash hitting a wall. */
export const ON_BONK = 4;

export interface MoveBehavior {
  readonly params: ParamSpec;
  /** Crosses pits and rocks (only the room walls stop it). */
  readonly flying?: boolean;
  /** Ignores knockback and separation pushes. */
  readonly pinned?: boolean;
  /** Places itself (no grid collision). */
  readonly noCollide?: boolean;
  /** Reacts to fear itself; otherwise fear replaces the behaviour with a plain flee. */
  readonly handlesFear?: boolean;
  init?(w: World, e: Enemy, p: Params): void;
  /** Writes the desired velocity into e.tvx / e.tvy (and may drive e.z, modes, telegraphs). */
  update(w: World, e: Enemy, p: Params, dt: number, spd: number): void;
}

export interface CompiledAttack {
  readonly kind: AttackKind;
  readonly beh: AttackBehavior;
  readonly cooldown: number;
  readonly p: Params;
  /** spawnMinion: what to spawn. */
  readonly minion: EnemyDef | null;
  /** Enemy shot style index (ENEMY_SHOT_STYLES). */
  readonly style: number;
}

export interface AttackBehavior {
  readonly params: ParamSpec;
  /** No telegraph, no range check, fires whenever it is off cooldown (e.g. leaveTrail). */
  readonly passive?: boolean;
  fire(w: World, e: Enemy, a: CompiledAttack): void;
}

export interface CompiledDeath {
  readonly kind: DeathKind;
  readonly beh: DeathBehavior;
  readonly p: Params;
  readonly minion: EnemyDef | null;
  readonly style: number;
}

export interface DeathBehavior {
  readonly params: ParamSpec;
  run(w: World, e: Enemy, d: CompiledDeath, frozen: boolean): void;
}

export interface CompiledMove {
  readonly kind: MoveKind;
  readonly beh: MoveBehavior;
  readonly p: Params;
}

export interface CompiledEnemy {
  readonly move: CompiledMove;
  readonly attacks: readonly CompiledAttack[];
  readonly deaths: readonly CompiledDeath[];
}

/** Params every attack understands (merged into each attack's spec). */
export const ATTACK_COMMON: ParamSpec = {
  /** Telegraph (flash + squash) before it fires, s. */
  windup: [0.35, 0, 2],
  /** Only used when the target is within [minRange, range] px. */
  range: [999, 0, 999],
  minRange: [0, 0, 400],
  /** ON_TIMER / ON_LAND / ON_EMERGE / ON_APPEAR / ON_BONK. */
  on: [0, 0, 4],
  /** Stand still during the wind-up. */
  still: [1, 0, 1],
  /** Seconds before the first use (-1 = a random 40-100 % of the cooldown). */
  first: [-1, -1, 30],
};

/** Params of attacks that fire projectiles. */
export const SHOT_COMMON: ParamSpec = {
  speed: [90, 20, 320],
  /** Half hearts. */
  dmg: [1, 1, 4],
  /** Collision radius, px. */
  size: [3, 1.5, 8],
  /** Speed change, px/s² (negative = slows down and fizzles). */
  accel: [0, -400, 400],
  /** Turn rate, rad/s (curving shots). */
  curve: [0, -6, 6],
  /** 1 = passes through rocks (walls still stop it). */
  phase: [0, 0, 1],
  /** Lifetime, s. */
  life: [3, 0.3, 8],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

export function feared(e: Enemy): boolean {
  return hasStatus(e.status, ST_FEAR);
}

/**
 * Unit direction the enemy wants to go (toward its target, or away from the player when feared).
 * Writes e.dirX/e.dirY; returns the distance to the target (Infinity without one).
 */
export function goalDir(w: World, e: Enemy): number {
  if (feared(e)) {
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) {
      e.dirX = dx / d;
      e.dirY = dy / d;
    }
    return d;
  }
  if (!e.hasTgt) return Infinity;
  const dx = e.tgtX - e.x;
  const dy = e.tgtY - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-4) {
    e.dirX = dx / d;
    e.dirY = dy / d;
  }
  return d;
}

/** Distance from the enemy to its target (Infinity without one). */
export function targetDist(e: Enemy): number {
  if (!e.hasTgt) return Infinity;
  const dx = e.tgtX - e.x;
  const dy = e.tgtY - e.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Inside the room interior with a margin of `r`. */
export function inRoom(x: number, y: number, r: number): boolean {
  return x >= r && y >= r && x <= ROOM_W - r && y <= ROOM_H - r;
}

/** A circle of radius r fits on walkable ground at (x, y). */
export function walkableAt(w: World, x: number, y: number, r: number): boolean {
  return inRoom(x, y, r) && !circleOverlapsGrid(w.room, x, y, r, WALK_MODE);
}

/**
 * Picks a random walkable cell centre whose distance to (cx, cy) is within [minD, maxD]
 * (combatRng; `tries` attempts). Writes e.tx/e.ty and returns true on success.
 */
export function randomSpotNear(w: World, e: Enemy, cx: number, cy: number, minD: number, maxD: number, tries = 16): boolean {
  const rng = w.combatRng;
  const room = w.room;
  for (let i = 0; i < tries; i++) {
    const col = rng.int(0, room.cols - 1);
    const row = rng.int(0, room.rows - 1);
    const x = col * TILE + TILE / 2;
    const y = row * TILE + TILE / 2;
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < minD * minD || d2 > maxD * maxD) continue;
    if (!walkableAt(w, x, y, e.r)) continue;
    e.tx = x;
    e.ty = y;
    return true;
  }
  return false;
}

/** Starts a generic telegraph (render flashes/squashes the enemy while it runs). */
export function telegraph(e: Enemy, seconds: number): void {
  e.teleT = e.teleMax = seconds;
}
