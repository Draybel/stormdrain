/**
 * Enemy loot. Regular enemies rarely drop anything (the room-clear reward is the main payout);
 * champions always drop a little something extra.
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
      { kind: 'coin', weight: 7 },
      { kind: 'halfHeart', weight: 2 },
      { kind: 'sparkSmall', weight: 1 },
    ],
  },
  {
    // Champion bonus.
    id: 'champion',
    rolls: [1, 1],
    nothing: 0,
    entries: [
      { kind: 'coin', weight: 30 },
      { kind: 'silverCoin', weight: 4 },
      { kind: 'halfHeart', weight: 20 },
      { kind: 'heart', weight: 8 },
      { kind: 'bomb', weight: 12 },
      { kind: 'key', weight: 12 },
      { kind: 'tinHeart', weight: 6 },
      { kind: 'sparkSmall', weight: 6 },
    ],
  },
];

export default tables;
