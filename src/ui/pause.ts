/**
 * Pause overlay: dims the frozen run; Resume / Quit to title.
 * Secret: tapping the PAUSED title 5 times (each within 1.5 s of the last) opens the debug menu.
 */

import { makeButton, type HitButton } from '../engine/buttons';
import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import { drawTextCentered, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import type { App } from './app';
import type { Scene } from './scene';
import { drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: UI.accent, shadow: '#243052', outline: '#0d0b14', scale: 3 };
const NOTE: TextStyle = { color: UI.textDim, shadow: UI.shadow };

const PANEL_W = 160;
const PANEL_H = 116;
/** Taps on the title that open the debug menu, and the most time allowed between two of them. */
const SECRET_TAPS = 5;
const SECRET_GAP = 1.5;

export class PauseScene implements Scene {
  readonly name = 'pause';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: HitButton[];
  private readonly menu: UiButton[];
  private readonly app: App;
  private time = 0;
  private taps = 0;
  private lastTap = -9;

  constructor(app: App) {
    this.app = app;
    const px = (GAME_W - PANEL_W) / 2;
    const py = (GAME_H - PANEL_H) / 2;
    const bw = PANEL_W - 28;
    this.menu = [
      uiButton({
        id: 'pause.resume',
        label: 'RESUME',
        kind: 'primary',
        x: px + 14,
        y: py + 40,
        w: bw,
        h: 28,
        onActivate: () => {
          app.audio.play('ui_click');
          app.nav.resume();
        },
      }),
      uiButton({
        id: 'pause.quit',
        label: 'QUIT TO TITLE',
        x: px + 14,
        y: py + 76,
        w: bw,
        h: 26,
        onActivate: () => {
          app.audio.play('ui_back');
          app.nav.title();
        },
      }),
    ];
    // Invisible hit area over the PAUSED title (press-triggered so quick taps all count).
    const secret = makeButton({ id: 'pause.title', x: px + 20, y: py + 6, w: PANEL_W - 40, h: 24, pad: 2, trigger: 'press' });
    secret.onActivate = () => this.titleTap();
    this.buttons = [...this.menu, secret];
  }

  private titleTap(): void {
    this.taps = this.time - this.lastTap <= SECRET_GAP ? this.taps + 1 : 1;
    this.lastTap = this.time;
    if (this.taps >= SECRET_TAPS) {
      this.taps = 0;
      this.app.nav.debug();
    }
  }

  enter(): void {
    this.time = 0;
    this.app.audio.music.muffle(true);
  }

  exit(): void {
    this.app.audio.music.muffle(false);
  }

  onKey(code: string): boolean {
    if (code === 'Escape' || code === 'KeyP' || code === 'Enter' || code === 'Space') {
      this.menu[0]!.onActivate?.();
      return true;
    }
    if (code === 'KeyQ') {
      this.menu[1]!.onActivate?.();
      return true;
    }
    return false;
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.menu, dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.min(0.7, this.time * 6);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
    const px = (GAME_W - PANEL_W) / 2;
    const py = (GAME_H - PANEL_H) / 2;
    drawPanel(ctx, px, py, PANEL_W, PANEL_H, UI.panel, UI.border, UI.panelLight);
    drawTextCentered(ctx, 'PAUSED', GAME_W / 2, py + 12, TITLE);
    drawMenuButtons(ctx, this.menu);
    drawTextCentered(ctx, 'THE RAIN WILL WAIT.', GAME_W / 2, py + PANEL_H + 6, NOTE);
  }
}
