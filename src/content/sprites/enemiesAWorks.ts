/**
 * The Grinding Works (chapter 3, main track) enemy sprites: clockwork, gears and steam in brass,
 * copper and tin. 1 px dark outline, big eyes, `idle` + `move`, `windup` where it matters. Side views
 * face RIGHT (the renderer mirrors them). The Runaway Cog's spin frames are rasterised once at load
 * (a toothed disc at four rotations) with its face stamped on top.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const k = '#10122a';
const w = '#f4fbff';

/**
 * A toothed gear as pixel rows: `size`² px, body radius `rim`, `teeth` teeth rotated by `rot` rad.
 * Filled pixels on the silhouette's edge become the outline 'o'; inside: 'h' lit (top-left), 'B'
 * body, 'b' shade (bottom-right).
 */
function gearRows(size: number, rim: number, teeth: number, rot: number): string[] {
  const c = (size - 1) / 2;
  const filled = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    const dx = x - c;
    const dy = y - c;
    const r = Math.sqrt(dx * dx + dy * dy);
    const tooth = Math.cos((Math.atan2(dy, dx) - rot) * teeth) > -0.1;
    return r <= (tooth ? rim + 2.1 : rim + 0.4);
  };
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = '';
    for (let x = 0; x < size; x++) {
      if (!filled(x, y)) row += '.';
      else if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) row += 'o';
      else {
        const dx = x - c;
        const dy = y - c;
        const s = dx + dy;
        // A dark groove rings the hub; lit top-left, shaded bottom-right.
        const r = Math.sqrt(dx * dx + dy * dy);
        row += r > rim - 1.3 && r < rim - 0.3 ? 'b' : s < -5 ? 'h' : s > 5 ? 'b' : 'B';
      }
    }
    rows.push(row);
  }
  return rows;
}

/** Stamps `face` (rows of the same width; '.' = keep) over `rows`, starting at row `top`. */
function stamp(rows: readonly string[], face: readonly string[], top: number): string[] {
  return rows.map((row, y) => {
    const f = face[y - top];
    if (!f) return row;
    let out = '';
    for (let x = 0; x < row.length; x++) out += f[x] === '.' ? row[x] : f[x];
    return out;
  });
}

/** Runaway Cog — a slipped brass gear with a gritted-teeth face, spinning as it ricochets (15×15). */
const COG_FACE = [
  '...............',
  '....wwB..wwB...',
  '....wkB..wkB...',
  '...............',
  '.....otttto....',
  '.....oooooo....',
];
const COG_FACE_WIND = [
  '...o.......o...',
  '....ooB..Boo...',
  '....wkB..Bkw...',
  '...............',
  '....otttttto...',
  '....oooooooo...',
];
const COG_SPIN = [0, 1, 2, 3].map((i) => gearRows(15, 4.7, 8, (i * Math.PI) / 16));
export const RUNAWAY_COG_SPRITE: SpriteDef = {
  id: 'enemy.runawayCog',
  w: 15,
  h: 15,
  palette: { o, k, w, B: '#d0a040', b: '#8a6424', h: '#f8e098', t: '#f4efe0' },
  frames: [...COG_SPIN.map((g) => stamp(g, COG_FACE, 4)), stamp(COG_SPIN[0]!, COG_FACE_WIND, 4)],
  anims: {
    idle: { frames: [0, 2], fps: 2, loop: true },
    move: { frames: [0, 1, 2, 3], fps: 14, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
  },
};

/** Whistling Kettle — a dented copper kettle on little legs that boils over (16×14), side view. */
const KETTLE_TOP = ['.....oooooo.....', '....oHHHHHHo....', '....oHo..oHo....', '...ooooKKoooo...'];
const KETTLE_BODY = [
  '..ohCCCCCCCCo.oo',
  '.ohCCCCCCCCCCoCo',
  'ohCCCwwCCwwCCoCo',
  'oCCCCwkCCwkCCCCo',
  'oCCCCCCmmCCCCCo.',
  'ocCCCCCCCCCCCco.',
  '.occcccccccccco.',
  '..oooooooooooo..',
];
export const WHISTLING_KETTLE_SPRITE: SpriteDef = {
  id: 'enemy.whistlingKettle',
  w: 16,
  h: 14,
  palette: {
    o,
    k,
    w,
    C: '#d07a48',
    c: '#8a4628',
    h: '#f4b088',
    H: '#4a3a44',
    K: '#2e2434',
    m: '#3a1a14',
    S: '#e8eef8',
  },
  frames: [
    [...KETTLE_TOP, ...KETTLE_BODY, '...oco....oco...', '...oo.....oo....'],
    ['.....oooooo.....', '....oHHHHHHo....', '....oHooooHo....', '...oooKKooooo...', ...KETTLE_BODY, '...oco....oco...', '...oo.....oo....'],
    [...KETTLE_TOP, ...KETTLE_BODY, '..oco....oco....', '..oo.....oo.....'],
    [
      '.....oooooo.S.S.',
      '....oHHHHHHo.S..',
      '....oHooooHoS.S.',
      '...oooKKoooo..S.',
      '..ohCCCCCCCCo.oo',
      '.ohCCooCCooCCoCo',
      'ohCCCwkCCkwCCoCo',
      'oCCCCwwCCwwCCCCo',
      'oCCCCCmmmCCCCCo.',
      'ocCCCCmmmCCCCco.',
      '.occcccccccccco.',
      '..oooooooooooo..',
      '...oco....oco...',
      '...oo.....oo....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 2], fps: 7, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Tick-Tock Mouse — a tin wind-up mouse with a brass key and a spring tail (14×10), side view. */
const MOUSE_BODY = ['...oooooooo...', '..ohTTTTTwwo..', '.oTTTTTTTwkoo.', 'soTTTTTTTTTTnn', 's.ottttttttoo.'];
export const TICKTOCK_MOUSE_SPRITE: SpriteDef = {
  id: 'enemy.ticktockMouse',
  w: 14,
  h: 10,
  palette: {
    o,
    k,
    w,
    T: '#a8b0c4',
    t: '#6a7390',
    h: '#e0e6f0',
    E: '#e8a0b0',
    e: '#b86a80',
    K: '#d8b050',
    j: '#8a6a2a',
    n: '#f090a0',
    s: '#c4ccdc',
    W: '#3a3448',
  },
  frames: [
    ['...oKo........', '..oKoKo..oo...', '...oKo..oEEo..', '....j...oEeo..', ...MOUSE_BODY, '...oWo..oWo...'],
    ['..............', '...oKKo..oo...', '...oKKo.oEEo..', '....j...oEeo..', ...MOUSE_BODY, '...oWo..oWo...'],
    [
      '...oKo........',
      '..oKoKo..oo...',
      '...oKo..oEEo..',
      '....j...oEeo..',
      '...oooooooo...',
      '..ohTTTTTkko..',
      '.oTTTTTTTwkoo.',
      'soTTTTTTTTTTnn',
      '.sottttttttoo.',
      '..oWo....oWo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 4, loop: true },
    move: { frames: [0, 1], fps: 14, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Mad Cuckoo — a cuckoo clock that strikes far too often; the bird bursts out to fire (16×18). */
const CLOCK_ROOF = [
  '.......oo.......',
  '......oRRo......',
  '.....oRhRRo.....',
  '....oRhRRRRo....',
  '...oRhRRRRRRo...',
  '..oRRRRRRRRRRo..',
  '.orrrrrrrrrrrro.',
  '.oooooooooooooo.',
];
const CLOCK_FACE = [
  '..oWooooooooWo..',
  '..oWoFFFFFFoWo..',
  '..oWowkFFwkoWo..',
  '..oWoFFkFFFoWo..',
  '..oWoFFkkkFoWo..',
  '..oWooooooooWo..',
  '..oooooooooooo..',
];
export const MAD_CUCKOO_SPRITE: SpriteDef = {
  id: 'enemy.madCuckoo',
  w: 16,
  h: 18,
  palette: {
    o,
    k,
    w,
    R: '#7a3e2a',
    r: '#4e2418',
    h: '#a86248',
    W: '#b0784a',
    D: '#3a2018',
    F: '#f0e4c8',
    G: '#d8b050',
    B: '#e05a4a',
    Y: '#ffcf57',
  },
  frames: [
    [...CLOCK_ROOF, '..oWWWoDDoWWWo..', '..oWWWoDDoWWWo..', ...CLOCK_FACE, '....oGo..oGo....'],
    [...CLOCK_ROOF, '..oWWWoDDoWWWo..', '..oWWWoDDoWWWo..', ...CLOCK_FACE, '.....oGooGo.....'],
    [
      ...CLOCK_ROOF.slice(0, 7),
      '.oooooBBBBooooo.',
      '..oWWoBwkBYoWo..',
      '..oWWoBBBBYoWo..',
      '..oWooooooooWo..',
      '..oWoFFFFFFoWo..',
      '..oWokwFFwkoWo..',
      '..oWoFFFFFFoWo..',
      '..oWoFkkkkFoWo..',
      '..oWooooooooWo..',
      '..oooooooooooo..',
      '....oGo..oGo....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 2, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
