/**
 * Boss and miniboss arena variants for every chapter: the boss spawns in the centre with a clear
 * 5×5 fighting area around it, and there is some cover near the walls (no hazards).
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  x crate  B boss spawn.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  {
    // Stone bulwarks in the four corners to duck behind.
    id: 'special.boss.bulwarks',
    chapters: ALL,
    type: 'boss',
    difficulty: 1,
    grid: [
      '.............',
      '.##.......##.',
      '.#.........#.',
      '......B......',
      '.#.........#.',
      '.##.......##.',
      '.............',
    ],
  },
  {
    // Crate barricades: good cover that the fight slowly chews away.
    id: 'special.boss.crate_barricade',
    chapters: ALL,
    type: 'boss',
    difficulty: 2,
    grid: [
      '.............',
      '..xx.....xx..',
      '.x.........x.',
      '......B......',
      '.x.........x.',
      '..xx.....xx..',
      '.............',
    ],
  },
  {
    // Flooded corners: the room is smaller than it looks, with two stones for cover.
    id: 'special.boss.flooded_corners',
    chapters: ALL,
    type: 'boss',
    difficulty: 3,
    grid: [
      'OO.........OO',
      'O...........O',
      '...#.....#...',
      '......B......',
      '...#.....#...',
      'O...........O',
      'OO.........OO',
    ],
  },
  {
    // Standing stones in a loose ring around a middling menace.
    id: 'special.miniboss.standing_stones',
    chapters: ALL,
    type: 'miniboss',
    difficulty: 2,
    grid: [
      '.............',
      '...#.....#...',
      '.#.........#.',
      '......B......',
      '.#.........#.',
      '...#.....#...',
      '.............',
    ],
  },
];

export default rooms;
