/**
 * The Rootcellar bosses (chapter 2, main track — floors 3-4), boss pack A. A chapter deeper than the
 * Gutterways, so: 420-440 HP, THREE phases each, denser rings, faster phases, more adds.
 *
 *   Grandmother Brine  an old pickle steeping in a crock. Steeping: brine puddles, pickled onions that
 *                      burst into rings where they land (clusterLob), stepped rings, gherklings. Fermenting
 *                      (60 %): the crock cracks and spills, a sweeping jet of brine, double onion volleys,
 *                      a vinegar spiral, crock hops. Sour (25 %): she calls a brine jar, twin brine jets,
 *                      onions that leave puddles, triple offset rings, jars dropping off the shelves.
 *   Old Knotroot       a wailing mandrake in the cellar floor. Buried: roots burst up in three lines
 *                      toward you (lineStrike), it tunnels and erupts, wails in offset rings, creeping
 *                      taproots. Uprooted (60 %): it tears loose (a shower of clods) and chases — charges,
 *                      double root volleys, double tunnels, a four-armed spiral. Wailing (30 %): a
 *                      scream of rings, roots in every direction, a reversing spiral, lunging charges.
 */

import type { BossDef } from '../../sim/types';
import { GRANDMOTHER_BRINE_SPRITE, KNOTROOT_SPRITE } from '../sprites/bossesARoot';

const CH = ['rootcellar'] as const;

const bosses: BossDef[] = [
  {
    id: 'grandmother-brine',
    name: 'Grandmother Brine',
    kind: 'boss',
    chapters: CH,
    hp: 420,
    size: 13,
    speed: 18,
    mass: 10,
    sprite: GRANDMOTHER_BRINE_SPRITE,
    hook: 'bossesA.brine',
    music: 'boss_floodgate',
    shot: 'muck',
    goo: ['#6a9a3a', '#a2cc58', '#e8dcc0', '#c49a6a'],
    drops: 'bossSpill',
    title: 'SHE HAS BEEN STEEPING SINCE BEFORE THE STORM',
    bestiary: 'The oldest pickle in the cellar, sharp as vinegar behind her spectacles. Stay out of her brine.',
    phases: [
      {
        at: 1,
        name: 'Steeping',
        move: { kind: 'wander', params: { pause: 0.8, dist: 36, walk: 0.8 } },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'hazard', params: { windup: 0.6, count: 5, radius: 12, life: 6, spread: 56 } },
          { kind: 'clusterLob', params: { windup: 0.6, count: 3, split: 6, spread: 44, air: 0.95 } },
          { kind: 'ring', params: { windup: 0.6, count: 14, speed: 70, repeats: 2, gap: 0.4, spin: 12 } },
          { kind: 'summon', enemy: 'gherkling', params: { windup: 0.5, count: 2, max: 4, dist: 26 } },
        ],
      },
      {
        at: 0.6,
        name: 'Fermenting',
        move: { kind: 'wander', params: { pause: 0.5, dist: 44, walk: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.4, params: { speed: 95, windup: 0.4, count: 3, spread: 18 } }],
        tint: '#9ad04a',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'hazard', params: { windup: 0.2, count: 6, self: 1, radius: 12, life: 7, spread: 50 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, arc: 140, time: 1.8, width: 8, look: 0 } },
          { kind: 'clusterLob', params: { windup: 0.5, count: 3, volleys: 2, gap: 0.6, split: 7, spread: 50 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 9, turn: 130, time: 2.4, speed: 70 } },
          { kind: 'jumpSlam', params: { windup: 0.55, air: 0.85, height: 44, waves: 2, waveRadius: 84, ring: 10, ringSpeed: 72 } },
          { kind: 'summon', enemy: 'gherkling', weight: 0.7, params: { windup: 0.4, count: 3, max: 5, dist: 26 } },
        ],
      },
      {
        at: 0.25,
        name: 'Sour',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 2, params: { speed: 100, windup: 0.35, count: 3, spread: 20 } }],
        speedMul: 1.4,
        tint: '#d8e040',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'summon', enemy: 'brine-jar', params: { windup: 0.3, count: 1, max: 2, dist: 30 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.8, twin: 1, arc: 180, time: 2.2, width: 8, look: 0 } },
          { kind: 'clusterLob', params: { windup: 0.45, count: 4, volleys: 2, gap: 0.5, split: 8, spread: 56, creep: 1, life: 4 } },
          { kind: 'ring', params: { windup: 0.45, count: 18, speed: 75, repeats: 3, gap: 0.35, alt: 1 } },
          { kind: 'debrisRain', params: { windup: 0.5, count: 12, time: 1.8, targeted: 3, air: 0.9, creep: 1, slam: 1 } },
        ],
      },
    ],
  },
  {
    id: 'old-knotroot',
    name: 'Old Knotroot',
    kind: 'boss',
    chapters: CH,
    hp: 440,
    size: 13,
    speed: 24,
    mass: 12,
    sprite: KNOTROOT_SPRITE,
    hook: 'bossesA.knotroot',
    music: 'boss_floodgate',
    shot: 'dust',
    goo: ['#d8c08a', '#6e4e32', '#5a8a3a', '#8ac8f0'],
    drops: 'bossSpill',
    title: 'IT SCREAMS WHEN YOU PULL IT UP',
    bestiary: 'A mandrake that took root in the cellar floor and grew old, knotted and very, very sad. Do not pull it up.',
    phases: [
      {
        at: 1,
        name: 'Buried',
        move: { kind: 'idle' },
        attacks: [{ kind: 'ringN', cooldown: 3, params: { count: 8, speed: 60, windup: 0.5 } }],
        rest: [0.9, 1.4],
        patterns: [
          { kind: 'lineStrike', params: { windup: 0.6, lines: 3, fan: 28, count: 8, step: 17, interval: 0.08, air: 0.75, splash: 9 } },
          { kind: 'burrow', params: { dig: 0.55, under: 1.4, speed: 95, rise: 0.7, ring: 10, ringSpeed: 70, waves: 1, waveRadius: 70 } },
          { kind: 'ring', params: { windup: 0.7, count: 16, speed: 62, repeats: 2, gap: 0.45, alt: 1 } },
          { kind: 'summon', enemy: 'creeping-taproot', params: { windup: 0.5, count: 1, max: 2, dist: 30 } },
        ],
      },
      {
        at: 0.6,
        name: 'Uprooted',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 2.2, params: { speed: 95, windup: 0.4, count: 3, spread: 20 } }],
        speedMul: 1.5,
        tint: '#c86a3a',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'debrisRain', params: { windup: 0.3, count: 8, time: 1, targeted: 2, air: 0.9, slam: 1 } },
        patterns: [
          { kind: 'charge', params: { windup: 0.65, speed: 210, count: 2, pause: 0.4, stun: 0.6, maxTime: 1.4, debris: 3, ring: 8, ringSpeed: 70 } },
          { kind: 'lineStrike', params: { windup: 0.5, lines: 3, fan: 35, count: 9, step: 16, interval: 0.07, repeats: 2, gap: 0.45 } },
          { kind: 'burrow', params: { dig: 0.45, under: 1.2, speed: 110, rise: 0.6, count: 2, ring: 12, ringSpeed: 76, waves: 1, waveRadius: 72 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 8, turn: 120, time: 2.2, speed: 66 } },
        ],
      },
      {
        at: 0.3,
        name: 'Wailing',
        move: { kind: 'chasePath' },
        attacks: [{ kind: 'ringN', cooldown: 2.4, params: { count: 10, speed: 66, windup: 0.4 } }],
        speedMul: 1.7,
        tint: '#ff5a3a',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'ring', params: { windup: 0.3, count: 20, speed: 70, repeats: 3, gap: 0.3, alt: 1 } },
        patterns: [
          { kind: 'lineStrike', params: { windup: 0.45, lines: 6, around: 1, count: 8, step: 16, interval: 0.07, repeats: 2, gap: 0.5 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 4, rate: 10, turn: 150, reverse: 1, time: 2.6, speed: 70 } },
          { kind: 'charge', params: { windup: 0.55, speed: 230, count: 3, lead: 0.3, pause: 0.3, stun: 0.4, ring: 10, ringSpeed: 72 } },
          { kind: 'summon', enemy: 'grumblemole', weight: 0.6, params: { windup: 0.4, count: 1, max: 2, dist: 30 } },
        ],
      },
    ],
  },
];

export default bosses;
