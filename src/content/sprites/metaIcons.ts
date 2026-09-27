/** Small icons for the meta layer: the achievement toast's trophy, the notice drop, the transformation star. */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

/** A little gold cup (achievement toasts). */
export const TROPHY_ICON: SpriteDef = {
  id: 'meta.trophy',
  w: 9,
  h: 9,
  palette: { o: OUTLINE, g: '#ffcf57', h: '#fff3c4', d: '#c98a1e' },
  frames: [
    [
      '.ooooooo.',
      'oghhgggdo',
      'oghggggdo',
      '.oggggdo.',
      '..oggdo..',
      '...ogo...',
      '...odo...',
      '..oggdo..',
      '..ooooo..',
    ],
  ],
};

/** A raindrop with a '!' (save notices). */
export const NOTICE_ICON: SpriteDef = {
  id: 'meta.notice',
  w: 9,
  h: 9,
  palette: { o: OUTLINE, b: '#6d9ac0', l: '#b9d6f0', w: '#ffffff' },
  frames: [
    [
      '....o....',
      '...obo...',
      '..obwbo..',
      '.oblwbbo.',
      '.obbwbbo.',
      'obbbbbbbo',
      'obbbwbbbo',
      '.obbbbbo.',
      '..ooooo..',
    ],
  ],
};

/** A four-point sparkle star (transformation / synergy banners). */
export const SPARK_STAR: SpriteDef = {
  id: 'meta.star',
  w: 7,
  h: 7,
  palette: { w: '#ffffff', y: '#ffe9a8' },
  frames: [
    ['...w...', '...y...', '..yyy..', 'wyywyyw', '..yyy..', '...y...', '...w...'],
    ['.......', '...y...', '...w...', '.yywyy.', '...w...', '...y...', '.......'],
  ],
};
