/**
 * Room combat flow: a wave of enemies spawns (poofs at spawn points), the doors shut while any enemy
 * lives, and when the last one dies the room is CLEARED — doors open, the 'roomClear' trigger fires
 * (room-charged actives +1), and a reward drops from the 'roomClear' table.
 *
 * The training yard uses it as an arena (F key / the FIGHT button → `startWave`); the floor code can
 * use the same flow for combat rooms (`startWave` with the room's pool and its 'e'/'E' spawn points,
 * which `Sim.loadRoom` collects into `arena.points`).
 */

import { enemiesInChapter, findEnemy } from '../content/registry';
import { TILE } from './constants';
import { roomCleared } from './effects';
import { spawnEnemy, livingEnemies } from './enemies/spawn';
import { spawnDrops } from './pickups';
import { Tile } from './tiles';
import type { EnemyDef, EnemyId } from './types';
import type { World } from './world';

/** Seconds the doors take to slam shut / swing open (render reads `doors`). */
const DOOR_TIME = 0.25;
/** Spawns keep at least this far from the player (px). */
const SAFE_DIST = 56;

export class Arena {
  /** A wave is in progress: doors shut until every enemy is gone. */
  active = false;
  /** Waves started in this room. */
  wave = 0;
  /** Door animation: 0 open … 1 shut. */
  doors = 0;
  /** Seconds since the last clear (render banner / sparkle). */
  sinceClear = 99;
  /** Enemy spawn points from the room layout ('e' markers, then 'E' elites): packed x, y pairs. */
  readonly points: number[] = [];
  readonly elitePoints: number[] = [];
  /**
   * Clearing the current wave counts as clearing the room (reward drop, 'roomClear' event, active
   * charge, triggers). The floor run turns it off for the first waves of a challenge room.
   */
  reward = true;
  /**
   * The doors stay shut even between waves (the floor run's Rain Barrel Arena holds them from the
   * pressure plate to the last wave).
   */
  locked = false;

  reset(): void {
    this.active = false;
    this.locked = false;
    this.wave = 0;
    this.doors = 0;
    this.sinceClear = 99;
    this.points.length = 0;
    this.elitePoints.length = 0;
    this.reward = true;
  }
}

/** One enemy placed exactly (floor runs: pre-rolled room contents, placeholder bosses). */
export interface FixedSpawn {
  id: EnemyId;
  x: number;
  y: number;
  /** true = roll (default), false = never, a champion id = force it. */
  champion?: boolean | string;
  /** Exact starting HP (bosses). */
  hp?: number;
  /** Size multiplier. */
  scale?: number;
}

export interface WaveOpts {
  /** How many enemies (default 4-6, a little more each wave). */
  count?: number;
  /** Enemy ids to pick from (weighted by EnemyDef.weight); default: the chapter's pool. */
  pool?: readonly EnemyId[];
  /** Chapter whose enemy pool to use (default 'gutterways'). */
  chapter?: string;
  /** Exactly these enemies (no random picks; count / pool / chapter are ignored). */
  spawns?: readonly FixedSpawn[];
}

function weightedDefs(opts: WaveOpts): EnemyDef[] {
  if (opts.pool) {
    const out: EnemyDef[] = [];
    for (const id of opts.pool) {
      const d = findEnemy(id);
      if (d) out.push(d);
    }
    return out;
  }
  return enemiesInChapter(opts.chapter ?? 'gutterways');
}

/**
 * Free cell centres for spawning: walkable plain floor, away from the player, pedestals and standing
 * dummies. Deterministic order (row-major) — the caller picks with combatRng.
 */
function freeSpots(w: World, out: number[]): void {
  out.length = 0;
  const room = w.room;
  const p = w.player;
  for (let row = 0; row < room.rows; row++) {
    for (let col = 0; col < room.cols; col++) {
      if (room.get(col, row) !== Tile.Floor) continue;
      const x = col * TILE + TILE / 2;
      const y = row * TILE + TILE / 2;
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy < SAFE_DIST * SAFE_DIST) continue;
      let blocked = false;
      for (let i = 0; i < w.pedestals.count && !blocked; i++) {
        const pd = w.pedestals.items[i]!;
        blocked = Math.abs(pd.x - x) < 12 && Math.abs(pd.y - y) < 12;
      }
      for (let i = 0; i < w.dummies.count && !blocked; i++) {
        const d = w.dummies.items[i]!;
        blocked = !d.popped && Math.abs(d.x - x) < 12 && Math.abs(d.y - y) < 12;
      }
      if (!blocked) out.push(x, y);
    }
  }
}

const spots: number[] = [];

/**
 * The free spawn cell (plain floor, clear of pedestals / dummies, not right next to the player — see
 * freeSpots) nearest to (x, y), written to `out`; (x, y) itself when the room has none.
 */
export function nearestFreeSpot(w: World, x: number, y: number, out: { x: number; y: number }): void {
  freeSpots(w, spots);
  out.x = x;
  out.y = y;
  let best = Infinity;
  for (let i = 0; i < spots.length; i += 2) {
    const dx = spots[i]! - x;
    const dy = spots[i + 1]! - y;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      out.x = spots[i]!;
      out.y = spots[i + 1]!;
    }
  }
}

/**
 * Starts a wave: spawns enemies (seeded champion rolls) at the room's spawn points or at random free
 * spots, and shuts the doors. Returns how many spawned (0 if a wave is already running or the pool
 * is empty).
 */
export function startWave(w: World, opts: WaveOpts = {}): number {
  const a = w.arena;
  if (a.active || w.player.dead) return 0;
  if (opts.spawns) return startFixedWave(w, opts.spawns);
  const defs = weightedDefs(opts);
  if (defs.length === 0) return 0;
  const rng = w.combatRng;
  const marked = (a.points.length + a.elitePoints.length) / 2;
  // A room with markers fills each of them once; the open arena grows a little every wave.
  const count = Math.max(1, opts.count ?? (marked > 0 ? marked : Math.min(8, rng.int(4, 6) + (a.wave >> 1))));
  if (marked > 0) {
    spots.length = 0;
    for (let i = 0; i < a.points.length; i++) spots.push(a.points[i]!);
    for (let i = 0; i < a.elitePoints.length; i++) spots.push(a.elitePoints[i]!);
  } else {
    freeSpots(w, spots);
  }
  let spawned = 0;
  for (let i = 0; i < count && spots.length >= 2; i++) {
    const def = rng.weightedPick(defs, (d) => d.weight);
    const k = rng.int(0, spots.length / 2 - 1) * 2;
    const x = spots[k]!;
    const y = spots[k + 1]!;
    // Each spot is used once (swap-remove the pair).
    spots[k] = spots[spots.length - 2]!;
    spots[k + 1] = spots[spots.length - 1]!;
    spots.length -= 2;
    if (spawnEnemy(w, def, x, y)) spawned++;
  }
  if (spawned === 0) return 0;
  beginWave(w);
  return spawned;
}

/** A wave of exactly these enemies (unknown ids are skipped). */
function startFixedWave(w: World, list: readonly FixedSpawn[]): number {
  let spawned = 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i]!;
    const def = findEnemy(s.id);
    if (!def) continue;
    if (spawnEnemy(w, def, s.x, s.y, { champion: s.champion ?? true, hp: s.hp, scale: s.scale })) spawned++;
  }
  if (spawned === 0) return 0;
  beginWave(w);
  return spawned;
}

/** Marks a wave as started (doors shut, Lucky Marble armed) — for enemies spawned by other means (bosses). */
export function beginWave(w: World): void {
  const a = w.arena;
  a.active = true;
  a.wave++;
  // Wren's Lucky Marble: the first volley in an uncleared room is a keeper marble.
  w.player.atk.keeper = true;
  w.events.emit('doors', 0, 0, 1, a.wave);
}

/** Per tick: door animation, and the clear check. */
export function updateArena(w: World, dt: number): void {
  const a = w.arena;
  a.sinceClear += dt;
  const target = a.active || a.locked ? 1 : 0;
  if (a.doors !== target) {
    const step = dt / DOOR_TIME;
    a.doors = a.doors < target ? Math.min(target, a.doors + step) : Math.max(target, a.doors - step);
  }
  if (!a.active || livingEnemies(w) > 0) return;
  finishWave(w);
}

/** Everything is dead: open the doors, count the clear, drop the reward. */
function finishWave(w: World): void {
  const a = w.arena;
  a.active = false;
  a.sinceClear = 0;
  // A wave that isn't the last one (challenge rooms): the floor run starts the next at once.
  if (!a.reward) return;
  w.events.emit('doors', 0, 0, 0, a.wave);
  // Reward in the middle of the room (the nearest open floor to the centre).
  const room = w.room;
  let bx = 6 * TILE + TILE / 2;
  let by = 3 * TILE + TILE / 2;
  let best = Infinity;
  for (let row = 0; row < room.rows; row++) {
    for (let col = 0; col < room.cols; col++) {
      if (room.get(col, row) !== Tile.Floor) continue;
      const d = Math.abs(col - 6) + Math.abs(row - 3) * 1.1;
      if (d < best) {
        best = d;
        bx = col * TILE + TILE / 2;
        by = row * TILE + TILE / 2;
      }
    }
  }
  w.events.emit('roomClear', bx, by, a.wave, 0);
  roomCleared(w);
  spawnDrops(w, 'roomClear', bx, by);
}
