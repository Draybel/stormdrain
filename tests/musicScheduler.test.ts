import { describe, expect, it, vi } from 'vitest';
import { NullAudio } from '../src/audio/engine';
import { LATE_TOLERANCE, StepClock } from '../src/audio/music/clock';
import { LOOKAHEAD, MusicDirector, SCHEDULE_INTERVAL_MS, type TimerApi } from '../src/audio/music/director';
import { FakeAudioContext } from '../src/audio/music/fakeAudioContext';
import { compileTrack, type CompiledTrack } from '../src/audio/music/parse';
import { allTracks, getCompiledTrack } from '../src/audio/music/registry';
import type { MusicTrack } from '../src/audio/music/types';

const TICK = SCHEDULE_INTERVAL_MS / 1000;

/** Drives a StepClock like the director does: a tick every 25 ms, scheduling 120 ms ahead. */
function runClock(clock: StepClock, from: number, to: number) {
  const got: { song: number; time: number; global: number; at: number }[] = [];
  for (let now = from; now < to; now += TICK) {
    clock.pump(now, now + LOOKAHEAD, (song, time, global) => got.push({ song, time, global, at: now }));
  }
  return got;
}

describe('StepClock (fake clock)', () => {
  it('computes step times from the absolute step index', () => {
    const c = new StepClock(0.125, 0, 32, true);
    c.start(2, 0);
    expect(c.timeOf(0)).toBe(2);
    expect(c.timeOf(8)).toBeCloseTo(3, 12);
    expect(c.timeOf(1000)).toBeCloseTo(2 + 125, 9);
    expect(c.stepAt(3.01)).toBe(8);
  });

  it('applies swing to odd steps only', () => {
    const c = new StepClock(0.1, 0.25, 16, true);
    c.start(0);
    expect(c.timeOf(2)).toBeCloseTo(0.2, 12);
    expect(c.timeOf(3)).toBeCloseTo(0.3 + 0.025, 12);
  });

  it('schedules every step exactly once, in order, ahead of time, sample-accurate', () => {
    const c = new StepClock(0.125, 0, 32, true);
    c.start(1.03, 0);
    const got = runClock(c, 1, 11);
    expect(got.length).toBe(Math.floor((11 + LOOKAHEAD - 1.03) / 0.125) + 1);
    got.forEach((g, i) => {
      expect(g.global).toBe(i);
      expect(g.song).toBe(i % 32);
      // Exact grid time (no accumulated drift) ...
      expect(Math.abs(g.time - (1.03 + i * 0.125))).toBeLessThan(1e-9);
      // ... scheduled before it is due, and never more than the lookahead early.
      expect(g.time).toBeGreaterThanOrEqual(g.at);
      expect(g.time - g.at).toBeLessThanOrEqual(LOOKAHEAD + 1e-9);
    });
  });

  it('loops seamlessly: the step after the last one is song step 0, one step later', () => {
    const c = new StepClock(0.1, 0.2, 8, true);
    c.start(0, 0);
    const got = runClock(c, 0, 2.5);
    const wrap = got.findIndex((g) => g.global === 8);
    expect(got[wrap]!.song).toBe(0);
    expect(got[wrap - 1]!.song).toBe(7);
    // Pairs of steps (on-beat + swung) always span exactly 2 steps, across the loop point too.
    for (let i = 2; i < got.length; i += 2) expect(got[i]!.time - got[i - 2]!.time).toBeCloseTo(0.2, 9);
  });

  it('stops a one-shot after its last step and reports its end', () => {
    const c = new StepClock(0.25, 0, 6, false);
    c.start(0.5);
    const got = runClock(c, 0.5, 4);
    expect(got.map((g) => g.song)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(c.done).toBe(true);
    expect(c.endTime).toBeCloseTo(2, 12);
  });

  it('skips (instead of bursting) steps that are already late after a stall', () => {
    const c = new StepClock(0.1, 0, 1000, true);
    c.start(0);
    const got: number[] = [];
    c.pump(0, 0.12, (_s, _t, g) => got.push(g));
    // The tab was throttled for 3 s.
    c.pump(3, 3.12, (_s, t) => {
      expect(t).toBeGreaterThanOrEqual(3 - LATE_TOLERANCE);
      got.push(Math.round(t * 10));
    });
    expect(c.skipped).toBeGreaterThan(25);
    expect(got.slice(-2)).toEqual([30, 31]);
  });

  it('respects stopTime (fade-outs stop scheduling)', () => {
    const c = new StepClock(0.1, 0, 100, true);
    c.start(0);
    c.stopTime = 0.45;
    const got = runClock(c, 0, 2);
    expect(got.map((g) => g.global)).toEqual([0, 1, 2, 3, 4]);
    expect(c.done).toBe(true);
  });

  it('starts mid-song so that the start step lands on the start time', () => {
    const c = new StepClock(0.125, 0, 64, true);
    c.start(10, 16);
    const got = runClock(c, 9.95, 10.3);
    expect(got[0]!.global).toBe(16);
    expect(got[0]!.time).toBeCloseTo(10, 12);
  });
});

// ---- Director with a fake AudioContext and manual timers ------------------------------------

const inst = { osc: [{ wave: 'sine' as const }], env: { a: 0.01, d: 0.1, s: 0.5, r: 0.1 }, gain: 0.5 };
const LOOP_A: MusicTrack = {
  id: 'loop_a',
  name: 'A',
  kind: 'chapter',
  chapter: 'test',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'C',
  scale: 'major',
  loop: true,
  instruments: { bass: inst, pad: { ...inst, filter: { type: 'lowpass', cutoff: 900 } }, drums: { kick: { kind: 'kick' }, hat: { kind: 'hat' }, gain: 0.5 } },
  sections: [{ name: 'A', bars: 2, bass: "1:4 5:4 1':4 5:4", pad: '1+3+5:32', drums: { kick: 'x...', hat: '..x.' } }],
  song: ['A'],
};
const LOOP_B: MusicTrack = { ...LOOP_A, id: 'loop_b', key: 'D' };
const STING: MusicTrack = {
  ...LOOP_A,
  id: 'sting',
  kind: 'sting',
  loop: false,
  sections: [{ name: 'S', bars: 1, bass: "1 3 5 1':13" }],
  song: ['S'],
};
const TRACKS = new Map<string, CompiledTrack>([LOOP_A, LOOP_B, STING].map((t) => [t.id, compileTrack(t)]));
const lookup = (id: string) => TRACKS.get(id) ?? null;

function manualTimers() {
  const state = { fn: null as (() => void) | null, sets: 0, clears: 0 };
  const api: TimerApi = {
    setInterval(fn) {
      state.fn = fn;
      state.sets++;
      return state.sets;
    },
    clearInterval() {
      state.fn = null;
      state.clears++;
    },
  };
  return { api, state };
}

function rig(attach = true) {
  const ctx = new FakeAudioContext();
  const timers = manualTimers();
  const music = new MusicDirector(lookup, timers.api);
  if (attach) music.attach(ctx.asAudioContext(), ctx.destination as unknown as AudioNode);
  /** Advances the fake clock, firing the interval like the browser would. */
  const advance = (seconds: number) => {
    const end = ctx.currentTime + seconds;
    while (ctx.currentTime < end - 1e-9) {
      ctx.currentTime = Math.min(end, ctx.currentTime + TICK);
      timers.state.fn?.();
    }
  };
  return { ctx, music, timers, advance };
}

describe('MusicDirector', () => {
  it('is silent-safe without an AudioContext and remembers the wanted track', () => {
    const { music, timers } = rig(false);
    expect(() => {
      music.play('loop_a');
      music.stinger('sting', { duck: 0.2 });
      music.duck();
      music.muffle(true);
      music.pause();
      music.resume();
    }).not.toThrow();
    expect(music.current).toBe('loop_a');
    expect(timers.state.sets).toBe(0);
    expect(music.inspect().main).toBeNull();
    const na = new NullAudio();
    na.music.play('title');
    expect(na.music.current).toBe('title');
  });

  it('starts the wanted track when the context is attached (first tap on iOS)', () => {
    const { ctx, music, timers } = rig(false);
    music.play('loop_a');
    music.attach(ctx.asAudioContext(), ctx.destination as unknown as AudioNode);
    expect(timers.state.fn).not.toBeNull();
    expect(music.inspect().main?.id).toBe('loop_a');
    expect(ctx.sources.length).toBeGreaterThan(0);
  });

  it('schedules notes on the exact step grid, never late, and loops for minutes', () => {
    const { ctx, music, advance } = rig();
    music.play('loop_a', { fade: 0 });
    const t0 = music.inspect().main!.t0;
    advance(130);
    const stepDur = TRACKS.get('loop_a')!.stepDur;
    for (const s of ctx.sources) {
      const k = (s.startTime - t0) / stepDur;
      expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-6);
      expect(s.stopTime).toBeGreaterThan(s.startTime);
      expect(Number.isFinite(s.stopTime)).toBe(true);
    }
    expect(ctx.lateStarts).toBe(0);
    // 130 s = 32.5 loops of 4 s: the kick (every beat) fired about 260 times.
    const steps = music.inspect().main!.next;
    expect(steps).toBeGreaterThan(1030);
    expect(steps).toBeLessThan(1045);
  });

  it('does not restart the current track and crossfades to a new one', () => {
    const { music, advance } = rig();
    music.play('loop_a');
    const before = music.inspect().main!.t0;
    advance(0.5);
    music.play('loop_a');
    expect(music.inspect().main!.t0).toBe(before);
    music.play('loop_b', { fade: 1 });
    expect(music.inspect()).toMatchObject({ current: 'loop_b', retiring: 1 });
    advance(0.5);
    expect(music.inspect().retiring).toBe(1);
    advance(0.7);
    expect(music.inspect().retiring).toBe(0);
    expect(music.inspect().main?.id).toBe('loop_b');
  });

  it('pauses on a bar line and resumes from the start of that bar', () => {
    const { ctx, music, advance } = rig();
    music.play('loop_a', { fade: 0 });
    advance(2.6); // bar 2 of the loop is playing (bars are 2 s)
    music.pause();
    expect(music.inspect()).toMatchObject({ paused: true, main: null });
    advance(1);
    expect(music.inspect().retiring).toBe(0);
    const sourcesWhilePaused = ctx.sources.length;
    advance(1);
    expect(ctx.sources.length).toBe(sourcesWhilePaused);
    music.resume();
    const now = ctx.currentTime;
    // Step 16 (start of bar 2) is placed right at the resume time.
    expect(music.inspect().main!.t0).toBeCloseTo(now + 0.03 - 16 * TRACKS.get('loop_a')!.stepDur, 9);
  });

  it('stinger with `then` starts the next track on the exact sample the stinger ends', () => {
    const { ctx, music, advance } = rig();
    music.play('loop_a', { fade: 0 });
    advance(1);
    music.stinger('sting', { then: 'loop_b' });
    const st = music.inspect();
    expect(st.current).toBe('loop_b');
    expect(st.stingers).toBe(1);
    const stingStart = ctx.currentTime + 0.03;
    expect(st.main!.t0).toBeCloseTo(stingStart + TRACKS.get('sting')!.duration, 12);
    advance(3);
    expect(music.inspect()).toMatchObject({ stingers: 0, retiring: 0 });
    expect(music.inspect().main!.scheduled).toBeGreaterThan(0);
    expect(ctx.lateStarts).toBe(0);
  });

  it('stinger over music ducks instead of stopping; stopMusic clears the wanted track', () => {
    const { music, advance } = rig();
    music.play('loop_a');
    music.stinger('sting');
    expect(music.inspect()).toMatchObject({ current: 'loop_a', stingers: 1, retiring: 0 });
    advance(2.5);
    expect(music.inspect().stingers).toBe(0);
    music.stinger('sting', { stopMusic: true });
    expect(music.current).toBeNull();
    advance(3);
    expect(music.inspect()).toMatchObject({ main: null, stingers: 0, retiring: 0, running: false });
  });

  it('pausing also fades a stinger that is playing', () => {
    const { music, advance } = rig();
    music.play('loop_a');
    music.stinger('sting');
    music.pause();
    advance(0.4);
    expect(music.inspect()).toMatchObject({ stingers: 0, retiring: 0, main: null, paused: true });
  });

  it('a one-shot played as music ends by itself and the scheduler goes idle', () => {
    const { music, advance, timers } = rig();
    music.play('sting', { fade: 0 });
    expect(music.current).toBe('sting');
    advance(3);
    expect(music.current).toBeNull();
    expect(music.inspect().running).toBe(false);
    expect(timers.state.clears).toBeGreaterThan(0);
  });

  it('stop fades out, lets notes ring out and leaves nothing sounding', () => {
    const { ctx, music, advance } = rig();
    music.play('loop_a', { fade: 0 });
    advance(1);
    music.stop(0.5);
    advance(2);
    expect(music.inspect()).toMatchObject({ main: null, retiring: 0, running: false });
    expect(ctx.activeSourcesAt(ctx.currentTime)).toBe(0);
  });

  it('suspends the timer while backgrounded', () => {
    const { music, timers } = rig();
    music.play('loop_a');
    expect(timers.state.fn).not.toBeNull();
    music.setSuspended(true);
    expect(timers.state.fn).toBeNull();
    music.setSuspended(false);
    expect(timers.state.fn).not.toBeNull();
  });

  it('warns once for unknown tracks and ignores them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { music } = rig();
    music.play('nope');
    music.play('nope');
    music.stinger('nope');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(music.current).toBeNull();
    expect(music.has('nope')).toBe(false);
    warn.mockRestore();
  });
});

describe('every real track plays against the fake AudioContext', () => {
  it.each(allTracks().map((t) => [t.id, t] as const))('%s', (id, t) => {
    const ctx = new FakeAudioContext();
    const timers = manualTimers();
    const music = new MusicDirector(undefined, timers.api);
    music.attach(ctx.asAudioContext(), ctx.destination as unknown as AudioNode);
    if (t.loop) music.play(id, { fade: 0 });
    else music.stinger(id);
    // Through the loop point for music; to the end (plus tails) for one-shots.
    const seconds = getCompiledTrack(id)!.duration + (t.loop ? 2 : 1);
    const end = ctx.currentTime + seconds;
    while (ctx.currentTime < end) {
      ctx.currentTime += TICK;
      timers.state.fn?.();
    }
    expect(ctx.sources.length).toBeGreaterThan(5);
    expect(ctx.lateStarts).toBe(0);
    for (const s of ctx.sources) expect(s.stopTime).toBeGreaterThan(s.startTime);
    music.stop(0.2);
    for (let i = 0; i < 200; i++) {
      ctx.currentTime += TICK;
      timers.state.fn?.();
    }
    expect(ctx.activeSourcesAt(ctx.currentTime)).toBe(0);
    expect(music.inspect()).toMatchObject({ main: null, retiring: 0, stingers: 0 });
  });
});
