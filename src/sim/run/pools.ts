/**
 * Item pools for floor runs: seeded, quality-weighted picks from PoolIds (DESIGN "Economy").
 * - Test items never roll; LOCKED items never roll: the run's meta snapshot lists them — every item
 *   flagged `unlock` that isn't in the run's `unlocked` list, plus RunOptions.lockedItems.
 * - Items already SEEN this run (shown on a pedestal, in a shop, offered by a trader, or taken) are
 *   left out of the pools for the rest of the run, and nothing repeats within a floor; when a pool runs
 *   dry the pick falls back to repeats rather than leaving a pedestal empty.
 * - Pools fall back in order (secret → treasure, …) while content is thin.
 */

import type { Rng } from '../../engine/rng';
import { allItems, findItem } from '../../content/registry';
import type { ItemDef, PoolId } from '../types';

/** Treasure-style rolls make the best items rarer (quality 0-4); an item's own `weight` replaces it. */
export const QUALITY_WEIGHT = [1, 1, 1, 0.7, 0.35] as const;
/**
 * Shop prices (coins) by quality for passives / actives (polish batch 4: 15-40, was 10-25 — at ~12 coins a shop sold
 * 2-3 items a floor and coins still piled up at 99; with the scarcer coins a shop item is a choice again).
 */
export const ITEM_PRICE = [15, 18, 22, 30, 40] as const;
/** Trinkets in the shop (consumables cost 5 + quality). */
export const TRINKET_PRICE = 12;

/** An item's roll weight: its own `weight`, else the quality's. */
export function rollWeight(d: ItemDef): number {
  return d.weight ?? QUALITY_WEIGHT[d.quality] ?? 1;
}

/** Every item id that must not roll this run: `unlock`-flagged items not unlocked, plus extra ids. */
export function lockedItemIds(unlocked: ReadonlySet<string>, extra: readonly string[] = []): string[] {
  const out = new Set<string>(extra);
  for (const d of allItems()) if (d.unlock !== undefined && !unlocked.has(d.id)) out.add(d.id);
  return [...out].sort();
}

function isPedestalKind(d: ItemDef): boolean {
  return d.kind === 'passive' || d.kind === 'active';
}

/**
 * One item from the first pool that still has candidates. Pass 0 skips `used` (seen this run / used
 * on this floor) and items below `minQuality`; pass 1 allows them again. Locked and test items never
 * roll. `anyKind` also allows trinkets / consumables (shops, traders). Adds the pick to `used`.
 * Returns '' when no pool has anything at all. Deterministic for (rng state, content set).
 */
export function rollItem(
  rng: Rng,
  pools: readonly PoolId[],
  used: Set<string>,
  locked: ReadonlySet<string>,
  anyKind: boolean,
  minQuality = 0,
): string {
  const roll = rng.next();
  const items = allItems();
  for (let pass = 0; pass < 2; pass++) {
    for (const pool of pools) {
      let total = 0;
      const list: ItemDef[] = [];
      for (const d of items) {
        if (!d.pools.includes(pool) || d.tags.includes('test') || locked.has(d.id)) continue;
        if (!anyKind && !isPedestalKind(d)) continue;
        if (pass === 0 && (used.has(d.id) || d.quality < minQuality)) continue;
        list.push(d);
        total += rollWeight(d);
      }
      if (list.length === 0) continue;
      let r = roll * total;
      let chosen = list[list.length - 1]!;
      for (const d of list) {
        const wt = rollWeight(d);
        if (r < wt) {
          chosen = d;
          break;
        }
        r -= wt;
      }
      used.add(chosen.id);
      return chosen.id;
    }
  }
  return '';
}

/** Magpie's Stall price of an item (before the haggler discount). */
export function itemPrice(id: string): number {
  const d = findItem(id);
  if (!d) return 15;
  if (d.kind === 'trinket') return TRINKET_PRICE;
  if (d.kind === 'consumable') return 5 + d.quality;
  return ITEM_PRICE[d.quality] ?? 15;
}
