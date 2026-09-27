/** Pitch helpers: note names, scale degrees, MIDI numbers and frequencies (pure, DOM-free). */

import { SCALES, type NoteName, type ScaleName } from './types';

const LETTER: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class (0-11) of a key name like 'C#', 'Eb', 'A'. */
export function pitchClass(name: NoteName | string): number {
  const base = LETTER[name[0] ?? ''];
  if (base === undefined) throw new Error(`bad note name "${name}"`);
  let pc = base;
  for (let i = 1; i < name.length; i++) {
    const c = name[i];
    if (c === '#') pc++;
    else if (c === 'b') pc--;
    else throw new Error(`bad note name "${name}"`);
  }
  return ((pc % 12) + 12) % 12;
}

/** MIDI number of an absolute note like 'C4' (= 60), 'F#3', 'Bb2'; NaN if malformed. */
export function noteToMidi(s: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) return NaN;
  const pc = LETTER[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (Number(m[3]) + 1) + pc;
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * MIDI number of scale degree `degree` (1-7) of `key`/`scale`, with degree 1 in `octave`
 * (octave 4 → middle-C octave), plus `accidental` semitones and `octShift` octaves.
 */
export function degreeToMidi(
  key: NoteName,
  scale: ScaleName,
  octave: number,
  degree: number,
  accidental = 0,
  octShift = 0,
): number {
  const steps = SCALES[scale];
  const d = degree - 1;
  const idx = ((d % 7) + 7) % 7;
  const extraOct = Math.floor(d / 7);
  return 12 * (octave + 1) + pitchClass(key) + steps[idx]! + accidental + 12 * (octShift + extraOct);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 'C4'-style name for a MIDI number (debug / docs). */
export function midiName(midi: number): string {
  const m = Math.round(midi);
  return `${NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
}
