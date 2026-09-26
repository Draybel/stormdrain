/**
 * Training dummies: stationary targets with HP. They flash and get nudged when hit (a visual
 * spring offset — their home position never moves), pop at 0 HP, and grow back after a moment.
 */

import type { Poolable } from '../engine/pool';
import { DUMMY_TUNING } from './tuning';
import type { Projectile } from './projectiles';
import type { World } from './world';

export class Dummy implements Poolable {
  alive = false;
  slot = 0;
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
    damageDummy(w, d, p.damage, nx, ny, p.knockback);
    w.events.emit('splash', p.x, p.y, 1, p.z);
    return true;
  }
  return false;
}

export function damageDummy(w: World, d: Dummy, dmg: number, dirX: number, dirY: number, knock: number): void {
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
    w.counters.pops++;
    w.events.emit('pop', d.x, d.y - 8, dirX, dirY, 'dummy');
  }
}

export function updateDummies(w: World, dt: number): void {
  const T = DUMMY_TUNING;
  const pool = w.dummies;
  for (let i = 0; i < pool.count; i++) {
    const d = pool.items[i]!;
    d.age += dt;
    if (d.flash > 0) d.flash = Math.max(0, d.flash - dt);

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
