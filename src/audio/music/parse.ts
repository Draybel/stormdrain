/**
 * Pattern mini-language + track compiler (pure, DOM-free).
 *
 * MELODIC patterns (bass / lead / arp / pad) are whitespace-separated tokens; each token occupies
 * one step unless it has a `:n` length suffix.
 *
 *   5        scale degree 5 (1-7) of the track key/scale, in the instrument's octave
 *   5' 5,    one octave up / down (repeatable: 1'' , 5,,)
 *   3b 4#    chromatic alteration (flat / sharp)
 *   C4 F#3   absolute note names (C4 = MIDI 60) for chromatic lines
 *   1+3+5    chord (pitches joined with '+')
 *   5:4      a note lasting 4 steps (same as `5 - - -`)
 *   5!  5?   accent / ghost velocity (default is a normal hit)
 *   ~5       glide into this note from the previous one (portamento)
 *   -  -:3   hold the previous note(s) one / three more steps
 *   .  .:8   rest one / eight steps
 *   |        bar line: optional, but when present every bar must be exactly one bar long
 *
 * DRUM lanes (kick / snare / hat / perc) are one character per step, spaces ignored:
 *   x hit   X accent   o ghost   + long hit (open hat, ringing perc)   . or - rest   | bar line
 *
 * `compileTrack` flattens a track's song into CSR event arrays (typed arrays, one entry per note)
 * so the scheduler can walk them without allocating.
 */

import { degreeToMidi, noteToMidi, pitchClass } from './theory';
import {
  DRUM_LANES,
  DRUM_SLOT0,
  MELODIC_CHANNELS,
  SCALES,
  type DrumKit,
  type Instrument,
  type MelodicChannel,
  type MusicTrack,
  type NoteName,
  type Pattern,
  type ScaleName,
} from './types';

/** Normalises a pattern given as an array of bars into one string with bar lines. */
export function patternText(p: Pattern): string {
  return typeof p === 'string' ? p : p.join(' | ');
}

export const VEL_NORMAL = 0.8;
export const VEL_ACCENT = 1;
export const VEL_GHOST = 0.5;

/** Default octave of scale degree 1 per channel. */
export const DEFAULT_OCTAVE: Readonly<Record<MelodicChannel, number>> = { bass: 2, lead: 4, arp: 4, pad: 3 };

export interface PitchContext {
  key: NoteName;
  scale: ScaleName;
  octave: number;
  transpose: number;
}

export const ItemKind = { Rest: 0, Hold: 1, Note: 2 } as const;
export type ItemKind = (typeof ItemKind)[keyof typeof ItemKind];

export interface PatternItem {
  kind: ItemKind;
  /** Steps this token occupies. */
  len: number;
  /** MIDI pitches (notes only). */
  pitches: number[];
  vel: number;
  glide: boolean;
}

export interface ParsedPattern {
  steps: number;
  items: PatternItem[];
  bars: number;
}

const TOKEN = /^(~?)([^:!?]+)(?::(\d+))?([!?]?)$/;
const DEGREE = /^([1-7])([#b]*)(['’,]*)$/;

function parsePitch(p: string, ctx: PitchContext): number {
  const d = DEGREE.exec(p);
  if (d) {
    let acc = 0;
    for (const c of d[2]!) acc += c === '#' ? 1 : -1;
    let oct = 0;
    for (const c of d[3]!) oct += c === ',' ? -1 : 1;
    return degreeToMidi(ctx.key, ctx.scale, ctx.octave, Number(d[1]), acc, oct) + ctx.transpose;
  }
  const m = noteToMidi(p);
  if (Number.isNaN(m)) throw new Error(`bad pitch "${p}"`);
  return m + ctx.transpose;
}

/** Checks bar lines: every '|'-separated segment (ignoring empty edges) must be `stepsPerBar` long. */
function checkBars(segments: number[], stepsPerBar: number, src: string): number {
  // Drop empty segments produced by leading / trailing bar lines.
  const segs = segments.filter((s, i) => !(s === 0 && (i === 0 || i === segments.length - 1)));
  for (let i = 0; i < segs.length; i++) {
    if (segs[i] !== stepsPerBar) {
      throw new Error(`bar ${i + 1} has ${segs[i]} steps, expected ${stepsPerBar} in "${src.trim().slice(0, 60)}"`);
    }
  }
  return segs.length;
}

export function parseMelodic(src: string, ctx: PitchContext, stepsPerBar: number): ParsedPattern {
  const items: PatternItem[] = [];
  const segments: number[] = [0];
  let hasBars = false;
  let steps = 0;
  for (const tok of src.split(/\s+/)) {
    if (!tok) continue;
    if (tok === '|') {
      hasBars = true;
      segments.push(0);
      continue;
    }
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`bad token "${tok}"`);
    const len = m[3] !== undefined ? Number(m[3]) : 1;
    if (!(len >= 1 && len <= 1024)) throw new Error(`bad length in "${tok}"`);
    const body = m[2]!;
    const velMark = m[4];
    const glide = m[1] === '~';
    let item: PatternItem;
    if (body === '.' || body === '-') {
      if (glide || velMark) throw new Error(`rest/hold cannot take '~', '!' or '?': "${tok}"`);
      item = { kind: body === '.' ? ItemKind.Rest : ItemKind.Hold, len, pitches: [], vel: 0, glide: false };
    } else {
      const pitches = body.split('+').map((p) => {
        if (!p) throw new Error(`empty pitch in "${tok}"`);
        return parsePitch(p, ctx);
      });
      const vel = velMark === '!' ? VEL_ACCENT : velMark === '?' ? VEL_GHOST : VEL_NORMAL;
      item = { kind: ItemKind.Note, len, pitches, vel, glide };
    }
    items.push(item);
    steps += len;
    segments[segments.length - 1]! += len;
  }
  if (steps === 0) throw new Error('empty pattern');
  const bars = hasBars ? checkBars(segments, stepsPerBar, src) : 0;
  return { steps, items, bars };
}

export interface DrumHit {
  vel: number;
  long: boolean;
}

export interface ParsedDrums {
  steps: number;
  /** One entry per step; null = rest. */
  hits: (DrumHit | null)[];
  bars: number;
}

export function parseDrums(src: string, stepsPerBar: number): ParsedDrums {
  const hits: (DrumHit | null)[] = [];
  const segments: number[] = [0];
  let hasBars = false;
  for (const c of src) {
    if (c === ' ' || c === '\n' || c === '\t' || c === '\r') continue;
    if (c === '|') {
      hasBars = true;
      segments.push(0);
      continue;
    }
    let h: DrumHit | null;
    switch (c) {
      case 'x':
        h = { vel: VEL_NORMAL, long: false };
        break;
      case 'X':
        h = { vel: VEL_ACCENT, long: false };
        break;
      case 'o':
        h = { vel: VEL_GHOST, long: false };
        break;
      case '+':
        h = { vel: VEL_NORMAL, long: true };
        break;
      case '.':
      case '-':
        h = null;
        break;
      default:
        throw new Error(`bad drum character "${c}" in "${src.trim().slice(0, 60)}"`);
    }
    hits.push(h);
    segments[segments.length - 1]! += 1;
  }
  if (hits.length === 0) throw new Error('empty drum pattern');
  const bars = hasBars ? checkBars(segments, stepsPerBar, src) : 0;
  return { steps: hits.length, hits, bars };
}

/** Flattened, scheduler-ready track. Events are sorted by start step (CSR layout). */
export interface CompiledTrack {
  readonly track: MusicTrack;
  readonly id: string;
  readonly stepsPerBar: number;
  readonly totalSteps: number;
  /** Seconds per step. */
  readonly stepDur: number;
  /** Seconds for one pass of the song. */
  readonly duration: number;
  readonly count: number;
  /** Events of step s are indices start[s] .. start[s+1]-1. Length totalSteps + 1. */
  readonly start: Uint32Array;
  /** 0-3 melodic channel (bass, lead, arp, pad), 4-7 drum lane (kick, snare, hat, perc). */
  readonly slot: Uint8Array;
  readonly midi: Float32Array;
  /** Glide origin (MIDI) or NaN. */
  readonly from: Float32Array;
  /** Length in steps. */
  readonly len: Float32Array;
  readonly vel: Float32Array;
  /** Bit 0: long drum hit. */
  readonly flags: Uint8Array;
  /** Step index where each song entry starts (debug / tests). */
  readonly sectionStarts: readonly { name: string; step: number }[];
  /** Longest release among the instruments (s) — how long notes ring after their end. */
  readonly tail: number;
}

interface RawEvent {
  step: number;
  slot: number;
  midi: number;
  from: number;
  len: number;
  vel: number;
  flags: number;
}

export function stepsPerBarOf(t: MusicTrack): number {
  return t.beatsPerBar * t.stepsPerBeat;
}

export function stepDurationOf(t: MusicTrack): number {
  return 60 / t.bpm / t.stepsPerBeat;
}

function sectionMap(t: MusicTrack): Map<string, MusicTrack['sections'][number]> {
  const map = new Map<string, MusicTrack['sections'][number]>();
  for (const s of t.sections) {
    if (map.has(s.name)) throw new Error(`duplicate section "${s.name}"`);
    map.set(s.name, s);
  }
  return map;
}

/** Compiles a track; throws a descriptive Error on any malformed pattern or structure. */
export function compileTrack(t: MusicTrack): CompiledTrack {
  if (!(t.bpm > 0) || !(t.stepsPerBeat >= 1) || !(t.beatsPerBar >= 1)) throw new Error('bad tempo grid');
  pitchClass(t.key);
  if (!(t.scale in SCALES)) throw new Error(`unknown scale "${t.scale}"`);
  const spb = stepsPerBarOf(t);
  const sections = sectionMap(t);
  if (t.song.length === 0) throw new Error('empty song');
  const starts: { name: string; step: number }[] = [];
  let total = 0;
  for (const name of t.song) {
    const s = sections.get(name);
    if (!s) throw new Error(`song references unknown section "${name}"`);
    if (!Number.isInteger(s.bars) || s.bars < 1) throw new Error(`section "${name}" has bad bar count`);
    starts.push({ name, step: total });
    total += s.bars * spb;
  }

  const events: RawEvent[] = [];
  const inst = t.instruments;

  MELODIC_CHANNELS.forEach((ch, slot) => {
    const instrument: Instrument | undefined = inst[ch];
    const used = t.song.some((n) => sections.get(n)![ch] !== undefined);
    if (!used) return;
    if (!instrument) throw new Error(`channel "${ch}" has patterns but no instrument`);
    const octave = instrument.octave ?? DEFAULT_OCTAVE[ch];
    let open: RawEvent[] = [];
    let lastMidi = NaN;
    let pos = 0;
    const cache = new Map<string, ParsedPattern>();
    for (let i = 0; i < t.song.length; i++) {
      const sec = sections.get(t.song[i]!)!;
      const secSteps = sec.bars * spb;
      const raw = sec[ch];
      if (raw === undefined) {
        open = [];
        pos += secSteps;
        continue;
      }
      const src = patternText(raw);
      const transpose = sec.transpose ?? 0;
      const cacheKey = `${transpose}|${src}`;
      let pat = cache.get(cacheKey);
      if (!pat) {
        try {
          pat = parseMelodic(src, { key: t.key, scale: t.scale, octave, transpose }, spb);
        } catch (e) {
          throw new Error(`section "${sec.name}" ${ch}: ${(e as Error).message}`);
        }
        cache.set(cacheKey, pat);
      }
      if (secSteps % pat.steps !== 0) {
        throw new Error(
          `section "${sec.name}" ${ch}: pattern is ${pat.steps} steps, which does not divide the section (${secSteps})`,
        );
      }
      for (let rep = 0; rep < secSteps / pat.steps; rep++) {
        for (const it of pat.items) {
          if (it.kind === ItemKind.Rest) {
            open = [];
          } else if (it.kind === ItemKind.Hold) {
            for (const e of open) e.len += it.len;
          } else {
            open = [];
            for (const p of it.pitches) {
              const e: RawEvent = {
                step: pos,
                slot,
                midi: p,
                from: it.glide ? lastMidi : NaN,
                len: it.len,
                vel: it.vel,
                flags: 0,
              };
              events.push(e);
              open.push(e);
            }
            lastMidi = it.pitches[0]!;
          }
          pos += it.len;
        }
      }
    }
  });

  DRUM_LANES.forEach((lane, li) => {
    const used = t.song.some((n) => sections.get(n)!.drums?.[lane] !== undefined);
    if (!used) return;
    const kit: DrumKit | undefined = inst.drums;
    if (!kit || !kit[lane]) throw new Error(`drum lane "${lane}" has patterns but no drum voice`);
    let pos = 0;
    const cache = new Map<string, ParsedDrums>();
    for (let i = 0; i < t.song.length; i++) {
      const sec = sections.get(t.song[i]!)!;
      const secSteps = sec.bars * spb;
      const raw = sec.drums?.[lane];
      if (raw === undefined) {
        pos += secSteps;
        continue;
      }
      const src = patternText(raw);
      let pat = cache.get(src);
      if (!pat) {
        try {
          pat = parseDrums(src, spb);
        } catch (e) {
          throw new Error(`section "${sec.name}" ${lane}: ${(e as Error).message}`);
        }
        cache.set(src, pat);
      }
      if (secSteps % pat.steps !== 0) {
        throw new Error(
          `section "${sec.name}" ${lane}: pattern is ${pat.steps} steps, which does not divide the section (${secSteps})`,
        );
      }
      for (let rep = 0; rep < secSteps / pat.steps; rep++) {
        for (let k = 0; k < pat.steps; k++) {
          const h = pat.hits[k];
          if (h) {
            events.push({ step: pos, slot: DRUM_SLOT0 + li, midi: 0, from: NaN, len: 1, vel: h.vel, flags: h.long ? 1 : 0 });
          }
          pos++;
        }
      }
    }
  });

  // Stable sort by step (slot order within a step is kept: bass, lead, arp, pad, drums).
  events.sort((a, b) => a.step - b.step || a.slot - b.slot);
  const n = events.length;
  const start = new Uint32Array(total + 1);
  const slot = new Uint8Array(n);
  const midi = new Float32Array(n);
  const from = new Float32Array(n);
  const len = new Float32Array(n);
  const vel = new Float32Array(n);
  const flags = new Uint8Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const e = events[i]!;
    while (s <= e.step) start[s++] = i;
    slot[i] = e.slot;
    midi[i] = e.midi;
    from[i] = e.from;
    len[i] = e.len;
    vel[i] = e.vel;
    flags[i] = e.flags;
  }
  while (s <= total) start[s++] = n;

  let tail = 0.3;
  for (const ch of MELODIC_CHANNELS) {
    const i = inst[ch];
    if (i) tail = Math.max(tail, i.env.r + 0.05);
  }
  const stepDur = stepDurationOf(t);
  return {
    track: t,
    id: t.id,
    stepsPerBar: spb,
    totalSteps: total,
    stepDur,
    duration: total * stepDur,
    count: n,
    start,
    slot,
    midi,
    from,
    len,
    vel,
    flags,
    sectionStarts: starts,
    tail,
  };
}
