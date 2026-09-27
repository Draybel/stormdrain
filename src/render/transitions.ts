/**
 * Presentation for floor-run transitions (drawn by the run scene; the sim is frozen meanwhile):
 * - the iris: a black screen with a circular hole (a pre-rendered 64×64 mask scaled with nearest
 *   neighbour, so the edge stays pixelly) closing on Wren as she drops through the trapdoor and
 *   opening on the next floor;
 * - the floor card: 'CHAPTER N · NAME', the floor number and the floor's curse.
 */

import { CURSE_ICONS, CURSE_NAMES } from '../content/sprites/mapIcons';
import type { FloorCurse } from '../sim/floor/types';
import { ctx2d, makeCanvas } from './canvas';
import { drawTextCentered, measureText, type TextStyle } from './font';
import { GAME_H, GAME_W } from './layout';
import { drawSprite } from './sprites';

let mask: HTMLCanvasElement | null = null;

function irisMask(): HTMLCanvasElement {
  if (mask) return mask;
  const S = 64;
  mask = makeCanvas(S, S);
  const g = ctx2d(mask);
  g.fillStyle = '#000';
  g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  const r = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - r;
      const dy = y + 0.5 - r;
      if (dx * dx + dy * dy < r * r) img.data[(y * S + x) * 4 + 3] = 0;
    }
  }
  g.putImageData(img, 0, 0);
  return mask;
}

/** Black everywhere except a circle of radius r around (cx, cy). */
export function drawIris(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.fillStyle = '#000';
  if (r < 1) {
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    return;
  }
  const x0 = Math.round(cx - r);
  const y0 = Math.round(cy - r);
  const d = Math.round(r * 2);
  ctx.drawImage(irisMask(), x0, y0, d, d);
  if (y0 > 0) ctx.fillRect(0, 0, GAME_W, y0);
  if (y0 + d < GAME_H) ctx.fillRect(0, y0 + d, GAME_W, GAME_H - y0 - d);
  if (x0 > 0) ctx.fillRect(0, y0, x0, d);
  if (x0 + d < GAME_W) ctx.fillRect(x0 + d, y0, GAME_W - x0 - d, d);
}

const CARD_TITLE: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08', outline: '#07080d', scale: 2 };
const CARD_SUB: TextStyle = { color: '#c9d3f0', shadow: '#07080d' };
const CARD_CURSE: TextStyle = { color: '#e08ad8', shadow: '#07080d' };

/** The floor card over the room (alpha 0..1). */
export function drawFloorCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
  curse: FloorCurse | null,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const y = 74;
  const h = curse ? 44 : 34;
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, y, GAME_W, h);
  ctx.fillStyle = '#ffcf57';
  ctx.fillRect(0, y, GAME_W, 1);
  ctx.fillRect(0, y + h - 1, GAME_W, 1);
  ctx.globalAlpha = alpha;
  drawTextCentered(ctx, title, GAME_W / 2, y + 6, CARD_TITLE);
  drawTextCentered(ctx, sub, GAME_W / 2, y + 22, CARD_SUB);
  if (curse) {
    const name = CURSE_NAMES[curse];
    const w = measureText(name) + 10;
    const x = Math.round((GAME_W - w) / 2);
    drawSprite(ctx, CURSE_ICONS[curse], 0, x, y + 31);
    drawTextCentered(ctx, name, GAME_W / 2 + 5, y + 32, CARD_CURSE);
  }
  ctx.globalAlpha = 1;
}
