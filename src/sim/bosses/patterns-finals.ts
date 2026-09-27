/**
 * Boss pattern kinds added for the final bosses (Old Thunderhead, The Nestmother, The Undertow), in the
 * same shape as the core library (patterns.ts): numeric params `name: [default, min, max]`, a telegraph
 * first ('bossTell', flash + squash, a pose), timers ÷ the phase's pace, shot speeds × √pace, nothing
 * allocated per tick, everything through the enemy shot / lob / wave pools (caps and charm rules apply).
 * They are generic — any boss may use them:
 *
 *   strikes    marked strikes along a shape: a line walking at the target, a cross or a ring on her, or
 *              snaking "tentacles" — lightning bolts or water spouts (droplets, puddles)
 *   curtain    sheets of rain falling from the ceiling with a gap that shifts sheet by sheet (optionally
 *              slanted by the wind)
 *   gust       wind: pushes the player sideways (or sucks her in) for a while, blowing rain along
 *   clap       thunderclaps: a flash, a ring of shots and a shockwave, repeated
 *   brood      calls adds with their own HP / size, around the boss or hatching on marked spots
 *   dive       rises out of reach, its shadow hunts the target, locks (blinking), plunges: impact ring
 *              + shockwave, smashing crates it lands on
 *   barricade  spits wads that set into breakable crate walls between the boss and the target
 *   vortex     debris gathers and circles the boss, then is flung (aimed one by one, or a spray)
 *
 * Extra scratch: besides the BossState slots the core patterns use (mode, t, n, k, ax/ay, a0/a1),
 * `strikes` keeps a random offset / sway phase in tellX / tellY (the charge line is off), `vortex`
 * tags its debris shots through `EnemyShot.creepR` (unused by non-lob shots).
 */

import { DEG, TAU } from '../../engine/math';
import { ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W, TILE } from '../constants';
import type { Enemy } from '../enemies/enemy';
import { SHOT_COMMON, telegraph, walkableAt, type ParamSpec } from '../enemies/behaviors/common';
import { spawnEnemyShot, spawnLob, spawnWave, type EnemyShot } from '../enemies/shots';
import { spawnEnemy } from '../enemies/spawn';
import { ST_CHARM, hasStatus } from '../enemies/status';
import { SRC_ALLY } from '../hittable';
import { Deco, Tile } from '../tiles';
import { ENEMY_TUNING } from '../tuning';
import type { World } from '../world';
import type { CompiledPattern } from './compile';
import type { PatternBehavior } from './patterns';
import type { BossState } from './state';

// ── Helpers (the core library's are module-private) ─────────────────────────

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
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

/** One straight shot of pattern `cp` (its dmg / size / accel / curve / phase / life). */
function fire(w: World, e: Enemy, cp: CompiledPattern, b: BossState, x: number, y: number, angle: number, speed: number): EnemyShot | null {
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

/** A ring of `n` shots around the boss starting at `off`. */
function ringOf(w: World, e: Enemy, cp: CompiledPattern, b: BossState, n: number, off: number, speed: number): void {
  if (n <= 0) return;
  const r = e.r * 0.6;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    fire(w, e, cp, b, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, a, speed);
  }
  w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
}

function targetX(e: Enemy): number {
  return e.hasTgt ? e.tgtX : ROOM_W / 2;
}

function targetY(e: Enemy): number {
  return e.hasTgt ? e.tgtY : ROOM_H / 2;
}

function aimAt(e: Enemy): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  return Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
}

function clampX(x: number, m = 4): number {
  return x < m ? m : x > ROOM_W - m ? ROOM_W - m : x;
}

function clampY(y: number, m = 4): number {
  return y < m ? m : y > ROOM_H - m ? ROOM_H - m : y;
}

/**
 * Pushes the player along (vx, vy) px/s through her contact-shove channel (`pushX/Y`, which decays at
 * ENEMY_TUNING.playerPushDecay): adding v × decay × dt every tick settles at exactly v, and composes with
 * contact shoves. Wind, currents, suction.
 */
export function pushPlayer(w: World, vx: number, vy: number, dt: number): void {
  const p = w.player;
  if (p.dead) return;
  const k = ENEMY_TUNING.playerPushDecay * dt;
  p.pushX += vx * k;
  p.pushY += vy * k;
}

/** Common params of shot patterns. */
function shotSpec(own: ParamSpec): ParamSpec {
  return { windup: [0.6, 0, 2], ...SHOT_COMMON, ...own };
}

// ── strikes: marked strikes along a shape (lightning / water spouts) ────────

const SHAPE_LINE = 0;
const SHAPE_CROSS = 1;
const SHAPE_RING = 2;
const SHAPE_TENTACLE = 3;

/** How many marks one volley of `strikes` places. */
function strikeTotal(p: Readonly<Record<string, number>>): number {
  const n = p.count!;
  switch (p.shape) {
    case SHAPE_CROSS:
      return 1 + 4 * n;
    case SHAPE_RING:
      return n;
    default:
      return n * p.paths!;
  }
}

const strikeAt = { x: 0, y: 0 };

/** Where mark `i` of the current volley goes (origin ax/ay, target a0/a1, offset tellX, sway phase tellY). */
function strikePoint(e: Enemy, b: BossState, p: Readonly<Record<string, number>>, i: number): void {
  const shape = p.shape!;
  if (shape === SHAPE_CROSS) {
    if (i === 0) {
      strikeAt.x = b.a0;
      strikeAt.y = b.a1;
      return;
    }
    const d = Math.floor((i - 1) / 4) + 1;
    const arm = (i - 1) % 4;
    const a = b.tellX + arm * (Math.PI / 2);
    strikeAt.x = b.a0 + Math.cos(a) * d * p.step!;
    strikeAt.y = b.a1 + Math.sin(a) * d * p.step! * 0.8;
    return;
  }
  if (shape === SHAPE_RING) {
    const a = b.tellX + (i / p.count!) * TAU;
    strikeAt.x = b.a0 + Math.cos(a) * p.radius!;
    strikeAt.y = b.a1 + Math.sin(a) * p.radius! * 0.8;
    return;
  }
  const paths = p.paths!;
  const d = Math.floor(i / paths);
  const k = i % paths;
  const dx = b.a0 - b.ax;
  const dy = b.a1 - b.ay;
  const base = Math.atan2(dy, dx) + (k - (paths - 1) / 2) * p.fan! * DEG;
  const c = Math.cos(base);
  const s = Math.sin(base);
  if (shape === SHAPE_TENTACLE) {
    // A snaking path from the boss to (a little past) the target, swaying sideways.
    const L = Math.max(24, Math.sqrt(dx * dx + dy * dy)) * 1.12;
    const f = (d + 1) / p.count!;
    const along = e.r * 0.5 + (L - e.r * 0.5) * f;
    const sway = Math.sin(f * Math.PI * 2.2 + b.tellY + k * 1.7) * p.sway! * (0.35 + 0.65 * f);
    strikeAt.x = b.ax + c * along - s * sway;
    strikeAt.y = b.ay + s * along + c * sway;
    return;
  }
  // A line walking from under the boss toward (and past) the target.
  const along = Math.max(8, e.r * 0.5) + d * p.step!;
  strikeAt.x = b.ax + c * along;
  strikeAt.y = b.ay + s * along;
}

/** Locks the origin (the boss) and the target for a volley of marks. */
function lockStrikes(w: World, e: Enemy, b: BossState, p: Readonly<Record<string, number>>): void {
  b.ax = e.x;
  b.ay = e.y;
  b.a0 = targetX(e);
  b.a1 = targetY(e);
  b.tellLine = false;
  // Rings start anywhere; crosses stand upright (or as an X).
  b.tellX = p.shape === SHAPE_CROSS ? (p.tilt! > 0 ? Math.PI / 4 : 0) : w.combatRng.next() * TAU;
  b.tellY = w.combatRng.next() * TAU;
  b.n = 0;
}

/** One mark: a lightning bolt, or a water spout (a glob that bursts up and splashes down). */
function strikeMark(w: World, e: Enemy, cp: CompiledPattern, b: BossState, x: number, y: number): void {
  const p = cp.p;
  if (x < 3 || y < 3 || x > ROOM_W - 3 || y > ROOM_H - 3) return;
  const bolt = p.bolt! > 0;
  const air = p.air! / b.pace;
  const s = spawnLob(w, x, y, x, y, air, bolt ? 120 : 34, p.dmg!, bolt ? 2 : 3, cp.style, allied(e), e.uid);
  if (!s) return;
  s.fall = bolt ? 2 : 0;
  s.splash = p.splash!;
  if (!bolt) {
    s.split = p.spray!;
    if (p.creep! > 0) {
      s.creep = 1;
      s.creepR = p.splash! * 0.9;
      s.creepLife = 4;
    }
  }
}

const strikes: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** 0 a line walking at the target, 1 a cross on the target, 2 a ring around it, 3 snaking tentacles. */
    shape: [0, 0, 3],
    /** Marks per path (a cross: per arm, plus its centre; a ring: in all). */
    count: [6, 1, 16],
    /** Lines / tentacles fanned out. */
    paths: [1, 1, 3],
    /** Fan between paths, degrees. */
    fan: [30, 0, 90],
    /** Distance between marks (lines, crosses), px. */
    step: [20, 8, 48],
    /** Ring radius, px. */
    radius: [40, 16, 90],
    /** 1 = the cross is turned 45° (an X). */
    tilt: [0, 0, 1],
    /** Seconds between one mark and the next (0 = all at once). */
    delay: [0.1, 0, 0.5],
    /** Warning time of each mark (the marker shows this long), s. */
    air: [0.8, 0.4, 2],
    /** 1 = lightning, 0 = water spouts. */
    bolt: [1, 0, 1],
    splash: [9, 4, 24],
    /** Spouts: droplets sprayed where they splash down. */
    spray: [0, 0, 8],
    /** Spouts: 1 = a puddle stays. */
    creep: [0, 0, 1],
    /** Tentacles: sideways sway, px. */
    sway: [16, 0, 40],
    repeats: [1, 1, 4],
    /** Seconds between volleys. */
    gap: [0.6, 0.1, 2],
    dmg: [1, 1, 4],
  },
  start(w, e, b, cp) {
    b.k = 0;
    lockStrikes(w, e, b, cp.p);
    tell(w, e, b, cp, cp.p.windup!, cp.p.bolt! > 0 ? 'roar' : 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    if (b.mode === 0) {
      b.t -= dt;
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = 0;
      b.anim = 'roar';
      // Aimed at where she is now, not where she stood when the telegraph began.
      lockStrikes(w, e, b, p);
      w.events.emit(p.bolt! > 0 ? 'enemyShoot' : 'enemyLob', e.x, e.y, strikeTotal(p), cp.style, e.def.id);
      return false;
    }
    b.t += dt;
    const total = strikeTotal(p);
    const delay = p.delay! / b.pace;
    while (b.n < total && b.t >= b.n * delay) {
      strikePoint(e, b, p, b.n);
      strikeMark(w, e, cp, b, strikeAt.x, strikeAt.y);
      b.n++;
    }
    if (b.n < total) return false;
    const last = (total - 1) * delay;
    if (b.k + 1 < p.repeats!) {
      if (b.t < last + p.gap! / b.pace) return false;
      b.k++;
      lockStrikes(w, e, b, p);
      b.t = 0;
      w.events.emit('bossTell', e.x, e.y, cp.index, 0, e.def.id);
      return false;
    }
    return b.t >= last + (p.air! / b.pace) * 0.7;
  },
};

// ── curtain: sheets of rain from the ceiling with a shifting gap ────────────

const curtain: PatternBehavior = {
  params: shotSpec({
    windup: [0.6, 0, 2],
    sheets: [3, 1, 8],
    /** Seconds between sheets. */
    gap: [0.9, 0.2, 3],
    /** Distance between drops, px. */
    spacing: [13, 8, 30],
    /** Drops left out to make the gap. */
    hole: [3, 2, 6],
    /** The gap moves up to this many drops from one sheet to the next. */
    shift: [2, 0, 6],
    /** Sideways drift of the rain (vx = slant × speed). */
    slant: [0, -0.8, 0.8],
    speed: [70, 20, 200],
    size: [2.5, 1.5, 5],
    life: [4, 0.3, 8],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    b.a0 = -1;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.n >= p.sheets!) return true;
    const gap = p.spacing!;
    const count = Math.floor((ROOM_W - 8) / gap) + 1;
    const x0 = (ROOM_W - (count - 1) * gap) / 2;
    const hole = Math.min(count - 2, p.hole!);
    const rng = w.combatRng;
    // The first gap opens near the target; each sheet moves it a little.
    let h: number;
    if (b.a0 < 0) h = Math.round((targetX(e) - x0) / gap) - (hole >> 1) + rng.int(-1, 1);
    else h = b.a0 + rng.int(-p.shift!, p.shift!);
    h = Math.max(0, Math.min(count - hole, h));
    b.a0 = h;
    const v = sp(b, p.speed!);
    const vx = p.slant! * v;
    const vy = v;
    // Slanted rain: drops that would start beyond the upwind wall come in through it, on the same line.
    const extra = vx === 0 ? 0 : Math.ceil((Math.abs(p.slant!) * ROOM_H) / gap);
    for (let j = -extra; j < count + extra; j++) {
      if (j >= h && j < h + hole) continue;
      let x = x0 + j * gap;
      let y = 3;
      if (x < 4 || x > ROOM_W - 4) {
        if (vx === 0 || (x < 4 && vx < 0) || (x > ROOM_W - 4 && vx > 0)) continue;
        const edge = x < 4 ? 4 : ROOM_W - 4;
        const t = (edge - x) / vx;
        y = 3 + vy * t;
        x = edge;
        if (y > ROOM_H - 6) continue;
      }
      const s = spawnEnemyShot(w, x, y, vx, vy, p.dmg!, p.size!, cp.style, allied(e), e.uid);
      if (!s) break;
      s.life = p.life!;
      s.accel = p.accel!;
    }
    w.events.emit('enemyShoot', e.x, e.y, count, cp.style, e.def.id);
    b.n++;
    b.mode = 1;
    b.anim = 'roar';
    b.t = b.n >= p.sheets! ? 0.35 : p.gap! / b.pace;
    return false;
  },
};

// ── gust: wind pushes the player (and blows rain along) ─────────────────────

const gust: PatternBehavior = {
  params: {
    windup: [0.7, 0.2, 2],
    time: [2.2, 0.5, 5],
    /** Push on the player, px/s (she walks at ~96). */
    force: [55, 10, 90],
    /** 0 = away from the boss (sideways), 1 = toward it (it inhales), 2 = a random side. */
    dir: [0, 0, 2],
    /** Drops blown in from the upwind wall, per second. */
    rain: [0, 0, 24],
    speed: [110, 30, 240],
    size: [2.5, 1.5, 5],
    dmg: [1, 1, 2],
  },
  start(w, e, b, cp) {
    const p = cp.p;
    const side = targetX(e) >= e.x ? 1 : -1;
    b.a0 = p.dir === 1 ? -side : p.dir === 2 ? (w.combatRng.next() < 0.5 ? 1 : -1) : side;
    b.k = 0;
    b.n = 0;
    tell(w, e, b, cp, p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    const dir = b.a0;
    if (b.mode === 0) {
      b.t -= dt;
      // The wind picks up: a few streaks already fly the way it will blow.
      b.k -= dt;
      if (b.k <= 0) {
        b.k = 0.3;
        w.events.emit('enemyDash', dir > 0 ? 10 : ROOM_W - 10, 12 + w.combatRng.next() * (ROOM_H - 24), -dir, 0, e.def.id);
      }
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = p.time! / b.pace;
      b.a1 = b.t;
      b.k = 0;
      b.ax = 0;
      b.anim = 'roar';
      w.events.emit('sfx', e.x, e.y, 0, 0, 'boomerang_whoosh');
      return false;
    }
    b.t -= dt;
    const total = b.a1;
    const into = total - b.t;
    // Ramps in and out so it never jerks her around.
    const ramp = Math.min(1, into / 0.35, Math.max(0, b.t) / 0.35);
    pushPlayer(w, dir * p.force! * ramp, 0, dt);
    // Streaks of wind blowing across the room (a whoosh with each gust of them).
    b.k -= dt;
    if (b.k <= 0) {
      b.k = 0.24;
      for (let i = 0; i < 3; i++) {
        const x = 12 + w.combatRng.next() * (ROOM_W - 24);
        const y = 8 + ((i + w.combatRng.next()) / 3) * (ROOM_H - 16);
        w.events.emit('enemyDash', x, y, -dir, 0, e.def.id);
      }
    }
    // Rain blown in sideways from the upwind wall.
    if (p.rain! > 0) {
      b.ax += dt * p.rain! * Math.sqrt(b.pace);
      while (b.ax >= 1) {
        b.ax -= 1;
        const y = 8 + w.combatRng.next() * (ROOM_H - 16);
        const v = sp(b, p.speed!);
        const s = spawnEnemyShot(w, dir > 0 ? 5 : ROOM_W - 5, y, dir * v, v * 0.12, p.dmg!, p.size!, cp.style, allied(e), e.uid);
        if (s) s.life = 3.5;
      }
    }
    return b.t <= 0;
  },
};

// ── clap: thunderclaps (flash, ring of shots, shockwave) ────────────────────

const clap: PatternBehavior = {
  params: shotSpec({
    windup: [0.8, 0.2, 2],
    claps: [1, 1, 4],
    gap: [0.5, 0.15, 1.5],
    /** Shots per ring (0 = none). */
    count: [14, 0, 32],
    speed: [85, 20, 220],
    /** 1 = every other ring is offset by half a step. */
    alt: [1, 0, 1],
    /** 1 = a shockwave with each clap. */
    waves: [1, 0, 1],
    waveRadius: [70, 20, 160],
    waveSpeed: [110, 40, 260],
    /** 1 = each clap flashes like lightning (thunder), 0 = a burst of the shot's colour. */
    flash: [1, 0, 1],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    b.a0 = w.combatRng.next() * TAU;
    tell(w, e, b, cp, cp.p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.n >= p.claps!) return true;
    const n = p.count!;
    const off = b.a0 + (p.alt! > 0 && (b.n & 1) === 1 && n > 0 ? Math.PI / n : 0);
    // The clap: a flash of lightning at the boss (thunder) or a burst, then the ring and the shockwave.
    w.events.emit('lobLand', e.x, e.y, Math.round(e.r * 1.5), cp.style, p.flash! > 0 ? 'bolt' : '');
    ringOf(w, e, cp, b, n, off, p.speed!);
    if (p.waves! > 0) spawnWave(w, e.x, e.y, p.waveRadius!, sp(b, p.waveSpeed!), p.dmg!, 6, allied(e), e.uid);
    else w.events.emit('bossSlam', e.x, e.y, e.r * 2, 0, e.def.id);
    b.n++;
    b.mode = 1;
    b.anim = 'roar';
    b.t = b.n >= p.claps! ? 0.35 : p.gap! / b.pace;
    return false;
  },
};

// ── brood: adds with their own HP / size, around the boss or hatching on marked spots ──

const brood: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    count: [2, 1, 6],
    /** Most of its adds alive at once. */
    max: [4, 1, 8],
    /** Starting HP (0 = the add's own). */
    hp: [0, 0, 200],
    /** Size of the adds. */
    scale: [1, 0.4, 1.3],
    /** 0 = around the boss, 1 = around the target (never on top of her), 2 = anywhere in the room. */
    place: [0, 0, 2],
    /** Around the boss: beyond its edge; around the target: at least this far, px. */
    dist: [20, 6, 90],
    /** Hatching: the adds fade in (harmless, untouchable) this long, s. */
    hatch: [0.6, 0.3, 1.6],
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
    b.t = 0.4;
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
    const scale = p.scale!;
    const r = def.radius * scale;
    const pl = w.player;
    let made = 0;
    for (let i = 0; i < n; i++) {
      let x = e.x;
      let y = e.y;
      for (let tries = 0; tries < 12; tries++) {
        let cx: number;
        let cy: number;
        if (p.place === 0) {
          const a = rng.next() * TAU;
          cx = e.x + Math.cos(a) * (e.r + p.dist!);
          cy = e.y + Math.sin(a) * (e.r + p.dist!);
        } else if (p.place === 1) {
          const a = rng.next() * TAU;
          const d = p.dist! + rng.next() * 40;
          cx = targetX(e) + Math.cos(a) * d;
          cy = targetY(e) + Math.sin(a) * d * 0.8;
        } else {
          cx = 12 + rng.next() * (ROOM_W - 24);
          cy = 12 + rng.next() * (ROOM_H - 24);
        }
        // Never on top of her (the last tries settle for any spot that fits).
        const far = (cx - pl.x) * (cx - pl.x) + (cy - pl.y) * (cy - pl.y) > 30 * 30 || tries >= 10;
        const fits = def.flying ? cx > r + 4 && cy > r + 4 && cx < ROOM_W - r - 4 && cy < ROOM_H - r - 4 : walkableAt(w, cx, cy, r);
        if (fits && far) {
          x = cx;
          y = cy;
          break;
        }
      }
      const m = spawnEnemy(w, def, x, y, { champion: false, scale, hp: p.hp! > 0 ? p.hp! : undefined, spawnT: p.hatch! });
      if (!m) break;
      m.parent = e.uid;
      if (allied(e)) m.applyStatus('charm', e.status.t[ST_CHARM]!, 0, SRC_ALLY);
      w.events.emit('enemySummon', x, y, 1, 0, e.def.id);
      made++;
    }
    if (made > 0) b.anim = 'roar';
    return false;
  },
};

// ── dive: up out of reach, the shadow hunts the target, locks, plunges ──────

const dive: PatternBehavior = {
  params: {
    windup: [0.5, 0.1, 2],
    /** Climb, s. */
    rise: [0.45, 0.2, 1.5],
    height: [70, 20, 120],
    /** Hunting: the shadow follows the target this long, s. */
    track: [0.9, 0.2, 3],
    /** How fast the shadow follows, px/s. */
    follow: [110, 30, 260],
    /** Locked on (blinking) before the plunge, s. */
    lock: [0.45, 0.2, 1.5],
    /** The plunge, s. */
    fall: [0.25, 0.1, 1],
    count: [1, 1, 4],
    ring: [10, 0, 24],
    ringSpeed: [80, 30, 220],
    waves: [1, 0, 1],
    waveRadius: [60, 20, 160],
    /** 1 = smashes the crates it lands on. */
    crush: [1, 0, 1],
    pause: [0.5, 0, 2],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    tell(w, e, b, cp, cp.p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    b.t -= dt;
    switch (b.mode) {
      case 0:
        stop(e);
        if (b.t > 0) return false;
        b.mode = 1;
        b.t = p.rise! / b.pace;
        b.anim = 'air';
        b.markX = e.x;
        b.markY = e.y;
        b.markT = 9;
        w.events.emit('enemyHop', e.x, e.y, e.r, 0, e.def.id);
        return false;
      case 1: {
        stop(e);
        const rise = p.rise! / b.pace;
        const f = 1 - Math.max(0, b.t) / rise;
        e.z = p.height! * (1 - (1 - f) * (1 - f));
        b.markX = e.x;
        b.markY = e.y;
        if (b.t > 0) return false;
        b.mode = 2;
        b.t = p.track! / b.pace;
        return false;
      }
      case 2: {
        // The shadow (her position; the marker rides on it) closes in on the target.
        e.z = p.height!;
        const dx = targetX(e) - e.x;
        const dy = targetY(e) - e.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        const v = Math.min(sp(b, p.follow!), d / Math.max(dt, 1e-3));
        if (d > 0.5) {
          e.tvx = (dx / d) * v;
          e.tvy = (dy / d) * v;
          e.snap = true;
        } else stop(e);
        b.markX = e.x;
        b.markY = e.y;
        if (b.t > 0) return false;
        b.mode = 3;
        b.t = p.lock! / b.pace;
        stop(e);
        e.vx = e.vy = 0;
        telegraph(e, b.t);
        w.events.emit('enemyWindup', e.x, e.y, 0, 0, e.def.id);
        return false;
      }
      case 3:
        stop(e);
        e.z = p.height!;
        b.markX = e.x;
        b.markY = e.y;
        if (b.t > 0) return false;
        b.mode = 4;
        b.t = p.fall! / b.pace;
        b.anim = 'charge';
        return false;
      case 4: {
        stop(e);
        const fall = p.fall! / b.pace;
        const f = 1 - Math.max(0, b.t) / fall;
        e.z = p.height! * (1 - f * f);
        if (b.t > 0) return false;
        e.z = 0;
        e.vx = e.vy = 0;
        b.markT = 0;
        b.anim = 'slam';
        w.events.emit('enemyLand', e.x, e.y, e.r, 0, e.def.id);
        w.events.emit('bossSlam', e.x, e.y, e.r * 2, 1, e.def.id);
        ringOf(w, e, cp, b, p.ring!, w.combatRng.next() * TAU, p.ringSpeed!);
        if (p.waves! > 0) spawnWave(w, e.x, e.y, p.waveRadius!, 130, p.dmg!, 6, allied(e), e.uid);
        if (p.crush! > 0) crushCrates(w, e.x, e.y, e.r + 6);
        b.mode = 5;
        b.t = p.pause! / b.pace;
        return false;
      }
      default:
        stop(e);
        if (b.t > 0) return false;
        b.n++;
        if (b.n >= p.count!) return true;
        tell(w, e, b, cp, p.windup! * 0.6, 'windup');
        return false;
    }
  },
};

/**
 * Smashes the crates overlapping a circle (a boss landing on a wall): no loot, a burst of debris.
 * Returns how many broke.
 */
export function crushCrates(w: World, x: number, y: number, r: number): number {
  const room = w.room;
  let n = 0;
  const c0 = Math.max(0, Math.floor((x - r) / TILE));
  const c1 = Math.min(ROOM_COLS - 1, Math.floor((x + r) / TILE));
  const r0 = Math.max(0, Math.floor((y - r) / TILE));
  const r1 = Math.min(ROOM_ROWS - 1, Math.floor((y + r) / TILE));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (room.get(col, row) !== Tile.Crate) continue;
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      const nx = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const ny = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      if ((nx - x) * (nx - x) + (ny - y) * (ny - y) > r * r) continue;
      breakCrate(w, col, row, cx, cy);
      n++;
    }
  }
  return n;
}

/** A crate turns to floor (planks left behind) without rolling loot. */
export function breakCrate(w: World, col: number, row: number, cx = col * TILE + TILE / 2, cy = row * TILE + TILE / 2): void {
  const room = w.room;
  room.set(col, row, Tile.Floor);
  room.deco[row * ROOM_COLS + col] = Deco.Planks;
  w.events.emit('tileBreak', cx, cy, Tile.Crate, 0);
}

// ── barricade: wads that set into breakable walls between the boss and the target ──

/** Door-front cells (never walled: every door stays reachable). */
const DOOR_FRONTS = [6, 3 * ROOM_COLS + 12, 6 * ROOM_COLS + 6, 3 * ROOM_COLS];

/** Planned wall cells per boss (≤ 16, allocated once per boss the first time it builds). */
const plans = new WeakMap<BossState, Int16Array>();

/** Does a circle overlap the cell (col, row)? */
function circleOnCell(col: number, row: number, x: number, y: number, r: number): boolean {
  const x0 = col * TILE;
  const y0 = row * TILE;
  const nx = x < x0 ? x0 : x > x0 + TILE ? x0 + TILE : x;
  const ny = y < y0 ? y0 : y > y0 + TILE ? y0 + TILE : y;
  return (nx - x) * (nx - x) + (ny - y) * (ny - y) < r * r;
}

/** May a crate go on this cell right now (plain floor, nothing standing / lying there, not a door front)? */
export function crateFits(w: World, col: number, row: number): boolean {
  const room = w.room;
  if (!room.inBounds(col, row) || room.get(col, row) !== Tile.Floor) return false;
  const cell = row * ROOM_COLS + col;
  for (let i = 0; i < DOOR_FRONTS.length; i++) if (DOOR_FRONTS[i] === cell) return false;
  const p = w.player;
  if (circleOnCell(col, row, p.x, p.y, p.r + 4)) return false;
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const o = enemies.items[i]!;
    if (o.dead || o.flying || o.boss) continue;
    if (circleOnCell(col, row, o.x, o.y, o.r + 1)) return false;
  }
  const pk = w.pickups;
  for (let i = 0; i < pk.count; i++) if (circleOnCell(col, row, pk.items[i]!.x, pk.items[i]!.y, 4)) return false;
  const pd = w.pedestals;
  for (let i = 0; i < pd.count; i++) if (circleOnCell(col, row, pd.items[i]!.x, pd.items[i]!.y, 8)) return false;
  const bm = w.bombs;
  for (let i = 0; i < bm.count; i++) if (circleOnCell(col, row, bm.items[i]!.x, bm.items[i]!.y, 5)) return false;
  return true;
}

function countCrates(w: World): number {
  const t = w.room.tiles;
  let n = 0;
  for (let i = 0; i < t.length; i++) if (t[i] === Tile.Crate) n++;
  return n;
}

const barricade: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** Cells per wall. */
    cells: [5, 2, 7],
    /** Cells left open in each wall. */
    gaps: [1, 0, 3],
    /** Walls: 2 = a second one a cell further back. */
    walls: [1, 1, 2],
    /** Flight of the wads (their landing markers are the warning), s. */
    air: [0.9, 0.4, 2],
    /** Most crates the room may hold (she builds fewer beyond that). */
    max: [16, 4, 40],
    dmg: [1, 1, 2],
  },
  start(w, e, b, cp) {
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    let plan = plans.get(b);
    if (!plan) {
      plan = new Int16Array(16);
      plans.set(b, plan);
    }
    if (b.mode === 0) {
      // Plan the wall(s) across the line from the boss to the target, a couple of cells in front of her.
      b.mode = 1;
      b.n = 0;
      const pc = Math.max(0, Math.min(ROOM_COLS - 1, Math.floor(targetX(e) / TILE)));
      const pr = Math.max(0, Math.min(ROOM_ROWS - 1, Math.floor(targetY(e) / TILE)));
      const bc = Math.floor(e.x / TILE);
      const br = Math.floor(e.y / TILE);
      const dx = e.x - targetX(e);
      const dy = e.y - targetY(e);
      const vertical = Math.abs(dx) * 0.7 >= Math.abs(dy);
      const budget = Math.max(0, p.max! - countCrates(w));
      const rng = w.combatRng;
      for (let wall = 0; wall < p.walls!; wall++) {
        const cells = p.cells!;
        const lineRows = vertical ? ROOM_ROWS : ROOM_COLS;
        const s = vertical ? (dx >= 0 ? 1 : -1) : dy >= 0 ? 1 : -1;
        let at = (vertical ? pc : pr) + s * (2 + wall);
        const lim = vertical ? bc : br;
        // Never past the boss's own cell.
        if ((s > 0 && at >= lim) || (s < 0 && at <= lim)) at = (vertical ? pc : pr) + s * (1 + wall);
        if (at < 0 || at >= (vertical ? ROOM_COLS : ROOM_ROWS)) continue;
        const mid = vertical ? pr : pc;
        const first = Math.max(0, Math.min(lineRows - cells, mid - (cells >> 1)));
        let gapA = first + rng.int(0, cells - 1);
        let gapB = p.gaps! > 1 ? first + rng.int(0, cells - 1) : -1;
        if (p.gaps! <= 0) gapA = gapB = -1;
        const gapC = p.gaps! > 2 ? first + rng.int(0, cells - 1) : -1;
        for (let i = first; i < first + cells && b.n < plan.length; i++) {
          if (i === gapA || i === gapB || i === gapC) continue;
          if (b.n >= budget) break;
          const col = vertical ? at : i;
          const row = vertical ? i : at;
          if (!crateFits(w, col, row)) continue;
          plan[b.n++] = row * ROOM_COLS + col;
        }
      }
      // Paper wads arc onto each planned cell (their landing rings are the warning).
      const air = p.air! / b.pace;
      for (let i = 0; i < b.n; i++) {
        const cell = plan[i]!;
        const x = (cell % ROOM_COLS) * TILE + TILE / 2;
        const y = Math.floor(cell / ROOM_COLS) * TILE + TILE / 2;
        const s = spawnLob(w, e.x, e.y - e.r * 0.4, x, y, air * (0.92 + 0.08 * (i / Math.max(1, b.n))), 38, p.dmg!, 3, cp.style, allied(e), e.uid);
        if (s) s.splash = 7;
      }
      if (b.n > 0) w.events.emit('enemyLob', e.x, e.y, b.n, cp.style, e.def.id);
      b.anim = 'roar';
      b.t = air + 0.05;
      return false;
    }
    if (b.mode === 1) {
      // The wads set: each planned cell still free becomes a paper wall.
      for (let i = 0; i < b.n; i++) {
        const cell = plan[i]!;
        const col = cell % ROOM_COLS;
        const row = Math.floor(cell / ROOM_COLS);
        if (!crateFits(w, col, row)) continue;
        w.room.set(col, row, Tile.Crate);
        w.events.emit('tileHit', col * TILE + TILE / 2, row * TILE + TILE / 2, Tile.Crate, 2);
      }
      b.mode = 2;
      b.t = 0.3;
      return false;
    }
    return true;
  },
};

// ── vortex: debris circles the boss, then is flung ──────────────────────────

/** Debris shots of a boss's vortex carry this tag + its uid in `creepR` while they circle. */
const VORTEX_TAG = 100000;

const vortex: PatternBehavior = {
  params: shotSpec({
    windup: [0.6, 0, 2],
    count: [8, 3, 20],
    /** Orbit radius from the boss's centre, px (squashed to 0.8 vertically). */
    radius: [32, 14, 70],
    /** Orbit speed, rad/s (negative = the other way). */
    spin: [2.4, -6, 6],
    /** Circling before the first fling, s. */
    hold: [1.4, 0.4, 4],
    /** 0 = flung at the target one by one, 1 = all at once along the spin, 2 = all at once straight out. */
    fling: [0, 0, 2],
    /** Aimed flings: seconds between two. */
    interval: [0.1, 0.03, 0.5],
    speed: [120, 30, 260],
    size: [3.5, 1.5, 6],
    /** Extra pull on the player toward the boss while the debris circles, px/s. */
    pull: [0, 0, 60],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    b.k = 0;
    tell(w, e, b, cp, cp.p.windup!, 'windup');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    const tag = VORTEX_TAG + e.uid;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      // Debris rises out of the water all around, a little wide of the orbit, and is drawn in.
      const n = p.count!;
      const off = w.combatRng.next() * TAU;
      const R = p.radius! * 1.6;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        const s = spawnEnemyShot(w, clampX(e.x + Math.cos(a) * R, 6), clampY(e.y + Math.sin(a) * R * 0.8, 6), 0, 0, p.dmg!, p.size!, cp.style, allied(e), e.uid);
        if (!s) break;
        s.phase = true;
        s.life = 60;
        s.creepR = tag;
      }
      w.events.emit('sfx', e.x, e.y, 0, 0, 'teleport');
      b.mode = 1;
      b.t = p.hold! / b.pace;
      b.a1 = b.t;
      b.anim = 'roar';
      return false;
    }
    // Circling: every tagged shot is carried along the orbit (its velocity lands it there this tick).
    const hold = b.a1;
    const gather = b.mode === 1 ? Math.min(1, (hold - Math.max(0, b.t)) / Math.min(0.5, hold)) : 1;
    const R = p.radius! * (1.6 - 0.6 * gather);
    const spin = p.spin! * Math.sqrt(b.pace);
    const shots = w.enemyShots;
    let left = 0;
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.lob || s.creepR !== tag) continue;
      left++;
      const a = Math.atan2((s.y - e.y) / 0.8, s.x - e.x) + spin * dt;
      const tx = clampX(e.x + Math.cos(a) * R, 5);
      const ty = clampY(e.y + Math.sin(a) * R * 0.8, 5);
      s.vx = (tx - s.x) / dt;
      s.vy = (ty - s.y) / dt;
    }
    if (p.pull! > 0 && left > 0) {
      const dx = e.x - w.player.x;
      const dy = e.y - w.player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > e.r + 8) pushPlayer(w, (dx / d) * p.pull!, (dy / d) * p.pull!, dt);
    }
    if (b.mode === 1) {
      if (b.t > 0 && left > 0) return false;
      b.mode = 2;
      b.t = 0;
      b.anim = 'roar';
    }
    if (left === 0) return b.t <= -0.2;
    // Fling.
    const v = sp(b, p.speed!);
    if (p.fling === 0) {
      if (b.t > 0) return false;
      b.t = p.interval! / b.pace;
      // The piece coming round nearest the target's side goes first.
      const want = aimAt(e);
      let best: EnemyShot | null = null;
      let bd = Infinity;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        if (s.lob || s.creepR !== tag) continue;
        let da = Math.atan2(s.y - e.y, s.x - e.x) - want;
        da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        if (da < bd) {
          bd = da;
          best = s;
        }
      }
      if (best) {
        const tx = targetX(e);
        const ty = targetY(e);
        const a = Math.atan2(ty - best.y, tx - best.x);
        release(best, Math.cos(a) * v, Math.sin(a) * v);
        if ((b.k++ & 1) === 0) w.events.emit('enemyShoot', best.x, best.y, 1, cp.style, e.def.id);
      }
      return false;
    }
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.lob || s.creepR !== tag) continue;
      const a = Math.atan2((s.y - e.y) / 0.8, s.x - e.x);
      if (p.fling === 1) {
        const dir = p.spin! >= 0 ? 1 : -1;
        const tx = -Math.sin(a) * dir + Math.cos(a) * 0.35;
        const ty = Math.cos(a) * dir + Math.sin(a) * 0.35;
        const l = Math.sqrt(tx * tx + ty * ty);
        release(s, (tx / l) * v, (ty / l) * v);
      } else {
        release(s, Math.cos(a) * v, Math.sin(a) * v);
      }
    }
    w.events.emit('enemyShoot', e.x, e.y, left, cp.style, e.def.id);
    b.t = 0;
    return false;
  },
};

/** A circling piece of debris is let go at (vx, vy). */
function release(s: EnemyShot, vx: number, vy: number): void {
  s.vx = vx;
  s.vy = vy;
  s.creepR = 0;
  s.life = s.age + 3;
}

export const FINALS_PATTERN_KINDS = ['strikes', 'curtain', 'gust', 'clap', 'brood', 'dive', 'barricade', 'vortex'] as const;
export type FinalsPatternKind = (typeof FINALS_PATTERN_KINDS)[number];

/** Registered into the core library's PATTERNS (patterns.ts) by kind. */
export const FINALS_PATTERNS: Readonly<Record<FinalsPatternKind, PatternBehavior>> = {
  strikes,
  curtain,
  gust,
  clap,
  brood,
  dive,
  barricade,
  vortex,
};
