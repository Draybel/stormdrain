/**
 * Chapter 3 (main track) — The Grinding Works: clockwork, gears and steam. Four enemies:
 *   Runaway Cog       bounce (diagonal ricochets)   sheds sparks four ways off every wall; bites hard
 *   Whistling Kettle  keepDistance (kiter)          wide fan of scalding steam that slows and fades
 *   Tick-Tock Mouse   dash (fast aimed zips)        pings a ring of bolts when it bonks a wall
 *   Mad Cuckoo        turret                        the cuckoo's burst + a turning chime ring
 * (The Lost Balloon also drifts here — see drowned_nursery.ts.) Floors 5-6: HP 24-46, heavier hits.
 */

import type { EnemyDef } from '../../sim/types';
import {
  MAD_CUCKOO_SPRITE,
  RUNAWAY_COG_SPRITE,
  TICKTOCK_MOUSE_SPRITE,
  WHISTLING_KETTLE_SPRITE,
} from '../sprites/enemiesAWorks';

const CH = ['grinding_works'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'runaway-cog',
    name: 'Runaway Cog',
    hp: 36,
    speed: 76,
    radius: 6,
    contact: 2,
    mass: 2,
    move: { kind: 'bounce', params: { axis: 0, seek: 0.3 } },
    attacks: [{ kind: 'cardinal4', cooldown: 1.3, params: { on: 4, windup: 0, alt: 1, speed: 95 } }],
    sprite: RUNAWAY_COG_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ember',
    goo: ['#d0a040', '#f8e098', '#8a6424', '#ff8a30'],
    bestiary: 'A gear that slipped its axle and never stopped rolling. It ricochets around, shedding sparks.',
  },
  {
    id: 'whistling-kettle',
    name: 'Whistling Kettle',
    hp: 38,
    speed: 42,
    radius: 6,
    contact: 1,
    mass: 1.4,
    move: { kind: 'keepDistance', params: { min: 56, max: 100, strafe: 0.7, flip: 1.4 } },
    attacks: [
      {
        kind: 'spreadFan',
        cooldown: 2.2,
        params: { count: 5, spread: 64, speed: 115, accel: -70, life: 2.2, size: 3, windup: 0.6, range: 180 },
      },
    ],
    sprite: WHISTLING_KETTLE_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'dust',
    goo: ['#d07a48', '#f4b088', '#8a4628', '#e8eef8'],
    bestiary: 'It boils over whenever you get close. When the lid rattles, expect a spray of scalding steam.',
  },
  {
    id: 'ticktock-mouse',
    name: 'Tick-Tock Mouse',
    hp: 24,
    speed: 52,
    radius: 5,
    contact: 1,
    mass: 0.9,
    move: {
      kind: 'dash',
      params: { axis: 0, windup: 0.4, dashSpeed: 265, maxTime: 0.8, stun: 0.5, rest: 0.8, walk: 0.5 },
    },
    attacks: [{ kind: 'ringN', cooldown: 0.5, params: { on: 4, windup: 0, count: 6, speed: 88 } }],
    sprite: TICKTOCK_MOUSE_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    drops: 'critter',
    shot: 'dust',
    goo: ['#a8b0c4', '#e0e6f0', '#d8b050', '#e8a0b0'],
    bestiary: 'Somebody wound it up years ago and let it go. It zips at you and pings bolts on impact.',
  },
  {
    id: 'mad-cuckoo',
    name: 'Mad Cuckoo',
    hp: 46,
    speed: 0,
    radius: 7,
    contact: 1,
    mass: 99,
    big: true,
    move: { kind: 'turret' },
    attacks: [
      { kind: 'burst', cooldown: 2.4, params: { count: 4, interval: 0.12, jitter: 3, speed: 120, windup: 0.5, range: 220 } },
      { kind: 'ringN', cooldown: 5, params: { count: 8, spin: 22.5, speed: 70, windup: 0.7 } },
    ],
    sprite: MAD_CUCKOO_SPRITE,
    chapters: CH,
    weight: 5,
    championable: true,
    shot: 'ink',
    goo: ['#b0784a', '#f0e4c8', '#e05a4a', '#7a3e2a'],
    bestiary: 'It strikes every hour, and in the Grinding Works an hour lasts about four seconds.',
  },
];

export default enemies;
