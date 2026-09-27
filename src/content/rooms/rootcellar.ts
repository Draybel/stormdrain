/**
 * The Rootcellar (chapter 2, main track, floors 3-4): roots, jars, pickles, moles.
 * Jar shelves and pickle barrels are urns and crates, roots are rocks, mole holes are pits.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['rootcellar'] as const;

const rooms: RoomTemplate[] = [
  {
    // Pantry shelves crowded with jars and one stubborn crate in the aisle.
    id: 'cellar.normal.pantry',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..uxu...uxu..',
      '.............',
      '...e..x..e...',
      '........e....',
      '..uux...xuu..',
      '.............',
    ],
  },
  {
    // Somebody has been digging: holes and dirt mounds everywhere.
    id: 'cellar.normal.mole_holes',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..O..#...O...',
      '.......e...#.',
      '...e..O......',
      '.#.......O...',
      '...O...#..e..',
      '.............',
    ],
  },
  {
    // Two root systems: one hanging from the ceiling, one pushing up through the floor.
    id: 'cellar.normal.root_tangle',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '..#..........',
      '.e##.#.......',
      '...###...e...',
      '....#.E.#....',
      '...e...###...',
      '.......#.##..',
      '..........#..',
    ],
  },
  {
    // Pickle barrels stacked in the corners, crates of preserves in the middle.
    id: 'cellar.normal.pickle_barrels',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.uu.e...E.uu.',
      '.ux.......xu.',
      '.....xxx.....',
      '.ux.......xu.',
      '.uu.e...e.uu.',
      '.............',
    ],
  },
  {
    // A mole warren: three tunnels joined by narrow gaps in the packed earth.
    id: 'cellar.normal.burrow_warren',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.e.#.....#.e.',
      '.###.###.###.',
      '.....e.e.....',
      '.###.###.###.',
      '.E.#.....#.E.',
      '.............',
    ],
  },
];

export default rooms;
