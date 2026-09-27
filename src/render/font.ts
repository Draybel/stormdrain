/**
 * "Drainletter" — an original compact 5-px-tall pixel font (variable width, uppercase; lowercase
 * input is drawn as uppercase). Glyphs are bitmaps in code, baked lazily into one atlas canvas
 * per colour, so drawing text is a drawImage per character.
 *
 * Special glyphs: ♥ heart, ¤ coin, ° degree, · middle dot, × times, ← ↑ → ↓ arrows.
 */

import { ctx2d, makeCanvas } from './canvas';

export const FONT_H = 5;
export const LINE_H = 7;
const SPACING = 1;

// Rows separated by '|'. '#' = ink.
const GLYPHS: Readonly<Record<string, string>> = {
  A: '.#.|#.#|###|#.#|#.#',
  B: '##.|#.#|##.|#.#|##.',
  C: '.##|#..|#..|#..|.##',
  D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###',
  F: '###|#..|##.|#..|#..',
  G: '.##|#..|#.#|#.#|.##',
  H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###',
  J: '..#|..#|..#|#.#|.#.',
  K: '#.#|#.#|##.|#.#|#.#',
  L: '#..|#..|#..|#..|###',
  M: '#...#|##.##|#.#.#|#...#|#...#',
  N: '#..#|##.#|#.##|#..#|#..#',
  O: '.##.|#..#|#..#|#..#|.##.',
  P: '##.|#.#|##.|#..|#..',
  Q: '.##.|#..#|#..#|#.#.|.#.#',
  R: '##.|#.#|##.|#.#|#.#',
  S: '.##|#..|.#.|..#|##.',
  T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###',
  V: '#.#|#.#|#.#|#.#|.#.',
  W: '#...#|#...#|#.#.#|#.#.#|.#.#.',
  X: '#.#|#.#|.#.|#.#|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.',
  Z: '###|..#|.#.|#..|###',
  '0': '###|#.#|#.#|#.#|###',
  '1': '.#.|##.|.#.|.#.|###',
  '2': '##.|..#|.#.|#..|###',
  '3': '##.|..#|.#.|..#|##.',
  '4': '#.#|#.#|###|..#|..#',
  '5': '###|#..|##.|..#|##.',
  '6': '.##|#..|###|#.#|###',
  '7': '###|..#|.#.|.#.|.#.',
  '8': '###|#.#|###|#.#|###',
  '9': '###|#.#|###|..#|##.',
  ' ': '..|..|..|..|..',
  '.': '.|.|.|.|#',
  ',': '..|..|..|.#|#.',
  '!': '#|#|#|.|#',
  '?': '##.|..#|.#.|...|.#.',
  ':': '.|#|.|#|.',
  ';': '..|.#|..|.#|#.',
  "'": '#|#|.|.|.',
  '"': '#.#|#.#|...|...|...',
  '-': '...|...|###|...|...',
  '+': '...|.#.|###|.#.|...',
  '=': '...|###|...|###|...',
  '/': '..#|..#|.#.|#..|#..',
  '(': '.#|#.|#.|#.|.#',
  ')': '#.|.#|.#|.#|#.',
  '[': '##|#.|#.|#.|##',
  ']': '##|.#|.#|.#|##',
  '%': '#.#|..#|.#.|#..|#.#',
  '*': '...|#.#|.#.|#.#|...',
  '#': '.#.#.|#####|.#.#.|#####|.#.#.',
  '<': '..#|.#.|#..|.#.|..#',
  '>': '#..|.#.|..#|.#.|#..',
  _: '...|...|...|...|###',
  '&': '.#..|#.#.|.#..|#.##|.##.',
  '°': '.#.|#.#|.#.|...|...',
  '·': '.|.|#|.|.',
  '×': '...|#.#|.#.|#.#|...',
  '♥': '.#.#.|#####|#####|.###.|..#..',
  '¤': '.##.|####|####|####|.##.',
  '←': '.....|.#...|#####|.#...|.....',
  '→': '.....|...#.|#####|...#.|.....',
  '↑': '.#.|###|.#.|.#.|.#.',
  '↓': '.#.|.#.|.#.|###|.#.',
};

interface Glyph {
  x: number;
  w: number;
  rows: string[];
}

const glyphs = new Map<number, Glyph>();
let atlasWidth = 0;
for (const [ch, data] of Object.entries(GLYPHS)) {
  const rows = data.split('|');
  const w = rows[0]!.length;
  glyphs.set(ch.codePointAt(0)!, { x: atlasWidth, w, rows });
  atlasWidth += w + 1;
}
const FALLBACK = glyphs.get('?'.codePointAt(0)!)!;

function glyphFor(code: number): Glyph {
  // a-z → A-Z
  if (code >= 97 && code <= 122) code -= 32;
  return glyphs.get(code) ?? FALLBACK;
}

const atlases = new Map<string, HTMLCanvasElement>();

function atlas(color: string): HTMLCanvasElement {
  let a = atlases.get(color);
  if (a) return a;
  a = makeCanvas(atlasWidth, FONT_H);
  const ctx = ctx2d(a);
  ctx.fillStyle = color;
  for (const g of glyphs.values()) {
    for (let y = 0; y < FONT_H; y++) {
      const row = g.rows[y]!;
      for (let x = 0; x < g.w; x++) if (row[x] === '#') ctx.fillRect(g.x + x, y, 1, 1);
    }
  }
  atlases.set(color, a);
  return a;
}

export interface TextStyle {
  color: string;
  /** Drop shadow colour (offset 1 px right/down, scaled), or null. */
  shadow?: string | null;
  /** 1 game-px outline all around (not scaled), or null. The shadow then sits under it. */
  outline?: string | null;
  /** Integer pixel scale (default 1). */
  scale?: number;
}

/** Width in px of the widest line. */
export function measureText(text: string, scale = 1): number {
  let best = 0;
  let w = 0;
  let any = false;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) {
      if (any) w -= SPACING;
      if (w > best) best = w;
      w = 0;
      any = false;
      continue;
    }
    w += glyphFor(code).w + SPACING;
    any = true;
  }
  if (any) w -= SPACING;
  if (w > best) best = w;
  return best * scale;
}

/** Height in px of `lines` lines of text. */
export function textHeight(lines = 1, scale = 1): number {
  return (FONT_H + (lines - 1) * LINE_H) * scale;
}

function run(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, img: HTMLCanvasElement, s: number): void {
  let cx = x;
  let cy = y;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 10) {
      cx = x;
      cy += LINE_H * s;
      continue;
    }
    const g = glyphFor(code);
    if (code !== 32) ctx.drawImage(img, g.x, 0, g.w, FONT_H, cx, cy, g.w * s, FONT_H * s);
    cx += (g.w + SPACING) * s;
  }
}

/** Draws text with its top-left at (x, y). */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): void {
  const s = style.scale ?? 1;
  x = Math.round(x);
  y = Math.round(y);
  if (style.outline) {
    if (style.shadow) run(ctx, text, x, y + 2, atlas(style.shadow), s);
    const o = atlas(style.outline);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) run(ctx, text, x + dx, y + dy, o, s);
    }
  } else if (style.shadow) {
    run(ctx, text, x + s, y + s, atlas(style.shadow), s);
  }
  run(ctx, text, x, y, atlas(style.color), s);
}

/** Draws text horizontally centred on cx (each line centred). */
export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  style: TextStyle,
): void {
  if (text.indexOf('\n') < 0) {
    drawText(ctx, text, cx - measureText(text, style.scale ?? 1) / 2, y, style);
    return;
  }
  const s = style.scale ?? 1;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    drawText(ctx, line, cx - measureText(line, s) / 2, y + i * LINE_H * s, style);
  }
}

/**
 * Bake a whole string into a canvas once (for logos and other static text).
 * Multi-line text is centred line by line unless `align` is 'left'.
 */
export function bakeText(text: string, style: TextStyle, align: 'left' | 'center' = 'center'): HTMLCanvasElement {
  const s = style.scale ?? 1;
  const pad = style.outline ? 1 : 0;
  const extraBottom = style.shadow ? (style.outline ? 2 : s) : 0;
  const lines = text.split('\n');
  const w = measureText(text, s);
  const c = makeCanvas(w + pad * 2 + (style.shadow && !style.outline ? s : 0), textHeight(lines.length, s) + pad * 2 + extraBottom);
  const ctx = ctx2d(c);
  if (align === 'left' || lines.length === 1) {
    drawText(ctx, text, pad, pad, style);
  } else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      drawText(ctx, line, pad + Math.floor((w - measureText(line, s)) / 2), pad + i * LINE_H * s, style);
    }
  }
  return c;
}
