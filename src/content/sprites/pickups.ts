/**
 * Pickups, chests, the item pedestal, the placed bomb and the small HUD counter icons.
 * Original pixel art (DESIGN.md "Pickups"): copper/silver/gold/lucky coins, bombs, keys, hearts
 * (red, Tin, Ember), Spark Cells, the Satchel and the Lockbox.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE, UI } from './palette';

const o = OUTLINE;

// ── Coins (7×7): frame 0 face, frame 1 edge-on (a quick glint-spin) ───────────
const COIN_FACE = ['..ooo..', '.oHCCo.', 'oHCCCco', 'oCCsCco', 'oCCCcco', '.occco.', '..ooo..'];
const COIN_EDGE = ['...o...', '..oHo..', '..oCo..', '..oCo..', '..oco..', '..oco..', '...o...'];

function coin(id: string, C: string, H: string, c: string, s: string): SpriteDef {
  return { id, w: 7, h: 7, anchorX: 3, anchorY: 6, palette: { o, C, H, c, s }, frames: [COIN_FACE, COIN_EDGE] };
}

export const COIN_COPPER_SPRITE = coin('pickup.coin', '#c8773a', '#f0b070', '#8a4a22', '#a85e2c');
export const COIN_SILVER_SPRITE = coin('pickup.silverCoin', '#b8c2d8', '#ffffff', '#6f7a96', '#8f9ab4');
export const COIN_GOLD_SPRITE = coin('pickup.goldCoin', '#f2c230', '#fff4a8', '#b07818', '#d49a20');

export const COIN_LUCKY_SPRITE: SpriteDef = {
  id: 'pickup.luckyCoin',
  w: 7,
  h: 7,
  anchorX: 3,
  anchorY: 6,
  palette: { o, C: '#f2c230', H: '#fff4a8', c: '#b07818', g: '#3aa856' },
  frames: [['..ooo..', '.oHgCo.', 'oHgggco', 'oCgggco', 'oCCgcco', '.occco.', '..ooo..'], COIN_EDGE],
};

// ── Bomb (10×10), also the placed bomb ───────────────────────────────────────
export const BOMB_SPRITE: SpriteDef = {
  id: 'pickup.bomb',
  w: 10,
  h: 10,
  anchorX: 4,
  anchorY: 9,
  palette: { o, B: '#2d3346', h: '#7d89a8', b: '#1c2030', f: '#b98040', s: '#ffcf57', S: '#fff3b0' },
  frames: [
    [
      '.......s..',
      '......fsS.',
      '.....f.s..',
      '...oooo...',
      '..oBBBho..',
      '.oBBBBBho.',
      '.oBBBBBBo.',
      '.oBBBBBbo.',
      '..oBBbbo..',
      '...oooo...',
    ],
  ],
};

// ── Key (10×6) ───────────────────────────────────────────────────────────────
export const KEY_SPRITE: SpriteDef = {
  id: 'pickup.key',
  w: 10,
  h: 6,
  anchorX: 5,
  anchorY: 5,
  palette: { o, Y: '#f2c230', h: '#fff4a8', y: '#b07818' },
  frames: [['.ooo......', 'oYhYo.....', 'oh.Yoooooo', 'oYYYYYYYyo', '.oooYoYooo', '....ooo...']],
};

// ── Hearts (9×8): red full/half reuse the HUD heart; bonus hearts here ───────
const HEART_FULL = ['.oo...oo.', 'oAAo.oAAo', 'oAhAAAAdo', 'oAArAAAdo', '.oAAAAdo.', '..oAAdo..', '...oAo...', '....o....'];
const HEART_HALF = ['.oo...oo.', 'oAAo.oxxo', 'oAhAAxxxo', 'oAArAxxxo', '.oAAAxxo.', '..oAAxo..', '...oAo...', '....o....'];

/** Frames: 0 tin full, 1 tin half, 2 ember full, 3 ember half. (Palette letters swap per kind.) */
export const TIN_HEART_SPRITE: SpriteDef = {
  id: 'heart.tin',
  w: 9,
  h: 8,
  anchorX: 4,
  anchorY: 7,
  palette: { o, A: '#9aa6c0', h: '#e4ebf7', d: '#5d6782', r: '#3d4560', x: '#2a2432' },
  frames: [HEART_FULL, HEART_HALF],
};

export const EMBER_HEART_SPRITE: SpriteDef = {
  id: 'heart.ember',
  w: 9,
  h: 8,
  anchorX: 4,
  anchorY: 7,
  palette: { o, A: '#ff7a2a', h: '#ffd36b', d: '#b83a1a', r: '#ffb347', x: '#2a2432' },
  frames: [HEART_FULL, HEART_HALF],
};

/** Red hearts with a world anchor (the HUD's HEART_SPRITE has none). 0 full, 1 half. */
export const RED_HEART_SPRITE: SpriteDef = {
  id: 'heart.red',
  w: 9,
  h: 8,
  anchorX: 4,
  anchorY: 7,
  palette: { o, A: UI.heart, h: '#ff9aa0', d: '#a83240', r: '#e0515a', x: '#3a1d26' },
  frames: [HEART_FULL, HEART_HALF],
};

// ── Spark Cells ──────────────────────────────────────────────────────────────
export const SPARK_SMALL_SPRITE: SpriteDef = {
  id: 'pickup.sparkSmall',
  w: 7,
  h: 9,
  anchorX: 3,
  anchorY: 8,
  palette: { o, G: '#2f6f8f', g: '#5fb0d8', M: '#9aa6c0', Y: '#fff27a' },
  frames: [['..ooo..', '.oMMMo.', 'oGgGGGo', 'oGgGYGo', 'oGgYYGo', 'oGYYGGo', 'oGYGGGo', 'oGGGGGo', '.ooooo.']],
};

export const SPARK_FULL_SPRITE: SpriteDef = {
  id: 'pickup.sparkFull',
  w: 9,
  h: 11,
  anchorX: 4,
  anchorY: 10,
  palette: { o, G: '#2f6f8f', g: '#5fb0d8', M: '#9aa6c0', Y: '#fff27a', W: '#ffffff' },
  frames: [
    [
      '...ooo...',
      '..oMMMo..',
      '.ooooooo.',
      'oGgGGGGGo',
      'oGgGGGYGo',
      'oGgGGYYGo',
      'oGgGYWYGo',
      'oGgYYYGGo',
      'oGgYYGGGo',
      'oGGYGGGGo',
      '.ooooooo.',
    ],
  ],
};

// ── Chests (12×11): frame 0 closed, 1 open ───────────────────────────────────
export const SATCHEL_SPRITE: SpriteDef = {
  id: 'chest.satchel',
  w: 12,
  h: 11,
  anchorX: 6,
  anchorY: 10,
  palette: { o, B: '#a8773f', h: '#d8a868', b: '#6e4a24', T: '#6e4a2c', k: '#2a1a10' },
  frames: [
    [
      '.....oo.....',
      '....oTTo....',
      '...oTooTo...',
      '....oTTo....',
      '..oooBBooo..',
      '.oBBBBBBBBo.',
      'oBBhBBBBBBbo',
      'oBhBBBBBBBbo',
      'oBBBBBBBBbbo',
      '.oBBBBBBbbo.',
      '..oooooooo..',
    ],
    [
      '............',
      '............',
      '............',
      '..oooooooo..',
      '.oTkkkkkkTo.',
      '.oBkkkkkkBo.',
      'oBBhBBBBBBbo',
      'oBhBBBBBBBbo',
      'oBBBBBBBBbbo',
      '.oBBBBBBbbo.',
      '..oooooooo..',
    ],
  ],
};

export const LOCKBOX_SPRITE: SpriteDef = {
  id: 'chest.lockbox',
  w: 12,
  h: 11,
  anchorX: 6,
  anchorY: 10,
  palette: { o, L: '#e8b83a', G: '#d4a020', h: '#fff0a0', d: '#8a6410', S: '#c9d3e6', k: '#1a1420', Y: '#fff27a' },
  frames: [
    [
      '............',
      '.oooooooooo.',
      'oLhLLLLLLLdo',
      'oLLLLLLLLLdo',
      'oooooooooooo',
      'oGhGGSSGGGdo',
      'oGhGSkkSGGdo',
      'oGGGSSkSGGdo',
      'oGGGGSSGGGdo',
      'oGGGGGGGGddo',
      'oooooooooooo',
    ],
    [
      '.oooooooooo.',
      'oLLLLLLLLLdo',
      'oLhLLLLLLLdo',
      '.oooooooooo.',
      'oooooooooooo',
      'okkkkYkkkkko',
      'oGhGGGGGGGdo',
      'oGhGGGGGGGdo',
      'oGGGGGGGGGdo',
      'oGGGGGGGGddo',
      'oooooooooooo',
    ],
  ],
};

// ── Item pedestal (14×12) ────────────────────────────────────────────────────
export const PEDESTAL_SPRITE: SpriteDef = {
  id: 'prop.pedestal',
  w: 14,
  h: 12,
  anchorX: 7,
  anchorY: 11,
  palette: { o, L: '#8691ad', S: '#5c6580', s: '#3e455a', g: '#4f7447' },
  frames: [
    [
      '..oooooooooo..',
      '.oLLLLLLLLLLo.',
      '.oSSSSSSSSSSo.',
      '..oooooooooo..',
      '...oSSSSSSo...',
      '...oSsSSSSo...',
      '...oSSSSsSo...',
      '...oSsSSSgo...',
      '..oooooooooo..',
      '.oLLLLLLLLLLo.',
      '.oSSSSSSSSgSo.',
      '..oooooooooo..',
    ],
  ],
};

// ── HUD counter icons ───────────────────────────────────────────────────────
export const HUD_COIN_ICON: SpriteDef = {
  id: 'hud.coin',
  w: 7,
  h: 7,
  palette: { o, C: '#f2c230', H: '#fff4a8', c: '#b07818', s: '#d49a20' },
  frames: [COIN_FACE],
};

export const HUD_BOMB_ICON: SpriteDef = {
  id: 'hud.bomb',
  w: 7,
  h: 7,
  palette: { o, B: '#3a4258', h: '#8a96b8', f: '#b98040', s: '#ffcf57' },
  frames: [['....f.s', '...f...', '.oooo..', 'oBBBho.', 'oBBBBo.', 'oBBBBo.', '.oooo..']],
};

export const HUD_KEY_ICON: SpriteDef = {
  id: 'hud.key',
  w: 5,
  h: 8,
  palette: { o, Y: '#f2c230', h: '#fff4a8' },
  frames: [['.ooo.', 'oYhYo', 'oY.Yo', '.oYo.', '.oYoo', '.oYYo', '.oYoo', '..o..']],
};
