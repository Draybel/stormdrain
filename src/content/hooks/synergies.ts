/**
 * Special-synergy hooks (ARCHITECTURE §4.7, content in src/content/synergies/*.ts, table in SYNERGIES.md).
 *
 * A synergy's behaviour comes from its persistent effects (mods, stats, familiars…), its StyleOverride
 * and — for the flourishes nothing else does — these hooks, run from the synergy's TRIGGERS (fire, kill,
 * hurt, use, bomb, pickup, roomClear). Every hook is parameterised by data, e.g.
 *
 *   { type: 'trigger', on: 'kill', effects: [{ type: 'hook', hook: 'syn.ring', params: { needs: 'freeze', n: 10, style: 'ice' } }] }
 *
 * Shared params: `dmg` is a multiple of the player's damage stat; `status` / `time` / `power` put a status
 * on what is hit (poison / burn power is × the damage stat, at least 1; slow power is 0..1); `needs`
 * (kill triggers) runs the hook only when the fallen foe had that status; `at: 'player'` centres it on
 * the player instead of the trigger position; `look` is a 'nova' flavour ('shock', 'ember', 'frost',
 * 'spore', 'charm', 'ink', 'gold', 'water' or a '#rrggbb' colour); `sfx` plays a sound.
 *
 * Rules (like every content hook, see DECISIONS "content hooks import nothing from the sim"): only
 * sim/hooks.ts, the leaf modules sim/types.ts, sim/constants.ts and sim/tuning.ts, and type imports.
 * Hooks work on the World they are handed: its pools (allied enemy shots, allied creep, allied
 * shockwaves), the attack pipeline's explosion queue (player blasts never hurt the player) and
 * Hittable.hurt / applyStatus. Nothing here allocates: scratch arrays are module-level and sized once,
 * and every loop is capped (chain arcs share the pipeline's 32-per-tick budget).
 */

import { ROOM_H, ROOM_W } from '../../sim/constants';
import { getHook, numParam, registerHook, strParam, type HookCtx } from '../../sim/hooks';
import { ATTACK_TUNING, ENEMY_TUNING, PLAYER_TUNING } from '../../sim/tuning';
import { ENEMY_SHOT_STYLES, PICKUP_NAMES, STATUS_KINDS, type PickupName, type StatusKind } from '../../sim/types';
import type { Hittable } from '../../sim/hittable';
import type { World } from '../../sim/world';
import { ITEMS_C_TOOLS } from './itemsC';

/** sim/hittable.ts SRC_BOMB (player-side area damage, kill credited) and SRC_PLAYER — mirrored, see above. */
const SRC_AREA = 1;
const SRC_PLAYER = 0;
/** sim/attack/state.ts SK_BLADE, F_CAUGHT, F_CHILD — mirrored. */
const SK_BLADE = 1;
const F_CAUGHT = 256;
const F_CHILD = 512;

const CHARM_BIT = 1 << STATUS_KINDS.indexOf('charm');
const ALLY = ENEMY_TUNING.allyDamage;
/**
 * Allied shots never take the last `SHOT_RESERVE` enemy-shot slots (enemies keep firing), and stop once the
 * pool holds `SHOT_BUDGET` shots in all: an absurd build's rings of shards would otherwise cost every tick
 * what a whole bullet-hell costs.
 */
const SHOT_RESERVE = 80;
const SHOT_BUDGET = 200;
/** Where sky bolts start: just inside the top wall. */
const SKY_Y = -12;
const TAU = Math.PI * 2;
const STYLE_ICE = ENEMY_SHOT_STYLES.indexOf('ice');

// ── Targets ────────────────────────────────────────────────────────────────

const TGT_CAP = 96;
const PICK_CAP = 16;

/**
 * Scratch space of one running hook. Hooks re-enter: a bolt's damage can kill a foe, whose kill trigger
 * runs another synergy hook before the first one finishes (trigger nesting stops at 3). Each nesting level
 * gets its own scratch (switched by `reg`), so an inner hook never scribbles over the list an outer hook
 * is walking. All allocated once.
 */
interface Scratch {
  /** Targets: hittable enemies that are not charmed (charmed ones fight for you), then standing dummies. */
  readonly tgt: Hittable[];
  tgtN: number;
  /** pickNearest's result, nearest first, and the distances. */
  readonly pick: Hittable[];
  readonly pickD: Float64Array;
  /** The effect's centre (centreOf). */
  cx: number;
  cy: number;
}
const LEVELS = 6;
const levels: Scratch[] = [];
for (let i = 0; i < LEVELS; i++) {
  levels.push({ tgt: new Array<Hittable>(TGT_CAP), tgtN: 0, pick: new Array<Hittable>(PICK_CAP), pickD: new Float64Array(PICK_CAP), cx: 0, cy: 0 });
}
let depth = -1;
let S: Scratch = levels[0]!;

/** Registers a synergy hook that runs on its own scratch level (nesting deeper than LEVELS is skipped). */
function reg(name: string, fn: (ctx: HookCtx) => void): void {
  registerHook(name, (ctx) => {
    if (depth + 1 >= LEVELS) return;
    const outer = S;
    S = levels[++depth]!;
    try {
      fn(ctx);
    } finally {
      S = outer;
      depth--;
    }
  });
}

function collectTargets(w: World): number {
  const tgt = S.tgt;
  let n = 0;
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count && n < TGT_CAP; i++) {
    const e = enemies.items[i]!;
    if (e.hittable && (e.status.mask & CHARM_BIT) === 0) tgt[n++] = e;
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count && n < TGT_CAP; i++) {
    const d = dummies.items[i]!;
    if (d.hittable) tgt[n++] = d;
  }
  S.tgtN = n;
  return n;
}

/** Up to `max` targets nearest to (x, y) within `range` (edge distance), nearest first, into `S.pick`. */
function pickNearest(x: number, y: number, range: number, max: number): number {
  const { tgt, tgtN, pick, pickD } = S;
  const want = Math.min(PICK_CAP, Math.max(0, Math.floor(max)));
  let k = 0;
  for (let i = 0; i < tgtN; i++) {
    const h = tgt[i]!;
    const dx = h.x - x;
    const dy = h.y - y;
    const d = Math.sqrt(dx * dx + dy * dy) - h.r;
    if (d > range) continue;
    if (k < want) {
      let j = k++;
      while (j > 0 && pickD[j - 1]! > d) {
        pick[j] = pick[j - 1]!;
        pickD[j] = pickD[j - 1]!;
        j--;
      }
      pick[j] = h;
      pickD[j] = d;
    } else if (want > 0 && d < pickD[want - 1]!) {
      let j = want - 1;
      while (j > 0 && pickD[j - 1]! > d) {
        pick[j] = pick[j - 1]!;
        pickD[j] = pickD[j - 1]!;
        j--;
      }
      pick[j] = h;
      pickD[j] = d;
    }
  }
  return k;
}

/**
 * Status mask of the foe that just fell at (x, y) (kill triggers fire at its exact position while it is
 * still flagged dead in the pool), or -1 when there is none (a training dummy clears its statuses).
 */
function victimMask(w: World, x: number, y: number): number {
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (e.dead && e.x === x && e.y === y) return e.status.mask;
  }
  return -1;
}

/** `needs` param: true when there is no filter or the fallen foe had that status. */
function needsMet(ctx: HookCtx): boolean {
  const need = strParam(ctx, 'needs', '');
  if (need === '') return true;
  const idx = STATUS_KINDS.indexOf(need as StatusKind);
  if (idx < 0) return false;
  const mask = victimMask(ctx.w, ctx.x, ctx.y);
  return mask >= 0 && (mask & (1 << idx)) !== 0;
}

function isStatus(s: string): s is StatusKind {
  return (STATUS_KINDS as readonly string[]).includes(s) && s !== 'knockback';
}

function isPickup(s: string): s is PickupName {
  return (PICKUP_NAMES as readonly string[]).includes(s);
}

/** Enemy-shot / creep style index by name (unknown → `fallback`). */
function styleIndex(name: string, fallback: number): number {
  const i = ENEMY_SHOT_STYLES.indexOf(name as (typeof ENEMY_SHOT_STYLES)[number]);
  return i >= 0 ? i : fallback;
}

/** The `status` / `time` / `power` params on one target. */
function applyParamStatus(ctx: HookCtx, h: Hittable): void {
  const kind = strParam(ctx, 'status', '');
  if (kind === '' || !isStatus(kind)) return;
  const time = numParam(ctx, 'time', 3);
  const power = numParam(ctx, 'power', kind === 'slow' ? 0.5 : 0.35);
  const p = kind === 'poison' || kind === 'burn' ? Math.max(1, power * ctx.w.player.stats.damage) : power;
  h.applyStatus(kind, time, p, SRC_PLAYER);
}

/** Centre of the effect (S.cx, S.cy): the player (`at: 'player'`) or the trigger position. */
function centreOf(ctx: HookCtx): void {
  if (strParam(ctx, 'at', '') === 'player') {
    S.cx = ctx.w.player.x;
    S.cy = ctx.w.player.y;
  } else {
    S.cx = ctx.x;
    S.cy = ctx.y;
  }
}

// ── Spawning on the World's pools ──────────────────────────────────────────

/** A chain-lightning style arc (drawn a few frames), within the pipeline's per-tick arc budget. */
function arc(w: World, x1: number, y1: number, x2: number, y2: number, color: string): void {
  const a = w.atk;
  if (a.arcsThisTick >= ATTACK_TUNING.capChainArcs) return;
  a.arcsThisTick++;
  w.events.emitFx('chainArc', x1, y1, x2, y2, color);
}

/** An allied shot (it hurts enemies for `damage`, never the player); false when the pool is (nearly) full. */
function allyShot(w: World, x: number, y: number, vx: number, vy: number, damage: number, r: number, style: number, life: number): boolean {
  if (w.enemyShots.free <= SHOT_RESERVE || w.enemyShots.count >= SHOT_BUDGET) return false;
  const s = w.enemyShots.alloc();
  if (!s) return false;
  s.x = s.prevX = Math.max(1, Math.min(ROOM_W - 1, x));
  s.y = s.prevY = Math.max(1, Math.min(ROOM_H - 1, y));
  s.vx = vx;
  s.vy = vy;
  s.z = s.prevZ = ENEMY_TUNING.shotHeight;
  s.r = r;
  s.dmg = damage / ALLY;
  s.style = style;
  s.age = 0;
  s.life = life;
  s.accel = 0;
  s.curve = 0;
  s.phase = false;
  s.allied = true;
  s.owner = 0;
  s.lob = false;
  s.splash = s.creep = s.split = 0;
  s.fall = 0;
  s.creepLife = s.creepR = 0;
  return true;
}

/**
 * An allied puddle (hurts enemies standing in it: `perHalfSec` damage every 0.5 s, never the player).
 * One close by is refreshed, restyled and grown instead (the creep cap stays useful); a full pool
 * recycles the puddle closest to drying up.
 */
function allyPuddle(w: World, x: number, y: number, r: number, life: number, perHalfSec: number, style: number): void {
  const pool = w.creep;
  for (let i = 0; i < pool.count; i++) {
    const c = pool.items[i]!;
    if (!c.allied) continue;
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy < c.r * c.r) {
      c.life = c.maxLife = Math.max(c.life, life);
      c.r = Math.min(20, Math.max(c.r, r) + 0.5);
      c.dmg = Math.max(c.dmg, perHalfSec / (ALLY * 0.5));
      c.style = style;
      return;
    }
  }
  let c = pool.alloc();
  if (!c) {
    let best = pool.items[0]!;
    for (let i = 1; i < pool.count; i++) if (pool.items[i]!.life < best.life) best = pool.items[i]!;
    c = best;
  }
  c.x = Math.max(2, Math.min(ROOM_W - 2, x));
  c.y = Math.max(2, Math.min(ROOM_H - 2, y));
  c.r = Math.min(20, r);
  c.life = c.maxLife = life;
  c.dmg = perHalfSec / (ALLY * 0.5);
  c.style = style;
  c.allied = true;
  c.owner = 0;
  c.seed = w.combatRng.next();
}

/** A player blast through the attack pipeline's explosion queue (merged and capped there; never hurts her). */
function blast(w: World, x: number, y: number, radius: number, damage: number): void {
  const q = w.atk.explosions;
  if (q.n < q.x.length) {
    const i = q.n++;
    q.x[i] = x;
    q.y[i] = y;
    q.r[i] = radius;
    q.dmg[i] = damage;
    q.rocks[i] = 0;
    return;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < q.n; i++) {
    const dx = q.x[i]! - x;
    const dy = q.y[i]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  q.dmg[best] = q.dmg[best]! + damage;
  q.r[best] = Math.min(72, Math.max(q.r[best]!, radius) + 3);
}

/** Allied expanding ring (hurts grounded enemies once as it passes). Ids far above the enemies' own. */
let waveSerial = 1_000_000_000;
function allyWave(w: World, x: number, y: number, maxRad: number, speed: number, damage: number, band: number): boolean {
  const v = w.waves.alloc();
  if (!v) return false;
  v.x = x;
  v.y = y;
  v.rad = 2;
  v.maxRad = maxRad;
  v.speed = speed;
  v.dmg = damage / ALLY;
  v.band = band;
  v.hitPlayer = false;
  v.allied = true;
  v.owner = 0;
  v.id = ++waveSerial;
  return true;
}

/** Distance along the ray (x, y) + t·(dx, dy) to the room's walls (the lance only stops there). */
function wallDistance(x: number, y: number, dx: number, dy: number): number {
  let t = 1e9;
  if (dx > 1e-6) t = Math.min(t, (ROOM_W - x) / dx);
  else if (dx < -1e-6) t = Math.min(t, -x / dx);
  if (dy > 1e-6) t = Math.min(t, (ROOM_H - y) / dy);
  else if (dy < -1e-6) t = Math.min(t, -y / dy);
  return Math.max(0, Math.min(t, 480));
}

function sfx(ctx: HookCtx, x: number, y: number): void {
  const name = strParam(ctx, 'sfx', '');
  if (name) ctx.w.events.emit('sfx', x, y, 0, 0, name);
}

function nova(ctx: HookCtx, x: number, y: number, radius: number): void {
  const look = strParam(ctx, 'look', '');
  if (look) ctx.w.events.emit('nova', x, y - 4, radius, 0, look);
}

// ── One-time: the first activation ─────────────────────────────────────────

/**
 * A synergy's debut (SynergyDef.hook of every special synergy): a ring of sparks in the NEW shot colour
 * around the player, next to the SYNERGY: NAME pill, so the moment reads even mid-fight.
 */
reg('syn.debut', (ctx) => {
  const p = ctx.w.player;
  ctx.w.events.emit('nova', p.x, p.y - 4, 30, 0, p.attack.style.body);
});

// ── Area bursts, bolts, blasts ─────────────────────────────────────────────

/**
 * A burst around the centre: `dmg` × damage to every foe within `radius`, a status, an outward shove
 * (`push` px/s) and a nova. { radius, dmg, status, time, power, push, look, sfx, needs, at }
 */
reg('syn.burst', (ctx) => {
  if (!needsMet(ctx)) return;
  const w = ctx.w;
  centreOf(ctx);
  const cx = S.cx;
  const cy = S.cy;
  const radius = numParam(ctx, 'radius', 40);
  const dmg = numParam(ctx, 'dmg', 0) * w.player.stats.damage;
  const push = numParam(ctx, 'push', 0);
  const n = collectTargets(w);
  for (let i = 0; i < n; i++) {
    const h = S.tgt[i]!;
    if (!h.hittable) continue;
    const dx = h.x - cx;
    const dy = h.y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + h.r) continue;
    const nx = d > 1e-3 ? dx / d : 0;
    const ny = d > 1e-3 ? dy / d : 1;
    if (dmg > 0 || push > 0) h.hurt(dmg, SRC_AREA, nx * push, ny * push);
    applyParamStatus(ctx, h);
  }
  nova(ctx, cx, cy, radius);
  sfx(ctx, cx, cy);
});

/**
 * Bolts from the sky onto the `count` foes nearest to the centre (within `range`): `dmg` × damage each,
 * half of it splashing `radius` px around, and a status. { count, dmg, radius, range, color, status, time,
 * power, at }
 */
reg('syn.skyBolts', (ctx) => {
  const w = ctx.w;
  centreOf(ctx);
  collectTargets(w);
  const k = pickNearest(S.cx, S.cy, numParam(ctx, 'range', 400), numParam(ctx, 'count', 3));
  if (k === 0) return;
  const dmg = numParam(ctx, 'dmg', 1) * w.player.stats.damage;
  const radius = numParam(ctx, 'radius', 10);
  const color = strParam(ctx, 'color', '#fff27a');
  const rng = w.combatRng;
  for (let j = 0; j < k; j++) {
    const h = S.pick[j]!;
    if (!h.hittable) continue;
    const hx = h.x;
    const hy = h.y;
    arc(w, hx + rng.range(-10, 10), SKY_Y, hx, hy - 2, color);
    if (j < 2) w.events.emit('lobLand', hx, hy, radius + 4, STYLE_ICE, 'bolt');
    h.hurt(dmg, SRC_AREA, 0, 50);
    applyParamStatus(ctx, h);
    if (radius > 0) {
      for (let i = 0; i < S.tgtN; i++) {
        const o = S.tgt[i]!;
        if (o === h || !o.hittable) continue;
        const dx = o.x - hx;
        const dy = o.y - hy;
        const rr = radius + o.r;
        if (dx * dx + dy * dy < rr * rr) o.hurt(dmg * 0.5, SRC_AREA, dx * 4, dy * 4);
      }
    }
  }
});

/**
 * Strikes along the aim from the player to the wall (the Storm Lance's furrow): every `spacing` px (at
 * most `max`) a bolt from the sky, `dmg` × damage and a status within `radius`, and a crater — an allied
 * puddle of `crater` style (`craterR` px, `craterLife` s, `craterDmg` × damage every 0.5 s).
 * { spacing, max, dmg, radius, color, crater, craterR, craterLife, craterDmg, status, time, power }
 */
reg('syn.lineStrikes', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const ax = p.aimX;
  const ay = p.aimY;
  const al = Math.sqrt(ax * ax + ay * ay);
  if (al < 1e-6) return;
  const dx = ax / al;
  const dy = ay / al;
  const spacing = Math.max(12, numParam(ctx, 'spacing', 40));
  const max = Math.min(12, numParam(ctx, 'max', 6));
  const reach = wallDistance(p.x, p.y, dx, dy);
  const dmg = numParam(ctx, 'dmg', 0.8) * p.stats.damage;
  const radius = numParam(ctx, 'radius', 14);
  const color = strParam(ctx, 'color', '#fff27a');
  const crater = strParam(ctx, 'crater', '');
  const craterStyle = crater ? styleIndex(crater, 4) : -1;
  const craterR = numParam(ctx, 'craterR', 9);
  const craterLife = numParam(ctx, 'craterLife', 3);
  const craterDmg = numParam(ctx, 'craterDmg', 0.3) * p.stats.damage;
  const rng = w.combatRng;
  const n = collectTargets(w);
  let made = 0;
  for (let t = spacing * 0.75; t < reach - 4 && made < max; t += spacing) {
    const x = p.x + dx * t;
    const y = p.y + dy * t;
    arc(w, x + rng.range(-8, 8), SKY_Y, x, y, color);
    if (made === 0) w.events.emit('lobLand', x, y, radius, STYLE_ICE, 'bolt');
    else w.events.emitFx('eshotPop', x, y, 0, STYLE_ICE, '');
    for (let i = 0; i < n; i++) {
      const h = S.tgt[i]!;
      if (!h.hittable) continue;
      const hx = h.x - x;
      const hy = h.y - y;
      const rr = radius + h.r;
      if (hx * hx + hy * hy >= rr * rr) continue;
      h.hurt(dmg, SRC_AREA, hx * 3, hy * 3);
      applyParamStatus(ctx, h);
    }
    if (craterStyle >= 0) allyPuddle(w, x, y, craterR, craterLife, craterDmg, craterStyle);
    made++;
  }
});

/**
 * Crackling orbs hung along the aim from the player: allied shots that drift slowly (`drift` px/s) for
 * `life` s and burst on the first foe they touch (`dmg` × damage). { spacing, max, dmg, life, drift, r,
 * style }
 */
reg('syn.orbs', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const ax = p.aimX;
  const ay = p.aimY;
  const al = Math.sqrt(ax * ax + ay * ay);
  if (al < 1e-6) return;
  const dx = ax / al;
  const dy = ay / al;
  const spacing = Math.max(10, numParam(ctx, 'spacing', 26));
  const max = Math.min(10, numParam(ctx, 'max', 6));
  const reach = wallDistance(p.x, p.y, dx, dy);
  const dmg = numParam(ctx, 'dmg', 0.9) * p.stats.damage;
  const life = numParam(ctx, 'life', 2);
  const drift = numParam(ctx, 'drift', 10);
  const r = numParam(ctx, 'r', 3);
  const style = styleIndex(strParam(ctx, 'style', 'ice'), STYLE_ICE);
  const rng = w.combatRng;
  let made = 0;
  for (let t = spacing; t < reach - 6 && made < max; t += spacing) {
    const a = rng.next() * TAU;
    if (!allyShot(w, p.x + dx * t, p.y + dy * t, Math.cos(a) * drift, Math.sin(a) * drift, dmg, r, style, life)) break;
    made++;
  }
});

/**
 * Player blasts (queued like the explode modifier's: they never hurt her): `mode: 'ring'` = `n` blasts
 * `dist` px around the centre; `mode: 'foes'` = one on each of up to `max` foes. { mode, n, dist, max,
 * radius, dmg, at, needs, sfx }
 */
reg('syn.blasts', (ctx) => {
  if (!needsMet(ctx)) return;
  const w = ctx.w;
  centreOf(ctx);
  const radius = numParam(ctx, 'radius', 16);
  const dmg = numParam(ctx, 'dmg', 0.6) * w.player.stats.damage;
  if (strParam(ctx, 'mode', 'ring') === 'foes') {
    const n = collectTargets(w);
    const max = numParam(ctx, 'max', 12);
    let made = 0;
    for (let i = 0; i < n && made < max; i++) {
      const h = S.tgt[i]!;
      if (!h.hittable) continue;
      blast(w, h.x, h.y, radius, dmg);
      made++;
    }
  } else {
    const n = Math.min(12, numParam(ctx, 'n', 4));
    const dist = numParam(ctx, 'dist', 14);
    const off = w.combatRng.next() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU;
      blast(w, S.cx + Math.cos(a) * dist, S.cy + Math.sin(a) * dist, radius, dmg);
    }
  }
  sfx(ctx, S.cx, S.cy);
});

/**
 * Expanding allied rings from the centre (hurt grounded foes once as they pass): `count` rings, the k-th
 * reaching `radius` × (1 + 0.5k) at `speed` px/s. { count, radius, speed, dmg, band, at, look, sfx }
 */
reg('syn.waves', (ctx) => {
  const w = ctx.w;
  centreOf(ctx);
  const count = Math.min(4, numParam(ctx, 'count', 1));
  const radius = numParam(ctx, 'radius', 48);
  const speed = numParam(ctx, 'speed', 150);
  const dmg = numParam(ctx, 'dmg', 0.5) * w.player.stats.damage;
  const band = numParam(ctx, 'band', 5);
  for (let k = 0; k < count; k++) allyWave(w, S.cx, S.cy, radius * (1 + 0.5 * k), speed * (1 - 0.18 * k), dmg, band);
  const look = strParam(ctx, 'look', '');
  if (look === 'splash') w.events.emitFx('splash', S.cx, S.cy, 1, 4, '#8fc8f0');
  else if (look) nova(ctx, S.cx, S.cy, radius * 0.5);
  sfx(ctx, S.cx, S.cy);
});

/**
 * A gust from the player: foes within `radius` are shoved away (or yanked in with `pull: 1`) at `push`
 * px/s, take `dmg` × damage; `pop: 1` also pops hostile shots in reach. { radius, push, dmg, pull, pop,
 * look, sfx }
 */
reg('syn.gust', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const radius = numParam(ctx, 'radius', 64);
  const push = numParam(ctx, 'push', 240);
  const dmg = numParam(ctx, 'dmg', 0.3) * p.stats.damage;
  const pull = numParam(ctx, 'pull', 0) > 0;
  const n = collectTargets(w);
  for (let i = 0; i < n; i++) {
    const h = S.tgt[i]!;
    if (!h.hittable) continue;
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + h.r) continue;
    const nx = d > 1e-3 ? dx / d : 0;
    const ny = d > 1e-3 ? dy / d : 1;
    const k = pull ? -push * (0.35 + d / radius) : push * (1 - (0.5 * d) / radius);
    h.hurt(dmg, SRC_AREA, nx * k, ny * k);
    h.applyStatus('knockback', 0.25, 0, SRC_PLAYER);
  }
  if (numParam(ctx, 'pop', 0) > 0) {
    const pool = w.enemyShots;
    let popped = 0;
    for (let i = pool.count - 1; i >= 0; i--) {
      const s = pool.items[i]!;
      if (s.allied || s.lob) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (popped++ < 12) w.events.emitFx('eshotPop', s.x, s.y, 0, s.style);
      pool.release(s);
    }
  }
  nova(ctx, p.x, p.y, radius * 0.6);
  sfx(ctx, p.x, p.y);
});

// ── Allied shots ───────────────────────────────────────────────────────────

/**
 * A ring of `n` allied shots from the centre at `speed` px/s (`dmg` × damage each, `style`: 'ice' shards,
 * anything else the friendly pink). { n, speed, dmg, r, life, style, at, needs, sfx, look }
 */
reg('syn.ring', (ctx) => {
  if (!needsMet(ctx)) return;
  const w = ctx.w;
  centreOf(ctx);
  const n = Math.min(16, numParam(ctx, 'n', 8));
  const speed = numParam(ctx, 'speed', 140);
  const dmg = numParam(ctx, 'dmg', 0.6) * w.player.stats.damage;
  const r = numParam(ctx, 'r', 2.5);
  const life = numParam(ctx, 'life', 1.5);
  const style = styleIndex(strParam(ctx, 'style', 'charm'), 6);
  const off = w.combatRng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    if (!allyShot(w, S.cx, S.cy, Math.cos(a) * speed, Math.sin(a) * speed, dmg, r, style, life)) break;
  }
  nova(ctx, S.cx, S.cy, 18);
  sfx(ctx, S.cx, S.cy);
});

/**
 * Every foe carrying `needs` sheds a ring of `n` allied shots (at most `maxFoes` foes). { needs, n, speed,
 * dmg, r, life, style, maxFoes, sfx }
 */
reg('syn.foeRings', (ctx) => {
  const w = ctx.w;
  const idx = STATUS_KINDS.indexOf(strParam(ctx, 'needs', 'freeze') as StatusKind);
  if (idx < 0) return;
  const bit = 1 << idx;
  const n = Math.min(8, numParam(ctx, 'n', 4));
  const speed = numParam(ctx, 'speed', 130);
  const dmg = numParam(ctx, 'dmg', 0.5) * w.player.stats.damage;
  const r = numParam(ctx, 'r', 2.5);
  const life = numParam(ctx, 'life', 1.2);
  const style = styleIndex(strParam(ctx, 'style', 'charm'), 6);
  const maxFoes = numParam(ctx, 'maxFoes', 10);
  const enemies = w.enemies;
  let foes = 0;
  for (let i = 0; i < enemies.count && foes < maxFoes; i++) {
    const e = enemies.items[i]!;
    if (!e.hittable || (e.status.mask & bit) === 0) continue;
    foes++;
    const off = w.combatRng.next() * TAU;
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * TAU;
      allyShot(w, e.x + Math.cos(a) * (e.r + 2), e.y + Math.sin(a) * (e.r + 2), Math.cos(a) * speed, Math.sin(a) * speed, dmg, r, style, life);
    }
  }
  if (foes > 0) sfx(ctx, w.player.x, w.player.y);
});

/**
 * Little ghosts: `n` allied shots from the centre, each flying straight at one of the nearest foes.
 * { n, speed, dmg, r, life, style, range, needs }
 */
reg('syn.ghosts', (ctx) => {
  if (!needsMet(ctx)) return;
  const w = ctx.w;
  centreOf(ctx);
  collectTargets(w);
  const k = pickNearest(S.cx, S.cy, numParam(ctx, 'range', 160), numParam(ctx, 'n', 1));
  const speed = numParam(ctx, 'speed', 95);
  const dmg = numParam(ctx, 'dmg', 1.2) * w.player.stats.damage;
  const r = numParam(ctx, 'r', 3);
  const life = numParam(ctx, 'life', 3);
  const style = styleIndex(strParam(ctx, 'style', 'charm'), 6);
  for (let j = 0; j < k; j++) {
    const h = S.pick[j]!;
    const dx = h.x - S.cx;
    const dy = h.y - S.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) continue;
    allyShot(w, S.cx, S.cy - 4, (dx / d) * speed, (dy / d) * speed, dmg, r, style, life);
  }
  if (k > 0) w.events.emitFx('blink', S.cx, S.cy, 1, 6);
});

/**
 * Hostile shots turn: `mode: 'cone'` = those within `radius` px in front of her (`cone` rad either side
 * of the aim) fly off along the aim; `mode: 'all'` = every hostile shot in the room flies back the way it
 * came. They become allied (worth at least `dmg` × damage). { mode, radius, cone, speed, dmg, max }
 */
reg('syn.reflect', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const all = strParam(ctx, 'mode', 'cone') === 'all';
  const radius = numParam(ctx, 'radius', 34);
  const cone = numParam(ctx, 'cone', 1.1);
  const speed = numParam(ctx, 'speed', 200);
  const min = (numParam(ctx, 'dmg', 1) * p.stats.damage) / ALLY;
  const max = numParam(ctx, 'max', 60);
  const al = Math.sqrt(p.aimX * p.aimX + p.aimY * p.aimY);
  const ax = al > 1e-6 ? p.aimX / al : 0;
  const ay = al > 1e-6 ? p.aimY / al : 1;
  const cosCone = Math.cos(cone);
  const pool = w.enemyShots;
  let turned = 0;
  for (let i = 0; i < pool.count && turned < max; i++) {
    const s = pool.items[i]!;
    if (s.allied || s.lob) continue;
    let vx: number;
    let vy: number;
    if (all) {
      const v = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
      if (v > 1e-3) {
        vx = (-s.vx / v) * speed;
        vy = (-s.vy / v) * speed;
      } else {
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        const d = Math.max(1e-3, Math.sqrt(dx * dx + dy * dy));
        vx = (dx / d) * speed;
        vy = (dy / d) * speed;
      }
    } else {
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > radius) continue;
      if (d > 4 && (dx * ax + dy * ay) / d < cosCone) continue;
      // Off along the aim, keeping a little of where it was hit (a bat, not a laser).
      const sx = ax + (d > 1e-3 ? dx / d : 0) * 0.25;
      const sy = ay + (d > 1e-3 ? dy / d : 0) * 0.25;
      const l = Math.max(1e-3, Math.sqrt(sx * sx + sy * sy));
      vx = (sx / l) * speed;
      vy = (sy / l) * speed;
    }
    s.vx = vx;
    s.vy = vy;
    s.allied = true;
    s.owner = 0;
    s.accel = 0;
    s.curve = 0;
    s.age = 0;
    s.life = 2;
    if (s.dmg < min) s.dmg = min;
    if (turned < 12) w.events.emitFx('shotBounce', s.x, s.y, vx / speed, vy / speed, '#ffe8a0');
    turned++;
  }
  if (turned > 0) {
    w.events.emit('sfx', p.x, p.y, 0, 0, all ? 'bounce_ping' : 'swipe_hit');
    if (all) w.events.emit('nova', p.x, p.y - 4, 26, 0, 'gold');
  }
});

/**
 * Hostile shots in `radius` (0 = the whole room) slow to `factor` of their speed and stop speeding up.
 * { factor, radius, look, sfx }
 */
reg('syn.stall', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const factor = Math.max(0.05, Math.min(1, numParam(ctx, 'factor', 0.4)));
  const radius = numParam(ctx, 'radius', 0);
  const pool = w.enemyShots;
  let slowed = 0;
  for (let i = 0; i < pool.count; i++) {
    const s = pool.items[i]!;
    if (s.allied || s.lob) continue;
    if (radius > 0) {
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      if (dx * dx + dy * dy > radius * radius) continue;
    }
    s.vx *= factor;
    s.vy *= factor;
    if (s.accel > 0) s.accel = 0;
    s.life += 1;
    if (slowed++ < 10) w.events.emitFx('eshotPop', s.x, s.y, 0, s.style);
  }
  nova(ctx, p.x, p.y, 40);
  sfx(ctx, p.x, p.y);
});

// ── Status spreading ───────────────────────────────────────────────────────

/**
 * Contagion: when a foe carrying `needs` falls, it passes `status` (default: the same) on to the `max`
 * foes nearest to it within `radius`, with coloured arcs and `dmg` × damage. { needs, status, time, power,
 * radius, max, dmg, color, sfx }
 */
reg('syn.contagion', (ctx) => {
  if (!needsMet(ctx)) return;
  const w = ctx.w;
  const kind = strParam(ctx, 'status', strParam(ctx, 'needs', 'burn'));
  if (!isStatus(kind)) return;
  collectTargets(w);
  const k = pickNearest(ctx.x, ctx.y, numParam(ctx, 'radius', 48), numParam(ctx, 'max', 2));
  const time = numParam(ctx, 'time', 3);
  const power = numParam(ctx, 'power', kind === 'slow' ? 0.5 : 0.35);
  const pw = kind === 'poison' || kind === 'burn' ? Math.max(1, power * w.player.stats.damage) : power;
  const dmg = numParam(ctx, 'dmg', 0) * w.player.stats.damage;
  const color = strParam(ctx, 'color', '#ff9a40');
  for (let j = 0; j < k; j++) {
    const h = S.pick[j]!;
    if (!h.hittable) continue;
    arc(w, ctx.x, ctx.y - 4, h.x, h.y - h.r * 0.6, color);
    if (dmg > 0) h.hurt(dmg, SRC_AREA, 0, 0);
    h.applyStatus(kind, time, pw, SRC_PLAYER);
  }
  if (k > 0) sfx(ctx, ctx.x, ctx.y);
});

/** Loot from a fallen foe carrying `needs`: `kind` with `chance` + `luck` × luck (≤ `maxChance`). */
reg('syn.loot', (ctx) => {
  if (!needsMet(ctx)) return;
  const kind = strParam(ctx, 'kind', 'coin');
  if (!isPickup(kind)) return;
  const w = ctx.w;
  const c = Math.min(numParam(ctx, 'maxChance', 1), numParam(ctx, 'chance', 0.1) + numParam(ctx, 'luck', 0) * w.player.stats.luck);
  if (c <= 0 || w.combatRng.next() >= c) return;
  ctx.api.spawnPickup(kind, ctx.x, ctx.y);
});

// ── Puddles ────────────────────────────────────────────────────────────────

/**
 * Every allied puddle turns `style` (burning oil, a spore bog…), grows `grow` px (≤ 20) and puts a status
 * on every foe standing in it. { style, status, time, power, grow, sfx }
 */
reg('syn.puddles', (ctx) => {
  const w = ctx.w;
  const style = styleIndex(strParam(ctx, 'style', 'ember'), 4);
  const grow = numParam(ctx, 'grow', 0);
  const n = collectTargets(w);
  const pool = w.creep;
  let lit = 0;
  for (let i = 0; i < pool.count; i++) {
    const c = pool.items[i]!;
    if (!c.allied) continue;
    c.style = style;
    if (grow > 0) c.r = Math.min(20, c.r + grow);
    lit++;
    for (let j = 0; j < n; j++) {
      const h = S.tgt[j]!;
      if (!h.hittable) continue;
      const dx = h.x - c.x;
      const dy = (h.y - c.y) * 2;
      const rr = c.r + h.r * 0.5;
      if (dx * dx + dy * dy < rr * rr) applyParamStatus(ctx, h);
    }
  }
  if (lit > 0) sfx(ctx, w.player.x, w.player.y);
});

/**
 * Electrified puddles: every foe standing in an allied puddle takes `dmg` × damage with an arc from the
 * puddle, and puddles within `link` px of each other crackle together. { dmg, link, color, status, time,
 * power }
 */
reg('syn.conduct', (ctx) => {
  const w = ctx.w;
  const dmg = numParam(ctx, 'dmg', 0.4) * w.player.stats.damage;
  const link = numParam(ctx, 'link', 44);
  const color = strParam(ctx, 'color', '#9fdcff');
  const n = collectTargets(w);
  const pool = w.creep;
  let links = 0;
  for (let i = 0; i < pool.count; i++) {
    const c = pool.items[i]!;
    if (!c.allied || c.life < c.maxLife * 0.2) continue;
    for (let j = 0; j < n; j++) {
      const h = S.tgt[j]!;
      if (!h.hittable) continue;
      const dx = h.x - c.x;
      const dy = (h.y - c.y) * 2;
      const rr = c.r + h.r * 0.5;
      if (dx * dx + dy * dy >= rr * rr) continue;
      arc(w, c.x, c.y, h.x, h.y - h.r * 0.6, color);
      h.hurt(dmg, SRC_AREA, 0, 0);
      applyParamStatus(ctx, h);
    }
    for (let k = i + 1; k < pool.count && links < 6; k++) {
      const o = pool.items[k]!;
      if (!o.allied) continue;
      const dx = o.x - c.x;
      const dy = o.y - c.y;
      if (dx * dx + dy * dy > link * link) continue;
      arc(w, c.x, c.y, o.x, o.y, color);
      links++;
    }
  }
});

/**
 * A puddle under every familiar (candle drips, moth dust): allied `style` puddles of `r` px for `life` s
 * (`dmg` × damage every 0.5 s), and a status on foes within `r` + 4 px of it. { style, r, life, dmg,
 * status, time, power, max }
 */
reg('syn.familiarPuddles', (ctx) => {
  const w = ctx.w;
  const style = styleIndex(strParam(ctx, 'style', 'ember'), 4);
  const r = numParam(ctx, 'r', 6);
  const life = numParam(ctx, 'life', 2);
  const dmg = numParam(ctx, 'dmg', 0.15) * w.player.stats.damage;
  const max = numParam(ctx, 'max', 6);
  const n = collectTargets(w);
  const list = w.atk.familiars.list;
  let made = 0;
  for (let i = 0; i < list.length && made < max; i++) {
    const f = list[i]!;
    if (!f.alive) continue;
    allyPuddle(w, f.x, f.y + 3, r, life, dmg, style);
    made++;
    for (let j = 0; j < n; j++) {
      const h = S.tgt[j]!;
      if (!h.hittable) continue;
      const dx = h.x - f.x;
      const dy = h.y - f.y;
      const rr = r + 4 + h.r;
      if (dx * dx + dy * dy < rr * rr) applyParamStatus(ctx, h);
    }
  }
});

/**
 * Allied puddles rained onto open floor: `n` of them (`r` px, `life` s, `dmg` × damage every 0.5 s,
 * `style`) with splashes. { n, r, life, dmg, style, sfx }
 */
const spot = { x: 0, y: 0 };
reg('syn.puddleRain', (ctx) => {
  const w = ctx.w;
  const n = Math.min(12, numParam(ctx, 'n', 6));
  const r = numParam(ctx, 'r', 10);
  const life = numParam(ctx, 'life', 4);
  const dmg = numParam(ctx, 'dmg', 0.3) * w.player.stats.damage;
  const style = styleIndex(strParam(ctx, 'style', 'water'), 1);
  const tools = ITEMS_C_TOOLS.t;
  const rng = w.combatRng;
  for (let i = 0; i < n; i++) {
    const x = rng.range(16, ROOM_W - 16);
    const y = rng.range(12, ROOM_H - 12);
    if (tools) tools.freeSpot(w, x, y, spot);
    else {
      spot.x = x;
      spot.y = y;
    }
    allyPuddle(w, spot.x, spot.y, r, life, dmg, style);
    if (i < 6) w.events.emitFx('splash', spot.x, spot.y, 1, 2, '#8fc8f0');
  }
  sfx(ctx, w.player.x, w.player.y);
});

// ── Lines, tethers, choirs ─────────────────────────────────────────────────

/** Squared distance from (px, py) to the segment (x1, y1)–(x2, y2). */
function segDist2(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 1e-9 ? ((px - x1) * vx + (py - y1) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (x1 + vx * t);
  const dy = py - (y1 + vy * t);
  return dx * dx + dy * dy;
}

/**
 * The kite string: every blade in flight is tied back to its thrower, and the string zaps what crosses it
 * (`dmg` × damage within `width` px of the line, an arc along it). { dmg, width, color, max, status, time,
 * power }
 */
reg('syn.tether', (ctx) => {
  const w = ctx.w;
  const dmg = numParam(ctx, 'dmg', 0.5) * w.player.stats.damage;
  const width = numParam(ctx, 'width', 5);
  const color = strParam(ctx, 'color', '#bfe8ff');
  const max = numParam(ctx, 'max', 8);
  const n = collectTargets(w);
  const shots = w.projectiles;
  let lines = 0;
  for (let i = 0; i < shots.count && lines < max; i++) {
    const s = shots.items[i]!;
    const a = s.anchor;
    if (s.kind !== SK_BLADE || a === null || !a.alive || (s.flags & (F_CAUGHT | F_CHILD)) !== 0) continue;
    lines++;
    const hy = PLAYER_TUNING.shotHeight;
    arc(w, a.x, a.y - hy, s.x, s.y - s.z, color);
    for (let j = 0; j < n; j++) {
      const h = S.tgt[j]!;
      if (!h.hittable) continue;
      const rr = width + h.r;
      if (segDist2(h.x, h.y, a.x, a.y, s.x, s.y) >= rr * rr) continue;
      h.hurt(dmg, SRC_AREA, 0, 0);
      applyParamStatus(ctx, h);
    }
  }
});

/**
 * The lasso: foes near the aim line (within `reach` px ahead, `width` px either side) are yanked toward
 * her at `pull` px/s, take `dmg` × damage and are slowed for `slow` s. { reach, width, pull, dmg, slow,
 * color }
 */
reg('syn.lasso', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const al = Math.sqrt(p.aimX * p.aimX + p.aimY * p.aimY);
  if (al < 1e-6) return;
  const ax = p.aimX / al;
  const ay = p.aimY / al;
  const reach = numParam(ctx, 'reach', 120);
  const width = numParam(ctx, 'width', 22);
  const pull = numParam(ctx, 'pull', 220);
  const dmg = numParam(ctx, 'dmg', 0.3) * p.stats.damage;
  const slow = numParam(ctx, 'slow', 1.5);
  const color = strParam(ctx, 'color', '#ff6a9a');
  const n = collectTargets(w);
  let caught = 0;
  for (let i = 0; i < n && caught < 8; i++) {
    const h = S.tgt[i]!;
    if (!h.hittable) continue;
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const along = dx * ax + dy * ay;
    if (along < 6 || along > reach) continue;
    if (Math.abs(dx * ay - dy * ax) > width + h.r) continue;
    const d = Math.max(1e-3, Math.sqrt(dx * dx + dy * dy));
    caught++;
    arc(w, p.x, p.y - PLAYER_TUNING.shotHeight, h.x, h.y - h.r * 0.6, color);
    h.hurt(dmg, SRC_AREA, (-dx / d) * pull, (-dy / d) * pull);
    h.applyStatus('knockback', 0.3, 0, SRC_PLAYER);
    if (slow > 0) h.applyStatus('slow', slow, 0.5, SRC_PLAYER);
  }
});

/**
 * The choir: every familiar zaps the foe nearest to it (within `range`) for `dmg` × damage — a bolt from
 * the familiar in `color`. { dmg, range, color, max, status, time, power, sfx }
 */
reg('syn.choir', (ctx) => {
  const w = ctx.w;
  const dmg = numParam(ctx, 'dmg', 0.6) * w.player.stats.damage;
  const range = numParam(ctx, 'range', 140);
  const color = strParam(ctx, 'color', '#fff0a8');
  const max = numParam(ctx, 'max', 12);
  collectTargets(w);
  const list = w.atk.familiars.list;
  let sang = 0;
  for (let i = 0; i < list.length && sang < max; i++) {
    const f = list[i]!;
    if (!f.alive) continue;
    if (pickNearest(f.x, f.y, range, 1) === 0) continue;
    const h = S.pick[0]!;
    sang++;
    arc(w, f.x, f.y - 8, h.x, h.y - h.r * 0.6, color);
    h.hurt(dmg, SRC_AREA, 0, 0);
    applyParamStatus(ctx, h);
  }
  if (sang > 0) sfx(ctx, w.player.x, w.player.y);
});

/**
 * A whirlpool around the player: foes within `radius` are dragged in and around (`pull` in, `swirl`
 * sideways, px/s), take `dmg` × damage and are slowed; `puddles` allied water puddles ring her.
 * { radius, pull, swirl, dmg, slow, puddles, r, sfx }
 */
reg('syn.vortex', (ctx) => {
  const w = ctx.w;
  const p = w.player;
  const radius = numParam(ctx, 'radius', 110);
  const pull = numParam(ctx, 'pull', 200);
  const swirl = numParam(ctx, 'swirl', 160);
  const dmg = numParam(ctx, 'dmg', 0.8) * p.stats.damage;
  const slow = numParam(ctx, 'slow', 2);
  const n = collectTargets(w);
  for (let i = 0; i < n; i++) {
    const h = S.tgt[i]!;
    if (!h.hittable) continue;
    const dx = h.x - p.x;
    const dy = h.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + h.r) continue;
    const nx = d > 1e-3 ? dx / d : 0;
    const ny = d > 1e-3 ? dy / d : 1;
    h.hurt(dmg, SRC_AREA, -nx * pull - ny * swirl, -ny * pull + nx * swirl);
    h.applyStatus('knockback', 0.4, 0, SRC_PLAYER);
    if (slow > 0) h.applyStatus('slow', slow, 0.5, SRC_PLAYER);
  }
  const puddles = Math.min(8, numParam(ctx, 'puddles', 6));
  const r = numParam(ctx, 'r', 9);
  const off = w.combatRng.next() * TAU;
  for (let i = 0; i < puddles; i++) {
    const a = off + (i / puddles) * TAU;
    allyPuddle(w, p.x + Math.cos(a) * 28, p.y + Math.sin(a) * 18, r, 3.5, 0.3 * p.stats.damage, 1);
  }
  w.events.emit('nova', p.x, p.y - 4, radius * 0.5, 0, 'water');
  sfx(ctx, p.x, p.y);
});

// ── Composition ────────────────────────────────────────────────────────────

/**
 * Runs another hook (`hook`) at every foe, up to `max` (this hook's params are passed along), e.g. the
 * Fairy Ring's spore cloud on everything in the room.
 */
const sub: { w: World; api: HookCtx['api']; x: number; y: number; source: string; params: HookCtx['params'] } = {
  w: null as unknown as World,
  api: null as unknown as HookCtx['api'],
  x: 0,
  y: 0,
  source: '',
  params: undefined,
};
let subDepth = 0;
const fx = new Float64Array(TGT_CAP);
const fy = new Float64Array(TGT_CAP);
reg('syn.everyFoe', (ctx) => {
  const name = strParam(ctx, 'hook', '');
  const fn = name && name !== 'syn.everyFoe' ? getHook(name) : undefined;
  if (!fn || subDepth > 0) return;
  const w = ctx.w;
  const n = collectTargets(w);
  const max = Math.min(n, numParam(ctx, 'max', 12));
  // The sub-hook may collect targets itself (the shared scratch list): copy the positions first.
  let k = 0;
  for (let i = 0; i < n && k < max; i++) {
    const h = S.tgt[i]!;
    if (!h.hittable) continue;
    fx[k] = h.x;
    fy[k] = h.y;
    k++;
  }
  subDepth++;
  try {
    for (let i = 0; i < k; i++) {
      sub.w = w;
      sub.api = ctx.api;
      sub.x = fx[i]!;
      sub.y = fy[i]!;
      sub.source = ctx.source;
      sub.params = ctx.params;
      fn(sub);
    }
  } finally {
    subDepth--;
  }
  if (k > 0) sfx(ctx, w.player.x, w.player.y);
});
