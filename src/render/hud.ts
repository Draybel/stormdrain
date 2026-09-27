/**
 * In-run HUD, all inside the 384×192 canvas and outside the room (ARCHITECTURE §2 layout):
 * - top-left margin: hearts (red / Tin / Ember, half hearts; 6 per row, wraps to a 2nd row),
 *   coin / bomb / key counters (they hop and flash white when they go up);
 * - the active button shows the held active's icon + a segmented charge bar beside it;
 * - the consumable button shows the held consumable; trinket icons sit next to it;
 * - top band: the item pickup banner (NAME + one-line description).
 * Text for numbers is cached per value, so steady-state frames allocate nothing.
 */

import type { GameEvent } from '../engine/events';
import { findItem } from '../content/registry';
import { BONUS_EMBER } from '../sim/health';
import { isUnidentifiedTonic, itemDesc, itemName } from '../sim/tonics';
import type { World } from '../sim/world';
import { UI } from '../content/sprites/palette';
import { EMBER_HEART_SPRITE, HUD_BOMB_ICON, HUD_COIN_ICON, HUD_KEY_ICON, TIN_HEART_SPRITE } from '../content/sprites/pickups';
import { HEART_SPRITE } from '../content/sprites/ui';
import { drawText, drawTextCentered, measureText, type TextStyle } from './font';
import { GAME_W } from './layout';
import { drawPanel } from './pixel';
import { drawSprite, getFrame } from './sprites';
import { itemIcon } from './worldRenderer';

const COUNT: TextStyle = { color: '#e9edf7', shadow: UI.shadow };
const COUNT_HOT: TextStyle = { color: '#ffffff', shadow: '#5a2410' };
const BANNER_NAME: TextStyle = { color: UI.accent, shadow: '#3a2410', scale: 2 };
const BANNER_DESC: TextStyle = { color: UI.text, shadow: UI.shadow };
/** The '?' on an unidentified Mystery Tonic in the consumable button. */
const TONIC_MARK: TextStyle = { color: '#3a2410' };

/** Hearts: top-left corner, 6 per row. */
export const HEARTS_X = 4;
export const HEARTS_Y = 4;
const HEART_STEP_X = 10;
const HEART_STEP_Y = 9;
const HEARTS_PER_ROW = 6;
/** Counters column (below two rows of hearts). */
export const COUNTERS_X = 4;
export const COUNTERS_Y = 24;
const COUNTER_STEP = 9;
/** Banner: centred in the top band. */
const BANNER_Y = 3;
const BANNER_H = 26;
const BANNER_TIME = 2.8;

export interface HudRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Positions of the two HUD buttons the HUD decorates (game px), from the run scene's layout. */
export interface HudButtons {
  active: { x: number; y: number; w: number; h: number };
  consumable: { x: number; y: number; w: number; h: number };
}

const COUNTER_ICONS = [HUD_COIN_ICON, HUD_BOMB_ICON, HUD_KEY_ICON] as const;

/** Trinket icons sit beside the consumable button, on the side facing the room. */
function trinketX(b: { x: number; w: number }): number {
  return b.x < GAME_W / 2 ? Math.round(b.x + b.w + 3) : Math.round(b.x) - 17;
}

function counterValue(world: World, i: number): number {
  const inv = world.player.inv;
  return i === 0 ? inv.coins : i === 1 ? inv.bombs : inv.keys;
}

const numberText: string[] = [];
function num2(n: number): string {
  return (numberText[n] ??= n < 10 ? `0${n}` : String(n));
}

export class Hud {
  private readonly shown = [-1, -1, -1];
  private readonly bump = [9, 9, 9];
  private bannerId = '';
  private bannerName = '';
  private bannerDesc = '';
  private bannerW = 0;
  private bannerT = BANNER_TIME;
  /** The banner still has to be named for this run (Mystery Tonics: '???' until identified). */
  private bannerPending = false;
  private chargeFlash = 1;
  private deniedShake = 1;
  private heartHit = 1;
  private lastHalves = -1;

  /** True while the pickup banner is up (the run scene hides its room label). */
  get bannerVisible(): boolean {
    return this.bannerT < BANNER_TIME;
  }

  onEvent(e: GameEvent): void {
    // Item pickups, and consumables when used (a drunk Tonic reveals what it was).
    if (e.type === 'item' || (e.type === 'activeUse' && e.a === 1)) {
      const def = findItem(e.id);
      if (!def) return;
      this.setBanner(def.id, def.name, def.desc);
      this.bannerT = 0;
      this.bannerPending = true;
    } else if (e.type === 'charged') {
      this.chargeFlash = 0;
    } else if (e.type === 'denied' && e.id === 'notCharged') {
      this.deniedShake = 0;
    }
  }

  private setBanner(id: string, name: string, desc: string): void {
    this.bannerId = id;
    this.bannerName = name.toUpperCase();
    this.bannerDesc = desc;
    this.bannerW = Math.max(measureText(this.bannerName, 2), measureText(this.bannerDesc)) + 18;
  }

  update(dt: number, world: World): void {
    if (this.bannerPending) {
      // The names this run shows (sim/tonics.ts): unidentified Tonics read '??? <COLOUR> TONIC'.
      this.bannerPending = false;
      const name = itemName(world, this.bannerId);
      const desc = itemDesc(world, this.bannerId);
      if (name.toUpperCase() !== this.bannerName || desc !== this.bannerDesc) this.setBanner(this.bannerId, name, desc);
    }
    for (let i = 0; i < 3; i++) {
      const v = counterValue(world, i);
      if (this.shown[i]! >= 0 && v > this.shown[i]!) this.bump[i] = 0;
      this.shown[i] = v;
      if (this.bump[i]! < 9) this.bump[i]! += dt;
    }
    const h = world.player.health;
    let halves = h.red;
    for (let i = 0; i < h.bonusCount; i++) halves += h.bonusHalves[i]!;
    if (this.lastHalves >= 0 && halves < this.lastHalves) this.heartHit = 0;
    this.lastHalves = halves;
    if (this.bannerT < BANNER_TIME) this.bannerT += dt;
    if (this.chargeFlash < 1) this.chargeFlash += dt;
    if (this.deniedShake < 1) this.deniedShake += dt;
    if (this.heartHit < 1) this.heartHit += dt;
  }

  reset(): void {
    this.shown.fill(-1);
    this.bump.fill(9);
    this.bannerT = BANNER_TIME;
    this.lastHalves = -1;
  }

  draw(ctx: CanvasRenderingContext2D, world: World, buttons: HudButtons, time: number): void {
    this.drawHearts(ctx, world);
    this.drawCounters(ctx, world);
    this.drawCharge(ctx, world, buttons, time);
    this.drawTrinkets(ctx, world, buttons);
    this.drawTonicMark(ctx, world, buttons);
    this.drawBanner(ctx);
  }

  /** An unidentified Mystery Tonic in the consumable button gets a gold '?' badge (top-right corner). */
  private drawTonicMark(ctx: CanvasRenderingContext2D, world: World, buttons: HudButtons): void {
    const c = world.player.inv.consumables;
    if (c.length === 0 || !isUnidentifiedTonic(world, c[0]!)) return;
    const b = buttons.consumable;
    const x = Math.round(b.x + b.w) - 7;
    const y = Math.round(b.y) + 1;
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(x - 1, y - 1, 7, 9);
    ctx.fillStyle = UI.accent;
    ctx.fillRect(x, y, 5, 7);
    drawText(ctx, '?', x + 1, y + 1, TONIC_MARK);
  }

  private drawHearts(ctx: CanvasRenderingContext2D, world: World): void {
    const h = world.player.health;
    const flash = this.heartHit < 0.3 && Math.floor(this.heartHit * 20) % 2 === 0;
    if (world.curse === 'unknown') {
      // Curse of the Unknown: your own hearts are a mystery.
      drawSprite(ctx, HEART_SPRITE, 2, HEARTS_X, HEARTS_Y, false, flash);
      drawText(ctx, '?', HEARTS_X + 3, HEARTS_Y + 2, COUNT);
      drawText(ctx, '???', HEARTS_X + HEART_STEP_X + 1, HEARTS_Y + 2, COUNT);
      return;
    }
    let slot = 0;
    const containers = h.redMax >> 1;
    for (let i = 0; i < containers; i++, slot++) {
      const hp = h.red - i * 2;
      const x = HEARTS_X + (slot % HEARTS_PER_ROW) * HEART_STEP_X;
      const y = HEARTS_Y + Math.floor(slot / HEARTS_PER_ROW) * HEART_STEP_Y;
      drawSprite(ctx, HEART_SPRITE, hp >= 2 ? 0 : hp === 1 ? 1 : 2, x, y, false, flash);
    }
    for (let i = 0; i < h.bonusCount; i++, slot++) {
      const x = HEARTS_X + (slot % HEARTS_PER_ROW) * HEART_STEP_X;
      const y = HEARTS_Y + Math.floor(slot / HEARTS_PER_ROW) * HEART_STEP_Y;
      const def = h.bonusKind[i] === BONUS_EMBER ? EMBER_HEART_SPRITE : TIN_HEART_SPRITE;
      drawSprite(ctx, def, h.bonusHalves[i] === 2 ? 0 : 1, x, y, false, flash);
    }
  }

  private drawCounters(ctx: CanvasRenderingContext2D, world: World): void {
    for (let i = 0; i < 3; i++) {
      const y = COUNTERS_Y + i * COUNTER_STEP;
      const icon = COUNTER_ICONS[i]!;
      drawSprite(ctx, icon, 0, COUNTERS_X + ((7 - icon.w) >> 1), y + ((7 - icon.h) >> 1));
      const b = this.bump[i]!;
      const hop = b < 0.12 ? -2 : b < 0.22 ? -1 : 0;
      drawText(ctx, num2(counterValue(world, i)), COUNTERS_X + 10, y + 1 + hop, b < 0.22 ? COUNT_HOT : COUNT);
    }
  }

  private drawCharge(ctx: CanvasRenderingContext2D, world: World, buttons: HudButtons, time: number): void {
    const slot = world.player.inv.active;
    if (!slot || slot.max <= 0) return;
    const b = buttons.active;
    const shake = this.deniedShake < 0.25 ? Math.round(Math.sin(this.deniedShake * 60) * 1.5) : 0;
    // Beside the button, on the side facing the room (left-handed layouts put the active on the left).
    const x = (b.x < GAME_W / 2 ? Math.round(b.x + b.w) + 3 : Math.round(b.x) - 6) + shake;
    const y = Math.round(b.y) + 1;
    const h = b.h - 2;
    const full = slot.charge >= slot.max;
    ctx.fillStyle = '#07080d';
    ctx.fillRect(x - 1, y - 1, 5, h + 2);
    ctx.fillStyle = '#1c2436';
    ctx.fillRect(x, y, 3, h);
    const lit = full ? (Math.sin(time * 6) > 0 ? '#bfe8ff' : '#6fd0ff') : '#4fb0e8';
    if (slot.timed || slot.max > h / 2) {
      const fill = Math.round((h * slot.charge) / slot.max);
      ctx.fillStyle = lit;
      ctx.fillRect(x, y + h - fill, 3, fill);
    } else {
      // One segment per room of charge, 1 px gaps. A segment part-way (Bolt's wind-up charges by the second)
      // fills from the bottom in a dimmer blue.
      const n = slot.max;
      const seg = (h - (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const sy = Math.round(y + h - (i + 1) * seg - i);
        const sh = Math.max(1, Math.round(seg));
        const f = slot.charge - i;
        ctx.fillStyle = f >= 1 ? lit : '#2a3350';
        ctx.fillRect(x, sy, 3, sh);
        if (f > 0 && f < 1) {
          const fh = Math.max(1, Math.round(sh * f));
          ctx.fillStyle = '#2f6f9a';
          ctx.fillRect(x, sy + sh - fh, 3, fh);
        }
      }
    }
    if (this.chargeFlash < 0.3) {
      ctx.globalAlpha = 1 - this.chargeFlash / 0.3;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, 5, h + 2);
      ctx.globalAlpha = 1;
    }
  }

  private drawTrinkets(ctx: CanvasRenderingContext2D, world: World, buttons: HudButtons): void {
    const t = world.player.inv.trinkets;
    if (t.length === 0) return;
    const b = buttons.consumable;
    const x = trinketX(b);
    let y = Math.round(b.y + (b.h - 14) / 2);
    if (t.length > 1) y -= 8;
    for (let i = 0; i < t.length && i < 2; i++) {
      ctx.globalAlpha = 0.9;
      ctx.drawImage(getFrame(itemIcon(t[i]!), 0), x, y + i * 16);
      ctx.globalAlpha = 1;
    }
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const t = this.bannerT;
    if (t >= BANNER_TIME || !this.bannerId) return;
    const slide = t < 0.18 ? 1 - t / 0.18 : 0;
    const fade = t > BANNER_TIME - 0.4 ? (BANNER_TIME - t) / 0.4 : 1;
    const w = this.bannerW;
    const x = Math.round((GAME_W - w) / 2);
    const y = Math.round(BANNER_Y - slide * (BANNER_H + 4));
    ctx.globalAlpha = fade * 0.92;
    drawPanel(ctx, x, y, w, BANNER_H, '#141a2a', UI.borderHot, '#2a3350');
    ctx.globalAlpha = fade;
    drawTextCentered(ctx, this.bannerName, GAME_W / 2, y + 4, BANNER_NAME);
    drawTextCentered(ctx, this.bannerDesc, GAME_W / 2, y + 17, BANNER_DESC);
    ctx.globalAlpha = 1;
  }

  /** HUD element rects in game px (for window.__SD / e2e layout checks). */
  rects(world: World, buttons: HudButtons): HudRect[] {
    const h = world.player.health;
    const hearts = (h.redMax >> 1) + h.bonusCount;
    const rows = Math.max(1, Math.ceil(hearts / HEARTS_PER_ROW));
    const cols = Math.min(HEARTS_PER_ROW, Math.max(1, hearts));
    const out: HudRect[] = [
      { id: 'hearts', x: HEARTS_X, y: HEARTS_Y, w: (cols - 1) * HEART_STEP_X + 9, h: (rows - 1) * HEART_STEP_Y + 8 },
      { id: 'counters', x: COUNTERS_X, y: COUNTERS_Y, w: 10 + measureText('99'), h: COUNTER_STEP * 2 + 8 },
    ];
    if (world.player.inv.active && world.player.inv.active.max > 0) {
      const b = buttons.active;
      out.push({ id: 'charge', x: b.x < GAME_W / 2 ? Math.round(b.x + b.w) + 2 : Math.round(b.x) - 7, y: Math.round(b.y), w: 5, h: b.h });
    }
    const t = world.player.inv.trinkets.length;
    if (t > 0) {
      const b = buttons.consumable;
      out.push({ id: 'trinkets', x: trinketX(b), y: Math.round(b.y + (b.h - 14) / 2) - (t > 1 ? 8 : 0), w: 14, h: t > 1 ? 30 : 14 });
    }
    if (this.bannerVisible && this.bannerId) {
      out.push({ id: 'banner', x: Math.round((GAME_W - this.bannerW) / 2), y: BANNER_Y, w: this.bannerW, h: BANNER_H });
    }
    return out;
  }
}
