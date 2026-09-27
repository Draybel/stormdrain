/**
 * The player: snappy analog movement with circle-vs-grid sliding, hold-to-fire marbles that
 * alternate between the left and right eye, and the run-level state that travels with them
 * (health, inventory, flags, triggers, attack loadout — see sim/effects.ts for how items feed it).
 */

import type { InputState } from '../engine/inputState';
import { vec2 } from '../engine/math';
import { placeBomb } from './bombs';
import { FLY_MODE, WALK_MODE, resolveCircleVsCircle, resolveCircleVsGrid } from './collision';
import { fireTrigger, useActive, useConsumable } from './effects';
import { Health, initHealth } from './health';
import { Inventory } from './inventory';
import { Loadout, makeFlags, makeTriggerLists, type TempEffect, type TriggerLists } from './loadout';
import { spawnMarble } from './projectiles';
import { ENEMY_TUNING, ITEM_TUNING, PLAYER_TUNING } from './tuning';
import type { CharacterDef, Stats } from './types';
import type { World } from './world';

export class Player {
  readonly character: CharacterDef;
  /** Computed stats (character base + items). Identity is stable; recompute writes into it. */
  readonly stats: Stats;
  readonly health = new Health();
  readonly inv = new Inventory();
  readonly flags = makeFlags();
  readonly loadout = new Loadout();
  /** Held trigger effects per event (rebuilt as NEW arrays on every recompute). */
  triggers: TriggerLists = makeTriggerLists();
  /** Trigger cooldowns: world time when each trigger effect may fire again. */
  readonly triggerReady = new Map<object, number>();
  /** Temporary effects from uses/triggers. */
  readonly temps: TempEffect[] = [];
  /** Completed item sets and active synergies (ids). */
  readonly sets: string[] = [];
  readonly synergies: string[] = [];
  /** Permanent luck from Lucky Coins. */
  luckBonus = 0;
  /** Bumped by every stats/flags recompute. */
  statsVersion = 0;
  /** Loadout version the attack pipeline last built from (see attack/recomputeAttack.ts). */
  attackVersion = -1;
  /** Item currently held overhead after a pickup (render pose + banner). */
  holdItem = '';
  holdTime = 0;

  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  /**
   * Short shove from enemy contact damage (px/s, decays fast) — separates Wren from what hit her.
   * Nothing else moves the player (see DECISIONS: health).
   */
  pushX = 0;
  pushY = 0;
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
  hurtTimer = 0;
  invuln = 0;
  dead = false;
  deathTime = 0;

  constructor(character: CharacterDef) {
    this.character = character;
    this.stats = { ...character.stats };
    const h = character.hearts;
    initHealth(this.health, h.redMax, h.red ?? h.redMax, h.tin ?? 0, h.ember ?? 0);
    const s = character.startPickups;
    this.inv.coins = s.coins;
    this.inv.bombs = s.bombs;
    this.inv.keys = s.keys;
  }

  /** Red health in half hearts (shorthand for health.red). */
  get red(): number {
    return this.health.red;
  }

  get redMax(): number {
    return this.health.redMax;
  }

  placeAt(x: number, y: number): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = this.vy = 0;
    this.pushX = this.pushY = 0;
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
  if (p.holdTime > 0) {
    p.holdTime = Math.max(0, p.holdTime - dt);
    if (p.holdTime === 0) p.holdItem = '';
  }

  if (p.dead) {
    p.deathTime += dt;
    p.vx = p.vy = 0;
    p.pushX = p.pushY = 0;
    p.firing = false;
    return;
  }

  movePlayer(w, input, dt);
  firePlayer(w, input, dt);
  // Action buttons (edge-triggered): bomb (E), active (Space), consumable (Q).
  if (input.bomb) placeBomb(w);
  if (input.active) useActive(w);
  if (input.consumable) useConsumable(w);
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

  // Integrate, then resolve against tiles, dummies and pedestals. Remove the velocity component
  // pushing into whatever we hit so the player slides along instead of sticking.
  const mode = p.flags.flying ? FLY_MODE : WALK_MODE;
  scratchPos.x = p.x + (p.vx + p.pushX) * dt;
  scratchPos.y = p.y + (p.vy + p.pushY) * dt;
  if (p.pushX !== 0 || p.pushY !== 0) {
    const k = Math.max(0, 1 - ENEMY_TUNING.playerPushDecay * dt);
    p.pushX *= k;
    p.pushY *= k;
    if (p.pushX * p.pushX + p.pushY * p.pushY < 4) p.pushX = p.pushY = 0;
  }
  if (resolveCircleVsGrid(w.room, scratchPos, p.r, mode, scratchN)) {
    cancelInto(p, scratchN.x, scratchN.y);
    const into = p.pushX * scratchN.x + p.pushY * scratchN.y;
    if (into < 0) {
      p.pushX -= into * scratchN.x;
      p.pushY -= into * scratchN.y;
    }
  }
  let pushed = false;
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.popped) continue;
    if (resolveCircleVsCircle(scratchPos, p.r, d.x, d.y, d.r, scratchN)) {
      cancelInto(p, scratchN.x, scratchN.y);
      pushed = true;
    }
  }
  const peds = w.pedestals;
  for (let i = 0; i < peds.count; i++) {
    const ped = peds.items[i]!;
    if (resolveCircleVsCircle(scratchPos, p.r, ped.x, ped.y, ITEM_TUNING.pedestalRadius, scratchN)) {
      cancelInto(p, scratchN.x, scratchN.y);
      pushed = true;
    }
  }
  // An obstacle may have pushed us into a rock: settle against the grid once more.
  if (pushed) resolveCircleVsGrid(w.room, scratchPos, p.r, mode, scratchN);

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
  const m = spawnMarble(w, sx, sy, T.shotHeight, vx, vy, s.damage, s.range, s.shotSize, s.knockback);
  if (m && p.flags.spectral) m.phase = true;
  p.aimX = ax;
  p.aimY = ay;
  p.sinceShot = 0;
  p.shotsFired++;
  w.counters.shots++;
  w.events.emit('shoot', sx, sy - T.shotHeight, ax, ay);
  fireTrigger(w, 'fire', sx, sy);
}
