/**
 * Item pedestals: a stone plinth offering one item. Touching it takes the item (Wren holds it
 * overhead ~0.8 s while the banner shows NAME + description). Taking an active while holding one
 * swaps: the old active (with its charge) is left on the pedestal, and can't be grabbed back until
 * the player steps away. Solid for the player (like a small pillar).
 *
 * Training yard extras (Phase 2D):
 * - ROTATING pedestals (`rotate` filter) offer a new item from their pool every few seconds while
 *   nobody stands next to them, and refill shortly after their item was taken (`updateRotation`);
 * - the BELL is a pedestal slot without an item: bumping into it rings it (`w.bellRung`, the Sim then
 *   starts a wave). It rings once per touch.
 */

import type { Poolable } from '../engine/pool';
import type { Rng } from '../engine/rng';
import { findItem } from '../content/registry';
import { collectItem } from './effects';
import { addContainers, containers } from './health';
import { addCounter } from './inventory';
import { pickItem, type ItemFilter } from './itemPools';
import { spawnItemPickup } from './pickups';
import { ITEM_TUNING, YARD_TUNING } from './tuning';
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
  /** Seconds since the item last changed (render sparkle / appear; the bell's swing). */
  changedT = 9;
  /** Training-yard bell instead of an item plinth. */
  bell = false;
  /** Rotating pedestal: what it rolls from (null = a normal pedestal). */
  rotate: ItemFilter | null = null;
  /** Rotation timer (s): counts up to the next change / refill. */
  rotateT = 0;
  /** Magpie's Stall: coins to pay before the item can be taken (0 = free). */
  price = 0;
  /** Broker's Nook: heart containers to pay (0 = free). */
  hearts = 0;
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
  ped.bell = false;
  ped.rotate = null;
  ped.rotateT = 0;
  ped.price = 0;
  ped.hearts = 0;
  return ped;
}

/**
 * Pays for a priced pedestal (coins in the shop, heart containers in the Broker's Nook). Returns
 * false (with a 'denied' event) when the player can't afford it; a heart deal never takes the last
 * heart (with no containers left the player needs a bonus heart to stay alive).
 */
export function buyFromPedestal(w: World, ped: Pedestal): boolean {
  const p = w.player;
  const inv = p.inv;
  if (ped.price > 0 && inv.coins < ped.price) {
    w.events.emit('denied', ped.x, ped.y - 16, ped.price, 0, 'poor');
    return false;
  }
  if (ped.hearts > 0) {
    const have = containers(p.health);
    if (have < ped.hearts || (have === ped.hearts && p.health.bonusCount === 0)) {
      w.events.emit('denied', ped.x, ped.y - 16, ped.hearts, 1, 'noHearts');
      return false;
    }
    addContainers(p.health, -ped.hearts);
  }
  if (ped.price > 0) addCounter(inv, 'coins', -ped.price);
  inv.version++;
  w.events.emit('buy', ped.x, ped.y - 12, ped.price, ped.hearts, ped.item);
  w.events.emit('sfx', ped.x, ped.y, 0, 0, 'shop_buy');
  ped.price = 0;
  ped.hearts = 0;
  return true;
}

/** The training-yard bell (a pedestal slot without an item). */
export function spawnBell(w: World, x: number, y: number): Pedestal | null {
  const ped = spawnPedestal(w, x, y, '');
  if (ped) ped.bell = true;
  return ped;
}

/** Puts a new item on a pedestal (a fresh copy; flashes in). */
export function setPedestalItem(ped: Pedestal, item: ItemId): void {
  ped.item = item;
  ped.charge = -1;
  ped.fresh = true;
  ped.blocked = false;
  ped.changedT = 0;
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
  ped.rotateT = 0;
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
    if (!touching || p.dead) continue;
    if (ped.bell) {
      // Ring once per bump; the Sim starts the wave (a = 1 when one can start).
      ped.blocked = true;
      ped.changedT = 0;
      w.bellRung = true;
      w.events.emit('bell', ped.x, ped.y - 12, w.arena.active ? 0 : 1, 0);
    } else if (ped.item !== '') {
      // Priced (shop / nook): pay first; can't afford it → refused until the player steps away.
      if ((ped.price > 0 || ped.hearts > 0) && !buyFromPedestal(w, ped)) {
        ped.blocked = true;
        continue;
      }
      takeFromPedestal(w, ped);
    }
  }
}

const exclude = new Set<string>();

/**
 * Training yard: rotating pedestals offer a new item every `rotatePeriod` s while the player isn't
 * next to them, and refill `refillDelay` s after being emptied (once the player stepped away). Picks
 * come from `rng` (the room stream) and never repeat an item another pedestal is showing — held
 * items may come round again (stacking is the point).
 */
export function updateRotation(w: World, rng: Rng, dt: number): void {
  const p = w.player;
  const pool = w.pedestals;
  const near = YARD_TUNING.rotateNear;
  for (let i = 0; i < pool.count; i++) {
    const ped = pool.items[i]!;
    if (!ped.rotate || ped.bell) continue;
    const dx = p.x - ped.x;
    const dy = p.y - ped.y;
    if (dx * dx + dy * dy < near * near || ped.blocked) {
      // Hold still while the player is close (and give them a moment after stepping away).
      if (ped.rotateT > 0) ped.rotateT = Math.min(ped.rotateT, YARD_TUNING.rotatePeriod - 1);
      continue;
    }
    ped.rotateT += dt;
    const due = ped.item === '' ? YARD_TUNING.refillDelay : YARD_TUNING.rotatePeriod;
    if (ped.rotateT < due) continue;
    exclude.clear();
    for (let k = 0; k < pool.count; k++) {
      const o = pool.items[k]!;
      if (o.item) exclude.add(o.item);
    }
    ped.rotate.exclude = exclude;
    const def = pickItem(rng, ped.rotate);
    ped.rotate.exclude = undefined;
    ped.rotateT = 0;
    if (!def) continue;
    setPedestalItem(ped, def.id);
    w.events.emit('pedestalRoll', ped.x, ped.y - 16, 0, 0, def.id);
  }
}
