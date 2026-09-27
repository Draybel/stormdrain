/**
 * Sable — a masked fox thief (DESIGN.md "Characters" 6). Quick on her feet.
 * Mechanic PICKPOCKET (`sable.pickpocket`, sim/mechanics.ts): the melee carrier is innate (swipes up close), her
 * hits may knock coins loose (luck helps; a coin per enemy, three from big ones), and the `haggler` flag takes
 * 25 % off Magpie's and Old Pell's prices.
 * Unlock: hold 75 coins at once — or rob a shop (blast a Gumball Gambler or Magpie's donation jar open).
 */

import type { CharacterDef } from '../../sim/types';
import { SABLE_SPRITE } from '../sprites/characters';

export const SABLE: CharacterDef = {
  id: 'sable',
  name: 'Sable',
  desc: 'A masked fox with quick paws. Everything shiny is a maybe.',
  stats: {
    damage: 3.2,
    fireRate: 3,
    shotSpeed: 190,
    range: 130,
    moveSpeed: 108,
    luck: 1,
    shotSize: 3,
    knockback: 70,
  },
  hearts: { redMax: 6 },
  startItems: [],
  startPickups: { coins: 5, bombs: 1, keys: 1 },
  sprite: SABLE_SPRITE,
  shotColor: '#c9a0ff',
  mechanic: 'sable.pickpocket',
  mechanicDesc: 'PICKPOCKET: SWIPES UP CLOSE. HITS MAY KNOCK COINS LOOSE, AND MAGPIE LETS YOU HAGGLE 25% OFF.',
  // Polish batch 4: a hit knocks a coin loose 7 % of the time (+3 % per luck), not 14 %: she took ~48 coins a floor to
  // everyone else's ~33 and bought an item more every floor.
  mechanicParams: { chance: 0.07 },
  innate: [
    { type: 'carrier', carrier: 'melee' },
    { type: 'flag', flag: 'haggler' },
  ],
  order: 5,
  unlock: 'deep-pockets',
};

const characters: CharacterDef[] = [SABLE];
export default characters;
