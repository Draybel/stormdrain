/**
 * One playing instance of a compiled track: persistent channel strips (gain → static filter → pan,
 * plus a room send) feeding a fader, and a StepClock that the director pumps every scheduler tick.
 * Crossfades, pause/resume and stingers are all built from starting / fading these players.
 */

import { StepClock } from './clock';
import type { CompiledTrack } from './parse';
import { scheduleDrum, scheduleNote, SourceRing, type SynthEnv } from './synth';
import { DRUM_LANES, DRUM_SLOT0, MELODIC_CHANNELS, SLOT_COUNT, type DrumVoice, type Instrument } from './types';

function makePanner(ctx: BaseAudioContext, pan: number): AudioNode | null {
  if (!pan || typeof ctx.createStereoPanner !== 'function') return null;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  return p;
}

export class TrackPlayer {
  readonly compiled: CompiledTrack;
  readonly clock: StepClock;
  /** Player fader (crossfades / fade-outs). */
  readonly out: GainNode;
  /** When set, the director disposes the player once the context time passes it. */
  disposeAt = Infinity;
  /** Notes + drum hits scheduled so far (diagnostics). */
  scheduled = 0;
  private readonly env: SynthEnv;
  private readonly strips: (AudioNode | null)[] = new Array<AudioNode | null>(SLOT_COUNT).fill(null);
  private readonly insts: (Instrument | null)[] = new Array<Instrument | null>(4).fill(null);
  private readonly drums: (DrumVoice | null)[] = new Array<DrumVoice | null>(4).fill(null);
  private readonly nodes: AudioNode[] = [];
  /** Long notes still ringing, cut on dispose. */
  private readonly ring = new SourceRing();
  private readonly level: number;
  private disposed = false;

  constructor(
    env: SynthEnv,
    compiled: CompiledTrack,
    dest: AudioNode,
    send: AudioNode,
    startTime: number,
    startStep: number,
    fadeIn: number,
  ) {
    this.env = env;
    this.compiled = compiled;
    const ctx = env.ctx;
    const t = compiled.track;
    this.level = t.gain ?? 1;
    this.out = ctx.createGain();
    this.nodes.push(this.out);
    const g = this.out.gain;
    if (fadeIn > 0) {
      g.setValueAtTime(0, startTime);
      g.linearRampToValueAtTime(this.level, startTime + fadeIn);
    } else {
      g.value = this.level;
    }
    this.out.connect(dest);

    MELODIC_CHANNELS.forEach((ch, slot) => {
      const inst = t.instruments[ch];
      if (!inst) return;
      this.insts[slot] = inst;
      const input = ctx.createGain();
      input.gain.value = inst.gain;
      this.nodes.push(input);
      let node: AudioNode = input;
      const f = inst.filter;
      if (f && !f.env) {
        const bq = ctx.createBiquadFilter();
        bq.type = f.type;
        bq.frequency.value = f.cutoff;
        bq.Q.value = f.q ?? 0.7;
        node.connect(bq);
        node = bq;
        this.nodes.push(bq);
      }
      const p = makePanner(ctx, inst.pan ?? 0);
      if (p) {
        node.connect(p);
        node = p;
        this.nodes.push(p);
      }
      node.connect(this.out);
      if (inst.delay) {
        const s = ctx.createGain();
        s.gain.value = inst.delay;
        node.connect(s);
        s.connect(send);
        this.nodes.push(s);
      }
      this.strips[slot] = input;
    });

    const kit = t.instruments.drums;
    if (kit) {
      let kitSend: GainNode | null = null;
      if (kit.delay) {
        kitSend = ctx.createGain();
        kitSend.gain.value = kit.delay;
        kitSend.connect(send);
        this.nodes.push(kitSend);
      }
      DRUM_LANES.forEach((lane, li) => {
        const v = kit[lane];
        if (!v) return;
        this.drums[li] = v;
        const input = ctx.createGain();
        input.gain.value = kit.gain * (v.gain ?? 1);
        this.nodes.push(input);
        let node: AudioNode = input;
        const p = makePanner(ctx, v.pan ?? 0);
        if (p) {
          node.connect(p);
          node = p;
          this.nodes.push(p);
        }
        node.connect(this.out);
        if (kitSend) node.connect(kitSend);
        this.strips[DRUM_SLOT0 + li] = input;
      });
    }

    this.clock = new StepClock(compiled.stepDur, t.swing ?? 0, compiled.totalSteps, t.loop);
    this.clock.start(startTime, startStep);
  }

  /** Bound once: the clock calls it for each due step (no per-step allocation). */
  private readonly onStep = (songStep: number, time: number): void => {
    const c = this.compiled;
    const end = c.start[songStep + 1]!;
    for (let i = c.start[songStep]!; i < end; i++) {
      const slot = c.slot[i]!;
      const dest = this.strips[slot];
      if (!dest) continue;
      if (slot < DRUM_SLOT0) {
        const dur = c.len[i]! * c.stepDur;
        scheduleNote(this.env, dest, this.insts[slot]!, c.midi[i]!, c.from[i]!, time, dur, c.vel[i]!, this.ring);
      } else {
        scheduleDrum(this.env, dest, this.drums[slot - DRUM_SLOT0]!, time, c.vel[i]!, c.flags[i] === 1);
      }
      this.scheduled++;
    }
  };

  pump(now: number, horizon: number): void {
    if (this.disposed) return;
    this.clock.pump(now, horizon, this.onStep);
  }

  /** A one-shot track whose last note has rung out. */
  finishedAt(now: number): boolean {
    return !this.compiled.track.loop && this.clock.done && now >= this.clock.endTime + this.compiled.tail;
  }

  /** Fades to silence over `dur`, stops scheduling, and marks the player for disposal. */
  fadeOut(now: number, dur: number): void {
    const d = Math.max(0.01, dur);
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + d);
    this.clock.stopTime = Math.min(this.clock.stopTime, now + d);
    this.disposeAt = Math.min(this.disposeAt, now + d + 0.1);
  }

  /** Stops long notes and disconnects the channel strips (call after the fade). */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.ring.stopAll(this.env.ctx.currentTime);
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already disconnected */
      }
    }
    this.nodes.length = 0;
  }

  get isDisposed(): boolean {
    return this.disposed;
  }
}
