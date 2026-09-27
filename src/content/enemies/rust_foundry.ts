/**
 * Chapter 3 (alt track) — The Rust Foundry: molten slag and furnaces. Four enemies:
 *   Slag Blob      hop                               spatters sparks on landing; splits when struck down
 *   Potbelly       chasePath (around obstacles)      fan of cinders + a coal that bursts where it lands
 *   Slag Crucible  turret                            three-armed spark spiral + molten globs that pool
 *   Clinker        lurk (a lump of coal until near)  flares into a ring of sparks, chases on hot coals
 * (The Lost Balloon also drifts here — see drowned_nursery.ts.) Floors 5-6: HP 28-52, heavier hits.
 */

import type { EnemyDef } from '../../sim/types';
import { CLINKER_SPRITE, POTBELLY_SPRITE, SLAG_BLOB_SPRITE, SLAG_CRUCIBLE_SPRITE } from '../sprites/enemiesAFoundry';

const CH = ['rust_foundry'] as const;

const enemies: EnemyDef[] = [
  {
    id: 'slag-blob',
    name: 'Slag Blob',
    hp: 36,
    speed: 0,
    radius: 6,
    contact: 1,
    mass: 1.5,
    move: { kind: 'hop', params: { rest: 0.8, crouch: 0.35, air: 0.5, dist: 46, height: 16, aim: 0.75 } },
    attacks: [{ kind: 'ringN', cooldown: 1.4, params: { on: 1, windup: 0, count: 4, speed: 80 } }],
    onDeath: [{ kind: 'split', params: { count: 2, scale: 0.6, hp: 0.35, gen: 1 } }],
    sprite: SLAG_BLOB_SPRITE,
    chapters: CH,
    weight: 8,
    championable: true,
    shot: 'ember',
    goo: ['#4a3434', '#ff8a30', '#ffd060', '#2e2024'],
    bestiary: 'Runoff from the furnaces, still cooling and still cranky. It spatters sparks and splits apart.',
  },
  {
    id: 'potbelly',
    name: 'Potbelly',
    hp: 50,
    speed: 28,
    radius: 7,
    contact: 2,
    mass: 2.4,
    big: true,
    move: { kind: 'chasePath', params: { recalc: 10 } },
    attacks: [
      { kind: 'spreadFan', cooldown: 2.6, params: { count: 5, spread: 64, speed: 95, windup: 0.6, range: 150 } },
      {
        kind: 'lob',
        cooldown: 4.2,
        params: { count: 1, split: 5, splash: 10, air: 1, height: 34, windup: 0.5, range: 200, minRange: 40 },
      },
    ],
    sprite: POTBELLY_SPRITE,
    chapters: CH,
    weight: 6,
    championable: true,
    shot: 'ember',
    goo: ['#4e4e60', '#ff9a40', '#ffd070', '#7a7a94'],
    bestiary: 'A little stove with a big appetite. Its grate glows bright just before it belches cinders.',
  },
  {
    id: 'slag-crucible',
    name: 'Slag Crucible',
    hp: 52,
    speed: 0,
    radius: 7,
    contact: 1,
    mass: 99,
    big: true,
    move: { kind: 'turret' },
    attacks: [
      {
        kind: 'spiral',
        cooldown: 4.2,
        params: { arms: 3, count: 8, interval: 0.11, spin: -130, speed: 72, windup: 0.6, range: 220 },
      },
      {
        kind: 'lob',
        cooldown: 3.6,
        params: { count: 3, creep: 1, splash: 10, scatter: 22, air: 1.1, height: 36, windup: 0.5, range: 200 },
      },
    ],
    sprite: SLAG_CRUCIBLE_SPRITE,
    chapters: CH,
    weight: 5,
    championable: true,
    shot: 'ember',
    goo: ['#56545f', '#ff8a30', '#ffd060', '#86849a'],
    bestiary: 'A crucible of slag left to simmer. It spins out sparks and lobs molten globs that pool.',
  },
  {
    id: 'clinker',
    name: 'Clinker',
    hp: 28,
    speed: 54,
    radius: 5,
    contact: 1,
    move: { kind: 'lurk', params: { wake: 50, rouse: 0.5, path: 1 } },
    attacks: [
      { kind: 'ringN', cooldown: 0.5, params: { on: 3, windup: 0, count: 8, speed: 78 } },
      { kind: 'leaveTrail', cooldown: 0.35, params: { radius: 5, life: 2.5, dmg: 1, moving: 1 } },
    ],
    sprite: CLINKER_SPRITE,
    chapters: CH,
    weight: 7,
    championable: true,
    shot: 'ember',
    goo: ['#302c34', '#ff8a30', '#ffd060', '#7a3226'],
    bestiary: 'Just a lump of coal on the floor. Until you get close, and it flares up and comes for you.',
  },
];

export default enemies;
