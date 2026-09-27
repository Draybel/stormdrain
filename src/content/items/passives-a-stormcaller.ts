/**
 * Items pack A — Stormcaller set (lightning). Hold any 3 for the transformation (sets/stormcaller.ts:
 * a cape of static, every shot chains lightning, more damage). Stacking notes:
 * - Brass Kite Key + Static Cling: two chain stacks plus the Key's extra jump (4 jumps, 68 px) —
 *   floating mines that arc through a whole crowd; the set adds another stack on top.
 * - Wool Mitten / Falling Barometer turn getting hit into power (each copy adds its own trigger;
 *   Barometer boosts multiply per hit until you leave the room).
 * - Crackle Candy is luck-scaled; overlapping sparks stack chain further.
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_KITE, COSTUME_STATIC_CLING } from '../sprites/itemsA-costumes';
import {
  ICON_BLINKBUG,
  ICON_BRASS_KITE_KEY,
  ICON_CRACKLE_CANDY,
  ICON_FALLING_BAROMETER,
  ICON_STATIC_CLING,
  ICON_WOOL_MITTEN,
} from '../sprites/itemsA-icons';

/** How long Crackle Candy's fizz lasts (s). */
const FIZZ = 1.5;

const items: ItemDef[] = [
  {
    id: 'brass-kite-key',
    name: 'Brass Kite Key',
    desc: 'LIGHTNING LEAPS FROM FOE TO FOE TO FOE',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss'],
    tags: ['modifier', 'stormcaller', 'lightning'],
    set: 'stormcaller',
    effects: [
      { type: 'mod', mod: 'chain', params: { jumps: 1 } },
      { type: 'stat', stat: 'damage', add: 0.5 },
      { type: 'stat', stat: 'shotSpeed', add: 20 },
    ],
    sprite: ICON_BRASS_KITE_KEY,
    costume: { id: 'brass-kite-key', layer: 'hat', sprite: COSTUME_KITE, frames: 'anim', fps: 3, sparks: '#fff27a' },
  },
  {
    id: 'wool-mitten',
    name: 'Wool Mitten',
    desc: '+FIRE RATE · WHEN HIT, A STATIC SHOCK BURSTS',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['stormcaller', 'lightning', 'stat-up'],
    set: 'stormcaller',
    effects: [
      { type: 'stat', stat: 'fireRate', add: 0.35 },
      {
        type: 'trigger',
        on: 'hurt',
        effects: [{ type: 'hook', hook: 'shockwave', params: { radius: 60, damage: 22 } }],
      },
    ],
    sprite: ICON_WOOL_MITTEN,
  },
  {
    id: 'crackle-candy',
    name: 'Crackle Candy',
    desc: 'NOW AND THEN, YOUR SHOTS FIZZ WITH SPARKS',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'stormcaller', 'lightning', 'food'],
    set: 'stormcaller',
    effects: [
      { type: 'stat', stat: 'fireRate', add: 0.2 },
      {
        type: 'trigger',
        on: 'fire',
        chance: 0.06,
        luck: 0.02,
        maxChance: 0.3,
        effects: [
          { type: 'mod', mod: 'chain', duration: FIZZ },
          { type: 'stat', stat: 'shotSpeed', mul: 1.25, duration: FIZZ },
        ],
      },
    ],
    sprite: ICON_CRACKLE_CANDY,
  },
  {
    id: 'falling-barometer',
    name: 'Falling Barometer',
    desc: 'EACH HIT YOU TAKE: MORE DAMAGE THIS ROOM',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'cursed', 'challenge'],
    tags: ['stormcaller', 'stat-up'],
    set: 'stormcaller',
    effects: [
      { type: 'stat', stat: 'damage', add: 0.3 },
      {
        type: 'trigger',
        on: 'hurt',
        say: 'THE PRESSURE DROPS!',
        // No duration: these last until you leave the room, and every hit adds another round.
        effects: [
          { type: 'stat', stat: 'damage', mul: 1.25 },
          { type: 'stat', stat: 'fireRate', add: 0.4 },
        ],
      },
    ],
    sprite: ICON_FALLING_BAROMETER,
  },
  {
    id: 'blinkbug',
    name: 'Blinkbug',
    desc: 'A LIGHTNING BUG ZIPS ALONG AND FIRES WITH YOU',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['familiar', 'stormcaller', 'lightning'],
    set: 'stormcaller',
    effects: [{ type: 'familiar', familiar: 'blinkbug' }],
    sprite: ICON_BLINKBUG,
  },
  {
    id: 'static-cling',
    unlock: 'bone-deep',
    name: 'Static Cling',
    desc: 'SHOTS HANG IN THE AIR, CRACKLING',
    kind: 'passive',
    quality: 3,
    pools: ['treasure'],
    tags: ['modifier', 'stormcaller', 'lightning'],
    set: 'stormcaller',
    effects: [
      { type: 'mod', mod: 'decelerate' },
      { type: 'mod', mod: 'chain' },
      { type: 'stat', stat: 'range', add: 40 },
    ],
    sprite: ICON_STATIC_CLING,
    costume: { id: 'static-cling', layer: 'held', sprite: COSTUME_STATIC_CLING, frames: 'anim', fps: 2.5, sparks: '#fff27a' },
  },
];

export default items;
