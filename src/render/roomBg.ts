/**
 * Pre-renders a room's static background (walls, floor, pits, rocks, decals) into one 240×144
 * canvas. Rebuilt only when the grid changes (RoomGrid.version) — per frame it is one drawImage.
 */

import { Rng } from '../engine/rng';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import type { RoomGrid } from '../sim/room';
import { Tile } from '../sim/tiles';
import {
  CORNER_SPRITE,
  FLOOR_SPRITE,
  FLOOR_VARIANT,
  LEAF_SPRITE,
  PIT_SPRITE,
  PUDDLE_SPRITE,
  ROCK_SPRITE,
  WALL_SPRITE,
} from '../content/sprites/gutterways';
import { GUTTER } from '../content/sprites/palette';
import { ctx2d, makeCanvas } from './canvas';
import { ROOM_OUTER_H, ROOM_OUTER_W, WALL } from './layout';
import { fillPixelEllipse } from './pixel';
import { getFrame, getRotated } from './sprites';

export class RoomBackground {
  private canvas: HTMLCanvasElement | null = null;
  private version = -1;
  private seed = -1;

  get(room: RoomGrid): HTMLCanvasElement {
    if (!this.canvas || this.version !== room.version || this.seed !== room.styleSeed) {
      this.canvas = buildRoomBackground(room, this.canvas);
      this.version = room.version;
      this.seed = room.styleSeed;
    }
    return this.canvas;
  }
}

function isPit(room: RoomGrid, c: number, r: number): boolean {
  return room.get(c, r) === Tile.Pit;
}

export function buildRoomBackground(room: RoomGrid, reuse: HTMLCanvasElement | null = null): HTMLCanvasElement {
  const canvas = reuse ?? makeCanvas(ROOM_OUTER_W, ROOM_OUTER_H);
  const ctx = ctx2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rng = new Rng(room.styleSeed);

  // ── Walls ────────────────────────────────────────────────────────────────
  for (let c = 0; c < ROOM_COLS; c++) {
    const x = WALL + c * TILE;
    ctx.drawImage(getFrame(WALL_SPRITE, rng.chance(0.3) ? 1 : 0), x, 0);
    ctx.drawImage(getRotated(WALL_SPRITE, rng.chance(0.3) ? 1 : 0, 2), x, ROOM_OUTER_H - WALL);
  }
  for (let r = 0; r < ROOM_ROWS; r++) {
    const y = WALL + r * TILE;
    ctx.drawImage(getRotated(WALL_SPRITE, rng.chance(0.3) ? 1 : 0, 3), 0, y);
    ctx.drawImage(getRotated(WALL_SPRITE, rng.chance(0.3) ? 1 : 0, 1), ROOM_OUTER_W - WALL, y);
  }
  const corner = getFrame(CORNER_SPRITE, 0);
  ctx.drawImage(corner, 0, 0);
  ctx.drawImage(corner, ROOM_OUTER_W - WALL, 0);
  ctx.drawImage(corner, 0, ROOM_OUTER_H - WALL);
  ctx.drawImage(corner, ROOM_OUTER_W - WALL, ROOM_OUTER_H - WALL);

  // Rain streaks running down the top wall.
  ctx.fillStyle = 'rgba(120,150,190,0.16)';
  for (let i = 0; i < 9; i++) {
    const x = WALL + rng.int(0, ROOM_COLS * TILE - 1);
    const len = rng.int(4, 11);
    ctx.fillRect(x, rng.int(3, 5), 1, len);
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      const t = room.get(c, r);
      if (t === Tile.Pit) continue;
      const edge = r === 0 || c === 0 || r === ROOM_ROWS - 1 || c === ROOM_COLS - 1;
      const variant = rng.weightedIndex([45, 30, 12, edge ? 22 : 6, t === Tile.Floor ? 2.5 : 0]);
      ctx.drawImage(getFrame(FLOOR_SPRITE, variant < 0 ? FLOOR_VARIANT.plain : variant), x, y);
    }
  }

  // ── Pits (lip on the far/top edge, rims on open sides) ─────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      if (!isPit(room, c, r)) continue;
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      ctx.drawImage(getFrame(PIT_SPRITE, 0), x, y);
      if (!isPit(room, c, r - 1)) ctx.drawImage(getFrame(PIT_SPRITE, 1), x, y);
      // Side rims: the broken floor edge catches a little light.
      const top = isPit(room, c, r - 1) ? 0 : 1;
      ctx.fillStyle = '#323b52';
      if (!isPit(room, c - 1, r)) ctx.fillRect(x, y + top, 1, TILE - top);
      if (!isPit(room, c + 1, r)) ctx.fillRect(x + TILE - 1, y + top, 1, TILE - top);
      if (!isPit(room, c, r + 1)) {
        ctx.fillStyle = GUTTER.floorLight;
        ctx.fillRect(x, y + TILE - 1, TILE, 1);
      }
    }
  }

  // ── Ambient occlusion where the walls meet the floor ───────────────────────
  ctx.fillStyle = '#05060a';
  const shade: [number, number][] = [
    [0, 0.42],
    [1, 0.26],
    [2, 0.12],
  ];
  for (const [i, a] of shade) {
    ctx.globalAlpha = a;
    ctx.fillRect(WALL, WALL + i, ROOM_COLS * TILE, 1); // under the top wall (strongest)
    ctx.globalAlpha = a * 0.7;
    ctx.fillRect(WALL + i, WALL, 1, ROOM_ROWS * TILE); // left
    ctx.fillRect(ROOM_OUTER_W - WALL - 1 - i, WALL, 1, ROOM_ROWS * TILE); // right
    ctx.globalAlpha = a * 0.4;
    ctx.fillRect(WALL, ROOM_OUTER_H - WALL - 1 - i, ROOM_COLS * TILE, 1); // bottom
  }
  ctx.globalAlpha = 1;

  // ── Decals: puddles and fallen leaves on plain floor ───────────────────────
  const floorAt = (px: number, py: number): boolean =>
    room.get(Math.floor((px - WALL) / TILE), Math.floor((py - WALL) / TILE)) === Tile.Floor &&
    px >= WALL &&
    py >= WALL;
  const puddles = rng.int(1, 3);
  for (let i = 0; i < puddles; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const px = WALL + rng.int(2, ROOM_COLS * TILE - 14);
      const py = WALL + rng.int(4, ROOM_ROWS * TILE - 7);
      if (floorAt(px, py) && floorAt(px + 11, py) && floorAt(px, py + 4) && floorAt(px + 11, py + 4)) {
        ctx.drawImage(getFrame(PUDDLE_SPRITE, 0), px, py);
        break;
      }
    }
  }
  const leaves = rng.int(3, 7);
  for (let i = 0; i < leaves; i++) {
    for (let tries = 0; tries < 12; tries++) {
      const px = WALL + rng.int(1, ROOM_COLS * TILE - 7);
      const py = WALL + rng.int(1, ROOM_ROWS * TILE - 5);
      if (floorAt(px, py) && floorAt(px + 5, py + 3)) {
        ctx.drawImage(getFrame(LEAF_SPRITE, rng.int(0, 1)), px, py);
        break;
      }
    }
  }

  // ── Rocks (with contact shadows) ───────────────────────────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      if (room.get(c, r) !== Tile.Rock) continue;
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      ctx.fillStyle = 'rgba(4,5,10,0.35)';
      fillPixelEllipse(ctx, x + 8, y + 13, 7, 2);
      ctx.drawImage(getFrame(ROCK_SPRITE, rng.chance(0.5) ? 1 : 0), x, y);
    }
  }

  return canvas;
}
