/**
 * Effect hooks of the "items B" passives (ARCHITECTURE §1: named behaviour for unusual items).
 * Hooks only read and poke the World they are handed (`ctx.w`) and use `ctx.api` for sim services,
 * so this module imports nothing from the sim but types, constants and the hook registry.
 *
 *   { type: 'hook', hook: 'itemsB.statusBurst', params: { status: 'fear', radius: 90, duration: 3.5 } }
 *     Every enemy within `radius` px of the effect position gets the status (a nova shows the reach).
 *     Optional `power` (slow strength 0..1), `damage` (area damage on top), `look` ('shock' | 'ember').
 *   { type: 'hook', hook: 'itemsB.toll', params: { cost: 4, pickup: 'tinHeart' } }
 *     Takes `cost` coins (only if the player has them) and pops the pickup out at the effect position.
 */

import { numParam, registerHook, strParam } from '../../sim/hooks';
import { PICKUP_NAMES, STATUS_KINDS, type PickupName, type StatusKind } from '../../sim/types';

/**
 * Kill credit for statuses applied by an item burst: `SRC_BOMB` (player-side area effects) from
 * sim/hittable.ts. Mirrored here instead of imported so this hook module stays free of sim imports
 * (content registry → hooks → sim → registry would be a cycle).
 */
const SRC_ITEM_BURST = 1;

function isStatus(s: string): s is StatusKind {
  return (STATUS_KINDS as readonly string[]).includes(s);
}

function isPickup(s: string): s is PickupName {
  return (PICKUP_NAMES as readonly string[]).includes(s);
}

registerHook('itemsB.statusBurst', (ctx) => {
  const kind = strParam(ctx, 'status', 'fear');
  if (!isStatus(kind) || kind === 'knockback') return;
  const radius = numParam(ctx, 'radius', 80);
  const duration = numParam(ctx, 'duration', 3);
  const power = numParam(ctx, 'power', 0);
  const pool = ctx.w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i]!;
    if (!e.hittable) continue;
    const dx = e.x - ctx.x;
    const dy = e.y - ctx.y;
    const reach = radius + e.r;
    if (dx * dx + dy * dy > reach * reach) continue;
    e.applyStatus(kind, duration, power, SRC_ITEM_BURST);
  }
  const damage = numParam(ctx, 'damage', 0);
  if (damage > 0) ctx.api.damageArea(ctx.x, ctx.y, radius, damage);
  ctx.api.emit('nova', ctx.x, ctx.y - 4, radius, 0, strParam(ctx, 'look', 'shock'));
});

registerHook('itemsB.toll', (ctx) => {
  const cost = Math.max(0, Math.round(numParam(ctx, 'cost', 4)));
  const pickup = strParam(ctx, 'pickup', 'tinHeart');
  const inv = ctx.w.player.inv;
  if (!isPickup(pickup) || inv.coins < cost) return;
  inv.coins -= cost;
  inv.version++;
  ctx.api.spawnPickup(pickup, ctx.x, ctx.y);
  ctx.api.emit('sfx', ctx.x, ctx.y, 0, 0, 'shop_buy');
});
