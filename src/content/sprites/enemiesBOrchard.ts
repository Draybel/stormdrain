/**
 * Chapter 5 (The Bone Orchard) enemy sprites: bone trees, crows, lanterns. Conventions as in
 * gutterEnemies.ts (1 px outline, idle / move, windup where it matters, side views face right).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** Gravecaw — a chubby orchard crow that dive-bombs (16×11), side view. */
const CAW_TAIL = ['oCCooCCCCCCCCCo.', '.oCCCCCCcCCCCo..', '..oCCcCCCCcCo...', '...ooocccccoo...', '.....ofo.ofo....'];
export const GRAVECAW_SPRITE: SpriteDef = {
  id: 'enemy.gravecaw',
  w: 16,
  h: 11,
  palette: {
    o,
    C: '#3c3c5e',
    c: '#27273f',
    h: '#7070a4',
    w: '#f4fbff',
    k: '#10122a',
    b: '#f0a838',
    B: '#a86820',
    f: '#e89a30',
    r: '#ff4a3a',
  },
  frames: [
    ['.ooo............', '.ohhoo.....ooo..', '..ohCCoo..oCCCo.', '..ohCCCCooCCwko.', '...ohCCCCCCCCobb', '.oo.oCCCCCCCCCoB', ...CAW_TAIL],
    [
      '................',
      '...........ooo..',
      '..........oCCCo.',
      '...oooooooCCwko.',
      '..ohhhhCCCCCCobb',
      '.oohCCChhCCCCCoB',
      'oCCohCCCChCCCCo.',
      '.oCCohCCCCCCCo..',
      '..oCCohhCCcCo...',
      '...ooooocccoo...',
      '.....ofo.ofo....',
    ],
    [
      '.ooo............',
      '.ohhoo.....ooo..',
      '..ohCCoo..oCCCo.',
      '..ohCCCCooCCrwo.',
      '...ohCCCCCCCCobb',
      '.oo.oCCCCCCCCCo.',
      'oCCooCCCCCCCCCob',
      '.oCCCCCCcCCCCo..',
      '..oCCcCCCCcCo...',
      '...ooocccccoo...',
      '....ofo..ofo....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 6, loop: true },
    move: { frames: [0, 1], fps: 9, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Bonebark — a skeletal tree that shakes down crab-apples (16×18). */
const BARK_TRUNK = [
  '....otTTTTTto...',
  '...oTkkTTkkTo...',
  '...oTkETTkETo...',
  '...otTTTTTTto...',
  '...oTTTmmTTTo...',
  '...otTTTTTTto...',
  '...oTTtTTtTTo...',
  '..otTToTToTTto..',
  '.oTTo.oTTo.oTTo.',
  '.ooo..oooo..ooo.',
];
export const BONEBARK_SPRITE: SpriteDef = {
  id: 'enemy.bonebark',
  w: 16,
  h: 18,
  anchorY: 17,
  palette: {
    o,
    T: '#ece4cc',
    t: '#b4a88a',
    k: '#1a1420',
    E: '#9aff7a',
    m: '#3a2a30',
    A: '#d8483a',
    a: '#8a2a26',
    h: '#ff9a7a',
  },
  frames: [
    [
      '.o...........o..',
      'oTo..o....o.oTo.',
      '.oTooTo..oToTo..',
      '..oTTTo..oTTo...',
      '.o.ooTTooTTo.o..',
      'oho.oTTTTTo.oho.',
      'oAAo.oTTTo.oAAo.',
      '.oo.oTTTTTo.oo..',
      ...BARK_TRUNK,
    ],
    [
      '..o...........o.',
      '.oTo.o....o..oTo',
      '..oToTo..oTooTo.',
      '...oTTo..oTTTo..',
      '..o.oTTooTTo.o..',
      '.oho.oTTTTo.oho.',
      '.oAAooTTTo.oAAo.',
      '..oo.oTTTTo.oo..',
      ...BARK_TRUNK,
    ],
    [
      'o.o.........o.o.',
      'oTo.oo...oo.oTo.',
      '.oTToTo.oToTTo..',
      '..oTTTo.oTTTo...',
      'oho.oTTooTTo.oho',
      'oAAo.oTTTTo.oAAo',
      'oaAo.oTTTTo.oaAo',
      '.oo.oTTTTTo..oo.',
      '....otTTTTTto...',
      '...oTkkTTkkTo...',
      '...oTEETTEETo...',
      '...otTTTTTTto...',
      '...oTTmmmmTTo...',
      '...otTTTTTTto...',
      '...oTTtTTtTTo...',
      '..otTToTToTTto..',
      '.oTTo.oTTo.oTTo.',
      '.ooo..oooo..ooo.',
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 1], fps: 1.5, loop: true },
    move: { frames: [0, 1], fps: 3, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Gloam Lantern — a sleepy iron lantern that blinks from spot to spot (12×14). */
const LANTERN_TOP = ['.....oo.....', '....o..o....', '...oooooo...', '..oFffffFo..'];
const LANTERN_BOTTOM = ['..oFGGGGFo..', '..oFffffFo..', '...oooooo...', '....oWWo....', '.....oo.....'];
export const GLOAM_LANTERN_SPRITE: SpriteDef = {
  id: 'enemy.gloamLantern',
  w: 12,
  h: 14,
  palette: {
    o,
    F: '#3a3048',
    f: '#6a5a78',
    G: '#ffcf57',
    g: '#e8862e',
    Y: '#fff6c0',
    k: '#3a1a10',
    W: '#9aa8c8',
  },
  frames: [
    [...LANTERN_TOP, '..oFGGGGFo..', '.oFGkGGkGFo.', '.oFGGYYGGFo.', '.oFGgYYgGFo.', '.oFGGggGGFo.', ...LANTERN_BOTTOM],
    [...LANTERN_TOP, '..oFGGGGFo..', '.oFGkGGkGFo.', '.oFGGGYGGFo.', '.oFGgYYGgFo.', '.oFGGgggGFo.', ...LANTERN_BOTTOM],
    [...LANTERN_TOP, '..oFYYYYFo..', '.oFYkYYkYFo.', '.oFYYYYYYFo.', '.oFYGkkGYFo.', '.oFYGGGGYFo.', '..oFYYYYFo..', '..oFffffFo..', '...oooooo...', '....oWWo....', '.....oo.....'],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 5, loop: true },
    move: { frames: [0, 1], fps: 7, loop: true },
    windup: { frames: [2, 0], fps: 10, loop: true },
  },
};

/** Rattlebones — a scarecrow skeleton in a straw hat that throws its own bones (12×17). */
const RATTLE_HEAD = [
  '....oooo....',
  '...oHHHHo...',
  '..oHhHHhHo..',
  'oooooooooooo',
  '.oTTTTTTTTo.',
  '.oTkkTTkkTo.',
  '.oTkeTTkeTo.',
  '.otTTTTTTto.',
  '..otTtTtto..',
  '...oooooo...',
];
export const RATTLEBONES_SPRITE: SpriteDef = {
  id: 'enemy.rattlebones',
  w: 12,
  h: 17,
  palette: {
    o,
    H: '#d8b050',
    h: '#9a7a30',
    T: '#ece4cc',
    t: '#b4a88a',
    k: '#10122a',
    e: '#9aff7a',
  },
  frames: [
    [...RATTLE_HEAD, '....oTTo....', '..ooTTTToo..', '.oTooTTooTo.', '.oo.oTTo.oo.', '....oTTo....', '...oTooTo...', '...oo..oo...'],
    [...RATTLE_HEAD, '....oTTo....', '..ooTTTToo..', '.oTooTTooTo.', '.oo.oTTo.oo.', '....oTTo....', '..oTo..oTo..', '..oo....oo..'],
    [
      ...RATTLE_HEAD.slice(0, 9),
      '...oooooooTo',
      '....oTToooTo',
      '..ooTTTTooTo',
      '.oTooTTo..o.',
      '.oo.oTTo....',
      '....oTTo....',
      '...oTooTo...',
      '...oo..oo...',
    ],
  ],
  anims: {
    idle: { frames: [0], fps: 1, loop: true },
    move: { frames: [0, 1], fps: 7, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
