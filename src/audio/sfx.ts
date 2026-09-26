/**
 * Procedural sound effects: every sound is a small recipe of oscillators / filtered noise with
 * envelopes, synthesised on the fly (no audio files). A voice cap and per-sound rate limits keep
 * rapid fire from turning into mush or overloading older phones.
 */

import { GAMEPLAY_RECIPES, type GameplaySfxName } from './sfxGameplay';
import { noise, osc, type Recipe, type Voice } from './synth';

/** Phase 1 core sounds (UI, shooting, dummies, hurt/death). */
export type CoreSfxName = 'shoot' | 'hit' | 'splash' | 'dummy_pop' | 'ui_click' | 'ui_back' | 'hurt' | 'death' | 'spawn';
export type SfxName = CoreSfxName | GameplaySfxName;

const MAX_VOICES = 20;

const CORE_RECIPES: Record<CoreSfxName, Recipe> = {
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

const RECIPES: Record<SfxName, Recipe> = { ...CORE_RECIPES, ...GAMEPLAY_RECIPES };

export class SfxPlayer {
  private readonly ctx: AudioContext;
  private readonly out: AudioNode;
  private readonly noiseBuf: AudioBuffer;
  private readonly last = new Map<SfxName, number>();
  /** End times of playing voices (fixed slots, no allocation). */
  private readonly voiceEnds = new Float64Array(MAX_VOICES);
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
  play(name: SfxName, pan = 0, volume = 1): void {
    const r = RECIPES[name];
    if (!r) return;
    const now = this.ctx.currentTime;
    const last = this.last.get(name);
    if (last !== undefined && now - last < r.minGap) return;
    // Find a free voice slot.
    let slot = -1;
    for (let i = 0; i < MAX_VOICES; i++) {
      if (this.voiceEnds[i]! <= now) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    this.voiceEnds[slot] = now + r.length;
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
