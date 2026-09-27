/**
 * Marrow — a little friendly skeleton in a red scarf (DESIGN.md "Characters" 3).
 * Mechanic BONE TOSS (`marrow.boneToss`): the boomerang carrier is innate (Marrow throws a bone that comes
 * back), and there are no red hearts at all — three Tin hearts to start; red heart pickups, heals and new
 * heart containers all turn into Tin (the `noRedHearts` flag: sim/effects.ts, sim/pickups.ts).
 * Unlock: die 10 times.
 */

import type { CharacterDef } from '../../sim/types';
import { MARROW_SPRITE } from '../sprites/characters';

export const MARROW: CharacterDef = {
  id: 'marrow',
  name: 'Marrow',
  desc: 'A little friendly skeleton in a red scarf. Nothing left to bruise.',
  stats: {
    damage: 3.3,
    fireRate: 2.8,
    shotSpeed: 185,
    range: 150,
    moveSpeed: 98,
    luck: 0,
    shotSize: 3,
    knockback: 70,
  },
  hearts: { redMax: 0, tin: 6 },
  startItems: [],
  startPickups: { coins: 0, bombs: 1, keys: 1 },
  sprite: MARROW_SPRITE,
  shotColor: '#efe8d6',
  mechanic: 'marrow.boneToss',
  mechanicDesc: 'BONE TOSS: THROWS A BONE THAT FLIES BACK. NO RED HEARTS: HEARTS, HEALS AND CONTAINERS BECOME TIN.',
  innate: [
    { type: 'carrier', carrier: 'boomerang' },
    { type: 'flag', flag: 'noRedHearts' },
  ],
  order: 2,
  unlock: 'soaked-through',
};

const characters: CharacterDef[] = [MARROW];
export default characters;
