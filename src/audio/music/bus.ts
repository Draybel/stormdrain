/**
 * Music bus (built once per AudioContext):
 *
 *   players ─► musicIn ─► duck ─► muffle (low-pass) ─► compressor ─► trim ─► out (engine music volume)
 *   stingers ─► stingerIn ──────────────────────────────►┘
 *   sends ─► roomIn ─► delay ⇄ damp ─► feedback ┘   damp ─► wet ─► musicIn
 *
 * The 'room' is a damped feedback delay (cheap on phones, no convolver). Its wet output joins the
 * music before the duck so echoes dip together with the music under a stinger.
 */

import type { RoomFx } from './types';

export const DEFAULT_ROOM: Required<RoomFx> = { time: 0.27, feedback: 0.34, wet: 0.3, damp: 2400 };

/**
 * Overall music trim so music sits under the sound effects at equal volume settings (the
 * compressor adds a few dB of automatic makeup gain, so this is the knob for music vs SFX balance).
 */
export const MUSIC_TRIM = 0.45;

export class MusicBus {
  readonly musicIn: GainNode;
  readonly stingerIn: GainNode;
  readonly roomIn: GainNode;
  private readonly ctx: BaseAudioContext;
  private readonly duckGain: GainNode;
  private readonly muffleFilter: BiquadFilterNode;
  private readonly comp: DynamicsCompressorNode;
  private readonly trim: GainNode;
  private readonly delay: DelayNode;
  private readonly damp: BiquadFilterNode;
  private readonly feedback: GainNode;
  private readonly wet: GainNode;

  constructor(ctx: BaseAudioContext, out: AudioNode) {
    this.ctx = ctx;
    this.musicIn = ctx.createGain();
    this.stingerIn = ctx.createGain();
    this.roomIn = ctx.createGain();
    this.duckGain = ctx.createGain();
    this.muffleFilter = ctx.createBiquadFilter();
    this.muffleFilter.type = 'lowpass';
    this.muffleFilter.frequency.value = 18000;
    this.muffleFilter.Q.value = 0.5;
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -12;
    this.comp.knee.value = 10;
    this.comp.ratio.value = 2.5;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.22;
    this.trim = ctx.createGain();
    this.trim.gain.value = MUSIC_TRIM;

    this.delay = ctx.createDelay(1.5);
    this.damp = ctx.createBiquadFilter();
    this.damp.type = 'lowpass';
    this.feedback = ctx.createGain();
    this.wet = ctx.createGain();

    this.musicIn.connect(this.duckGain);
    this.duckGain.connect(this.muffleFilter);
    this.muffleFilter.connect(this.comp);
    this.stingerIn.connect(this.comp);
    this.comp.connect(this.trim);
    this.trim.connect(out);

    this.roomIn.connect(this.delay);
    this.delay.connect(this.damp);
    this.damp.connect(this.feedback);
    this.feedback.connect(this.delay);
    this.damp.connect(this.wet);
    this.wet.connect(this.musicIn);

    this.setRoom(undefined, 0);
  }

  /** Glides the room to a track's settings (defaults for missing fields). */
  setRoom(fx: RoomFx | undefined, now: number): void {
    const time = Math.min(1.2, Math.max(0.02, fx?.time ?? DEFAULT_ROOM.time));
    const fb = Math.min(0.85, Math.max(0, fx?.feedback ?? DEFAULT_ROOM.feedback));
    const wet = Math.min(1, Math.max(0, fx?.wet ?? DEFAULT_ROOM.wet));
    const damp = Math.min(16000, Math.max(200, fx?.damp ?? DEFAULT_ROOM.damp));
    // Short glides so a crossfade doesn't produce a delay-time pitch warble.
    this.delay.delayTime.setTargetAtTime(time, now, 0.05);
    this.feedback.gain.setTargetAtTime(fb, now, 0.3);
    this.wet.gain.setTargetAtTime(wet, now, 0.3);
    this.damp.frequency.setTargetAtTime(damp, now, 0.3);
  }

  /** Dips the music to `level` (0..1) for `hold` seconds, then recovers over `release`. */
  duck(level: number, now: number, attack: number, hold: number, release: number): void {
    const g = this.duckGain.gain;
    const lv = Math.min(1, Math.max(0, level));
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(lv, now + attack);
    g.setValueAtTime(lv, now + attack + hold);
    g.linearRampToValueAtTime(1, now + attack + hold + release);
  }

  /** Muffles the music (e.g. under the pause menu) with a low-pass sweep. */
  setMuffle(on: boolean, now: number): void {
    this.muffleFilter.frequency.setTargetAtTime(on ? 700 : 18000, now, on ? 0.08 : 0.15);
  }
}
