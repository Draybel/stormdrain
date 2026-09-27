/**
 * Chapter 2 (main track) — The Rootcellar: roots, jars, pickles and moles. Five enemies:
 *   Creeping Taproot  wallCrawl (clings to the walls)   bursts of thorny seeds
 *   Brine Jar         wander (slow waddle)              lobs brine that pools; breaks into two Gherklings
 *   Gherkling         hop (quick little bounds)         (contact only; also rolled on its own, rarely)
 *   Grumblemole       burrow                            dirt ring on surfacing + a spray of clods
 *   Radish Rammer     dash (aimed charge)               sprays clods when it bonks a wall
 * (The Dust Bunny also roams here — see drowned_nursery.ts.) Tuned for floors 3-4: HP 8-32.
 */

import type { EnemyDef } from '../../sim/types';
import {
  BRINE_JAR_SPRITE,
  CREEPING_TAPROOT_SPRITE,
  GHERKLING_SPRITE,
  GRUMBLEMOLE_SPRITE,
  RADISH_RAMMER_SPRITE,
} from '../sprites/enemiesARoot';

const CH = ['rootcellar'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'creeping-taproot',
    name: 'Creeping Taproot',
    hp: 26,
    speed: 36,
    radius: 6,
    contact: 1,
    mass: 99,
    move: { kind: 'wallCrawl' },
    attacks: [
      { kind: 'burst', cooldown: 2.3, params: { count: 3, interval: 0.15, jitter: 5, speed: 100, windup: 0.45, range: 220 } },
    ],
    sprite: CREEPING_TAPROOT_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'muck',
    goo: ['#8a6a4a', '#b8946a', '#6aa04e', '#e8f080'],
    bestiary: 'A taproot that crept along the cellar walls looking for water. It flicks thorny seeds at you.',
  },
  {
    id: 'brine-jar',
    name: 'Brine Jar',
    hp: 30,
    speed: 22,
    radius: 6,
    contact: 1,
    mass: 1.5,
    move: { kind: 'wander', params: { pause: 1, dist: 30, walk: 1 } },
    attacks: [
      {
        kind: 'lob',
        cooldown: 2.8,
        params: { count: 2, creep: 1, splash: 10, scatter: 14, air: 0.9, height: 30, windup: 0.5, range: 190 },
      },
    ],
    onDeath: [{ kind: 'split', enemy: 'gherkling', params: { count: 2, hp: 0.3, gen: 1 } }],
    sprite: BRINE_JAR_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'muck',
    goo: ['#8ac47a', '#e0f6cc', '#3e6e2a', '#b0a8b8'],
    bestiary: 'Forgotten pickles that grew legs. It lobs stinging brine, and it is full of little surprises.',
  },
  {
    id: 'gherkling',
    name: 'Gherkling',
    hp: 8,
    speed: 0,
    radius: 4,
    contact: 1,
    move: { kind: 'hop', params: { rest: 0.35, crouch: 0.18, air: 0.34, dist: 30, height: 9, aim: 0.85 } },
    attacks: [],
    sprite: GHERKLING_SPRITE,
    chapters: CH,
    weight: 3,
    championable: true,
    goo: ['#6aa84a', '#b4dc84', '#3e7a2e', '#8ac47a'],
    bestiary: 'A pickle with places to be. It hops after you in quick little bounds, squeaking as it lands.',
  },
  {
    id: 'grumblemole',
    name: 'Grumblemole',
    hp: 32,
    speed: 46,
    radius: 6,
    contact: 1,
    mass: 1.6,
    move: { kind: 'burrow', params: { under: 1.6, above: 1.8, near: 40, rise: 0.65, dig: 0.35, tunnel: 1.2 } },
    attacks: [
      { kind: 'landShockwave', cooldown: 0.1, params: { on: 2, radius: 34, speed: 105, band: 5 } },
      { kind: 'aimedShot', cooldown: 1.9, params: { count: 3, spread: 20, speed: 90, windup: 0.5, range: 160 } },
    ],
    sprite: GRUMBLEMOLE_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'muck',
    goo: ['#6a5664', '#a8949e', '#f0909a', '#7e664e'],
    bestiary: 'A mole with a short temper and a long tunnel. The floor ripples where it surfaces. Then: dirt.',
  },
  {
    id: 'radish-rammer',
    name: 'Radish Rammer',
    hp: 24,
    speed: 36,
    radius: 5,
    contact: 1,
    mass: 1.2,
    move: {
      kind: 'dash',
      params: { axis: 0, windup: 0.5, dashSpeed: 205, maxTime: 0.9, stun: 0.7, rest: 1.1, walk: 0.6 },
    },
    attacks: [{ kind: 'spreadFan', cooldown: 0.5, params: { on: 4, windup: 0, count: 3, spread: 40, speed: 85 } }],
    sprite: RADISH_RAMMER_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'muck',
    goo: ['#d84a5a', '#f49098', '#6ab84e', '#f0e6dc'],
    bestiary: 'Pulled up too early and furious about it. It charges head first and sprays clods off the walls.',
  },
];

export default enemies;
