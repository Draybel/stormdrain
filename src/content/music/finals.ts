/**
 * Final boss themes.
 *
 * - "Old Thunderhead" (end of Eye of the Storm II): D harmonic minor, 150 bpm. Thunder toms, a
 *   storm choir and the title's STORMDRAIN motif shouted by a saw lead.
 * - "The Nestmother" (end of The Hollow Nest II): A phrygian dominant, 138 bpm. The Paper Hive
 *   melody turned vicious, a constant A–Bb wing trill, tribal toms.
 * - "The Undertow" (floor 13, the true final): F# harmonic minor in a swirling 12/8, 132 bpm.
 *   Arpeggios circle like a whirlpool; the title motif returns, pulled under.
 */

import { arp, bars, inst, rep } from '../../audio/music/compose';
import { CHIP_ARP, CHOIR, DRONE, FUZZ_BASS, GLASS, SAW_LEAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// ---- Old Thunderhead ------------------------------------------------------------------------
// D harmonic minor: 1=D 2=E 3=F 4=G 5=A 6=Bb 7=C#.
const storm8 = (r: string, up: string) => `${r}:2 ${r}:2 ${up}:2 ${r}:2 ${r}:2 ${r}:2 ${up}:2 ${r}:2`;
const BOLT = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1];
const TH = {
  Dm: { bass: storm8('1', "1'"), pad: '1+3+5:16', arp: arp('1 3 5', BOLT) },
  Bb: { bass: storm8('6,', '6'), pad: '6,+1+3:16', arp: arp('6, 1 3', BOLT) },
  Gm: { bass: storm8('4', "4'"), pad: '6,+1+4:16', arp: arp('4, 6, 1', BOLT) },
  A: { bass: storm8('5,', '5'), pad: '5,+7,+2:16', arp: arp('5, 7, 2', BOLT) },
} as const;
type ThCh = keyof typeof TH;
const thLane = (prog: readonly ThCh[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => TH[c][k]));
const TH_A: ThCh[] = ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'];
const TH_B: ThCh[] = ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Bb', 'A'];
const TH_C: ThCh[] = ['Dm', 'Dm', 'Bb', 'A'];

const thunderhead: MusicTrack = {
  id: 'final_thunderhead',
  gain: 1.19,
  name: 'Old Thunderhead',
  kind: 'final',
  mood: 'colossal and grumpy; the storm itself looking down at you',
  bpm: 150,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.3 }),
    pad: inst(CHOIR, { gain: 0.12, env: { a: 0.15, d: 0.3, s: 0.85, r: 0.4 } }),
    arp: inst(CHIP_ARP, { gain: 0.065, pan: 0.4, octave: 5 }),
    lead: inst(SAW_LEAD, { gain: 0.13, pan: -0.1 }),
    drums: {
      kick: { kind: 'kick', pitch: 48, decay: 0.26, tone: 0.55, gain: 1 },
      snare: { kind: 'snare', pitch: 190, decay: 0.18, tone: 0.65, gain: 0.72 },
      hat: { kind: 'hat', gain: 0.4, pan: 0.25 },
      perc: { kind: 'tom', pitch: 55, decay: 0.9, tone: 0.6, gain: 0.95, pan: -0.15 },
      gain: 0.62,
      delay: 0.12,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: thLane(TH_A, 'bass'),
      pad: thLane(TH_A, 'pad'),
      arp: thLane(TH_A, 'arp'),
      lead: bars(
        "1:2 1:2 5:4 1':6 2':2",
        "3':6 2':2 1':4 6:4",
        "4:4 6:4 1':4 4':4",
        "3':4 2':4 7:8",
        "1:2 1:2 5:4 1':6 3':2",
        "4':6 3':2 2':4 1':4",
        "6:4 4:4 1':4 6:4",
        "7:4 2':4 5':8",
      ),
      drums: {
        kick: 'x...x...x...x...',
        snare: '....x.......x...',
        hat: 'xoxoxoxoxoxoxoxo',
        perc: bars('x...............', '................'),
      },
    },
    {
      name: 'B',
      bars: 8,
      bass: thLane(TH_B, 'bass'),
      pad: thLane(TH_B, 'pad'),
      // The title motif (B phrase), as a battle cry.
      lead: bars(
        "1':6 6:2 4:8",
        "3':4 2':4 1':4 5:4",
        "6:6 1':2 3':8",
        "2':6 1':2 7:8",
        "1':4 6:4 4:4 6:4",
        '5:6 6:2 5:4 3:4',
        '4:4 3:4 1:4 3:4',
        '2:6 1:2 7,:8',
      ),
      drums: {
        kick: 'x...x...x...x...',
        snare: '....x.......x..o',
        hat: 'x.x.x.x.x.x.x.x+',
        perc: bars('x...............', '............x.x.'),
      },
    },
    {
      name: 'C',
      bars: 4,
      bass: thLane(TH_C, 'bass'),
      pad: thLane(TH_C, 'pad'),
      arp: thLane(TH_C, 'arp'),
      lead: bars("5':16", "3':8 2':8", "1':16", "7:8 2':8"),
      drums: {
        kick: 'x.......x.......',
        snare: '........x.......',
        hat: '..x...x...x...x.',
        perc: bars('x.......x.......', 'x...x...x...x...', 'x.......x.......', 'x.x.x.x.xxxxxxxx'),
      },
    },
  ],
  song: ['A', 'B', 'C'],
  room: { time: 0.2, feedback: 0.32, wet: 0.22, damp: 2600 },
};

// ---- The Nestmother -------------------------------------------------------------------------
// A phrygian dominant: 1=A 2=Bb 3=C# 4=D 5=E 6=F 7=G.
const sting = (r: string, up: string) => `${r} ${r} ${r}:2 ${up}:2 ${r}:2 ${r} ${r} ${r}:2 ${up}:2 ${r}:2`;
const NM = {
  A: { bass: sting('1', "1'"), pad: '1+3+5:16' },
  Bb: { bass: sting('2', "2'"), pad: '2+4+6:16' },
  Gm: { bass: sting('7,', '7'), pad: '7,+2+4:16' },
  Dm: { bass: sting('4', "4'"), pad: "4+6+1':16" },
} as const;
type NmCh = keyof typeof NM;
const nmLane = (prog: readonly NmCh[], k: 'bass' | 'pad') => bars(...prog.map((c) => NM[c][k]));
const NM_A: NmCh[] = ['A', 'A', 'Bb', 'A', 'A', 'A', 'Gm', 'A'];
const NM_B: NmCh[] = ['Dm', 'Bb', 'A', 'A', 'Dm', 'Bb', 'Gm', 'A'];
const WINGS = rep('1 2', 8);

const nestmother: MusicTrack = {
  id: 'final_nestmother',
  gain: 1.27,
  name: 'The Nestmother',
  kind: 'final',
  mood: 'the hive queen rises; papery wings, amber glare, a furious drone',
  bpm: 138,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'A',
  scale: 'phrygianDominant',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.3, octave: 1 }),
    pad: inst(DRONE, { gain: 0.075, octave: 2 }),
    arp: inst(CHIP_ARP, { gain: 0.06, pan: 0.4, osc: [{ wave: 'square', voices: 2, detune: 24 }] }),
    lead: inst(SAW_LEAD, {
      gain: 0.12,
      pan: -0.15,
      vibrato: { rate: 12, depth: 16, delay: 0.08 },
      filter: { type: 'lowpass', cutoff: 2600, q: 2 },
    }),
    drums: {
      kick: { kind: 'kick', pitch: 50, decay: 0.24, tone: 0.5, gain: 1 },
      snare: { kind: 'clap', pitch: 1500, decay: 0.14, gain: 0.6 },
      hat: { kind: 'shaker', pitch: 6000, decay: 0.05, gain: 0.45, pan: 0.3 },
      perc: { kind: 'tom', pitch: 95, decay: 0.3, gain: 0.8, pan: -0.25 },
      gain: 0.62,
      delay: 0.1,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: nmLane(NM_A, 'bass'),
      pad: bars('1+5:16', '-:16', '2+4+6:16', '1+5:16', '-:16', '-:16', '7,+2+4:16', '1+5:16'),
      arp: WINGS,
      lead: bars(
        '1:4 2:2 3:2 4:4 3:2 2:2',
        '1:8 5:8',
        '6:4 4:4 2:4 4:4',
        '3:12 1:4',
        "1':4 7:2 6:2 5:4 6:2 5:2",
        '4:4 3:4 2:4 3:4',
        '2:4 4:4 7,:8',
        '3:2 4:2 5:2 6:2 5:2 4:2 3:2 2:2',
      ),
      drums: {
        kick: 'x..x..x...x..x..',
        snare: '....x.......x...',
        hat: 'xoxoxoxoxoxoxoxo',
        perc: '..x...x.x..x..x.',
      },
    },
    {
      name: 'B',
      bars: 8,
      bass: nmLane(NM_B, 'bass'),
      pad: nmLane(NM_B, 'pad'),
      arp: WINGS,
      lead: bars('6:8 4:8', '4:8 2:8', "3:4 5:4 1':8", "2':8 1':8", "1':6 6:2 4:8", "2':6 1':2 6:8", '7:8 4:4 2:4', '3:8 2:4 1:4'),
      drums: {
        kick: 'x..x..x...x..x..',
        snare: '....x.......x...',
        hat: 'xoxoxoxoxoxoxoxo',
        perc: '..x...x.x..x.xxx',
      },
    },
    {
      name: 'C',
      bars: 4,
      bass: '1:16',
      pad: bars('1+5:16', '-:16'),
      arp: bars(WINGS, WINGS, rep('5 6', 8), rep("1' 2'", 8)),
      lead: bars('.:16', '.:16', "1':16", "2':8 1':8"),
      drums: { kick: 'x...x...x...x...', hat: 'xoxoxoxoxoxoxoxo', perc: bars('................', 'x.x.x.x.xxxxxxxx') },
    },
  ],
  song: ['A', 'B', 'C'],
  room: { time: 0.17, feedback: 0.3, wet: 0.2, damp: 2400 },
};

// ---- The Undertow ---------------------------------------------------------------------------
// F# harmonic minor: 1=F# 2=G# 3=A 4=B 5=C# 6=D 7=E# (7b = E). 12 steps per bar (12/8 swirl).
const SWIRL = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1];
const surge = (r: string, up: string) => `${r}:3 ${r}:2 ${r} ${up}:3 ${r}:2 ${r}`;
const UT = {
  Fsm: { bass: surge('1', "1'"), pad: '1+3+5:12', arp: arp("1 3 5 1'", SWIRL) },
  D: { bass: surge('6,', '6'), pad: '6,+1+3:12', arp: arp('6, 1 3 6', SWIRL) },
  Bm: { bass: surge('4', "4'"), pad: '6,+1+4:12', arp: arp('4, 6, 1 4', SWIRL) },
  Cs: { bass: surge('5,', '5'), pad: '7,+2+5:12', arp: arp('5, 7, 2 5', SWIRL) },
  E: { bass: surge('7b,', '7b'), pad: '7b,+2+4:12', arp: arp('7b, 2 4 7b', SWIRL) },
} as const;
type UtCh = keyof typeof UT;
const utLane = (prog: readonly UtCh[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => UT[c][k]));
const UT_A: UtCh[] = ['Fsm', 'D', 'Bm', 'Cs', 'Fsm', 'D', 'Bm', 'Cs'];
const UT_B: UtCh[] = ['D', 'E', 'Fsm', 'Fsm', 'D', 'Bm', 'Cs', 'Cs'];
const UT_C: UtCh[] = ['Fsm', 'Fsm', 'Fsm', 'Cs'];

const undertow: MusicTrack = {
  id: 'final_undertow',
  gain: 1.28,
  name: 'The Undertow',
  kind: 'final',
  mood: 'the whirlpool at the bottom of every drain; everything the rain kept, spinning',
  bpm: 132,
  beatsPerBar: 4,
  stepsPerBeat: 3,
  key: 'F#',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.3 }),
    pad: inst(CHOIR, { gain: 0.12 }),
    arp: inst(GLASS, { gain: 0.12, pan: 0.3, delay: 0.35, env: { a: 0.002, d: 0.3, s: 0, r: 0.2 } }),
    lead: inst(SAW_LEAD, { gain: 0.12, pan: -0.15, glide: 0.1 }),
    drums: {
      kick: { kind: 'kick', pitch: 46, decay: 0.3, tone: 0.5, gain: 1 },
      snare: { kind: 'snare', pitch: 180, decay: 0.2, tone: 0.55, gain: 0.7 },
      hat: { kind: 'hat', pitch: 8500, gain: 0.38, pan: 0.25 },
      perc: { kind: 'tom', pitch: 75, decay: 0.45, gain: 0.85, pan: -0.2 },
      gain: 0.62,
      delay: 0.12,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: utLane(UT_A, 'bass'),
      pad: utLane(UT_A, 'pad'),
      arp: utLane(UT_A, 'arp'),
      lead: bars(
        "5:3 1':3 7b:2 6:2 5:2",
        '3:6 4:2 5:2 6:2',
        "4:3 6:3 1':6",
        "7:6 2':3 5:3",
        "5:3 1':3 2':2 3':2 2':2",
        "1':6 7b:2 6:2 5:2",
        '4:3 5:3 6:3 4:3',
        '2:6 7,:6',
      ),
      drums: { kick: 'x.....x.....', snare: '...x.....x..', hat: 'XooXooXooXoo', perc: '.........x.x' },
    },
    {
      name: 'B',
      bars: 8,
      bass: utLane(UT_B, 'bass'),
      pad: utLane(UT_B, 'pad'),
      arp: utLane(UT_B, 'arp'),
      lead: bars("6:6 3':6", "7b:6 2':6", "3':6 1':6", '5:12', "6:3 1':3 3':6", "4':6 3':3 1':3", "2':6 7:6", "7:6 2':6"),
      drums: { kick: 'x.....x..x..', snare: '...x.....x..', hat: 'XooXooXooXoo', perc: '......x..x.x' },
    },
    {
      name: 'C',
      bars: 4,
      bass: utLane(UT_C, 'bass'),
      pad: bars('1+3+5:12', '-:12', '1+3+5+7b:12', '7,+2+5:12'),
      arp: utLane(UT_C, 'arp'),
      lead: bars("1':12", "2':12", "3':12", '7:12'),
      drums: { kick: 'x..x..x..x..', snare: '...x.....x..', hat: 'XooXooXooXoo', perc: bars('x.....x.....', 'x..x..x..xxx') },
    },
  ],
  song: ['A', 'B', 'C'],
  room: { time: 0.34, feedback: 0.45, wet: 0.3, damp: 2200 },
};

export default [thunderhead, nestmother, undertow];
