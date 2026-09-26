/**
 * The full procedural SFX library (~80 recipes), registered into the core SfxPlayer (sfx.ts) when
 * this module loads — engine.ts imports it once. Play by name: `app.audio.play('coin')`, or from
 * the sim with an `sfx` event whose id is the name.
 *
 * Every recipe: a per-sound voice limit (`maxVoices`), a minimum retrigger gap, and slight random
 * pitch (`v.jitter` is a fresh ±1 each play). All scheduling is on the AudioContext clock; every
 * source is stopped right after its envelope so the browser frees the nodes.
 */

import { registerSfx, type Recipe, type Voice } from './sfx';

const MIN = 0.0001;

function clampF(f: number): number {
  return f < 20 ? 20 : f > 18000 ? 18000 : f;
}

/** Pitch multiplier from the voice jitter: ±`amount` (e.g. 0.05 = ±5 %). */
function pj(v: Voice, amount = 0.05): number {
  return 1 + v.jitter * amount;
}

/** Attack to `peak`, exponential decay to silence. */
function envelope(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
  g.gain.setValueAtTime(MIN, t);
  g.gain.linearRampToValueAtTime(Math.max(MIN * 2, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(MIN, t + attack + decay);
}

/** Oscillator sweeping f0 → f1 over its length, with an attack/decay envelope. Returns the oscillator. */
function tone(
  v: Voice,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  peak: number,
  dt = 0,
  attack = 0.004,
): OscillatorNode {
  const ctx = v.ctx;
  const t = v.t + dt;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(clampF(f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(clampF(f1), t + attack + dur);
  const g = ctx.createGain();
  envelope(g, t, attack, peak, dur);
  o.connect(g).connect(v.out);
  o.start(t);
  o.stop(t + attack + dur + 0.02);
  return o;
}

/** Filtered white noise with a swept filter and an attack/decay envelope. */
function noise(
  v: Voice,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  dt = 0,
  attack = 0.002,
): void {
  const ctx = v.ctx;
  const t = v.t + dt;
  const src = ctx.createBufferSource();
  src.buffer = v.noise;
  const total = attack + dur + 0.02;
  src.loop = total > v.noise.duration - 0.05;
  const offset = src.loop ? 0 : Math.random() * Math.max(0, v.noise.duration - total - 0.05);
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(clampF(f0), t);
  if (f1 !== f0) bq.frequency.exponentialRampToValueAtTime(clampF(f1), t + attack + dur);
  const g = ctx.createGain();
  envelope(g, t, attack, peak, dur);
  src.connect(bq).connect(g).connect(v.out);
  src.start(t, offset);
  src.stop(t + total);
}

/** Noise whose band sweeps f0 → f1 → f2 (doppler whooshes). */
function noiseArc(v: Voice, f0: number, f1: number, f2: number, q: number, dur: number, peak: number, dt = 0): void {
  const ctx = v.ctx;
  const t = v.t + dt;
  const src = ctx.createBufferSource();
  src.buffer = v.noise;
  src.loop = dur + 0.1 > v.noise.duration - 0.05;
  const bq = ctx.createBiquadFilter();
  bq.type = 'bandpass';
  bq.Q.value = q;
  bq.frequency.setValueAtTime(clampF(f0), t);
  bq.frequency.exponentialRampToValueAtTime(clampF(f1), t + dur * 0.5);
  bq.frequency.exponentialRampToValueAtTime(clampF(f2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(MIN, t);
  g.gain.linearRampToValueAtTime(peak, t + dur * 0.45);
  g.gain.exponentialRampToValueAtTime(MIN, t + dur);
  src.connect(bq).connect(g).connect(v.out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

/** Adds vibrato (cents) to an oscillator from `tone`. */
function wobble(v: Voice, o: OscillatorNode, rate: number, cents: number, dur: number, dt = 0): void {
  const t = v.t + dt;
  const lfo = v.ctx.createOscillator();
  lfo.frequency.value = rate;
  const g = v.ctx.createGain();
  g.gain.value = cents;
  lfo.connect(g).connect(o.detune);
  lfo.start(t);
  lfo.stop(t + dur + 0.03);
}

/** FM bell / metal: sine carrier with a decaying modulator at an inharmonic ratio. */
function bell(v: Voice, f: number, dur: number, peak: number, dt = 0, ratio = 2.76, index = 1.6): void {
  const ctx = v.ctx;
  const t = v.t + dt;
  const car = ctx.createOscillator();
  car.frequency.value = clampF(f);
  const mod = ctx.createOscillator();
  mod.frequency.value = clampF(f * ratio);
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * 0.02), t + dur);
  mod.connect(mg).connect(car.frequency);
  const g = ctx.createGain();
  envelope(g, t, 0.002, peak, dur);
  car.connect(g).connect(v.out);
  mod.start(t);
  car.start(t);
  mod.stop(t + dur + 0.03);
  car.stop(t + dur + 0.03);
}

/** A run of notes (fanfares, jingles). `freqs` should be a module-level constant. */
function notes(
  v: Voice,
  type: OscillatorType,
  freqs: readonly number[],
  step: number,
  dur: number,
  peak: number,
  dt = 0,
  mul = 1,
): void {
  for (let i = 0; i < freqs.length; i++) tone(v, type, freqs[i]! * mul, freqs[i]! * mul, dur, peak, dt + i * step);
}

/** Tiny random clicks spread over `span` seconds (crackle, fuse, rattle). */
function ticks(v: Voice, n: number, span: number, fLo: number, fHi: number, peak: number, dt = 0): void {
  for (let i = 0; i < n; i++) {
    const f = fLo + Math.random() * (fHi - fLo);
    noise(v, 'bandpass', f, f, 3, 0.012 + Math.random() * 0.02, peak * (0.4 + Math.random() * 0.6), dt + Math.random() * span);
  }
}

// Note frequencies (equal temperament).
const N = {
  G4: 392,
  A4: 440,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.26,
  F5: 698.46,
  Fs5: 739.99,
  G5: 783.99,
  Gs5: 830.61,
  A5: 880,
  As5: 932.33,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  E6: 1318.51,
  Fs6: 1479.98,
  G6: 1567.98,
  Gs6: 1661.22,
  A6: 1760,
  B6: 1975.53,
  C7: 2093,
  E7: 2637.02,
} as const;

const COIN_SILVER = [N.E6, N.Gs6, N.B6];
const COIN_GOLD = [N.C6, N.E6, N.G6, N.C7];
const ITEM_FANFARE = [N.G5, N.C6, N.E6, N.G6];
const ITEM_CHORD = [N.C6, N.E6, N.G6];
const TRANSFORM_RUN = [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6, N.C7];
const TRANSFORM_CHORD = [N.C5, N.G5, N.E6];
const SECRET = [N.E5, N.As5, N.D6, N.Fs6];
const ACHIEVE = [N.G5, N.B5, N.D6, N.G6];
const SLOT_WIN = [N.C6, N.E6, N.G6, N.C6, N.E6, N.G6, N.C7];
const HEAL = [N.C6, N.E6, N.A6];
const SHOP_BUY = [N.B5, N.E6];
const ACTIVE_READY = [N.E6, N.B6];
const UNLOCK = [N.D6, N.A6];
const HEART = [N.C5, N.G5];
const DONATION = [N.G6, N.D6];

export const SFX_LIBRARY = {
  // ---- Pickups -------------------------------------------------------------------------------
  coin: {
    minGap: 0.03,
    length: 0.3,
    gain: 0.4,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.03);
      tone(v, 'square', N.B5 * p, N.B5 * p, 0.05, 0.16);
      tone(v, 'triangle', N.E6 * p, N.E6 * p, 0.22, 0.35, 0.06);
    },
  },
  coin_silver: {
    minGap: 0.04,
    length: 0.4,
    gain: 0.4,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.02);
      notes(v, 'triangle', COIN_SILVER, 0.045, 0.2, 0.3, 0, p);
      tone(v, 'sine', N.E7 * p, N.E7 * p, 0.3, 0.08, 0.1);
    },
  },
  coin_gold: {
    minGap: 0.06,
    length: 0.6,
    gain: 0.42,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.02);
      notes(v, 'square', COIN_GOLD, 0.045, 0.12, 0.12, 0, p);
      bell(v, N.C7 * p, 0.45, 0.25, 0.17, 3.01, 1.2);
    },
  },
  coin_lucky: {
    minGap: 0.06,
    length: 0.6,
    gain: 0.4,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.02);
      tone(v, 'triangle', N.B5 * p, N.B5 * p, 0.05, 0.25);
      tone(v, 'triangle', N.E6 * p, N.E6 * p, 0.2, 0.3, 0.06);
      const o = tone(v, 'sine', 1500 * p, 3200 * p, 0.35, 0.1, 0.12, 0.02);
      wobble(v, o, 14, 40, 0.4, 0.12);
    },
  },
  key: {
    minGap: 0.05,
    length: 0.45,
    gain: 0.4,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.04);
      bell(v, 2400 * p, 0.12, 0.25, 0, 3.5, 1.2);
      bell(v, 3100 * p, 0.14, 0.2, 0.07, 3.5, 1.2);
      bell(v, 2750 * p, 0.25, 0.22, 0.14, 3.5, 1.2);
      noise(v, 'highpass', 5000, 5000, 0.8, 0.02, 0.15);
    },
  },
  bomb_pickup: {
    minGap: 0.05,
    length: 0.3,
    gain: 0.55,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      tone(v, 'triangle', 190 * p, 110 * p, 0.14, 0.5);
      noise(v, 'lowpass', 900, 300, 0.8, 0.08, 0.3);
      noise(v, 'highpass', 5000, 7000, 0.8, 0.05, 0.08, 0.1);
    },
  },
  heart: {
    minGap: 0.05,
    length: 0.45,
    gain: 0.45,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.03);
      tone(v, 'sine', 90, 55, 0.12, 0.45);
      notes(v, 'triangle', HEART, 0.08, 0.25, 0.3, 0, p);
      tone(v, 'sine', N.C6 * p, N.C6 * p, 0.3, 0.08, 0.1, 0.03);
    },
  },
  heart_tin: {
    minGap: 0.05,
    length: 0.45,
    gain: 0.4,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.04);
      bell(v, 1250 * p, 0.35, 0.3, 0, 2.41, 2.2);
      tone(v, 'square', 330 * p, 300 * p, 0.06, 0.08);
    },
  },
  heart_ember: {
    minGap: 0.05,
    length: 0.6,
    gain: 0.45,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.04);
      noise(v, 'bandpass', 500, 2400, 1.2, 0.35, 0.35, 0, 0.05);
      const o = tone(v, 'sine', 330 * p, 660 * p, 0.35, 0.25, 0, 0.02);
      wobble(v, o, 9, 25, 0.4);
      ticks(v, 6, 0.4, 2000, 6000, 0.12, 0.05);
    },
  },
  spark_cell: {
    minGap: 0.05,
    length: 0.35,
    gain: 0.55,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.04);
      tone(v, 'sawtooth', 300 * p, 1400 * p, 0.16, 0.18);
      tone(v, 'square', N.A6 * p, N.A6 * p, 0.12, 0.1, 0.15);
      noise(v, 'highpass', 3000, 9000, 1, 0.12, 0.08);
    },
  },
  spark_cell_full: {
    minGap: 0.1,
    length: 0.7,
    gain: 0.55,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.02);
      tone(v, 'sawtooth', 200 * p, 1800 * p, 0.35, 0.18);
      notes(v, 'square', ACTIVE_READY, 0.08, 0.18, 0.1, 0.3, p);
      ticks(v, 8, 0.4, 3000, 9000, 0.1);
    },
  },
  pickup: {
    minGap: 0.04,
    length: 0.2,
    gain: 0.35,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.06);
      tone(v, 'sine', 500 * p, 1100 * p, 0.09, 0.4);
      noise(v, 'lowpass', 2500, 900, 0.8, 0.05, 0.1);
    },
  },
  trinket: {
    minGap: 0.08,
    length: 0.6,
    gain: 0.38,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.02);
      bell(v, N.A5 * p, 0.5, 0.25, 0, 2, 1.2);
      bell(v, N.E6 * p, 0.45, 0.2, 0.09, 2, 1.2);
    },
  },
  tonic_drink: {
    minGap: 0.2,
    length: 0.7,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.06);
      for (let i = 0; i < 3; i++) {
        tone(v, 'triangle', 320 * p, 150 * p, 0.09, 0.35, i * 0.16, 0.01);
        noise(v, 'lowpass', 700, 300, 1.5, 0.08, 0.15, i * 0.16);
      }
      tone(v, 'sine', 900 * p, 1400 * p, 0.12, 0.12, 0.5);
    },
  },
  sticker_use: {
    minGap: 0.1,
    length: 0.35,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.05);
      noise(v, 'bandpass', 2500, 5000, 1.5, 0.08, 0.35);
      tone(v, 'triangle', 700 * p, 1400 * p, 0.12, 0.2, 0.06);
      tone(v, 'sine', 1400 * p, 1400 * p, 0.2, 0.1, 0.16);
    },
  },

  // ---- Chests & doors ------------------------------------------------------------------------
  chest_open: {
    minGap: 0.1,
    length: 0.8,
    gain: 0.45,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      const creak = tone(v, 'sawtooth', 110 * p, 190 * p, 0.3, 0.1, 0, 0.03);
      wobble(v, creak, 23, 60, 0.35);
      noise(v, 'bandpass', 600, 900, 4, 0.28, 0.12, 0, 0.03);
      noise(v, 'highpass', 2500, 2500, 1, 0.03, 0.3, 0.3);
      notes(v, 'triangle', ITEM_CHORD, 0.05, 0.3, 0.14, 0.36, p);
    },
  },
  chest_unlock: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.55,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.04);
      noise(v, 'bandpass', 3000, 3000, 3, 0.02, 0.4);
      noise(v, 'bandpass', 2200, 2200, 3, 0.03, 0.35, 0.09);
      tone(v, 'square', 260 * p, 180 * p, 0.08, 0.15, 0.09);
      bell(v, 1800 * p, 0.3, 0.15, 0.16, 3.2, 1);
    },
  },
  door_open: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.5,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      noise(v, 'lowpass', 250 * p, 1000 * p, 1.2, 0.35, 0.4, 0, 0.05);
      tone(v, 'sine', 70, 55, 0.2, 0.3, 0.3);
    },
  },
  door_close: {
    minGap: 0.1,
    length: 0.4,
    gain: 0.55,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      tone(v, 'sine', 95 * p, 45 * p, 0.28, 0.6);
      noise(v, 'lowpass', 1400, 200, 0.9, 0.22, 0.45);
    },
  },
  door_lock: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.04);
      tone(v, 'square', 220 * p, 150 * p, 0.08, 0.22);
      bell(v, 900 * p, 0.12, 0.2, 0.02, 1.41, 2.5);
      noise(v, 'bandpass', 1800, 1200, 2, 0.05, 0.25);
    },
  },
  door_unlock: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.03);
      noise(v, 'bandpass', 3200, 3200, 3, 0.025, 0.35);
      noise(v, 'bandpass', 2400, 2400, 3, 0.03, 0.3, 0.08);
      notes(v, 'triangle', UNLOCK, 0.09, 0.25, 0.22, 0.12, p);
    },
  },

  // ---- Bombs & explosions --------------------------------------------------------------------
  bomb_place: {
    minGap: 0.08,
    length: 0.3,
    gain: 0.5,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.06);
      tone(v, 'sine', 140 * p, 70 * p, 0.12, 0.5);
      noise(v, 'highpass', 4000, 6000, 0.7, 0.18, 0.1, 0.05, 0.03);
    },
  },
  bomb_fuse: {
    minGap: 0.25,
    length: 0.7,
    gain: 0.5,
    maxVoices: 3,
    play(v) {
      noise(v, 'highpass', 5000, 7000, 0.7, 0.6, 0.12, 0, 0.02);
      ticks(v, 10, 0.6, 3000, 8000, 0.25);
    },
  },
  explosion_big: {
    minGap: 0.05,
    length: 1.6,
    gain: 0.6,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.08);
      tone(v, 'sine', 120 * p, 30, 0.9, 0.7, 0, 0.003);
      noise(v, 'lowpass', 3500 * p, 90, 0.7, 1.3, 0.7, 0, 0.004);
      noise(v, 'bandpass', 900 * p, 250, 1.2, 0.35, 0.45);
      noise(v, 'highpass', 2500, 1200, 0.7, 0.08, 0.35);
      ticks(v, 6, 0.6, 400, 1800, 0.18, 0.1);
    },
  },
  explosion_small: {
    minGap: 0.04,
    length: 0.7,
    gain: 0.6,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.1);
      tone(v, 'sine', 180 * p, 50, 0.35, 0.5);
      noise(v, 'lowpass', 4500 * p, 200, 0.7, 0.5, 0.55);
      noise(v, 'highpass', 3000, 1500, 0.7, 0.05, 0.25);
    },
  },

  // ---- Enemies & bosses ----------------------------------------------------------------------
  enemy_hurt: {
    minGap: 0.03,
    length: 0.12,
    gain: 0.55,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.1);
      tone(v, 'square', 420 * p, 240 * p, 0.06, 0.15);
      noise(v, 'bandpass', 1500 * p, 800, 1.5, 0.05, 0.3);
    },
  },
  enemy_hurt_squish: {
    minGap: 0.03,
    length: 0.15,
    gain: 0.5,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.1);
      tone(v, 'sine', 320 * p, 120 * p, 0.09, 0.4);
      noise(v, 'bandpass', 1300 * p, 450, 2.5, 0.08, 0.3);
    },
  },
  enemy_die_squish: {
    minGap: 0.04,
    length: 0.45,
    gain: 0.55,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'lowpass', 2200 * p, 250, 1.5, 0.3, 0.55);
      tone(v, 'sine', 260 * p, 60 * p, 0.25, 0.45);
      tone(v, 'sine', 500 * p, 900 * p, 0.05, 0.12, 0.15);
      tone(v, 'sine', 420 * p, 800 * p, 0.05, 0.1, 0.24);
    },
  },
  enemy_die_crunch: {
    minGap: 0.04,
    length: 0.35,
    gain: 0.55,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'bandpass', 2500 * p, 1200, 1.2, 0.05, 0.5);
      noise(v, 'bandpass', 1800 * p, 900, 1.2, 0.06, 0.45, 0.045);
      noise(v, 'bandpass', 1200 * p, 600, 1.2, 0.1, 0.4, 0.09);
      tone(v, 'square', 160 * p, 60 * p, 0.15, 0.18);
    },
  },
  enemy_die_pop: {
    minGap: 0.04,
    length: 0.3,
    gain: 0.5,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.12);
      noise(v, 'highpass', 2500, 2500, 0.7, 0.015, 0.6);
      tone(v, 'sine', 600 * p, 1300 * p, 0.07, 0.35);
      noise(v, 'lowpass', 1800, 400, 0.8, 0.2, 0.25, 0.02, 0.01);
    },
  },
  enemy_shoot: {
    minGap: 0.04,
    length: 0.12,
    gain: 0.35,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.08);
      tone(v, 'triangle', 700 * p, 280 * p, 0.08, 0.35);
      noise(v, 'bandpass', 1200, 600, 1, 0.05, 0.1);
    },
  },
  enemy_spawn: {
    minGap: 0.06,
    length: 0.45,
    gain: 0.4,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.08);
      noise(v, 'bandpass', 300, 1500, 2, 0.3, 0.25, 0, 0.1);
      const o = tone(v, 'triangle', 150 * p, 420 * p, 0.3, 0.2, 0.05, 0.05);
      wobble(v, o, 12, 50, 0.4, 0.05);
    },
  },
  boss_roar: {
    minGap: 0.8,
    length: 1.4,
    gain: 0.75,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.06);
      const a = tone(v, 'sawtooth', 95 * p, 70 * p, 1.1, 0.35, 0, 0.15);
      const b = tone(v, 'sawtooth', 98 * p, 66 * p, 1.1, 0.3, 0, 0.15);
      wobble(v, a, 28, 90, 1.3);
      wobble(v, b, 31, 110, 1.3);
      noise(v, 'bandpass', 500, 250, 1.2, 1.1, 0.4, 0, 0.12);
      noise(v, 'lowpass', 900, 200, 0.7, 1.2, 0.35, 0, 0.2);
    },
  },
  boss_hurt: {
    minGap: 0.06,
    length: 0.3,
    gain: 0.55,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.06);
      tone(v, 'sine', 140 * p, 60 * p, 0.2, 0.55);
      bell(v, 600 * p, 0.15, 0.2, 0, 1.73, 2);
      noise(v, 'bandpass', 1400, 600, 1.2, 0.08, 0.3);
    },
  },
  boss_death: {
    minGap: 1,
    length: 2.8,
    gain: 0.7,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.04);
      const s = tone(v, 'sawtooth', 420 * p, 40, 1.8, 0.25, 0, 0.02);
      wobble(v, s, 7, 60, 2);
      tone(v, 'sine', 110, 28, 2.2, 0.6, 0.1);
      noise(v, 'lowpass', 3000, 80, 0.7, 2.4, 0.55, 0.05, 0.01);
      noise(v, 'bandpass', 900, 200, 1.3, 0.5, 0.4, 0.4);
      noise(v, 'bandpass', 700, 150, 1.3, 0.6, 0.4, 0.9);
      ticks(v, 8, 1.6, 300, 1500, 0.2, 0.2);
    },
  },

  // ---- Storm Lance & carriers ----------------------------------------------------------------
  lance_charge: {
    minGap: 0.6,
    length: 1.1,
    gain: 0.4,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.02);
      // Swells for 0.7 s, then tails off: the game re-triggers it while the lance charges.
      const o = tone(v, 'sawtooth', 110 * p, 440 * p, 0.35, 0.12, 0, 0.7);
      wobble(v, o, 8, 20, 1.05);
      tone(v, 'sine', 220 * p, 880 * p, 0.35, 0.15, 0, 0.7);
      noise(v, 'bandpass', 800, 5000, 3, 0.3, 0.12, 0, 0.7);
    },
  },
  lance_ready: {
    minGap: 0.2,
    length: 0.6,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.01);
      bell(v, N.A6 * p, 0.5, 0.3, 0, 2, 1.1);
      tone(v, 'sine', N.A5 * p, N.A5 * p, 0.45, 0.15);
      ticks(v, 4, 0.2, 5000, 9000, 0.12);
    },
  },
  lance_fire: {
    minGap: 0.1,
    length: 2,
    gain: 0.7,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.04);
      // Crack of the strike, then the deep thunder boom rolling away.
      noise(v, 'highpass', 6000, 2000, 0.7, 0.06, 0.8);
      noise(v, 'bandpass', 3000, 800, 0.8, 0.15, 0.45);
      tone(v, 'sine', 75 * p, 26, 1.4, 0.9, 0, 0.004);
      tone(v, 'triangle', 150 * p, 40, 0.6, 0.35, 0.01);
      noise(v, 'lowpass', 1400 * p, 70, 0.8, 1.7, 0.75, 0.02, 0.01);
      noise(v, 'bandpass', 220, 90, 1.5, 1.2, 0.4, 0.25, 0.1);
      ticks(v, 10, 0.5, 2000, 8000, 0.2, 0.02);
    },
  },
  crackle: {
    minGap: 0.08,
    length: 0.5,
    gain: 0.6,
    maxVoices: 3,
    play(v) {
      ticks(v, 12, 0.4, 2500, 9000, 0.4);
      tone(v, 'square', 1800 * pj(v, 0.3), 900, 0.03, 0.08, 0.1);
      tone(v, 'square', 2600 * pj(v, 0.3), 1200, 0.02, 0.06, 0.25);
    },
  },
  laser_zap: {
    minGap: 0.04,
    length: 0.18,
    gain: 0.45,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.06);
      tone(v, 'square', 1800 * p, 420 * p, 0.12, 0.18);
      tone(v, 'sawtooth', 2300 * p, 600 * p, 0.1, 0.1);
      noise(v, 'bandpass', 4000, 2000, 2, 0.08, 0.1);
    },
  },
  boomerang_whoosh: {
    minGap: 0.08,
    length: 0.5,
    gain: 0.55,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.08);
      noiseArc(v, 400 * p, 1700 * p, 400 * p, 3, 0.45, 0.5);
      tone(v, 'triangle', 300 * p, 520 * p, 0.2, 0.05, 0, 0.18);
    },
  },
  melee_swipe: {
    minGap: 0.05,
    length: 0.18,
    gain: 0.45,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'bandpass', 3500 * p, 700 * p, 1.4, 0.12, 0.55, 0, 0.015);
      tone(v, 'sine', 900 * p, 300 * p, 0.08, 0.06);
    },
  },
  chain_zap: {
    minGap: 0.04,
    length: 0.25,
    gain: 0.55,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      const o = tone(v, 'square', 950 * p, 700 * p, 0.18, 0.16);
      wobble(v, o, 55, 900, 0.2);
      ticks(v, 5, 0.18, 3000, 9000, 0.3);
    },
  },
  freeze: {
    minGap: 0.06,
    length: 0.45,
    gain: 0.55,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      tone(v, 'sine', 2600 * p, 4200 * p, 0.12, 0.15);
      bell(v, 3300 * p, 0.35, 0.12, 0.05, 1.41, 0.8);
      noise(v, 'highpass', 6000, 9000, 1, 0.25, 0.12, 0.02, 0.02);
      ticks(v, 5, 0.3, 5000, 9000, 0.15);
    },
  },
  burn: {
    minGap: 0.06,
    length: 0.45,
    gain: 0.9,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.08);
      noise(v, 'lowpass', 500 * p, 2000 * p, 0.9, 0.35, 0.45, 0, 0.04);
      ticks(v, 6, 0.35, 1500, 5000, 0.18, 0.03);
    },
  },
  poison: {
    minGap: 0.06,
    length: 0.45,
    gain: 0.35,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.1);
      tone(v, 'sine', 380 * p, 900 * p, 0.06, 0.3);
      tone(v, 'sine', 450 * p, 1100 * p, 0.05, 0.25, 0.1);
      tone(v, 'sine', 330 * p, 800 * p, 0.06, 0.22, 0.2);
      const o = tone(v, 'triangle', 120 * p, 100 * p, 0.35, 0.15, 0, 0.03);
      wobble(v, o, 6, 80, 0.4);
    },
  },
  split_pop: {
    minGap: 0.03,
    length: 0.12,
    gain: 0.3,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.12);
      tone(v, 'sine', 900 * p, 1400 * p, 0.035, 0.3);
      tone(v, 'sine', 1300 * p, 2000 * p, 0.035, 0.22, 0.04);
    },
  },
  bounce_ping: {
    minGap: 0.03,
    length: 0.2,
    gain: 0.3,
    maxVoices: 4,
    play(v) {
      const p = pj(v, 0.1);
      bell(v, 1500 * p, 0.14, 0.25, 0, 1, 0.6);
      tone(v, 'triangle', 750 * p, 820 * p, 0.06, 0.12);
    },
  },

  // ---- Fanfares, rooms & economy -------------------------------------------------------------
  item_pickup: {
    minGap: 0.3,
    length: 1.3,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      notes(v, 'square', ITEM_FANFARE, 0.08, 0.14, 0.12);
      notes(v, 'triangle', ITEM_FANFARE, 0.08, 0.2, 0.2);
      for (let i = 0; i < ITEM_CHORD.length; i++) {
        const o = tone(v, 'triangle', ITEM_CHORD[i]!, ITEM_CHORD[i]!, 0.8, 0.13, 0.34, 0.02);
        wobble(v, o, 5.5, 12, 0.85, 0.34);
      }
      tone(v, 'sine', N.C7, N.C7, 0.7, 0.07, 0.36, 0.05);
    },
  },
  transformation: {
    minGap: 1,
    length: 2.2,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      notes(v, 'square', TRANSFORM_RUN, 0.07, 0.12, 0.1);
      notes(v, 'triangle', TRANSFORM_RUN, 0.07, 0.18, 0.18);
      for (let i = 0; i < TRANSFORM_CHORD.length; i++) {
        const f = TRANSFORM_CHORD[i]!;
        const a = tone(v, 'sawtooth', f, f, 1.3, 0.06, 0.5, 0.15);
        wobble(v, a, 5, 14, 1.5, 0.5);
        tone(v, 'triangle', f * 1.003, f * 1.003, 1.3, 0.1, 0.5, 0.15);
      }
      noise(v, 'highpass', 5000, 9000, 0.8, 1.2, 0.08, 0.5, 0.3);
      bell(v, N.C7, 1, 0.12, 0.55, 2, 1);
    },
  },
  secret_found: {
    minGap: 0.5,
    length: 1.6,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      for (let i = 0; i < SECRET.length; i++) {
        const o = tone(v, 'triangle', SECRET[i]!, SECRET[i]!, 0.9 - i * 0.12, 0.2, i * 0.14, 0.01);
        wobble(v, o, 6, 10, 1, i * 0.14);
        bell(v, SECRET[i]! * 2, 0.4, 0.05, i * 0.14 + 0.01, 2, 0.6);
      }
    },
  },
  trapdoor: {
    minGap: 0.3,
    length: 1.1,
    gain: 0.55,
    maxVoices: 1,
    play(v) {
      const creak = tone(v, 'sawtooth', 180, 120, 0.25, 0.08, 0, 0.02);
      wobble(v, creak, 18, 50, 0.3);
      tone(v, 'sine', 100, 40, 0.3, 0.5, 0.2);
      noise(v, 'bandpass', 1600, 180, 1.2, 0.8, 0.35, 0.25, 0.1);
    },
  },
  stairs: {
    minGap: 0.3,
    length: 1,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      for (let i = 0; i < 4; i++) {
        const f = 150 - i * 18;
        tone(v, 'sine', f, f * 0.6, 0.1, 0.45 - i * 0.07, i * 0.19);
        noise(v, 'lowpass', 900 - i * 120, 300, 0.8, 0.06, 0.2 - i * 0.03, i * 0.19);
      }
    },
  },
  shop_buy: {
    minGap: 0.1,
    length: 0.6,
    gain: 0.42,
    maxVoices: 1,
    play(v) {
      noise(v, 'highpass', 4000, 4000, 1, 0.03, 0.3);
      notes(v, 'square', SHOP_BUY, 0.07, 0.1, 0.1, 0.03);
      bell(v, N.E6, 0.45, 0.22, 0.1, 3.01, 1.3);
      ticks(v, 5, 0.3, 4000, 8000, 0.12, 0.05);
    },
  },
  cant_afford: {
    minGap: 0.2,
    length: 0.35,
    gain: 0.6,
    maxVoices: 1,
    play(v) {
      tone(v, 'square', 185, 180, 0.1, 0.14);
      tone(v, 'square', 150, 140, 0.16, 0.14, 0.14);
    },
  },
  slot_spin: {
    minGap: 0.3,
    length: 1.1,
    gain: 0.6,
    maxVoices: 1,
    play(v) {
      for (let i = 0; i < 14; i++) {
        const f = 700 + i * 60;
        tone(v, 'square', f, f, 0.02, 0.1, i * 0.07);
        noise(v, 'bandpass', 3000, 3000, 3, 0.012, 0.12, i * 0.07);
      }
    },
  },
  slot_win: {
    minGap: 0.5,
    length: 1.3,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      notes(v, 'square', SLOT_WIN, 0.075, 0.12, 0.12);
      notes(v, 'triangle', SLOT_WIN, 0.075, 0.18, 0.18);
      for (let i = 0; i < 4; i++) bell(v, N.C7, 0.2, 0.1, 0.55 + i * 0.1, 3.01, 1.2);
    },
  },
  slot_lose: {
    minGap: 0.5,
    length: 1,
    gain: 0.6,
    maxVoices: 1,
    play(v) {
      const a = tone(v, 'sawtooth', 330, 310, 0.3, 0.12, 0, 0.02);
      wobble(v, a, 6, 30, 0.35);
      const b = tone(v, 'sawtooth', 262, 220, 0.5, 0.12, 0.35, 0.02);
      wobble(v, b, 5, 45, 0.55, 0.35);
    },
  },
  donation: {
    minGap: 0.08,
    length: 0.6,
    gain: 0.5,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.03);
      tone(v, 'triangle', N.B5 * p, N.B5 * p, 0.05, 0.2);
      notes(v, 'sine', DONATION, 0.12, 0.3, 0.18, 0.08, p);
      bell(v, 3200 * p, 0.3, 0.08, 0.1, 1.5, 0.8);
    },
  },
  achievement: {
    minGap: 0.5,
    length: 1.4,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      notes(v, 'triangle', ACHIEVE, 0.09, 0.4, 0.2);
      notes(v, 'square', ACHIEVE, 0.09, 0.12, 0.06);
      bell(v, N.G6, 0.8, 0.12, 0.36, 2, 1);
      noise(v, 'highpass', 6000, 9000, 0.8, 0.6, 0.06, 0.35, 0.1);
    },
  },

  // ---- Menus ---------------------------------------------------------------------------------
  menu_move: {
    minGap: 0.03,
    length: 0.06,
    gain: 0.5,
    maxVoices: 2,
    play(v) {
      tone(v, 'square', 1250, 1200, 0.025, 0.12);
    },
  },
  menu_select: {
    minGap: 0.05,
    length: 0.15,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      tone(v, 'square', 990, 980, 0.04, 0.15);
      tone(v, 'square', 1480, 1470, 0.07, 0.13, 0.045);
    },
  },
  menu_back: {
    minGap: 0.05,
    length: 0.15,
    gain: 0.45,
    maxVoices: 1,
    play(v) {
      tone(v, 'square', 740, 730, 0.04, 0.14);
      tone(v, 'square', 495, 480, 0.07, 0.12, 0.045);
    },
  },

  // ---- Player --------------------------------------------------------------------------------
  player_hurt: {
    minGap: 0.1,
    length: 0.35,
    gain: 0.6,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.04);
      tone(v, 'square', 360 * p, 150 * p, 0.18, 0.2);
      tone(v, 'sine', 120, 60, 0.15, 0.45);
      noise(v, 'bandpass', 1600, 500, 1.2, 0.12, 0.3);
    },
  },
  player_die: {
    minGap: 0.5,
    length: 1.5,
    gain: 0.55,
    maxVoices: 1,
    play(v) {
      const a = tone(v, 'triangle', 660, 110, 1.2, 0.35, 0, 0.01);
      wobble(v, a, 6, 40, 1.3);
      tone(v, 'sine', 330, 55, 1.3, 0.3, 0.05);
      noise(v, 'lowpass', 1800, 120, 0.7, 0.8, 0.25, 0.05, 0.02);
    },
  },
  heal: {
    minGap: 0.1,
    length: 0.8,
    gain: 0.4,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.02);
      notes(v, 'sine', HEAL, 0.08, 0.45, 0.22, 0, p);
      noise(v, 'highpass', 6000, 9000, 0.8, 0.5, 0.05, 0.1, 0.1);
    },
  },
  curse: {
    minGap: 0.5,
    length: 1.2,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      const a = tone(v, 'sawtooth', 110, 104, 0.9, 0.12, 0, 0.35);
      const b = tone(v, 'sawtooth', 155.6, 147, 0.9, 0.1, 0, 0.35);
      wobble(v, a, 4, 30, 1.3);
      wobble(v, b, 5, 30, 1.3);
      noise(v, 'bandpass', 300, 150, 2, 0.9, 0.2, 0, 0.3);
      tone(v, 'sine', 55, 40, 0.9, 0.35, 0.1, 0.2);
    },
  },
  teleport: {
    minGap: 0.3,
    length: 0.7,
    gain: 0.5,
    maxVoices: 1,
    play(v) {
      const o = tone(v, 'sine', 220, 2200, 0.5, 0.22, 0, 0.02);
      wobble(v, o, 18, 60, 0.55);
      noise(v, 'bandpass', 400, 6000, 2, 0.5, 0.18, 0, 0.05);
      bell(v, N.A6, 0.3, 0.1, 0.45, 2, 1);
    },
  },
  active_use: {
    minGap: 0.1,
    length: 0.4,
    gain: 0.55,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.03);
      tone(v, 'square', 440 * p, 880 * p, 0.12, 0.15);
      tone(v, 'triangle', 880 * p, 1320 * p, 0.2, 0.2, 0.08);
      noise(v, 'highpass', 3000, 6000, 1, 0.15, 0.1, 0.02);
    },
  },
  active_ready: {
    minGap: 0.2,
    length: 0.5,
    gain: 0.4,
    maxVoices: 1,
    play(v) {
      notes(v, 'triangle', ACTIVE_READY, 0.07, 0.3, 0.22);
      bell(v, N.B6, 0.3, 0.08, 0.08, 2, 0.8);
    },
  },
  fire_nova: {
    minGap: 0.1,
    length: 0.8,
    gain: 0.6,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.06);
      noise(v, 'lowpass', 400 * p, 3000 * p, 0.8, 0.25, 0.5, 0, 0.03);
      noise(v, 'bandpass', 2000, 400, 1, 0.5, 0.35, 0.2);
      tone(v, 'sine', 160 * p, 60, 0.4, 0.4);
      ticks(v, 8, 0.5, 1500, 6000, 0.2, 0.05);
    },
  },
  tin_break: {
    minGap: 0.1,
    length: 0.5,
    gain: 0.5,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      bell(v, 1600 * p, 0.3, 0.25, 0, 2.41, 3);
      bell(v, 2300 * p, 0.25, 0.18, 0.03, 1.73, 3);
      noise(v, 'highpass', 4000, 2000, 1, 0.2, 0.3);
    },
  },
  rock_break: {
    minGap: 0.05,
    length: 0.4,
    gain: 0.5,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'lowpass', 1800 * p, 300, 0.9, 0.3, 0.5);
      tone(v, 'sine', 110 * p, 50, 0.2, 0.4);
      ticks(v, 6, 0.25, 600, 2500, 0.25, 0.03);
    },
  },
  crate_break: {
    minGap: 0.05,
    length: 0.35,
    gain: 0.5,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'bandpass', 1200 * p, 600, 2, 0.06, 0.5);
      tone(v, 'triangle', 300 * p, 150 * p, 0.08, 0.3);
      noise(v, 'bandpass', 900 * p, 500, 2, 0.1, 0.35, 0.05);
      ticks(v, 4, 0.2, 800, 2000, 0.2, 0.06);
    },
  },
  urn_break: {
    minGap: 0.05,
    length: 0.45,
    gain: 0.5,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.08);
      noise(v, 'highpass', 3500 * p, 2000, 1, 0.25, 0.4);
      bell(v, 2100 * p, 0.18, 0.15, 0.01, 2.9, 2);
      bell(v, 2900 * p, 0.15, 0.1, 0.05, 2.3, 2);
      tone(v, 'sine', 200 * p, 90, 0.12, 0.3);
    },
  },
  puddle_splash: {
    minGap: 0.05,
    length: 0.35,
    gain: 0.4,
    maxVoices: 3,
    play(v) {
      const p = pj(v, 0.12);
      noise(v, 'bandpass', 1400 * p, 500, 1.2, 0.2, 0.4);
      tone(v, 'sine', 500 * p, 1400 * p, 0.05, 0.2, 0.05);
      tone(v, 'sine', 700 * p, 1700 * p, 0.04, 0.12, 0.13);
    },
  },
  spikes: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.45,
    maxVoices: 2,
    play(v) {
      const p = pj(v, 0.05);
      bell(v, 1100 * p, 0.12, 0.2, 0, 1.41, 3);
      noise(v, 'highpass', 3000, 5000, 1, 0.1, 0.35);
      tone(v, 'square', 500 * p, 250 * p, 0.06, 0.1);
    },
  },
  thunder: {
    minGap: 0.8,
    length: 2.2,
    gain: 0.6,
    maxVoices: 1,
    play(v) {
      const p = pj(v, 0.1);
      noise(v, 'highpass', 4000, 1500, 0.7, 0.05, 0.4);
      noise(v, 'lowpass', 900 * p, 60, 0.7, 2, 0.6, 0.05, 0.1);
      tone(v, 'sine', 60 * p, 30, 1.5, 0.5, 0.05, 0.05);
      noise(v, 'bandpass', 300, 120, 1.5, 1.2, 0.3, 0.5, 0.2);
    },
  },
} satisfies Record<string, Recipe>;

export type LibrarySfxName = keyof typeof SFX_LIBRARY;

/** Names in the library (for tests / debug menus). */
export const LIBRARY_SFX_NAMES = Object.keys(SFX_LIBRARY) as LibrarySfxName[];

/** Library names that a core recipe of the same name shadows (should stay empty). */
export const SHADOWED_SFX: readonly string[] = registerSfx(SFX_LIBRARY);
