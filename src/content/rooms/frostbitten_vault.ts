/**
 * The Frostbitten Vault (chapter 5, alt track, floors 9-10): ice, frozen treasure.
 * Symmetrical vaults: strongroom walls are metal, icicles are spikes, frozen crates are crates,
 * holes in the ice are pits.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['frostbitten_vault'] as const;

const rooms: RoomTemplate[] = [
  {
    // A strongroom with iron alcoves in all four corners.
    id: 'vault.normal.strongroom',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.MMM.....MMM.',
      '.M..e...e..M.',
      '......x......',
      '.M..e...e..M.',
      '.MMM.....MMM.',
      '.............',
    ],
  },
  {
    // Icicles hanging from the ceiling and pushing up from the floor.
    id: 'vault.normal.icicle_hall',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.^.^.....^.^.',
      '.............',
      '...e.....e...',
      '.....M.M.....',
      '...e.....E...',
      '.............',
      '.^.^.....^.^.',
    ],
  },
  {
    // A chest frozen in the vault's heart, with guards on every side.
    id: 'vault.normal.frozen_hoard',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E..MM.MM..E.',
      '....M...M....',
      '...eM.c.Me...',
      '....M...M....',
      '.e..MM.MM..e.',
      '.............',
    ],
  },
  {
    // Cold storage: crates stacked in perfect mirror order around an ice pillar.
    id: 'vault.normal.cold_storage',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.xx.x...x.xx.',
      '.x.e.....e.x.',
      '....E.M.E....',
      '.x.e.....e.x.',
      '.xx.x...x.xx.',
      '.............',
    ],
  },
  {
    // The deep freeze: a ring of thin ice around one very cold customer.
    id: 'vault.normal.deep_freeze',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '..e.OO.OO.e..',
      '....O...O....',
      '..M.O.E.O.M..',
      '....O...O....',
      '..e.OO.OO.e..',
      '.............',
    ],
  },
];

export default rooms;
