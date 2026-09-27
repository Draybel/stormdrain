/**
 * Presentation for floor-run transitions (drawn by the run scene; the sim is frozen meanwhile):
 * - the iris: a black screen with a circular hole (a pre-rendered 64×64 mask scaled with nearest
 *   neighbour, so the edge stays pixelly) closing on Wren as she drops through the trapdoor and
 *   opening on the next floor;
 * - the floor card: 'CHAPTER N · NAME', the floor number and the floor's curse (its name and what it does).
 */

import { CURSE_HINTS, CURSE_ICONS, CURSE_NAMES } from '../content/sprites/mapIcons';
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
const CARD_HINT: TextStyle = { color: '#9a86a8', shadow: '#07080d' };

const DOT_PAST = '#c98a1e';
const DOT_NEXT = '#2a3350';
const DOT_ALT = '#b06ad8';
const DOT_HERE = '#fff3c4';

/**
 * The floor card over the room (alpha 0..1; `t` = seconds since it appeared). Phase 4B polish: the band opens
 * from its centre line, the title slides in from the left and the floor line from the right, and a row of
 * twelve floor marks (paired by chapter; the thirteenth only on floor 13) shows how deep the run is — floors
 * behind in gold, this one lit and pulsing (violet on the hidden route), the rest dark.
 */
export function drawFloorCard(
  ctx: CanvasRenderingContext2D,
  title: string,
  sub: string,
  curse: FloorCurse | null,
  alpha: number,
  t = 1,
  floor = 0,
  alt = false,
): void {
  if (alpha <= 0) return;
  const fullH = (curse ? 52 : 34) + (floor > 0 ? 8 : 0);
  const yc = 74 + fullH / 2;
  const open = Math.min(1, t / 0.22);
  const h = Math.max(2, Math.round(fullH * open * (2 - open)));
  const y = Math.round(yc - h / 2);
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, y, GAME_W, h);
  ctx.fillStyle = '#ffcf57';
  ctx.fillRect(0, y, GAME_W, 1);
  ctx.fillRect(0, y + h - 1, GAME_W, 1);
  if (open < 1) {
    ctx.globalAlpha = 1;
    return;
  }
  const k = Math.min(1, Math.max(0, (t - 0.16) / 0.3));
  const e = k * (2 - k);
  const top = Math.round(yc - fullH / 2);
  ctx.globalAlpha = alpha * e;
  drawTextCentered(ctx, title, GAME_W / 2 - Math.round((1 - e) * 36), top + 6, CARD_TITLE);
  drawTextCentered(ctx, sub, GAME_W / 2 + Math.round((1 - e) * 36), top + 22, CARD_SUB);
  let ry = top + 31;
  if (floor > 0) {
    const n = floor >= 13 ? 13 : 12;
    const step = 7;
    const width = (n - 1) * step + Math.floor((n - 1) / 2) * 3;
    const x0 = Math.round(GAME_W / 2 - width / 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * step + Math.floor(i / 2) * 3;
      const f = i + 1;
      if (f === floor) {
        const pulse = Math.floor(t * 4) % 2 === 0;
        ctx.fillStyle = alt ? DOT_ALT : DOT_HERE;
        ctx.fillRect(x - 1, ry - 1, 4, 4);
        if (pulse) {
          ctx.fillStyle = '#ffcf57';
          ctx.fillRect(x - 2, ry + 3, 6, 1);
        }
      } else {
        ctx.fillStyle = f < floor ? DOT_PAST : DOT_NEXT;
        ctx.fillRect(x, ry, 2, 2);
      }
    }
    ry += 8;
  }
  if (curse) {
    const name = CURSE_NAMES[curse];
    const w = measureText(name) + 10;
    const x = Math.round((GAME_W - w) / 2);
    drawSprite(ctx, CURSE_ICONS[curse], 0, x, ry);
    drawTextCentered(ctx, name, GAME_W / 2 + 5, ry + 1, CARD_CURSE);
    drawTextCentered(ctx, CURSE_HINTS[curse], GAME_W / 2, ry + 10, CARD_HINT);
  }
  ctx.globalAlpha = 1;
}
