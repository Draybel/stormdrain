/**
 * Per-tick enemy update: statuses (damage over time), champion extras, spawn protection, targeting,
 * the movement behaviour → one shared integrator (acceleration, knockback, separation, grid
 * collision), attacks, and contact damage. No allocation per tick.
 */

import { vec2 } from '../../engine/math';
import { PHASE_MODE, WALK_MODE, resolveCircleVsCircle, resolveCircleVsGrid } from '../collision';
import { DMG_ENEMY, damagePlayer } from '../combat';
import { ROOM_H, ROOM_W } from '../constants';
import { SRC_ALLY, SRC_HAZARD, SRC_STATUS } from '../hittable';
import { ENEMY_TUNING, ITEM_TUNING, STATUS_TUNING } from '../tuning';
import type { World } from '../world';
import { updateAttacks } from './attackRunner';
import { feared } from './behaviors/common';
import { damageEnemy, killEnemy } from './damage';
import { updateBoss, updateBossFight } from '../bosses/brain';
import type { Enemy } from './enemy';
import { ST_CHARM, ST_FREEZE, ST_SLOW, hasStatus, statusSpeedMul, tickStatuses } from './status';

const pos = vec2();
const nrm = vec2();

function charmed(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

/** Flying or mid-hop: a different layer for separation and contact. */
function aloft(e: Enemy): boolean {
  return e.flying || e.z > 4;
}

export function updateEnemies(w: World, dt: number): void {
  const pool = w.enemies;
  updateBossFight(w, dt);
  if (pool.count === 0) return;
  separation(w);
  // Forward: enemies spawned during the loop (minions, splits) are appended and updated this tick too.
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i]!;
    if (!e.dead) updateEnemy(w, e, dt);
  }
  sweepEnemies(w);
}

/** Releases killed enemies from the pool (safe after any loop that may kill). */
export function sweepEnemies(w: World): void {
  const pool = w.enemies;
  for (let i = pool.count - 1; i >= 0; i--) if (pool.items[i]!.dead) pool.release(pool.items[i]!);
}

function acquireTarget(w: World, e: Enemy): void {
  e.tgtPlayer = false;
  if (charmed(e)) {
    // Fights for the player: go for the nearest enemy that isn't charmed.
    const pool = w.enemies;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (o === e || !o.hittable || charmed(o)) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) {
        bd = d2;
        best = o;
      }
    }
    e.hasTgt = best !== null;
    if (best) {
      e.tgtX = best.x;
      e.tgtY = best.y;
    }
    return;
  }
  const p = w.player;
  if (p.dead) {
    e.hasTgt = false;
    return;
  }
  e.tgtX = p.x;
  e.tgtY = p.y;
  e.hasTgt = true;
  e.tgtPlayer = true;
}

function updateEnemy(w: World, e: Enemy, dt: number): void {
  e.prevX = e.x;
  e.prevY = e.y;
  e.prevZ = e.z;
  e.age += dt;
  if (e.flash > 0) e.flash = Math.max(0, e.flash - dt);
  e.hurtT += dt;
  if (e.teleT > 0) e.teleT = Math.max(0, e.teleT - dt);
  if (e.allyT > 0) e.allyT -= dt;

  // Damage over time.
  if (e.status.mask !== 0) {
    const dot = tickStatuses(e.status, dt);
    if (dot.damage > 0) {
      damageEnemy(w, e, dot.damage, SRC_STATUS, 0, 0);
      if (e.dead) return;
    }
  }

  // Champion extras.
  const ch = e.champion;
  if (ch) {
    if (ch.regen && e.hurtT > ENEMY_TUNING.regenDelay && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ch.regen * dt);
    if (ch.phantom) {
      const T = ENEMY_TUNING;
      const ph = ((e.age + e.uid * 0.37) % T.phantomPeriod) / T.phantomPeriod;
      e.faded = ph < T.phantomFaded;
    }
  }

  const frozen = hasStatus(e.status, ST_FREEZE);
  e.snap = false;
  e.tvx = e.tvy = 0;

  if (e.spawnT > 0) {
    // Poof: inactive and harmless for a moment (fair room entries).
    e.spawnT -= dt;
    e.vx = e.vy = 0;
    integrate(w, e, dt, frozen);
    return;
  }

  acquireTarget(w, e);
  const spd = e.speed * statusSpeedMul(e.status);
  const rate = hasStatus(e.status, ST_SLOW) ? STATUS_TUNING.slowAttackRate : 1;
  if (e.boss !== null) {
    // Bosses: phases, patterns, the death sequence (sim/bosses/brain.ts), then the shared integrator.
    updateBoss(w, e, dt, spd, rate);
    integrate(w, e, dt, false);
    if (!e.dead) contact(w, e);
    return;
  }
  if (e.anchor !== 0) {
    tethered(w, e, dt, rate);
    return;
  }
  if (e.stun > 0) e.stun = Math.max(0, e.stun - dt);
  const mv = e.cfg.move;

  if (frozen) {
    // Frozen solid mid-hop: drop to the floor.
    if (e.z > 0) {
      e.z = Math.max(0, e.z - 90 * dt);
      if (e.z === 0 && mv.kind === 'hop') {
        e.mode = 0;
        e.modeT = 0.4;
      }
    }
  } else if (e.stun > 0) {
    // Dazed by a heavy knockback.
  } else if (feared(e) && !mv.beh.handlesFear && !e.pinned) {
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) {
      e.tvx = (dx / d) * spd;
      e.tvy = (dy / d) * spd;
    }
  } else if (e.windAtk >= 0 && e.cfg.attacks[e.windAtk]!.p.still! > 0 && e.z <= 0) {
    // Plants its feet for the telegraph.
  } else {
    mv.beh.update(w, e, mv.p, dt, spd);
  }

  integrate(w, e, dt, frozen);
  updateAttacks(w, e, dt, rate);
  if (!e.dead) contact(w, e);
}

/** The enemy an anchored one orbits (by uid), or null when it is gone. */
function anchorOf(w: World, uid: number): Enemy | null {
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const o = pool.items[i]!;
    if (o.uid === uid) return o.dead || o.dying ? null : o;
  }
  return null;
}

/**
 * Tethered enemies (boss shield orbs): ride their orbit around the anchor, hide when it hides, die
 * with it. They still attack (their own attacks) and hurt on contact.
 */
function tethered(w: World, e: Enemy, dt: number, rate: number): void {
  const a = anchorOf(w, e.anchor);
  if (!a) {
    killEnemy(w, e, SRC_HAZARD);
    return;
  }
  e.anchorA += e.anchorW * dt;
  const x = a.x + Math.cos(e.anchorA) * e.anchorR;
  const y = a.y + Math.sin(e.anchorA) * e.anchorR * 0.8;
  e.x = x < e.r ? e.r : x > ROOM_W - e.r ? ROOM_W - e.r : x;
  e.y = y < e.r ? e.r : y > ROOM_H - e.r ? ROOM_H - e.r : y;
  e.vx = e.vy = 0;
  e.moving = true;
  e.hidden = a.hidden || a.burrowed;
  if (e.hidden) return;
  updateAttacks(w, e, dt, rate);
  if (!e.dead) contact(w, e);
}

function integrate(w: World, e: Enemy, dt: number, frozen: boolean): void {
  const T = ENEMY_TUNING;
  if (e.snap) {
    e.vx = e.tvx;
    e.vy = e.tvy;
  } else {
    let dvx = e.tvx - e.vx;
    let dvy = e.tvy - e.vy;
    const dl = Math.sqrt(dvx * dvx + dvy * dvy);
    const max = T.accel * dt;
    if (dl > max) {
      dvx *= max / dl;
      dvy *= max / dl;
    }
    e.vx += dvx;
    e.vy += dvy;
  }
  const k = Math.max(0, 1 - (frozen ? T.frozenDrag : T.knockDrag) * dt);
  e.kx *= k;
  e.ky *= k;
  if (e.kx * e.kx + e.ky * e.ky < 1) e.kx = e.ky = 0;

  if (e.noCollide) {
    e.sepX = e.sepY = 0;
    return;
  }

  const mx = (e.vx + e.kx) * dt + e.sepX;
  const my = (e.vy + e.ky) * dt + e.sepY;
  e.sepX = e.sepY = 0;
  const dist = Math.sqrt(mx * mx + my * my);
  const maxStep = Math.max(1, e.r * 0.75);
  const steps = dist > maxStep ? Math.ceil(dist / maxStep) : 1;
  const room = w.room;
  // Flyers, hoppers in the air and burrowers underground only meet the walls.
  const mode = aloft(e) || e.z > 0 || e.burrowed ? PHASE_MODE : WALK_MODE;
  const walker = !e.flying && e.z <= 0 && !e.burrowed;
  pos.x = e.x;
  pos.y = e.y;
  e.blocked = false;
  for (let s = 0; s < steps; s++) {
    pos.x += mx / steps;
    pos.y += my / steps;
    if (resolveCircleVsGrid(room, pos, e.r, mode, nrm)) {
      e.blocked = true;
      e.wallNX = nrm.x;
      e.wallNY = nrm.y;
      cancelInto(e, nrm.x, nrm.y);
    }
  }
  if (walker) {
    // Standing dummies and pedestals are solid for walkers.
    let pushed = false;
    const dummies = w.dummies;
    for (let i = 0; i < dummies.count; i++) {
      const d = dummies.items[i]!;
      if (!d.popped && resolveCircleVsCircle(pos, e.r, d.x, d.y, d.r, nrm)) pushed = true;
    }
    const peds = w.pedestals;
    for (let i = 0; i < peds.count; i++) {
      const pd = peds.items[i]!;
      if (resolveCircleVsCircle(pos, e.r, pd.x, pd.y, ITEM_TUNING.pedestalRadius, nrm)) pushed = true;
    }
    if (pushed) resolveCircleVsGrid(room, pos, e.r, mode, nrm);
  }
  if (pos.x < e.r) pos.x = e.r;
  else if (pos.x > ROOM_W - e.r) pos.x = ROOM_W - e.r;
  if (pos.y < e.r) pos.y = e.r;
  else if (pos.y > ROOM_H - e.r) pos.y = ROOM_H - e.r;
  const ddx = pos.x - e.x;
  const ddy = pos.y - e.y;
  e.x = pos.x;
  e.y = pos.y;
  e.moving = ddx * ddx + ddy * ddy > 0.01;
  if (!e.pinned && Math.abs(e.vx) > 4) e.face = e.vx > 0 ? 1 : -1;
}

function cancelInto(e: Enemy, nx: number, ny: number): void {
  const v = e.vx * nx + e.vy * ny;
  if (v < 0) {
    e.vx -= v * nx;
    e.vy -= v * ny;
  }
  const k = e.kx * nx + e.ky * ny;
  if (k < 0) {
    e.kx -= k * nx;
    e.ky -= k * ny;
  }
}

/** Soft pairwise separation (O(n²), n ≤ 64), written into sepX/sepY for the integrator. */
function separation(w: World): void {
  const pool = w.enemies;
  const n = pool.count;
  const k = ENEMY_TUNING.separation;
  for (let i = 0; i < n; i++) {
    const a = pool.items[i]!;
    if (a.dead || a.burrowed || a.hidden) continue;
    for (let j = i + 1; j < n; j++) {
      const b = pool.items[j]!;
      if (b.dead || b.burrowed || b.hidden || aloft(a) !== aloft(b)) continue;
      if (a.pinned && b.pinned) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-3) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const push = Math.min(3, (rr - d) * k);
      const wa = a.pinned ? 0 : b.pinned ? 1 : 0.5;
      const wb = 1 - wa;
      a.sepX -= dx * push * wa;
      a.sepY -= dy * push * wa;
      b.sepX += dx * push * wb;
      b.sepY += dy * push * wb;
    }
  }
}

/** Contact damage: the player (hostile), or other enemies (charmed). */
function contact(w: World, e: Enemy): void {
  const dmg = e.def.contact;
  if (dmg <= 0 || e.spawnT > 0 || e.intangible || e.z > 6 || hasStatus(e.status, ST_FREEZE)) return;
  const T = ENEMY_TUNING;
  const cr = e.r * T.contactScale;
  if (charmed(e)) {
    if (e.allyT > 0) return;
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (o === e || !o.hittable || charmed(o) || aloft(o) !== aloft(e)) continue;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const rr = cr + o.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 1;
      o.hurt(dmg * T.allyDamage, SRC_ALLY, (dx / d) * 120, (dy / d) * 120);
      e.allyT = T.allyContactEvery;
      return;
    }
    return;
  }
  const p = w.player;
  if (p.dead) return;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const rr = cr + p.r;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return;
  if (damagePlayer(w, dmg, DMG_ENEMY, e.uid)) {
    // A short shove apart so you aren't left standing inside it.
    const d = Math.sqrt(d2);
    const nx = d > 1e-4 ? dx / d : -p.faceX;
    const ny = d > 1e-4 ? dy / d : -p.faceY || 1;
    p.pushX += nx * T.playerPush;
    p.pushY += ny * T.playerPush;
  }
}
