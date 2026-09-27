/**
 * Boss pattern kinds added by boss pack A (registered at the end of BOSS_PATTERN_KINDS in sim/types.ts
 * and of PATTERNS in ./patterns.ts). Same contract as the core library: params `name: [default, min,
 * max]` (validated), a telegraph first ('bossTell', flash + squash, a pose), timers ÷ pace, shot and
 * move speeds × √pace, state in the BossState scratch slots only, nothing allocated per tick, every
 * shot / lob through the enemy pools (caps and the charm rules apply).
 *
 *   lineStrike  marked strikes rippling out along one or more lines from the boss toward the target
 *               (roots bursting up, candles toppling): a row of landing markers you step off of.
 *   orbitDash   the boss sweeps a lap around the room (or around where you stood) at speed, firing
 *               volleys on the way — aimed, inward (converging) or outward.
 *   clusterLob  lobbed globs (landing markers) that burst into a ring of shots where they land, in
 *               volleys; optionally leaving a puddle.
 *
 * DOM-free. Imports nothing from ./patterns.ts at runtime (it imports this file).
 */

import { DEG, TAU } from '../../engine/math';
import { ROOM_H, ROOM_W } from '../constants';
import { SHOT_COMMON, telegraph, type ParamSpec } from '../enemies/behaviors/common';
import type { Enemy } from '../enemies/enemy';
import { spawnEnemyShot, spawnLob } from '../enemies/shots';
import { ST_CHARM, hasStatus } from '../enemies/status';
import type { World } from '../world';
import type { CompiledPattern } from './compile';
import type { PatternBehavior } from './patterns';
import type { BossState } from './state';

// ── Helpers (the core library keeps its own private) ────────────────────────

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

/** Angle from the boss to its target, or along its facing. */
function aimAt(e: Enemy): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  return Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
}

/** A telegraph of `seconds` ÷ pace: flash + squash, a pose, the 'bossTell' event. */
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

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── lineStrike ────────────────────────────────────────────────────────────────

const lineStrike: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** Lines per volley, fanned `fan` degrees apart around the aim (or spread all round). */
    lines: [1, 1, 6],
    fan: [30, 5, 90],
    /** 1 = the lines go all the way round (evenly spaced), 0 = fanned at the target. */
    around: [0, 0, 1],
    /** Marks per line, the first `start` px beyond the boss's edge, `step` px apart. */
    count: [7, 2, 14],
    start: [8, 0, 60],
    step: [18, 8, 40],
    /** Seconds between neighbouring marks (the ripple's speed; ÷ pace). */
    interval: [0.09, 0.03, 0.5],
    /** Warning before each strike lands (the marker), s. Not scaled by pace: always fair. */
    air: [0.7, 0.3, 2],
    splash: [9, 4, 24],
    dmg: [1, 1, 4],
    /** 1 = lightning strikes instead of falling debris. */
    bolt: [0, 0, 1],
    /** 1 = every strike leaves a puddle. */
    creep: [0, 0, 1],
    /** Volleys (re-aimed each time) and the pause between them (s). */
    repeats: [1, 1, 4],
    gap: [0.5, 0.1, 2],
  },
  start(w, e, b, cp) {
    b.a1 = 0;
    tell(w, e, b, cp, cp.p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    if (b.mode === 0) {
      b.t -= dt;
      if (b.t > 0) return false;
      // Lock the aim and the origin; the ripple starts.
      b.mode = 1;
      b.a0 = p.around! > 0 ? w.combatRng.next() * TAU : aimAt(e);
      b.ax = e.x;
      b.ay = e.y;
      b.n = 0;
      b.k = 0;
      b.anim = 'slam';
      w.events.emit('bossSlam', e.x, e.y, e.r, 0, e.def.id);
      return false;
    }
    if (b.mode === 1) {
      b.k += dt;
      const count = p.count!;
      const interval = p.interval! / b.pace;
      const lines = p.lines!;
      while (b.n < count && b.k >= b.n * interval) {
        const d = e.r + p.start! + b.n * p.step!;
        for (let i = 0; i < lines; i++) {
          const a = p.around! > 0 ? b.a0 + (i / lines) * TAU : b.a0 + (i - (lines - 1) / 2) * p.fan! * DEG;
          const x = b.ax + Math.cos(a) * d;
          const y = b.ay + Math.sin(a) * d;
          if (x < 4 || y < 4 || x > ROOM_W - 4 || y > ROOM_H - 4) continue;
          const bolt = p.bolt! > 0;
          const s = spawnLob(w, x, y, x, y, p.air!, bolt ? 120 : 90, p.dmg!, bolt ? 2 : 3, cp.style, allied(e), e.uid);
          if (!s) continue;
          s.fall = bolt ? 2 : 1;
          s.splash = p.splash!;
          s.creep = p.creep! > 0 ? 1 : 0;
        }
        b.n++;
      }
      if (b.n < count) return false;
      b.a1++;
      if (b.a1 >= p.repeats!) {
        // Hold the pose a beat while the last marks come down.
        b.mode = 3;
        b.t = 0.3;
        return false;
      }
      b.mode = 2;
      b.t = p.gap! / b.pace;
      b.anim = 'windup';
      telegraph(e, b.t);
      return false;
    }
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.mode === 3) return true;
    // Next volley: re-aimed from where the boss stands now.
    b.mode = 1;
    b.a0 = p.around! > 0 ? b.a0 + Math.PI / Math.max(1, p.lines!) : aimAt(e);
    b.ax = e.x;
    b.ay = e.y;
    b.n = 0;
    b.k = 0;
    b.anim = 'slam';
    w.events.emit('bossSlam', e.x, e.y, e.r, 0, e.def.id);
    return false;
  },
};

// ── orbitDash ─────────────────────────────────────────────────────────────────

/** Lap geometry for the current tick (scratch, never kept). */
const lap = { cx: 0, cy: 0, rx: 0, ry: 0 };

/** The lap around (b.ax, b.ay) with the pattern's radius, squeezed to fit inside the room. */
function lapFor(e: Enemy, b: BossState, radius: number): void {
  const m = e.r + 3;
  lap.rx = Math.max(10, Math.min(radius, ROOM_W / 2 - m));
  lap.ry = Math.max(8, Math.min(radius * 0.72, ROOM_H / 2 - m));
  lap.cx = clamp(b.ax, lap.rx + m, ROOM_W - lap.rx - m);
  lap.cy = clamp(b.ay, lap.ry + m, ROOM_H - lap.ry - m);
}

const orbitDash: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** Lap radius (px); squeezed vertically to fit the room. */
    radius: [70, 24, 96],
    /** Degrees per second along the lap (× √pace). */
    spin: [140, 30, 360],
    time: [2.4, 0.5, 6],
    /** 0 = around the room's centre, 1 = around where the target stood at the telegraph. */
    center: [0, 0, 1],
    /** Direction: 1 / -1, 0 = a coin flip. */
    dir: [0, -1, 1],
    /** Volleys per second while circling (0 = none; × √pace). */
    rate: [3, 0, 12],
    /** Shots per volley, fanned over `spread` degrees. */
    shots: [1, 1, 7],
    spread: [24, 0, 120],
    /** 0 = aimed at the target, 1 = toward the lap's centre (converging), 2 = away from it. */
    aim: [0, 0, 2],
    ...SHOT_COMMON,
    speed: [90, 20, 260],
  },
  start(w, e, b, cp) {
    const p = cp.p;
    b.ax = p.center! > 0 && e.hasTgt ? e.tgtX : ROOM_W / 2;
    b.ay = p.center! > 0 && e.hasTgt ? e.tgtY : ROOM_H / 2;
    b.a1 = p.dir! !== 0 ? Math.sign(p.dir!) : w.combatRng.next() < 0.5 ? 1 : -1;
    lapFor(e, b, p.radius!);
    // Mark the lap's centre while she winds up (the landing marker ring).
    b.markX = lap.cx;
    b.markY = lap.cy;
    b.markT = p.windup! / b.pace;
    tell(w, e, b, cp, p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    lapFor(e, b, p.radius!);
    if (b.mode === 0) {
      stop(e);
      b.t -= dt;
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = p.time! / b.pace;
      b.k = 0;
      b.n = 0;
      // Join the lap where she already is (its nearest angle).
      b.a0 = Math.atan2((e.y - lap.cy) / lap.ry, (e.x - lap.cx) / lap.rx);
      b.anim = 'charge';
      w.events.emit('enemyDash', e.x, e.y, Math.cos(b.a0), Math.sin(b.a0), e.def.id);
      return false;
    }
    // Circling: chase a point that runs round the lap.
    const rp = Math.sqrt(b.pace);
    b.a0 += b.a1 * p.spin! * DEG * rp * dt;
    const tx = lap.cx + Math.cos(b.a0) * lap.rx;
    const ty = lap.cy + Math.sin(b.a0) * lap.ry;
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const lapSpeed = p.spin! * DEG * rp * Math.max(lap.rx, lap.ry);
    const vmax = Math.max(90, lapSpeed * 1.5);
    const v = Math.min(vmax, d * 8);
    if (d > 1e-3) {
      e.tvx = (dx / d) * v;
      e.tvy = (dy / d) * v;
    } else stop(e);
    e.snap = true;
    // Volleys on the way round.
    if (p.rate! > 0) {
      b.k -= dt;
      if (b.k <= 0) {
        b.k += 1 / (p.rate! * rp);
        const n = p.shots!;
        const base =
          p.aim! === 1 ? Math.atan2(lap.cy - e.y, lap.cx - e.x) : p.aim! === 2 ? Math.atan2(e.y - lap.cy, e.x - lap.cx) : aimAt(e);
        const spread = n > 1 ? p.spread! * DEG : 0;
        const al = allied(e);
        const sv = p.speed! * rp;
        for (let i = 0; i < n; i++) {
          const a = base - spread / 2 + (n > 1 ? (i / (n - 1)) * spread : 0);
          const s = spawnEnemyShot(w, e.x, e.y, Math.cos(a) * sv, Math.sin(a) * sv, p.dmg!, p.size!, cp.style, al, e.uid);
          if (!s) break;
          s.accel = p.accel!;
          s.curve = p.curve!;
          s.phase = p.phase! > 0;
          s.life = p.life!;
        }
        if ((b.n++ & 1) === 0) w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
      }
    }
    b.t -= dt;
    if (b.t > 0) return false;
    stop(e);
    return true;
  },
};

// ── clusterLob ────────────────────────────────────────────────────────────────

const clusterLob: PatternBehavior = {
  params: {
    windup: [0.5, 0, 2],
    /** Globs per volley, and volleys `gap` s apart (÷ pace). */
    count: [3, 1, 8],
    volleys: [1, 1, 4],
    gap: [0.6, 0.1, 2],
    /** Each glob bursts into a ring of this many shots where it lands (0 = none). */
    split: [6, 0, 12],
    /** Scatter around the target (px); the first glob of a volley lands right on her. */
    spread: [40, 0, 160],
    /** Flight time (the marker's warning), s — not scaled by pace. */
    air: [0.9, 0.4, 2],
    height: [40, 10, 100],
    splash: [8, 4, 24],
    dmg: [1, 1, 2],
    size: [3, 2, 6],
    /** 1 = each glob also leaves a puddle (`life` s). */
    creep: [0, 0, 1],
    life: [4, 1, 12],
  },
  start(w, e, b, cp) {
    b.n = 0;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    // Mode 2: the last globs are mostly down.
    if (b.mode === 2) return true;
    const rng = w.combatRng;
    const cx = e.hasTgt ? e.tgtX : ROOM_W / 2;
    const cy = e.hasTgt ? e.tgtY : ROOM_H / 2;
    const n = p.count!;
    const off = rng.next() * TAU;
    const al = allied(e);
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * TAU + rng.next() * 0.5;
      const d = i === 0 ? 0 : (0.4 + rng.next() * 0.6) * p.spread!;
      const x = clamp(cx + Math.cos(a) * d, 8, ROOM_W - 8);
      const y = clamp(cy + Math.sin(a) * d, 8, ROOM_H - 8);
      const s = spawnLob(w, e.x, e.y - e.r * 0.5, x, y, p.air! * (0.9 + rng.next() * 0.2), p.height!, p.dmg!, p.size!, cp.style, al, e.uid);
      if (!s) break;
      s.splash = p.splash!;
      s.split = p.split!;
      if (p.creep! > 0) {
        s.creep = 1;
        s.creepR = Math.max(6, p.splash! * 1.1);
        s.creepLife = p.life!;
      }
    }
    w.events.emit('enemyLob', e.x, e.y, n, cp.style, e.def.id);
    b.n++;
    b.anim = 'roar';
    if (b.n >= p.volleys!) {
      b.mode = 2;
      b.t = Math.min(0.6, p.air! * 0.6);
    } else {
      b.mode = 1;
      b.t = p.gap! / b.pace;
    }
    return false;
  },
};

/** The pack's pattern behaviours, merged into PATTERNS (./patterns.ts). */
export const PATTERNS_A = { lineStrike, orbitDash, clusterLob } as const;

/** Declared for the params tests (every param spec is `[default, min, max]` with min ≤ default ≤ max). */
export const PATTERN_A_PARAMS: Readonly<Record<keyof typeof PATTERNS_A, ParamSpec>> = {
  lineStrike: lineStrike.params,
  orbitDash: orbitDash.params,
  clusterLob: clusterLob.params,
};
