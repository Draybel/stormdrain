/**
 * Display scaling. Everything is drawn into a 384×192 back-buffer; each frame it is blitted onto
 * the full-viewport display canvas (CSS px × devicePixelRatio) with nearest-neighbour scaling,
 * uniformly scaled to fit INSIDE the safe area (env(safe-area-inset-*)) and centred, with black
 * letterbox around it. Also maps screen (client) coordinates back to game pixels for input.
 */

import { clamp, type Vec2 } from './math';
import { GAME_H, GAME_W } from './screen';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Where the game image lands, in CSS px. `scale` = CSS px per game px. */
export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

/** Largest backing store we allow per side (older iOS limits huge canvases). */
const MAX_CANVAS_SIDE = 4096;

export class Display {
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly screen: HTMLCanvasElement;
  private readonly sctx: CanvasRenderingContext2D;
  private readonly probe: HTMLElement | null;

  dpr = 1;
  cssW = 0;
  cssH = 0;
  readonly safe: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  readonly view: ViewRect = { x: 0, y: 0, w: GAME_W, h: GAME_H, scale: 1 };
  /** Portrait (height > width): the game pauses and a rotate-your-phone screen is shown. */
  portrait = false;
  /** Increments whenever the layout changes. */
  version = 0;

  /** Destination rect in device px. */
  private dx = 0;
  private dy = 0;
  private dw = GAME_W;
  private dh = GAME_H;
  private rectLeft = 0;
  private rectTop = 0;
  private dirty = true;
  private lastInnerW = -1;
  private lastInnerH = -1;
  private lastDpr = -1;
  /** What the screen canvas currently shows, so switching modes clears stale pixels. */
  private presented: 'none' | 'game' | 'other' = 'none';
  private readonly timers: ReturnType<typeof setTimeout>[] = [];

  constructor(screen: HTMLCanvasElement, probe: HTMLElement | null) {
    this.screen = screen;
    this.probe = probe;
    this.buffer = document.createElement('canvas');
    this.buffer.width = GAME_W;
    this.buffer.height = GAME_H;
    const ctx = this.buffer.getContext('2d', { alpha: false });
    const sctx = screen.getContext('2d', { alpha: false });
    if (!ctx || !sctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.sctx = sctx;
    this.ctx.imageSmoothingEnabled = false;

    window.addEventListener('resize', this.markDirty);
    window.addEventListener('orientationchange', this.onOrientation);
    window.visualViewport?.addEventListener('resize', this.markDirty);
    window.visualViewport?.addEventListener('scroll', this.markDirty);
    this.measure();
  }

  private readonly markDirty = (): void => {
    this.dirty = true;
  };

  /** iOS reports stale sizes right after rotating; re-measure a few times as it settles. */
  private readonly onOrientation = (): void => {
    this.dirty = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers.length = 0;
    for (const ms of [50, 200, 500, 1000]) this.timers.push(setTimeout(this.markDirty, ms));
  };

  /** Call once per frame. Cheap unless something changed. Returns true if the layout changed. */
  update(): boolean {
    const dpr = window.devicePixelRatio || 1;
    if (!this.dirty && window.innerWidth === this.lastInnerW && window.innerHeight === this.lastInnerH && dpr === this.lastDpr) {
      return false;
    }
    this.measure();
    return true;
  }

  measure(): void {
    this.dirty = false;
    this.lastInnerW = window.innerWidth;
    this.lastInnerH = window.innerHeight;
    this.lastDpr = window.devicePixelRatio || 1;

    const rect = this.screen.getBoundingClientRect();
    this.cssW = rect.width > 0 ? rect.width : window.innerWidth;
    this.cssH = rect.height > 0 ? rect.height : window.innerHeight;
    this.rectLeft = rect.left;
    this.rectTop = rect.top;
    this.readSafeArea();

    let dpr = clamp(this.lastDpr, 1, 4);
    // Keep the backing store within limits on huge screens.
    const maxSide = Math.max(this.cssW, this.cssH) * dpr;
    if (maxSide > MAX_CANVAS_SIDE) dpr *= MAX_CANVAS_SIDE / maxSide;
    this.dpr = dpr;

    const bw = Math.max(1, Math.round(this.cssW * dpr));
    const bh = Math.max(1, Math.round(this.cssH * dpr));
    if (this.screen.width !== bw || this.screen.height !== bh) {
      this.screen.width = bw;
      this.screen.height = bh;
    }
    this.portrait = this.cssH > this.cssW;

    // Fit the 2:1 image inside the safe rect (device px).
    const s = this.safe;
    const sw = Math.max(1, this.cssW - s.left - s.right) * dpr;
    const sh = Math.max(1, this.cssH - s.top - s.bottom) * dpr;
    let scale = Math.min(sw / GAME_W, sh / GAME_H);
    // Prefer a whole-number scale (perfectly even pixels) when it costs at most 10% of the size.
    const whole = Math.floor(scale);
    if (whole >= 1 && whole / scale >= 0.9) scale = whole;
    this.dw = Math.max(1, Math.floor(GAME_W * scale));
    this.dh = Math.max(1, Math.floor(GAME_H * scale));
    this.dx = Math.round(s.left * dpr + (sw - this.dw) / 2);
    this.dy = Math.round(s.top * dpr + (sh - this.dh) / 2);

    const v = this.view;
    v.x = this.dx / dpr;
    v.y = this.dy / dpr;
    v.w = this.dw / dpr;
    v.h = this.dh / dpr;
    v.scale = v.w / GAME_W;

    this.sctx.imageSmoothingEnabled = false;
    this.clearScreen();
    this.version++;
  }

  private readSafeArea(): void {
    const s = this.safe;
    if (!this.probe) {
      s.top = s.right = s.bottom = s.left = 0;
      return;
    }
    const cs = getComputedStyle(this.probe);
    s.top = parseFloat(cs.paddingTop) || 0;
    s.right = parseFloat(cs.paddingRight) || 0;
    s.bottom = parseFloat(cs.paddingBottom) || 0;
    s.left = parseFloat(cs.paddingLeft) || 0;
  }

  private clearScreen(): void {
    this.sctx.fillStyle = '#000';
    this.sctx.fillRect(0, 0, this.screen.width, this.screen.height);
    this.presented = 'none';
  }

  /** Blit the back-buffer to the screen. Letterbox stays black (cleared on layout change). */
  present(): void {
    if (this.presented !== 'game') {
      if (this.presented !== 'none') this.clearScreen();
      this.presented = 'game';
    }
    this.sctx.drawImage(this.buffer, 0, 0, GAME_W, GAME_H, this.dx, this.dy, this.dw, this.dh);
  }

  /**
   * Blit another low-res canvas (e.g. the portrait rotate screen) scaled to fit the safe area.
   */
  presentOther(src: HTMLCanvasElement): void {
    if (this.presented !== 'other') {
      this.clearScreen();
      this.presented = 'other';
    }
    const s = this.safe;
    const dpr = this.dpr;
    const sw = Math.max(1, this.cssW - s.left - s.right) * dpr;
    const sh = Math.max(1, this.cssH - s.top - s.bottom) * dpr;
    let scale = Math.min(sw / src.width, sh / src.height);
    const whole = Math.floor(scale);
    if (whole >= 1 && whole / scale >= 0.85) scale = whole;
    const w = Math.floor(src.width * scale);
    const h = Math.floor(src.height * scale);
    const x = Math.round(s.left * dpr + (sw - w) / 2);
    const y = Math.round(s.top * dpr + (sh - h) / 2);
    this.sctx.drawImage(src, 0, 0, src.width, src.height, x, y, w, h);
  }

  /**
   * Client (CSS) coordinates → game pixels. Points in the letterbox still map, clamped to the
   * edge, so a tap on the black bar next to a button still reaches it (button hit tests, menus).
   */
  toGame(clientX: number, clientY: number, out: Vec2): Vec2 {
    this.toGameRaw(clientX, clientY, out);
    out.x = clamp(out.x, 0, GAME_W - 0.001);
    out.y = clamp(out.y, 0, GAME_H - 0.001);
    return out;
  }

  /**
   * {@link toGame} without the clamp (polish batch 3): a point in the letterbox maps OUTSIDE 0..GAME_W × 0..GAME_H
   * (e.g. x = -20 in the home-screen app's 59 pt left inset). The floating sticks use it, so a thumb that lands near the
   * image edge or on the black bar can still push toward the bezel (a clamped point stops dead at the edge).
   */
  toGameRaw(clientX: number, clientY: number, out: Vec2): Vec2 {
    const v = this.view;
    out.x = (clientX - this.rectLeft - v.x) / v.scale;
    out.y = (clientY - this.rectTop - v.y) / v.scale;
    return out;
  }

  /** Game pixels → client (CSS) coordinates. */
  toClient(x: number, y: number, out: Vec2): Vec2 {
    const v = this.view;
    out.x = this.rectLeft + v.x + x * v.scale;
    out.y = this.rectTop + v.y + y * v.scale;
    return out;
  }
}
