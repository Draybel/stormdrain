/**
 * Wren — a scrappy kid in an oversized yellow raincoat (14×16).
 * Frames are composed from an upper body (hood + coat, 14 rows) and a pair of boot rows so the
 * walk cycles stay consistent. Left-facing frames are the side frames mirrored at draw time.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const PALETTE = {
  o: OUTLINE,
  Y: '#f5c52e', // coat
  y: '#c98a1f', // coat shade
  h: '#fff09a', // coat highlight
  d: '#7a4f17', // hood rim / seams
  k: '#1d1830', // the dark inside the hood
  e: '#eaf7ff', // bright eyes
  x: '#5f6784', // dimmed eyes (death)
  b: '#c23a44', // red rubber boots
  p: '#5b7fae', // blue patch on the back
  t: '#6b4a2f', // coat toggle
} as const;

// ── Upper bodies (rows 0-13) ────────────────────────────────────────────────
const DOWN = [
  '....oooooo....',
  '..ooYYYYYYoo..',
  '.oYhhYYYYYYyo.',
  'oYhYYYYYYYYYyo',
  'oYhYddddddYYyo',
  'oYYdkkkkkkdYyo',
  'oYYdkekkekdYyo',
  'oYYdkekkekdyyo',
  '.oYYdkkkkdyyo.',
  '.oyYYddddYyyo.',
  'oYYYYYdYYYYYyo',
  'oYhYYYdtYYYyyo',
  'oYhYYYdYYYYyyo',
  '.oyyyydyyyyyo.',
];

const DOWN_BLINK = DOWN.map((row, i) =>
  i === 6 ? 'oYYdkkkkkkdYyo' : i === 7 ? 'oYYdkekkekdyyo' : row,
);

const HURT = DOWN.map((row, i) =>
  i === 5 ? 'oYYdekkkkedYyo' : i === 7 ? 'oYYdekkkkedyyo' : row,
);

const UP = [
  '....oooooo....',
  '..ooYYYYYYoo..',
  '.oYhhYYYYYYyo.',
  'oYhYYYYdYYYYyo',
  'oYhYYYYdYYYYyo',
  'oYYYYYYdYYYyyo',
  'oYYYYYYdYYYyyo',
  'oYYYYYYdYYyyyo',
  '.oyYYYYdYYyyo.',
  '.oyyyyyyyyyyo.',
  'oYYYYYYYYYYYyo',
  'oYhYYYYYppYyyo',
  'oYhYYYYYppYyyo',
  '.oyyyyyyyyyyo.',
];

/** Facing right; mirrored for left. Two eyes peek out of the hood (3/4 view). */
const SIDE = [
  '...oooooo.....',
  '.ooYYYYYYoo...',
  'oYhhYYYYYYYo..',
  'oYhYYYYYYYYYo.',
  'oYhYYYYYYddddo',
  'oYYYYYYYdkkkko',
  'oYYYYYYYdkekeo',
  'oyYYYYYYdkekeo',
  '.oyYYYYYdkkkko',
  '.oyyYYYYYddddo',
  '.oYYYYYYYYYyo.',
  '.ohYYYYtYYYyo.',
  '.ohYYYYYYYyyo.',
  '..oyyyyyyyyo..',
];

// ── Boots (rows 14-15) ──────────────────────────────────────────────────────
const FEET_STAND = ['..obbo..obbo..', '..oooo..oooo..'];
const FEET_LEFT_UP = ['..oooo..obbo..', '........oooo..'];
const FEET_RIGHT_UP = ['..obbo..oooo..', '..oooo........'];
const FEET_SIDE_TOGETHER = ['....obbbbo....', '....oooooo....'];
const FEET_SIDE_SPREAD = ['..obbo..obbo..', '..oooo..oooo..'];

// ── Death ───────────────────────────────────────────────────────────────────
const DEATH_SLUMP = [
  '..............',
  '..............',
  '....oooooo....',
  '..ooYYYYYYoo..',
  '.oYhhYYYYYYyo.',
  'oYhYddddddYYyo',
  'oYYdkxkkxkdYyo',
  'oYYdkkkkkkdyyo',
  'oYYYddddddYyyo',
  'oYYYYYdYYYYYyo',
  'ohYYYYdYYYYyyo',
  'ohYYYYdYYYYyyo',
  'oyyyyyyyyyyyyo',
  '.oooooooooooo.',
  '..obbo..obbo..',
  '..oooo..oooo..',
];

/** Just the empty raincoat left in a heap, eyes closed. */
const DEATH_HEAP = [
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
  '.....oooo.....',
  '...ooYYYYoo...',
  '..oYhYYYYYyo..',
  '.oYhddddddyyo.',
  'oYYdxxkkxxdyyo',
  'oyyyyyyyyyyyyo',
  '.oooooooooooo.',
];

export const WREN_FRAME = {
  downStand: 0,
  downStepL: 1,
  downStepR: 2,
  downBlink: 3,
  upStand: 4,
  upStepL: 5,
  upStepR: 6,
  sideTogether: 7,
  sideSpread: 8,
  hurt: 9,
  deathSlump: 10,
  deathHeap: 11,
} as const;

export const WREN_SPRITE: SpriteDef = {
  id: 'wren',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: PALETTE,
  frames: [
    [...DOWN, ...FEET_STAND],
    [...DOWN, ...FEET_LEFT_UP],
    [...DOWN, ...FEET_RIGHT_UP],
    [...DOWN_BLINK, ...FEET_STAND],
    [...UP, ...FEET_STAND],
    [...UP, ...FEET_LEFT_UP],
    [...UP, ...FEET_RIGHT_UP],
    [...SIDE, ...FEET_SIDE_TOGETHER],
    [...SIDE, ...FEET_SIDE_SPREAD],
    [...HURT, ...FEET_STAND],
    DEATH_SLUMP,
    DEATH_HEAP,
  ],
  anims: {
    idleDown: { frames: [0], fps: 1, loop: true },
    walkDown: { frames: [1, 0, 2, 0], fps: 8, loop: true },
    idleUp: { frames: [4], fps: 1, loop: true },
    walkUp: { frames: [5, 4, 6, 4], fps: 8, loop: true },
    idleSide: { frames: [7], fps: 1, loop: true },
    walkSide: { frames: [8, 7, 8, 7], fps: 8, loop: true },
    hurt: { frames: [9], fps: 1, loop: false },
    death: { frames: [9, 10, 11], fps: 6, loop: false },
  },
};
