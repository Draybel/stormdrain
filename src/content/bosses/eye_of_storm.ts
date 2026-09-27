/**
 * Chapter 6 boss — The Eye of the Storm, floor 11 (floor 12 belongs to the final, Old Thunderhead;
 * boss pack C, docs/content-bosses-c.md). Original design, the hardest regular fight on the main track.
 *
 *   Squallvane  the iron rooster weathervane torn off the tallest roof in town. Gusting: spins out a
 *               four-arm spiral, gusts of leaves in walls with a gap, chains of lightning striking in
 *               lines toward you, rusty flak. Struck (65 %): lightning hits it — a storm of strikes, twin
 *               lightning sweeps, a cross of strikes on you, a spark halo, a reversing five-arm spiral.
 *               Unmoored (25 %): the rod snaps and it tumbles round the room, sparks loose, strikes
 *               everywhere, an X of lightning, a fast spiral, wide twin sweeps.
 * It wears a new sprite in each phase (content/hooks/bosses-c.ts).
 */

import type { BossDef } from '../../sim/types';
import { SQUALLVANE_SPRITE } from '../sprites/bossesCStorm';

const bosses: BossDef[] = [
  {
    id: 'squallvane',
    name: 'Squallvane',
    kind: 'boss',
    chapters: ['eye_of_storm'],
    hp: 640,
    size: 13,
    speed: 34,
    mass: 8,
    flying: true,
    sprite: SQUALLVANE_SPRITE,
    music: 'boss_undercurrent',
    shot: 'water',
    goo: ['#4e5262', '#a0582a', '#ffe36a', '#8ab8ff'],
    drops: 'bossSpill',
    hook: 'bossesC.squallvane',
    title: 'TORN OFF THE TALLEST ROOF IN TOWN',
    bestiary: 'Spun off the tallest roof in town by the storm. It still points to wherever the weather is worst.',
    phases: [
      {
        at: 1,
        name: 'Gusting',
        move: { kind: 'float', params: { wobble: 0.9, freq: 0.5, drift: 0.8 } },
        attacks: [],
        rest: [0.9, 1.3],
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 10, turn: 160, time: 2.2, speed: 85 } },
          { kind: 'wave', shot: 'dust', params: { windup: 0.6, waves: 3, gap: 0.8, spacing: 13, hole: 3, speed: 72 } },
          { kind: 'dropLine', params: { windup: 0.6, lines: 2, fan: 34, count: 7, spacing: 17, start: 4, step: 0.08, air: 0.75, look: 2, splash: 10 } },
          { kind: 'aimedBurst', shot: 'dust', params: { windup: 0.4, bursts: 3, shots: 3, spread: 20, interval: 0.3, speed: 120, lead: 0.4 } },
        ],
      },
      {
        at: 0.65,
        name: 'Struck',
        move: { kind: 'float', params: { wobble: 1, freq: 0.6, drift: 0.9 } },
        attacks: [],
        tint: '#ffe36a',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'debrisRain', params: { windup: 0.3, bolt: 1, count: 8, targeted: 3, air: 0.8, time: 1.2, slam: 0, splash: 10 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, twin: 1, arc: 150, time: 1.9, width: 7, look: 1 } },
          { kind: 'dropLine', params: { windup: 0.55, layout: 1, count: 8, spacing: 16, step: 0.06, air: 0.75, look: 2, splash: 10 } },
          { kind: 'halo', params: { windup: 0.5, count: 14, radius: 26, spin: 3, hold: 0.8, speed: 100, aim: 0 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 5, rate: 10, turn: 170, time: 2.4, speed: 88, reverse: 1 } },
        ],
      },
      {
        at: 0.25,
        name: 'Unmoored',
        move: { kind: 'float', params: { wobble: 1.3, freq: 0.8, drift: 1 } },
        attacks: [],
        speedMul: 1.3,
        tint: '#8ab8ff',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'summon', enemy: 'staticling', params: { windup: 0.3, count: 2, max: 2, dist: 34 } },
        patterns: [
          { kind: 'ricochet', params: { windup: 0.7, speed: 220, bounces: 4, ring: 8, ringSpeed: 85, stun: 0.4 } },
          { kind: 'debrisRain', params: { windup: 0.4, bolt: 1, count: 12, targeted: 4, air: 0.75, time: 1.8, slam: 0, splash: 10 } },
          { kind: 'dropLine', params: { windup: 0.5, layout: 2, count: 8, spacing: 16, step: 0.06, air: 0.75, look: 2, splash: 10 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 3, rate: 12, turn: 200, time: 2, speed: 95 } },
          { kind: 'beamSweep', params: { windup: 0.8, twin: 1, arc: 200, time: 2.2, width: 7, look: 1 } },
        ],
      },
    ],
  },
];

export default bosses;
