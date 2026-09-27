/**
 * The Rust Foundry (chapter 3, alt track, floors 5-6): molten slag, furnaces.
 * Slag runs in pits, furnace mouths are fires set in metal, coal and ingots are crates and metal.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['rust_foundry'] as const;

const rooms: RoomTemplate[] = [
  {
    // A cooling runnel of slag cutting the floor in two, with one dry step across.
    id: 'foundry.normal.slag_runnel',
    chapters: CH,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.OO..........',
      '..OOO....e...',
      '....OO.......',
      '...e...OO....',
      '........OO...',
      '..e......OOO.',
      '..........OO.',
    ],
  },
  {
    // Four furnace mouths glowing in their iron housings; coal in the middle.
    id: 'foundry.normal.furnace_row',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.MfM....eMfM.',
      '.............',
      '...e.xEx.e...',
      '.............',
      '.MfMe....MfM.',
      '.............',
    ],
  },
  {
    // The great crucible: a slag pit in an iron cradle, fires stoked on both sides.
    id: 'foundry.normal.crucible',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..e.......e..',
      '....MOOOM....',
      '...fOOOOOf...',
      '....MOOOM....',
      '..e.......E..',
      '.............',
    ],
  },
  {
    // Stacks of fresh ingots and coal crates waiting for the carts.
    id: 'foundry.normal.ingot_stacks',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.MM.xx.xx.MM.',
      '.MMe......MM.',
      '....e.E.e....',
      '.xx......exx.',
      '.xx.MM.MM.xx.',
      '.............',
    ],
  },
  {
    // The pouring floor: slag moulds on both sides of a narrow catwalk.
    id: 'foundry.normal.pour_floor',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E..OO.OO..E.',
      '....OO.OO....',
      '...f.e.e.f...',
      '....OO.OO....',
      '.e..OO.OO..e.',
      '.............',
    ],
  },
];

export default rooms;
