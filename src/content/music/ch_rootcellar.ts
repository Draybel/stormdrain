/**
 * Chapter 2 (main) — The Rootcellar: "Pickle-Jar Waltz". A harmonic minor folk waltz, 150 bpm.
 * Upright bass on the one, wheezy accordion on two-and-three, a fiddle tune, wooden-spoon knocks
 * and the odd clink of a jar.
 */

import { bars, inst } from '../../audio/music/compose';
import { FIDDLE, PLUCK, REED, UPRIGHT_BASS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// A harmonic minor: 1=A 2=B 3=C 4=D 5=E 6=F 7=G# (7b = G natural). 12-step bars.
const CH = {
  Am: { bass: '1:4 .:8', pad: '.:4 1+3+5:3 . 1+3+5:3 .' },
  Dm: { bass: '4:4 .:8', pad: ".:4 6,+1+4:3 . 6,+1+4:3 ." },
  E: { bass: '5,:4 .:8', pad: '.:4 7,+2+5:3 . 7,+2+5:3 .' },
  C: { bass: '3:4 .:8', pad: '.:4 7b,+3+5:3 . 7b,+3+5:3 .' },
  G: { bass: '7b,:4 .:8', pad: '.:4 7b,+2+4:3 . 7b,+2+4:3 .' },
  Em: { bass: '5,:4 .:8', pad: '.:4 7b,+2+5:3 . 7b,+2+5:3 .' },
  F: { bass: '6,:4 .:8', pad: '.:4 6,+1+3:3 . 6,+1+3:3 .' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Am', 'Am', 'Dm', 'Dm', 'E', 'E', 'Am', 'Am'];
const PROG_B: Ch[] = ['C', 'G', 'Am', 'Em', 'F', 'C', 'Dm', 'E'];
const PROG_C: Ch[] = ['Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'E'];

// Walking pickups at the end of each 8-bar phrase replace the last plain bass bar.
const BASS_A = bars(...PROG_A.slice(0, 7).map((c) => CH[c].bass), '1:4 5,:4 7,:4');
const BASS_B = bars(...PROG_B.slice(0, 7).map((c) => CH[c].bass), '5,:4 7,:4 2:4');
const BASS_C = bars(...PROG_C.slice(0, 7).map((c) => CH[c].bass), '5,:4 6,:4 7,:4');

const LEAD_A = bars(
  "5:4 1':2 2':2 3':4",
  "2':2 1':2 7:2 1':2 5:4",
  "4:4 6:2 1':2 4':4",
  "3':2 2':2 1':2 2':2 6:4",
  "5:4 7:2 2':2 5':4",
  "4':2 3':2 2':2 1':2 7:4",
  "1':4 3':4 5':4",
  "1':8 .:4",
);
const LEAD_B = bars(
  "3':4 5':4 3':4",
  "2':6 1':2 7b:4",
  "1':4 3':2 2':2 1':4",
  "5:4 7b:4 2':4",
  "6:4 1':2 3':2 6':4",
  "5':6 4':2 3':4",
  "4':4 3':2 2':2 1':4",
  '7:8 5:4',
);
const LEAD_C = bars(
  "4:2 6:2 1':2 4':2 1':2 6:2",
  "5:2 1':2 3':2 5':2 3':2 1':2",
  "5:2 7:2 2':2 5':2 4':2 2':2",
  "1':4 5:4 1':4",
  "6:4 4':4 3':2 2':2",
  "1':2 2':2 3':4 1':4",
  "7:4 2':4 4':4",
  "3':2 2':2 1':2 7:2 2':4",
);
// Mandolin tremolo on the C section.
const MANDO_C = bars(
  "4' 4' 4' 4' 3' 3' 3' 3' 1' 1' 1' 1'",
  "3' 3' 3' 3' 1' 1' 1' 1' 5 5 5 5",
  "2' 2' 2' 2' 7 7 7 7 5 5 5 5",
  "1' 1' 1' 1' 5 5 5 5 3 3 3 3",
  "4' 4' 4' 4' 3' 3' 3' 3' 1' 1' 1' 1'",
  "3' 3' 3' 3' 1' 1' 1' 1' 5 5 5 5",
  "2' 2' 2' 2' 7 7 7 7 5 5 5 5",
  "7 7 7 7 2' 2' 2' 2' 4' 4' 4' 4'",
);

const DRUMS = { kick: 'x...........', snare: '....x...x...', hat: '..o...o...o.', perc: bars('..........x.', '............') };

const rootcellar: MusicTrack = {
  id: 'ch_rootcellar',
  gain: 1.5,
  name: 'Pickle-Jar Waltz',
  kind: 'chapter',
  chapter: 'rootcellar',
  mood: 'cellar folk-waltz; roots, jars and moles dancing by lamplight',
  bpm: 150,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  key: 'A',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(UPRIGHT_BASS, { gain: 0.6 }),
    pad: inst(REED, { gain: 0.1, pan: 0.2, octave: 3 }),
    lead: inst(FIDDLE, { gain: 0.2, pan: -0.15, octave: 3 }),
    arp: inst(PLUCK, { gain: 0.1, pan: 0.4, octave: 3, delay: 0.15 }),
    drums: {
      kick: { kind: 'kick', pitch: 58, decay: 0.2, tone: 0.2, gain: 0.8 },
      snare: { kind: 'block', pitch: 700, gain: 0.7, pan: 0.15 },
      hat: { kind: 'shaker', gain: 0.45, pan: -0.2 },
      perc: { kind: 'clank', pitch: 900, decay: 0.12, gain: 0.35, pan: 0.45 },
      gain: 0.6,
      delay: 0.12,
    },
  },
  sections: [
    { name: 'A', bars: 8, bass: BASS_A, pad: lane(PROG_A, 'pad'), lead: LEAD_A, drums: DRUMS },
    { name: 'B', bars: 8, bass: BASS_B, pad: lane(PROG_B, 'pad'), lead: LEAD_B, drums: DRUMS },
    {
      name: 'C',
      bars: 8,
      bass: BASS_C,
      pad: lane(PROG_C, 'pad'),
      lead: LEAD_C,
      arp: MANDO_C,
      drums: { ...DRUMS, hat: 'x.o.x.o.x.o.' },
    },
  ],
  song: ['A', 'B', 'A', 'C'],
  room: { time: 0.15, feedback: 0.2, wet: 0.2, damp: 2200 },
};

export default [rootcellar];
