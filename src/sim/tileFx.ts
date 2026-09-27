/**
 * Room grid interactions (ARCHITECTURE §3 tiles):
 * - crates take 2 shots, urns break on 1, fires go out after 4 (each hit shrinks the flame);
 * - explosions destroy rocks, tinted rocks (loot!), crates, urns, put out fires and reveal secret walls;
 * - spikes hurt when stepped on (unless flying), fires hurt on contact; pits/metal only block.
 * Destroyed tiles become floor with a cosmetic mark (RoomGrid.deco) and may drop seeded loot.
 */

import { TILE } from './constants';
import { DMG_FIRE, DMG_SPIKES, damagePlayer } from './combat';
import { spawnDrops } from './pickups';
import { Deco, Tile, bombBreakable, shotBreakable, walkInset } from './tiles';
import { HAZARD_TUNING } from './tuning';
import type { World } from './world';

/** A shot hit a blocking cell (index into the grid). Crates/urns/fires take damage. */
export function hitTileWithShot(w: World, cell: number): void {
  const room = w.room;
  const t = room.tiles[cell]!;
  if (!shotBreakable(t)) return;
  const col = cell % room.cols;
  const row = (cell / room.cols) | 0;
  const hp = room.hp[cell]!;
  if (hp <= 1) {
    destroyTile(w, col, row);
    return;
  }
  room.hp[cell] = hp - 1;
  // A cracked crate changes the pre-rendered background; flames are drawn live from hp.
  if (t === Tile.Crate) room.version++;
  w.events.emit('tileHit', col * TILE + TILE / 2, row * TILE + TILE / 2, t, hp - 1);
}

/**
 * Destroys (or puts out) the tile at (col, row) if it can be; returns true on success.
 * Loot is rolled after the cell became floor, so it never spawns inside the old obstacle.
 */
export function destroyTile(w: World, col: number, row: number): boolean {
  const room = w.room;
  if (!room.inBounds(col, row)) return false;
  const i = row * room.cols + col;
  const t = room.tiles[i]!;
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  let deco: number;
  let table = '';
  switch (t) {
    case Tile.Rock:
      deco = Deco.Rubble;
      break;
    case Tile.RockTinted:
      deco = Deco.Rubble;
      table = 'tintedRock';
      break;
    case Tile.Crate:
      deco = Deco.Planks;
      table = 'crate';
      break;
    case Tile.Urn:
      deco = Deco.Shards;
      table = 'urn';
      break;
    case Tile.Fire:
      deco = Deco.Ash;
      table = 'fire';
      break;
    case Tile.SecretWall:
      deco = Deco.Rubble;
      w.onSecretWallBombed?.(cx, cy);
      break;
    default:
      return false;
  }
  room.set(col, row, Tile.Floor);
  room.deco[i] = deco;
  w.counters.tilesBroken++;
  w.events.emit('tileBreak', cx, cy, t, 0);
  if (table) spawnDrops(w, table, cx, cy);
  return true;
}

/** Wall door slots (the four wall centres, room px): where secret rooms connect. */
const SLOT_X = [TILE * 6.5, TILE * 6.5, 0, TILE * 13] as const;
const SLOT_Y = [0, TILE * 7, TILE * 3.5, TILE * 3.5] as const;
/** How close (beyond the tile radius) an explosion must be to a door slot to reach it. */
const SLOT_REACH = 12;

/** Explosion vs grid: every bomb-breakable cell whose box is within `radius` of (x, y). */
export function explodeTiles(w: World, x: number, y: number, radius: number): void {
  const room = w.room;
  const c0 = Math.max(0, Math.floor((x - radius) / TILE));
  const c1 = Math.min(room.cols - 1, Math.floor((x + radius) / TILE));
  const r0 = Math.max(0, Math.floor((y - radius) / TILE));
  const r1 = Math.min(room.rows - 1, Math.floor((y + radius) / TILE));
  const r2 = radius * radius;
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!bombBreakable(room.get(col, row))) continue;
      const left = col * TILE;
      const top = row * TILE;
      const cx = x < left ? left : x > left + TILE ? left + TILE : x;
      const cy = y < top ? top : y > top + TILE ? top + TILE : y;
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy < r2) destroyTile(w, col, row);
    }
  }
  w.onExplosion?.(x, y, radius);
  const cb = w.onSecretWallBombed;
  if (cb) {
    const reach = radius + SLOT_REACH;
    for (let s = 0; s < 4; s++) {
      const dx = x - SLOT_X[s]!;
      const dy = y - SLOT_Y[s]!;
      if (dx * dx + dy * dy < reach * reach) cb(SLOT_X[s]!, SLOT_Y[s]!);
    }
  }
}

/** Spikes underfoot and fire contact. Damage respects i-frames (damagePlayer ignores them). */
export function updateHazards(w: World): void {
  const p = w.player;
  if (p.dead || p.invuln > 0) return;
  const room = w.room;
  const H = HAZARD_TUNING;
  // Spikes: the feet (centre) must be well inside a spike tile.
  if (!p.flags.flying && !p.flags.spikeImmune) {
    const col = Math.floor(p.x / TILE);
    const row = Math.floor(p.y / TILE);
    if (room.get(col, row) === Tile.Spikes) {
      const lx = p.x - col * TILE;
      const ly = p.y - row * TILE;
      const m = H.spikeInset;
      if (lx > m && lx < TILE - m && ly > m && ly < TILE - m) {
        damagePlayer(w, H.spikeDamage, DMG_SPIKES);
        return;
      }
    }
  }
  // Fire: touching the (inset) flame box.
  if (!p.flags.fireImmune) {
    const reach = p.r + H.fireReach;
    const c0 = Math.floor((p.x - reach) / TILE);
    const c1 = Math.floor((p.x + reach) / TILE);
    const r0 = Math.floor((p.y - reach) / TILE);
    const r1 = Math.floor((p.y + reach) / TILE);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (room.get(col, row) !== Tile.Fire) continue;
        const inset = walkInset(Tile.Fire);
        const left = col * TILE + inset;
        const right = (col + 1) * TILE - inset;
        const top = row * TILE + inset;
        const bottom = (row + 1) * TILE - inset;
        const cx = p.x < left ? left : p.x > right ? right : p.x;
        const cy = p.y < top ? top : p.y > bottom ? bottom : p.y;
        const dx = p.x - cx;
        const dy = p.y - cy;
        if (dx * dx + dy * dy < reach * reach) {
          damagePlayer(w, H.fireDamage, DMG_FIRE);
          return;
        }
      }
    }
  }
}
