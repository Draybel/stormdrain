/**
 * Chapter 4 bosses — The Mushroom Hollow (main track, floors 7-8). Original designs (guide:
 * docs/content-bosses-b.md). One chapter deeper than the Works: 620-640 HP, spore volleys that linger,
 * three phases for the matriarch, more adds. Each changes its look with its phase (hook
 * 'bossesB.<id>', content/hooks/bosses-b.ts).
 *
 *   Grandmother Gill  an ancient toadstool in spectacles. Dozing: rings of spores that drift to a stop,
 *                     spore pods that burst where they land (sticky puddles), grandchildren (Puffcaps),
 *                     a wide sneeze. Sporulating (66 %): Puffcaps orbit her as a shield (each bursts into
 *                     spores when popped), a spore swirl, a cloud closing in on you, walls of spores.
 *                     Overripe (30 %): more Puffcaps, a five-arm reversing swirl, pods all over the room,
 *                     stepped rings, sticky puddles round herself, fresh shields.
 *   Bramblehorn       a mossy rhinoceros beetle with a garden on its back. Rooting: double charges that
 *                     shake mushrooms loose, digging under the moss to erupt beneath you, spore fans, a
 *                     wing-hop slam. Taking Wing (half health): Mossback Beetles, triple charges with a
 *                     ring on each bonk, triple flying slams, a mushroom rain, double digs, leading fans.
 */

import type { BossDef } from '../../sim/types';
import { BRAMBLEHORN_SPRITE, GRANDMOTHER_GILL_SPRITE } from '../sprites/bossesBHollow';

const CH = ['mushroom_hollow'] as const;

const bosses: BossDef[] = [
  {
    id: 'grandmother-gill',
    name: 'Grandmother Gill',
    kind: 'boss',
    chapters: CH,
    hp: 580,
    size: 14,
    speed: 14,
    mass: 12,
    sprite: GRANDMOTHER_GILL_SPRITE,
    hook: 'bossesB.grandmother-gill',
    shot: 'muck',
    goo: ['#8a3a6e', '#e8dcc0', '#7fe0d8', '#3f7a4a'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'THE OLDEST THING IN THE HOLLOW WANTS A NAP',
    bestiary: 'Every mushroom in the Hollow is one of her grandchildren. Wake her and she sneezes the family at you.',
    phases: [
      {
        at: 1,
        name: 'Dozing',
        move: { kind: 'wander', params: { pause: 1.2, dist: 28, walk: 0.8 } },
        attacks: [],
        rest: [1.2, 1.8],
        patterns: [
          { kind: 'ring', params: { windup: 0.7, count: 16, speed: 90, accel: -40, life: 3, repeats: 2, gap: 0.6, spin: 11, alt: 1 } },
          { kind: 'podBurst', params: { windup: 0.6, count: 3, split: 6, air: 1.1, spread: 56, creep: 1, radius: 11, life: 5, stagger: 0.2 } },
          { kind: 'summon', enemy: 'puffcap', params: { windup: 0.6, count: 2, max: 3 } },
          { kind: 'aimedBurst', params: { windup: 0.5, bursts: 2, shots: 5, spread: 50, interval: 0.5, speed: 100 } },
        ],
      },
      {
        at: 0.66,
        name: 'Sporulating',
        move: { kind: 'wander', params: { pause: 1, dist: 32, walk: 0.9 } },
        attacks: [],
        tint: '#7fe0d8',
        pace: 1.15,
        rest: [1, 1.5],
        enter: { kind: 'shields', enemy: 'puffcap', params: { windup: 0.4, count: 4, radius: 16, spin: 1.3 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.6, arms: 3, rate: 8, turn: 110, time: 2.6, speed: 70, accel: -12 } },
          { kind: 'closingRing', params: { windup: 0.6, count: 18, radius: 70, hole: 3, speed: 12, accel: 100, repeats: 2, gap: 1.1 } },
          { kind: 'podBurst', params: { windup: 0.55, count: 5, split: 7, air: 1.1, spread: 60, creep: 1, radius: 10, life: 5, stagger: 0.15 } },
          { kind: 'wave', params: { windup: 0.6, waves: 2, gap: 1, spacing: 13, hole: 3, speed: 62 } },
        ],
      },
      {
        at: 0.3,
        name: 'Overripe',
        move: { kind: 'wander', params: { pause: 0.8, dist: 36, walk: 1 } },
        attacks: [],
        speedMul: 1.2,
        tint: '#c07a4a',
        pace: 1.3,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'puffcap', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 5, rate: 9, turn: 140, time: 2.6, speed: 72, reverse: 1 } },
          { kind: 'podBurst', params: { windup: 0.5, count: 7, where: 2, split: 8, air: 1.1, creep: 1, radius: 10, life: 5, stagger: 0.1 } },
          { kind: 'ring', params: { windup: 0.5, count: 20, speed: 85, repeats: 4, gap: 0.35, spin: 9, alt: 1 } },
          { kind: 'hazard', params: { windup: 0.5, count: 6, self: 1, radius: 12, life: 6, spread: 60 } },
          { kind: 'shields', enemy: 'puffcap', weight: 0.6, params: { windup: 0.4, count: 4, radius: 16, spin: -1.5 } },
        ],
      },
    ],
  },
  {
    id: 'bramblehorn',
    name: 'Bramblehorn',
    kind: 'boss',
    chapters: CH,
    hp: 600,
    size: 14,
    speed: 34,
    mass: 11,
    contact: 2,
    sprite: BRAMBLEHORN_SPRITE,
    hook: 'bossesB.bramblehorn',
    shot: 'muck',
    goo: ['#2c4a3a', '#66b86a', '#c05a96', '#6a5238'],
    drops: 'bossSpill',
    music: 'boss_pressure',
    title: 'A WHOLE GARDEN, CHARGING HORN FIRST',
    bestiary: 'A beetle so old a garden grew on its back. It still charges anything that tramples its mushrooms.',
    phases: [
      {
        at: 1,
        name: 'Rooting',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 3, params: { speed: 100, windup: 0.45, count: 3, spread: 18, range: 170 } }],
        rest: [1, 1.5],
        patterns: [
          { kind: 'charge', params: { windup: 0.75, speed: 240, count: 2, pause: 0.45, stun: 0.8, maxTime: 1.4, debris: 5 } },
          { kind: 'burrow', params: { dig: 0.5, under: 1.4, speed: 105, rise: 0.7, ring: 12, ringSpeed: 78, waves: 1, waveRadius: 70 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 4, spread: 36, interval: 0.4, speed: 105 } },
          { kind: 'jumpSlam', params: { windup: 0.55, air: 0.9, height: 50, waves: 1, waveRadius: 80, ring: 10, ringSpeed: 72 } },
        ],
      },
      {
        at: 0.5,
        name: 'Taking Wing',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 2.4, params: { speed: 110, windup: 0.4, count: 3, spread: 16, range: 180 } }],
        speedMul: 1.35,
        tint: '#8aff9a',
        pace: 1.25,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'summon', enemy: 'mossback-beetle', params: { windup: 0.3, count: 2, max: 2 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.6, speed: 270, count: 3, pause: 0.35, stun: 0.5, maxTime: 1.3, ring: 12, ringSpeed: 82, debris: 4 } },
          { kind: 'jumpSlam', params: { windup: 0.45, air: 0.7, height: 56, count: 3, waves: 1, waveRadius: 84, ring: 12, ringSpeed: 80 } },
          { kind: 'debrisRain', params: { windup: 0.6, count: 12, time: 1.5, targeted: 3, air: 0.95, slam: 1 } },
          { kind: 'burrow', params: { dig: 0.45, under: 1.2, speed: 115, rise: 0.6, count: 2, ring: 14, ringSpeed: 80, waves: 1, waveRadius: 74 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 4, shots: 5, spread: 44, interval: 0.32, speed: 112, lead: 0.4 } },
        ],
      },
    ],
  },
];

export default bosses;
