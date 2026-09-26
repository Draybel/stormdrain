/**
 * What the player carries during a run. Plain ids + numbers so the run save can serialize it as-is.
 *
 * - passives: in pickup order, duplicates allowed (and counted — two copies stack).
 * - active: ONE active item with charge current/max; 'room' charge counts cleared rooms, 'timed'
 *   charge counts seconds. Picking up another active swaps (the old one is dropped).
 * - trinkets: 1 slot (2 with the extraTrinket flag). A new one when full drops the oldest.
 * - consumables: 1 slot (2 with the extraConsumable flag). Same swap rule.
 * - coins / bombs / keys: 0..99.
 */

import type { ItemDef, ItemId } from './types';

export const COUNTER_CAP = 99;

export type CounterId = 'coins' | 'bombs' | 'keys';

export interface ActiveSlot {
  id: ItemId;
  /** Current charge (rooms or seconds). */
  charge: number;
  max: number;
  timed: boolean;
}

export class Inventory {
  coins = 0;
  bombs = 0;
  keys = 0;
  readonly passives: ItemId[] = [];
  active: ActiveSlot | null = null;
  readonly trinkets: ItemId[] = [];
  trinketSlots = 1;
  readonly consumables: ItemId[] = [];
  consumableSlots = 1;
  /** Bumped on every change (HUD caches key on it). */
  version = 0;
}

export function counter(inv: Inventory, c: CounterId): number {
  return inv[c];
}

/** Adds (or removes, if negative) to a counter clamped to 0..99; returns the signed change. */
export function addCounter(inv: Inventory, c: CounterId, n: number): number {
  const before = inv[c];
  const after = Math.max(0, Math.min(COUNTER_CAP, before + Math.trunc(n)));
  inv[c] = after;
  if (after !== before) inv.version++;
  return after - before;
}

export function countItem(inv: Inventory, id: ItemId): number {
  let n = 0;
  for (let i = 0; i < inv.passives.length; i++) if (inv.passives[i] === id) n++;
  if (inv.active?.id === id) n++;
  for (let i = 0; i < inv.trinkets.length; i++) if (inv.trinkets[i] === id) n++;
  return n;
}

export function hasItem(inv: Inventory, id: ItemId): boolean {
  return countItem(inv, id) > 0;
}

/** Max charge for an active item def (0 = always usable). */
export function activeMax(def: ItemDef): number {
  return Math.max(0, def.active?.charge ?? 0);
}

/**
 * Equips an active item. `charge` < 0 means fully charged (fresh items come charged).
 * Returns the previously held active (to be dropped), or null.
 */
export function setActive(inv: Inventory, def: ItemDef, charge = -1): ActiveSlot | null {
  const prev = inv.active;
  const max = activeMax(def);
  inv.active = {
    id: def.id,
    max,
    timed: def.active?.chargeType === 'timed',
    charge: charge < 0 ? max : Math.min(max, charge),
  };
  inv.version++;
  return prev;
}

export function isCharged(slot: ActiveSlot | null): boolean {
  return !!slot && slot.charge >= slot.max;
}

/** Adds charge (or fills with 'full'); returns the amount added. */
export function addCharge(slot: ActiveSlot | null, amount: number | 'full'): number {
  if (!slot) return 0;
  const before = slot.charge;
  slot.charge = amount === 'full' ? slot.max : Math.min(slot.max, slot.charge + amount);
  return slot.charge - before;
}

/** Adds a trinket; when the slots are full the OLDEST is removed and returned (to be dropped). */
export function addTrinket(inv: Inventory, id: ItemId): ItemId | null {
  let dropped: ItemId | null = null;
  if (inv.trinkets.length >= inv.trinketSlots) dropped = inv.trinkets.shift() ?? null;
  inv.trinkets.push(id);
  inv.version++;
  return dropped;
}

/** Adds a consumable; when the slots are full the OLDEST is removed and returned (to be dropped). */
export function addConsumable(inv: Inventory, id: ItemId): ItemId | null {
  let dropped: ItemId | null = null;
  if (inv.consumables.length >= inv.consumableSlots) dropped = inv.consumables.shift() ?? null;
  inv.consumables.push(id);
  inv.version++;
  return dropped;
}

/** Removes and returns the consumable to use next (slot 0), or null. */
export function takeConsumable(inv: Inventory): ItemId | null {
  const id = inv.consumables.shift() ?? null;
  if (id !== null) inv.version++;
  return id;
}

/** Removes one copy of a passive; returns true if one was held. */
export function removePassive(inv: Inventory, id: ItemId): boolean {
  const i = inv.passives.lastIndexOf(id);
  if (i < 0) return false;
  inv.passives.splice(i, 1);
  inv.version++;
  return true;
}
