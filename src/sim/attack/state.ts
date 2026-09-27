/**
 * Shared shapes of the attack pipeline (ARCHITECTURE §4): ModStack, ModifierDef, SpawnCtx, ShotState
 * (the one view used by projectiles AND beam trace cursors), anchors and attack sources.
 *
 * Headless: nothing here touches the DOM. Hot paths reuse these objects; nothing allocates per tick.
 */

import type { Rng } from '../../engine/rng';
import type { Hittable } from '../hittable';
import { MOD_IDS, type CarrierId, type ModId, type ShapeHint, type TrailKind } from '../types';
import type { World } from '../world';
import type { AttackProfile } from './profile';
import type { ShotStyle } from './style';
import type { Beam } from './beam';

/** The simulation as modifiers see it (the World: rooms, pools, rng, events). */
export type SimView = World;

export const MOD_COUNT = MOD_IDS.length;

/** ModId → dense index (MOD_IDS order). */
export const MOD_INDEX: Readonly<Record<ModId, number>> = (() => {
  const m = {} as Record<ModId, number>;
  MOD_IDS.forEach((id, i) => (m[id] = i));
  return m;
})();

/** Scratch slots per modifier in ShotState.m (a modifier owns m[index * MOD_SLOTS .. + MOD_SLOTS)). */
export const MOD_SLOTS = 3;

/** A held modifier: total stacks, summed item params and numbers derived once per profile build. */
export interface ModStack {
  readonly id: ModId;
  readonly index: number;
  stacks: number;
  /** Numeric params summed across the items granting it (e.g. { turn: 2 }). */
  readonly params: Readonly<Record<string, number>>;
  /** Derived numbers (ModifierDef.prepare) — per-hit code reads these instead of recomputing. */
  v0: number;
  v1: number;
  v2: number;
  v3: number;
  /** First scratch slot of this modifier in ShotState.m. */
  readonly slot: number;
}

/**
 * A modifier: plain object registered by id (sim/attack/modifiers). Every hook is optional.
 * `order` sorts the hooks inside a stage (lower runs first).
 */
export interface ModifierDef {
  id: ModId;
  /** Tint mixed into the shot colour (ShotStyle). */
  color?: string;
  trail?: TrailKind;
  shape?: ShapeHint;
  order: number;
  /** True for status effects (poison, burn…): chain lightning re-applies these on every jump. */
  status?: boolean;
  /** Once per profile build: fill stack.v0..v3 from stacks + params. */
  prepare?(stack: ModStack, profile: AttackProfile): void;
  /** Edit the volley: add shots, angles, delays. */
  spawn?(ctx: SpawnCtx, stack: ModStack): void;
  /** Per shot / per beam trace, once: set per-shot params. */
  initShot?(s: ShotState, stack: ModStack): void;
  /** Per step: velocity / heading / size transforms. */
  motion?(s: ShotState, stack: ModStack, sim: SimView, dt: number): void;
  /** On damaging something (after the damage). */
  hit?(s: ShotState, target: Hittable, stack: ModStack, sim: SimView): void;
  /** Touching a wall / blocking tile with unit normal (nx, ny); return true = the shot survives. */
  wall?(s: ShotState, stack: ModStack, sim: SimView, nx: number, ny: number): boolean;
  /** The shot ended without being used up by a hit (range, wall, timeout, beam end). */
  expire?(s: ShotState, stack: ModStack, sim: SimView): void;
  /** Beams only, once per tick before tracing: steer the beam itself (origin rotation, spins). */
  beamTick?(b: Beam, stack: ModStack, sim: SimView, dt: number): void;
}

/** A hook bound to its stack (flat, pre-sorted arrays in the profile). */
export interface ModEntry {
  readonly def: ModifierDef;
  readonly stack: ModStack;
}

// ── Volleys ────────────────────────────────────────────────────────────────

/** Spec flags inside a volley. */
export const SF_MAIN = 1;
export const SF_EXTRA = 2;
export const SF_BACK = 4;
export const SF_SIDE = 8;
export const SF_PELLET = 16;
export const SF_CIRCLE = 32;
/** A tiny-planet ring copy (orbitPlayer): orbits / turns around the owner; the aimed specs stay aimed. */
export const SF_RING = 64;

/**
 * The volley being built (reused): one spec per shot/beam with an angle offset from the aim, damage /
 * size / speed multipliers, a delay (s) and flags. Spawn hooks edit it; the carrier turns each spec
 * into projectiles, beams or swipes.
 */
export class SpawnCtx {
  readonly cap: number;
  count = 0;
  readonly ang: Float64Array;
  readonly dmg: Float64Array;
  readonly size: Float64Array;
  readonly speed: Float64Array;
  readonly delay: Float64Array;
  readonly flags: Int32Array;
  /** The primary carrier emits beams (lance / laser). */
  beam = false;
  carrier: CarrierId = 'marble';
  scale = 1;
  rng!: Rng;
  profile!: AttackProfile;

  constructor(cap: number) {
    this.cap = cap;
    this.ang = new Float64Array(cap);
    this.dmg = new Float64Array(cap);
    this.size = new Float64Array(cap);
    this.speed = new Float64Array(cap);
    this.delay = new Float64Array(cap);
    this.flags = new Int32Array(cap);
  }

  reset(): void {
    this.count = 0;
  }

  /** Adds a spec; returns its index or -1 when the volley is full (the caller may merge instead). */
  add(ang: number, dmg = 1, size = 1, speed = 1, flags = 0, delay = 0): number {
    if (this.count >= this.cap) return -1;
    const i = this.count++;
    this.ang[i] = ang;
    this.dmg[i] = dmg;
    this.size[i] = size;
    this.speed[i] = speed;
    this.delay[i] = delay;
    this.flags[i] = flags;
    return i;
  }

  /** Copies spec `from` into slot `to`. */
  copy(from: number, to: number): void {
    this.ang[to] = this.ang[from]!;
    this.dmg[to] = this.dmg[from]!;
    this.size[to] = this.size[from]!;
    this.speed[to] = this.speed[from]!;
    this.delay[to] = this.delay[from]!;
    this.flags[to] = this.flags[from]!;
  }

  /**
   * Shrinks the volley to `max` specs by merging neighbours (damage summed, size grown, angles
   * averaged) — the guardrail that keeps damage when caps are hit (§4.5).
   */
  mergeTo(max: number): void {
    max = Math.max(1, max);
    while (this.count > max) {
      // Merge the last spec into its nearest-angle neighbour.
      const last = this.count - 1;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < last; i++) {
        const d = Math.abs(this.ang[i]! - this.ang[last]!);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      const a = this.dmg[best]!;
      const b = this.dmg[last]!;
      this.ang[best] = (this.ang[best]! * a + this.ang[last]! * b) / Math.max(1e-6, a + b);
      this.dmg[best] = a + b;
      this.size[best] = Math.min(3, Math.sqrt(this.size[best]! * this.size[best]! + this.size[last]! * this.size[last]! * 0.5));
      this.count = last;
    }
  }
}

// ── Shots ──────────────────────────────────────────────────────────────────

/** Shot kinds (render shape + carrier behaviour). */
export const SK_MARBLE = 0;
export const SK_BLADE = 1;
export const SK_CRESCENT = 2;
export const SK_BOMB = 3;
/** An orbit-rider blade circling the player. */
export const SK_ORBIT = 4;
/** A beam trace cursor (virtual projectile). */
export const SK_BEAM = 5;
/** A melee swipe's hit (pseudo shot passed to hit hooks). */
export const SK_SWIPE = 6;

/** Homing picks a beam trace remembers per segment (polish batch 2). */
export const HOME_MEM = 6;

/** Shot flags. */
export const F_FALLING = 1;
export const F_RETURNING = 2;
export const F_PHASE = 4;
/** Wren's keeper marble: triple damage, pierces everything. */
export const F_KEEPER = 8;
/** Bomb rider: explodes at its end, breaks rocks. */
export const F_BOMB = 16;
/** Laser rider: zaps nearby enemies with thin side lasers. */
export const F_SIDELASER = 32;
/** circleFirst: circling the owner before launching. */
export const F_CIRCLING = 64;
/** Fired by a familiar / orbit blade (smaller, never spawns more volleys). */
export const F_MINI = 128;
/** Boomerang: caught by its owner (ends silently). */
export const F_CAUGHT = 256;
/** A split child (render: slightly smaller glow). */
export const F_CHILD = 512;
/** Rides the tiny-planet orbit: homing picks its target but the orbit steers (the ring locks onto it). */
export const F_ORBITING = 1024;

/** Owner kinds. */
export const OWN_PLAYER = 0;
export const OWN_FAMILIAR = 1;
export const OWN_BLADE = 2;
export const OWN_HOOK = 3;

/** Something that shots and beams can be anchored to (player, familiar, orbit blade). */
export interface Anchor {
  x: number;
  y: number;
  readonly alive: boolean;
}

/**
 * The shared per-shot state of projectiles and beam trace cursors (§4.4). Motion is heading-based:
 * velocity = speed × (cos, sin)(ang + angOff); a motion hook may instead set a velocity override for
 * one step (ovr, ovx, ovy: orbits, catches). Size and damage are base × per-step multipliers
 * (sizeMul / dmgMul reset to 1 before the motion hooks run), so grow and shrink compose.
 */
export class ShotState {
  x = 0;
  y = 0;
  /** Height above the ground (px): marbles fly at eye height and drop at the end of their range. */
  z = 0;
  vz = 0;
  /** Heading (rad), a non-accumulating offset (wavy) and speed (px/s). */
  ang = 0;
  angOff = 0;
  speed = 0;
  baseSpeed = 0;
  /** Current velocity (derived every step; read by render, tests and hooks). */
  vx = 0;
  vy = 0;
  /** Velocity override for this step. */
  ovr = false;
  ovx = 0;
  ovy = 0;
  /** Owner (anchor) position this step — boomerangs return to it, orbits circle it. */
  ax = 0;
  ay = 0;
  anchor: Anchor | null = null;
  ownerKind = OWN_PLAYER;
  /** Distance moved (px), distance before the shot ends (px), age (s) and max age (s). */
  traveled = 0;
  range = 0;
  age = 0;
  life = 6;
  damage = 0;
  baseDamage = 0;
  dmgMul = 1;
  /** Collision radius (px). */
  size = 3;
  baseSize = 3;
  sizeMul = 1;
  /** Knockback impulse on hit (px/s). */
  knock = 0;
  /** Split generation (0 = fired directly). */
  depth = 0;
  flags = 0;
  hitCount = 0;
  pierceLeft = 0;
  bounceLeft = 0;
  /** Ticks before a piercing shot may hit the same target again. */
  rehit = 30;
  /** ±1: turn direction for spirals / orbits (alternates across a volley). */
  spin = 1;
  /** Index inside its volley. */
  vIndex = 0;
  kind = SK_MARBLE;
  /** Volley scale (familiars, orbit blades ≈ 0.4). */
  scale = 1;
  profile: AttackProfile | null = null;
  style: ShotStyle | null = null;
  /** Per-modifier scratch (MOD_SLOTS per modifier, see ModStack.slot). */
  readonly m = new Float64Array(MOD_COUNT * MOD_SLOTS);
  /** Homing target cache (beams: `homeT` counts the trace steps spent chasing it). */
  homeRef: Hittable | null = null;
  homeT = 0;
  /**
   * Beam trace cursors (polish batch 2): the targets homing picked along this trace, in order (`homeSeq`), and last
   * tick's picks for the same trace segment (`homeMem`, from the beam). A pick is taken from the memory while it is
   * still good, so a homing lance keeps its path from tick to tick instead of flipping between near-equal targets.
   */
  readonly homeSeq: (Hittable | null)[] = new Array<Hittable | null>(HOME_MEM).fill(null);
  homeSeqN = 0;
  readonly homeMem: (Hittable | null)[] = new Array<Hittable | null>(HOME_MEM).fill(null);
  homeMemN = 0;
  /** The current homing target came from `homeMem` (it gets the hysteresis slack). */
  homeMemo = false;
  /** Trace steps to wait before seeking again (nothing was in reach). */
  homeWait = 0;
  /** Recently hit targets (piercing shots don't re-hit every sub-step). */
  readonly hitRefs: (Hittable | null)[] = [null, null, null, null];
  readonly hitAt = new Int32Array(4);
  hitN = 0;
  /** Laser rider: seconds to the next side zap. */
  zapT = 0;
}

export function resetShotState(s: ShotState): void {
  s.x = s.y = s.z = s.vz = 0;
  s.ang = s.angOff = s.speed = s.baseSpeed = 0;
  s.vx = s.vy = 0;
  s.ovr = false;
  s.ovx = s.ovy = 0;
  s.ax = s.ay = 0;
  s.anchor = null;
  s.ownerKind = OWN_PLAYER;
  s.traveled = s.range = s.age = 0;
  s.life = 6;
  s.damage = s.baseDamage = 0;
  s.dmgMul = 1;
  s.size = s.baseSize = 3;
  s.sizeMul = 1;
  s.knock = 0;
  s.depth = 0;
  s.flags = 0;
  s.hitCount = 0;
  s.pierceLeft = 0;
  s.bounceLeft = 0;
  s.rehit = 30;
  s.spin = 1;
  s.vIndex = 0;
  s.kind = SK_MARBLE;
  s.scale = 1;
  s.profile = null;
  s.style = null;
  s.m.fill(0);
  s.homeRef = null;
  s.homeT = 0;
  s.homeSeqN = 0;
  s.homeMemN = 0;
  s.homeMemo = false;
  s.homeWait = 0;
  s.hitRefs[0] = s.hitRefs[1] = s.hitRefs[2] = s.hitRefs[3] = null;
  s.hitAt.fill(0);
  s.hitN = 0;
  s.zapT = 0;
}

/** Remembers a hit target (ring of 4). */
export function rememberHit(s: ShotState, t: Hittable, tick: number): void {
  s.hitRefs[s.hitN] = t;
  s.hitAt[s.hitN] = tick;
  s.hitN = (s.hitN + 1) & 3;
}

/** Was `t` hit within the last `s.rehit` ticks? */
export function recentlyHit(s: ShotState, t: Hittable, tick: number): boolean {
  for (let i = 0; i < 4; i++) if (s.hitRefs[i] === t && tick - s.hitAt[i]! < s.rehit) return true;
  return false;
}

export function forgetHits(s: ShotState): void {
  s.hitRefs[0] = s.hitRefs[1] = s.hitRefs[2] = s.hitRefs[3] = null;
}

// ── Sources ────────────────────────────────────────────────────────────────

/**
 * Who fires a volley (reused objects — one per player / familiar / blade). `mul` and `sizeMul` are the
 * charge multipliers of this volley; `keeper` = Wren's keeper marble.
 */
export class AttackSource {
  ownerKind = OWN_PLAYER;
  anchor: Anchor | null = null;
  /** Velocity inherited by projectiles (× PLAYER_TUNING.inheritVelocity). */
  vx = 0;
  vy = 0;
  /** Damage / size multipliers for this volley (charge). */
  mul = 1;
  sizeMul = 1;
  /** Beam life multiplier (lance overcharge). */
  lifeMul = 1;
  keeper = false;
  /** Familiars and orbit blades: never trigger further volleys. */
  mini = false;
  /** Beam volleys: the lance/laser flash events are emitted by the player only. */
  quiet = false;
}

/** A carrier: how damage travels (primary) and how it merges into another primary (rider). */
export interface CarrierDef {
  id: CarrierId;
  /** Primary precedence (higher wins): lance > laser > boomerang > melee > marble. Riders only: -1. */
  rank: number;
  color?: string;
  shape?: ShapeHint;
  trail?: TrailKind;
}
