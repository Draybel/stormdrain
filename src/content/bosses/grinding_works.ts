/**
 * Chapter 3 bosses — The Grinding Works (main track, floors 5-6). Original designs (guide:
 * docs/content-bosses-b.md). Deeper than the Gutterways, so: ~500 HP (a Gutterways boss borrowed here
 * would have ~370-430), denser volleys, faster phase 2 (pace 1.2-1.25) and adds from the chapter's own
 * roster. Each changes its look with its phase (hook 'bossesB.<id>', content/hooks/bosses-b.ts).
 *
 *   Old Governor  a riveted brass boiler that regulates the Works. Regulating: turning spokes flung off
 *                 its flyballs, a sweeping steam jet, stepped steam rings, rivet fans. Overpressure (half
 *                 health, red-hot and cracked): twin jets, a steam ring closing in on you, denser
 *                 spokes, rivets raining from the pipes, wind-up mice.
 *   Gnawgear      a gear with a jaw. Grinding: rolls at you twice (sheds a ring of teeth on the wall),
 *                 spins out spokes of teeth, spits bolts, calls a Runaway Cog. Stripped (45 %, teeth
 *                 snapped off): triple rolls with falling debris, spark spokes and a reversing spiral,
 *                 bouncing slams, two more cogs.
 */

import type { BossDef } from '../../sim/types';
import { GNAWGEAR_SPRITE, OLD_GOVERNOR_SPRITE } from '../sprites/bossesBWorks';

const CH = ['grinding_works'] as const;

const bosses: BossDef[] = [
  {
    id: 'old-governor',
    name: 'Old Governor',
    kind: 'boss',
    chapters: CH,
    hp: 480,
    size: 13,
    speed: 22,
    mass: 9,
    sprite: OLD_GOVERNOR_SPRITE,
    hook: 'bossesB.old-governor',
    shot: 'dust',
    goo: ['#b8863a', '#e2b85a', '#eef4f6', '#8c979c'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'IT KEEPS THE WHOLE WORKS AT A STEADY BOIL',
    bestiary: 'The regulator that holds the Works at pressure. Spin its flyballs too fast and it forgets how to stop.',
    phases: [
      {
        at: 1,
        name: 'Regulating',
        move: { kind: 'wander', params: { pause: 0.7, dist: 40, walk: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.6, params: { speed: 105, windup: 0.4, count: 2, spread: 16, range: 190 } }],
        rest: [1, 1.5],
        patterns: [
          { kind: 'gearSpokes', params: { windup: 0.6, arms: 4, len: 3, step: 18, speed: 55, volleys: 4, gap: 0.55, turn: 14 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 150, time: 1.8, width: 7, look: 0 } },
          { kind: 'ring', params: { windup: 0.6, count: 14, speed: 72, repeats: 3, gap: 0.4, spin: 12, alt: 1 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 3, spread: 28, interval: 0.35, speed: 110 } },
        ],
      },
      {
        at: 0.5,
        name: 'Overpressure',
        move: { kind: 'wander', params: { pause: 0.5, dist: 48, walk: 1.2 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.1, params: { speed: 115, windup: 0.35, count: 3, spread: 14, range: 200 } }],
        speedMul: 1.2,
        tint: '#e0582a',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.3],
        enter: { kind: 'summon', enemy: 'ticktock-mouse', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, arc: 200, time: 2.4, width: 7, twin: 1, look: 0 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 18, radius: 74, hole: 3, speed: 16, accel: 120, repeats: 2, gap: 1 } },
          { kind: 'gearSpokes', params: { windup: 0.5, arms: 5, len: 4, step: 16, speed: 55, volleys: 5, gap: 0.5, turn: 18 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 10, time: 1.5, targeted: 3, air: 1, slam: 1 } },
          { kind: 'summon', enemy: 'ticktock-mouse', weight: 0.6, params: { windup: 0.5, count: 2, max: 3 } },
        ],
      },
    ],
  },
  {
    id: 'gnawgear',
    name: 'Gnawgear',
    kind: 'boss',
    chapters: CH,
    hp: 480,
    size: 14,
    speed: 28,
    mass: 8,
    contact: 2,
    sprite: GNAWGEAR_SPRITE,
    hook: 'bossesB.gnawgear',
    shot: 'dust',
    goo: ['#c08c3c', '#6a7472', '#ecc466', '#1c0c10'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'IT CHEWS UP WHATEVER FALLS INTO THE WORKS',
    bestiary: 'A drive gear that grew a jaw and an appetite. Anything that drops into the Works goes through its teeth.',
    phases: [
      {
        at: 1,
        name: 'Grinding',
        move: { kind: 'chase' },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'charge', params: { windup: 0.75, speed: 220, count: 2, pause: 0.4, stun: 0.6, maxTime: 1.4, ring: 10, ringSpeed: 80 } },
          { kind: 'gearSpokes', params: { windup: 0.55, arms: 3, len: 4, step: 20, speed: 50, volleys: 5, gap: 0.45, turn: 20 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 3, spread: 26, interval: 0.35, speed: 115 } },
          { kind: 'summon', enemy: 'runaway-cog', params: { windup: 0.5, count: 1, max: 2 } },
        ],
      },
      {
        at: 0.45,
        name: 'Stripped',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.3,
        tint: '#d97a3a',
        pace: 1.25,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'runaway-cog', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.6, speed: 250, count: 3, pause: 0.35, stun: 0.45, maxTime: 1.3, ring: 12, ringSpeed: 85, debris: 4 } },
          { kind: 'gearSpokes', shot: 'ember', params: { windup: 0.5, arms: 5, len: 4, step: 18, speed: 52, volleys: 6, gap: 0.42, turn: 24 } },
          { kind: 'spiral', shot: 'ember', params: { windup: 0.5, arms: 4, rate: 9, turn: 170, time: 2.2, speed: 72, reverse: 1 } },
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.75, height: 48, count: 2, waves: 1, waveRadius: 80, ring: 12, ringSpeed: 78 } },
        ],
      },
    ],
  },
];

export default bosses;
