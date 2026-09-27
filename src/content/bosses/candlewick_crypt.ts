/**
 * The Candlewick Crypt bosses (chapter 2, alt track — floors 3-4), boss pack A. Chapter 2 numbers:
 * 400-450 HP, THREE phases each, denser and faster than chapter 1, more adds.
 *
 *   Vesperwing  a great dusty moth. Drawn to the Flame: laps of the room (orbitDash), rings of sleepy
 *               dust that slow to a hover, swooping charges, dusk moths. Singed (55 %): her wings catch —
 *               a flare of embers, spiralling sparks, faster laps with fans, dripping cinders, swoops
 *               that burst, wing-beat gusts. Guttering (20 %): more moths, a reversing four-armed
 *               spiral, burning scales raining down, converging laps, triple offset rings.
 *   Wickwarden  a hunched warden of fused candles. Lit: hot wax puddles, lines of wax dripping from
 *               the ceiling toward you (lineStrike), ember rings, aimed fans. Melting (60 %): waxwraiths
 *               rise, a hot wax trail behind it, heavy slams, a four-armed spiral, five lines of drips,
 *               wax blobs that burst into sparks. Wick's End (25 %): a burst of rings, then denser rings,
 *               a five-armed reversing spiral, the ceiling's candles dripping everywhere, more blobs.
 */

import type { BossDef } from '../../sim/types';
import { VESPERWING_SPRITE, WICKWARDEN_SPRITE } from '../sprites/bossesACrypt';

const CH = ['candlewick_crypt'] as const;

const bosses: BossDef[] = [
  {
    id: 'vesperwing',
    name: 'Vesperwing',
    kind: 'boss',
    chapters: CH,
    hp: 400,
    size: 13,
    speed: 40,
    mass: 6,
    flying: true,
    sprite: VESPERWING_SPRITE,
    hook: 'bossesA.vesperwing',
    music: 'boss_floodgate',
    shot: 'dust',
    goo: ['#a898b8', '#e8dcc4', '#e8a040', '#fff8ea'],
    drops: 'bossSpill',
    title: 'SHE CIRCLED THE CANDLE ONE TIME TOO MANY',
    bestiary: 'The great moth of the crypt, drawn to every flame for a hundred years. Her wings are dusted with sleep.',
    phases: [
      {
        at: 1,
        name: 'Drawn to the Flame',
        move: { kind: 'float', params: { wobble: 1, freq: 0.6, drift: 0.8 } },
        attacks: [{ kind: 'spreadFan', cooldown: 3, params: { count: 3, spread: 30, speed: 80, windup: 0.45 } }],
        rest: [1, 1.4],
        patterns: [
          { kind: 'orbitDash', params: { windup: 0.6, radius: 72, spin: 150, time: 2.6, rate: 3, shots: 1, speed: 88 } },
          { kind: 'ring', params: { windup: 0.6, count: 14, speed: 66, accel: -16, life: 4.5, repeats: 2, gap: 0.45, alt: 1 } },
          { kind: 'charge', params: { windup: 0.7, speed: 220, count: 2, lead: 0.3, pause: 0.4, stun: 0.3 } },
          { kind: 'summon', enemy: 'dusk-moth', params: { windup: 0.5, count: 2, max: 3, dist: 30 } },
        ],
      },
      {
        at: 0.55,
        name: 'Singed',
        move: { kind: 'float', params: { wobble: 1.2, freq: 0.8, drift: 0.9 } },
        attacks: [{ kind: 'spreadFan', cooldown: 2.6, shot: 'ember', params: { count: 3, spread: 30, speed: 88, windup: 0.4 } }],
        speedMul: 1.25,
        tint: '#ff9a3a',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'ring', shot: 'ember', params: { windup: 0.2, count: 18, speed: 72 } },
        patterns: [
          { kind: 'spiral', shot: 'ember', params: { windup: 0.5, arms: 3, rate: 10, turn: 140, time: 2.4, speed: 70 } },
          { kind: 'orbitDash', shot: 'ember', params: { windup: 0.5, radius: 80, spin: 170, time: 3, rate: 4, shots: 3, spread: 24, speed: 80 } },
          { kind: 'hazard', shot: 'ember', params: { windup: 0.45, count: 5, radius: 10, life: 5, spread: 60 } },
          { kind: 'charge', shot: 'ember', params: { windup: 0.6, speed: 240, count: 3, lead: 0.35, pause: 0.3, stun: 0.3, ring: 8, ringSpeed: 72 } },
          { kind: 'wave', params: { windup: 0.6, waves: 2, gap: 0.9, hole: 3, speed: 62 } },
        ],
      },
      {
        at: 0.2,
        name: 'Guttering',
        move: { kind: 'float', params: { wobble: 1.4, freq: 1, drift: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 1.8, shot: 'ember', params: { count: 3, spread: 16, speed: 100, windup: 0.35 } }],
        speedMul: 1.4,
        tint: '#e04a2a',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1],
        enter: { kind: 'summon', enemy: 'dusk-moth', params: { windup: 0.3, count: 3, max: 4, dist: 30 } },
        patterns: [
          { kind: 'spiral', shot: 'ember', params: { windup: 0.45, arms: 4, rate: 11, turn: 160, reverse: 1, time: 2.8, speed: 72 } },
          { kind: 'debrisRain', shot: 'ember', params: { windup: 0.45, count: 12, time: 1.8, targeted: 4, air: 0.85, slam: 0, creep: 1 } },
          { kind: 'orbitDash', shot: 'ember', params: { windup: 0.45, radius: 84, spin: 190, time: 3.2, rate: 5, shots: 3, spread: 40, aim: 1, speed: 72 } },
          { kind: 'ring', shot: 'ember', params: { windup: 0.45, count: 20, speed: 78, repeats: 3, gap: 0.35, alt: 1 } },
        ],
      },
    ],
  },
  {
    id: 'wickwarden',
    name: 'Wickwarden',
    kind: 'boss',
    chapters: CH,
    hp: 450,
    size: 13,
    speed: 20,
    mass: 12,
    sprite: WICKWARDEN_SPRITE,
    hook: 'bossesA.wickwarden',
    music: 'boss_floodgate',
    shot: 'ember',
    goo: ['#f0e6cc', '#ffd04a', '#ff8a2a', '#c8a04a'],
    drops: 'bossSpill',
    title: 'KEEPER OF THE LAST LIT CANDLE',
    bestiary: 'Every candle ever lit for someone lost, melted into one stern warden. It will not let the crypt go dark.',
    phases: [
      {
        at: 1,
        name: 'Lit',
        move: { kind: 'chase' },
        attacks: [{ kind: 'aimedShot', cooldown: 2.8, params: { speed: 90, windup: 0.4 } }],
        rest: [1, 1.5],
        patterns: [
          { kind: 'hazard', shot: 'dust', params: { windup: 0.6, count: 4, radius: 11, life: 6, spread: 50 } },
          { kind: 'lineStrike', shot: 'dust', params: { windup: 0.6, lines: 2, fan: 40, count: 7, step: 18, interval: 0.1, air: 0.8, creep: 1 } },
          { kind: 'ring', params: { windup: 0.6, count: 12, speed: 70, repeats: 2, gap: 0.4, spin: 15 } },
          { kind: 'aimedBurst', params: { windup: 0.45, bursts: 3, shots: 3, spread: 24, interval: 0.35, speed: 100 } },
        ],
      },
      {
        at: 0.6,
        name: 'Melting',
        move: { kind: 'chase' },
        attacks: [
          { kind: 'leaveTrail', cooldown: 0.4, shot: 'dust', params: { radius: 7, life: 3.5, moving: 1 } },
          { kind: 'aimedShot', cooldown: 2.4, params: { speed: 100, windup: 0.35, count: 2, spread: 12 } },
        ],
        speedMul: 1.3,
        tint: '#6a8aff',
        pace: 1.15,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'summon', enemy: 'waxwraith', params: { windup: 0.3, count: 2, max: 3, dist: 30 } },
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.55, air: 0.85, height: 46, waves: 2, waveRadius: 84, ring: 10, ringSpeed: 72 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 8, turn: 120, time: 2.4, speed: 68 } },
          { kind: 'lineStrike', shot: 'dust', params: { windup: 0.5, lines: 5, fan: 24, count: 8, step: 17, interval: 0.08, creep: 1 } },
          { kind: 'clusterLob', params: { windup: 0.5, count: 3, volleys: 2, split: 6, spread: 48 } },
        ],
      },
      {
        at: 0.25,
        name: "Wick's End",
        move: { kind: 'chase' },
        attacks: [
          { kind: 'leaveTrail', cooldown: 0.35, shot: 'dust', params: { radius: 8, life: 4, moving: 1 } },
          { kind: 'aimedShot', cooldown: 2, params: { speed: 104, windup: 0.35, count: 3, spread: 18 } },
        ],
        speedMul: 1.5,
        tint: '#ff6a3a',
        pace: 1.3,
        order: 'random',
        rest: [0.7, 1.1],
        enter: { kind: 'ring', params: { windup: 0.3, count: 20, speed: 72, repeats: 2, gap: 0.3, alt: 1 } },
        patterns: [
          { kind: 'ring', params: { windup: 0.45, count: 18, speed: 76, repeats: 3, gap: 0.35, alt: 1 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 5, rate: 9, turn: 140, reverse: 1, time: 2.8, speed: 70 } },
          { kind: 'debrisRain', shot: 'dust', params: { windup: 0.5, count: 14, time: 2, targeted: 4, air: 0.9, creep: 1, slam: 1 } },
          { kind: 'clusterLob', params: { windup: 0.45, count: 4, volleys: 2, split: 8, spread: 56 } },
        ],
      },
    ],
  },
];

export default bosses;
