/**
 * Music data format (DOM-free, so content files and tests load in node).
 *
 * A `MusicTrack` is a small step-sequencer song: a tempo grid (bpm × stepsPerBeat, optional swing),
 * a key + scale that scale-degree notes resolve against, one instrument per channel, a list of
 * named sections holding compact pattern strings, and a song order. See `parse.ts` for the pattern
 * mini-language and docs/audio.md for a walkthrough.
 */

export const MELODIC_CHANNELS = ['bass', 'lead', 'arp', 'pad'] as const;
export type MelodicChannel = (typeof MELODIC_CHANNELS)[number];

export const DRUM_LANES = ['kick', 'snare', 'hat', 'perc'] as const;
export type DrumLane = (typeof DRUM_LANES)[number];

export type ChannelId = MelodicChannel | 'drums';

/** Compiled channel slots: 0-3 melodic channels, 4-7 drum lanes. */
export const SLOT_COUNT = 8;
export const DRUM_SLOT0 = 4;

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  hungarianMinor: [0, 2, 3, 6, 7, 8, 11],
} as const satisfies Record<string, readonly number[]>;
export type ScaleName = keyof typeof SCALES;

export type NoteName =
  | 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B';

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';
export const WAVES: readonly Wave[] = ['sine', 'square', 'sawtooth', 'triangle', 'noise'];

/** One oscillator layer of an instrument. `voices > 1` makes a detuned stack (supersaw-style). */
export interface OscLayer {
  wave: Wave;
  /** Detuned copies, 1-4 (default 1). */
  voices?: number;
  /** Detune in cents: the total spread across the voices of a stack, or the offset of a single voice (default 0). */
  detune?: number;
  /** Octave offset of this layer, -2..2 (default 0). */
  octave?: number;
  /** Extra semitone offset (e.g. 7 for a fifth), -24..24 (default 0). */
  semi?: number;
  /** Relative layer level, 0..1 (default 1). */
  gain?: number;
}

/** ADSR in seconds; `s` is the sustain level 0..1. */
export interface Envelope {
  a: number;
  d: number;
  s: number;
  r: number;
}

export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterSpec {
  type: FilterType;
  /** Resting cutoff, Hz. */
  cutoff: number;
  /** Resonance (default 0.7). */
  q?: number;
  /** Envelope amount in Hz added at note-on, decaying back to `cutoff` (makes the filter per-note). */
  env?: number;
  /** Filter envelope decay, s (default 0.2). */
  decay?: number;
  /** 0..1: how much the cutoff follows pitch (1 = one octave per octave, relative to middle C). */
  keyTrack?: number;
}

export interface Vibrato {
  /** Hz. */
  rate: number;
  /** Cents. */
  depth: number;
  /** Seconds before the vibrato fades in (default 0). */
  delay?: number;
}

/** Synth parameters for one melodic channel. */
export interface Instrument {
  osc: readonly OscLayer[];
  env: Envelope;
  filter?: FilterSpec;
  vibrato?: Vibrato;
  /** Channel level 0..1. */
  gain: number;
  /** Stereo position -1..1. */
  pan?: number;
  /** Send to the music bus 'room' (feedback delay), 0..1. */
  delay?: number;
  /** Octave that scale degree 1 sits in (defaults: bass 2, lead 4, arp 4, pad 3). */
  octave?: number;
  /** Portamento time (s) for notes written with a leading '~' (default 0.06). */
  glide?: number;
  /** Fraction of the written length before release starts, 0.05..1 (default 1). */
  gate?: number;
}

export type DrumKind =
  | 'kick'
  | 'snare'
  | 'hat'
  | 'clap'
  | 'rim'
  | 'tom'
  | 'shaker'
  | 'block'
  | 'bell'
  | 'drip'
  | 'clank'
  | 'thump'
  | 'cymbal';
export const DRUM_KINDS: readonly DrumKind[] = [
  'kick', 'snare', 'hat', 'clap', 'rim', 'tom', 'shaker', 'block', 'bell', 'drip', 'clank', 'thump', 'cymbal',
];

/** One synthesized drum sound. */
export interface DrumVoice {
  kind: DrumKind;
  /** Base pitch in Hz (kind-specific default). */
  pitch?: number;
  /** Decay time, s (kind-specific default). */
  decay?: number;
  /** Brightness 0..1 (default 0.5). */
  tone?: number;
  /** Level 0..1 (default 1). */
  gain?: number;
  /** Stereo position -1..1. */
  pan?: number;
}

export interface DrumKit {
  kick?: DrumVoice;
  snare?: DrumVoice;
  hat?: DrumVoice;
  perc?: DrumVoice;
  /** Kit level 0..1. */
  gain: number;
  /** Send to the room effect, 0..1. */
  delay?: number;
}

export interface TrackInstruments {
  bass?: Instrument;
  lead?: Instrument;
  arp?: Instrument;
  pad?: Instrument;
  drums?: DrumKit;
}

/** A pattern: one string, or an array of bars (joined with bar lines, so each must be exactly one bar). */
export type Pattern = string | readonly string[];

export type DrumPatterns = Partial<Record<DrumLane, Pattern>>;

/**
 * A named block of whole bars. A pattern shorter than the section repeats to fill it (its length
 * must divide the section length); a missing pattern is silence.
 */
export interface Section {
  name: string;
  bars: number;
  /** Semitones added to every melodic note in this section (key changes / lifts). */
  transpose?: number;
  bass?: Pattern;
  lead?: Pattern;
  arp?: Pattern;
  pad?: Pattern;
  drums?: DrumPatterns;
}

/** Per-track settings for the music bus feedback-delay 'room'. */
export interface RoomFx {
  /** Delay time, s (0.02..1). */
  time?: number;
  /** Feedback 0..0.85. */
  feedback?: number;
  /** Wet level 0..1. */
  wet?: number;
  /** Damping low-pass on the repeats, Hz. */
  damp?: number;
}

export type TrackKind =
  | 'title'
  | 'chapter'
  | 'boss'
  | 'miniboss'
  | 'final'
  | 'shop'
  | 'secret'
  | 'jingle'
  | 'sting';

export interface MusicTrack {
  id: string;
  name: string;
  kind: TrackKind;
  /** Chapter id this loop belongs to (chapter tracks). */
  chapter?: string;
  /** Short description of the mood (docs / debug). */
  mood?: string;
  /** Beats per minute, where a beat is `stepsPerBeat` steps. */
  bpm: number;
  /** Time signature numerator (3 = waltz, 4 = common time...). */
  beatsPerBar: number;
  /** Grid resolution: 4 = sixteenths in x/4, 3 or 6 for compound/triplet feels. */
  stepsPerBeat: number;
  /** 0..0.5: odd steps are delayed by this fraction of a step (needs an even stepsPerBeat). */
  swing?: number;
  key: NoteName;
  scale: ScaleName;
  /** Loops seamlessly (music) or plays once (jingles / stingers). */
  loop: boolean;
  instruments: TrackInstruments;
  sections: readonly Section[];
  /** Section names in play order (repeats allowed). */
  song: readonly string[];
  room?: RoomFx;
  /** Output level trim for the whole track, 0..2.5 (default 1); used to even out loudness between tracks. */
  gain?: number;
}
