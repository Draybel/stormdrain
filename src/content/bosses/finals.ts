/**
 * The three final bosses (DESIGN "Final bosses & endings"). Keep the ids and `final` keys: the floor
 * generator, the run's ending flow and the saves know them.
 *
 *   Old Thunderhead  floor 12, main track   ending 1 "Clear Skies"
 *   The Nestmother   floor 12, alt track    ending 2 "The Quiet Hive"
 *   The Undertow     floor 13 (whirlpool)   ending 3 "What the Rain Kept"
 *
 * Built from the core pattern library plus the finals' own kinds (sim/bosses/patterns-finals.ts:
 * strikes, curtain, gust, clap, brood, dive, barricade, vortex) and per-boss code
 * (content/hooks/bosses-finals.ts: Thunderhead's looming drift and blackout, the Undertow's pull, a new
 * look every phase, the send-offs). Guide: docs/content-finals.md.
 *
 * HP: 1400 / 1500 / 1900 — about a minute for a floor-12 build (four times Wren's base damage); the
 * base-stat god-mode bot still gets through in about three and a half minutes (tests).
 */

import type { BossDef } from '../../sim/types';
import { NESTMOTHER_1 } from '../sprites/finals-nestmother';
import { THUNDERHEAD_1 } from '../sprites/finals-thunderhead';
import { UNDERTOW_1 } from '../sprites/finals-undertow';

const bosses: BossDef[] = [
  // ── Old Thunderhead ───────────────────────────────────────────────────────
  // A colossal, grumpy old storm cloud. It looms along the top of the room: lightning walks at you,
  // rain comes down in curtains with a gap to find, wind gusts shove you about, thunderclaps ring out.
  // Gathering Storm: it towers up, shakes off little cloudlets and fans its lightning. The Last
  // Downpour: the lights go out — only your own glow and the lightning show the room.
  {
    id: 'old-thunderhead',
    name: 'Old Thunderhead',
    kind: 'final',
    final: 'thunderhead',
    ending: 1,
    chapters: ['eye_of_storm'],
    hp: 1400,
    size: 18,
    speed: 30,
    contact: 2,
    mass: 12,
    flying: true,
    sprite: THUNDERHEAD_1,
    music: 'final_thunderhead',
    shot: 'water',
    drops: 'bossSpill',
    goo: ['#98a2bc', '#cdd4e6', '#ffd84a', '#6f9fd8', '#fff7c8'],
    title: 'THE STORM THAT WOULD NOT STOP',
    bestiary: 'The grumpiest cloud in the sky. It has rained on the town for forty days and it does not intend to stop for anyone.',
    hook: 'old-thunderhead',
    phases: [
      {
        at: 1,
        name: 'Brooding',
        move: { kind: 'idle' },
        attacks: [],
        rest: [1.0, 1.5],
        patterns: [
          { kind: 'strikes', params: { windup: 0.6, shape: 0, count: 7, step: 20, delay: 0.12, air: 0.85, bolt: 1, splash: 10 } },
          { kind: 'curtain', params: { windup: 0.6, sheets: 3, gap: 1, spacing: 13, hole: 3, shift: 2, speed: 64 } },
          { kind: 'gust', params: { windup: 0.8, time: 2.2, force: 48, dir: 0, rain: 5, speed: 95 } },
          { kind: 'clap', params: { windup: 0.8, claps: 1, count: 14, speed: 78, waves: 1, waveRadius: 72, waveSpeed: 100 } },
          { kind: 'strikes', params: { windup: 0.6, shape: 1, count: 2, step: 20, delay: 0.07, air: 0.9, bolt: 1, splash: 10 } },
        ],
      },
      {
        at: 0.55,
        name: 'Gathering Storm',
        move: { kind: 'idle' },
        attacks: [],
        pace: 1.15,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'brood', enemy: 'grumblecloud', params: { windup: 0.3, count: 3, max: 4, hp: 14, scale: 0.6, place: 0, dist: 10, hatch: 0.6 } },
        patterns: [
          { kind: 'strikes', params: { windup: 0.6, shape: 0, count: 6, paths: 3, fan: 30, step: 20, delay: 0.1, air: 0.8, bolt: 1, splash: 10 } },
          { kind: 'curtain', params: { windup: 0.55, sheets: 4, gap: 0.85, spacing: 13, hole: 3, shift: 3, slant: 0.35, speed: 70 } },
          { kind: 'gust', params: { windup: 0.7, time: 2.6, force: 62, dir: 2, rain: 10, speed: 112 } },
          { kind: 'clap', params: { windup: 0.7, claps: 2, gap: 0.55, count: 16, speed: 82, alt: 1, waves: 1, waveRadius: 80, waveSpeed: 105 } },
          { kind: 'beamSweep', params: { windup: 0.9, look: 1, arc: 140, time: 1.8, width: 7 } },
          { kind: 'strikes', params: { windup: 0.55, shape: 1, tilt: 1, count: 3, step: 18, delay: 0.05, air: 0.85, repeats: 2, gap: 0.6, bolt: 1, splash: 10 } },
          { kind: 'brood', enemy: 'grumblecloud', weight: 0.6, params: { windup: 0.5, count: 2, max: 4, hp: 14, scale: 0.6, place: 0, dist: 10, hatch: 0.6 } },
        ],
      },
      {
        at: 0.2,
        name: 'The Last Downpour',
        move: { kind: 'idle' },
        attacks: [],
        pace: 1.3,
        order: 'random',
        rest: [0.6, 1.0],
        enter: { kind: 'hook', hook: 'thunderhead-blackout', params: { windup: 0.9, time: 8 } },
        patterns: [
          { kind: 'hook', hook: 'thunderhead-blackout', weight: 1.5, params: { windup: 0.8, time: 8 } },
          { kind: 'strikes', params: { windup: 0.55, shape: 2, count: 8, radius: 36, delay: 0.04, air: 0.9, repeats: 2, gap: 0.55, bolt: 1, splash: 10 } },
          { kind: 'curtain', params: { windup: 0.5, sheets: 5, gap: 0.75, spacing: 13, hole: 3, shift: 3, slant: -0.3, speed: 78 } },
          { kind: 'clap', params: { windup: 0.6, claps: 3, gap: 0.5, count: 18, speed: 84, alt: 1, waves: 1, waveRadius: 84, waveSpeed: 110 } },
          { kind: 'gust', params: { windup: 0.7, time: 2.4, force: 56, dir: 1, rain: 14, speed: 118 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 4, rate: 8, turn: 120, time: 2.6, speed: 72, reverse: 1 } },
          { kind: 'beamSweep', params: { windup: 0.85, twin: 1, look: 1, arc: 170, time: 2.2, width: 7 } },
        ],
      },
    ],
  },

  // ── The Nestmother ─────────────────────────────────────────────────────────
  // The paper-wasp queen. She circles you, hatches larvae around you, rises out of reach and dives
  // where her shadow caught you, spits paper into walls (break them — they hide goodies) and leaves
  // honey puddles. Swarming: drones join her, stingers swirl out in spirals. Hive Fury: a guard of
  // drones circles her and everything comes faster.
  {
    id: 'nestmother',
    name: 'The Nestmother',
    kind: 'final',
    final: 'nestmother',
    ending: 2,
    chapters: ['hollow_nest'],
    hp: 1500,
    size: 15,
    speed: 46,
    contact: 2,
    flying: true,
    sprite: NESTMOTHER_1,
    music: 'final_nestmother',
    shot: 'ember',
    drops: 'bossSpill',
    goo: ['#e8a430', '#efe9dc', '#2a1c14', '#ffcf57', '#e89a22'],
    title: 'QUEEN OF THE PAPER HIVE',
    bestiary: 'The paper-wasp queen who built her hive from every lost letter the storm carried down. She is very proud of it.',
    hook: 'nestmother',
    phases: [
      {
        at: 1,
        name: "Queen's Court",
        move: { kind: 'orbitPlayer', params: { radius: 64, spin: 1.1, dir: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2.4, params: { speed: 100, windup: 0.35, range: 220, still: 0 } }],
        rest: [1.0, 1.4],
        patterns: [
          { kind: 'brood', enemy: 'grubling', params: { windup: 0.5, count: 3, max: 4, place: 1, dist: 40, hatch: 0.9 } },
          { kind: 'dive', params: { windup: 0.5, rise: 0.45, height: 70, track: 0.9, follow: 110, lock: 0.5, fall: 0.26, ring: 10, ringSpeed: 75, waveRadius: 56 } },
          { kind: 'barricade', shot: 'dust', params: { windup: 0.6, cells: 5, gaps: 1, walls: 1, air: 0.9, max: 14 } },
          { kind: 'aimedBurst', params: { windup: 0.4, bursts: 3, shots: 3, spread: 26, interval: 0.32, speed: 108 } },
          { kind: 'hazard', params: { windup: 0.45, count: 3, radius: 12, life: 6, spread: 44 } },
        ],
      },
      {
        at: 0.6,
        name: 'Swarming',
        move: { kind: 'orbitPlayer', params: { radius: 58, spin: 1.4, dir: -1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 2, params: { speed: 108, windup: 0.3, range: 220, still: 0, count: 2, spread: 14 } }],
        pace: 1.15,
        order: 'random',
        rest: [0.8, 1.2],
        enter: { kind: 'brood', enemy: 'nest-drone', params: { windup: 0.3, count: 3, max: 4, place: 0, dist: 14, hatch: 0.5 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 3, rate: 10, turn: 150, time: 2.4, speed: 70, curve: 1.1 } },
          { kind: 'dive', params: { windup: 0.45, rise: 0.4, height: 72, track: 0.8, follow: 125, lock: 0.45, fall: 0.24, count: 2, ring: 12, ringSpeed: 80, waveRadius: 60 } },
          { kind: 'barricade', shot: 'dust', params: { windup: 0.55, cells: 5, gaps: 1, walls: 2, air: 0.85, max: 18 } },
          { kind: 'hazard', params: { windup: 0.4, count: 5, radius: 13, life: 7, spread: 56 } },
          { kind: 'charge', params: { windup: 0.6, speed: 250, count: 3, lead: 0.35, stun: 0.3, pause: 0.3 } },
          { kind: 'brood', enemy: 'grubling', weight: 0.7, params: { windup: 0.45, count: 2, max: 4, place: 1, dist: 40, hatch: 0.8 } },
        ],
      },
      {
        at: 0.25,
        name: 'Hive Fury',
        move: { kind: 'orbitPlayer', params: { radius: 52, spin: 1.8, dir: 1 } },
        attacks: [{ kind: 'aimedShot', cooldown: 1.8, params: { speed: 115, windup: 0.3, range: 220, still: 0, count: 3, spread: 14 } }],
        pace: 1.3,
        order: 'random',
        rest: [0.6, 1.0],
        enter: { kind: 'shields', enemy: 'nest-drone', params: { windup: 0.3, count: 5, radius: 16, spin: 2.2 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.45, arms: 5, rate: 9, turn: 170, time: 2.8, speed: 70, curve: 0.9, reverse: 1 } },
          { kind: 'dive', params: { windup: 0.4, rise: 0.38, height: 74, track: 0.7, follow: 140, lock: 0.42, fall: 0.22, count: 3, ring: 14, ringSpeed: 84, waveRadius: 64 } },
          { kind: 'brood', enemy: 'grubling', params: { windup: 0.4, count: 3, max: 5, place: 1, dist: 40, hatch: 0.8 } },
          { kind: 'hazard', params: { windup: 0.35, count: 6, radius: 13, life: 7, spread: 64 } },
          { kind: 'aimedBurst', params: { windup: 0.35, bursts: 4, shots: 5, spread: 50, interval: 0.3, speed: 112 } },
          { kind: 'ring', params: { windup: 0.45, count: 16, speed: 76, repeats: 3, gap: 0.4, spin: 12, curve: 0.8 } },
        ],
      },
    ],
  },

  // ── The Undertow ───────────────────────────────────────────────────────────
  // The living whirlpool at the bottom of every drain. It sits in the middle of the room and slowly
  // drags you in; debris circles it and is flung at you, water tentacles snake across the floor, a
  // spiral of spray fills the room. It churns, reaches up out of the deep, and makes a last stand.
  {
    id: 'undertow',
    name: 'The Undertow',
    kind: 'final',
    final: 'undertow',
    ending: 3,
    chapters: ['eye_of_storm'],
    hp: 1900,
    size: 20,
    speed: 0,
    contact: 2,
    mass: 100,
    sprite: UNDERTOW_1,
    music: 'final_undertow',
    shot: 'water',
    drops: 'bossSpill',
    goo: ['#5a95c8', '#a8d4f0', '#e6f6ff', '#ffcf57', '#1c3d66'],
    title: 'THE BOTTOM OF EVERY DRAIN',
    bestiary: 'The living whirlpool at the bottom of every drain. Everything the rain ever took ends up here, going round and round.',
    hook: 'undertow',
    phases: [
      {
        at: 1,
        name: 'The Current',
        move: { kind: 'idle' },
        attacks: [],
        rest: [1.0, 1.4],
        enter: { kind: 'shields', params: { windup: 0.2, count: 4, radius: 16, spin: 1.3 } },
        patterns: [
          { kind: 'vortex', shot: 'dust', params: { windup: 0.6, count: 8, radius: 34, spin: 2.2, hold: 1.3, fling: 0, interval: 0.12, speed: 112, size: 3.5 } },
          { kind: 'strikes', params: { windup: 0.6, shape: 3, count: 7, sway: 14, delay: 0.12, air: 0.75, bolt: 0, splash: 9, spray: 4 } },
          { kind: 'spiral', params: { windup: 0.6, arms: 4, rate: 7, turn: 90, time: 2.4, speed: 64, curve: 0.6 } },
          { kind: 'ring', params: { windup: 0.55, count: 14, speed: 68, repeats: 2, gap: 0.5, spin: 12, curve: 0.7 } },
        ],
      },
      {
        at: 0.7,
        name: 'Churning',
        move: { kind: 'idle' },
        attacks: [],
        pace: 1.1,
        order: 'random',
        rest: [0.9, 1.3],
        enter: { kind: 'shields', params: { windup: 0.2, count: 5, radius: 18, spin: -1.8 } },
        patterns: [
          { kind: 'vortex', shot: 'dust', params: { windup: 0.55, count: 12, radius: 36, spin: -2.6, hold: 1.4, fling: 1, speed: 100, size: 3.5, pull: 18 } },
          { kind: 'strikes', params: { windup: 0.55, shape: 3, count: 7, paths: 2, fan: 44, sway: 16, delay: 0.11, air: 0.75, bolt: 0, splash: 9, spray: 4 } },
          { kind: 'beamSweep', params: { windup: 0.9, twin: 1, arc: 160, time: 2.2, width: 8, look: 0 } },
          { kind: 'spiral', params: { windup: 0.5, arms: 5, rate: 7, turn: -100, time: 2.6, speed: 66, curve: -0.5 } },
          { kind: 'hazard', params: { windup: 0.45, count: 4, radius: 12, life: 7, spread: 60 } },
        ],
      },
      {
        at: 0.4,
        name: 'The Deep',
        move: { kind: 'idle' },
        attacks: [],
        pace: 1.2,
        order: 'random',
        rest: [0.8, 1.1],
        enter: { kind: 'vortex', shot: 'dust', params: { windup: 0.3, count: 14, radius: 32, spin: 3, hold: 0.9, fling: 2, speed: 96, size: 3.5 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.55, arms: 6, rate: 8, turn: 120, time: 3, speed: 66, reverse: 1 } },
          { kind: 'strikes', params: { windup: 0.5, shape: 2, count: 8, radius: 38, delay: 0.05, air: 0.85, repeats: 2, gap: 0.55, bolt: 0, splash: 9, spray: 3 } },
          { kind: 'strikes', params: { windup: 0.5, shape: 3, count: 6, paths: 3, fan: 36, sway: 18, delay: 0.1, air: 0.75, bolt: 0, splash: 9, spray: 3 } },
          { kind: 'vortex', shot: 'dust', params: { windup: 0.5, count: 10, radius: 34, spin: 2.8, hold: 1.1, fling: 0, interval: 0.1, speed: 118, size: 3.5, pull: 24 } },
          { kind: 'beamSweep', params: { windup: 0.85, twin: 1, arc: 220, time: 2.4, width: 8, look: 0 } },
        ],
      },
      {
        at: 0.15,
        name: 'What the Rain Kept',
        move: { kind: 'idle' },
        attacks: [],
        pace: 1.35,
        order: 'random',
        rest: [0.6, 0.9],
        enter: { kind: 'vortex', shot: 'dust', params: { windup: 0.3, count: 16, radius: 34, spin: -3, hold: 1, fling: 1, speed: 92, size: 3.5 } },
        patterns: [
          { kind: 'spiral', params: { windup: 0.5, arms: 6, rate: 8, turn: 95, time: 3.2, speed: 62, reverse: 1, curve: 0.3 } },
          { kind: 'strikes', params: { windup: 0.45, shape: 3, count: 8, paths: 3, fan: 40, sway: 18, delay: 0.09, air: 0.72, bolt: 0, splash: 9, spray: 5, creep: 1 } },
          { kind: 'vortex', shot: 'dust', params: { windup: 0.45, count: 14, radius: 34, spin: 3.2, hold: 1, fling: 0, interval: 0.08, speed: 122, size: 3.5, pull: 30 } },
          { kind: 'ring', params: { windup: 0.4, count: 20, speed: 70, repeats: 4, gap: 0.35, alt: 1, curve: 0.5 } },
          { kind: 'clap', params: { windup: 0.6, claps: 2, gap: 0.6, count: 16, speed: 74, waves: 1, waveRadius: 90, waveSpeed: 100, flash: 0 } },
        ],
      },
    ],
  },
];

export default bosses;
