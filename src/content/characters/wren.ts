/**
 * Wren — the starting character (DESIGN.md). Balanced stats.
 * Phase 2 turns this folder into an auto-discovered registry (export default CharacterDef[]).
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
  redMax: 6,
  sprite: WREN_SPRITE,
};

const characters: CharacterDef[] = [WREN];
export default characters;
