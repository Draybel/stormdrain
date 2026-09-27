/**
 * Items pack A — Clockwork set (gears & springs). Hold any 3 for the transformation (sets/clockwork.ts:
 * a gear halo, more fire rate, gear-shaped shots that ricochet). Stacking notes:
 * - Pocket Metronome and Clockwork Heart MULTIPLY fire rate (×1.2 · ×1.15 per copy, soft-capped).
 * - Ratchet Wrench: kills click the fire rate up (+0.5 for 4 s, at most one click per 0.5 s) — a kill
 *   streak winds you right up. Copies add their base damage / fire rate; the clicks share one
 *   cooldown (a trigger's cooldown belongs to the item), which keeps absurd kill rates cheap.
 * - Loose Mainspring + Whirring Cog: piercing corkscrews that ricochet round the room.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_WINDUP_KEY } from '../sprites/itemsA-costumes';
import {
  ICON_CLOCKWORK_HEART,
  ICON_LOOSE_MAINSPRING,
  ICON_POCKET_METRONOME,
  ICON_RATCHET_WRENCH,
  ICON_TIN_CUCKOO,
  ICON_WHIRRING_COG,
} from '../sprites/itemsA-icons';

/** Ratchet Wrench: seconds between clicks, and how long each click's boost holds. */
const RATCHET_CLICK = 0.5;
const RATCHET_HOLD = 4;

const items: ItemDef[] = [
  {
    id: 'pocket-metronome',
    name: 'Pocket Metronome',
    desc: 'TICK-TOCK · FIRE RATE X1.2, SHOT SPEED X1.1',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop', 'boss'],
    tags: ['clockwork', 'stat-up'],
    set: 'clockwork',
    effects: [
      { type: 'stat', stat: 'fireRate', mul: 1.2 },
      { type: 'stat', stat: 'shotSpeed', mul: 1.1 },
    ],
    sprite: ICON_POCKET_METRONOME,
  },
  {
    id: 'loose-mainspring',
    name: 'Loose Mainspring',
    desc: 'SPROING! SHOTS RICOCHET AND SHOVE HARD',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'clockwork'],
    set: 'clockwork',
    effects: [
      { type: 'mod', mod: 'bounce', params: { bounces: 1 } },
      { type: 'stat', stat: 'knockback', mul: 1.4 },
      { type: 'stat', stat: 'shotSpeed', add: 25 },
    ],
    sprite: ICON_LOOSE_MAINSPRING,
  },
  {
    id: 'tin-cuckoo',
    name: 'Tin Cuckoo',
    desc: 'A WIND-UP BIRD THAT CUCKOOS OUT SHOTS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'clockwork'],
    set: 'clockwork',
    effects: [{ type: 'familiar', familiar: 'tin-cuckoo' }],
    sprite: ICON_TIN_CUCKOO,
  },
  {
    id: 'ratchet-wrench',
    name: 'Ratchet Wrench',
    desc: 'KILLS CRANK YOUR FIRE RATE UP, CLICK BY CLICK',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop', 'challenge'],
    tags: ['clockwork', 'stat-up'],
    set: 'clockwork',
    effects: [
      { type: 'stat', stat: 'damage', add: 0.3 },
      { type: 'stat', stat: 'fireRate', add: 0.15 },
      // One click per half second at most (a kill-streak winds up to +4 shots/s), each lasting 4 s.
      // The cooldown keeps the number of live boosts bounded however fast things die.
      {
        type: 'trigger',
        on: 'kill',
        cooldown: RATCHET_CLICK,
        effects: [{ type: 'stat', stat: 'fireRate', add: 0.5, duration: RATCHET_HOLD }],
      },
    ],
    sprite: ICON_RATCHET_WRENCH,
  },
  {
    id: 'clockwork-heart',
    name: 'Clockwork Heart',
    desc: 'TICKS ALONG · +1 HEART, FIRE RATE X1.15',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss', 'broker'],
    tags: ['clockwork', 'health', 'stat-up'],
    set: 'clockwork',
    effects: [
      { type: 'hearts', containers: 1 },
      { type: 'stat', stat: 'fireRate', mul: 1.15 },
      { type: 'stat', stat: 'moveSpeed', add: 6 },
    ],
    sprite: ICON_CLOCKWORK_HEART,
    costume: { id: 'clockwork-heart', layer: 'cape', sprite: COSTUME_WINDUP_KEY, behind: true, frames: 'anim', fps: 3 },
  },
  {
    id: 'whirring-cog',
    name: 'Whirring Cog',
    desc: 'SHOTS WHIRL LIKE COGS, GRINDING THROUGH FOES',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['modifier', 'clockwork'],
    set: 'clockwork',
    effects: [
      { type: 'mod', mod: 'spiral' },
      { type: 'mod', mod: 'pierce' },
      { type: 'stat', stat: 'damage', add: 0.3 },
    ],
    sprite: ICON_WHIRRING_COG,
  },
];

export default items;
