/**
 * Behaviour library extension A (added with the Drowned Nursery / Rootcellar / Candlewick Crypt /
 * Grinding Works / Rust Foundry enemies). Same contracts as movement.ts and attacks.ts: params are
 * `name: [default, min, max]`, nothing allocates per tick, every sudden move or attack is telegraphed.
 *
 *   bounce (move)   Ricochets in straight lines off walls, rocks and pits: diagonal (the corner-to-corner
 *                   wind-up toy) or a horizontal / vertical patrol (`axis`). Each ricochet fires the
 *                   enemy's `on: 4` (ON_BONK) attacks; `pause` makes it stop and re-wind (telegraphed).
 *   lurk (move)     An ambusher: sits still, looking like part of the room, until its target comes within
 *                   `wake` px or it gets hit; then it rouses (telegraph), fires its `on: 3` (ON_APPEAR)
 *                   attacks and chases (around obstacles with `path` 1). Timer attacks wait until it wakes.
 *   spiral (attack) A rotating stream: `count` shots per arm, `interval` s apart, `arms` evenly spaced
 *                   streams turning at `spin` °/s (a sprinkler). With `aim` 1 it sweeps `sweep`° across
 *                   the target instead (a hose). Runs on the burst machinery: one shot per interval, the
 *                   rest of the enemy's timer attacks wait until the stream ends.
 *
 * This module must not import movement.ts / attacks.ts (they import it for their registries).
 */

import { vec2 } from '../../../engine/math';
import { WALK_MODE } from '../../collision';
import type { World } from '../../world';
import { triggerAttacks } from '../attackRunner';
import type { Enemy } from '../enemy';
import { lineClear } from '../pathfield';
import { spawnEnemyShot } from '../shots';
import { ST_CHARM, hasStatus } from '../status';
import {
  ATTACK_COMMON,
  ON_APPEAR,
  ON_BONK,
  ON_TIMER,
  SHOT_COMMON,
  feared,
  goalDir,
  targetDist,
  telegraph,
  type AttackBehavior,
  type CompiledAttack,
  type MoveBehavior,
} from './common';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const DIAG = Math.SQRT1_2;
const scratch = vec2();

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function toward(e: Enemy, x: number, y: number, spd: number): void {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-4) {
    e.tvx = (dx / d) * spd;
    e.tvy = (dy / d) * spd;
    e.dirX = dx / d;
    e.dirY = dy / d;
  } else {
    stop(e);
  }
}

// ── bounce: straight-line ricochets (diagonal) or a back-and-forth patrol (axis 1 / 2) ──

/** Unit sign, never 0 (0 → a random side). */
function side(w: World, v: number): number {
  return v > 0.2 ? 1 : v < -0.2 ? -1 : w.combatRng.sign();
}

/** New heading after hitting something with surface normal (nx, ny). */
function ricochet(w: World, e: Enemy, axis: number, seek: number, nx: number, ny: number): void {
  if (axis === 1) {
    e.dirX = e.dirX > 0 ? -1 : 1;
    e.dirY = 0;
    return;
  }
  if (axis === 2) {
    e.dirX = 0;
    e.dirY = e.dirY > 0 ? -1 : 1;
    return;
  }
  // Mirror the heading on the surface, then snap it back onto a diagonal that leads away from it.
  const d = e.dirX * nx + e.dirY * ny;
  let sx = side(w, e.dirX - 2 * d * nx);
  let sy = side(w, e.dirY - 2 * d * ny);
  if (sx * nx + sy * ny <= 0) {
    sx = side(w, nx);
    sy = side(w, ny);
  }
  // Sometimes it turns toward its target (only if that still leads away from the wall).
  if (seek > 0 && e.hasTgt && w.combatRng.next() < seek) {
    const tx = side(w, e.tgtX - e.x);
    const ty = side(w, e.tgtY - e.y);
    if (tx * nx + ty * ny > 0) {
      sx = tx;
      sy = ty;
    }
  }
  e.dirX = sx * DIAG;
  e.dirY = sy * DIAG;
}

export const bounce: MoveBehavior = {
  params: {
    /** 0 = diagonal ricochets, 1 = horizontal patrol, 2 = vertical patrol. */
    axis: [0, 0, 2],
    /** Chance a ricochet heads toward the target (diagonal mode). */
    seek: [0.3, 0, 1],
    /** Rest after each ricochet (re-winding, telegraphed), s. */
    pause: [0, 0, 2],
  },
  init(w, e, p) {
    const rng = w.combatRng;
    const axis = p.axis!;
    if (axis === 1) {
      e.dirX = rng.sign();
      e.dirY = 0;
    } else if (axis === 2) {
      e.dirX = 0;
      e.dirY = rng.sign();
    } else {
      e.dirX = rng.sign() * DIAG;
      e.dirY = rng.sign() * DIAG;
    }
    e.mode = 0;
    e.modeT = 0;
    e.m0 = 0;
  },
  update(w, e, p, dt, spd) {
    if (e.mode === 1) {
      // Re-winding after a ricochet.
      stop(e);
      e.modeT -= dt;
      if (e.modeT > 0) return;
      e.mode = 0;
    }
    let turned = false;
    if (e.blocked && e.dirX * e.wallNX + e.dirY * e.wallNY < -0.05) {
      // Last tick's collision pushed straight against the heading: ricochet.
      ricochet(w, e, p.axis!, p.seek!, e.wallNX, e.wallNY);
      turned = true;
    } else if (!e.moving) {
      // Wedged against something that isn't the grid (a pedestal, a crowd): turn around after a moment.
      e.m0 += dt;
      if (e.m0 > 0.4) {
        e.m0 = 0;
        ricochet(w, e, p.axis!, p.seek!, -e.dirX, -e.dirY);
      }
    } else {
      e.m0 = 0;
    }
    if (turned) {
      triggerAttacks(w, e, ON_BONK);
      if (p.pause! > 0) {
        e.mode = 1;
        e.modeT = p.pause!;
        telegraph(e, p.pause!);
        w.events.emit('enemyWindup', e.x, e.y, 0, 0, e.def.id);
        stop(e);
        return;
      }
    }
    e.tvx = e.dirX * spd;
    e.tvy = e.dirY * spd;
    e.snap = true;
  },
};

// ── lurk: dormant (disguised) → rouse (telegraph, ON_APPEAR attacks) → chase ──

/** Keeps timer attacks from firing while it plays dead. */
function holdTimerAttacks(e: Enemy): void {
  const atks = e.cfg.attacks;
  for (let i = 0; i < atks.length; i++) if (atks[i]!.p.on === ON_TIMER && e.atkT[i]! < 0.3) e.atkT[i] = 0.3;
}

export const lurk: MoveBehavior = {
  handlesFear: true,
  params: {
    /** Wakes when its target comes this close (px), or when it is hit. */
    wake: [48, 16, 160],
    /** Rousing telegraph before it moves, s. */
    rouse: [0.5, 0.1, 2],
    /** 1 = chases around rocks and pits (shared flow field), 0 = straight at the target. */
    path: [1, 0, 1],
  },
  init(_w, e) {
    e.mode = 0;
    e.modeT = 0;
    e.m0 = 0;
    e.m1 = 0;
  },
  update(w, e, p, dt, spd) {
    if (e.mode === 0) {
      stop(e);
      holdTimerAttacks(e);
      if ((e.hasTgt && targetDist(e) < p.wake!) || e.hurtT < 0.25) {
        e.mode = 1;
        e.modeT = p.rouse!;
        telegraph(e, p.rouse!);
        w.events.emit('enemyWindup', e.x, e.y, 0, 0, e.def.id);
      }
      return;
    }
    if (e.mode === 1) {
      stop(e);
      holdTimerAttacks(e);
      e.modeT -= dt;
      if (e.modeT > 0) return;
      e.mode = 2;
      const atks = e.cfg.attacks;
      for (let i = 0; i < atks.length; i++) {
        const a = atks[i]!;
        // The wake-up attack is ready; timer attacks come a beat later (never on the same tick).
        if (a.p.on === ON_APPEAR) e.atkT[i] = 0;
        else if (a.p.on === ON_TIMER) e.atkT[i] = Math.max(0.6, a.cooldown * 0.5);
      }
      triggerAttacks(w, e, ON_APPEAR);
      return;
    }
    // Awake.
    if (feared(e)) {
      if (goalDir(w, e) === Infinity) {
        stop(e);
        return;
      }
      e.tvx = e.dirX * spd;
      e.tvy = e.dirY * spd;
      return;
    }
    if (!e.hasTgt) {
      stop(e);
      return;
    }
    if (p.path! > 0 && e.tgtPlayer) {
      // Line of sight re-checked a few times a second (m0 = clear, m1 = timer), else the flow field.
      e.m1 -= dt;
      if (e.m1 <= 0) {
        e.m1 = 0.12;
        e.m0 = lineClear(w.room, e.x, e.y, e.tgtX, e.tgtY, e.r * 0.9, WALK_MODE) ? 1 : 0;
      }
      if (e.m0 !== 1) {
        w.flow.refresh(w.room, w.tick, e.tgtX, e.tgtY, 10);
        if (w.flow.dirAt(e.x, e.y, scratch)) {
          e.tvx = scratch.x * spd;
          e.tvy = scratch.y * spd;
          e.dirX = scratch.x;
          e.dirY = scratch.y;
          return;
        }
      }
    }
    toward(e, e.tgtX, e.tgtY, spd);
  },
};

// ── spiral: a rotating (or sweeping) stream of shots ─────────────────────────

function shootAt(w: World, e: Enemy, a: CompiledAttack, angle: number): void {
  const p = a.p;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const off = e.r * 0.5;
  const shot = spawnEnemyShot(
    w,
    e.x + c * off,
    e.y + s * off,
    c * p.speed!,
    s * p.speed!,
    p.dmg!,
    p.size!,
    a.style,
    hasStatus(e.status, ST_CHARM),
    e.uid,
  );
  if (shot) {
    shot.accel = p.accel!;
    shot.curve = p.curve!;
    shot.phase = p.phase! > 0;
    shot.life = p.life!;
  }
}

export const spiral: AttackBehavior = {
  params: {
    ...ATTACK_COMMON,
    ...SHOT_COMMON,
    /** Shots per arm. */
    count: [10, 2, 40],
    /** Seconds between shots. */
    interval: [0.1, 0.03, 0.5],
    /** Evenly spaced streams. */
    arms: [1, 1, 6],
    /** Rotation, degrees per second (negative = anticlockwise). */
    spin: [150, -720, 720],
    /** 1 = sweep across the target (a hose) instead of spinning. */
    aim: [0, 0, 1],
    /** aim 1: total sweep, degrees. */
    sweep: [90, 10, 270],
  },
  fire(w, e, a) {
    const p = a.p;
    const count = p.count!;
    if (e.burstLeft <= 0 || e.burstA !== a) {
      e.burstLeft = count;
      e.burstA = a;
    }
    const i = count - e.burstLeft;
    let base: number;
    if (p.aim! > 0) {
      const at = e.hasTgt ? Math.atan2(e.tgtY - e.y, e.tgtX - e.x) : e.face > 0 ? 0 : Math.PI;
      base = at + ((count > 1 ? i / (count - 1) : 0.5) - 0.5) * p.sweep! * DEG;
    } else {
      // Sim time drives the turn (no stored state); the uid staggers neighbours.
      base = (e.age * p.spin! + e.uid * 47) * DEG;
    }
    const arms = p.arms!;
    for (let k = 0; k < arms; k++) shootAt(w, e, a, base + (k / arms) * TAU);
    w.events.emit('enemyShoot', e.x, e.y, arms, a.style, e.def.id);
    e.burstLeft--;
    e.burstT = p.interval!;
    if (e.burstLeft <= 0) e.burstA = null;
  },
};
