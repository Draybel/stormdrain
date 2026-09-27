/**
 * Enemy loot. Regular enemies rarely drop anything (the room-clear reward is the main payout);
 * champions often drop a little something extra (polish batch 4: a 'nothing' entry — it had none — and about a
 * third of the coins and bombs, a sixth of the keys; Tin 6 → 3).
 */

import type { DropTableDef } from '../../sim/types';

const tables: DropTableDef[] = [
  {
    // Common Gutterways vermin: a stray coin now and then.
    id: 'critter',
    rolls: [1, 1],
    nothing: 90,
    luck: 0.04,
    entries: [
      { kind: 'coin', weight: 5 },
      { kind: 'halfHeart', weight: 2 },
      { kind: 'sparkSmall', weight: 1 },
    ],
  },
  {
    // Champion bonus.
    id: 'champion',
    rolls: [1, 1],
    nothing: 50,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 8 },
      { kind: 'silverCoin', weight: 2 },
      { kind: 'halfHeart', weight: 20 },
      { kind: 'heart', weight: 8 },
      { kind: 'bomb', weight: 4 },
      { kind: 'key', weight: 2 },
      { kind: 'tinHeart', weight: 3 },
      { kind: 'sparkSmall', weight: 6 },
    ],
  },
];

export default tables;
