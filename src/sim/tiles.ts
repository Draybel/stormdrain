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

const BLOCK_WALK = 1;
const BLOCK_SHOT = 2;

const FLAGS = new Uint8Array(256);
FLAGS[Tile.Rock] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[Tile.RockTinted] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[Tile.Metal] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[Tile.Pit] = BLOCK_WALK; // marbles fly over pits
FLAGS[Tile.Crate] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[Tile.Urn] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[Tile.SecretWall] = BLOCK_WALK | BLOCK_SHOT;
FLAGS[WALL] = BLOCK_WALK | BLOCK_SHOT;

/**
 * Walking collision boxes are shrunk by this many px per side. Pits are generous (you can stand
 * on the lip), rocks slightly rounded so you slide around their corners instead of snagging.
 */
const WALK_INSET = new Float32Array(256);
WALK_INSET[Tile.Rock] = 1;
WALK_INSET[Tile.RockTinted] = 1;
WALK_INSET[Tile.Pit] = 3.5;
WALK_INSET[Tile.Urn] = 2;

export function blocksWalk(t: number): boolean {
  return (FLAGS[t]! & BLOCK_WALK) !== 0;
}

export function blocksShots(t: number): boolean {
  return (FLAGS[t]! & BLOCK_SHOT) !== 0;
}

export function walkInset(t: number): number {
  return WALK_INSET[t]!;
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
