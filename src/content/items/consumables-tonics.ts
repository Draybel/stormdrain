/**
 * Mystery Tonics (DESIGN.md "Pickups"): ten coloured bottles and ten effects. Each run deals the
 * effects to the colours from the run seed (src/sim/tonics.ts); a bottle reads '??? <COLOUR> TONIC'
 * until one of its colour is drunk, then shows its real name for the rest of the run.
 *
 * - TONIC_BOTTLES (this file's default export) are the items: `consumable: 'tonic'`, and their own
 *   `use` is only the shared glug (a splash in the bottle's colour). Their descriptions are flavour
 *   hints that say nothing about the effect.
 * - TONICS are the effects (TonicDef): eight kind ones, two bad trips (Sour, Dizzy).
 * Stacking: Clover Tonic luck is permanent; the "for the room" ones multiply with everything held.
 */

import type { ItemDef, TonicDef } from '../../sim/types';
import {
  ICON_TONIC_AMBER,
  ICON_TONIC_COBALT,
  ICON_TONIC_CRIMSON,
  ICON_TONIC_LEMON,
  ICON_TONIC_MOSS,
  ICON_TONIC_MURK,
  ICON_TONIC_PEARL,
  ICON_TONIC_ROSE,
  ICON_TONIC_TEAL,
  ICON_TONIC_VIOLET,
} from '../sprites/itemsCConsumables';

/** The ten effects a bottle can hold. */
export const TONICS: readonly TonicDef[] = [
  {
    id: 'mending',
    name: 'Mending Tonic',
    desc: 'HEALS TWO HEARTS',
    good: true,
    use: [{ type: 'heal', amount: 4 }],
  },
  {
    id: 'warm-milk',
    name: 'Warm Milk Tonic',
    desc: 'FULL HEALTH · AND A COZY NAP FEELING',
    good: true,
    use: [{ type: 'heal', amount: 99 }],
  },
  {
    id: 'fizzbang',
    name: 'Fizzbang Tonic',
    desc: "+3 BOMBS · DON'T SHAKE IT",
    good: true,
    use: [
      { type: 'pickups', bombs: 3 },
      { type: 'hook', hook: 'itemsC.fx', params: { sfx: 'bomb_pickup' } },
    ],
  },
  {
    id: 'zippy',
    name: 'Zippy Tonic',
    desc: 'FASTER FEET AND SHOTS FOR THE ROOM',
    good: true,
    use: [
      { type: 'stat', stat: 'moveSpeed', add: 30 },
      { type: 'stat', stat: 'shotSpeed', add: 40 },
      { type: 'hook', hook: 'itemsC.fx', params: { look: 'blink', radius: 6 } },
    ],
  },
  {
    id: 'grit',
    name: 'Grit Tonic',
    desc: 'HIT MUCH HARDER FOR THE ROOM',
    good: true,
    use: [
      { type: 'stat', stat: 'damage', mul: 1.4 },
      { type: 'hook', hook: 'itemsC.fx', params: { look: 'ember', radius: 20, sfx: 'surge' } },
    ],
  },
  {
    id: 'sour',
    name: 'Sour Tonic',
    desc: 'BLEH! LOSE HALF A HEART',
    good: false,
    use: [{ type: 'hook', hook: 'itemsC.sour', params: { halves: 1 } }],
  },
  {
    id: 'dizzy',
    name: 'Dizzy Tonic',
    desc: 'LEFT IS RIGHT, UP IS DOWN · FOR A BIT',
    good: false,
    use: [
      { type: 'flag', flag: 'confused', duration: 6 },
      { type: 'hook', hook: 'itemsC.fx', params: { sfx: 'curse', say: "EVERYTHING'S BACKWARDS!" } },
    ],
  },
  {
    id: 'clover',
    name: 'Clover Tonic',
    desc: '+1 LUCK, FOR KEEPS',
    good: true,
    use: [{ type: 'hook', hook: 'itemsC.luck', params: { amount: 1 } }],
  },
  {
    id: 'tin',
    name: 'Tin Tonic',
    desc: '+1 TIN HEART · TASTES LIKE A SPOON',
    good: true,
    use: [
      { type: 'hearts', tin: 2 },
      { type: 'hook', hook: 'itemsC.fx', params: { sfx: 'heart_tin' } },
    ],
  },
  {
    id: 'storm-bottle',
    name: 'Storm in a Bottle',
    desc: 'LIGHTNING STRIKES EVERY FOE IN THE ROOM',
    good: true,
    use: [{ type: 'hook', hook: 'itemsC.lightning', params: { damage: 20, perDamage: 3, extra: 5, shake: 0.5 } }],
  },
];

/** A bottle: its colour name, flavour hint, icon and splash colour. */
function bottle(colour: string, hint: string, sprite: ItemDef['sprite'], splash: string): ItemDef {
  return {
    id: `tonic-${colour.toLowerCase()}`,
    name: `${colour} Tonic`,
    desc: `${hint} · WHAT DOES IT DO?`,
    kind: 'consumable',
    consumable: 'tonic',
    quality: 1,
    pools: ['chest', 'shop', 'trader'],
    tags: ['tonic', 'mystery'],
    effects: [],
    use: [{ type: 'hook', hook: 'itemsC.glug', params: { color: splash } }],
    sprite,
  };
}

export const TONIC_BOTTLES: readonly ItemDef[] = [
  bottle('Crimson', 'SMELLS OF CHERRIES', ICON_TONIC_CRIMSON, '#ff8a90'),
  bottle('Amber', 'WARM AND SYRUPY', ICON_TONIC_AMBER, '#ffd08a'),
  bottle('Lemon', 'IT FIZZES A LITTLE', ICON_TONIC_LEMON, '#fff4b0'),
  bottle('Moss', 'SMELLS LIKE A POND', ICON_TONIC_MOSS, '#b8e890'),
  bottle('Teal', 'COLD AS A CREEK', ICON_TONIC_TEAL, '#a8f0e8'),
  bottle('Cobalt', 'IT GLOWS, FAINTLY', ICON_TONIC_COBALT, '#9ab8ff'),
  bottle('Violet', 'IT HUMS WHEN SHAKEN', ICON_TONIC_VIOLET, '#d0a8ff'),
  bottle('Rose', 'SWEET AS BUBBLEGUM', ICON_TONIC_ROSE, '#ffc0dc'),
  bottle('Murk', 'IT HAS BITS IN IT', ICON_TONIC_MURK, '#b0a070'),
  bottle('Pearl', 'MILKY AND VERY STILL', ICON_TONIC_PEARL, '#ffffff'),
];

export default TONIC_BOTTLES;
