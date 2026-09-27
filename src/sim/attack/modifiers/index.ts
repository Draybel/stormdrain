/**
 * The modifier registry: every ModId in types.ts MOD_IDS has exactly one ModifierDef (checked at load —
 * a missing or duplicate modifier throws, so the stress test can rely on "all of them exist").
 */

import { MOD_IDS, type ModId } from '../../types';
import type { ModifierDef } from '../state';
import { HIT_MODIFIERS } from './hit';
import { MOTION_MODIFIERS } from './motion';
import { SPAWN_MODIFIERS } from './spawn';
import { STATUS_MODIFIERS } from './status';

const map = new Map<ModId, ModifierDef>();

/** Registers a modifier (throws on duplicates). Also used by tests / tools for experiments. */
export function registerModifier(def: ModifierDef): void {
  if (map.has(def.id)) throw new Error(`duplicate modifier "${def.id}"`);
  map.set(def.id, def);
}

for (const list of [SPAWN_MODIFIERS, MOTION_MODIFIERS, HIT_MODIFIERS, STATUS_MODIFIERS]) for (const d of list) registerModifier(d);

for (const id of MOD_IDS) if (!map.has(id)) throw new Error(`modifier "${id}" has no ModifierDef`);

export const MODIFIERS: ReadonlyMap<ModId, ModifierDef> = map;

export function getModifier(id: ModId): ModifierDef {
  return map.get(id)!;
}
