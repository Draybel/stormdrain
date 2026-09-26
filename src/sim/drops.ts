/**
 * Drop tables → pickups. Rolls use the run's seeded `lootRng`, so the same seed and the same
 * sequence of breakages always yields the same loot. Allocates a small result array per roll
 * (drops are event-driven — a crate breaking, a chest opening — never per tick).
 */

import type { Rng } from '../engine/rng';
import { pickupKindOf, type PickupKind } from './pickupKinds';
import type { DropTableDef, PoolId } from './types';

export interface DropRoll {
  kind: PickupKind;
  /** Item pool for trinket/consumable outcomes. */
  pool: PoolId | undefined;
}

/** The nothing-weight after luck (luck shrinks it; bad luck grows it, both bounded). */
export function nothingWeight(table: DropTableDef, luck: number): number {
  const base = table.nothing ?? 0;
  if (base <= 0) return 0;
  const k = 1 - luck * (table.luck ?? 0);
  return base * (k < 0.2 ? 0.2 : k > 2 ? 2 : k);
}

/** Rolls a table. Deterministic for a given rng state. */
export function rollDrops(table: DropTableDef, rng: Rng, luck = 0): DropRoll[] {
  const out: DropRoll[] = [];
  const rolls = rng.int(table.rolls[0], table.rolls[1]);
  const none = nothingWeight(table, luck);
  let total = none;
  for (const e of table.entries) total += Math.max(0, e.weight);
  if (total <= 0) return out;
  for (let r = 0; r < rolls; r++) {
    let x = rng.next() * total;
    if (x < none) continue;
    x -= none;
    let chosen = null as DropTableDef['entries'][number] | null;
    for (const e of table.entries) {
      const w = Math.max(0, e.weight);
      if (w <= 0) continue;
      chosen = e; // float edge: falls back to the last positive entry
      if (x < w) break;
      x -= w;
    }
    if (!chosen) continue;
    const kind = pickupKindOf(chosen.kind);
    const n = Math.max(1, chosen.count ?? 1);
    for (let i = 0; i < n; i++) out.push({ kind, pool: chosen.pool });
  }
  return out;
}
