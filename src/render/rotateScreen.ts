/**
 * Portrait fallback: a friendly "rotate your phone" card drawn into its own small portrait
 * buffer (108×192), scaled up by the Display. The phone icon tips between upright and sideways.
 */

import { PHONE_SPRITE } from '../content/sprites/ui';
import { UI } from '../content/sprites/palette';
import { ctx2d, makeCanvas } from './canvas';
import { bakeText, type TextStyle } from './font';
import { getFrame, getRotated } from './sprites';

export const ROTATE_W = 108;
export const ROTATE_H = 192;

const TITLE: TextStyle = { color: UI.accent, shadow: UI.shadow };
const BODY: TextStyle = { color: UI.textDim, shadow: UI.shadow };

export class RotateScreen {
  readonly canvas = makeCanvas(ROTATE_W, ROTATE_H);
  private readonly ctx = ctx2d(this.canvas);
  /** Deterministic rain (x, speed, phase triples) so the card feels alive. */
  private readonly drops: number[] = [];
  private readonly title = bakeText('ROTATE YOUR\nPHONE', TITLE);
  private readonly body = bakeText('STORMDRAIN IS\nPLAYED SIDEWAYS.\n\nTHE GAME IS\nPAUSED.', BODY);

  constructor() {
    for (let i = 0; i < 24; i++) this.drops.push((i * 37) % ROTATE_W, 60 + ((i * 53) % 70), (i * 29) % ROTATE_H);
  }

  draw(time: number): HTMLCanvasElement {
    const ctx = this.ctx;
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, ROTATE_W, ROTATE_H);
    ctx.fillStyle = 'rgba(150,180,230,0.35)';
    for (let i = 0; i < this.drops.length; i += 3) {
      const y = (this.drops[i + 2]! + time * this.drops[i + 1]!) % (ROTATE_H + 10);
      const x = (((this.drops[i]! - y * 0.15) % ROTATE_W) + ROTATE_W) % ROTATE_W;
      ctx.fillRect(Math.round(x), Math.round(y) - 5, 1, 3);
    }

    // Tip the phone sideways for the second half of each 2 s cycle (drawn at 2×).
    const sideways = time % 2 > 1;
    const img = sideways ? getRotated(PHONE_SPRITE, 0, 1) : getFrame(PHONE_SPRITE, 0);
    const cx = ROTATE_W / 2;
    const cy = 62;
    const w = img.width * 2;
    const h = img.height * 2;
    ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
    // Curved arrow hint (a clockwise quarter turn) beside the phone.
    ctx.fillStyle = UI.accent;
    const ax = Math.round(cx + 24);
    const ay = cy - 26;
    ctx.fillRect(ax, ay, 5, 1);
    ctx.fillRect(ax + 5, ay + 1, 1, 1);
    ctx.fillRect(ax + 6, ay + 2, 1, 6);
    ctx.fillRect(ax + 4, ay + 6, 5, 1);
    ctx.fillRect(ax + 5, ay + 7, 3, 1);
    ctx.fillRect(ax + 6, ay + 8, 1, 1);

    ctx.drawImage(this.title, Math.round(cx - this.title.width / 2), 108);
    ctx.drawImage(this.body, Math.round(cx - this.body.width / 2), 134);
    return this.canvas;
  }
}
