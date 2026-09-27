/**
 * The run's big moments (Phase 4A):
 * - TRANSFORMATION: a big banner that drops over the top of the room (set name in large letters, its
 *   line underneath, sparkles), ~3 s, translucent, never interactive;
 * - SYNERGY: NAME — a small pill in the top band (under the item banner), the first time a special
 *   synergy switches on in a run.
 * Texts are baked when the moment happens; drawing is a few drawImage calls.
 */

import { SPARK_STAR } from '../content/sprites/metaIcons';
import { UI } from '../content/sprites/palette';
import { bakeText, type TextStyle } from './font';
import { GAME_W, ROOM_OUTER_Y, ROOM_Y } from './layout';
import { drawPanel } from './pixel';
import { drawSprite } from './sprites';

const KICKER: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08' };
const NAME: TextStyle = { color: '#fff3c4', shadow: '#5a2410', outline: '#07080d', scale: 2 };
const DESC: TextStyle = { color: UI.text, shadow: UI.shadow };
const PILL: TextStyle = { color: '#c9f2ff', shadow: '#0b2a3a' };

const T_TIME = 3.2;
const S_TIME = 2.6;
/** Sparkle offsets around the transformation banner (fixed, so nothing is allocated per frame). */
const STARS: readonly (readonly [number, number, number])[] = [
  [-0.46, -4, 0],
  [0.44, 2, 0.4],
  [-0.2, 30, 0.9],
  [0.3, 32, 1.3],
  [0.02, -6, 1.7],
];

export class FeatBanner {
  private tT = T_TIME;
  private sT = S_TIME;
  private kicker: HTMLCanvasElement | null = null;
  private name: HTMLCanvasElement | null = null;
  private desc: HTMLCanvasElement | null = null;
  private pill: HTMLCanvasElement | null = null;

  /** A transformation happened: `name` (the set's name) and its one-line description. */
  transform(name: string, desc: string): void {
    this.kicker ??= bakeText('TRANSFORMATION!', KICKER);
    this.name = bakeText(name.toUpperCase(), NAME);
    this.desc = bakeText(desc.toUpperCase(), DESC);
    this.tT = 0;
  }

  /** A synergy switched on for the first time this run. */
  synergy(name: string): void {
    this.pill = bakeText(`SYNERGY: ${name.toUpperCase()}`, PILL);
    this.sT = 0;
  }

  get transformVisible(): boolean {
    return this.tT < T_TIME;
  }

  get synergyVisible(): boolean {
    return this.sT < S_TIME;
  }

  reset(): void {
    this.tT = T_TIME;
    this.sT = S_TIME;
  }

  update(dt: number): void {
    if (this.tT < T_TIME) this.tT += dt;
    if (this.sT < S_TIME) this.sT += dt;
  }

  /** The big transformation banner over the top of the room. */
  drawTransform(ctx: CanvasRenderingContext2D, time: number): void {
    const t = this.tT;
    if (t >= T_TIME || !this.name || !this.desc || !this.kicker) return;
    const inK = Math.min(1, t / 0.25);
    const out = t > T_TIME - 0.5 ? (T_TIME - t) / 0.5 : 1;
    const w = Math.max(this.name.width, this.desc.width, this.kicker.width) + 28;
    const h = 38;
    const x = Math.round((GAME_W - w) / 2);
    const y = Math.round(ROOM_Y + 4 - (1 - inK * inK) * 24);
    ctx.globalAlpha = 0.9 * out;
    drawPanel(ctx, x, y, w, h, '#1b1430', '#e0a020', '#3a2c5a');
    ctx.globalAlpha = out;
    ctx.drawImage(this.kicker, Math.round(GAME_W / 2 - this.kicker.width / 2), y + 3);
    ctx.drawImage(this.name, Math.round(GAME_W / 2 - this.name.width / 2), y + 10);
    ctx.drawImage(this.desc, Math.round(GAME_W / 2 - this.desc.width / 2), y + 27);
    // Twinkling stars around it.
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i]!;
      const tw = Math.sin(time * 7 + s[2] * 5);
      if (tw < -0.3) continue;
      drawSprite(ctx, SPARK_STAR, tw > 0.5 ? 0 : 1, Math.round(GAME_W / 2 + s[0] * w) - 3, y + s[1]);
    }
    // A white flash as it lands.
    if (t < 0.35) {
      ctx.globalAlpha = (1 - t / 0.35) * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    ctx.globalAlpha = 1;
  }

  /** The SYNERGY pill: in the top band (over the top wall during a boss fight, under the HP bar). */
  drawSynergy(ctx: CanvasRenderingContext2D, bossFight: boolean): void {
    const t = this.sT;
    const img = this.pill;
    if (t >= S_TIME || !img) return;
    const a = t < 0.15 ? t / 0.15 : t > S_TIME - 0.4 ? (S_TIME - t) / 0.4 : 1;
    const w = img.width + 12;
    const x = Math.round((GAME_W - w) / 2);
    const y = bossFight ? ROOM_OUTER_Y + 2 : ROOM_OUTER_Y - 16;
    ctx.globalAlpha = a * 0.92;
    drawPanel(ctx, x, y, w, 12, '#0e2230', '#5ad0e8', '#1c3a4c');
    ctx.globalAlpha = a;
    ctx.drawImage(img, x + 6, y + 3);
    ctx.globalAlpha = 1;
  }
}
