/**
 * Pip — a tiny mole in a miner's helmet (DESIGN.md "Characters" 2). Sturdy and slow, four hearts.
 * Mechanic BURROW (`pip.burrow`, sim/mechanics.ts): the DASH button (Shift on a keyboard) ducks Pip
 * underground for 0.4 s — a fast straight tunnel nothing can touch — on a 1.5 s cooldown.
 * Unlock: defeat the boss of chapter 2.
 */

import type { CharacterDef } from '../../sim/types';
import { PIP_SPRITE } from '../sprites/characters';

export const PIP: CharacterDef = {
  id: 'pip',
  name: 'Pip',
  desc: "A tiny mole in a miner's helmet. Slow, sturdy and very stubborn.",
  stats: {
    damage: 3.7,
    fireRate: 2.7,
    shotSpeed: 180,
    range: 140,
    moveSpeed: 84,
    luck: 0,
    shotSize: 3.3,
    knockback: 85,
  },
  hearts: { redMax: 8 },
  startItems: ['rusty-trowel'],
  startPickups: { coins: 0, bombs: 2, keys: 0 },
  sprite: PIP_SPRITE,
  shotColor: '#ffb347',
  mechanic: 'pip.burrow',
  mechanicDesc: 'BURROW: DASH (SHIFT) DUCKS UNDERGROUND FOR A MOMENT. NOTHING CAN TOUCH YOU DOWN THERE.',
  order: 1,
  unlock: 'under-the-roots',
};

const characters: CharacterDef[] = [PIP];
export default characters;
