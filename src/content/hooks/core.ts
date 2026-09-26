/**
 * General-purpose effect hooks usable from any item/synergy data:
 *   { type: 'hook', hook: 'shockwave', params: { radius: 64, damage: 24 } }
 */

import { numParam, registerHook, strParam } from '../../sim/hooks';

/** A ring of force around the effect position: damages every hittable inside. */
registerHook('shockwave', (ctx) => {
  const radius = numParam(ctx, 'radius', 56);
  const damage = numParam(ctx, 'damage', 20);
  ctx.api.emit('nova', ctx.x, ctx.y - 4, radius, 0, strParam(ctx, 'look', 'shock'));
  ctx.api.damageArea(ctx.x, ctx.y, radius, damage);
});

/** A full explosion at the effect position (tiles, pickups, chain reactions — and it can hurt you). */
registerHook('explode', (ctx) => {
  ctx.api.explode(ctx.x, ctx.y, numParam(ctx, 'radius', 40), numParam(ctx, 'damage', 50));
});

/** Rolls a drop table at the effect position: { table: 'crate' }. */
registerHook('dropTable', (ctx) => {
  ctx.api.dropTable(strParam(ctx, 'table', 'crate'), ctx.x, ctx.y);
});
