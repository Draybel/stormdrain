/**
 * Attack behaviours (ATTACK_KINDS). Each `fire` runs once the wind-up telegraph is over (the runner in
 * attackRunner.ts handles cooldowns, ranges and telegraphs). Shots of a charmed enemy are allied:
 * they hurt enemies instead of the player.
 */

import { SRC_ALLY } from '../../hittable';
import type { AttackKind } from '../../types';
import type { World } from '../../world';
import type { Enemy } from '../enemy';
import { spawnCreep, spawnEnemyShot, spawnLob, spawnWave, type EnemyShot } from '../shots';
import { spawnEnemy } from '../spawn';
import { ST_CHARM, hasStatus } from '../status';
import { ATTACK_COMMON, SHOT_COMMON, walkableAt, type AttackBehavior, type CompiledAttack, type ParamSpec } from './common';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

function allied(e: Enemy): boolean {
  return hasStatus(e.status, ST_CHARM);
}

/** Angle from the enemy to its target (with optional lead on a moving player), or its facing. */
function aimAngle(w: World, e: Enemy, lead = 0, speed = 90): number {
  if (!e.hasTgt) return e.face > 0 ? 0 : Math.PI;
  let tx = e.tgtX;
  let ty = e.tgtY;
  if (lead > 0 && e.tgtPlayer) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const t = Math.sqrt(dx * dx + dy * dy) / Math.max(20, speed);
    tx += w.player.vx * t * lead;
    ty += w.player.vy * t * lead;
  }
  return Math.atan2(ty - e.y, tx - e.x);
}

/** Fires one shot of attack `a` at `angle` from just in front of the enemy. */
function shoot(w: World, e: Enemy, a: CompiledAttack, angle: number, speedMul = 1): EnemyShot | null {
  const p = a.p;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const sp = p.speed! * speedMul;
  const off = e.r * 0.5;
  const shot = spawnEnemyShot(w, e.x + c * off, e.y + s * off, c * sp, s * sp, p.dmg!, p.size!, a.style, allied(e), e.uid);
  if (shot) {
    shot.accel = p.accel!;
    shot.curve = p.curve!;
    shot.phase = p.phase! > 0;
    shot.life = p.life!;
  }
  return shot;
}

function volley(w: World, e: Enemy, a: CompiledAttack, count: number): void {
  w.events.emit('enemyShoot', e.x, e.y, count, a.style, e.def.id);
}

function spec(own: ParamSpec, shots = true): ParamSpec {
  return shots ? { ...ATTACK_COMMON, ...SHOT_COMMON, ...own } : { ...ATTACK_COMMON, ...own };
}

// ── aimedShot: one (or a tight pair/triple of) shot(s) straight at the target ──
const aimedShot: AttackBehavior = {
  params: spec({
    /** 0..1: how much it leads a moving player. */
    lead: [0, 0, 1],
    count: [1, 1, 3],
    /** Degrees between shots when count > 1. */
    spread: [12, 0, 60],
  }),
  fire(w, e, a) {
    const p = a.p;
    const n = p.count!;
    const base = aimAngle(w, e, p.lead!, p.speed!);
    for (let i = 0; i < n; i++) shoot(w, e, a, base + (i - (n - 1) / 2) * p.spread! * DEG);
    volley(w, e, a, n);
  },
};

// ── cardinal4: + pattern (optionally alternating with ×) ─────────────────────
const cardinal4: AttackBehavior = {
  params: spec({
    /** 1 = alternate + and × every volley. */
    alt: [1, 0, 1],
    /** 1 = start with the × pattern. */
    diag: [0, 0, 1],
  }),
  fire(w, e, a) {
    const p = a.p;
    let diag = p.diag! > 0;
    if (p.alt! > 0 && (e.volleys & 1) === 1) diag = !diag;
    const off = diag ? Math.PI / 4 : 0;
    for (let i = 0; i < 4; i++) shoot(w, e, a, off + i * (Math.PI / 2));
    volley(w, e, a, 4);
  },
};

// ── ringN: a ring of N shots (ring of 8 by default), optionally rotating per volley ──
const ringN: AttackBehavior = {
  params: spec({
    count: [8, 3, 24],
    /** Degrees the ring turns each volley. */
    spin: [0, -90, 90],
    /** 1 = one shot points straight at the target. */
    aim: [0, 0, 1],
  }),
  fire(w, e, a) {
    const p = a.p;
    const n = p.count!;
    const off = (p.aim! > 0 ? aimAngle(w, e) : 0) + e.volleys * p.spin! * DEG;
    for (let i = 0; i < n; i++) shoot(w, e, a, off + (i / n) * TAU);
    volley(w, e, a, n);
  },
};

// ── spreadFan: a fan of shots centred on the target ─────────────────────────
const spreadFan: AttackBehavior = {
  params: spec({
    count: [3, 2, 9],
    /** Total fan width, degrees. */
    spread: [40, 5, 180],
  }),
  fire(w, e, a) {
    const p = a.p;
    const n = p.count!;
    const base = aimAngle(w, e);
    const step = n > 1 ? (p.spread! * DEG) / (n - 1) : 0;
    for (let i = 0; i < n; i++) shoot(w, e, a, base - (p.spread! * DEG) / 2 + i * step);
    volley(w, e, a, n);
  },
};

// ── burst: several aimed shots in quick succession (re-aimed each shot) ─────────
const burst: AttackBehavior = {
  params: spec({
    count: [3, 2, 8],
    /** Seconds between shots. */
    interval: [0.12, 0.04, 0.5],
    /** Random aim wobble per shot, degrees. */
    jitter: [4, 0, 30],
  }),
  fire(w, e, a) {
    const p = a.p;
    if (e.burstLeft <= 0 || e.burstA !== a) {
      e.burstLeft = p.count!;
      e.burstA = a;
    }
    const j = (w.combatRng.next() - 0.5) * 2 * p.jitter! * DEG;
    shoot(w, e, a, aimAngle(w, e) + j);
    volley(w, e, a, 1);
    e.burstLeft--;
    e.burstT = p.interval!;
    if (e.burstLeft <= 0) e.burstA = null;
  },
};

// ── lob: arcing shot(s) that land on the target's spot (marker shown), splash / creep / split ──
const lob: AttackBehavior = {
  params: spec({
    /** Flight time, s. */
    air: [0.9, 0.3, 2],
    /** Apex height, px. */
    height: [28, 6, 80],
    /** Random landing offset, px. */
    scatter: [8, 0, 40],
    /** Landing splash radius, px. */
    splash: [10, 4, 40],
    /** 1 = leaves a creep puddle where it lands. */
    creep: [0, 0, 1],
    /** Ring of this many small shots on landing. */
    split: [0, 0, 12],
    count: [1, 1, 4],
  }),
  fire(w, e, a) {
    const p = a.p;
    const rng = w.combatRng;
    const n = p.count!;
    const baseX = e.hasTgt ? e.tgtX : e.x;
    const baseY = e.hasTgt ? e.tgtY : e.y;
    for (let i = 0; i < n; i++) {
      const ang = rng.next() * TAU;
      const d = (i === 0 ? 0.3 : 1) * p.scatter! * rng.next() + (i === 0 ? 0 : p.scatter! * 0.5);
      const s = spawnLob(
        w,
        e.x,
        e.y,
        baseX + Math.cos(ang) * d,
        baseY + Math.sin(ang) * d,
        p.air!,
        p.height!,
        p.dmg!,
        p.size!,
        a.style,
        allied(e),
        e.uid,
      );
      if (s) {
        s.splash = p.splash!;
        s.creep = p.creep!;
        s.split = p.split!;
      }
    }
    w.events.emit('enemyLob', e.x, e.y, n, a.style, e.def.id);
  },
};

// ── spawnMinion: calls in helpers (capped per spawner) ────────────────────────
const spawnMinion: AttackBehavior = {
  params: spec(
    {
      count: [1, 1, 4],
      /** Most of its minions alive at once. */
      max: [3, 1, 8],
      /** Spawn distance from the spawner, px. */
      dist: [12, 0, 40],
    },
    false,
  ),
  fire(w, e, a) {
    const def = a.minion;
    if (!def) return;
    let alive = 0;
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (!o.dead && o.parent === e.uid) alive++;
    }
    const p = a.p;
    const n = Math.min(p.count!, p.max! - alive);
    const rng = w.combatRng;
    for (let i = 0; i < n; i++) {
      let x = e.x;
      let y = e.y;
      for (let t = 0; t < 6; t++) {
        const ang = rng.next() * TAU;
        const cx = e.x + Math.cos(ang) * p.dist!;
        const cy = e.y + Math.sin(ang) * p.dist!;
        if (walkableAt(w, cx, cy, def.radius) || def.flying) {
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
  },
};

// ── landShockwave: an expanding ring along the ground (hop landings by default) ──
const landShockwave: AttackBehavior = {
  params: {
    ...ATTACK_COMMON,
    windup: [0, 0, 2],
    on: [1, 0, 4],
    /** Final radius, px. */
    radius: [44, 12, 120],
    /** Expansion speed, px/s. */
    speed: [130, 40, 300],
    dmg: [1, 1, 4],
    /** Thickness of the hurting ring, px. */
    band: [5, 2, 12],
  },
  fire(w, e, a) {
    const p = a.p;
    spawnWave(w, e.x, e.y, p.radius!, p.speed!, p.dmg!, p.band!, allied(e));
  },
};

// ── leaveTrail: drops damaging creep puddles (passive, on its cooldown) ─────────
const leaveTrail: AttackBehavior = {
  passive: true,
  params: {
    ...ATTACK_COMMON,
    windup: [0, 0, 0],
    /** Puddle radius, px. */
    radius: [7, 3, 20],
    /** Seconds a puddle lasts. */
    life: [3, 0.5, 10],
    dmg: [1, 1, 2],
    /** 1 = only while moving. */
    moving: [1, 0, 1],
  },
  fire(w, e, a) {
    const p = a.p;
    if (p.moving! > 0 && !e.moving) return;
    if (e.flying || e.z > 0 || e.burrowed) return;
    spawnCreep(w, e.x, e.y + 1, p.radius!, p.life!, p.dmg!, a.style, allied(e));
  },
};

export const ATTACKS: Readonly<Record<AttackKind, AttackBehavior>> = {
  aimedShot,
  cardinal4,
  ringN,
  spreadFan,
  burst,
  lob,
  spawnMinion,
  landShockwave,
  leaveTrail,
};
