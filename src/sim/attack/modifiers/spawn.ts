/**
 * Spawn-stage modifiers (§4.4): they edit the volley (SpawnCtx) before the carrier turns every spec
 * into projectiles, beams or swipes — so they work the same for marbles, blades, crescents, lances
 * and lasers.
 */

import { F_CIRCLING, SF_BACK, SF_CIRCLE, SF_EXTRA, SF_MAIN, SF_PELLET, SF_SIDE, SK_BEAM, type ModifierDef, type SpawnCtx } from '../state';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** +1 shot per stack, in an even fan around every spec already in the volley. */
const extraShots: ModifierDef = {
  id: 'extraShots',
  order: 10,
  prepare(st, prof) {
    st.v0 = st.stacks + (st.params.shots ?? 0);
    // Beams fan a little tighter than shots (they are long).
    st.v1 = (prof.beam ? 8 : 10) * DEG;
  },
  spawn(ctx, st) {
    const extra = Math.max(0, Math.round(st.v0));
    if (extra === 0) return;
    const step = st.v1;
    const base = ctx.count;
    for (let i = 0; i < base; i++) {
      const a = ctx.ang[i]!;
      const first = a - (extra * step) / 2;
      ctx.ang[i] = first;
      const fl = (ctx.flags[i]! & ~SF_MAIN) | SF_EXTRA;
      for (let j = 1; j <= extra; j++) {
        if (ctx.add(first + j * step, ctx.dmg[i], ctx.size[i], ctx.speed[i], fl, ctx.delay[i]) < 0) return;
      }
    }
  },
};

/** Shotgun pellets: +2 smaller shots per stack scattered in a cone around the main shot. */
const spread: ModifierDef = {
  id: 'spread',
  order: 20,
  prepare(st) {
    st.v0 = 2 * st.stacks;
    st.v1 = (10 + 4 * st.stacks) * DEG;
  },
  spawn(ctx, st) {
    const rng = ctx.rng;
    const n = st.v0;
    const cone = st.v1;
    for (let k = 0; k < n; k++) {
      // Evenly covered cone with a little jitter, so the pattern reads as a spray.
      const t = n > 1 ? k / (n - 1) : 0.5;
      const a = -cone + 2 * cone * t + (rng.next() - 0.5) * cone * 0.35;
      if (ctx.add(a, 0.5, 0.7, 0.8 + rng.next() * 0.35, SF_PELLET) < 0) return;
    }
  },
};

/** Shots out of your back: one per stack, fanned behind you. */
const backShot: ModifierDef = {
  id: 'backShot',
  order: 30,
  prepare(st) {
    st.v0 = st.stacks;
  },
  spawn(ctx, st) {
    const n = st.v0;
    for (let j = 0; j < n; j++) {
      if (ctx.add(Math.PI + (j - (n - 1) / 2) * 12 * DEG, 1, 1, 1, SF_BACK) < 0) return;
    }
  },
};

/** Shots to both sides: a pair per stack (±90°, then ±70°, ±110°, ±50°…). */
const sideShots: ModifierDef = {
  id: 'sideShots',
  order: 40,
  prepare(st) {
    st.v0 = st.stacks;
  },
  spawn(ctx, st) {
    for (let k = 0; k < st.v0; k++) {
      const off = 90 + (k % 2 === 1 ? -1 : 1) * Math.ceil(k / 2) * 20;
      if (ctx.add(off * DEG, 0.8, 1, 1, SF_SIDE) < 0) return;
      if (ctx.add(-off * DEG, 0.8, 1, 1, SF_SIDE) < 0) return;
    }
  },
};

/**
 * Tiny planet. Spawn stage: a BEAM volley becomes a ring — every spec already in the volley (extra,
 * back, side shots, pellets…) gets `stacks` more copies, all spaced evenly around the circle, so
 * the ring multiplies with the other spawn modifiers instead of swallowing them. The motion part
 * lives in modifiers/motion.ts.
 */
export function orbitRing(ctx: SpawnCtx, stacks: number): void {
  if (!ctx.beam) return;
  const base = ctx.count;
  const want = Math.min(ctx.cap, base * (1 + stacks));
  for (let k = base; k < want; k++) {
    const i = ctx.add(0);
    if (i < 0) break;
    ctx.copy(k % base, i);
    ctx.flags[i] = (ctx.flags[i]! & ~SF_MAIN) | SF_EXTRA;
  }
  const n = ctx.count;
  for (let i = 0; i < n; i++) ctx.ang[i] = (i / n) * TAU;
}

/** Shots circle you first (one lap), then launch toward where you aimed. */
const circleFirst: ModifierDef = {
  id: 'circleFirst',
  color: '#c9a0ff',
  order: 50,
  prepare(st) {
    // Lap time (s) and circle radius (px): more stacks = a wider, slower, more menacing lap.
    st.v0 = 0.35 + 0.1 * st.stacks;
    st.v1 = 12 + 2 * st.stacks;
    // Beams: spin time.
    st.v2 = 0.2 + 0.05 * st.stacks;
  },
  spawn(ctx) {
    for (let i = 0; i < ctx.count; i++) ctx.flags[i] = ctx.flags[i]! | SF_CIRCLE;
  },
  initShot(s, st) {
    if (s.kind === SK_BEAM) return; // beams spin in beamTick
    if ((s.flags & F_CIRCLING) === 0) return;
    const o = st.slot;
    s.m[o] = st.v0; // lap time left
    s.m[o + 1] = Math.atan2(s.y - s.ay, s.x - s.ax); // current angle around the owner
    s.m[o + 2] = 0; // radius so far
  },
  motion(s, st, _w, dt) {
    if ((s.flags & F_CIRCLING) === 0 || s.kind === SK_BEAM) return;
    const o = st.slot;
    const left = s.m[o]! - dt;
    s.m[o] = left;
    if (left <= 0) {
      // Launch: leave along the aim from wherever the lap ended.
      s.flags &= ~F_CIRCLING;
      return;
    }
    const lapW = TAU / st.v0;
    const r = Math.min(st.v1, s.m[o + 2]! + 90 * dt);
    s.m[o + 2] = r;
    const a = s.m[o + 1]! + s.spin * lapW * dt;
    s.m[o + 1] = a;
    const tx = s.ax + Math.cos(a) * r;
    const ty = s.ay + Math.sin(a) * r;
    s.ovr = true;
    s.ovx = (tx - s.x) / dt;
    s.ovy = (ty - s.y) / dt;
  },
  beamTick(b, st, _w, _dt) {
    // Beams sweep one full circle around you before settling on the aim (first trace at 0: the spin
    // starts on the aim). Short beams (lasers) finish the circle within 60 % of their life.
    const t = (b.ticks - 1) / 60;
    const spin = Math.min(st.v2, b.life * 0.6);
    b.spinAng = t < spin ? (t / spin) * TAU * b.spin : 0;
  },
};

/** Wobbly aim: every shot is scattered a little (and hits a little harder to make up for it). */
const inaccuracy: ModifierDef = {
  id: 'inaccuracy',
  order: 90,
  prepare(st) {
    st.v0 = (5 + 4 * st.stacks) * DEG;
    st.v1 = 1 + 0.08 * st.stacks;
  },
  spawn(ctx, st) {
    const rng = ctx.rng;
    for (let i = 0; i < ctx.count; i++) {
      ctx.ang[i] = ctx.ang[i]! + (rng.next() * 2 - 1) * st.v0;
      ctx.speed[i] = ctx.speed[i]! * (0.9 + rng.next() * 0.2);
      ctx.dmg[i] = ctx.dmg[i]! * st.v1;
    }
  },
};

export const SPAWN_MODIFIERS: readonly ModifierDef[] = [extraShots, spread, backShot, sideShots, circleFirst, inaccuracy];
