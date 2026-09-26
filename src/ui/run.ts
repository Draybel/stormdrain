/**
 * The run scene (Phase 1: Wren in the training room). Owns the headless Sim, steps it with the
 * InputState each fixed tick, and turns its events into particles, shake and sound.
 */

import type { InputState } from '../engine/inputState';
import { randomSeed } from '../engine/rng';
import { GAME_H, GAME_W } from '../engine/screen';
import { Sim } from '../sim/sim';
import { UI } from '../content/sprites/palette';
import { HEART_SPRITE } from '../content/sprites/ui';
import { playEventSound } from '../audio/eventSounds';
import { saveRunNow } from '../meta/save';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { ROOM_OUTER_Y } from '../render/layout';
import { drawSprite } from '../render/sprites';
import { WorldFx } from '../render/worldFx';
import { WorldRenderer } from '../render/worldRenderer';
import type { App } from './app';
import type { Scene } from './scene';
import { createRunButtons, drawHudButton, drawMinimapButton, drawSticks, layoutRunButtons, type RunButtons } from './touchControls';
import { tickButtons, type UiButton } from './widgets';

const LABEL: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const NOTICE: TextStyle = { color: UI.text, shadow: UI.shadow };
const COUNTER: TextStyle = { color: UI.accent, shadow: UI.shadow };
const HINT: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const BG = '#07080d';

/** Seconds the stick hints / keyboard hint stay up at the start of a run. */
const HINT_TIME = 7;

export class RunScene implements Scene {
  readonly name = 'run';
  readonly overlay = false;
  readonly wantsSticks = true;
  readonly buttons: UiButton[];
  private readonly ui: RunButtons;
  private readonly app: App;
  private readonly renderer = new WorldRenderer();
  private readonly fx: WorldFx;
  sim: Sim;
  private time = 0;
  private notice = '';
  private noticeTime = 0;
  /** Set once the player has used each stick (hints fade out). */
  private usedSticks = false;
  /** HUD counter text, rebuilt only when the number changes. */
  private popsShown = -1;
  private popsText = '';

  constructor(app: App) {
    this.app = app;
    this.ui = createRunButtons();
    this.buttons = this.ui.all;
    this.fx = new WorldFx(app.particles, app.shake);
    this.sim = new Sim({ seed: randomSeed() });
  }

  enter(): void {
    this.prepareRoom();
    this.onLayout();
  }

  /** Fresh training room (used after the death animation — Phase 1 has no game over). */
  private restartRoom(): void {
    this.sim = new Sim({ seed: randomSeed() });
    this.prepareRoom();
  }

  private prepareRoom(): void {
    this.renderer.prepare(this.sim.world);
    this.app.particles.clear();
    this.app.shake.reset();
    this.time = 0;
  }

  onLayout(): void {
    layoutRunButtons(this.ui, this.app.settings.value.buttonScale);
  }

  onBackground(): void {
    this.app.nav.pause();
  }

  onKey(): boolean {
    return false;
  }

  private say(text: string): void {
    this.notice = text;
    this.noticeTime = 1.4;
  }

  update(dt: number, input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    if (input.pause) {
      this.app.nav.pause();
      return;
    }
    // Placeholder feedback until bombs/items/map exist (Phases 2-3).
    if (input.bomb) this.say('NO BOMBS YET');
    if (input.active) this.say('NO ACTIVE ITEM');
    if (input.consumable) this.say('NOTHING TO USE');
    if (input.map) this.say('MAP: ONE ROOM SO FAR');
    if (this.noticeTime > 0) this.noticeTime -= dt;
    if (this.app.input.moveStick.active || this.app.input.aimStick.active) this.usedSticks = true;

    const sim = this.sim;
    sim.step(input);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      this.fx.onEvent(e);
      playEventSound(this.app.audio, e);
    }
    this.app.particles.update(dt);
    this.app.shake.update(dt);

    // Phase 1 has no game over: after the death animation, pop back into a fresh room.
    const p = sim.world.player;
    if (p.dead && p.deathTime > 2.2) this.restartRoom();
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const shake = this.app.shake;
    this.renderer.draw(ctx, this.sim.world, alpha, this.time, shake.x, shake.y);
    this.app.particles.draw(ctx, shake.x, shake.y);
    this.drawHud(ctx);
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const p = this.sim.world.player;
    // Hearts (top-left).
    for (let i = 0; i < p.redMax / 2; i++) {
      const hp = p.red - i * 2;
      drawSprite(ctx, HEART_SPRITE, hp >= 2 ? 0 : hp === 1 ? 1 : 2, 6 + i * 10, 6);
    }
    // Room label over the top wall, and a pop counter.
    drawTextCentered(ctx, 'THE GUTTERWAYS · TRAINING ROOM', GAME_W / 2, ROOM_OUTER_Y - 12, LABEL);
    const pops = this.sim.world.counters.pops;
    if (pops !== this.popsShown) {
      this.popsShown = pops;
      this.popsText = `POPPED ${pops}`;
    }
    drawText(ctx, this.popsText, 6, 18, COUNTER);

    const input = this.app.input;
    const early = this.time < HINT_TIME;
    const hint = !input.touchUsed || this.usedSticks ? 0 : early ? 0.9 : 0.35;
    drawSticks(ctx, input, hint);
    if (!input.touchUsed && early) {
      const t = 'WASD MOVE · ARROWS SHOOT · ESC PAUSE';
      drawText(ctx, t, (GAME_W - measureText(t)) / 2, ROOM_OUTER_Y - 22, HINT);
    }
    const all = this.ui.all;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]!;
      if (b === this.ui.map) drawMinimapButton(ctx, b);
      else drawHudButton(ctx, b);
    }
    if (this.noticeTime > 0) {
      ctx.globalAlpha = Math.min(1, this.noticeTime * 3);
      drawTextCentered(ctx, this.notice, GAME_W / 2, ROOM_OUTER_Y + 22, NOTICE);
      ctx.globalAlpha = 1;
    }
  }
}
