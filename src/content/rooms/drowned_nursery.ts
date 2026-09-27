/**
 * The Drowned Nursery (chapter 1, alt track, floors 1-2): soggy toys, music boxes.
 * Toy blocks and pens are crates, crib bars and music-box combs are metal, the bathtub is a pit.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['drowned_nursery'] as const;

const rooms: RoomTemplate[] = [
  {
    // Building blocks left in little leaning towers.
    id: 'nursery.normal.toy_blocks',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.xx......x.e.',
      '.x..e....xx..',
      '.............',
      '..xx....e..x.',
      '...x......xx.',
      '.............',
    ],
  },
  {
    // A crib with a soggy toy still inside; slip between the bars.
    id: 'nursery.normal.crib',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '...M.M.M.M...',
      '...M.....M...',
      '....e.p.e....',
      '...M.....M...',
      '...M.M.M.M.e.',
      '.............',
    ],
  },
  {
    // An overflowing bathtub in the middle of the room.
    id: 'nursery.normal.bathtub',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..e.......e..',
      '....OOOOO....',
      '...OOOOOOO...',
      '....OOOOO....',
      '.u.......e.u.',
      '.............',
    ],
  },
  {
    // A giant music box: comb teeth up top, the pinned drum below.
    id: 'nursery.normal.music_box',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.M.M.M.M.M.M.',
      '.MeM.....MeM.',
      '......E......',
      '....^^.^^....',
      '...e.....e...',
      '.............',
    ],
  },
  {
    // A playpen of stacked blocks; something big was put in time-out.
    id: 'nursery.normal.playpen',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.e.xxx.xxx.e.',
      '...x.....x...',
      '...x..E..x...',
      '...x.....x...',
      '.e.xxx.xxx...',
      '.............',
    ],
  },
];

export default rooms;
