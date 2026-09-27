/**
 * The expanded floor map (tap the minimap, or Tab): an overlay over the frozen run — on a phone the
 * thumb that tapped the map is off the sticks, so the run pauses while the map is open. Tap anywhere
 * (or Tab / Esc / M) to close. Shows every known room with its icon, the current room blinking, the
 * floor / chapter and the curse. Under the Curse of the Soggy Map it shows only the rooms already visited.
 */

import type { InputState } from '../engine/inputState';
import { GAME_H, GAME_W } from '../engine/screen';
import { CURSE_ICONS, CURSE_NAMES } from '../content/sprites/mapIcons';
import { UI } from '../content/sprites/palette';
import { CHAPTERS } from '../content/registry';
import type { Sim } from '../sim/sim';
import { drawText, drawTextCentered, measureText, type TextStyle } from '../render/font';
import { MinimapRenderer } from '../render/minimap';
import { drawPanel } from '../render/pixel';
import { drawSprite } from '../render/sprites';
import type { App } from './app';
import type { Scene } from './scene';
import { tickButtons, uiButton, type UiButton } from './widgets';

const TITLE: TextStyle = { color: UI.accent, shadow: UI.shadow };
const NOTE: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const CURSE: TextStyle = { color: '#e08ad8', shadow: UI.shadow };
const SOGGY: TextStyle = { color: '#9a86a8', shadow: UI.shadow };

export class MapScene implements Scene {
  readonly name = 'map';
  readonly overlay = true;
  readonly wantsSticks = false;
  readonly buttons: UiButton[];
  private readonly app: App;
  private readonly sim: Sim;
  private readonly map = new MinimapRenderer();
  private time = 0;
  private readonly title: string;

  constructor(app: App, sim: Sim) {
    this.app = app;
    this.sim = sim;
    const close = uiButton({ id: 'map.close', x: 0, y: 0, w: GAME_W, h: GAME_H, pad: 0 });
    close.onActivate = () => this.close();
    this.buttons = [close];
    const d = sim.run?.data;
    const chapter = d ? CHAPTERS.get(d.chapter) : undefined;
    this.title = d ? `FLOOR ${d.floor} · ${(chapter?.name ?? d.chapter).toUpperCase()}` : 'MAP';
  }

  enter(): void {
    this.time = 0;
    this.app.audio.play('ui_click');
  }

  private close(): void {
    this.app.audio.play('ui_back');
    this.app.nav.resume();
  }

  onKey(code: string): boolean {
    if (code === 'Tab' || code === 'Escape' || code === 'KeyM' || code === 'Enter' || code === 'Space') {
      this.close();
      return true;
    }
    return false;
  }

  update(dt: number, _input: InputState): void {
    this.time += dt;
    tickButtons(this.buttons, dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.min(0.75, this.time * 8);
    ctx.fillStyle = '#04050a';
    ctx.fillRect(0, 0, GAME_W, GAME_H);
    ctx.globalAlpha = 1;
    const px = 64;
    const py = 6;
    const pw = GAME_W - 128;
    const ph = GAME_H - 12;
    drawPanel(ctx, px, py, pw, ph, '#0d111c', UI.border, '#1a2031');
    drawTextCentered(ctx, this.title, GAME_W / 2, py + 6, TITLE);
    const run = this.sim.run;
    if (run) {
      const d = run.data;
      this.map.drawBig(ctx, d.layout, d.map, GAME_W / 2, GAME_H / 2 + 2, this.time);
      if (d.map.lostMap) drawTextCentered(ctx, 'SOGGY: ONLY WHERE YOU HAVE BEEN', GAME_W / 2, py + 16, SOGGY);
      const curse = d.layout.curse;
      if (curse) {
        const name = CURSE_NAMES[curse];
        const w = measureText(name) + 10;
        const x = Math.round((GAME_W - w) / 2);
        drawSprite(ctx, CURSE_ICONS[curse], 0, x, py + ph - 22);
        drawText(ctx, name, x + 10, py + ph - 21, CURSE);
      }
    }
    drawTextCentered(ctx, 'TAP TO CLOSE', GAME_W / 2, py + ph - 11, NOTE);
  }
}
