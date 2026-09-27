/**
 * Base of the full-screen menu pages (character select, collection, bestiary, stats, achievements): pushed
 * over the title (which stays underneath, untouched), the darkened drain backdrop, a header with BACK and the
 * page title, keyboard focus (MenuNav) and Esc / Backspace = back. Button ids are `<page>.<name>`.
 */

import type { InputState } from '../engine/inputState';
import type { App } from './app';
import type { Scene } from './scene';
import { BTN_H, MenuNav, drawMenuButtons, drawPageHeader, pageBackdrop, tickButtons, uiButton, type UiButton } from './widgets';

export abstract class PageScene implements Scene {
  readonly name: string;
  readonly overlay: boolean = false;
  readonly wantsSticks = false;
  readonly buttons: UiButton[] = [];
  protected readonly app: App;
  protected readonly back: UiButton;
  protected readonly menu: MenuNav;
  protected time = 0;
  private readonly title: string;

  constructor(app: App, name: string, title: string) {
    this.app = app;
    this.name = name;
    this.title = title;
    this.back = uiButton({ id: `${name}.back`, label: 'BACK', x: 6, y: 5, w: 60, h: BTN_H, onActivate: () => this.goBack() });
    this.menu = new MenuNav(() => this.buttons);
    this.menu.onMove = () => app.audio.play('menu_move');
  }

  enter(): void {
    this.time = 0;
    this.menu.set(this.defaultFocus());
  }

  /** The button the keyboard focus starts on. */
  protected defaultFocus(): UiButton | null {
    return this.back;
  }

  protected goBack(): void {
    this.app.audio.play('ui_back');
    this.app.nav.back();
  }

  onKey(code: string): boolean {
    if (code === 'Escape' || code === 'Backspace') {
      this.goBack();
      return true;
    }
    return this.menu.onKey(code);
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
  }

  /** Backdrop + header. */
  protected drawBase(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(pageBackdrop(), 0, 0);
    drawPageHeader(ctx, this.title);
  }

  /** The visible buttons, then the keyboard focus ring. */
  protected drawButtons(ctx: CanvasRenderingContext2D, list: readonly UiButton[] = this.buttons): void {
    drawMenuButtons(ctx, list);
    this.menu.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
  }

  abstract render(ctx: CanvasRenderingContext2D, alpha: number): void;

  /** Test hook (`__SD.screen()`): what the page shows, as plain data. */
  describe?(): Record<string, unknown>;
}
