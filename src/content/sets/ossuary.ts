/**
 * Ossuary transformation (DESIGN.md item set 7): any 3 bones → a bone mask with glowing sockets,
 * bone blades orbiting you (the orbit carrier: it merges into any primary and stacks with
 * Bone Jacks / Tin Pinwheel for more blades), a Tin heart at the start of every floor and a
 * little damage. Members: items with `set: 'ossuary'` (content/items/passives-b-sets.ts).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_BONE_MASK } from '../sprites/itemsBCostumes';

const sets: ItemSetDef[] = [
  {
    id: 'ossuary',
    name: 'Ossuary',
    desc: 'BONE BLADES SPIN · A TIN HEART EVERY FLOOR',
    need: 3,
    effects: [
      { type: 'carrier', carrier: 'orbit' },
      { type: 'stat', stat: 'damage', add: 0.5 },
      { type: 'trigger', on: 'floorStart', effects: [{ type: 'hearts', tin: 2 }] },
    ],
    costume: { id: 'set-ossuary-mask', layer: 'eyes', sprite: COSTUME_BONE_MASK, frames: 'dir', glow: '160,255,210' },
  },
];

export default sets;
