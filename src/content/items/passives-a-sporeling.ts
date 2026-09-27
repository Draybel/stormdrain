/**
 * Items pack A — Sporeling set (mushrooms). Hold any 3 for the transformation (sets/sporeling.ts: a
 * toadstool cap, +1 heart, every kill bursts into a spore cloud). Stacking notes:
 * - Fairy Ring's clouds (and the set's) damage and poison what's around, and kills they cause fire the
 *   kill trigger again — crowds pop in chains (nesting stops at depth 3). Copies roll separately.
 * - Earthstar + Snail Shell / Pouch of Wing Dust: bigger, longer-lived spore patches.
 * - Shelf Fungus loves slow shots (Static Cling, Snail Mail Stamp): they keep growing.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_FAIRY_RING_BACK, COSTUME_FAIRY_RING_FRONT } from '../sprites/itemsA-costumes';
import { ICON_FAIRY_RING, ICON_GLOWCAP, ICON_EARTHSTAR, ICON_SHELF_FUNGUS, ICON_TODDLECAP } from '../sprites/itemsA-icons';

const items: ItemDef[] = [
  {
    id: 'earthstar',
    name: 'Earthstar',
    desc: 'SHOTS PUFF OUT PATCHES OF STINGING SPORES',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'sporeling'],
    set: 'sporeling',
    effects: [
      { type: 'mod', mod: 'puddle' },
      { type: 'mod', mod: 'poison', params: { duration: 1 } },
    ],
    sprite: ICON_EARTHSTAR,
  },
  {
    id: 'glowcap',
    name: 'Glowcap',
    desc: '+1 LUCK · GLOWS IN THE DARK, SPOTS SECRETS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'secret'],
    tags: ['sporeling', 'luck'],
    set: 'sporeling',
    effects: [
      { type: 'stat', stat: 'luck', add: 1 },
      { type: 'stat', stat: 'range', add: 20 },
      { type: 'flag', flag: 'darkVision' },
      { type: 'flag', flag: 'seeSecrets' },
    ],
    sprite: ICON_GLOWCAP,
  },
  {
    id: 'fairy-ring',
    name: 'Fairy Ring',
    desc: 'FOES MAY BURST INTO SPORE CLOUDS ON DEATH',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'secret', 'deepSecret'],
    tags: ['sporeling'],
    set: 'sporeling',
    effects: [
      { type: 'stat', stat: 'damage', add: 0.4 },
      {
        type: 'trigger',
        on: 'kill',
        chance: 0.35,
        luck: 0.05,
        maxChance: 0.8,
        effects: [{ type: 'hook', hook: 'itemsA.sporeCloud', params: { radius: 28, dmg: 0.6, poison: 3 } }],
      },
    ],
    sprite: ICON_FAIRY_RING,
    costume: [
      { id: 'fairy-ring.back', layer: 'body', sprite: COSTUME_FAIRY_RING_BACK, behind: true, frames: 'anim', glow: '190,255,160' },
      { id: 'fairy-ring.front', layer: 'body', sprite: COSTUME_FAIRY_RING_FRONT, frames: 'anim' },
    ],
  },
  {
    id: 'toddlecap',
    name: 'Toddlecap',
    desc: 'A LITTLE MUSHROOM THAT HEADBUTTS FOES',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'sporeling'],
    set: 'sporeling',
    effects: [{ type: 'familiar', familiar: 'toddlecap' }],
    sprite: ICON_TODDLECAP,
  },
  {
    id: 'shelf-fungus',
    name: 'Shelf Fungus',
    desc: 'SHOTS SWELL UP BIGGER AS THEY FLY',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['modifier', 'sporeling'],
    set: 'sporeling',
    effects: [
      { type: 'mod', mod: 'grow' },
      { type: 'stat', stat: 'damage', add: 0.4 },
      { type: 'stat', stat: 'range', add: 20 },
    ],
    sprite: ICON_SHELF_FUNGUS,
  },
];

export default items;
