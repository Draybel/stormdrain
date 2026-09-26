/**
 * MusicDirector — the public music API (`audio.music`).
 *
 * Lookahead scheduler: a setInterval (25 ms) pumps every live TrackPlayer, which schedules each step
 * due within the next 120 ms at its exact AudioContext time. The interval only runs while something
 * is playing and stops while the page is backgrounded.
 *
 * Silent-safe: before `attach()` (no AudioContext yet — iOS waits for the first tap — or none at all)
 * every call just records the wanted state; the wanted track starts as soon as a context is attached.
 */

import { MusicBus } from './bus';
import type { CompiledTrack } from './parse';
import { TrackPlayer } from './player';
import { getCompiledTrack } from './registry';
import { makeNoiseBuffer, type SynthEnv } from './synth';

export const SCHEDULE_INTERVAL_MS = 25;
export const LOOKAHEAD = 0.12;
/** Small offset so the first notes of a new player are never already in the past. */
const START_OFFSET = 0.03;

export interface PlayOptions {
  /** Crossfade / fade-in seconds (default 1.2; 0 = hard cut). */
  fade?: number;
  /** Restart even if this track is already the current one. */
  restart?: boolean;
}

export interface StingerOptions {
  /** Music level under the stinger, 0..1 (default 0.3). Ignored with `then` / `stopMusic`. */
  duck?: number;
  /** Track that starts exactly when the stinger ends (the current music fades out first). */
  then?: string;
  /** Fade the current music out for good (game over, victory). */
  stopMusic?: boolean;
  /** Fade-out time for the current music with `then` / `stopMusic` (default 0.3 s). */
  fadeOut?: number;
}

export interface MusicControl {
  /** Wanted track id (also while paused or before audio is unlocked). */
  readonly current: string | null;
  readonly paused: boolean;
  /** Crossfades to a track (no-op if it is already current, unless `restart`). */
  play(id: string, opts?: PlayOptions): void;
  stop(fade?: number): void;
  /** Plays a one-shot on top of (ducked) music, or in place of it (`then`, `stopMusic`). */
  stinger(id: string, opts?: StingerOptions): void;
  /** Dips the music (boss roar, big explosion): to `level` for `hold` s, back over `release` s. */
  duck(level?: number, hold?: number, release?: number): void;
  /** Fades out and remembers the bar; `resume()` picks the song up from there. */
  pause(): void;
  resume(): void;
  /** Low-pass the music (e.g. under the pause menu). */
  muffle(on: boolean): void;
  has(id: string): boolean;
}

export interface TimerApi {
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

const DEFAULT_TIMERS: TimerApi = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
};

export type TrackLookup = (id: string) => CompiledTrack | null;

export class MusicDirector implements MusicControl {
  private ctx: BaseAudioContext | null = null;
  private env: SynthEnv | null = null;
  private bus: MusicBus | null = null;
  private main: TrackPlayer | null = null;
  /** Players fading out or ringing out, disposed when their time comes. */
  private readonly retiring: TrackPlayer[] = [];
  private readonly stingers: TrackPlayer[] = [];
  private wanted: string | null = null;
  private isPaused = false;
  /** Global step to resume from (bar-aligned). */
  private resumeStep = 0;
  private suspended = false;
  private muffled = false;
  private timer: unknown = null;
  private readonly warned = new Set<string>();
  private readonly lookup: TrackLookup;
  private readonly timers: TimerApi;

  constructor(lookup: TrackLookup = getCompiledTrack, timers: TimerApi = DEFAULT_TIMERS) {
    this.lookup = lookup;
    this.timers = timers;
  }

  get current(): string | null {
    return this.wanted;
  }

  get paused(): boolean {
    return this.isPaused;
  }

  get attached(): boolean {
    return this.ctx !== null;
  }

  /** Live players (main + retiring + stingers) — diagnostics / tests. */
  get playerCount(): number {
    return (this.main ? 1 : 0) + this.retiring.length + this.stingers.length;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  has(id: string): boolean {
    return this.lookup(id) !== null;
  }

  /** Snapshot for tests and the debug overlay. */
  inspect(): {
    current: string | null;
    paused: boolean;
    running: boolean;
    main: { id: string; t0: number; next: number; scheduled: number } | null;
    retiring: number;
    stingers: number;
  } {
    const m = this.main;
    return {
      current: this.wanted,
      paused: this.isPaused,
      running: this.timer !== null,
      main: m ? { id: m.compiled.id, t0: m.clock.t0, next: m.clock.next, scheduled: m.scheduled } : null,
      retiring: this.retiring.length,
      stingers: this.stingers.length,
    };
  }

  /** Connects to an AudioContext; `out` is the engine's music volume bus. */
  attach(ctx: BaseAudioContext, out: AudioNode): void {
    if (this.ctx) return;
    try {
      this.ctx = ctx;
      this.env = { ctx, noise: makeNoiseBuffer(ctx, 1) };
      this.bus = new MusicBus(ctx, out);
      if (this.muffled) this.bus.setMuffle(true, ctx.currentTime);
    } catch {
      this.ctx = null;
      this.env = null;
      this.bus = null;
      return;
    }
    if (this.wanted && !this.isPaused) this.startMain(this.wanted, 0.8, this.resumeStep);
  }

  /** Lifecycle: stop the scheduler while the page is hidden (the context is suspended anyway). */
  setSuspended(s: boolean): void {
    this.suspended = s;
    if (s) this.stopTimer();
    else if (this.playerCount > 0) this.ensureTimer();
  }

  play(id: string, opts?: PlayOptions): void {
    if (!this.resolve(id)) return;
    const already = this.wanted === id && (this.main !== null || this.isPaused || !this.ctx);
    if (already && !opts?.restart) return;
    this.wanted = id;
    this.resumeStep = 0;
    if (this.isPaused || !this.ctx) return;
    this.startMain(id, opts?.fade ?? 1.2, 0);
  }

  stop(fade = 1): void {
    this.wanted = null;
    this.resumeStep = 0;
    this.isPaused = false;
    this.retireMain(fade);
  }

  stinger(id: string, opts?: StingerOptions): void {
    const c = this.resolve(id);
    if (!c) return;
    const replace = opts?.then !== undefined || opts?.stopMusic === true;
    if (replace) {
      const next = opts?.then && this.resolve(opts.then) ? opts.then : null;
      this.wanted = next;
      this.resumeStep = 0;
    }
    const ctx = this.ctx;
    if (!ctx || !this.env || !this.bus || this.isPaused) return;
    const now = ctx.currentTime;
    const t = now + START_OFFSET;
    const p = new TrackPlayer(this.env, c, this.bus.stingerIn, this.bus.roomIn, t, 0, 0);
    this.stingers.push(p);
    if (replace) {
      this.retireMain(opts?.fadeOut ?? 0.3);
      if (this.wanted) {
        // The next track starts on the exact sample the stinger's last step ends.
        const nc = this.lookup(this.wanted)!;
        this.main = new TrackPlayer(this.env, nc, this.bus.musicIn, this.bus.roomIn, t + c.duration, 0, 0);
        this.bus.setRoom(nc.track.room, t + c.duration);
      }
    } else {
      this.bus.duck(opts?.duck ?? 0.3, now, 0.06, c.duration, 0.7);
    }
    this.ensureTimer();
    this.tick();
  }

  duck(level = 0.35, hold = 0.4, release = 0.8): void {
    if (!this.ctx || !this.bus) return;
    this.bus.duck(level, this.ctx.currentTime, 0.04, hold, release);
  }

  pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    const ctx = this.ctx;
    if (!ctx) return;
    for (const s of this.stingers) s.fadeOut(ctx.currentTime, 0.2);
    const m = this.main;
    if (!m) return;
    // Resume from the start of the bar that was playing, so held chords re-trigger musically.
    const step = m.clock.stepAt(ctx.currentTime);
    const spb = m.compiled.stepsPerBar;
    const bar = Math.floor(m.clock.songStep(step) / spb) * spb;
    this.resumeStep = m.compiled.track.loop ? bar : 0;
    this.retireMain(0.25);
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    if (this.wanted && this.ctx) this.startMain(this.wanted, 0.5, this.resumeStep);
  }

  muffle(on: boolean): void {
    this.muffled = on;
    if (this.ctx && this.bus) this.bus.setMuffle(on, this.ctx.currentTime);
  }

  /** One scheduler pass (public for tests). */
  tick = (): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const m = this.main;
    if (m) {
      m.pump(now, horizon);
      if (m.finishedAt(now)) {
        // A one-shot played through play(): it is over.
        m.dispose();
        this.main = null;
        if (this.wanted === m.compiled.id) this.wanted = null;
      }
    }
    for (let i = this.stingers.length - 1; i >= 0; i--) {
      const p = this.stingers[i]!;
      p.pump(now, horizon);
      if (p.finishedAt(now) || now >= p.disposeAt) {
        p.dispose();
        this.stingers[i] = this.stingers[this.stingers.length - 1]!;
        this.stingers.pop();
      }
    }
    for (let i = this.retiring.length - 1; i >= 0; i--) {
      const p = this.retiring[i]!;
      p.pump(now, horizon);
      if (now >= p.disposeAt || p.finishedAt(now)) {
        p.dispose();
        this.retiring[i] = this.retiring[this.retiring.length - 1]!;
        this.retiring.pop();
      }
    }
    if (this.playerCount === 0) this.stopTimer();
  };

  private resolve(id: string): CompiledTrack | null {
    const c = this.lookup(id);
    if (!c && !this.warned.has(id)) {
      this.warned.add(id);
      console.warn(`music: unknown track "${id}"`);
    }
    return c;
  }

  private startMain(id: string, fade: number, step: number): void {
    const ctx = this.ctx;
    const c = this.lookup(id);
    if (!ctx || !this.env || !this.bus || !c) return;
    const now = ctx.currentTime;
    this.retireMain(fade > 0 ? fade : 0.02);
    this.main = new TrackPlayer(this.env, c, this.bus.musicIn, this.bus.roomIn, now + START_OFFSET, step, fade);
    this.bus.setRoom(c.track.room, now);
    this.ensureTimer();
    this.tick();
  }

  private retireMain(fade: number): void {
    const m = this.main;
    if (!m) return;
    this.main = null;
    if (this.ctx) m.fadeOut(this.ctx.currentTime, fade);
    this.retiring.push(m);
  }

  private ensureTimer(): void {
    if (this.timer !== null || this.suspended || !this.ctx) return;
    this.timer = this.timers.setInterval(this.tick, SCHEDULE_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    this.timers.clearInterval(this.timer);
    this.timer = null;
  }
}
