/** Marble projectile and the training dummy. */

import type { SpriteDef } from '../../sim/types';
import { GLOW, OUTLINE } from './palette';

/** Wren's glowing marble (7×7). The soft halo is added by the renderer. */
export const MARBLE_SPRITE: SpriteDef = {
  id: 'marble',
  w: 7,
  h: 7,
  anchorX: 3,
  anchorY: 3,
  palette: { o: GLOW.outline, C: GLOW.core, W: GLOW.hot, r: GLOW.rim },
  frames: [
    [
      '..ooo..',
      '.oCCCo.',
      'oCWWCCo',
      'oCWCCro',
      'oCCCrro',
      '.orrro.',
      '..ooo..',
    ],
  ],
};

/**
 * A stitched burlap training dummy on a stake with a painted target (14×18).
 * Frame 1 is the bare stake left behind after it pops (it grows back).
 */
export const DUMMY_SPRITE: SpriteDef = {
  id: 'dummy',
  w: 14,
  h: 18,
  anchorX: 7,
  anchorY: 17,
  palette: {
    o: OUTLINE,
    S: '#b89363', // burlap
    s: '#8a6a42', // burlap shade
    h: '#dcbc86', // burlap highlight
    k: '#1d1830', // button eyes
    x: '#4a3522', // stitches
    R: '#9c7b4c', // rope
    r: '#c63d3d', // target red
    w: '#f3e6c8', // target cream
    P: '#6e4a2c', // stake
    p: '#4b301b', // stake shade
  },
  frames: [
    [
      '....oooooo....',
      '...oShhSSSo...',
      '..oShSSSSSso..',
      '..oSSkSSkSso..',
      '..oSSSSSSSso..',
      '..oSSxSSxSso..',
      '...oSSxxSso...',
      '....oRRRRo....',
      '..ooSSSSSSoo..',
      '.oShSSrrSSSso.',
      '.oShSrwwrSSso.',
      '.oSSrwrrwrSso.',
      '.oSSrwrrwrsso.',
      '.oSSSrwwrSsso.',
      '..oSSSrrSsso..',
      '...oooooooo...',
      '.....oPpo.....',
      '....oPPppo....',
    ],
    [
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '..............',
      '......oo......',
      '.....oPpo.....',
      '.....oPpo.....',
      '.....oPpo.....',
      '.....oPpo.....',
      '....oPPppo....',
    ],
  ],
};
