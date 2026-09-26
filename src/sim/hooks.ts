/**
 * Named behaviour hooks for unusual item/character/synergy effects (ARCHITECTURE §1 content registries).
 * Content registers them from side-effect modules in src/content/hooks/*.ts (auto-discovered by the
 * content registry); data refers to them by name (`{ type: 'hook', hook: 'shockwave', params }`).
 *
 * Hooks receive a context with an `api` object instead of importing sim modules directly, which keeps
 * content free of import cycles (registry → hooks → sim → registry).
 */

import type { GameEventType } from '../engine/events';
import type { DropTableId, ItemId, PickupName } from './types';
import type { World } from './world';

/** The sim services a hook may use. Built once per World (see sim/effects.ts). */
export interface HookApi {
  /** Pops a pickup out at (x, y) with a little arc. */
  spawnPickup(name: PickupName, x: number, y: number): void;
  /** Rolls a drop table and pops the loot out at (x, y). */
  dropTable(id: DropTableId, x: number, y: number): void;
  /** Damages every hittable (dummies, later enemies) inside the circle; returns how many were hit. */
  damageArea(x: number, y: number, radius: number, damage: number): number;
  /** A full bomb explosion (tiles, pickups, player, chain reactions). */
  explode(x: number, y: number, radius: number, damage: number): void;
  /** Heals the player's red health (half hearts); returns the amount healed. */
  healPlayer(halves: number): number;
  /** Gives an item as if picked up fresh. */
  giveItem(id: ItemId): void;
  emit(type: GameEventType, x: number, y: number, a?: number, b?: number, id?: string): void;
}

export interface HookCtx {
  readonly w: World;
  readonly api: HookApi;
  /** Where the effect happens (player, trigger position…), room px. */
  x: number;
  y: number;
  /** Id of the item/synergy/character that owns the effect. */
  source: string;
  params: Readonly<Record<string, number | string>> | undefined;
}

export type HookFn = (ctx: HookCtx) => void;

const hooks = new Map<string, HookFn>();

/** Registers a hook. Throws on duplicate names (two content files claiming the same hook). */
export function registerHook(name: string, fn: HookFn): void {
  if (hooks.has(name)) throw new Error(`duplicate hook "${name}"`);
  hooks.set(name, fn);
}

export function getHook(name: string): HookFn | undefined {
  return hooks.get(name);
}

export function hasHook(name: string): boolean {
  return hooks.has(name);
}

export function hookNames(): string[] {
  return [...hooks.keys()];
}

/** Numeric hook parameter with a default. */
export function numParam(ctx: HookCtx, key: string, fallback: number): number {
  const v = ctx.params?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** String hook parameter with a default. */
export function strParam(ctx: HookCtx, key: string, fallback: string): string {
  const v = ctx.params?.[key];
  return typeof v === 'string' ? v : fallback;
}
