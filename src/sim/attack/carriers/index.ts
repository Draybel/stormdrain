/** Carrier registry (§4.2): one Carrier per CarrierId, and the order riders merge in. */

import type { CarrierId } from '../../types';
import { BOMB } from './bomb';
import { BOOMERANG } from './boomerang';
import type { Carrier } from './carrier';
import { CHARGE } from './charge';
import { LANCE } from './lance';
import { LASER } from './laser';
import { MARBLE } from './marble';
import { MELEE } from './melee';
import { ORBIT } from './orbit';

export type { Carrier } from './carrier';

export const CARRIERS: Readonly<Record<CarrierId, Carrier>> = {
  marble: MARBLE,
  lance: LANCE,
  laser: LASER,
  boomerang: BOOMERANG,
  melee: MELEE,
  bomb: BOMB,
  charge: CHARGE,
  orbit: ORBIT,
};

/** Riders merge in this order after the primary emitted (melee swipes before feathers / blades). */
export const RIDER_ORDER: readonly Carrier[] = [MARBLE, MELEE, LASER, BOOMERANG, BOMB, CHARGE, ORBIT];
