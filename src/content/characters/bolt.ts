/**
 * Bolt — a tin robot kid with a wind-up key (DESIGN.md "Characters" 5).
 * Mechanic WIND-UP (`bolt.windUp`, sim/mechanics.ts): the charge rider is innate (hold to charge every shot);
 * the held active item winds itself up over time — a room of charge every 12 s — as well as per room cleared.
 * Starts with the Jar of Lightning. Unlock: use active items 50 times.
 */

import type { CharacterDef } from '../../sim/types';
import { BOLT_SPRITE } from '../sprites/characters';

export const BOLT: CharacterDef = {
  id: 'bolt',
  name: 'Bolt',
  desc: 'A tin robot kid. Somebody wound the key all the way round.',
  stats: {
    damage: 3.5,
    fireRate: 2.6,
    shotSpeed: 200,
    range: 150,
    moveSpeed: 92,
    luck: 0,
    shotSize: 3,
    knockback: 75,
  },
  hearts: { redMax: 4, tin: 2 },
  startItems: ['jar-of-lightning'],
  startPickups: { coins: 0, bombs: 1, keys: 1 },
  sprite: BOLT_SPRITE,
  shotColor: '#7ff0ff',
  mechanic: 'bolt.windUp',
  mechanicDesc: 'WIND-UP: HOLD TO CHARGE EVERY SHOT. YOUR ACTIVE ITEM WINDS ITSELF UP OVER TIME, NOT JUST PER ROOM.',
  innate: [{ type: 'carrier', carrier: 'charge' }],
  order: 4,
  unlock: 'wound-up',
};

const characters: CharacterDef[] = [BOLT];
export default characters;
