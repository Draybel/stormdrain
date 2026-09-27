/**
 * "Items B" general passives (20): health ups (containers, Tin and Ember hearts), luck, 'on hurt' /
 * 'on kill' / 'on room clear' / 'on bomb' / 'on pickup' triggers, the pickup economy (coins, keys, bombs,
 * active charge, extra slots), flight, spectral shots, stat multipliers, a combo enabler and a familiar.
 *
 * Stacking: stat multipliers multiply (two Kettles = ×1.69 damage), chance triggers roll once per copy,
 * 'on hurt' buffs pile up as separate timed effects, one-time hearts / pickups come with every fresh copy.
 * Rusty Toll Box uses the `itemsB.toll` hook (content/hooks/itemsB.ts).
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_BALLOONS, COSTUME_BEDSHEET, COSTUME_KETTLE_HELMET } from '../sprites/itemsBCostumes';
import {
  ICON_BEDSHEET_GHOST,
  ICON_BENT_HORSESHOE,
  ICON_BUNDLE_OF_BALLOONS,
  ICON_BURNT_COFFEE_BEAN,
  ICON_CAST_IRON_KETTLE,
  ICON_CHIPPED_PIGGY_BANK,
  ICON_CLOVER_IN_AMBER,
  ICON_GRUDGE_PEBBLE,
  ICON_GUTTER_FERRET,
  ICON_HAND_ME_DOWN_POCKETS,
  ICON_HOT_WATER_BOTTLE,
  ICON_KALEIDOSCOPE,
  ICON_LEATHER_APRON,
  ICON_RUSTY_TOLL_BOX,
  ICON_SARDINE_TIN,
  ICON_SPARE_SPOON,
  ICON_STRAY_CATS_BELL,
  ICON_THUNDER_EGG,
  ICON_TIN_LUNCHBOX,
  ICON_WARMING_PAN,
} from '../sprites/itemsBIcons';

const items: ItemDef[] = [
  // ── Health ──
  {
    id: 'hot-water-bottle',
    name: 'Hot Water Bottle',
    desc: 'HEALTH UP · +1 EMBER HEART · TOASTY',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop', 'boss'],
    tags: ['health'],
    effects: [
      { type: 'hearts', containers: 1, ember: 2 },
      { type: 'heal', amount: 2 },
    ],
    sprite: ICON_HOT_WATER_BOTTLE,
  },
  {
    id: 'sardine-tin',
    name: 'Sardine Tin',
    desc: '+3 TIN HEARTS · SMELLS VERY FISHY',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['health', 'food'],
    effects: [{ type: 'hearts', tin: 6 }],
    sprite: ICON_SARDINE_TIN,
  },
  {
    id: 'warming-pan',
    name: 'Warming Pan',
    desc: "+2 EMBER HEARTS · FIRE CAN'T HURT YOU",
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'cursed'],
    tags: ['health'],
    effects: [
      { type: 'hearts', ember: 4 },
      { type: 'flag', flag: 'fireImmune' },
    ],
    sprite: ICON_WARMING_PAN,
  },

  // ── Luck ──
  {
    id: 'clover-in-amber',
    name: 'Clover in Amber',
    desc: 'LUCK UP · A LUCKY COIN EVERY FLOOR',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'secret'],
    tags: ['luck'],
    effects: [
      { type: 'stat', stat: 'luck', add: 1.5 },
      { type: 'trigger', on: 'floorStart', effects: [{ type: 'pickups', spawn: [{ kind: 'luckyCoin' }] }] },
    ],
    sprite: ICON_CLOVER_IN_AMBER,
  },
  {
    id: 'bent-horseshoe',
    name: 'Bent Horseshoe',
    desc: 'LUCK UP UP · SHOTS WOBBLE A LITTLE',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'cursed'],
    tags: ['luck', 'gamble'],
    effects: [
      { type: 'stat', stat: 'luck', add: 2 },
      { type: 'mod', mod: 'inaccuracy' },
    ],
    sprite: ICON_BENT_HORSESHOE,
  },

  // ── Triggers ──
  {
    id: 'grudge-pebble',
    name: 'Grudge Pebble',
    desc: 'WHEN HURT, HIT MUCH HARDER FOR A WHILE',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'cursed'],
    tags: ['trigger'],
    effects: [{ type: 'trigger', on: 'hurt', effects: [{ type: 'stat', stat: 'damage', add: 2, duration: 10 }] }],
    sprite: ICON_GRUDGE_PEBBLE,
  },
  {
    id: 'spare-spoon',
    name: 'Spare Spoon',
    desc: 'FOES MAY LEAVE A SIP OF HEALTH BEHIND',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['trigger', 'food'],
    effects: [
      {
        type: 'trigger',
        on: 'kill',
        chance: 0.06,
        luck: 0.01,
        maxChance: 0.25,
        effects: [{ type: 'heal', amount: 1 }],
      },
    ],
    sprite: ICON_SPARE_SPOON,
  },
  {
    id: 'stray-cats-bell',
    name: "Stray Cat's Bell",
    desc: 'AFTER A KILL, SHOTS HUNT FOR A MOMENT',
    kind: 'passive',
    quality: 2,
    pools: ['treasure'],
    tags: ['trigger', 'combo'],
    effects: [
      { type: 'stat', stat: 'range', add: 15 },
      { type: 'trigger', on: 'kill', cooldown: 0.5, effects: [{ type: 'mod', mod: 'homing', duration: 2.5 }] },
    ],
    sprite: ICON_STRAY_CATS_BELL,
  },
  {
    id: 'tin-lunchbox',
    name: 'Tin Lunchbox',
    desc: 'CLEARED ROOMS MAY PACK YOU A SNACK',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['trigger', 'food', 'economy'],
    effects: [
      {
        type: 'trigger',
        on: 'roomClear',
        chance: 0.25,
        luck: 0.05,
        maxChance: 0.6,
        effects: [{ type: 'pickups', table: 'basket' }],
      },
    ],
    sprite: ICON_TIN_LUNCHBOX,
  },
  {
    id: 'thunder-egg',
    name: 'Thunder Egg',
    desc: 'CLEARED ROOMS MAY ADD ACTIVE CHARGE',
    kind: 'passive',
    quality: 1,
    pools: ['shop', 'treasure'],
    tags: ['trigger', 'economy', 'lightning'],
    effects: [
      {
        type: 'trigger',
        on: 'roomClear',
        chance: 0.35,
        luck: 0.05,
        maxChance: 0.75,
        effects: [{ type: 'pickups', charge: 1 }],
      },
    ],
    sprite: ICON_THUNDER_EGG,
  },

  // ── Economy ──
  {
    id: 'chipped-piggy-bank',
    name: 'Chipped Piggy Bank',
    desc: '+5 COINS · A COIN FOR EVERY ROOM CLEARED',
    kind: 'passive',
    quality: 1,
    pools: ['shop', 'treasure'],
    tags: ['economy'],
    effects: [
      { type: 'pickups', coins: 5 },
      { type: 'trigger', on: 'roomClear', effects: [{ type: 'pickups', coins: 1 }] },
    ],
    sprite: ICON_CHIPPED_PIGGY_BANK,
  },
  {
    id: 'leather-apron',
    name: 'Leather Apron',
    desc: "+3 BOMBS · YOUR OWN BLASTS CAN'T HURT",
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['economy', 'explosive'],
    effects: [
      { type: 'pickups', bombs: 3 },
      { type: 'flag', flag: 'explosionImmune' },
      {
        type: 'trigger',
        on: 'bomb',
        chance: 0.2,
        luck: 0.04,
        maxChance: 0.5,
        effects: [{ type: 'pickups', bombs: 1 }],
      },
    ],
    sprite: ICON_LEATHER_APRON,
  },
  {
    id: 'rusty-toll-box',
    name: 'Rusty Toll Box',
    desc: 'EACH CLEAR TRADES 4 COINS FOR A TIN HEART',
    kind: 'passive',
    quality: 1,
    pools: ['shop', 'secret'],
    tags: ['economy', 'trade'],
    effects: [
      { type: 'trigger', on: 'roomClear', effects: [{ type: 'hook', hook: 'itemsB.toll', params: { cost: 4, pickup: 'tinHeart' } }] },
    ],
    sprite: ICON_RUSTY_TOLL_BOX,
  },
  {
    id: 'hand-me-down-pockets',
    name: 'Hand-Me-Down Pockets',
    desc: 'HOLD 2 TRINKETS AND 2 CONSUMABLES',
    kind: 'passive',
    quality: 2,
    pools: ['shop', 'treasure'],
    tags: ['utility', 'economy'],
    effects: [
      { type: 'flag', flag: 'extraTrinket' },
      { type: 'flag', flag: 'extraConsumable' },
      {
        type: 'trigger',
        on: 'pickup',
        chance: 0.08,
        luck: 0.02,
        maxChance: 0.25,
        effects: [{ type: 'pickups', coins: 1 }],
      },
    ],
    sprite: ICON_HAND_ME_DOWN_POCKETS,
  },

  // ── Flight, spectral ──
  {
    id: 'bundle-of-balloons',
    name: 'Bundle of Balloons',
    desc: "FLIGHT · DON'T LET GO OF THE STRINGS",
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss', 'broker'],
    tags: ['flight', 'toy'],
    effects: [
      { type: 'flag', flag: 'flying' },
      { type: 'stat', stat: 'range', add: 15 },
    ],
    sprite: ICON_BUNDLE_OF_BALLOONS,
    costume: { id: 'balloons', layer: 'hat', sprite: COSTUME_BALLOONS, behind: true, frames: 'anim', fps: 2 },
  },
  {
    id: 'bedsheet-ghost',
    name: 'Bedsheet Ghost',
    desc: 'SHOTS FLOAT THROUGH ROCKS · BOOO!',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'secret'],
    tags: ['spectral', 'spooky'],
    effects: [
      { type: 'flag', flag: 'spectral' },
      { type: 'mod', mod: 'fear' },
      { type: 'stat', stat: 'range', add: 25 },
    ],
    sprite: ICON_BEDSHEET_GHOST,
    costume: { id: 'bedsheet', layer: 'body', sprite: COSTUME_BEDSHEET, frames: 'dir' },
  },

  // ── Stat multipliers ──
  {
    id: 'cast-iron-kettle',
    name: 'Cast-Iron Kettle',
    desc: 'DAMAGE +30% · HEAVY TO LUG AROUND',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss', 'broker'],
    tags: ['stat-mul'],
    effects: [
      { type: 'stat', stat: 'damage', mul: 1.3 },
      { type: 'stat', stat: 'moveSpeed', mul: 0.92 },
    ],
    sprite: ICON_CAST_IRON_KETTLE,
    costume: { id: 'kettle-helmet', layer: 'hat', sprite: COSTUME_KETTLE_HELMET, frames: 'dir' },
  },
  {
    id: 'burnt-coffee-bean',
    name: 'Burnt Coffee Bean',
    desc: 'FIRE RATE +20% · JITTERY LITTLE FEET',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['stat-mul', 'food'],
    effects: [
      { type: 'stat', stat: 'fireRate', mul: 1.2 },
      { type: 'stat', stat: 'moveSpeed', add: 8 },
    ],
    sprite: ICON_BURNT_COFFEE_BEAN,
  },

  // ── Combo enabler, familiar ──
  {
    id: 'kaleidoscope',
    name: 'Kaleidoscope',
    desc: 'SHOTS BURST OUT EVERY WHICH WAY',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'challenge'],
    tags: ['modifier', 'glimmer'],
    effects: [
      { type: 'mod', mod: 'sideShots' },
      { type: 'mod', mod: 'backShot' },
      { type: 'stat', stat: 'damage', mul: 0.85 },
    ],
    sprite: ICON_KALEIDOSCOPE,
  },
  {
    id: 'gutter-ferret',
    name: 'Gutter Ferret',
    desc: 'A FERRET DARTS OUT AND NIPS AT FOES',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['familiar'],
    effects: [{ type: 'familiar', familiar: 'gutter-ferret' }],
    sprite: ICON_GUTTER_FERRET,
  },
];

export default items;
