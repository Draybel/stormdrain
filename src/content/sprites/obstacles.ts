/**
 * Room obstacles for the Gutterways (16×16 tiles): wooden crates, clay urns, tinted rocks (they hide
 * loot), riveted metal blocks, floor spikes, and a drain fire (basket + animated flame).
 */

import type { SpriteDef } from '../../sim/types';
import { GUTTER, OUTLINE } from './palette';

const o = OUTLINE;

/** Crate: frame 0 intact, frame 1 cracked (one hit left). */
export const CRATE_SPRITE: SpriteDef = {
  id: 'tile.crate',
  w: 16,
  h: 16,
  palette: { o, W: '#9a6a3a', H: '#c89458', d: '#5e3c1e', x: '#7a5028', k: '#24160c' },
  frames: [
    [
      '.oooooooooooooo.',
      'oHHHHHHHHHHHHHHo',
      'oHWWWWWWWWWWWWdo',
      'oHWxWWWWWWWWxWdo',
      'oHWWxWWWWWWxWWdo',
      'oHWWWxWWWWxWWWdo',
      'oHWWWWxWWxWWWWdo',
      'oHWWWWWxxWWWWWdo',
      'oHWWWWWxxWWWWWdo',
      'oHWWWWxWWxWWWWdo',
      'oHWWWxWWWWxWWWdo',
      'oHWWxWWWWWWxWWdo',
      'oHWxWWWWWWWWxWdo',
      'oHWWWWWWWWWWWWdo',
      'oddddddddddddddo',
      '.oooooooooooooo.',
    ],
    [
      '.oooooooooooooo.',
      'oHHHHHkHHHHHHHHo',
      'oHWWWWkWWWWWWWdo',
      'oHWxWWWkWWWWxWdo',
      'oHWWxWWkWWWxWWdo',
      'oHWWWxkWWWxWWWdo',
      'oHWWWWkWWxWWWWdo',
      'oHWWWWWkxWWWkkdo',
      'oHWWWWWxkWWkWWdo',
      'oHkWWWxWWkkWWWdo',
      'oHWkWxWWWWxWWWdo',
      'oHWWkWWWWWWxWWdo',
      'oHWxWkWWWWWWxWdo',
      'oHWWWWkWWWWWWWdo',
      'odddddkdddddddo.',
      '.oooooooooooooo.',
    ],
  ],
};

export const URN_SPRITE: SpriteDef = {
  id: 'tile.urn',
  w: 16,
  h: 16,
  palette: { o, C: '#b8683a', h: '#e89a68', c: '#7a3e22', P: '#e0c080' },
  frames: [
    [
      '................',
      '................',
      '.....oooooo.....',
      '....oCCCCCCo....',
      '.....oCCCCo.....',
      '....oCCCCCCo....',
      '...oCChCCCCCo...',
      '..oCChCCCCCCco..',
      '..oChPPCPPCCco..',
      '..oCCCPPCPPcco..',
      '..oCCCCCCCCcco..',
      '...oCCCCCCcco...',
      '...oCCCCCccco...',
      '....occcccco....',
      '.....oooooo.....',
      '................',
    ],
  ],
};

export const TINTED_ROCK_SPRITE: SpriteDef = {
  id: 'tile.rockTinted',
  w: 16,
  h: 16,
  palette: {
    o,
    R: '#7a6a62',
    L: '#a8988a',
    r: '#51443e',
    T: '#e0a040',
    Y: '#fff0a0',
    g: GUTTER.moss,
    G: GUTTER.mossLight,
  },
  frames: [
    [
      '................',
      '.....oooooo.....',
      '...ooLLLRRRoo...',
      '..oLLLRRRTRRRo..',
      '.oLLRRRRTTRRRro.',
      '.oLRRRRTYTRRRro.',
      'oLRRRRRRTRRRRrro',
      'oLRRTRRRRRRRrrro',
      'oRRRTTRRRRRRrrro',
      'oRRRRTRRRRRrrrro',
      'oGgRRRRRRRTrrrro',
      'oggGRRRRRTTrrrro',
      '.oggggRRRrTrrro.',
      '.oogggrrrrrrroo.',
      '...oooooooooo...',
      '................',
    ],
  ],
};

export const METAL_SPRITE: SpriteDef = {
  id: 'tile.metal',
  w: 16,
  h: 16,
  palette: { o, M: '#6a7388', H: '#a8b2c8', d: '#3a4050', r: '#d8e0f0', b: '#4a5264' },
  frames: [
    [
      'oooooooooooooooo',
      'oHHHHHHHHHHHHHHo',
      'oHrMMMMMMMMMMrdo',
      'oHMMMMMMMMMMMMdo',
      'oHMMbbbbbbbbMMdo',
      'oHMMbMMMMMMbMMdo',
      'oHMMbMHMMMMbMMdo',
      'oHMMbMMHMMMbMMdo',
      'oHMMbMMMHMMbMMdo',
      'oHMMbMMMMHMbMMdo',
      'oHMMbMMMMMMbMMdo',
      'oHMMbbbbbbbbMMdo',
      'oHMMMMMMMMMMMMdo',
      'oHrMMMMMMMMMMrdo',
      'oddddddddddddddo',
      'oooooooooooooooo',
    ],
  ],
};

// ── Spikes: a dark plate with four steel spikes, stamped in code ──────────────
const SPIKE = ['..o..', '.oHo.', '.oHo.', 'oHSdo', 'oHSdo', 'ooooo'];

function buildSpikes(): string[] {
  const g: string[][] = [];
  for (let y = 0; y < 16; y++) {
    const row: string[] = [];
    for (let x = 0; x < 16; x++) {
      const edge = x === 1 || x === 14 || y === 1 || y === 14;
      const inside = x >= 1 && x <= 14 && y >= 1 && y <= 14;
      row.push(!inside ? '.' : edge ? 'P' : 'p');
    }
    g.push(row);
  }
  const at: [number, number][] = [
    [2, 2],
    [9, 3],
    [3, 8],
    [9, 9],
  ];
  for (const [sx, sy] of at) {
    for (let y = 0; y < SPIKE.length; y++) {
      for (let x = 0; x < 5; x++) {
        const ch = SPIKE[y]![x]!;
        if (ch !== '.') g[sy + y]![sx + x] = ch;
      }
    }
  }
  return g.map((r) => r.join(''));
}

export const SPIKES_SPRITE: SpriteDef = {
  id: 'tile.spikes',
  w: 16,
  h: 16,
  palette: { o, P: '#3e455a', p: '#232a3b', H: '#e4ebf7', S: '#a8b2c8', d: '#5d6782' },
  frames: [buildSpikes()],
};

// ── Fire: an iron basket of glowing embers + a flame drawn on top ─────────────
export const FIRE_BASE_SPRITE: SpriteDef = {
  id: 'tile.fireBase',
  w: 16,
  h: 7,
  palette: { o, S: '#5c6580', s: '#3e455a', R: '#ff7a2a', r: '#b83a1a' },
  frames: [
    [
      '...oooooooooo...',
      '.ooRrRrRrRrRroo.',
      'oSSoRrRrRrRroSSo',
      'oSsSooooooooSsSo',
      'oSSsSSsSSsSSsSSo',
      '.oSSsSSsSSsSSso.',
      '..oooooooooooo..',
    ],
  ],
};

/** Flame (12×13), 3 frames. Fewer hits left = drawn with the top rows cut off (a lower flame). */
export const FLAME_SPRITE: SpriteDef = {
  id: 'tile.flame',
  w: 12,
  h: 13,
  anchorX: 6,
  anchorY: 12,
  palette: { R: '#c0401e', O: '#e8862e', Y: '#ffcf57', W: '#fffbe8' },
  frames: [
    [
      '.....R......',
      '....RO......',
      '....ROR..R..',
      '...ROYOR.R..',
      '...ROYYORO..',
      '..ROYYWYOR..',
      '..ROYWWYOR..',
      '.ROYYWWWYOR.',
      '.ROYWWWWYOR.',
      '.ROYWWWWYOR.',
      '..ROYWWYOR..',
      '..RROYYORR..',
      '...RRRRRR...',
    ],
    [
      '......R.....',
      '......OR....',
      '..R..ROR....',
      '..R.ROYOR...',
      '..RORYYOR...',
      '..ROYYWYOR..',
      '..ROYWWYOR..',
      '.ROYYWWWYOR.',
      '.ROYWWWWYOR.',
      '.ROYWWWWYOR.',
      '..ROYWWYOR..',
      '..RROYYORR..',
      '...RRRRRR...',
    ],
    [
      '.....R......',
      '.....OR.....',
      '....ROR.....',
      '....ROYR....',
      '...ROYYOR...',
      '..ROYYWYOR..',
      '..ROYWWYOR..',
      '.ROYYWWWYOR.',
      '.ROYWWWWYOR.',
      '.ROYWWWWYOR.',
      '..ROYWWYOR..',
      '..RROYYORR..',
      '...RRRRRR...',
    ],
  ],
};
