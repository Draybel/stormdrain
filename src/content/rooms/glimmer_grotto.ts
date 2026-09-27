/**
 * The Glimmer Grotto (chapter 4, alt track, floors 7-8): crystals, echo bats.
 * Crystal columns are metal, loose crystals are tinted rocks, chasms are pits the bats fly over.
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup.
 * House rules (tests/content-rooms.test.ts): no spawn or hazard within 2 steps of a door front, the
 * tile after each door is safe floor, everything reachable without fire or spikes.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const CH = ['glimmer_grotto'] as const;

const rooms: RoomTemplate[] = [
  {
    // Crystal veins growing in from all four corners.
    id: 'grotto.normal.crystal_veins',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.M.........M.',
      '..M.......M..',
      '...$.e.e.M...',
      '.............',
      '...M.e.E.$...',
      '..M.......M..',
      '.M.........M.',
    ],
  },
  {
    // A cracked-open geode, sparkling inside.
    id: 'grotto.normal.geode',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      'e............',
      '...##...##...',
      '..#..$.$..#..',
      '..#..eEe..#..',
      '..#.......#..',
      '...##...##...',
      '............e',
    ],
  },
  {
    // Two chasms with crystal shards jutting out of the dark.
    id: 'grotto.normal.chasm',
    chapters: CH,
    type: 'normal',
    difficulty: 2,
    grid: [
      '..e..........',
      '.OOOO...OOOO.',
      '.OMOO...OOMO.',
      '...e..E..e...',
      '.OMOO...OOMO.',
      '.OOOO...OOOO.',
      '..........e..',
    ],
  },
  {
    // A hall of prism columns that bounces every sound around.
    id: 'grotto.normal.prism_hall',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.e...........',
      '..M.M...M.M..',
      '.....e.e.....',
      '..$.M.E.M.$..',
      '.....e.e.....',
      '..M.M...M.M..',
      '...........E.',
    ],
  },
  {
    // A round echo chamber; the bats hang in the corners.
    id: 'grotto.normal.echo_chamber',
    chapters: CH,
    type: 'normal',
    difficulty: 3,
    grid: [
      '###.......###',
      '##E........##',
      '#...e...e...#',
      '.....$.M.....',
      '#...e...e...#',
      '##........E##',
      '###.......###',
    ],
  },
];

export default rooms;
