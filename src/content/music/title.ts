/**
 * Title theme — "Forty Days of Rain". D minor, 84 bpm, half-time.
 * Introduces the STORMDRAIN motif (A–D–C–Bb–A) that Eye of the Storm, Old Thunderhead,
 * The Undertow and the victory jingle quote. Music-box raindrops over a warm pad, flute lead.
 */

import { bars, inst } from '../../audio/music/compose';
import { FLUTE, MUSIC_BOX, SUB_BASS, WARM_PAD } from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

// Chords per bar — A: Dm Bb F C (x2), B: Gm Dm Bb A (x2).
const PAD_A = bars('1+3+5:16', '6,+1+3:16', '7,+3+5:16', '7,+2+4:16');
const PAD_B = bars('6,+1+4:16', '5,+1+3:16', '6,+1+3:16', '5,+7#,+2:16');

const BASS_A = bars('1:6 1:2 . . 5,:2 1:4', '6,:6 6,:2 . . 3:2 6,:4', '3:6 3:2 . . 7,:2 3:4', '7,:6 7,:2 . . 4:2 7,:4');
const BASS_B = bars('4:6 4:2 . . 1:2 4:4', '1:6 1:2 . . 5,:2 1:4', '6,:6 6,:2 . . 3:2 6,:4', '5,:6 5,:2 . . 2:2 5,:4');

const ARP_A = bars(
  "1:2 5:2 1':2 3':2 5':2 3':2 1':2 5:2",
  "6,:2 3:2 6:2 1':2 3':2 1':2 6:2 3:2",
  "3:2 5:2 7:2 3':2 5':2 3':2 7:2 5:2",
  "7,:2 4:2 7:2 2':2 4':2 2':2 7:2 4:2",
);
const ARP_B = bars(
  "4:2 6:2 1':2 4':2 6':2 4':2 1':2 6:2",
  "1:2 3:2 5:2 1':2 3':2 1':2 5:2 3:2",
  "6,:2 3:2 6:2 1':2 3':2 1':2 6:2 3:2",
  '5,:2 7#,:2 2:2 5:2 7#:2 5:2 2:2 7#,:2',
);

const LEAD_A = bars(
  "5:3 1':5 7:2 6:2 5:4",
  '3:6 4:2 5:2 6:6',
  '5:4 7:4 5:2 4:2 3:4',
  '2:8 . . 7,:2 1:4',
  "5:3 1':5 2':2 3':2 2':4",
  "1':6 7:2 6:2 5:6",
  '3:4 5:4 7:4 6:2 5:2',
  '7,:2 1:2 2:12',
);
const LEAD_B = bars(
  "1':6 6:2 4:8",
  "3':4 2':4 1':4 5:4",
  "6:6 1':2 3':8",
  "2':6 1':2 7#:8",
  "1':4 6:4 4:4 6:4",
  '5:6 6:2 5:4 3:4',
  '4:4 3:4 1:4 3:4',
  '2:6 1:2 7#,:8',
);

const SHAKER = '..x...x...x...x.';
const DRIPS = bars('.....x..........', '..........x..x..');

const title: MusicTrack = {
  id: 'title',
  gain: 0.81,
  name: 'Forty Days of Rain',
  kind: 'title',
  mood: 'melancholy but hopeful; rain on a window, a lantern in the dark',
  bpm: 84,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'minor',
  loop: true,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.5 }),
    pad: inst(WARM_PAD, { gain: 0.075 }),
    arp: inst(MUSIC_BOX, { gain: 0.15, pan: 0.3, delay: 0.35 }),
    lead: inst(FLUTE, { gain: 0.28, pan: -0.12 }),
    drums: {
      kick: { kind: 'kick', pitch: 50, decay: 0.3, tone: 0.2, gain: 0.8 },
      snare: { kind: 'snare', pitch: 180, decay: 0.18, tone: 0.3, gain: 0.45 },
      hat: { kind: 'shaker', gain: 0.45, pan: 0.2 },
      perc: { kind: 'drip', pitch: 900, gain: 0.5, pan: -0.35 },
      gain: 0.6,
      delay: 0.25,
    },
  },
  sections: [
    { name: 'A', bars: 8, pad: PAD_A, bass: BASS_A, arp: ARP_A, lead: LEAD_A, drums: { hat: SHAKER, perc: DRIPS } },
    {
      name: 'B',
      bars: 8,
      pad: PAD_B,
      bass: BASS_B,
      arp: ARP_B,
      lead: LEAD_B,
      drums: { kick: 'x.........x.....', snare: '........x.......', hat: SHAKER, perc: DRIPS },
    },
  ],
  song: ['A', 'B'],
  room: { time: 0.32, feedback: 0.38, wet: 0.32 },
};

export default [title];
