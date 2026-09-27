/**
 * Items pack A — Waxen set (candles). Hold any 3 for the transformation (sets/waxen.ts: a candle
 * crown, burning shots, fireproof, sees in the dark). Stacking notes:
 * - Candelabra: +2 shots per copy at ×0.8 damage each (two copies: 5 shots at ×0.64 — the extra shots
 *   multiply everything else they carry: burn, split, chain…).
 * - Trick Candle + Drippy Candle / the set: burn stacks last longer and bite harder.
 * - Candle Snuffer's Ember hearts break into fire novas when you get hit.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_CANDELABRA } from '../sprites/itemsA-costumes';
import {
  ICON_TRICK_CANDLE,
  ICON_CANDELABRA,
  ICON_CANDLE_SNUFFER,
  ICON_SEALING_WAX,
  ICON_TALLOW_TOT,
} from '../sprites/itemsA-icons';

const items: ItemDef[] = [
  {
    id: 'trick-candle',
    name: 'Trick Candle',
    desc: 'IT KEEPS RELIGHTING · +1 LUCK, BURNING SHOTS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'waxen'],
    set: 'waxen',
    effects: [
      { type: 'mod', mod: 'burn' },
      { type: 'stat', stat: 'luck', add: 1 },
    ],
    sprite: ICON_TRICK_CANDLE,
  },
  {
    id: 'sealing-wax',
    name: 'Sealing Wax',
    desc: 'HOT WAX GUMS FOES UP · THEY SLOW RIGHT DOWN',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'waxen'],
    set: 'waxen',
    effects: [
      { type: 'mod', mod: 'slow', stacks: 2 },
      { type: 'stat', stat: 'damage', add: 0.4 },
    ],
    sprite: ICON_SEALING_WAX,
  },
  {
    id: 'candelabra',
    unlock: 'bare-bones',
    name: 'Candelabra',
    desc: 'THREE FLAMES, THREE SHOTS · EACH A BIT WEAKER',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'broker'],
    tags: ['modifier', 'waxen'],
    set: 'waxen',
    effects: [
      { type: 'mod', mod: 'extraShots', stacks: 2 },
      { type: 'mod', mod: 'burn' },
      { type: 'stat', stat: 'damage', mul: 0.8 },
    ],
    sprite: ICON_CANDELABRA,
    costume: { id: 'candelabra', layer: 'held', sprite: COSTUME_CANDELABRA, frames: 'dir', glow: '255,190,90', sparks: '#ffcf57' },
  },
  {
    id: 'candle-snuffer',
    name: 'Candle Snuffer',
    desc: 'KILLS MAY KINDLE HALF AN EMBER HEART',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['waxen', 'health'],
    set: 'waxen',
    effects: [
      { type: 'stat', stat: 'range', add: 15 },
      { type: 'trigger', on: 'kill', chance: 0.04, luck: 0.01, maxChance: 0.15, effects: [{ type: 'hearts', ember: 1 }] },
    ],
    sprite: ICON_CANDLE_SNUFFER,
  },
  {
    id: 'tallow-tot',
    name: 'Tallow Tot',
    desc: 'A STUBBY CANDLE BUDDY THAT SHOOTS ALONG',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['familiar', 'waxen'],
    set: 'waxen',
    effects: [{ type: 'familiar', familiar: 'tallow-tot' }],
    sprite: ICON_TALLOW_TOT,
  },
];

export default items;
