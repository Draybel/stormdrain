/**
 * Starter kit: one of each item kind so every inventory slot and effect family can be tried in
 * the training room — actives (room charge + timed charge), special passives (flag, ember hearts),
 * trinkets (flag, luck-scaled trigger) and consumables (heal + a temporary stat, pickups).
 */

import type { ItemDef, SpriteDef } from '../../sim/types';
import { OUTLINE } from '../sprites/palette';

const o = OUTLINE;

const JAR_OF_LIGHTNING: SpriteDef = {
  id: 'item.jar-of-lightning',
  w: 14,
  h: 14,
  palette: { o, C: '#b98040', G: '#2c4a66', g: '#6d9ac0', Y: '#fff27a', W: '#ffffff' },
  frames: [
    [
      '.....oooo.....',
      '....oCCCCo....',
      '....oooooo....',
      '...oGGGGGGo...',
      '..oGgGGYGGGo..',
      '..oGgGYYGGGo..',
      '..oGgYYGGGGo..',
      '..oGgYWYYGGo..',
      '..oGgGGYYGGo..',
      '..oGgGYYGGGo..',
      '..oGgGYGGGGo..',
      '..oGGGGGGGGo..',
      '...oooooooo...',
      '..............',
    ],
  ],
};

const PICNIC_BASKET: SpriteDef = {
  id: 'item.picnic-basket',
  w: 14,
  h: 14,
  palette: { o, R: '#e0515a', W: '#f3e6c8', B: '#c8913e', b: '#8a5a2b', H: '#b07a38' },
  frames: [
    [
      '..............',
      '....oooooo....',
      '...oHo..oHo...',
      '..oHo....oHo..',
      '..oRWRWRWRWo..',
      '.oRWRWRWRWRWo.',
      '.oooooooooooo.',
      '.oBbBbBbBbBbo.',
      '.obBbBbBbBbBo.',
      '.oBbBbBbBbBbo.',
      '..obBbBbBbBo..',
      '..oBbBbBbBbo..',
      '...oooooooo...',
      '..............',
    ],
  ],
};

const LEAKY_UMBRELLA: SpriteDef = {
  id: 'item.leaky-umbrella',
  w: 14,
  h: 14,
  palette: { o, P: '#7a5ab8', p: '#5a3e8a', h: '#b89ae8', q: '#e0b040', S: '#b98040', d: '#8fc4ec' },
  frames: [
    [
      '......oo......',
      '....ooPhoo....',
      '...oPPPhPPo...',
      '..oPPqPhPPPo..',
      '.oPPpPPhPPpPo.',
      'oPPPpPPhPPpPPo',
      '.oooooooooooo.',
      '.d....oSo.....',
      '......oSo...d.',
      '......oSo.....',
      '......oSo.....',
      '..oSo.oSo.....',
      '..oSSSSSo.....',
      '...ooooo......',
    ],
  ],
};

const CANDLE_STUB: SpriteDef = {
  id: 'item.candle-stub',
  w: 14,
  h: 14,
  palette: {
    o,
    Y: '#ffcf57',
    w: '#fffbe8',
    O: '#e8862e',
    k: '#2a2230',
    W: '#f3e6c8',
    x: '#d8c8a8',
    c: '#c8b898',
    D: '#8a6a42',
  },
  frames: [
    [
      '.......o......',
      '......oYo.....',
      '.....oYYYo....',
      '.....oYwYo....',
      '.....oOwOo....',
      '......oko.....',
      '....oWWWWWo...',
      '....oWxWWco...',
      '....oWxWWco...',
      '....oWWWWco...',
      '....oWWWWco...',
      '..ooooooooooo.',
      '..oDDDDDDDDDo.',
      '...ooooooooo..',
    ],
  ],
};

const FRIDGE_MAGNET: SpriteDef = {
  id: 'item.fridge-magnet',
  w: 14,
  h: 14,
  palette: { o, R: '#d8404a', h: '#ff8a8a', S: '#c9d3e6', m: '#8fc4ec' },
  frames: [
    [
      '.m..........m.',
      '..oooo..oooo..',
      '..oSSo..oSSo..',
      '..oSSo..oSSo..',
      '..ooooooooooo.',
      '..ohRo..ohRo..',
      '..ohRo..ohRo..',
      '..ohRo..ohRo..',
      '..ohRRooRRRo..',
      '...ohRRRRRo...',
      '....oooooo....',
      '..............',
      '..............',
      '..............',
    ],
  ],
};

const WORN_BANDAGE: SpriteDef = {
  id: 'item.worn-bandage',
  w: 14,
  h: 14,
  palette: { o, B: '#e0b890', b: '#c09870', W: '#f3efe0', R: '#e0515a', s: '#a07a5a' },
  frames: [
    [
      '..............',
      '..............',
      '..............',
      '..oooooooooo..',
      '.oBbBoWWWoBbo.',
      'oBBsBoWRWoBBBo',
      'oBbBBoRRRoBbBo',
      'oBBBBoWRWoBsBo',
      '.oBbBoWWWoBbo.',
      '..oooooooooo..',
      '..............',
      '..............',
      '..............',
      '..............',
    ],
  ],
};

const FIZZ_TONIC: SpriteDef = {
  id: 'item.fizz-tonic',
  w: 14,
  h: 14,
  palette: { o, C: '#b98040', G: '#9ab4d0', P: '#4fb0e8', h: '#bfe8ff', b: '#e9f7ff' },
  frames: [
    [
      '.....oooo.....',
      '.....oCCo.....',
      '.....oooo.....',
      '.....oGGo.....',
      '....oGGGGo....',
      '...oGbPPPGo...',
      '..oPhPPPPbPo..',
      '..oPhPbPPPPo..',
      '..oPPPPPbPPo..',
      '..oPPbPPPPPo..',
      '...oPPPPPPo...',
      '....oooooo....',
      '..............',
      '..............',
    ],
  ],
};

const LUCKY_STICKER: SpriteDef = {
  id: 'item.lucky-sticker',
  w: 14,
  h: 14,
  palette: { o, Y: '#ffcf57', h: '#fff4b0', y: '#d49a20', p: '#f3e6c8' },
  frames: [
    [
      '......oo......',
      '.....oYYo.....',
      '.....oYYo.....',
      '....oYhYYo....',
      'ooooYhYYYYoooo',
      'oYYYYhYYYYYYYo',
      '.oYYYYYYYYYyo.',
      '..oYYYYYYYyo..',
      '...oYYYYYYo...',
      '...oYYYYYyo...',
      '..oYYYooYYyo..',
      '..oYYo..oYyo..',
      '.oYYo....opYo.',
      '.ooo......ooo.',
    ],
  ],
};

const items: ItemDef[] = [
  {
    id: 'jar-of-lightning',
    name: 'Jar of Lightning',
    desc: 'ZAPS EVERYTHING AROUND YOU · 2 ROOMS',
    kind: 'active',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['starter-active', 'storm'],
    effects: [],
    active: {
      charge: 2,
      chargeType: 'room',
      use: [{ type: 'hook', hook: 'shockwave', params: { radius: 64, damage: 24 } }],
    },
    sprite: JAR_OF_LIGHTNING,
  },
  {
    id: 'picnic-basket',
    name: 'Picnic Basket',
    desc: 'SNACKS FOR LATER · REFILLS OVER TIME',
    kind: 'active',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-active', 'food'],
    effects: [],
    active: {
      charge: 25,
      chargeType: 'timed',
      use: [{ type: 'pickups', table: 'basket' }],
    },
    sprite: PICNIC_BASKET,
  },
  {
    id: 'leaky-umbrella',
    unlock: 'homeward-wren',
    name: 'Leaky Umbrella',
    desc: 'FLIGHT · IT HOLDS AIR, NOT WATER',
    kind: 'passive',
    quality: 3,
    pools: ['treasure'],
    tags: ['starter-special', 'water'],
    effects: [{ type: 'flag', flag: 'flying' }],
    sprite: LEAKY_UMBRELLA,
  },
  {
    id: 'candle-stub',
    name: 'Candle Stub',
    desc: '+1 EMBER HEART · IT BURNS WHEN IT BREAKS',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['starter-special', 'wax'],
    effects: [{ type: 'hearts', ember: 2 }],
    sprite: CANDLE_STUB,
  },
  {
    id: 'fridge-magnet',
    name: 'Fridge Magnet',
    desc: 'PICKUPS DRIFT TOWARD YOU',
    kind: 'trinket',
    quality: 1,
    pools: ['chest', 'trader'],
    tags: ['starter'],
    effects: [{ type: 'flag', flag: 'magnet' }],
    sprite: FRIDGE_MAGNET,
  },
  {
    id: 'worn-bandage',
    name: 'Worn Bandage',
    desc: 'GETTING HURT MAY DROP A HEART · LUCK HELPS',
    kind: 'trinket',
    quality: 1,
    pools: ['chest', 'trader'],
    tags: ['starter'],
    effects: [
      {
        type: 'trigger',
        on: 'hurt',
        chance: 0.3,
        luck: 0.05,
        effects: [{ type: 'pickups', spawn: [{ kind: 'halfHeart' }] }],
      },
    ],
    sprite: WORN_BANDAGE,
  },
  {
    id: 'fizz-tonic',
    name: 'Fizz Tonic',
    desc: 'HEALS TWO HEARTS · FIZZY FEET FOR A BIT',
    kind: 'consumable',
    quality: 1,
    pools: ['chest', 'shop'],
    tags: ['starter', 'tonic'],
    effects: [],
    use: [
      { type: 'heal', amount: 4 },
      { type: 'stat', stat: 'moveSpeed', add: 24, duration: 8 },
    ],
    sprite: FIZZ_TONIC,
  },
  {
    id: 'lucky-sticker',
    name: 'Lucky Sticker',
    desc: '+1 KEY · +1 BOMB · +3 COINS',
    kind: 'consumable',
    quality: 1,
    pools: ['chest', 'shop'],
    tags: ['starter', 'sticker'],
    effects: [],
    use: [{ type: 'pickups', keys: 1, bombs: 1, coins: 3 }],
    sprite: LUCKY_STICKER,
  },
];

export default items;
