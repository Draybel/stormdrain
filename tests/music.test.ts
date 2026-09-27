import { describe, expect, it } from 'vitest';
import { BOSS_MUSIC, BOSS_TRACKS, CHAPTER_IDS, CHAPTER_MUSIC, FINAL_MUSIC, MUSIC } from '../src/audio/music/ids';
import { compileTrack, parseDrums, parseMelodic, stepsPerBarOf } from '../src/audio/music/parse';
import { allTracks, getCompiledTrack, getTrack } from '../src/audio/music/registry';
import { degreeToMidi, midiToFreq, noteToMidi, pitchClass } from '../src/audio/music/theory';
import type { MusicTrack } from '../src/audio/music/types';
import { LENGTH_BOUNDS, validateTrack } from '../src/audio/music/validate';
import { BOSSES, CHAPTERS } from '../src/content/registry';

const tracks = allTracks();

describe('music theory', () => {
  it('maps note names and degrees to MIDI', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(noteToMidi('F#3')).toBe(54);
    expect(noteToMidi('H2')).toBeNaN();
    expect(pitchClass('Eb')).toBe(3);
    expect(pitchClass('C#')).toBe(1);
    // D minor, degree 1 in octave 4 = D4.
    expect(degreeToMidi('D', 'minor', 4, 1)).toBe(62);
    expect(degreeToMidi('D', 'minor', 4, 3)).toBe(65); // F4
    expect(degreeToMidi('D', 'minor', 4, 7, 1)).toBe(73); // C#5
    expect(degreeToMidi('D', 'minor', 4, 5, 0, -1)).toBe(57); // A3
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });
});

describe('pattern parser', () => {
  const ctx = { key: 'C' as const, scale: 'major' as const, octave: 4, transpose: 0 };

  it('parses notes, lengths, chords, holds, rests, velocity and glide', () => {
    const p = parseMelodic("1 3:2 - 5+1'! . ~2? .:3 C5 5,", ctx, 16);
    expect(p.steps).toBe(1 + 2 + 1 + 1 + 1 + 1 + 3 + 1 + 1);
    const notes = p.items.filter((i) => i.kind === 2);
    expect(notes.map((n) => n.pitches)).toEqual([[60], [64], [67, 72], [62], [72], [55]]);
    expect(notes[2]!.vel).toBe(1);
    expect(notes[3]!.vel).toBe(0.5);
    expect(notes[3]!.glide).toBe(true);
  });

  it('checks bar lines against the time signature', () => {
    expect(parseMelodic('1:16 | 5:8 3:8', ctx, 16).bars).toBe(2);
    expect(() => parseMelodic('1:16 | 5:8 3:4', ctx, 16)).toThrow(/bar 2 has 12 steps/);
    expect(parseDrums('x..x x... | x... ....', 8).bars).toBe(2);
    expect(() => parseDrums('x...x|x..', 4)).toThrow(/bar/);
  });

  it('rejects bad tokens', () => {
    expect(() => parseMelodic('8', ctx, 16)).toThrow();
    expect(() => parseMelodic('1:0', ctx, 16)).toThrow();
    expect(() => parseMelodic('~.', ctx, 16)).toThrow();
    expect(() => parseMelodic('Q4', ctx, 16)).toThrow();
    expect(() => parseDrums('x.y.', 4)).toThrow();
  });

  it('compiles holds across repeats and sections into CSR events', () => {
    const t: MusicTrack = {
      id: 'probe',
      name: 'Probe',
      kind: 'jingle',
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 2,
      key: 'C',
      scale: 'major',
      loop: false,
      instruments: {
        lead: { osc: [{ wave: 'sine' }], env: { a: 0.01, d: 0.1, s: 0.5, r: 0.1 }, gain: 0.5 },
        drums: { kick: { kind: 'kick' }, gain: 0.5 },
      },
      sections: [
        { name: 'A', bars: 2, lead: '1:2 3 - - . . 5', drums: { kick: 'x.x.' } },
        { name: 'B', bars: 1, lead: "- ~1':7" },
      ],
      song: ['A', 'B'],
    };
    const c = compileTrack(t);
    expect(c.totalSteps).toBe(24);
    expect(c.stepDur).toBeCloseTo(0.25, 9);
    expect(c.duration).toBeCloseTo(6, 9);
    const lead = [...Array(c.count).keys()].filter((i) => c.slot[i] === 1);
    // Each 8-step lead pattern: C (2 steps), E (3 steps), G (1 step) — twice; then B's leading '-'
    // extends the last G and the glide note starts at step 17.
    expect(lead.map((i) => c.midi[i])).toEqual([60, 64, 67, 60, 64, 67, 72]);
    expect(lead.map((i) => c.len[i])).toEqual([2, 3, 1, 2, 3, 2, 7]);
    expect(Number.isNaN(c.from[lead[0]!]!)).toBe(true);
    expect(c.from[lead[6]!]).toBe(67);
    const kicks = [...Array(c.count).keys()].filter((i) => c.slot[i] === 4);
    expect(kicks.length).toBe(8);
    // CSR offsets are monotonic and cover every event.
    for (let s = 0; s < c.totalSteps; s++) expect(c.start[s + 1]!).toBeGreaterThanOrEqual(c.start[s]!);
    expect(c.start[c.totalSteps]).toBe(c.count);
  });

  it('accepts patterns as arrays of bars (each element must be one bar)', () => {
    const base: MusicTrack = {
      id: 'probe3',
      name: 'Probe',
      kind: 'jingle',
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 2,
      key: 'A',
      scale: 'minor',
      loop: false,
      instruments: {
        bass: { osc: [{ wave: 'sine' }], env: { a: 0, d: 0, s: 1, r: 0.1 }, gain: 0.5 },
        drums: { hat: { kind: 'hat' }, gain: 0.5 },
      },
      sections: [{ name: 'A', bars: 2, bass: ['1:8', '5,:4 3:4'], drums: { hat: ['x.x.x.x.', 'xxxxxxxx'] } }],
      song: ['A'],
    };
    const c = compileTrack(base);
    const bass = [...Array(c.count).keys()].filter((i) => c.slot[i] === 0);
    expect(bass.map((i) => c.midi[i])).toEqual([45, 40, 48]);
    expect([...Array(c.count).keys()].filter((i) => c.slot[i] === 6)).toHaveLength(12);
    const bad = { ...base, sections: [{ name: 'A', bars: 2, bass: ['1:8', '5,:4 3:2'] }] };
    expect(() => compileTrack(bad)).toThrow(/bar 2/);
  });

  it('requires patterns to divide their section', () => {
    const t: MusicTrack = {
      id: 'probe2',
      name: 'Probe',
      kind: 'jingle',
      bpm: 120,
      beatsPerBar: 4,
      stepsPerBeat: 4,
      key: 'C',
      scale: 'major',
      loop: false,
      instruments: { bass: { osc: [{ wave: 'sine' }], env: { a: 0, d: 0, s: 1, r: 0.1 }, gain: 0.5 } },
      sections: [{ name: 'A', bars: 1, bass: '1:6' }],
      song: ['A'],
    };
    expect(() => compileTrack(t)).toThrow(/does not divide/);
  });
});

describe('music tracks', () => {
  it('discovers tracks with unique ids', () => {
    expect(tracks.length).toBeGreaterThanOrEqual(27);
    const ids = tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(tracks.map((t) => [t.id, t] as const))('%s validates', (_id, t) => {
    const { errors, compiled } = validateTrack(t);
    expect(errors).toEqual([]);
    expect(compiled).not.toBeNull();
    const [lo, hi] = LENGTH_BOUNDS[t.kind];
    expect(compiled!.duration).toBeGreaterThanOrEqual(lo);
    expect(compiled!.duration).toBeLessThanOrEqual(hi);
    expect(compiled!.totalSteps % stepsPerBarOf(t)).toBe(0);
  });

  it('every chapter of DESIGN.md has its own loop of 30-60 s', () => {
    expect(CHAPTER_IDS).toHaveLength(12);
    const used = new Set<string>();
    for (const ch of CHAPTER_IDS) {
      const id = CHAPTER_MUSIC[ch];
      const t = getTrack(id);
      expect(t, `${ch} → ${id}`).toBeDefined();
      expect(t!.kind).toBe('chapter');
      expect(t!.chapter).toBe(ch);
      expect(t!.loop).toBe(true);
      const c = getCompiledTrack(id)!;
      expect(c.duration).toBeGreaterThanOrEqual(28);
      expect(c.duration).toBeLessThanOrEqual(64);
      used.add(id);
    }
    expect(used.size).toBe(12);
    // Every chapter track in the registry is mapped.
    const chapterTracks = tracks.filter((t) => t.kind === 'chapter').map((t) => t.id);
    expect(chapterTracks.sort()).toEqual([...used].sort());
  });

  it('chapter loops are musically distinct (key, scale, tempo or meter)', () => {
    const sig = CHAPTER_IDS.map((ch) => {
      const t = getTrack(CHAPTER_MUSIC[ch])!;
      return `${t.key}-${t.scale}-${t.bpm}-${t.beatsPerBar}/${t.stepsPerBeat}`;
    });
    expect(new Set(sig).size).toBe(12);
  });

  it('boss, final, and role tracks all exist with the right kinds', () => {
    for (const id of BOSS_TRACKS) expect(getTrack(id)?.kind).toBe('boss');
    for (const id of Object.values(BOSS_MUSIC)) expect(getTrack(id)).toBeDefined();
    for (const id of Object.values(FINAL_MUSIC)) expect(getTrack(id)?.kind).toBe('final');
    expect(getTrack(MUSIC.title)?.kind).toBe('title');
    expect(getTrack(MUSIC.shop)?.kind).toBe('shop');
    expect(getTrack(MUSIC.secret)?.kind).toBe('secret');
    expect(getTrack(MUSIC.miniboss)?.kind).toBe('miniboss');
    expect(getTrack(MUSIC.victory)?.kind).toBe('jingle');
    expect(getTrack(MUSIC.gameOver)?.kind).toBe('jingle');
    for (const id of [MUSIC.floorSting, MUSIC.bossIntro, MUSIC.itemFanfare]) expect(getTrack(id)?.kind).toBe('sting');
  });

  it('content chapters and bosses name registered tracks', () => {
    expect(CHAPTERS.size).toBeGreaterThan(0);
    for (const ch of CHAPTERS.values()) {
      expect(getTrack(ch.music), `chapter ${ch.id} → ${ch.music}`).toBeDefined();
      if ((CHAPTER_IDS as readonly string[]).includes(ch.id)) {
        expect(ch.music, ch.id).toBe(CHAPTER_MUSIC[ch.id as (typeof CHAPTER_IDS)[number]]);
      }
    }
    for (const b of BOSSES.values()) if (b.music) expect(getTrack(b.music), `boss ${b.id} → ${b.music}`).toBeDefined();
  });

  it('loops never leave a note hanging past the loop point by more than a bar', () => {
    for (const t of tracks) {
      if (!t.loop) continue;
      const c = getCompiledTrack(t.id)!;
      let maxEnd = 0;
      for (let step = 0; step < c.totalSteps; step++) {
        for (let i = c.start[step]!; i < c.start[step + 1]!; i++) maxEnd = Math.max(maxEnd, step + c.len[i]!);
      }
      expect(maxEnd - c.totalSteps, t.id).toBeLessThanOrEqual(c.stepsPerBar);
    }
  });
});
