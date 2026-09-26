/** The 13×7 tile grid of the current room. */

import { ROOM_COLS, ROOM_ROWS, TILE } from './constants';
import { TILE_CHARS, TILE_HP, Tile, WALL, blocksShots, blocksWalk, type TileId } from './tiles';

export class RoomGrid {
  readonly cols = ROOM_COLS;
  readonly rows = ROOM_ROWS;
  readonly tiles = new Uint8Array(ROOM_COLS * ROOM_ROWS);
  /** Hits left for shot-breakable tiles (crates, urns, fires); see TILE_HP. */
  readonly hp = new Uint8Array(ROOM_COLS * ROOM_ROWS);
  /** Cosmetic floor marks (Deco) left where something was destroyed. */
  readonly deco = new Uint8Array(ROOM_COLS * ROOM_ROWS);
  /** Bumped on every tile change so render caches know to rebuild. */
  version = 0;
  /** Seed for cosmetic variation (floor decals etc.). */
  styleSeed = 0;

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows;
  }

  /** Tile at a cell; cells outside the interior are the room's walls (WALL). */
  get(col: number, row: number): number {
    if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return WALL;
    return this.tiles[row * this.cols + col]!;
  }

  set(col: number, row: number, t: TileId): void {
    if (!this.inBounds(col, row)) return;
    const i = row * this.cols + col;
    this.tiles[i] = t;
    this.hp[i] = TILE_HP[t] ?? 0;
    this.version++;
  }

  fill(t: TileId): void {
    this.tiles.fill(t);
    this.hp.fill(TILE_HP[t] ?? 0);
    this.deco.fill(0);
    this.version++;
  }

  /** Tile under a room-local pixel position. */
  tileAt(x: number, y: number): number {
    return this.get(Math.floor(x / TILE), Math.floor(y / TILE));
  }

  blocksWalkAt(col: number, row: number): boolean {
    return blocksWalk(this.get(col, row));
  }

  blocksShotsAt(col: number, row: number): boolean {
    return blocksShots(this.get(col, row));
  }
}

/** A non-tile character found while parsing a room layout (spawns, markers). */
export interface RoomMarker {
  ch: string;
  col: number;
  row: number;
}

/**
 * Parses a 7-row × 13-column layout into `grid`. Tile characters come from TILE_CHARS; any other
 * non-space character becomes floor plus a marker returned to the caller. Throws on bad shapes.
 */
export function parseRoomLayout(rows: readonly string[], grid: RoomGrid): RoomMarker[] {
  if (rows.length !== ROOM_ROWS) throw new Error(`room layout needs ${ROOM_ROWS} rows, got ${rows.length}`);
  const markers: RoomMarker[] = [];
  grid.tiles.fill(Tile.Floor);
  grid.hp.fill(0);
  grid.deco.fill(0);
  for (let r = 0; r < ROOM_ROWS; r++) {
    const line = rows[r]!;
    if (line.length !== ROOM_COLS) throw new Error(`room row ${r} needs ${ROOM_COLS} chars: "${line}"`);
    for (let c = 0; c < ROOM_COLS; c++) {
      const ch = line[c]!;
      const t = TILE_CHARS[ch];
      if (t !== undefined) {
        grid.tiles[r * ROOM_COLS + c] = t;
        grid.hp[r * ROOM_COLS + c] = TILE_HP[t] ?? 0;
      } else {
        markers.push({ ch, col: c, row: r });
      }
    }
  }
  grid.version++;
  return markers;
}

/** Centre of a cell in room-local px. */
export function cellCenterX(col: number): number {
  return col * TILE + TILE / 2;
}

export function cellCenterY(row: number): number {
  return row * TILE + TILE / 2;
}
