/**
 * Items pack A — familiar sprites (anchored at the feet; 2 frames = idle flap / wiggle / flicker).
 * Blinkbug (a lightning bug), Gloamwing (an eyespotted dusk moth), Tin Cuckoo (a wind-up bird), Toddlecap
 * (a toddling mushroom) and Tallow Tot (a stubby candle). All original.
 */

import type { SpriteDef } from '../../sim/types';
import { o } from './itemsA';

/** Blinkbug: a round lightning bug whose bottom blinks bright when it flaps. */
export const BLINKBUG_SPRITE: SpriteDef = {
  id: 'fam.blinkbug',
  w: 9,
  h: 9,
  anchorX: 4,
  anchorY: 8,
  palette: { o, k: '#4a4470', e: '#fffbe8', W: '#cfe4ff', Y: '#fff27a', y: '#e0b040', H: '#ffffff' },
  frames: [
    ['.o.....o.', '..o...o..', '..ooooo..', '.okekeko.', 'oWokkkoWo', 'oWoYYYoWo', '.ooYyYoo.', '..oYYYo..', '...ooo...'],
    ['.o.....o.', '..o...o..', '..ooooo..', '.okekeko.', '.ookkkoo.', 'oWoHHHoWo', 'oWoYHYoWo', '..oYHYo..', '...ooo...'],
  ],
};

/** Gloamwing: a violet-grey dusk moth with golden eyespots on its wings. */
export const GLOAMWING_SPRITE: SpriteDef = {
  id: 'fam.gloamwing',
  w: 11,
  h: 8,
  anchorX: 5,
  anchorY: 7,
  palette: { o, G: '#a898b8', g: '#6a5a7a', E: '#ffd878', b: '#3a3040' },
  frames: [
    ['...o...o...', '....o.o....', '.ooooboooo.', 'oGGGoboGGGo', 'oGEGoboGEGo', 'ogGGoboGGgo', '.oggoboggo.', '..oo.o.oo..'],
    ['...o...o...', '....o.o....', '....obo....', '.ooooboooo.', 'oGEGoboGEGo', 'oGGGoboGGGo', 'ogggobogggo', '.ooo.o.ooo.'],
  ],
};

/** Tin Cuckoo: a round wind-up tin bird with a brass key in its back — frame 1 pops its beak open. */
export const TIN_CUCKOO_SPRITE: SpriteDef = {
  id: 'fam.tin-cuckoo',
  w: 13,
  h: 11,
  anchorX: 6,
  anchorY: 10,
  palette: { o, T: '#b8c4d8', t: '#7d89a8', h: '#eef4ff', e: '#ffffff', k: '#1d1830', B: '#ffb030', K: '#e0b040' },
  frames: [
    [
      '.oKKoKKo.....',
      '...oKo.......',
      '...oooooo....',
      '..oThhTTTo...',
      '.oThTTTekTo..',
      '.oTTTTTTkTBBo',
      '.oTTtTTTTTo..',
      '.otTTttTTTo..',
      '..otTTTTTo...',
      '...oooooo....',
      '....o..o.....',
    ],
    [
      '.oKKoKKo.....',
      '...oKo.......',
      '...oooooo....',
      '..oThhTTTo...',
      '.oThTTTekTBBo',
      '.oTTTTTTkTo..',
      '.oTTtTTTTTBBo',
      '.otTTttTTTo..',
      '..otTTTTTo...',
      '...oooooo....',
      '....o..o.....',
    ],
  ],
};

/** Toddlecap: a little red-capped mushroom on stubby feet (it waddles). */
export const TODDLECAP_SPRITE: SpriteDef = {
  id: 'fam.toddlecap',
  w: 9,
  h: 9,
  anchorX: 4,
  anchorY: 8,
  palette: { o, R: '#d8403a', r: '#8a2424', W: '#fff4e0', S: '#f0e0c0', s: '#c0a880', k: '#1d1830' },
  frames: [
    ['..ooooo..', '.oRWRRRo.', 'oRRRRWRRo', 'oWRRRRRro', 'orrrrrrro', '.oSkSkso.', '.oSSSsso.', '..ooooo..', '..o...o..'],
    ['..ooooo..', '.oRRRWRo.', 'oRWRRRRRo', 'oRRRRRWro', 'orrrrrrro', '.oSkSkso.', '.oSSSsso.', '..ooooo..', '...o.o...'],
  ],
};

/** Tallow Tot: a stubby candle with a sleepy face and a flickering flame. */
export const TALLOW_TOT_SPRITE: SpriteDef = {
  id: 'fam.tallow-tot',
  w: 7,
  h: 11,
  anchorX: 3,
  anchorY: 10,
  palette: { o, F: '#ffcf57', f: '#ff8a30', H: '#fffbe8', W: '#f3ead0', w: '#c8b890', k: '#3a1a10', d: '#fffdf4' },
  frames: [
    ['...o...', '..oFo..', '.oFHFo.', '.ofHfo.', '..oko..', '.oWWWo.', 'oWdWWwo', 'oWkWkwo', 'odWWWwo', 'oWWWwwo', '.ooooo.'],
    ['....o..', '...oFo.', '..oFHo.', '.ofHfo.', '..oko..', '.oWWWo.', 'oWdWWwo', 'oWkWkwo', 'odWWWwo', 'oWWWwwo', '.ooooo.'],
  ],
};

/** Every familiar sprite of this pack (the tests validate them all). */
export const ITEMS_A_FAMILIAR_SPRITES: readonly SpriteDef[] = [
  BLINKBUG_SPRITE,
  GLOAMWING_SPRITE,
  TIN_CUCKOO_SPRITE,
  TODDLECAP_SPRITE,
  TALLOW_TOT_SPRITE,
];
