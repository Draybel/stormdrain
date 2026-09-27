/**
 * Boss loot: what a boss or miniboss leaves besides its reward pedestal (the run drops the pedestal,
 * the trapdoor and a heart itself).
 */

import type { DropTableDef } from '../../sim/types';

const tables: DropTableDef[] = [
  {
    // A miniboss's own reward (plus a heart from the run): a handful of useful things.
    id: 'minibossReward',
    rolls: [2, 3],
    nothing: 0,
    entries: [
      { kind: 'coin', weight: 26, count: 3 },
      { kind: 'silverCoin', weight: 8 },
      { kind: 'key', weight: 18 },
      { kind: 'bomb', weight: 18 },
      { kind: 'heart', weight: 12 },
      { kind: 'lockbox', weight: 10 },
      { kind: 'sparkFull', weight: 4 },
      { kind: 'trinket', weight: 6, pool: 'chest' },
    ],
  },
  {
    // What a boss spills when it bursts (a little extra on top of the pedestal).
    id: 'bossSpill',
    rolls: [2, 3],
    nothing: 10,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 22, count: 2 },
      { kind: 'silverCoin', weight: 5 },
      { kind: 'key', weight: 4 },
      { kind: 'bomb', weight: 6 },
      { kind: 'halfHeart', weight: 10 },
    ],
  },
];

export default tables;
