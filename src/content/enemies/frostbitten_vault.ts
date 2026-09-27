/**
 * Chapter 5 (alt) — The Frostbitten Vault (floors 9-10): ice and frozen treasure.
 *   Rimechest    lurks as a treasure chest, wakes when you come close (or shoot it), then hunts;
 *                spits a fan of icy coins; bites for a full heart; keeps a little real loot
 *   Slushpup     aimed belly-slides (bonks walls)   slush trail; a ring of ice when it bonks
 *   Rime Wraith  circles you (flying)               shards that speed up; a slow frost nova
 * Tuned like the Bone Orchard (the same floors). Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import { RIME_WRAITH_SPRITE, RIMECHEST_SPRITE, SLUSHPUP_SPRITE } from '../sprites/enemiesBVault';

const CH = ['frostbitten_vault'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'rimechest',
    name: 'Rimechest',
    hp: 64,
    speed: 72,
    radius: 7,
    contact: 2,
    mass: 2.5,
    // Wakes 64 px out with a 0.5 s rouse: Wren (96 px/s) always sees the lid crack before it can bite.
    move: { kind: 'lurk', params: { wake: 64, rouse: 0.5, recalc: 8 } },
    attacks: [{ kind: 'spreadFan', cooldown: 1.9, params: { windup: 0.45, range: 150, count: 5, spread: 60, speed: 110 } }],
    sprite: RIMECHEST_SPRITE,
    chapters: CH,
    weight: 5,
    championable: true,
    drops: 'champion',
    shot: 'ice',
    goo: ['#8a5a3a', '#e4f8ff', '#ffd35a', '#9ad8f0'],
    bestiary: 'Frozen treasure, at last! No: it was waiting for you. Its teeth are icicles and its coins bite back.',
  },
  {
    id: 'slushpup',
    name: 'Slushpup',
    hp: 40,
    speed: 40,
    radius: 6,
    contact: 1,
    mass: 1.5,
    move: { kind: 'dash', params: { axis: 0, windup: 0.5, dashSpeed: 235, maxTime: 1.6, stun: 0.8, rest: 1, walk: 0.7 } },
    attacks: [
      { kind: 'leaveTrail', cooldown: 0.2, params: { radius: 6, life: 2.4, moving: 1 } },
      { kind: 'ringN', cooldown: 0.3, params: { on: 4, windup: 0, count: 6, speed: 85 } },
    ],
    sprite: SLUSHPUP_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'ice',
    goo: ['#e4f2fa', '#a8c8e0', '#7aa0c8', '#ffb0c0'],
    bestiary: 'Belly-slides everywhere and leaves a trail of stinging slush. Bonk! Then it shakes off a spray of ice.',
  },
  {
    id: 'rime-wraith',
    name: 'Rime Wraith',
    hp: 38,
    speed: 62,
    radius: 6,
    contact: 1,
    flying: true,
    move: { kind: 'orbitPlayer', params: { radius: 62, spin: 1.2, dir: 0 } },
    attacks: [
      {
        kind: 'burst',
        cooldown: 2.3,
        params: { windup: 0.5, range: 200, count: 4, interval: 0.12, jitter: 4, speed: 60, accel: 110 },
      },
      { kind: 'ringN', cooldown: 4.5, params: { windup: 0.6, count: 10, speed: 55, accel: 60, spin: 18 } },
    ],
    sprite: RIME_WRAITH_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ice',
    goo: ['#bfe8ff', '#6fe0ff', '#e8fbff', '#7ab8e0'],
    bestiary: "The vault's old guard, still on patrol. It circles at arm's length, flicking shards that pick up speed.",
  },
];

export default enemies;
