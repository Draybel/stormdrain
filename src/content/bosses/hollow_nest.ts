/**
 * Chapter 6 (alt) boss — The Hollow Nest, floor 11 (floor 12 belongs to the final, The Nestmother;
 * boss pack C, docs/content-bosses-c.md). Original design, the hardest regular fight on the alt track.
 *
 *   Ambergut  the queen's hungriest grub. Gorging: tunnels under the paper floor and erupts in a ring
 *             and a shockwave, spits sticky amber, fans of spit, Grublings. Pupating (60 %): it spins a
 *             paper cocoon and sits still while Papercut wasps circle and guard it — two-ring halos,
 *             a reversing spiral, lines of amber drips, stepped rings. Hatched (25 %): it bursts out as
 *             a scruffy young wasp and flies — leading stinger dives, a four-arm spiral, aimed bursts,
 *             an X of amber on you, Papercuts.
 * It wears a new sprite in each phase and takes wing in the last (content/hooks/bosses-c.ts).
 */

import type { BossDef } from '../../sim/types';
import { AMBERGUT_SPRITE } from '../sprites/bossesCNest';

const bosses: BossDef[] = [
  {
    id: 'ambergut',
    name: 'Ambergut',
    kind: 'boss',
    chapters: ['hollow_nest'],
    hp: 660,
    size: 14,
    speed: 22,
    mass: 10,
    sprite: AMBERGUT_SPRITE,
    music: 'boss_undercurrent',
    shot: 'ember',
    goo: ['#f4e8c8', '#f0a830', '#ffe08a', '#7a4a24'],
    drops: 'bossSpill',
    hook: 'bossesC.ambergut',
    title: "THE HIVE'S HUNGRIEST HEIR",
    bestiary: "Too big for its cell and too hungry to wait, the queen's greediest grub has eaten half the nest.",
    phases: [
      {
        at: 1,
        name: 'Gorging',
        move: { kind: 'wander', params: { pause: 0.6, dist: 36, walk: 1 } },
        attacks: [],
        rest: [1, 1.4],
        patterns: [
          { kind: 'burrow', params: { dig: 0.5, under: 1.3, speed: 105, rise: 0.7, ring: 14, ringSpeed: 78, waves: 1, waveRadius: 70 } },
          { kind: 'hazard', params: { windup: 0.5, count: 4, radius: 12, life: 6, spread: 50 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 5, spread: 36, interval: 0.4, speed: 100 } },
          { kind: 'summon', enemy: 'grubling', params: { windup: 0.5, count: 2, max: 3, dist: 22 } },
        ],
      },
      {
        at: 0.6,
        name: 'Pupating',
        move: { kind: 'idle' },
        attacks: [],
        tint: '#f0a830',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'shields', enemy: 'papercut', params: { windup: 0.3, count: 2, radius: 16, spin: 1.4 } },
        patterns: [
          { kind: 'halo', params: { windup: 0.5, count: 12, rings: 2, radius: 24, spin: 2, hold: 1, speed: 90, aim: 0 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 140, time: 2.4, speed: 85, reverse: 1 } },
          { kind: 'dropLine', params: { windup: 0.6, lines: 3, fan: 30, count: 6, spacing: 17, start: 6, step: 0.1, air: 0.8, look: 0, creep: 1, creepLife: 5 } },
          { kind: 'ring', params: { windup: 0.5, count: 16, speed: 80, repeats: 3, gap: 0.35, spin: 11 } },
        ],
      },
      {
        at: 0.25,
        name: 'Hatched',
        move: { kind: 'float', params: { wobble: 1.1, freq: 0.8, drift: 1 } },
        attacks: [],
        speedMul: 1.8,
        tint: '#ffcf57',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'summon', enemy: 'papercut', params: { windup: 0.3, count: 2, max: 3, dist: 30 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.6, speed: 250, maxTime: 1.2, count: 3, lead: 0.35, pause: 0.3, stun: 0.3, ring: 8, ringSpeed: 80 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 4, rate: 11, turn: 180, time: 2, speed: 90 } },
          { kind: 'aimedBurst', params: { windup: 0.35, bursts: 4, shots: 3, spread: 20, interval: 0.3, speed: 125, lead: 0.5 } },
          { kind: 'dropLine', params: { windup: 0.5, layout: 2, count: 6, spacing: 18, step: 0.08, air: 0.8, look: 0, creep: 1, creepLife: 4 } },
        ],
      },
    ],
  },
];

export default bosses;
