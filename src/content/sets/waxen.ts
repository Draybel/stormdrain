/**
 * Waxen transformation (DESIGN.md item sets #5): hold 3 items whose `set` is 'waxen'
 * (content/items/passives-a-waxen.ts). A crown of little candles: burning shots (longer burns),
 * +damage, fireproof (fires and fire hazards can't hurt you), and a bright light that ignores the
 * Curse of the Blackout (`darkVision`).
 */

import type { ItemSetDef } from '../../sim/types';
import { COSTUME_CANDLE_CROWN } from '../sprites/itemsA-costumes';

const sets: ItemSetDef[] = [
  {
    id: 'waxen',
    name: 'Waxen',
    desc: 'BURNING SHOTS · FIREPROOF · SEES IN THE DARK',
    need: 3,
    effects: [
      { type: 'mod', mod: 'burn', params: { duration: 1 } },
      { type: 'stat', stat: 'damage', add: 0.5 },
      { type: 'flag', flag: 'fireImmune' },
      { type: 'flag', flag: 'darkVision' },
    ],
    costume: {
      id: 'set.waxen.crown',
      layer: 'hat',
      sprite: COSTUME_CANDLE_CROWN,
      frames: 'anim',
      fps: 7,
      glow: '255,190,90',
      sparks: '#ffcf57',
    },
  },
];

export default sets;
