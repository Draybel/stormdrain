/**
 * Hidey-Hole (secret) and Forgotten Pocket (deep secret) variants for every chapter.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  c chest  p pickup  i item pedestal.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  {
    // Lost and found: everything the rain carried off, piled up in a dry corner of the drains.
    id: 'special.secret.lost_and_found',
    chapters: ALL,
    type: 'secret',
    difficulty: 1,
    grid: [
      'u...........u',
      '..#.......#..',
      '.....p.p.....',
      '...u..c..u...',
      '.....p.p.....',
      '..#.......#..',
      'u...........u',
    ],
  },
  {
    // A reliquary behind two iron brackets: one keepsake and a few loose trinkets.
    id: 'special.deepsecret.reliquary',
    chapters: ALL,
    type: 'deepSecret',
    difficulty: 1,
    grid: [
      '.............',
      '..MMM...MMM..',
      '..M..p.p..M..',
      '......i......',
      '..M..p.p..M..',
      '..MMM...MMM..',
      '.............',
    ],
  },
];

export default rooms;
