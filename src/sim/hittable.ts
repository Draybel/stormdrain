/**
 * The unified damage interface (ARCHITECTURE §3 "Hittables"). Enemies, training dummies and
 * shot-breakable tiles all implement `Hittable`, so the attack pipeline (shots, beams, swipes,
 * explosions, chain lightning…) can treat every target the same way:
 *
 *   const n = queryHittables(w, x, y, r, scratch, true);
 *   for (let i = 0; i < n; i++) { scratch[i]!.hurt(dmg, SRC_PLAYER, kx, ky); scratch[i]!.applyStatus('burn', 3, 0, SRC_PLAYER); }
 *
 * `hurt(dmg, source, kx, ky)`: damage with a knockback impulse (kx, ky in px/s, divided by the target's
 * mass; the direction is also remembered for a later 'knockback' status). Returns true if it landed.
 * `applyStatus(kind, duration, power, source)`: see sim/enemies/status.ts for the stacking rules.
 */

import { hitTileWithShot, destroyTile } from './tileFx';
import { Tile, shotBreakable } from './tiles';
import { TILE } from './constants';
import type { StatusKind } from './types';
import type { World } from './world';

/** Damage sources (kill credit, who a hit may hurt). */
/** The player's own attacks (shots, beams, swipes, familiars). */
export const SRC_PLAYER = 0;
/** Player-side area damage: bombs, novas, item blasts. */
export const SRC_BOMB = 1;
/** Damage over time (poison / burn); credit goes to whoever applied it. */
export const SRC_STATUS = 2;
/** Charmed enemies and ice shards fighting on the player's side. */
export const SRC_ALLY = 3;
/** Hostile enemy attacks (enemy explosions hurting other things). */
export const SRC_ENEMY = 4;
/** Environment (creep, spikes, pits). */
export const SRC_HAZARD = 5;

/** Does a kill from this source count as the player's (on-kill triggers)? */
export function creditsPlayer(source: number): boolean {
  return source <= SRC_ALLY;
}

export const HIT_ENEMY = 0;
export const HIT_DUMMY = 1;
export const HIT_TILE = 2;

export interface Hittable {
  /** HIT_ENEMY / HIT_DUMMY / HIT_TILE. */
  readonly hitKind: number;
  readonly x: number;
  readonly y: number;
  readonly r: number;
  /** Can be hit right now (alive, not popped / burrowed / faded out). */
  readonly hittable: boolean;
  hurt(dmg: number, source: number, kx: number, ky: number): boolean;
  applyStatus(kind: StatusKind, duration: number, power: number, source: number): void;
}

/**
 * A shot-breakable grid cell (crate, urn, fire) as a Hittable. One adapter per cell is created with
 * the World, so querying never allocates. Shots count hits, not damage (ARCHITECTURE §3); freezing a
 * fire puts it out.
 */
export class TileTarget implements Hittable {
  readonly hitKind = HIT_TILE;
  readonly x: number;
  readonly y: number;
  readonly r = TILE / 2;
  readonly cell: number;
  private readonly w: World;

  constructor(w: World, cell: number, col: number, row: number) {
    this.w = w;
    this.cell = cell;
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
  }

  get hittable(): boolean {
    return shotBreakable(this.w.room.tiles[this.cell]!);
  }

  hurt(dmg: number, _source: number, _kx: number, _ky: number): boolean {
    if (!this.hittable || !(dmg > 0)) return false;
    hitTileWithShot(this.w, this.cell);
    return true;
  }

  applyStatus(kind: StatusKind, duration: number, _power: number, _source: number): void {
    const room = this.w.room;
    if (kind === 'freeze' && duration > 0 && room.tiles[this.cell] === Tile.Fire) {
      destroyTile(this.w, this.cell % room.cols, (this.cell / room.cols) | 0);
    }
  }
}

function overlaps(h: Hittable, x: number, y: number, r: number): boolean {
  const dx = h.x - x;
  const dy = h.y - y;
  const rr = h.r + r;
  return dx * dx + dy * dy < rr * rr;
}

/**
 * Fills `out` with every hittable target whose circle overlaps (x, y, r): enemies first, then standing
 * dummies, then (with `tiles`) breakable cells. Returns the count; `out` is reused (no allocation once
 * it has grown).
 */
export function queryHittables(w: World, x: number, y: number, r: number, out: Hittable[], tiles = false): number {
  let n = 0;
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (e.hittable && overlaps(e, x, y, r)) out[n++] = e;
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.hittable && overlaps(d, x, y, r)) out[n++] = d;
  }
  if (tiles) {
    const room = w.room;
    const c0 = Math.max(0, Math.floor((x - r) / TILE));
    const c1 = Math.min(room.cols - 1, Math.floor((x + r) / TILE));
    const r0 = Math.max(0, Math.floor((y - r) / TILE));
    const r1 = Math.min(room.rows - 1, Math.floor((y + r) / TILE));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const t = w.tileTargets[row * room.cols + col]!;
        if (t.hittable && overlaps(t, x, y, r)) out[n++] = t;
      }
    }
  }
  return n;
}

/** The first hittable enemy or standing dummy overlapping the circle (shots), or null. */
export function firstHittable(w: World, x: number, y: number, r: number): Hittable | null {
  const enemies = w.enemies;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (e.hittable && overlaps(e, x, y, r)) return e;
  }
  const dummies = w.dummies;
  for (let i = 0; i < dummies.count; i++) {
    const d = dummies.items[i]!;
    if (d.hittable && overlaps(d, x, y, r)) return d;
  }
  return null;
}
