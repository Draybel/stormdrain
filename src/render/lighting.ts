/**
 * Curse of the Blackout (darkness): the room goes dark except for a pool of light around Wren (and the glow of fires,
 * the trapdoor and item pedestals). One offscreen canvas the size of the room: fill it dark, punch
 * pre-rendered radial "light" sprites out of it (destination-out), draw it over the world — a handful
 * of drawImage calls per frame, no gradients built per frame.
 */

import { ROOM_COLS, ROOM_ROWS, TILE } from '../sim/constants';
import { Tile } from '../sim/tiles';
import type { World } from '../sim/world';
import { ctx2d, makeCanvas } from './canvas';
import { ROOM_OUTER_H, ROOM_OUTER_W, ROOM_OUTER_X, ROOM_OUTER_Y, ROOM_X, ROOM_Y } from './layout';

/** A soft round light: opaque in the middle, fading to nothing at radius r. */
function lightSprite(r: number, core: number): HTMLCanvasElement {
  const c = makeCanvas(r * 2, r * 2);
  const g = ctx2d(c);
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(core, 'rgba(0,0,0,0.95)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, r * 2, r * 2);
  return c;
}

const PLAYER_R = 54;
const FIRE_R = 34;
const SMALL_R = 18;

export class DarknessLayer {
  private canvas: HTMLCanvasElement | null = null;
  private g: CanvasRenderingContext2D | null = null;
  private player: HTMLCanvasElement | null = null;
  private fire: HTMLCanvasElement | null = null;
  private small: HTMLCanvasElement | null = null;

  /** @param px,py the player's screen position (shake included) */
  draw(ctx: CanvasRenderingContext2D, world: World, px: number, py: number, sx: number, sy: number, time: number): void {
    if (!this.canvas) {
      this.canvas = makeCanvas(ROOM_OUTER_W, ROOM_OUTER_H);
      this.g = ctx2d(this.canvas);
      this.player = lightSprite(PLAYER_R, 0.35);
      this.fire = lightSprite(FIRE_R, 0.25);
      this.small = lightSprite(SMALL_R, 0.2);
    }
    const g = this.g!;
    const bx = ROOM_OUTER_X + sx;
    const by = ROOM_OUTER_Y + sy;
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, ROOM_OUTER_W, ROOM_OUTER_H);
    g.fillStyle = 'rgba(2,3,8,0.93)';
    g.fillRect(0, 0, ROOM_OUTER_W, ROOM_OUTER_H);
    g.globalCompositeOperation = 'destination-out';
    // Wren's light breathes a little.
    g.globalAlpha = 0.92 + 0.08 * Math.sin(time * 2.3);
    g.drawImage(this.player!, Math.round(px - bx - PLAYER_R), Math.round(py - by - 6 - PLAYER_R));
    g.globalAlpha = 1;
    const room = world.room;
    const ox = ROOM_X - ROOM_OUTER_X;
    const oy = ROOM_Y - ROOM_OUTER_Y;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        if (room.tiles[r * ROOM_COLS + c] !== Tile.Fire) continue;
        g.globalAlpha = 0.8 + 0.2 * Math.sin(time * 11 + c * 1.7 + r);
        g.drawImage(this.fire!, ox + c * TILE + 8 - FIRE_R, oy + r * TILE + 6 - FIRE_R);
      }
    }
    g.globalAlpha = 0.7;
    const peds = world.pedestals;
    for (let i = 0; i < peds.count; i++) {
      const p = peds.items[i]!;
      if (p.item) g.drawImage(this.small!, Math.round(ox + p.x - SMALL_R), Math.round(oy + p.y - 10 - SMALL_R));
    }
    const t = world.trapdoor;
    if (t.active) g.drawImage(this.small!, Math.round(ox + t.x - SMALL_R), Math.round(oy + t.y - SMALL_R));
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.canvas, bx, by);
  }
}
