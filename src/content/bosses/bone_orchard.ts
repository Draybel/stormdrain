/**
 * Chapter 5 bosses — The Bone Orchard (floors 9-10; boss pack C, docs/content-bosses-c.md). Original
 * designs. HP is sized for a floor-9 build (a Gutterways boss met here would have ≈ 2× its 260-300).
 *
 *   Marrowbough      the bone tree the orchard grew from. Rooted: shakes bone-apples down in lines,
 *                    stepped bone rings, crows off its limbs, a rain of apples. Withered (half): its
 *                    lanterns swing round it (orbiting Gloam Lanterns that shoot), a two-ring halo of
 *                    bone shards, a cross of apples on you, it uproots and stomps, a reversing spiral.
 *   The Gloamkeeper  the orchard's lamplighter. Lit: blinks between lanterns, embers that circle and
 *                    then converge on you, a sweep of lantern light, aimed ember bursts. Guttering
 *                    (half): lost lanterns join, triple blinks, burning oil spilled in an X, a twin
 *                    light sweep, a spiral, a whole halo flung at you (stand in its hole).
 * Each wears a second sprite in its later phase (content/hooks/bosses-c.ts).
 */

import type { BossDef } from '../../sim/types';
import { GLOAMKEEPER_SPRITE, MARROWBOUGH_SPRITE } from '../sprites/bossesCOrchard';

const CH = ['bone_orchard'] as const;

const bosses: BossDef[] = [
  {
    id: 'marrowbough',
    name: 'Marrowbough',
    kind: 'boss',
    chapters: CH,
    hp: 540,
    size: 15,
    speed: 16,
    mass: 14,
    sprite: MARROWBOUGH_SPRITE,
    music: 'boss_undercurrent',
    shot: 'dust',
    goo: ['#ece4cc', '#9a8f76', '#ff7a3a', '#3c3c5e'],
    drops: 'bossSpill',
    hook: 'bossesC.marrowbough',
    title: 'THE TREE THE WHOLE ORCHARD GREW FROM',
    bestiary: 'The first bone tree. Every crow in the orchard roosts in it. It had not moved in a hundred rains, until you.',
    phases: [
      {
        at: 1,
        name: 'Rooted',
        move: { kind: 'wander', params: { pause: 1.2, dist: 24, walk: 0.6 } },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'dropLine', params: { windup: 0.7, lines: 3, fan: 28, count: 6, spacing: 17, start: 6, step: 0.11, air: 0.8, look: 0, splash: 9 } },
          { kind: 'ring', params: { windup: 0.6, count: 14, speed: 80, repeats: 3, gap: 0.35, spin: 12 } },
          { kind: 'summon', enemy: 'gravecaw', params: { windup: 0.5, count: 2, max: 3, dist: 20 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 10, time: 1.4, targeted: 3, air: 1, slam: 1 } },
        ],
      },
      {
        at: 0.5,
        name: 'Withered',
        move: { kind: 'wander', params: { pause: 0.8, dist: 30, walk: 0.7 } },
        attacks: [],
        speedMul: 1.2,
        tint: '#d8703a',
        pace: 1.2,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'shields', enemy: 'gloam-lantern', params: { windup: 0.3, count: 3, radius: 16, spin: 1.1 } },
        patterns: [
          { kind: 'halo', params: { windup: 0.5, count: 12, rings: 2, radius: 26, spin: 2.2, hold: 0.9, speed: 85, aim: 0 } },
          { kind: 'dropLine', params: { windup: 0.6, layout: 1, count: 7, spacing: 16, step: 0.09, air: 0.85, look: 0, split: 3 } },
          { kind: 'jumpSlam', params: { windup: 0.6, air: 0.9, height: 40, waves: 2, waveRadius: 90, ring: 12, ringSpeed: 80 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 9, turn: 120, time: 2.4, speed: 80, reverse: 1 } },
          { kind: 'summon', enemy: 'gravecaw', weight: 0.6, params: { windup: 0.4, count: 2, max: 3, dist: 20 } },
        ],
      },
    ],
  },
  {
    id: 'gloamkeeper',
    name: 'The Gloamkeeper',
    kind: 'boss',
    chapters: CH,
    hp: 500,
    size: 11,
    speed: 34,
    mass: 7,
    flying: true,
    sprite: GLOAMKEEPER_SPRITE,
    music: 'boss_undercurrent',
    shot: 'ember',
    goo: ['#6a5a80', '#ffcf57', '#6af0c8', '#2e2440'],
    drops: 'bossSpill',
    hook: 'bossesC.gloamkeeper',
    title: 'HE LIGHTS THE WAY DOWN, NEVER BACK UP',
    bestiary: "The orchard's lamplighter. He lights the lanterns for travellers going down. None of them come back up.",
    phases: [
      {
        at: 1,
        name: 'Lit',
        move: { kind: 'float', params: { wobble: 0.8, freq: 0.5, drift: 0.7 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.8, params: { windup: 0.4, range: 180, speed: 105, lead: 0.3 } }],
        rest: [1, 1.4],
        patterns: [
          { kind: 'teleport', params: { fade: 0.55, appear: 0.3, min: 60, max: 110, count: 2, ring: 12, ringSpeed: 80 } },
          { kind: 'halo', params: { windup: 0.5, count: 10, radius: 22, spin: 2.6, hold: 1, speed: 95, aim: 1 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 110, time: 1.6, width: 7, look: 1 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 3, spread: 24, interval: 0.35, speed: 110, lead: 0.5 } },
        ],
      },
      {
        at: 0.5,
        name: 'Guttering',
        move: { kind: 'float', params: { wobble: 1, freq: 0.6, drift: 0.8 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2, params: { windup: 0.35, range: 190, speed: 115, lead: 0.4, count: 2, spread: 12 } }],
        tint: '#4ad8a8',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'gloam-lantern', params: { windup: 0.3, count: 2, max: 2, dist: 30 } },
        patterns: [
          { kind: 'teleport', params: { fade: 0.5, appear: 0.28, min: 60, max: 110, count: 3, ring: 14, ringSpeed: 82, burst: 3, burstSpeed: 115 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 150, time: 2.2, speed: 85, reverse: 1 } },
          { kind: 'dropLine', params: { windup: 0.6, layout: 2, count: 6, spacing: 18, step: 0.1, air: 0.8, look: 0, creep: 1, creepLife: 3.5, splash: 8 } },
          { kind: 'beamSweep', params: { windup: 0.9, twin: 1, arc: 150, time: 2, width: 7, look: 1 } },
          { kind: 'halo', params: { windup: 0.5, count: 12, rings: 2, radius: 22, spin: -2.4, hold: 0.8, speed: 90, aim: 2 } },
        ],
      },
    ],
  },
];

export default bosses;
