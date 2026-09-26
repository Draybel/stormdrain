/**
 * Marbles (the default projectile). Pooled; they fly at eye height, travel their range, then
 * drop to the floor with a little splash. Height `z` is purely vertical (for the drop + shadow);
 * all collisions use the ground position (x, y), like the classic top-down "tear" model.
 */

import type { Poolable } from '../engine/pool';
import { MARBLE_TUNING } from './tuning';
import { SHOT_MODE, circleOverlapsGrid } from './collision';
import { Tile } from './tiles';
import type { World } from './world';
import { hitDummyWithShot } from './dummies';

export class Projectile implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  /** Height above the ground (px) and vertical velocity while dropping. */
  z = 0;
  prevZ = 0;
  vz = 0;
  /** Collision radius (px). */
  r = 3;
  damage = 0;
  knockback = 0;
  /** Distance to travel before dropping (px) and distance travelled so far. */
  range = 0;
  traveled = 0;
  falling = false;
  age = 0;
}

export function resetProjectile(p: Projectile): void {
  p.x = p.y = p.prevX = p.prevY = 0;
  p.vx = p.vy = 0;
  p.z = p.prevZ = p.vz = 0;
  p.r = 3;
  p.damage = 0;
  p.knockback = 0;
  p.range = 0;
  p.traveled = 0;
  p.falling = false;
  p.age = 0;
}

/** Spawns a marble; returns null when the projectile cap is reached. */
export function spawnMarble(
  w: World,
  x: number,
  y: number,
  z: number,
  vx: number,
  vy: number,
  damage: number,
  range: number,
  radius: number,
  knockback: number,
): Projectile | null {
  const p = w.projectiles.alloc();
  if (!p) return null;
  resetProjectile(p);
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.z = p.prevZ = z;
  p.vx = vx;
  p.vy = vy;
  p.damage = damage;
  p.range = range;
  p.r = radius;
  p.knockback = knockback;
  return p;
}

export function updateProjectiles(w: World, dt: number): void {
  const pool = w.projectiles;
  const room = w.room;
  const T = MARBLE_TUNING;
  for (let i = pool.count - 1; i >= 0; i--) {
    const p = pool.items[i]!;
    p.prevX = p.x;
    p.prevY = p.y;
    p.prevZ = p.z;
    p.age += dt;

    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (!p.falling) {
      p.traveled += speed * dt;
      if (p.traveled >= p.range) {
        p.falling = true;
        p.vz = 0;
      }
    } else {
      p.vz -= T.dropGravity * dt;
      p.z += p.vz * dt;
      const k = Math.max(0, 1 - T.dropDrag * dt);
      p.vx *= k;
      p.vy *= k;
      if (p.z <= 0) {
        p.z = 0;
        const inPit = room.tileAt(p.x, p.y) === Tile.Pit;
        w.events.emit('splash', p.x, p.y, inPit ? 2 : 0);
        pool.release(p);
        continue;
      }
    }

    // Sub-stepped move so fast marbles can't tunnel through rocks or dummies.
    const stepDist = speed * dt;
    const steps = stepDist > T.substep ? Math.ceil(stepDist / T.substep) : 1;
    const sx = (p.vx * dt) / steps;
    const sy = (p.vy * dt) / steps;
    const tileR = p.r * T.tileRadiusScale;
    let dead = false;
    for (let s = 0; s < steps; s++) {
      p.x += sx;
      p.y += sy;
      if (circleOverlapsGrid(room, p.x, p.y, tileR, SHOT_MODE)) {
        // Splash just outside the obstacle.
        w.events.emit('splash', p.x - sx, p.y - sy, 1);
        dead = true;
        break;
      }
      if (hitDummyWithShot(w, p)) {
        dead = true;
        break;
      }
    }
    if (dead || p.age > T.maxAge) pool.release(p);
  }
}
