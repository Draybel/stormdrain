/**
 * Pre-renders a room's static background (walls, floor, pits, rocks, props, decals, debris) into
 * one 240×144 canvas. Rebuilt only when the grid changes (RoomGrid.version) — per frame it is one
 * drawImage. Per-cell variation uses a positional hash (not a running RNG), so breaking a crate
 * never reshuffles the rest of the room's decoration. Fires are animated and drawn by the world
 * renderer on top of this.
 */

import { Rng, fmix32 } from '../engine/rng';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import type { RoomGrid } from '../sim/room';
import { Deco, Tile } from '../sim/tiles';
import { FLOOR_VARIANT } from '../content/sprites/gutterways';
import { CRATE_SPRITE, METAL_SPRITE, SPIKES_SPRITE, TINTED_ROCK_SPRITE, URN_SPRITE } from '../content/sprites/obstacles';
import { chapterArt, type ChapterArt } from './chapterArt';
import { ctx2d, makeCanvas } from './canvas';
import { ROOM_OUTER_H, ROOM_OUTER_W, WALL } from './layout';
import { fillPixelEllipse } from './pixel';
import { getFrame, getRotated } from './sprites';

export class RoomBackground {
  private canvas: HTMLCanvasElement | null = null;
  private version = -1;
  private seed = -1;
  private chapter = '';

  /** The room's background in its chapter's look (rebuilt when the grid, seed or chapter changes). */
  get(room: RoomGrid, chapter = 'gutterways'): HTMLCanvasElement {
    if (!this.canvas || this.version !== room.version || this.seed !== room.styleSeed || this.chapter !== chapter) {
      this.canvas = buildRoomBackground(room, chapterArt(chapter), this.canvas);
      this.version = room.version;
      this.seed = room.styleSeed;
      this.chapter = chapter;
    }
    return this.canvas;
  }
}

function isPit(room: RoomGrid, c: number, r: number): boolean {
  return room.get(c, r) === Tile.Pit;
}

/** Deterministic 0..1 value for a cell (+ salt), independent of every other cell. */
function cellRand(seed: number, c: number, r: number, salt: number): number {
  return fmix32((seed ^ Math.imul(c + 11, 0x9e3779b1) ^ Math.imul(r + 7, 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35)) >>> 0) / 4294967296;
}

function weightedPick(u: number, weights: readonly number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let x = u * total;
  for (let i = 0; i < weights.length; i++) {
    if (x < weights[i]!) return i;
    x -= weights[i]!;
  }
  return weights.length - 1;
}

export function buildRoomBackground(room: RoomGrid, art: ChapterArt, reuse: HTMLCanvasElement | null = null): HTMLCanvasElement {
  const canvas = reuse ?? makeCanvas(ROOM_OUTER_W, ROOM_OUTER_H);
  const ctx = ctx2d(canvas);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const seed = room.styleSeed;
  // Walls, streaks and decals consume this RNG in a fixed order (never depends on the tiles).
  const rng = new Rng(seed);

  // ── Walls ────────────────────────────────────────────────────────────────
  for (let c = 0; c < ROOM_COLS; c++) {
    const x = WALL + c * TILE;
    ctx.drawImage(getFrame(art.wall, rng.chance(0.3) ? 1 : 0), x, 0);
    ctx.drawImage(getRotated(art.wall, rng.chance(0.3) ? 1 : 0, 2), x, ROOM_OUTER_H - WALL);
  }
  for (let r = 0; r < ROOM_ROWS; r++) {
    const y = WALL + r * TILE;
    ctx.drawImage(getRotated(art.wall, rng.chance(0.3) ? 1 : 0, 3), 0, y);
    ctx.drawImage(getRotated(art.wall, rng.chance(0.3) ? 1 : 0, 1), ROOM_OUTER_W - WALL, y);
  }
  const corner = getFrame(art.corner, 0);
  ctx.drawImage(corner, 0, 0);
  ctx.drawImage(corner, ROOM_OUTER_W - WALL, 0);
  ctx.drawImage(corner, 0, ROOM_OUTER_H - WALL);
  ctx.drawImage(corner, ROOM_OUTER_W - WALL, ROOM_OUTER_H - WALL);

  // Streaks running down the top wall (rain, wax, soot…), then the chapter's wall trims.
  for (let i = 0; i < 9; i++) {
    const x = WALL + rng.int(0, ROOM_COLS * TILE - 1);
    const len = rng.int(4, 11);
    const y = rng.int(3, 5);
    if (art.streak) {
      ctx.fillStyle = art.streak;
      ctx.fillRect(x, y, 1, len);
    }
  }
  const trims = art.trims.length ? rng.int(1, 3) : 0;
  for (let i = 0; i < trims; i++) {
    const t = art.trims[rng.int(0, art.trims.length - 1)]!;
    // Anywhere along the top wall except over the door in the middle (cols 5-7).
    let col = rng.int(0, ROOM_COLS - 3);
    if (col >= 4) col += 3;
    ctx.drawImage(getFrame(t, rng.int(0, t.frames.length - 1)), WALL + col * TILE + ((TILE - t.w) >> 1), 2);
  }

  // ── Floor ────────────────────────────────────────────────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      const t = room.get(c, r);
      if (t === Tile.Pit) continue;
      const edge = r === 0 || c === 0 || r === ROOM_ROWS - 1 || c === ROOM_COLS - 1;
      const plainFloor = t === Tile.Floor && room.deco[r * ROOM_COLS + c] === Deco.None;
      const variant = weightedPick(cellRand(seed, c, r, 1), [45, 30, 12, edge ? 22 : 6, plainFloor ? 2.5 : 0]);
      ctx.drawImage(getFrame(art.floor, variant < 0 ? FLOOR_VARIANT.plain : variant), x, y);
    }
  }

  // ── Pits (lip on the far/top edge, rims on open sides) ─────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      if (!isPit(room, c, r)) continue;
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      ctx.drawImage(getFrame(art.pit, 0), x, y);
      if (!isPit(room, c, r - 1)) ctx.drawImage(getFrame(art.pit, 1), x, y);
      // Side rims: the broken floor edge catches a little light.
      const top = isPit(room, c, r - 1) ? 0 : 1;
      ctx.fillStyle = art.pitRim;
      if (!isPit(room, c - 1, r)) ctx.fillRect(x, y + top, 1, TILE - top);
      if (!isPit(room, c + 1, r)) ctx.fillRect(x + TILE - 1, y + top, 1, TILE - top);
      if (!isPit(room, c, r + 1)) {
        ctx.fillStyle = art.pitEdge;
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

  // ── Decals: the chapter's floor details (fixed rolls, drawn only where it's plain floor) ──────
  const floorAt = (px: number, py: number): boolean =>
    px >= WALL && py >= WALL && room.get(Math.floor((px - WALL) / TILE), Math.floor((py - WALL) / TILE)) === Tile.Floor;
  const decals = art.decals.length ? rng.int(art.decalCount[0], art.decalCount[1]) : 0;
  for (let i = 0; i < decals; i++) {
    const d = art.decals[rng.int(0, art.decals.length - 1)]!;
    const frame = rng.int(0, d.frames.length - 1);
    const px = WALL + rng.int(1, ROOM_COLS * TILE - d.w - 1);
    const py = WALL + rng.int(2, ROOM_ROWS * TILE - d.h - 1);
    if (floorAt(px, py) && floorAt(px + d.w - 1, py) && floorAt(px, py + d.h - 1) && floorAt(px + d.w - 1, py + d.h - 1)) {
      ctx.drawImage(getFrame(d, frame), px, py);
    }
  }

  // ── Debris left by destroyed things ────────────────────────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const d = room.deco[r * ROOM_COLS + c]!;
      if (d !== Deco.None) drawDebris(ctx, d, WALL + c * TILE, WALL + r * TILE, seed, c, r);
    }
  }

  // ── Props (with contact shadows) ───────────────────────────────────────────
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const t = room.get(c, r);
      const x = WALL + c * TILE;
      const y = WALL + r * TILE;
      switch (t) {
        case Tile.Rock:
        case Tile.SecretWall:
          contactShadow(ctx, x, y, 7);
          ctx.drawImage(getFrame(art.rock, cellRand(seed, c, r, 2) < 0.5 ? 1 : 0), x, y);
          if (t === Tile.SecretWall) drawCracks(ctx, x, y);
          break;
        case Tile.RockTinted:
          contactShadow(ctx, x, y, 7);
          ctx.drawImage(getFrame(TINTED_ROCK_SPRITE, 0), x, y);
          break;
        case Tile.Crate:
          contactShadow(ctx, x, y, 8);
          ctx.drawImage(getFrame(CRATE_SPRITE, room.hp[r * ROOM_COLS + c]! <= 1 ? 1 : 0), x, y);
          break;
        case Tile.Urn:
          contactShadow(ctx, x, y, 5);
          ctx.drawImage(getFrame(URN_SPRITE, 0), x, y);
          break;
        case Tile.Metal:
          ctx.drawImage(getFrame(METAL_SPRITE, 0), x, y);
          break;
        case Tile.Spikes:
          ctx.drawImage(getFrame(SPIKES_SPRITE, 0), x, y);
          break;
        case Tile.Fire:
          // Scorched stones under the (animated) fire basket.
          ctx.fillStyle = 'rgba(4,5,10,0.4)';
          fillPixelEllipse(ctx, x + 8, y + 12, 7, 3);
          break;
        default:
          break;
      }
    }
  }

  return canvas;
}

function contactShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number): void {
  ctx.fillStyle = 'rgba(4,5,10,0.35)';
  fillPixelEllipse(ctx, x + 8, y + 13, rx, 2);
}

function drawCracks(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#1a1f2c';
  ctx.fillRect(x + 7, y + 4, 1, 3);
  ctx.fillRect(x + 8, y + 7, 1, 2);
  ctx.fillRect(x + 6, y + 9, 2, 1);
  ctx.fillRect(x + 9, y + 9, 1, 3);
}

const RUBBLE = ['#5c6580', '#8691ad', '#3e455a'] as const;
const PLANKS = ['#9a6a3a', '#c89458', '#5e3c1e'] as const;
const SHARDS = ['#b8683a', '#e89a68', '#7a3e22'] as const;

/** Small scattered bits (seeded per cell) where a tile was destroyed. */
function drawDebris(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, seed: number, c: number, r: number): void {
  let salt = 10;
  const rand = (): number => cellRand(seed, c, r, salt++);
  if (kind === Deco.Ash || kind === Deco.Scorch) {
    ctx.fillStyle = 'rgba(10,8,12,0.45)';
    fillPixelEllipse(ctx, x + 8, y + 10, 6, 3);
    ctx.fillStyle = 'rgba(40,36,44,0.8)';
    for (let i = 0; i < 6; i++) ctx.fillRect(x + 3 + Math.floor(rand() * 10), y + 8 + Math.floor(rand() * 5), 1, 1);
    if (kind === Deco.Ash) {
      ctx.fillStyle = '#b83a1a';
      ctx.fillRect(x + 5 + Math.floor(rand() * 6), y + 9 + Math.floor(rand() * 3), 1, 1);
    }
    return;
  }
  const colors = kind === Deco.Planks ? PLANKS : kind === Deco.Shards ? SHARDS : RUBBLE;
  const n = kind === Deco.Planks ? 4 : 6;
  for (let i = 0; i < n; i++) {
    const px = x + 2 + Math.floor(rand() * 12);
    const py = y + 4 + Math.floor(rand() * 10);
    const w = kind === Deco.Planks ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
    const h = kind === Deco.Planks ? 1 : 1 + Math.floor(rand() * 2);
    ctx.fillStyle = 'rgba(4,5,10,0.35)';
    ctx.fillRect(px, py + 1, w, h);
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.fillRect(px, py, w, h);
  }
}
