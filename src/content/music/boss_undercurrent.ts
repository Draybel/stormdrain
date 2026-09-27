/**
 * Boss theme 3 (chapters 5-6) — "Undercurrent". F harmonic minor, 132 bpm.
 * Dark and heavy: fuzz bass eighths, an ominous choir, a gliding saw lead, low toms.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { CHOIR, FUZZ_BASS, PLUCK, SAW_LEAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// F harmonic minor: 1=F 2=G 3=Ab 4=Bb 5=C 6=Db 7=E (7b = Eb).
const drive = (r: string, up: string, f: string) => `${r}:2 ${r}:2 ${r}:2 ${up}:2 ${r}:2 ${r}:2 ${f}:2 ${r}:2`;
const ARPS = [0, 1, 2, 3, 2, 1, 2, 3];
const CH = {
  Fm: { bass: drive('1', "1'", '5'), pad: '1+3+5:16', arp: arp("1 3 5 1'", ARPS, 2) },
  Db: { bass: drive('6,', '6', '3'), pad: '6,+1+3:16', arp: arp('6, 1 3 6', ARPS, 2) },
  Bbm: { bass: drive('4,', '4', '1'), pad: '6,+1+4:16', arp: arp('4, 6, 1 4', ARPS, 2) },
  C: { bass: drive('5,', '5', '2'), pad: '7,+2+5:16', arp: arp('5, 7, 2 5', ARPS, 2) },
  Eb: { bass: drive('7b,', '7b', '4'), pad: '7b,+2+4:16', arp: arp('7b, 2 4 7b', ARPS, 2) },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Fm', 'Db', 'Bbm', 'C', 'Fm', 'Db', 'Bbm', 'C'];
const PROG_B: Ch[] = ['Db', 'Eb', 'Fm', 'Fm', 'Db', 'Bbm', 'C', 'C'];

const LEAD_A = bars(
  "1':6 7:2 1':4 5:4",
  "6:6 5:2 6:4 1':4",
  "4':6 3':2 2':4 1':4",
  '7:12 5:4',
  "1':6 7:2 1':4 3':4",
  "4':6 3':2 1':8",
  "2':4 1':4 6:4 4:4",
  "7:8 2':4 5':4",
);
const LEAD_B = bars("3':8 1':8", "2':8 7b:8", "1':12 5:4", '3:4 4:4 5:8', "6:8 3':8", "4':8 2':4 1':4", '7:16', "2':8 7:8");

const undercurrent: MusicTrack = {
  id: 'boss_undercurrent',
  gain: 1.28,
  name: 'Undercurrent',
  kind: 'boss',
  mood: 'dark and heavy; the pull of deep water, a shape circling below',
  bpm: 132,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'F',
  scale: 'harmonicMinor',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.3 }),
    pad: inst(CHOIR, { gain: 0.11, env: { a: 0.3, d: 0.4, s: 0.85, r: 0.5 } }),
    arp: inst(PLUCK, { gain: 0.12, pan: 0.35, octave: 3 }),
    lead: inst(SAW_LEAD, { gain: 0.12, pan: -0.15, glide: 0.08 }),
    drums: {
      kick: { kind: 'kick', pitch: 46, decay: 0.3, tone: 0.5, gain: 1 },
      snare: { kind: 'snare', pitch: 170, decay: 0.2, tone: 0.5, gain: 0.7 },
      hat: { kind: 'hat', pitch: 8000, gain: 0.35, pan: 0.25 },
      perc: { kind: 'tom', pitch: 70, decay: 0.5, gain: 0.85, pan: -0.2 },
      gain: 0.62,
      delay: 0.12,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: lane(PROG_A, 'bass'),
      pad: lane(PROG_A, 'pad'),
      lead: LEAD_A,
      drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', perc: '..........x...x.' },
    },
    {
      name: 'B',
      bars: 8,
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      arp: lane(PROG_B, 'arp'),
      lead: LEAD_B,
      drums: { kick: 'x.....x.x.....x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', perc: '..........x.x.x.' },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.23, feedback: 0.35, wet: 0.24, damp: 2000 },
};

export default [undercurrent];
