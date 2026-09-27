/**
 * Movement behaviours (MOVE_KINDS). Each writes the velocity it wants into e.tvx / e.tvy (the common
 * integrator in update.ts accelerates toward it, adds knockback and resolves collisions), and may
 * run a small state machine in e.mode / e.modeT with scratch slots e.m0..m3.
 *
 * Fairness: every sudden move is telegraphed (hop crouch, dash wind-up, burrower rumble, teleport fade)
 * through `telegraph()`, which the renderer shows as a flash + squash.
 */

import { vec2 } from '../../../engine/math';
import { WALK_MODE } from '../../collision';
import { ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W, TILE } from '../../constants';
import { Tile } from '../../tiles';
import type { MoveKind } from '../../types';
import type { World } from '../../world';
import type { Enemy } from '../enemy';
import { lineClear } from '../pathfield';
import { triggerAttacks } from '../attackRunner';
import { bounce, lurk } from './ext-a';
import { EXT_B_MOVES } from './ext-b';
import {
  ON_APPEAR,
  ON_BONK,
  ON_EMERGE,
  ON_LAND,
  feared,
  goalDir,
  inRoom,
  randomSpotNear,
  telegraph,
  walkableAt,
  type MoveBehavior,
  type Params,
} from './common';

const TAU = Math.PI * 2;
const scratch = vec2();

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function toward(e: Enemy, x: number, y: number, spd: number): number {
  const dx = x - e.x;
  const dy = y - e.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 1e-4) {
    e.tvx = (dx / d) * spd;
    e.tvy = (dy / d) * spd;
  } else {
    stop(e);
  }
  return d;
}

// ── idle ─────────────────────────────────────────────────────────────────────
const idle: MoveBehavior = {
  params: {},
  update(_w, e) {
    stop(e);
  },
};

// ── wander: stroll to random nearby spots, pause, repeat ────────────────────────
const wander: MoveBehavior = {
  params: {
    /** Pause between strolls (s). */
    pause: [0.8, 0, 5],
    /** Stroll length (px). */
    dist: [36, 8, 160],
    /** Speed factor while strolling. */
    walk: [1, 0.1, 2],
  },
  init(w, e, p) {
    e.mode = 0;
    e.modeT = w.combatRng.next() * p.pause!;
  },
  update(w, e, p, dt, spd) {
    if (e.mode === 0) {
      stop(e);
      e.modeT -= dt;
      if (e.modeT > 0) return;
      const rng = w.combatRng;
      for (let i = 0; i < 6; i++) {
        const a = rng.next() * TAU;
        const d = p.dist! * (0.5 + rng.next() * 0.5);
        const x = e.x + Math.cos(a) * d;
        const y = e.y + Math.sin(a) * d;
        if (walkableAt(w, x, y, e.r)) {
          e.tx = x;
          e.ty = y;
          e.mode = 1;
          e.modeT = 2.5;
          return;
        }
      }
      e.modeT = 0.3;
      return;
    }
    e.modeT -= dt;
    const d = toward(e, e.tx, e.ty, spd * p.walk!);
    if (d < 2 || e.modeT <= 0 || (e.blocked && e.age > 0.5 && e.modeT < 2.3)) {
      e.mode = 0;
      e.modeT = p.pause! * (0.6 + w.combatRng.next() * 0.8);
    }
  },
};

// ── chase: straight at the target ────────────────────────────────────────────
const chase: MoveBehavior = {
  params: {},
  update(w, e, _p, _dt, spd) {
    const d = goalDir(w, e);
    if (d === Infinity || d < 1) {
      stop(e);
      return;
    }
    e.tvx = e.dirX * spd;
    e.tvy = e.dirY * spd;
  },
};

// ── chasePath: flow field around rocks and pits, straight when the way is clear ──
const chasePath: MoveBehavior = {
  params: {
    /** Ticks between flow-field refreshes (shared per room). */
    recalc: [10, 2, 60],
  },
  update(w, e, p, dt, spd) {
    if (!e.hasTgt) {
      stop(e);
      return;
    }
    // Charmed rats hunt enemies directly (the shared field points at the player).
    const charmedTarget = !e.tgtPlayer;
    // Line-of-sight is re-checked a few times a second (cached in m0/m1).
    e.m1 -= dt;
    if (e.m1 <= 0) {
      e.m1 = 0.12;
      e.m0 = lineClear(w.room, e.x, e.y, e.tgtX, e.tgtY, e.r * 0.9, WALK_MODE) ? 1 : 0;
    }
    if (e.m0 === 1 || charmedTarget) {
      toward(e, e.tgtX, e.tgtY, spd);
      return;
    }
    w.flow.refresh(w.room, w.tick, e.tgtX, e.tgtY, p.recalc!);
    if (w.flow.dirAt(e.x, e.y, scratch)) {
      e.tvx = scratch.x * spd;
      e.tvy = scratch.y * spd;
      e.dirX = scratch.x;
      e.dirY = scratch.y;
    } else {
      toward(e, e.tgtX, e.tgtY, spd);
    }
  },
};

// ── hop: rest → crouch (telegraph) → arcing jump (airborne) → land (ON_LAND attacks) ──
const hop: MoveBehavior = {
  handlesFear: true,
  params: {
    rest: [0.7, 0, 5],
    /** Crouch before the jump (the telegraph), s. */
    crouch: [0.25, 0.05, 1.5],
    /** Time in the air, s. */
    air: [0.45, 0.15, 1.5],
    /** Longest jump, px. */
    dist: [42, 8, 120],
    /** Apex height, px. */
    height: [14, 2, 48],
    /** Chance each jump heads for the target (else a random direction). */
    aim: [0.8, 0, 1],
  },
  init(w, e, p) {
    e.mode = 0;
    e.modeT = p.rest! * (0.3 + w.combatRng.next() * 0.7);
  },
  update(w, e, p, dt) {
    if (e.mode === 0) {
      stop(e);
      e.modeT -= dt;
      if (e.modeT > 0) return;
      // Choose the landing spot now (so the crouch telegraphs a committed jump).
      const rng = w.combatRng;
      let d = goalDir(w, e);
      let dx: number;
      let dy: number;
      if ((d !== Infinity && rng.next() < p.aim!) || feared(e)) {
        const j = (rng.next() - 0.5) * 0.6;
        const c = Math.cos(j);
        const s = Math.sin(j);
        dx = e.dirX * c - e.dirY * s;
        dy = e.dirX * s + e.dirY * c;
      } else {
        const a = rng.next() * TAU;
        dx = Math.cos(a);
        dy = Math.sin(a);
        d = Infinity;
      }
      // Don't sail far past the target when hunting it.
      const len = feared(e) ? p.dist! : Math.min(p.dist!, d === Infinity ? p.dist! : d + 6);
      e.tx = e.x;
      e.ty = e.y;
      for (let f = 1; f > 0.1; f -= 0.25) {
        const x = e.x + dx * len * f;
        const y = e.y + dy * len * f;
        if (walkableAt(w, x, y, e.r)) {
          e.tx = x;
          e.ty = y;
          break;
        }
      }
      e.mode = 1;
      e.modeT = p.crouch!;
      telegraph(e, p.crouch!);
      return;
    }
    if (e.mode === 1) {
      stop(e);
      e.modeT -= dt;
      if (e.modeT > 0) return;
      e.mode = 2;
      e.modeT = 0;
      e.m0 = e.x;
      e.m1 = e.y;
      w.events.emit('enemyHop', e.x, e.y, e.r, 0, e.def.id);
    }
    // Airborne: straight over the ground, parabolic height.
    const air = p.air!;
    e.modeT += dt;
    const t = Math.min(1, e.modeT / air);
    e.tvx = (e.tx - e.m0) / air;
    e.tvy = (e.ty - e.m1) / air;
    e.snap = true;
    e.z = 4 * p.height! * t * (1 - t);
    if (t >= 1) {
      e.z = 0;
      e.tvx = e.tvy = 0;
      e.vx = e.vy = 0;
      e.mode = 0;
      e.modeT = p.rest! * (0.7 + w.combatRng.next() * 0.6);
      w.events.emit('enemyLand', e.x, e.y, e.r, 0, e.def.id);
      triggerAttacks(w, e, ON_LAND);
    }
  },
};

// ── dash: roam / line up → wind-up (telegraph) → straight charge → bonk on walls ──
const dash: MoveBehavior = {
  params: {
    /** 0 = aimed at the target, 1 = horizontal only (sidesteppers), 2 = vertical only. */
    axis: [0, 0, 2],
    /** Axis modes: how closely it must line up with the target first (px). */
    align: [10, 2, 60],
    windup: [0.45, 0.1, 2],
    dashSpeed: [220, 60, 400],
    /** Longest charge, s. */
    maxTime: [1.2, 0.2, 4],
    /** Dazed after hitting a wall, s. */
    stun: [0.6, 0, 3],
    /** Minimum time between charges, s. */
    rest: [0.9, 0, 6],
    /** Speed factor while roaming. */
    walk: [0.5, 0, 2],
  },
  init(w, e, p) {
    e.mode = 0;
    e.modeT = p.rest! * w.combatRng.next();
  },
  update(w, e, p, dt, spd) {
    const axis = p.axis!;
    if (e.mode === 0) {
      e.modeT -= dt;
      if (!e.hasTgt) {
        stop(e);
        return;
      }
      const dx = e.tgtX - e.x;
      const dy = e.tgtY - e.y;
      let aligned: boolean;
      // Axis movers blocked while lining up side-step along the other axis for a moment (m2).
      if (e.blocked && axis !== 0 && e.m2 <= 0) e.m2 = 0.5 + w.combatRng.next() * 0.4;
      if (e.m2 > 0) e.m2 -= dt;
      if (axis === 1) {
        // Scuttle up/down to line up with the target's row, then charge sideways.
        if (e.m2 > 0) {
          e.tvx = (dx >= 0 ? 1 : -1) * spd * p.walk!;
          e.tvy = 0;
        } else {
          e.tvx = 0;
          e.tvy = Math.abs(dy) > 2 ? Math.sign(dy) * spd * p.walk! : 0;
        }
        aligned = Math.abs(dy) < p.align!;
      } else if (axis === 2) {
        if (e.m2 > 0) {
          e.tvx = 0;
          e.tvy = (dy >= 0 ? 1 : -1) * spd * p.walk!;
        } else {
          e.tvx = Math.abs(dx) > 2 ? Math.sign(dx) * spd * p.walk! : 0;
          e.tvy = 0;
        }
        aligned = Math.abs(dx) < p.align!;
      } else {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1e-4) {
          e.tvx = (dx / d) * spd * p.walk!;
          e.tvy = (dy / d) * spd * p.walk!;
        }
        aligned = d < 140;
      }
      if (aligned && e.modeT <= 0) {
        if (axis === 1) {
          e.dirX = dx >= 0 ? 1 : -1;
          e.dirY = 0;
        } else if (axis === 2) {
          e.dirX = 0;
          e.dirY = dy >= 0 ? 1 : -1;
        } else {
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          e.dirX = dx / d;
          e.dirY = dy / d;
        }
        e.mode = 1;
        e.modeT = p.windup!;
        telegraph(e, p.windup!);
        w.events.emit('enemyWindup', e.x, e.y, 1, 0, e.def.id);
      }
      return;
    }
    if (e.mode === 1) {
      stop(e);
      e.modeT -= dt;
      if (e.modeT <= 0) {
        e.mode = 2;
        e.modeT = p.maxTime!;
        w.events.emit('enemyDash', e.x, e.y, e.dirX, e.dirY, e.def.id);
      }
      return;
    }
    if (e.mode === 2) {
      e.tvx = e.dirX * p.dashSpeed!;
      e.tvy = e.dirY * p.dashSpeed!;
      e.snap = true;
      e.modeT -= dt;
      // Bonk: last tick's collision pushed straight against the charge.
      if (e.blocked && e.dirX * e.wallNX + e.dirY * e.wallNY < -0.5) {
        e.mode = 3;
        e.modeT = p.stun!;
        e.vx = e.vy = 0;
        e.tvx = e.tvy = 0;
        e.kx = -e.dirX * 60;
        e.ky = -e.dirY * 60;
        w.events.emit('bonk', e.x + e.dirX * e.r, e.y + e.dirY * e.r, e.r, 0, e.def.id);
        triggerAttacks(w, e, ON_BONK);
        return;
      }
      if (e.modeT <= 0) {
        e.mode = 0;
        e.modeT = p.rest!;
      }
      return;
    }
    // Dazed.
    stop(e);
    e.modeT -= dt;
    if (e.modeT <= 0) {
      e.mode = 0;
      e.modeT = p.rest!;
    }
  },
};

// ── orbitPlayer: circle the target at a set radius ────────────────────────────
const orbitPlayer: MoveBehavior = {
  params: {
    radius: [48, 16, 120],
    /** Angular speed, rad/s. */
    spin: [1.6, 0.2, 6],
    /** 1 clockwise, -1 counter-clockwise, 0 random. */
    dir: [1, -1, 1],
  },
  init(w, e, p) {
    e.m1 = p.dir! === 0 ? w.combatRng.sign() : Math.sign(p.dir!);
    e.m2 = 0;
  },
  update(_w, e, p, dt, spd) {
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
    const gx = e.tgtX + Math.cos(e.m0) * p.radius!;
    const gy = e.tgtY + Math.sin(e.m0) * p.radius!;
    const dx = gx - e.x;
    const dy = gy - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const s = Math.min(spd * 1.2, d * 5);
    if (d > 1e-4) {
      e.tvx = (dx / d) * s;
      e.tvy = (dy / d) * s;
    } else {
      stop(e);
    }
  },
};

// ── keepDistance: the kiter — backs off when close, closes in when far, strafes between ──
const keepDistance: MoveBehavior = {
  params: {
    min: [40, 0, 200],
    max: [80, 10, 240],
    /** Strafe speed factor inside the comfort band. */
    strafe: [0.6, 0, 1.5],
    /** Seconds between strafe direction flips. */
    flip: [1.6, 0.2, 8],
  },
  init(w, e, p) {
    e.m1 = w.combatRng.sign();
    e.m0 = p.flip! * w.combatRng.next();
  },
  update(w, e, p, dt, spd) {
    if (!e.hasTgt) {
      stop(e);
      return;
    }
    const dx = e.tgtX - e.x;
    const dy = e.tgtY - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    e.m0 -= dt;
    if (e.m0 <= 0 || (e.blocked && e.m0 < p.flip! * 0.5)) {
      e.m1 = -e.m1;
      e.m0 = p.flip! * (0.7 + w.combatRng.next() * 0.6);
    }
    if (d < p.min!) {
      // Back off, sliding sideways a little so corners don't trap it.
      e.tvx = (-ux + -uy * e.m1 * 0.4) * spd;
      e.tvy = (-uy + ux * e.m1 * 0.4) * spd;
    } else if (d > p.max!) {
      e.tvx = ux * spd;
      e.tvy = uy * spd;
    } else {
      e.tvx = -uy * e.m1 * spd * p.strafe!;
      e.tvy = ux * e.m1 * spd * p.strafe!;
    }
  },
};

// ── burrow: tunnel under the floor toward the target, rumble, surface (ON_EMERGE), dig back in ──

/** Seconds past its tunnel time before a burrower stuck under something heads for open floor. */
const BURROW_OVERDUE = 0.75;
/** Seconds past its tunnel time before it is simply moved onto that floor and surfaces (never stays down). */
const BURROW_GIVE_UP = 4;

const bfsQueue = new Int16Array(ROOM_COLS * ROOM_ROWS);
const bfsSeen = new Uint8Array(ROOM_COLS * ROOM_ROWS);

function cellX(c: number): number {
  return (c % ROOM_COLS) * TILE + TILE / 2;
}

function cellY(c: number): number {
  return Math.floor(c / ROOM_COLS) * TILE + TILE / 2;
}

/** A burrower of radius r may come up in the middle of cell c. */
function surfaceOk(w: World, c: number, r: number): boolean {
  return walkableAt(w, cellX(c), cellY(c), r);
}

/**
 * The cell a stuck burrower heads for: breadth-first over the room grid from its own cell (it tunnels under
 * everything, so every neighbour is a step), taking the first ring that holds a cell it can surface on and,
 * within that ring, the one nearest in a straight line (lowest index on ties). Falls back to the nearest plain
 * Floor cell (a body too big for any cell), then -1. Deterministic, no allocation.
 */
function surfaceCell(w: World, e: Enemy): number {
  const room = w.room;
  const col0 = Math.min(ROOM_COLS - 1, Math.max(0, Math.floor(e.x / TILE)));
  const row0 = Math.min(ROOM_ROWS - 1, Math.max(0, Math.floor(e.y / TILE)));
  bfsSeen.fill(0);
  let head = 0;
  let tail = 0;
  const start = row0 * ROOM_COLS + col0;
  bfsQueue[tail++] = start;
  bfsSeen[start] = 1;
  let floorBest = -1;
  while (head < tail) {
    // One whole ring at a time, so "nearest" means fewest steps first, then straight-line distance.
    const ringEnd = tail;
    let best = -1;
    let bestD = Infinity;
    for (let i = head; i < ringEnd; i++) {
      const c = bfsQueue[i]!;
      if (surfaceOk(w, c, e.r)) {
        const dx = cellX(c) - e.x;
        const dy = cellY(c) - e.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD || (d2 === bestD && c < best)) {
          bestD = d2;
          best = c;
        }
      } else if (floorBest < 0 && room.get(c % ROOM_COLS, Math.floor(c / ROOM_COLS)) === Tile.Floor) {
        floorBest = c;
      }
    }
    if (best >= 0) return best;
    for (let i = head; i < ringEnd; i++) {
      const c = bfsQueue[i]!;
      const col = c % ROOM_COLS;
      const row = (c - col) / ROOM_COLS;
      if (col > 0 && !bfsSeen[c - 1]) {
        bfsSeen[c - 1] = 1;
        bfsQueue[tail++] = c - 1;
      }
      if (col < ROOM_COLS - 1 && !bfsSeen[c + 1]) {
        bfsSeen[c + 1] = 1;
        bfsQueue[tail++] = c + 1;
      }
      if (row > 0 && !bfsSeen[c - ROOM_COLS]) {
        bfsSeen[c - ROOM_COLS] = 1;
        bfsQueue[tail++] = c - ROOM_COLS;
      }
      if (row < ROOM_ROWS - 1 && !bfsSeen[c + ROOM_COLS]) {
        bfsSeen[c + ROOM_COLS] = 1;
        bfsQueue[tail++] = c + ROOM_COLS;
      }
    }
    head = ringEnd;
  }
  return floorBest;
}

/** Rumble + telegraph, then it comes up (mode 1). */
function beginSurfacing(w: World, e: Enemy, p: Params): void {
  e.mode = 1;
  e.modeT = p.rise!;
  e.surfCell = -1;
  telegraph(e, p.rise!);
  w.events.emit('burrow', e.x, e.y, 1, e.r, e.def.id);
}

const burrow: MoveBehavior = {
  handlesFear: true,
  params: {
    /** Seconds underground per tunnel. */
    under: [1.6, 0.3, 6],
    /** Seconds surfaced. */
    above: [1.8, 0.3, 6],
    /** Surfaces early this close to the target (px). */
    near: [24, 0, 120],
    /** Rumble telegraph before surfacing, s. */
    rise: [0.5, 0.1, 2],
    /** Sinking animation, s. */
    dig: [0.35, 0.1, 2],
    /** Speed factor underground. */
    tunnel: [1.2, 0.2, 3],
  },
  init(_w, e, p) {
    e.mode = 2;
    e.modeT = p.above! * 0.6;
    e.burrowed = false;
  },
  update(w, e, p, dt, spd) {
    switch (e.mode) {
      case 0: {
        e.burrowed = true;
        const d = goalDir(w, e);
        if (e.modeT < -BURROW_OVERDUE && !walkableAt(w, e.x, e.y, e.r)) {
          // Overdue under a rock / pit (its target stands where it can't come up): tunnel for the nearest cell
          // it can come up on (cached until it surfaces), so it never stays down for good. The room's middle
          // used to be the goal, but many templates put a rock or a barrel right there.
          let c = e.surfCell;
          if (c < 0 || !surfaceOk(w, c, e.r)) c = e.surfCell = surfaceCell(w, e);
          const sx = c >= 0 ? cellX(c) : ROOM_W / 2;
          const sy = c >= 0 ? cellY(c) : ROOM_H / 2;
          if (e.modeT < -BURROW_GIVE_UP && c >= 0) {
            // Hard cap: still stuck (pushed about, a prop dropped on its spot…) — pop out on that cell now.
            e.x = e.prevX = sx;
            e.y = e.prevY = sy;
            e.vx = e.vy = e.kx = e.ky = 0;
            stop(e);
            beginSurfacing(w, e, p);
            break;
          }
          toward(e, sx, sy, spd * p.tunnel!);
        } else if (d !== Infinity) {
          e.tvx = e.dirX * spd * p.tunnel!;
          e.tvy = e.dirY * spd * p.tunnel!;
        } else {
          stop(e);
        }
        e.modeT -= dt;
        // Underground it passes under rocks and pits, but it can only surface on open floor.
        if ((e.modeT <= 0 || (!feared(e) && d < p.near!)) && walkableAt(w, e.x, e.y, e.r)) beginSurfacing(w, e, p);
        break;
      }
      case 1:
        stop(e);
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.mode = 2;
          e.modeT = p.above!;
          e.burrowed = false;
          w.events.emit('burrow', e.x, e.y, 2, e.r, e.def.id);
          triggerAttacks(w, e, ON_EMERGE);
        }
        break;
      case 2:
        stop(e);
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.mode = 3;
          e.modeT = p.dig!;
          telegraph(e, p.dig!);
        }
        break;
      default:
        stop(e);
        e.modeT -= dt;
        if (e.modeT <= 0) {
          e.mode = 0;
          e.modeT = p.under!;
          e.burrowed = true;
          e.windAtk = -1;
          w.events.emit('burrow', e.x, e.y, 0, e.r, e.def.id);
        }
        break;
    }
  },
};

// ── teleport: fade out (telegraph + destination marker), blink, fade in (ON_APPEAR) ──
const teleport: MoveBehavior = {
  handlesFear: true,
  params: {
    /** Seconds between blinks. */
    interval: [2.4, 0.5, 8],
    /** Fade-out telegraph, s. */
    fade: [0.45, 0.1, 2],
    /** Fade-in (intangible), s. */
    appear: [0.3, 0.05, 1.5],
    /** Destination distance from the player (px). */
    min: [40, 0, 200],
    max: [96, 16, 240],
    /** Speed factor while visible (0 = stands still). */
    drift: [0, 0, 1],
  },
  init(w, e, p) {
    e.mode = 0;
    e.modeT = p.interval! * (0.5 + w.combatRng.next() * 0.5);
  },
  update(w, e, p, dt, spd) {
    if (e.mode === 0) {
      e.hidden = false;
      if (p.drift! > 0 && goalDir(w, e) !== Infinity) {
        e.tvx = e.dirX * spd * p.drift!;
        e.tvy = e.dirY * spd * p.drift!;
      } else {
        stop(e);
      }
      // Frightened teleporters blink away sooner.
      e.modeT -= feared(e) ? dt * 2 : dt;
      if (e.modeT > 0) return;
      const pl = w.player;
      const minD = feared(e) ? p.max! : p.min!;
      if (!randomSpotNear(w, e, pl.x, pl.y, minD, Math.max(minD + 16, p.max!), 24)) {
        e.tx = e.x;
        e.ty = e.y;
      }
      e.mode = 1;
      e.modeT = p.fade!;
      telegraph(e, p.fade!);
      w.events.emit('blink', e.x, e.y, 0, e.r, e.def.id);
      return;
    }
    stop(e);
    e.modeT -= dt;
    if (e.mode === 1) {
      if (e.modeT > 0) return;
      e.x = e.prevX = e.tx;
      e.y = e.prevY = e.ty;
      e.vx = e.vy = e.kx = e.ky = 0;
      e.hidden = true;
      e.mode = 2;
      e.modeT = p.appear!;
      w.events.emit('blink', e.x, e.y, 1, e.r, e.def.id);
      return;
    }
    if (e.modeT > 0) return;
    e.hidden = false;
    e.mode = 0;
    e.modeT = p.interval! * (0.8 + w.combatRng.next() * 0.4);
    triggerAttacks(w, e, ON_APPEAR);
  },
};

// ── wallCrawl: clings to the room's edge, sliding along it toward the target ──
/** Perimeter of the inset rectangle a crawler of inset `m` moves on. */
function perimeter(m: number): number {
  return 2 * (ROOM_W - 2 * m) + 2 * (ROOM_H - 2 * m);
}

/** Point at perimeter distance s (clockwise from the top-left corner) → scratch. */
function perimeterPoint(s: number, m: number): void {
  const w = ROOM_W - 2 * m;
  const h = ROOM_H - 2 * m;
  const P = 2 * (w + h);
  s = ((s % P) + P) % P;
  if (s < w) {
    scratch.x = m + s;
    scratch.y = m;
  } else if (s < w + h) {
    scratch.x = m + w;
    scratch.y = m + (s - w);
  } else if (s < 2 * w + h) {
    scratch.x = m + w - (s - w - h);
    scratch.y = m + h;
  } else {
    scratch.x = m;
    scratch.y = m + h - (s - 2 * w - h);
  }
}

/** Perimeter distance of the edge point closest to (x, y). */
function perimeterProject(x: number, y: number, m: number): number {
  const w = ROOM_W - 2 * m;
  const h = ROOM_H - 2 * m;
  const cx = Math.min(m + w, Math.max(m, x));
  const cy = Math.min(m + h, Math.max(m, y));
  const dTop = y - m;
  const dBottom = m + h - y;
  const dLeft = x - m;
  const dRight = m + w - x;
  const best = Math.min(dTop, dBottom, dLeft, dRight);
  if (best === dTop) return cx - m;
  if (best === dRight) return w + (cy - m);
  if (best === dBottom) return w + h + (m + w - cx);
  return 2 * w + h + (m + h - cy);
}

const wallCrawl: MoveBehavior = {
  pinned: true,
  noCollide: true,
  handlesFear: true,
  params: {
    /** Extra distance from the wall (px). */
    hug: [0, 0, 8],
  },
  init(_w, e, p) {
    const m = e.r + p.hug!;
    e.m0 = perimeterProject(e.x, e.y, m);
    perimeterPoint(e.m0, m);
    e.x = e.prevX = scratch.x;
    e.y = e.prevY = scratch.y;
  },
  update(w, e, p, dt, spd) {
    stop(e);
    const m = e.r + p.hug!;
    const P = perimeter(m);
    let target = e.m0;
    if (e.hasTgt) target = perimeterProject(e.tgtX, e.tgtY, m);
    if (feared(e)) target = perimeterProject(w.player.x, w.player.y, m) + P / 2;
    let delta = (((target - e.m0) % P) + P) % P;
    if (delta > P / 2) delta -= P;
    const step = Math.max(-spd * dt, Math.min(spd * dt, delta));
    e.m0 = (((e.m0 + step) % P) + P) % P;
    perimeterPoint(e.m0, m);
    const mx = scratch.x - e.x;
    e.x = scratch.x;
    e.y = scratch.y;
    e.moving = Math.abs(step) > 0.05;
    if (Math.abs(mx) > 0.05) e.face = mx > 0 ? 1 : -1;
  },
};

// ── float: flying sine drift (crosses pits and rocks) ─────────────────────────
const float: MoveBehavior = {
  flying: true,
  params: {
    /** Side-to-side weave strength (fraction of speed). */
    wobble: [0.7, 0, 2],
    /** Weave frequency, Hz. */
    freq: [0.5, 0.05, 4],
    /** 1 = homes on the target, 0 = aimless drifting. */
    drift: [1, 0, 1],
  },
  init(w, e) {
    e.m0 = w.combatRng.next() * TAU;
    e.m1 = w.combatRng.next() * TAU;
  },
  update(w, e, p, dt, spd) {
    let dx: number;
    let dy: number;
    const d = goalDir(w, e);
    if (d !== Infinity && p.drift! > 0) {
      dx = e.dirX * p.drift!;
      dy = e.dirY * p.drift!;
    } else {
      e.m1 += (w.combatRng.next() - 0.5) * 3 * dt;
      dx = Math.cos(e.m1);
      dy = Math.sin(e.m1);
      // Turn back from the walls.
      if (!inRoom(e.x + dx * 12, e.y + dy * 12, e.r)) e.m1 += Math.PI * dt * 4;
    }
    const s = Math.sin(e.age * p.freq! * TAU + e.m0) * p.wobble!;
    const vx = dx - dy * s;
    const vy = dy + dx * s;
    const l = Math.sqrt(vx * vx + vy * vy) || 1;
    e.tvx = (vx / l) * spd;
    e.tvy = (vy / l) * spd;
  },
};

// ── turret: never moves; pinned ────────────────────────────────────────────
const turret: MoveBehavior = {
  pinned: true,
  handlesFear: true,
  params: {},
  update(_w, e) {
    stop(e);
    if (e.hasTgt) e.face = e.tgtX >= e.x ? 1 : -1;
  },
};

export const MOVES: Readonly<Record<MoveKind, MoveBehavior>> = {
  idle,
  wander,
  chase,
  chasePath,
  hop,
  dash,
  orbitPlayer,
  keepDistance,
  burrow,
  teleport,
  wallCrawl,
  float,
  turret,
  bounce,
  lurk,
  ...EXT_B_MOVES,
};
