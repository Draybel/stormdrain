/**
 * Boss theme 1 (chapters 1-2) — "Floodgate". C harmonic minor, 150 bpm.
 * Urgent galloping acid bass, a bright square hero lead, sixteenth chip arpeggios, string stabs
 * and tom fills. Short, punchy, loops hard.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { ACID_BASS, CHIP_ARP, SQUARE_LEAD, STRINGS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// C harmonic minor: 1=C 2=D 3=Eb 4=F 5=G 6=Ab 7=B (7b = Bb).
const gallop = (r: string, up: string) => `${r} . ${r} ${r} ${up} . ${r} ${r} ${r} . ${r} ${r} ${up} . ${r} ${r}`;
const CYCLE = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1];
const CH = {
  Cm: { bass: gallop('1', "1'"), arp: arp('1 3 5', CYCLE), pad: '1+3+5:16' },
  Ab: { bass: gallop('6,', '6'), arp: arp('6, 1 3', CYCLE), pad: '6,+1+3:16' },
  Bb: { bass: gallop('7b,', '7b'), arp: arp('7b, 2 4', CYCLE), pad: '7b,+2+4:16' },
  G: { bass: gallop('5,', '5'), arp: arp('5, 7, 2', CYCLE), pad: '7,+2+5:16' },
  Fm: { bass: gallop('4,', '4'), arp: arp('4, 6, 1', CYCLE), pad: '6,+1+4:16' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'];
const PROG_B: Ch[] = ['Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'Bb', 'G', 'G'];

const LEAD_A = bars(
  "1':2 1':2 7b:2 1':2 3':4 2':2 1':2",
  "6:4 1':4 3':4 6':4",
  "5':4 4':2 3':2 2':4 7b:4",
  "7:8 2':4 5':4",
  "1':2 1':2 7b:2 1':2 3':4 5':4",
  "6':4 5':2 4':2 3':4 1':4",
  "4':4 3':2 2':2 1':4 6:4",
  "7:4 2':4 4':4 7':4",
);
const LEAD_B = bars(
  "3':6 1':2 6:8",
  "4':6 2':2 7b:8",
  "5':6 3':2 1':4 5:4",
  "1':12 .:4",
  "6':6 5':2 3':8",
  "4':6 3':2 2':8",
  "2':4 7:4 5:4 7:4",
  "2':4 4':4 7':8",
);

const DRUMS = {
  kick: 'x...x...x...x...',
  snare: '....x.......x...',
  hat: 'xoxoxoxoxoxoxoxo',
  perc: bars('................', '..........x.x.xx'),
};

const floodgate: MusicTrack = {
  id: 'boss_floodgate',
  gain: 2.1,
  name: 'Floodgate',
  kind: 'boss',
  mood: 'urgent; the water is rising and something big is in it',
  bpm: 150,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'C',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(ACID_BASS, { gain: 0.3 }),
    pad: inst(STRINGS, { gain: 0.06, env: { a: 0.08, d: 0.4, s: 0.8, r: 0.3 } }),
    arp: inst(CHIP_ARP, { gain: 0.07, pan: 0.35, octave: 5 }),
    lead: inst(SQUARE_LEAD, { gain: 0.15, pan: -0.1 }),
    drums: {
      kick: { kind: 'kick', pitch: 52, decay: 0.22, tone: 0.55, gain: 1 },
      snare: { kind: 'snare', pitch: 210, decay: 0.14, tone: 0.65, gain: 0.7 },
      hat: { kind: 'hat', gain: 0.42, pan: 0.25 },
      perc: { kind: 'tom', pitch: 110, decay: 0.3, gain: 0.8, pan: -0.25 },
      gain: 0.62,
      delay: 0.08,
    },
  },
  sections: [
    { name: 'A', bars: 8, bass: lane(PROG_A, 'bass'), arp: lane(PROG_A, 'arp'), pad: lane(PROG_A, 'pad'), lead: LEAD_A, drums: DRUMS },
    { name: 'B', bars: 8, bass: lane(PROG_B, 'bass'), arp: lane(PROG_B, 'arp'), pad: lane(PROG_B, 'pad'), lead: LEAD_B, drums: DRUMS },
  ],
  song: ['A', 'B'],
  room: { time: 0.2, feedback: 0.25, wet: 0.18 },
};

export default [floodgate];
