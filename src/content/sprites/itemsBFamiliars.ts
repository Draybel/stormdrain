/**
 * Familiar art for the "items B" passives (all original pixel maps, anchored at the feet; 2 frames =
 * idle bob / march / wiggle):
 * - Tin Sentry: a wind-up toy soldier in a tall busby (Toybox; the Toybox set adds two more);
 * - Threadbare Bear: a patched teddy with one button eye that hugs shots out of the air (Toybox);
 * - Tadpole: a little gutter tadpole that swims along and spits (Tidewalker);
 * - Gutter Ferret: a masked ferret that darts at foes and fires point-blank.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** Tin Sentry: busby hat, big eyes, red coat with a white cross-belt, marching legs. */
export const TIN_SENTRY_SPRITE: SpriteDef = {
  id: 'fam.tin-sentry',
  w: 8,
  h: 12,
  anchorX: 4,
  anchorY: 11,
  palette: { o, K: '#2a2438', h: '#5a5070', Y: '#e0b040', F: '#f0c8a0', e: '#1d1830', R: '#d8404a', W: '#f3efe0', B: '#3a5a9a' },
  frames: [
    ['..oooo..', '.oKKKKo.', '.oKhKKo.', '.oKKKKo.', '.oYYYYo.', '.oeFFeo.', '.oFFFFo.', 'oRRWWRRo', 'oRRWWRRo', '.oBBBBo.', '.oBooBo.', '.oo..oo.'],
    ['..oooo..', '.oKKKKo.', '.oKhKKo.', '.oKKKKo.', '.oYYYYo.', '.oeFFeo.', '.oFFFFo.', 'oRRWWRRo', 'oRRWWRRo', '.oBBBBo.', '..oBBo..', '..oooo..'],
  ],
};

/** Threadbare Bear: round ears, one dark eye and one blue button eye, a pink tummy patch. */
export const THREADBARE_BEAR_SPRITE: SpriteDef = {
  id: 'fam.threadbare-bear',
  w: 10,
  h: 10,
  anchorX: 5,
  anchorY: 9,
  palette: { o, B: '#b08a5a', n: '#e8d0a8', k: '#1d1830', x: '#6fb3e0', P: '#e05a8a' },
  frames: [
    ['.oo....oo.', 'oBBooooBBo', 'oBBBBBBBBo', 'oBkBBBBxBo', '.oBBnnBBo.', '..oBBBBo..', '.oBBPPBBo.', 'oBBBPPBBBo', '.oBBBBBBo.', '.oBo..oBo.'],
    ['.oo....oo.', 'oBBooooBBo', 'oBBBBBBBBo', 'oBkBBBBxBo', '.oBBnnBBo.', '..oBBBBo..', 'oBBBPPBBBo', '.oBBPPBBo.', '.oBBBBBBo.', '.oBo..oBo.'],
  ],
};

/** Tadpole: a round dark head with one bright eye and a wiggling tail. */
export const TADPOLE_SPRITE: SpriteDef = {
  id: 'fam.tadpole',
  w: 10,
  h: 6,
  anchorX: 6,
  anchorY: 5,
  palette: { o, G: '#3b4a5a', h: '#8aa0b8', e: '#eaf7ff', g: '#26303c', t: '#5a6a80' },
  frames: [
    ['.....oooo.', '....oGhGGo', 'o..ooGGGeo', 'ottooGGGGo', '.o..oGGGgo', '.....oooo.'],
    ['.....oooo.', '....oGhGGo', '.o.ooGGGeo', 'ottooGGGGo', 'o...oGGGgo', '.....oooo.'],
  ],
};

/** Gutter Ferret: a long sandy body, a dark mask over a bright eye, a curled tail, scurrying legs. */
export const GUTTER_FERRET_SPRITE: SpriteDef = {
  id: 'fam.gutter-ferret',
  w: 12,
  h: 6,
  anchorX: 6,
  anchorY: 5,
  palette: { o, F: '#c8a878', W: '#f3efe0', m: '#3a2a20', e: '#fff2a8', T: '#8a6a48', n: '#e07a7a' },
  frames: [
    ['.........oo.', 'oo......oWWo', 'oToooooFFmeo', '.oTFFFFFFFno', '..oFFFFFFFo.', '..o.o..o.o..'],
    ['.........oo.', '.o......oWWo', 'oToooooFFmeo', '.oTFFFFFFFno', '..oFFFFFFFo.', '...o.o..o.o.'],
  ],
};
