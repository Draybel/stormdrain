/**
 * Instrument presets shared by the tracks (synth parameter sets, see types.ts `Instrument`).
 * Tracks tweak them with `inst(PRESET, { gain, pan, delay, octave... })`.
 * Levels are set so a full five-channel arrangement sits around -6 dBFS before the bus compressor.
 */

import type { Instrument } from './types';

// ---- Bass -------------------------------------------------------------------------------------

/** Round sine sub with a little triangle grit. */
export const SUB_BASS: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'triangle', gain: 0.35 }],
  env: { a: 0.006, d: 0.25, s: 0.75, r: 0.08 },
  filter: { type: 'lowpass', cutoff: 900, q: 0.7 },
  gain: 0.55,
};

/** Rubbery filtered saw with a plucky filter envelope. */
export const PLUCK_BASS: Instrument = {
  osc: [{ wave: 'sawtooth' }, { wave: 'square', octave: -1, gain: 0.3 }],
  env: { a: 0.004, d: 0.22, s: 0.45, r: 0.06 },
  filter: { type: 'lowpass', cutoff: 260, q: 5, env: 1700, decay: 0.16 },
  gain: 0.34,
};

/** Wooden upright / folk bass: triangle with a fast decay. */
export const UPRIGHT_BASS: Instrument = {
  osc: [{ wave: 'triangle' }, { wave: 'sine', octave: 1, gain: 0.18 }],
  env: { a: 0.004, d: 0.45, s: 0.12, r: 0.1 },
  filter: { type: 'lowpass', cutoff: 1300, q: 0.8 },
  gain: 0.62,
};

/** Hollow chiptune square bass. */
export const SQUARE_BASS: Instrument = {
  osc: [{ wave: 'square' }],
  env: { a: 0.004, d: 0.12, s: 0.8, r: 0.05 },
  filter: { type: 'lowpass', cutoff: 750, q: 1 },
  gain: 0.3,
};

/** Resonant squelchy saw (machines, bosses). */
export const ACID_BASS: Instrument = {
  osc: [{ wave: 'sawtooth' }],
  env: { a: 0.003, d: 0.18, s: 0.5, r: 0.05 },
  filter: { type: 'lowpass', cutoff: 320, q: 9, env: 2400, decay: 0.11 },
  gain: 0.3,
};

/** Thick detuned saw stack an octave down (bosses, finals). */
export const FUZZ_BASS: Instrument = {
  osc: [
    { wave: 'sawtooth', voices: 2, detune: 18 },
    { wave: 'square', octave: -1, gain: 0.45 },
  ],
  env: { a: 0.005, d: 0.2, s: 0.7, r: 0.07 },
  filter: { type: 'lowpass', cutoff: 520, q: 3, env: 900, decay: 0.12 },
  gain: 0.3,
};

// ---- Lead -------------------------------------------------------------------------------------

/** Breathy flute / tin whistle. */
export const FLUTE: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'triangle', octave: 1, gain: 0.12 }, { wave: 'noise', gain: 0.035 }],
  env: { a: 0.05, d: 0.2, s: 0.8, r: 0.16 },
  filter: { type: 'lowpass', cutoff: 3000, q: 0.5 },
  vibrato: { rate: 5.2, depth: 14, delay: 0.22 },
  gain: 0.3,
  delay: 0.3,
};

/** Soft square lead with delayed vibrato (the chiptune voice). */
export const SQUARE_LEAD: Instrument = {
  osc: [{ wave: 'square' }],
  env: { a: 0.01, d: 0.18, s: 0.65, r: 0.12 },
  filter: { type: 'lowpass', cutoff: 2600, q: 0.7 },
  vibrato: { rate: 5.5, depth: 12, delay: 0.18 },
  gain: 0.16,
  delay: 0.22,
};

/** Bowed fiddle: saw with vibrato and a soft attack. */
export const FIDDLE: Instrument = {
  osc: [{ wave: 'sawtooth' }, { wave: 'triangle', gain: 0.4 }],
  env: { a: 0.07, d: 0.25, s: 0.8, r: 0.18 },
  filter: { type: 'lowpass', cutoff: 2300, q: 1.6 },
  vibrato: { rate: 5.8, depth: 16, delay: 0.14 },
  gain: 0.2,
  delay: 0.18,
};

/** Wheezy reed / accordion: two detuned squares. */
export const REED: Instrument = {
  osc: [{ wave: 'square', voices: 2, detune: 12 }, { wave: 'sawtooth', gain: 0.25 }],
  env: { a: 0.035, d: 0.1, s: 0.9, r: 0.09 },
  filter: { type: 'lowpass', cutoff: 1900, q: 1.1 },
  vibrato: { rate: 6, depth: 6 },
  gain: 0.13,
  delay: 0.12,
};

/** Big detuned saw lead (climaxes, bosses). */
export const SAW_LEAD: Instrument = {
  osc: [{ wave: 'sawtooth', voices: 3, detune: 16 }, { wave: 'square', octave: -1, gain: 0.2 }],
  env: { a: 0.012, d: 0.3, s: 0.7, r: 0.16 },
  filter: { type: 'lowpass', cutoff: 3200, q: 1.2 },
  vibrato: { rate: 5.6, depth: 10, delay: 0.2 },
  gain: 0.13,
  delay: 0.25,
};

/** Pure whistle / theremin-ish sine with wide vibrato (eerie). */
export const WHISTLE: Instrument = {
  osc: [{ wave: 'sine' }],
  env: { a: 0.08, d: 0.2, s: 0.85, r: 0.3 },
  vibrato: { rate: 4.6, depth: 22, delay: 0.3 },
  gain: 0.3,
  delay: 0.4,
  glide: 0.09,
};

/** Glockenspiel / celesta bell lead. */
export const BELL_LEAD: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'sine', octave: 2, gain: 0.22 }, { wave: 'triangle', semi: 19, gain: 0.08 }],
  env: { a: 0.002, d: 0.9, s: 0, r: 0.5 },
  gain: 0.3,
  delay: 0.35,
};

// ---- Arp / plucks -----------------------------------------------------------------------------

/** Short triangle pluck with a filter blip. */
export const PLUCK: Instrument = {
  osc: [{ wave: 'triangle' }, { wave: 'square', gain: 0.18 }],
  env: { a: 0.002, d: 0.18, s: 0, r: 0.08 },
  filter: { type: 'lowpass', cutoff: 900, q: 2, env: 3200, decay: 0.08 },
  gain: 0.22,
  delay: 0.25,
};

/** Music box: sine + second-octave shimmer, long decay. */
export const MUSIC_BOX: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'sine', octave: 2, gain: 0.3 }, { wave: 'triangle', semi: 31, gain: 0.05 }],
  env: { a: 0.001, d: 1.1, s: 0, r: 0.5 },
  gain: 0.24,
  delay: 0.3,
};

/** Marimba / wood: fundamental plus two-octave partial, quick decay. */
export const MARIMBA: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'sine', octave: 2, gain: 0.2 }],
  env: { a: 0.002, d: 0.34, s: 0, r: 0.14 },
  gain: 0.34,
  delay: 0.12,
};

/** Glassy crystal arp (grotto, frost). */
export const GLASS: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'triangle', octave: 1, gain: 0.25 }, { wave: 'sine', semi: 28, gain: 0.08 }],
  env: { a: 0.002, d: 0.6, s: 0, r: 0.4 },
  gain: 0.22,
  delay: 0.45,
};

/** Chippy square arp. */
export const CHIP_ARP: Instrument = {
  osc: [{ wave: 'square' }],
  env: { a: 0.002, d: 0.09, s: 0.3, r: 0.04 },
  filter: { type: 'lowpass', cutoff: 3400, q: 0.7 },
  gain: 0.1,
  delay: 0.2,
};

/** Plucked harp / kalimba. */
export const HARP: Instrument = {
  osc: [{ wave: 'triangle' }, { wave: 'sine', octave: 1, gain: 0.3 }],
  env: { a: 0.002, d: 0.7, s: 0, r: 0.3 },
  filter: { type: 'lowpass', cutoff: 2600, q: 0.6 },
  gain: 0.3,
  delay: 0.3,
};

// ---- Pads -------------------------------------------------------------------------------------

/** Warm detuned saw pad. */
export const WARM_PAD: Instrument = {
  osc: [{ wave: 'sawtooth', voices: 3, detune: 18 }],
  env: { a: 0.7, d: 0.6, s: 0.8, r: 1.1 },
  filter: { type: 'lowpass', cutoff: 1100, q: 0.8 },
  gain: 0.07,
  delay: 0.25,
};

/** Airy 'ooh' choir: detuned triangles with slow vibrato. */
export const CHOIR: Instrument = {
  osc: [{ wave: 'triangle', voices: 3, detune: 14 }, { wave: 'sine', octave: 1, gain: 0.25 }],
  env: { a: 0.5, d: 0.4, s: 0.85, r: 0.9 },
  filter: { type: 'lowpass', cutoff: 1900, q: 0.6 },
  vibrato: { rate: 4.2, depth: 9 },
  gain: 0.13,
  delay: 0.35,
};

/** Drawbar-ish organ (crypt, cellar). */
export const ORGAN: Instrument = {
  osc: [{ wave: 'sine' }, { wave: 'sine', octave: 1, gain: 0.5 }, { wave: 'sine', semi: 19, gain: 0.25 }],
  env: { a: 0.03, d: 0.1, s: 1, r: 0.14 },
  vibrato: { rate: 6.5, depth: 5 },
  gain: 0.1,
  delay: 0.2,
};

/** Bowed string section. */
export const STRINGS: Instrument = {
  osc: [{ wave: 'sawtooth', voices: 3, detune: 12 }],
  env: { a: 0.3, d: 0.4, s: 0.85, r: 0.5 },
  filter: { type: 'lowpass', cutoff: 1900, q: 0.7 },
  vibrato: { rate: 5, depth: 7, delay: 0.3 },
  gain: 0.07,
  delay: 0.2,
};

/** Low buzzing drone (hive, machinery). */
export const DRONE: Instrument = {
  osc: [{ wave: 'sawtooth', voices: 4, detune: 26 }, { wave: 'square', octave: -1, gain: 0.3 }],
  env: { a: 1.2, d: 0.5, s: 0.9, r: 1.4 },
  filter: { type: 'lowpass', cutoff: 520, q: 2.5 },
  vibrato: { rate: 0.4, depth: 10 },
  gain: 0.07,
  delay: 0.15,
};

/** Glassy sine pad (frost, grotto, secrets). */
export const GLASS_PAD: Instrument = {
  osc: [{ wave: 'sine', voices: 2, detune: 9 }, { wave: 'triangle', octave: 1, gain: 0.2 }],
  env: { a: 1, d: 0.6, s: 0.8, r: 1.5 },
  gain: 0.12,
  delay: 0.45,
};
