/**
 * Starter familiars (ARCHITECTURE §4.8), one item each — together they use every familiar behaviour:
 * Lamplet and Paper Boat follow and shoot, Dustwing hovers and shoots, Bottlecap Beetle orbits and
 * blocks shots, Wick Wisp guards close (blocks, sparks), Roly-Poly chases enemies down. Shooters fire
 * the player's whole attack profile at their scale, so they inherit every carrier and modifier.
 */

import type { ItemDef } from '../../sim/types';
import { BOTTLECAP_BEETLE_SPRITE, LAMPLET_SPRITE, PAPER_BOAT_SPRITE, iconFrom } from '../sprites/attack';
import { DUSTWING_SPRITE, ROLY_POLY_SPRITE, WICK_WISP_SPRITE } from '../sprites/starterItems';

const items: ItemDef[] = [
  {
    id: 'lamplet',
    name: 'Lamplet',
    desc: 'A LANTERN SPRITE THAT SHOOTS WITH YOU',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'waxen'],
    effects: [{ type: 'familiar', familiar: 'lamplet' }],
    sprite: iconFrom(LAMPLET_SPRITE, 'item.lamplet', '#3a2a40'),
  },
  {
    id: 'paper-boat',
    name: 'Paper Boat',
    desc: 'A LITTLE BOAT FOLLOWS YOU AND FIRES',
    kind: 'passive',
    quality: 1,
    pools: ['treasure'],
    tags: ['familiar', 'tidewalker'],
    effects: [{ type: 'familiar', familiar: 'paper-boat' }],
    sprite: iconFrom(PAPER_BOAT_SPRITE, 'item.paper-boat', '#2c4a66'),
  },
  {
    id: 'bottlecap-beetle',
    name: 'Bottlecap Beetle',
    desc: 'CIRCLES YOU · BUMPS FOES · BLOCKS SHOTS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['familiar'],
    effects: [{ type: 'familiar', familiar: 'bottlecap-beetle' }],
    sprite: iconFrom(BOTTLECAP_BEETLE_SPRITE, 'item.bottlecap-beetle', '#35523a'),
  },
  {
    id: 'dustwing',
    name: 'Dustwing',
    desc: 'A DUSTY MOTH HOVERS CLOSE AND SHOOTS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'mothkin'],
    effects: [{ type: 'familiar', familiar: 'dustwing' }],
    sprite: iconFrom(DUSTWING_SPRITE, 'item.dustwing', '#3a3450'),
  },
  {
    id: 'roly-poly',
    name: 'Roly-Poly',
    desc: 'A PILL BUG THAT BOWLS INTO YOUR FOES',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'sporeling'],
    effects: [{ type: 'familiar', familiar: 'roly-poly' }],
    sprite: iconFrom(ROLY_POLY_SPRITE, 'item.roly-poly', '#2e4430'),
  },
  {
    id: 'wick-wisp',
    name: 'Wick Wisp',
    desc: 'A LITTLE FLAME GUARDS YOU · SPITS SPARKS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['familiar', 'waxen'],
    effects: [{ type: 'familiar', familiar: 'wick-wisp' }],
    sprite: iconFrom(WICK_WISP_SPRITE, 'item.wick-wisp', '#4a2a2a'),
  },
];

export default items;
