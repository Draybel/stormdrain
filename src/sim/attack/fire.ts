/**
 * `fireVolley(sim, source, origin, dir, profile, scale)` — THE single entry point for every attack
 * (§4.3): the player, familiars (scale ≈ 0.4), orbit blades (mini volleys) and item hooks all call it,
 * so everything inherits every carrier and modifier.
 *
 * 1. Build the volley: one main spec, then the profile's spawn hooks (extra shots, spread, back / side
 *    shots, circle-first, inaccuracy, beam rings…). Too many specs for the pool merge into fewer,
 *    stronger ones (damage conserved).
 * 2. The primary carrier turns each spec into projectiles / beams / swipes (carriers/*.ts); delayed
 *    specs wait in a small queue.
 * 3. Riders merge in (carriers/*.ts `rider`): feathered sub-beams, a swipe, a companion marble, orbit
 *    blades firing mini volleys…
 */

import { ATTACK_TUNING, PLAYER_TUNING } from '../tuning';
import type { World } from '../world';
import type { Beam } from './beam';
import type { Swipe } from './melee';
import { CARRIERS, RIDER_ORDER } from './carriers/index';
import type { AttackProfile } from './profile';
import { allocShot, finishShot, type Shot } from './shot';
import {
  AttackSource,
  F_BOMB,
  F_CIRCLING,
  F_KEEPER,
  F_MINI,
  F_ORBITING,
  F_PHASE,
  F_SIDELASER,
  OWN_PLAYER,
  SF_CIRCLE,
  SF_MAIN,
  SF_RING,
  SK_BOMB,
  SK_MARBLE,
  SpawnCtx,
  type Anchor,
} from './state';

const T = ATTACK_TUNING;
const MAX_BEAMS = 48;

/** One volley being emitted (reused per nesting level: a player volley may trigger mini volleys). */
export class Volley {
  w!: World;
  src!: AttackSource;
  profile!: AttackProfile;
  ctx!: SpawnCtx;
  /** Origin (room px), launch height and aim angle. */
  x = 0;
  y = 0;
  z = 0;
  ang = 0;
  scale = 1;
  /** Spec index of Wren's keeper marble (-1 = none). */
  keeper = -1;
  /** What this volley made (riders read these). */
  readonly beams: Beam[] = new Array<Beam>(MAX_BEAMS);
  nBeams = 0;
  shots = 0;
  swipes = 0;
  /** Swipe directions already covered in this volley (melee: one swipe per distinct direction). */
  readonly swipeAng = new Float64Array(4);
  lastBeam: Beam | null = null;
  lastShot: Shot | null = null;
  lastSwipe: Swipe | null = null;
}

const DEPTH = 3;
const volleys: Volley[] = [];
const ctxs: SpawnCtx[] = [];
for (let i = 0; i < DEPTH; i++) {
  volleys.push(new Volley());
  ctxs.push(new SpawnCtx(T.maxVolley));
}
let depth = 0;

/** Height shots leave from, per source (eye height for the player, lower for small familiars). */
function launchHeight(src: AttackSource): number {
  return src.ownerKind === OWN_PLAYER ? PLAYER_TUNING.shotHeight : T.flyHeight - 1;
}

/**
 * Fires one volley of `profile` from `origin` toward `dir` (unit) at `scale`. Returns how many
 * projectiles / beams / swipes it made.
 */
export function fireVolley(
  w: World,
  src: AttackSource,
  origin: { readonly x: number; readonly y: number },
  dir: { readonly x: number; readonly y: number },
  profile: AttackProfile,
  scale: number,
): number {
  if (depth >= DEPTH) return 0;
  const v = volleys[depth]!;
  const ctx = ctxs[depth]!;
  depth++;
  try {
    ctx.reset();
    ctx.beam = profile.beam;
    ctx.carrier = profile.primary;
    ctx.scale = scale;
    ctx.rng = w.combatRng;
    ctx.profile = profile;
    ctx.add(0, 1, 1, 1, SF_MAIN);
    const hooks = profile.spawnHooks;
    for (let k = 0; k < hooks.length; k++) hooks[k]!.def.spawn!(ctx, hooks[k]!.stack);

    // Guardrail: never ask a pool for more than it can hold — merge specs instead (damage kept).
    const free = profile.beam ? w.atk.beams.free : w.projectiles.free - T.poolReserve;
    if (ctx.count > free) ctx.mergeTo(Math.max(1, free));

    v.w = w;
    v.src = src;
    v.profile = profile;
    v.ctx = ctx;
    v.x = origin.x;
    v.y = origin.y;
    v.z = launchHeight(src);
    v.ang = Math.atan2(dir.y, dir.x);
    v.scale = scale;
    v.nBeams = 0;
    v.shots = 0;
    v.swipes = 0;
    v.lastBeam = null;
    v.lastShot = null;
    v.lastSwipe = null;
    v.keeper = -1;
    if (src.keeper) {
      for (let i = 0; i < ctx.count; i++) {
        if ((ctx.flags[i]! & SF_MAIN) !== 0) {
          v.keeper = i;
          break;
        }
      }
    }

    const carrier = CARRIERS[profile.primary];
    for (let i = 0; i < ctx.count; i++) {
      if (ctx.delay[i]! > 0) queueDelayed(w, v, i);
      else carrier.emit!(v, i);
    }
    // Riders merge into the primary.
    for (let r = 0; r < RIDER_ORDER.length; r++) {
      const c = RIDER_ORDER[r]!;
      if (c.id === profile.primary) continue;
      const n = profile.stacksOf(c.id);
      if (n > 0 && c.rider) c.rider(v, n);
    }
    return v.shots + v.nBeams + v.swipes;
  } finally {
    depth--;
  }
}

/** Records a beam made by this volley (riders use the list). */
export function noteBeam(v: Volley, b: Beam): void {
  if (v.nBeams < MAX_BEAMS) v.beams[v.nBeams++] = b;
  v.lastBeam = b;
}

/**
 * Launches spec `i` of a volley as a projectile of `kind` (carriers call this): heading from the aim +
 * spec angle, the source's velocity partly inherited, numbers from the profile × carrier multipliers ×
 * spec × volley scale × charge. Returns the shot, or null if the pool is full (its damage then goes
 * into the previous shot of the volley).
 */
export function launchProjectile(
  v: Volley,
  i: number,
  kind: number,
  dmgMul: number,
  speedMul: number,
  rangeMul: number,
  sizeMul: number,
  /** Absolute heading (rad) instead of the aim + spec `i`'s angle (the melee rider's crescent on beams). */
  angle?: number,
): Shot | null {
  const w = v.w;
  const p = v.profile;
  const ctx = v.ctx;
  const src = v.src;
  const scale = v.scale;
  let dmg = p.damage * dmgMul * ctx.dmg[i]! * scale * src.mul;
  const s = allocShot(w);
  if (!s) {
    const last = v.lastShot;
    if (last && last.alive) {
      last.baseDamage += dmg;
      last.damage = last.baseDamage;
    }
    return null;
  }
  const ang = angle ?? v.ang + ctx.ang[i]!;
  const speed = p.shotSpeed * speedMul * ctx.speed[i]!;
  const inherit = PLAYER_TUNING.inheritVelocity;
  const vx = Math.cos(ang) * speed + src.vx * inherit;
  const vy = Math.sin(ang) * speed + src.vy * inherit;
  let size = p.size * sizeMul * ctx.size[i]! * Math.sqrt(scale) * src.sizeMul;
  let flags = 0;
  if (p.phase) flags |= F_PHASE;
  if (p.riderBomb > 0) flags |= F_BOMB;
  if (p.riderLaser > 0) flags |= F_SIDELASER;
  if (src.mini) flags |= F_MINI;
  if ((ctx.flags[i]! & SF_CIRCLE) !== 0) flags |= F_CIRCLING;
  // A tiny-planet ring copy: a moon that orbits its owner (orbitPlayer); the aimed shots fly on.
  if ((ctx.flags[i]! & SF_RING) !== 0) flags |= F_ORBITING;
  s.style = p.style;
  if (i === v.keeper) {
    // Wren's keeper marble: big, triple damage, pierces everything.
    flags |= F_KEEPER;
    dmg *= 3;
    size *= 1.6;
    s.style = p.keeperStyle;
  }
  s.kind = kind === SK_MARBLE && p.riderBomb > 0 ? SK_BOMB : kind;
  s.x = v.x;
  s.y = v.y;
  s.z = v.z;
  s.ang = Math.atan2(vy, vx);
  s.baseSpeed = s.speed = Math.sqrt(vx * vx + vy * vy);
  s.baseDamage = dmg;
  s.baseSize = size;
  s.range = p.range * rangeMul * (0.6 + 0.4 * scale);
  s.knock = p.knockback * (0.5 + 0.5 * scale);
  s.flags = flags;
  s.profile = p;
  s.anchor = src.anchor;
  s.ownerKind = src.ownerKind;
  s.scale = scale;
  s.vIndex = i;
  s.spin = (i & 1) === 1 ? -1 : 1;
  s.life = T.maxAge;
  s.rehit = T.rehitTicks;
  s.zapT = T.sideLaserEvery * 0.5;
  if (src.anchor) {
    s.ax = src.anchor.x;
    s.ay = src.anchor.y;
  }
  finishShot(w, s);
  v.shots++;
  v.lastShot = s;
  return s;
}

// ── Delayed specs ──────────────────────────────────────────────────────────

const PENDING = 64;

/** Specs waiting for their delay (reused slots). */
export class PendingSpecs {
  n = 0;
  readonly time = new Float64Array(PENDING);
  readonly ang = new Float64Array(PENDING);
  readonly dmg = new Float64Array(PENDING);
  readonly size = new Float64Array(PENDING);
  readonly speed = new Float64Array(PENDING);
  readonly flags = new Int32Array(PENDING);
  readonly scale = new Float64Array(PENDING);
  readonly x = new Float64Array(PENDING);
  readonly y = new Float64Array(PENDING);
  readonly src: AttackSource[] = [];
  readonly profile: (AttackProfile | null)[] = new Array<AttackProfile | null>(PENDING).fill(null);
  constructor() {
    for (let i = 0; i < PENDING; i++) this.src.push(new AttackSource());
  }
}

function queueDelayed(w: World, v: Volley, i: number): void {
  const q = w.atk.pending;
  if (q.n >= PENDING) {
    v.w = w;
    CARRIERS[v.profile.primary].emit!(v, i);
    return;
  }
  const k = q.n++;
  const ctx = v.ctx;
  q.time[k] = w.time + ctx.delay[i]!;
  q.ang[k] = v.ang + ctx.ang[i]!;
  q.dmg[k] = ctx.dmg[i]!;
  q.size[k] = ctx.size[i]!;
  q.speed[k] = ctx.speed[i]!;
  q.flags[k] = ctx.flags[i]!;
  q.scale[k] = v.scale;
  q.x[k] = v.x - (v.src.anchor?.x ?? v.x);
  q.y[k] = v.y - (v.src.anchor?.y ?? v.y);
  const s = q.src[k]!;
  copySource(s, v.src);
  q.profile[k] = v.profile;
}

export function copySource(to: AttackSource, from: AttackSource): void {
  to.ownerKind = from.ownerKind;
  to.anchor = from.anchor;
  to.vx = from.vx;
  to.vy = from.vy;
  to.mul = from.mul;
  to.sizeMul = from.sizeMul;
  to.lifeMul = from.lifeMul;
  to.keeper = false;
  to.mini = from.mini;
  to.quiet = from.quiet;
}

/** Emits the delayed specs whose time has come (from where their owner is now). */
export function flushPending(w: World): void {
  const q = w.atk.pending;
  if (q.n === 0 || depth >= DEPTH) return;
  for (let k = q.n - 1; k >= 0; k--) {
    if (q.time[k]! > w.time + 1e-9) continue;
    const prof = q.profile[k]!;
    const src = q.src[k]!;
    const anchor: Anchor | null = src.anchor;
    if (!anchor || anchor.alive) {
      const v = volleys[depth]!;
      const ctx = ctxs[depth]!;
      depth++;
      try {
        ctx.reset();
        ctx.beam = prof.beam;
        ctx.scale = q.scale[k]!;
        ctx.rng = w.combatRng;
        ctx.profile = prof;
        ctx.add(0, q.dmg[k]!, q.size[k]!, q.speed[k]!, q.flags[k]! & ~SF_MAIN);
        v.w = w;
        v.src = src;
        v.profile = prof;
        v.ctx = ctx;
        v.x = (anchor?.x ?? 0) + q.x[k]!;
        v.y = (anchor?.y ?? 0) + q.y[k]!;
        v.z = launchHeight(src);
        v.ang = q.ang[k]!;
        v.scale = q.scale[k]!;
        v.nBeams = v.shots = v.swipes = 0;
        v.lastBeam = null;
        v.lastShot = null;
        v.lastSwipe = null;
        v.keeper = -1;
        CARRIERS[prof.primary].emit!(v, 0);
      } finally {
        depth--;
      }
    }
    // Remove k (swap with the last).
    const last = q.n - 1;
    if (k !== last) {
      q.time[k] = q.time[last]!;
      q.ang[k] = q.ang[last]!;
      q.dmg[k] = q.dmg[last]!;
      q.size[k] = q.size[last]!;
      q.speed[k] = q.speed[last]!;
      q.flags[k] = q.flags[last]!;
      q.scale[k] = q.scale[last]!;
      q.x[k] = q.x[last]!;
      q.y[k] = q.y[last]!;
      copySource(q.src[k]!, q.src[last]!);
      q.profile[k] = q.profile[last]!;
    }
    q.profile[last] = null;
    q.n = last;
  }
}
