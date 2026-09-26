/**
 * Starter stat items: simple, readable upgrades (one stat each, plus a health up).
 * Tag 'starter-stat' — the training room offers two of these at random.
 */

import type { ItemDef, SpriteDef } from '../../sim/types';
import { OUTLINE } from '../sprites/palette';

const o = OUTLINE;

const BRICK_CHIP: SpriteDef = {
  id: 'item.brick-chip',
  w: 14,
  h: 14,
  palette: { o, R: '#b5533c', h: '#e48a6a', d: '#7a3326', m: '#c9b89a' },
  frames: [
    [
      '..............',
      '..............',
      '.....ooooo....',
      '....oRRRRRoo..',
      '...oRhRRRRRRo.',
      '..oRhRRRmRRRo.',
      '..oRRRRmRRRdo.',
      '.ommmmmmRRRdo.',
      '.oRRRRmRRRddo.',
      '.oRhRRmRRRddo.',
      '..oRRRmRRdddo.',
      '..oddddddddo..',
      '...oooooooo...',
      '..............',
    ],
  ],
};

const WIND_UP_CRANK: SpriteDef = {
  id: 'item.wind-up-crank',
  w: 14,
  h: 14,
  palette: { o, Y: '#e0b040', h: '#fff0a0', y: '#9a6a1c' },
  frames: [
    [
      '..............',
      '..ooo....ooo..',
      '.oYYYo..oYYYo.',
      '.oYhYYooYYhYo.',
      '.oYYYYYYYYYYo.',
      '..oooYYYYooo..',
      '.....oYYo.....',
      '.....oYyo.....',
      '.....oYyo.....',
      '....ooYyoo....',
      '...oyYhYYyo...',
      '...oyyyyyyo...',
      '....oooooo....',
      '..............',
    ],
  ],
};

const PUDDLE_JUMPERS: SpriteDef = {
  id: 'item.puddle-jumpers',
  w: 14,
  h: 14,
  palette: { o, G: '#4fae5a', h: '#9be08a', g: '#2e6e3a', w: '#8fc4ec', W: '#d6ecff' },
  frames: [
    [
      '..............',
      '....oooo......',
      '....ohGo......',
      '....ohGo...w..',
      '....ohGo..w.w.',
      '....oGGo......',
      '....oGGoooo...',
      '...ohGGGGGGo..',
      '...oGGGGGGGGo.',
      '...ogggggggo..',
      '....ooooooo...',
      '..w........w..',
      '.wWw......wWw.',
      '..............',
    ],
  ],
};

const KITE_STRING: SpriteDef = {
  id: 'item.kite-string',
  w: 14,
  h: 14,
  palette: { o, R: '#e05a4a', r: '#a8362c', h: '#ffd36b', s: '#d8d0b8', b: '#6fb3e0' },
  frames: [
    [
      '.....o........',
      '....oRo.......',
      '...oRhRo......',
      '..oRRhRro.....',
      '.oRRRhRrro....',
      '..ohhhhro.....',
      '...oRhro......',
      '....oro.......',
      '.....o........',
      '......s.......',
      '.......sb.....',
      '......bs......',
      '.......s......',
      '........s.....',
    ],
  ],
};

const THERMOS_OF_SOUP: SpriteDef = {
  id: 'item.thermos-of-soup',
  w: 14,
  h: 14,
  palette: { o, T: '#3f7fbf', h: '#8cc0f0', d: '#264e7a', M: '#b9c2da', R: '#e0515a', s: '#c9d3f0' },
  frames: [
    [
      '.....s...s....',
      '......s...s...',
      '....ooooooo...',
      '....oMMMMMo...',
      '...ooooooooo..',
      '...ohTTTTTdo..',
      '...ohRRTRRdo..',
      '...ohRRRRRdo..',
      '...ohTRRRTdo..',
      '...ohTTRTTdo..',
      '...ohTTTTTdo..',
      '...ohTTTTTdo..',
      '...ooooooooo..',
      '..............',
    ],
  ],
};

const FOUR_LEAF_BUTTON: SpriteDef = {
  id: 'item.four-leaf-button',
  w: 14,
  h: 14,
  palette: { o, G: '#5fbf6a', h: '#b8f0a0', g: '#2f7a3c', k: '#16301c' },
  frames: [
    [
      '..............',
      '.....oooo.....',
      '...ooGGGGoo...',
      '..oGhGGGGGGo..',
      '..ohGGGGGGGo..',
      '.oGhGkGGkGGgo.',
      '.oGGGkGGkGGgo.',
      '.oGGGGGGGGGgo.',
      '.oGGGkGGkGGgo.',
      '.oGGGkGGkGggo.',
      '..oGGGGGGggo..',
      '..ogGGGGgggo..',
      '...oogggggo...',
      '.....oooo.....',
    ],
  ],
};

const items: ItemDef[] = [
  {
    id: 'brick-chip',
    name: 'Brick Chip',
    desc: 'DAMAGE UP · IT STILL SMELLS LIKE RAIN',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-stat', 'stone'],
    effects: [{ type: 'stat', stat: 'damage', add: 1 }],
    sprite: BRICK_CHIP,
  },
  {
    id: 'wind-up-crank',
    name: 'Wind-Up Crank',
    desc: 'FIRE RATE UP · CLICK, CLICK, CLICK',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-stat', 'clockwork'],
    effects: [{ type: 'stat', stat: 'fireRate', add: 0.75 }],
    sprite: WIND_UP_CRANK,
  },
  {
    id: 'puddle-jumpers',
    name: 'Puddle Jumpers',
    desc: 'SPEED UP · SPLISH SPLASH',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-stat', 'water'],
    effects: [{ type: 'stat', stat: 'moveSpeed', add: 14 }],
    sprite: PUDDLE_JUMPERS,
  },
  {
    id: 'kite-string',
    name: 'Kite String',
    desc: 'RANGE UP · LET IT FLY',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-stat', 'toy'],
    effects: [
      { type: 'stat', stat: 'range', add: 45 },
      { type: 'stat', stat: 'shotSpeed', add: 25 },
    ],
    sprite: KITE_STRING,
  },
  {
    id: 'thermos-of-soup',
    name: 'Thermos of Soup',
    desc: 'HEALTH UP · STILL WARM',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop', 'boss'],
    tags: ['starter-stat', 'food'],
    effects: [
      { type: 'hearts', containers: 1 },
      { type: 'heal', amount: 99 },
    ],
    sprite: THERMOS_OF_SOUP,
  },
  {
    id: 'four-leaf-button',
    name: 'Four-Leaf Button',
    desc: 'LUCK UP · FOUND IN A COAT POCKET',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-stat', 'lucky'],
    effects: [{ type: 'stat', stat: 'luck', add: 1 }],
    sprite: FOUR_LEAF_BUTTON,
  },
];

export default items;
