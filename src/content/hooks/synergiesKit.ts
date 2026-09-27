/**
 * Tiny data builders for the special synergies (src/content/synergies/*.ts) — plain Effect objects, so a
 * synergy reads like a sentence: `when('kill', hook('syn.ring', { needs: 'freeze', n: 10 }))`.
 *
 * Lives next to the synergy hooks (content/hooks/synergies.ts) because the synergies folder is
 * auto-discovered and may only hold `export default SynergyDef[]` modules. No side effects, nothing
 * from the sim but types.
 */

import type { Effect, FamiliarEffect, HookEffect, ModEffect, ModId, StatEffect, StatId, TriggerEffect, TriggerOn } from '../../sim/types';

export type HookParams = Readonly<Record<string, number | string>>;

/** Trigger options (see TriggerEffect): chance (+ luck, capped), cooldown (s), a `say` notice. */
export interface WhenOpts {
  chance?: number;
  luck?: number;
  maxChance?: number;
  cooldown?: number;
  say?: string;
}

/** A named hook with its params (content/hooks/synergies.ts, or any registered hook). */
export function hook(name: string, params?: HookParams): HookEffect {
  return params ? { type: 'hook', hook: name, params } : { type: 'hook', hook: name };
}

/** Runs `effects` every time `on` happens (fire, kill, hurt, use, bomb, pickup, roomClear, floorStart). */
export function when(on: TriggerOn, effects: Effect | readonly Effect[], opts: WhenOpts = {}): TriggerEffect {
  const list: readonly Effect[] = Array.isArray(effects) ? effects : [effects as Effect];
  return { type: 'trigger', on, ...opts, effects: list };
}

/** Modifier stacks (ARCHITECTURE §4.4); params are summed with the items'. */
export function mod(id: ModId, stacks = 1, params?: Readonly<Record<string, number>>): ModEffect {
  return params ? { type: 'mod', mod: id, stacks, params } : { type: 'mod', mod: id, stacks };
}

/** A stat change: `{ add }` and / or `{ mul }`, timed when `duration` is given (trigger contexts). */
export function stat(id: StatId, change: { add?: number; mul?: number }, duration?: number): StatEffect {
  const e: StatEffect = { type: 'stat', stat: id, ...change };
  return duration !== undefined ? { ...e, duration } : e;
}

/** An extra familiar while the synergy holds. */
export function familiar(id: string, count = 1): FamiliarEffect {
  return { type: 'familiar', familiar: id, count };
}

/** The first-activation flourish every special synergy uses (a ring in the new shot colour). */
export const DEBUT = 'syn.debut';
