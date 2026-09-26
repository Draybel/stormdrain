/**
 * Procedural sound effects: every sound is a small recipe of oscillators / filtered noise with
 * envelopes, synthesised on the fly (no audio files). A voice cap and per-sound rate limits keep
 * rapid fire from turning into mush or overloading older phones.
 */

import type { LibrarySfxName } from './sfxLibrary';

export type SfxName = 'shoot' | 'hit' | 'splash' | 'dummy_pop' | 'ui_click' | 'ui_back' | 'hurt' | 'death' | 'spawn';

/** Every playable sound: the core recipes here plus the library in sfxLibrary.ts (registered at startup). */
export type SoundName = SfxName | LibrarySfxName;

export interface Recipe {
  /** Minimum seconds between two plays of this sound. */
  minGap: number;
  /** Approximate length (s), used for voice accounting. */
  length: number;
  /** Base gain (before bus volumes). */
  gain: number;
  /** Most simultaneous voices of this sound (default: only the global cap). */
  maxVoices?: number;
  play(v: Voice): void;
}

/** Everything a recipe needs, prepared by the player (so recipes stay tiny). */
export interface Voice {
  ctx: AudioContext;
  out: AudioNode;
  t: number;
  noise: AudioBuffer;
  /** Random ±1 value for per-play variation. */
  jitter: number;
}

const MAX_VOICES = 20;

function env(g: GainNode, t: number, attack: number, peak: number, decay: number): void {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function osc(v: Voice, type: OscillatorType, f0: number, f1: number, dur: number, peak: number, attack = 0.004): void {
  const o = v.ctx.createOscillator();
  const g = v.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, v.t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), v.t + dur);
  env(g, v.t, attack, peak, dur);
  o.connect(g).connect(v.out);
  o.start(v.t);
  o.stop(v.t + attack + dur + 0.02);
}

function noise(
  v: Voice,
  filter: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  dur: number,
  peak: number,
  attack = 0.002,
): void {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  // Random start inside the buffer so repeated hits don't sound identical.
  const offset = Math.random() * Math.max(0, v.noise.duration - dur - 0.05);
  const bq = v.ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, v.t);
  bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), v.t + dur);
  const g = v.ctx.createGain();
  env(g, v.t, attack, peak, dur);
  src.connect(bq).connect(g).connect(v.out);
  src.start(v.t, offset);
  src.stop(v.t + attack + dur + 0.02);
}

const RECIPES: Record<SfxName, Recipe> = {
  // Soft glassy "pip".
  shoot: {
    minGap: 0.03,
    length: 0.1,
    gain: 0.5,
    play(v) {
      const f = 1180 * (1 + v.jitter * 0.05);
      osc(v, 'triangle', f, f * 0.55, 0.075, 0.35);
      osc(v, 'sine', f * 2, f * 1.1, 0.04, 0.08);
    },
  },
  // Marble lands / plinks on stone.
  splash: {
    minGap: 0.04,
    length: 0.08,
    gain: 0.35,
    play(v) {
      const f = 1600 * (1 + v.jitter * 0.12);
      osc(v, 'sine', f, f * 0.35, 0.05, 0.25);
      noise(v, 'highpass', 3000, 5000, 0.7, 0.035, 0.12);
    },
  },
  // Thwack into burlap.
  hit: {
    minGap: 0.025,
    length: 0.12,
    gain: 0.6,
    play(v) {
      noise(v, 'bandpass', 1400 * (1 + v.jitter * 0.1), 700, 1.4, 0.07, 0.5);
      osc(v, 'sine', 210, 90, 0.08, 0.45);
    },
  },
  // Bloop + puff of straw.
  dummy_pop: {
    minGap: 0.06,
    length: 0.35,
    gain: 0.7,
    play(v) {
      osc(v, 'sine', 240, 760, 0.09, 0.45, 0.005);
      osc(v, 'square', 120, 60, 0.12, 0.08);
      noise(v, 'lowpass', 3200, 260, 0.9, 0.3, 0.45, 0.01);
    },
  },
  // Dummy grows back.
  spawn: {
    minGap: 0.1,
    length: 0.2,
    gain: 0.25,
    play(v) {
      osc(v, 'triangle', 300, 620, 0.14, 0.3, 0.02);
      noise(v, 'lowpass', 900, 2000, 0.8, 0.12, 0.12, 0.02);
    },
  },
  ui_click: {
    minGap: 0.03,
    length: 0.08,
    gain: 0.35,
    play(v) {
      osc(v, 'square', 880, 860, 0.03, 0.18);
      const t = v.t;
      v.t = t + 0.035;
      osc(v, 'square', 1320, 1300, 0.035, 0.14);
      v.t = t;
    },
  },
  ui_back: {
    minGap: 0.03,
    length: 0.1,
    gain: 0.35,
    play(v) {
      osc(v, 'square', 660, 650, 0.035, 0.16);
      const t = v.t;
      v.t = t + 0.04;
      osc(v, 'square', 440, 430, 0.05, 0.14);
      v.t = t;
    },
  },
  hurt: {
    minGap: 0.1,
    length: 0.3,
    gain: 0.6,
    play(v) {
      osc(v, 'sawtooth', 520, 130, 0.25, 0.3);
      noise(v, 'bandpass', 1800, 400, 1, 0.15, 0.3);
    },
  },
  death: {
    minGap: 0.3,
    length: 0.8,
    gain: 0.6,
    play(v) {
      osc(v, 'triangle', 660, 110, 0.7, 0.4, 0.01);
      osc(v, 'sine', 330, 55, 0.75, 0.3, 0.01);
      noise(v, 'lowpass', 2000, 150, 0.7, 0.5, 0.25, 0.02);
    },
  },
};

/** Recipes added by other modules (sfxLibrary.ts). Core RECIPES win on a name clash. */
const EXTRA = new Map<string, Recipe>();

/** Registers extra recipes; names that already exist (core or registered) are skipped and returned. */
export function registerSfx(recipes: Readonly<Record<string, Recipe>>): string[] {
  const skipped: string[] = [];
  for (const name of Object.keys(recipes)) {
    if (Object.prototype.hasOwnProperty.call(RECIPES, name) || EXTRA.has(name)) skipped.push(name);
    else EXTRA.set(name, recipes[name]!);
  }
  return skipped;
}

function recipeFor(name: string): Recipe | undefined {
  if (Object.prototype.hasOwnProperty.call(RECIPES, name)) return (RECIPES as Readonly<Record<string, Recipe>>)[name];
  return EXTRA.get(name);
}

/** Names of every playable sound (core first). */
export function sfxNames(): string[] {
  return [...Object.keys(RECIPES), ...EXTRA.keys()];
}

export function coreSfxNames(): string[] {
  return Object.keys(RECIPES);
}

export class SfxPlayer {
  private readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private readonly noiseBuf: AudioBuffer;
  private readonly last = new Map<string, number>();
  /** End times of playing voices (fixed slots, no allocation). */
  private readonly voiceEnds = new Float64Array(MAX_VOICES);
  /** Which sound each voice slot is playing (for per-sound voice limits). */
  private readonly voiceNames: (string | null)[] = new Array<string | null>(MAX_VOICES).fill(null);
  private readonly voice: Voice;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.out = out;
    // One second of white noise shared by every noise-based recipe.
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.voice = { ctx, out, t: 0, noise: this.noiseBuf, jitter: 0 };
  }

  /**
   * @param pan    -1 (left) .. 1 (right)
   * @param volume 0..1 extra scale
   */
  play(name: SoundName, pan = 0, volume = 1): void {
    const r = recipeFor(name);
    if (!r) return;
    const now = this.ctx.currentTime;
    const last = this.last.get(name);
    if (last !== undefined && now - last < r.minGap) return;
    // Find a free voice slot (and count this sound's live voices for its own limit).
    let slot = -1;
    let same = 0;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voiceEnds[i]! <= now) {
        if (slot < 0) slot = i;
      } else if (this.voiceNames[i] === name) {
        same++;
      }
    }
    if (slot < 0) return;
    if (r.maxVoices !== undefined && same >= r.maxVoices) return;
    this.voiceEnds[slot] = now + r.length;
    this.voiceNames[slot] = name;
    this.last.set(name, now);

    // Per-voice gain (+ optional panner). Nodes are released by the browser once the
    // scheduled sources stop, so nothing needs manual cleanup.
    const g = this.ctx.createGain();
    g.gain.value = r.gain * volume;
    if (pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(this.out);
    } else {
      g.connect(this.out);
    }
    const v = this.voice;
    v.out = g;
    v.t = now + 0.005;
    v.jitter = Math.random() * 2 - 1;
    r.play(v);
  }
}
