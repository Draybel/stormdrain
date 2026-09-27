/**
 * The Drowned Nursery bosses (chapter 1, alt track — floors 1-2), boss pack A. Tuned like the
 * Gutterways pair (Wren deals ≈ 10 damage a second at base): 225-240 HP (polish batch 4: ×0.8), two phases,
 * half-heart hits.
 *
 *   Pirouetta     a porcelain music-box dancer. Curtain Up: circles you, a two-armed spiral of notes, a
 *                 grand lap of the room (orbitDash), walls of sheet music with a gap, a curtsy that
 *                 vanishes and reappears in a ring. Overwound (half): the mainspring snaps — a twanging
 *                 double ring, faster reversing spirals, laps that fire notes INWARD at the middle, double
 *                 curtsies, birthday balloons drifting in.
 *   Sir Sopsalot  a waterlogged teddy knight. Soggy: squelching jump-slams, wrung-out bathwater puddles,
 *                 button volleys, bath ducks to the rescue. Unstitched (half): a puff of stuffing, then
 *                 tumbling double charges, double slams, toy blocks raining off the shelves, slowing
 *                 stuffing rings (polish batch 4: pace 1.0 and two charges, not 1.15 and three — he was the
 *                 deadliest boss of the game).
 */

import type { BossDef } from '../../sim/types';
import { PIROUETTA_SPRITE, SOPSALOT_SPRITE } from '../sprites/bossesANursery';

const CH = ['drowned_nursery'] as const;

const bosses: BossDef[] = [
  {
    id: 'pirouetta',
    name: 'Pirouetta',
    kind: 'boss',
    chapters: CH,
    hp: 225,
    size: 12,
    speed: 34,
    mass: 5,
    sprite: PIROUETTA_SPRITE,
    hook: 'bossesA.pirouetta',
    music: 'boss_floodgate',
    shot: 'dust',
    goo: ['#f2c4d2', '#f6eef2', '#3f8a8a', '#d0a44a'],
    drops: 'bossSpill',
    title: 'SHE DANCES UNTIL THE MUSIC RUNS DOWN',
    bestiary: 'The dancer from a drowned music box. Her key still turns, so she still dances, and she wants a partner.',
    phases: [
      {
        at: 1,
        name: 'Curtain Up',
        move: { kind: 'orbitPlayer', params: { radius: 64, spin: 1.1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 3.2, params: { speed: 80, windup: 0.45, size: 2.5 } }],
        rest: [1, 1.5],
        patterns: [
          { kind: 'spiral', params: { windup: 0.6, arms: 2, rate: 8, turn: 150, time: 2.2, speed: 58, size: 2.5 } },
          { kind: 'orbitDash', params: { windup: 0.6, radius: 70, spin: 130, time: 2.6, rate: 2.5, shots: 1, speed: 85, size: 2.5 } },
          { kind: 'wave', params: { windup: 0.7, waves: 2, gap: 1, spacing: 14, hole: 3, speed: 55, size: 2.5 } },
          { kind: 'teleport', params: { fade: 0.6, appear: 0.35, min: 50, max: 100, ring: 10, ringSpeed: 65 } },
        ],
      },
      {
        at: 0.5,
        name: 'Overwound',
        move: { kind: 'orbitPlayer', params: { radius: 56, spin: 1.5 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.6, params: { speed: 88, windup: 0.4, count: 2, spread: 14, size: 2.5 } }],
        speedMul: 1.2,
        tint: '#6fd6c8',
        pace: 1.2,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'ring', params: { windup: 0.2, count: 16, speed: 70, repeats: 2, gap: 0.3, alt: 1, size: 2.5 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 9, turn: 170, reverse: 1, time: 2.6, speed: 62, size: 2.5 } },
          { kind: 'orbitDash', params: { windup: 0.5, radius: 76, spin: 160, time: 3, rate: 3, shots: 3, spread: 30, aim: 1, speed: 70, size: 2.5 } },
          { kind: 'teleport', params: { fade: 0.5, appear: 0.3, count: 2, ring: 12, ringSpeed: 70, burst: 3 } },
          { kind: 'wave', params: { windup: 0.6, waves: 3, gap: 0.8, spacing: 14, hole: 3, speed: 60, size: 2.5 } },
          { kind: 'summon', enemy: 'lost-balloon', weight: 0.7, params: { windup: 0.4, count: 2, max: 3, dist: 30 } },
        ],
      },
    ],
  },
  {
    id: 'sir-sopsalot',
    name: 'Sir Sopsalot',
    kind: 'boss',
    chapters: CH,
    hp: 240,
    size: 14,
    speed: 22,
    mass: 9,
    sprite: SOPSALOT_SPRITE,
    hook: 'bossesA.sopsalot',
    music: 'boss_floodgate',
    shot: 'water',
    goo: ['#9a7652', '#dcc49c', '#f4f0e8', '#8cc8ea'],
    drops: 'bossSpill',
    title: 'THE BRAVEST BEAR IN THE BATHTUB',
    bestiary: 'A teddy knighted with a wooden spoon, then forgotten in the bath. Soaked through, he guards the nursery.',
    phases: [
      {
        at: 1,
        name: 'Soggy',
        move: { kind: 'chase' },
        attacks: [],
        rest: [1, 1.6],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.6, air: 0.9, height: 50, waves: 1, waveRadius: 80, ring: 8, ringSpeed: 70 } },
          { kind: 'hazard', params: { windup: 0.6, count: 4, radius: 12, life: 6, spread: 50 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 2, spread: 16, interval: 0.35, speed: 100 } },
          { kind: 'summon', enemy: 'bathtub-paddler', params: { windup: 0.5, count: 2, max: 3, dist: 26 } },
        ],
      },
      {
        at: 0.5,
        name: 'Unstitched',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.3,
        tint: '#e07a5a',
        pace: 1,
        order: 'random',
        rest: [0.9, 1.4],
        enter: { kind: 'ring', shot: 'dust', params: { windup: 0.2, count: 14, speed: 62, accel: -18, life: 3.4 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.7, speed: 200, count: 2, pause: 0.35, stun: 0.5, maxTime: 1.4, ring: 6, ringSpeed: 70, debris: 2 } },
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.8, height: 54, count: 2, waves: 2, waveRadius: 80, ring: 10, ringSpeed: 75 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 10, time: 1.5, targeted: 3, air: 1, slam: 1 } },
          { kind: 'ring', shot: 'dust', params: { windup: 0.5, count: 12, speed: 65, repeats: 3, gap: 0.35, spin: 15, accel: -12, life: 4 } },
          { kind: 'summon', enemy: 'bathtub-paddler', weight: 0.6, params: { windup: 0.4, count: 2, max: 4, dist: 26 } },
        ],
      },
    ],
  },
];

export default bosses;
