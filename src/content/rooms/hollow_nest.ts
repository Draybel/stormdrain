/**
 * The Hollow Nest (chapter 6, alt track, floors 11-12): wasp paper, amber, larvae.
 * Paper comb walls are crates (shoot your own shortcuts), amber is tinted rock, brood cells are pits.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['hollow_nest'] as const;

const rooms: RoomTemplate[] = [
  {
    // Rows of papery comb, one cell sealed with amber.
    id: 'nest.normal.paper_comb',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.xx.xx.xx.xx.',
      '..e......e...',
      '...xx.E.$x...',
      '...e......e..',
      '.xx.xx.xx.xx.',
      '.............',
    ],
  },
  {
    // Four amber cells, each with a larva that has just woken up.
    id: 'nest.normal.amber_cells',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.#$#.....###.',
      '.#e#.....#e#.',
      '.............',
      '....e.E.e....',
      '.............',
      '.#e#.....#e#.',
      '.###.....#$#.',
    ],
  },
  {
    // The brood chamber: paper walls in close rows and nurses on patrol.
    id: 'nest.normal.brood_chamber',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '..x.......x..',
      '.x.e.x.x.e.x.',
      '..x..x.x..x..',
      '...e.xex.e...',
      '..x..x.x..x..',
      '.x.E.x.x.E.x.',
      '..x.......x..',
    ],
  },
  {
    // Paper tunnels: a chamber inside a chamber, open toward every door.
    id: 'nest.normal.paper_tunnels',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '...e.....e...',
      '.xxxxx.xxxxx.',
      '.x.........x.',
      '...xE...Ex...',
      '.x.........x.',
      '.xxxxx.xxxxx.',
      '...e.....e...',
    ],
  },
  {
    // The queen's hall: pillars of old comb and brood cells along the aisle.
    id: 'nest.normal.queens_hall',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E.O.$.#.O.E.',
      '...O.....O...',
      '.....e.e.....',
      '...O.....O...',
      '.e.O.#.#.O.e.',
      '.............',
    ],
  },
];

export default rooms;
