/**
 * The Grinding Works (chapter 3, main track, floors 5-6): clockwork sewer, gears, steam.
 * Metal-block machinery with spike plates; gears and pistons are metal, belts carry spikes.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['grinding_works'] as const;

const rooms: RoomTemplate[] = [
  {
    // One enormous cogwheel bolted to the floor.
    id: 'works.normal.cogwheel',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..e..M.M..e..',
      '....MMMMM....',
      '...MMMMMMM...',
      '....MMMMM....',
      '..e..M.M..e..',
      '.............',
    ],
  },
  {
    // A spiked conveyor belt between two housings; cross at the gap.
    id: 'works.normal.conveyor',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.MMMM...MMMM.',
      '...e.....e...',
      '...^^^.^^^...',
      '...e.....E...',
      '.MMMM...MMMM.',
      '.............',
    ],
  },
  {
    // Pistons stamping from the walls onto two spike plates.
    id: 'works.normal.pistons',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '..M.......M..',
      '..M.......M..',
      '..M..e.e..M..',
      '....^.E.^....',
      '....M...M....',
      '.e..M...M..e.',
      '....M...M....',
    ],
  },
  {
    // A switchyard of iron blocks with spiked dead ends.
    id: 'works.normal.switchyard',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.MM.MM.MM.MM.',
      '.M..^M.M^..M.',
      '...e..E..e...',
      '.M..^M.M^..M.',
      '.MM.MM.MM.MM.',
      '.............',
    ],
  },
  {
    // The crusher: an iron box lined with spike plates, and something waiting inside.
    id: 'works.normal.crusher',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E.MM...MM.E.',
      '...M^^.^^M...',
      '...M.e.e.M...',
      '...M^^.^^M...',
      '.e.MM...MM.e.',
      '.............',
    ],
  },
];

export default rooms;
