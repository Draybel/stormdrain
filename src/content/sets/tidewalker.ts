/**
 * Tidewalker transformation (DESIGN.md item set 8): any 3 water items → a wet shimmer with drops
 * falling past you, shots that bounce off walls and leave stinging puddles, and quicker feet and
 * shots. Members: items with `set: 'tidewalker'` (content/items/passives-b-sets.ts).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_WET_SHIMMER } from '../sprites/itemsBCostumes';

const sets: ItemSetDef[] = [
  {
    id: 'tidewalker',
    name: 'Tidewalker',
    desc: 'SHOTS BOUNCE AND PUDDLE · SPEED UP',
    need: 3,
    effects: [
      { type: 'mod', mod: 'bounce' },
      { type: 'mod', mod: 'puddle' },
      { type: 'stat', stat: 'moveSpeed', add: 16 },
      { type: 'stat', stat: 'shotSpeed', add: 20 },
    ],
    costume: {
      id: 'set-tidewalker-shimmer',
      layer: 'aura',
      sprite: COSTUME_WET_SHIMMER,
      behind: true,
      frames: 'anim',
      fps: 8,
      glow: '110,190,255',
      sparks: '#bfe8ff',
      additive: true,
    },
  },
];

export default sets;
