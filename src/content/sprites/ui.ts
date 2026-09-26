/** Pixel icons for on-screen buttons and the rotate-your-phone screen. */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE, UI } from './palette';

const W = UI.text;

export const ICON_PAUSE: SpriteDef = {
  id: 'icon.pause',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, W },
  frames: [
    [
      '............',
      '..ooo..ooo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..oWo..oWo..',
      '..ooo..ooo..',
      '............',
    ],
  ],
};

export const ICON_BOMB: SpriteDef = {
  id: 'icon.bomb',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, B: '#59617d', h: '#c3cbe6', f: '#b98040', s: '#ffcf57', S: '#fff3b0' },
  frames: [
    [
      '.........S..',
      '........SsS.',
      '.......f.S..',
      '......f.....',
      '....oooo....',
      '..ooBBBBoo..',
      '.oBBBBBBhBo.',
      '.oBBBBBBBho.',
      '.oBBBBBBBBo.',
      '.oBBBBBBBBo.',
      '..oBBBBBBo..',
      '...oooooo...',
    ],
  ],
};

export const ICON_ACTIVE: SpriteDef = {
  id: 'icon.active',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, Y: '#ffd84a' },
  frames: [
    [
      '.......oooo.',
      '......oYYo..',
      '.....oYYo...',
      '....oYYo....',
      '...oYYYYYo..',
      '...ooooYYo..',
      '......oYo...',
      '.....oYo....',
      '....oYo.....',
      '...oYo......',
      '...oo.......',
      '............',
    ],
  ],
};

export const ICON_CONSUMABLE: SpriteDef = {
  id: 'icon.consumable',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, W, P: '#6fb3e0', S: '#ffcf57', D: UI.textDim },
  frames: [
    [
      '..oooooooo..',
      '..oWWWWWWo..',
      '..oWPPPPWo..',
      '..oWPSSPWo..',
      '..oWPSSPWo..',
      '..oWPPPPWo..',
      '..oWWWWWWo..',
      '..oWDDDDWo..',
      '..oWWWWWWo..',
      '..oWDDDWWo..',
      '..oWWWWWWo..',
      '..oooooooo..',
    ],
  ],
};

export const ICON_MAP: SpriteDef = {
  id: 'icon.map',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, W, M: '#b9c2da', r: UI.accent, x: UI.danger },
  frames: [
    [
      '............',
      'oooooooooooo',
      'oWWWoMMMoWWo',
      'oWrWoMMMoWWo',
      'oWWWoMrMoWWo',
      'oWWWoMMMorWo',
      'oWWWoMMMoWWo',
      'oWWWoMMMxWxo',
      'oWWWoMMMoxWo',
      'oWWWoMMMxWxo',
      'oooooooooooo',
      '............',
    ],
  ],
};

/** A phone held upright with a tiny Wren on screen. Drawn rotated 90° for the landscape pose. */
export const PHONE_SPRITE: SpriteDef = {
  id: 'ui.phone',
  w: 13,
  h: 21,
  palette: { o: OUTLINE, P: '#56648a', S: '#1a2340', Y: '#f5c52e', k: '#1d1830', e: '#eaf7ff' },
  frames: [
    [
      '.ooooooooooo.',
      'oPPPPPPPPPPPo',
      'oPPPPoooPPPPo',
      'oPoooooooooPo',
      'oPoSSSSSSSoPo',
      'oPoSSSSSSSoPo',
      'oPoSSSSSSSoPo',
      'oPoSSYYYSSoPo',
      'oPoSYYYYYSoPo',
      'oPoSYkkkYSoPo',
      'oPoSYekeYSoPo',
      'oPoSYkkkYSoPo',
      'oPoSYYYYYSoPo',
      'oPoSSSSSSSoPo',
      'oPoSSSSSSSoPo',
      'oPoSSSSSSSoPo',
      'oPoooooooooPo',
      'oPPPPPPPPPPPo',
      'oPPPPPoPPPPPo',
      'oPPPPPPPPPPPo',
      '.ooooooooooo.',
    ],
  ],
};

/** HUD heart (9×8): 0 full, 1 half, 2 empty. */
export const HEART_SPRITE: SpriteDef = {
  id: 'ui.heart',
  w: 9,
  h: 8,
  palette: { o: OUTLINE, R: UI.heart, h: '#ff9aa0', e: '#3a1d26' },
  frames: [
    [
      '.oo...oo.',
      'oRRo.oRRo',
      'oRhRRRRRo',
      'oRRRRRRRo',
      '.oRRRRRo.',
      '..oRRRo..',
      '...oRo...',
      '....o....',
    ],
    [
      '.oo...oo.',
      'oRRo.oeeo',
      'oRhRReeeo',
      'oRRRReeeo',
      '.oRRReeo.',
      '..oRReo..',
      '...oRo...',
      '....o....',
    ],
    [
      '.oo...oo.',
      'oeeo.oeeo',
      'oeeeeeeeo',
      'oeeeeeeeo',
      '.oeeeeeo.',
      '..oeeeo..',
      '...oeo...',
      '....o....',
    ],
  ],
};
