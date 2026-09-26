/**
 * The Gutterways tileset (16×16): deep blue-grey flagstones, brick walls, mossy boulders, pits,
 * a drain grate and a few decals. Walls are authored for the TOP wall (floor side at the bottom)
 * and rotated in 90° steps for the other sides by the room background builder.
 */

import type { SpriteDef } from '../../sim/types';
import { GUTTER, OUTLINE } from './palette';

const FLOOR_PAL = {
  a: GUTTER.floor,
  b: GUTTER.floorLight,
  c: GUTTER.floorDark,
  m: GUTTER.mortar,
  g: GUTTER.moss,
  G: GUTTER.mossLight,
  i: '#3a4256',
  I: '#5a6480',
  k: GUTTER.deep,
};

export const FLOOR_SPRITE: SpriteDef = {
  id: 'gutter.floor',
  w: 16,
  h: 16,
  palette: FLOOR_PAL,
  frames: [
    // 0: single flagstone
    [
      'bbbbbbbbbbbbbbbm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaacaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaacaacm',
      'baacaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'bccccccccccccccm',
      'mmmmmmmmmmmmmmmm',
    ],
    // 1: one long stone over two short ones
    [
      'bbbbbbbbbbbbbbbm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaacaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'bccccccccccccccm',
      'mmmmmmmmmmmmmmmm',
      'bbbbbbbmbbbbbbbm',
      'baaaaacmbaaaaacm',
      'baaaaacmbaaaaacm',
      'baacaacmbaaaaacm',
      'baaaaacmbaaacacm',
      'baaaaacmbaaaaacm',
      'bccccccmbccccccm',
      'mmmmmmmmmmmmmmmm',
    ],
    // 2: cracked
    [
      'bbbbbbbbbbbbbbbm',
      'baaaaaaaaaaaaacm',
      'baaaaaaamaaaaacm',
      'baaaaaaamaaaaacm',
      'baaaaaamaaaaaacm',
      'baaaaaamaaaaaacm',
      'baaaaaaamaaaaacm',
      'baaaaaaaamaaaacm',
      'baaaaaaaamaaaacm',
      'baaaaaaaaamaaacm',
      'baaaaaaaamaaaacm',
      'baaaaaaaaaaaaacm',
      'baacaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'bccccccccccccccm',
      'mmmmmmmmmmmmmmmm',
    ],
    // 3: moss creeping in from the corner
    [
      'bbbbbbbbbbbbbbbm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaacaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'baaaaaaaaaaaaacm',
      'bgaaaaaaaaaaaacm',
      'bgGaaaaaaaaaaacm',
      'bgGgaaaaaaaaaacm',
      'gGggaaaaaaaaaacm',
      'ggGgcccccccccccm',
      'gmmmmmmmmmmmmmmm',
    ],
    // 4: drain grate
    [
      'bbbbbbbbbbbbbbbm',
      'baaaaaaaaaaaaacm',
      'baIIIIIIIIIIIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baIkIkIkIkIkIacm',
      'baiiiiiiiiiiiacm',
      'baaaaaaaaaaaaacm',
      'bccccccccccccccm',
      'mmmmmmmmmmmmmmmm',
    ],
  ],
};

export const FLOOR_VARIANT = { plain: 0, split: 1, cracked: 2, mossy: 3, grate: 4 } as const;

const WALL_PAL = {
  k: GUTTER.deep,
  m: GUTTER.mortar,
  W: GUTTER.brick,
  w: GUTTER.brickShade,
  L: GUTTER.brickLight,
  g: GUTTER.moss,
  G: GUTTER.mossLight,
};

/** Top-wall segment (floor side = bottom row). Frame 1 is a mossy variant. */
export const WALL_SPRITE: SpriteDef = {
  id: 'gutter.wall',
  w: 16,
  h: 16,
  palette: WALL_PAL,
  frames: [
    [
      'kkkkkkkkkkkkkkkk',
      'kkmkkkkkkkmkkkkk',
      'mmmmmmmmmmmmmmmm',
      'LLLLLLLmLLLLLLLL',
      'WWWWWWWmWWWWWWWW',
      'wwwwwwwmwwwwwwww',
      'mmmmmmmmmmmmmmmm',
      'LLLmLLLLLLLLmLLL',
      'WWWmWWWWWWWWmWWW',
      'wwwmwwwwwwwwmwww',
      'mmmmmmmmmmmmmmmm',
      'LLLLLLLmLLLLLLLL',
      'WWWWWWWmWWWWWWWW',
      'wwwwwwwmwwwwwwww',
      'mmmmmmmmmmmmmmmm',
      'mmmmmmmmmmmmmmmm',
    ],
    [
      'kkkkkkkkkkkkkkkk',
      'kkkkkmkkkkkkkmkk',
      'mmmmmmmmmmmmmmmm',
      'LLLLLLLmLLLLLLLL',
      'WWWWWWWmWWWWWWWW',
      'wwwwwwwmwwwwwwww',
      'mmmmmmmmmmmmmmmm',
      'LLLmLLLLLLLLmLLL',
      'WWWmWWWWWWWgmWWW',
      'wwwmwwwwwwgGmwww',
      'mmmmmmmmmmgmmmmm',
      'LLgLLLLmLLLLLLgL',
      'WgGgWWWmWWWWWgGW',
      'wggGwwwmwwwwgGgw',
      'mgmmmmmmmmmmmgmm',
      'mmmmmmmmmmmmmmmm',
    ],
  ],
};

/** Corner capstone block (symmetric, so rotation does not matter). */
export const CORNER_SPRITE: SpriteDef = {
  id: 'gutter.corner',
  w: 16,
  h: 16,
  palette: WALL_PAL,
  frames: [
    [
      'kkkkkkkkkkkkkkkk',
      'kmmmmmmmmmmmmmmk',
      'kmLLLLLLLLLLLLmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWwWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWwWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmLWWWWWWWWWWwmk',
      'kmwwwwwwwwwwwwmk',
      'kmmmmmmmmmmmmmmk',
      'kkkkkkkkkkkkkkkk',
    ],
  ],
};

/** Mossy boulders (2 variants). */
export const ROCK_SPRITE: SpriteDef = {
  id: 'gutter.rock',
  w: 16,
  h: 16,
  palette: {
    o: OUTLINE,
    R: GUTTER.stone,
    L: GUTTER.stoneLight,
    r: GUTTER.stoneShade,
    g: GUTTER.moss,
    G: GUTTER.mossLight,
  },
  frames: [
    [
      '................',
      '.....oooooo.....',
      '...ooLLLRRRoo...',
      '..oLLLRRRRRRRo..',
      '.oLLRRRRRRRRRro.',
      '.oLRRRRRRRRRRro.',
      'oLRRRRRRRRRRRrro',
      'oLRRRRRRRRRRrrro',
      'oRRRRRRRRRRRrrro',
      'oRRRRRRRRRRrrrro',
      'oGgRRRRRRRRrrrro',
      'oggGRRRRRRrrrrro',
      '.oggggRRRrrrrro.',
      '.oogggrrrrrrroo.',
      '...oooooooooo...',
      '................',
    ],
    [
      '................',
      '................',
      '................',
      '....oooooooo....',
      '..ooLLLLRRRRoo..',
      '.oLLLRRRRRRRRRo.',
      'oLLRRRRRRRRRRRro',
      'oLRRRRRRRRRRRrro',
      'oRRRRRRRRRRRrrro',
      'oRRoRRRRRRRrrrro',
      'oGRRoRRRRRrrrrro',
      'oggRRRRRRrrrrrro',
      'oggGgRRRrrrrrrro',
      '.oggggrrrrrrrro.',
      '..oooooooooooo..',
      '................',
    ],
  ],
};

/** Pit interior (frame 0) and the stone lip drawn along a pit's top edge (frame 1, top 7 rows). */
export const PIT_SPRITE: SpriteDef = {
  id: 'gutter.pit',
  w: 16,
  h: 16,
  palette: {
    v: GUTTER.void,
    u: GUTTER.voidSpeck,
    L: '#46516c', // lit rim where the floor breaks off
    S: '#262d3f', // stone face
    m: '#161a26', // mortar
    s: '#1a1f2c',
    t: '#10131b',
    d: '#0a0c13',
  },
  frames: [
    [
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvuvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvuvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvuvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvuvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vuvvvvvvvvvvvvvv',
      'vvvvvvvvvvvvvvvv',
      'vvvvvvvvvvvuvvvv',
      'vvvvvvvvvvvvvvvv',
    ],
    [
      'LLLLLLLLLLLLLLLL',
      'SSSmSSSSSSSmSSSS',
      'SSSmSSSSSSSmSSSS',
      'mmmmmmmmmmmmmmmm',
      'sssssssmssssssss',
      'tttttttmtttttttt',
      'dddddddddddddddd',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  ],
};

/** Small floor decals: fallen leaves and a rain puddle. */
export const LEAF_SPRITE: SpriteDef = {
  id: 'gutter.leaf',
  w: 6,
  h: 4,
  palette: { l: GUTTER.leaf, L: GUTTER.leafLight },
  frames: [
    ['..lL..', '.lLLl.', 'lLLl..', '.l....'],
    ['.Ll...', 'lLLl..', '.lLLl.', '...l..'],
  ],
};

export const PUDDLE_SPRITE: SpriteDef = {
  id: 'gutter.puddle',
  w: 12,
  h: 5,
  palette: { w: '#3b5f7e66', W: '#8fb8dc88' },
  frames: [
    [
      '...wwwwww...',
      '.wwwWWwwwww.',
      'wwwwwwwwWwww',
      '.wwwwwwwwww.',
      '...wwwww....',
    ],
  ],
};
