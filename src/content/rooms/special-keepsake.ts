/**
 * Keepsake Room (treasure) variants for every chapter.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  c chest  p pickup  i item pedestal.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  {
    // A little shrine: the keepsake between four iron posts, two offering jars by the walls.
    id: 'special.treasure.shrine',
    chapters: ALL,
    type: 'treasure',
    difficulty: 1,
    grid: [
      '.............',
      '..u.......u..',
      '....M...M....',
      '......i......',
      '....M...M....',
      '..u.......u..',
      '.............',
    ],
  },
  {
    // Somebody packed the keepsake in crates; walk in from the top or bottom, or shoot a way in.
    id: 'special.treasure.crate_cache',
    chapters: ALL,
    type: 'treasure',
    difficulty: 1,
    grid: [
      '.............',
      '.x.........x.',
      '...xx...xx...',
      '...x..i..x...',
      '...xx...xx...',
      '.x.........x.',
      '.............',
    ],
  },
];

export default rooms;
