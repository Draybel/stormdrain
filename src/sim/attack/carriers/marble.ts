/**
 * Marble (default primary): Wren's round glowing projectile — flies at eye height, drops at the end of
 * its range. As a RIDER (a marble carrier held under another primary) every volley is joined by a
 * half-strength companion marble.
 */

import { launchProjectile } from '../fire';
import { SK_MARBLE } from '../state';
import { shootEvent, type Carrier } from './carrier';

export const MARBLE: Carrier = {
  id: 'marble',
  rank: 1,
  shape: 'marble',
  emit(v, i) {
    const extra = Math.max(0, v.profile.stacksOf('marble') - 1);
    launchProjectile(v, i, SK_MARBLE, 1, 1, 1, 1 + 0.1 * extra);
    if (i === 0) shootEvent(v);
  },
  rider(v, stacks) {
    const s = launchProjectile(v, 0, SK_MARBLE, 0.5 * stacks, 1, 0.8, 0.8);
    if (s && v.profile.beam) shootEvent(v);
  },
};
