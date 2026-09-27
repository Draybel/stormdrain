/**
 * Phase 2D familiars — the behaviours the first three didn't use yet:
 * - Dustwing (hover): a dusty moth that bobs along in your wake and shoots a little slower;
 * - Roly-Poly (chase): a pill bug that bowls into the nearest enemy, then trundles back;
 * - Wick Wisp (guard): a candle flame circling close, swatting shots and spitting tiny sparks.
 */

import type { FamiliarDef } from '../../sim/types';
import { DUSTWING_SPRITE, ROLY_POLY_SPRITE, WICK_WISP_SPRITE } from '../sprites/starterItems';

const familiars: FamiliarDef[] = [
  {
    id: 'dustwing',
    name: 'Dustwing',
    desc: 'A dusty moth that hovers in your wake and shoots when you do.',
    sprite: DUSTWING_SPRITE,
    behavior: 'hover',
    radius: 4,
    attackScale: 0.4,
    fireRateMul: 0.8,
    speed: 100,
    glow: '255,240,190',
  },
  {
    id: 'roly-poly',
    name: 'Roly-Poly',
    desc: 'A pill bug that curls up and bowls into your enemies.',
    sprite: ROLY_POLY_SPRITE,
    behavior: 'chase',
    radius: 4,
    attackScale: 0,
    contactDamage: 6,
    speed: 135,
    blocks: false,
  },
  {
    id: 'wick-wisp',
    name: 'Wick Wisp',
    desc: 'A little candle flame that guards you and spits sparks.',
    sprite: WICK_WISP_SPRITE,
    behavior: 'guard',
    radius: 3,
    attackScale: 0.25,
    fireRateMul: 0.7,
    contactDamage: 2,
    blocks: true,
    glow: '255,170,80',
  },
];

export default familiars;
