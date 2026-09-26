/**
 * Wren — the starting character (DESIGN.md). Balanced stats, three red hearts, one bomb.
 * Mechanic "Lucky Marble" (first shot in each uncleared room is a big piercing keeper marble) is
 * implemented by the attack pipeline; the hook name is registered in content/hooks/characters.ts.
 */

import type { CharacterDef } from '../../sim/types';
import { WREN_SPRITE } from '../sprites/wren';

export const WREN: CharacterDef = {
  id: 'wren',
  name: 'Wren',
  desc: 'A scrappy kid in a raincoat three sizes too big.',
  stats: {
    damage: 3.5,
    fireRate: 3,
    shotSpeed: 190,
    range: 150,
    moveSpeed: 96,
    luck: 0,
    shotSize: 3,
    knockback: 70,
  },
  hearts: { redMax: 6 },
  startItems: [],
  startPickups: { coins: 0, bombs: 1, keys: 0 },
  sprite: WREN_SPRITE,
  mechanic: 'wren.luckyMarble',
};

const characters: CharacterDef[] = [WREN];
export default characters;
