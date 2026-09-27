/**
 * Projectiles (§4.3): marbles, blades, crescents, bomb shots, split children, familiar shots and the
 * orbit rider's blades — one pooled class (`world.projectiles`, cap 700) driven by the modifier hooks
 * of the profile it was fired with.
 *
 * Per tick: motion hooks → velocity → (marbles past their range drop with gravity) → sub-stepped move
 * with wall/tile collision (wall hooks: bounce…) and target hits (hit hooks: split, chain…). Nothing
 * allocates; targets come from the per-tick snapshot (attack/targets.ts).
 */

import type { Poolable } from '../../engine/pool';
import { NO_CELL, PHASE_MODE, SHOT_MODE, firstBlockingCell, type CollideMode } from '../collision';
import { ROOM_H, ROOM_W } from '../constants';
import type { Enemy } from '../enemies/enemy';
import { HIT_ENEMY, SRC_PLAYER, type Hittable } from '../hittable';
import type { RoomGrid } from '../room';
import { hitTileWithShot } from '../tileFx';
import { Tile } from '../tiles';
import { ATTACK_TUNING, ENEMY_TUNING, MARBLE_TUNING } from '../tuning';
import type { World } from '../world';
import { BK_SIDE, spawnBeam } from './beam';
import {
  F_BOMB,
  F_CAUGHT,
  F_CIRCLING,
  F_FALLING,
  F_KEEPER,
  F_PHASE,
  F_RETURNING,
  F_SIDELASER,
  SK_BOMB,
  SK_MARBLE,
  SK_ORBIT,
  ShotState,
  recentlyHit,
  rememberHit,
  resetShotState,
} from './state';
import { nearestTarget } from './targets';

export class Shot extends ShotState implements Poolable {
  alive = false;
  slot = 0;
  prevX = 0;
  prevY = 0;
  prevZ = 0;
  /** Orbit-rider blades: index around the ring. */
  bladeIndex = 0;
}

/** A fresh (reset) projectile from the pool, or null at the cap. */
export function allocShot(w: World): Shot | null {
  const s = w.projectiles.alloc();
  if (!s) return null;
  resetShotState(s);
  s.bladeIndex = 0;
  return s;
}

/** Derived velocity from heading + speed (or the override). */
export function updateVelocity(s: ShotState): void {
  if (s.ovr) {
    s.vx = s.ovx;
    s.vy = s.ovy;
    return;
  }
  const th = s.ang + s.angOff;
  s.vx = Math.cos(th) * s.speed;
  s.vy = Math.sin(th) * s.speed;
}

/**
 * Call after filling a fresh shot's fields (kind, position, heading, base speed/damage/size, range,
 * profile…): runs the profile's initShot hooks and derives the current numbers.
 */
export function finishShot(w: World, s: Shot): void {
  s.prevX = s.x;
  s.prevY = s.y;
  s.prevZ = s.z;
  if (s.speed === 0) s.speed = s.baseSpeed;
  const prof = s.profile;
  if (prof) {
    const hooks = prof.initHooks;
    for (let k = 0; k < hooks.length; k++) {
      const e = hooks[k]!;
      e.def.initShot!(s, e.stack);
    }
  }
  s.damage = s.baseDamage;
  s.size = s.baseSize;
  updateVelocity(s);
  if (s.anchor === null) {
    s.ax = w.player.x;
    s.ay = w.player.y;
  }
}

/** Unit normal of the obstacle hit when moving from (px, py) to (x, y). */
const normal = { x: 0, y: 0 };
function wallNormal(room: RoomGrid, px: number, py: number, x: number, y: number, r: number, mode: CollideMode): void {
  const bx = firstBlockingCell(room, x, py, r, mode) !== NO_CELL;
  const by = firstBlockingCell(room, px, y, r, mode) !== NO_CELL;
  let nx = 0;
  let ny = 0;
  if (bx) nx = x > px ? -1 : 1;
  if (by) ny = y > py ? -1 : 1;
  if (!bx && !by) {
    nx = x > px ? -1 : x < px ? 1 : 0;
    ny = y > py ? -1 : y < py ? 1 : 0;
  }
  const l = Math.sqrt(nx * nx + ny * ny);
  normal.x = l > 0 ? nx / l : 0;
  normal.y = l > 0 ? ny / l : -1;
}

/** Reflects the shot's heading off a surface with unit normal (nx, ny). */
export function reflect(s: ShotState, nx: number, ny: number): void {
  const th = s.ang + s.angOff;
  let dx = Math.cos(th);
  let dy = Math.sin(th);
  const d = dx * nx + dy * ny;
  if (d < 0) {
    dx -= 2 * d * nx;
    dy -= 2 * d * ny;
  } else if (nx !== 0 || ny !== 0) {
    // Already moving away (grazing a corner): push along the normal a little.
    dx += nx * 0.2;
    dy += ny * 0.2;
  }
  s.ang = Math.atan2(dy, dx) - s.angOff;
}

/** Runs the wall hooks; true if one of them lets the shot survive. */
export function runWallHooks(w: World, s: ShotState, nx: number, ny: number): boolean {
  const hooks = s.profile?.wallHooks;
  if (!hooks) return false;
  for (let k = 0; k < hooks.length; k++) {
    const e = hooks[k]!;
    if (e.def.wall!(s, e.stack, w, nx, ny)) return true;
  }
  return false;
}

export function runExpireHooks(w: World, s: ShotState): void {
  const hooks = s.profile?.expireHooks;
  if (!hooks) return;
  for (let k = 0; k < hooks.length; k++) {
    const e = hooks[k]!;
    e.def.expire!(s, e.stack, w);
  }
}

/**
 * A direct hit staggers a non-boss enemy (ENEMY_TUNING.hitStun: its own movement slowed for a moment; refreshed by
 * the next hit, never stacked). Called from the direct-hit paths only — projectiles, a beam's first tick on a target,
 * melee swipes — never from DoT, statuses, creep or blasts.
 */
export function stagger(t: Hittable): void {
  if (t.hitKind !== HIT_ENEMY) return;
  const e = t as Enemy;
  if (e.boss !== null || e.dead) return;
  const s = ENEMY_TUNING.hitStun;
  if (e.hitStunT < s) e.hitStunT = s;
}

export function runHitHooks(w: World, s: ShotState, t: Hittable): void {
  const hooks = s.profile?.hitHooks;
  if (!hooks) return;
  for (let k = 0; k < hooks.length; k++) {
    const e = hooks[k]!;
    e.def.hit!(s, t, e.stack, w);
  }
}

/** Style colour for burst events (id field), '' = the default candle-gold. */
function colorId(s: ShotState): string {
  return s.style?.body ?? '';
}

/**
 * Damages `t` with the shot and runs the hit hooks. Returns true if the shot is used up (no pierce
 * left). Knockback is an impulse along the shot's motion.
 */
export function applyShotHit(w: World, s: ShotState, t: Hittable): boolean {
  const sp = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  const k = sp > 1e-6 ? s.knock / sp : 0;
  if (t.hurt(s.damage, SRC_PLAYER, s.vx * k, s.vy * k)) stagger(t);
  rememberHit(s, t, w.tick);
  w.events.emitFx('splash', s.x, s.y, 1, s.z, colorId(s));
  runHitHooks(w, s, t);
  s.hitCount++;
  if ((s.flags & F_KEEPER) !== 0) return false;
  if (s.pierceLeft > 0) {
    s.pierceLeft--;
    return false;
  }
  return true;
}

/** Ends a shot: expire hooks (unless it was used up by a hit), end burst, release. */
export function endShot(w: World, s: Shot, expire: boolean, burst = 1): void {
  if (expire) runExpireHooks(w, s);
  if (burst >= 0) {
    const pit = burst === 0 && w.room.tileAt(s.x, s.y) === Tile.Pit;
    w.events.emitFx('splash', s.x, s.y, pit ? 2 : burst, s.z, colorId(s));
  }
  w.projectiles.release(s);
}

/** First live target overlapping the shot that it may hit now. */
function findHit(w: World, s: ShotState): Hittable | null {
  const t = w.atk.targets;
  const r = s.size;
  const tick = w.tick;
  for (let i = 0; i < t.n; i++) {
    const h = t.refs[i]!;
    const dx = h.x - s.x;
    const dy = h.y - s.y;
    const rr = h.r + r;
    if (dx * dx + dy * dy >= rr * rr || !h.hittable) continue;
    if (recentlyHit(s, h, tick)) continue;
    return h;
  }
  return null;
}

/** Laser rider: a projectile zaps the nearest enemy with a thin side laser. */
function sideZap(w: World, s: Shot): void {
  const T = ATTACK_TUNING;
  const t = w.atk.targets;
  const i = nearestTarget(t, s.x, s.y, T.sideLaserRange);
  if (i < 0) return;
  const h = t.refs[i]!;
  const b = spawnBeam(w, BK_SIDE, s.profile!, null, s.x, s.y, Math.atan2(h.y - s.y, h.x - s.x), s.scale);
  if (!b) return;
  b.dmg = s.damage * T.sideLaserDamage;
  b.maxLen = T.sideLaserRange + h.r;
}

export function updateShots(w: World, dt: number): void {
  const pool = w.projectiles;
  const room = w.room;
  const T = ATTACK_TUNING;
  for (let i = pool.count - 1; i >= 0; i--) {
    const s = pool.items[i]!;
    s.prevX = s.x;
    s.prevY = s.y;
    s.prevZ = s.z;
    s.age += dt;
    const a = s.anchor;
    if (a !== null) {
      if (a.alive) {
        s.ax = a.x;
        s.ay = a.y;
      } else if (s.kind === SK_ORBIT) {
        pool.release(s);
        continue;
      }
    } else {
      s.ax = w.player.x;
      s.ay = w.player.y;
    }
    if (s.kind === SK_ORBIT) {
      updateBlade(w, s);
      continue;
    }
    if (s.age > s.life) {
      endShot(w, s, true, 0);
      continue;
    }
    const prof = s.profile!;
    s.sizeMul = 1;
    s.dmgMul = 1;
    s.ovr = false;
    if ((s.flags & F_FALLING) === 0) {
      const hooks = prof.motionHooks;
      for (let k = 0; k < hooks.length; k++) {
        const e = hooks[k]!;
        e.def.motion!(s, e.stack, w, dt);
      }
    }
    s.size = s.baseSize * s.sizeMul;
    s.damage = s.baseDamage * s.dmgMul;
    if ((s.flags & F_CAUGHT) !== 0) {
      w.events.emit('bladeCatch', s.x, s.y, s.kind, 0, colorId(s));
      pool.release(s);
      continue;
    }

    // Falling (marbles and bomb shots past their range): gravity + drag, burst on landing.
    if ((s.flags & F_FALLING) !== 0) {
      s.speed *= Math.max(0, 1 - MARBLE_TUNING.dropDrag * dt);
      s.vz -= MARBLE_TUNING.dropGravity * dt;
      s.z += s.vz * dt;
      if (s.z <= 0) {
        s.z = 0;
        endShot(w, s, true, 0);
        continue;
      }
    }
    updateVelocity(s);

    if ((s.flags & F_SIDELASER) !== 0) {
      s.zapT -= dt;
      if (s.zapT <= 0) {
        s.zapT = T.sideLaserEvery;
        sideZap(w, s);
      }
    }

    // Sub-stepped move so fast shots can't tunnel through rocks or targets.
    let vx = s.vx;
    let vy = s.vy;
    const sp = Math.sqrt(vx * vx + vy * vy);
    const stepDist = sp * dt;
    const steps = stepDist > T.substep ? Math.ceil(stepDist / T.substep) : 1;
    let sx = (vx * dt) / steps;
    let sy = (vy * dt) / steps;
    const stepLen = stepDist / steps;
    let moved = 0;
    let done = false;
    for (let k = 0; k < steps; k++) {
      const px = s.x;
      const py = s.y;
      s.x += sx;
      s.y += sy;
      const mode = (s.flags & (F_PHASE | F_RETURNING)) !== 0 ? PHASE_MODE : SHOT_MODE;
      const tileR = s.size * MARBLE_TUNING.tileRadiusScale;
      const cell = firstBlockingCell(room, s.x, s.y, tileR, mode);
      if (cell !== NO_CELL) {
        if (cell >= 0) hitTileWithShot(w, cell);
        wallNormal(room, px, py, s.x, s.y, tileR, mode);
        s.x = px;
        s.y = py;
        if (runWallHooks(w, s, normal.x, normal.y)) {
          reflect(s, normal.x, normal.y);
          // A one-step velocity override (orbit, corkscrew) would carry it straight back into the
          // wall: the reflected heading takes over for the rest of this tick (the orbit reads the
          // turn as a tilt next step).
          s.ovr = false;
          updateVelocity(s);
          vx = s.vx;
          vy = s.vy;
          sx = (vx * dt) / steps;
          sy = (vy * dt) / steps;
          w.events.emitFx('shotBounce', s.x, s.y, normal.x, normal.y, colorId(s));
          continue;
        }
        endShot(w, s, true, 1);
        done = true;
        break;
      }
      moved += stepLen;
      const t = findHit(w, s);
      if (t !== null && applyShotHit(w, s, t)) {
        w.projectiles.release(s);
        done = true;
        break;
      }
    }
    if (done) continue;
    // Laps around the owner (circle-first) don't use up range.
    if ((s.flags & F_CIRCLING) === 0) s.traveled += moved;
    if ((s.flags & F_FALLING) === 0 && s.traveled >= s.range) {
      if (s.kind === SK_MARBLE || s.kind === SK_BOMB || (s.flags & F_BOMB) !== 0) {
        s.flags |= F_FALLING;
        s.vz = 0;
      } else {
        endShot(w, s, true, 0);
      }
    }
  }
}

/** Orbit-rider blade: rides a ring around its anchor, hits what it touches, blocks enemy shots. */
function updateBlade(w: World, s: Shot): void {
  const prof = s.profile!;
  const n = Math.max(1, prof.orbitCount);
  const T = ATTACK_TUNING;
  const a = w.time * T.orbitSpin + (s.bladeIndex / n) * Math.PI * 2;
  const r = T.orbitRadius;
  const tx = s.ax + Math.cos(a) * r;
  const ty = s.ay + Math.sin(a) * r;
  s.vx = (tx - s.x) * 60;
  s.vy = (ty - s.y) * 60;
  // Stay inside the room even when the player hugs a wall.
  s.x = tx < s.size ? s.size : tx > ROOM_W - s.size ? ROOM_W - s.size : tx;
  s.y = ty < s.size ? s.size : ty > ROOM_H - s.size ? ROOM_H - s.size : ty;
  s.ang = a + Math.PI / 2;
  s.damage = s.baseDamage;
  s.size = s.baseSize;
  const t = findHit(w, s);
  if (t !== null) {
    const k = s.knock;
    const dx = t.x - s.ax;
    const dy = t.y - s.ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (t.hurt(s.damage, SRC_PLAYER, d > 1e-6 ? (dx / d) * k : 0, d > 1e-6 ? (dy / d) * k : 0)) stagger(t);
    rememberHit(s, t, w.tick);
    w.events.emitFx('splash', s.x, s.y, 1, s.z, colorId(s));
    runHitHooks(w, s, t);
  }
  // Blades swat hostile enemy shots.
  const shots = w.enemyShots;
  for (let i = shots.count - 1; i >= 0; i--) {
    const e = shots.items[i]!;
    if (e.allied || e.lob) continue;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const rr = e.r + s.size + 1;
    if (dx * dx + dy * dy < rr * rr) {
      w.events.emitFx('eshotPop', e.x, e.y, 1, e.style, '');
      shots.release(e);
    }
  }
}
