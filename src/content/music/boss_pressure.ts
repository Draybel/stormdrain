/**
 * Boss theme 2 (chapters 3-4) — "Pressure". B minor in 7/8 (2+2+3), eighth = 280.
 * A lurching machine riff that shifts key by section (B → G → E → F#) like gears changing,
 * cross-rhythm chip arpeggios, and a squealing saw lead.
 */

import { bars, inst } from '../../audio/music/compose';
import { ACID_BASS, CHIP_ARP, DRONE, SAW_LEAD } from '../../audio/music/instruments';
import type { MusicTrack, Section } from '../../audio/music/types';

// B minor: 1=B 2=C# 3=D 4=E 5=F# 6=G 7=A. 14 sixteenths per bar, grouped 4+4+6.
const RIFF = bars(
  "1 - 1 1'  1 - 7, 1  3 - 2 - 7, -",
  "1 - 1 1'  1 - 7, 1  3 - 2 - 7, -",
  "1 - 1 1'  1 - 7, 1  3 - 2 - 7, -",
  "1 - 1 1'  1 - 7, 1  5, - 6, - 7, -",
);
const LEAD = bars(
  '5 - - 4  3 - 4 -  5 - - - 6 -',
  '5 - - -  3 - 1 -  2 - - - - -',
  "1' - - 7  6 - 7 -  1' - - - 3' -",
  "2' - - -  1' - 5 -  4 - - - - -",
);
const GEARS = '1 3 5 1 3 5 1 3 5 1 3 5 1 3';
const DRUMS = {
  kick: 'x...x...x..x..',
  snare: '..X...X.....X.',
  hat: 'xoxoxoxoxoxoxo',
  perc: 'x.............',
};

const sec = (name: string, transpose: number, lead: boolean): Section => ({
  name,
  bars: 4,
  transpose,
  bass: RIFF,
  pad: '1+5:14',
  arp: GEARS,
  ...(lead ? { lead: LEAD } : {}),
  drums: DRUMS,
});

const pressure: MusicTrack = {
  id: 'boss_pressure',
  gain: 2.1,
  name: 'Pressure',
  kind: 'boss',
  mood: 'mechanical and lopsided; pistons, valves and a boiler about to blow',
  bpm: 280,
  beatsPerBar: 7,
  stepsPerBeat: 2,
  key: 'B',
  scale: 'minor',
  loop: true,
  instruments: {
    bass: inst(ACID_BASS, { gain: 0.3, octave: 1 }),
    pad: inst(DRONE, { gain: 0.06, octave: 2 }),
    arp: inst(CHIP_ARP, { gain: 0.07, pan: 0.4 }),
    lead: inst(SAW_LEAD, { gain: 0.11, pan: -0.15 }),
    drums: {
      kick: { kind: 'kick', pitch: 50, decay: 0.2, tone: 0.6, gain: 1 },
      snare: { kind: 'snare', pitch: 220, decay: 0.12, tone: 0.7, gain: 0.65 },
      hat: { kind: 'hat', pitch: 10000, gain: 0.4, pan: 0.3 },
      perc: { kind: 'clank', pitch: 300, decay: 0.25, tone: 0.4, gain: 0.5, pan: -0.3 },
      gain: 0.6,
      delay: 0.08,
    },
  },
  sections: [sec('intro', 0, false), sec('b', 0, true), sec('g', -4, true), sec('e', 5, true), sec('fs', 7, true)],
  song: ['intro', 'b', 'g', 'e', 'fs'],
  room: { time: 0.16, feedback: 0.3, wet: 0.16, damp: 2800 },
};

export default [pressure];
