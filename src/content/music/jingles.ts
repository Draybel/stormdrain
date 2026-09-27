/**
 * One-shots: jingles (a few seconds) and stingers (under six seconds). Play them with
 * `audio.music.stinger(id, ...)` — see docs/audio.md.
 *
 * - jingle_victory   "Clear Skies": the STORMDRAIN motif, finally in D major.
 * - jingle_gameover  "Washed Away": a slow chromatic sink back to D minor.
 * - sting_floor      "Down the Drain": a falling glass arpeggio into the next floor.
 * - sting_boss_intro "Something Stirs": dun, dun, DUN — hand off to the boss theme with `then`.
 * - sting_item       "Treasure!": a quick rising sparkle for item pedestals.
 */

import { bars, inst } from '../../audio/music/compose';
import {
  BELL_LEAD,
  CHOIR,
  FUZZ_BASS,
  GLASS,
  HARP,
  MUSIC_BOX,
  SAW_LEAD,
  STRINGS,
  SUB_BASS,
} from '../../audio/music/instruments';
import type { MusicTrack } from '../../audio/music/types';

const victory: MusicTrack = {
  id: 'jingle_victory',
  gain: 0.84,
  name: 'Clear Skies',
  kind: 'jingle',
  mood: 'the rain stops; sunlight through the grate',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'major',
  loop: false,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.5 }),
    pad: inst(STRINGS, { gain: 0.08 }),
    arp: inst(HARP, { gain: 0.2, pan: 0.3 }),
    lead: inst(SAW_LEAD, { gain: 0.13, filter: { type: 'lowpass', cutoff: 2600, q: 1 } }),
    drums: {
      kick: { kind: 'kick', pitch: 55, decay: 0.3, tone: 0.3 },
      snare: { kind: 'tom', pitch: 90, decay: 0.5, gain: 0.8 },
      perc: { kind: 'cymbal', decay: 1.6, gain: 0.5, pan: 0.2 },
      gain: 0.6,
      delay: 0.2,
    },
  },
  sections: [
    {
      name: 'fanfare',
      bars: 4,
      lead: bars("5:3 1':5 7:2 6:2 5:4", '3:4 4:4 5:4 6:4', "7:4 2':4 5':8", "1':12 .:4"),
      pad: bars('1+3+5:16', '1+4+6:16', '7,+2+5:16', '1+3+5:12 .:4'),
      bass: bars('1:8 5,:8', '4:16', '5:16', '1:12 .:4'),
      arp: bars(
        "1 3 5 1' 3 5 1' 3' 5 1' 3' 5' 1' 3' 5' 1''",
        "4 6 1' 4' 6 1' 4' 6' 1' 4' 6' 1'' 4' 6' 1'' 4''",
        "5 7 2' 5' 7 2' 5' 7' 2' 5' 7' 2'' 5' 7' 2'' 5''",
        ".:16",
      ),
      drums: {
        kick: bars('x.......x.......', 'x.......x.......', 'x.......x.......', 'x...............'),
        snare: bars('x...............', '................', 'x.x.x.x.x.x.xxxx', 'X...............'),
        perc: bars('x...............', '................', '................', 'x...............'),
      },
    },
  ],
  song: ['fanfare'],
  room: { time: 0.3, feedback: 0.35, wet: 0.3 },
};

const gameOver: MusicTrack = {
  id: 'jingle_gameover',
  gain: 0.85,
  name: 'Washed Away',
  kind: 'jingle',
  mood: 'the lantern goes out; the drain gurgles',
  bpm: 76,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'minor',
  loop: false,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.45 }),
    pad: inst(CHOIR, { gain: 0.12 }),
    lead: inst(BELL_LEAD, { gain: 0.26, vibrato: { rate: 3, depth: 12 } }),
    arp: inst(MUSIC_BOX, { gain: 0.14, pan: 0.3, vibrato: { rate: 2, depth: 20 } }),
    drums: { kick: { kind: 'thump', pitch: 50, gain: 0.7 }, gain: 0.5, delay: 0.3 },
  },
  sections: [
    {
      name: 'fall',
      bars: 3,
      lead: bars('5:4 4#:4 4:4 3:4', '4:4 2:4 7#,:8', '1:12 .:4'),
      pad: bars('1+3+5:16', '6,+1+3:8 5,+7#,+2:8', '1+3+5:16'),
      bass: bars('1:16', '6,:8 5,:8', '1:16'),
      arp: bars('.:16', '.:16', "1'' . . . 5' . . . 3' . . . 1' . . ."),
      drums: { kick: bars('x...............', '................', 'x...............') },
    },
  ],
  song: ['fall'],
  room: { time: 0.4, feedback: 0.45, wet: 0.4, damp: 2000 },
};

const floorSting: MusicTrack = {
  id: 'sting_floor',
  gain: 1.06,
  name: 'Down the Drain',
  kind: 'sting',
  bpm: 120,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'D',
  scale: 'minor',
  loop: false,
  instruments: {
    bass: inst(SUB_BASS, { gain: 0.45, env: { a: 0.01, d: 0.6, s: 0.4, r: 0.6 } }),
    pad: inst(CHOIR, { gain: 0.12, env: { a: 0.15, d: 0.4, s: 0.8, r: 0.8 } }),
    arp: inst(GLASS, { gain: 0.16, pan: 0.25 }),
    drums: {
      kick: { kind: 'thump', pitch: 45, decay: 0.4, gain: 0.8 },
      perc: { kind: 'cymbal', decay: 1.2, gain: 0.3 },
      gain: 0.55,
      delay: 0.3,
    },
  },
  sections: [
    {
      name: 'drop',
      bars: 1,
      arp: "1'' 5' 3' 1' 5 3 1 5, .:8",
      pad: '1+5:16',
      bass: '1:16',
      drums: { kick: 'x.......x.......', perc: 'x...............' },
    },
  ],
  song: ['drop'],
  room: { time: 0.35, feedback: 0.45, wet: 0.35 },
};

const bossIntro: MusicTrack = {
  id: 'sting_boss_intro',
  gain: 1.08,
  name: 'Something Stirs',
  kind: 'sting',
  bpm: 90,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'C',
  scale: 'harmonicMinor',
  loop: false,
  instruments: {
    bass: inst(FUZZ_BASS, { gain: 0.32 }),
    pad: inst(CHOIR, { gain: 0.13, env: { a: 0.1, d: 0.4, s: 0.85, r: 0.5 } }),
    lead: inst(SAW_LEAD, { gain: 0.12, glide: 0.1 }),
    drums: {
      kick: { kind: 'kick', pitch: 45, decay: 0.4, tone: 0.5 },
      snare: { kind: 'tom', pitch: 70, decay: 0.6, gain: 0.9 },
      perc: { kind: 'cymbal', decay: 1.8, gain: 0.35 },
      gain: 0.62,
      delay: 0.15,
    },
  },
  sections: [
    {
      name: 'stir',
      bars: 2,
      bass: bars('1:2 .:2 1:2 .:2 2b:8', '1:16'),
      pad: bars('.:8 2b+4+6:8', '1+3+5:16'),
      lead: bars('.:16', '5:4 6:4 7:8'),
      drums: {
        kick: bars('x...x...x.......', 'x...............'),
        snare: bars('x...x...X.......', 'X...........x.x.'),
        perc: bars('................', 'x...............'),
      },
    },
  ],
  song: ['stir'],
  room: { time: 0.3, feedback: 0.4, wet: 0.3 },
};

const itemSting: MusicTrack = {
  id: 'sting_item',
  gain: 1.8,
  name: 'Treasure!',
  kind: 'sting',
  bpm: 150,
  beatsPerBar: 4,
  stepsPerBeat: 4,
  key: 'C',
  scale: 'major',
  loop: false,
  instruments: {
    arp: inst(GLASS, { gain: 0.24, pan: 0.25 }),
    lead: inst(BELL_LEAD, { gain: 0.36, pan: -0.15 }),
    pad: inst(STRINGS, { gain: 0.09, env: { a: 0.05, d: 0.3, s: 0.8, r: 0.6 } }),
    drums: { perc: { kind: 'bell', pitch: 2093, decay: 0.8, tone: 0.7, gain: 0.35 }, gain: 0.5, delay: 0.3 },
  },
  sections: [
    {
      name: 'shine',
      bars: 1,
      arp: "1 3 5 1' 3' 5' 1'' .:9",
      lead: ".:4 5:2 6:2 7:2 1':6",
      pad: '1+3+5:16',
      drums: { perc: '....x...........' },
    },
  ],
  song: ['shine'],
  room: { time: 0.25, feedback: 0.35, wet: 0.3 },
};

export default [victory, gameOver, floorSting, bossIntro, itemSting];
