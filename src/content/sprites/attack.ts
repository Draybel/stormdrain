/**
 * Attack-pipeline art (all original pixel maps): the three familiars, the Storm Lance costume (a
 * crackling aura + glowing eyes over Wren), carrier item icons, and `iconFrom` (a familiar sprite
 * centred on a glow disc, used for familiar item icons).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

// ── Familiars (anchored at the feet; 2 frames = idle bob / flicker) ─────────

/** Lamplet: a paper-lantern sprite with a flame on its head and one sleepy eye. */
export const LAMPLET_SPRITE: SpriteDef = {
  id: 'fam.lamplet',
  w: 9,
  h: 12,
  anchorX: 4,
  anchorY: 11,
  palette: { o, R: '#d8503a', r: '#9a3024', L: '#ffd878', e: '#3a1a10', Y: '#ffcf57', W: '#fffbe8', T: '#e8b040' },
  frames: [
    ['....o....', '...oYo...', '...oWo...', '..ooooo..', '.oRRRRRo.', 'oRrLLLrRo', 'oRrLeLrRo', 'oRrLLLrRo', '.oRRRRRo.', '..ooooo..', '...oTo...', '....o....'],
    ['...o.....', '...oYo...', '...oWo...', '..ooooo..', '.oRRRRRo.', 'oRrLLLrRo', 'oRrLLLrRo', 'oRrLeLrRo', '.oRRRRRo.', '..ooooo..', '...oTo...', '....o....'],
  ],
};

/** Paper Boat: a folded paper boat with a little sail. */
export const PAPER_BOAT_SPRITE: SpriteDef = {
  id: 'fam.paper-boat',
  w: 12,
  h: 9,
  anchorX: 6,
  anchorY: 8,
  palette: { o, P: '#f3efe0', p: '#c8c0a8', S: '#e8e0c8', s: '#b0a890', b: '#6fb3e0' },
  frames: [
    ['.....o......', '.....oo.....', '.....oSo....', '.....oSSo...', '.....osSSo..', '.oooooooooo.', 'oPPPPPPPPPPo', '.oPpPPPPpPo.', '..oooooooo..'],
    ['.....o......', '.....oo.....', '.....oSo....', '.....oSSo...', '.....oSsSo..', '.oooooooooo.', 'oPPPPPPPPPPo', '.oPPpPPpPPo.', '.boooooooob.'],
  ],
};

/** Bottlecap Beetle: a beetle wearing a crimped red bottle cap as its shell. */
export const BOTTLECAP_BEETLE_SPRITE: SpriteDef = {
  id: 'fam.bottlecap-beetle',
  w: 10,
  h: 10,
  anchorX: 5,
  anchorY: 9,
  palette: { o, C: '#d8404a', c: '#9a2430', h: '#ffb0a8', K: '#2a2230', W: '#f3e6c8' },
  frames: [
    ['...o..o...', '....oo....', '...oKKo...', '..oCWCWo..', '.oCChCCCo.', 'ooCCCCCcoo', '.oCCCCcco.', 'o.oCccco.o', '...oooo...', '..........'],
    ['..o....o..', '....oo....', '...oKKo...', '..oWCWCo..', '.oCChCCCo.', '.oCCCCCco.', 'ooCCCCccoo', '..oCccco..', 'o..oooo..o', '..........'],
  ],
};

// ── Storm Lance costume ──────────────────────────────────────────────────────

/**
 * Crackling aura (behind Wren, 20×21, feet anchor 10/18): a jagged ring of lightning around her
 * silhouette, 3 animation frames generated from a fixed hash so it flickers without any randomness.
 */
function auraFrames(): string[][] {
  const W = 20;
  const H = 21;
  const frames: string[][] = [];
  for (let f = 0; f < 3; f++) {
    const g: string[][] = [];
    for (let y = 0; y < H; y++) g.push(new Array<string>(W).fill('.'));
    const cx = 9.5;
    const cy = 10;
    const N = 40;
    let px = -1;
    let py = -1;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // Deterministic jag per frame.
      const h = Math.sin(i * 12.9898 + f * 78.233) * 43758.5453;
      const jag = (h - Math.floor(h)) * 2.2 - 1.1;
      const rx = 8.2 + jag;
      const ry = 9.4 + jag;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      if (px >= 0) {
        // Rasterise a short segment from the previous point.
        const steps = Math.max(Math.abs(x - px), Math.abs(y - py), 1);
        for (let s = 0; s <= steps; s++) {
          const lx = Math.round(px + ((x - px) * s) / steps);
          const ly = Math.round(py + ((y - py) * s) / steps);
          if (lx < 0 || ly < 0 || lx >= W || ly >= H) continue;
          // Leave gaps so it reads as crackles, not a solid ring.
          if ((i + f) % 5 === 0) continue;
          g[ly]![lx] = (i + f * 2) % 4 === 0 ? 'w' : (i + s) % 3 === 0 ? 'B' : 'b';
        }
      }
      px = x;
      py = y;
    }
    frames.push(g.map((r) => r.join('')));
  }
  return frames;
}

export const STORM_AURA_SPRITE: SpriteDef = {
  id: 'costume.storm-aura',
  w: 20,
  h: 21,
  anchorX: 10,
  anchorY: 18,
  palette: { b: '#6fc8ff', B: '#3a7ad0', w: '#e8f8ff' },
  frames: auraFrames(),
};

const BLANK_ROW = '..............';
function eyesFrame(points: readonly (readonly [number, number, string])[]): string[] {
  const rows: string[][] = [];
  for (let y = 0; y < 16; y++) rows.push(BLANK_ROW.split(''));
  for (const [x, y, c] of points) rows[y]![x] = c;
  return rows.map((r) => r.join(''));
}

/** Glowing storm eyes over Wren's (frames: facing down, up (none), side). Same anchor as Wren. */
export const STORM_EYES_SPRITE: SpriteDef = {
  id: 'costume.storm-eyes',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { W: '#ffffff', E: '#8fe8ff' },
  frames: [
    eyesFrame([
      [5, 6, 'W'],
      [8, 6, 'W'],
      [5, 7, 'E'],
      [8, 7, 'E'],
    ]),
    eyesFrame([]),
    eyesFrame([
      [10, 6, 'W'],
      [12, 6, 'W'],
      [10, 7, 'E'],
      [12, 7, 'E'],
    ]),
  ],
};

// ── Carrier item icons (14×14) ───────────────────────────────────────────────

export const ICON_STORM_LANCE: SpriteDef = {
  id: 'item.storm-lance',
  w: 14,
  h: 14,
  palette: { o, W: '#f0fbff', b: '#6fc8ff', d: '#3a4a6a', s: '#8aa0c8', y: '#fff27a' },
  frames: [
    [
      '..........ooo.',
      '.........oWWWo',
      '........oWbbWo',
      '.......oWbbWo.',
      '..y...oWbbWo..',
      '...y.oWbbWo...',
      '....odddWo....',
      '...oddddo..y..',
      '..oddso...y...',
      '.oddso........',
      'oddso.........',
      'odso..........',
      '.oo...........',
      '..............',
    ],
  ],
};

export const ICON_NEON_TUBE: SpriteDef = {
  id: 'item.neon-tube',
  w: 14,
  h: 14,
  palette: { o, m: '#9aa6c0', P: '#ff5a78', W: '#ffe0e8', y: '#ff9ab0' },
  frames: [
    [
      '..............',
      '..............',
      '..y......y....',
      '.oooooooooooo.',
      'omPPPPPPPPPPmo',
      'omPWWWWWWWWPmo',
      'omPPPPPPPPPPmo',
      '.oooooooooooo.',
      '..o........o..',
      '..o........o..',
      '.ooo......ooo.',
      '....y.....y...',
      '..............',
      '..............',
    ],
  ],
};

export const ICON_RUSTY_BOOMERANG: SpriteDef = {
  id: 'item.rusty-boomerang',
  w: 14,
  h: 14,
  palette: { o, R: '#c8773a', r: '#8a4a24', h: '#f0b070' },
  frames: [
    [
      '..............',
      '..............',
      '.oo...........',
      'ohRo..........',
      'oRrRo.........',
      '.oRrRo........',
      '..oRrRo.......',
      '...oRrRooooo..',
      '....oRrrrrRRo.',
      '.....oRRRRRrho',
      '......ooooooo.',
      '..............',
      '..............',
      '..............',
    ],
  ],
};

export const ICON_BROKEN_OAR: SpriteDef = {
  id: 'item.broken-oar',
  w: 14,
  h: 14,
  palette: { o, P: '#3f7fbf', h: '#8cc0f0', W: '#b98040' },
  frames: [
    [
      '..........oo..',
      '.........oPPo.',
      '........oPPPPo',
      '.......oPPhPo.',
      '......oPPPPo..',
      '.....oWoPPo...',
      '....oWo.oo....',
      '...oWo........',
      '..oWo.........',
      '.oWo..........',
      'oWo...........',
      'oo............',
      '..............',
      '..............',
    ],
  ],
};

export const ICON_FIRECRACKER_POUCH: SpriteDef = {
  id: 'item.firecracker-pouch',
  w: 14,
  h: 14,
  palette: { o, B: '#8a6a42', b: '#b89363', R: '#e0404a', y: '#fff27a' },
  frames: [
    [
      '...y....y.....',
      '...o....o.....',
      '..oRo..oRo....',
      '..oRo..oRo.y..',
      '..oRooooRo.o..',
      '.oBBBBBBBBoRo.',
      'oBbBBBBBBBoRo.',
      'oBBBBBBBBBBoo.',
      'oBBBbBBBBBBo..',
      'oBBBBBBBBBbo..',
      '.oBBBBBBBBo...',
      '..oooooooo....',
      '..............',
      '..............',
    ],
  ],
};

export const ICON_COILED_SPRING: SpriteDef = {
  id: 'item.coiled-spring',
  w: 14,
  h: 14,
  palette: { o, S: '#e0b040', s: '#9a6a1c', y: '#fff4a0' },
  frames: [
    [
      '...........y..',
      '...oooooooo...',
      '..oSSSSSSSSo..',
      '...oooooosSo..',
      '..oSsooooooo..',
      '..oSSSSSSSSo..',
      '...oooooosSo..',
      '..oSsooooooo..',
      '..oSSSSSSSSo..',
      '...oooooosSo..',
      '..oSsooooooo..',
      '..oSSSSSSSSo..',
      '...oooooooo...',
      '.y............',
    ],
  ],
};

export const ICON_TIN_PINWHEEL: SpriteDef = {
  id: 'item.tin-pinwheel',
  w: 14,
  h: 14,
  palette: { o, S: '#c9d3e6', s: '#7d89a8', y: '#fff4b0' },
  frames: [
    [
      '..............',
      '......o.......',
      '.....oSo......',
      '.....oSo...y..',
      '....oSSso.....',
      '.oooSSsSSooo..',
      'oSSSSsoSSSSSo.',
      '.oooSSsSSooo..',
      '....oSSso.....',
      '.....oSo......',
      '.y...oSo......',
      '......o.......',
      '..............',
      '..............',
    ],
  ],
};

/** A 14×14 icon with a smaller sprite's first frame centred on a soft glow disc. */
export function iconFrom(def: SpriteDef, id: string, disc: string): SpriteDef {
  const rows: string[][] = [];
  for (let y = 0; y < 14; y++) {
    const r: string[] = [];
    for (let x = 0; x < 14; x++) {
      const d = Math.hypot(x - 6.5, y - 7);
      r.push(d < 6.2 ? 'g' : '.');
    }
    rows.push(r);
  }
  const f = def.frames[0]!;
  const ox = Math.floor((14 - def.w) / 2);
  const oy = Math.floor((14 - def.h) / 2) + 1;
  for (let y = 0; y < def.h; y++) {
    for (let x = 0; x < def.w; x++) {
      const ch = f[y]![x]!;
      if (ch === '.' || ch === ' ') continue;
      const ty = y + oy;
      const tx = x + ox;
      if (ty >= 0 && ty < 14 && tx >= 0 && tx < 14) rows[ty]![tx] = ch;
    }
  }
  return { id, w: 14, h: 14, palette: { ...def.palette, g: disc }, frames: [rows.map((r) => r.join(''))] };
}
