/**
 * Orbit (rider only): blades circle the player and hit what they touch, inheriting every hit modifier
 * (attack/orbit.ts); whenever the player fires, each blade fires a mini (scale 0.4) version of the
 * primary — mini marbles, mini blades, mini lances…
 */

import { bladeVolleys } from '../orbit';
import { OWN_PLAYER } from '../state';
import type { Carrier } from './carrier';

export const ORBIT: Carrier = {
  id: 'orbit',
  rank: 0,
  color: '#c0c8ff',
  shape: 'gear',
  rider(v) {
    if (v.src.mini || v.src.ownerKind !== OWN_PLAYER) return;
    bladeVolleys(v.w, v.ang, v.src);
  },
};
