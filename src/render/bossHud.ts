/**
 * Boss presentation in the HUD band and over the room (ARCHITECTURE §8):
 * - the HP bar: the boss's name over a bar in the top band (never over the room), phase notches, a
 *   pale trail that drains after each hit, red for bosses / orange for minibosses / violet for finals;
 *   it slides in when the fight begins and blinks empty during the death sequence;
 * - the intro card: a band across the room with the boss's portrait, its name, the chapter and a
 *   flavour line, sliding in when the fight begins ('bossIntro').
 * Presentation only; everything it reads is `world.boss` (sim/bosses/state.ts BossFight).
 */

import type { GameEvent } from '../engine/events';
import { BOSSES } from '../content/registry';
import { FIGHT_FINAL, FIGHT_MINIBOSS, type BossFight } from '../sim/bosses/state';
import type { SpriteDef } from '../sim/types';
import { drawText, drawTextCentered, measureText, type TextStyle } from './font';
import { GAME_W } from './layout';
import { drawPanel } from './pixel';
import { getFrame } from './sprites';

const NAME: TextStyle = { color: '#ffe9a8', shadow: '#07080d' };
const CARD_NAME: TextStyle = { color: '#ffe9a8', shadow: '#2a1a08', outline: '#07080d', scale: 2 };
const CARD_SUB: TextStyle = { color: '#c9d3f0', shadow: '#07080d' };
const CARD_FLAVOUR: TextStyle = { color: '#8e98b5', shadow: '#07080d' };
const CARD_KIND: TextStyle = { color: '#ff8a7a', shadow: '#07080d' };

/** Bar geometry (game px, top band). */
export const BOSS_BAR_W = 140;
export const BOSS_BAR_Y = 38;
const BAR_H = 5;
/** Intro card length (s). */
export const BOSS_CARD_TIME = 2.2;

/** Fill / rim colours per fight kind (boss, miniboss, final). */
const FILL = ['#e0515a', '#f08a3a', '#b070f0'] as const;
const RIM = ['#ff9aa0', '#ffc080', '#e0c0ff'] as const;

export class BossHud {
  /** The HP the bar shows (a trail that drains after the real value). */
  private shownHp = 0;
  private trailHp = 0;
  private cardT = BOSS_CARD_TIME;
  private cardSprite: SpriteDef | null = null;
  private cardKind = 0;
  private hitT = 1;
  /** Upper-case name / chapter, cached per fight (no strings per frame). */
  private idFor = '';
  private chapterFor = '';
  private nameUp = '';
  private chapterUp = '';

  private texts(f: BossFight): void {
    if (this.idFor === f.id && this.chapterFor === f.chapter) return;
    this.idFor = f.id;
    this.chapterFor = f.chapter;
    this.nameUp = f.name.toUpperCase();
    this.chapterUp = f.chapter.toUpperCase();
  }

  reset(): void {
    this.shownHp = 0;
    this.trailHp = 0;
    this.cardT = BOSS_CARD_TIME;
    this.cardSprite = null;
  }

  /** Is the intro card showing? */
  get cardVisible(): boolean {
    return this.cardT < BOSS_CARD_TIME;
  }

  onEvent(e: GameEvent): void {
    if (e.type === 'bossIntro') {
      const def = BOSSES.get(e.id);
      this.cardSprite = def && typeof def.sprite !== 'string' ? def.sprite : null;
      this.cardKind = e.a;
      this.cardT = 0;
    }
  }

  update(dt: number, f: BossFight): void {
    if (this.cardT < BOSS_CARD_TIME) this.cardT += dt;
    if (this.hitT < 1) this.hitT += dt;
    if (!f.active) {
      this.shownHp = this.trailHp = 0;
      return;
    }
    if (f.hp < this.shownHp - 0.01) this.hitT = 0;
    this.shownHp = f.hp;
    // The pale trail catches up after a short pause.
    if (this.trailHp < this.shownHp) this.trailHp = this.shownHp;
    else if (this.hitT > 0.35) this.trailHp = Math.max(this.shownHp, this.trailHp - f.maxHp * dt * 0.6);
  }

  /** The HP bar in the top band (name above it). */
  drawBar(ctx: CanvasRenderingContext2D, f: BossFight, time: number): void {
    if (!f.active) return;
    const slide = f.age < 0.4 ? Math.round((1 - f.age / 0.4) * -24) : 0;
    const k = f.kind === FIGHT_MINIBOSS ? 1 : f.kind === FIGHT_FINAL ? 2 : 0;
    const w = k === 1 ? 110 : BOSS_BAR_W;
    const x = Math.round((GAME_W - w) / 2);
    const y = BOSS_BAR_Y + slide;
    this.texts(f);
    drawTextCentered(ctx, this.nameUp, GAME_W / 2, y - 8, NAME);
    drawPanel(ctx, x - 2, y - 2, w + 4, BAR_H + 4, '#07080d', f.dying ? '#ffffff' : '#56648a');
    const max = Math.max(1, f.maxHp);
    const trail = Math.round((w * Math.max(0, this.trailHp)) / max);
    const fill = Math.round((w * Math.max(0, f.hp)) / max);
    ctx.fillStyle = '#2a1520';
    ctx.fillRect(x, y, w, BAR_H);
    if (trail > fill) {
      ctx.fillStyle = '#fff0c0';
      ctx.fillRect(x + fill, y, trail - fill, BAR_H);
    }
    if (fill > 0) {
      ctx.fillStyle = this.hitT < 0.08 ? '#ffffff' : FILL[k];
      ctx.fillRect(x, y, fill, BAR_H);
      ctx.fillStyle = RIM[k];
      ctx.fillRect(x, y, fill, 1);
    }
    // Phase notches.
    ctx.fillStyle = '#07080d';
    for (let i = 1; i < f.marks.length; i++) {
      const nx = x + Math.round(w * f.marks[i]!);
      ctx.fillRect(nx, y - 1, 1, BAR_H + 2);
    }
    if (f.dying && (Math.floor(time * 8) & 1) === 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, w, BAR_H);
      ctx.globalAlpha = 1;
    }
  }

  /** The intro card over the room (portrait, name, chapter, flavour line). */
  drawCard(ctx: CanvasRenderingContext2D, f: BossFight, time: number): void {
    if (this.cardT >= BOSS_CARD_TIME) return;
    const t = this.cardT;
    const a = t < 0.2 ? t / 0.2 : t > BOSS_CARD_TIME - 0.45 ? (BOSS_CARD_TIME - t) / 0.45 : 1;
    const slide = t < 0.25 ? Math.round((1 - t / 0.25) * -80) : 0;
    const y = 70;
    const h = 48;
    ctx.globalAlpha = a * 0.86;
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, y, GAME_W, h);
    const edge = this.cardKind === FIGHT_FINAL ? '#b070f0' : this.cardKind === FIGHT_MINIBOSS ? '#f08a3a' : '#e0515a';
    ctx.fillStyle = edge;
    ctx.fillRect(0, y, GAME_W, 1);
    ctx.fillRect(0, y + h - 1, GAME_W, 1);
    ctx.globalAlpha = a;
    // The portrait (first frame, whole pixels only) on the left, the text in a column to its right.
    this.texts(f);
    const name = this.nameUp;
    const kind = this.cardKind === FIGHT_FINAL ? 'FINAL BOSS' : this.cardKind === FIGHT_MINIBOSS ? 'MINIBOSS' : this.chapterUp;
    const textW = Math.max(measureText(name, 2), measureText(kind), f.title ? measureText(f.title) : 0);
    const spr = this.cardSprite;
    const img = spr ? getFrame(spr, 0) : null;
    const pw = img ? img.width + 10 : 0;
    // Centre portrait + column, but keep the column on screen.
    let colX = Math.round((GAME_W - (pw + textW)) / 2) + pw;
    colX = Math.min(colX, GAME_W - 6 - textW);
    colX += slide;
    if (img) {
      // Tall portraits are cropped at the card's top edge rather than scaled (pixel art stays crisp).
      const dh = Math.min(img.height, h - 4);
      ctx.drawImage(img, 0, img.height - dh, img.width, dh, colX - pw, y + h - 2 - dh + Math.round(Math.sin(time * 3)), img.width, dh);
    }
    drawText(ctx, kind, colX, y + 6, this.cardKind === 0 ? CARD_SUB : CARD_KIND);
    drawText(ctx, name, colX, y + 15, CARD_NAME);
    if (f.title) drawText(ctx, f.title, colX, y + 34, CARD_FLAVOUR);
    ctx.globalAlpha = 1;
  }
}
