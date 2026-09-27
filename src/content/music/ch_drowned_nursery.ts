/**
 * Chapter 1 (alt) — The Drowned Nursery: "Waterlogged Lullaby". F major waltz (3/4), 92 bpm.
 * A warped music box (slow wobble, as if the spring got wet) with a borrowed Bb-minor chord that
 * turns the lullaby a little sour. Muffled thumps, drips, long cavernous echoes.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { BELL_LEAD, GLASS_PAD, MUSIC_BOX, SUB_BASS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// F major: 1=F 2=G 3=A 4=Bb 5=C 6=D 7=E. One chord per 12-step bar.
const WALTZ = [0, 1, 2, 3, 2, 1];
const C = {
  F: { arp: arp("1 3 5 1'", WALTZ, 2), bass: '1:8 5,:4', pad: '1+3+5:12' },
  Dm: { arp: arp('6, 1 3 6', WALTZ, 2), bass: '6,:8 3,:4', pad: '6,+1+3:12' },
  Bb: { arp: arp('4, 6, 1 4', WALTZ, 2), bass: '4,:8 1:4', pad: '6,+1+4:12' },
  C: { arp: arp('5, 7, 2 5', WALTZ, 2), bass: '5,:8 2:4', pad: '7,+2+5:12' },
  Bbm: { arp: arp('4, 6b, 1 4', WALTZ, 2), bass: '4,:8 1:4', pad: '6b,+1+4:12' },
  Am: { arp: arp("3 5 7 3'", WALTZ, 2), bass: '3,:8 7,:4', pad: '7,+3+5:12' },
  Gm: { arp: arp("2 4 6 2'", WALTZ, 2), bass: '2,:8 6,:4', pad: '6,+2+4:12' },
} as const;
type Ch = keyof typeof C;

function lane(prog: readonly Ch[], k: 'arp' | 'bass' | 'pad'): string {
  return bars(...prog.map((c) => C[c][k]));
}

const PROG_A: Ch[] = ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Bbm', 'C'];
const PROG_B: Ch[] = ['Dm', 'Am', 'Bb', 'F', 'Gm', 'C', 'F', 'F'];

const LEAD_A = bars(
  '5:6 6:2 5:4',
  '3:6 2:2 1:4',
  '2:4 4:4 6:4',
  '5:12',
  '5:6 6:2 5:4',
  "1':6 7:2 6:4",
  '6b:4 5:4 4:4',
  '2:8 7,:4',
);
const LEAD_B = bars(
  "6:6 1':2 6:4",
  '5:6 3:2 5:4',
  "4:6 6:2 1':4",
  '7:6 6:2 5:4',
  '6:6 4:2 2:4',
  '3:4 5:4 7:4',
  "1':12",
  '.:8 3:2 4:2',
);

const nursery: MusicTrack = {
  id: 'ch_drowned_nursery',
  gain: 1.0,
  name: 'Waterlogged Lullaby',
  kind: 'chapter',
  chapter: 'drowned_nursery',
  mood: 'soggy toys and a music box that keeps playing underwater',
  bpm: 92,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  key: 'F',
  scale: 'major',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.42, env: { a: 0.02, d: 0.4, s: 0.5, r: 0.2 } }),
    pad: inst(GLASS_PAD, { gain: 0.1 }),
    arp: inst(MUSIC_BOX, { gain: 0.15, pan: 0.3, vibrato: { rate: 2.4, depth: 16 } }),
    lead: inst(BELL_LEAD, { gain: 0.24, pan: -0.2, vibrato: { rate: 3, depth: 9 } }),
    drums: {
      kick: { kind: 'thump', pitch: 60, gain: 0.7 },
      hat: { kind: 'shaker', decay: 0.09, gain: 0.35, pan: 0.3 },
      perc: { kind: 'drip', pitch: 620, gain: 0.5, pan: -0.45 },
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
      drums: { kick: 'x...........', hat: '....o...o...', perc: bars('.......x....', '..x.........', '............', '.....x...x..') },
    },
    {
      name: 'B',
      bars: 8,
      arp: lane(PROG_B, 'arp'),
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      lead: LEAD_B,
      drums: { kick: 'x...........', hat: '....x...o...', perc: bars('..........x.', '....x.......') },
    },
  ],
  song: ['A', 'B', 'A'],
  room: { time: 0.38, feedback: 0.5, wet: 0.4, damp: 1800 },
};

export default [nursery];
