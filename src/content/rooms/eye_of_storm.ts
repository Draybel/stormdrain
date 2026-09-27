/**
 * The Eye of the Storm (chapter 6, main track, floors 11-12): clouds, lightning, wind.
 * Wide-open arenas; gaps in the cloud floor are pits (islands of sky), lightning rods are metal.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['eye_of_storm'] as const;

const rooms: RoomTemplate[] = [
  {
    // Open sky with four small holes torn in the clouds.
    id: 'storm.normal.cloudbreak',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..OO.....OO..',
      '.....e.e.....',
      '.............',
      '.....e.E.....',
      '..OO.....OO..',
      '.............',
    ],
  },
  {
    // The eye wall: a ring of open sky around the calm centre.
    id: 'storm.normal.eye_wall',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      'e...........e',
      '...OOO.OOO...',
      '..O.......O..',
      '..O.e.E.e.O..',
      '..O.......O..',
      '...OOO.OOO...',
      'e...........e',
    ],
  },
  {
    // Gale lanes: long rifts in the clouds with narrow crossings.
    id: 'storm.normal.gale_lanes',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E.........E.',
      'OOOO.OOO.OOOO',
      '...e..e..e...',
      'OOOO.OOO.OOOO',
      '.e.........e.',
      '.............',
    ],
  },
  {
    // Lightning rods between drifting holes; stay off the open ground if you can.
    id: 'storm.normal.lightning_rods',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.M..O...O..M.',
      '...e..M..e...',
      '..O.E...E.O..',
      '...e..M..e...',
      '.M..O...O..M.',
      '.............',
    ],
  },
  {
    // Skyholes: a scatter of gaps and a whirl of foes around the middle.
    id: 'storm.normal.skyholes',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.O...O.O...O.',
      '..eO.....Oe..',
      '.....OEO.....',
      '..eO.....Oe..',
      '.O...O.O...O.',
      '.........E...',
    ],
  },
];

export default rooms;
