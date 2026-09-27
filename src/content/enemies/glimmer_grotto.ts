/**
 * Chapter 4 (alt) — The Glimmer Grotto (floors 7-8): crystals and echo bats.
 *   Echo Bat        flying weave            screech = a ring you have to step over; sonic pellets
 *   Quartz Creeper  crawls along the walls  quick bursts of quartz slivers
 *   Geode Tumbler   rolls straight at you   spits gravel; cracks open into Glint Mites
 *   Glint Mite      path-finding sprint     (spawned by the Geode Tumbler only)
 * Tuned like the Mushroom Hollow (the same floors). Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import { ECHO_BAT_SPRITE, GEODE_TUMBLER_SPRITE, GLINT_MITE_SPRITE, QUARTZ_CREEPER_SPRITE } from '../sprites/enemiesBGrotto';

const CH = ['glimmer_grotto'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'echo-bat',
    name: 'Echo Bat',
    hp: 16,
    speed: 46,
    radius: 5,
    contact: 1,
    flying: true,
    move: { kind: 'float', params: { wobble: 1.3, freq: 0.9, drift: 1 } },
    attacks: [
      { kind: 'landShockwave', cooldown: 3.2, params: { on: 0, windup: 0.6, range: 80, radius: 60, speed: 110, band: 4 } },
      { kind: 'spreadFan', cooldown: 2.6, params: { windup: 0.35, range: 150, minRange: 50, count: 3, spread: 24, speed: 110 } },
    ],
    sprite: ECHO_BAT_SPRITE,
    chapters: CH,
    weight: 9,
    championable: true,
    shot: 'dust',
    goo: ['#5a4a80', '#d890e0', '#8ff0ff', '#7a68b0'],
    bestiary: 'It sees with its ears. When it screeches, the sound rolls out in a ring you can feel in your teeth.',
  },
  {
    id: 'quartz-creeper',
    name: 'Quartz Creeper',
    hp: 26,
    speed: 52,
    radius: 6,
    contact: 1,
    move: { kind: 'wallCrawl' },
    attacks: [
      { kind: 'burst', cooldown: 2.2, params: { windup: 0.45, range: 220, count: 4, interval: 0.12, jitter: 5, speed: 115 } },
    ],
    sprite: QUARTZ_CREEPER_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ice',
    goo: ['#b8f6ff', '#4fb8d8', '#3e3262', '#ff6ad8'],
    bestiary: 'Clings to the grotto walls and flicks slivers of quartz at anyone who walks the middle of the room.',
  },
  {
    id: 'geode-tumbler',
    name: 'Geode Tumbler',
    hp: 38,
    speed: 38,
    radius: 7,
    contact: 1,
    mass: 2.5,
    move: { kind: 'chase' },
    attacks: [{ kind: 'spreadFan', cooldown: 2.6, params: { windup: 0.5, range: 150, count: 4, spread: 45, speed: 95 } }],
    onDeath: [{ kind: 'split', enemy: 'glint-mite', params: { count: 3, hp: 0.18, gen: 1 } }],
    sprite: GEODE_TUMBLER_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'dust',
    goo: ['#6a6478', '#c070f0', '#f4e0ff', '#46415a'],
    bestiary: 'A grumpy rolling geode that spits gravel. Crack it open and the mites living inside come pouring out.',
  },
  {
    id: 'glint-mite',
    name: 'Glint Mite',
    hp: 7,
    speed: 72,
    radius: 4,
    contact: 1,
    move: { kind: 'chasePath', params: { recalc: 10 } },
    attacks: [],
    sprite: GLINT_MITE_SPRITE,
    chapters: CH,
    weight: 0,
    championable: false,
    goo: ['#b8f6ff', '#4fb8d8', '#3e3262'],
    bestiary: 'Tiny crystal ticks that live inside geodes. Fast, fragile and always in a hurry to bite.',
  },
];

export default enemies;
