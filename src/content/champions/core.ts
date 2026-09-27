/**
 * Champion variants (rare: ~4 % of championable spawns, luck raises it — see ENEMY_TUNING). Each one
 * changes a few numbers and/or adds a behaviour flag, glows in its colour and drops extra loot.
 * Order matters for seeded rolls: append new champions at the end.
 */

import type { ChampionDef } from '../../sim/types';

const champions: ChampionDef[] = [
  {
    id: 'swift',
    name: 'Swift',
    color: '#6fe0ff',
    weight: 20,
    speedMul: 1.5,
    cooldownMul: 0.7,
    hpMul: 0.9,
    drops: 'champion',
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    color: '#9aa6c0',
    weight: 18,
    hpMul: 2,
    sizeMul: 1.25,
    speedMul: 0.85,
    drops: 'champion',
  },
  {
    id: 'splitter',
    name: 'Splitter',
    color: '#8fe06a',
    weight: 14,
    hpMul: 1.1,
    split: 2,
    drops: 'champion',
  },
  {
    id: 'vengeful',
    name: 'Vengeful',
    color: '#ff5a4a',
    weight: 14,
    hpMul: 1.2,
    deathRing: 8,
    drops: 'champion',
  },
  {
    id: 'regrowing',
    name: 'Regrowing',
    color: '#ff7ac8',
    weight: 12,
    hpMul: 1.3,
    regen: 0.12,
    drops: 'champion',
  },
  {
    id: 'phantom',
    name: 'Phantom',
    color: '#c9b8ff',
    weight: 12,
    speedMul: 1.15,
    phantom: true,
    drops: 'champion',
  },
  {
    id: 'golden',
    name: 'Golden',
    color: '#ffd23a',
    weight: 10,
    hpMul: 1.2,
    coins: [3, 5],
  },
];

export default champions;
