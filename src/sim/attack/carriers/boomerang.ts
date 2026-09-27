/**
 * Boomerang: a thrown spinning blade that flies out, turns and comes back to be caught, piercing
 * everything both ways (the carrier adds an implicit `boomerang` modifier stack). As a RIDER it adds
 * the same `boomerang` motion to the primary: shots return, beams bend back into a U, melee crescents
 * fly out and back (see profile.ts).
 */

import { ATTACK_TUNING } from '../../tuning';
import { launchProjectile } from '../fire';
import { SK_BLADE } from '../state';
import { shootEvent, type Carrier } from './carrier';

const T = ATTACK_TUNING;

export const BOOMERANG: Carrier = {
  id: 'boomerang',
  rank: 3,
  color: '#dfe6f2',
  shape: 'blade',
  emit(v, i) {
    const extra = Math.max(0, v.profile.stacksOf('boomerang') - 1);
    const s = launchProjectile(v, i, SK_BLADE, T.boomerangDamage * (1 + 0.25 * extra), T.boomerangSpeed, T.boomerangRange, 1.3 * (1 + 0.15 * extra));
    if (s) {
      s.pierceLeft = 9999;
      s.rehit = 14;
    }
    if (i === 0) shootEvent(v);
  },
  // Rider: the implicit `boomerang` modifier stacks do the work.
};
