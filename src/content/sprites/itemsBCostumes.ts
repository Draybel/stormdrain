/**
 * Costume layers for the "items B" passives and the four set transformations they belong to
 * (all original pixel maps). Anchored like Wren (14 wide, feet at the bottom row): a 16-row layer
 * lines up with her frame row for row; 20-row hats reach 4 rows above her hood.
 *
 * Items: Paper Crown, Cast-Iron Kettle (a kettle worn as a helmet), Bone Jacks (a bone hair clip),
 * Bundle of Balloons (behind, swaying), Bedsheet Ghost (a sheet with eye holes, boots poking out),
 * Glowstone Pendant (a glowing crystal on the chest) and Cracked Cat's-Eye (eyes).
 * Sets: Toybox (patchwork), Ossuary (bone mask), Tidewalker (a wet shimmer + falling drops),
 * Glimmer (crystal growths and glints).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const EMPTY_ROW = '..............';

/** An `h`-row frame with `rows` placed from row `top` (other rows transparent). */
function layer(h: number, top: number, rows: readonly string[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < h; y++) out.push(y >= top && y < top + rows.length ? rows[y - top]! : EMPTY_ROW);
  return out;
}

/** A 16-row frame from (x, y, palette key) points (eyes, patches). */
function points(pts: readonly (readonly [number, number, string])[]): string[] {
  const rows: string[][] = [];
  for (let y = 0; y < 16; y++) rows.push(EMPTY_ROW.split(''));
  for (const [x, y, c] of pts) rows[y]![x] = c;
  return rows.map((r) => r.join(''));
}

/** A deterministic 0..1 hash (no randomness in content). */
function hash(i: number, f: number): number {
  const h = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

// ── Item costumes ────────────────────────────────────────────────────────────

const CROWN = ['...o..oo..o...', '..oPooPPooPo..', '..ohPPPPPPPo..', '..oRPRPPRPRo..', '...oooooooo...'];
const CROWN_SIDE = ['..o..oo..o....', '.oPooPPooPo...', '.ohPPPPPPPo...', '.oRPRPPRPRo...', '..oooooooo....'];

/** Paper Crown: a gold paper crown with red dots, sitting on the hood (down, up, side). */
export const COSTUME_PAPER_CROWN: SpriteDef = {
  id: 'costume.paper-crown',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, P: '#ffd35a', h: '#fff4b0', R: '#e0515a' },
  frames: [layer(20, 1, CROWN), layer(20, 1, CROWN), layer(20, 1, CROWN_SIDE)],
};

const KETTLE = [
  '......s.......',
  '.....oooo..s..',
  '....o....o....',
  '...oooooooo...',
  '..oKKhKKKKKo..',
  '.oKKhKKKKKKKo.',
  '.oKhKKKKKKKKo.',
  'oRRRRRRRRRRRRo',
  '.oooooooooooo.',
];
const KETTLE_SIDE = [
  '.....s........',
  '....oooo..s...',
  '...o....o.....',
  '..oooooooo....',
  '.oKKhKKKKKo...',
  'oKKhKKKKKKKo..',
  'oKhKKKKKKKKKo.',
  'oRRRRRRRRRRRRo',
  'oooooooooooo..',
];

/** Cast-Iron Kettle: an iron kettle pulled down over the hood like a helmet, still steaming. */
export const COSTUME_KETTLE_HELMET: SpriteDef = {
  id: 'costume.kettle-helmet',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, K: '#3a3a48', h: '#8a8aa0', R: '#b86a3a', s: '#d8e0f0' },
  frames: [layer(20, 0, KETTLE), layer(20, 0, KETTLE), layer(20, 0, KETTLE_SIDE)],
};

/** Bone Jacks: a little bone clipped into the hood (one frame, mirrored with Wren). */
export const COSTUME_BONE_CLIP: SpriteDef = {
  id: 'costume.bone-clip',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, W: '#f0e6cc' },
  frames: [layer(20, 3, ['.o.....o......', 'oWoooooWo.....', '.oWWWWWo......', 'oWoooooWo.....', '.o.....o......'])],
};

/**
 * Bundle of Balloons: three balloons floating high above and behind Wren on tangled strings
 * (26 rows: 10 above her hood; 2-frame sway).
 */
export const COSTUME_BALLOONS: SpriteDef = {
  id: 'costume.balloons',
  w: 14,
  h: 26,
  anchorX: 7,
  anchorY: 25,
  palette: { o, R: '#e0515a', B: '#4a7ad0', Y: '#ffcf57', h: '#ffffff', s: '#d8d0b8' },
  frames: [
    layer(26, 0, [
      '.ooo.....ooo..',
      'ohRRo...ohBBo.',
      'oRRRo...oBBBo.',
      'oRRRoooooBBBo.',
      '.oRoohYYooBo..',
      '..o.oYYYo.o...',
      '...soYYYos....',
      '....soYos.....',
      '.....sos......',
      '......s.......',
      '......s.......',
    ]),
    layer(26, 0, [
      '..ooo.....ooo.',
      '.ohRRo...ohBBo',
      '.oRRRo...oBBBo',
      '.oRRRoooooBBBo',
      '..oRoohYYooBo.',
      '...o.oYYYo.o..',
      '...soYYYos....',
      '....soYos.....',
      '.....sos......',
      '......s.......',
      '......s.......',
    ]),
  ],
};

/** Bedsheet Ghost: a white sheet over Wren with eye holes (her eyes peek through); boots show. */
export const COSTUME_BEDSHEET: SpriteDef = {
  id: 'costume.bedsheet',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { o, W: '#e8eef8', w: '#b8c0d8', h: '#ffffff' },
  frames: [
    [
      '....oooooo....',
      '..ooWWWWWWoo..',
      '.oWhhWWWWWWwo.',
      'oWhWWWWWWWWWwo',
      'oWhWWWWWWWWWwo',
      'oWhWWWWWWWWwwo',
      'oWWW..WW..Wwwo',
      'oWWW..WW..Wwwo',
      'oWhWWWWWWWWwwo',
      'oWhWWWWWWWWwwo',
      'oWhWWWWWWWWwwo',
      'oWWWWWWWWWWwwo',
      'oWWWWWWWWWwwwo',
      '.oWwoWWoWwoWo.',
      EMPTY_ROW,
      EMPTY_ROW,
    ],
    [
      '....oooooo....',
      '..ooWWWWWWoo..',
      '.oWhhWWWWWWwo.',
      'oWhWWWWWWWWWwo',
      'oWhWWWWWWWWWwo',
      'oWhWWWWWWWWwwo',
      'oWWWWWWWWWWwwo',
      'oWWWWWWWWWWwwo',
      'oWhWWWWWWWWwwo',
      'oWhWWWWWWWWwwo',
      'oWhWWWWWWWWwwo',
      'oWWWWWWWWWWwwo',
      'oWWWWWWWWWwwwo',
      '.oWwoWWoWwoWo.',
      EMPTY_ROW,
      EMPTY_ROW,
    ],
    [
      '...oooooo.....',
      '.ooWWWWWWoo...',
      'oWhhWWWWWWWo..',
      'oWhWWWWWWWWWo.',
      'oWhWWWWWWWWWWo',
      'oWWWWWWWWWWWWo',
      'oWWWWWWWWW.W.o',
      'owWWWWWWWW.W.o',
      '.owWWWWWWWWWWo',
      '.owwWWWWWWWWWo',
      '.oWWWWWWWWWwo.',
      '.ohWWWWWWWWwo.',
      '.oWWWWWWWWwwo.',
      '..oWoWWoWWoo..',
      EMPTY_ROW,
      EMPTY_ROW,
    ],
  ],
};

/** Glowstone Pendant: a glowing teal crystal hanging on the chest (hidden from behind). */
export const COSTUME_PENDANT: SpriteDef = {
  id: 'costume.glowstone-pendant',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { o, C: '#7fe8d8', c: '#3aa89a', h: '#ffffff', s: '#c8b898' },
  frames: [
    points([
      [5, 9, 's'], [8, 9, 's'], [6, 10, 'o'], [7, 10, 'o'],
      [5, 11, 'o'], [6, 11, 'h'], [7, 11, 'C'], [8, 11, 'o'],
      [5, 12, 'o'], [6, 12, 'c'], [7, 12, 'c'], [8, 12, 'o'],
      [6, 13, 'o'], [7, 13, 'o'],
    ]),
    points([]),
    points([[10, 10, 'o'], [9, 11, 'o'], [10, 11, 'h'], [11, 11, 'o'], [9, 12, 'o'], [10, 12, 'c'], [11, 12, 'o'], [10, 13, 'o']]),
  ],
};

/** Cracked Cat's-Eye: one eye turns into a glinting mint crystal. */
export const COSTUME_CATS_EYE: SpriteDef = {
  id: 'costume.cats-eye',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { C: '#b8ffe8', c: '#3ad8a8', s: '#ffffff' },
  frames: [
    points([[8, 6, 'C'], [8, 7, 'c'], [9, 4, 's']]),
    points([]),
    points([[12, 6, 'C'], [12, 7, 'c'], [12, 4, 's']]),
  ],
};

// ── Set transformations ──────────────────────────────────────────────────────

/** A 3-wide checked patch (colours a / b, `rows` tall) with its top-left corner at (x, y). */
function patch(x: number, y: number, a: string, b: string, rows = 3): [number, number, string][] {
  const out: [number, number, string][] = [];
  for (let dy = 0; dy < rows; dy++) for (let dx = 0; dx < 3; dx++) out.push([x + dx, y + dy, (dx + dy) % 2 === 0 ? a : b]);
  return out;
}

/** Toybox: bold checked patches sewn onto the raincoat, with dark stitches (down, up, side). */
export const COSTUME_PATCHWORK: SpriteDef = {
  id: 'costume.set.patchwork',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { R: '#e0515a', r: '#f3e6c8', B: '#4a7ad0', b: '#8ab0f0', G: '#5fbf6a', g: '#b8f0a0', x: '#3a2a40' },
  frames: [
    points([
      ...patch(1, 10, 'R', 'r'),
      ...patch(9, 10, 'B', 'b'),
      ...patch(8, 2, 'G', 'g', 2),
      [4, 11, 'x'], [8, 11, 'x'], [7, 2, 'x'], [2, 3, 'x'], [3, 2, 'x'],
    ]),
    points([
      ...patch(2, 10, 'R', 'r'),
      ...patch(3, 2, 'G', 'g'),
      [5, 11, 'x'], [6, 3, 'x'], [10, 3, 'x'], [11, 4, 'x'],
    ]),
    points([
      ...patch(2, 10, 'R', 'r'),
      ...patch(2, 2, 'G', 'g'),
      [8, 11, 'B'], [9, 11, 'b'], [8, 12, 'b'], [9, 12, 'B'],
      [5, 11, 'x'], [5, 3, 'x'], [7, 12, 'x'],
    ]),
  ],
};

/** Ossuary: a bone mask over the hood opening, sockets glowing a pale green (down, up, side). */
export const COSTUME_BONE_MASK: SpriteDef = {
  id: 'costume.set.bone-mask',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { W: '#f0e6cc', w: '#c8b898', k: '#1d1830', G: '#a0ffd8', n: '#3a3040' },
  frames: [
    points([
      [4, 5, 'W'], [5, 5, 'W'], [6, 5, 'W'], [7, 5, 'W'], [8, 5, 'W'], [9, 5, 'w'],
      [4, 6, 'W'], [5, 6, 'k'], [6, 6, 'W'], [7, 6, 'W'], [8, 6, 'k'], [9, 6, 'w'],
      [4, 7, 'W'], [5, 7, 'G'], [6, 7, 'W'], [7, 7, 'W'], [8, 7, 'G'], [9, 7, 'w'],
      [5, 8, 'w'], [6, 8, 'n'], [7, 8, 'n'], [8, 8, 'w'],
    ]),
    points([]),
    points([
      [9, 5, 'W'], [10, 5, 'W'], [11, 5, 'W'], [12, 5, 'W'],
      [9, 6, 'W'], [10, 6, 'k'], [11, 6, 'W'], [12, 6, 'k'],
      [9, 7, 'W'], [10, 7, 'G'], [11, 7, 'W'], [12, 7, 'G'],
      [9, 8, 'w'], [10, 8, 'W'], [11, 8, 'W'], [12, 8, 'n'],
    ]),
  ],
};

/**
 * Tidewalker: a shimmering ring of water around Wren's silhouette plus a few drops falling past her
 * (behind, 20×21, feet anchor 10/18, 3 frames generated from a fixed hash).
 */
function shimmerFrames(): string[][] {
  const W = 20;
  const H = 21;
  const frames: string[][] = [];
  const dropX = [2, 9, 17];
  for (let f = 0; f < 3; f++) {
    const g: string[][] = [];
    for (let y = 0; y < H; y++) g.push(new Array<string>(W).fill('.'));
    const N = 44;
    for (let i = 0; i < N; i++) {
      const h = hash(i, f);
      if (h < 0.35) continue; // sparse: it glints rather than outlines
      const a = (i / N) * Math.PI * 2;
      const x = Math.round(9.5 + Math.cos(a) * (8.3 + (h - 0.7) * 1.4));
      const y = Math.round(10.5 + Math.sin(a) * (9.3 + (h - 0.7) * 1.4));
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      g[y]![x] = h > 0.88 ? 'w' : (i + f) % 2 === 0 ? 'b' : 'B';
    }
    // Drops falling past (a bright head with a short trail above it).
    for (let d = 0; d < dropX.length; d++) {
      const x = dropX[d]!;
      const y = 1 + ((d * 4 + f * 3) % 9);
      g[y]![x] = 'w';
      if (y > 0) g[y - 1]![x] = 'b';
    }
    frames.push(g.map((r) => r.join('')));
  }
  return frames;
}

export const COSTUME_WET_SHIMMER: SpriteDef = {
  id: 'costume.set.wet-shimmer',
  w: 20,
  h: 21,
  anchorX: 10,
  anchorY: 18,
  palette: { b: '#6fb8ff', B: '#3a78c0', w: '#e0f4ff' },
  frames: shimmerFrames(),
};

/** Glimmer: violet crystals growing out of the hood and two gems on the coat, glinting (2 frames). */
export const COSTUME_CRYSTAL_SKIN: SpriteDef = {
  id: 'costume.set.crystal-skin',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, C: '#c9a0ff', c: '#7fe8ff', h: '#ffffff' },
  frames: [
    [
      ...layer(15, 1, ['......o.......', '..o..oCo..o...', '.oCo.oCo.oco..', '.oCooChCooco..', '..oCCCCCcco...']),
      '..C........c..',
      '..............',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
    ],
    [
      ...layer(15, 1, ['......o.......', '..o..oCo..o...', '.oho.oCo.oco..', '.oCooCCCooho..', '..oCCCCCcco...']),
      '..c........C..',
      '..............',
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
    ],
  ],
};
