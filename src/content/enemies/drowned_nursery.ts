/**
 * Chapter 1 (alt track) — The Drowned Nursery: soggy toys and music boxes. Four enemies, plus two
 * cross-chapter foes that are defined here (their first chapter) and list every chapter they roam:
 *   Bathtub Paddler  bounce (diagonal ricochets)   squirts at you after a ricochet
 *   Lullaby Box      turret                        slow two-armed spiral of notes
 *   Puddle Poppet    teleport (puddle to puddle)   pair of drips as it reappears
 *   Sprung Jack      lurk (a shut box until near)  bursts out in a fan, then chases and spits
 *   Dust Bunny       keepDistance (shy)            sneezes a ring of dust, splits in two   [nursery, rootcellar, crypt]
 *   Lost Balloon     float (drifts after you)      pops into a ring of droplets             [nursery, works, foundry]
 * Tuned like the Gutterways (floors 1-2): HP 8-22, half-heart shots. Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import {
  BATHTUB_PADDLER_SPRITE,
  DUST_BUNNY_SPRITE,
  LOST_BALLOON_SPRITE,
  LULLABY_BOX_SPRITE,
  PUDDLE_POPPET_SPRITE,
  SPRUNG_JACK_SPRITE,
} from '../sprites/enemiesANursery';

const CH = ['drowned_nursery'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'bathtub-paddler',
    name: 'Bathtub Paddler',
    hp: 14,
    speed: 60,
    radius: 5,
    contact: 1,
    mass: 0.8,
    move: { kind: 'bounce', params: { axis: 0, seek: 0.35 } },
    attacks: [{ kind: 'aimedShot', cooldown: 1.8, params: { on: 4, windup: 0.3, still: 0, speed: 85 } }],
    sprite: BATHTUB_PADDLER_SPRITE,
    chapters: CH,
    weight: 9,
    championable: true,
    shot: 'water',
    goo: ['#e8c14a', '#fff2a8', '#f07a32', '#6fc0f0'],
    bestiary: 'A wind-up bath duck that never ran down. It ricochets off the walls and squirts at you.',
  },
  {
    id: 'lullaby-box',
    name: 'Lullaby Box',
    hp: 22,
    speed: 0,
    radius: 6,
    contact: 1,
    mass: 99,
    move: { kind: 'turret' },
    attacks: [
      {
        kind: 'spiral',
        cooldown: 3.4,
        params: { arms: 2, count: 8, interval: 0.11, spin: 140, speed: 55, size: 2.5, life: 4.5, windup: 0.55, range: 180 },
      },
    ],
    sprite: LULLABY_BOX_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'dust',
    goo: ['#d98aa8', '#f0c860', '#9fd4e8', '#f6dccb'],
    bestiary: 'Its tiny dancer still twirls under the water, and every tune spins out a slow spiral of notes.',
  },
  {
    id: 'puddle-poppet',
    name: 'Puddle Poppet',
    hp: 16,
    speed: 18,
    radius: 5,
    contact: 1,
    move: { kind: 'teleport', params: { interval: 2.3, fade: 0.5, appear: 0.35, min: 44, max: 100, drift: 0.35 } },
    attacks: [{ kind: 'aimedShot', cooldown: 0.5, params: { on: 3, windup: 0.3, count: 3, spread: 16, speed: 90 } }],
    sprite: PUDDLE_POPPET_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'water',
    goo: ['#6d83a8', '#e8d5c0', '#5e9a9a', '#6fc0f0'],
    bestiary: 'A rag doll too soaked to stand for long. It sinks into one puddle and pops out of another.',
  },
  {
    id: 'sprung-jack',
    name: 'Sprung Jack',
    hp: 20,
    speed: 50,
    radius: 6,
    contact: 1,
    mass: 1.3,
    move: { kind: 'lurk', params: { wake: 56, rouse: 0.6, path: 1 } },
    attacks: [
      { kind: 'spreadFan', cooldown: 0.5, params: { on: 3, windup: 0, count: 5, spread: 80, speed: 80 } },
      { kind: 'aimedShot', cooldown: 2.2, params: { windup: 0.45, speed: 85, range: 120 } },
    ],
    sprite: SPRUNG_JACK_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'dust',
    goo: ['#c05a5a', '#6d8ac0', '#f2dcc0', '#5ab0a0'],
    bestiary: 'A sodden jack-in-the-box. It keeps its lid shut until you wander close, then springs out.',
  },
  // ── Cross-chapter ──
  {
    id: 'dust-bunny',
    name: 'Dust Bunny',
    hp: 14,
    speed: 44,
    radius: 5,
    contact: 1,
    move: { kind: 'keepDistance', params: { min: 44, max: 88, strafe: 0.6, flip: 1.8 } },
    attacks: [
      {
        kind: 'ringN',
        cooldown: 3.2,
        params: { count: 6, aim: 1, speed: 60, accel: -24, life: 3.2, size: 2.5, windup: 0.55 },
      },
    ],
    onDeath: [{ kind: 'split', params: { count: 2, scale: 0.65, hp: 0.35, gen: 1 } }],
    sprite: DUST_BUNNY_SPRITE,
    chapters: ['drowned_nursery', 'rootcellar', 'candlewick_crypt'],
    weight: 6,
    championable: true,
    drops: 'critter',
    shot: 'dust',
    goo: ['#aaa6b8', '#d8d4e2', '#76728a', '#e8a0b0'],
    bestiary: 'Lint and bad temper, rolled up under a forgotten bed. It keeps away and sneezes. Pop it: two!',
  },
  {
    id: 'lost-balloon',
    name: 'Lost Balloon',
    hp: 8,
    speed: 22,
    radius: 5,
    contact: 1,
    mass: 0.5,
    flying: true,
    move: { kind: 'float', params: { wobble: 0.5, freq: 0.3, drift: 1 } },
    attacks: [],
    onDeath: [{ kind: 'ringN', params: { count: 8, speed: 75, size: 2.5 } }],
    sprite: LOST_BALLOON_SPRITE,
    chapters: ['drowned_nursery', 'grinding_works', 'rust_foundry'],
    weight: 5,
    championable: true,
    shot: 'water',
    goo: ['#d86a6a', '#f6b0a8', '#9a3e4a', '#6fc0f0'],
    bestiary: "Somebody's birthday balloon, drifting after you for company. Pop it from afar: it bursts.",
  },
];

export default enemies;
