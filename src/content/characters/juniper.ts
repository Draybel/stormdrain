/**
 * Juniper — a girl in a moss cloak with a jar of fireflies (DESIGN.md "Characters" 4). Low damage.
 * Mechanic FIREFLY JAR (`juniper.fireflyJar`, sim/mechanics.ts): two fireflies (innate familiars that circle her
 * and fire with her); every cleared room lets one more out of the jar (six at most); a hit scares one of the
 * extras away and a new floor settles the jar back to two.
 * Unlock: have 3 familiars at once.
 */

import type { CharacterDef } from '../../sim/types';
import { JUNIPER_SPRITE } from '../sprites/characters';

export const JUNIPER: CharacterDef = {
  id: 'juniper',
  name: 'Juniper',
  desc: 'A girl in a moss cloak who never goes anywhere without her jar.',
  stats: {
    damage: 2.6,
    fireRate: 3.1,
    shotSpeed: 190,
    range: 155,
    moveSpeed: 100,
    luck: 0.5,
    shotSize: 2.8,
    knockback: 60,
  },
  hearts: { redMax: 6 },
  startItems: [],
  startPickups: { coins: 0, bombs: 1, keys: 0 },
  sprite: JUNIPER_SPRITE,
  shotColor: '#fff27a',
  mechanic: 'juniper.fireflyJar',
  mechanicDesc: 'FIREFLY JAR: TWO FIREFLIES FIGHT WITH YOU. EVERY CLEARED ROOM FREES ONE MORE (UP TO 6) · A HIT SCARES ONE OFF.',
  innate: [{ type: 'familiar', familiar: 'firefly', count: 2 }],
  order: 3,
  unlock: 'little-parade',
};

const characters: CharacterDef[] = [JUNIPER];
export default characters;
