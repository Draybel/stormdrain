/**
 * Clockwork transformation (DESIGN.md item sets #3): hold 3 items whose `set` is 'clockwork'
 * (content/items/passives-a-clockwork.ts). A turning gear halo, more fire rate (+0.5, then ×1.2), and
 * shots that spin as gears and ricochet once (the bounce modifier's gear shape; its `bounces: -1`
 * trims the usual 2 bounces per stack to 1 — more bounce items add their full count on top).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_GEAR_HALO } from '../sprites/itemsA-costumes';

const sets: ItemSetDef[] = [
  {
    id: 'clockwork',
    name: 'Clockwork',
    desc: 'WOUND UP · +FIRE RATE, GEAR SHOTS RICOCHET',
    need: 3,
    effects: [
      { type: 'stat', stat: 'fireRate', add: 0.5 },
      { type: 'stat', stat: 'fireRate', mul: 1.2 },
      { type: 'mod', mod: 'bounce', params: { bounces: -1 } },
    ],
    costume: {
      id: 'set.clockwork.halo',
      layer: 'hat',
      sprite: COSTUME_GEAR_HALO,
      frames: 'anim',
      fps: 5,
      glow: '255,220,120',
    },
  },
];

export default sets;
