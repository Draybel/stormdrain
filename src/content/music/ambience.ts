/**
 * Room ambiences.
 *
 * - "Magpie's Stall" (shop): a cosy bossa in F major, 112 bpm — guitar-ish harp comping,
 *   vibraphone melody, rim clave, a shaker and the occasional chirp from the shopkeeper.
 * - "Hidey-Hole" (secret rooms): Eb lydian, 64 bpm — no beat, just glass, a low hum and
 *   sparkles, like finding a pocket of warm air behind a wall.
 */

import { bars, inst } from '../../audio/music/compose';
import { BELL_LEAD, GLASS, GLASS_PAD, HARP, SUB_BASS, UPRIGHT_BASS, WHISTLE } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// ---- Shop -----------------------------------------------------------------------------------
// F major: 1=F 2=G 3=A 4=Bb 5=C 6=D 7=E.
const comp = (c: string) => `${c} . . ${c} . . ${c} . . . ${c} . . ${c} . .`;
const bossa = (r: string, f: string) => `${r}:6 ${f}:2 ${f}:6 ${r}:2`;
const SH = {
  Fmaj7: { pad: comp('3+5+7'), bass: bossa('1', '5') },
  Gm7: { pad: comp("4+6+1'"), bass: bossa('2', '6') },
  C7: { pad: comp("4+7+2'"), bass: bossa('5,', '2') },
  Am7: { pad: comp("5+7+2'"), bass: bossa('3', '7') },
  D7: { pad: comp("5+6+1#'"), bass: bossa('6,', '3') },
  Bbmaj7: { pad: comp('3+4+6'), bass: bossa('4,', '1') },
  Bbm6: { pad: comp('2+4+6b'), bass: bossa('4,', '1') },
} as const;
type ShCh = keyof typeof SH;
const shLane = (prog: readonly ShCh[], k: 'pad' | 'bass') => bars(...prog.map((c) => SH[c][k]));
const SH_A: ShCh[] = ['Fmaj7', 'Fmaj7', 'Gm7', 'C7', 'Am7', 'D7', 'Gm7', 'C7'];
const SH_B: ShCh[] = ['Bbmaj7', 'Bbm6', 'Am7', 'D7', 'Gm7', 'C7', 'Fmaj7', 'C7'];

const BOSSA_DRUMS = {
  kick: 'x.....x.x.....x.',
  snare: bars('x..x..x...x..x..', '..x..x..x.......'),
  hat: 'ooxoooxoooxoooxo',
  perc: bars('.............x..', '................', '................', '......x.x.......'),
};

const shop: MusicTrack = {
  id: 'shop',
  gain: 1.23,
  name: "Magpie's Stall",
  kind: 'shop',
  mood: 'cosy lounge bossa; shiny things on every shelf, a bird humming behind the counter',
  bpm: 112,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'F',
  scale: 'major',
  loop: true,
  instruments: {
    bass: inst(UPRIGHT_BASS, { gain: 0.55, env: { a: 0.004, d: 0.5, s: 0.25, r: 0.1 } }),
    pad: inst(HARP, { gain: 0.14, pan: 0.25, delay: 0.12, env: { a: 0.002, d: 0.3, s: 0, r: 0.12 } }),
    lead: inst(BELL_LEAD, { gain: 0.24, pan: -0.2, vibrato: { rate: 5, depth: 10 }, env: { a: 0.004, d: 0.7, s: 0.15, r: 0.4 } }),
    drums: {
      kick: { kind: 'kick', pitch: 58, decay: 0.2, tone: 0.1, gain: 0.6 },
      snare: { kind: 'rim', pitch: 1700, gain: 0.5, pan: 0.15 },
      hat: { kind: 'shaker', gain: 0.4, pan: -0.25 },
      perc: { kind: 'drip', pitch: 2300, decay: 0.07, gain: 0.35, pan: 0.5 },
      gain: 0.55,
      delay: 0.15,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      pad: shLane(SH_A, 'pad'),
      bass: shLane(SH_A, 'bass'),
      lead: bars(
        "3':4 2':2 1':2 7:6 .:2",
        ".:4 5:2 6:2 7:2 1':2 2':4",
        "1':6 6:2 4:8",
        '3:4 5:4 7:4 6:4',
        "5:6 7:2 2':8",
        "1#':6 6:2 5:8",
        "4:4 6:4 1':4 3':4",
        "2':8 .:8",
      ),
      drums: BOSSA_DRUMS,
    },
    {
      name: 'B',
      bars: 8,
      pad: shLane(SH_B, 'pad'),
      bass: shLane(SH_B, 'bass'),
      lead: bars(
        "6:6 1':2 3':8",
        "2':6 1':2 6b:8",
        '7:6 5:2 3:8',
        "6:4 1#':4 3':4 5':4",
        "4':6 3':2 2':8",
        "1':4 7:4 4:8",
        '3:16',
        '.:8 5:2 6:2 7:4',
      ),
      drums: BOSSA_DRUMS,
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.25, feedback: 0.25, wet: 0.22, damp: 3500 },
};

// ---- Secret room ----------------------------------------------------------------------------
// Eb lydian: 1=Eb 2=F 3=G 4=A 5=Bb 6=C 7=D.
const SE = {
  Eb: { pad: '1+3+5+7:16', bass: '1:16', arp: "5' . . . 3' . . 7 . . . 4 . . . ." },
  F: { pad: '2+4+6:16', bass: '2:16', arp: "6' . . . 4' . . 2' . . . 6 . . . ." },
  Gm: { pad: '3+5+7:16', bass: '3:16', arp: "7' . . . 5' . . 3' . . . 7 . . . ." },
  Cm: { pad: '6,+1+3:16', bass: '6,:16', arp: "5' . . . 3' . . 1' . . . 6 . . . ." },
  Dm: { pad: '7,+2+4:16', bass: '7,:16', arp: "4' . . . 2' . . 7 . . . 4 . . . ." },
} as const;
type SeCh = keyof typeof SE;
const SE_PROG: SeCh[] = ['Eb', 'F', 'Gm', 'F', 'Eb', 'F', 'Cm', 'Dm'];
const seLane = (k: 'pad' | 'bass' | 'arp') => bars(...SE_PROG.map((c) => SE[c][k]));

const secret: MusicTrack = {
  id: 'secret',
  gain: 1.0,
  name: 'Hidey-Hole',
  kind: 'secret',
  mood: 'a hidden pocket of warm air; hush, sparkle, secrets',
  bpm: 64,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'Eb',
  scale: 'lydian',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.3, env: { a: 0.6, d: 0.5, s: 0.8, r: 1 } }),
    pad: inst(GLASS_PAD, { gain: 0.12 }),
    arp: inst(GLASS, { gain: 0.12, pan: 0.35, delay: 0.55 }),
    lead: inst(WHISTLE, { gain: 0.16, pan: -0.3 }),
    drums: {
      perc: { kind: 'bell', pitch: 2489, decay: 0.8, tone: 0.8, gain: 0.25, pan: -0.5 },
      gain: 0.4,
      delay: 0.6,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      pad: seLane('pad'),
      bass: seLane('bass'),
      arp: seLane('arp'),
      lead: bars('.:16', '4:8 6:8', '7:16', '6:16', '.:16', "6:8 1':8", '7:8 5:8', '4:16'),
      drums: { perc: bars('x...............', '................', '........x.......', '................') },
    },
  ],
  song: ['A'],
  room: { time: 0.6, feedback: 0.6, wet: 0.5, damp: 5000 },
};

export default [shop, secret];
