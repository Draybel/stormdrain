/**
 * Beams (§4.3): the Storm Lance, lasers, the lance's feathered sub-beams and laser-rider side zaps.
 *
 * A beam has no body of its own: every tick its geometry is produced by TRACING a virtual projectile
 * (a ShotState cursor) from the origin in ≈4 px steps, running the profile's SAME motion hooks a
 * projectile would (homing bends, wavy wiggles, spiral curls, boomerang bends back into a U), and the
 * same wall hooks (bounce reflects). The result is a polyline (≤ 128 points per trace) that is both
 * collided and drawn. Split forks the trace at the first enemy on the path (child traces, depth ≤ 2).
 * Hit / expire hooks run at hit points, rate-limited per beam per target.
 *
 * Pooled (cap 48, `world.atk.beams`), fixed arrays, no allocation per tick.
 */

import type { Poolable } from '../../engine/pool';
import { NO_CELL, PHASE_MODE, SHOT_MODE, firstBlockingCell, type CollideMode } from '../collision';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../constants';
import { SRC_PLAYER, type Hittable } from '../hittable';
import type { RoomGrid } from '../room';
import { hitTileWithShot } from '../tileFx';
import { shotBreakable } from '../tiles';
import { ATTACK_TUNING } from '../tuning';
import type { World } from '../world';
import { bombBlastMul, bombBlastRadius, queueExplosion } from './impacts';
import type { AttackProfile } from './profile';
import { reflect, runExpireHooks, runHitHooks, runWallHooks } from './shot';
import { TARGET_CAP } from './targets';
import { F_CAUGHT, F_PHASE, OWN_PLAYER, SK_BEAM, ShotState, forgetHits, recentlyHit, rememberHit, type Anchor } from './state';
import type { ShotStyle } from './style';

/** Beam kinds. */
export const BK_LANCE = 0;
export const BK_LASER = 1;
/** Laser rider on the lance: thin feathered sub-beams beside it. */
export const BK_FEATHER = 2;
/** Laser rider on projectiles: a short zap from a shot to a nearby enemy. */
export const BK_SIDE = 3;

const T = ATTACK_TUNING;
const BUDGET = T.beamBudget;
const MAX_SEG = T.beamMaxSegments;
/** One rate-limit slot per target a snapshot can hold, so no target ever waits for (or steals) a slot. */
const HIT_SLOTS = TARGET_CAP;
const CELLS = ROOM_COLS * ROOM_ROWS;

export class Beam implements Poolable {
  alive = false;
  slot = 0;
  kind = BK_LASER;
  /** Follows this (player / familiar / blade); null = fixed origin (fx, fy). */
  anchor: Anchor | null = null;
  ownerKind = OWN_PLAYER;
  fx = 0;
  fy = 0;
  /** Aim angle at fire time, plus rotations: orbit ring, circle-first spin, melee-rider sweep. */
  ang = 0;
  orbitAng = 0;
  spinAng = 0;
  /** Melee rider: half-arc (rad) swept across over the beam's life (0 = none). */
  sweep = 0;
  spin = 1;
  /** Origin distance from the anchor along the beam (px, on top of the muzzle). */
  offset = 0;
  /** Current direction (rad) — what render and tests read. */
  dir = 0;
  age = 0;
  life = 0.5;
  ticks = 0;
  /** Full width (px) at the origin. */
  width = 12;
  /** Damage per damage tick. */
  dmg = 0;
  knock = 0;
  /** Ticks between two damage ticks on the same target. */
  every = 3;
  /** Non-damage hit hooks run on every Nth damage tick per target. */
  hookEvery = 3;
  maxLen = 512;
  /** Collision mode of the trace (lances pass rocks; lasers stop at them unless phasing). */
  mode: CollideMode = PHASE_MODE;
  scale = 1;
  vIndex = 0;
  profile: AttackProfile | null = null;
  style: ShotStyle | null = null;
  /** Bomb rider: explosions along the beam. */
  bomb = false;

  // ── Trace output (read by render) ──
  readonly px = new Float32Array(BUDGET);
  readonly py = new Float32Array(BUDGET);
  /** Width (px) at each point (grow / shrink shape the beam). */
  readonly pw = new Float32Array(BUDGET);
  n = 0;
  readonly segStart = new Int16Array(MAX_SEG);
  readonly segLen = new Int16Array(MAX_SEG);
  readonly segDepth = new Int8Array(MAX_SEG);
  nseg = 0;
  /** The main trace ended on a wall (sparks there) at (endX, endY). */
  endWall = false;
  endX = 0;
  endY = 0;
  /** Origin this tick. */
  ox = 0;
  oy = 0;

  // ── Rate limits ──
  readonly hitRefs: (Hittable | null)[] = new Array<Hittable | null>(HIT_SLOTS).fill(null);
  readonly hitNext = new Int32Array(HIT_SLOTS);
  readonly hitCnt = new Int32Array(HIT_SLOTS);
  /** Slots in use (0 .. hitUsed-1): lookups scan only these. */
  hitUsed = 0;
  readonly tileNext = new Int32Array(CELLS);
}

/**
 * Spawns a beam of `kind` with that kind's defaults from `profile` (the caller scales damage / width
 * afterwards). Anchored beams re-centre on the anchor every tick; `x, y` is the fixed origin of
 * unanchored ones. Returns null at the cap (the caller merges its damage elsewhere).
 */
export function spawnBeam(
  w: World,
  kind: number,
  profile: AttackProfile,
  anchor: Anchor | null,
  x: number,
  y: number,
  ang: number,
  scale: number,
): Beam | null {
  const b = w.atk.beams.alloc();
  if (!b) return null;
  b.kind = kind;
  b.anchor = anchor;
  b.ownerKind = OWN_PLAYER;
  b.fx = x;
  b.fy = y;
  b.ang = b.dir = ang;
  b.orbitAng = b.spinAng = 0;
  b.sweep = 0;
  b.spin = 1;
  b.offset = 0;
  b.age = 0;
  b.ticks = 0;
  b.scale = scale;
  b.vIndex = 0;
  b.profile = profile;
  b.style = profile.style;
  b.bomb = false;
  b.knock = profile.knockback * 0.6;
  b.maxLen = T.beamMaxPoints * T.beamStep;
  b.n = b.nseg = 0;
  b.endWall = false;
  b.endX = b.ox = x;
  b.endY = b.oy = y;
  b.hitRefs.fill(null);
  b.hitNext.fill(0);
  b.hitCnt.fill(0);
  b.hitUsed = 0;
  b.tileNext.fill(0);
  const s = Math.sqrt(scale);
  switch (kind) {
    case BK_LANCE:
      b.width = profile.lanceWidth * s;
      b.life = profile.lanceLife;
      b.dmg = profile.lanceTick * scale;
      b.every = T.lanceEvery;
      b.hookEvery = T.lanceHookEvery;
      b.mode = PHASE_MODE;
      b.knock = profile.knockback * 0.35;
      break;
    case BK_FEATHER:
      b.width = T.featherWidth * s;
      b.life = profile.lanceLife;
      b.dmg = profile.lanceTick * T.featherDamage * scale;
      b.every = T.lanceEvery + 1;
      b.hookEvery = T.lanceHookEvery;
      b.mode = PHASE_MODE;
      break;
    case BK_SIDE:
      b.width = 1.5;
      b.life = 0.1;
      b.dmg = profile.damage * T.sideLaserDamage * scale;
      b.every = 999;
      b.hookEvery = 1;
      b.mode = profile.phase ? PHASE_MODE : SHOT_MODE;
      b.maxLen = T.sideLaserRange;
      break;
    default:
      b.width = profile.laserWidth * s;
      b.life = profile.laserLife;
      b.dmg = profile.laserDamage * scale;
      b.every = 999;
      b.hookEvery = 1;
      b.mode = profile.phase ? PHASE_MODE : SHOT_MODE;
      break;
  }
  return b;
}

// ── Tracing ────────────────────────────────────────────────────────────────

/** The virtual projectile. */
const C = new ShotState();

/** This tick's trace allowance per beam (points) and step (px) — set by updateBeams. */
let allowPts: number = BUDGET;
let curStep: number = T.beamStep;
/** Hit-spark events left this tick. */
let sparksLeft = 0;

/** Pending forks (split): start point, heading, depth, the target that caused it. */
const FORK_CAP = 24;
const forkX = new Float64Array(FORK_CAP);
const forkY = new Float64Array(FORK_CAP);
const forkA = new Float64Array(FORK_CAP);
const forkD = new Int8Array(FORK_CAP);
const forkT: (Hittable | null)[] = new Array<Hittable | null>(FORK_CAP).fill(null);
let forkN = 0;

const nrm = { x: 0, y: 0 };
function traceNormal(room: RoomGrid, px: number, py: number, x: number, y: number, mode: CollideMode): void {
  const bx = firstBlockingCell(room, x, py, 1, mode) !== NO_CELL;
  const by = firstBlockingCell(room, px, y, 1, mode) !== NO_CELL;
  let nx = bx ? (x > px ? -1 : 1) : 0;
  let ny = by ? (y > py ? -1 : 1) : 0;
  if (!bx && !by) {
    nx = x > px ? -1 : 1;
    ny = y > py ? -1 : 1;
  }
  const l = Math.sqrt(nx * nx + ny * ny);
  nrm.x = nx / l;
  nrm.y = ny / l;
}

function push(b: Beam, x: number, y: number, wdt: number): void {
  const i = b.n;
  if (i >= BUDGET) return;
  b.px[i] = x;
  b.py[i] = y;
  b.pw[i] = wdt;
  b.n = i + 1;
}

function beamTileHit(w: World, b: Beam, cell: number): void {
  if (b.tileNext[cell]! > w.tick) return;
  b.tileNext[cell] = w.tick + (b.kind === BK_LANCE ? 12 : 999);
  hitTileWithShot(w, cell);
}

/** Damage tick on a target, rate-limited per beam per target; hooks on every `hookEvery`th tick. */
function beamHit(w: World, b: Beam, h: Hittable): void {
  const tick = w.tick;
  let slot = -1;
  const used = b.hitUsed;
  for (let i = 0; i < used; i++) {
    if (b.hitRefs[i] === h) {
      slot = i;
      break;
    }
  }
  if (slot >= 0) {
    if (b.hitNext[slot]! > tick) return;
  } else {
    // A new target gets its own slot (never another target's: evicting a live one would reset its rate
    // limit and let it be hit again at once — a crowd would take a hit every tick). Slots of targets
    // that died are reused.
    if (used < HIT_SLOTS) {
      slot = used;
      b.hitUsed = used + 1;
    } else {
      for (let i = 0; i < HIT_SLOTS; i++) {
        const r = b.hitRefs[i]!;
        if (r === null || !r.hittable) {
          slot = i;
          break;
        }
      }
      if (slot < 0) return;
    }
    b.hitRefs[slot] = h;
    b.hitCnt[slot] = 0;
  }
  b.hitNext[slot] = tick + b.every;
  const cnt = ++b.hitCnt[slot]!;
  const th = C.ang + C.angOff;
  h.hurt(C.damage, SRC_PLAYER, Math.cos(th) * C.knock, Math.sin(th) * C.knock);
  if ((cnt - 1) % b.hookEvery === 0) runHitHooks(w, C, h);
  if (b.kind === BK_LANCE && (cnt & 1) === 1 && sparksLeft > 0) {
    sparksLeft--;
    w.events.emit('beamHit', h.x, h.y - h.r, C.damage, b.kind);
  }
}

/** Traces one polyline segment from (ox, oy) heading `dir`. */
function traceSegment(
  w: World,
  b: Beam,
  ox: number,
  oy: number,
  dir: number,
  depth: number,
  maxPoints: number,
  maxLen: number,
  dmgMul: number,
  sizeMul: number,
  ignore: Hittable | null,
): void {
  if (b.nseg >= MAX_SEG || b.n >= allowPts - 2) return;
  const prof = b.profile!;
  const room = w.room;
  const step = curStep;
  // Reset the cursor (the virtual projectile).
  C.m.fill(0);
  C.kind = SK_BEAM;
  C.x = ox;
  C.y = oy;
  C.z = 0;
  C.ang = dir;
  C.angOff = 0;
  C.speed = C.baseSpeed = T.beamSpeed;
  C.range = maxLen;
  C.traveled = 0;
  C.age = 0;
  C.baseDamage = b.dmg * dmgMul;
  C.baseSize = (b.width / 2) * sizeMul;
  C.damage = C.baseDamage;
  C.size = C.baseSize;
  C.knock = b.knock;
  C.depth = depth;
  C.flags = b.mode === PHASE_MODE ? F_PHASE : 0;
  C.bounceLeft = 0;
  C.pierceLeft = 9999;
  C.spin = b.spin;
  C.vIndex = b.vIndex;
  C.scale = b.scale;
  C.profile = prof;
  C.style = b.style;
  C.anchor = b.anchor;
  C.ownerKind = b.ownerKind;
  C.ax = b.anchor ? b.anchor.x : ox;
  C.ay = b.anchor ? b.anchor.y : oy;
  C.homeRef = null;
  C.homeT = 0;
  C.ovr = false;
  // What this trace passed through (homing moves on to the next target instead of looping back).
  forgetHits(C);
  C.rehit = 1 << 30;
  const init = prof.initHooks;
  for (let k = 0; k < init.length; k++) init[k]!.def.initShot!(C, init[k]!.stack);
  const mode: CollideMode = (C.flags & F_PHASE) !== 0 ? PHASE_MODE : SHOT_MODE;
  const motion = prof.motionHooks;
  const targets = w.atk.targets;
  const splitStacks = prof.splitStacks;
  const forkDepth = Math.min(T.beamForkDepth, splitStacks);
  let forked = !(splitStacks > 0 && depth < forkDepth);

  const seg = b.nseg++;
  b.segStart[seg] = b.n;
  b.segDepth[seg] = depth;
  push(b, ox, oy, C.size * 2);
  let points = 1;
  while (points < maxPoints && b.n < allowPts) {
    // Uniform trace time (step / virtual speed): accelerate / decelerate shape a beam (taper, flare)
    // but must not change how sharply homing / boomerang / spiral bend it.
    const dt = step / T.beamSpeed;
    C.age += dt;
    C.sizeMul = 1;
    C.dmgMul = 1;
    for (let k = 0; k < motion.length; k++) motion[k]!.def.motion!(C, motion[k]!.stack, w, dt);
    if ((C.flags & F_CAUGHT) !== 0) break;
    C.size = C.baseSize * C.sizeMul;
    C.damage = C.baseDamage * C.dmgMul;
    let th = C.ang + C.angOff;
    let nx: number;
    let ny: number;
    if (C.ovr) {
      // A motion hook placed the cursor (corkscrews): follow it, one step's worth.
      let dx = C.ovx * dt;
      let dy = C.ovy * dt;
      const l = Math.sqrt(dx * dx + dy * dy);
      if (l > step * 3) {
        dx *= (step * 3) / l;
        dy *= (step * 3) / l;
      }
      nx = C.x + dx;
      ny = C.y + dy;
      if (l > 1e-6) th = Math.atan2(dy, dx);
      C.ovr = false;
    } else {
      nx = C.x + Math.cos(th) * step;
      ny = C.y + Math.sin(th) * step;
    }
    C.vx = Math.cos(th) * C.speed;
    C.vy = Math.sin(th) * C.speed;
    const cell = firstBlockingCell(room, nx, ny, 1, mode);
    if (cell !== NO_CELL) {
      if (cell >= 0) beamTileHit(w, b, cell);
      traceNormal(room, C.x, C.y, nx, ny, mode);
      if (runWallHooks(w, C, nrm.x, nrm.y)) {
        reflect(C, nrm.x, nrm.y);
        push(b, C.x, C.y, C.size * 2);
        points++;
        continue;
      }
      // Stop exactly at the surface (a few bisection steps).
      let lo = 0;
      let hi = 1;
      for (let it = 0; it < 4; it++) {
        const mid = (lo + hi) / 2;
        if (firstBlockingCell(room, C.x + (nx - C.x) * mid, C.y + (ny - C.y) * mid, 1, mode) !== NO_CELL) hi = mid;
        else lo = mid;
      }
      C.x += (nx - C.x) * lo;
      C.y += (ny - C.y) * lo;
      push(b, C.x, C.y, C.size * 2);
      if (seg === 0) b.endWall = true;
      break;
    }
    C.x = nx;
    C.y = ny;
    C.traveled += step;
    // Lances (and phasing lasers) burn through the props they pass over.
    if (mode === PHASE_MODE) {
      const col = Math.floor(nx / TILE);
      const row = Math.floor(ny / TILE);
      if (room.inBounds(col, row) && shotBreakable(room.get(col, row))) beamTileHit(w, b, row * room.cols + col);
    }
    // Targets along the path.
    const hr = C.size;
    for (let i = 0; i < targets.n; i++) {
      const h = targets.refs[i]!;
      if (h === ignore) continue;
      const dx = h.x - C.x;
      const dy = h.y - C.y;
      const rr = h.r + hr;
      if (dx * dx + dy * dy >= rr * rr || !h.hittable) continue;
      if (!recentlyHit(C, h, w.tick)) rememberHit(C, h, w.tick);
      if (!forked && forkN < FORK_CAP) {
        forked = true;
        forkX[forkN] = C.x;
        forkY[forkN] = C.y;
        forkA[forkN] = C.ang + C.angOff;
        forkD[forkN] = depth + 1;
        forkT[forkN] = h;
        forkN++;
      }
      beamHit(w, b, h);
    }
    push(b, C.x, C.y, C.size * 2);
    points++;
    if (C.traveled >= C.range) break;
  }
  b.segLen[seg] = b.n - b.segStart[seg]!;
  if (seg === 0) {
    // Where the main line ends (on a wall when endWall): wall sparks, expire hooks.
    b.endX = C.x;
    b.endY = C.y;
  }
}

/** Re-traces a beam (main line + forks) from its current origin and direction. */
export function traceBeam(w: World, b: Beam): void {
  b.n = 0;
  b.nseg = 0;
  b.endWall = false;
  forkN = 0;
  const mainPts = Math.max(8, Math.min(T.beamMaxPoints, Math.round((T.beamMaxPoints * T.beamStep) / curStep)));
  traceSegment(w, b, b.ox, b.oy, b.dir, 0, mainPts, b.maxLen, 1, 1, null);
  const prof = b.profile!;
  const count = Math.min(T.beamForkMax, 1 + prof.splitStacks);
  const childPts = mainPts >> 1;
  for (let f = 0; f < forkN && b.nseg < MAX_SEG && b.n < allowPts - 8; f++) {
    const d = forkD[f]!;
    const spread = T.beamForkSpread;
    const dmg = Math.pow(T.beamForkDamage, d);
    const size = Math.pow(0.7, d);
    for (let c = 0; c < count; c++) {
      const a = forkA[f]! + (count > 1 ? (c / (count - 1) - 0.5) * 2 * spread : 0) + (count === 1 ? spread * 0.5 : 0);
      traceSegment(w, b, forkX[f]!, forkY[f]!, a, d, childPts, 140, dmg, size, forkT[f]!);
    }
    forkT[f] = null;
  }
  for (let f = 0; f < forkN; f++) forkT[f] = null;
}

/** Bomb rider on beams: explosions spaced along the main line. */
function beamBombs(w: World, b: Beam): void {
  const prof = b.profile!;
  const len = b.segLen[0]!;
  let acc = 0;
  let made = 0;
  const r = bombBlastRadius(prof) * Math.sqrt(b.scale);
  const dmg = prof.damage * bombBlastMul(prof) * b.scale;
  for (let i = 1; i < len && made < T.beamBombMax; i++) {
    const dx = b.px[i]! - b.px[i - 1]!;
    const dy = b.py[i]! - b.py[i - 1]!;
    acc += Math.sqrt(dx * dx + dy * dy);
    if (acc >= T.beamBombSpacing) {
      acc = 0;
      queueExplosion(w, b.px[i]!, b.py[i]!, r, dmg, true);
      made++;
    }
  }
  if (b.endWall && made < T.beamBombMax) queueExplosion(w, b.endX, b.endY, r, dmg, true);
}

/** End of a beam's life: expire hooks at its end point. */
function endBeam(w: World, b: Beam): void {
  if (b.profile && b.n > 0) {
    C.x = b.endX;
    C.y = b.endY;
    C.kind = SK_BEAM;
    C.damage = C.baseDamage = b.dmg;
    C.size = C.baseSize = b.width / 2;
    C.profile = b.profile;
    C.style = b.style;
    C.scale = b.scale;
    C.flags = 0;
    runExpireHooks(w, C);
  }
  w.atk.beams.release(b);
}

export function updateBeams(w: World, dt: number): void {
  const pool = w.atk.beams;
  // Guardrail: share this tick's trace budget; crowded beams get fewer points and a coarser step.
  const share = pool.count > 0 ? Math.floor(T.beamTickBudget / pool.count) : BUDGET;
  allowPts = Math.max(24, Math.min(BUDGET, share));
  curStep = allowPts >= T.beamMaxPoints ? T.beamStep : Math.min(T.beamMaxStep, (T.beamStep * T.beamMaxPoints) / allowPts);
  sparksLeft = T.beamHitEvents;
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.items[i]!;
    b.age += dt;
    b.ticks++;
    if (b.age > b.life + 1e-6 || (b.anchor !== null && !b.anchor.alive)) {
      endBeam(w, b);
      continue;
    }
    const prof = b.profile!;
    // Side zaps are aimed at their target: rings and spins don't turn them away from it.
    if (b.kind !== BK_SIDE) {
      const hooks = prof.beamHooks;
      for (let k = 0; k < hooks.length; k++) hooks[k]!.def.beamTick!(b, hooks[k]!.stack, w, dt);
    }
    const sweep = b.sweep !== 0 ? b.sweep * (2 * Math.min(1, b.age / b.life) - 1) * b.spin : 0;
    const dir = b.ang + b.orbitAng * b.spin + b.spinAng + sweep;
    b.dir = dir;
    const cx = b.anchor ? b.anchor.x : b.fx;
    const cy = b.anchor ? b.anchor.y : b.fy;
    const off = b.anchor ? T.beamMuzzle + b.offset : 0;
    b.ox = cx + Math.cos(dir) * off;
    b.oy = cy + Math.sin(dir) * off;
    traceBeam(w, b);
    if (b.bomb && (b.ticks === 1 || (b.kind === BK_LANCE && b.ticks % T.beamBombEvery === 1))) beamBombs(w, b);
  }
}
