/**
 * The Bone Orchard (chapter 5, main track, floors 9-10): bone trees, crows, lanterns.
 * Bone trees are rocks, headstones are metal, lanterns are fires, open graves are pits,
 * bramble hedges are spikes.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['bone_orchard'] as const;

const rooms: RoomTemplate[] = [
  {
    // Neat rows of bone trees; one still bears a golden fruit.
    id: 'orchard.normal.tree_rows',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..#.#...#.#..',
      '...e.....e...',
      '..#.#.E.#.#..',
      '...e.....e...',
      '..#.#...#.$..',
      '.............',
    ],
  },
  {
    // Crooked headstones and a single funeral urn.
    id: 'orchard.normal.graveyard',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.M..M...M..M.',
      '...e.....E...',
      '...M..u..M...',
      '..e.......e..',
      '.M..M...M..M.',
      '.............',
    ],
  },
  {
    // The lantern walk: a lit path through the trees, watched from the branches.
    id: 'orchard.normal.lantern_walk',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.#E.#...#.E#.',
      '...f..#..f...',
      '....e...e....',
      '...f..#..f...',
      '.#e.#...#.e#.',
      '.............',
    ],
  },
  {
    // The crows' roost: one huge bone tree between four open graves.
    id: 'orchard.normal.crow_roost',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E..O...O..E.',
      '.....#$#.....',
      '...e#####e...',
      '.....#.#.....',
      '.e..O...O..e.',
      '.............',
    ],
  },
  {
    // Two bramble hedges split the orchard; go round them, not through.
    id: 'orchard.normal.bramble_hedge',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.e..^...^..e.',
      '....^.#.^....',
      '..#.^.e.^.#..',
      '....^.#.^....',
      '.E..^...^..E.',
      '.............',
    ],
  },
];

export default rooms;
