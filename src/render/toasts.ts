/**
 * Toasts (achievement unlocks, save notices): a slim pixel banner that slides up over the bottom wall,
 * one at a time from a small queue, over every scene (main.ts draws it after the scene stack). It is
 * never a button and never covers the room's interior, so it never blocks play.
 */

import { NOTICE_ICON, TROPHY_ICON } from '../content/sprites/metaIcons';
import { UI } from '../content/sprites/palette';
import { bakeText, measureText, type TextStyle } from './font';
import { GAME_H, GAME_W, ROOM_OUTER_W } from './layout';
import { drawPanel } from './pixel';
import { drawSprite } from './sprites';

export const TOAST_ACHIEVEMENT = 0;
export const TOAST_NOTICE = 1;

const TITLE: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08' };
const TITLE_NOTICE: TextStyle = { color: '#b9d6f0', shadow: UI.shadow };
const LINE: TextStyle = { color: UI.text, shadow: UI.shadow };

const H = 17;
const IN = 0.22;
const HOLD = 3.2;
const OUT = 0.3;
const QUEUE_MAX = 8;

interface Toast {
  kind: number;
  title: string;
  line: string;
}

export class ToastLayer {
  private readonly queue: Toast[] = [];
  private cur: Toast | null = null;
  private t = 0;
  private titleImg: HTMLCanvasElement | null = null;
  private lineImg: HTMLCanvasElement | null = null;
  private w = 0;
  /** Called when a toast starts showing (the app plays its sound). */
  onShow: ((kind: number) => void) | null = null;

  /** Queues a toast (the oldest waiting one is dropped when the queue is full). */
  push(kind: number, title: string, line = ''): void {
    if (this.queue.length >= QUEUE_MAX) this.queue.shift();
    this.queue.push({ kind, title: title.toUpperCase(), line: line.toUpperCase() });
  }

  /** The toast on screen (tests / __SD), or null. */
  get showing(): { kind: number; title: string; line: string } | null {
    return this.cur;
  }

  get pending(): number {
    return this.queue.length + (this.cur ? 1 : 0);
  }

  update(dt: number): void {
    if (this.cur) {
      this.t += dt;
      if (this.t >= IN + HOLD + OUT) this.cur = null;
    }
    if (!this.cur && this.queue.length > 0) {
      const c = this.queue.shift()!;
      this.cur = c;
      this.t = 0;
      this.titleImg = bakeText(c.title, c.kind === TOAST_ACHIEVEMENT ? TITLE : TITLE_NOTICE, 'left');
      this.lineImg = c.line ? bakeText(c.line, LINE, 'left') : null;
      this.w = Math.min(ROOM_OUTER_W, Math.max(measureText(c.title), c.line ? measureText(c.line) : 0) + 24);
      this.onShow?.(c.kind);
    }
  }

  /**
   * `atTop`: slide down from the top edge instead (screens whose buttons sit along the bottom — game over,
   * the endings — ask for it through `Scene.toastsAtTop`).
   */
  draw(ctx: CanvasRenderingContext2D, atTop = false): void {
    const c = this.cur;
    if (!c) return;
    const t = this.t;
    const k = t < IN ? t / IN : t > IN + HOLD ? Math.max(0, 1 - (t - IN - HOLD) / OUT) : 1;
    const e = k * k * (3 - 2 * k);
    const x = Math.round((GAME_W - this.w) / 2);
    const y = atTop ? Math.round(-H + e * (H + 1)) : Math.round(GAME_H - e * (H + 1));
    ctx.globalAlpha = 0.94;
    drawPanel(ctx, x, y, this.w, H, '#141a2a', c.kind === TOAST_ACHIEVEMENT ? '#e0a020' : '#56648a', '#2a3350');
    ctx.globalAlpha = 1;
    drawSprite(ctx, c.kind === TOAST_ACHIEVEMENT ? TROPHY_ICON : NOTICE_ICON, 0, x + 4, y + 4);
    const tx = x + 16;
    const title = this.titleImg!;
    const line = this.lineImg;
    // A one-liner sits in the middle; with a second line the title goes on top.
    ctx.drawImage(title, tx, line ? y + 2 : y + 5);
    if (line) ctx.drawImage(line, tx, y + 9);
    // A glint across the panel as it arrives.
    if (t < 0.5) {
      const gx = x + Math.round((t / 0.5) * (this.w + 12)) - 6;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.max(x + 1, gx), y + 1, 2, H - 2);
      ctx.globalAlpha = 1;
    }
  }
}
