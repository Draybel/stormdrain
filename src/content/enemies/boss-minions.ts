/**
 * Helpers that only bosses call (weight 0: never rolled into a room on their own):
 *   Bubble Ward  orbiting shield of The Undertow (the 'shields' pattern tethers it to its boss)
 *   Nest Drone   a paper wasp the Nestmother calls in
 */

import type { EnemyDef } from '../../sim/types';
import { BUBBLE_WARD_SPRITE, NEST_DRONE_SPRITE } from '../sprites/specialRooms';

const enemies: EnemyDef[] = [
  {
    id: 'bubble-ward',
    name: 'Bubble Ward',
    hp: 14,
    speed: 0,
    radius: 4,
    contact: 1,
    flying: true,
    mass: 99,
    move: { kind: 'idle' },
    attacks: [],
    sprite: BUBBLE_WARD_SPRITE,
    chapters: ['eye_of_storm'],
    weight: 0,
    championable: false,
    shot: 'water',
    goo: ['#a8d4f0', '#5a95c8', '#ffffff', '#2f6296'],
    bestiary: 'A bubble of drain water that circles its master and swallows every shot you throw at it.',
  },
  {
    id: 'nest-drone',
    name: 'Nest Drone',
    hp: 10,
    speed: 52,
    radius: 4,
    contact: 1,
    flying: true,
    move: { kind: 'float', params: { wobble: 0.9, freq: 0.9, drift: 1 } },
    attacks: [{ kind: 'aimedShot', cooldown: 2.4, params: { speed: 85, windup: 0.35, range: 150 } }],
    sprite: NEST_DRONE_SPRITE,
    chapters: ['hollow_nest'],
    weight: 0,
    championable: false,
    shot: 'ember',
    goo: ['#d8902c', '#e8e4d8', '#2a1c14', '#f2c055'],
    bestiary: 'A paper wasp barely out of its cell. It lives to guard the queen and spit amber at intruders.',
  },
];

export default enemies;
