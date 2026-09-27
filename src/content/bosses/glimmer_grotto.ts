/**
 * Chapter 4 alt bosses — The Glimmer Grotto (hidden route, floors 7-8). Original designs (guide:
 * docs/content-bosses-b.md). Hushwing, a flying boss built around echoes: what it screams out comes back from
 * the walls; Facetta (polish batch 4 — the hidden route used to meet Hushwing on both floors), a slow crystal
 * tortoise whose shell sings. Three phases each; both change their look with the phase (hooks 'bossesB.<id>',
 * content/hooks/bosses-b.ts).
 *
 *   Hushwing  a great crystal-grown grotto bat. Listening: screech rings, then the ECHO — a call flies out
 *             and a ring comes back from the room's walls to close on the bat (one gap), a vanishing act
 *             ending in an aimed fan, crystals falling from the ceiling. Resonating (66 %): Echo Bats, a
 *             crystal cage closing on you, a four-arm spiral, double blinks with rings, twin light beams.
 *             Shattering (30 %): the crystals burst (a ring), star-shaped crystal spokes, double echoes,
 *             a thick crystal rain, fast stepped rings, blinks with wide fans.
 *
 *   Facetta   an ancient grotto tortoise grown over with crystal spires. Dormant: rings of crystal, crystal
 *             pods that burst into shards, spokes of glitter, stalactites falling. Singing (64 %): three
 *             Glint Mites wake; twin prism beams, a cage of crystal closing in, a four-arm spiral, bigger pod
 *             volleys, fans of shards between. Prism Heart (30 %): the shell cracks open (a burst of 24),
 *             seven-arm spokes, a wide twin beam, a crystal downpour, and she charges.
 */

import type { BossDef } from '../../sim/types';
import { FACETTA_SPRITE, HUSHWING_SPRITE } from '../sprites/bossesBGrotto';

const bosses: BossDef[] = [
  {
    id: 'hushwing',
    name: 'Hushwing',
    kind: 'boss',
    chapters: ['glimmer_grotto'],
    hp: 600,
    size: 13,
    speed: 38,
    mass: 7,
    flying: true,
    sprite: HUSHWING_SPRITE,
    hook: 'bossesB.hushwing',
    shot: 'ice',
    goo: ['#5e4e78', '#8ae8ff', '#d8b0ff', '#ffffff'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'IT HEARS YOUR HEARTBEAT ACROSS THE CAVE',
    bestiary: 'The eldest grotto bat. Crystals grow wherever its screech rings out, and it has screeched for ages.',
    phases: [
      {
        at: 1,
        name: 'Listening',
        move: { kind: 'float', params: { wobble: 1, freq: 0.6, drift: 1 } },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'ring', params: { windup: 0.6, count: 16, speed: 78, repeats: 2, gap: 0.45, alt: 1 } },
          {
            kind: 'closingRing',
            params: { windup: 0.6, center: 1, edge: 1, count: 20, hole: 3, out: 12, outSpeed: 95, delay: 0.7, speed: 14, accel: 95 },
          },
          { kind: 'teleport', params: { fade: 0.6, appear: 0.35, min: 50, max: 100, ring: 0, burst: 3, burstSpeed: 110 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 8, time: 1.4, targeted: 2, air: 1, slam: 0 } },
        ],
      },
      {
        at: 0.66,
        name: 'Resonating',
        move: { kind: 'float', params: { wobble: 1.2, freq: 0.8, drift: 1 } },
        attacks: [],
        tint: '#b48cff',
        pace: 1.15,
        rest: [0.9, 1.4],
        enter: { kind: 'summon', enemy: 'echo-bat', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'closingRing', params: { windup: 0.6, count: 18, radius: 72, hole: 3, speed: 14, accel: 110, repeats: 2, gap: 1 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 9, turn: 130, time: 2.4, speed: 75 } },
          { kind: 'teleport', params: { fade: 0.5, appear: 0.3, min: 50, max: 100, count: 2, ring: 10, ringSpeed: 80, burst: 0 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 160, time: 1.8, width: 7, twin: 1, look: 0 } },
        ],
      },
      {
        at: 0.3,
        name: 'Shattering',
        move: { kind: 'float', params: { wobble: 1.4, freq: 1, drift: 1 } },
        attacks: [],
        speedMul: 1.3,
        tint: '#e8f4ff',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'ring', params: { windup: 0.3, count: 24, speed: 90 } },
        patterns: [
          { kind: 'gearSpokes', params: { windup: 0.55, arms: 6, len: 3, step: 16, speed: 55, volleys: 5, gap: 0.45, turn: 15 } },
          {
            kind: 'closingRing',
            params: { windup: 0.55, center: 1, edge: 1, count: 22, hole: 3, out: 16, outSpeed: 100, delay: 0.6, speed: 14, accel: 100, repeats: 2, gap: 0.9 },
          },
          { kind: 'debrisRain', params: { windup: 0.5, count: 14, time: 1.6, targeted: 4, air: 0.95, slam: 0 } },
          { kind: 'ring', params: { windup: 0.5, count: 18, speed: 85, repeats: 4, gap: 0.3, spin: 10, alt: 1 } },
          { kind: 'teleport', params: { fade: 0.45, appear: 0.3, min: 56, max: 104, count: 2, ring: 0, burst: 5, burstSpeed: 115 } },
        ],
      },
    ],
  },
  {
    id: 'facetta',
    name: 'Facetta',
    kind: 'boss',
    chapters: ['glimmer_grotto'],
    hp: 580,
    size: 15,
    speed: 16,
    mass: 14,
    contact: 2,
    sprite: FACETTA_SPRITE,
    hook: 'bossesB.facetta',
    shot: 'ice',
    goo: ['#4e4468', '#8ae8ff', '#d8b0ff', '#6a7a68'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'SHE WEARS A CATHEDRAL ON HER BACK',
    bestiary: 'A grotto tortoise so old that crystal grew over her shell like frost. When she is upset, it sings.',
    phases: [
      {
        at: 1,
        name: 'Dormant',
        move: { kind: 'wander', params: { pause: 1, dist: 30, walk: 0.8 } },
        attacks: [],
        rest: [1.2, 1.7],
        patterns: [
          { kind: 'ring', params: { windup: 0.7, count: 14, speed: 70, repeats: 2, gap: 0.5, spin: 12 } },
          { kind: 'podBurst', params: { windup: 0.6, count: 3, split: 7, air: 1.1, spread: 56, stagger: 0.25 } },
          { kind: 'gearSpokes', params: { windup: 0.6, arms: 5, len: 2, step: 18, speed: 50, volleys: 3, gap: 0.55, turn: 18 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 8, time: 1.4, targeted: 2, air: 1, slam: 0 } },
        ],
      },
      {
        at: 0.64,
        name: 'Singing',
        move: { kind: 'wander', params: { pause: 0.8, dist: 34, walk: 0.9 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.6, params: { speed: 100, windup: 0.4, range: 180, count: 3, spread: 18 } }],
        tint: '#8ae8ff',
        pace: 1.15,
        rest: [1, 1.4],
        enter: { kind: 'summon', enemy: 'glint-mite', params: { windup: 0.3, count: 3, max: 4 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, arc: 140, time: 1.8, width: 7, twin: 1, look: 0 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 18, radius: 74, hole: 3, speed: 14, accel: 105, repeats: 2, gap: 1 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 9, turn: 140, time: 2.4, speed: 70 } },
          { kind: 'podBurst', params: { windup: 0.55, count: 5, split: 8, air: 1, spread: 64, stagger: 0.15 } },
        ],
      },
      {
        at: 0.3,
        name: 'Prism Heart',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.4,
        tint: '#e8f8ff',
        pace: 1.3,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'ring', params: { windup: 0.3, count: 24, speed: 88 } },
        patterns: [
          { kind: 'gearSpokes', params: { windup: 0.5, arms: 7, len: 3, step: 16, speed: 55, volleys: 5, gap: 0.42, turn: 14 } },
          { kind: 'beamSweep', params: { windup: 0.8, arc: 200, time: 2.2, width: 8, twin: 1, look: 0 } },
          { kind: 'debrisRain', params: { windup: 0.5, count: 14, time: 1.6, targeted: 4, air: 0.95, slam: 0 } },
          { kind: 'charge', params: { windup: 0.7, speed: 170, count: 2, pause: 0.4, stun: 0.6, maxTime: 1.4, ring: 10, ringSpeed: 76 } },
        ],
      },
    ],
  },
];

export default bosses;
