/**
 * Rain Barrel Arena (challenge) variants for every chapter: waves spawn on the e/E markers,
 * the reward (i/c) sits in the middle.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup  i item pedestal.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  {
    // Four pens in the corners; each wave climbs out of them toward the prize.
    id: 'special.challenge.corner_pens',
    chapters: ALL,
    type: 'challenge',
    difficulty: 2,
    grid: [
      '.............',
      '.e.#.....#.e.',
      '.###.....###.',
      '......i......',
      '.###.....###.',
      '.E.#.....#.e.',
      '.............',
    ],
  },
  {
    // The prize on a moated island with two narrow ways in; hold the bridges.
    id: 'special.challenge.moat_ring',
    chapters: ALL,
    type: 'challenge',
    difficulty: 3,
    grid: [
      '...e.........',
      '..e.......e..',
      '....OO.OO....',
      '...O..i..O...',
      '....OO.OO....',
      '..E.......E..',
      '.........e...',
    ],
  },
];

export default rooms;
