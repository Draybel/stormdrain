/**
 * Pickups (DESIGN.md "Pickups"): coins, bombs, keys, hearts, spark cells, chests, and trinkets /
 * consumables lying on the floor. Pooled (cap 64).
 *
 * Feel: loot pops out with a little arc (and a bounce), slides with friction, bounces off walls,
 * rocks, pedestals and dummies, gets shoved by the player when it can't be taken, and blown around by
 * explosions. Overlapping pickups gently separate.
 * Rules: red hearts are only taken when they can heal (bonus hearts when there's room), spark cells
 * only with a chargeable active, counters stop at 99; chests open on touch (lockbox needs a key) and
 * burst into seeded loot.
 */

import { TAU, vec2 } from '../engine/math';
import type { Poolable } from '../engine/pool';
import { findDropTable, findItem } from '../content/registry';
import { WALK_MODE, resolveCircleVsGrid } from './collision';
import { ROOM_H, ROOM_W } from './constants';
import { rollDrops } from './drops';
import { chargeActive, collectItem, fireTrigger, recomputePlayer, smallSparkAmount } from './effects';
import { BONUS_EMBER, BONUS_TIN, addBonus, canAddBonus, canHeal, heal } from './health';
import { COUNTER_CAP, addCounter, isCharged } from './inventory';
import { pickItem } from './itemPools';
import { PICKUP_PUSH, PICKUP_RADIUS, PK, isChest, isItemPickup, type PickupKind } from './pickupKinds';
import { ITEM_TUNING, PICKUP_TUNING } from './tuning';
import type { ItemId, PoolId } from './types';
import type { World } from './world';

export class Pickup implements Poolable {
  alive = false;
  slot = 0;
  kind: PickupKind = PK.Coin;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  /** Height of the pop arc (px) and its vertical velocity. */
  z = 0;
  prevZ = 0;
  vz = 0;
  vx = 0;
  vy = 0;
  r = 3.5;
  age = 0;
  /** Can't be collected until this reaches 0 (you see it land first). */
  collectDelay = 0;
  /** Trinket / consumable pickups: the item they carry. */
  itemId: ItemId = '';
  /** False for items dropped by a swap (their one-time pickup effects already ran). */
  fresh = true;
  /** Just dropped by a swap: must stop touching the player before it can be taken back. */
  waitLeave = false;
  /** Chests: opened (stays as an empty prop). */
  opened = false;
  /** Lockbox without a key: "locked" feedback cooldown (s). */
  lockedT = 0;
  /** Seconds since the last landing / opening (render squash). */
  landT = 9;
  /** Cosmetic phase 0..1 (spin/sparkle offsets). */
  phase = 0;
}

// Touch outcomes.
const REFUSED = 0;
const TAKEN = 1;
const OPENED = 2;

const scratch = vec2();
const scratchN = vec2();

/** Spawns a pickup. `pop` launches it with an arc in a random direction (combatRng). */
export function spawnPickup(
  w: World,
  kind: PickupKind,
  x: number,
  y: number,
  pop: boolean,
  itemId: ItemId = '',
  fresh = true,
): Pickup | null {
  const pk = w.pickups.alloc();
  if (!pk) return null;
  const T = PICKUP_TUNING;
  pk.kind = kind;
  pk.r = PICKUP_RADIUS[kind]!;
  pk.x = pk.prevX = x;
  pk.y = pk.prevY = y;
  pk.z = pk.prevZ = 0;
  pk.vx = pk.vy = pk.vz = 0;
  pk.age = 0;
  pk.collectDelay = 0;
  pk.itemId = itemId;
  pk.fresh = fresh;
  pk.waitLeave = false;
  pk.opened = false;
  pk.lockedT = 0;
  pk.landT = 9;
  const rng = w.combatRng;
  pk.phase = rng.next();
  if (pop) {
    const a = rng.range(0, TAU);
    const s = rng.range(T.popOut[0], T.popOut[1]);
    pk.vx = Math.cos(a) * s;
    pk.vy = Math.sin(a) * s * 0.8;
    pk.vz = rng.range(T.popUp[0], T.popUp[1]);
    pk.z = pk.prevZ = 0.01;
    pk.collectDelay = T.collectDelay;
  }
  return pk;
}

/** Spawns loot of a kind; trinket/consumable kinds draw an item from `pool` (default 'chest'). */
export function spawnLoot(w: World, kind: PickupKind, pool: PoolId | undefined, x: number, y: number): Pickup | null {
  if (isItemPickup(kind)) {
    // Items still locked in the run's meta snapshot never drop (floor runs set world.lockedItems).
    const def = pickItem(w.lootRng, { pool: pool ?? 'chest', kind: kind === PK.Trinket ? 'trinket' : 'consumable', exclude: w.lockedItems ?? undefined });
    if (!def) return spawnPickup(w, PK.Coin, x, y, true);
    return spawnPickup(w, kind, x, y, true, def.id, true);
  }
  return spawnPickup(w, kind, x, y, true);
}

/** Drops a trinket/consumable item on the floor (a swap, or loot). */
export function spawnItemPickup(w: World, id: ItemId, x: number, y: number, fresh: boolean): Pickup | null {
  const def = findItem(id);
  if (!def || (def.kind !== 'trinket' && def.kind !== 'consumable')) return null;
  const pk = spawnPickup(w, def.kind === 'trinket' ? PK.Trinket : PK.Consumable, x, y, true, id, fresh);
  if (pk && !fresh) pk.waitLeave = true;
  return pk;
}

/** Rolls a drop table (lootRng + the player's luck) and pops the loot out at (x, y). Returns the count. */
export function spawnDrops(w: World, tableId: string, x: number, y: number): number {
  const table = findDropTable(tableId);
  if (!table) return 0;
  const rolls = rollDrops(table, w.lootRng, w.player.stats.luck);
  for (let i = 0; i < rolls.length; i++) spawnLoot(w, rolls[i]!.kind, rolls[i]!.pool, x, y);
  if (rolls.length > 0) w.events.emit('loot', x, y, rolls.length);
  return rolls.length;
}

/** Would touching this pickup take it right now? (Chests are opened, not taken.) */
export function wouldCollect(w: World, pk: Pickup): boolean {
  return canTakeKind(w, pk.kind);
}

/** Could the player take a pickup of this kind right now (room for it, something to heal…)? */
export function canTakeKind(w: World, kind: PickupKind): boolean {
  const p = w.player;
  const inv = p.inv;
  switch (kind) {
    case PK.Coin:
    case PK.SilverCoin:
    case PK.GoldCoin:
      return inv.coins < COUNTER_CAP;
    case PK.LuckyCoin:
      return true;
    case PK.Bomb:
    case PK.DoubleBomb:
      return inv.bombs < COUNTER_CAP;
    case PK.Key:
    case PK.KeyRing:
      return inv.keys < COUNTER_CAP;
    case PK.HalfHeart:
    case PK.Heart:
      return p.flags.noRedHearts ? canAddBonus(p.health, BONUS_TIN) : canHeal(p.health);
    case PK.TinHeart:
      return canAddBonus(p.health, BONUS_TIN);
    case PK.EmberHeart:
      return canAddBonus(p.health, BONUS_EMBER);
    case PK.SparkSmall:
    case PK.SparkFull:
      return !!inv.active && !isCharged(inv.active);
    case PK.Trinket:
    case PK.Consumable:
      return true;
    default:
      return false;
  }
}

/**
 * Gives the player a pickup of this kind directly (shop goods): applied like touching one, with the
 * 'pickup' event and trigger. Returns the amount gained.
 */
export function collectKind(w: World, kind: PickupKind, x: number, y: number): number {
  const amount = applyKind(w, kind);
  w.counters.pickups++;
  w.events.emit('pickup', x, y, kind, amount);
  fireTrigger(w, 'pickup', x, y);
  return amount;
}

/** Applies a collectible pickup. Returns the amount gained (for the event / HUD). */
function applyPickup(w: World, pk: Pickup): number {
  return applyKind(w, pk.kind);
}

function applyKind(w: World, kind: PickupKind): number {
  const p = w.player;
  const inv = p.inv;
  switch (kind) {
    case PK.Coin:
      return addCounter(inv, 'coins', 1);
    case PK.SilverCoin:
      return addCounter(inv, 'coins', 5);
    case PK.GoldCoin:
      return addCounter(inv, 'coins', 10);
    case PK.LuckyCoin:
      addCounter(inv, 'coins', 1);
      p.luckBonus += ITEM_TUNING.luckyCoinLuck;
      recomputePlayer(w);
      return 1;
    case PK.Bomb:
      return addCounter(inv, 'bombs', 1);
    case PK.DoubleBomb:
      return addCounter(inv, 'bombs', 2);
    case PK.Key:
      return addCounter(inv, 'keys', 1);
    case PK.KeyRing:
      return addCounter(inv, 'keys', 2);
    case PK.HalfHeart:
    case PK.Heart: {
      const n = kind === PK.Heart ? 2 : 1;
      inv.version++;
      return p.flags.noRedHearts ? addBonus(p.health, BONUS_TIN, n) : heal(p.health, n);
    }
    case PK.TinHeart:
      inv.version++;
      return addBonus(p.health, BONUS_TIN, 2);
    case PK.EmberHeart:
      inv.version++;
      return addBonus(p.health, BONUS_EMBER, 2);
    case PK.SparkSmall:
      return inv.active ? chargeActive(w, smallSparkAmount(inv.active)) : 0;
    case PK.SparkFull:
      return chargeActive(w, 'full');
    default:
      return 0;
  }
}

function openChest(w: World, pk: Pickup): number {
  if (pk.opened) return REFUSED;
  const inv = w.player.inv;
  if (pk.kind === PK.Lockbox) {
    if (inv.keys <= 0) {
      if (pk.lockedT <= 0) {
        pk.lockedT = PICKUP_TUNING.lockedCooldown;
        w.events.emit('denied', pk.x, pk.y - 10, 0, 0, 'locked');
      }
      return REFUSED;
    }
    addCounter(inv, 'keys', -1);
  }
  pk.opened = true;
  pk.landT = 0;
  w.counters.chestsOpened++;
  w.events.emit('chest', pk.x, pk.y - 3, pk.kind, 0);
  spawnDrops(w, pk.kind === PK.Lockbox ? 'lockbox' : 'satchel', pk.x, pk.y - 2);
  return OPENED;
}

/** The player touches a pickup that is ready: take it, open it, or refuse (then it gets shoved). */
function touchPickup(w: World, pk: Pickup): number {
  if (isChest(pk.kind)) return openChest(w, pk);
  if (!wouldCollect(w, pk)) return REFUSED;
  const p = w.player;
  if (isItemPickup(pk.kind)) {
    const def = findItem(pk.itemId);
    if (!def) return TAKEN;
    const res = collectItem(w, def, pk.fresh);
    const dropped = res.droppedItem;
    if (dropped) spawnItemPickup(w, dropped, p.x, p.y, false);
    return TAKEN;
  }
  const amount = applyPickup(w, pk);
  w.counters.pickups++;
  w.events.emit('pickup', pk.x, pk.y - pk.z, pk.kind, amount);
  fireTrigger(w, 'pickup', pk.x, pk.y);
  return TAKEN;
}

/** Reflects velocity off a contact normal with restitution `e`. */
function bounceOff(pk: { vx: number; vy: number }, nx: number, ny: number, e: number): void {
  const vn = pk.vx * nx + pk.vy * ny;
  if (vn < 0) {
    pk.vx -= (1 + e) * vn * nx;
    pk.vy -= (1 + e) * vn * ny;
  }
}

/**
 * Pushes a circle (pos, r) out of standing dummies and pedestals, bouncing `body` off them.
 * Shared by pickups and bombs.
 */
export function resolveVsProps(
  w: World,
  pos: { x: number; y: number },
  r: number,
  body: { vx: number; vy: number },
  e: number,
): void {
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.popped) continue;
    pushOut(pos, r, d.x, d.y, d.r, body, e);
  }
  const peds = w.pedestals;
  for (let i = 0; i < peds.count; i++) {
    const ped = peds.items[i]!;
    pushOut(pos, r, ped.x, ped.y, ITEM_TUNING.pedestalRadius, body, e);
  }
}

function pushOut(
  pos: { x: number; y: number },
  r: number,
  bx: number,
  by: number,
  br: number,
  body: { vx: number; vy: number },
  e: number,
): void {
  const dx = pos.x - bx;
  const dy = pos.y - by;
  const rr = r + br;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  const d = Math.sqrt(d2);
  const nx = d > 1e-6 ? dx / d : 0;
  const ny = d > 1e-6 ? dy / d : 1;
  pos.x = bx + nx * rr;
  pos.y = by + ny * rr;
  bounceOff(body, nx, ny, e);
}

export function updatePickups(w: World, dt: number): void {
  const T = PICKUP_TUNING;
  const p = w.player;
  const pool = w.pickups;
  const alive = !p.dead;
  for (let i = pool.count - 1; i >= 0; i--) {
    const pk = pool.items[i]!;
    pk.prevX = pk.x;
    pk.prevY = pk.y;
    pk.prevZ = pk.z;
    pk.age += dt;
    pk.landT += dt;
    if (pk.collectDelay > 0) pk.collectDelay -= dt;
    if (pk.lockedT > 0) pk.lockedT -= dt;

    // Pop arc with a bounce or two.
    if (pk.z > 0 || pk.vz > 0) {
      pk.vz -= T.gravity * dt;
      pk.z += pk.vz * dt;
      if (pk.z <= 0) {
        const impact = -pk.vz;
        pk.z = 0;
        pk.vz = impact > T.minBounce ? impact * T.bounce : 0;
        pk.landT = 0;
        if (impact > 60) w.events.emit('land', pk.x, pk.y, pk.kind, impact);
      }
    }
    const airborne = pk.z > 0;

    // Magnet flag: collectible pickups drift toward the player (never chests or items — no accidental swaps).
    if (alive && p.flags.magnet && !isChest(pk.kind) && !isItemPickup(pk.kind) && !pk.waitLeave && wouldCollect(w, pk)) {
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < T.magnetRadius * T.magnetRadius && d2 > 1e-4) {
        const d = Math.sqrt(d2);
        pk.vx += (dx / d) * T.magnetAccel * dt;
        pk.vy += (dy / d) * T.magnetAccel * dt;
      }
    }

    // Friction (much less while in the air), then integrate and collide.
    const k = Math.max(0, 1 - (airborne ? T.airDrag : T.friction) * dt);
    pk.vx *= k;
    pk.vy *= k;
    if (!airborne && pk.vx * pk.vx + pk.vy * pk.vy < 0.25) pk.vx = pk.vy = 0;
    moveBody(w, pk, pk.r, dt, T.wallBounce);

    // The player: take / open, else get shoved out of the way.
    if (!alive || pk.z > 6) continue;
    const dx = pk.x - p.x;
    const dy = pk.y - p.y;
    const rr = pk.r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) {
      if (pk.waitLeave && d2 > (rr + 2) * (rr + 2)) pk.waitLeave = false;
      continue;
    }
    if (!pk.waitLeave && pk.collectDelay <= 0 && !pk.opened) {
      const res = touchPickup(w, pk);
      if (res === TAKEN) {
        pool.release(pk);
        continue;
      }
    }
    shove(w, pk, dx, dy, d2, rr);
  }
  separate(w, dt);
}

/** Moves a refused pickup out of the player and gives it some of the player's momentum. */
function shove(w: World, pk: Pickup, dx: number, dy: number, d2: number, rr: number): void {
  const p = w.player;
  const d = Math.sqrt(d2);
  let nx: number;
  let ny: number;
  if (d > 1e-4) {
    nx = dx / d;
    ny = dy / d;
  } else {
    nx = p.faceX || 0;
    ny = p.faceY || 1;
  }
  const push = PICKUP_PUSH[pk.kind]!;
  pk.x += nx * (rr - d);
  pk.y += ny * (rr - d);
  const pv = p.vx * nx + p.vy * ny;
  const target = Math.max(pv * 1.15, PICKUP_TUNING.shove * 0.35) * push;
  const vn = pk.vx * nx + pk.vy * ny;
  if (vn < target) {
    pk.vx += (target - vn) * nx;
    pk.vy += (target - vn) * ny;
  }
  // Keep it out of walls right away (next tick bounces properly).
  scratch.x = pk.x;
  scratch.y = pk.y;
  resolveCircleVsGrid(w.room, scratch, pk.r, WALK_MODE, scratchN);
  clampToRoom(scratch, pk.r);
  pk.x = scratch.x;
  pk.y = scratch.y;
}

/** Fastest a pickup or bomb may slide (px/s) — explosions stack, chains of them shouldn't launch loot. */
export const MAX_BODY_SPEED = 360;

/** Keeps a circle inside the room interior (walls are always at the edges). */
export function clampToRoom(b: { x: number; y: number }, r: number): void {
  if (b.x < r) b.x = r;
  else if (b.x > ROOM_W - r) b.x = ROOM_W - r;
  if (b.y < r) b.y = r;
  else if (b.y > ROOM_H - r) b.y = ROOM_H - r;
}

/**
 * Moves a sliding body (pickup, bomb) by its velocity: speed-capped, sub-stepped so it can't tunnel
 * through walls or props, bouncing with restitution `e`, and finally clamped inside the room.
 */
export function moveBody(w: World, b: { x: number; y: number; vx: number; vy: number }, r: number, dt: number, e: number): void {
  const sp2 = b.vx * b.vx + b.vy * b.vy;
  if (sp2 > MAX_BODY_SPEED * MAX_BODY_SPEED) {
    const k = MAX_BODY_SPEED / Math.sqrt(sp2);
    b.vx *= k;
    b.vy *= k;
  }
  const dist = Math.sqrt(b.vx * b.vx + b.vy * b.vy) * dt;
  const maxStep = r * 0.75;
  const steps = dist > maxStep ? Math.ceil(dist / maxStep) : 1;
  const h = dt / steps;
  for (let s = 0; s < steps; s++) {
    scratch.x = b.x + b.vx * h;
    scratch.y = b.y + b.vy * h;
    if (resolveCircleVsGrid(w.room, scratch, r, WALK_MODE, scratchN)) bounceOff(b, scratchN.x, scratchN.y, e);
    resolveVsProps(w, scratch, r, b, e);
    clampToRoom(scratch, r);
    b.x = scratch.x;
    b.y = scratch.y;
  }
}

/** Soft separation so loot doesn't stack into one pixel (O(n²), n ≤ 64, grounded pickups only). */
function separate(w: World, _dt: number): void {
  const pool = w.pickups;
  const n = pool.count;
  const k = PICKUP_TUNING.separation;
  for (let i = 0; i < n; i++) {
    const a = pool.items[i]!;
    if (a.z > 0) continue;
    for (let j = i + 1; j < n; j++) {
      const b = pool.items[j]!;
      if (b.z > 0) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = a.r + b.r - 1;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-4 ? dx / d : 1;
      const ny = d > 1e-4 ? dy / d : 0;
      const overlap = (rr - d) * k;
      const pa = PICKUP_PUSH[a.kind]!;
      const pb = PICKUP_PUSH[b.kind]!;
      const sum = pa + pb;
      a.x -= nx * overlap * (pa / sum);
      a.y -= ny * overlap * (pa / sum);
      b.x += nx * overlap * (pb / sum);
      b.y += ny * overlap * (pb / sum);
      clampToRoom(a, a.r);
      clampToRoom(b, b.r);
    }
  }
}

/** Explosion push: radial impulse (fading with distance) and a little hop. */
export function pushPickups(w: World, x: number, y: number, radius: number, strength: number): void {
  const pool = w.pickups;
  for (let i = 0; i < pool.count; i++) {
    const pk = pool.items[i]!;
    const dx = pk.x - x;
    const dy = pk.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    const d = Math.sqrt(d2);
    const f = (1 - d / radius) * strength * PICKUP_PUSH[pk.kind]!;
    const nx = d > 1e-4 ? dx / d : 0;
    const ny = d > 1e-4 ? dy / d : 1;
    pk.vx += nx * f;
    pk.vy += ny * f;
    pk.vz = Math.max(pk.vz, f * 0.35);
    if (pk.z <= 0) pk.z = 0.01;
  }
}
