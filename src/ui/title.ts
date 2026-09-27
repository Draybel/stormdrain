/**
 * Title screen: rainy drain-mouth backdrop, big pixel logo, Continue (when a run is saved) / New Run /
 * Settings, and a line about the save when it needs attention (restored, newer version, not kept).
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { UI } from '../content/sprites/palette';
import { MARBLE_SPRITE } from '../content/sprites/props';
import { WREN_FRAME, WREN_SPRITE } from '../content/sprites/wren';
import { bakeText, drawText, measureText, type TextStyle } from '../render/font';
import { P_RING, P_STREAK } from '../render/particles';
import { MARBLE_GLOW_RGB, drawShadow, glowSprite } from '../render/pixel';
import { drawSpriteAnchored } from '../render/sprites';
import { TITLE_GROUND_Y, buildLogo, buildTitleBackdrop } from '../render/titleArt';
import { MUSIC } from '../audio/music/ids';
import type { App } from './app';
import type { Scene } from './scene';
import { drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

/** Outlined so it stays crisp where it crosses the arch bricks. */
const SUBTITLE: TextStyle = { color: '#b4c3e6', outline: '#07080d', shadow: '#07080d' };
const VERSION: TextStyle = { color: '#4b5776' };
const NOTICE: TextStyle = { color: '#b9d6f0', shadow: '#07080d' };
const RAIN = 'rgba(160,190,235,0.55)';
const RAIN_FAR = 'rgba(120,150,200,0.3)';
const SPLASH = 'rgba(170,200,240,0.5)';

let backdrop: HTMLCanvasElement | null = null;
let logo: HTMLCanvasElement | null = null;
let subtitle: HTMLCanvasElement | null = null;

/** Marble trail leading from Wren into the drain (static, so no per-frame arrays). */
const TRAIL_X = [124, 140, 157, 175, 192] as const;
const TRAIL_Y = [TITLE_GROUND_Y + 1, TITLE_GROUND_Y + 3, TITLE_GROUND_Y + 2, TITLE_GROUND_Y + 4, TITLE_GROUND_Y + 1] as const;

export class TitleScene implements Scene {
  readonly name = 'title';
  readonly overlay = false;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly cont: UiButton;
  private readonly newRun: UiButton;
  private readonly settings: UiButton;
  /** The save line under the buttons ('' = none). */
  private notice = '';
  private time = 0;
  private rainAcc = 0;
  private lightning = 0;
  private nextStrike = 3;
  private readonly glow = glowSprite(7, MARBLE_GLOW_RGB, 0.7);

  constructor(app: App) {
    this.app = app;
    const w = 124;
    const x = Math.round((GAME_W - w) / 2);
    this.cont = uiButton({
      id: 'title.continue',
      label: 'CONTINUE',
      kind: 'primary',
      x,
      y: 76,
      w,
      h: 26,
      visible: false,
      onActivate: () => {
        app.audio.play('ui_click');
        if (!app.nav.continueRun()) this.layout();
      },
    });
    this.newRun = uiButton({
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
    });
    this.settings = uiButton({
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
    });
    this.buttons = [this.cont, this.newRun, this.settings];
    this.layout();
  }

  /** Continue shows (on top, as the main button) only when a run is saved. */
  private layout(): void {
    const saved = this.app.save.hasRun();
    this.cont.visible = saved;
    this.newRun.kind = saved ? 'secondary' : 'primary';
    this.newRun.y = saved ? 106 : 84;
    this.newRun.h = saved ? 26 : 28;
    this.settings.y = saved ? 136 : 118;
    const n = this.app.save.notice;
    this.notice = n?.lasting ? `${n.title} · ${n.line}` : '';
  }

  enter(): void {
    this.layout();
    backdrop ??= buildTitleBackdrop();
    logo ??= buildLogo();
    subtitle ??= bakeText('FOLLOW THE GLOWING MARBLES', SUBTITLE);
    this.app.particles.clear();
    this.app.shake.reset();
    this.app.audio.music.play(MUSIC.title, { fade: 1.2 });
    // Pre-fill the rain so the first frame is already stormy.
    for (let i = 0; i < 60; i++) this.spawnDrop(Math.random() * GAME_H);
  }

  onKey(code: string): boolean {
    if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter') {
      (this.cont.visible ? this.cont : this.newRun).onActivate?.();
      return true;
    }
    if (code === 'KeyC' && this.cont.visible) {
      this.cont.onActivate?.();
      return true;
    }
    if (code === 'KeyN') {
      this.newRun.onActivate?.();
      return true;
    }
    if (code === 'KeyS') {
      this.settings.onActivate?.();
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
    const n = TRAIL_X.length;
    for (let i = 0; i < n; i++) drawShadow(ctx, TRAIL_X[i]!, TRAIL_Y[i]! + 1, 5);
    ctx.globalCompositeOperation = 'lighter';
    const gh = this.glow.width >> 1;
    for (let i = 0; i < n; i++) {
      // Each marble pulses in turn, like a trail being followed into the dark.
      if (Math.sin(t * 2.2 - i * 0.9) > -0.2) ctx.drawImage(this.glow, TRAIL_X[i]! - gh, TRAIL_Y[i]! - 3 - gh);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) drawSpriteAnchored(ctx, MARBLE_SPRITE, 0, TRAIL_X[i]!, TRAIL_Y[i]! - 3);
    drawShadow(ctx, 104, TITLE_GROUND_Y + 1, 11);
    drawSpriteAnchored(ctx, WREN_SPRITE, WREN_FRAME.sideTogether, 104, TITLE_GROUND_Y + 1);

    this.app.particles.draw(ctx, 0, 0);

    const lg = logo!;
    const bob = Math.round(Math.sin(t * 1.3) * 1);
    ctx.drawImage(lg, Math.round((GAME_W - lg.width) / 2), 14 + bob);
    const sub = subtitle!;
    ctx.drawImage(sub, Math.round((GAME_W - sub.width) / 2), 49);

    drawMenuButtons(ctx, this.buttons);
    if (this.notice) drawText(ctx, this.notice, Math.round((GAME_W - measureText(this.notice)) / 2), 166, NOTICE);
    const v = 'V0.1';
    drawText(ctx, v, GAME_W - measureText(v) - 4, GAME_H - 8, VERSION);
  }
}
