/** Title screen: rainy drain-mouth backdrop, big pixel logo, New Run / Settings. */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import { MARBLE_SPRITE } from '../content/sprites/props';
import { WREN_FRAME, WREN_SPRITE } from '../content/sprites/wren';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { P_RING, P_STREAK } from '../render/particles';
import { drawShadow, glowSprite } from '../render/pixel';
import { drawSpriteAnchored } from '../render/sprites';
import { TITLE_GROUND_Y, buildLogo, buildTitleBackdrop } from '../render/titleArt';
import type { App } from './app';
import type { Scene } from './scene';
import { drawMenuButton, tickButtons, uiButton, type UiButton } from './widgets';

const SUBTITLE: TextStyle = { color: '#9fb0d6', shadow: UI.shadow };
const VERSION: TextStyle = { color: '#4b5776' };
const RAIN = 'rgba(160,190,235,0.55)';
const RAIN_FAR = 'rgba(120,150,200,0.3)';
const SPLASH = 'rgba(170,200,240,0.5)';

let backdrop: HTMLCanvasElement | null = null;
let logo: HTMLCanvasElement | null = null;

export class TitleScene implements Scene {
  readonly name = 'title';
  readonly overlay = false;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private time = 0;
  private rainAcc = 0;
  private lightning = 0;
  private nextStrike = 3;
  private readonly glow = glowSprite(6, '255,176,80', 0.45);

  constructor(app: App) {
    this.app = app;
    const w = 124;
    const x = Math.round((GAME_W - w) / 2);
    this.buttons = [
      uiButton({
        id: 'title.newRun',
        label: 'NEW RUN',
        kind: 'primary',
        x,
        y: 84,
        w,
        h: 28,
        onActivate: () => {
          app.audio.play('ui_click');
          app.nav.newRun();
        },
      }),
      uiButton({
        id: 'title.settings',
        label: 'SETTINGS',
        x,
        y: 118,
        w,
        h: 26,
        onActivate: () => {
          app.audio.play('ui_click');
          app.nav.settings();
        },
      }),
    ];
  }

  enter(): void {
    backdrop ??= buildTitleBackdrop();
    logo ??= buildLogo();
    this.app.particles.clear();
    this.app.shake.reset();
    // Pre-fill the rain so the first frame is already stormy.
    for (let i = 0; i < 60; i++) this.spawnDrop(Math.random() * GAME_H);
  }

  onKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      this.buttons[0]!.onActivate?.();
      return true;
    }
    if (code === 'KeyS') {
      this.buttons[1]!.onActivate?.();
      return true;
    }
    return false;
  }

  private spawnDrop(y0 = -6): void {
    const far = Math.random() < 0.45;
    const vy = far ? 150 + Math.random() * 40 : 230 + Math.random() * 70;
    const groundY = TITLE_GROUND_Y + 2 + Math.random() * (GAME_H - TITLE_GROUND_Y);
    const life = Math.max(0.05, (groundY - y0) / vy);
    const p = this.app.particles.spawn(Math.random() * (GAME_W + 40), y0, -vy * 0.18, vy, life, far ? RAIN_FAR : RAIN, far ? 3 : 5, P_STREAK);
    if (p) p.fade = false;
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    // Rain + splash rings on the ledge/water.
    this.rainAcc += dt * 130;
    while (this.rainAcc >= 1) {
      this.rainAcc -= 1;
      this.spawnDrop();
      if (Math.random() < 0.35) {
        const r = this.app.particles.spawn(Math.random() * GAME_W, TITLE_GROUND_Y + 3 + Math.random() * (GAME_H - TITLE_GROUND_Y - 4), 0, 0, 0.25, SPLASH, 0, P_RING);
        if (r) r.endSize = 3;
      }
    }
    // Occasional lightning (sometimes a double flicker).
    this.nextStrike -= dt;
    if (this.nextStrike <= 0) {
      this.lightning = 1;
      this.nextStrike = Math.random() < 0.3 ? 0.18 : 4 + Math.random() * 6;
    }
    this.lightning = Math.max(0, this.lightning - dt * 3.2);
    this.app.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.drawImage(backdrop!, 0, 0);
    if (this.lightning > 0) {
      ctx.globalAlpha = this.lightning * 0.22;
      ctx.fillStyle = '#c9d8ff';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalAlpha = 1;
    }

    // Wren on the ledge, and the trail of glowing marbles leading into the drain.
    const t = this.time;
    const trail = [
      [124, TITLE_GROUND_Y + 1],
      [140, TITLE_GROUND_Y + 3],
      [157, TITLE_GROUND_Y + 2],
      [175, TITLE_GROUND_Y + 4],
      [192, TITLE_GROUND_Y + 1],
    ] as const;
    for (const [x, y] of trail) drawShadow(ctx, x, y + 1, 5);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < trail.length; i++) {
      const [x, y] = trail[i]!;
      if (Math.sin(t * 2.2 - i * 0.9) > -0.2) ctx.drawImage(this.glow, x - 6, y - 4 - 6);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const [x, y] of trail) drawSpriteAnchored(ctx, MARBLE_SPRITE, 0, x, y - 3);
    drawShadow(ctx, 104, TITLE_GROUND_Y + 1, 11);
    drawSpriteAnchored(ctx, WREN_SPRITE, WREN_FRAME.sideTogether, 104, TITLE_GROUND_Y + 1);

    this.app.particles.draw(ctx, 0, 0);

    const lg = logo!;
    const bob = Math.round(Math.sin(t * 1.3) * 1);
    ctx.drawImage(lg, Math.round((GAME_W - lg.width) / 2), 14 + bob);
    drawTextCentered(ctx, 'FOLLOW THE GLOWING MARBLES', GAME_W / 2, 50, SUBTITLE);

    for (const b of this.buttons) drawMenuButton(ctx, b);
    const v = 'V0.1';
    drawText(ctx, v, GAME_W - measureText(v) - 4, GAME_H - 8, VERSION);
  }
}
