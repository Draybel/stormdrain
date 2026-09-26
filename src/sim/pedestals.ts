/**
 * Item pedestals: a stone plinth offering one item. Touching it takes the item (Wren holds it
 * overhead ~0.8 s while the banner shows NAME + description). Taking an active while holding one
 * swaps: the old active (with its charge) is left on the pedestal, and can't be grabbed back until
 * the player steps away. Solid for the player (like a small pillar).
 */

import type { Poolable } from '../engine/pool';
import { findItem } from '../content/registry';
import { collectItem } from './effects';
import { spawnItemPickup } from './pickups';
import { ITEM_TUNING } from './tuning';
import type { ItemId } from './types';
import type { World } from './world';

export class Pedestal implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  /** Item offered ('' = empty pedestal). */
  item: ItemId = '';
  /** Charge of an active left here by a swap (-1 = fully charged / fresh). */
  charge = -1;
  /** False once the item has been held (its one-time pickup effects already ran). */
  fresh = true;
  /** Swap just happened: the player must step away before taking it again. */
  blocked = false;
  age = 0;
  /** Seconds since the item last changed (render sparkle / appear). */
  changedT = 9;
}

export function spawnPedestal(w: World, x: number, y: number, item: ItemId): Pedestal | null {
  const ped = w.pedestals.alloc();
  if (!ped) return null;
  ped.x = x;
  ped.y = y;
  ped.item = item;
  ped.charge = -1;
  ped.fresh = true;
  ped.blocked = false;
  ped.age = 0;
  ped.changedT = 9;
  return ped;
}

/** Takes the pedestal's item (the swap rules live in collectItem). */
export function takeFromPedestal(w: World, ped: Pedestal): void {
  const def = findItem(ped.item);
  if (!def) {
    ped.item = '';
    return;
  }
  const fresh = ped.fresh;
  const charge = ped.charge;
  ped.item = '';
  ped.charge = -1;
  ped.fresh = false;
  ped.changedT = 0;
  const res = collectItem(w, def, fresh, charge);
  const droppedActive = res.droppedActive;
  const droppedItem = res.droppedItem;
  if (droppedActive) {
    ped.item = droppedActive.id;
    ped.charge = droppedActive.charge;
    ped.fresh = false;
    ped.blocked = true;
  }
  if (droppedItem) spawnItemPickup(w, droppedItem, w.player.x, w.player.y, false);
}

export function updatePedestals(w: World, dt: number): void {
  const p = w.player;
  const pool = w.pedestals;
  const reach = p.r + ITEM_TUNING.pedestalRadius + ITEM_TUNING.pedestalReach;
  for (let i = 0; i < pool.count; i++) {
    const ped = pool.items[i]!;
    ped.age += dt;
    ped.changedT += dt;
    const dx = p.x - ped.x;
    const dy = p.y - ped.y;
    const touching = dx * dx + dy * dy < reach * reach;
    if (ped.blocked) {
      if (!touching) ped.blocked = false;
      continue;
    }
    if (touching && ped.item !== '' && !p.dead) takeFromPedestal(w, ped);
  }
}
