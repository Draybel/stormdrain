/**
 * Chapter 2 (alt) — The Candlewick Crypt: "Wax and Wingdust". C harmonic minor in a slow 6/8.
 * Harpsichord arpeggios, a drawbar organ and pedal bass, a wordless choir voice, a tolling bell
 * every other bar and moth-wing flutters on the shaker.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHOIR, ORGAN, SUB_BASS } from '../../audio/music/instruments';
import type { Instrument, MusicTrack } from '../../audio/music/types';

const HARPSICHORD: Instrument = {
  osc: [{ wave: 'sawtooth' }, { wave: 'square', octave: 1, gain: 0.25 }],
  env: { a: 0.001, d: 0.35, s: 0.05, r: 0.12 },
  filter: { type: 'lowpass', cutoff: 1400, q: 1.5, env: 2600, decay: 0.12 },
  gain: 0.11,
  delay: 0.25,
};

// C harmonic minor: 1=C 2=D 3=Eb 4=F 5=G 6=Ab 7=B (7b = Bb). 12 steps (two dotted beats) per bar.
const ORDER = [0, 1, 2, 3, 2, 1];
const CH = {
  Cm: { arp: arp("1 3 5 1'", ORDER, 2), bass: '1:12', pad: '1+3+5:12' },
  Ab: { arp: arp('6, 1 3 6', ORDER, 2), bass: '6,:12', pad: '1+3+6:12' },
  Fm: { arp: arp('4, 6, 1 4', ORDER, 2), bass: '4,:12', pad: '1+4+6:12' },
  G: { arp: arp('5, 7, 2 5', ORDER, 2), bass: '5,:12', pad: '7,+2+5:12' },
  Ddim: { arp: arp("2 4 6 2'", ORDER, 2), bass: '2:12', pad: '2+4+6:12' },
  Eb: { arp: arp("3 5 7b 3'", ORDER, 2), bass: '3:12', pad: '7b,+3+5:12' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Ab', 'Ddim', 'G'];
const PROG_B: Ch[] = ['Ab', 'Eb', 'Fm', 'Cm', 'Ab', 'Fm', 'G', 'G'];

const LEAD_A = bars('5:9 6:3', "1':6 6:3 5:3", '6:6 4:6', '2:6 7,:6', "5:6 1':6", "3':6 1':6", '6:6 4:6', '7,:12');
const LEAD_B = bars("1':6 3':6", '5:6 7b:6', "1':6 6:3 5:3", '5:6 3:6', "6:6 1':6", "4':6 3':3 2':3", "2':6 7:6", '5:12');

const crypt: MusicTrack = {
  id: 'ch_candlewick_crypt',
  gain: 0.84,
  name: 'Wax and Wingdust',
  kind: 'chapter',
  chapter: 'candlewick_crypt',
  mood: 'gothic but cosy; dripping candles, organ drone, moths around the flame',
  bpm: 56,
  beatsPerBar: 2,
  stepsPerBeat: 6,
  key: 'C',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.38, env: { a: 0.08, d: 0.5, s: 0.8, r: 0.4 } }),
    pad: inst(ORGAN, { gain: 0.085 }),
    arp: inst(HARPSICHORD, { pan: 0.3 }),
    lead: inst(CHOIR, { gain: 0.2, pan: -0.2, octave: 4, env: { a: 0.25, d: 0.3, s: 0.85, r: 0.6 } }),
    drums: {
      kick: { kind: 'thump', pitch: 55, gain: 0.6 },
      hat: { kind: 'shaker', pitch: 4500, decay: 0.12, gain: 0.3, pan: 0.4 },
      perc: { kind: 'bell', pitch: 262, decay: 2.2, tone: 0.7, gain: 0.35, pan: -0.3 },
      gain: 0.55,
      delay: 0.35,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      arp: lane(PROG_A, 'arp'),
      bass: lane(PROG_A, 'bass'),
      pad: lane(PROG_A, 'pad'),
      lead: LEAD_A,
      drums: { kick: 'x...........', hat: bars('......o.o...', '............'), perc: bars('x...........', '............') },
    },
    {
      name: 'B',
      bars: 8,
      arp: lane(PROG_B, 'arp'),
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      lead: LEAD_B,
      drums: { kick: 'x.....x.....', hat: '......o.o.o.', perc: bars('x...........', '............') },
    },
  ],
  song: ['A', 'B', 'A'],
  room: { time: 0.42, feedback: 0.45, wet: 0.4, damp: 1800 },
};

export default [crypt];
