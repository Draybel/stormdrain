/**
 * Stormcaller transformation (DESIGN.md item sets #1): hold 3 items whose `set` is 'stormcaller'
 * (content/items/passives-a-stormcaller.ts). A crackling cape of static; every shot chains lightning
 * and hits harder. With the Brass Kite Key / Static Cling / Rooftop Rod the chain stacks further.
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_STORM_CAPE_BACK, COSTUME_STORM_CAPE_FRONT } from '../sprites/itemsA-costumes';

const sets: ItemSetDef[] = [
  {
    id: 'stormcaller',
    name: 'Stormcaller',
    desc: 'ALL SHOTS CHAIN LIGHTNING · +DAMAGE',
    need: 3,
    effects: [
      { type: 'mod', mod: 'chain', params: { jumps: 1 } },
      { type: 'stat', stat: 'damage', add: 0.5 },
      { type: 'stat', stat: 'damage', mul: 1.15 },
    ],
    costume: [
      {
        id: 'set.stormcaller.cape',
        layer: 'cape',
        sprite: COSTUME_STORM_CAPE_BACK,
        behind: true,
        frames: 'dir',
        glow: '120,190,255',
        sparks: '#bfe8ff',
      },
      { id: 'set.stormcaller.clasp', layer: 'cape', sprite: COSTUME_STORM_CAPE_FRONT, frames: 'dir' },
    ],
  },
];

export default sets;
