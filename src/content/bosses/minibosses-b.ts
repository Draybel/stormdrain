/**
 * Boss pack B minibosses — chapters 3-4, main and alt tracks (the Grinding Works, the Rust Foundry, the
 * Mushroom Hollow, the Glimmer Grotto). Original designs (guide: docs/content-bosses-b.md). Their home
 * is chapter 3, so on chapter 4's floors they get the usual +14 % HP per floor deeper (bossHpFor). Both
 * change their look at half health (hook 'bossesB.<id>', content/hooks/bosses-b.ts).
 *
 *   Canshell  a hermit crab in a tin can. Scuttling: circles you sideways, rushes, snaps its claw
 *             (aimed fans), flings bottle caps that burst. Tucked In: hides in the can and ROLLS — three
 *             bouncing rolls with a ring on every bonk, spokes as it spins, leading claw fans.
 *   Glowtail  a cave grub with a lantern tail. Glowing: tunnels under the floor and erupts, a twin spiral
 *             of light motes, sticky goo. Flare: goo round itself, double dives with a shockwave, a ring
 *             of light closing in, a triple reversing spiral of embers.
 */

import type { BossDef } from '../../sim/types';
import { CANSHELL_SPRITE, GLOWTAIL_SPRITE } from '../sprites/bossesBMini';

const CH = ['grinding_works', 'rust_foundry', 'mushroom_hollow', 'glimmer_grotto'] as const;

const bosses: BossDef[] = [
  {
    id: 'canshell',
    name: 'Canshell',
    kind: 'miniboss',
    chapters: CH,
    hp: 220,
    size: 10,
    speed: 30,
    mass: 4,
    sprite: CANSHELL_SPRITE,
    hook: 'bossesB.canshell',
    shot: 'dust',
    goo: ['#9aa4ac', '#d8663a', '#c84a3a', '#5e6870'],
    music: 'miniboss',
    title: 'FINDERS KEEPERS, SAYS THE CRAB',
    bestiary: 'A hermit crab that moved into a soup can and will not be moving out. It pinches first and asks never.',
    phases: [
      {
        at: 1,
        name: 'Scuttling',
        move: { kind: 'orbitPlayer', params: { radius: 62, spin: 1.3, dir: 1 } },
        attacks: [],
        rest: [0.9, 1.3],
        patterns: [
          { kind: 'charge', params: { windup: 0.65, speed: 200, count: 1, stun: 0.6, maxTime: 1.3 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 2, shots: 3, spread: 30, interval: 0.4, speed: 110 } },
          { kind: 'podBurst', params: { windup: 0.5, count: 2, split: 5, air: 0.9, spread: 40, stagger: 0.25 } },
        ],
      },
      {
        at: 0.5,
        name: 'Tucked In',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.2,
        tint: '#e8583a',
        pace: 1.2,
        rest: [0.8, 1.1],
        enter: { kind: 'ring', params: { windup: 0.3, count: 12, speed: 80 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.55, speed: 230, count: 3, pause: 0.3, stun: 0.35, maxTime: 1.2, ring: 8, ringSpeed: 80 } },
          { kind: 'gearSpokes', params: { windup: 0.5, arms: 3, len: 3, step: 18, speed: 55, volleys: 4, gap: 0.45, turn: 20 } },
          { kind: 'aimedBurst', params: { windup: 0.35, bursts: 3, shots: 3, spread: 24, interval: 0.35, speed: 115, lead: 0.3 } },
        ],
      },
    ],
  },
  {
    id: 'glowtail',
    name: 'Glowtail',
    kind: 'miniboss',
    chapters: CH,
    hp: 240,
    size: 10,
    speed: 22,
    mass: 4,
    sprite: GLOWTAIL_SPRITE,
    hook: 'bossesB.glowtail',
    shot: 'dust',
    goo: ['#d8cfa8', '#ffe98a', '#9a8e68', '#fffbe0'],
    music: 'miniboss',
    title: 'A LITTLE LIGHT IN THE DARK, WITH TEETH',
    bestiary: 'A cave grub that grew a lantern on its tail to lure moths. These days it lures bigger things.',
    phases: [
      {
        at: 1,
        name: 'Glowing',
        move: { kind: 'wander', params: { pause: 1, dist: 30, walk: 0.8 } },
        attacks: [],
        rest: [1, 1.4],
        patterns: [
          { kind: 'burrow', params: { dig: 0.5, under: 1.3, speed: 90, rise: 0.7, ring: 10, ringSpeed: 72, waves: 0 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 2, rate: 8, turn: 150, time: 2, speed: 72 } },
          { kind: 'hazard', shot: 'muck', params: { windup: 0.5, count: 3, radius: 11, life: 5, spread: 44 } },
        ],
      },
      {
        at: 0.5,
        name: 'Flare',
        move: { kind: 'wander', params: { pause: 0.7, dist: 36, walk: 1 } },
        attacks: [],
        tint: '#ff8a5a',
        pace: 1.2,
        rest: [0.8, 1.2],
        enter: { kind: 'hazard', shot: 'muck', params: { windup: 0.2, self: 1, count: 4, radius: 10, life: 6, spread: 40 } },
        patterns: [
          { kind: 'burrow', params: { dig: 0.45, under: 1.1, speed: 105, rise: 0.6, count: 2, ring: 12, ringSpeed: 76, waves: 1, waveRadius: 60 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 14, radius: 64, hole: 3, speed: 14, accel: 100 } },
          { kind: 'spiral', shot: 'ember', params: { windup: 0.5, arms: 3, rate: 9, turn: 170, time: 2, speed: 76, reverse: 1 } },
        ],
      },
    ],
  },
];

export default bosses;
