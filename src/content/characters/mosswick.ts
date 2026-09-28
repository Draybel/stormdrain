/**
 * Mosswick — a small swamp sprite in a lily-pad hat (DESIGN.md "Characters" 7).
 * Mechanic BOG BLOOD (`mosswick.bogBlood`, sim/mechanics.ts): the puddle modifier is innate (shots leave
 * stinging puddles, and a shorter range lands them close by); standing in those puddles soaks up half a Tin
 * heart every 2.5 s while a fight is on, up to two Tin hearts (MECHANIC_TUNING.soak).
 * Unlock: defeat Old Thunderhead (Ending 1).
 */

import type { CharacterDef } from '../../sim/types';
import { MOSSWICK_SPRITE } from '../sprites/characters';

export const MOSSWICK: CharacterDef = {
  id: 'mosswick',
  name: 'Mosswick',
  desc: 'A small swamp sprite in a lily-pad hat. Hums along with the frogs.',
  stats: {
    damage: 3.2,
    fireRate: 3.2,
    shotSpeed: 170,
    range: 115,
    moveSpeed: 96,
    luck: 0,
    shotSize: 3.2,
    knockback: 60,
  },
  hearts: { redMax: 4, tin: 2 },
  startItems: [],
  startPickups: { coins: 0, bombs: 1, keys: 0 },
  sprite: MOSSWICK_SPRITE,
  shotColor: '#6fd0b0',
  mechanic: 'mosswick.bogBlood',
  mechanicDesc: 'BOG BLOOD: SHOTS LEAVE STINGING PUDDLES. STAND IN YOUR OWN PUDDLES IN A FIGHT TO SOAK UP TIN HEARTS (UP TO 2).',
  innate: [{ type: 'mod', mod: 'puddle' }],
  order: 6,
  unlock: 'clear-skies',
};

const characters: CharacterDef[] = [MOSSWICK];
export default characters;
