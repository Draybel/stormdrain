/**
 * Charge (rider only): hold to charge, release = the volley's damage and size multiplied by the charge
 * (attack/charge.ts). Lance: overcharge past 100 % (wider, longer, stronger beam). Laser: a charged
 * burst of lasers.
 */

import type { Carrier } from './carrier';

export const CHARGE: Carrier = {
  id: 'charge',
  rank: 0,
  color: '#fff4a0',
};
