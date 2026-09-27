/**
 * Chapter 5 (main) — The Bone Orchard (floors 9-10): bone trees, crows, lanterns.
 *   Gravecaw      flying aimed dive-bomb (bonks walls)   fan of three feathers between dives
 *   Bonebark      rooted tree (turret)                   crab-apples that burst into seeds; rattles up close
 *   Gloam Lantern blinks from spot to spot               aimed ring of embers on arrival, aimed ember between
 *   Rattlebones   path-finding chase                     throws bones (leads you); pulls itself together once
 * Tougher than chapter 4: more HP, faster shots, denser volleys. Units: ARCHITECTURE §3.
 */

import type { EnemyDef } from '../../sim/types';
import { BONEBARK_SPRITE, GLOAM_LANTERN_SPRITE, GRAVECAW_SPRITE, RATTLEBONES_SPRITE } from '../sprites/enemiesBOrchard';

const CH = ['bone_orchard'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'gravecaw',
    name: 'Gravecaw',
    hp: 28,
    speed: 58,
    radius: 6,
    contact: 1,
    flying: true,
    move: { kind: 'dash', params: { axis: 0, windup: 0.5, dashSpeed: 240, maxTime: 1.1, stun: 0.55, rest: 1.3, walk: 0.9 } },
    attacks: [
      // still: 0 — it keeps flying while it winds up (a charge never stalls mid-air).
      { kind: 'aimedShot', cooldown: 2.2, params: { windup: 0.4, still: 0, range: 160, minRange: 48, count: 3, spread: 14, speed: 120 } },
    ],
    sprite: GRAVECAW_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'dust',
    goo: ['#3c3c5e', '#7070a4', '#f0a838', '#27273f'],
    bestiary: 'Orchard crows pick the bones clean, then pick on you: a fan of feathers, then a beak-first dive.',
  },
  {
    id: 'bonebark',
    name: 'Bonebark',
    hp: 60,
    speed: 0,
    radius: 8,
    contact: 1,
    mass: 99,
    big: true,
    move: { kind: 'turret' },
    attacks: [
      {
        kind: 'lob',
        cooldown: 2.6,
        params: { windup: 0.6, range: 220, count: 3, air: 1.1, height: 34, scatter: 18, splash: 10, split: 6 },
        shot: 'ink',
      },
      { kind: 'ringN', cooldown: 3.4, params: { windup: 0.5, range: 72, count: 10, speed: 70, spin: 18 } },
    ],
    sprite: BONEBARK_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'dust',
    goo: ['#ece4cc', '#b4a88a', '#d8483a', '#9aff7a'],
    bestiary: "The orchard's oldest tree grew bones instead of wood. Its crab-apples burst into stinging seeds.",
  },
  {
    id: 'gloam-lantern',
    name: 'Gloam Lantern',
    hp: 30,
    speed: 0,
    radius: 5,
    contact: 1,
    flying: true,
    move: { kind: 'teleport', params: { interval: 2.4, fade: 0.5, appear: 0.3, min: 44, max: 100 } },
    attacks: [
      { kind: 'ringN', cooldown: 0.5, params: { on: 3, windup: 0.3, count: 8, speed: 80, aim: 1 } },
      { kind: 'aimedShot', cooldown: 1.6, params: { windup: 0.4, range: 180, speed: 105, lead: 0.5 } },
    ],
    sprite: GLOAM_LANTERN_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ember',
    goo: ['#ffcf57', '#e8862e', '#3a3048', '#fff6c0'],
    bestiary: "Someone's lost lantern, still looking for the way home. It blinks from spot to spot, spitting embers.",
  },
  {
    id: 'rattlebones',
    name: 'Rattlebones',
    hp: 30,
    speed: 50,
    radius: 5,
    contact: 1,
    move: { kind: 'chasePath', params: { recalc: 8 } },
    attacks: [{ kind: 'aimedShot', cooldown: 2, params: { windup: 0.45, range: 160, minRange: 32, speed: 115, lead: 0.5 } }],
    onDeath: [{ kind: 'split', params: { count: 1, scale: 0.8, hp: 0.5, gen: 1 } }],
    sprite: RATTLEBONES_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    drops: 'critter',
    shot: 'dust',
    goo: ['#ece4cc', '#b4a88a', '#d8b050', '#9aff7a'],
    bestiary: 'A scarecrow that lost its straw but kept its bones. Knock it apart and it pulls itself together once.',
  },
];

export default enemies;
