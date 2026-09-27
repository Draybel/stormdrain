/**
 * Items pack A — Mothkin set (moths & wings). Hold any 3 for the transformation (sets/mothkin.ts:
 * dusty wings, flight, shots leave slowing dust). Stacking notes:
 * - Porch Bulb (shots orbit you) + Feathery Antennae (long-reach homing): orbiting shots lash out at
 *   anything that comes near, then settle back.
 * - Pouch of Wing Dust + Sealing Wax (Waxen) / the Mothkin set: slow stacks run to −80 % speed.
 * - Eyespot Charm's fear chance grows with more copies and with luck.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_ANTENNAE } from '../sprites/itemsA-costumes';
import {
  ICON_GLOAMWING,
  ICON_FEATHERY_ANTENNAE,
  ICON_EYESPOT_CHARM,
  ICON_PORCH_BULB,
  ICON_SNUG_COCOON,
  ICON_WING_DUST_POUCH,
} from '../sprites/itemsA-icons';

const items: ItemDef[] = [
  {
    id: 'feathery-antennae',
    name: 'Feathery Antennae',
    desc: 'SHOTS SNIFF OUT FOES FROM ACROSS THE ROOM',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss'],
    tags: ['modifier', 'mothkin'],
    set: 'mothkin',
    effects: [
      { type: 'mod', mod: 'homing', params: { radius: 48, turn: 1 } },
      { type: 'stat', stat: 'range', add: 30 },
      { type: 'stat', stat: 'damage', add: 0.4 },
    ],
    sprite: ICON_FEATHERY_ANTENNAE,
    costume: { id: 'feathery-antennae', layer: 'hat', sprite: COSTUME_ANTENNAE, frames: 'anim', fps: 2 },
  },
  {
    id: 'wing-dust-pouch',
    name: 'Pouch of Wing Dust',
    desc: 'SHOTS SHED SHIMMERY DUST THAT SLOWS FOES',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'mothkin'],
    set: 'mothkin',
    effects: [
      { type: 'mod', mod: 'slow' },
      { type: 'mod', mod: 'puddle' },
      { type: 'stat', stat: 'damage', add: 0.3 },
    ],
    sprite: ICON_WING_DUST_POUCH,
  },
  {
    id: 'porch-bulb',
    name: 'Porch Bulb',
    desc: 'SHOTS FLUTTER ROUND YOU LIKE MOTHS AT A LAMP',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['modifier', 'mothkin'],
    set: 'mothkin',
    effects: [
      { type: 'mod', mod: 'orbitPlayer' },
      { type: 'mod', mod: 'wavy' },
      { type: 'flag', flag: 'darkVision' },
      { type: 'stat', stat: 'range', add: 25 },
    ],
    sprite: ICON_PORCH_BULB,
  },
  {
    id: 'eyespot-charm',
    name: 'Eyespot Charm',
    desc: 'BIG STARING EYESPOTS · FOES FLEE YOUR SHOTS',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'mothkin'],
    set: 'mothkin',
    effects: [
      { type: 'mod', mod: 'fear', stacks: 2 },
      { type: 'stat', stat: 'range', add: 15 },
    ],
    sprite: ICON_EYESPOT_CHARM,
  },
  {
    id: 'gloamwing',
    name: 'Gloamwing',
    desc: 'A DUSK MOTH CIRCLES YOU · SHOOTS AND BLOCKS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['familiar', 'mothkin'],
    set: 'mothkin',
    effects: [{ type: 'familiar', familiar: 'gloamwing' }],
    sprite: ICON_GLOAMWING,
  },
  {
    id: 'snug-cocoon',
    name: 'Snug Cocoon',
    desc: 'SO COZY · +1 HEART AND A TIN HEART',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'boss'],
    tags: ['mothkin', 'health'],
    set: 'mothkin',
    effects: [{ type: 'hearts', containers: 1, tin: 2 }],
    sprite: ICON_SNUG_COCOON,
  },
];

export default items;
