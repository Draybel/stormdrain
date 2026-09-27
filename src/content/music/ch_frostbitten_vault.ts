/**
 * Chapter 5 (alt) — The Frostbitten Vault: "Frost Chimes". A major, 66 bpm.
 * Cold, beautiful major-seventh harmony: falling icicle arpeggios, a celesta melody, a slow glass
 * pad, snow-soft shaker and a very long icy echo.
 */

import { bars, inst } from '../../audio/music/compose';
import { BELL_LEAD, GLASS, GLASS_PAD, SUB_BASS } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// A major: 1=A 2=B 3=C# 4=D 5=E 6=F# 7=G#. Arp octave 4 (A4).
/** Falling icicles: four chord tones high → low at uneven spots in the bar. */
const fall = (t0: string, t1: string, t2: string, t3: string) =>
  `${t0} . ${t1} ${t2} . . ${t3} . . . ${t1} . ${t0} . . .`;
const CH = {
  Amaj7: { arp: fall("3'", '7', '5', '3'), bass: '1:16', pad: '1+3+5+7:16' },
  Fsm7: { arp: fall("1'", '5', '3', '6,'), bass: '6,:16', pad: '6,+1+3+5:16' },
  Dmaj7: { arp: fall('6', '3', '1', '4,'), bass: '4,:16', pad: '4,+6,+1+3:16' },
  Esus: { arp: fall("2'", '5', '2', '1'), bass: '5,:16', pad: '5,+1+2:8 5,+7,+2:8' },
  E: { arp: fall('7', '5', '2', '7,'), bass: '5,:16', pad: '5,+7,+2:16' },
  Csm7: { arp: fall('7', '5', '3', '2'), bass: '3,:16', pad: '5,+7,+2+3:16' },
  Bm7: { arp: fall("1'", '6', '4', '2'), bass: '2,:16', pad: '4,+6,+1+2:16' },
} as const;
type Ch = keyof typeof CH;
const lane = (prog: readonly Ch[], k: 'arp' | 'bass' | 'pad') => bars(...prog.map((c) => CH[c][k]));

const PROG_A: Ch[] = ['Amaj7', 'Fsm7', 'Dmaj7', 'Esus'];
const PROG_A2: Ch[] = ['Amaj7', 'Csm7', 'Dmaj7', 'E'];
const PROG_B: Ch[] = ['Fsm7', 'Dmaj7', 'Bm7', 'E'];

const SNOW = { kick: 'x...............', hat: '..o...o...o...o.', perc: bars('......x.........', '..............x.') };

const vault: MusicTrack = {
  id: 'ch_frostbitten_vault',
  gain: 0.87,
  name: 'Frost Chimes',
  kind: 'chapter',
  chapter: 'frostbitten_vault',
  mood: 'ice and frozen treasure; still air, breath clouds, chimes of cracking icicles',
  bpm: 66,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'A',
  scale: 'major',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.38, env: { a: 0.3, d: 0.5, s: 0.8, r: 0.8 } }),
    pad: inst(GLASS_PAD, { gain: 0.11 }),
    arp: inst(GLASS, { gain: 0.14, pan: 0.35, delay: 0.5 }),
    lead: inst(BELL_LEAD, { gain: 0.26, pan: -0.2 }),
    drums: {
      kick: { kind: 'thump', pitch: 50, decay: 0.3, gain: 0.5 },
      hat: { kind: 'shaker', pitch: 7000, decay: 0.1, gain: 0.25, pan: 0.3 },
      perc: { kind: 'bell', pitch: 2637, decay: 0.7, tone: 0.8, gain: 0.25, pan: -0.45 },
      gain: 0.5,
      delay: 0.5,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 4,
      arp: lane(PROG_A, 'arp'),
      bass: lane(PROG_A, 'bass'),
      pad: lane(PROG_A, 'pad'),
      lead: bars('5:8 3:4 5:4', '6:12 5:4', '3:8 1:4 3:4', '2:16'),
      drums: SNOW,
    },
    {
      name: 'A2',
      bars: 4,
      arp: lane(PROG_A2, 'arp'),
      bass: lane(PROG_A2, 'bass'),
      pad: lane(PROG_A2, 'pad'),
      lead: bars("5:8 7:4 1':4", '7:12 5:4', '6:8 3:8', '2:8 3:4 2:4'),
      drums: SNOW,
    },
    {
      name: 'B',
      bars: 4,
      arp: lane(PROG_B, 'arp'),
      bass: lane(PROG_B, 'bass'),
      pad: lane(PROG_B, 'pad'),
      lead: bars("1':8 7:4 6:4", '6:8 5:4 3:4', "4:8 6:4 1':4", '7:16'),
      drums: { ...SNOW, hat: '..o...o.o.o...o.' },
    },
  ],
  song: ['A', 'A2', 'B'],
  room: { time: 0.55, feedback: 0.55, wet: 0.45, damp: 5000 },
};

export default [vault];
