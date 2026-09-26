/**
 * The player: snappy analog movement with circle-vs-grid sliding, and hold-to-fire marbles that
 * alternate between the left and right eye.
 */

import type { InputState } from '../engine/inputState';
import { vec2 } from '../engine/math';
import { WALK_MODE, resolveCircleVsCircle, resolveCircleVsGrid } from './collision';
import { spawnMarble } from './projectiles';
import { PLAYER_TUNING } from './tuning';
import type { CharacterDef, Stats } from './types';
import type { World } from './world';

export class Player {
  readonly character: CharacterDef;
  stats: Stats;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  readonly r: number = PLAYER_TUNING.radius;
  /** Facing (4-way unit vector) used by the sprite: aim while firing, otherwise movement. */
  faceX = 0;
  faceY = 1;
  /** Last fired direction (unit). */
  aimX = 0;
  aimY = 1;
  /** True on ticks where the fire input is held with a direction. */
  firing = false;
  /** Seconds until the next shot may fire (can go slightly negative to keep exact cadence). */
  fireCooldown = 0;
  /** +1 / -1: which eye the next marble leaves from. */
  eyeSide = 1;
  /** Distance walked (px) — drives the walk cycle. */
  walkDist = 0;
  /** Seconds since the last shot (render recoil). */
  sinceShot = 99;
  shotsFired = 0;
  /** Health in half hearts (full health model arrives in Phase 2). */
  redMax: number;
  red: number;
  hurtTimer = 0;
  invuln = 0;
  dead = false;
  deathTime = 0;

  constructor(character: CharacterDef) {
    this.character = character;
    this.stats = { ...character.stats };
    this.redMax = character.redMax;
    this.red = character.redMax;
  }

  placeAt(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = this.vy = 0;
  }
}

const scratchPos = vec2();
const scratchN = vec2();

export function updatePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  p.prevX = p.x;
  p.prevY = p.y;
  p.sinceShot += dt;
  if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);

  if (p.dead) {
    p.deathTime += dt;
    p.vx = p.vy = 0;
    p.firing = false;
    return;
  }

  movePlayer(w, input, dt);
  firePlayer(w, input, dt);
}

function movePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  const T = PLAYER_TUNING;

  // Target velocity from analog input (magnitude clamped to 1).
  let ix = input.moveX;
  let iy = input.moveY;
  const im = Math.sqrt(ix * ix + iy * iy);
  if (im > 1) {
    ix /= im;
    iy /= im;
  }
  const speed = p.stats.moveSpeed;
  const tvx = ix * speed;
  const tvy = iy * speed;

  // Constant-rate approach: quick to start, snappy reversals, short slide on release.
  let rate: number;
  if (im > 0.05) {
    rate = T.accel;
    if (p.vx * tvx + p.vy * tvy < 0) rate *= T.turnBoost;
  } else {
    rate = T.decel;
  }
  let dvx = tvx - p.vx;
  let dvy = tvy - p.vy;
  const dl = Math.sqrt(dvx * dvx + dvy * dvy);
  const maxDv = rate * dt;
  if (dl > maxDv) {
    dvx *= maxDv / dl;
    dvy *= maxDv / dl;
  }
  p.vx += dvx;
  p.vy += dvy;

  // Integrate, then resolve against tiles and dummies. Remove the velocity component pushing
  // into whatever we hit so the player slides along instead of sticking.
  scratchPos.x = p.x + p.vx * dt;
  scratchPos.y = p.y + p.vy * dt;
  if (resolveCircleVsGrid(w.room, scratchPos, p.r, WALK_MODE, scratchN)) cancelInto(p, scratchN.x, scratchN.y);
  const dummies = w.dummies;
  let pushed = false;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.popped) continue;
    if (resolveCircleVsCircle(scratchPos, p.r, d.x, d.y, d.r, scratchN)) {
      cancelInto(p, scratchN.x, scratchN.y);
      pushed = true;
    }
  }
  // A dummy may have pushed us into a rock: settle against the grid once more.
  if (pushed) resolveCircleVsGrid(w.room, scratchPos, p.r, WALK_MODE, scratchN);

  const mdx = scratchPos.x - p.x;
  const mdy = scratchPos.y - p.y;
  p.x = scratchPos.x;
  p.y = scratchPos.y;
  p.walkDist += Math.sqrt(mdx * mdx + mdy * mdy);

  // Facing follows movement input when not shooting.
  if (!p.firing && im > 0.2) setFacing(p, ix, iy);
}

function cancelInto(p: Player, nx: number, ny: number): void {
  const into = p.vx * nx + p.vy * ny;
  if (into < 0) {
    p.vx -= into * nx;
    p.vy -= into * ny;
  }
}

function setFacing(p: Player, x: number, y: number): void {
  if (Math.abs(x) >= Math.abs(y)) {
    p.faceX = x > 0 ? 1 : -1;
    p.faceY = 0;
  } else {
    p.faceX = 0;
    p.faceY = y > 0 ? 1 : -1;
  }
}

function firePlayer(w: World, input: InputState, dt: number): void {
  const p = w.player;
  const T = PLAYER_TUNING;
  const ax = input.aimX;
  const ay = input.aimY;
  const hasAim = ax !== 0 || ay !== 0;
  const wants = (input.fireHeld || input.firePressed) && hasAim;
  p.firing = wants;

  // Only count down while cooling: a ready weapon (0) fires on the very tick the press arrives,
  // and the fractional remainder carries over so e.g. 3/s is exactly every 20 ticks.
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (!wants) {
    // No banking shots while idle: resting at 0 means the next press fires instantly.
    if (p.fireCooldown < 0) p.fireCooldown = 0;
    return;
  }
  setFacing(p, ax, ay);
  // Epsilon keeps the cadence exact despite float drift (3/s must be exactly every 20 ticks).
  if (p.fireCooldown > 1e-7) return;

  const period = 1 / Math.max(0.1, p.stats.fireRate);
  p.fireCooldown += period;
  if (p.fireCooldown < 0) p.fireCooldown = 0;

  // Spawn ahead of the feet, offset sideways to the current "eye" for an alternating look.
  const px = -ay;
  const py = ax;
  const side = p.eyeSide * T.eyeOffset;
  p.eyeSide = -p.eyeSide;
  const sx = p.x + ax * T.muzzleForward + px * side;
  const sy = p.y + ay * T.muzzleForward + py * side;
  const s = p.stats;
  const vx = ax * s.shotSpeed + p.vx * T.inheritVelocity;
  const vy = ay * s.shotSpeed + p.vy * T.inheritVelocity;
  spawnMarble(w, sx, sy, T.shotHeight, vx, vy, s.damage, s.range, s.shotSize, s.knockback);
  p.aimX = ax;
  p.aimY = ay;
  p.sinceShot = 0;
  p.shotsFired++;
  w.counters.shots++;
  w.events.emit('shoot', sx, sy - T.shotHeight, ax, ay);
}

/** Debug/test hook until real damage sources exist (Phase 2). */
export function hurtPlayer(w: World, halfHearts = 1): void {
  const p = w.player;
  if (p.dead || p.invuln > 0) return;
  p.red = Math.max(0, p.red - halfHearts);
  p.hurtTimer = PLAYER_TUNING.hurtPose;
  p.invuln = PLAYER_TUNING.hurtInvuln;
  w.events.emit('hurt', p.x, p.y - 8);
  if (p.red <= 0) killPlayer(w);
}

export function killPlayer(w: World): void {
  const p = w.player;
  if (p.dead) return;
  p.dead = true;
  p.deathTime = 0;
  p.vx = p.vy = 0;
  w.events.emit('death', p.x, p.y - 8);
}
