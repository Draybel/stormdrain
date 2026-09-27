/**
 * The Gutterways (chapter 1, main track, floors 1-2): rainwater, grates, leaves, slugs.
 * Open drain channels and grates are pits, leaf drifts are crates and stones.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['gutterways'] as const;

const rooms: RoomTemplate[] = [
  {
    // Two open storm channels with a grate bridge down the middle.
    id: 'gutter.normal.culverts',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..e.......e..',
      'OOOOO...OOOOO',
      '.............',
      'OOOOO...OOOOO',
      '.........e...',
      '.............',
    ],
  },
  {
    // A pair of street grates: slots you can shoot across but not walk over.
    id: 'gutter.normal.grate_rows',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.e.O.O.O.O.e.',
      '...O.O.O.O...',
      '.............',
      '...O.O.O.O...',
      '.e.O.O.O.O.e.',
      '.............',
    ],
  },
  {
    // Soggy leaves and pebbles washed into a long diagonal drift.
    id: 'gutter.normal.leaf_drift',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.xx.......e..',
      '..x##........',
      '....e..##....',
      '........##x..',
      '..e.......xx.',
      '.............',
    ],
  },
  {
    // A round cistern with a big slug sulking on the dry middle.
    id: 'gutter.normal.cistern',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..e.......e..',
      '...OOO.OOO...',
      '...O..E..O...',
      '...OOO.OOO...',
      '..e.......e..',
      '.............',
    ],
  },
  {
    // A wide spillway: one plank bridge across, flyers don't care.
    id: 'gutter.normal.spillway',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..e......E...',
      '..OOOO.OOOO..',
      '..OOOO.OOOO..',
      '..OOOO.OOOO..',
      '...e......e..',
      '.............',
    ],
  },
];

export default rooms;
