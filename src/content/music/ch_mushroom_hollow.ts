/**
 * Chapter 4 (main) — The Mushroom Hollow: "Spore Drift". F lydian, 92 bpm.
 * Sixteenth-note glass arpeggios cascading through a dotted-eighth echo, a soft choir, a slow
 * dreamy flute and a lazy trip-hop beat that only arrives in the second half.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHOIR, FLUTE, GLASS, SUB_BASS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// F lydian: 1=F 2=G 3=A 4=B 5=C 6=D 7=E.
const SPORE = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 1, 3, 2, 3, 1, 2];
const CH = {
  F: { arp: arp('1 3 5 7', SPORE), bass: '1:8 1:4 5:4', pad: '1+3+5+7:16' },
  G: { arp: arp("2 4 6 2'", SPORE), bass: '2:8 2:4 6:4', pad: '2+4+6:16' },
  Em: { arp: arp('7, 2 4 7', SPORE), bass: '7,:8 7,:4 4:4', pad: '7,+2+4:16' },
  Am: { arp: arp("3 5 7 3'", SPORE), bass: '3:8 3:4 7:4', pad: '7,+3+5:16' },
  Dm: { arp: arp('6, 1 3 6', SPORE), bass: '6,:8 6,:4 3:4', pad: '6,+1+3:16' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['F', 'G', 'F', 'G', 'Em', 'Am', 'Dm', 'G'];
const PROG_B: Ch[] = ['Dm', 'Em', 'F', 'G', 'Am', 'G', 'F', 'G'];

const LEAD_A = bars('5:8 4:4 3:4', '2:12 3:4', '5:8 6:4 7:4', '6:16', '7:8 6:4 4:4', '3:12 5:4', '6:8 5:4 3:4', '2:16');
const LEAD_B = bars(
  "1':8 7:4 6:4",
  "7:8 2':8",
  "3':12 2':4",
  "1':8 6:8",
  '7:8 6:4 7:4',
  '6:8 4:8',
  '5:12 4:4',
  '4:8 2:8',
);

const hollow: MusicTrack = {
  id: 'ch_mushroom_hollow',
  gain: 0.85,
  name: 'Spore Drift',
  kind: 'chapter',
  chapter: 'mushroom_hollow',
  mood: 'spore-y and dreamy; glowcaps pulsing, spores drifting upward',
  bpm: 92,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'F',
  scale: 'lydian',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.44 }),
    pad: inst(CHOIR, { gain: 0.1 }),
    arp: inst(GLASS, { gain: 0.14, pan: 0.3, delay: 0.55 }),
    lead: inst(FLUTE, { gain: 0.24, pan: -0.25, delay: 0.4 }),
    drums: {
      kick: { kind: 'kick', pitch: 55, decay: 0.28, tone: 0.25, gain: 0.8 },
      snare: { kind: 'clap', pitch: 1200, decay: 0.16, gain: 0.45 },
      hat: { kind: 'shaker', gain: 0.35, pan: 0.25 },
      perc: { kind: 'drip', pitch: 1400, decay: 0.08, gain: 0.4, pan: -0.4 },
      gain: 0.55,
      delay: 0.3,
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
      drums: { hat: 'o.x.o.x.o.x.o.x.', perc: bars('......x.........', '...........x..x.') },
    },
    {
      name: 'B',
      bars: 8,
      arp: lane(PROG_B, 'arp'),
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      lead: LEAD_B,
      drums: {
        kick: 'x......x..x.....',
        snare: '....x.......x...',
        hat: 'o.x.o.x.o.x.o.x.',
        perc: bars('......x.........', '...........x..x.'),
      },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.49, feedback: 0.45, wet: 0.35, damp: 3000 },
};

export default [hollow];
