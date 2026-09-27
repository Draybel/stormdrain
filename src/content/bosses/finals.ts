/**
 * The three final bosses (DESIGN "Final bosses & endings") — placeholder-but-playable versions that
 * make the endings flow work; the full fights replace them later (keep the ids and `final` keys).
 *
 *   Old Thunderhead  floor 12, main track   ending 1 "Clear Skies"
 *   The Nestmother   floor 12, alt track    ending 2 "The Quiet Hive"
 *   The Undertow     floor 13 (whirlpool)   ending 3 "What the Rain Kept"
 */

import type { BossDef } from '../../sim/types';
import { NESTMOTHER_SPRITE, THUNDERHEAD_SPRITE, UNDERTOW_SPRITE } from '../sprites/bosses';

const bosses: BossDef[] = [
  {
    id: 'old-thunderhead',
    name: 'Old Thunderhead',
    kind: 'final',
    final: 'thunderhead',
    ending: 1,
    chapters: ['eye_of_storm'],
    hp: 700,
    size: 18,
    speed: 34,
    contact: 2,
    flying: true,
    sprite: THUNDERHEAD_SPRITE,
    music: 'final_thunderhead',
    shot: 'water',
    goo: ['#9aa3bb', '#c4cbdc', '#ffe36a', '#565d74'],
    title: 'THE STORM THAT WOULD NOT STOP',
    bestiary: 'A grumpy old storm cloud that has rained on the town for forty days. It does not want to stop.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 0.8, freq: 0.4, drift: 0.6 } },
        attacks: [],
        rest: [0.9, 1.3],
        patterns: [
          { kind: 'ring', params: { windup: 0.6, count: 16, speed: 80, repeats: 2, gap: 0.5, spin: 11 } },
          { kind: 'debrisRain', params: { windup: 0.5, bolt: 1, count: 7, targeted: 3, air: 0.8, time: 1.2, slam: 0, splash: 10 } },
          { kind: 'beamSweep', params: { windup: 0.9, look: 1, arc: 110, time: 1.5, width: 7 } },
        ],
      },
      {
        at: 0.55,
        name: 'Gathering',
        move: { kind: 'float', params: { wobble: 1, freq: 0.5, drift: 0.7 } },
        attacks: [],
        tint: '#6a6ad8',
        pace: 1.1,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'summon', enemy: 'sogwing', params: { windup: 0.3, count: 2, max: 3 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 9, turn: 130, time: 2.4, speed: 75, reverse: 1 } },
          { kind: 'beamSweep', params: { windup: 0.9, twin: 1, look: 1, arc: 160, time: 2, width: 7 } },
          { kind: 'debrisRain', params: { windup: 0.4, bolt: 1, count: 10, targeted: 4, air: 0.75, time: 1.4, slam: 0 } },
          { kind: 'wave', params: { windup: 0.6, waves: 2, hole: 3, speed: 62 } },
        ],
      },
      {
        at: 0.2,
        name: 'The Last Downpour',
        move: { kind: 'float', params: { wobble: 1.2, freq: 0.7, drift: 0.8 } },
        attacks: [],
        tint: '#e8d24a',
        pace: 1.25,
        order: 'random',
        rest: [0.7, 1.1],
        patterns: [
          { kind: 'debrisRain', params: { windup: 0.4, bolt: 1, count: 14, targeted: 5, air: 0.7, time: 2.2, slam: 0 } },
          { kind: 'ring', params: { windup: 0.5, count: 20, speed: 85, repeats: 3, gap: 0.35, spin: 9 } },
          { kind: 'beamSweep', params: { windup: 0.8, twin: 1, look: 1, arc: 200, time: 2.2, width: 7 } },
        ],
      },
    ],
  },
  {
    id: 'nestmother',
    name: 'The Nestmother',
    kind: 'final',
    final: 'nestmother',
    ending: 2,
    chapters: ['hollow_nest'],
    hp: 700,
    size: 16,
    speed: 42,
    contact: 2,
    flying: true,
    sprite: NESTMOTHER_SPRITE,
    music: 'final_nestmother',
    shot: 'ember',
    goo: ['#d8902c', '#f2c055', '#2a1c14', '#e8e4d8'],
    title: 'QUEEN OF THE PAPER HIVE',
    bestiary: 'The paper-wasp queen who built her hive out of every lost letter the storm carried down.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 1, freq: 0.6, drift: 0.8 } },
        attacks: [],
        rest: [1, 1.5],
        patterns: [
          { kind: 'summon', enemy: 'nest-drone', params: { windup: 0.5, count: 2, max: 4 } },
          { kind: 'charge', params: { windup: 0.7, speed: 240, count: 2, lead: 0.3, stun: 0.3 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 3, spread: 24, speed: 110 } },
        ],
      },
      {
        at: 0.5,
        name: 'Swarming',
        move: { kind: 'float', params: { wobble: 1.2, freq: 0.8, drift: 0.9 } },
        attacks: [],
        tint: '#e05a3a',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'summon', enemy: 'nest-drone', params: { windup: 0.3, count: 3, max: 5 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 160, time: 2 } },
          { kind: 'charge', params: { windup: 0.6, speed: 260, count: 3, lead: 0.4, stun: 0.3 } },
          { kind: 'hazard', params: { windup: 0.4, count: 4, radius: 11, life: 6, spread: 50 } },
          { kind: 'ring', params: { windup: 0.5, count: 12, speed: 80, repeats: 2, gap: 0.4, alt: 1 } },
        ],
      },
    ],
  },
  {
    id: 'undertow',
    name: 'The Undertow',
    kind: 'final',
    final: 'undertow',
    ending: 3,
    chapters: ['eye_of_storm'],
    hp: 900,
    size: 18,
    speed: 20,
    contact: 2,
    flying: true,
    sprite: UNDERTOW_SPRITE,
    music: 'final_undertow',
    shot: 'water',
    goo: ['#5a95c8', '#a8d4f0', '#1c3d66', '#f4f0e0'],
    title: 'THE BOTTOM OF EVERY DRAIN',
    bestiary: 'The living whirlpool at the bottom of every drain. Everything the rain took ends up here.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 0.5, freq: 0.3, drift: 0.4 } },
        attacks: [],
        rest: [1, 1.4],
        enter: { kind: 'shields', params: { windup: 0.2, count: 4, radius: 16, spin: 1.3 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.6, arms: 5, rate: 8, turn: 90, time: 2.6, speed: 70, curve: 0.8 } },
          { kind: 'teleport', params: { fade: 0.6, appear: 0.35, ring: 12, count: 2 } },
          { kind: 'wave', params: { windup: 0.6, waves: 3, hole: 3, speed: 55 } },
        ],
      },
      {
        at: 0.6,
        name: 'Churning',
        move: { kind: 'float', params: { wobble: 0.7, freq: 0.4, drift: 0.5 } },
        attacks: [],
        tint: '#1a6ab8',
        pace: 1.1,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'shields', params: { windup: 0.2, count: 5, radius: 18, spin: -1.8 } },
        patterns: [
          { kind: 'beamSweep', params: { windup: 0.9, twin: 1, arc: 180, time: 2.2, width: 8, look: 0 } },
          { kind: 'ring', params: { windup: 0.5, count: 18, speed: 75, repeats: 3, gap: 0.4, spin: 10, curve: 0.6 } },
          { kind: 'hazard', params: { windup: 0.4, count: 5, radius: 12, life: 8, spread: 60 } },
          { kind: 'teleport', params: { fade: 0.5, appear: 0.3, ring: 10, burst: 3, count: 2 } },
        ],
      },
      {
        at: 0.25,
        name: 'What the Rain Kept',
        move: { kind: 'float', params: { wobble: 0.9, freq: 0.5, drift: 0.6 } },
        attacks: [],
        tint: '#e04a6a',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 6, rate: 10, turn: 150, reverse: 1, time: 3, speed: 72 } },
          { kind: 'beamSweep', params: { windup: 0.8, twin: 1, arc: 240, time: 2.4, width: 8 } },
          { kind: 'debrisRain', params: { windup: 0.5, count: 12, time: 1.8, targeted: 4, air: 0.9, slam: 0, creep: 1 } },
        ],
      },
    ],
  },
];

export default bosses;
