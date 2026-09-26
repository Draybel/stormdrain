/**
 * Minimal item-pool rolls for loot (lockbox trinkets/consumables, test-room pedestals).
 * The floor generator pre-rolls treasure/shop/boss pedestals with its own floorRng; this helper only
 * needs "a random item of this kind/pool/tag that isn't excluded", deterministically for a given rng.
 */

import type { Rng } from '../engine/rng';
import { allItems } from '../content/registry';
import type { ItemDef, ItemKind, PoolId } from './types';

export interface ItemFilter {
  pool?: PoolId;
  kind?: ItemKind;
  tag?: string;
  exclude?: ReadonlySet<string>;
}

export function itemCandidates(f: ItemFilter): ItemDef[] {
  return allItems().filter(
    (d) =>
      (f.pool === undefined || d.pools.includes(f.pool)) &&
      (f.kind === undefined || d.kind === f.kind) &&
      (f.tag === undefined || d.tags.includes(f.tag)) &&
      !(f.exclude?.has(d.id) ?? false),
  );
}

/** A random matching item (registry order + rng → deterministic), or null if none match. */
export function pickItem(rng: Rng, f: ItemFilter): ItemDef | null {
  const list = itemCandidates(f);
  return list.length ? rng.pick(list) : null;
}
