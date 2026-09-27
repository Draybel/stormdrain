/** Helpers for the enemy tests: rooms with obstacles, invariant checks, test-only defs. */

import { expect } from 'vitest';
import { ENEMIES, registerEnemy } from '../../src/content/registry';
import { DRIZZLE_BLOB_SPRITE } from '../../src/content/sprites/gutterEnemies';
import { WALK_MODE, circleOverlapsGrid } from '../../src/sim/collision';
import { ROOM_H, ROOM_W } from '../../src/sim/constants';
import type { Enemy } from '../../src/sim/enemies/enemy';
import type { Sim } from '../../src/sim/sim';
import type { EnemyDef } from '../../src/sim/types';

/** Rocks, pits, a crate column, metal, spikes, an urn and a fire. */
export const OBSTACLE_ROOM: readonly string[] = [
  '.............',
  '..#...O...x..',
  '..#...O...x..',
  '..###.....M..',
  '......^^.....',
  '.u..f....#...',
  '.............',
];

/** A rock wall down column 6 with a single gap at the bottom row. */
export const WALL_ROOM: readonly string[] = [
  '......#......',
  '......#......',
  '......#......',
  '......#......',
  '......#......',
  '......#......',
  '.............',
];

export const OPEN_ROOM: readonly string[] = [
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
];

const EPS = 0.6;

/** Finite numbers, inside the room, walkers never inside walls/rocks/pits; enemy shots finite. */
export function checkEnemyInvariants(sim: Sim): void {
  const w = sim.world;
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i]!;
    for (const v of [e.x, e.y, e.z, e.vx, e.vy, e.kx, e.ky, e.hp]) expect(Number.isFinite(v), `${e.def.id} finite`).toBe(true);
    expect(e.x, e.def.id).toBeGreaterThanOrEqual(e.r - EPS);
    expect(e.y, e.def.id).toBeGreaterThanOrEqual(e.r - EPS);
    expect(e.x, e.def.id).toBeLessThanOrEqual(ROOM_W - e.r + EPS);
    expect(e.y, e.def.id).toBeLessThanOrEqual(ROOM_H - e.r + EPS);
    if (walker(e)) {
      expect(circleOverlapsGrid(w.room, e.x, e.y, e.r - EPS, WALK_MODE), `${e.def.id} inside an obstacle at ${e.x.toFixed(1)},${e.y.toFixed(1)}`).toBe(false);
    }
  }
  const shots = w.enemyShots;
  for (let i = 0; i < shots.count; i++) {
    const s = shots.items[i]!;
    for (const v of [s.x, s.y, s.z, s.vx, s.vy]) expect(Number.isFinite(v)).toBe(true);
  }
  expect(w.enemyShots.count).toBeLessThanOrEqual(w.enemyShots.capacity);
}

function walker(e: Enemy): boolean {
  return !e.dead && !e.flying && e.z <= 0 && !e.burrowed && !e.noCollide;
}

/** Registers (once) a test-only enemy def built on top of a small base. */
export function testEnemy(id: string, over: Partial<EnemyDef>): EnemyDef {
  const have = ENEMIES.get(id);
  if (have) return have;
  const def: EnemyDef = {
    id,
    name: id,
    hp: 20,
    speed: 50,
    radius: 5,
    contact: 1,
    move: { kind: 'idle' },
    attacks: [],
    sprite: DRIZZLE_BLOB_SPRITE,
    chapters: ['gutterways'],
    weight: 0,
    championable: false,
    bestiary: 'A test-only enemy used by the unit tests.',
    ...over,
  };
  registerEnemy(def);
  return def;
}

/** Keeps the player alive and untouchable (enemies still target them). */
export function godMode(sim: Sim): void {
  sim.world.godMode = true;
}
