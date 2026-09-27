/**
 * Motion-stage modifiers (§4.4). They run every step for projectiles AND for beam trace cursors
 * (dt = step / virtual speed), which is why a homing lance bends toward enemies and a wavy laser
 * wiggles without any beam-specific code. Motion is heading-based (see ShotState).
 */

import { ATTACK_TUNING } from '../../tuning';
import { F_CAUGHT, F_CIRCLING, F_ORBITING, F_PHASE, F_RETURNING, SK_BEAM, forgetHits, recentlyHit, type ModifierDef } from '../state';
import { seekTarget } from '../targets';
import { orbitRing } from './spawn';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;

function wrap(a: number): number {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  else if (a < -Math.PI) a += TAU;
  return a;
}

/** Turns heading `s.ang` toward angle `to` by at most `max` rad. */
function steer(s: { ang: number; angOff: number }, to: number, max: number): void {
  const d = wrap(to - (s.ang + s.angOff));
  s.ang += d > max ? max : d < -max ? -max : d;
}

/**
 * Seeks an enemy in range; stacks: longer reach, sharper turns. The target is the one the shot can
 * actually reach soonest (targets.ts seekTarget): ahead beats beside, never one it could only circle
 * forever, and a piercing shot moves on to the next once it has hit one.
 */
const homing: ModifierDef = {
  id: 'homing',
  color: '#b07aff',
  trail: 'wisps',
  order: 10,
  prepare(st) {
    st.v0 = 80 + 24 * st.stacks + (st.params.radius ?? 0);
    st.v1 = 2.5 + 2 * st.stacks + (st.params.turn ?? 0);
  },
  motion(s, st, w, dt) {
    if ((s.flags & (F_RETURNING | F_CIRCLING)) !== 0) return;
    let ref = s.homeRef;
    s.homeT -= dt;
    if (ref === null || s.homeT <= 0 || !ref.hittable || recentlyHit(s, ref, w.tick)) {
      const t = w.atk.targets;
      // (Orbiting shots don't steer by heading: the nearest target in reach, see orbitPlayer.)
      const turnR = (s.flags & F_ORBITING) !== 0 ? 0 : Math.max(4, s.speed) / st.v1;
      const i = seekTarget(t, s.x, s.y, s.ang + s.angOff, st.v0, turnR, s.size, s, w.tick);
      ref = i >= 0 ? t.refs[i]! : null;
      s.homeRef = ref;
      s.homeT = 0.12;
    }
    // Orbiting shots: the orbit follows the target by swelling / shrinking its ring (orbitPlayer).
    if (ref === null || (s.flags & F_ORBITING) !== 0) return;
    steer(s, Math.atan2(ref.y - s.y, ref.x - s.x), st.v1 * dt);
  },
};

/** Snakes along a sine path (phase by distance, so beams draw the same wave). */
const wavy: ModifierDef = {
  id: 'wavy',
  color: '#5fe0d0',
  order: 20,
  prepare(st) {
    st.v0 = Math.min(1.1, 0.35 + 0.12 * st.stacks);
    st.v1 = TAU / 44;
  },
  initShot(s, st) {
    s.m[st.slot] = (s.vIndex & 1) === 1 ? Math.PI : 0;
  },
  motion(s, st) {
    if ((s.flags & F_CIRCLING) !== 0) return;
    s.angOff = st.v0 * Math.sin(s.traveled * st.v1 + s.m[st.slot]!);
  },
};

/**
 * Tiny planet: shots orbit their owner on a widening ring (living longer); beams become a rotating
 * ring (spawn: evenly spaced beams; beamTick: the ring turns).
 * Composes with the other motion modifiers instead of overriding them:
 * - homing: as the shot's sweep comes up on the homing target it whips out (or in) to the target's
 *   distance from the owner, then settles back onto the ring — orbiting shots lash at enemies they
 *   pass (homing only picks the nearest target for orbiting shots, F_ORBITING);
 * - a heading change made by an earlier hook since the last step (a bounce off a wall…) TILTS the
 *   heading away from the tangent; the shot moves along the tilted heading (split into angle +
 *   radius around the owner, so it still travels with her) and the tilt fades back into the orbit;
 * - wavy's heading offset makes the ring breathe; spiral corkscrews around the orbit path;
 * - circle-first laps and boomerang returns pause it; it rejoins from wherever the shot is.
 */
const orbitPlayer: ModifierDef = {
  id: 'orbitPlayer',
  color: '#9f9fff',
  order: 40,
  prepare(st) {
    st.v0 = 20 + 7 * st.stacks;
    st.v1 = 1.6 + 0.4 * st.stacks;
    st.v2 = 3 + 0.6 * st.stacks;
  },
  spawn(ctx, st) {
    orbitRing(ctx, st.stacks);
  },
  initShot(s, st) {
    if (s.kind === SK_BEAM) return;
    s.range *= st.v1;
    s.rehit = Math.min(s.rehit, 12);
    s.flags |= F_ORBITING;
    // m[o] angle around the owner, m[o + 1] radius (< 0: (re)join from the current position), m[o + 2] tilt.
    s.m[st.slot + 1] = -1;
  },
  motion(s, st, _w, dt) {
    if (s.kind === SK_BEAM) return;
    const o = st.slot;
    if ((s.flags & (F_CIRCLING | F_RETURNING)) !== 0) {
      s.m[o + 1] = -1;
      return;
    }
    const side = s.spin * HALF_PI;
    let a: number;
    let r: number;
    let tilt: number;
    if (s.m[o + 1]! < 0) {
      const dx = s.x - s.ax;
      const dy = s.y - s.ay;
      const d = Math.sqrt(dx * dx + dy * dy);
      a = d > 2 ? Math.atan2(dy, dx) : s.ang - side;
      r = Math.max(6, d);
      tilt = 0;
    } else {
      a = s.m[o]!;
      r = s.m[o + 1]!;
      tilt = s.m[o + 2]!;
      // Whatever turned the heading since this hook wrote it last step tilts the orbit.
      tilt += wrap(s.ang - (a + side + tilt));
    }
    // The tilt fades (the orbit recovers); it may reach all the way round (homing can turn the shot
    // back against the spin): the motion below is just its heading split into angle + radius.
    tilt = wrap(tilt) * Math.max(0, 1 - 2.5 * dt);
    const dir = tilt + s.angOff;
    // A positive tilt (spin +1) turns the heading inward: radial speed = −spin · speed · sin(dir).
    const radial = -s.spin * s.speed * Math.sin(dir);
    // The ring: out to v0 quickly (60 px/s), then a slow widening (12 px/s) so the orbit sweeps more
    // of the room. Homing: while its target is coming up in the sweep (up to ~70° ahead, until just
    // past it) the shot whips out / in to the target's distance at full speed, then returns.
    let ring = st.v0 + 12 * s.age;
    let rate = 60;
    const h = s.homeRef;
    if (h !== null && h.hittable) {
      const hx = h.x - s.ax;
      const hy = h.y - s.ay;
      const ahead = wrap(Math.atan2(hy, hx) - a) * s.spin;
      if (ahead > -0.35 && ahead < 1.2) {
        ring = Math.sqrt(hx * hx + hy * hy);
        rate = s.speed;
      }
    }
    const k = rate * dt;
    const dr = ring - r;
    r += dr > k ? k : dr < -k ? -k : dr;
    r = Math.max(6, r + radial * dt);
    a += (s.spin * s.speed * Math.cos(dir) * dt) / Math.max(8, r);
    s.m[o] = a;
    s.m[o + 1] = r;
    s.m[o + 2] = tilt;
    const tx = s.ax + Math.cos(a) * r;
    const ty = s.ay + Math.sin(a) * r;
    let vx = (tx - s.x) / dt;
    let vy = (ty - s.y) / dt;
    const v2 = vx * vx + vy * vy;
    if (v2 > 900 * 900) {
      const k = 900 / Math.sqrt(v2);
      vx *= k;
      vy *= k;
    }
    s.ovr = true;
    s.ovx = vx;
    s.ovy = vy;
    s.ang = a + side + tilt;
  },
  beamTick(b, st, _w, dt) {
    b.orbitAng += st.v2 * dt;
    b.offset = Math.max(b.offset, 10);
  },
};

/** Flies out, turns around and comes back to its owner (who catches it). Beams bend into a U. */
const boomerang: ModifierDef = {
  id: 'boomerang',
  color: '#d0d8e8',
  order: 50,
  prepare(st) {
    st.v0 = 7 + 2 * st.stacks;
    st.v1 = Math.min(0.6, 0.45 + 0.03 * st.stacks);
  },
  initShot(s, st) {
    s.m[st.slot] = s.kind === SK_BEAM ? 80 + 15 * st.stacks : Math.max(24, s.range * st.v1);
  },
  motion(s, st, _w, dt) {
    if ((s.flags & F_CIRCLING) !== 0) return;
    if ((s.flags & F_RETURNING) === 0) {
      if (s.traveled < s.m[st.slot]!) return;
      s.flags |= F_RETURNING;
      forgetHits(s);
      // Plenty of range for the way back; the catch (or max age) ends it.
      if (s.kind !== SK_BEAM) s.range = s.traveled * 3 + 200;
    }
    const dx = s.ax - s.x;
    const dy = s.ay - s.y;
    steer(s, Math.atan2(dy, dx), st.v0 * dt);
    if (s.speed < s.baseSpeed) s.speed = s.baseSpeed;
    const r = ATTACK_TUNING.catchRadius + s.size;
    // Only once it has swung around (heading home) can it be caught.
    if (dx * dx + dy * dy < r * r && s.traveled > s.m[st.slot]! + 12) s.flags |= F_CAUGHT;
  },
};

/**
 * Corkscrew: the shot loops around its own path, the loops widening as it flies (stacks: faster,
 * wider loops). The loop is an OFFSET added on top of whatever path the shot is on — along its heading
 * at 0.6 × speed (so homing, wavy and bounce still steer it), or the orbit / placed path an earlier
 * hook set (a tiny planet that corkscrews) — so it composes instead of replacing. Coming home
 * (boomerang) the loops close up so the catch still works. Beams draw the same corkscrew.
 */
const spiral: ModifierDef = {
  id: 'spiral',
  color: '#ff7ad9',
  shape: 'star',
  order: 55,
  prepare(st) {
    // v0 loop speed (rad/s), v1 radius growth (px/s), v2 max radius (px), v3 forward speed fraction.
    st.v0 = 9 + 1.5 * st.stacks;
    st.v1 = 26 + 6 * st.stacks;
    st.v2 = 10 + 3 * st.stacks;
    st.v3 = 0.6;
  },
  initShot(s, st) {
    const o = st.slot;
    s.m[o] = s.ang - s.spin * HALF_PI; // loop angle
    s.m[o + 1] = 0; // current loop offset (x, y) from the path
    s.m[o + 2] = 0;
    if (s.kind !== SK_BEAM) s.range *= 1.6;
  },
  motion(s, st, _w, dt) {
    if ((s.flags & F_CIRCLING) !== 0) return;
    const o = st.slot;
    const home = (s.flags & F_RETURNING) !== 0;
    let bx: number;
    let by: number;
    if (s.ovr) {
      bx = s.ovx;
      by = s.ovy;
    } else {
      const th = s.ang + s.angOff;
      const f = s.speed * (home ? 1 : st.v3);
      bx = Math.cos(th) * f;
      by = Math.sin(th) * f;
    }
    const ox = s.m[o + 1]!;
    const oy = s.m[o + 2]!;
    const r = home ? Math.max(0, Math.sqrt(ox * ox + oy * oy) - st.v1 * 2 * dt) : Math.min(st.v2, st.v1 * s.age);
    const a = s.m[o]! + s.spin * st.v0 * dt;
    s.m[o] = a;
    const nx = Math.cos(a) * r;
    const ny = Math.sin(a) * r;
    s.m[o + 1] = nx;
    s.m[o + 2] = ny;
    s.ovr = true;
    s.ovx = bx + (nx - ox) / dt;
    s.ovy = by + (ny - oy) / dt;
  },
};

/** Grows as it flies (and hits harder). */
const grow: ModifierDef = {
  id: 'grow',
  color: '#ffb060',
  order: 60,
  prepare(st) {
    st.v0 = 1.1 + 0.3 * st.stacks;
    st.v1 = Math.min(3.6, 1.6 + 0.4 * st.stacks);
  },
  motion(s, st) {
    const k = Math.min(st.v1, 1 + st.v0 * s.age);
    s.sizeMul *= k;
    s.dmgMul *= 1 + 0.5 * (k - 1);
  },
};

/** Starts huge and strong, shrinks as it flies. */
const shrink: ModifierDef = {
  id: 'shrink',
  color: '#8fe8ff',
  order: 61,
  prepare(st) {
    st.v0 = Math.min(2.75, 1.5 + 0.25 * st.stacks);
  },
  motion(s, st) {
    const span = s.kind === SK_BEAM ? 220 : Math.max(1, s.range);
    const t = Math.min(1, s.traveled / span);
    const k = st.v0 + (0.5 - st.v0) * t;
    s.sizeMul *= k;
    s.dmgMul *= k;
  },
};

/** Speeds up as it flies. Beams: taper into a thinner, harder-hitting tip. */
const accelerate: ModifierDef = {
  id: 'accelerate',
  color: '#ff6040',
  order: 70,
  prepare(st) {
    st.v0 = 1.4 + 0.5 * st.stacks;
    st.v1 = 2 + 0.5 * st.stacks;
  },
  initShot(s, st) {
    if (s.kind !== SK_BEAM) s.range *= 1 + 0.15 * st.stacks;
  },
  motion(s, st, _w, dt) {
    if ((s.flags & F_CIRCLING) !== 0) return;
    const max = s.baseSpeed * st.v1;
    const v = s.speed * (1 + st.v0 * dt);
    s.speed = v > max ? max : v;
    if (s.kind === SK_BEAM) {
      // A beam has no speed to show: it tapers into a thinner, harder-hitting whip toward its tip.
      const k = s.speed / s.baseSpeed;
      s.dmgMul *= 1 + 0.5 * (k - 1);
      s.sizeMul /= Math.sqrt(k);
    }
  },
};

/** Slows down and lingers. Beams: flare out wider toward their end and linger longer. */
const decelerate: ModifierDef = {
  id: 'decelerate',
  color: '#8a94b0',
  trail: 'dust',
  order: 71,
  prepare(st, prof) {
    st.v0 = 1.5 + 0.3 * st.stacks;
    st.v1 = Math.max(0.12, 0.25 - 0.02 * st.stacks);
    // Beams linger (+20 % lance / +25 % laser life per stack).
    prof.lanceLife *= 1 + 0.2 * st.stacks;
    prof.laserLife *= 1 + 0.25 * st.stacks;
  },
  motion(s, st, _w, dt) {
    const min = s.baseSpeed * st.v1;
    const v = s.speed * (1 - st.v0 * dt);
    s.speed = v < min ? min : v;
    if (s.kind === SK_BEAM) s.sizeMul *= Math.sqrt(s.baseSpeed / s.speed);
  },
};

/** Ricochets off walls and rocks: 2 bounces per stack. */
const bounce: ModifierDef = {
  id: 'bounce',
  color: '#9be35a',
  shape: 'gear',
  order: 80,
  prepare(st) {
    st.v0 = 2 * st.stacks + (st.params.bounces ?? 0);
  },
  initShot(s, st) {
    s.bounceLeft += st.v0;
  },
  wall(s) {
    if (s.bounceLeft <= 0) return false;
    s.bounceLeft--;
    return true;
  },
};

/**
 * Passes through rocks and props (walls still stop it); +10 % range per stack. The Storm Lance already
 * passes rocks, so on its beams each stack adds +15 % damage instead (nothing is in the way to soak it).
 */
const phase: ModifierDef = {
  id: 'phase',
  color: '#d8e8ff',
  trail: 'wisps',
  order: 90,
  prepare(st, prof) {
    st.v0 = prof.primary === 'lance' ? 1 + 0.15 * st.stacks : 1;
  },
  initShot(s, st) {
    s.flags |= F_PHASE;
    if (s.kind !== SK_BEAM) s.range *= 1 + 0.1 * st.stacks;
    else s.baseDamage *= st.v0;
  },
};

export const MOTION_MODIFIERS: readonly ModifierDef[] = [
  homing,
  wavy,
  orbitPlayer,
  boomerang,
  spiral,
  grow,
  shrink,
  accelerate,
  decelerate,
  bounce,
  phase,
];
