/**
 * Chapter 5 alt (The Frostbitten Vault) enemy sprites: ice and frozen treasure. Conventions as in
 * gutterEnemies.ts (1 px outline, idle / move, windup where it matters, side views face right).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/**
 * Rimechest — a frost-rimed treasure chest that is not a treasure chest (16×14), front view.
 * `idle` = shut (its disguise), `windup` = the lid cracking open, `move` = wide awake and scuttling.
 */
const CHEST_LOWER = ['oWFWWWoggoWWWFWo', 'oWfWWWWooWWWWfWo', 'oWWWWWWWWWWWWWWo', 'owwwwwwwwwwwwwwo', 'oIIIIIIIIIIIIIIo', '.oooooooooooooo.'];
const CHEST_OPEN = [
  '.oooooooooooooo.',
  'oFFfFFFFFFFfFFFo',
  'oiiiiiiiiiiiiiio',
  'oTMTMMMMMMMMTMTo',
  'oMMeeMMMMMMeeMMo',
  'oMMMMGgGGgGMMMMo',
];
const CHEST_OPEN_LOWER = ['oiiiiiiGGiiiiiio', 'oWWWWWWggWWWWWWo', 'oWFWWWWooWWWWFWo', 'owwwwwwwwwwwwwwo', 'oIIIIIIIIIIIIIIo', '.oooooooooooooo.'];
export const RIMECHEST_SPRITE: SpriteDef = {
  id: 'enemy.rimechest',
  w: 16,
  h: 14,
  palette: {
    o,
    W: '#8a5a3a',
    w: '#5e3a22',
    I: '#9aa8c8',
    i: '#5a6680',
    F: '#e4f8ff',
    f: '#9ad8f0',
    S: '#ffffff',
    G: '#ffd35a',
    g: '#c89420',
    T: '#f4fbff',
    M: '#2a0a18',
    R: '#e0405a',
    e: '#6fe0ff',
  },
  frames: [
    [
      '................',
      '..oooooooooooo..',
      '.oFFfFFFFFFfFFo.',
      'oFWWWWoIIoWWWWFo',
      'oWWWWWoIIoWWWWWo',
      'owwwwwoIIowwwwwo',
      'oiiiiioGGoiiiiio',
      ...CHEST_LOWER,
      '................',
    ],
    [
      '................',
      '..oooooooooooo..',
      '.oFFfFFSFFFfFFo.',
      'oFWWWWoIIoWWWWFo',
      'oWWWWWoIIoWWWWWo',
      'owwwwwoIIowwwwwo',
      'oiiiiioGGoiiiiio',
      'oWFWWWoggoWWWSWo',
      ...CHEST_LOWER.slice(1),
      '................',
    ],
    [...CHEST_OPEN, 'oTMTMTRRRRTMTMTo', ...CHEST_OPEN_LOWER, '..oo........oo..'],
    [...CHEST_OPEN, 'oTMTMRRRRTTMTMTo', ...CHEST_OPEN_LOWER, '.oo..........oo.'],
    [
      '................',
      '..oooooooooooo..',
      '.oFFfFFFFFFfFFo.',
      'oFWWWWoIIoWWWWFo',
      'owwwwwoIIowwwwwo',
      'oMMeeMMMMMMeeMMo',
      'oiiiiioGGoiiiiio',
      ...CHEST_LOWER,
      '................',
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 0, 1], fps: 2, loop: true },
    move: { frames: [2, 3], fps: 8, loop: true },
    windup: { frames: [4, 0], fps: 8, loop: true },
  },
};

/** Slushpup — a round snow-seal pup that belly-slides across the ice (16×11), side view. */
const PUP_BODY = ['..oSSSSSSSScSSSo', '.oSSSSSSSSSSSSo.', 'oFSSSSSSSSSSSso.', 'oFosssssFFssso..', '.oo.oooooooooo..'];
export const SLUSHPUP_SPRITE: SpriteDef = {
  id: 'enemy.slushpup',
  w: 16,
  h: 11,
  palette: {
    o,
    S: '#e4f2fa',
    s: '#a8c8e0',
    F: '#7aa0c8',
    k: '#10122a',
    n: '#3a2a3a',
    c: '#ffb0c0',
    r: '#ff4a3a',
    l: '#c8e8ff',
  },
  frames: [
    ['................', '.........ooooo..', '........oSSSSSo.', '.......oSSSSkSSo', '...oooosSSSSSSno', ...PUP_BODY, '................'],
    ['................', '.........ooooo..', '........oSSSSSo.', '.......oSSSSsSSo', '...oooosSSSSSSno', ...PUP_BODY, '................'],
    [
      '.........ooooo..',
      '........oSSSSSo.',
      '.......oSSSSrSSo',
      '....ooosSSSSSSno',
      '.o.oSSSSSSSSSSo.',
      'oFooSSSSSSSScSSo',
      'oFSSSSSSSSSSSSo.',
      '.oSSSSSSSSSSSso.',
      '..osssssoFFsso..',
      '...ooooooooooo..',
      '................',
    ],
    [
      '................',
      '................',
      '..........ooooo.',
      '.........oSSSSSo',
      '.....ooooSSSSkSo',
      '...ooSSSSSSSSSno',
      '.ooSSSSSSSSScSSo',
      'oFSSSSSSSSSSSSo.',
      'oFossssssFFsso..',
      '.oo.ooooooooo...',
      'll.lll..........',
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 0, 1], fps: 2, loop: true },
    move: { frames: [3, 0], fps: 6, loop: true },
    windup: { frames: [2, 0], fps: 10, loop: true },
  },
};

/** Rime Wraith — a tattered frost ghost with an icicle crown (13×14), front view. */
const WRAITH_CLOAK = ['ocCCCCCCCCCco', 'ocCCcCCCcCCco', 'occCCcCcCCcco', '.ocCCcCcCCco.', '.occcCcCccco.'];
export const RIME_WRAITH_SPRITE: SpriteDef = {
  id: 'enemy.rimeWraith',
  w: 13,
  h: 14,
  palette: {
    o,
    I: '#e8fbff',
    C: '#bfe8ff',
    c: '#7ab8e0',
    k: '#0a1a2a',
    E: '#6fe0ff',
    m: '#3a6a9a',
    S: '#ffffff',
  },
  frames: [
    [
      '...o..o..o...',
      '..oIooIooIo..',
      '..oCCCCCCCo..',
      '.oCCkECkECCo.',
      '.oCCkkCkkCCo.',
      '.oCCCCmCCCCo.',
      ...WRAITH_CLOAK,
      '..occcocccoo.',
      '..oco.oco.o..',
      '...o...o.....',
    ],
    [
      '...o..o..o...',
      '..oIooIooIo..',
      '..oCCCCCCCo..',
      '.oCCkECkECCo.',
      '.oCCkkCkkCCo.',
      '.oCCCCmCCCCo.',
      ...WRAITH_CLOAK,
      '.oocccocccoo.',
      '.oco.oco.o...',
      '..o...o......',
    ],
    [
      'S..o..o..o..S',
      '..oSooSooSo..',
      '..oCCCCCCCo..',
      '.oCCEECEECCo.',
      '.oCCEkCEkCCo.',
      '.oCCCkkkCCCo.',
      ...WRAITH_CLOAK,
      '..occcocccoo.',
      '..oco.oco.o..',
      '...o...o.....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 5, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
