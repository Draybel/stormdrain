/**
 * Chapter 6 alt (The Hollow Nest) enemy sprites: wasp paper, amber, larvae. Conventions as in
 * gutterEnemies.ts (1 px outline, idle / move, windup where it matters, side views face right).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** Papercut — a paper wasp that cuts you off (16×12), side view. */
const WASP_BODY = ['..oooo.oPPPooPPo', '.oYsYsooPPPoPeeo', 'ooYsYsYoPpPoPeko', '.oYsYsooPPPoPPmo', '..oooo.oooooooo.'];
export const PAPERCUT_SPRITE: SpriteDef = {
  id: 'enemy.papercut',
  w: 16,
  h: 12,
  palette: {
    o,
    P: '#d8d0c0',
    p: '#a8a090',
    Y: '#e8b830',
    s: '#4a4038',
    W: '#eef6ff',
    w: '#a8c0d8',
    e: '#ff9a3a',
    k: '#10122a',
    m: '#6a5040',
    r: '#ff3a2a',
  },
  frames: [
    ['......oo.oo.....', '.....oWWoWWo....', '.....oWwWWwWo.o.', '......oWWoWWo.o.', '.......ooooo.oo.', ...WASP_BODY, '........o.o.o...', '.......o.o.o....'],
    ['................', '..............o.', '..ooooooo.....o.', '.oWWwWWWWoooooo.', '..oooWwWWWooo.o.', ...WASP_BODY, '........o.o.o...', '........o.o.o...'],
    [
      '......oo.oo.....',
      '.....oWWoWWo....',
      '.....oWwWWwWo.o.',
      '......oWWoWWo.o.',
      '.......ooooo.oo.',
      '...ooo.oPPPooPPo',
      '..oYsYooPPPoPrro',
      '.oYsYsYoPpPoPrko',
      'ooYsYsooPPPoPmmo',
      'o.oooo.ooooooo.o',
      '........o.o.o...',
      '.......o.o.o....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 14, loop: true },
    move: { frames: [0, 1], fps: 16, loop: true },
    windup: { frames: [2, 1], fps: 14, loop: true },
  },
};

/** Ambertomb — a glob of old amber with a beetle sealed inside, still awake (16×14). */
const AMBER_LOWER = ['.oaAAAAAAAAAaao.', '.oaaAAAAAAAAaao.', '..ooaaaaaaaaoo..', '....oooooooo....'];
export const AMBERTOMB_SPRITE: SpriteDef = {
  id: 'enemy.ambertomb',
  w: 16,
  h: 14,
  palette: {
    o,
    A: '#f0a830',
    a: '#b87010',
    H: '#ffe08a',
    W: '#fff6d0',
    B: '#7a3a10',
    b: '#a85a20',
    e: '#fff27a',
    r: '#ff3a2a',
  },
  frames: [
    [
      '.....oooooo.....',
      '...ooHHAAAAoo...',
      '..oHWHAAAAAAao..',
      '.oHHAAAAAAAAAao.',
      '.oHAAAbAAbAAAao.',
      'oHAAAAeBBeAAAAao',
      'oAAAbABBBBAbAAao',
      'oAAAAbBbbBbAAaao',
      'oAAAbABBBBAbAaao',
      'oaAAAAABBAAAAaao',
      ...AMBER_LOWER,
    ],
    [
      '.....oooooo.....',
      '...ooHHAAAAoo...',
      '..oHHWAAAAAAao..',
      '.oHHAAAAAAAAAao.',
      '.oHAAAAbbAAAAao.',
      'oHAAAAeBBeAAAAao',
      'oAAAAbBBBBbAAAao',
      'oAAAAbBbbBbAAaao',
      'oAAAAbBBBBbAaaao',
      'oaAAAAABBAAAAaao',
      ...AMBER_LOWER,
    ],
    [
      '.....oooooo.....',
      '...ooWWHHHHoo...',
      '..oWWHHHHHHHAo..',
      '.oWHHHHHHHHHHAo.',
      '.oWHHHbHHbHHHAo.',
      'oWHHHHrBBrHHHHAo',
      'oHHHbHBBBBHbHHAo',
      'oHHHHbBbbBbHHAAo',
      'oHHHbHBBBBHbHAAo',
      'oAHHHHHBBHHHHAao',
      ...AMBER_LOWER,
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 3, loop: true },
    windup: { frames: [2, 0], fps: 8, loop: true },
  },
};

/** Brood Comb — a papery wasp nest with a grub peeking out of its door (16×16). */
const COMB_TOP = ['.......oo.......', '......opPo......', '....oopPPPoo....', '...opPPPPPPPo...', '..opppppppppPo..', '..oPPPPPPPPPPo..'];
const COMB_BOTTOM = ['.oPPPPoooooPPPo.', '..oppppppppppo..', '...oooooooooo...'];
export const BROOD_COMB_SPRITE: SpriteDef = {
  id: 'enemy.broodComb',
  w: 16,
  h: 16,
  palette: {
    o,
    P: '#d8d0c0',
    p: '#a8a090',
    d: '#2a221e',
    G: '#f4e8c8',
    g: '#d0b890',
    w: '#f4fbff',
    k: '#10122a',
    m: '#8a5a30',
    r: '#ff3a2a',
  },
  frames: [
    [
      ...COMB_TOP,
      '.oPwkPPPPPPwkPo.',
      '.opppppppppppPo.',
      'oPPPPPoooooPPPPo',
      'oPPPPodddddoPPPo',
      'opppodGgGgGdoppo',
      'oPPPodgGkGgdoPPo',
      'oPPPPodddddoPPPo',
      ...COMB_BOTTOM,
    ],
    [
      ...COMB_TOP,
      '.oPwkPPPPPPwkPo.',
      '.opppppppppppPo.',
      'oPPPPPoooooPPPPo',
      'oPPPPodddddoPPPo',
      'opppodddddddoppo',
      'oPPPodddddddoPPo',
      'oPPPPodddddoPPPo',
      ...COMB_BOTTOM,
    ],
    [
      ...COMB_TOP,
      '.oPrkPPPPPPrkPo.',
      '.opppppppppppPo.',
      'oPPPPPoGGGoPPPPo',
      'oPPPPoGgGgGoPPPo',
      'opppoGgkGkgGoppo',
      'oPPPoGggmggGoPPo',
      'oPPPPoGGGGGoPPPo',
      ...COMB_BOTTOM,
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 1, 0], fps: 2, loop: true },
    move: { frames: [0], fps: 1, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Grubling — a chubby wasp larva that chews tunnels through the paper floor (12×8), side view. */
export const GRUBLING_SPRITE: SpriteDef = {
  id: 'enemy.grubling',
  w: 12,
  h: 8,
  palette: {
    o,
    G: '#f4e8c8',
    s: '#c8a878',
    H: '#c87a3a',
    k: '#10122a',
    m: '#5a2a10',
  },
  frames: [
    ['............', '..oooooooo..', '.oGsGGsGoHHo', 'oGGsGGsGoHko', 'oGGsGGsGoHmo', 'osGGsGGsoHoo', '.osssssso...', '..o.o.o.o...'],
    ['...ooooo....', '..oGsGGsoo..', '.oGsGGsGoHHo', 'oGGsGGsGoHko', 'oGsGGsGGoHmo', '.osGGsGsoHoo', '..ossssso...', '...o.o.o....'],
    ['............', '..oooooooo..', '.oGsGGsGoHHm', 'oGGsGGsGoHko', 'oGGsGGsGoHoo', 'osGGsGGsoHmm', '.osssssso...', '.o.o.o.o....'],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 8, loop: true },
    windup: { frames: [2, 0], fps: 10, loop: true },
  },
};
