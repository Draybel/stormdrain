/**
 * A menu page built around a scrolling grid of cells with a detail panel underneath (the collection, the
 * bestiary): drag / flick / wheel to scroll, tap a cell to read about it, arrows move the selection.
 */

import { GAME_W } from '../engine/screen';
import type { App } from './app';
import { PageScene } from './page';
import { Scroller, uiButton, type UiButton } from './widgets';

export const GRID_TOP = 40;
export const DETAIL_TOP = 150;

export abstract class GridPage<T> extends PageScene {
  protected entries: T[] = [];
  protected sel = 0;
  protected readonly area: UiButton;
  protected readonly scroll: Scroller;
  protected cell = 20;
  protected cols = 1;
  protected gridX = 6;
  protected gridW = GAME_W - 18;
  protected gridY = GRID_TOP;
  protected gridH = DETAIL_TOP - GRID_TOP - 4;

  constructor(app: App, name: string, title: string) {
    super(app, name, title);
    this.area = uiButton({ id: `${name}.grid`, x: 0, y: 0, w: 1, h: 1, pad: 0, draggable: true, nav: false });
    this.area.onActivate = () => this.tap(this.area.curX, this.area.curY);
    this.scroll = new Scroller(this.area);
  }

  /** Sets the entries and the cell size; lays the grid out. */
  protected setEntries(entries: T[], cell: number): void {
    this.entries = entries;
    this.cell = cell;
    this.cols = Math.max(1, Math.floor(this.gridW / cell));
    // Centre the columns in the area.
    const used = this.cols * cell;
    const x0 = 6 + Math.floor((GAME_W - 18 - used) / 2);
    this.gridX = x0;
    const a = this.area;
    a.x = 6;
    a.y = this.gridY;
    a.w = GAME_W - 12;
    a.h = this.gridH;
    this.scroll.setContent(Math.ceil(entries.length / this.cols) * cell, this.gridH);
    this.scroll.pos = 0;
    this.sel = Math.min(this.sel, Math.max(0, entries.length - 1));
  }

  private tap(x: number, y: number): void {
    const i = this.indexAt(x, y);
    if (i < 0) return;
    this.sel = i;
    this.app.audio.play('menu_move');
  }

  protected indexAt(x: number, y: number): number {
    const lx = x - this.gridX;
    const ly = y - this.gridY + this.scroll.pos;
    if (lx < 0 || ly < 0 || lx >= this.cols * this.cell) return -1;
    const i = Math.floor(ly / this.cell) * this.cols + Math.floor(lx / this.cell);
    return i < this.entries.length ? i : -1;
  }

  /** The keyboard starts in the grid (no header button focused). */
  override enter(): void {
    super.enter();
    this.menu.focus = null;
  }

  /**
   * Keys: with no header button focused the arrows move the selection through the grid (up from the top row
   * focuses BACK); with a header button focused, down returns to the grid and the rest is MenuNav.
   */
  override onKey(code: string): boolean {
    const n = this.entries.length;
    if (code === 'PageDown' || code === 'PageUp') {
      this.scroll.by(code === 'PageDown' ? this.gridH - this.cell : -(this.gridH - this.cell));
      return true;
    }
    const inGrid = this.menu.current() === null;
    if (!inGrid) {
      if (code === 'ArrowDown' && n > 0) {
        this.menu.focus = null;
        this.app.audio.play('menu_move');
        return true;
      }
      return super.onKey(code);
    }
    let step = 0;
    if (code === 'ArrowLeft') step = -1;
    else if (code === 'ArrowRight') step = 1;
    else if (code === 'ArrowUp') step = -this.cols;
    else if (code === 'ArrowDown') step = this.cols;
    if (step === 0 || n === 0) return super.onKey(code);
    if (code === 'ArrowUp' && this.sel < this.cols) {
      this.menu.set(this.back);
      this.app.audio.play('menu_move');
      return true;
    }
    const next = Math.max(0, Math.min(n - 1, this.sel + step));
    if (next !== this.sel) {
      this.sel = next;
      this.app.audio.play('menu_move');
      this.scroll.reveal(Math.floor(next / this.cols) * this.cell, this.cell, this.gridH);
    }
    return true;
  }

  onWheel(dy: number): void {
    this.scroll.by(dy * 0.35);
  }

  override update(dt: number, input: Parameters<PageScene['update']>[1]): void {
    super.update(dt, input);
    this.scroll.update(dt);
  }

  /** Draws the visible cells (clipped) and the scroll bar. */
  protected drawGrid(ctx: CanvasRenderingContext2D): void {
    const c = this.cell;
    const s = this.scroll.pos;
    ctx.save();
    ctx.beginPath();
    ctx.rect(4, this.gridY - 1, GAME_W - 8, this.gridH + 1);
    ctx.clip();
    const first = Math.max(0, Math.floor(s / c) * this.cols);
    const last = Math.min(this.entries.length, Math.ceil((s + this.gridH) / c) * this.cols);
    const a = this.area;
    const pressed = a.held > 0 && !a.dragged ? this.indexAt(a.downX, a.downY) : -1;
    for (let i = first; i < last; i++) {
      const x = this.gridX + (i % this.cols) * c;
      const y = Math.round(this.gridY + Math.floor(i / this.cols) * c - s);
      this.drawCell(ctx, this.entries[i]!, x, y, i === this.sel, i === pressed);
    }
    ctx.restore();
    this.scroll.drawBar(ctx, GAME_W - 7, this.gridY, this.gridH);
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(6, DETAIL_TOP - 3, GAME_W - 12, 1);
  }

  protected abstract drawCell(ctx: CanvasRenderingContext2D, e: T, x: number, y: number, selected: boolean, pressed: boolean): void;
}
