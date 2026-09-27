/**
 * Chapter 5 (alt) bosses — The Frostbitten Vault (floors 9-10; boss pack C, docs/content-bosses-c.md).
 * Original designs, tuned like the Bone Orchard's (the same floors).
 *
 *   Hoarquill       a frost hedgehog wearing the vault's coins on its icicle quills. Bristling: curls
 *                   up and ricochets round the room (quills burst at every bounce), a bristling halo
 *                   of quills, wide quill fans, rings that speed up. Shedding (half): slush puddles,
 *                   longer and homing-ish rolls, a four-arm spiral, halos that converge, Slushpups,
 *                   icicles shaken down from the ceiling.
 *   The Vaultwarden an empty suit of frozen armour with a key for a sword. On Duty: shield bashes,
 *                   key slams that raise lines of ice, walls of frost with a gap, a frost beam.
 *                   Cracked Plate (half): Rime Wraiths answer the call, triple bashes with falling
 *                   ice, a cross of ice on you, a halo flung as one ring, twin beams.
 * Each wears a second sprite in its later phase (content/hooks/bosses-c.ts).
 */

import type { BossDef } from '../../sim/types';
import { HOARQUILL_SPRITE, VAULTWARDEN_SPRITE } from '../sprites/bossesCVault';

const CH = ['frostbitten_vault'] as const;

const bosses: BossDef[] = [
  {
    id: 'hoarquill',
    name: 'Hoarquill',
    kind: 'boss',
    chapters: CH,
    hp: 520,
    size: 14,
    speed: 26,
    mass: 9,
    sprite: HOARQUILL_SPRITE,
    music: 'boss_undercurrent',
    shot: 'ice',
    goo: ['#8fbcd8', '#effcff', '#ffd35a', '#5a88a8'],
    drops: 'bossSpill',
    hook: 'bossesC.hoarquill',
    title: 'IT ROLLED IN THE HOARD AND KEPT WHAT STUCK',
    bestiary: "A hedgehog as big as a snowdrift. It rolled through the vault's treasure and kept every coin that stuck.",
    phases: [
      {
        at: 1,
        name: 'Bristling',
        move: { kind: 'chase' },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'ricochet', params: { windup: 0.8, speed: 185, bounces: 3, ring: 6, ringSpeed: 75, stun: 0.7 } },
          { kind: 'halo', params: { windup: 0.5, count: 14, radius: 24, spin: 1.8, hold: 0.8, speed: 90, aim: 0 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 5, spread: 40, interval: 0.4, speed: 105 } },
          { kind: 'ring', params: { windup: 0.6, count: 16, speed: 55, accel: 55, repeats: 2, gap: 0.5, alt: 1 } },
        ],
      },
      {
        at: 0.5,
        name: 'Shedding',
        move: { kind: 'chase' },
        attacks: [],
        speedMul: 1.25,
        tint: '#7ab8ff',
        pace: 1.2,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'hazard', params: { windup: 0.2, count: 5, self: 1, radius: 11, life: 7, spread: 50 } },
        patterns: [
          { kind: 'ricochet', params: { windup: 0.7, speed: 215, bounces: 5, ring: 8, ringSpeed: 78, home: 0.25, stun: 0.5 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 9, turn: 130, time: 2.2, speed: 80 } },
          { kind: 'halo', params: { windup: 0.5, count: 12, rings: 2, radius: 24, spin: -2.2, hold: 0.9, speed: 85, aim: 1 } },
          { kind: 'summon', enemy: 'slushpup', weight: 0.7, params: { windup: 0.4, count: 2, max: 2, dist: 24 } },
          { kind: 'debrisRain', params: { windup: 0.5, count: 10, time: 1.4, targeted: 3, air: 0.95, slam: 1 } },
        ],
      },
    ],
  },
  {
    id: 'vaultwarden',
    name: 'The Vaultwarden',
    kind: 'boss',
    chapters: CH,
    hp: 560,
    size: 12,
    speed: 22,
    mass: 11,
    sprite: VAULTWARDEN_SPRITE,
    music: 'boss_undercurrent',
    shot: 'ice',
    goo: ['#6a7a9a', '#e4f8ff', '#d8b050', '#8ff0ff'],
    drops: 'bossSpill',
    hook: 'bossesC.vaultwarden',
    title: 'IT STILL GUARDS A DOOR NOBODY REMEMBERS',
    bestiary: 'An empty suit of armour frozen at its post. Its key opens nothing any more, but it swings it like it means it.',
    phases: [
      {
        at: 1,
        name: 'On Duty',
        move: { kind: 'chasePath', params: { recalc: 10 } },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'charge', params: { windup: 0.8, speed: 200, maxTime: 1.4, count: 2, pause: 0.4, stun: 0.6, ring: 10, ringSpeed: 75 } },
          { kind: 'dropLine', params: { windup: 0.7, lines: 3, fan: 26, count: 7, spacing: 16, start: 4, step: 0.08, air: 0.8, look: 1, splash: 9 } },
          { kind: 'wave', params: { windup: 0.6, waves: 3, gap: 0.8, spacing: 13, hole: 3, speed: 70 } },
          { kind: 'beamSweep', params: { windup: 0.9, arc: 120, time: 1.7, width: 8, look: 0 } },
        ],
      },
      {
        at: 0.5,
        name: 'Cracked Plate',
        move: { kind: 'chasePath', params: { recalc: 8 } },
        attacks: [],
        speedMul: 1.2,
        tint: '#9ae0ff',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'rime-wraith', params: { windup: 0.3, count: 2, max: 2, dist: 30 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.7, speed: 215, maxTime: 1.3, count: 3, pause: 0.35, stun: 0.5, ring: 12, ringSpeed: 78, debris: 4 } },
          { kind: 'dropLine', params: { windup: 0.6, layout: 1, count: 7, spacing: 16, step: 0.07, air: 0.8, look: 1, splash: 9 } },
          { kind: 'halo', params: { windup: 0.5, count: 12, radius: 24, spin: -2.4, hold: 0.9, speed: 95, aim: 2 } },
          { kind: 'wave', params: { windup: 0.5, waves: 4, gap: 0.7, spacing: 13, hole: 3, speed: 78 } },
          { kind: 'beamSweep', params: { windup: 0.85, twin: 1, arc: 160, time: 2, width: 8, look: 0 } },
        ],
      },
    ],
  },
];

export default bosses;
