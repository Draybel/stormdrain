/**
 * Chapter 4 (The Mushroom Hollow) enemy sprites: spores, glowcaps, beetles. Same conventions as the
 * Gutterways set (gutterEnemies.ts): 1 px dark outline, big readable eyes, `idle` + `move` animations
 * plus `windup` (telegraph pose) / `air` (hops) where it matters; side views face RIGHT (the renderer
 * mirrors them). Hurt flash and death bursts are done by the renderer.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** Puffcap — a hopping puffball that breathes out spores (12×11), front view. */
const PUFF_BODY = ['.oPPwwPwwPpo', 'oPPPwkPwkPpo', 'oPsPPPPPPPpo', 'oPPPPmmPPspo', '.oppPPPPppo.', '..oooooooo..'];
export const PUFFCAP_SPRITE: SpriteDef = {
  id: 'enemy.puffcap',
  w: 12,
  h: 11,
  palette: {
    o,
    P: '#d8c49a',
    p: '#a58c62',
    h: '#f4ead0',
    s: '#8a7550',
    w: '#f4fbff',
    k: '#10122a',
    m: '#5a3a2a',
    d: '#4a3a28',
    g: '#e8dcb0',
    G: '#b8a070',
  },
  frames: [
    ['..G.....g...', '.....g...G..', '...oooooo...', '..ohhddPpo..', '.ohPPsPPPPo.', ...PUFF_BODY],
    ['....G...g...', '...g...G....', '...oooooo...', '..ohhddPpo..', '.ohPPsPPPPo.', ...PUFF_BODY],
    [
      '.....oo.....',
      '...oohhoo...',
      '..ohhPPPpo..',
      '..ohPsPPpo..',
      '..oPwwPwwo..',
      '..oPwkPwko..',
      '..oPPPPPpo..',
      '..oPsPmmpo..',
      '...oPPPpo...',
      '....oooo....',
      '...g..G.....',
    ],
    [
      '.g..G..g..G.',
      '...G.gG.g...',
      '....gGgG....',
      '...oooooo...',
      '.oohhddPpoo.',
      'ohhPPsPPPPpo',
      'oPPPwwPwwPpo',
      'oPPPwkPwkPpo',
      'oPsPPmmPPspo',
      '.oppppppppo.',
      '..oooooooo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2.5, loop: true },
    move: { frames: [0, 1], fps: 5, loop: true },
    air: { frames: [2], fps: 1, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Glowcap — a glowing teal mushroom that tunnels through the mycelium (12×13), front view. */
const GLOWCAP_STEM = ['..oSSSSSSo..', '..oSSmmSSo..', '..osSSSSso..', '..oossssoo..', '...oooooo...'];
export const GLOWCAP_SPRITE: SpriteDef = {
  id: 'enemy.glowcap',
  w: 12,
  h: 13,
  palette: {
    o,
    C: '#3fc7b8',
    c: '#23877f',
    L: '#b8fff2',
    r: '#5a4a6a',
    S: '#e8dcc0',
    s: '#b0a080',
    w: '#f4fbff',
    k: '#10122a',
    m: '#6a3a4a',
  },
  frames: [
    ['....oooo....', '..ooCLCCoo..', '.oCCCCCLCCo.', 'oCLCCCCCCCco', 'oCCCCLCCCcco', 'occcccccccco', '.oorrrrrroo.', '..oSwkSwko..', ...GLOWCAP_STEM],
    ['....oooo....', '..ooCCCLoo..', '.oCLCCCCCCo.', 'oCCCCCLCCCco', 'oCCLCCCCCcco', 'occcccccccco', '.oorrrrrroo.', '..oSwkSwko..', ...GLOWCAP_STEM],
    [
      '............',
      '............',
      '....oooo....',
      '..ooCLCCoo..',
      '.oCCCCCLCCo.',
      'oCLCLCCLCCco',
      'occcccccccco',
      '.oorrrrrroo.',
      '..oSkkSkko..',
      '..oSSmmSSo..',
      '..osSSSSso..',
      '.oossssssoo.',
      'oooooooooooo',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 4, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Mossback Beetle — a horned beetle with a mossy shell that charges (16×11), side view. */
const BEETLE_SHELL = ['.oogMggMggo.oHo.', 'ogMMmMMMMMgooHo.', 'oMMMMMmMMMMobbbo', 'oMmMMMMMMmMobeko', 'omMMMMmMMMMobbbo', '.ommmmmmmmmoobo.', '..oBBBBBBBBBBo..'];
export const MOSSBACK_BEETLE_SPRITE: SpriteDef = {
  id: 'enemy.mossbackBeetle',
  w: 16,
  h: 11,
  palette: {
    o,
    M: '#4f7a3a',
    m: '#35572a',
    g: '#8fbf5a',
    B: '#4a3656',
    b: '#6a5080',
    l: '#9a80b0',
    H: '#e0cc90',
    e: '#ffd35a',
    k: '#10122a',
    r: '#ff4a3a',
  },
  frames: [
    ['.............oo.', '...ooooooo..oHHo', ...BEETLE_SHELL, '..olol.olol.o...', '.o.o...o.o......'],
    ['.............oo.', '...ooooooo..oHHo', ...BEETLE_SHELL, '..olol.olol.o...', '..o.o...o.o.....'],
    ['.............oo.', '...ooooooo..oHHo', ...BEETLE_SHELL, '..olo.lolo.lo...', '.o..o.o..o..o...'],
    [
      '................',
      '...ooooooo......',
      '.oogMggMggo.....',
      'ogMMmMMMMMgo....',
      'oMMMMMmMMMMooooo',
      'oMmMMMMMMmMobHHo',
      'omMMMMmMMMMobroo',
      '.ommmmmmmmmobbo.',
      '..oBBBBBBBBBBo..',
      '.olol..olol.o...',
      'o.o...o.o.......',
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 0, 1], fps: 3, loop: true },
    move: { frames: [0, 2], fps: 9, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Morelob — a wrinkly morel that backs off and lobs sticky spore clumps (12×15), front view. */
const MOREL_CAP = ['...ohCcCo...', '...oCcCco...', '..ohcChcCo..', '..oCcCcCco..', '..ocCcChco..', '..oCcCcCco..', '..oooooooo..'];
export const MORELOB_SPRITE: SpriteDef = {
  id: 'enemy.morelob',
  w: 12,
  h: 15,
  palette: {
    o,
    C: '#9a6a3a',
    c: '#5e3a1e',
    h: '#c89a5e',
    S: '#efe3c4',
    s: '#b8a67e',
    w: '#f4fbff',
    k: '#10122a',
    m: '#6a3a2a',
    g: '#b8e070',
    G: '#7fb040',
  },
  frames: [
    ['.....oo.....', '....ohCo....', ...MOREL_CAP, '..oSwkSwko..', '.ooSSSSSSoo.', '.oSoSmmSoSo.', '..oosSSsoo..', '...oSooSo...', '...oo..oo...'],
    ['.....oo.....', '....ohCo....', ...MOREL_CAP, '..oSwkSwko..', '.ooSSSSSSoo.', '.oSoSmmSoSo.', '..oosSSsoo..', '..oSo..oSo..', '..oo....oo..'],
    ['.g...oo...G.', '..G.ohCo.g..', ...MOREL_CAP, '..oSkkSkko..', 'gooSSSSSSooG', 'oSooSmmSooSo', '.o.osSSso.o.', '...oSooSo...', '...oo..oo...'],
  ],
  anims: {
    idle: { frames: [0], fps: 1, loop: true },
    move: { frames: [0, 1], fps: 5, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
