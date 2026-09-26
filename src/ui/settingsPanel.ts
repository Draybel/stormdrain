/**
 * Settings panel (overlay). Phase 1 stub: aim mode, button size, screen shake.
 * Full settings (volumes, left-handed, save export) arrive in Phase 4.
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import { BUTTON_SCALES, SHAKE_LEVELS, cycle } from '../meta/settings';
import { drawTextCentered, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import type { App } from './app';
import type { Scene } from './scene';
import { drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: UI.accent, shadow: UI.shadow, scale: 2 };
const NOTE: TextStyle = { color: UI.textDim, shadow: UI.shadow };

const PANEL_W = 208;
const PANEL_H = 160;

export class SettingsScene implements Scene {
  readonly name = 'settings';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly aim: UiButton;
  private readonly size: UiButton;
  private readonly shake: UiButton;

  constructor(app: App) {
    this.app = app;
    const px = (GAME_W - PANEL_W) / 2;
    const py = (GAME_H - PANEL_H) / 2;
    const bw = PANEL_W - 24;
    const bx = px + 12;
    const row = (i: number): number => py + 30 + i * 30;
    const click = (fn: () => void) => () => {
      app.audio.play('ui_click');
      fn();
      this.refreshLabels();
    };
    this.aim = uiButton({
      id: 'settings.aim',
      x: bx,
      y: row(0),
      w: bw,
      h: 26,
      textScale: 2,
      onActivate: click(() => app.settings.update({ aim360: !app.settings.value.aim360 })),
    });
    this.size = uiButton({
      id: 'settings.buttons',
      x: bx,
      y: row(1),
      w: bw,
      h: 26,
      textScale: 2,
      onActivate: click(() => app.settings.update({ buttonScale: cycle(BUTTON_SCALES, app.settings.value.buttonScale as (typeof BUTTON_SCALES)[number]) })),
    });
    this.shake = uiButton({
      id: 'settings.shake',
      x: bx,
      y: row(2),
      w: bw,
      h: 26,
      textScale: 2,
      onActivate: click(() => app.settings.update({ shake: cycle(SHAKE_LEVELS, app.settings.value.shake as (typeof SHAKE_LEVELS)[number]) })),
    });
    const back = uiButton({
      id: 'settings.back',
      label: 'BACK',
      kind: 'primary',
      x: bx + bw / 2 - 40,
      y: row(3) + 2,
      w: 80,
      h: 24,
      onActivate: () => {
        app.audio.play('ui_back');
        app.nav.resume();
      },
    });
    this.buttons = [this.aim, this.size, this.shake, back];
    this.refreshLabels();
  }

  private refreshLabels(): void {
    const s = this.app.settings.value;
    this.aim.label = s.aim360 ? 'AIM: 360° FREE' : 'AIM: 4-WAY SNAP';
    this.size.label = `BUTTON SIZE: ${Math.round(s.buttonScale * 100)}%`;
    this.shake.label = s.shake === 0 ? 'SCREEN SHAKE: OFF' : `SCREEN SHAKE: ${Math.round(s.shake * 100)}%`;
  }

  onKey(code: string): boolean {
    if (code === 'Escape' || code === 'Backspace') {
      this.buttons[3]!.onActivate?.();
      return true;
    }
    return false;
  }

  update(dt: number, _input: InputState): void {
    tickButtons(this.buttons, dt);
    this.app.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
    const px = (GAME_W - PANEL_W) / 2;
    const py = (GAME_H - PANEL_H) / 2;
    drawPanel(ctx, px, py, PANEL_W, PANEL_H, UI.panel, UI.border, UI.panelLight);
    drawTextCentered(ctx, 'SETTINGS', GAME_W / 2, py + 9, TITLE);
    drawMenuButtons(ctx, this.buttons);
    drawTextCentered(ctx, 'MORE OPTIONS COMING SOON', GAME_W / 2, py + PANEL_H + 5, NOTE);
  }
}
