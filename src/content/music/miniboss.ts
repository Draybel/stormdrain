/**
 * Miniboss theme — "Skirmish". E harmonic minor, 144 bpm.
 * A scrappy chiptune scuffle: bouncing plucked sixteenth bass, square lead, fast chip arps.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHIP_ARP, PLUCK_BASS, SQUARE_LEAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// E harmonic minor: 1=E 2=F# 3=G 4=A 5=B 6=C 7=D# (7b = D).
const bounce = (r: string, up: string) => `${r} . ${r} ${up} . ${r} ${r} . ${r} . ${r} ${up} . ${r} ${r} .`;
const CYCLE = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1];
const CH = {
  Em: { bass: bounce('1', "1'"), arp: arp('1 3 5', CYCLE) },
  C: { bass: bounce('6,', '6'), arp: arp('6, 1 3', CYCLE) },
  Am: { bass: bounce('4', "4'"), arp: arp("4 6 1'", CYCLE) },
  B: { bass: bounce('5,', '5'), arp: arp('5, 7, 2', CYCLE) },
  D: { bass: bounce('7b,', '7b'), arp: arp('7b, 2 4', CYCLE) },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Em', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B'];
const PROG_B: Ch[] = ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'];

const LEAD_A = bars(
  "5:2 3:2 5:2 1':2 7:4 5:4",
  '6:4 5:2 3:2 1:8',
  "4:2 6:2 1':2 3':2 2':4 1':4",
  "7:8 2':4 4':4",
  "5:2 3:2 5:2 1':2 3':4 2':4",
  "1':4 7b:2 6:2 5:8",
  "6:4 1':4 4:4 3:4",
  '7,:4 2:4 5:8',
);
const LEAD_B = bars(
  "3':6 2':2 1':8",
  "2':6 1':2 7b:8",
  "1':4 5:4 3:4 5:4",
  "1':16",
  "3':6 4':2 5':8",
  "4':6 3':2 2':8",
  "7:8 2':8",
  "4':8 7:8",
);

const skirmish: MusicTrack = {
  id: 'miniboss',
  gain: 1.9,
  name: 'Skirmish',
  kind: 'miniboss',
  mood: 'a scrappy scuffle; quick, bouncy, a little cheeky',
  bpm: 144,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'E',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(PLUCK_BASS, { gain: 0.34 }),
    arp: inst(CHIP_ARP, { gain: 0.07, pan: 0.35, octave: 5 }),
    lead: inst(SQUARE_LEAD, { gain: 0.15, pan: -0.15 }),
    drums: {
      kick: { kind: 'kick', pitch: 54, decay: 0.2, tone: 0.5, gain: 1 },
      snare: { kind: 'snare', pitch: 220, decay: 0.13, tone: 0.6, gain: 0.65 },
      hat: { kind: 'hat', gain: 0.4, pan: 0.25 },
      perc: { kind: 'tom', pitch: 130, decay: 0.22, gain: 0.7, pan: -0.25 },
      gain: 0.6,
      delay: 0.08,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: lane(PROG_A, 'bass'),
      arp: lane(PROG_A, 'arp'),
      lead: LEAD_A,
      drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', perc: '..............xx' },
    },
    {
      name: 'B',
      bars: 8,
      bass: lane(PROG_B, 'bass'),
      arp: lane(PROG_B, 'arp'),
      lead: LEAD_B,
      drums: { kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx', perc: '............x.xx' },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.18, feedback: 0.22, wet: 0.16 },
};

export default [skirmish];
