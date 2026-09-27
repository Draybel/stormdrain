/**
 * Minibosses of boss pack C (docs/content-bosses-c.md) — chapters 5-6, main and alt, plus one listing
 * each for the Rust Foundry and the Glimmer Grotto. Original designs. The FIRST chapter listed is the
 * home one: HP scales up deeper (bossHpFor) and the boss hook adds 6 % pace per chapter deeper.
 *
 *   Tatterjack  (Bone Orchard, Eye of the Storm)  a scarecrow hopping after you on its pole. Hops send
 *               a shockwave; big stomps, straw fans, a crow. Unstuffed: double stomps, a spinning
 *               straw spiral, straw halos that converge, two crows.
 *   Shiverwing  (Glimmer Grotto, Frostbitten Vault)  a frost bat with crystal wings. A screech you step
 *               over, swoops, screech rings that speed up, Echo Bats. Shattering: a crystal halo,
 *               falling crystal shards, triple swoops, stepped rings.
 *   Slagjacket  (Rust Foundry, Hollow Nest)  an iron-and-slag yellowjacket. Stinger dives, slag drips,
 *               spark bursts. Overheated: triple dives with sparks, a three-arm spiral, a line of
 *               burning slag toward you, more drips.
 * Each wears a second sprite in its later phase (content/hooks/bosses-c.ts).
 */

import type { BossDef } from '../../sim/types';
import { TATTERJACK_SPRITE } from '../sprites/bossesCOrchard';
import { SLAGJACKET_SPRITE } from '../sprites/bossesCNest';
import { SHIVERWING_SPRITE } from '../sprites/bossesCVault';

const bosses: BossDef[] = [
  {
    id: 'tatterjack',
    name: 'Tatterjack',
    kind: 'miniboss',
    chapters: ['bone_orchard', 'eye_of_storm'],
    hp: 210,
    size: 9,
    speed: 30,
    mass: 4,
    sprite: TATTERJACK_SPRITE,
    music: 'miniboss',
    shot: 'dust',
    goo: ['#c8a878', '#e8c860', '#6a4a3a', '#3c3c5e'],
    hook: 'bossesC.tatterjack',
    title: "THE FIELD'S LAST GUARD, STILL ON ITS POLE",
    bestiary: 'A scarecrow tired of standing still. It hops after you on its pole, flinging straw and whistling up crows.',
    phases: [
      {
        at: 1,
        move: { kind: 'hop', params: { rest: 0.7, crouch: 0.3, air: 0.55, dist: 40, height: 18, aim: 0.7 } },
        attacks: [{ kind: 'landShockwave', cooldown: 0.3, params: { on: 1, radius: 34, speed: 105, band: 4 } }],
        rest: [0.9, 1.3],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.5, air: 0.8, height: 44, waves: 1, waveRadius: 70, ring: 8, ringSpeed: 75 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 2, shots: 5, spread: 44, interval: 0.4, speed: 100 } },
          { kind: 'summon', enemy: 'gravecaw', params: { windup: 0.4, count: 1, max: 2, dist: 18 } },
        ],
      },
      {
        at: 0.5,
        name: 'Unstuffed',
        move: { kind: 'hop', params: { rest: 0.5, crouch: 0.25, air: 0.5, dist: 46, height: 20, aim: 0.8 } },
        attacks: [{ kind: 'landShockwave', cooldown: 0.3, params: { on: 1, radius: 46, speed: 115, band: 4 } }],
        tint: '#e8c860',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        patterns: [
          { kind: 'jumpSlam', params: { windup: 0.45, air: 0.75, height: 44, count: 2, waves: 1, waveRadius: 75, ring: 10, ringSpeed: 80 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 2, rate: 10, turn: 220, time: 1.8, speed: 85 } },
          { kind: 'halo', params: { windup: 0.4, count: 10, radius: 20, spin: 3, hold: 0.7, speed: 95, aim: 1 } },
          { kind: 'summon', enemy: 'gravecaw', weight: 0.6, params: { windup: 0.4, count: 2, max: 2, dist: 18 } },
        ],
      },
    ],
  },
  {
    id: 'shiverwing',
    name: 'Shiverwing',
    kind: 'miniboss',
    chapters: ['glimmer_grotto', 'frostbitten_vault'],
    hp: 200,
    size: 9,
    speed: 42,
    mass: 3,
    flying: true,
    sprite: SHIVERWING_SPRITE,
    music: 'miniboss',
    shot: 'ice',
    goo: ['#4a4a7a', '#b8f6ff', '#6fd8f0', '#ff6ad8'],
    hook: 'bossesC.shiverwing',
    title: 'SOMETHING HANGS FROM THE CEILING, LISTENING',
    bestiary: 'An old frost bat grown huge in the dark. Crystals grow along its wings, and its screech rolls out in rings.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 1.2, freq: 0.9, drift: 1 } },
        attacks: [{ kind: 'landShockwave', cooldown: 4, params: { on: 0, windup: 0.6, range: 90, radius: 64, speed: 110, band: 4 } }],
        rest: [0.7, 1.1],
        patterns: [
          { kind: 'charge', params: { windup: 0.6, speed: 230, maxTime: 1.1, count: 2, lead: 0.3, pause: 0.3, stun: 0.2 } },
          { kind: 'ring', params: { windup: 0.5, count: 14, speed: 60, accel: 45, repeats: 2, gap: 0.45, alt: 1 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 2, shots: 3, spread: 24, interval: 0.35, speed: 115 } },
          { kind: 'summon', enemy: 'echo-bat', params: { windup: 0.4, count: 2, max: 2, dist: 24 } },
        ],
      },
      {
        at: 0.5,
        name: 'Shattering',
        move: { kind: 'float', params: { wobble: 1.4, freq: 1, drift: 1 } },
        attacks: [{ kind: 'landShockwave', cooldown: 3.4, params: { on: 0, windup: 0.5, range: 100, radius: 70, speed: 115, band: 4 } }],
        tint: '#ff6ad8',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        patterns: [
          { kind: 'halo', params: { windup: 0.45, count: 10, radius: 20, spin: -3, hold: 0.8, speed: 100, aim: 0 } },
          { kind: 'debrisRain', params: { windup: 0.4, count: 8, time: 1.2, targeted: 3, air: 0.9, slam: 0 } },
          { kind: 'charge', params: { windup: 0.5, speed: 245, maxTime: 1.1, count: 3, lead: 0.35, pause: 0.25, stun: 0.2 } },
          { kind: 'ring', params: { windup: 0.45, count: 16, speed: 75, repeats: 3, gap: 0.35, spin: 12 } },
        ],
      },
    ],
  },
  {
    id: 'slagjacket',
    name: 'Slagjacket',
    kind: 'miniboss',
    chapters: ['rust_foundry', 'hollow_nest'],
    hp: 160,
    size: 8,
    speed: 46,
    mass: 3,
    flying: true,
    sprite: SLAGJACKET_SPRITE,
    music: 'miniboss',
    shot: 'ember',
    goo: ['#4a4a58', '#ff8a30', '#ffd060', '#2e2e3a'],
    hook: 'bossesC.slagjacket',
    title: 'FORGED IN THE FOUNDRY, IT FLEW TO THE NEST',
    bestiary: 'Someone built a wasp from iron plates and poured slag in its belly. It liked the nest better than the forge.',
    phases: [
      {
        at: 1,
        move: { kind: 'float', params: { wobble: 1, freq: 0.8, drift: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.2, params: { windup: 0.4, range: 170, speed: 110 } }],
        rest: [0.9, 1.3],
        patterns: [
          { kind: 'charge', params: { windup: 0.6, speed: 240, maxTime: 1.1, count: 2, lead: 0.3, pause: 0.3, stun: 0.3 } },
          { kind: 'hazard', params: { windup: 0.5, count: 3, radius: 11, life: 5, spread: 40 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 3, spread: 22, interval: 0.35, speed: 110 } },
        ],
      },
      {
        at: 0.5,
        name: 'Overheated',
        move: { kind: 'float', params: { wobble: 1.2, freq: 1, drift: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 1.8, params: { windup: 0.35, range: 180, speed: 118, count: 2, spread: 12 } }],
        tint: '#ff8a30',
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.2],
        patterns: [
          { kind: 'charge', params: { windup: 0.55, speed: 250, maxTime: 1.1, count: 3, lead: 0.35, pause: 0.25, stun: 0.25, ring: 6, ringSpeed: 75 } },
          { kind: 'spiral', params: { windup: 0.45, arms: 3, rate: 9, turn: 150, time: 1.8, speed: 80 } },
          { kind: 'dropLine', params: { windup: 0.5, lines: 1, count: 7, spacing: 16, start: 4, step: 0.08, air: 0.75, look: 0, creep: 1, creepLife: 4 } },
          { kind: 'hazard', params: { windup: 0.4, count: 4, radius: 11, life: 5, spread: 44 } },
        ],
      },
    ],
  },
];

export default bosses;
