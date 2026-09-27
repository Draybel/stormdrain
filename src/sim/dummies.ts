/**
 * Training dummies: stationary targets with HP. They flash and get nudged when hit (a visual
 * spring offset — their home position never moves), pop at 0 HP, and grow back after a moment.
 * They are Hittables (sim/hittable.ts) and take statuses too (poison/burn tick damage; the others
 * only tint them), so item effects can be tried out in the training yard.
 */

import type { Poolable } from '../engine/pool';
import { fireTrigger } from './effects';
import { ST_KNOCKBACK, StatusSet, addStatus, clearStatuses, statusIndex, tickStatuses } from './enemies/status';
import { HIT_DUMMY, SRC_PLAYER, creditsPlayer, type Hittable } from './hittable';
import { DUMMY_TUNING, STATUS_TUNING } from './tuning';
import type { Projectile } from './projectiles';
import type { StatusKind } from './types';
import type { World } from './world';

export class Dummy implements Poolable, Hittable {
  alive = false;
  slot = 0;
  readonly hitKind = HIT_DUMMY;
  /** Home position (feet), room px. */
  x = 0;
  y = 0;
  r = DUMMY_TUNING.radius;
  hp: number = DUMMY_TUNING.hp;
  maxHp: number = DUMMY_TUNING.hp;
  /** Seconds of white flash left. */
  flash = 0;
  /** Visual spring offset from home (px) and its velocity. */
  nudgeX = 0;
  nudgeY = 0;
  nudgeVx = 0;
  nudgeVy = 0;
  /** True while popped (not solid, not hittable); `respawn` counts down. */
  popped = false;
  respawn = 0;
  /** Seconds since (re)spawn — lets render do a grow-in. */
  age = 0;
  readonly status = new StatusSet();
  /** Direction of the last hit (for the 'knockback' status). */
  lastHitX = 0;
  lastHitY = 1;
  private readonly w: World;

  constructor(w: World) {
    this.w = w;
  }

  get hittable(): boolean {
    return this.alive && !this.popped;
  }

  hurt(dmg: number, source: number, kx: number, ky: number): boolean {
    if (!this.hittable) return false;
    const k = Math.sqrt(kx * kx + ky * ky);
    if (k > 1e-6) {
      this.lastHitX = kx / k;
      this.lastHitY = ky / k;
    }
    damageDummy(this.w, this, dmg, k > 1e-6 ? kx / k : 0, k > 1e-6 ? ky / k : 0, k, source);
    return true;
  }

  applyStatus(kind: StatusKind, duration: number, power: number, source: number): void {
    if (!this.hittable) return;
    const idx = statusIndex(kind);
    if (idx === ST_KNOCKBACK) {
      const f = power > 0 ? power : STATUS_TUNING.knockPower;
      this.nudgeVx += this.lastHitX * f;
      this.nudgeVy += this.lastHitY * f;
      return;
    }
    const applied = addStatus(this.status, idx, duration, power, source, 1);
    if (applied >= 0) this.w.events.emit('status', this.x, this.y - 12, applied, 0, 'dummy');
  }
}

export function spawnDummy(w: World, x: number, y: number): Dummy | null {
  const d = w.dummies.alloc();
  if (!d) return null;
  d.x = x;
  d.y = y;
  d.r = DUMMY_TUNING.radius;
  d.hp = d.maxHp = DUMMY_TUNING.hp;
  d.flash = 0;
  d.nudgeX = d.nudgeY = d.nudgeVx = d.nudgeVy = 0;
  d.popped = false;
  d.respawn = 0;
  d.age = 1;
  clearStatuses(d.status);
  return d;
}

/** Checks a marble against all dummies; applies damage and returns true if it hit one. */
export function hitDummyWithShot(w: World, p: Projectile): boolean {
  const pool = w.dummies;
  for (let i = 0; i < pool.count; i++) {
    const d = pool.items[i]!;
    if (d.popped) continue;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    const rr = p.r + d.r;
    if (dx * dx + dy * dy >= rr * rr) continue;
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    const nx = sp > 1e-6 ? p.vx / sp : 0;
    const ny = sp > 1e-6 ? p.vy / sp : 0;
    d.lastHitX = nx;
    d.lastHitY = ny;
    damageDummy(w, d, p.damage, nx, ny, p.knockback);
    w.events.emit('splash', p.x, p.y, 1, p.z);
    return true;
  }
  return false;
}

export function damageDummy(
  w: World,
  d: Dummy,
  dmg: number,
  dirX: number,
  dirY: number,
  knock: number,
  source: number = SRC_PLAYER,
): void {
  if (d.popped) return;
  d.hp -= dmg;
  d.flash = DUMMY_TUNING.flash;
  d.nudgeVx += dirX * knock;
  d.nudgeVy += dirY * knock;
  w.counters.hits++;
  w.events.emit('hit', d.x, d.y - 8, dmg, Math.max(0, d.hp), 'dummy');
  if (d.hp <= 0) {
    d.popped = true;
    d.respawn = DUMMY_TUNING.respawn;
    d.flash = 0;
    clearStatuses(d.status);
    w.counters.pops++;
    w.events.emit('pop', d.x, d.y - 8, dirX, dirY, 'dummy');
    // Popping a dummy counts as a kill for on-kill item triggers (training room).
    if (creditsPlayer(source)) fireTrigger(w, 'kill', d.x, d.y);
  }
}

export function updateDummies(w: World, dt: number): void {
  const T = DUMMY_TUNING;
  const pool = w.dummies;
  for (let i = 0; i < pool.count; i++) {
    const d = pool.items[i]!;
    d.age += dt;
    if (d.flash > 0) d.flash = Math.max(0, d.flash - dt);

    // Damage over time (poison / burn) from statuses.
    if (!d.popped && d.status.mask !== 0) {
      const dot = tickStatuses(d.status, dt);
      if (dot.damage > 0) damageDummy(w, d, dot.damage, 0, 0, 0, dot.source);
    }

    // Damped spring back to home.
    d.nudgeVx += (-T.spring * d.nudgeX - T.damping * d.nudgeVx) * dt;
    d.nudgeVy += (-T.spring * d.nudgeY - T.damping * d.nudgeVy) * dt;
    d.nudgeX += d.nudgeVx * dt;
    d.nudgeY += d.nudgeVy * dt;
    if (d.nudgeX > T.maxNudge) d.nudgeX = T.maxNudge;
    else if (d.nudgeX < -T.maxNudge) d.nudgeX = -T.maxNudge;
    if (d.nudgeY > T.maxNudge) d.nudgeY = T.maxNudge;
    else if (d.nudgeY < -T.maxNudge) d.nudgeY = -T.maxNudge;

    if (d.popped) {
      d.respawn -= dt;
      if (d.respawn <= 0) {
        d.popped = false;
        d.hp = d.maxHp;
        d.age = 0;
        d.nudgeX = d.nudgeY = d.nudgeVx = d.nudgeVy = 0;
        w.events.emit('spawn', d.x, d.y - 6, 0, 0, 'dummy');
      }
    }
  }
}
