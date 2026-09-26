/**
 * Grid tile types (ARCHITECTURE §3) and their collision properties.
 * Numeric ids so the grid is a compact Uint8Array.
 */

export const Tile = {
  Floor: 0,
  Rock: 1,
  RockTinted: 2,
  Metal: 3,
  Pit: 4,
  Spikes: 5,
  Fire: 6,
  Crate: 7,
  Urn: 8,
  SecretWall: 9,
} as const;

export type TileId = (typeof Tile)[keyof typeof Tile];

/** Pseudo tile returned for cells outside the 13×7 interior: the room's walls. */
export const WALL = 255;

/**
 * Collision masks. Movers pick one:
 * - WALK: the player and pickups on foot (pits block);
 * - SHOT: marbles (pits don't block — shots fly over them);
 * - FLY: flying players (cross pits; rocks and props still block);
 * - PHASE: shots with the future 'phase' modifier / spectral flag (only walls block).
 */
const BLOCK_WALK = 1;
const BLOCK_SHOT = 2;
const BLOCK_FLY = 4;
const BLOCK_PHASE = 8;

const FLAGS = new Uint8Array(256);
FLAGS[Tile.Rock] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.RockTinted] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.Metal] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.Pit] = BLOCK_WALK; // marbles and flyers pass over pits
FLAGS[Tile.Fire] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.Crate] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.Urn] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY;
FLAGS[Tile.SecretWall] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY | BLOCK_PHASE;
FLAGS[WALL] = BLOCK_WALK | BLOCK_SHOT | BLOCK_FLY | BLOCK_PHASE;

/** Collision mode id → mask bit (index = CollideMode in collision.ts). */
export const MODE_MASK: readonly number[] = [BLOCK_WALK, BLOCK_SHOT, BLOCK_FLY, BLOCK_PHASE];

/**
 * Walking collision boxes are shrunk by this many px per side. Pits are generous (you can stand
 * on the lip), rocks slightly rounded so you slide around their corners instead of snagging.
 */
const WALK_INSET = new Float32Array(256);
WALK_INSET[Tile.Rock] = 1;
WALK_INSET[Tile.RockTinted] = 1;
WALK_INSET[Tile.Pit] = 3.5;
WALK_INSET[Tile.Urn] = 2;
WALK_INSET[Tile.Fire] = 2;

export function blocksWalk(t: number): boolean {
  return (FLAGS[t]! & BLOCK_WALK) !== 0;
}

export function blocksShots(t: number): boolean {
  return (FLAGS[t]! & BLOCK_SHOT) !== 0;
}

export function blocksMask(t: number, mask: number): boolean {
  return (FLAGS[t]! & mask) !== 0;
}

export function walkInset(t: number): number {
  return WALK_INSET[t]!;
}

/** Hits a tile absorbs before it breaks (shots). 0 = not destroyed by shots. */
export const TILE_HP: Readonly<Partial<Record<TileId, number>>> = {
  [Tile.Crate]: 2,
  [Tile.Urn]: 1,
  [Tile.Fire]: 4,
};

/** Destroyed (or put out) by explosions. */
export function bombBreakable(t: number): boolean {
  return (
    t === Tile.Rock || t === Tile.RockTinted || t === Tile.Crate || t === Tile.Urn || t === Tile.Fire || t === Tile.SecretWall
  );
}

/** Damaged by shots (hp counts hits). */
export function shotBreakable(t: number): boolean {
  return t === Tile.Crate || t === Tile.Urn || t === Tile.Fire;
}

/** Room template legend for tiles (ARCHITECTURE §5). Non-tile markers are handled by the parser. */
export const TILE_CHARS: Readonly<Record<string, TileId>> = {
  '.': Tile.Floor,
  '#': Tile.Rock,
  $: Tile.RockTinted,
  M: Tile.Metal,
  O: Tile.Pit,
  '^': Tile.Spikes,
  f: Tile.Fire,
  x: Tile.Crate,
  u: Tile.Urn,
};

/** Cosmetic floor marks left where something was destroyed (RoomGrid.deco). */
export const Deco = {
  None: 0,
  Rubble: 1,
  Planks: 2,
  Shards: 3,
  Ash: 4,
  Scorch: 5,
} as const;
