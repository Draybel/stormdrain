/**
 * The Mushroom Hollow (chapter 4, main track, floors 7-8): spores, glowcaps, beetles.
 * Clearings ringed by mushrooms (rocks), glowcaps are tinted rocks, beetle burrows are pits.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['mushroom_hollow'] as const;

const rooms: RoomTemplate[] = [
  {
    // A fairy ring with one glowing cap; don't dance inside it.
    id: 'hollow.normal.fairy_ring',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.e..$#.##....',
      '...#.....#...',
      '...#.e.e.#...',
      '...#.....#...',
      '....##.##..e.',
      '.............',
    ],
  },
  {
    // Two small rings side by side; a glowcap grows in the middle of one.
    id: 'hollow.normal.twin_rings',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..#.#...#e#..',
      '.#...#.#...#.',
      '...$..E..e...',
      '.#...#.#...#.',
      '..#e#...#.#..',
      '.............',
    ],
  },
  {
    // A loose grove of tall mushrooms, two of them glowing.
    id: 'hollow.normal.glowcap_grove',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '..#..........',
      '..#......$.e.',
      '....E....#...',
      '.......#.....',
      '...$...#..e..',
      '.e.#.........',
      '.........#...',
    ],
  },
  {
    // A great spore circle with a heart of caps; its keeper sits right in the middle.
    id: 'hollow.normal.spore_circle',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      'E............',
      '..#.##.##.#..',
      '.#.e.....e.#.',
      '.....$E#.....',
      '.#.e.....e.#.',
      '..#.##.##.#..',
      '.............',
    ],
  },
  {
    // Beetle burrows in pairs between the stalks; the big ones guard the top.
    id: 'hollow.normal.beetle_burrows',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '..E.#...#.E..',
      '.OO.......OO.',
      '....e.O.e....',
      '.OO.......OO.',
      '..e.#...#.e..',
      '.............',
    ],
  },
];

export default rooms;
