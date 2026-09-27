/**
 * Chapter 4 alt (The Glimmer Grotto) enemy sprites: crystals and echo bats. Conventions as in
 * gutterEnemies.ts (1 px outline, idle / move, windup where it matters, side views face right).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** Echo Bat — a big-eared cave bat whose screech rolls out as a ring (16×10), front view. */
export const ECHO_BAT_SPRITE: SpriteDef = {
  id: 'enemy.echoBat',
  w: 16,
  h: 10,
  palette: {
    o,
    B: '#5a4a80',
    W: '#7a68b0',
    m: '#44386a',
    E: '#d890e0',
    e: '#8ff0ff',
    f: '#f4fbff',
    s: '#c8f0ff',
  },
  frames: [
    [
      'o..............o',
      'oWo..oEooEo..oWo',
      'oWWo.oBBBBo.oWWo',
      'oWmWooeBBeooWmWo',
      '.oWmWoBBBBoWmWo.',
      '.oWWmoBffBomWWo.',
      '..ooWWoBBoWWoo..',
      '....oooooooo....',
      '................',
      '................',
    ],
    [
      '................',
      '.....oEooEo.....',
      '.....oBBBBo.....',
      '.....oeBBeo.....',
      '.oooooBBBBooooo.',
      'oWWWmoBffBomWWWo',
      'oWmWWWoBBoWWWmWo',
      '.oWWmWWooWWmWWo.',
      '..oWo......oWo..',
      '...o........o...',
    ],
    [
      's..s........s..s',
      'oWo.soEooEos.oWo',
      'oWWo.oBBBBo.oWWo',
      'oWmWooeBBeooWmWo',
      '.oWmWoBBBBoWmWo.',
      '.oWWmoffffomWWo.',
      '..ooWWoffoWWoo..',
      '....oooooooo....',
      '................',
      '................',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 8, loop: true },
    move: { frames: [0, 1], fps: 10, loop: true },
    windup: { frames: [2, 1], fps: 12, loop: true },
  },
};

/** Quartz Creeper — a crystal-backed spider that scuttles along the walls (14×11). */
const CREEPER_TOP = ['....o....o....', '...oQo..oQo...', '..oQqo.oQqdo..', '..oQqdoQqqdo..', '.ooqqdqqqdqoo.'];
export const QUARTZ_CREEPER_SPRITE: SpriteDef = {
  id: 'enemy.quartzCreeper',
  w: 14,
  h: 11,
  palette: {
    o,
    Q: '#b8f6ff',
    q: '#4fb8d8',
    d: '#2a6a9a',
    w: '#ffffff',
    B: '#3e3262',
    b: '#6a5a9a',
    e: '#ff6ad8',
    k: '#10122a',
  },
  frames: [
    [...CREEPER_TOP, 'oBbbbbbbbbbbBo', 'oBekBBBBBBekBo', 'oBBBBkBBkBBBBo', '.oBBBBBBBBBBo.', 'oo.o.o..o.o.oo', 'o..o.o..o.o..o'],
    [...CREEPER_TOP, 'oBbbbbbbbbbbBo', 'oBekBBBBBBekBo', 'oBBBBkBBkBBBBo', '.oBBBBBBBBBBo.', '.oo.o.oo.o.oo.', '.o..o....o..o.'],
    [
      '..w.o....o.w..',
      '...oQo..oQo...',
      '..oQQo.oQQqo..',
      '.woQQqoQQQqow.',
      '.ooQQqQQQqQoo.',
      'oBbbbbbbbbbbBo',
      'oBeeBBBBBBeeBo',
      'oBBBBeBBeBBBBo',
      '.oBBBBBBBBBBo.',
      'oo.o.o..o.o.oo',
      'o..o.o..o.o..o',
    ],
  ],
  anims: {
    idle: { frames: [0], fps: 1, loop: true },
    move: { frames: [0, 1], fps: 10, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Geode Tumbler — a grumpy rolling geode with amethyst showing through a crack (16×14). */
export const GEODE_TUMBLER_SPRITE: SpriteDef = {
  id: 'enemy.geodeTumbler',
  w: 16,
  h: 14,
  palette: {
    o,
    R: '#6a6478',
    r: '#46415a',
    h: '#8e89a0',
    A: '#c070f0',
    a: '#8040c0',
    W: '#f4e0ff',
    w: '#f4fbff',
    k: '#10122a',
    m: '#2a2438',
  },
  frames: [
    [
      '.....oooooo.....',
      '...oohhhRRRoo...',
      '..ohhRRRRRRRro..',
      '.ohRRRRRRRRRRro.',
      '.ohRooRRRRooRro.',
      'ohRRwkRRRRwkRRro',
      'ohRRRRRRRRRRRrro',
      'oRoaoRRRRRRRRrro',
      'oRaAaoRRmmRRrrro',
      'oaAWAaoRRRRRrrro',
      '.oaAAaoRRRRrrro.',
      '.ooaaooRrrrrroo.',
      '...oooorrrroo...',
      '.....oooooo.....',
    ],
    [
      '................',
      '.....oooooo.....',
      '...oohhhRRRoo...',
      '..ohRRRRRRRRRo..',
      '.ohRooRRRRooRro.',
      'ohRRwkRRRRwkRRro',
      'ohRRRRRRRRRRRrro',
      'oRoaoRRRRRRRRrro',
      'oRaAaoRRmmRRrrro',
      'oaAAAaoRRRRRrrro',
      'oaAWAaoRRRRrrrro',
      '.oaaaooRrrrrrro.',
      '..ooooorrrrooo..',
      '....oooooooo....',
    ],
    [
      '.....oooooo.....',
      '...oohhhRRRoo...',
      '..ohhRRRRRRRro..',
      '.ohoRRRRRRRRoro.',
      '.ohRooRRRRooRro.',
      'ohRRwkRRRRwkRRro',
      'ohRRRRRRRRRRRrro',
      'oRoaoRRmmmmRRrro',
      'oRaAaoRmkkmRrrro',
      'oaAWAaoRmmRRrrro',
      '.oaAAaoRRRRrrro.',
      '.ooaaooRrrrrroo.',
      '...oooorrrroo...',
      '.....oooooo.....',
    ],
  ],
  anims: {
    idle: { frames: [0], fps: 1, loop: true },
    move: { frames: [0, 1], fps: 6, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Glint Mite — a tiny crystal tick that pours out of a cracked geode (10×8). */
export const GLINT_MITE_SPRITE: SpriteDef = {
  id: 'enemy.glintMite',
  w: 10,
  h: 8,
  palette: {
    o,
    Q: '#b8f6ff',
    q: '#4fb8d8',
    d: '#2a6a9a',
    B: '#3e3262',
    e: '#ff6ad8',
    k: '#10122a',
  },
  frames: [
    ['...o..o...', '..oQooQo..', '.oqQqqQqo.', 'oBqqddqqBo', 'oBekBBekBo', '.oBBBBBBo.', 'o.o.oo.o.o', '..........'],
    ['...o..o...', '..oQooQo..', '.oqQqqQqo.', 'oBqqddqqBo', 'oBekBBekBo', '.oBBBBBBo.', '.o.o..o.o.', 'o........o'],
  ],
  anims: {
    idle: { frames: [0], fps: 1, loop: true },
    move: { frames: [0, 1], fps: 14, loop: true },
  },
};
