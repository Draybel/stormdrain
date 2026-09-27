/**
 * Items pack A hooks (see docs/content-itemsA.md).
 *
 *   { type: 'hook', hook: 'itemsA.sporeCloud', params: { radius: 30, dmg: 0.6, poison: 3, power: 0.35 } }
 *
 * - `itemsA.sporeCloud`: a puff of stinging spores at the effect position (the Sporeling
 *   transformation and the Fairy Ring put one where a foe dies): area damage of `dmg` × the player's
 *   damage, then poison (`poison` s, `power` × the player's damage per tick, at least 1) on every
 *   enemy and training dummy in reach. Scaling with the player's damage lets it keep up with a build;
 *   kills it causes fire the 'kill' trigger again, so clouds can chain (trigger nesting stops at 3).
 *
 * Like every content hook it only imports sim/hooks.ts (plus types) and works through `ctx.api` and
 * the World's public pools, so the registry → hooks → sim import cycle can't happen.
 */

import { numParam, registerHook } from '../../sim/hooks';

/**
 * Player-side area damage (sim/hittable SRC_BOMB). Mirrored here instead of imported: a runtime import
 * of sim/hittable would pull the sim into the content registry's hook loading.
 */
const SRC_AREA = 1;

registerHook('itemsA.sporeCloud', (ctx) => {
  const w = ctx.w;
  const radius = numParam(ctx, 'radius', 28);
  const dmgStat = w.player.stats.damage;
  const damage = numParam(ctx, 'dmg', 0.6) * dmgStat;
  const duration = numParam(ctx, 'poison', 3);
  const power = Math.max(1, numParam(ctx, 'power', 0.35) * dmgStat);
  if (damage > 0) ctx.api.damageArea(ctx.x, ctx.y, radius, damage);
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (!e.hittable) continue;
    const dx = e.x - ctx.x;
    const dy = e.y - ctx.y;
    const rr = radius + e.r;
    if (dx * dx + dy * dy < rr * rr) e.applyStatus('poison', duration, power, SRC_AREA);
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (!d.hittable) continue;
    const dx = d.x - ctx.x;
    const dy = d.y - ctx.y;
    const rr = radius + d.r;
    if (dx * dx + dy * dy < rr * rr) d.applyStatus('poison', duration, power, SRC_AREA);
  }
  // A green puff (the poison status burst) and its hiss, right where the cloud bursts.
  ctx.api.emit('status', ctx.x, ctx.y - 6, 0, SRC_AREA, 'spores');
});
