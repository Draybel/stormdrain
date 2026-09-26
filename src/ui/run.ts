/**
 * The run scene (Phase 2: Wren in the training yard). Owns the headless Sim, steps it with the
 * InputState each fixed tick, and turns its events into particles, shake, sound and HUD feedback.
 */

import type { InputState } from '../engine/inputState';
import { randomSeed } from '../engine/rng';
import { GAME_H, GAME_W } from '../engine/screen';
import { Sim } from '../sim/sim';
import { UI } from '../content/sprites/palette';
import { ICON_ACTIVE, ICON_CONSUMABLE } from '../content/sprites/ui';
import { playEventSound } from '../audio/eventSounds';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { Hud, type HudRect } from '../render/hud';
import { ROOM_OUTER_Y } from '../render/layout';
import { WorldFx } from '../render/worldFx';
import { WorldRenderer, itemIcon } from '../render/worldRenderer';
import type { App } from './app';
import type { Scene } from './scene';
import { createRunButtons, drawHudButton, drawMinimapButton, drawSticks, layoutRunButtons, type RunButtons } from './touchControls';
import { tickButtons, type UiButton } from './widgets';

const LABEL: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const NOTICE: TextStyle = { color: UI.text, shadow: UI.shadow };
const HINT: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const BG = '#07080d';

/** Seconds the stick hints / keyboard hint stay up at the start of a run. */
const HINT_TIME = 7;
const HINT_KEYS_1 = 'WASD MOVE · ARROWS SHOOT · ESC PAUSE';
const HINT_KEYS_2 = 'E BOMB · SPACE ACTIVE ITEM · Q CONSUMABLE';

/** What to say when the sim refuses an action (GameEvent 'denied' ids). */
const DENIED: Readonly<Record<string, string>> = {
  noBombs: 'NO BOMBS',
  noActive: 'NO ACTIVE ITEM',
  notCharged: 'NOT CHARGED YET',
  noConsumable: 'NOTHING TO USE',
  locked: 'NEEDS A KEY',
};

export class RunScene implements Scene {
  readonly name = 'run';
  readonly overlay = false;
  readonly wantsSticks = true;
  readonly buttons: UiButton[];
  private readonly ui: RunButtons;
  private readonly app: App;
  private readonly renderer = new WorldRenderer();
  private readonly fx: WorldFx;
  readonly hud = new Hud();
  sim: Sim;
  private time = 0;
  private notice = '';
  private noticeTime = 0;
  /** Set once the player has used each stick (hints fade out). */
  private usedSticks = false;
  /** Inventory version the button icons were last updated for. */
  private iconsFor = -1;

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

  /** Fresh training room (used after the death animation — no game over until Phase 3). */
  private restartRoom(): void {
    this.sim = new Sim({ seed: randomSeed() });
    this.prepareRoom();
  }

  private prepareRoom(): void {
    this.renderer.prepare(this.sim.world);
    this.app.particles.clear();
    this.app.shake.reset();
    this.hud.reset();
    this.iconsFor = -1;
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
    if (input.map) this.say('MAP: ONE ROOM SO FAR');
    if (this.noticeTime > 0) this.noticeTime -= dt;
    if (this.app.input.moveStick.active || this.app.input.aimStick.active) this.usedSticks = true;

    const sim = this.sim;
    sim.step(input);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      this.fx.onEvent(e);
      this.hud.onEvent(e);
      playEventSound(this.app.audio, e);
      if (e.type === 'denied') this.say(DENIED[e.id] ?? 'NOPE');
    }
    this.fx.tick(sim.world, dt);
    this.hud.update(dt, sim.world);
    this.app.particles.update(dt);
    this.app.shake.update(dt);
    this.syncButtonIcons();

    // No game over until the floors exist: after the death animation, pop back into a fresh room.
    const p = sim.world.player;
    if (p.dead && p.deathTime > 2.2) this.restartRoom();
  }

  /** The active / consumable buttons show the held item's icon. */
  private syncButtonIcons(): void {
    const inv = this.sim.world.player.inv;
    if (inv.version === this.iconsFor) return;
    this.iconsFor = inv.version;
    this.ui.active.icon = inv.active ? itemIcon(inv.active.id) : ICON_ACTIVE;
    this.ui.consumable.icon = inv.consumables.length ? itemIcon(inv.consumables[0]!) : ICON_CONSUMABLE;
  }

  render(ctx: CanvasRenderingContext2D, alpha: number): void {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    const shake = this.app.shake;
    this.renderer.draw(ctx, this.sim.world, alpha, this.time, shake.x, shake.y);
    this.app.particles.draw(ctx, shake.x, shake.y);
    if (this.fx.flash > 0) {
      // Explosion / nova flash (softer when screen shake is turned down).
      ctx.globalAlpha = Math.min(0.45, this.fx.flash * 0.45) * (0.4 + 0.6 * Math.min(1, this.app.settings.value.shake));
      ctx.fillStyle = '#fff6e0';
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.globalAlpha = 1;
    }
    this.drawHud(ctx);
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    const banner = this.hud.bannerVisible;
    // Room label over the top wall; short notices ("NO BOMBS") replace it for a moment. Both stay
    // in the top band so nothing covers the room.
    if (this.noticeTime > 0) {
      ctx.globalAlpha = Math.min(1, this.noticeTime * 3);
      drawTextCentered(ctx, this.notice, GAME_W / 2, ROOM_OUTER_Y - 12, NOTICE);
      ctx.globalAlpha = 1;
    } else if (!banner) {
      drawTextCentered(ctx, 'THE GUTTERWAYS · TRAINING YARD', GAME_W / 2, ROOM_OUTER_Y - 12, LABEL);
    }

    const input = this.app.input;
    const early = this.time < HINT_TIME;
    const hint = !input.touchUsed || this.usedSticks ? 0 : early ? 0.9 : 0.35;
    drawSticks(ctx, input, hint);
    if (!input.touchUsed && early && !banner) {
      drawText(ctx, HINT_KEYS_1, (GAME_W - measureText(HINT_KEYS_1)) / 2, ROOM_OUTER_Y - 30, HINT);
      drawText(ctx, HINT_KEYS_2, (GAME_W - measureText(HINT_KEYS_2)) / 2, ROOM_OUTER_Y - 22, HINT);
    }
    const all = this.ui.all;
    for (let i = 0; i < all.length; i++) {
      const b = all[i]!;
      if (b === this.ui.map) drawMinimapButton(ctx, b);
      else drawHudButton(ctx, b);
    }
    this.hud.draw(ctx, this.sim.world, this.ui, this.time);
  }

  /** HUD element rects in game px (window.__SD.hud()). */
  hudRects(): HudRect[] {
    return this.hud.rects(this.sim.world, this.ui);
  }
}
