/**
 * The run scene (Phase 2: Wren in the training yard). Owns the headless Sim, steps it with the
 * InputState each fixed tick, and turns its events into particles, shake, sound and HUD feedback.
 * Training-yard arena: F (or the bell button) calls a wave of chapter 1 enemies; big kills get a
 * 1-2 frame hit-stop (presentation only: the scene skips sim steps, the sim itself never pauses).
 */

import type { InputState } from '../engine/inputState';
import { ICON_FIGHT } from '../content/sprites/combat';
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
import { tickButtons, uiButton, type UiButton } from './widgets';

const LABEL: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const NOTICE: TextStyle = { color: UI.text, shadow: UI.shadow };
const HINT: TextStyle = { color: '#8e98b5', shadow: UI.shadow };
const BG = '#07080d';

/** Seconds the stick hints / keyboard hint stay up at the start of a run. */
const HINT_TIME = 7;
const HINT_KEYS_1 = 'WASD MOVE · ARROWS SHOOT · ESC PAUSE';
const HINT_KEYS_2 = 'E BOMB · SPACE ACTIVE · Q CONSUMABLE · F FIGHT';
/** Hit-stop ticks on the death of a big enemy / a champion. */
const HITSTOP_BIG = 2;
const HITSTOP_CHAMPION = 1;

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
  /** Training-yard bell: calls the next wave (hidden while one is running). */
  private readonly fight: UiButton;
  /** Remaining hit-stop ticks (presentation freeze after big kills). */
  private hitStop = 0;
  private label = '';
  private labelFor = -1;

  constructor(app: App) {
    this.app = app;
    this.ui = createRunButtons();
    this.fight = uiButton({ id: 'run.fight', trigger: 'release', icon: ICON_FIGHT, kind: 'hud', pad: 4 });
    this.fight.onActivate = () => this.startWave();
    this.buttons = [...this.ui.all, this.fight];
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

  /** Big kills freeze the picture briefly (for tests / tools). */
  get hitStopTicks(): number {
    return this.hitStop;
  }

  private prepareRoom(): void {
    this.renderer.prepare(this.sim.world);
    this.app.particles.clear();
    this.app.shake.reset();
    this.hud.reset();
    this.iconsFor = -1;
    this.time = 0;
    this.hitStop = 0;
    this.labelFor = -1;
  }

  onLayout(): void {
    layoutRunButtons(this.ui, this.app.settings.value.buttonScale);
    // The bell sits under the consumable button in the left margin.
    const c = this.ui.consumable;
    this.fight.x = c.x;
    this.fight.y = c.y + c.h + 6;
    this.fight.w = c.w;
    this.fight.h = c.h;
  }

  /** Training-yard arena: a wave of chapter 1 enemies (F key / bell button). */
  startWave(): number {
    const n = this.sim.startWave();
    if (n === 0 && this.sim.world.arena.active) this.say('FINISH THIS WAVE FIRST');
    return n;
  }

  onBackground(): void {
    this.app.nav.pause();
  }

  onKey(code: string): boolean {
    if (code === 'KeyF') {
      this.startWave();
      return true;
    }
    return false;
  }

  private say(text: string, time = 1.4): void {
    this.notice = text;
    this.noticeTime = time;
  }

  update(dt: number, input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
    if (input.pause) {
      this.app.nav.pause();
      return;
    }
    // Hit-stop: hold the picture for a tick or two after a big kill (only when no button edge is
    // pending, so a press is never swallowed).
    if (this.hitStop > 0 && !input.bomb && !input.active && !input.consumable && !input.firePressed) {
      this.hitStop--;
      return;
    }
    this.hitStop = 0;
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
      else if (e.type === 'enemyKilled') {
        const stop = (e.b & 4) !== 0 ? HITSTOP_BIG : (e.b & 2) !== 0 ? HITSTOP_CHAMPION : 0;
        if (stop > this.hitStop) this.hitStop = stop;
      } else if (e.type === 'roomClear') this.say('ROOM CLEARED!');
      else if (e.type === 'say') this.say(e.id, 2);
      else if (e.type === 'bell' && e.a === 0) this.say('FINISH THIS WAVE FIRST');
    }
    this.fight.visible = this.sim.trainingRoom && !this.sim.world.arena.active && !this.sim.world.player.dead;
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
    this.fx.attack.drawArcs(ctx, shake.x, shake.y);
    if (this.fx.flash > 0) {
      // Explosion / nova / Storm Lance flash (softer when screen shake is turned down).
      const max = this.fx.flashMax;
      ctx.globalAlpha = Math.min(max, this.fx.flash * max) * (0.4 + 0.6 * Math.min(1, this.app.settings.value.shake));
      ctx.fillStyle = this.fx.flashColor;
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
      drawTextCentered(ctx, this.roomLabel(), GAME_W / 2, ROOM_OUTER_Y - 12, LABEL);
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
    drawHudButton(ctx, this.fight);
    this.hud.draw(ctx, this.sim.world, this.ui, this.time);
  }

  /** Room label: the yard's name, or the wave in progress (cached per wave / enemy count). */
  private roomLabel(): string {
    const w = this.sim.world;
    if (!w.arena.active) {
      if (!this.sim.trainingRoom) return 'THE GUTTERWAYS';
      if (this.sim.autoWaves) return 'TRAINING YARD · NEXT WAVE SOON...';
      return this.app.input.touchUsed ? 'TRAINING YARD · RING THE BELL TO FIGHT' : 'TRAINING YARD · RING THE BELL (OR F) TO FIGHT';
    }
    let n = 0;
    for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i]!.dead) n++;
    const key = w.arena.wave * 1000 + n;
    if (key !== this.labelFor) {
      this.labelFor = key;
      this.label = `WAVE ${w.arena.wave} · ${n} LEFT`;
    }
    return this.label;
  }

  /** HUD element rects in game px (window.__SD.hud()). */
  hudRects(): HudRect[] {
    return this.hud.rects(this.sim.world, this.ui);
  }
}
