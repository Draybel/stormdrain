/**
 * Chapter 1 (main) — The Gutterways: "Gutter Groove". E minor, 98 bpm, lightly swung 16ths.
 * Rubbery plucked bass, drips of delay, a muted square 'rain whistle' playing call-and-response.
 */

import { arp, bars, inst } from '../../audio/music/compose';
import { PLUCK, PLUCK_BASS, SQUARE_LEAD, WARM_PAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// Bass riffs, one bar each (E minor: 1=E 2=F# 3=G 4=A 5=B 6=C 7=D).
const B_EM = "1 - . 1' . 1 . 5, 7, - 1 - . 3 . 4";
const B_AM = "4 - . 4' . 4 . 1 3 - 4 - . 6 . 7";
const B_C = '6, - . 6 . 6, . 3, 1 - 6, - . 3 . 5,';
const B_B7 = '5, - . 5 . 5, . 7#, 2 - 5, - . 4 . 7#,';
const B_D = '7, - . 7 . 7, . 4, 7, - 7, - . 2 . 4';

// Pads (octave 3).
const P_EM = '1+3+5:16';
const P_AM = '1+4+6:16';
const P_C = '1+3+6:16';
const P_B7 = '7#,+2+4:16';
const P_D = '7,+2+4:16';

// Arp: drips in A (two plinks per bar), eighth-note arpeggios in B.
const D_EM = "  . . 5' . . . . . . . 1'' . . . . .";
const D_AM = "  . . 3' . . . . . . . 6' . . . . .";
const D_C = "   . . 5' . . . . . . . 3' . . . . .";
const D_B7 = "  . . 2'' . . . . . . . 7#' . . . . .";
const UPDOWN = [0, 1, 2, 3, 2, 1, 2, 3];
const A_EM = arp('1 3 5 7', UPDOWN, 2);
const A_AM = arp("4 6 1' 3'", UPDOWN, 2);
const A_C = arp('6, 1 3 5', UPDOWN, 2);
const A_D = arp('7, 2 4 6', UPDOWN, 2);
const A_B7 = arp('5, 7#, 2 4', UPDOWN, 2);

const LEAD_A = bars(
  "  . . 5 7   1' - 7 5   3 - - .   . . . .",
  "  . . . .   5 . 7 .    1' - - -  7 - 5 -",
  "  1' - - 7  6 - 4 -    3 - 4 -   . . . .",
  "  . . 6 7   1' - 3' -  2' - 1' 7 6 - - -",
  "  . . 5 7   1' - 7 5   3 - - .   . . . .",
  "  . . . .   5 . 7 .    1' - 3' - 2' - 1' -",
  "  3' - - 2' 1' - 7 -   6 - 5 -   3 - - -",
  "  2' - - -  7# - - -   2' - 4' - 3' - 2' -",
);
const LEAD_B = bars(
  "  1' - - -  - - . .    6 - 1' -  3' - - -",
  "  2' - 1' - 7 - 5 -    - - - -   . . . .",
  "  . . 1' -  3' - 4' -  3' - 1' - 6 - - -",
  "  7 - 5 -   3 - - -    5 - - -   - - . .",
  "  3' - - -  2' - 1' -  7 - - -   1' - - -",
  "  2' - - -  4' - - -   2' - 1' - 7 - 6 -",
  "  7# - - -  2' - - -   4' - - -  - - - -",
  "  . . . .   5 - 6 -    7 - 7# -  . . . .",
);

const gutterways: MusicTrack = {
  id: 'ch_gutterways',
  gain: 1.8,
  name: 'Gutter Groove',
  kind: 'chapter',
  chapter: 'gutterways',
  mood: 'drippy minor-key groove; rainwater running under grates',
  bpm: 98,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  swing: 0.14,
  key: 'E',
  scale: 'minor',
  loop: true,
  instruments: {
    bass: inst(PLUCK_BASS, { gain: 0.36 }),
    pad: inst(WARM_PAD, { gain: 0.05 }),
    arp: inst(PLUCK, { gain: 0.16, pan: 0.35, delay: 0.5 }),
    lead: inst(SQUARE_LEAD, {
      gain: 0.14,
      pan: -0.15,
      filter: { type: 'lowpass', cutoff: 1800, q: 1 },
    }),
    drums: {
      kick: { kind: 'kick', pitch: 52, decay: 0.26, tone: 0.3 },
      snare: { kind: 'rim', pitch: 1500, gain: 0.7 },
      hat: { kind: 'shaker', gain: 0.5, pan: 0.25 },
      perc: { kind: 'drip', pitch: 780, gain: 0.55, pan: -0.4 },
      gain: 0.62,
      delay: 0.2,
    },
  },
  sections: [
    {
      name: 'A',
      bars: 8,
      bass: bars(B_EM, B_EM, B_AM, B_AM, B_EM, B_EM, B_C, B_B7),
      pad: bars(P_EM, P_EM, P_AM, P_AM, P_EM, P_EM, P_C, P_B7),
      arp: bars(D_EM, D_EM, D_AM, D_AM, D_EM, D_EM, D_C, D_B7),
      lead: LEAD_A,
      drums: {
        kick: 'x.....x...x..x..',
        snare: '....x..o....x..o',
        hat: 'x.o.x.o.x.o.x.oo',
        perc: bars('...........x....', '......x.........'),
      },
    },
    {
      name: 'B',
      bars: 8,
      bass: bars(B_AM, B_EM, B_AM, B_EM, B_C, B_D, B_B7, B_B7),
      pad: bars(P_AM, P_EM, P_AM, P_EM, P_C, P_D, P_B7, P_B7),
      arp: bars(A_AM, A_EM, A_AM, A_EM, A_C, A_D, A_B7, A_B7),
      lead: LEAD_B,
      drums: {
        kick: 'x.....x...x.x...',
        snare: '....x..o....x.o.',
        hat: 'x.o.x.o.x.o.x.o+',
        perc: bars('..x.............', '......x.....x...'),
      },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.31, feedback: 0.42, wet: 0.3, damp: 2600 },
};

export default [gutterways];
