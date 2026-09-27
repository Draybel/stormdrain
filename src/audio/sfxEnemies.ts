/**
 * Enemy, status and room-combat sounds (Phase 2 part C). Same recipe format as sfx.ts / sfxGameplay.ts.
 * Names are prefixed (foe_, eshot_, gate_, room_, st_) so they never collide with other recipe sets.
 */

import { later, noise, osc, type Recipe } from './synth';

export const ENEMY_RECIPES = {
  // Squishy thwack when a shot lands on something alive.
  foe_hit: {
    minGap: 0.03,
    length: 0.12,
    gain: 0.5,
    play(v) {
      noise(v, 'bandpass', 900 * (1 + v.jitter * 0.1), 380, 1.2, 0.07, 0.45);
      osc(v, 'sine', 190, 85, 0.08, 0.35);
    },
  },
  // Wet pop.
  foe_die: {
    minGap: 0.05,
    length: 0.3,
    gain: 0.6,
    play(v) {
      osc(v, 'sine', 320 * (1 + v.jitter * 0.08), 70, 0.16, 0.45, 0.004);
      noise(v, 'lowpass', 2200, 180, 0.8, 0.22, 0.4, 0.004);
    },
  },
  // Heavier splat for big things.
  foe_die_big: {
    minGap: 0.08,
    length: 0.5,
    gain: 0.7,
    play(v) {
      osc(v, 'sine', 170, 38, 0.32, 0.55, 0.004);
      osc(v, 'square', 90, 45, 0.18, 0.1);
      noise(v, 'lowpass', 1400, 90, 0.7, 0.4, 0.5, 0.006);
    },
  },
  // "Ptew" spit.
  foe_shoot: {
    minGap: 0.05,
    length: 0.12,
    gain: 0.38,
    play(v) {
      noise(v, 'bandpass', 1700 * (1 + v.jitter * 0.1), 700, 1.5, 0.05, 0.35);
      osc(v, 'triangle', 540, 250, 0.07, 0.25);
    },
  },
  // Bloop of a lobbed glob.
  foe_lob: {
    minGap: 0.08,
    length: 0.25,
    gain: 0.4,
    play(v) {
      osc(v, 'sine', 220, 520, 0.09, 0.35);
      later(v, 0.09, () => osc(v, 'sine', 520, 260, 0.12, 0.25));
    },
  },
  // Soft poof as something appears.
  foe_spawn: {
    minGap: 0.04,
    length: 0.22,
    gain: 0.3,
    play(v) {
      noise(v, 'lowpass', 500, 1900, 0.8, 0.16, 0.35, 0.02);
      osc(v, 'triangle', 170, 340, 0.14, 0.2, 0.02);
    },
  },
  foe_hop: {
    minGap: 0.05,
    length: 0.12,
    gain: 0.3,
    play(v) {
      osc(v, 'sine', 240 * (1 + v.jitter * 0.1), 620, 0.08, 0.3);
    },
  },
  foe_land: {
    minGap: 0.05,
    length: 0.16,
    gain: 0.4,
    play(v) {
      osc(v, 'sine', 130, 50, 0.12, 0.45);
      noise(v, 'lowpass', 700, 140, 0.7, 0.1, 0.3);
    },
  },
  // Ground ripple.
  foe_quake: {
    minGap: 0.1,
    length: 0.4,
    gain: 0.55,
    play(v) {
      osc(v, 'sine', 80, 36, 0.35, 0.5, 0.01);
      noise(v, 'lowpass', 420, 90, 0.7, 0.35, 0.4, 0.01);
    },
  },
  // Digging in.
  foe_burrow: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.4,
    play(v) {
      noise(v, 'bandpass', 520, 180, 1.1, 0.26, 0.45, 0.01);
      osc(v, 'sine', 140, 70, 0.2, 0.2);
    },
  },
  // Low rumble: something is about to surface (the audible telegraph).
  foe_rumble: {
    minGap: 0.15,
    length: 0.5,
    gain: 0.45,
    play(v) {
      noise(v, 'lowpass', 180, 320, 0.9, 0.45, 0.45, 0.08);
      osc(v, 'sine', 55, 75, 0.45, 0.25, 0.08);
    },
  },
  foe_emerge: {
    minGap: 0.1,
    length: 0.25,
    gain: 0.45,
    play(v) {
      noise(v, 'lowpass', 1600, 300, 0.8, 0.18, 0.45);
      osc(v, 'sine', 140, 320, 0.12, 0.3);
    },
  },
  // Teleport shimmer.
  foe_blink: {
    minGap: 0.08,
    length: 0.28,
    gain: 0.3,
    play(v) {
      osc(v, 'triangle', 1200, 2400, 0.12, 0.25);
      later(v, 0.1, () => osc(v, 'triangle', 1800, 900, 0.14, 0.2));
    },
  },
  // Attack wind-up: a quick rising "hnn".
  foe_windup: {
    minGap: 0.08,
    length: 0.16,
    gain: 0.22,
    play(v) {
      osc(v, 'triangle', 380 * (1 + v.jitter * 0.05), 720, 0.13, 0.25, 0.02);
    },
  },
  // Dash wind-up: claws scraping stone.
  foe_scrape: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.35,
    play(v) {
      noise(v, 'highpass', 2200, 3200, 0.8, 0.22, 0.25, 0.02);
      osc(v, 'triangle', 280, 560, 0.25, 0.18, 0.02);
    },
  },
  foe_dash: {
    minGap: 0.08,
    length: 0.2,
    gain: 0.35,
    play(v) {
      noise(v, 'bandpass', 700, 2600, 1, 0.16, 0.4);
    },
  },
  // Crab meets wall.
  foe_bonk: {
    minGap: 0.08,
    length: 0.25,
    gain: 0.55,
    play(v) {
      osc(v, 'square', 190, 110, 0.08, 0.2);
      osc(v, 'triangle', 760, 520, 0.18, 0.3);
      noise(v, 'bandpass', 2400, 1200, 1.2, 0.06, 0.3);
    },
  },
  // An enemy shot popping on a wall / on you.
  eshot_pop: {
    minGap: 0.03,
    length: 0.06,
    gain: 0.22,
    play(v) {
      osc(v, 'sine', 950 * (1 + v.jitter * 0.12), 380, 0.045, 0.25);
    },
  },
  // Doors: iron bars slam down / swing up.
  gate_shut: {
    minGap: 0.2,
    length: 0.35,
    gain: 0.6,
    play(v) {
      osc(v, 'square', 110, 70, 0.18, 0.25);
      noise(v, 'lowpass', 1600, 200, 0.8, 0.2, 0.45);
      later(v, 0.08, () => osc(v, 'triangle', 320, 300, 0.12, 0.2));
    },
  },
  gate_open: {
    minGap: 0.2,
    length: 0.35,
    gain: 0.5,
    play(v) {
      osc(v, 'triangle', 200, 330, 0.22, 0.25, 0.02);
      noise(v, 'bandpass', 1200, 900, 1, 0.12, 0.25);
      later(v, 0.16, () => osc(v, 'square', 150, 120, 0.1, 0.15));
    },
  },
  // Room cleared: a bright little arpeggio.
  room_clear: {
    minGap: 0.3,
    length: 0.6,
    gain: 0.4,
    play(v) {
      osc(v, 'triangle', 523, 523, 0.1, 0.3);
      later(v, 0.08, () => osc(v, 'triangle', 659, 659, 0.1, 0.3));
      later(v, 0.16, () => osc(v, 'triangle', 784, 784, 0.1, 0.3));
      later(v, 0.24, () => osc(v, 'triangle', 1046, 1046, 0.3, 0.3));
    },
  },
  // Status effects taking hold.
  st_poison: {
    minGap: 0.08,
    length: 0.18,
    gain: 0.3,
    play(v) {
      osc(v, 'sine', 300, 620, 0.06, 0.25);
      later(v, 0.07, () => osc(v, 'sine', 420, 840, 0.06, 0.2));
    },
  },
  st_burn: {
    minGap: 0.08,
    length: 0.22,
    gain: 0.35,
    play(v) {
      noise(v, 'bandpass', 900, 1900, 0.9, 0.2, 0.35, 0.02);
    },
  },
  st_freeze: {
    minGap: 0.08,
    length: 0.22,
    gain: 0.35,
    play(v) {
      osc(v, 'triangle', 1800, 2700, 0.15, 0.25);
      osc(v, 'sine', 3300, 3100, 0.12, 0.1);
    },
  },
  st_slow: {
    minGap: 0.08,
    length: 0.22,
    gain: 0.3,
    play(v) {
      osc(v, 'triangle', 420, 210, 0.2, 0.25);
    },
  },
  st_charm: {
    minGap: 0.08,
    length: 0.28,
    gain: 0.32,
    play(v) {
      osc(v, 'triangle', 880, 1175, 0.12, 0.25);
      later(v, 0.1, () => osc(v, 'triangle', 1175, 1568, 0.14, 0.22));
    },
  },
  st_fear: {
    minGap: 0.08,
    length: 0.25,
    gain: 0.3,
    play(v) {
      osc(v, 'triangle', 620, 300, 0.22, 0.25);
      osc(v, 'sine', 640, 310, 0.22, 0.12);
    },
  },
  // Frozen enemy shattering.
  st_shatter: {
    minGap: 0.06,
    length: 0.3,
    gain: 0.5,
    play(v) {
      noise(v, 'highpass', 3600, 5200, 0.8, 0.2, 0.45);
      osc(v, 'triangle', 2400, 1100, 0.18, 0.25);
      later(v, 0.05, () => osc(v, 'triangle', 3100, 1600, 0.12, 0.18));
    },
  },
} satisfies Record<string, Recipe>;

export type EnemySfxName = keyof typeof ENEMY_RECIPES;
