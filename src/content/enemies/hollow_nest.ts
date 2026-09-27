/**
 * Chapter 6 (alt) — The Hollow Nest (floors 11-12): wasp paper, amber, larvae. The hardest alt
 * chapter: tough, fast and crowded.
 *   Papercut    flies to cut you off (leads your movement)   leading stinger pairs
 *   Ambertomb   slow slide                                   turning 12-drop rings; sticky resin lobs (a heart)
 *   Brood Comb  rooted nest (turret)                         hatches Grublings; sweeping spray of paper scraps
 *   Grubling    chews tunnels under the floor                ring of goo when it pops up
 * Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import { AMBERTOMB_SPRITE, BROOD_COMB_SPRITE, GRUBLING_SPRITE, PAPERCUT_SPRITE } from '../sprites/enemiesBNest';

const CH = ['hollow_nest'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'papercut',
    name: 'Papercut',
    hp: 30,
    speed: 80,
    radius: 5,
    contact: 1,
    flying: true,
    move: { kind: 'intercept', params: { lead: 0.8, weave: 0.45, freq: 1.4 } },
    attacks: [
      {
        kind: 'aimedShot',
        cooldown: 1.6,
        params: { windup: 0.35, range: 150, minRange: 40, count: 2, spread: 8, speed: 135, lead: 0.8 },
      },
    ],
    sprite: PAPERCUT_SPRITE,
    chapters: CH,
    weight: 9,
    championable: true,
    shot: 'ember',
    goo: ['#d8d0c0', '#e8b830', '#a8a090', '#4a4038'],
    bestiary: 'Paper wasps chew old letters into nests. This one flies to where you are going, not where you are.',
  },
  {
    id: 'ambertomb',
    name: 'Ambertomb',
    hp: 80,
    speed: 16,
    radius: 7,
    contact: 2,
    mass: 4,
    big: true,
    move: { kind: 'wander', params: { pause: 1, dist: 30, walk: 1 } },
    attacks: [
      { kind: 'ringN', cooldown: 2.6, params: { windup: 0.55, count: 12, speed: 70, spin: 15 } },
      {
        kind: 'lob',
        cooldown: 3.4,
        params: { windup: 0.5, range: 200, count: 2, air: 1, height: 26, scatter: 16, splash: 11, creep: 1, dmg: 2 },
      },
    ],
    sprite: AMBERTOMB_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'ember',
    goo: ['#f0a830', '#ffe08a', '#7a3a10', '#b87010'],
    bestiary: 'A beetle sealed in amber a thousand rains ago. It still spits, and what it spits still sticks.',
  },
  {
    id: 'brood-comb',
    name: 'Brood Comb',
    hp: 56,
    speed: 0,
    radius: 7,
    contact: 1,
    mass: 99,
    move: { kind: 'turret' },
    attacks: [
      { kind: 'spawnMinion', cooldown: 4.2, enemy: 'grubling', params: { windup: 0.6, count: 1, max: 3, dist: 14 } },
      {
        kind: 'stream',
        cooldown: 2.8,
        params: { windup: 0.5, range: 200, count: 9, interval: 0.09, turn: 11, aim: 1, speed: 95 },
      },
    ],
    sprite: BROOD_COMB_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'dust',
    goo: ['#d8d0c0', '#a8a090', '#f4e8c8', '#2a221e'],
    bestiary: 'A papery nest that never stops hatching. Grubs crawl out of its door while it sprays paper scraps.',
  },
  {
    id: 'grubling',
    name: 'Grubling',
    hp: 14,
    speed: 50,
    radius: 4,
    contact: 1,
    move: { kind: 'burrow', params: { under: 1, above: 1.2, near: 20, rise: 0.5, dig: 0.3, tunnel: 1.3 } },
    attacks: [{ kind: 'ringN', cooldown: 0.4, params: { on: 2, windup: 0.15, count: 6, speed: 70 } }],
    sprite: GRUBLING_SPRITE,
    chapters: CH,
    weight: 5,
    championable: true,
    shot: 'ember',
    goo: ['#f4e8c8', '#c8a878', '#c87a3a', '#e8b830'],
    bestiary: 'Wasp larvae chew tunnels through the paper floor. When it bulges, a grub is about to pop up and spit.',
  },
];

export default enemies;
