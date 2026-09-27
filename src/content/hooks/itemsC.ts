/**
 * Item-C hooks — the unusual parts of the actives (content/items/actives*.ts), trinkets
 * (trinkets*.ts) and consumables (consumables*.ts): room blasts, lightning strikes, room-wide
 * statuses, gusts and pulls, shields, bomb rain, pedestal rerolls, pickup copies, coin-operated
 * heals and wishes, teleports, map reveals, pickup rain, charge refunds, the Sour Tonic and the
 * Tonic "glug".
 *
 * Content hooks must not import sim modules (ARCHITECTURE §1 — it keeps the registry free of import
 * cycles) and HookApi only covers the basics, so the sim hands the extra services over instead:
 * src/sim/tonics.ts installs `ITEMS_C_TOOLS.t` when it loads. Hooks only ever run from
 * sim/effects.ts, which imports sim/tonics.ts, so the tools are always there when a hook runs.
 * World objects are used through their own fields and methods (pools, enemies, the player).
 *
 * Nothing here runs per tick: hooks fire on uses and triggers only.
 */

// sim/health.ts is pure (no imports), so it is safe here (no registry -> hooks -> sim cycle).
import { BONUS_TIN, canAddBonus, canHeal } from '../../sim/health';
import type { Hittable } from '../../sim/hittable';
import { numParam, registerHook, strParam, type HookCtx } from '../../sim/hooks';
import type { Pedestal } from '../../sim/pedestals';
import type { Pickup } from '../../sim/pickups';
import type { Effect, PickupName, StatusKind } from '../../sim/types';
import type { World } from '../../sim/world';

/** How much of the floor map a reveal shows (the minimap model's levels, src/sim/floor/minimap.ts). */
export type MapReveal = 'layout' | 'icons' | 'secrets' | 'full';
/** Where a teleport goes: a random room of the floor, or a special room. */
export type TeleportTarget = 'random' | 'treasure' | 'shop' | 'secret' | 'start';

/** Sim services for these hooks (installed by src/sim/tonics.ts). */
export interface ItemsCTools {
  /** Runs an effect list for `source` at (x, y), like an item use (persistent types become temporary). */
  run(w: World, effects: readonly Effect[], x: number, y: number, source: string): void;
  /** Adds active charge (rooms, or seconds for timed items; 'full' fills it). Returns the amount added. */
  chargeActive(w: World, amount: number | 'full'): number;
  /** Rebuilds the player's stats after a direct change (the permanent luck bonus). */
  recompute(w: World): void;
  /** Hurts the player by half hearts (respects i-frames and god mode); true if it landed. */
  hurtPlayer(w: World, halves: number): boolean;
  /** Player-side area damage to one hittable (credited to the player) with a knockback impulse (px/s). */
  hurt(t: Hittable, damage: number, kx: number, ky: number): void;
  /** Applies a status effect from the player's side (the status stacking rules apply). */
  status(t: Hittable, kind: StatusKind, duration: number, power: number): void;
  /** Drops a lit bomb with a fuse (s); false at the bomb cap. */
  spawnBomb(w: World, x: number, y: number, fuse: number): boolean;
  /** Swaps a pedestal's item for another of the same kind from the old item's first pool; false if none. */
  rerollPedestal(w: World, ped: Pedestal): boolean;
  /** Pops out a copy of a pickup lying in the room; false at the pickup cap. */
  copyPickup(w: World, pk: Pickup): boolean;
  /** A use that had nothing to do: an active gets its charge back, a consumable goes back in the slot. */
  refund(w: World, source: string): void;
  /** Makes sure this run's Mystery Tonics are dealt (sim/tonics.ts tonicState). */
  dealTonics(w: World): void;
  /** The free floor spot nearest (x, y): plain floor, clear of pedestals / dummies / the player. */
  freeSpot(w: World, x: number, y: number, out: { x: number; y: number }): void;
  /** Floor wiring (FLOOR_LINKS in sim/tonics.ts): false when there is no floor (training yard). */
  revealMap(w: World, level: MapReveal): boolean;
  teleport(w: World, to: TeleportTarget): boolean;
  /** False while the floor won't let her leave the room (a boss's death sequence): teleports refuse and refund. */
  canTeleport(w: World): boolean;
}

/** Filled in by src/sim/tonics.ts. */
export const ITEMS_C_TOOLS: { t: ItemsCTools | null } = { t: null };

/** Lightning bolt colour for strike arcs (chainArc id = colour). */
const BOLT = '#dff4ff';
/** Where strikes start: just inside the top wall. */
const SKY_Y = -12;
/** Hard cap on lightning strikes per use. */
const MAX_STRIKES = 24;

const spot = { x: 0, y: 0 };

function refused(ctx: HookCtx, t: ItemsCTools): void {
  ctx.api.emit('denied', ctx.w.player.x, ctx.w.player.y - 12, 0, 0, 'nothing');
  t.refund(ctx.w, ctx.source);
}

function sfx(ctx: HookCtx, fallback = ''): void {
  const name = strParam(ctx, 'sfx', fallback);
  if (name) ctx.api.emit('sfx', ctx.x, ctx.y, 0, 0, name);
}

function say(ctx: HookCtx): void {
  const text = strParam(ctx, 'say', '');
  if (text) ctx.api.emit('say', ctx.x, ctx.y, 0, 0, text);
}

/** Every hittable enemy and standing dummy (dummies make the training yard a fair test bench). */
function forEachTarget(w: World, fn: (h: Hittable) => void): void {
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (e.hittable) fn(e);
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.hittable) fn(d);
  }
}

/** Pops hostile enemy shots within `radius` of (x, y) (every one when radius ≤ 0). Returns how many. */
function popShots(w: World, x: number, y: number, radius: number): number {
  const pool = w.enemyShots;
  let n = 0;
  for (let i = pool.count - 1; i >= 0; i--) {
    const s = pool.items[i]!;
    if (s.allied) continue;
    if (radius > 0) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (dx * dx + dy * dy > radius * radius) continue;
    }
    if (n < 24) w.events.emitFx('eshotPop', s.x, s.y, 0, s.style);
    pool.release(s);
    n++;
  }
  return n;
}

/**
 * Cosmetic flourish for data-only uses: { sfx, look: 'shock'|'ember'|'blink'|'splash'|'status',
 * radius, color, status (index), shake, say }.
 */
registerHook('itemsC.fx', (ctx) => {
  const { api, x, y } = ctx;
  sfx(ctx);
  const look = strParam(ctx, 'look', '');
  if (look === 'shock' || look === 'ember') api.emit('nova', x, y - 4, numParam(ctx, 'radius', 36), 0, look);
  else if (look === 'blink') api.emit('blink', x, y, 0, numParam(ctx, 'radius', 8));
  else if (look === 'splash') api.emit('splash', x, y, 1, 8, strParam(ctx, 'color', '#bfe8ff'));
  else if (look === 'status') api.emit('status', x, y - 6, numParam(ctx, 'status', 0), 0, 'player');
  const shake = numParam(ctx, 'shake', 0);
  if (shake > 0) api.emit('shake', x, y, shake);
  say(ctx);
});

/**
 * A blast from the player: every foe within `radius` takes `damage` + `perDamage` × your damage
 * stat and is thrown outward; hostile shots in reach pop. { radius, damage, perDamage, look, sfx }
 */
registerHook('itemsC.blast', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const radius = numParam(ctx, 'radius', 240);
  const dmg = numParam(ctx, 'damage', 30) + numParam(ctx, 'perDamage', 3) * p.stats.damage;
  ctx.api.emit('nova', p.x, p.y - 4, Math.min(radius, 120), 0, strParam(ctx, 'look', 'shock'));
  ctx.api.damageArea(p.x, p.y, radius, dmg);
  popShots(w, p.x, p.y, radius);
  ctx.api.emit('shake', p.x, p.y, numParam(ctx, 'shake', 0.5));
  sfx(ctx, 'thunder');
  say(ctx);
});

/**
 * Lightning: a bolt from the sky onto every foe (and standing dummy, at most 24), each taking `damage` +
 * `perDamage` × your damage stat, then `extra` bolts on random open floor that splash half of that within
 * `radius` + 6 px. The player is never struck. { damage, perDamage, extra, radius, sfx, say, shake }
 */
registerHook('itemsC.lightning', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  const w = ctx.w;
  if (!t) return;
  const dmg = numParam(ctx, 'damage', 16) + numParam(ctx, 'perDamage', 2) * w.player.stats.damage;
  const radius = numParam(ctx, 'radius', 10);
  const rng = w.combatRng;
  let strikes = 0;
  forEachTarget(w, (h) => {
    if (strikes >= MAX_STRIKES) return;
    strikes++;
    w.events.emit('chainArc', h.x + rng.range(-10, 10), SKY_Y, h.x, h.y, BOLT);
    t.hurt(h, dmg, 0, 60);
    t.status(h, 'knockback', 0.15, 0);
  });
  const extra = Math.min(MAX_STRIKES - strikes, numParam(ctx, 'extra', 3));
  for (let i = 0; i < extra; i++) {
    t.freeSpot(w, rng.range(16, 192), rng.range(12, 100), spot);
    w.events.emit('chainArc', spot.x + rng.range(-10, 10), SKY_Y, spot.x, spot.y, BOLT);
    ctx.api.damageArea(spot.x, spot.y, radius + 6, dmg * 0.5);
  }
  ctx.api.emit('shake', w.player.x, w.player.y, numParam(ctx, 'shake', 0.35));
  sfx(ctx, 'thunder');
  say(ctx);
});

/**
 * A status on every foe (radius ≤ 0) or on those within `radius` of the effect position, plus
 * optional damage and popping hostile shots. { status, time, power, powerPerDamage, damage, perDamage, radius,
 * clearShots (1 = every hostile shot, else those in radius), sfx, say }
 */
registerHook('itemsC.statusAll', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const kind = strParam(ctx, 'status', 'slow') as StatusKind;
  const time = numParam(ctx, 'time', 4);
  const power = numParam(ctx, 'power', 0) + numParam(ctx, 'powerPerDamage', 0) * w.player.stats.damage;
  const dmg = numParam(ctx, 'damage', 0) + numParam(ctx, 'perDamage', 0) * w.player.stats.damage;
  const radius = numParam(ctx, 'radius', 0);
  const x = ctx.x;
  const y = ctx.y;
  forEachTarget(w, (h) => {
    if (radius > 0) {
      const dx = h.x - x;
      const dy = h.y - y;
      const rr = radius + h.r;
      if (dx * dx + dy * dy > rr * rr) return;
    }
    if (dmg > 0) t.hurt(h, dmg, 0, 0);
    t.status(h, kind, time, power);
  });
  if (numParam(ctx, 'clearShots', 0) > 0) popShots(w, x, y, radius);
  sfx(ctx);
  say(ctx);
});

/**
 * Pushes (or with pull = 1, yanks) every foe within `radius` of the player, hurting them a little,
 * and pops hostile shots in reach (not when pulling). { radius, push (px/s), damage, pull, sfx }
 */
registerHook('itemsC.gust', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const p = w.player;
  const radius = numParam(ctx, 'radius', 90);
  const push = numParam(ctx, 'push', 360);
  const dmg = numParam(ctx, 'damage', 4);
  const pull = numParam(ctx, 'pull', 0) > 0;
  forEachTarget(w, (h) => {
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + h.r) return;
    const nx = d > 1e-3 ? dx / d : 0;
    const ny = d > 1e-3 ? dy / d : 1;
    // Pulls scale with distance so everyone lands next to you, pushes fade with it.
    const k = pull ? -push * (0.35 + d / radius) : push * (1 - (0.5 * d) / radius);
    t.hurt(h, dmg, nx * k, ny * k);
    t.status(h, 'knockback', pull ? 0.6 : 0.3, 0);
  });
  if (!pull) popShots(w, p.x, p.y, radius);
  ctx.api.emit(pull ? 'blink' : 'shockwave', p.x, p.y, pull ? 1 : radius, pull ? 12 : 0);
  sfx(ctx);
  say(ctx);
});

/** Untouchable for `time` s (the i-frame flicker shows it), shoving close foes and shots off. { time, push, sfx } */
registerHook('itemsC.shield', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  const w = ctx.w;
  const p = w.player;
  if (p.dead) return;
  p.invuln = Math.max(p.invuln, numParam(ctx, 'time', 5));
  const push = numParam(ctx, 'push', 0);
  if (t && push > 0) {
    forEachTarget(w, (h) => {
      const dx = h.x - p.x;
      const dy = h.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 40 + h.r) return;
      const nx = d > 1e-3 ? dx / d : 0;
      const ny = d > 1e-3 ? dy / d : 1;
      t.hurt(h, 2, nx * push, ny * push);
    });
    popShots(w, p.x, p.y, 40);
  }
  ctx.api.emit('nova', p.x, p.y - 4, 22, 0, 'shock');
  sfx(ctx, 'tin_heart');
  say(ctx);
});

/**
 * Bomb rain: a lit bomb lands on each foe (up to `count`), the rest on random open floor;
 * fuses are staggered. Pair it with explosionImmune in the item's use list. { count, fuse, step }
 */
registerHook('itemsC.bombRain', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const rng = w.combatRng;
  const count = numParam(ctx, 'count', 8);
  const fuse = numParam(ctx, 'fuse', 0.8);
  const step = numParam(ctx, 'step', 0.12);
  let n = 0;
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count && n < count; i++) {
    const e = enemies.items[i]!;
    if (!e.hittable) continue;
    if (t.spawnBomb(w, e.x + rng.range(-4, 4), e.y + rng.range(-4, 4), fuse + n * step)) n++;
  }
  for (let guard = 0; n < count && guard < count * 2; guard++) {
    t.freeSpot(w, rng.range(16, 192), rng.range(12, 100), spot);
    if (t.spawnBomb(w, spot.x, spot.y, fuse + n * step)) n++;
    else break;
  }
  sfx(ctx, 'bomb_fuse');
  say(ctx);
});

/** Rerolls every item pedestal in the room (refunded when there is nothing to reroll). { sfx } */
registerHook('itemsC.reroll', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const pool = w.pedestals;
  let n = 0;
  for (let i = 0; i < pool.count; i++) {
    const ped = pool.items[i]!;
    if (ped.bell || ped.item === '') continue;
    if (t.rerollPedestal(w, ped)) n++;
  }
  if (n === 0) {
    refused(ctx, t);
    return;
  }
  ctx.api.emit('shake', ctx.x, ctx.y, 0.2);
  sfx(ctx, 'slot_spin');
  say(ctx);
});

/** Copies the pickup nearest to the player (refunded when the room has none). { sfx } */
registerHook('itemsC.copyPickup', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const p = w.player;
  const pool = w.pickups;
  let best: Pickup | null = null;
  let bestD = Infinity;
  for (let i = 0; i < pool.count; i++) {
    const k = pool.items[i]!;
    if (k.opened) continue;
    const d = (k.x - p.x) * (k.x - p.x) + (k.y - p.y) * (k.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  if (!best || !t.copyPickup(w, best)) {
    refused(ctx, t);
    return;
  }
  ctx.api.emit('blink', best.x, best.y, 1, 6);
  sfx(ctx, 'split_pop');
  say(ctx);
});

/**
 * Pay coins for red health (Tin hearts for those who can't hold red ones). Refused — and refunded —
 * when you can't pay or are already full. { cost, heal (half hearts), sfx }
 */
registerHook('itemsC.buyHeal', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const p = w.player;
  const cost = numParam(ctx, 'cost', 5);
  const halves = numParam(ctx, 'heal', 2);
  const tinOnly = p.flags.noRedHearts;
  // Full = the cocoa could give nothing: no red to heal, or (Marrow) no room for another half Tin heart.
  const full = tinOnly ? !canAddBonus(p.health, BONUS_TIN) : !canHeal(p.health);
  if (p.inv.coins < cost || full) {
    refused(ctx, t);
    return;
  }
  p.inv.coins -= cost;
  p.inv.version++;
  if (tinOnly) t.run(w, [{ type: 'hearts', tin: halves }], p.x, p.y, ctx.source);
  else ctx.api.healPlayer(halves);
  sfx(ctx, 'heal');
  say(ctx);
});

/** Toss coins for a permanent luck bonus (refused and refunded without the coins). { cost, luck, sfx } */
registerHook('itemsC.wish', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const p = w.player;
  const cost = numParam(ctx, 'cost', 5);
  if (p.inv.coins < cost) {
    refused(ctx, t);
    return;
  }
  p.inv.coins -= cost;
  p.inv.version++;
  p.luckBonus += numParam(ctx, 'luck', 0.5);
  t.recompute(w);
  ctx.api.emit('triggered', p.x, p.y - 4, 0, 0, ctx.source);
  sfx(ctx, 'donation');
  say(ctx);
});

/** A permanent luck bonus (like a Lucky Coin, bigger). { amount, sfx } */
registerHook('itemsC.luck', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const p = ctx.w.player;
  p.luckBonus += numParam(ctx, 'amount', 1);
  t.recompute(ctx.w);
  ctx.api.emit('triggered', p.x, p.y - 4, 0, 0, ctx.source);
  sfx(ctx, 'coin_lucky');
  say(ctx);
});

/**
 * Teleport through the floor wiring; without a floor, `to: 'random'` blinks to open floor across the
 * room (half a second of i-frames), anything else is refused and refunded. { to, sfx }
 */
registerHook('itemsC.teleport', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const p = w.player;
  const to = strParam(ctx, 'to', 'random') as TeleportTarget;
  const fromX = p.x;
  const fromY = p.y;
  // Not now (a boss is going down): refused and refunded — no in-room blink either.
  if (!t.canTeleport(w)) {
    refused(ctx, t);
    return;
  }
  if (!t.teleport(w, to)) {
    if (to !== 'random') {
      refused(ctx, t);
      return;
    }
    // Blink to the open floor farthest from danger: try a few spots, keep the one with the most room.
    const rng = w.combatRng;
    let bestX = p.x;
    let bestY = p.y;
    let bestScore = -1;
    for (let k = 0; k < 8; k++) {
      t.freeSpot(w, rng.range(16, 192), rng.range(12, 100), spot);
      let score = Math.hypot(spot.x - p.x, spot.y - p.y) * 0.25;
      let nearest = Infinity;
      const enemies = w.enemies;
      for (let i = 0; i < enemies.count; i++) {
        const e = enemies.items[i]!;
        if (!e.dead) nearest = Math.min(nearest, Math.hypot(e.x - spot.x, e.y - spot.y));
      }
      score += nearest === Infinity ? 0 : Math.min(nearest, 120);
      if (score > bestScore) {
        bestScore = score;
        bestX = spot.x;
        bestY = spot.y;
      }
    }
    p.placeAt(bestX, bestY);
    p.invuln = Math.max(p.invuln, 0.5);
  }
  ctx.api.emit('blink', fromX, fromY, 0, 9);
  ctx.api.emit('blink', p.x, p.y, 1, 9);
  sfx(ctx, 'teleport');
  say(ctx);
});

/** Reveals the floor map through the floor wiring (refused and refunded without a floor). { level, sfx } */
registerHook('itemsC.revealMap', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  if (!t.revealMap(ctx.w, strParam(ctx, 'level', 'full') as MapReveal)) {
    refused(ctx, t);
    return;
  }
  sfx(ctx, 'secret_found');
  say(ctx);
});

/** Pickups rain down on random open floor all over the room. { kind (PickupName), count, bonus, sfx } */
registerHook('itemsC.rain', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const w = ctx.w;
  const rng = w.combatRng;
  const kind = strParam(ctx, 'kind', 'coin') as PickupName;
  const count = numParam(ctx, 'count', 8);
  const bonus = strParam(ctx, 'bonus', '') as PickupName | '';
  for (let i = 0; i < count; i++) {
    t.freeSpot(w, rng.range(16, 192), rng.range(12, 100), spot);
    ctx.api.spawnPickup(bonus !== '' && i === 0 ? bonus : kind, spot.x, spot.y);
  }
  sfx(ctx, 'coin_gold');
  say(ctx);
});

/** Active charge: +`rooms` for room-charged items, `timed` × the max for timed ones. { rooms, timed } */
registerHook('itemsC.charge', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  const slot = ctx.w.player.inv.active;
  if (!t || !slot || slot.max <= 0) return;
  const added = t.chargeActive(ctx.w, slot.timed ? slot.max * numParam(ctx, 'timed', 0.25) : numParam(ctx, 'rooms', 1));
  if (added > 0) {
    ctx.api.emit('triggered', ctx.w.player.x, ctx.w.player.y - 4, 0, 0, ctx.source);
    sfx(ctx, 'spark_cell');
  }
});

/** The Sour Tonic: lose half a heart — unless that would be the last one, then it perks you up instead. */
registerHook('itemsC.sour', (ctx) => {
  const t = ITEMS_C_TOOLS.t;
  if (!t) return;
  const p = ctx.w.player;
  const h = p.health;
  let total = h.red;
  for (let i = 0; i < h.bonusCount; i++) total += h.bonusHalves[i]!;
  if (total <= 1) {
    t.run(ctx.w, [{ type: 'heal', amount: 2 }, { type: 'hearts', tin: 1 }], p.x, p.y, ctx.source);
    ctx.api.emit('say', p.x, p.y, 0, 0, 'SO SOUR IT WOKE YOU UP!');
    return;
  }
  t.hurtPlayer(ctx.w, numParam(ctx, 'halves', 1));
  sfx(ctx, 'curse');
});

/** Drinking any Tonic bottle: a splash in the bottle's colour. { color } */
registerHook('itemsC.glug', (ctx) => {
  const p = ctx.w.player;
  ctx.api.emit('splash', p.x, p.y, 1, 9, strParam(ctx, 'color', '#bfe8ff'));
  ctx.api.emit('sfx', p.x, p.y, 0, 0, 'tonic_drink');
});

/** Reading labels needs this run's tonics dealt: the Cracked Monocle does it when first picked up. */
registerHook('itemsC.readLabels', (ctx) => {
  ITEMS_C_TOOLS.t?.dealTonics(ctx.w);
});
