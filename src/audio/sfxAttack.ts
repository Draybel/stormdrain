/**
 * Attack-pipeline sounds (Phase 2B), same recipe format as sfx.ts. `v.param` (0..1+, passed by the
 * caller) drives pitch / intensity where it matters (the lance charge rises as it fills).
 * Names are prefixed (lance_, laser_, swipe, blade_, shot_, chain_, charge_…) so they can't collide
 * with other recipe sets.
 */

import { later, noise, osc, type Recipe } from './synth';

export const ATTACK_RECIPES = {
  /** A rising electric hum tick while the Storm Lance charges (param = charge level 0..2). */
  lance_charge: {
    minGap: 0.06,
    length: 0.14,
    gain: 0.32,
    play(v) {
      const lvl = Math.min(2, v.param);
      const f = 110 + 360 * Math.min(1, lvl) + 180 * Math.max(0, lvl - 1);
      osc(v, 'sawtooth', f, f * 1.08, 0.11, 0.18);
      osc(v, 'sine', f * 2, f * 2.1, 0.09, 0.12);
      noise(v, 'bandpass', 2400 + 2400 * Math.min(1, lvl), 3600, 3, 0.06, 0.08 + 0.1 * Math.min(1, lvl));
    },
  },
  /** Fully charged: a bright rising chime with static. */
  lance_ready: {
    minGap: 0.2,
    length: 0.35,
    gain: 0.45,
    play(v) {
      const k = v.param >= 2 ? 1.5 : 1;
      osc(v, 'triangle', 660 * k, 690 * k, 0.12, 0.3);
      later(v, 0.06, () => osc(v, 'triangle', 990 * k, 1020 * k, 0.14, 0.25));
      later(v, 0.12, () => osc(v, 'sine', 1320 * k, 1400 * k, 0.2, 0.22));
      noise(v, 'highpass', 5000, 7000, 0.8, 0.18, 0.12);
    },
  },
  /** The release: a deep thunder boom under a searing crack. */
  lance_fire: {
    minGap: 0.1,
    length: 1.1,
    gain: 0.95,
    play(v) {
      const k = v.param > 0 ? 1.35 : 1; // mini lances (familiars) are pitched up
      osc(v, 'sine', 120 * k, 28 * k, 0.9, 0.9, 0.003);
      osc(v, 'square', 70 * k, 32 * k, 0.5, 0.18, 0.003);
      osc(v, 'sawtooth', 1800 * k, 200 * k, 0.12, 0.2, 0.001);
      noise(v, 'lowpass', 5200, 120, 0.7, 0.9, 0.7, 0.002);
      noise(v, 'highpass', 3000, 6000, 1, 0.08, 0.5, 0.001);
      later(v, 0.08, () => noise(v, 'bandpass', 2600, 900, 2, 0.12, 0.35));
      later(v, 0.2, () => noise(v, 'bandpass', 3400, 1400, 2.5, 0.1, 0.25));
    },
  },
  /** Electric crackle (a few quick static pops). */
  crackle: {
    minGap: 0.08,
    length: 0.45,
    gain: 0.4,
    play(v) {
      for (let i = 0; i < 6; i++) {
        later(v, i * 0.055 + Math.random() * 0.03, () => noise(v, 'highpass', 2500 + Math.random() * 3000, 6000, 1.5, 0.025, 0.3 + Math.random() * 0.2));
      }
    },
  },
  /** Let go too early: a sad little sputter. */
  lance_fizzle: {
    minGap: 0.1,
    length: 0.2,
    gain: 0.35,
    play(v) {
      noise(v, 'bandpass', 3200, 700, 1.5, 0.12, 0.35);
      osc(v, 'square', 420, 160, 0.1, 0.1);
    },
  },
  /** Thin laser zap. */
  laser_zap: {
    minGap: 0.035,
    length: 0.1,
    gain: 0.3,
    play(v) {
      const f = 1900 * (1 + v.jitter * 0.06) * (v.param > 0 ? 1.4 : 1);
      osc(v, 'square', f, f * 0.3, 0.07, 0.22);
      noise(v, 'highpass', 4000, 7000, 0.8, 0.03, 0.1);
    },
  },
  /** Melee whoosh. */
  swipe: {
    minGap: 0.05,
    length: 0.16,
    gain: 0.45,
    play(v) {
      noise(v, 'bandpass', 500, 2600, 1.2, 0.12, 0.45, 0.01);
      osc(v, 'sine', 180, 320, 0.08, 0.12);
    },
  },
  /** A swipe connecting: a meaty thwack. */
  swipe_hit: {
    minGap: 0.04,
    length: 0.18,
    gain: 0.6,
    play(v) {
      noise(v, 'lowpass', 2400, 300, 0.9, 0.1, 0.55);
      osc(v, 'sine', 160, 60, 0.12, 0.5);
    },
  },
  /** Boomerang throw (a spinning whirr). */
  blade_throw: {
    minGap: 0.05,
    length: 0.2,
    gain: 0.3,
    play(v) {
      osc(v, 'triangle', 420, 640, 0.14, 0.18);
      noise(v, 'bandpass', 1400, 2200, 3, 0.14, 0.15);
    },
  },
  /** Caught it: a metallic clink. */
  blade_catch: {
    minGap: 0.05,
    length: 0.15,
    gain: 0.35,
    play(v) {
      osc(v, 'triangle', 2400, 2300, 0.08, 0.25);
      osc(v, 'sine', 3600, 3400, 0.06, 0.12);
    },
  },
  /** A shot's small explosion. */
  shot_boom: {
    minGap: 0.05,
    length: 0.3,
    gain: 0.55,
    play(v) {
      osc(v, 'sine', 170 * (1 + v.jitter * 0.08), 45, 0.24, 0.55, 0.003);
      noise(v, 'lowpass', 3200, 180, 0.8, 0.24, 0.5, 0.003);
    },
  },
  /** Chain lightning: a sharp electric snap. */
  chain_zap: {
    minGap: 0.04,
    length: 0.1,
    gain: 0.3,
    play(v) {
      noise(v, 'highpass', 3000, 6000, 1.2, 0.05, 0.35);
      osc(v, 'square', 2200 * (1 + v.jitter * 0.1), 700, 0.05, 0.12);
    },
  },
  /** A shot splitting apart. */
  split_pop: {
    minGap: 0.04,
    length: 0.08,
    gain: 0.25,
    play(v) {
      osc(v, 'sine', 900, 1600, 0.05, 0.25);
    },
  },
  /** A bounce off a wall. */
  bounce_tink: {
    minGap: 0.04,
    length: 0.06,
    gain: 0.2,
    play(v) {
      osc(v, 'sine', 1800 * (1 + v.jitter * 0.1), 1300, 0.045, 0.25);
    },
  },
  /** Charge-rider meter tick (param = level 0..1). */
  charge_tick: {
    minGap: 0.06,
    length: 0.08,
    gain: 0.22,
    play(v) {
      const f = 280 + 700 * Math.min(1, v.param);
      osc(v, 'triangle', f, f * 1.05, 0.06, 0.2);
    },
  },
  /** Charge-rider release (param = level). */
  charge_release: {
    minGap: 0.08,
    length: 0.3,
    gain: 0.45,
    play(v) {
      const k = 0.6 + Math.min(1, v.param);
      noise(v, 'bandpass', 700 * k, 2600 * k, 1.1, 0.16, 0.4, 0.005);
      osc(v, 'sawtooth', 200 * k, 90 * k, 0.2, 0.2 * k);
    },
  },
  /** Wren's keeper marble: a sparkly chime. */
  keeper_chime: {
    minGap: 0.2,
    length: 0.4,
    gain: 0.35,
    play(v) {
      osc(v, 'triangle', 1320, 1340, 0.1, 0.3);
      later(v, 0.07, () => osc(v, 'triangle', 1760, 1780, 0.12, 0.25));
      later(v, 0.14, () => osc(v, 'sine', 2640, 2700, 0.18, 0.18));
    },
  },
  /** A familiar pops in. */
  familiar_poof: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.35,
    play(v) {
      osc(v, 'sine', 330, 880, 0.14, 0.3, 0.01);
      later(v, 0.1, () => osc(v, 'triangle', 880, 990, 0.12, 0.18));
    },
  },
  /** Orbit blades whirl into place. */
  blade_whirr: {
    minGap: 0.12,
    length: 0.25,
    gain: 0.25,
    play(v) {
      noise(v, 'bandpass', 900, 2600, 4, 0.2, 0.25, 0.02);
    },
  },
} satisfies Record<string, Recipe>;

export type AttackSfxName = keyof typeof ATTACK_RECIPES;
