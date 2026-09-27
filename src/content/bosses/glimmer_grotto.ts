/**
 * Chapter 4 alt boss — The Glimmer Grotto (hidden route, floors 7-8). Original design (guide:
 * docs/content-bosses-b.md). A flying boss built around echoes: what it screams out comes back from the
 * walls. Three phases; it changes its look with its phase (hook 'bossesB.hushwing',
 * content/hooks/bosses-b.ts).
 *
 *   Hushwing  a great crystal-grown grotto bat. Listening: screech rings, then the ECHO — a call flies out
 *             and a ring comes back from the room's walls to close on the bat (one gap), a vanishing act
 *             ending in an aimed fan, crystals falling from the ceiling. Resonating (66 %): Echo Bats, a
 *             crystal cage closing on you, a four-arm spiral, double blinks with rings, twin light beams.
 *             Shattering (30 %): the crystals burst (a ring), star-shaped crystal spokes, double echoes,
 *             a thick crystal rain, fast stepped rings, blinks with wide fans.
 */

import type { BossDef } from '../../sim/types';
import { HUSHWING_SPRITE } from '../sprites/bossesBGrotto';

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
];

export default bosses;
