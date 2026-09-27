/**
 * Boss pattern kinds added by boss pack B (chapters 3-4: the Grinding Works, the Rust Foundry, the
 * Mushroom Hollow, the Glimmer Grotto — guide: docs/content-bosses-b.md). They follow the library's
 * rules (patterns.ts): params `name: [default, min, max]`, a telegraph first ('bossTell', flash +
 * squash + a pose), timers ÷ pace, shot speeds × √pace, everything through the enemy shot pools (caps
 * and the charm rules apply), no allocation per tick.
 *
 *   podBurst     lobbed pods (marked landing spots) that burst into a ring of shots where they land,
 *                optionally leaving a puddle — slag bombs, spore pods
 *   closingRing  a ring of shots that forms around a spot and closes in on it (one gap to slip out
 *                through); on the boss with `edge` it starts at the room's walls — an echo coming back
 *   gearSpokes   volleys of straight radial spokes (several shots per arm at rising speeds) that turn
 *                a little each volley — gear teeth flung off a spinning wheel
 */

import { DEG, TAU } from '../../engine/math';
import { ROOM_H, ROOM_W, TILE } from '../constants';
import type { Enemy } from '../enemies/enemy';
import { ATTACK_COMMON, SHOT_COMMON, telegraph, type ParamSpec } from '../enemies/behaviors/common';
import { spawnEnemyShot, spawnLob } from '../enemies/shots';
import { ST_CHARM, hasStatus } from '../enemies/status';
import type { World } from '../world';
import type { CompiledPattern } from './compile';
import type { PatternBehavior } from './patterns';
import type { BossState } from './state';

// ── Helpers (the library's own are private to patterns.ts) ───────────────────

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function aimAngle(e: Enemy): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  return Math.atan2(e.tgtY - e.y, e.tgtX - e.x);
}

function tell(w: World, e: Enemy, b: BossState, cp: CompiledPattern, seconds: number, anim: string): void {
  const t = seconds / b.pace;
  b.mode = 0;
  b.t = t;
  b.anim = anim;
  if (t > 0.01) {
    telegraph(e, t);
    w.events.emit('bossTell', e.x, e.y, cp.index, 0, e.def.id);
  }
}

/** One shot of pattern `cp` (its size / dmg / accel / curve / phase / life), speed × √pace. */
function shot(w: World, e: Enemy, cp: CompiledPattern, b: BossState, x: number, y: number, angle: number, speed: number): void {
  const p = cp.p;
  const v = speed * Math.sqrt(b.pace);
  const s = spawnEnemyShot(w, x, y, Math.cos(angle) * v, Math.sin(angle) * v, p.dmg ?? 1, p.size ?? 3, cp.style, allied(e), e.uid);
  if (s) {
    s.accel = p.accel ?? 0;
    s.curve = p.curve ?? 0;
    s.phase = (p.phase ?? 0) > 0;
    s.life = p.life ?? 3;
  }
}

function shotSpec(own: ParamSpec): ParamSpec {
  return { windup: ATTACK_COMMON.windup!, ...SHOT_COMMON, ...own };
}

/** Closing-ring shots never appear closer than this to the player (px). */
const SAFE_SPAWN = 16;

/** Free for a shot to appear at (x, y): inside the room, not in a rock / prop. */
function openAt(w: World, x: number, y: number): boolean {
  if (x < 3 || y < 3 || x > ROOM_W - 3 || y > ROOM_H - 3) return false;
  return !w.room.blocksShotsAt(Math.floor(x / TILE), Math.floor(y / TILE));
}

// ── podBurst: lobbed pods that burst into rings where they land ───────────────
const podBurst: PatternBehavior = {
  params: {
    windup: [0.6, 0, 2],
    /** Pods thrown. */
    count: [4, 1, 10],
    /** Ring of shots each pod bursts into on landing (0 = none). */
    split: [6, 0, 12],
    /** Flight time (the marker's warning), s. */
    air: [1, 0.4, 2],
    height: [44, 10, 90],
    /** Scatter around the centre, px. */
    spread: [56, 0, 200],
    /** 0 = around the target (the first pod right on it), 1 = around the boss, 2 = anywhere in the room. */
    where: [0, 0, 2],
    /** Seconds between two throws. */
    stagger: [0.12, 0, 0.6],
    splash: [9, 4, 24],
    /** 1 = each pod leaves a puddle (radius / life). */
    creep: [0, 0, 1],
    radius: [10, 4, 30],
    life: [4, 1, 20],
    dmg: [1, 1, 2],
    size: [3.5, 1.5, 8],
  },
  start(w, e, b, cp) {
    b.n = 0;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.mode === 0) {
      if (b.t > 0) return false;
      b.mode = 1;
      b.t = 0;
    }
    if (b.mode === 1) {
      const rng = w.combatRng;
      while (b.t <= 0 && b.n < p.count!) {
        let cx = e.x;
        let cy = e.y;
        let d: number;
        const where = p.where!;
        if (where >= 2) {
          cx = 16 + rng.next() * (ROOM_W - 32);
          cy = 14 + rng.next() * (ROOM_H - 28);
          d = 0;
        } else if (where >= 1) {
          d = e.r + 8 + rng.next() * p.spread!;
        } else {
          if (e.hasTgt) {
            cx = e.tgtX;
            cy = e.tgtY;
          }
          d = b.n === 0 ? 0 : (0.35 + rng.next() * 0.65) * p.spread!;
        }
        const a = rng.next() * TAU;
        const x = Math.min(ROOM_W - 8, Math.max(8, cx + Math.cos(a) * d));
        const y = Math.min(ROOM_H - 8, Math.max(8, cy + Math.sin(a) * d));
        const s = spawnLob(w, e.x, e.y - e.r * 0.5, x, y, p.air! * (0.9 + rng.next() * 0.2), p.height!, p.dmg!, p.size!, cp.style, allied(e), e.uid);
        if (s) {
          s.splash = p.splash!;
          s.split = p.split!;
          s.creep = p.creep! > 0 ? 1 : 0;
          s.creepR = p.radius!;
          s.creepLife = p.life!;
        }
        w.events.emit('enemyLob', e.x, e.y, 1, cp.style, e.def.id);
        b.n++;
        b.anim = 'roar';
        b.t += p.stagger! / b.pace;
      }
      if (b.n >= p.count!) {
        b.mode = 2;
        b.t = p.air! * 1.1 + 0.25;
      }
      return false;
    }
    return b.t <= 0;
  },
};

// ── closingRing: a ring that forms around a spot and closes in (one gap) ─────
const closingRing: PatternBehavior = {
  params: shotSpec({
    windup: [0.6, 0, 2],
    /** Shots in the full circle. */
    count: [16, 6, 32],
    /** Starting radius, px (ignored with `edge`). */
    radius: [72, 30, 160],
    /** Shots left out to make the way out. */
    hole: [3, 0, 8],
    /** Starting inward speed (slow: the ring shows before it bites) and its speed-up, px/s². */
    speed: [14, 4, 120],
    accel: [110, 0, 400],
    life: [3.2, 0.3, 8],
    repeats: [1, 1, 5],
    gap: [0.9, 0.2, 3],
    /** 0 = closes on the target, 1 = on the boss. */
    center: [0, 0, 1],
    /** 1 = the ring starts at the room's walls (an echo coming back). */
    edge: [0, 0, 1],
    /** First an outward ring of this many shots from the boss (the call the echo answers). */
    out: [0, 0, 24],
    outSpeed: [100, 30, 220],
    /** Seconds between the outward ring and the first returning one. */
    delay: [0.7, 0, 2],
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
    if (b.mode === 0) {
      b.anim = 'roar';
      if (p.out! > 0) {
        const n = p.out!;
        const off = w.combatRng.next() * TAU;
        const r = e.r * 0.6;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * TAU;
          // The call itself flies straight (no speed-up).
          const v = p.outSpeed! * Math.sqrt(b.pace);
          const s = spawnEnemyShot(w, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.cos(a) * v, Math.sin(a) * v, p.dmg!, p.size!, cp.style, allied(e), e.uid);
          if (s) s.life = 3;
        }
        w.events.emit('enemyShoot', e.x, e.y, n, cp.style, e.def.id);
        b.mode = 1;
        b.t = p.delay! / b.pace;
        return false;
      }
      b.mode = 1;
    }
    if (b.n >= p.repeats!) return true;
    // One closing ring.
    const cx = p.center! > 0 || !e.hasTgt ? e.x : e.tgtX;
    const cy = p.center! > 0 || !e.hasTgt ? e.y : e.tgtY;
    const n = p.count!;
    const hole = Math.min(n - 2, p.hole!);
    const off = w.combatRng.next() * TAU;
    let fired = 0;
    for (let i = hole; i < n; i++) {
      const a = off + (i / n) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      let R = p.radius!;
      if (p.edge! > 0) {
        // Where the ray from the centre meets the room's (inset) walls.
        const tx = c > 1e-4 ? (ROOM_W - 5 - cx) / c : c < -1e-4 ? (5 - cx) / c : Infinity;
        const ty = s > 1e-4 ? (ROOM_H - 5 - cy) / s : s < -1e-4 ? (5 - cy) / s : Infinity;
        R = Math.max(8, Math.min(tx, ty));
      }
      const x = cx + c * R;
      const y = cy + s * R;
      if (!openAt(w, x, y)) continue;
      // Never right on top of her (an echo starting at the wall she hugs): the ring opens around her.
      const pdx = x - w.player.x;
      const pdy = y - w.player.y;
      if (pdx * pdx + pdy * pdy < SAFE_SPAWN * SAFE_SPAWN) continue;
      shot(w, e, cp, b, x, y, a + Math.PI, p.speed!);
      fired++;
    }
    if (fired > 0) w.events.emit('enemyShoot', cx, cy, fired, cp.style, e.def.id);
    b.n++;
    b.t = (b.n >= p.repeats! ? 0.45 : p.gap!) / b.pace;
    return false;
  },
};

// ── gearSpokes: turning volleys of straight radial spokes ─────────────────────
const gearSpokes: PatternBehavior = {
  params: shotSpec({
    windup: [0.6, 0, 2],
    arms: [4, 1, 8],
    /** Shots per spoke (at speed, speed + step, …). */
    len: [3, 1, 6],
    step: [18, 4, 60],
    speed: [60, 20, 220],
    volleys: [4, 1, 12],
    gap: [0.5, 0.1, 2],
    /** Degrees the spokes turn each volley (the direction is picked per use). */
    turn: [15, -90, 90],
    /** 1 = the first spoke points at the target. */
    aim: [0, 0, 1],
  }),
  start(w, e, b, cp) {
    b.n = 0;
    b.a0 = cp.p.aim! > 0 ? aimAngle(e) : w.combatRng.next() * TAU;
    b.a1 = w.combatRng.next() < 0.5 ? 1 : -1;
    tell(w, e, b, cp, cp.p.windup!, 'roar');
  },
  update(w, e, b, cp, dt) {
    const p = cp.p;
    stop(e);
    b.t -= dt;
    if (b.t > 0) return false;
    if (b.n >= p.volleys!) return true;
    const arms = p.arms!;
    const len = p.len!;
    const base = b.a0 + b.n * p.turn! * DEG * b.a1;
    const r = e.r * 0.6;
    for (let i = 0; i < arms; i++) {
      const a = base + (i / arms) * TAU;
      const x = e.x + Math.cos(a) * r;
      const y = e.y + Math.sin(a) * r;
      for (let j = 0; j < len; j++) shot(w, e, cp, b, x, y, a, p.speed! + j * p.step!);
    }
    w.events.emit('enemyShoot', e.x, e.y, arms * len, cp.style, e.def.id);
    b.n++;
    b.mode = 1;
    b.anim = 'roar';
    b.t = (b.n >= p.volleys! ? 0.3 : p.gap!) / b.pace;
    return false;
  },
};

/** Registered at the end of PATTERNS (patterns.ts); their names close BOSS_PATTERN_KINDS (types.ts). */
export const PATTERNS_B = { podBurst, closingRing, gearSpokes } as const;
