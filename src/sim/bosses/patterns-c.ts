/**
 * Boss pattern kinds added by boss pack C (chapters 5-6; guide: docs/content-bosses-c.md). Same
 * contract as the library in patterns.ts: numeric params `name: [default, min, max]`, a tiny state
 * machine over the BossState scratch slots, a telegraph first ('bossTell', flash + squash, a pose),
 * timers ÷ pace and shot speeds × √pace, every projectile through the enemy shot pools (caps, charm).
 * Nothing allocates per tick.
 *
 *   dropLine  a domino line of marked drops (lobbed globs, falling debris or lightning) marching away
 *             from the boss toward the target — several fanned lines — or a cross / an X centred on
 *             where the target stood. The landing rings are the telegraph; the gaps between lines are
 *             the way out.
 *   halo      shots spawn on a circle around the boss and orbit it (one or two counter-rotating rings)
 *             for a moment, then let go: outward, converging on the target, or flying at the target as
 *             one formation (step into its hole or out of its way).
 *   ricochet  a telegraphed roll / tumble (aim line) that bounces off walls, rocks and pits a few
 *             times, bursting shots at every bounce, then bonks to a stop (a daze to punish).
 *
 * Self-contained on purpose (no import of patterns.ts, which imports this module).
 */

import { DEG, TAU } from '../../engine/math';
import { ROOM_H, ROOM_W } from '../constants';
import type { Enemy } from '../enemies/enemy';
import { ATTACK_COMMON, SHOT_COMMON, telegraph, type ParamSpec } from '../enemies/behaviors/common';
import { spawnEnemyShot, spawnLob } from '../enemies/shots';
import { ST_CHARM, hasStatus } from '../enemies/status';
import type { World } from '../world';
import type { CompiledPattern } from './compile';
import type { PatternBehavior } from './patterns';
import type { BossState } from './state';

// ── Helpers (mirrors of the private ones in patterns.ts) ──────────────────────

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function sp(b: BossState, v: number): number {
  return v * Math.sqrt(b.pace);
}

function targetAngle(e: Enemy): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  return Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
}

/** Starts a telegraph of `seconds` (÷ pace): flash + squash, a pose, the 'bossTell' event. */
function tell(w: World, e: Enemy, b: BossState, cp: CompiledPattern, seconds: number, anim = 'windup'): void {
  const t = seconds / b.pace;
  b.mode = 0;
  b.t = t;
  b.anim = anim;
  if (t > 0.01) {
    telegraph(e, t);
    w.events.emit('bossTell', e.x, e.y, cp.index, 0, e.def.id);
  }
}

/** One pattern shot (size / dmg / accel / curve / phase / life from the pattern's params). */
function shot(w: World, e: Enemy, cp: CompiledPattern, x: number, y: number, angle: number, speed: number, life?: number) {
  const p = cp.p;
  const s = spawnEnemyShot(w, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, p.dmg ?? 1, p.size ?? 3, cp.style, allied(e), e.uid);
  if (s) {
    s.accel = p.accel ?? 0;
    s.curve = p.curve ?? 0;
    s.phase = (p.phase ?? 0) > 0;
    s.life = life ?? p.life ?? 3;
  }
  return s;
}

function shotSpec(own: ParamSpec): ParamSpec {
  return { windup: ATTACK_COMMON.windup!, ...SHOT_COMMON, ...own };
}

// ── dropLine ──────────────────────────────────────────────────────────────────

/** dropLine layouts. */
const LINE_AIMED = 0;
const LINE_CROSS = 1;
const LINE_X = 2;

const dropLine: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** Aimed layout: lines fanned `fan` degrees apart, centred on the target. */
    lines: [1, 1, 5],
    fan: [30, 0, 90],
    /** Drops per line (per arm for the cross / X). */
    count: [6, 2, 14],
    /** Distance between drops (px). */
    spacing: [18, 8, 40],
    /** Aimed layout: the first drop's distance beyond the boss's edge (px). */
    start: [14, 0, 60],
    /** Seconds between successive drops of a line (the domino). */
    step: [0.1, 0.02, 0.5],
    /** Fall / flight time = the landing ring's warning (s). */
    air: [0.8, 0.3, 2],
    /** 0 globs lobbed from the boss, 1 falling debris, 2 lightning strikes. */
    look: [0, 0, 2],
    splash: [9, 4, 20],
    dmg: [1, 1, 3],
    /** Shots bursting out of each landing. */
    split: [0, 0, 6],
    /** 1 = each landing leaves a puddle. */
    creep: [0, 0, 1],
    creepLife: [3, 1, 10],
    /** 0 aimed lines from the boss, 1 a cross (row + column) on the target, 2 an X on the target. */
    layout: [0, 0, 2],
  },
  start(w, e, b, cp) {
    b.n = 0;
    b.k = 0;
    // Lock the layout now: the lines point where the target was at the telegraph.
    b.a0 = targetAngle(e);
    if (cp.p.layout! === LINE_AIMED || !e.hasTgt) {
      b.ax = e.x;
      b.ay = e.y;
    } else {
      b.ax = e.tgtX;
      b.ay = e.tgtY;
    }
    tell(w, e, b, cp, cp.p.windup!, cp.p.look! === 0 ? 'roar' : 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = 0;
      b.anim = p.look! === 0 ? 'roar' : 'slam';
      if (p.look! === 1) w.events.emit('bossSlam', e.x, e.y, e.r * 2, 1, e.def.id);
      return false;
    }
    // b.t counts down from 0: elapsed = -b.t.
    const elapsed = -b.t;
    const n = p.count!;
    const step = p.step! / b.pace;
    let fired = 0;
    while (b.n < n && elapsed >= b.n * step) {
      fired += dropStep(w, e, b, cp, b.n);
      b.n++;
    }
    if (fired > 0 && p.look! === 0) w.events.emit('enemyLob', e.x, e.y, fired, cp.style, e.def.id);
    return b.n >= n && elapsed >= (n - 1) * step + 0.35;
  },
};

/** Drops the `i`-th spot of every line; returns how many went off. */
function dropStep(w: World, e: Enemy, b: BossState, cp: CompiledPattern, i: number): number {
  const p = cp.p;
  const layout = p.layout!;
  let fired = 0;
  if (layout === LINE_AIMED || !e.hasTgt) {
    const lines = p.lines!;
    const d = e.r + p.start! + i * p.spacing!;
    for (let l = 0; l < lines; l++) {
      const a = b.a0 + (l - (lines - 1) / 2) * p.fan! * DEG;
      fired += dropAt(w, e, cp, b.ax + Math.cos(a) * d, b.ay + Math.sin(a) * d);
    }
    return fired;
  }
  // Cross / X centred on the locked spot, spreading outward (the centre drops once).
  if (i === 0) return dropAt(w, e, cp, b.ax, b.ay);
  const d = i * p.spacing!;
  const dirs = layout === LINE_X ? X_DIRS : CROSS_DIRS;
  for (let k = 0; k < 8; k += 2) fired += dropAt(w, e, cp, b.ax + dirs[k]! * d, b.ay + dirs[k + 1]! * d);
  return fired;
}

/** Arm directions (x, y pairs) of the cross and the X layouts. */
const CROSS_DIRS = [1, 0, -1, 0, 0, 1, 0, -1] as const;
const X_DIRS = [Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2, -Math.SQRT1_2, -Math.SQRT1_2, Math.SQRT1_2] as const;

/** One drop on (x, y) if it is inside the room. */
function dropAt(w: World, e: Enemy, cp: CompiledPattern, x: number, y: number): number {
  if (x < 4 || y < 4 || x > ROOM_W - 4 || y > ROOM_H - 4) return 0;
  const p = cp.p;
  const look = p.look!;
  const s =
    look === 0
      ? spawnLob(w, e.x, e.y - e.r * 0.5, x, y, p.air!, 34, p.dmg!, 3, cp.style, allied(e), e.uid)
      : spawnLob(w, x, y, x, y, p.air!, look === 2 ? 120 : 90, p.dmg!, look === 2 ? 2 : 3, cp.style, allied(e), e.uid);
  if (!s) return 0;
  s.fall = look === 0 ? 0 : look;
  s.splash = p.splash!;
  s.split = p.split!;
  if (p.creep! > 0) {
    s.creep = 1;
    s.creepR = Math.max(6, p.splash! * 0.9);
    s.creepLife = p.creepLife!;
  }
  return 1;
}

// ── halo ───────────────────────────────────────────────────────────────────────

/** halo release modes. */
const HALO_OUT = 0;
const HALO_CONVERGE = 1;
const HALO_FORMATION = 2;

const halo: PatternBehavior = {
  params: shotSpec({
    windup: [0.5, 0, 2],
    /** Shots per ring. */
    count: [10, 3, 24],
    /** 2 = a second, wider ring turning the other way. */
    rings: [1, 1, 2],
    /** Orbit radius from the boss's centre (px); the second ring sits 12 px further out. */
    radius: [24, 10, 60],
    /** Orbit speed, rad/s (negative = the other way). */
    spin: [2.4, -6, 6],
    /** Seconds the shots circle before they are let go. */
    hold: [1, 0.3, 3],
    /** Release speed (px/s). */
    speed: [90, 20, 260],
    /** 0 outward, 1 converging on the target, 2 the whole halo flies at the target. */
    aim: [0, 0, 2],
    /** Halos in a row (each spawned as the previous one is let go). */
    repeats: [1, 1, 3],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.mode === 1) {
      releaseHalo(w, e, b, cp);
      b.n++;
      if (b.n >= p.repeats!) return true;
    }
    spawnHalo(w, e, b, cp);
    b.mode = 1;
    b.anim = 'roar';
    b.t = p.hold! / b.pace;
    return false;
  },
};

/** Spawns the orbiting ring(s); tags them by their exact turn rate (b.a0 / b.a1). */
function spawnHalo(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  const p = cp.p;
  const rings = p.rings!;
  b.ax = e.x;
  b.ay = e.y;
  // A per-halo nudge keeps the tag unique among this boss's other curving shots.
  const nudge = 1e-6 * (b.n + 1);
  const off = w.combatRng.next() * TAU;
  for (let r = 0; r < rings; r++) {
    const R = p.radius! + r * 12;
    const omega = (r === 0 ? 1 : -1) * p.spin! * Math.sqrt(b.pace) + (r === 0 ? nudge : -nudge);
    if (r === 0) b.a0 = omega;
    else b.a1 = omega;
    const n = p.count! + r * 2;
    const life = p.hold! / b.pace + (p.life ?? 3);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU + r * (Math.PI / n);
      const x = b.ax + Math.cos(a) * R;
      const y = b.ay + Math.sin(a) * R;
      // Tangential velocity; with curve = omega the shot circles (ax, ay) at radius R.
      const s = spawnEnemyShot(w, x, y, -Math.sin(a) * omega * R, Math.cos(a) * omega * R, p.dmg!, p.size!, cp.style, allied(e), e.uid);
      if (!s) break;
      s.curve = omega;
      s.life = life;
      s.phase = (p.phase ?? 0) > 0;
    }
  }
  if (rings < 2) b.a1 = NaN;
  w.events.emit('enemyShoot', e.x, e.y, p.count!, cp.style, e.def.id);
}

/** Lets the current halo go (every live shot of this boss carrying one of its tags). */
function releaseHalo(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  const p = cp.p;
  const aim = p.aim!;
  const v = sp(b, p.speed!);
  const tx = e.hasTgt ? e.tgtX : b.ax + (e.face > 0 ? 1 : -1);
  const ty = e.hasTgt ? e.tgtY : b.ay;
  const formation = Math.atan2(ty - b.ay, tx - b.ax);
  const pool = w.enemyShots;
  let n = 0;
  for (let i = 0; i < pool.count; i++) {
    const s = pool.items[i]!;
    if (s.lob || s.owner !== e.uid || (s.curve !== b.a0 && s.curve !== b.a1)) continue;
    let a: number;
    if (aim === HALO_CONVERGE) a = Math.atan2(ty - s.y, tx - s.x);
    else if (aim === HALO_FORMATION) a = formation;
    else a = Math.atan2(s.y - b.ay, s.x - b.ax);
    s.curve = 0;
    s.vx = Math.cos(a) * v;
    s.vy = Math.sin(a) * v;
    s.accel = p.accel ?? 0;
    s.age = 0;
    s.life = p.life ?? 3;
    n++;
  }
  if (n > 0) w.events.emit('enemyShoot', b.ax, b.ay, n, cp.style, e.def.id);
}

// ── ricochet ───────────────────────────────────────────────────────────────────

const ricochet: PatternBehavior = {
  params: {
    windup: [0.8, 0.2, 2],
    speed: [190, 80, 360],
    /** Reflections off walls / rocks / pits before the final bonk. */
    bounces: [3, 1, 8],
    maxTime: [3.5, 0.5, 8],
    /** Shots bursting out at every bounce (0 = none) and their speed. */
    ring: [0, 0, 16],
    ringSpeed: [80, 30, 220],
    /** 0..1: how much each bounce turns toward the target (0 = a pure reflection). */
    home: [0, 0, 1],
    /** Aim lead on the first leg (0..1). */
    lead: [0, 0, 1],
    /** Dazed after the final bonk (s). */
    stun: [0.6, 0, 2],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    let a = targetAngle(e);
    const lead = cp.p.lead!;
    if (lead > 0 && e.hasTgt && e.tgtPlayer) {
      const t = Math.hypot(e.tgtX - e.x, e.tgtY - e.y) / Math.max(40, cp.p.speed!);
      a = Math.atan2(e.tgtY + w.player.vy * t * lead - e.y, e.tgtX + w.player.vx * t * lead - e.x);
    }
    b.ax = Math.cos(a);
    b.ay = Math.sin(a);
    b.tellLine = true;
    b.tellX = b.ax;
    b.tellY = b.ay;
    tell(w, e, b, cp, cp.p.windup!);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    b.t -= dt;
    switch (b.mode) {
      case 0:
        stop(e);
        e.face = b.ax >= 0 ? 1 : -1;
        if (b.t > 0) return false;
        b.mode = 1;
        b.t = p.maxTime! / Math.max(1, Math.sqrt(b.pace));
        b.k = 0;
        b.a1 = 0;
        b.tellLine = false;
        b.anim = 'charge';
        w.events.emit('enemyDash', e.x, e.y, b.ax, b.ay, e.def.id);
        return false;
      case 1: {
        const v = sp(b, p.speed!);
        b.k -= dt;
        // A contact against the motion (the integrator's push normal) or the room's edge = a bounce.
        let nx = 0;
        let ny = 0;
        if (b.k <= 0) {
          if (e.blocked && b.ax * e.wallNX + b.ay * e.wallNY < -0.3) {
            nx = e.wallNX;
            ny = e.wallNY;
          } else if (e.x <= e.r + 0.5 && b.ax < 0) nx = 1;
          else if (e.x >= ROOM_W - e.r - 0.5 && b.ax > 0) nx = -1;
          else if (e.y <= e.r + 0.5 && b.ay < 0) ny = 1;
          else if (e.y >= ROOM_H - e.r - 0.5 && b.ay > 0) ny = -1;
        }
        if (nx !== 0 || ny !== 0) {
          if (b.n >= p.bounces!) {
            finishRoll(w, e, b, cp);
            return false;
          }
          bounce(w, e, b, cp, nx, ny);
        }
        // Wedged (nothing moved for a while) or out of time: stop rolling.
        b.a1 = e.moving ? 0 : b.a1 + dt;
        if (b.t <= 0 || b.a1 > 0.25) {
          finishRoll(w, e, b, cp);
          return false;
        }
        e.tvx = b.ax * v;
        e.tvy = b.ay * v;
        e.snap = true;
        e.face = b.ax >= 0 ? 1 : -1;
        return false;
      }
      default:
        stop(e);
        return b.t <= 0;
    }
  },
};

function bounce(w: World, e: Enemy, b: BossState, cp: CompiledPattern, nx: number, ny: number): void {
  const p = cp.p;
  // Reflect about the contact normal.
  const d = b.ax * nx + b.ay * ny;
  let dx = b.ax - 2 * d * nx;
  let dy = b.ay - 2 * d * ny;
  // Optionally bend toward the target.
  const home = p.home!;
  if (home > 0 && e.hasTgt) {
    const ta = Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
    dx = dx * (1 - home) + Math.cos(ta) * home;
    dy = dy * (1 - home) + Math.sin(ta) * home;
  }
  // Never a flat ping-pong along one axis (or a stall): keep at least a little of each.
  if (Math.abs(dx) < 0.3) dx = dx < 0 ? -0.3 : 0.3;
  if (Math.abs(dy) < 0.3) dy = dy < 0 ? -0.3 : 0.3;
  // Never back into the surface it just hit.
  if (dx * nx + dy * ny < 0.2) {
    dx += nx * 0.5;
    dy += ny * 0.5;
  }
  const l = Math.sqrt(dx * dx + dy * dy) || 1;
  b.ax = dx / l;
  b.ay = dy / l;
  b.n++;
  b.k = 0.1;
  e.vx = e.vy = 0;
  w.events.emit('bonk', e.x - nx * e.r, e.y - ny * e.r, e.r, 0, e.def.id);
  burst(w, e, b, cp);
}

function finishRoll(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  stop(e);
  e.vx = e.vy = 0;
  w.events.emit('bossSlam', e.x, e.y, e.r * 1.5, 0, e.def.id);
  burst(w, e, b, cp);
  b.mode = 2;
  b.t = cp.p.stun! / b.pace;
  b.anim = 'slam';
}

function burst(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  const n = cp.p.ring!;
  if (n <= 0) return;
  const off = w.combatRng.next() * TAU;
  const v = sp(b, cp.p.ringSpeed!);
  const r = e.r * 0.6;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    shot(w, e, cp, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, a, v);
  }
  w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
}

/** The pack C kinds, spread into PATTERNS (patterns.ts). Keys must match BOSS_PATTERN_KINDS (types.ts). */
export const PATTERNS_C = { dropLine, halo, ricochet } as const satisfies Record<string, PatternBehavior>;
