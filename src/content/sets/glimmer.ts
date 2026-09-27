/**
 * Glimmer transformation (DESIGN.md item set 9): any 3 crystals → violet crystals growing out of
 * the hood, and every shot bursts into three crystal shards on a hit (split; stacks with Geode /
 * Cracked Cat's-Eye into wider, deeper shard sprays), plus a little damage and shot size.
 * Members: items with `set: 'glimmer'` (content/items/passives-b-sets.ts).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_CRYSTAL_SKIN } from '../sprites/itemsBCostumes';

const sets: ItemSetDef[] = [
  {
    id: 'glimmer',
    name: 'Glimmer',
    desc: 'SHOTS BURST INTO CRYSTAL SHARDS ON HIT',
    need: 3,
    effects: [
      { type: 'mod', mod: 'split', params: { count: 1 } },
      { type: 'stat', stat: 'damage', add: 0.5 },
      { type: 'stat', stat: 'shotSize', add: 0.5 },
    ],
    costume: {
      id: 'set-glimmer-crystals',
      layer: 'hat',
      sprite: COSTUME_CRYSTAL_SKIN,
      frames: 'anim',
      fps: 3,
      glow: '200,160,255',
      sparks: '#f0e0ff',
    },
  },
];

export default sets;
