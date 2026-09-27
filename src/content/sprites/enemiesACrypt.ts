/**
 * The Candlewick Crypt (chapter 2, alt track) enemy sprites: wax, candles and moths in candle-gold,
 * tallow cream and dusky violet. 1 px dark outline, big eyes, `idle` + `move`, `windup` where it
 * matters. Side views face RIGHT (the renderer mirrors them).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const k = '#10122a';
const w = '#f4fbff';
/** Candle flame colours (shared). */
const FLAME = { F: '#ffcf57', f: '#e8862e', y: '#fffbe8' } as const;

/** Dusk Moth — a fuzzy moth with eyespot wings, drawn to your marbles' glow (16×12), front view. */
export const DUSK_MOTH_SPRITE: SpriteDef = {
  id: 'enemy.duskMoth',
  w: 16,
  h: 12,
  palette: {
    o,
    k,
    w,
    V: '#8a6aa8',
    v: '#5a4278',
    E: '#f0a040',
    e: '#fff0b0',
    B: '#f0e0c0',
    b: '#c0a888',
    a: '#c0a888',
  },
  frames: [
    [
      '.....a....a.....',
      'oo....a..a....oo',
      'oVo...oooo...oVo',
      'oVVo.oBBBBo.oVVo',
      'oVEVowkBBwkoVEVo',
      'oVeVoBBBBBBoVeVo',
      'ovVVVobbbboVVVvo',
      '.ovVVobBBboVVvo.',
      '..ovvooBbooovvo.',
      '..oVVoobBooVVo..',
      '...oo..oo..oo...',
      '................',
    ],
    [
      '................',
      '.....a....a.....',
      '......a..a......',
      '......oooo......',
      '.oooooBBBBooooo.',
      'oVVVVwkBBwkVVVVo',
      'oVEeVoBBBBoVeEVo',
      'ovVVVobbbboVVVvo',
      '.ovvvobBBbovvvo.',
      '..ooooobBooooo..',
      '..oVVo.oo.oVVo..',
      '...oo......oo...',
    ],
    [
      '.....a....a.....',
      'oo....a..a....oo',
      'oVo...oooo...oVo',
      'oVVo.oBBBBo.oVVo',
      'oVeVoEkBBkEoVeVo',
      'oVEVoBBBBBBoVEVo',
      'ovVVVobbbboVVVvo',
      '.ovVVobBBboVVvo.',
      '..ovvooBbooovvo.',
      '..oVVoobBooVVo..',
      '...oo..oo..oo...',
      '................',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 8, loop: true },
    move: { frames: [0, 1], fps: 11, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Tallow Trudger — a sleepy candle stub waddling on wax feet, wick still lit (12×16). */
const CANDLE_BODY = [
  '..oooooooo..',
  '.ohWWWWWWXo.',
  '.oWWWWWWWXo.',
  '.oWkkWWkkXo.',
  '.oWWWWWWWXo.',
  '.oWWWmmWWXo.',
  'oWWWWWWWWXo.',
  'oWWWWWWWWXo.',
  '.oXXXXXXXXo.',
];
export const TALLOW_TRUDGER_SPRITE: SpriteDef = {
  id: 'enemy.tallowTrudger',
  w: 12,
  h: 16,
  palette: { o, k, w, ...FLAME, W: '#f0e4c8', X: '#c8b090', h: '#fffaf0', m: '#6a4a3a' },
  frames: [
    ['.....oo.....', '....oFFo....', '....oFyFo...', '....ofFfo...', '.....oko....', ...CANDLE_BODY, '..oWo..oWo..', '..oo....oo..'],
    ['......oo....', '.....oFFo...', '....oFyFo...', '....oFFfo...', '.....oko....', ...CANDLE_BODY, '.oWo....oWo.', '.oo......oo.'],
    [
      '....oFFo....',
      '...oFyyFo...',
      '...oFyyFo...',
      '....ofFo....',
      '.....oko....',
      '..oooooooo..',
      '.ohWWWWWWXo.',
      '.oWwkWWwkXo.',
      '.oWwwWWwwXo.',
      '.oWWWWWWWXo.',
      '.oWWWmmWWXo.',
      'oWWWWWWWWXo.',
      'oWWWWWWWWXo.',
      '.oXXXXXXXXo.',
      '..oWo..oWo..',
      '..oo....oo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 5, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Grim Candelabra — a crooked three-armed candelabra with a face on its stem (16×16). */
const CANDELABRA_BODY = [
  '.oWo..oWWo..oWo.',
  'oBBBooBBBBooBBBo',
  '.obo..obbo..obo.',
  '.ohBBBBBBBBBBbo.',
  '..oooooBBooooo..',
  '....ohBBBBbo....',
  '....okkBBkko....',
  '....okEBBEko....',
  '....oBBmmBBo....',
  '.....oBBBbo.....',
  '...ohBBBBBBbo...',
  '..oooooooooooo..',
];
export const GRIM_CANDELABRA_SPRITE: SpriteDef = {
  id: 'enemy.grimCandelabra',
  w: 16,
  h: 16,
  palette: { o, k, ...FLAME, B: '#c8a04a', b: '#8a6a2a', h: '#f0d890', W: '#e8e0d0', E: '#ffcf57', m: '#3a2410' },
  frames: [
    ['..o....oo....o..', '.oFo..oFFo..oFo.', '.oyo..oyFo..oyo.', '.oWo..oWWo..oWo.', ...CANDELABRA_BODY],
    ['...o...oo...o...', '..oFo.oFFo.oFo..', '.oyFo.oFyo.oyFo.', '.oWo..oWWo..oWo.', ...CANDELABRA_BODY],
    ['.oFo..oFFo..oFo.', 'oFyFooFyyFooFyFo', 'oyyyooyyyyooyyyo', '.oWo..oWWo..oWo.', ...CANDELABRA_BODY],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 4, loop: true },
    move: { frames: [0, 1], fps: 4, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Waxwraith — a drifting sheet of melted candle wax with hollow glowing eyes (14×14). */
const WRAITH_TOP = [
  '....oooooo....',
  '..ooWWWWWWoo..',
  '.oWhhWWWWWWXo.',
  '.oWhWWWWWWWXo.',
  'oWWkkWWWWkkWXo',
  'oWWkEWWWWkEWXo',
  'oWWWWWWWWWWWXo',
];
export const WAXWRAITH_SPRITE: SpriteDef = {
  id: 'enemy.waxwraith',
  w: 14,
  h: 14,
  palette: { o, k, W: '#e8dcc8', X: '#b8a484', h: '#fff8e8', E: '#ffb040', m: '#3a2a20' },
  frames: [
    [
      ...WRAITH_TOP,
      'oWWWWmmmWWWWXo',
      'oWWWWmmmWWWWXo',
      'oWWWWWWWWWWXXo',
      'oWWXWWWXWWWXXo',
      'oWXoWWXoWWXoXo',
      'oXo.oXo.oXo.oo',
      '.o...o...o....',
    ],
    [
      ...WRAITH_TOP,
      'oWWWWmmmWWWWXo',
      'oWWWWmmmWWWWXo',
      'oWWWWWWWWWWXXo',
      'oWXWWWXWWWXWXo',
      'oXoWWXoWWXoWXo',
      '.o.oXo.oXo.oXo',
      '...o...o...o..',
    ],
    [
      '....oooooo....',
      '..ooWWWWWWoo..',
      '.oWhhWWWWWWXo.',
      '.oWhWWWWWWWXo.',
      'oWWkkWWWWkkWXo',
      'oWWkEWWWWkEWXo',
      'oWWWWmmmmWWWXo',
      'oWWWmmmmmmWWXo',
      'oWWWWmmmmWWWXo',
      'oWWWWWWWWWWXXo',
      'oWWXWWWXWWWXXo',
      'oWXoWWXoWWXoXo',
      'oXo.oXo.oXo.oo',
      '.o...o...o....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 4, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
