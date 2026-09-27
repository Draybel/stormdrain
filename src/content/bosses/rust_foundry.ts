/**
 * Chapter 3 alt bosses — The Rust Foundry (hidden route, floors 5-6). Original designs (guide:
 * docs/content-bosses-b.md). The alt track's reward for finding the grate is a harder fight: three
 * phases, burning puddles and slag everywhere. Each changes its look with its phase (hooks
 * 'bossesB.<id>', content/hooks/bosses-b.ts). Two bosses, so the chapter's two floors never repeat one
 * (polish batch 4 added Hammerjaw; the hidden route used to meet Bellowbelly on both floors).
 *
 *   Bellowbelly  a cast-iron stove on legs. Stoked: slag bombs that burst into ember rings and leave
 *                burning puddles, a sweeping breath of flame, stepped ember rings, lobbed cinders.
 *                Red Hot (65 %): a ring of slag puddles round itself, belly flops with double
 *                shockwaves, five-bomb volleys, a spinning spark spiral, twin flame breath. Meltdown
 *                (30 %): slag blobs, bombs all over the room, a ring of fire closing in, a reversing
 *                spiral, molten drips from the ceiling, double flops.
 *   Hammerjaw    an anvil that stood up and hit back. Cold Iron: anvil drops (a shockwave and a ring of
 *                sparks), spokes of sparks, hot rivets in threes, slag bombs that leave burning puddles.
 *                White Heat (62 %): a burst of sparks, then double charges that shake scrap off the
 *                ceiling, double drops, a spark spiral, a pour of molten iron swept across the room.
 *                Slag Heap (28 %): two Slag Blobs crawl out; scrap rain that leaves slag, six-arm spokes,
 *                a ring of sparks closing in, triple drops.
 */

import type { BossDef } from '../../sim/types';
import { BELLOWBELLY_SPRITE, HAMMERJAW_SPRITE } from '../sprites/bossesBFoundry';

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
  {
    id: 'hammerjaw',
    name: 'Hammerjaw',
    kind: 'boss',
    chapters: ['rust_foundry'],
    hp: 520,
    size: 14,
    speed: 22,
    mass: 12,
    contact: 2,
    sprite: HAMMERJAW_SPRITE,
    hook: 'bossesB.hammerjaw',
    shot: 'ember',
    goo: ['#4a4650', '#ff7a2a', '#ffc84a', '#2a2630'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'THE ANVIL THAT GOT TIRED OF BEING HIT',
    bestiary: 'A foundry anvil struck ten thousand times, until one day it struck back. Its jaw rings like a bell.',
    phases: [
      {
        at: 1,
        name: 'Cold Iron',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 2.8, params: { speed: 105, windup: 0.4, range: 180 } }],
        rest: [1.1, 1.6],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.6, air: 0.9, height: 46, waves: 1, waveRadius: 84, ring: 10, ringSpeed: 72 } },
          { kind: 'gearSpokes', params: { windup: 0.55, arms: 4, len: 3, step: 16, speed: 50, volleys: 3, gap: 0.5, turn: 20 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 3, spread: 22, interval: 0.4, speed: 100 } },
          { kind: 'podBurst', params: { windup: 0.6, count: 3, split: 6, air: 1, spread: 50, creep: 1, radius: 10, life: 4, stagger: 0.2 } },
        ],
      },
      {
        at: 0.62,
        name: 'White Heat',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.15,
        tint: '#ff7a3a',
        pace: 1.15,
        rest: [1, 1.4],
        enter: { kind: 'ring', params: { windup: 0.2, count: 18, speed: 80, repeats: 2, gap: 0.3, alt: 1 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.7, speed: 190, count: 2, pause: 0.4, stun: 0.6, maxTime: 1.4, ring: 8, ringSpeed: 72, debris: 3 } },
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.8, height: 50, count: 2, waves: 2, waveRadius: 88, ring: 12, ringSpeed: 76 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 150, time: 2.4, speed: 72 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 120, time: 1.7, width: 8, look: 2 } },
        ],
      },
      {
        at: 0.28,
        name: 'Slag Heap',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.3,
        tint: '#ffd060',
        pace: 1.3,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'slag-blob', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'debrisRain', params: { windup: 0.6, count: 12, time: 1.6, targeted: 3, air: 1, creep: 1, slam: 1 } },
          { kind: 'gearSpokes', params: { windup: 0.5, arms: 6, len: 3, step: 16, speed: 55, volleys: 4, gap: 0.45, turn: 15 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 18, radius: 76, hole: 4, speed: 14, accel: 110, repeats: 2, gap: 0.9 } },
          { kind: 'jumpSlam', params: { windup: 0.45, air: 0.75, height: 52, count: 3, waves: 2, waveRadius: 90, ring: 12, ringSpeed: 78 } },
        ],
      },
    ],
  },
];

export default bosses;
