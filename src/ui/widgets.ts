/**
 * Canvas-drawn UI widgets. Buttons are HitButtons (engine/buttons.ts) plus a label/icon; menu buttons
 * activate on pointer-up inside themselves (a thumb can slide off to cancel), with touch, mouse or keys.
 * Size rule: menu buttons are >= BTN_H (27) game px tall — >= 44 pt even in Safari's short landscape view
 * (1 game px ≈ 1.67-2.05 pt on an iPhone 15).
 *
 * - {@link MenuNav}: keyboard focus for a scene's buttons (arrows move to the nearest button that way,
 *   Enter / Space activate, a slider's left / right adjust it); the focus ring shows while the keyboard is in use.
 * - {@link Scroller}: drag / flick / wheel scrolling of a draggable list button (momentum, soft bounce).
 * - Tiles (icon over a small label), the menu pages' backdrop and header.
 */

import { makeButton, type HitButton } from '../engine/buttons';
import { GAME_H, GAME_W } from '../engine/screen';
import type { SpriteDef } from '../sim/types';
import { UI } from '../content/sprites/palette';
import { ctx2d, makeCanvas } from '../render/canvas';
import { drawText, drawTextCentered, FONT_H, measureText, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';
import { getFrame } from '../render/sprites';
import { buildTitleBackdrop } from '../render/titleArt';

export type ButtonKind = 'primary' | 'secondary' | 'hud' | 'tile';

/**
 * Menu button height (game px): >= 44 pt on every iPhone 15 view — Safari with its toolbars shows the game
 * at about 1.67 CSS px per game px (320 px tall), so 27 px = 45 pt; the home-screen app is larger.
 */
export const BTN_H = 27;

export interface UiButton extends HitButton {
  label: string;
  icon: SpriteDef | null;
  kind: ButtonKind;
  /** Text scale (menu buttons use 2 for thumb-friendly labels). */
  textScale: number;
  /** Keyboard focus may land here (default true; big invisible areas opt out). */
  nav: boolean;
  /** Sliders / steppers: the keyboard's left / right adjust instead of moving the focus. */
  adjust: ((dir: -1 | 1) => void) | null;
}

export function uiButton(init: Partial<UiButton> & { id: string }): UiButton {
  const base = makeButton({ pad: 3, ...init });
  return {
    ...base,
    label: init.label ?? '',
    icon: init.icon ?? null,
    kind: init.kind ?? 'secondary',
    textScale: init.textScale ?? 2,
    nav: init.nav ?? true,
    adjust: init.adjust ?? null,
  };
}

const LABEL_PRIMARY: TextStyle = { color: '#fff3c4', shadow: '#3a2410' };
const LABEL_SECONDARY: TextStyle = { color: UI.text, shadow: UI.shadow };
const LABEL_DISABLED: TextStyle = { color: UI.textDim, shadow: UI.shadow };
const TILE_LABEL: TextStyle = { color: UI.text, shadow: UI.shadow };

/** Scaled copies of the label styles, created once (no per-frame allocation). */
const styleCache = new Map<TextStyle, TextStyle[]>();
export function scaledStyle(base: TextStyle, scale: number): TextStyle {
  let arr = styleCache.get(base);
  if (!arr) {
    arr = [];
    styleCache.set(base, arr);
  }
  return (arr[scale] ??= { ...base, scale });
}

/** Draws a menu button: raised panel with a drop edge; pressed = sunk 1 px and brighter. */
export function drawMenuButton(ctx: CanvasRenderingContext2D, b: UiButton): void {
  if (!b.visible) return;
  if (b.kind === 'tile') {
    drawTile(ctx, b);
    return;
  }
  const pressed = b.held > 0 && b.armed;
  const primary = b.kind === 'primary';
  const x = Math.round(b.x);
  const y = Math.round(b.y) + (pressed ? 1 : 0);
  const h = b.h - 1;
  if (!pressed) {
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(x + 1, Math.round(b.y) + h, b.w - 2, 1);
  }
  const fill = !b.enabled ? '#151a28' : pressed ? (primary ? '#3b4870' : '#2a3350') : primary ? '#2b3553' : UI.panel;
  const border = !b.enabled ? '#2e3650' : primary ? UI.borderHot : pressed ? '#8a98c4' : UI.border;
  drawPanel(ctx, x, y, b.w, h, fill, border, !b.enabled ? null : primary ? '#44527c' : '#28304a');
  flash(ctx, b, x, y, h);
  const style = scaledStyle(!b.enabled ? LABEL_DISABLED : primary ? LABEL_PRIMARY : LABEL_SECONDARY, b.textScale);
  const ty = y + Math.round((h - FONT_H * b.textScale) / 2);
  if (b.icon) {
    // Icon + label side by side, centred together.
    const img = getFrame(b.icon, 0);
    const tw = measureText(b.label, b.textScale);
    const gap = b.label ? 4 : 0;
    const x0 = Math.round(x + (b.w - img.width - gap - tw) / 2);
    ctx.globalAlpha = b.enabled ? 1 : 0.4;
    ctx.drawImage(img, x0, y + Math.round((h - img.height) / 2));
    ctx.globalAlpha = 1;
    if (b.label) drawText(ctx, b.label, x0 + img.width + gap, ty, style);
  } else {
    drawTextCentered(ctx, b.label, x + b.w / 2, ty, style);
  }
}

function flash(ctx: CanvasRenderingContext2D, b: UiButton, x: number, y: number, h: number): void {
  if (b.flash >= 0.15) return;
  ctx.globalAlpha = 0.35 * (1 - b.flash / 0.15);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 1, y + 1, b.w - 2, h - 2);
  ctx.globalAlpha = 1;
}

/** A tile: a panel with a big icon over a small label (the title's page buttons). */
export function drawTile(ctx: CanvasRenderingContext2D, b: UiButton): void {
  const pressed = b.held > 0 && b.armed;
  const x = Math.round(b.x);
  const y = Math.round(b.y) + (pressed ? 1 : 0);
  const h = b.h - 1;
  if (!pressed) {
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(x + 1, Math.round(b.y) + h, b.w - 2, 1);
  }
  ctx.globalAlpha = pressed ? 0.95 : 0.86;
  drawPanel(ctx, x, y, b.w, h, pressed ? '#2a3350' : '#141a2a', pressed ? '#8a98c4' : '#46537a', '#232b42');
  ctx.globalAlpha = 1;
  flash(ctx, b, x, y, h);
  const labelH = b.label ? FONT_H + 3 : 0;
  if (b.icon) {
    const img = getFrame(b.icon, 0);
    ctx.drawImage(img, Math.round(x + (b.w - img.width) / 2), Math.round(y + (h - labelH - img.height) / 2) + (b.label ? 1 : 0));
  }
  if (b.label) drawTextCentered(ctx, b.label, x + b.w / 2, y + h - FONT_H - 4, TILE_LABEL);
}

/** Advance per-button flash timers (call from the owning scene's update). */
export function tickButtons(buttons: readonly HitButton[], dt: number): void {
  for (let i = 0; i < buttons.length; i++) {
    const b = buttons[i]!;
    if (b.flash < 1) b.flash = Math.min(1, b.flash + dt);
  }
}

/** Draws every menu button (indexed loop: no iterator allocation per frame). */
export function drawMenuButtons(ctx: CanvasRenderingContext2D, buttons: readonly UiButton[]): void {
  for (let i = 0; i < buttons.length; i++) drawMenuButton(ctx, buttons[i]!);
}

/** Fires a button the way a tap would (keyboard activation): its flash, then its callback. */
export function activateButton(b: UiButton): void {
  if (!b.visible || !b.enabled) return;
  b.flash = 0;
  b.onActivate?.();
}

// ── Keyboard focus ─────────────────────────────────────────────────────────────

/**
 * Keyboard navigation over a scene's buttons. Arrows move to the nearest focusable button in that
 * direction (its centre must lie that way; distance along the axis + 2 × the sideways offset), Tab /
 * Shift+Tab go through them in list order, Enter / Space activate. A focused slider (`adjust`) takes left /
 * right itself. `onMove` plays the move sound.
 */
export class MenuNav {
  focus: UiButton | null = null;
  private readonly list: () => readonly UiButton[];
  onMove: (() => void) | null = null;

  constructor(list: () => readonly UiButton[]) {
    this.list = list;
  }

  private focusable(b: UiButton): boolean {
    return b.visible && b.enabled && b.nav;
  }

  /** Focus a button (or the first focusable one); returns it. */
  set(b: UiButton | null): UiButton | null {
    this.focus = b && this.focusable(b) ? b : this.first();
    return this.focus;
  }

  first(): UiButton | null {
    const l = this.list();
    for (let i = 0; i < l.length; i++) if (this.focusable(l[i]!)) return l[i]!;
    return null;
  }

  /** The focus, re-validated (it may have been hidden / disabled since). */
  current(): UiButton | null {
    if (this.focus && !this.focusable(this.focus)) this.focus = null;
    return this.focus;
  }

  onKey(code: string): boolean {
    let dx = 0;
    let dy = 0;
    switch (code) {
      case 'ArrowLeft':
        dx = -1;
        break;
      case 'ArrowRight':
        dx = 1;
        break;
      case 'ArrowUp':
        dy = -1;
        break;
      case 'ArrowDown':
        dy = 1;
        break;
      case 'Tab':
        this.step(1);
        return true;
      case 'Enter':
      case 'NumpadEnter':
      case 'Space': {
        const f = this.current();
        if (!f) return false;
        // Sliders take left / right; Enter on one does nothing (its tap handler reads a pointer position).
        if (!f.adjust) activateButton(f);
        return true;
      }
      default:
        return false;
    }
    const f = this.current();
    if (!f) {
      if (this.set(null)) this.onMove?.();
      return true;
    }
    if (dx !== 0 && f.adjust) {
      f.adjust(dx as -1 | 1);
      return true;
    }
    const next = this.nearest(f, dx, dy);
    if (next) {
      this.focus = next;
      this.onMove?.();
    }
    return true;
  }

  private step(dir: number): void {
    const l = this.list().filter((b) => this.focusable(b));
    if (l.length === 0) return;
    const i = this.focus ? l.indexOf(this.focus) : -1;
    this.focus = l[(i + dir + l.length) % l.length]!;
    this.onMove?.();
  }

  private nearest(f: UiButton, dx: number, dy: number): UiButton | null {
    const fx = f.x + f.w / 2;
    const fy = f.y + f.h / 2;
    let best: UiButton | null = null;
    let bestScore = Infinity;
    const l = this.list();
    for (let i = 0; i < l.length; i++) {
      const b = l[i]!;
      if (b === f || !this.focusable(b)) continue;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const along = (bx - fx) * dx + (by - fy) * dy;
      if (along <= 1) continue;
      // Sideways distance: 0 while the rects overlap on the other axis.
      const side = dx !== 0 ? gap(f.y, f.h, b.y, b.h) : gap(f.x, f.w, b.x, b.w);
      const score = along + side * 2;
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  /** Corner brackets around the focused button (only while the keyboard is being used). */
  draw(ctx: CanvasRenderingContext2D, time: number, show: boolean): void {
    const f = this.current();
    if (!f || !show) return;
    const pulse = Math.floor(time * 4) % 2 === 0 ? 1 : 0;
    const x = Math.round(f.x) - 2 - pulse;
    const y = Math.round(f.y) - 2 - pulse;
    const w = f.w + 4 + pulse * 2;
    const h = f.h + 3 + pulse * 2;
    ctx.fillStyle = UI.accent;
    const L = 5;
    ctx.fillRect(x, y, L, 1);
    ctx.fillRect(x, y, 1, L);
    ctx.fillRect(x + w - L, y, L, 1);
    ctx.fillRect(x + w - 1, y, 1, L);
    ctx.fillRect(x, y + h - 1, L, 1);
    ctx.fillRect(x, y + h - L, 1, L);
    ctx.fillRect(x + w - L, y + h - 1, L, 1);
    ctx.fillRect(x + w - 1, y + h - L, 1, L);
  }
}

/** Distance between two 1-D spans (0 when they overlap). */
function gap(a: number, aw: number, b: number, bw: number): number {
  if (b + bw <= a) return a - (b + bw);
  if (b >= a + aw) return b - (a + aw);
  return 0;
}

// ── Scrolling lists ────────────────────────────────────────────────────────────

/**
 * Scrolling for a draggable list button: while it is held and dragged the content follows the finger;
 * released, it keeps the flick's momentum with friction and settles back inside [0, max]. Wheel and keys
 * scroll by amounts. `pos` is the scroll offset (px) along `axis`.
 */
export class Scroller {
  pos = 0;
  max = 0;
  private vel = 0;
  private pressing = false;
  private pressPos = 0;
  private last = 0;
  readonly area: HitButton;
  readonly axis: 'x' | 'y';

  constructor(area: HitButton, axis: 'x' | 'y' = 'y') {
    this.area = area;
    this.axis = axis;
  }

  /** Content size vs view size along the axis (call when the content changes). */
  setContent(content: number, view: number): void {
    this.max = Math.max(0, content - view);
    if (this.pos > this.max) this.pos = this.max;
  }

  by(d: number): void {
    this.vel = 0;
    this.pos = Math.max(0, Math.min(this.max, this.pos + d));
  }

  /** Scrolls just enough to show [start, start + size) inside a view of `view` px. */
  reveal(start: number, size: number, view: number): void {
    if (start < this.pos) this.by(start - this.pos);
    else if (start + size > this.pos + view) this.by(start + size - view - this.pos);
  }

  /** True while a drag is moving the content (taps are suppressed by the button itself). */
  get dragging(): boolean {
    return this.area.held > 0 && this.area.dragged;
  }

  update(dt: number): void {
    const a = this.area;
    const cur = this.axis === 'y' ? a.curY : a.curX;
    const down = this.axis === 'y' ? a.downY : a.downX;
    if (a.held > 0) {
      if (!this.pressing) {
        this.pressing = true;
        this.pressPos = this.pos;
        this.last = this.pos;
        this.vel = 0;
      }
      if (a.dragged) {
        const s = Math.max(-12, Math.min(this.max + 12, this.pressPos - (cur - down)));
        this.vel = dt > 0 ? (s - this.last) / dt : 0;
        this.last = s;
        this.pos = s;
      }
      return;
    }
    if (this.pressing) {
      this.pressing = false;
      if (!a.dragged) this.vel = 0;
    }
    let s = this.pos;
    if (Math.abs(this.vel) > 1) {
      s += this.vel * dt;
      this.vel *= Math.exp(-5 * dt);
    } else {
      this.vel = 0;
    }
    if (s < 0) {
      s += (0 - s) * Math.min(1, dt * 14);
      if (s > -0.5) s = 0;
      this.vel = 0;
    } else if (s > this.max) {
      s += (this.max - s) * Math.min(1, dt * 14);
      if (s < this.max + 0.5) s = this.max;
      this.vel = 0;
    }
    this.pos = s;
  }

  /** A thin scroll bar along the right edge of (x, y, h). */
  drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
    if (this.max <= 0) return;
    const view = h;
    const barH = Math.max(10, Math.round((h * view) / (view + this.max)));
    const t = Math.max(0, Math.min(1, this.pos / this.max));
    ctx.fillStyle = '#1e2638';
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = '#6a7896';
    ctx.fillRect(x, Math.round(y + (h - barH) * t), 2, barH);
  }
}

// ── Menu pages: backdrop + header ────────────────────────────────────────────

let pageBg: HTMLCanvasElement | null = null;

/** The drain tunnel, darkened: the backdrop of every menu page (built once). */
export function pageBackdrop(): HTMLCanvasElement {
  if (pageBg) return pageBg;
  const c = makeCanvas(GAME_W, GAME_H);
  const g = ctx2d(c);
  g.drawImage(buildTitleBackdrop(), 0, 0);
  g.fillStyle = 'rgba(5,6,11,0.8)';
  g.fillRect(0, 0, GAME_W, GAME_H);
  // A faint vignette band top and bottom.
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, GAME_W, 36);
  pageBg = c;
  return c;
}

const PAGE_TITLE: TextStyle = { color: UI.accent, shadow: '#2a1a08', scale: 2 };

/** Header of a menu page: the title right of the BACK button and a rule under both. */
export function drawPageHeader(ctx: CanvasRenderingContext2D, title: string, x = 74): void {
  drawText(ctx, title, x, 12, PAGE_TITLE);
  ctx.fillStyle = '#2a3350';
  ctx.fillRect(6, 35, GAME_W - 12, 1);
}

/**
 * Word-wraps `text` to lines of at most `maxW` px (scale 1). Cached per (text, width) so pages can call it
 * every frame without allocating.
 */
const wrapCache = new Map<string, string[]>();
export function wrapText(text: string, maxW: number): string[] {
  const key = `${maxW}|${text}`;
  const hit = wrapCache.get(key);
  if (hit) return hit;
  const out: string[] = [];
  for (const para of text.toUpperCase().split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measureText(next) > maxW) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    out.push(line);
  }
  if (wrapCache.size > 400) wrapCache.clear();
  wrapCache.set(key, out);
  return out;
}

/** Draws wrapped lines from (x, y), `lineH` apart; returns how many were drawn. */
export function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, style: TextStyle, lineH = 8, maxLines = 99): number {
  const lines = wrapText(text, maxW);
  const n = Math.min(lines.length, maxLines);
  for (let i = 0; i < n; i++) drawText(ctx, lines[i]!, x, y + i * lineH, style);
  return n;
}
