/**
 * The Candlewick Crypt (chapter 2, alt track, floors 3-4): wax, candles, moths.
 * Candles are fires (solid, they singe on touch), tombs are metal, pews are crates, wax pools are pits.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['candlewick_crypt'] as const;

const rooms: RoomTemplate[] = [
  {
    // Rows of pews with a candle burning at every corner.
    id: 'crypt.normal.candle_pews',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.f.........f.',
      '...xxx.xxx...',
      '...e..e..e...',
      '...xxx.xxx...',
      '.f.........f.',
      '.............',
    ],
  },
  {
    // Six stone coffins, lids firmly shut. Mostly.
    id: 'crypt.normal.sarcophagi',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..MM.....MM..',
      '....e........',
      '..MM..e..MM..',
      '........e....',
      '..MM.....MM..',
      '.............',
    ],
  },
  {
    // Two pools of melted wax, still warm, lit from the corners.
    id: 'crypt.normal.wax_pools',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.f..e...e..f.',
      '...OO...OO...',
      '...OO.E.OO...',
      '...OO...OO...',
      '.f..e...e..f.',
      '.............',
    ],
  },
  {
    // A cross-shaped altar with two tall candles at its foot.
    id: 'crypt.normal.altar',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..f.......f..',
      '....e.M.e....',
      '...e.MMM.E...',
      '....f.M.f....',
      '.............',
      '.............',
    ],
  },
  {
    // Burial niches along both walls; every one of them is occupied.
    id: 'crypt.normal.niches',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '#e#e#...#e#e#',
      '.............',
      '...f.....f...',
      '.....^.^.....',
      '...f.....f...',
      '.............',
      '#E#.#...#.#E#',
    ],
  },
];

export default rooms;
