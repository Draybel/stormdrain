/**
 * The Rust Foundry (chapter 3, alt track) enemy sprites: slag, cast iron and embers — dark crusts with
 * glowing orange cracks. 1 px dark outline, glowing eyes, `idle` + `move`, `windup` / `air` where it
 * matters. Side views face RIGHT (the renderer mirrors them).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const k = '#10122a';
const w = '#f4fbff';
/** Molten glow (shared). */
const GLOW = { L: '#ff8a30', l: '#ffd060', y: '#fff0a0' } as const;

/** Slag Blob — a hopping lump of cooling slag with glowing cracks (14×12). */
export const SLAG_BLOB_SPRITE: SpriteDef = {
  id: 'enemy.slagBlob',
  w: 14,
  h: 12,
  palette: { o, k, ...GLOW, C: '#4a3434', c: '#2e2024', h: '#6e4c44' },
  frames: [
    [
      '..............',
      '.....oooo.....',
      '...ooCCLCoo...',
      '..oCChCLlCCo..',
      '.oCChCCCLCCCo.',
      '.oCyyCCCCyyCo.',
      'oCLykCCLCykCCo',
      'oCCCLCCCCCLCco',
      'oCLCColllCCLco',
      'ocCCLCCCCCLCco',
      '.occcLcccLcco.',
      '..oooooooooo..',
    ],
    [
      '..............',
      '..............',
      '....oooooo....',
      '..ooCCLlCCoo..',
      '.oCChCClLCCCo.',
      '.oCyyCCCCyyCo.',
      'oClykCCLCykCCo',
      'oCCClCCCCClCco',
      'oCLCColllCClco',
      'ocCClCCCCCLCco',
      '.occcLcccLcco.',
      '..oooooooooo..',
    ],
    [
      '.....oooo.....',
      '....oCLCCo....',
      '...oChCLlCo...',
      '..oCChCCLCCo..',
      '..oCyyCCyyCo..',
      '..oLykCCykCo..',
      '..oCCLCCCLco..',
      '..oCColllCco..',
      '..ocCLCCLCco..',
      '...occLccco...',
      '....oooooo....',
      '..............',
    ],
    [
      '..............',
      '..............',
      '..............',
      '....oooooo....',
      '..ooCCLlCCoo..',
      '.oChCCCCCLCCo.',
      'oCLyyCCCCyyCCo',
      'oCCykCLCCykLco',
      'oCLCColllCCLco',
      'ocCCLCCCCCLCco',
      '.occcLcccLcco.',
      '..oooooooooo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 6, loop: true },
    air: { frames: [2], fps: 1, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Potbelly — a squat cast-iron stove on stubby legs, its grate mouth glowing (14×16). */
const STOVE_TOP = ['.......oooo...', '.......ohIo...', '.......oIio...', '...ooooooooo..', '..ohIIIIIIIIo.', '.ohIIIIIIIIIIo'];
const STOVE_GRATE = ['.oIIoooooooIIo', '.oIoGiGiGiGoIo', '.oIoGiGiGiGoIo', '.oIogigigigoIo', '.oIIoooooooIIo', '.oiiiiiiiiiiio', '.ooooooooooooo'];
export const POTBELLY_SPRITE: SpriteDef = {
  id: 'enemy.potbelly',
  w: 14,
  h: 16,
  palette: { o, k, w, I: '#4e4e60', i: '#2e2e3a', h: '#7a7a94', G: '#ff9a40', g: '#ffd070', y: '#fff0a0', S: '#8a8494' },
  frames: [
    [...STOVE_TOP, '.oIIwwIIIwwIIo', '.oIIwkIIIwkIIo', ...STOVE_GRATE, '..oio....oio..'],
    [
      ...STOVE_TOP,
      '.oIIwwIIIwwIIo',
      '.oIIwkIIIwkIIo',
      '.oIIoooooooIIo',
      '.oIogigigigoIo',
      '.oIoGiGiGiGoIo',
      '.oIoGiGiGiGoIo',
      '.oIIoooooooIIo',
      '.oiiiiiiiiiiio',
      '.ooooooooooooo',
      '..oio....oio..',
    ],
    [...STOVE_TOP, '.oIIwwIIIwwIIo', '.oIIwkIIIwkIIo', ...STOVE_GRATE, '.oio......oio.'],
    [
      '......SoooS...',
      '.......ohIo.S.',
      '.......oIio...',
      '...ooooooooo..',
      '..ohIIIIIIIIo.',
      '.ohIooIIIooIIo',
      '.oIIwkIIIkwIIo',
      '.oIIwwIIIwwIIo',
      '.oIIoooooooIIo',
      '.oIogygygygoIo',
      '.oIogygygygoIo',
      '.oIogygygygoIo',
      '.oIIoooooooIIo',
      '.oiiiiiiiiiiio',
      '.ooooooooooooo',
      '..oio....oio..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 2], fps: 5, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Slag Crucible — a heavy crucible brimming with slag, glaring over its rim (16×14). */
const CRUCIBLE_BODY = [
  'oIIIIIIIIIIIIIIo',
  'ohIIwwIIIIwwIIIo',
  'oIIIwkIIIIkwIIIo',
  '.oIIIIIIIIIIIIo.',
  '.oIIIIIIIIIIIIo.',
  '.ohIIIIIIIIIIio.',
  '..oiIIIIIIIIio..',
  '...oiiiiiiiio...',
  '..oLooooooooLo..',
  '.oLlLo....oLlLo.',
];
export const SLAG_CRUCIBLE_SPRITE: SpriteDef = {
  id: 'enemy.slagCrucible',
  w: 16,
  h: 14,
  palette: { o, k, w, ...GLOW, I: '#56545f', i: '#34323c', h: '#86849a' },
  frames: [
    ['.....l.....l....', '..oooooooooooo..', '.olLLlLLLLlLLlo.', '.oLLLLLlLLLLLLo.', ...CRUCIBLE_BODY],
    ['........l.....l.', '..oooooooooooo..', '.oLLlLLLlLLLlLo.', '.oLlLLLLLLlLLLo.', ...CRUCIBLE_BODY],
    [
      '..y..l..y..l..y.',
      '..oooooooooooo..',
      '.olyylllyylllyo.',
      '.oLlLLLlLLLlLLo.',
      'oIIIIIIIIIIIIIIo',
      'ohIooIIIIIIooIIo',
      'oIIIkwIIIIwkIIIo',
      '.oIIIIIIIIIIIIo.',
      '.oIIIIIIIIIIIIo.',
      '.ohIIIIIIIIIIio.',
      '..oiIIIIIIIIio..',
      '...oiiiiiiiio...',
      '..oLooooooooLo..',
      '.oLlLo....oLlLo.',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 3, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/**
 * Clinker — a lump of coal that plays dead (12×11). Idle = a dull black lump with a faint red glint,
 * windup = cracks flaring as it wakes, move = glowing eyes and scuttling legs.
 */
export const CLINKER_SPRITE: SpriteDef = {
  id: 'enemy.clinker',
  w: 12,
  h: 11,
  palette: { o, k, ...GLOW, C: '#302c34', c: '#1c1a22', h: '#4e4858', r: '#7a3226' },
  frames: [
    [
      '............',
      '....ooooo...',
      '..ooChhCCo..',
      '.oChCCCCCCo.',
      'oChCCrCCCCco',
      'oCCCCCCCCCco',
      'oCCCCCCCrcco',
      '.oCCCCCcCco.',
      '.occcCcccco.',
      '..oooooooo..',
      '............',
    ],
    [
      '............',
      '....ooooo...',
      '..ooChhCCo..',
      '.oChCCCCCCo.',
      'oChCCCCCCCco',
      'oCCCCCCrCCco',
      'oCCCCCCCCcco',
      '.oCrCCCcCco.',
      '.occcCcccco.',
      '..oooooooo..',
      '............',
    ],
    [
      '............',
      '....ooooo...',
      '..ooCLhCCo..',
      '.oChlCCCLCo.',
      'oCLCCLCCCLco',
      'oCCyyCCyyCco',
      'oLCCCllCCCLo',
      '.oCLCCCLCCo.',
      '.occLccLcco.',
      '..oooooooo..',
      '............',
    ],
    [
      '....ooooo...',
      '..ooCLhCCo..',
      '.oCLlCCCLCo.',
      'oCyyCCCyyCco',
      'oCykCLCykCco',
      'oLCCClllCCLo',
      '.oCCLCCCLCo.',
      '.occcLcccco.',
      '..oooooooo..',
      '..oco..oco..',
      '..oo....oo..',
    ],
    [
      '............',
      '....ooooo...',
      '..ooCLhCCo..',
      '.oCLlCCCLCo.',
      'oCyyCCCyyCco',
      'oCykCLCykCco',
      'oLCCClllCCLo',
      '.oCCLCCCLCo.',
      '.occcLcccco.',
      '..oooooooo..',
      '.oco....oco.',
    ],
  ],
  anims: {
    idle: { frames: [0, 0, 1], fps: 2, loop: true },
    move: { frames: [3, 4], fps: 9, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
