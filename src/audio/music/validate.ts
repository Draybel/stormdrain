/**
 * Track validation (used by the unit tests; cheap enough to run in a debug tool too).
 * Returns human-readable problems; an empty list means the track is good to ship.
 */

import { compileTrack, stepDurationOf, stepsPerBarOf, type CompiledTrack } from './parse';
import { pitchClass } from './theory';
import {
  DRUM_KINDS,
  DRUM_LANES,
  DRUM_SLOT0,
  MELODIC_CHANNELS,
  SCALES,
  WAVES,
  type DrumVoice,
  type Instrument,
  type MusicTrack,
  type TrackKind,
} from './types';

/** Allowed loop / one-shot length (seconds) per kind. */
export const LENGTH_BOUNDS: Readonly<Record<TrackKind, readonly [number, number]>> = {
  chapter: [28, 64],
  title: [20, 90],
  boss: [20, 80],
  miniboss: [15, 80],
  final: [20, 90],
  shop: [15, 80],
  secret: [15, 80],
  jingle: [1.5, 12],
  sting: [0.3, 6],
};

/** Playable MIDI range per channel. */
export const NOTE_RANGE: Readonly<Record<(typeof MELODIC_CHANNELS)[number], readonly [number, number]>> = {
  bass: [24, 64],
  lead: [43, 100],
  arp: [43, 103],
  pad: [33, 88],
};

const ONE_SHOT: readonly TrackKind[] = ['jingle', 'sting'];

function inRange(v: number | undefined, lo: number, hi: number): boolean {
  return v === undefined || (Number.isFinite(v) && v >= lo && v <= hi);
}

export function validateInstrument(i: Instrument, where: string): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(`${where}: ${m}`);
  if (!Array.isArray(i.osc) || i.osc.length < 1 || i.osc.length > 4) bad('needs 1-4 oscillator layers');
  let voices = 0;
  for (const L of i.osc ?? []) {
    if (!WAVES.includes(L.wave)) bad(`unknown wave "${L.wave}"`);
    if (!inRange(L.voices, 1, 4) || (L.voices !== undefined && !Number.isInteger(L.voices))) bad('voices must be 1-4');
    if (!inRange(L.detune, -100, 100)) bad('detune out of range');
    if (!inRange(L.octave, -2, 2)) bad('layer octave out of range');
    if (!inRange(L.semi, -36, 36)) bad('layer semi out of range');
    if (!inRange(L.gain, 0, 1)) bad('layer gain out of range');
    voices += L.voices ?? 1;
  }
  if (voices > 6) bad(`too many oscillators per note (${voices} > 6)`);
  const e = i.env;
  if (!e || !inRange(e.a, 0, 4) || !inRange(e.d, 0, 6) || !inRange(e.s, 0, 1) || !inRange(e.r, 0, 6)) bad('bad envelope');
  if (!inRange(i.gain, 0, 1) || !Number.isFinite(i.gain)) bad('gain must be 0..1');
  if (!inRange(i.pan, -1, 1)) bad('pan must be -1..1');
  if (!inRange(i.delay, 0, 1)) bad('delay send must be 0..1');
  if (i.octave !== undefined && (!Number.isInteger(i.octave) || i.octave < 0 || i.octave > 7)) bad('octave must be 0-7');
  if (!inRange(i.glide, 0, 1)) bad('glide must be 0..1 s');
  if (!inRange(i.gate, 0.05, 1)) bad('gate must be 0.05..1');
  const f = i.filter;
  if (f) {
    if (!['lowpass', 'highpass', 'bandpass'].includes(f.type)) bad(`unknown filter "${f.type}"`);
    if (!inRange(f.cutoff, 20, 20000) || !Number.isFinite(f.cutoff)) bad('filter cutoff must be 20..20000 Hz');
    if (!inRange(f.q, 0.0001, 30)) bad('filter Q must be 0.0001..30');
    if (!inRange(f.env, 0, 20000)) bad('filter env must be 0..20000 Hz');
    if (!inRange(f.decay, 0.001, 5)) bad('filter decay must be 0.001..5 s');
    if (!inRange(f.keyTrack, 0, 1)) bad('keyTrack must be 0..1');
  }
  const v = i.vibrato;
  if (v && (!inRange(v.rate, 0, 20) || !inRange(v.depth, 0, 200) || !inRange(v.delay, 0, 4))) bad('bad vibrato');
  return out;
}

export function validateDrumVoice(v: DrumVoice, where: string): string[] {
  const out: string[] = [];
  const bad = (m: string) => out.push(`${where}: ${m}`);
  if (!DRUM_KINDS.includes(v.kind)) bad(`unknown drum kind "${v.kind}"`);
  if (!inRange(v.pitch, 20, 12000)) bad('pitch must be 20..12000 Hz');
  if (!inRange(v.decay, 0.005, 4)) bad('decay must be 0.005..4 s');
  if (!inRange(v.tone, 0, 1)) bad('tone must be 0..1');
  if (!inRange(v.gain, 0, 1)) bad('gain must be 0..1');
  if (!inRange(v.pan, -1, 1)) bad('pan must be -1..1');
  return out;
}

/** Full validation; `compiled` is returned when the track compiles. */
export function validateTrack(t: MusicTrack): { errors: string[]; compiled: CompiledTrack | null } {
  const errors: string[] = [];
  const bad = (m: string) => errors.push(`${t.id}: ${m}`);
  if (!/^[a-z][a-z0-9_]*$/.test(t.id)) bad('id must be snake_case');
  if (!t.name) bad('missing name');
  if (!inRange(t.bpm, 30, 300)) bad('bpm must be 30..300');
  if (!Number.isInteger(t.beatsPerBar) || t.beatsPerBar < 1 || t.beatsPerBar > 12) bad('beatsPerBar must be 1-12');
  if (!Number.isInteger(t.stepsPerBeat) || t.stepsPerBeat < 1 || t.stepsPerBeat > 8) bad('stepsPerBeat must be 1-8');
  if (!inRange(t.swing, 0, 0.5)) bad('swing must be 0..0.5');
  if ((t.swing ?? 0) > 0 && t.stepsPerBeat % 2 !== 0) bad('swing needs an even stepsPerBeat');
  if (!inRange(t.gain, 0, 2.5)) bad('track gain must be 0..2.5');
  try {
    pitchClass(t.key);
  } catch {
    bad(`bad key "${t.key}"`);
  }
  if (!(t.scale in SCALES)) bad(`unknown scale "${t.scale}"`);
  const oneShot = ONE_SHOT.includes(t.kind);
  if (oneShot === t.loop) bad(oneShot ? 'jingles and stings must not loop' : 'music tracks must loop');
  if (t.kind === 'chapter' && !t.chapter) bad('chapter track without a chapter id');
  const names = new Set(t.sections.map((s) => s.name));
  if (names.size !== t.sections.length) bad('duplicate section names');
  for (const s of t.sections) if (!t.song.includes(s.name)) bad(`section "${s.name}" is never played`);

  for (const ch of MELODIC_CHANNELS) {
    const i = t.instruments[ch];
    if (i) errors.push(...validateInstrument(i, `${t.id}.${ch}`));
  }
  const kitDef = t.instruments.drums;
  if (kitDef) {
    if (!inRange(kitDef.gain, 0, 1) || !Number.isFinite(kitDef.gain)) bad('drum kit gain must be 0..1');
    if (!inRange(kitDef.delay, 0, 1)) bad('drum kit delay must be 0..1');
    for (const lane of DRUM_LANES) {
      const v = kitDef[lane];
      if (v) errors.push(...validateDrumVoice(v, `${t.id}.drums.${lane}`));
    }
  }
  const r = t.room;
  if (r && (!inRange(r.time, 0.02, 1.2) || !inRange(r.feedback, 0, 0.85) || !inRange(r.wet, 0, 1) || !inRange(r.damp, 200, 16000))) {
    bad('bad room settings');
  }

  let compiled: CompiledTrack | null = null;
  try {
    compiled = compileTrack(t);
  } catch (e) {
    bad(`compile: ${(e as Error).message}`);
  }
  if (compiled) {
    const [lo, hi] = LENGTH_BOUNDS[t.kind];
    if (compiled.duration < lo || compiled.duration > hi) {
      bad(`length ${compiled.duration.toFixed(1)} s outside ${lo}-${hi} s for a ${t.kind}`);
    }
    if (compiled.totalSteps % stepsPerBarOf(t) !== 0) bad('song is not a whole number of bars');
    if (t.loop && (t.swing ?? 0) > 0 && compiled.totalSteps % 2 !== 0) bad('swung loop needs an even step count');
    if (Math.abs(compiled.stepDur - stepDurationOf(t)) > 1e-12) bad('step duration mismatch');
    let perStepMax = 0;
    for (let s = 0; s < compiled.totalSteps; s++) {
      perStepMax = Math.max(perStepMax, compiled.start[s + 1]! - compiled.start[s]!);
    }
    if (perStepMax > 14) bad(`too many notes on one step (${perStepMax})`);
    for (let i = 0; i < compiled.count; i++) {
      const slot = compiled.slot[i]!;
      if (slot >= DRUM_SLOT0) continue;
      const ch = MELODIC_CHANNELS[slot]!;
      const [a, b] = NOTE_RANGE[ch];
      const m = compiled.midi[i]!;
      if (!(m >= a && m <= b)) {
        bad(`${ch} note ${m} out of range ${a}-${b}`);
        break;
      }
    }
    if (compiled.count === 0) bad('no notes');
  }
  return { errors, compiled };
}
