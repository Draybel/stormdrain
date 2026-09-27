/**
 * The boss pattern library (BOSS_PATTERN_KINDS): big telegraphed moves composed by data. A phase lists
 * the patterns it uses (`PhaseSpec.patterns`); the brain (brain.ts) runs one at a time between rests
 * of baseline movement. Each pattern declares its numeric params as `name: [default, min, max]` (the
 * same convention as the enemy behaviours; validateBossDef checks them) and is a tiny state machine
 * over the BossState scratch slots (mode, t, n, k, ax/ay, a0/a1). Every pattern starts with a
 * telegraph (`tell`: flash + squash + a wind-up pose + the 'bossTell' event), so nothing is unfair.
 * Timers are divided by the phase's `pace`, shot speeds multiplied by √pace.
 *
 * Patterns never allocate per tick. Shots, lobs, shockwaves and creep go through the enemy shot pools
 * (sim/enemies/shots.ts), so every cap and the charmed-enemy rules apply to boss attacks too.
 */

import { DEG, TAU } from '../../engine/math';
import { ROOM_H, ROOM_W, TILE } from '../constants';
import { findEnemy } from '../../content/registry';
import { SRC_ALLY } from '../hittable';
import type { Enemy } from '../enemies/enemy';
import { ATTACK_COMMON, SHOT_COMMON, randomSpotNear, telegraph, walkableAt, type ParamSpec } from '../enemies/behaviors/common';
import { spawnEnemyShot, spawnLob, spawnWave, type EnemyShot } from '../enemies/shots';
import { spawnEnemy } from '../enemies/spawn';
import { ST_CHARM, hasStatus } from '../enemies/status';
import type { BossPatternKind } from '../types';
import type { World } from '../world';
import type { CompiledPattern } from './compile';
import type { BossState } from './state';
import { PATTERNS_A } from './patterns-a';
import { PATTERNS_B } from './patterns-b';
import { PATTERNS_C } from './patterns-c';
import { FINALS_PATTERNS } from './patterns-finals';

export interface PatternBehavior {
  readonly params: ParamSpec;
  /** summon / shields: needs an enemy (spec.enemy or a default). */
  readonly enemy?: string;
  start(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void;
  /** Per tick while it runs; returns true when finished. Writes the desired velocity (e.tvx / e.tvy). */
  update(w: World, e: Enemy, b: BossState, cp: CompiledPattern, dt: number): boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

/** Angle from the boss to its target (with lead on a moving player), or its facing. */
function aimAngle(w: World, e: Enemy, lead = 0, speed = 90): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  let tx = e.tgtX;
  let ty = e.tgtY;
  if (lead > 0 && e.tgtPlayer) {
    const t = Math.hypot(tx - e.x, ty - e.y) / Math.max(20, speed);
    tx += w.player.vx * t * lead;
    ty += w.player.vy * t * lead;
  }
  return Math.atan2(ty - e.y, tx - e.x);
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

/** Shot speed with the phase's pace. */
function sp(b: BossState, v: number): number {
  return v * Math.sqrt(b.pace);
}

/** One shot of pattern `cp` from (x, y) at `angle` (the pattern's size / dmg / accel / curve / life). */
function shot(w: World, e: Enemy, cp: CompiledPattern, b: BossState, x: number, y: number, angle: number, speed: number): EnemyShot | null {
  const p = cp.p;
  const v = sp(b, speed);
  const s = spawnEnemyShot(w, x, y, Math.cos(angle) * v, Math.sin(angle) * v, p.dmg ?? 1, p.size ?? 3, cp.style, allied(e), e.uid);
  if (s) {
    s.accel = p.accel ?? 0;
    s.curve = p.curve ?? 0;
    s.phase = (p.phase ?? 0) > 0;
    s.life = p.life ?? 3;
  }
  return s;
}

/** A ring of `n` shots around the boss starting at angle `off`. */
function ring(w: World, e: Enemy, cp: CompiledPattern, b: BossState, n: number, off: number, speed: number): void {
  if (n <= 0) return;
  const r = e.r * 0.6;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    shot(w, e, cp, b, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, a, speed);
  }
  w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
}

/** A spot for a body of radius r near (x, y): itself if it fits, else the nearest fitting cell centre. */
function fitSpot(w: World, e: Enemy, x: number, y: number, out: { x: number; y: number }): void {
  const r = e.r;
  x = Math.min(ROOM_W - r, Math.max(r, x));
  y = Math.min(ROOM_H - r, Math.max(r, y));
  if (e.flying || walkableAt(w, x, y, r * 0.8)) {
    out.x = x;
    out.y = y;
    return;
  }
  let best = Infinity;
  out.x = e.x;
  out.y = e.y;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 13; col++) {
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      if (!walkableAt(w, cx, cy, r * 0.8)) continue;
      const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d < best) {
        best = d;
        out.x = cx;
        out.y = cy;
      }
    }
  }
}

const spot = { x: 0, y: 0 };

/** Debris / lightning falling on (x, y) after `air` seconds (a marked spot). */
function dropOn(w: World, e: Enemy, cp: CompiledPattern, x: number, y: number, air: number, bolt: boolean): void {
  const p = cp.p;
  const s = spawnLob(w, x, y, x, y, air, bolt ? 120 : 90, p.dmg ?? 1, bolt ? 2 : 3, cp.style, allied(e), e.uid);
  if (!s) return;
  s.fall = bolt ? 2 : 1;
  s.splash = p.splash ?? 9;
  s.creep = (p.creep ?? 0) > 0 ? 1 : 0;
}

/** Common params of shot patterns. */
function shotSpec(own: ParamSpec): ParamSpec {
  return { windup: ATTACK_COMMON.windup!, ...SHOT_COMMON, ...own };
}

// ── charge: telegraphed charge (aim line) → dash → bonk on walls ─────────────
const charge: PatternBehavior = {
  params: {
    windup: [0.7, 0.2, 2],
    speed: [230, 80, 420],
    maxTime: [1.3, 0.3, 3],
    count: [1, 1, 5],
    /** Dazed after a bonk (s). */
    stun: [0.5, 0, 2],
    /** Pause between charges (s). */
    pause: [0.35, 0, 2],
    lead: [0, 0, 1],
    /** Ring of shots from the impact (0 = none). */
    ring: [0, 0, 24],
    ringSpeed: [80, 30, 220],
    /** Debris falling on random spots after a bonk. */
    debris: [0, 0, 16],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
    splash: [9, 4, 24],
  },
  start(w, e, b, cp) {
    b.n = 0;
    aimCharge(w, e, b, cp, cp.p.windup!);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    b.t -= dt;
    if (b.mode === 0) {
      stop(e);
      e.face = b.ax >= 0 ? 1 : -1;
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = p.maxTime!;
      b.tellLine = false;
      b.anim = 'charge';
      w.events.emit('enemyDash', e.x, e.y, b.ax, b.ay, e.def.id);
      return false;
    }
    if (b.mode === 1) {
      const v = sp(b, p.speed!);
      e.tvx = b.ax * v;
      e.tvy = b.ay * v;
      e.snap = true;
      if (e.blocked && b.ax * e.wallNX + b.ay * e.wallNY < -0.5) {
        // Bonk.
        stop(e);
        e.vx = e.vy = 0;
        e.kx = -b.ax * 50;
        e.ky = -b.ay * 50;
        w.events.emit('bossSlam', e.x + b.ax * e.r, e.y + b.ay * e.r, e.r, 0, e.def.id);
        ring(w, e, cp, b, p.ring!, w.combatRng.next() * TAU, p.ringSpeed!);
        for (let i = 0; i < p.debris!; i++) {
          randomDropSpot(w, spot);
          dropOn(w, e, cp, spot.x, spot.y, 0.8 + i * 0.07, false);
        }
        b.mode = 2;
        b.t = p.stun!;
        b.anim = 'slam';
        return false;
      }
      if (b.t <= 0) {
        b.mode = 2;
        b.t = p.pause!;
        b.anim = '';
      }
      return false;
    }
    stop(e);
    if (b.t > 0) return false;
    b.n++;
    if (b.n >= p.count!) return true;
    aimCharge(w, e, b, cp, p.windup! * 0.6);
    return false;
  },
};

function aimCharge(w: World, e: Enemy, b: BossState, cp: CompiledPattern, windup: number): void {
  const a = aimAngle(w, e, cp.p.lead!, cp.p.speed!);
  b.ax = Math.cos(a);
  b.ay = Math.sin(a);
  b.tellLine = true;
  b.tellX = b.ax;
  b.tellY = b.ay;
  tell(w, e, b, cp, windup);
}

/** Any spot in the room for falling debris (floor or not — rocks can fall on rocks). */
function randomDropSpot(w: World, out: { x: number; y: number }): void {
  const rng = w.combatRng;
  out.x = 10 + rng.next() * (ROOM_W - 20);
  out.y = 10 + rng.next() * (ROOM_H - 20);
}

// ── jumpSlam: crouch → leap to a marked spot → slam (shockwaves, shots) ──────
const jumpSlam: PatternBehavior = {
  params: {
    windup: [0.5, 0.1, 2],
    air: [0.9, 0.3, 2],
    height: [56, 10, 120],
    count: [1, 1, 4],
    /** Shockwave rings on landing (0.22 s apart). */
    waves: [1, 0, 3],
    waveRadius: [90, 20, 220],
    waveSpeed: [120, 40, 300],
    /** Ring of shots on landing. */
    ring: [0, 0, 24],
    ringSpeed: [80, 30, 220],
    /** 1 = lands on the player, 0 = a random spot. */
    aim: [1, 0, 1],
    pause: [0.45, 0, 2],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    aimJump(w, e, b, cp);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    if (b.mode === 0) {
      stop(e);
      b.t -= dt;
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = 0;
      b.a0 = e.x;
      b.a1 = e.y;
      b.markT = p.air! / b.pace + 0.1;
      b.anim = 'air';
      w.events.emit('enemyHop', e.x, e.y, e.r, 0, e.def.id);
      return false;
    }
    if (b.mode === 1) {
      const air = p.air! / b.pace;
      b.t += dt;
      const f = Math.min(1, b.t / air);
      e.tvx = (b.markX - b.a0) / air;
      e.tvy = (b.markY - b.a1) / air;
      e.snap = true;
      e.z = 4 * p.height! * f * (1 - f);
      if (f < 1) return false;
      e.z = 0;
      stop(e);
      e.vx = e.vy = 0;
      b.markT = 0;
      b.anim = 'slam';
      w.events.emit('enemyLand', e.x, e.y, e.r, 0, e.def.id);
      w.events.emit('bossSlam', e.x, e.y, e.r * 2, 0, e.def.id);
      if (p.waves! > 0) spawnWave(w, e.x, e.y, p.waveRadius!, p.waveSpeed!, p.dmg!, 6, allied(e), e.uid);
      ring(w, e, cp, b, p.ring!, w.combatRng.next() * TAU, p.ringSpeed!);
      b.mode = 2;
      b.k = 1;
      b.t = p.pause!;
      return false;
    }
    stop(e);
    b.t -= dt;
    // Follow-up rings, 0.22 s apart.
    if (b.k < p.waves! && p.pause! - b.t >= 0.22 * b.k) {
      spawnWave(w, e.x, e.y, p.waveRadius! * (1 + 0.15 * b.k), p.waveSpeed! * 0.85, p.dmg!, 6, allied(e), e.uid);
      b.k++;
    }
    if (b.t > 0) return false;
    b.n++;
    if (b.n >= p.count!) return true;
    aimJump(w, e, b, cp);
    b.t *= 0.6;
    return false;
  },
};

function aimJump(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  let x: number;
  let y: number;
  if (cp.p.aim! > 0 && e.hasTgt) {
    x = e.tgtX;
    y = e.tgtY;
  } else {
    x = 24 + w.combatRng.next() * (ROOM_W - 48);
    y = 20 + w.combatRng.next() * (ROOM_H - 40);
  }
  fitSpot(w, e, x, y, spot);
  b.markX = spot.x;
  b.markY = spot.y;
  b.markT = 0;
  tell(w, e, b, cp, cp.p.windup!);
}

// ── ring: rings of shots, repeated (spin between them = a stepped spiral) ────
const ringPattern: PatternBehavior = {
  params: shotSpec({
    count: [12, 3, 32],
    speed: [80, 20, 260],
    repeats: [1, 1, 8],
    gap: [0.35, 0.05, 2],
    /** Degrees the ring turns each repeat. */
    spin: [0, -45, 45],
    /** 1 = every other ring is offset by half a step. */
    alt: [0, 0, 1],
    /** 1 = one shot points straight at the target. */
    aim: [0, 0, 1],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    b.a0 = cp.p.aim! > 0 ? aimAngle(w, e) : w.combatRng.next() * TAU;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.n >= p.repeats!) return true;
    const n = p.count!;
    const off = b.a0 + b.n * p.spin! * DEG + (p.alt! > 0 && (b.n & 1) === 1 ? Math.PI / n : 0);
    ring(w, e, cp, b, n, off, p.speed!);
    b.n++;
    b.mode = 1;
    b.anim = 'roar';
    b.t = b.n >= p.repeats! ? 0.25 : p.gap! / b.pace;
    return false;
  },
};

// ── spiral: a rotating stream of shots ─────────────────────────────────────
const spiral: PatternBehavior = {
  params: shotSpec({
    arms: [3, 1, 8],
    /** Volleys per second. */
    rate: [10, 2, 30],
    /** Degrees per second the arms turn. */
    turn: [140, -400, 400],
    time: [2.4, 0.5, 6],
    speed: [75, 20, 220],
    /** 1 = the spin reverses halfway. */
    reverse: [0, 0, 1],
  }),
  start(w, e, b, cp) {
    b.a0 = w.combatRng.next() * TAU;
    b.a1 = w.combatRng.next() < 0.5 ? 1 : -1;
    b.k = 0;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = p.time!;
      b.k = 0;
      return false;
    }
    const time = p.time!;
    const dir = p.reverse! > 0 && b.t < time / 2 ? -b.a1 : b.a1;
    b.a0 += dir * p.turn! * DEG * dt;
    b.k -= dt;
    if (b.k <= 0) {
      b.k += 1 / (p.rate! * Math.sqrt(b.pace));
      const n = p.arms!;
      const r = e.r * 0.5;
      for (let i = 0; i < n; i++) {
        const a = b.a0 + (i / n) * TAU;
        shot(w, e, cp, b, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, a, p.speed!);
      }
      if ((b.n++ & 3) === 0) w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
    }
    return b.t <= 0;
  },
};

// ── wave: walls of shots crossing the room, each with a gap ───────────────────
const wave: PatternBehavior = {
  params: shotSpec({
    windup: [0.6, 0, 2],
    waves: [2, 1, 6],
    gap: [0.9, 0.2, 3],
    /** Distance between shots in the wall (px). */
    spacing: [13, 8, 30],
    /** Shots left out to make the gap. */
    hole: [3, 1, 6],
    speed: [60, 20, 200],
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
    if (b.n >= p.waves!) return true;
    // The wall travels toward the target along the dominant axis, starting at the boss.
    const dx = (e.hasTgt ? e.tgtX : ROOM_W / 2) - e.x;
    const dy = (e.hasTgt ? e.tgtY : ROOM_H / 2) - e.y;
    const horiz = Math.abs(dx) * (ROOM_H / ROOM_W) >= Math.abs(dy);
    const span = horiz ? ROOM_H : ROOM_W;
    const gap = p.spacing!;
    const count = Math.floor(span / gap);
    const hole = Math.min(count - 2, p.hole!);
    const h0 = 1 + w.combatRng.int(0, Math.max(0, count - hole - 2));
    const ang = horiz ? (dx >= 0 ? 0 : Math.PI) : dy >= 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let i = 0; i < count; i++) {
      if (i >= h0 && i < h0 + hole) continue;
      const along = (span - (count - 1) * gap) / 2 + i * gap;
      shot(w, e, cp, b, horiz ? e.x : along, horiz ? along : e.y, ang, p.speed!);
    }
    w.events.emit('enemyShoot', e.x, e.y, count, cp.style, e.def.id);
    b.n++;
    b.mode = 1;
    b.t = b.n >= p.waves! ? 0.3 : p.gap! / b.pace;
    return false;
  },
};

// ── aimedBurst: fans of aimed shots in quick bursts ──────────────────────────
const aimedBurst: PatternBehavior = {
  params: shotSpec({
    windup: [0.4, 0, 2],
    bursts: [3, 1, 8],
    shots: [3, 1, 9],
    /** Total fan width, degrees. */
    spread: [30, 0, 120],
    interval: [0.3, 0.06, 1.5],
    speed: [110, 30, 260],
    lead: [0, 0, 1],
    /** 1 = keeps walking toward the target while firing. */
    walk: [0, 0, 1],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    tell(w, e, b, cp, cp.p.windup!);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    if (p.walk! > 0 && b.mode === 1 && e.hasTgt) {
      const a = aimAngle(w, e);
      e.tvx = Math.cos(a) * e.speed * 0.6;
      e.tvy = Math.sin(a) * e.speed * 0.6;
    } else {
      stop(e);
    }
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.n >= p.bursts!) return true;
    const n = p.shots!;
    const base = aimAngle(w, e, p.lead!, p.speed!);
    const step = n > 1 ? (p.spread! * DEG) / (n - 1) : 0;
    const r = e.r * 0.6;
    for (let i = 0; i < n; i++) {
      const a = base - (n > 1 ? (p.spread! * DEG) / 2 : 0) + i * step;
      shot(w, e, cp, b, e.x + Math.cos(base) * r, e.y + Math.sin(base) * r, a, p.speed!);
    }
    w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
    b.n++;
    b.mode = 1;
    b.anim = 'roar';
    b.t = b.n >= p.bursts! ? 0.2 : p.interval! / b.pace;
    return false;
  },
};

// ── summon: calls adds (capped) ───────────────────────────────────────────────
const summon: PatternBehavior = {
  enemy: '',
  params: {
    windup: [0.6, 0, 2],
    count: [2, 1, 6],
    /** Most of its adds alive at once. */
    max: [4, 1, 8],
    /** Spawn distance from the boss (px). */
    dist: [26, 8, 90],
  },
  start(w, e, b, cp) {
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.mode === 1) return true;
    b.mode = 1;
    b.t = 0.35;
    const def = cp.minion;
    if (!def) return false;
    const p = cp.p;
    let alive = 0;
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (!o.dead && o.parent === e.uid && o.anchor === 0) alive++;
    }
    const n = Math.min(p.count!, p.max! - alive);
    const rng = w.combatRng;
    for (let i = 0; i < n; i++) {
      let x = e.x;
      let y = e.y;
      for (let tries = 0; tries < 8; tries++) {
        const a = rng.next() * TAU;
        const cx = e.x + Math.cos(a) * (e.r + p.dist!);
        const cy = e.y + Math.sin(a) * (e.r + p.dist!);
        if (def.flying ? cx > 8 && cy > 8 && cx < ROOM_W - 8 && cy < ROOM_H - 8 : walkableAt(w, cx, cy, def.radius)) {
          x = cx;
          y = cy;
          break;
        }
      }
      const m = spawnEnemy(w, def, x, y, { champion: false });
      if (m) {
        m.parent = e.uid;
        if (allied(e)) m.applyStatus('charm', e.status.t[ST_CHARM]!, 0, SRC_ALLY);
      }
    }
    if (n > 0) w.events.emit('enemySummon', e.x, e.y, n, 0, e.def.id);
    return false;
  },
};

// ── beamSweep: a telegraphed beam that sweeps an arc (see brain.ts updateBeams) ──
const beamSweep: PatternBehavior = {
  params: {
    windup: [0.8, 0.2, 2.5],
    /** Degrees swept. */
    arc: [120, 10, 360],
    /** Seconds the sweep takes. */
    time: [1.6, 0.3, 5],
    width: [8, 3, 20],
    dmg: [1, 1, 4],
    /** 1 = two beams back to back. */
    twin: [0, 0, 1],
    /** 0 water jet, 1 lightning, 2 ink. */
    look: [0, 0, 2],
  },
  start(w, e, b, cp) {
    const p = cp.p;
    const base = aimAngle(w, e);
    const dir = w.combatRng.next() < 0.5 ? 1 : -1;
    const half = (p.arc! * DEG) / 2;
    b.a0 = base - dir * half;
    b.a1 = base + dir * half;
    for (let i = 0; i < 2; i++) {
      const bm = b.beams[i]!;
      bm.on = i === 0 || p.twin! > 0;
      bm.tele = true;
      bm.angle = b.a0 + i * Math.PI;
      bm.width = p.width!;
      bm.look = p.look!;
      bm.dmg = p.dmg!;
      bm.len = 0;
    }
    tell(w, e, b, cp, p.windup!, 'roar');
    w.events.emit('bossBeam', e.x, e.y, 0, p.look!, e.def.id);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = p.time! / b.pace;
      for (let i = 0; i < 2; i++) b.beams[i]!.tele = false;
      w.events.emit('bossBeam', e.x, e.y, 1, p.look!, e.def.id);
      return false;
    }
    const time = p.time! / b.pace;
    const f = Math.min(1, 1 - b.t / time);
    const a = b.a0 + (b.a1 - b.a0) * f;
    b.beams[0]!.angle = a;
    b.beams[1]!.angle = a + Math.PI;
    if (b.t > 0) return false;
    b.beams[0]!.on = false;
    b.beams[1]!.on = false;
    return true;
  },
};

// ── burrow: dig in → tunnel toward the target → rumble → erupt ───────────────
const burrow: PatternBehavior = {
  params: {
    /** Sinking (the telegraph), s. */
    dig: [0.5, 0.1, 2],
    /** Longest tunnel, s. */
    under: [1.4, 0.3, 5],
    speed: [100, 30, 240],
    /** Rumble before erupting (the mound shakes), s. */
    rise: [0.7, 0.2, 2],
    /** Surfaces early this close to the target (px). */
    near: [16, 0, 80],
    count: [1, 1, 4],
    ring: [8, 0, 24],
    ringSpeed: [80, 30, 220],
    waves: [1, 0, 2],
    waveRadius: [70, 20, 180],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    b.k = 0;
    b.a0 = 0;
    tell(w, e, b, cp, cp.p.dig!);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    b.t -= dt;
    switch (b.mode) {
      case 0:
        stop(e);
        if (b.t > 0) return false;
        b.mode = 1;
        b.t = p.under! / b.pace;
        b.k = 0;
        b.a0 = 0;
        e.burrowed = true;
        w.events.emit('burrow', e.x, e.y, 0, e.r, e.def.id);
        return false;
      case 1: {
        let d = Infinity;
        if (b.k > 0) {
          // Overdue under a spot too tight to come up in (the target stands in a nook between blocks): it tunnels to
          // the nearest spot it fits, and after BURROW_OVERDUE s more is put there (polish batch 4 — the longer fights
          // let a boss end up waiting under a crate barricade forever, like the stuck burrowers of polish batch 1).
          b.a0 += dt;
          const dx = b.ax - e.x;
          const dy = b.ay - e.y;
          const dd = Math.sqrt(dx * dx + dy * dy);
          const v = sp(b, p.speed!);
          if (dd > 2 && b.a0 < BURROW_OVERDUE) {
            e.tvx = (dx / dd) * v;
            e.tvy = (dy / dd) * v;
          } else {
            stop(e);
            e.x = e.prevX = b.ax;
            e.y = e.prevY = b.ay;
          }
          if (walkableAt(w, e.x, e.y, e.r * 0.8) || b.a0 >= BURROW_OVERDUE) {
            stop(e);
            e.vx = e.vy = 0;
            b.mode = 2;
            b.t = p.rise! / b.pace;
            telegraph(e, b.t);
            w.events.emit('burrow', e.x, e.y, 1, e.r, e.def.id);
          }
          return false;
        }
        if (e.hasTgt) {
          const dx = e.tgtX - e.x;
          const dy = e.tgtY - e.y;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d > 1) {
            const v = sp(b, p.speed!);
            e.tvx = (dx / d) * v;
            e.tvy = (dy / d) * v;
          } else stop(e);
        } else stop(e);
        if ((b.t <= 0 || d < p.near!) && walkableAt(w, e.x, e.y, e.r * 0.8)) {
          stop(e);
          e.vx = e.vy = 0;
          b.mode = 2;
          b.t = p.rise! / b.pace;
          telegraph(e, b.t);
          w.events.emit('burrow', e.x, e.y, 1, e.r, e.def.id);
        } else if (b.t <= -0.5) {
          // Half a second overdue and still no room to come up: head for the nearest spot that has it.
          surfaceSpot(w, e, b);
          b.k = 1;
        }
        return false;
      }
      case 2:
        stop(e);
        if (b.t > 0) return false;
        e.burrowed = false;
        b.anim = 'slam';
        w.events.emit('burrow', e.x, e.y, 2, e.r, e.def.id);
        w.events.emit('bossSlam', e.x, e.y, e.r * 2, 0, e.def.id);
        ring(w, e, cp, b, p.ring!, w.combatRng.next() * TAU, p.ringSpeed!);
        if (p.waves! > 0) spawnWave(w, e.x, e.y, p.waveRadius!, 120, p.dmg!, 6, allied(e), e.uid);
        b.mode = 3;
        b.t = 0.55;
        return false;
      default:
        stop(e);
        if (b.t > 0) return false;
        b.n++;
        if (b.n >= p.count!) return true;
        tell(w, e, b, cp, p.dig! * 0.7);
        return false;
    }
  },
};

/** Seconds a burrowed boss may spend heading for a spot it fits before it is put there. */
const BURROW_OVERDUE = 3;

/**
 * The nearest cell centre where a boss this big can surface (b.ax, b.ay), trying a smaller fit when the room has none
 * (a boss-room barricade); the room's middle as a last resort. Row-major within equal distances (deterministic).
 */
function surfaceSpot(w: World, e: Enemy, b: BossState): void {
  const room = w.room;
  for (const k of [0.8, 0.6, 0.4]) {
    let best = Infinity;
    for (let row = 0; row < room.rows; row++) {
      for (let col = 0; col < room.cols; col++) {
        const x = col * TILE + TILE / 2;
        const y = row * TILE + TILE / 2;
        if (!walkableAt(w, x, y, e.r * k)) continue;
        const d = (x - e.x) * (x - e.x) + (y - e.y) * (y - e.y);
        if (d < best) {
          best = d;
          b.ax = x;
          b.ay = y;
        }
      }
    }
    if (best < Infinity) return;
  }
  b.ax = ROOM_W / 2;
  b.ay = ROOM_H / 2;
}

// ── teleport: fade out (marker at the destination) → blink → reappear + attack ─
const teleport: PatternBehavior = {
  params: {
    fade: [0.6, 0.1, 2],
    appear: [0.35, 0.05, 1.5],
    /** Destination distance from the player (px). */
    min: [50, 0, 200],
    max: [110, 20, 240],
    count: [1, 1, 4],
    ring: [8, 0, 24],
    ringSpeed: [80, 30, 220],
    /** Aimed shots fired on reappearing. */
    burst: [0, 0, 6],
    burstSpeed: [110, 30, 260],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    aimTeleport(w, e, b, cp);
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    switch (b.mode) {
      case 0: {
        const fade = p.fade! / b.pace;
        b.fade = Math.max(0.15, b.t / fade);
        if (b.t > 0) return false;
        w.events.emit('blink', e.x, e.y, 0, e.r, e.def.id);
        e.x = e.prevX = b.markX;
        e.y = e.prevY = b.markY;
        e.vx = e.vy = e.kx = e.ky = 0;
        e.hidden = true;
        b.fade = 0;
        b.mode = 1;
        b.t = p.appear! / b.pace;
        return false;
      }
      case 1:
        b.fade = Math.min(1, 1 - b.t / (p.appear! / b.pace));
        if (b.t > 0) return false;
        e.hidden = false;
        b.fade = 1;
        b.markT = 0;
        w.events.emit('blink', e.x, e.y, 1, e.r, e.def.id);
        ring(w, e, cp, b, p.ring!, aimAngle(w, e), p.ringSpeed!);
        if (p.burst! > 0) {
          const base = aimAngle(w, e, 0.3, p.burstSpeed!);
          for (let i = 0; i < p.burst!; i++) shot(w, e, cp, b, e.x, e.y, base + (i - (p.burst! - 1) / 2) * 10 * DEG, p.burstSpeed!);
        }
        b.anim = 'roar';
        b.mode = 2;
        b.t = 0.45;
        return false;
      default:
        if (b.t > 0) return false;
        b.n++;
        if (b.n >= p.count!) return true;
        aimTeleport(w, e, b, cp);
        return false;
    }
  },
};

function aimTeleport(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  const p = cp.p;
  const pl = w.player;
  const saveX = e.tx;
  const saveY = e.ty;
  if (randomSpotNear(w, e, pl.x, pl.y, p.min!, Math.max(p.min! + 16, p.max!), 32) && walkableAt(w, e.tx, e.ty, e.r * 0.8)) {
    b.markX = e.tx;
    b.markY = e.ty;
  } else {
    // The mirror image of where it stands (always inside the room).
    fitSpot(w, e, ROOM_W - e.x, ROOM_H - e.y, spot);
    b.markX = spot.x;
    b.markY = spot.y;
  }
  e.tx = saveX;
  e.ty = saveY;
  b.markT = (p.fade! + p.appear!) / b.pace + 0.1;
  tell(w, e, b, cp, p.fade!);
}

// ── debrisRain: slam → debris (or lightning) rains on marked spots ────────────
const debrisRain: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    count: [8, 1, 24],
    /** The drops are spread over this many seconds. */
    time: [1.4, 0.2, 4],
    /** How many of them aim at the player. */
    targeted: [2, 0, 8],
    /** Fall time (the marker's warning), s. */
    air: [1, 0.4, 2],
    splash: [9, 4, 24],
    dmg: [1, 1, 4],
    /** 1 = lightning strikes instead of rocks. */
    bolt: [0, 0, 1],
    /** 1 = the boss slams first (shake). */
    slam: [1, 0, 1],
    /** 1 = each drop leaves a puddle. */
    creep: [0, 0, 1],
  },
  start(w, e, b, cp) {
    b.n = 0;
    b.k = 0;
    tell(w, e, b, cp, cp.p.windup!, cp.p.slam! > 0 ? 'windup' : 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = 0;
      b.anim = p.slam! > 0 ? 'slam' : 'roar';
      if (p.slam! > 0) w.events.emit('bossSlam', e.x, e.y, e.r * 2, 1, e.def.id);
      return false;
    }
    // b.t counts down from 0: elapsed = -b.t.
    const elapsed = -b.t;
    const n = p.count!;
    const time = p.time! / b.pace;
    while (b.n < n && elapsed >= (b.n / n) * time) {
      if (b.n < p.targeted! && e.hasTgt) {
        const j = w.combatRng.next() * TAU;
        spot.x = Math.min(ROOM_W - 6, Math.max(6, w.player.x + Math.cos(j) * 6));
        spot.y = Math.min(ROOM_H - 6, Math.max(6, w.player.y + Math.sin(j) * 6));
      } else {
        randomDropSpot(w, spot);
      }
      dropOn(w, e, cp, spot.x, spot.y, p.air!, p.bolt! > 0);
      b.n++;
    }
    return b.n >= n && elapsed >= time + 0.3;
  },
};

// ── split: become several smaller parts sharing the fight's health (brain.ts does it) ──
const split: PatternBehavior = {
  params: {
    count: [2, 2, 4],
    /** Size of each part relative to the boss. */
    scale: [0.7, 0.4, 1],
    /** Push apart speed (px/s). */
    spread: [140, 0, 300],
  },
  start(w, e, b, cp) {
    b.mode = 0;
    b.t = 0;
    splitHandler?.(w, e, b, cp);
  },
  update() {
    return true;
  },
};

/** Set by brain.ts (it owns spawning parts) — avoids an import cycle. */
let splitHandler: ((w: World, e: Enemy, b: BossState, cp: CompiledPattern) => void) | null = null;
export function setSplitHandler(fn: (w: World, e: Enemy, b: BossState, cp: CompiledPattern) => void): void {
  splitHandler = fn;
}

// ── shields: orbiting orbs that soak up shots ──────────────────────────────
const shields: PatternBehavior = {
  enemy: 'bubble-ward',
  params: {
    windup: [0.4, 0, 2],
    count: [3, 1, 8],
    /** Orbit radius beyond the boss's edge (px). */
    radius: [14, 4, 60],
    /** Orbit speed (rad/s; negative = the other way). */
    spin: [1.6, -5, 5],
  },
  start(w, e, b, cp) {
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.mode === 1) return true;
    b.mode = 1;
    b.t = 0.3;
    const def = cp.minion ?? findEnemy('bubble-ward') ?? null;
    if (!def) return false;
    const p = cp.p;
    // Only top up to `count` (orbs already circling count).
    let alive = 0;
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (!o.dead && o.anchor === e.uid) alive++;
    }
    const n = p.count! - alive;
    const off = w.combatRng.next() * TAU;
    const R = e.r + p.radius!;
    for (let i = 0; i < n; i++) {
      const a = off + (i / Math.max(1, n)) * TAU;
      const m = spawnEnemy(w, def, e.x + Math.cos(a) * R, e.y + Math.sin(a) * R, { champion: false });
      if (!m) break;
      m.parent = e.uid;
      m.anchor = e.uid;
      m.anchorR = R;
      m.anchorA = a;
      m.anchorW = p.spin!;
      m.pinned = true;
      m.noCollide = true;
      m.flying = true;
    }
    if (n > 0) w.events.emit('enemySummon', e.x, e.y, n, 0, e.def.id);
    return false;
  },
};

// ── hazard: lobbed globs that leave puddles (muck, water, fire…) ──────────────
const hazard: PatternBehavior = {
  params: {
    windup: [0.5, 0, 2],
    count: [4, 1, 12],
    /** Puddle radius (px) and life (s). */
    radius: [12, 4, 30],
    life: [6, 1, 20],
    dmg: [1, 1, 2],
    /** Flight time of the globs, s. */
    air: [0.8, 0.3, 2],
    /** Scatter around the target (px). */
    spread: [48, 0, 200],
    /** 1 = around the boss instead of the target. */
    self: [0, 0, 1],
  },
  start(w, e, b, cp) {
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.mode === 1) return true;
    b.mode = 1;
    b.t = cp.p.air! + 0.2;
    const p = cp.p;
    const rng = w.combatRng;
    const cx = p.self! > 0 || !e.hasTgt ? e.x : e.tgtX;
    const cy = p.self! > 0 || !e.hasTgt ? e.y : e.tgtY;
    const n = p.count!;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng.next() * 0.8;
      const d = p.self! > 0 ? e.r + 10 + rng.next() * p.spread! : (i === 0 ? 0 : 0.35 + rng.next() * 0.65) * p.spread!;
      const x = Math.min(ROOM_W - 6, Math.max(6, cx + Math.cos(a) * d));
      const y = Math.min(ROOM_H - 6, Math.max(6, cy + Math.sin(a) * d));
      const s = spawnLob(w, e.x, e.y - e.r * 0.5, x, y, p.air! * (0.85 + rng.next() * 0.3), 34, p.dmg!, 3, cp.style, allied(e), e.uid);
      if (!s) break;
      s.splash = Math.max(5, p.radius! * 0.6);
      s.creep = 1;
      s.creepR = p.radius!;
      s.creepLife = p.life!;
    }
    w.events.emit('enemyLob', e.x, e.y, n, cp.style, e.def.id);
    return false;
  },
};

// ── hook: named per-boss code (sim/bosses/hooks.ts) ─────────────────────────
const hook: PatternBehavior = {
  params: {
    windup: [0.5, 0, 2],
    /** Longest the hook may run (s). */
    time: [3, 0.1, 20],
  },
  start(w, e, b, cp) {
    tell(w, e, b, cp, cp.p.windup!);
  },
  update(w, e, b, cp, dt) {
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = cp.p.time!;
      b.k = 0;
    }
    b.k += dt;
    const done = hookRunner?.(w, e, b, cp, dt) ?? true;
    return done || b.t <= 0;
  },
};

let hookRunner: ((w: World, e: Enemy, b: BossState, cp: CompiledPattern, dt: number) => boolean) | null = null;
/** Set by brain.ts (it builds the hook context) — avoids an import cycle. */
export function setHookRunner(fn: (w: World, e: Enemy, b: BossState, cp: CompiledPattern, dt: number) => boolean): void {
  hookRunner = fn;
}

export const PATTERNS: Readonly<Record<BossPatternKind, PatternBehavior>> = {
  charge,
  jumpSlam,
  ring: ringPattern,
  spiral,
  wave,
  aimedBurst,
  summon,
  beamSweep,
  burrow,
  teleport,
  debrisRain,
  split,
  shields,
  hazard,
  hook,
  ...PATTERNS_A,
  ...PATTERNS_B,
  ...PATTERNS_C,
  ...FINALS_PATTERNS,
};
