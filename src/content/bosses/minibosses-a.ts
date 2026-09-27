/**
 * Boss pack A minibosses: things the town lost on the first rainy days, met anywhere in chapters 1-2
 * on either track (The Gutterways, The Drowned Nursery, The Rootcellar, The Candlewick Crypt). Their
 * home is the Gutterways (floor 1), so on floors 3-4 they get the usual +14 % HP per floor
 * (select.ts bossHpFor). Miniboss numbers: 150 HP, two phases, half-heart hits.
 *
 *   Bumbershoot  a lost umbrella gone batty (flying). Swoops (it snaps shut to dart), shakes rain off in
 *                offset rings, aimed fans. Inside Out (half): the storm flips it — the rain it caught
 *                pours down, it whirls round the room firing pairs, spirals, triple swoops.
 *   Puddlestomp  a pair of lost galoshes with something living in them. Hops about with a splash
 *                ring on every landing, stomps (jump-slam), kicks puddles, charges. Odd Boots (half): the
 *                boots split up and hunt you separately — smaller, faster, each with its own slams,
 *                charges and fans.
 */

import type { BossDef } from '../../sim/types';
import { BUMBERSHOOT_SPRITE, PUDDLESTOMP_SPRITE } from '../sprites/bossesAMini';

/** Chapters 1-2, main and alt (the first is the home chapter for HP scaling). */
const CH = ['gutterways', 'drowned_nursery', 'rootcellar', 'candlewick_crypt'] as const;

const bosses: BossDef[] = [
  {
    id: 'bumbershoot',
    name: 'Bumbershoot',
    kind: 'miniboss',
    chapters: CH,
    hp: 150,
    size: 10,
    speed: 44,
    mass: 3,
    flying: true,
    sprite: BUMBERSHOOT_SPRITE,
    hook: 'bossesA.bumbershoot',
    music: 'miniboss',
    shot: 'water',
    goo: ['#4a2a5a', '#8e5aa2', '#c8ccd8', '#8cc8ea'],
    drops: 'champion',
    title: 'LOST ON THE FIRST DAY OF RAIN',
    bestiary: 'Somebody left this umbrella on a bus forty days ago. It has grown teeth, and it has not forgiven them.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 1, freq: 0.7, drift: 0.6 } },
        attacks: [],
        rest: [0.6, 1],
        patterns: [
          { kind: 'ring', params: { windup: 0.5, count: 10, speed: 68, repeats: 2, gap: 0.4, alt: 1 } },
          { kind: 'charge', params: { windup: 0.6, speed: 210, count: 2, lead: 0.2, pause: 0.35, stun: 0.3 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 3, spread: 26, interval: 0.35, speed: 100 } },
        ],
      },
      {
        at: 0.5,
        name: 'Inside Out',
        move: { kind: 'float', params: { wobble: 1.3, freq: 0.9, drift: 1 } },
        attacks: [],
        speedMul: 1.3,
        tint: '#9a7ad8',
        pace: 1.2,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'debrisRain', params: { windup: 0.3, count: 8, time: 1.2, targeted: 2, air: 0.9, slam: 0 } },
        patterns: [
          { kind: 'orbitDash', params: { windup: 0.5, radius: 64, spin: 170, time: 2.4, rate: 4, shots: 2, spread: 20, speed: 85 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 9, turn: 170, time: 2, speed: 70 } },
          { kind: 'charge', params: { windup: 0.5, speed: 230, count: 3, lead: 0.3, pause: 0.3, stun: 0.3 } },
        ],
      },
    ],
  },
  {
    id: 'puddlestomp',
    name: 'Puddlestomp',
    kind: 'miniboss',
    chapters: CH,
    hp: 150,
    size: 10,
    speed: 34,
    mass: 4,
    sprite: PUDDLESTOMP_SPRITE,
    hook: 'bossesA.puddlestomp',
    music: 'miniboss',
    shot: 'water',
    goo: ['#d8403a', '#f47e60', '#3a2a2a', '#8cc8ea'],
    drops: 'champion',
    title: "SOMEBODY'S BOOTS, STILL LOOKING FOR PUDDLES",
    bestiary: 'Two lost galoshes and whatever moved into them. They stomp every puddle flat. You look like a puddle.',
    phases: [
      {
        at: 1,
        move: { kind: 'hop', params: { rest: 0.6, crouch: 0.25, air: 0.45, dist: 40, height: 12, aim: 0.8 } },
        attacks: [{ kind: 'landShockwave', cooldown: 0.1, params: { on: 1, radius: 30, speed: 110, band: 4 } }],
        rest: [0.8, 1.2],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.8, height: 40, waves: 1, waveRadius: 70, ring: 8, ringSpeed: 70 } },
          { kind: 'hazard', params: { windup: 0.5, count: 3, radius: 11, life: 5, spread: 40 } },
          { kind: 'charge', params: { windup: 0.6, speed: 190, count: 2, pause: 0.35, stun: 0.5, ring: 6, ringSpeed: 65 } },
        ],
      },
      {
        at: 0.5,
        name: 'Odd Boots',
        move: { kind: 'hop', params: { rest: 0.5, crouch: 0.22, air: 0.4, dist: 44, height: 10, aim: 0.8 } },
        attacks: [{ kind: 'landShockwave', cooldown: 0.1, params: { on: 1, radius: 24, speed: 110, band: 4 } }],
        speedMul: 1.2,
        tint: '#e0703a',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.4],
        enter: { kind: 'split', params: { count: 2, scale: 0.8, spread: 150 } },
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.75, height: 36, waves: 1, waveRadius: 60, ring: 6, ringSpeed: 70 } },
          { kind: 'charge', params: { windup: 0.55, speed: 200, count: 2, pause: 0.3, stun: 0.4 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 2, shots: 3, spread: 24, interval: 0.35, speed: 95 } },
        ],
      },
    ],
  },
];

export default bosses;
