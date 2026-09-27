/**
 * Chapter 3 (alt) — The Rust Foundry: "Slag and Anvil". E phrygian, 88 bpm, heavy half-time.
 * A fuzzy phrygian riff, anvil strikes on two and four, a molten drone, a wailing gliding saw and
 * spark-like glass plinks in the second half.
 */

import { bars, inst } from '../../audio/music/compose';
import { DRONE, FUZZ_BASS, GLASS, SAW_LEAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// E phrygian: 1=E 2=F 3=G 4=A 5=B 6=C 7=D.
const RIFF1 = '1:3 1:3 1:2 2:4 1:2 7,:2';
const RIFF2 = '1:3 1:3 1:2 3:4 2:2 1:2';
const CLIMB = '6,:4 5,:4 6,:4 7,:4';
const root = (r: string) => `${r}:3 ${r}:3 ${r}:2 ${r}:4 ${r}:2 ${r}:2`;

const LEAD_A = bars(
  '5:8 6:4 5:4',
  '3:6 2:2 1:8',
  "5:8 6:4 1':4",
  '7:12 6:4',
  "1':8 2':4 1':4",
  '7:6 6:2 5:8',
  '6:4 5:4 3:4 2:4',
  '1:16',
);
const LEAD_B = bars(
  '3:8 5:8',
  '4:8 6:8',
  "~5:8 1':8",
  "2':8 1':8",
  "3':8 2':4 1':4",
  "2':8 1':4 7:4",
  '6:8 5:4 6:4',
  "1':16",
);
const SPARKS = bars(
  "1'' . . . . . 5' . . . . . . . 3' .",
  ". . 1'' . . . . . . 7' . . . . . .",
  "5' . . . . . 1'' . . . . . 2'' . . .",
  ". . . . 1'' . . . . . . 5' . . . .",
);

const foundry: MusicTrack = {
  id: 'ch_rust_foundry',
  gain: 1.32,
  name: 'Slag and Anvil',
  kind: 'chapter',
  chapter: 'rust_foundry',
  mood: 'molten slag, furnace glow, hammer blows in slow motion',
  bpm: 88,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'E',
  scale: 'phrygian',
  loop: true,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.3 }),
    pad: inst(DRONE, { gain: 0.065, octave: 3 }),
    lead: inst(SAW_LEAD, {
      gain: 0.11,
      pan: -0.15,
      glide: 0.12,
      filter: { type: 'lowpass', cutoff: 2200, q: 2 },
    }),
    arp: inst(GLASS, { gain: 0.12, pan: 0.4, delay: 0.5 }),
    drums: {
      kick: { kind: 'kick', pitch: 46, decay: 0.38, tone: 0.45, gain: 1 },
      snare: { kind: 'clap', pitch: 1100, decay: 0.2, gain: 0.6 },
      hat: { kind: 'hat', pitch: 8000, gain: 0.35, pan: 0.3 },
      perc: { kind: 'clank', pitch: 480, decay: 0.3, tone: 0.3, gain: 0.55, pan: -0.25 },
      gain: 0.62,
      delay: 0.15,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: bars(RIFF1, RIFF2, RIFF1, CLIMB),
      pad: bars('1+5:16', '-:16'),
      lead: LEAD_A,
      drums: {
        kick: 'x......xx.......',
        snare: '........x.......',
        hat: '..x...x...x...x.',
        perc: '....x.......x...',
      },
    },
    {
      name: 'B',
      bars: 8,
      bass: bars(root('6,'), root('7,'), RIFF1, RIFF2, root('6,'), root('7,'), root('2'), RIFF1),
      pad: bars('1+3+6:16', '7,+2+4:16', '1+3+5:16', '-:16', '1+3+6:16', '7,+2+4:16', '2+4+6:16', '1+3+5:16'),
      lead: LEAD_B,
      arp: SPARKS,
      drums: {
        kick: 'x......xx.....x.',
        snare: '........x.......',
        hat: '..x...x...x.x.x.',
        perc: '....x.......x..x',
      },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.2, feedback: 0.35, wet: 0.22, damp: 1500 },
};

export default [foundry];
