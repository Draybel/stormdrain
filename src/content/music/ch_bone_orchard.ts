/**
 * Chapter 5 (main) — The Bone Orchard: "Lantern Lullaby". G harmonic minor, 3/4, 78 bpm.
 * An eerie lullaby: a wavering whistle over a dry bone-xylophone ostinato, a ghostly choir,
 * pizzicato bass, bone clacks and a faraway lantern chime.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHOIR, MARIMBA, UPRIGHT_BASS, WHISTLE } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// G harmonic minor: 1=G 2=A 3=Bb 4=C 5=D 6=Eb 7=F# (7b = F). 12-step bars (3/4 in 16ths).
const BONES = [0, 2, 1, 2, 3, 2];
const CH = {
  Gm: { arp: arp("1 3 5 1'", BONES, 2), bass: '1:4 .:4 5,:4', pad: '1+3+5:12' },
  Eb: { arp: arp('6, 1 3 6', BONES, 2), bass: '6,:4 .:4 3,:4', pad: '6,+1+3:12' },
  Cm: { arp: arp('4, 6, 1 4', BONES, 2), bass: '4,:4 .:4 1:4', pad: '6,+1+4:12' },
  D: { arp: arp('5, 7, 2 5', BONES, 2), bass: '5,:4 .:4 2:4', pad: '7,+2+5:12' },
  Adim: { arp: arp("2 4 6 2'", BONES, 2), bass: '2:4 .:4 6,:4', pad: '6,+2+4:12' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Gm', 'Eb', 'Cm', 'D', 'Gm', 'Eb', 'Adim', 'D'];
const PROG_B: Ch[] = ['Cm', 'Gm', 'Eb', 'D', 'Cm', 'Gm', 'D', 'Gm'];

const LEAD_A = bars('5:6 6:2 5:4', '3:6 2:2 1:4', '6:4 5:4 4:4', '7,:12', '5:6 6:2 5:4', "1':6 7:2 6:4", '6:4 4:4 2:4', '7,:4 2:8');
const LEAD_B = bars("1':6 7b:2 6:4", '5:12', '6:6 5:2 3:4', '2:4 7,:4 5,:4', '6,:4 1:4 4:4', '3:6 2:2 1:4', '7,:6 1:2 2:4', '1:12');

const orchard: MusicTrack = {
  id: 'ch_bone_orchard',
  gain: 1.52,
  name: 'Lantern Lullaby',
  kind: 'chapter',
  chapter: 'bone_orchard',
  mood: 'eerie lullaby among bone trees; crows, swaying lanterns, something humming along',
  bpm: 78,
  beatsPerBar: 3,
  stepsPerBeat: 4,
  key: 'G',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(UPRIGHT_BASS, { gain: 0.55, env: { a: 0.003, d: 0.3, s: 0, r: 0.1 } }),
    pad: inst(CHOIR, { gain: 0.1 }),
    arp: inst(MARIMBA, {
      gain: 0.2,
      pan: 0.3,
      delay: 0.2,
      env: { a: 0.001, d: 0.16, s: 0, r: 0.08 },
    }),
    lead: inst(WHISTLE, { gain: 0.26, pan: -0.25, vibrato: { rate: 5.5, depth: 30, delay: 0.25 } }),
    drums: {
      kick: { kind: 'thump', pitch: 58, gain: 0.65 },
      snare: { kind: 'block', pitch: 1100, decay: 0.05, gain: 0.55, pan: 0.2 },
      perc: { kind: 'bell', pitch: 1568, decay: 0.9, tone: 0.6, gain: 0.25, pan: -0.5 },
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
      drums: {
        kick: 'x...........',
        snare: '....o...x...',
        perc: bars('x...........', '............', '............', '......x.....'),
      },
    },
    {
      name: 'B',
      bars: 8,
      arp: lane(PROG_B, 'arp'),
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      lead: LEAD_B,
      drums: {
        kick: 'x...........',
        snare: '....o.o.x...',
        perc: bars('x...........', '............', '........x...', '............'),
      },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.35, feedback: 0.42, wet: 0.35, damp: 2400 },
};

export default [orchard];
