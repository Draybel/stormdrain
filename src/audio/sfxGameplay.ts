/**
 * Gameplay sounds for items, pickups, bombs and room props (Phase 2 part A). Same recipe format as
 * the core sounds in sfx.ts: short oscillator/noise recipes with envelopes, no audio files.
 */

import { later, noise, osc, type Recipe } from './synth';

export const GAMEPLAY_RECIPES = {
  // Two bright notes: the classic coin "ting-ting".
  coin: {
    minGap: 0.04,
    length: 0.16,
    gain: 0.4,
    play(v) {
      osc(v, 'square', 1568, 1568, 0.05, 0.14);
      later(v, 0.055, () => osc(v, 'square', 2093, 2093, 0.1, 0.13));
    },
  },
  // Silver / gold: a quick rising arpeggio with a shimmer.
  coin_big: {
    minGap: 0.05,
    length: 0.28,
    gain: 0.42,
    play(v) {
      osc(v, 'square', 1319, 1319, 0.05, 0.12);
      later(v, 0.05, () => osc(v, 'square', 1760, 1760, 0.05, 0.12));
      later(v, 0.1, () => osc(v, 'square', 2637, 2637, 0.14, 0.12));
      later(v, 0.1, () => osc(v, 'sine', 5274, 5274, 0.12, 0.04));
    },
  },
  // Metallic key clink.
  key: {
    minGap: 0.05,
    length: 0.2,
    gain: 0.45,
    play(v) {
      osc(v, 'triangle', 2400 * (1 + v.jitter * 0.03), 2300, 0.08, 0.25);
      later(v, 0.06, () => osc(v, 'triangle', 3100, 3000, 0.1, 0.18));
      noise(v, 'highpass', 5000, 7000, 0.8, 0.04, 0.1);
    },
  },
  // A heavy little thunk.
  bomb_pickup: {
    minGap: 0.05,
    length: 0.2,
    gain: 0.55,
    play(v) {
      osc(v, 'sine', 180, 90, 0.12, 0.5);
      noise(v, 'lowpass', 1200, 300, 0.8, 0.08, 0.25);
      later(v, 0.07, () => osc(v, 'square', 520, 520, 0.04, 0.08));
    },
  },
  // Warm "gulp" + chime.
  heart: {
    minGap: 0.06,
    length: 0.3,
    gain: 0.45,
    play(v) {
      osc(v, 'sine', 392, 587, 0.12, 0.35);
      later(v, 0.08, () => osc(v, 'triangle', 784, 988, 0.18, 0.18));
    },
  },
  tin_heart: {
    minGap: 0.06,
    length: 0.3,
    gain: 0.4,
    play(v) {
      osc(v, 'triangle', 880, 880, 0.2, 0.25);
      osc(v, 'triangle', 1318, 1318, 0.22, 0.15);
      later(v, 0.07, () => osc(v, 'sine', 1760, 1760, 0.2, 0.1));
    },
  },
  ember_heart: {
    minGap: 0.06,
    length: 0.4,
    gain: 0.45,
    play(v) {
      noise(v, 'bandpass', 600, 2400, 1.2, 0.3, 0.25, 0.04);
      osc(v, 'sine', 330, 660, 0.25, 0.3);
      later(v, 0.1, () => osc(v, 'triangle', 988, 1318, 0.2, 0.12));
    },
  },
  // A Tin heart shatters.
  tin_break: {
    minGap: 0.08,
    length: 0.3,
    gain: 0.4,
    play(v) {
      noise(v, 'highpass', 3000, 6000, 0.9, 0.15, 0.3);
      osc(v, 'triangle', 1400, 700, 0.2, 0.2);
    },
  },
  // Electric zap of a Spark Cell.
  spark: {
    minGap: 0.06,
    length: 0.25,
    gain: 0.38,
    play(v) {
      osc(v, 'sawtooth', 700, 2400, 0.12, 0.18);
      noise(v, 'highpass', 4000, 8000, 0.7, 0.1, 0.15);
      later(v, 0.1, () => osc(v, 'square', 1760, 1760, 0.1, 0.1));
    },
  },
  // Creak open + a sparkle of loot.
  chest_open: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.5,
    play(v) {
      osc(v, 'triangle', 160, 240, 0.16, 0.3, 0.02);
      noise(v, 'bandpass', 900, 500, 3, 0.15, 0.2, 0.01);
      later(v, 0.14, () => osc(v, 'square', 1046, 1046, 0.06, 0.1));
      later(v, 0.2, () => osc(v, 'square', 1568, 1568, 0.06, 0.1));
      later(v, 0.26, () => osc(v, 'square', 2093, 2093, 0.12, 0.1));
    },
  },
  // Rattling a locked box.
  locked: {
    minGap: 0.2,
    length: 0.2,
    gain: 0.45,
    play(v) {
      osc(v, 'square', 170, 140, 0.05, 0.2);
      noise(v, 'bandpass', 1200, 900, 2, 0.05, 0.2);
      later(v, 0.08, () => osc(v, 'square', 150, 120, 0.06, 0.18));
    },
  },
  // Item fanfare: a bright rising arpeggio with a soft pad underneath.
  item_get: {
    minGap: 0.3,
    length: 0.9,
    gain: 0.5,
    play(v) {
      const notes = [523, 659, 784, 1046];
      for (let i = 0; i < notes.length; i++) later(v, i * 0.075, () => osc(v, 'square', notes[i]!, notes[i]!, 0.12, 0.13));
      later(v, 0.3, () => osc(v, 'triangle', 1046, 1046, 0.5, 0.18, 0.02));
      later(v, 0.3, () => osc(v, 'triangle', 1318, 1318, 0.5, 0.12, 0.02));
      osc(v, 'sine', 131, 131, 0.7, 0.2, 0.05);
    },
  },
  // Bomb set down + fuse catching.
  bomb_place: {
    minGap: 0.08,
    length: 0.3,
    gain: 0.45,
    play(v) {
      osc(v, 'sine', 150, 100, 0.08, 0.35);
      later(v, 0.05, () => noise(v, 'highpass', 3000, 6000, 0.7, 0.22, 0.15, 0.02));
    },
  },
  // BOOM: low thump, rumble, crackle.
  explosion: {
    minGap: 0.05,
    length: 1.1,
    gain: 0.9,
    play(v) {
      osc(v, 'sine', 110 * (1 + v.jitter * 0.05), 32, 0.5, 0.8, 0.003);
      noise(v, 'lowpass', 2400, 90, 0.7, 0.9, 0.7, 0.003);
      noise(v, 'bandpass', 900, 200, 0.6, 0.35, 0.35);
      later(v, 0.08, () => noise(v, 'highpass', 2500, 1200, 0.5, 0.25, 0.12));
    },
  },
  rock_break: {
    minGap: 0.05,
    length: 0.35,
    gain: 0.6,
    play(v) {
      noise(v, 'bandpass', 900, 200, 0.9, 0.3, 0.45);
      osc(v, 'sine', 140, 60, 0.18, 0.35);
    },
  },
  crate_break: {
    minGap: 0.05,
    length: 0.3,
    gain: 0.55,
    play(v) {
      noise(v, 'bandpass', 1600, 500, 1.5, 0.2, 0.4);
      osc(v, 'square', 220, 110, 0.1, 0.12);
      later(v, 0.05, () => noise(v, 'bandpass', 900, 400, 2, 0.12, 0.25));
    },
  },
  // A wooden knock (crate takes a hit).
  crate_hit: {
    minGap: 0.04,
    length: 0.1,
    gain: 0.45,
    play(v) {
      noise(v, 'bandpass', 1300 * (1 + v.jitter * 0.1), 700, 3, 0.06, 0.35);
      osc(v, 'triangle', 300, 200, 0.06, 0.2);
    },
  },
  urn_break: {
    minGap: 0.05,
    length: 0.35,
    gain: 0.5,
    play(v) {
      noise(v, 'highpass', 2500, 4000, 0.8, 0.18, 0.35);
      osc(v, 'triangle', 2500, 2400, 0.08, 0.12);
      later(v, 0.05, () => osc(v, 'triangle', 3200, 3100, 0.1, 0.1));
      later(v, 0.1, () => osc(v, 'triangle', 1900, 1850, 0.12, 0.08));
    },
  },
  // A shot sizzles into a fire.
  fire_hit: {
    minGap: 0.05,
    length: 0.15,
    gain: 0.35,
    play(v) {
      noise(v, 'highpass', 4000, 2500, 0.7, 0.12, 0.3);
    },
  },
  // Fire put out: a long hiss of steam.
  fire_out: {
    minGap: 0.1,
    length: 0.6,
    gain: 0.45,
    play(v) {
      noise(v, 'bandpass', 3500, 900, 0.8, 0.5, 0.4, 0.01);
      osc(v, 'sine', 300, 120, 0.2, 0.15);
    },
  },
  // Ember nova: a whoosh ring.
  nova: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.55,
    play(v) {
      noise(v, 'bandpass', 400, 3000, 1.2, 0.35, 0.45, 0.01);
      osc(v, 'sine', 220, 880, 0.3, 0.25);
    },
  },
  // Lightning shockwave (Jar of Lightning).
  shock: {
    minGap: 0.1,
    length: 0.6,
    gain: 0.6,
    play(v) {
      osc(v, 'sawtooth', 1800, 120, 0.35, 0.35);
      noise(v, 'highpass', 6000, 1500, 0.6, 0.4, 0.4);
      osc(v, 'sine', 90, 40, 0.45, 0.45);
    },
  },
  // Active item used.
  power_up: {
    minGap: 0.1,
    length: 0.4,
    gain: 0.45,
    play(v) {
      osc(v, 'triangle', 440, 1320, 0.25, 0.3);
      later(v, 0.1, () => osc(v, 'square', 1760, 1760, 0.12, 0.08));
    },
  },
  // Consumable used: bubbly glugs.
  tonic: {
    minGap: 0.1,
    length: 0.4,
    gain: 0.45,
    play(v) {
      osc(v, 'sine', 300, 520, 0.08, 0.3);
      later(v, 0.1, () => osc(v, 'sine', 340, 600, 0.08, 0.28));
      later(v, 0.2, () => osc(v, 'sine', 400, 760, 0.1, 0.25));
    },
  },
  // Refused action (no bombs, not charged…): a soft double bonk.
  denied: {
    minGap: 0.15,
    length: 0.2,
    gain: 0.35,
    play(v) {
      osc(v, 'square', 200, 180, 0.05, 0.15);
      later(v, 0.08, () => osc(v, 'square', 160, 140, 0.07, 0.15));
    },
  },
  // Active fully charged: a two-tone chime.
  charged: {
    minGap: 0.2,
    length: 0.4,
    gain: 0.4,
    play(v) {
      osc(v, 'triangle', 1046, 1046, 0.1, 0.25);
      later(v, 0.09, () => osc(v, 'triangle', 1568, 1568, 0.25, 0.25));
    },
  },
  // Coins landing on stone.
  tink: {
    minGap: 0.05,
    length: 0.06,
    gain: 0.18,
    play(v) {
      osc(v, 'sine', 3000 * (1 + v.jitter * 0.1), 2600, 0.04, 0.2);
    },
  },
} satisfies Record<string, Recipe>;

export type GameplaySfxName = keyof typeof GAMEPLAY_RECIPES;
