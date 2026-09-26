/**
 * Chapter 4 (alt) — The Glimmer Grotto: "Echo Crystals". C# minor, 104 bpm.
 * High crystal arpeggios bouncing through a long dotted-eighth echo, a gliding theremin-like
 * whistle (the echo bats), glassy pads, rim ticks that ring around the cave and crystal chimes.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { GLASS, GLASS_PAD, SUB_BASS, WHISTLE } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// C# minor: 1=C# 2=D# 3=E 4=F# 5=G# 6=A 7=B. Arp in octave 5 (C#5).
const ECHO = [0, 2, 1, 3, 2, 1, 3, 2];
const CH = {
  Csm: { arp: arp("1 3 5 1'", ECHO, 2), bass: "1:6 1':2 .:4 1:4", pad: '1+3+5:16' },
  A: { arp: arp('6, 1 3 6', ECHO, 2), bass: '6,:6 6:2 .:4 6,:4', pad: '6,+1+3:16' },
  E: { arp: arp("3 5 7 3'", ECHO, 2), bass: "3:6 3':2 .:4 3:4", pad: '7,+3+5:16' },
  B: { arp: arp('7, 2 4 7', ECHO, 2), bass: '7,:6 7:2 .:4 7,:4', pad: '7,+2+4:16' },
  Fsm: { arp: arp('4, 6, 1 4', ECHO, 2), bass: "4:6 4':2 .:4 4:4", pad: '6,+1+4:16' },
  Gs: { arp: arp('5, 7#, 2 5', ECHO, 2), bass: '5,:6 5:2 .:4 5,:4', pad: '7#,+2+5:16' },
  Gsm: { arp: arp('5, 7, 2 5', ECHO, 2), bass: '5,:6 5:2 .:4 5,:4', pad: '7,+2+5:16' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Csm', 'A', 'E', 'B', 'Csm', 'A', 'Fsm', 'Gs'];
const PROG_B: Ch[] = ['A', 'B', 'Gsm', 'Csm', 'A', 'B', 'Csm', 'Csm'];

const LEAD_A = bars(
  "5:6 1':2 3':8",
  "1':8 7:4 6:4",
  '7:8 5:8',
  '4:12 2:4',
  "5:6 1':2 5':8",
  "3':8 2':4 1':4",
  '6:8 4:8',
  '~5:16',
);
const LEAD_B = bars(
  "3':12 2':4",
  "2':8 7:8",
  '7:8 5:4 7:4',
  "1':16",
  "1':6 3':2 6':8",
  "5':8 4':8",
  "3':8 2':4 1':4",
  '.:16',
);

const grotto: MusicTrack = {
  id: 'ch_glimmer_grotto',
  gain: 0.85,
  name: 'Echo Crystals',
  kind: 'chapter',
  chapter: 'glimmer_grotto',
  mood: 'crystal caves; every note comes back three times, bats circling overhead',
  bpm: 104,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'C#',
  scale: 'minor',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.42 }),
    pad: inst(GLASS_PAD, { gain: 0.1 }),
    arp: inst(GLASS, { gain: 0.13, pan: -0.35, octave: 5, delay: 0.55 }),
    lead: inst(WHISTLE, { gain: 0.24, pan: 0.2 }),
    drums: {
      kick: { kind: 'kick', pitch: 50, decay: 0.3, tone: 0.2, gain: 0.75 },
      snare: { kind: 'rim', pitch: 1900, gain: 0.55, pan: 0.3 },
      hat: { kind: 'shaker', decay: 0.05, gain: 0.35, pan: -0.2 },
      perc: { kind: 'bell', pitch: 1760, decay: 0.6, tone: 0.8, gain: 0.3, pan: 0.5 },
      gain: 0.55,
      delay: 0.45,
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
        kick: 'x.........x.....',
        snare: '....x.......x...',
        hat: '..o...o...o...o.',
        perc: bars('..............x.', '................', '.......x........', '................'),
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
        kick: 'x.........x..x..',
        snare: '....x.......x...',
        hat: '..o...o.o.o...o.',
        perc: bars('..............x.', '......x.........'),
      },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.433, feedback: 0.5, wet: 0.4, damp: 4000 },
};

export default [grotto];
