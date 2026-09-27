/**
 * Chapter 6 (alt) — The Hollow Nest: "Paper Hive". A phrygian dominant, 108 bpm.
 * A humming hive drone, a buzzing saw melody with quick wing-beat vibrato, rustling shaker,
 * papery taps and — in the breakdown — the whole nest trilling A–Bb like ten thousand wings.
 */

import { arp, bars, inst, rep } from '../../audio/music/compose';
import { CHIP_ARP, DRONE, SAW_LEAD, SUB_BASS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// A phrygian dominant: 1=A 2=Bb 3=C# 4=D 5=E 6=F 7=G.
const HUM = "1:2 1:2 1:2 1':2 1:2 1:2 1:2 1':2";
const hum = (r: string, up: string) => `${r}:2 ${r}:2 ${r}:2 ${up}:2 ${r}:2 ${r}:2 ${r}:2 ${up}:2`;
const EIGHTHS = [0, 1, 2, 1, 0, 1, 2, 1];
const CH = {
  Bb: { arp: arp('2 4 6', EIGHTHS, 2), bass: hum('2', "2'"), pad: '2+4+6:16' },
  A: { arp: arp('1 3 5', EIGHTHS, 2), bass: HUM, pad: '1+3+5:16' },
  Gm: { arp: arp('7, 2 4', EIGHTHS, 2), bass: hum('7,', '7'), pad: '7,+2+4:16' },
} as const;
type Ch = keyof typeof CH;
const PROG_B: Ch[] = ['Bb', 'A', 'Bb', 'A', 'Gm', 'A', 'Bb', 'A'];
const lane = (k: 'arp' | 'bass' | 'pad') => bars(...PROG_B.map((c) => CH[c][k]));

const LEAD_A = bars(
  '1:4 2:2 3:2 4:4 3:2 2:2',
  '1:12 .:4',
  '5:4 6:2 5:2 4:4 3:2 2:2',
  '3:8 2:4 1:4',
  "1':4 7:2 6:2 5:4 6:2 5:2",
  '4:4 3:4 2:8',
  '3:2 4:2 5:2 6:2 5:2 4:2 3:2 2:2',
  '1:16',
);
const LEAD_B = bars('4:8 6:8', '5:8 3:8', '6:4 4:4 2:8', '3:12 1:4', '7,:8 2:4 4:4', '3:8 5:8', '6:6 5:2 4:4 2:4', '3:4 2:4 1:8');
const LEAD_C = bars('.:16', '.:16', '5:16', "2':8 1':8");
const TRILL = bars(rep('1 2', 8), rep('1 2', 8), rep('5 6', 8), rep("1' 2'", 8));

const nest: MusicTrack = {
  id: 'ch_hollow_nest',
  gain: 0.83,
  name: 'Paper Hive',
  kind: 'chapter',
  chapter: 'hollow_nest',
  mood: 'humming hive drone; wasp paper walls, amber light, larvae stirring',
  bpm: 108,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'A',
  scale: 'phrygianDominant',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.46, octave: 1, osc: [{ wave: 'sine' }, { wave: 'sawtooth', gain: 0.18 }] }),
    pad: inst(DRONE, { gain: 0.075, octave: 2 }),
    arp: inst(CHIP_ARP, { gain: 0.07, pan: 0.4, osc: [{ wave: 'square', voices: 2, detune: 20 }] }),
    lead: inst(SAW_LEAD, {
      gain: 0.1,
      pan: -0.2,
      vibrato: { rate: 11, depth: 14, delay: 0.1 },
      filter: { type: 'lowpass', cutoff: 2000, q: 2.5 },
    }),
    drums: {
      kick: { kind: 'kick', pitch: 52, decay: 0.24, tone: 0.3, gain: 0.9 },
      snare: { kind: 'clap', pitch: 1500, decay: 0.12, gain: 0.5 },
      hat: { kind: 'shaker', pitch: 5500, decay: 0.05, gain: 0.4, pan: 0.3 },
      perc: { kind: 'block', pitch: 1400, decay: 0.04, gain: 0.4, pan: -0.35 },
      gain: 0.58,
      delay: 0.12,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: HUM,
      pad: bars('1+5:16', '-:16'),
      lead: LEAD_A,
      drums: {
        kick: 'x..x..x...x..x..',
        snare: '....x.......x...',
        hat: 'xoxoxoxoxoxoxoxo',
        perc: '..x...x...x..x.x',
      },
    },
    {
      name: 'B',
      bars: 8,
      bass: lane('bass'),
      pad: lane('pad'),
      arp: lane('arp'),
      lead: LEAD_B,
      drums: {
        kick: 'x..x..x...x..x..',
        snare: '....x.......x...',
        hat: 'xoxoxoxoxoxoxoxo',
        perc: '..x...x...x..x.x',
      },
    },
    {
      name: 'C',
      bars: 4,
      bass: '1:16',
      pad: bars('1+5:16', '-:16'),
      arp: TRILL,
      lead: LEAD_C,
      drums: { kick: 'x...............', hat: 'o.o.o.o.o.o.o.o.' },
    },
  ],
  song: ['A', 'B', 'C'],
  room: { time: 0.18, feedback: 0.3, wet: 0.2, damp: 2500 },
};

export default [nest];
