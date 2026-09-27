/**
 * Chapter 6 (main) — The Eye of the Storm: "Eye of the Storm". D minor, 140 bpm, driving.
 * The climb to the top: pumping fuzz-bass eighths, sixteenth chip arpeggios like rain on tin,
 * a big detuned saw lead, thunder toms — and in the middle the title's STORMDRAIN motif returns
 * at double speed.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHIP_ARP, FUZZ_BASS, SAW_LEAD, STRINGS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// D minor: 1=D 2=E 3=F 4=G 5=A 6=Bb 7=C (7# = C#).
const RAIN = [0, 1, 2, 1, 3, 2, 1, 2, 0, 1, 2, 1, 3, 2, 1, 2];
const pump = (r: string, up: string) => `${r}:2 ${r}:2 ${up}:2 ${r}:2 ${r}:2 ${r}:2 ${up}:2 ${r}:2`;
const CH = {
  Dm: { arp: arp("1 3 5 1'", RAIN), bass: pump('1', "1'"), pad: '1+3+5:16' },
  Bb: { arp: arp('6, 1 3 6', RAIN), bass: pump('6,', '6'), pad: '6,+1+3:16' },
  C: { arp: arp('7, 2 4 7', RAIN), bass: pump('7,', '7'), pad: '7,+2+4:16' },
  A: { arp: arp('5, 7#, 2 5', RAIN), bass: pump('5,', '5'), pad: '5,+7#,+2:16' },
  Gm: { arp: arp('4, 6, 1 4', RAIN), bass: pump('4', "4'"), pad: '6,+1+4:16' },
  F: { arp: arp("3 5 7 3'", RAIN), bass: pump('3', "3'"), pad: '7,+3+5:16' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'];
const PROG_B: Ch[] = ['Dm', 'Bb', 'F', 'C', 'Gm', 'Dm', 'Bb', 'A'];
const PROG_C: Ch[] = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'];

const LEAD_A = bars(
  "1':4 5:4 1':2 2':2 3':4",
  "2':4 1':4 6:4 1':4",
  "7:6 1':2 2':4 7:4",
  '7#:12 5:4',
  "1':4 5:4 1':2 2':2 3':4",
  "4':6 3':2 2':4 1':4",
  "2':4 1':4 6:4 4:4",
  '7#,:4 2:4 5:4 7#:4',
);
// The title motif (see title.ts), now over the storm.
const LEAD_B = bars(
  "5:3 1':5 7:2 6:2 5:4",
  '3:6 4:2 5:2 6:6',
  '5:4 7:4 5:2 4:2 3:4',
  '2:8 . . 7,:2 1:4',
  "1':6 6:2 4:8",
  "3':4 2':4 1':4 5:4",
  "6:6 1':2 3':8",
  "2':6 1':2 7#:8",
);
const LEAD_C = bars("3':16", "2':16", "1':16", "-:8 5:4 6:4", "3':8 4':8", "5':8 4':4 2':4", "2':16", "7#:8 2':8");

const HATS = 'x.x.x.x.x.x.x.x+';
const storm: MusicTrack = {
  id: 'ch_eye_of_storm',
  gain: 1.5,
  name: 'Eye of the Storm',
  kind: 'chapter',
  chapter: 'eye_of_storm',
  mood: 'driving climax; wind, lightning, the whole storm turning around you',
  bpm: 140,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'minor',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.28 }),
    pad: inst(STRINGS, { gain: 0.06 }),
    arp: inst(CHIP_ARP, { gain: 0.08, pan: 0.35 }),
    lead: inst(SAW_LEAD, { gain: 0.12, pan: -0.1 }),
    drums: {
      kick: { kind: 'kick', pitch: 50, decay: 0.26, tone: 0.5, gain: 1 },
      snare: { kind: 'snare', pitch: 200, decay: 0.16, tone: 0.6, gain: 0.7 },
      hat: { kind: 'hat', gain: 0.45, pan: 0.25 },
      perc: { kind: 'tom', pitch: 80, decay: 0.45, gain: 0.8, pan: -0.2 },
      gain: 0.62,
      delay: 0.1,
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
        kick: 'x...x...x...x...',
        snare: '....x.......x...',
        hat: HATS,
        perc: bars('................', '............x.x.'),
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
        kick: 'x...x...x...x...',
        snare: '....x.......x..o',
        hat: HATS,
        perc: bars('................', '..........x.x.xx'),
      },
    },
    {
      name: 'C',
      bars: 8,
      arp: lane(PROG_C, 'arp'),
      bass: lane(PROG_C, 'bass'),
      pad: lane(PROG_C, 'pad'),
      lead: LEAD_C,
      drums: {
        kick: 'x.......x.......',
        snare: '........x.......',
        hat: '..x...x...x...x.',
        perc: bars('................', '................', '................', 'x...x...x.x.xxxx'),
      },
    },
  ],
  song: ['A', 'B', 'C'],
  room: { time: 0.21, feedback: 0.3, wet: 0.22, damp: 3000 },
};

export default [storm];
