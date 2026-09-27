/**
 * Note and drum voices for the sequencer. Every call builds a handful of short-lived nodes
 * (oscillators can't be restarted), schedules their whole envelope up front on the AudioContext
 * clock and stops them right after the release, so the browser frees them on its own.
 * Channel-level nodes (gain, static filter, pan, sends) live in TrackPlayer and are reused.
 */

import { midiToFreq } from './theory';
import type { DrumVoice, Instrument } from './types';

export interface SynthEnv {
  readonly ctx: BaseAudioContext;
  /** Shared white-noise buffer (1 s) for noise layers and drums. */
  readonly noise: AudioBuffer;
}

export function makeNoiseBuffer(ctx: BaseAudioContext, seconds = 1): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Deterministic LCG noise: identical texture every session, no Math.random dependency.
  let s = 0x2545f491;
  for (let i = 0; i < len; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = (s / 4294967296) * 2 - 1;
  }
  return buf;
}

/**
 * Fixed-size ring of long-lived note sources (no allocation per note), so a disposed player can
 * cut its still-ringing pads instead of leaving disconnected oscillators running until their end.
 */
export class SourceRing {
  private readonly nodes: (AudioScheduledSourceNode | null)[];
  private readonly ends: Float64Array;
  private i = 0;

  constructor(size = 128) {
    this.nodes = new Array<AudioScheduledSourceNode | null>(size).fill(null);
    this.ends = new Float64Array(size);
  }

  add(node: AudioScheduledSourceNode, end: number): void {
    this.nodes[this.i] = node;
    this.ends[this.i] = end;
    this.i = (this.i + 1) % this.nodes.length;
  }

  /** Stops every tracked source still scheduled past `now`. */
  stopAll(now: number): void {
    for (let k = 0; k < this.nodes.length; k++) {
      const n = this.nodes[k];
      if (n && this.ends[k]! > now) {
        try {
          n.stop(now);
        } catch {
          /* already stopped */
        }
      }
      this.nodes[k] = null;
    }
  }
}

/** Notes longer than this (s) are tracked in the player's SourceRing. */
const LONG_NOTE = 0.5;

const NYQUIST_SAFE = 18000;
const MIN_GAIN = 0.0005;

function clampFreq(f: number): number {
  return f < 20 ? 20 : f > NYQUIST_SAFE ? NYQUIST_SAFE : f;
}

function noiseSource(env: SynthEnv, t: number, dur: number): AudioBufferSourceNode {
  const src = env.ctx.createBufferSource();
  src.buffer = env.noise;
  src.loop = true;
  // Start somewhere inside the buffer so consecutive hits don't phase identically.
  const offset = ((t * 7.919) % 1) * Math.max(0, env.noise.duration - 0.01);
  src.start(t, offset);
  src.stop(t + dur + 0.02);
  return src;
}

/**
 * Schedules one melodic note. `dur` is the written length in seconds (before gate / release).
 * `fromMidi` (finite) glides the pitch from that note.
 */
export function scheduleNote(
  env: SynthEnv,
  dest: AudioNode,
  inst: Instrument,
  midi: number,
  fromMidi: number,
  t: number,
  dur: number,
  vel: number,
  ring?: SourceRing,
): void {
  const ctx = env.ctx;
  const e = inst.env;
  const hold = Math.max(0.01, dur * (inst.gate ?? 1));
  const tOff = t + hold;
  const rel = Math.max(0.01, e.r);
  const end = tOff + rel;
  const track = ring && end - t > LONG_NOTE ? ring : null;

  // Amplitude envelope, fully precomputed (no cancel needed later).
  const amp = ctx.createGain();
  const g = amp.gain;
  const a = Math.max(0.001, e.a);
  g.setValueAtTime(0, t);
  if (hold <= a) {
    g.linearRampToValueAtTime((vel * hold) / a, tOff);
  } else {
    g.linearRampToValueAtTime(vel, t + a);
    if (e.s < 1) {
      const sus = vel * e.s;
      const tc = Math.max(0.005, e.d) / 3;
      g.setTargetAtTime(sus, t + a, tc);
      // Exact value of the exponential approach at note-off, so the release starts without a jump.
      g.setValueAtTime(sus + (vel - sus) * Math.exp(-(hold - a) / tc), tOff);
    } else {
      g.setValueAtTime(vel, tOff);
    }
  }
  g.linearRampToValueAtTime(0, end);
  amp.connect(dest);

  // Optional per-note filter (only when the instrument has a filter envelope).
  let into: AudioNode = amp;
  const f = inst.filter;
  if (f && f.env) {
    const bq = ctx.createBiquadFilter();
    bq.type = f.type;
    bq.Q.value = f.q ?? 0.7;
    const base = clampFreq(f.cutoff * Math.pow(2, ((midi - 60) / 12) * (f.keyTrack ?? 0)));
    const peak = clampFreq(base + f.env * vel);
    bq.frequency.setValueAtTime(peak, t);
    bq.frequency.setTargetAtTime(base, t, Math.max(0.005, f.decay ?? 0.2) / 3);
    bq.connect(amp);
    into = bq;
  }

  // Vibrato: one LFO per note feeding every oscillator's detune.
  let lfoGain: GainNode | null = null;
  const vib = inst.vibrato;
  if (vib && vib.depth > 0 && vib.rate > 0) {
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = vib.rate;
    lfoGain = ctx.createGain();
    const delay = vib.delay ?? 0;
    if (delay > 0) {
      lfoGain.gain.setValueAtTime(0, t);
      lfoGain.gain.linearRampToValueAtTime(vib.depth, t + delay);
    } else {
      lfoGain.gain.value = vib.depth;
    }
    lfo.connect(lfoGain);
    lfo.start(t);
    lfo.stop(end + 0.02);
    track?.add(lfo, end);
  }

  const freq = midiToFreq(midi);
  const glideFrom = Number.isFinite(fromMidi) ? midiToFreq(fromMidi) : 0;
  const glide = Math.max(0.005, inst.glide ?? 0.06);
  const layers = inst.osc;
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li]!;
    const voices = Math.max(1, Math.min(4, L.voices ?? 1));
    const layerGain = (L.gain ?? 1) / Math.sqrt(voices);
    let layerOut: AudioNode = into;
    if (layerGain !== 1) {
      const lg = ctx.createGain();
      lg.gain.value = layerGain;
      lg.connect(into);
      layerOut = lg;
    }
    if (L.wave === 'noise') {
      const ns = noiseSource(env, t, end - t);
      ns.connect(layerOut);
      track?.add(ns, end);
      continue;
    }
    const mult = Math.pow(2, (L.octave ?? 0) + (L.semi ?? 0) / 12);
    const spread = L.detune ?? 0;
    for (let v = 0; v < voices; v++) {
      const o = ctx.createOscillator();
      o.type = L.wave;
      const target = clampFreq(freq * mult);
      if (glideFrom > 0) {
        o.frequency.setValueAtTime(clampFreq(glideFrom * mult), t);
        o.frequency.exponentialRampToValueAtTime(target, t + glide);
      } else {
        o.frequency.setValueAtTime(target, t);
      }
      o.detune.value = voices > 1 ? -spread / 2 + (spread * v) / (voices - 1) : spread;
      if (lfoGain) lfoGain.connect(o.detune);
      o.connect(layerOut);
      o.start(t);
      o.stop(end + 0.02);
      track?.add(o, end);
    }
  }
}

/** Default pitch (Hz) and decay (s) per drum kind. */
const DRUM_DEFAULTS: Readonly<Record<DrumVoice['kind'], readonly [number, number]>> = {
  kick: [52, 0.32],
  snare: [190, 0.16],
  hat: [9000, 0.045],
  clap: [1300, 0.14],
  rim: [1700, 0.04],
  tom: [120, 0.28],
  shaker: [6000, 0.07],
  block: [820, 0.07],
  bell: [880, 1.2],
  drip: [700, 0.12],
  clank: [320, 0.16],
  thump: [70, 0.2],
  cymbal: [7000, 1.1],
};

/** Decaying gain: 2 ms attack to `peak`, exponential decay to silence by `t + decay`. */
function hitGain(ctx: BaseAudioContext, dest: AudioNode, t: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.max(MIN_GAIN * 2, peak), t + 0.002);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 0.002 + decay);
  g.connect(dest);
  return g;
}

function tone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  f0: number,
  f1: number,
  sweep: number,
  t: number,
  peak: number,
  decay: number,
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(clampFreq(f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(clampFreq(f1), t + Math.max(0.003, sweep));
  o.connect(hitGain(ctx, dest, t, peak, decay));
  o.start(t);
  o.stop(t + decay + 0.03);
}

function noiseHit(
  env: SynthEnv,
  dest: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q: number,
  t: number,
  peak: number,
  decay: number,
): void {
  const ctx = env.ctx;
  const bq = ctx.createBiquadFilter();
  bq.type = type;
  bq.frequency.value = clampFreq(freq);
  bq.Q.value = q;
  bq.connect(hitGain(ctx, dest, t, peak, decay));
  noiseSource(env, t, decay + 0.01).connect(bq);
}

/** Schedules one drum hit. `long` = open hat / ringing variant (the '+' pattern character). */
export function scheduleDrum(env: SynthEnv, dest: AudioNode, voice: DrumVoice, t: number, vel: number, long: boolean): void {
  const ctx = env.ctx;
  const def = DRUM_DEFAULTS[voice.kind];
  const p = voice.pitch ?? def[0];
  const decay = (voice.decay ?? def[1]) * (long ? 3 : 1);
  const tn = voice.tone ?? 0.5;
  switch (voice.kind) {
    case 'kick':
      tone(ctx, dest, 'sine', p * 3.2, p, 0.05, t, vel, decay);
      if (tn > 0.2) noiseHit(env, dest, 'highpass', 2500 + tn * 3000, 0.7, t, vel * tn * 0.25, 0.012);
      break;
    case 'snare':
      tone(ctx, dest, 'triangle', p * 1.25, p, 0.04, t, vel * 0.55, Math.min(decay, 0.09));
      noiseHit(env, dest, 'highpass', 1200 + tn * 2600, 0.8, t, vel * 0.7, decay);
      break;
    case 'hat':
      noiseHit(env, dest, 'highpass', Math.max(4000, p * (0.75 + tn * 0.5)), 0.9, t, vel * 0.45, decay);
      break;
    case 'clap': {
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = clampFreq(p * (0.8 + tn * 0.6));
      bq.Q.value = 1.3;
      const g = ctx.createGain();
      const gg = g.gain;
      gg.setValueAtTime(0, t);
      for (let k = 0; k < 3; k++) {
        const tk = t + k * 0.011;
        gg.linearRampToValueAtTime(vel * 0.8, tk + 0.001);
        gg.linearRampToValueAtTime(vel * 0.2, tk + 0.009);
      }
      gg.linearRampToValueAtTime(vel * 0.7, t + 0.035);
      gg.exponentialRampToValueAtTime(MIN_GAIN, t + 0.035 + decay);
      bq.connect(g).connect(dest);
      noiseSource(env, t, 0.04 + decay).connect(bq);
      break;
    }
    case 'rim':
      tone(ctx, dest, 'triangle', p, p * 0.96, decay, t, vel * 0.6, decay);
      noiseHit(env, dest, 'bandpass', p * 1.8, 2, t, vel * 0.35, decay * 0.6);
      break;
    case 'tom':
      tone(ctx, dest, 'sine', p * 1.6, p, decay * 0.5, t, vel * 0.9, decay);
      break;
    case 'shaker': {
      const bq = ctx.createBiquadFilter();
      bq.type = 'highpass';
      bq.frequency.value = clampFreq(p * (0.7 + tn * 0.6));
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vel * 0.35, t + 0.015);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 0.015 + decay);
      bq.connect(g).connect(dest);
      noiseSource(env, t, 0.02 + decay).connect(bq);
      break;
    }
    case 'block':
      tone(ctx, dest, 'triangle', p, p, 0, t, vel * 0.7, decay);
      tone(ctx, dest, 'sine', p * 2.34, p * 2.3, decay, t, vel * 0.25 * (0.5 + tn), decay * 0.6);
      break;
    case 'bell':
      tone(ctx, dest, 'sine', p, p, 0, t, vel * 0.45, decay);
      tone(ctx, dest, 'sine', p * 2.76, p * 2.76, 0, t, vel * 0.18 * (0.5 + tn), decay * 0.55);
      tone(ctx, dest, 'sine', p * 5.4, p * 5.4, 0, t, vel * 0.08 * (0.5 + tn), decay * 0.25);
      break;
    case 'drip':
      tone(ctx, dest, 'sine', p, p * 2.6, 0.045, t, vel * 0.55, decay);
      break;
    case 'clank': {
      const bq = ctx.createBiquadFilter();
      bq.type = 'bandpass';
      bq.frequency.value = clampFreq(p * (3 + tn * 3));
      bq.Q.value = 2.5;
      const g = hitGain(ctx, dest, t, vel * 0.5, decay);
      bq.connect(g);
      for (const r of CLANK_RATIOS) {
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.value = clampFreq(p * r);
        o.connect(bq);
        o.start(t);
        o.stop(t + decay + 0.03);
      }
      break;
    }
    case 'thump':
      tone(ctx, dest, 'sine', p * 1.5, p, 0.03, t, vel * 0.8, decay);
      noiseHit(env, dest, 'lowpass', 300 + tn * 500, 0.8, t, vel * 0.5, decay * 0.5);
      break;
    case 'cymbal':
      noiseHit(env, dest, 'highpass', Math.max(3000, p * (0.6 + tn * 0.5)), 0.6, t, vel * 0.3, decay);
      noiseHit(env, dest, 'bandpass', p * 1.2, 1.5, t, vel * 0.15, decay * 0.5);
      break;
  }
}

const CLANK_RATIOS = [1, 1.47, 2.09] as const;
