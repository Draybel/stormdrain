/**
 * Chapter 6 (main) — The Eye of the Storm (floors 11-12): clouds, lightning, wind. The hardest main
 * chapter: faster, tougher, denser volleys and smarter movement.
 *   Grumblecloud  hovers after you (flying)             drops raindrop bolts that burst on landing; rain fan
 *   Staticling    blinks around you every ~2 s          ring of 12 sparks on arrival (turning), zap triplets
 *   Whirligust    circles you (flying)                  two-armed spiral stream of leaves
 *   Stormkite     swoops: circles, hovers, dives through you   fan of sparks as each dive ends, zaps
 * Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import { GRUMBLECLOUD_SPRITE, STATICLING_SPRITE, STORMKITE_SPRITE, WHIRLIGUST_SPRITE } from '../sprites/enemiesBStorm';

const CH = ['eye_of_storm'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'grumblecloud',
    name: 'Grumblecloud',
    hp: 46,
    speed: 40,
    radius: 7,
    contact: 1,
    flying: true,
    move: { kind: 'float', params: { wobble: 0.6, freq: 0.4, drift: 1 } },
    attacks: [
      {
        kind: 'lob',
        cooldown: 2.2,
        params: { windup: 0.55, range: 200, count: 3, air: 0.7, height: 18, scatter: 22, splash: 12, split: 4 },
      },
      { kind: 'spreadFan', cooldown: 3, params: { windup: 0.4, range: 160, count: 5, spread: 50, speed: 110 } },
    ],
    sprite: GRUMBLECLOUD_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'water',
    goo: ['#6a7090', '#a4acc8', '#fff27a', '#464c68'],
    bestiary: 'A sulky little storm that follows you around. When it rumbles, look up: something is about to fall.',
  },
  {
    id: 'staticling',
    name: 'Staticling',
    hp: 32,
    speed: 0,
    radius: 5,
    contact: 1,
    flying: true,
    move: { kind: 'teleport', params: { interval: 1.8, fade: 0.4, appear: 0.25, min: 40, max: 92 } },
    attacks: [
      { kind: 'ringN', cooldown: 0.4, params: { on: 3, windup: 0.25, count: 12, speed: 105, spin: 15 } },
      { kind: 'aimedShot', cooldown: 1.2, params: { windup: 0.35, range: 170, count: 3, spread: 10, speed: 140 } },
    ],
    sprite: STATICLING_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'water',
    goo: ['#fff27a', '#6ad8ff', '#ffc830', '#2a8ad8'],
    bestiary: 'A spark that got loose from the storm. It never stays put, and every hop ends in a crackling ring.',
  },
  {
    id: 'whirligust',
    name: 'Whirligust',
    hp: 42,
    speed: 70,
    radius: 6,
    contact: 1,
    flying: true,
    move: { kind: 'orbitPlayer', params: { radius: 70, spin: 1.5, dir: 0 } },
    attacks: [
      {
        kind: 'stream',
        cooldown: 3.2,
        params: { windup: 0.5, range: 200, count: 14, interval: 0.07, turn: 26, arms: 2, speed: 80, spin: 40 },
      },
    ],
    sprite: WHIRLIGUST_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'dust',
    goo: ['#dce8f4', '#9ab0c8', '#d8943a', '#7aaa4a'],
    bestiary: 'A pocket-sized tornado full of leaves. It circles you, then spins them out in a spiral you must weave.',
  },
  {
    id: 'stormkite',
    name: 'Stormkite',
    hp: 38,
    speed: 72,
    radius: 6,
    contact: 1,
    flying: true,
    move: { kind: 'swoop', params: { radius: 64, spin: 1.6, every: 2, windup: 0.5, diveSpeed: 220, over: 48 } },
    attacks: [
      { kind: 'spreadFan', cooldown: 0.3, params: { on: 4, windup: 0, count: 5, spread: 90, speed: 95 } },
      // still: 0 — it keeps circling / diving while it winds up (a dive never stalls mid-air).
      { kind: 'aimedShot', cooldown: 1.8, params: { windup: 0.35, still: 0, range: 150, minRange: 40, count: 2, spread: 10, speed: 125 } },
    ],
    sprite: STORMKITE_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ink',
    goo: ['#d8483a', '#ffd35a', '#6fc0f0', '#8a5a3a'],
    bestiary: 'A runaway kite that never came down. It circles high, hovers, then dives straight through you.',
  },
];

export default enemies;
