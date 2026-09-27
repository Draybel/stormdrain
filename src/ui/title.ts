/**
 * Title screen (Phase 4B): the rainy drain-mouth backdrop and the pixel logo; the play column inside the
 * arch — CONTINUE (only with a saved run, then the main button) / NEW RUN / DAILY RUN / ENTER SEED; page tiles
 * on the walls — COLLECTION, BESTIARY (left), ACHIEVEMENTS, STATS (right); SETTINGS in the top-right corner;
 * the lasting save notice on the bottom line. Every button is >= 26 game px tall (≈ 46 pt).
 *
 * Keyboard: arrows move the focus, Enter / Space pick; shortcuts C continue, N new run, D daily, E enter seed,
 * O collection, B bestiary, A achievements, T stats, S settings.
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { MARBLE_SPRITE } from '../content/sprites/props';
import { WREN_FRAME, WREN_SPRITE } from '../content/sprites/wren';
import { ICON_BESTIARY, ICON_COLLECTION, ICON_GEAR, ICON_STATS, ICON_TICK, ICON_TROPHY } from '../content/sprites/menuIcons';
import { utcDateKey } from '../meta/metaState';
import { bakeText, drawText, measureText, type TextStyle } from '../render/font';
import { P_RING, P_STREAK } from '../render/particles';
import { MARBLE_GLOW_RGB, drawShadow, glowSprite } from '../render/pixel';
import { drawSprite, drawSpriteAnchored } from '../render/sprites';
import { TITLE_GROUND_Y, buildLogo, buildTitleBackdrop } from '../render/titleArt';
import { MUSIC } from '../audio/music/ids';
import type { App } from './app';
import type { Scene } from './scene';
import { BTN_H, MenuNav, drawMenuButtons, tickButtons, uiButton, type UiButton } from './widgets';

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

/** The play column (inside the arch) and the wall tiles. */
const COL_W = 124;
const COL_X = Math.round((GAME_W - COL_W) / 2);
const TILE_W = 70;
const TILE_H = 42;
const TILE_Y0 = 62;
const TILE_GAP = 5;

export class TitleScene implements Scene {
  readonly name = 'title';
  readonly overlay = false;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly cont: UiButton;
  private readonly newRun: UiButton;
  private readonly daily: UiButton;
  private readonly seed: UiButton;
  private readonly settings: UiButton;
  private readonly tiles: UiButton[];
  private readonly menu: MenuNav;
  /** The save line at the bottom ('' = none). */
  private notice = '';
  /** Today's daily run has been played (a tick on its button). */
  private dailyDone = false;
  private time = 0;
  private rainAcc = 0;
  private lightning = 0;
  private nextStrike = 3;
  private readonly glow = glowSprite(7, MARBLE_GLOW_RGB, 0.7);

  constructor(app: App) {
    this.app = app;
    const nav = app.nav;
    const go = (fn: () => void, sound: 'ui_click' | 'menu_select' = 'ui_click') => () => {
      app.audio.play(sound);
      fn();
    };
    this.cont = uiButton({
      id: 'title.continue',
      label: 'CONTINUE',
      kind: 'primary',
      x: COL_X,
      w: COL_W,
      h: 28,
      visible: false,
      onActivate: () => {
        app.audio.play('ui_click');
        if (!nav.continueRun()) this.layout();
      },
    });
    this.newRun = uiButton({ id: 'title.newRun', label: 'NEW RUN', kind: 'primary', x: COL_X, w: COL_W, h: 28, onActivate: go(() => nav.characters(null)) });
    this.daily = uiButton({ id: 'title.daily', label: 'DAILY RUN', x: COL_X, w: COL_W, h: BTN_H, onActivate: go(() => nav.daily()) });
    this.seed = uiButton({ id: 'title.seed', label: 'ENTER SEED', x: COL_X, w: COL_W, h: BTN_H, onActivate: go(() => nav.seedEntry()) });
    const tile = (id: string, label: string, icon: UiButton['icon'], x: number, row: number, fn: () => void): UiButton =>
      uiButton({ id: `title.${id}`, label, icon, kind: 'tile', x, y: TILE_Y0 + row * (TILE_H + TILE_GAP), w: TILE_W, h: TILE_H, onActivate: go(fn) });
    const right = GAME_W - 6 - TILE_W;
    this.tiles = [
      tile('collection', 'COLLECTION', ICON_COLLECTION, 6, 0, () => nav.collection()),
      tile('bestiary', 'BESTIARY', ICON_BESTIARY, 6, 1, () => nav.bestiary()),
      tile('achievements', 'ACHIEVEMENTS', ICON_TROPHY, right, 0, () => nav.achievements()),
      tile('stats', 'STATS', ICON_STATS, right, 1, () => nav.stats()),
    ];
    this.settings = uiButton({
      id: 'title.settings',
      label: 'SETTINGS',
      icon: ICON_GEAR,
      textScale: 1,
      x: right,
      y: 6,
      w: TILE_W,
      h: BTN_H,
      onActivate: go(() => nav.settings()),
    });
    this.buttons = [this.cont, this.newRun, this.daily, this.seed, ...this.tiles, this.settings];
    this.menu = new MenuNav(() => this.buttons);
    this.menu.onMove = () => app.audio.play('menu_move');
    this.layout();
  }

  /** Continue shows (on top, as the main button) only when a run is saved. */
  private layout(): void {
    const saved = this.app.save.hasRun();
    this.cont.visible = saved;
    this.newRun.kind = saved ? 'secondary' : 'primary';
    this.newRun.h = saved ? BTN_H : 28;
    let y = saved ? 60 : 66;
    if (saved) {
      this.cont.y = y;
      y += this.cont.h + 4;
    }
    for (const b of [this.newRun, this.daily, this.seed]) {
      b.y = y;
      y += b.h + (saved ? 4 : 6);
    }
    const n = this.app.save.notice;
    this.notice = n?.lasting ? `${n.title} · ${n.line}` : '';
    this.dailyDone = this.app.save.meta.hasDaily(utcDateKey(Date.now()));
    const f = this.menu.current();
    if (!f || f === this.cont || f === this.newRun) this.menu.set(saved ? this.cont : this.newRun);
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

  /** Back from a page / settings / a modal: the save may have changed (import, a new daily). */
  focus(): void {
    this.layout();
  }

  onKey(code: string): boolean {
    const shortcut: Record<string, UiButton | undefined> = {
      KeyC: this.cont.visible ? this.cont : undefined,
      KeyN: this.newRun,
      KeyD: this.daily,
      KeyE: this.seed,
      KeyO: this.tiles[0],
      KeyB: this.tiles[1],
      KeyA: this.tiles[2],
      KeyT: this.tiles[3],
      KeyS: this.settings,
    };
    const b = shortcut[code];
    if (b) {
      this.menu.set(b);
      b.flash = 0;
      b.onActivate?.();
      return true;
    }
    return this.menu.onKey(code);
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
    ctx.drawImage(lg, Math.round((GAME_W - lg.width) / 2), 12 + bob);
    const sub = subtitle!;
    ctx.drawImage(sub, Math.round((GAME_W - sub.width) / 2), 46);

    drawMenuButtons(ctx, this.buttons);
    // Today's daily is done: a tick on its button.
    if (this.dailyDone) drawSprite(ctx, ICON_TICK, 0, this.daily.x + this.daily.w - 12, this.daily.y + 10);
    this.menu.draw(ctx, this.time, this.app.input.lastDevice === 'keyboard');
    if (this.notice) drawText(ctx, this.notice, Math.round((GAME_W - measureText(this.notice)) / 2), GAME_H - 8, NOTICE);
    const v = 'V0.2';
    drawText(ctx, v, GAME_W - measureText(v) - 4, GAME_H - 8, VERSION);
  }

  describe(): Record<string, unknown> {
    return { continue: this.cont.visible, dailyDone: this.dailyDone, notice: this.notice, focus: this.menu.current()?.id ?? null };
  }
}
