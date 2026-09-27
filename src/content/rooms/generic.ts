/**
 * Generic room layouts that fit every chapter (chapters ['*']).
 * Legend (ARCHITECTURE §5): . floor  # rock  $ tinted rock  M metal  O pit  ^ spikes  f fire
 * x crate  u urn  e enemy  E elite  c chest  p pickup  i item pedestal  S shop slot  B boss.
 * Rules (validateTemplate): 13×7; the tile inside each door (6,0) (12,3) (6,6) (0,3) is '.';
 * no enemy next to a door; every walkable tile reachable on foot; doors linked by a hazard-free path.
 */

import type { RoomTemplate } from '../../sim/floor/types';

const ALL = ['*'] as const;

const rooms: RoomTemplate[] = [
  // ── Start ──────────────────────────────────────────────────────────────
  {
    id: 'gen.start.corners',
    chapters: ALL,
    type: 'start',
    difficulty: 1,
    grid: [
      '#...........#',
      '.............',
      '.............',
      '.............',
      '.............',
      '.............',
      '#...........#',
    ],
  },

  // ── Normal, difficulty 1 ───────────────────────────────────────────────
  {
    id: 'gen.normal.stones',
    chapters: ALL,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '..#.......#..',
      '....e...e....',
      '.............',
      '......e......',
      '..#.......#..',
      '.............',
    ],
  },
  {
    id: 'gen.normal.sinkhole',
    chapters: ALL,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.....OOO.....',
      '..e..OOO..e..',
      '.............',
      '..u..OOO..u..',
      '.....OOO.....',
      '.............',
    ],
  },
  {
    id: 'gen.normal.crates',
    chapters: ALL,
    type: 'normal',
    difficulty: 1,
    grid: [
      '.............',
      '.xx.......xx.',
      '.x...e.e...x.',
      '.............',
      '.x..e...e..x.',
      '.xx.......xx.',
      '.............',
    ],
  },
  {
    id: 'gen.normal.urngarden',
    chapters: ALL,
    type: 'normal',
    difficulty: 1,
    grid: [
      'u...........u',
      '.............',
      '...#..$..#...',
      '..e.......e..',
      '...#.....#...',
      '.............',
      'u...........u',
    ],
  },

  // ── Normal, difficulty 2 ───────────────────────────────────────────────
  {
    id: 'gen.normal.spikelanes',
    chapters: ALL,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.^^^^...^^^^.',
      '...e.....e...',
      '.............',
      '...e.....e...',
      '.^^^^...^^^^.',
      '.............',
    ],
  },
  {
    id: 'gen.normal.braziers',
    chapters: ALL,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '..f...#...f..',
      '.....e.e.....',
      '...#.....#...',
      '.....e.e.....',
      '..f...#...f..',
      '.............',
    ],
  },
  {
    id: 'gen.normal.cellar',
    chapters: ALL,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.#$#.....#$#.',
      '.#.........#.',
      '.....E.......',
      '.#.........#.',
      '.#$#.e.e.#$#.',
      '.............',
    ],
  },
  {
    id: 'gen.normal.ironcross',
    chapters: ALL,
    type: 'normal',
    difficulty: 2,
    grid: [
      '.............',
      '.....M.M.....',
      '..e..M.M..e..',
      '.MMM.....MMM.',
      '..e..M.M..e..',
      '.....M.M.....',
      '.............',
    ],
  },

  // ── Normal, difficulty 3 ───────────────────────────────────────────────
  {
    id: 'gen.normal.gauntlet',
    chapters: ALL,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.E..^^.^^..E.',
      '...#.....#...',
      '..e..fff..e..',
      '...#.....#...',
      '.E..^^.^^..E.',
      '.............',
    ],
  },
  {
    id: 'gen.normal.bridges',
    chapters: ALL,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.OOOO...OOOO.',
      '.O..e...e..O.',
      '...E.....E...',
      '.O..e...e..O.',
      '.OOOO...OOOO.',
      '.............',
    ],
  },
  {
    id: 'gen.normal.furnace',
    chapters: ALL,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.x.........x.',
      '.x.f.$.$.f.x.',
      '....e...e....',
      '..E...M...E..',
      '....e...e....',
      '.x.f.$.$.f.x.',
      '.x.........x.',
    ],
  },
  {
    id: 'gen.normal.urnhall',
    chapters: ALL,
    type: 'normal',
    difficulty: 3,
    grid: [
      '.............',
      '.u.u.u.u.u.u.',
      '...E.....E...',
      '..^^^...^^^..',
      '...e.....e...',
      '.u.u.u.u.u.u.',
      '.............',
    ],
  },

  // ── Keepsake Room (treasure) ───────────────────────────────────────────
  {
    id: 'gen.treasure.plinth',
    chapters: ALL,
    type: 'treasure',
    difficulty: 1,
    grid: [
      '.............',
      '.............',
      '.....#.#.....',
      '......i......',
      '.....#.#.....',
      '.............',
      '.............',
    ],
  },
  {
    id: 'gen.treasure.moat',
    chapters: ALL,
    type: 'treasure',
    difficulty: 1,
    grid: [
      '.............',
      '....OOOOO....',
      '....O...O....',
      '......i......',
      '....O...O....',
      '....OOOOO....',
      '.............',
    ],
  },

  // ── Magpie's Stall (shop) ──────────────────────────────────────────────
  {
    id: 'gen.shop.stall',
    chapters: ALL,
    type: 'shop',
    difficulty: 1,
    grid: [
      '.............',
      '.............',
      '...S..S..S...',
      '.............',
      '....S...S....',
      '.............',
      '.............',
    ],
  },

  // ── Boss & miniboss ────────────────────────────────────────────────────
  {
    id: 'gen.boss.pillars',
    chapters: ALL,
    type: 'boss',
    difficulty: 2,
    grid: [
      '.............',
      '..#.......#..',
      '.............',
      '......B......',
      '.............',
      '..#.......#..',
      '.............',
    ],
  },
  {
    id: 'gen.boss.open',
    chapters: ALL,
    type: 'boss',
    difficulty: 2,
    grid: [
      '.............',
      '.............',
      '.............',
      '......B......',
      '.............',
      '.............',
      '.............',
    ],
  },
  {
    id: 'gen.miniboss.drains',
    chapters: ALL,
    type: 'miniboss',
    difficulty: 2,
    grid: [
      '.............',
      '.O.........O.',
      '.............',
      '......B......',
      '.............',
      '.O.........O.',
      '.............',
    ],
  },

  // ── Hidey-Hole (secret) & Forgotten Pocket (deep secret) ───────────────
  {
    id: 'gen.secret.stash',
    chapters: ALL,
    type: 'secret',
    difficulty: 1,
    grid: [
      '.............',
      '.............',
      '....p...p....',
      '......c......',
      '....p...p....',
      '.............',
      '.............',
    ],
  },
  {
    id: 'gen.secret.hoard',
    chapters: ALL,
    type: 'secret',
    difficulty: 1,
    grid: [
      '$u.........u$',
      'u...........u',
      '.....p.p.....',
      '.............',
      '.....p.p.....',
      'u...........u',
      '$u.........u$',
    ],
  },
  {
    id: 'gen.deepsecret.pocket',
    chapters: ALL,
    type: 'deepSecret',
    difficulty: 1,
    grid: [
      '.............',
      '..M.......M..',
      '.............',
      '....c.i.c....',
      '.............',
      '..M.......M..',
      '.............',
    ],
  },

  // ── Rain Barrel Arena (challenge) ──────────────────────────────────────
  {
    id: 'gen.challenge.barrels',
    chapters: ALL,
    type: 'challenge',
    difficulty: 2,
    grid: [
      '.............',
      '..e.......e..',
      '....#...#....',
      '......i......',
      '....#...#....',
      '..e.......E..',
      '.............',
    ],
  },

  // ── Thorn Room (cursed) ────────────────────────────────────────────────
  {
    id: 'gen.cursed.thorns',
    chapters: ALL,
    type: 'cursed',
    difficulty: 2,
    grid: [
      '^^^^^...^^^^^',
      '^...........^',
      '^...c...c...^',
      '......i......',
      '^...........^',
      '^..e.....e..^',
      '^^^^^...^^^^^',
    ],
  },

  // ── Broker's Nook ──────────────────────────────────────────────────────
  {
    id: 'gen.nook.counter',
    chapters: ALL,
    type: 'nook',
    difficulty: 1,
    grid: [
      '.............',
      '.....M.M.....',
      '.............',
      '...i..i..i...',
      '.............',
      '.....M.M.....',
      '.............',
    ],
  },
];

export default rooms;
