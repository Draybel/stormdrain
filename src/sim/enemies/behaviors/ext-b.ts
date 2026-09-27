/**
 * Behaviour-library extension B (the chapter 4-6 enemies): three movements and one attack that the
 * late chapters need for smarter movement and denser bullet patterns. Registered with one line each in
 * MOVES (movement.ts), ATTACKS (attacks.ts) and MOVE_KINDS / ATTACK_KINDS (sim/types.ts).
 *
 *   intercept (move)   heads for where the target WILL be (leads a moving player), weaving across its
 *                      approach; walkers path-find around rocks and pits, flyers go straight.
 *   swoop     (move)   flyer: circles the target, hovers (telegraph), then dives in a straight line
 *                      through her spot and out the other side. ON_BONK attacks fire as a dive ends.
 *   ambush    (move)   lies dormant (a disguise) until its target comes close, it gets hurt or it runs
 *                      out of patience; a rousing telegraph, then it hunts like chasePath. Its attack
 *                      clocks are held while it sleeps, so a sleeping lurker is always harmless.
 *   stream    (attack) a timed stream of shots: `arms` evenly spaced arms, each step turned `turn`°
 *                      from the last (spirals, sprinkler sweeps); `aim` centres the sweep on the target.
 *
 * Same rules as the rest of the library: params are `[default, min, max]`, state lives in the enemy's
 * mode / modeT / m0..m3 slots, every sudden move is telegraphed, and nothing allocates per tick.
 */

import { vec2 } from '../../../engine/math';
import { WALK_MODE } from '../../collision';
import { ROOM_H, ROOM_W } from '../../constants';
import type { World } from '../../world';
import { triggerAttacks } from '../attackRunner';
import type { Enemy } from '../enemy';
import { lineClear } from '../pathfield';
import { spawnEnemyShot } from '../shots';
import { ST_CHARM, hasStatus } from '../status';
import {
  ATTACK_COMMON,
  ON_BONK,
  SHOT_COMMON,
  feared,
  goalDir,
  targetDist,
  telegraph,
  type AttackBehavior,
  type CompiledAttack,
  type MoveBehavior,
} from './common';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const scratch = vec2();

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function clampX(x: number, r: number): number {
  return x < r ? r : x > ROOM_W - r ? ROOM_W - r : x;
}

function clampY(y: number, r: number): number {
  return y < r ? r : y > ROOM_H - r ? ROOM_H - r : y;
}

/**
 * Walker pathing shared by intercept and ambush: straight at (gx, gy) when the line to it is clear
 * (re-checked every 0.12 s, cached in m0 / m1), else the room's shared flow field toward the player.
 * Returns true when it wrote a velocity from the flow field.
 */
function followField(w: World, e: Enemy, gx: number, gy: number, recalc: number, spd: number, dt: number): boolean {
  e.m1 -= dt;
  if (e.m1 <= 0) {
    e.m1 = 0.12;
    e.m0 = lineClear(w.room, e.x, e.y, gx, gy, e.r * 0.9, WALK_MODE) ? 1 : 0;
  }
  if (e.m0 === 1 || !e.tgtPlayer) return false;
  w.flow.refresh(w.room, w.tick, e.tgtX, e.tgtY, recalc);
  if (!w.flow.dirAt(e.x, e.y, scratch)) return false;
  e.tvx = scratch.x * spd;
  e.tvy = scratch.y * spd;
  e.dirX = scratch.x;
  e.dirY = scratch.y;
  return true;
}

// ── intercept: cut the target off instead of trailing behind her ──────────────
const intercept: MoveBehavior = {
  params: {
    /** Seconds of the player's motion it leads (never more than its own travel time to her). */
    lead: [0.7, 0, 2],
    /** Weave across the approach (fraction of speed; fades out up close) and its frequency, Hz. */
    weave: [0.35, 0, 1.5],
    freq: [1.2, 0.1, 4],
    /** Walkers: ticks between shared flow-field refreshes. */
    recalc: [10, 2, 60],
  },
  init(w, e) {
    e.m0 = 0;
    e.m1 = 0;
    e.m2 = w.combatRng.next() * TAU;
  },
  update(w, e, p, dt, spd) {
    if (!e.hasTgt) {
      stop(e);
      return;
    }
    let gx = e.tgtX;
    let gy = e.tgtY;
    if (e.tgtPlayer) {
      const pl = w.player;
      const dx = gx - e.x;
      const dy = gy - e.y;
      const t = Math.min(p.lead!, Math.sqrt(dx * dx + dy * dy) / Math.max(20, spd));
      gx = clampX(gx + pl.vx * t, e.r);
      gy = clampY(gy + pl.vy * t, e.r);
    }
    if (!e.flying && followField(w, e, gx, gy, p.recalc!, spd, dt)) return;
    let dx = gx - e.x;
    let dy = gy - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) {
      stop(e);
      return;
    }
    dx /= d;
    dy /= d;
    e.dirX = dx;
    e.dirY = dy;
    const s = Math.sin(e.age * p.freq! * TAU + e.m2) * p.weave! * Math.min(1, d / 40);
    const vx = dx - dy * s;
    const vy = dy + dx * s;
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    e.tvx = (vx / l) * spd;
    e.tvy = (vy / l) * spd;
  },
};

// ── swoop: circle → hover (telegraph) → straight dive through her spot → circle again ──
const swoop: MoveBehavior = {
  flying: true,
  params: {
    /** Circling radius around the target, px. */
    radius: [60, 20, 120],
    /** Circling speed, rad/s. */
    spin: [1.5, 0.2, 5],
    /** Seconds circling between dives (±25 %). */
    every: [2.2, 0.5, 8],
    /** Hover before the dive (the telegraph; it keeps its eye on the target), s. */
    windup: [0.45, 0.1, 2],
    diveSpeed: [200, 60, 360],
    /** How far past the target's spot the dive carries on, px. */
    over: [40, 0, 140],
    /** 1 clockwise, -1 counter-clockwise, 0 random. */
    dir: [0, -1, 1],
  },
  init(w, e, p) {
    e.mode = 0;
    e.modeT = p.every! * (0.5 + 0.5 * w.combatRng.next());
    e.m1 = p.dir! === 0 ? w.combatRng.sign() : Math.sign(p.dir!);
    e.m2 = 0;
    e.m3 = 0;
  },
  update(w, e, p, dt, spd) {
    if (e.mode === 0) {
      if (!e.hasTgt) {
        stop(e);
        return;
      }
      if (e.m2 === 0) {
        e.m0 = Math.atan2(e.y - e.tgtY, e.x - e.tgtX);
        e.m2 = 1;
      }
      if (e.blocked) e.m1 = -e.m1;
      e.m0 += p.spin! * e.m1 * dt;
      const gx = clampX(e.tgtX + Math.cos(e.m0) * p.radius!, e.r);
      const gy = clampY(e.tgtY + Math.sin(e.m0) * p.radius!, e.r);
      const dx = gx - e.x;
      const dy = gy - e.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const s = Math.min(spd * 1.3, d * 5);
      if (d > 1e-4) {
        e.tvx = (dx / d) * s;
        e.tvy = (dy / d) * s;
      } else {
        stop(e);
      }
      e.modeT -= dt;
      if (e.modeT <= 0 && targetDist(e) > 12) {
        e.mode = 1;
        e.modeT = p.windup!;
        telegraph(e, p.windup!);
        w.events.emit('enemyWindup', e.x, e.y, 1, 0, e.def.id);
      }
      return;
    }
    if (e.mode === 1) {
      stop(e);
      if (e.hasTgt) e.face = e.tgtX >= e.x ? 1 : -1;
      e.modeT -= dt;
      if (e.modeT > 0) return;
      // Dive: locked now, straight through the target's spot and `over` px beyond.
      const d = goalDir(w, e);
      e.m3 = (d === Infinity ? 60 : d) + p.over!;
      e.mode = 2;
      w.events.emit('enemyDash', e.x, e.y, e.dirX, e.dirY, e.def.id);
      return;
    }
    e.tvx = e.dirX * p.diveSpeed!;
    e.tvy = e.dirY * p.diveSpeed!;
    e.snap = true;
    e.m3 -= p.diveSpeed! * dt;
    if (e.m3 <= 0 || (e.blocked && e.dirX * e.wallNX + e.dirY * e.wallNY < -0.5)) {
      e.mode = 0;
      e.modeT = p.every! * (0.75 + 0.5 * w.combatRng.next());
      e.m2 = 0;
      e.snap = false;
      e.vx *= 0.35;
      e.vy *= 0.35;
      triggerAttacks(w, e, ON_BONK);
    }
  },
};

// ── ambush: dormant disguise → rousing telegraph → path-finding hunt ─────────────
/** Keeps a sleeping lurker's attack clocks from running out (the first attack comes ≥ 0.5 s after waking). */
function holdAttacks(e: Enemy): void {
  const t = e.atkT;
  for (let i = 0; i < t.length; i++) if (t[i]! < 0.5) t[i] = 0.5;
}

const ambush: MoveBehavior = {
  handlesFear: true,
  params: {
    /** Wakes when its target comes this close, px. */
    wake: [44, 8, 160],
    /** Rousing telegraph, s. */
    rouse: [0.55, 0.1, 2],
    /** Wakes on its own after this many seconds (0 = never). */
    patience: [0, 0, 30],
    /** Ticks between shared flow-field refreshes. */
    recalc: [10, 2, 60],
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
      holdAttacks(e);
      const near = e.hasTgt && targetDist(e) < p.wake!;
      const poked = e.hurtT < 0.25;
      const bored = p.patience! > 0 && e.age > p.patience!;
      if (near || poked || bored) {
        e.mode = 1;
        e.modeT = p.rouse!;
        telegraph(e, p.rouse!);
        w.events.emit('enemyWindup', e.x, e.y, 0, 0, e.def.id);
      }
      return;
    }
    if (e.mode === 1) {
      stop(e);
      holdAttacks(e);
      e.modeT -= dt;
      if (e.modeT <= 0) e.mode = 2;
      return;
    }
    // Awake. Frightened: run from the player (a sleeping one just keeps playing dead).
    if (feared(e)) {
      if (goalDir(w, e) !== Infinity) {
        e.tvx = e.dirX * spd;
        e.tvy = e.dirY * spd;
      }
      return;
    }
    if (!e.hasTgt) {
      stop(e);
      return;
    }
    if (followField(w, e, e.tgtX, e.tgtY, p.recalc!, spd, dt)) return;
    const d = goalDir(w, e);
    if (d < 1) {
      stop(e);
      return;
    }
    e.tvx = e.dirX * spd;
    e.tvy = e.dirY * spd;
  },
};

// ── stream: a timed stream of shots (spirals, sweeps) ─────────────────────────
function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function aimAt(e: Enemy): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  return Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
}

function shoot(w: World, e: Enemy, a: CompiledAttack, angle: number): void {
  const p = a.p;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const sp = p.speed!;
  const off = e.r * 0.5;
  const shot = spawnEnemyShot(w, e.x + c * off, e.y + s * off, c * sp, s * sp, p.dmg!, p.size!, a.style, allied(e), e.uid);
  if (shot) {
    shot.accel = p.accel!;
    shot.curve = p.curve!;
    shot.phase = p.phase! > 0;
    shot.life = p.life!;
  }
}

const stream: AttackBehavior = {
  params: {
    ...ATTACK_COMMON,
    ...SHOT_COMMON,
    /** Steps (shots per arm). */
    count: [12, 2, 32],
    /** Seconds between steps. */
    interval: [0.08, 0.03, 0.5],
    /** Degrees each step turns from the last (+ clockwise). */
    turn: [15, -60, 60],
    /** Evenly spaced arms, one shot each per step. */
    arms: [1, 1, 4],
    /** 1 = the sweep is centred on the target (re-aimed every step), 0 = a fixed start angle. */
    aim: [0, 0, 1],
    /** Degrees the whole pattern turns from one stream to the next. */
    spin: [0, -90, 90],
  },
  fire(w, e, a) {
    const p = a.p;
    const n = p.count!;
    if (e.burstLeft <= 0 || e.burstA !== a) {
      e.burstLeft = n;
      e.burstA = a;
    }
    const i = n - e.burstLeft;
    // fireAttack counts the volley after the first step, so the later steps see volleys + 1.
    const v = i === 0 ? e.volleys : e.volleys - 1;
    let base = v * p.spin! * DEG + (i - (p.aim! > 0 ? (n - 1) / 2 : 0)) * p.turn! * DEG;
    if (p.aim! > 0) base += aimAt(e);
    const arms = p.arms!;
    for (let k = 0; k < arms; k++) shoot(w, e, a, base + (k / arms) * TAU);
    w.events.emit('enemyShoot', e.x, e.y, arms, a.style, e.def.id);
    e.burstLeft--;
    e.burstT = p.interval!;
    if (e.burstLeft <= 0) e.burstA = null;
  },
};

/** Spread into MOVES (movement.ts). */
export const EXT_B_MOVES = { intercept, swoop, ambush } as const;
/** Spread into ATTACKS (attacks.ts). */
export const EXT_B_ATTACKS = { stream } as const;
