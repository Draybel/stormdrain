/**
 * Chapter 1 bosses — The Gutterways (original designs). Numbers: Wren deals ≈ 10 damage per second
 * at base, so a 260-300 HP boss is a 25-30 s fight before items.
 *
 *   Sodden Snarl  (boss)      a wad of drain hair and leaves. Phase 1 rolls at you (debris falls when
 *                             it bonks a wall), rings of muck, muck puddles. At half health it
 *                             unravels into two smaller snarls that charge twice and spit.
 *   Brimwell      (boss)      a rain-gauge golem. Phase 1 jump-slams (shockwave + water ring), stepped
 *                             spiral rings, walls of rain with a gap. Overflowing (half health): a
 *                             sweeping water jet, double slams, ceiling debris, a spiral.
 *   Pipewhip      (miniboss)  a sewer eel. Dives under the flagstones and erupts, spits, pops out of
 *                             another drain. Thrashing: rats from the pipes, double dives, a spiral.
 */

import type { BossDef } from '../../sim/types';
import { BRIMWELL_SPRITE, PIPEWHIP_SPRITE, SODDEN_SNARL_SPRITE } from '../sprites/bosses';

const CH = ['gutterways'] as const;

const bosses: BossDef[] = [
  {
    id: 'sodden-snarl',
    name: 'Sodden Snarl',
    kind: 'boss',
    chapters: CH,
    hp: 260,
    size: 14,
    speed: 24,
    mass: 7,
    sprite: SODDEN_SNARL_SPRITE,
    shot: 'muck',
    goo: ['#45321f', '#8a6b4a', '#6f9a58', '#c8773a'],
    drops: 'bossSpill',
    title: 'EVERYTHING THE RAIN WASHED DOWN, IN ONE LUMP',
    bestiary: 'Hair, leaves, string and one lost mitten, balled up in the drains until it grew a temper.',
    phases: [
      {
        at: 1,
        name: 'Soggy',
        move: { kind: 'chase' },
        attacks: [],
        rest: [1, 1.6],
        patterns: [
          { kind: 'charge', params: { windup: 0.8, speed: 190, maxTime: 1.6, stun: 0.7, debris: 4, splash: 9 } },
          { kind: 'ring', params: { windup: 0.6, count: 10, speed: 65, repeats: 2, gap: 0.45, spin: 18 } },
          { kind: 'hazard', params: { windup: 0.5, count: 3, radius: 12, life: 5, spread: 40 } },
        ],
      },
      {
        at: 0.5,
        name: 'Unravelled',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.35,
        tint: '#b0603a',
        pace: 1.1,
        rest: [1.2, 2],
        enter: { kind: 'split', params: { count: 2, scale: 0.72, spread: 150 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.65, speed: 215, count: 2, pause: 0.4, stun: 0.5, maxTime: 1.3 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 2, shots: 3, spread: 26, interval: 0.4, speed: 95 } },
          { kind: 'ring', params: { windup: 0.5, count: 8, speed: 75 } },
        ],
      },
    ],
  },
  {
    id: 'brimwell',
    name: 'Brimwell',
    kind: 'boss',
    chapters: CH,
    hp: 300,
    size: 12,
    speed: 20,
    mass: 9,
    sprite: BRIMWELL_SPRITE,
    shot: 'water',
    goo: ['#72b4ec', '#3b78c0', '#e6f4ff', '#c89c3c'],
    drops: 'bossSpill',
    title: 'THE RAIN GAUGE THAT MEASURED FORTY DAYS',
    bestiary: 'A rain gauge that counted every drop of the storm until the numbers ran out. It is very full.',
    phases: [
      {
        at: 1,
        name: 'Rising',
        move: { kind: 'wander', params: { pause: 0.6, dist: 40, walk: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.6, params: { speed: 100, windup: 0.4, range: 170 } }],
        rest: [1, 1.5],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.55, air: 0.85, height: 50, waves: 1, waveRadius: 80, ring: 8, ringSpeed: 70 } },
          { kind: 'ring', params: { windup: 0.6, count: 12, speed: 70, repeats: 3, gap: 0.3, spin: 15 } },
          { kind: 'wave', params: { windup: 0.7, waves: 2, gap: 1, spacing: 14, hole: 3, speed: 58 } },
        ],
      },
      {
        at: 0.5,
        name: 'Overflowing',
        move: { kind: 'wander', params: { pause: 0.4, dist: 48, walk: 1.2 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.2, params: { speed: 110, windup: 0.35, range: 180, count: 2, spread: 14 } }],
        tint: '#2f7ad8',
        pace: 1.2,
        order: 'random',
        rest: [0.9, 1.4],
        enter: { kind: 'hazard', params: { windup: 0.2, count: 5, self: 1, radius: 11, life: 7, spread: 60 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, arc: 140, time: 1.8, width: 8, look: 0 } },
          { kind: 'jumpSlam', params: { windup: 0.45, air: 0.8, height: 56, count: 2, waves: 2, waveRadius: 80, ring: 10, ringSpeed: 75 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 9, time: 1.4, targeted: 2, air: 1, slam: 1 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 8, turn: 120, time: 2.2, speed: 70 } },
        ],
      },
    ],
  },
  {
    id: 'pipewhip',
    name: 'Pipewhip',
    kind: 'miniboss',
    chapters: CH,
    hp: 120,
    size: 9,
    speed: 0,
    mass: 4,
    sprite: PIPEWHIP_SPRITE,
    shot: 'muck',
    goo: ['#4f6f5a', '#7aa07e', '#2f4636', '#c8e06a'],
    title: 'SOMETHING LIVES IN THE BIG PIPE',
    bestiary: 'An eel as long as a drainpipe. It swims under the flagstones and bites whatever stands still.',
    phases: [
      {
        at: 1,
        move: { kind: 'idle' },
        attacks: [],
        rest: [0.8, 1.2],
        patterns: [
          { kind: 'burrow', params: { dig: 0.5, under: 1.3, speed: 95, rise: 0.7, ring: 8, ringSpeed: 72, waves: 0 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 1, interval: 0.35, speed: 115, lead: 0.4 } },
          { kind: 'teleport', params: { fade: 0.55, appear: 0.3, min: 50, max: 100, ring: 0, burst: 3 } },
        ],
      },
      {
        at: 0.5,
        name: 'Thrashing',
        move: { kind: 'idle' },
        attacks: [],
        tint: '#8ae06a',
        pace: 1.2,
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'scurrier', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'burrow', params: { dig: 0.45, under: 1.1, speed: 110, rise: 0.6, count: 2, ring: 10, ringSpeed: 76, waves: 1, waveRadius: 60 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 2, rate: 9, turn: 180, time: 1.6, speed: 80 } },
          { kind: 'aimedBurst', params: { windup: 0.35, bursts: 2, shots: 3, spread: 30, interval: 0.4, speed: 105 } },
        ],
      },
    ],
  },
];

export default bosses;
