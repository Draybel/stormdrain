/**
 * Bomb (rider only): shots become little bombs with fuse sparks that explode where they hit and where
 * they land (and break rocks); beams explode at intervals along their length; swipes explode at the
 * tip. The flags are set where things are made (fire.ts F_BOMB, beam.bomb, melee.ts) and the implicit
 * `explode` modifier stacks do the blasting — player-owned blasts never hurt the player.
 */

import type { Carrier } from './carrier';

export const BOMB: Carrier = {
  id: 'bomb',
  rank: 0,
  color: '#ffb040',
  shape: 'bomb',
  trail: 'sparks',
};
