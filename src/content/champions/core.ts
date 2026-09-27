/**
 * Champion variants (rare: ~4 % of championable spawns, luck raises it — see ENEMY_TUNING — plus the rooms' 'E' elite
 * markers, which hold one 40 % of the time, pre-rolled with the room: sim/run/contents.ts ELITE_CHANCE; together ≈ 6-25 %
 * of spawns, more on the deeper floors). Golden champions spill 1-3 coins (polish batch 4: 3-5). Each one changes a
 * few numbers and/or adds a behaviour flag, glows in its colour and often drops extra loot (the 'champion' table).
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
    coins: [1, 3],
  },
];

export default champions;
