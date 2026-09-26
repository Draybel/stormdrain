/**
 * Placed bombs and explosions. A bomb is dropped at Wren's feet (bomb button / E), blinks faster
 * and faster for a ~1.4 s fuse, then explodes:
 * - big damage to hittables in the blast, one full heart to the player (bonus hearts first);
 * - destroys rocks (tinted rocks drop loot), crates, urns; puts out fires; reveals secret walls
 *   through World.onSecretWallBombed (for the floor code);
 * - pushes pickups and other bombs, and chain-detonates bombs caught in the blast;
 * - the 'explosion' event drives the shake / flash / ring / smoke / debris / boom (render + audio).
 * Walking into a bomb nudges it along; bombs slide with friction and bounce off walls.
 */

import type { Poolable } from '../engine/pool';
import { DMG_EXPLOSION, damageArea, damagePlayer } from './combat';
import { fireTrigger } from './effects';
import { addCounter } from './inventory';
import { moveBody, pushPickups } from './pickups';
import { explodeTiles } from './tileFx';
import { BOMB_TUNING } from './tuning';
import type { World } from './world';

export class Bomb implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  r: number = BOMB_TUNING.radius;
  /** Seconds left, and the fuse it started with (render blink rate). */
  fuse = 0;
  maxFuse = 0;
  /** The player has stepped off it since it was placed (only then does walking into it nudge it). */
  clear = false;
  age = 0;
}

export function spawnBomb(w: World, x: number, y: number, fuse: number = BOMB_TUNING.fuse): Bomb | null {
  const b = w.bombs.alloc();
  if (!b) return null;
  b.x = b.prevX = x;
  b.y = b.prevY = y;
  b.vx = b.vy = 0;
  b.r = BOMB_TUNING.radius;
  b.fuse = b.maxFuse = fuse;
  b.clear = false;
  b.age = 0;
  return b;
}

/** Bomb button: drops a bomb at the player's feet if they have one. */
export function placeBomb(w: World): boolean {
  const p = w.player;
  if (p.dead) return false;
  if (p.inv.bombs <= 0) {
    w.events.emit('denied', p.x, p.y - 12, 0, 0, 'noBombs');
    return false;
  }
  const b = spawnBomb(w, p.x, p.y + 1);
  if (!b) return false;
  addCounter(p.inv, 'bombs', -1);
  w.counters.bombsPlaced++;
  w.events.emit('bombPlaced', b.x, b.y);
  fireTrigger(w, 'bomb', b.x, b.y);
  return true;
}

export function updateBombs(w: World, dt: number): void {
  const T = BOMB_TUNING;
  const p = w.player;
  const pool = w.bombs;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i]!;
    b.prevX = b.x;
    b.prevY = b.y;
    b.age += dt;
    b.fuse -= dt;
    if (b.fuse <= 0) {
      const x = b.x;
      const y = b.y;
      pool.release(b);
      explode(w, x, y, T.blastRadius, T.damage);
      continue;
    }

    // Walking into it nudges it (after the player has stepped off it once).
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rr = b.r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) {
      b.clear = true;
    } else if (b.clear && !p.dead) {
      const d = Math.sqrt(d2);
      const nx = d > 1e-4 ? dx / d : p.faceX;
      const ny = d > 1e-4 ? dy / d : p.faceY;
      b.x += nx * (rr - d);
      b.y += ny * (rr - d);
      const target = Math.max((p.vx * nx + p.vy * ny) * T.nudge, T.nudgeMin);
      const vn = b.vx * nx + b.vy * ny;
      if (vn < target) {
        b.vx += (target - vn) * nx;
        b.vy += (target - vn) * ny;
      }
    }

    const k = Math.max(0, 1 - T.friction * dt);
    b.vx *= k;
    b.vy *= k;
    if (b.vx * b.vx + b.vy * b.vy < 0.25) b.vx = b.vy = 0;
    moveBody(w, b, b.r, dt, T.wallBounce);
  }
}

/**
 * An explosion at (x, y). Also used by hooks (bomb shots later, item effects).
 * @param radius blast radius for hittables / the player (px)
 */
export function explode(w: World, x: number, y: number, radius: number = BOMB_TUNING.blastRadius, damage: number = BOMB_TUNING.damage): void {
  const T = BOMB_TUNING;
  const p = w.player;
  w.counters.explosions++;
  w.events.emit('explosion', x, y, radius, damage);
  damageArea(w, x, y, radius, damage, 220);

  // The player: one full heart (bonus hearts first), unless immune.
  if (!p.dead && !p.flags.explosionImmune) {
    const dx = p.x - x;
    const dy = p.y - y;
    const rr = radius + p.r * 0.5;
    if (dx * dx + dy * dy < rr * rr) damagePlayer(w, T.playerDamage, DMG_EXPLOSION);
  }

  // Tiles scale with the blast (a standard bomb clears about a 3×3 area).
  explodeTiles(w, x, y, T.tileRadius * (radius / T.blastRadius));

  const pushR = radius * T.pushRange;
  pushPickups(w, x, y, pushR, T.push);

  // Other bombs: shove them and light them up for a chain reaction.
  const pool = w.bombs;
  for (let i = 0; i < pool.count; i++) {
    const b = pool.items[i]!;
    const dx = b.x - x;
    const dy = b.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= pushR * pushR) continue;
    const d = Math.sqrt(d2);
    const f = (1 - d / pushR) * T.push * 0.8;
    b.vx += (d > 1e-4 ? dx / d : 0) * f;
    b.vy += (d > 1e-4 ? dy / d : 1) * f;
    if (d < radius + b.r && b.fuse > T.chainFuse) b.fuse = T.chainFuse;
  }
}
