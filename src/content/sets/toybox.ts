/**
 * Toybox transformation (DESIGN.md item set 6): any 3 toys → a patchwork raincoat and two Tin Sentries
 * marching behind you (they stack with Tin Sentry items: each one adds another soldier), plus a
 * little luck and fire rate. Members: items with `set: 'toybox'` (content/items/passives-b-sets.ts).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_PATCHWORK } from '../sprites/itemsBCostumes';

const sets: ItemSetDef[] = [
  {
    id: 'toybox',
    name: 'Toybox',
    desc: 'TWO TIN SENTRIES JOIN YOUR PARADE',
    need: 3,
    effects: [
      { type: 'familiar', familiar: 'tin-sentry', count: 2 },
      { type: 'stat', stat: 'luck', add: 1 },
      { type: 'stat', stat: 'fireRate', add: 0.3 },
    ],
    costume: { id: 'set-toybox-patchwork', layer: 'body', sprite: COSTUME_PATCHWORK, frames: 'dir' },
  },
];

export default sets;
