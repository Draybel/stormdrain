/**
 * Mothkin transformation (DESIGN.md item sets #2): hold 3 items whose `set` is 'mothkin'
 * (content/items/passives-a-mothkin.ts). Big dusty wings: flight (over pits and spikes), a little more
 * speed, and shots that slow what they hit and leave glittering dust patches behind.
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_MOTH_WINGS } from '../sprites/itemsA-costumes';

const sets: ItemSetDef[] = [
  {
    id: 'mothkin',
    name: 'Mothkin',
    desc: 'DUSTY WINGS · FLIGHT, SHOTS LEAVE SLOWING DUST',
    need: 3,
    effects: [
      { type: 'flag', flag: 'flying' },
      { type: 'mod', mod: 'slow' },
      { type: 'mod', mod: 'puddle' },
      { type: 'stat', stat: 'moveSpeed', add: 8 },
    ],
    costume: {
      id: 'set.mothkin.wings',
      layer: 'cape',
      sprite: COSTUME_MOTH_WINGS,
      behind: true,
      frames: 'anim',
      fps: 6,
      sparks: '#f8f0c8',
    },
  },
];

export default sets;
