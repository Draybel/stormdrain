/**
 * Chapter 3 alt boss — The Rust Foundry (hidden route, floors 5-6). Original design (guide:
 * docs/content-bosses-b.md). The alt track's reward for finding the grate is a harder fight: three
 * phases, burning puddles and slag everywhere. It changes its look with its phase (hook
 * 'bossesB.bellowbelly', content/hooks/bosses-b.ts).
 *
 *   Bellowbelly  a cast-iron stove on legs. Stoked: slag bombs that burst into ember rings and leave
 *                burning puddles, a sweeping breath of flame, stepped ember rings, lobbed cinders.
 *                Red Hot (65 %): a ring of slag puddles round itself, belly flops with double
 *                shockwaves, five-bomb volleys, a spinning spark spiral, twin flame breath. Meltdown
 *                (30 %): slag blobs, bombs all over the room, a ring of fire closing in, a reversing
 *                spiral, molten drips from the ceiling, double flops.
 */

import type { BossDef } from '../../sim/types';
import { BELLOWBELLY_SPRITE } from '../sprites/bossesBFoundry';

const bosses: BossDef[] = [
  {
    id: 'bellowbelly',
    name: 'Bellowbelly',
    kind: 'boss',
    chapters: ['rust_foundry'],
    hp: 540,
    size: 14,
    speed: 20,
    mass: 10,
    contact: 2,
    sprite: BELLOWBELLY_SPRITE,
    hook: 'bossesB.bellowbelly',
    shot: 'ember',
    goo: ['#45404a', '#ff7a2a', '#ffc84a', '#8a4a2a'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'THE STOVE THAT NEVER LETS ITS FIRE GO OUT',
    bestiary: 'A cast-iron stove that learned to walk by stomping. It breathes through its bellows and hiccups slag.',
    phases: [
      {
        at: 1,
        name: 'Stoked',
        move: { kind: 'wander', params: { pause: 0.8, dist: 36, walk: 1 } },
        attacks: [{ kind: 'lob', cooldown: 3.2, params: { windup: 0.5, air: 0.9, splash: 10, creep: 1, count: 1, range: 200 } }],
        rest: [1.1, 1.6],
        patterns: [
          { kind: 'podBurst', params: { windup: 0.6, count: 3, split: 6, air: 1, spread: 50, creep: 1, radius: 10, life: 4, stagger: 0.2 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 110, time: 1.5, width: 9, look: 2 } },
          { kind: 'ring', params: { windup: 0.6, count: 16, speed: 70, repeats: 2, gap: 0.45, alt: 1 } },
        ],
      },
      {
        at: 0.65,
        name: 'Red Hot',
        move: { kind: 'wander', params: { pause: 0.6, dist: 42, walk: 1.1 } },
        attacks: [{ kind: 'lob', cooldown: 2.6, params: { windup: 0.45, air: 0.85, splash: 10, creep: 1, count: 2, scatter: 20, range: 200 } }],
        tint: '#ff6a2a',
        pace: 1.15,
        rest: [1, 1.4],
        enter: { kind: 'hazard', params: { windup: 0.3, count: 5, self: 1, radius: 11, life: 7, spread: 50 } },
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.55, air: 0.85, height: 44, waves: 2, waveRadius: 90, ring: 14, ringSpeed: 72 } },
          { kind: 'podBurst', params: { windup: 0.55, count: 5, split: 8, air: 1, spread: 64, creep: 1, radius: 10, life: 4, stagger: 0.14 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 150, time: 2.4, speed: 72 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 180, time: 2.2, width: 9, twin: 1, look: 2 } },
        ],
      },
      {
        at: 0.3,
        name: 'Meltdown',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.25,
        tint: '#ffe066',
        pace: 1.3,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'slag-blob', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'podBurst', params: { windup: 0.5, count: 7, where: 2, split: 8, air: 1.1, creep: 1, radius: 9, life: 5, stagger: 0.1 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 20, radius: 80, hole: 4, speed: 14, accel: 115, repeats: 2, gap: 0.9 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 10, turn: 170, time: 2.6, speed: 75, reverse: 1 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 12, time: 1.6, targeted: 3, air: 1, creep: 1, slam: 1 } },
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.8, height: 48, count: 2, waves: 2, waveRadius: 90, ring: 14, ringSpeed: 76 } },
        ],
      },
    ],
  },
];

export default bosses;
