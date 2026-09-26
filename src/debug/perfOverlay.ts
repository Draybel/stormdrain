/**
 * Perf overlay (toggle: ` key, or a three-finger tap on touch screens): fps, update/render cost,
 * object counts. Text is rebuilt 4×/s so the overlay itself stays cheap.
 */

import { drawText, LINE_H, measureText, type TextStyle } from '../render/font';

const STYLE: TextStyle = { color: '#b8f0a8' };

export class PerfOverlay {
  visible = false;
  private lines: string[] = [];
  private acc = 1;
  private width = 0;

  update(dt: number, sample: () => string[]): void {
    if (!this.visible) return;
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    this.lines = sample();
    this.width = 0;
    for (const l of this.lines) this.width = Math.max(this.width, measureText(l));
  }

  toggle(): boolean {
    this.visible = !this.visible;
    this.acc = 1;
    return this.visible;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || this.lines.length === 0) return;
    const x = 4;
    const y = 30;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 2, y - 2, this.width + 4, this.lines.length * LINE_H + 2);
    ctx.globalAlpha = 1;
    for (let i = 0; i < this.lines.length; i++) drawText(ctx, this.lines[i]!, x, y + i * LINE_H, STYLE);
  }
}
