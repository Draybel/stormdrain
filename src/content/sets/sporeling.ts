/**
 * Sporeling transformation (DESIGN.md item sets #4): hold 3 items whose `set` is 'sporeling'
 * (content/items/passives-a-sporeling.ts). A big toadstool cap, +1 heart container (a one-time
 * instant: the set runtime grants it when the set completes), and every kill bursts into a cloud of
 * stinging spores (hook `itemsA.sporeCloud`, content/hooks/itemsA.ts) that can set off more clouds.
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_TOADSTOOL_CAP } from '../sprites/itemsA-costumes';

const sets: ItemSetDef[] = [
  {
    id: 'sporeling',
    name: 'Sporeling',
    desc: '+1 HEART · FOES BURST INTO SPORE CLOUDS',
    need: 3,
    effects: [
      { type: 'hearts', containers: 1 },
      {
        type: 'trigger',
        on: 'kill',
        effects: [{ type: 'hook', hook: 'itemsA.sporeCloud', params: { radius: 34, dmg: 0.8, poison: 3.5, power: 0.4 } }],
      },
    ],
    costume: { id: 'set.sporeling.cap', layer: 'hat', sprite: COSTUME_TOADSTOOL_CAP, frames: 'dir' },
  },
];

export default sets;
