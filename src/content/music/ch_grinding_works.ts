/**
 * Chapter 3 (main) — The Grinding Works: "Cogs in Swing". G dorian, 118 bpm shuffle written on a
 * triplet grid (3 steps per beat). Walking plucked bass, clarinet-ish reed melody, marimba triplet
 * gears, a ride-cymbal tick and clanking pipes.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { MARIMBA, ORGAN, PLUCK_BASS, REED } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// G dorian: 1=G 2=A 3=Bb 4=C 5=D 6=E 7=F (6b = Eb, 7# = F#). 12 steps per bar.
const TRIP = [2, 1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0];
const GEARS = {
  Gm7: arp('3 5 7', TRIP),
  C7: arp("3 6 1'", TRIP),
  Ebmaj7: arp('1 3 5', TRIP),
  D7: arp('7#, 2 4', TRIP),
  Cm7: arp("4 6b 1'", TRIP),
  F7: arp('2 4 6b', TRIP),
  Bbmaj7: arp('3 5 7', TRIP),
  Am7b5: arp("4 6b 1'", TRIP),
} as const;
const PADS = {
  Gm7: '1+3+5+7:12',
  C7: "3+4+6+1':12",
  Ebmaj7: '1+3+5+6b:12',
  D7: '7#,+2+4+5:12',
  Cm7: '1+3+4+6b:12',
  F7: '7,+2+4+6b:12',
  Bbmaj7: '2+3+5+7:12',
  Am7b5: '1+2+4+6b:12',
} as const;
type Ch = keyof typeof PADS;
const PROG_A: Ch[] = ['Gm7', 'C7', 'Gm7', 'C7', 'Ebmaj7', 'D7', 'Gm7', 'D7'];
const PROG_B: Ch[] = ['Cm7', 'F7', 'Bbmaj7', 'Ebmaj7', 'Am7b5', 'D7', 'Gm7', 'D7'];

const WALK_A = bars(
  '1:3 2:3 3:3 3#:3',
  '4:3 3:3 2:3 7#,:3',
  '1:3 5:3 7:3 5:3',
  '4:3 3:3 2:3 1:3',
  '6b,:3 1:3 3:3 5:3',
  '5,:3 7#,:3 2:3 4:3',
  '1:3 3:3 4:3 5:3',
  '5:3 4:3 2:3 7#,:3',
);
const WALK_B = bars(
  "4:3 6b:3 1':3 6b:3",
  '7,:3 2:3 4:3 6b:3',
  '3:3 5:3 7:3 5:3',
  '6b,:3 1:3 3:3 1:3',
  '2:3 4:3 6b:3 4:3',
  '5,:3 2:3 4:3 2:3',
  '1:3 5:3 3:3 1:3',
  '5,:3 7#,:3 2:3 7#,:3',
);

const LEAD_A = bars(
  '5:2 5 4:2 3 1:3 .:3',
  ".:2 6 6:2 7 1':3 6:2 5",
  '5:2 5 4:2 3 5:2 3 1:3',
  '2:2 3 4:2 5 6:3 .:3',
  '5:3 3:2 1 3:3 1:3',
  '7#,:2 2 4:2 5 4:3 2:3',
  "3:2 1 3:2 5 1':3 7:2 5",
  '4:3 2:2 7#, 5,:6',
);
const LEAD_B = bars(
  "6b:3 5:2 4 1':3 6b:3",
  '6b:2 4 2:2 7, 1:6',
  "7:3 5:2 3 5:3 1':3",
  '5:6 3:3 1:3',
  '6b:3 4:2 2 6b:3 4:3',
  '7#:3 4:3 2:3 7#,:3',
  "1':2 7 5:2 3 5:3 1:3",
  '.:6 5,:2 7#, 2:2 4',
);

const DRUMS = {
  kick: 'x.....x.....',
  snare: '...x.....x..',
  hat: 'x..x.xx..x.x',
  perc: bars('..x.....x...', '.....x....x.'),
};

const works: MusicTrack = {
  id: 'ch_grinding_works',
  gain: 1.6,
  name: 'Cogs in Swing',
  kind: 'chapter',
  chapter: 'grinding_works',
  mood: 'clanky clockwork swing; gears ticking, steam hissing, pipes knocking in time',
  bpm: 118,
  beatsPerBar: 4,
  stepsPerBeat: 3,
  key: 'G',
  scale: 'dorian',
  loop: true,
  instruments: {
    bass: inst(PLUCK_BASS, { gain: 0.34, env: { a: 0.004, d: 0.3, s: 0.35, r: 0.06 } }),
    pad: inst(ORGAN, { gain: 0.05, gate: 0.9 }),
    arp: inst(MARIMBA, { gain: 0.17, pan: 0.35 }),
    lead: inst(REED, { gain: 0.14, pan: -0.2, filter: { type: 'lowpass', cutoff: 1600, q: 1.4 } }),
    drums: {
      kick: { kind: 'kick', pitch: 55, decay: 0.22, tone: 0.35, gain: 0.85 },
      snare: { kind: 'clap', pitch: 1400, decay: 0.1, gain: 0.55 },
      hat: { kind: 'hat', pitch: 9500, decay: 0.07, gain: 0.55, pan: 0.3 },
      perc: { kind: 'clank', pitch: 360, decay: 0.14, gain: 0.45, pan: -0.4 },
      gain: 0.6,
      delay: 0.1,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: WALK_A,
      pad: bars(...PROG_A.map((c) => PADS[c])),
      arp: bars(...PROG_A.map((c) => GEARS[c])),
      lead: LEAD_A,
      drums: DRUMS,
    },
    {
      name: 'B',
      bars: 8,
      bass: WALK_B,
      pad: bars(...PROG_B.map((c) => PADS[c])),
      arp: bars(...PROG_B.map((c) => GEARS[c])),
      lead: LEAD_B,
      drums: { ...DRUMS, kick: 'x.....x..x..' },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.12, feedback: 0.3, wet: 0.18, damp: 3200 },
};

export default [works];
