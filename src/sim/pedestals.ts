/**
 * Item pedestals: a stone plinth offering one item. Touching it takes the item (Wren holds it
 * overhead ~0.8 s while the banner shows NAME + description). Taking an active while holding one
 * swaps: the old active (with its charge) is left on the pedestal, and can't be grabbed back until
 * the player steps away. Solid for the player (like a small pillar).
 *
 * Priced offers (Phase 3B): coins (Magpie's Stall; the 'haggler' flag takes 25 % off), heart
 * containers (the Broker's Nook; with no containers, Tin hearts instead) or keys (Old Pell). Shop GOODS
 * are pickups for sale on a pedestal slot (`goods` = a pickup kind): paid, then handed straight to the
 * player, and only sold when the player can take them. Choice GROUPS: taking one item makes the other
 * pedestals of its group vanish. Coin-operated PROPS share the slot pool (sim/shopProps.ts): the
 * donation jar, the Gumball Gambler and Old Pell himself (a trader with an item on offer).
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
import { BONUS_TIN, addContainers, bonusHalvesOf, containers, removeBonus, type Health } from './health';
import { addCounter } from './inventory';
import { pickItem, type ItemFilter } from './itemPools';
import { pickupName, type PickupKind } from './pickupKinds';
import { canTakeKind, collectKind, spawnItemPickup } from './pickups';
import { PROP_JAR, PROP_NONE, PROP_SLOTS, donate, playSlots, slotsPayout } from './shopProps';
import { ITEM_TUNING, SHOP_TUNING, YARD_TUNING } from './tuning';
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
  /** Old Pell: keys to pay (0 = free). */
  keys = 0;
  /** Shop goods: a pickup kind for sale instead of an item (-1 = none). */
  goods = -1;
  /** Choice group: taking this item makes the other pedestals of the group vanish (0 = none). */
  group = 0;
  /** Coin-operated prop (sim/shopProps PROP_*): donation jar, Gumball Gambler, Old Pell. */
  prop = PROP_NONE;
  /** Gumball Gambler: spinning (s left); blown open by a blast. */
  spinT = 0;
  broken = false;
  /** Jar / gambler: seconds before the next coin is taken. */
  coolT = 0;
  /** Vanished (a choice was made) or sold out: released at the end of the tick. */
  gone = false;
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
  ped.keys = 0;
  ped.goods = -1;
  ped.group = 0;
  ped.prop = PROP_NONE;
  ped.spinT = 0;
  ped.broken = false;
  ped.coolT = 0;
  ped.gone = false;
  return ped;
}

/** Shop goods for sale: a pickup on a pedestal slot. */
export function spawnGoods(w: World, x: number, y: number, kind: PickupKind, price: number): Pedestal | null {
  const ped = spawnPedestal(w, x, y, '');
  if (!ped) return null;
  ped.goods = kind;
  ped.price = price;
  return ped;
}

/** A coin-operated prop (PROP_JAR / PROP_SLOTS / PROP_TRADER) on a pedestal slot. */
export function spawnProp(w: World, x: number, y: number, prop: number, item: ItemId = ''): Pedestal | null {
  const ped = spawnPedestal(w, x, y, item);
  if (ped) ped.prop = prop;
  return ped;
}

/** A coin / key price after the 'haggler' discount (−25 %, at least 1). */
export function haggled(w: World, price: number): number {
  if (price <= 0) return 0;
  return w.player.flags.haggler ? Math.max(1, Math.round(price * SHOP_TUNING.haggle)) : price;
}

/** Every bonus heart is Tin (paying them all would leave nothing to live on). */
function tinOnly(h: Health): boolean {
  for (let i = 0; i < h.bonusCount; i++) if (h.bonusKind[i] !== BONUS_TIN) return false;
  return true;
}

/**
 * Pays for a priced offer: coins (after the haggler discount), keys, or heart containers — with no
 * containers left, 3 Tin hearts per container. Refuses (a 'denied' event, false) when the player can't
 * afford it, when goods couldn't be taken (a heart at full health), or when paying would leave nothing
 * to live on (a heart deal never takes the last heart).
 */
export function buyFromPedestal(w: World, ped: Pedestal): boolean {
  const p = w.player;
  const inv = p.inv;
  const price = haggled(w, ped.price);
  const keys = haggled(w, ped.keys);
  if (price > 0 && inv.coins < price) {
    w.events.emit('denied', ped.x, ped.y - 16, price, 0, 'poor');
    return false;
  }
  if (keys > 0 && inv.keys < keys) {
    w.events.emit('denied', ped.x, ped.y - 16, keys, 0, 'noKeys');
    return false;
  }
  if (ped.goods >= 0 && !canTakeKind(w, ped.goods as PickupKind)) {
    w.events.emit('denied', ped.x, ped.y - 16, 0, 0, 'full');
    return false;
  }
  if (ped.hearts > 0) {
    const h = p.health;
    const have = containers(h);
    if (have === 0) {
      const tin = ped.hearts * SHOP_TUNING.tinPerContainer * 2;
      const own = bonusHalvesOf(h, BONUS_TIN);
      if (own < tin || (own === tin && tinOnly(h))) {
        w.events.emit('denied', ped.x, ped.y - 16, ped.hearts, 1, 'noHearts');
        return false;
      }
      removeBonus(h, BONUS_TIN, tin);
    } else {
      if (have < ped.hearts || (have === ped.hearts && h.bonusCount === 0)) {
        w.events.emit('denied', ped.x, ped.y - 16, ped.hearts, 1, 'noHearts');
        return false;
      }
      addContainers(h, -ped.hearts);
    }
  }
  if (price > 0) addCounter(inv, 'coins', -price);
  if (keys > 0) addCounter(inv, 'keys', -keys);
  inv.version++;
  w.events.emit('buy', ped.x, ped.y - 12, price, ped.hearts, ped.goods >= 0 ? pickupName(ped.goods as PickupKind) : ped.item);
  w.events.emit('sfx', ped.x, ped.y, 0, 0, 'shop_buy');
  ped.price = 0;
  ped.hearts = 0;
  ped.keys = 0;
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
  if (ped.group > 0) vanishGroup(w, ped);
}

/** A choice was made: the other pedestals of the group vanish (released at the end of the tick). */
function vanishGroup(w: World, taken: Pedestal): void {
  const pool = w.pedestals;
  for (let i = 0; i < pool.count; i++) {
    const o = pool.items[i]!;
    if (o === taken || o.group !== taken.group || o.gone) continue;
    o.gone = true;
    w.events.emit('pedestalVanish', o.x, o.y - 12, 0, 0, o.item);
  }
  taken.group = 0;
}

export function updatePedestals(w: World, dt: number): void {
  const p = w.player;
  const pool = w.pedestals;
  const reach = p.r + ITEM_TUNING.pedestalRadius + ITEM_TUNING.pedestalReach;
  for (let i = 0; i < pool.count; i++) {
    const ped = pool.items[i]!;
    ped.age += dt;
    ped.changedT += dt;
    if (ped.coolT > 0) ped.coolT -= dt;
    if (ped.spinT > 0) {
      ped.spinT -= dt;
      if (ped.spinT <= 0) slotsPayout(w, ped);
    }
    if (ped.gone) continue;
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
    } else if (ped.prop === PROP_JAR) {
      donate(w, ped);
    } else if (ped.prop === PROP_SLOTS) {
      playSlots(w, ped);
    } else if (ped.goods >= 0) {
      // Shop goods: paid, then handed over (only when the player can take them).
      if (!buyFromPedestal(w, ped)) {
        ped.blocked = true;
        continue;
      }
      const kind = ped.goods as PickupKind;
      ped.goods = -1;
      ped.gone = true;
      collectKind(w, kind, ped.x, ped.y - 6);
    } else if (ped.item !== '') {
      // Priced (shop / nook / trader): pay first; can't afford it → refused until the player steps away.
      if ((ped.price > 0 || ped.hearts > 0 || ped.keys > 0) && !buyFromPedestal(w, ped)) {
        ped.blocked = true;
        continue;
      }
      if (ped.prop !== PROP_NONE) w.events.emit('trade', ped.x, ped.y - 12, 0, 0, ped.item);
      takeFromPedestal(w, ped);
    }
  }
  // Vanished choices and sold goods leave the room.
  for (let i = pool.count - 1; i >= 0; i--) if (pool.items[i]!.gone) pool.release(pool.items[i]!);
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
