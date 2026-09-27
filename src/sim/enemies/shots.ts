/**
 * Everything enemies throw at you, pooled and capped (ARCHITECTURE §4.5):
 * - EnemyShot (cap 400): straight / accelerating / curving shots, and gravity lobs that only hurt
 *   where they land (a marker shows the spot). Walls and rocks stop them unless `phase`; pits don't.
 *   They hurt the player (half a heart by default; damagePlayer respects i-frames) and pop on contact.
 * - Creep (cap 48): damaging puddles left by trails and lob splashes (the oldest is recycled).
 * - Wave (cap 16): expanding ground shockwaves (hop landings); jump over them by flying.
 * Allied versions (from charmed enemies, ice shards) hurt enemies instead of the player.
 */

import type { Poolable } from '../../engine/pool';
import { NO_CELL, PHASE_MODE, SHOT_MODE, firstBlockingCell } from '../collision';
import { DMG_ENEMY, damagePlayer } from '../combat';
import { ROOM_H, ROOM_W } from '../constants';
import { SRC_ALLY } from '../hittable';
import { ENEMY_TUNING } from '../tuning';
import type { World } from '../world';
import type { Enemy } from './enemy';
import { ST_CHARM, hasStatus } from './status';

export class EnemyShot implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  /** Height (render; lobs arc through it). */
  z = 0;
  prevZ = 0;
  r = 3;
  /** Half hearts (hostile) — allied shots deal dmg × ENEMY_TUNING.allyDamage to enemies. */
  dmg = 1;
  /** ENEMY_SHOT_STYLES index. */
  style = 0;
  age = 0;
  life = 3;
  /** Speed change (px/s²) and turn rate (rad/s). */
  accel = 0;
  curve = 0;
  /** Ignores rocks (walls still stop it). */
  phase = false;
  /** Fights for the player (charmed shooter, ice shards). */
  allied = false;
  /** uid of the enemy that fired it (allied shots never hit their shooter). */
  owner = 0;
  // Lob
  lob = false;
  /** Lob: start point, landing point, flight time, apex height. */
  sx = 0;
  sy = 0;
  tx = 0;
  ty = 0;
  air = 1;
  height = 24;
  /** Lob landing: splash radius (px), creep puddle (0/1), ring of shots (count). */
  splash = 0;
  creep = 0;
  split = 0;
  /** Lob: 0 an arcing glob, 1 debris falling straight down, 2 a lightning strike (boss patterns). */
  fall = 0;
  /** Lob creep puddle: seconds it lasts and radius (0 = the defaults: 3 s, 0.8 × splash). */
  creepLife = 0;
  creepR = 0;
}

export class Creep implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  r = 7;
  life = 3;
  maxLife = 3;
  /** Half hearts to the player (allied creep: ×allyDamage to enemies). */
  dmg = 1;
  style = 0;
  allied = false;
  /** Cosmetic seed (shape wobble). */
  seed = 0;
  /** uid of the enemy that left it (0 = unknown) — the game-over screen's killer. */
  owner = 0;
}

export class Wave implements Poolable {
  alive = false;
  slot = 0;
  x = 0;
  y = 0;
  /** Current and final radius (px), expansion speed (px/s). */
  rad = 0;
  maxRad = 40;
  speed = 120;
  /** Half hearts; ring thickness that hurts (px). */
  dmg = 1;
  band = 5;
  hitPlayer = false;
  allied = false;
  id = 0;
  /** uid of the enemy that made it (0 = unknown). */
  owner = 0;
}

let waveSerial = 0;

/** Spawns a straight shot; returns null at the cap. */
export function spawnEnemyShot(
  w: World,
  x: number,
  y: number,
  vx: number,
  vy: number,
  dmg: number,
  r: number,
  style: number,
  allied: boolean,
  owner: number,
): EnemyShot | null {
  const s = w.enemyShots.alloc();
  if (!s) return null;
  s.x = s.prevX = x;
  s.y = s.prevY = y;
  s.vx = vx;
  s.vy = vy;
  s.z = s.prevZ = ENEMY_TUNING.shotHeight;
  s.r = r;
  s.dmg = dmg;
  s.style = style;
  s.age = 0;
  s.life = ENEMY_TUNING.shotMaxAge;
  s.accel = 0;
  s.curve = 0;
  s.phase = false;
  s.allied = allied;
  s.owner = owner;
  s.lob = false;
  s.splash = s.creep = s.split = 0;
  s.fall = 0;
  s.creepLife = s.creepR = 0;
  w.counters.enemyShots++;
  return s;
}

/** Spawns a gravity lob from (x, y) that lands on (tx, ty) after `air` seconds. */
export function spawnLob(
  w: World,
  x: number,
  y: number,
  tx: number,
  ty: number,
  air: number,
  height: number,
  dmg: number,
  r: number,
  style: number,
  allied: boolean,
  owner: number,
): EnemyShot | null {
  const s = spawnEnemyShot(w, x, y, 0, 0, dmg, r, style, allied, owner);
  if (!s) return null;
  s.lob = true;
  s.sx = x;
  s.sy = y;
  s.tx = Math.min(ROOM_W - 2, Math.max(2, tx));
  s.ty = Math.min(ROOM_H - 2, Math.max(2, ty));
  s.air = Math.max(0.1, air);
  s.height = height;
  s.z = s.prevZ = ENEMY_TUNING.shotHeight;
  s.life = s.air + 0.5;
  return s;
}

export function spawnCreep(w: World, x: number, y: number, r: number, life: number, dmg: number, style: number, allied: boolean, owner = 0): Creep | null {
  let c = w.creep.alloc();
  if (!c) {
    // Recycle the puddle closest to drying up.
    const pool = w.creep;
    let best = pool.items[0]!;
    for (let i = 1; i < pool.count; i++) if (pool.items[i]!.life < best.life) best = pool.items[i]!;
    c = best;
  }
  c.x = x;
  c.y = y;
  c.r = r;
  c.life = c.maxLife = life;
  c.dmg = dmg;
  c.style = style;
  c.allied = allied;
  c.owner = owner;
  c.seed = w.combatRng.next();
  return c;
}

export function spawnWave(w: World, x: number, y: number, maxRad: number, speed: number, dmg: number, band: number, allied: boolean, owner = 0): Wave | null {
  const v = w.waves.alloc();
  if (!v) return null;
  v.x = x;
  v.y = y;
  v.rad = 2;
  v.maxRad = maxRad;
  v.speed = speed;
  v.dmg = dmg;
  v.band = band;
  v.hitPlayer = false;
  v.allied = allied;
  v.owner = owner;
  v.id = ++waveSerial;
  w.events.emit('shockwave', x, y, maxRad, speed);
  return v;
}

/** The first hostile (non-charmed) enemy overlapping the circle, excluding `owner`. */
function hostileEnemyAt(w: World, x: number, y: number, r: number, owner: number): Enemy | null {
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i]!;
    if (!e.hittable || e.uid === owner || isCharmed(e)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const rr = e.r + r;
    if (dx * dx + dy * dy < rr * rr) return e;
  }
  return null;
}

function isCharmed(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

/** Hurts the player (hostile) or enemies (allied) inside a circle — lob splashes. */
function splashAt(w: World, x: number, y: number, radius: number, dmg: number, allied: boolean, owner: number): void {
  if (allied) {
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const e = pool.items[i]!;
      if (!e.hittable || e.uid === owner || isCharmed(e)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const rr = e.r + radius;
      if (dx * dx + dy * dy < rr * rr) e.hurt(dmg * ENEMY_TUNING.allyDamage, SRC_ALLY, dx * 3, dy * 3);
    }
    return;
  }
  const p = w.player;
  if (p.dead) return;
  const dx = p.x - x;
  const dy = p.y - y;
  const rr = radius + p.r * ENEMY_TUNING.playerHitScale;
  if (dx * dx + dy * dy < rr * rr) damagePlayer(w, dmg, DMG_ENEMY, owner);
}

function popShot(w: World, s: EnemyShot, hit: number): void {
  w.events.emit('eshotPop', s.x, s.y, hit, s.style, '');
  w.enemyShots.release(s);
}

function landLob(w: World, s: EnemyShot): void {
  s.x = s.tx;
  s.y = s.ty;
  w.events.emit('lobLand', s.x, s.y, s.splash, s.style, s.fall === 2 ? 'bolt' : s.fall === 1 ? 'rock' : '');
  splashAt(w, s.x, s.y, s.splash, s.dmg, s.allied, s.owner);
  if (s.creep > 0) {
    spawnCreep(w, s.x, s.y, s.creepR > 0 ? s.creepR : Math.max(6, s.splash * 0.8), s.creepLife > 0 ? s.creepLife : 3, 1, s.style, s.allied, s.owner);
  }
  const n = s.split;
  if (n > 0) {
    const off = w.combatRng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      spawnEnemyShot(w, s.x, s.y, Math.cos(a) * 70, Math.sin(a) * 70, 1, 2.5, s.style, s.allied, s.owner);
    }
  }
  w.enemyShots.release(s);
}

export function updateEnemyShots(w: World, dt: number): void {
  const pool = w.enemyShots;
  const room = w.room;
  const p = w.player;
  const T = ENEMY_TUNING;
  const hitR = p.r * T.playerHitScale;
  for (let i = pool.count - 1; i >= 0; i--) {
    const s = pool.items[i]!;
    s.prevX = s.x;
    s.prevY = s.y;
    s.prevZ = s.z;
    s.age += dt;

    if (s.lob) {
      // Straight line over the ground, parabolic height; only the landing matters.
      const t = Math.min(1, s.age / s.air);
      s.x = s.sx + (s.tx - s.sx) * t;
      s.y = s.sy + (s.ty - s.sy) * t;
      // Debris / lightning drop straight down from the ceiling (accelerating); globs arc.
      s.z = s.fall > 0 ? s.height * (1 - t * t) : T.shotHeight * (1 - t) + 4 * s.height * t * (1 - t);
      if (t >= 1) landLob(w, s);
      continue;
    }

    if (s.curve !== 0) {
      const c = Math.cos(s.curve * dt);
      const sn = Math.sin(s.curve * dt);
      const vx = s.vx * c - s.vy * sn;
      s.vy = s.vx * sn + s.vy * c;
      s.vx = vx;
    }
    let speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (s.accel !== 0 && speed > 1e-4) {
      const ns = Math.min(420, speed + s.accel * dt);
      if (ns < 12) {
        popShot(w, s, 0);
        continue;
      }
      s.vx *= ns / speed;
      s.vy *= ns / speed;
      speed = ns;
    }

    const stepDist = speed * dt;
    const steps = stepDist > T.shotSubstep ? Math.ceil(stepDist / T.shotSubstep) : 1;
    const sx = (s.vx * dt) / steps;
    const sy = (s.vy * dt) / steps;
    const mode = s.phase ? PHASE_MODE : SHOT_MODE;
    let done = false;
    for (let k = 0; k < steps; k++) {
      s.x += sx;
      s.y += sy;
      if (firstBlockingCell(room, s.x, s.y, s.r * 0.7, mode) !== NO_CELL) {
        s.x -= sx;
        s.y -= sy;
        popShot(w, s, 1);
        done = true;
        break;
      }
      if (s.allied) {
        const e = hostileEnemyAt(w, s.x, s.y, s.r, s.owner);
        if (e) {
          e.hurt(s.dmg * T.allyDamage, SRC_ALLY, s.vx * 0.3, s.vy * 0.3);
          popShot(w, s, 1);
          done = true;
          break;
        }
      } else if (!p.dead) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const rr = hitR + s.r;
        if (dx * dx + dy * dy < rr * rr) {
          damagePlayer(w, s.dmg, DMG_ENEMY, s.owner);
          popShot(w, s, 1);
          done = true;
          break;
        }
      }
    }
    if (done) continue;
    if (s.age >= s.life) popShot(w, s, 0);
  }
}

export function updateCreep(w: World, dt: number): void {
  const pool = w.creep;
  const p = w.player;
  for (let i = pool.count - 1; i >= 0; i--) {
    const c = pool.items[i]!;
    c.life -= dt;
    if (c.life <= 0) {
      pool.release(c);
      continue;
    }
    // Drying puddles (last 20 %) no longer hurt.
    if (c.life < c.maxLife * 0.2) continue;
    if (c.allied) {
      const enemies = w.enemies;
      for (let j = 0; j < enemies.count; j++) {
        const e = enemies.items[j]!;
        if (!e.hittable || e.flying || e.z > 0 || e.allyT > 0 || isCharmed(e)) continue;
        const dx = e.x - c.x;
        const dy = (e.y - c.y) * 2;
        const rr = c.r + e.r * 0.5;
        if (dx * dx + dy * dy < rr * rr) {
          e.allyT = ENEMY_TUNING.allyContactEvery;
          e.hurt(c.dmg * ENEMY_TUNING.allyDamage * 0.5, SRC_ALLY, 0, 0);
        }
      }
      continue;
    }
    if (p.dead || p.invuln > 0 || p.flags.flying) continue;
    // Puddles are flat ellipses (half as tall as wide).
    const dx = p.x - c.x;
    const dy = (p.y - c.y) * 2;
    const rr = c.r + p.r * 0.4;
    if (dx * dx + dy * dy < rr * rr) damagePlayer(w, c.dmg, DMG_ENEMY, c.owner);
  }
}

export function updateWaves(w: World, dt: number): void {
  const pool = w.waves;
  const p = w.player;
  for (let i = pool.count - 1; i >= 0; i--) {
    const v = pool.items[i]!;
    v.rad += v.speed * dt;
    if (v.rad >= v.maxRad) {
      pool.release(v);
      continue;
    }
    if (v.allied) {
      const enemies = w.enemies;
      for (let j = 0; j < enemies.count; j++) {
        const e = enemies.items[j]!;
        if (!e.hittable || e.flying || e.z > 2 || e.waveId === v.id || isCharmed(e)) continue;
        const dx = e.x - v.x;
        const dy = e.y - v.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(d - v.rad) < v.band + e.r * 0.5) {
          e.waveId = v.id;
          e.hurt(v.dmg * ENEMY_TUNING.allyDamage, SRC_ALLY, d > 1e-3 ? (dx / d) * 120 : 0, d > 1e-3 ? (dy / d) * 120 : 0);
        }
      }
      continue;
    }
    if (v.hitPlayer || p.dead || p.flags.flying) continue;
    const dx = p.x - v.x;
    const dy = p.y - v.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(d - v.rad) < v.band + p.r * 0.5) {
      v.hitPlayer = true;
      damagePlayer(w, v.dmg, DMG_ENEMY, v.owner);
    }
  }
}
