/**
 * Drizzle — the secret character: a little raincloud that followed the storm home (DESIGN.md "Characters",
 * extra). Floats (the `flying` flag innate: pits and spikes mean nothing to a cloud).
 * Mechanic RAINMAKER (`drizzle.rainmaker`): data only — an innate 'hurt' trigger bursts a cloudburst over the
 * whole room (every foe soaked: slowed hard for 4 s, a little damage), so every hit Drizzle takes buys a moment.
 * Unlock: the hidden achievement WHAT THE RAIN KEPT (Ending 3).
 */

import type { CharacterDef } from '../../sim/types';
import { DRIZZLE_SPRITE } from '../sprites/characters';

export const DRIZZLE: CharacterDef = {
  id: 'drizzle',
  name: 'Drizzle',
  desc: 'A little raincloud that followed the storm home. Mostly harmless.',
  stats: {
    damage: 3.2,
    fireRate: 3.4,
    shotSpeed: 200,
    range: 160,
    moveSpeed: 100,
    luck: 1,
    shotSize: 2.8,
    knockback: 60,
  },
  hearts: { redMax: 4, tin: 2 },
  startItems: [],
  startPickups: { coins: 0, bombs: 1, keys: 0 },
  sprite: DRIZZLE_SPRITE,
  shotColor: '#bfe8ff',
  mechanic: 'drizzle.rainmaker',
  mechanicDesc: 'RAINMAKER: FLOATS OVER PITS AND SPIKES. EVERY HIT YOU TAKE BURSTS A CLOUD OVER THE ROOM: ALL FOES SOAKED AND SLOWED.',
  innate: [
    { type: 'flag', flag: 'flying' },
    {
      type: 'trigger',
      on: 'hurt',
      say: 'CLOUDBURST!',
      effects: [{ type: 'hook', hook: 'itemsB.statusBurst', params: { status: 'slow', radius: 400, duration: 4, power: 0.6, damage: 6 } }],
    },
  ],
  order: 7,
  unlock: 'what-the-rain-kept',
};

const characters: CharacterDef[] = [DRIZZLE];
export default characters;
