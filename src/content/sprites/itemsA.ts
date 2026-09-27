/**
 * Items pack A — shared pixel-map helpers (all art original). The icons (itemsA-icons.ts), familiars
 * (itemsA-familiars.ts) and costumes (itemsA-costumes.ts) mix hand-drawn rows with a few raster
 * helpers (ellipses, lines, gears, auto-outline, light-from-the-upper-left shading) so round things get
 * clean curves and consistent shading. Everything runs ONCE at module load and produces plain
 * `SpriteDef`s; nothing here is touched per frame.
 *
 * Grid convention: `grid[y][x]`, '.' = transparent, every other character is a palette key.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

export const o = OUTLINE;

/** A mutable pixel grid (rows of single-character cells). */
export type Grid = string[][];

export function grid(w: number, h: number): Grid {
  const g: Grid = [];
  for (let y = 0; y < h; y++) g.push(new Array<string>(w).fill('.'));
  return g;
}

/** A grid pre-filled from rows (for editing a hand-drawn frame). */
export function gridOf(rows: readonly string[]): Grid {
  return rows.map((r) => r.split(''));
}

export function put(g: Grid, x: number, y: number, ch: string): void {
  if (y < 0 || y >= g.length) return;
  const row = g[y]!;
  if (x < 0 || x >= row.length) return;
  row[x] = ch;
}

export function get(g: Grid, x: number, y: number): string {
  if (y < 0 || y >= g.length) return '.';
  const row = g[y]!;
  return x < 0 || x >= row.length ? '.' : row[x]!;
}

/** Copies the non-transparent characters of `rows` onto the grid at (x, y). */
export function stamp(g: Grid, x: number, y: number, rows: readonly string[]): void {
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j]!;
    for (let i = 0; i < r.length; i++) {
      const ch = r[i]!;
      if (ch !== '.' && ch !== ' ') put(g, x + i, y + j, ch);
    }
  }
}

/** Fills every cell whose centre lies inside the ellipse. */
export function ellipse(g: Grid, cx: number, cy: number, rx: number, ry: number, ch: string): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[y]![x] = ch;
    }
  }
}

export function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch);
}

/** A 1 px line (Bresenham). */
export function line(g: Grid, x0: number, y0: number, x1: number, y1: number, ch: string): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    put(g, x, y, ch);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Fills every cell whose centre lies inside the polygon (even-odd rule). */
export function polygon(g: Grid, pts: readonly (readonly [number, number])[], ch: string): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) g[y]![x] = ch;
    }
  }
}

/** The corners of an `n`-pointed star (first point straight up). */
export function starPoints(cx: number, cy: number, rOut: number, rIn: number, n = 5): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

/**
 * A cog: `teeth` square-ish teeth out to `rOuter`, a body down to `rOuter - toothH`, a hole inside
 * `rHole` (0 = none). `phase` (radians) turns it — used for the animated halo.
 */
export function gear(
  g: Grid,
  cx: number,
  cy: number,
  rOuter: number,
  rHole: number,
  teeth: number,
  phase: number,
  ch: string,
  toothH = 1.4,
): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const r = Math.hypot(px, py);
      const a = Math.atan2(py, px);
      const tooth = Math.cos(teeth * (a + phase)) > 0.15;
      const R = tooth ? rOuter : rOuter - toothH;
      if (r <= R && r >= rHole) g[y]![x] = ch;
    }
  }
}

/**
 * Draws a 1 px outline (`ch`) on every transparent cell touching a coloured one (4-neighbourhood, or
 * 8 with `diagonal`). Cells already holding the outline character don't grow it further.
 */
export function outline(g: Grid, ch = 'o', diagonal = false): void {
  const h = g.length;
  const marks: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    const w = g[y]!.length;
    for (let x = 0; x < w; x++) {
      if (g[y]![x] !== '.') continue;
      let touch = false;
      for (let j = -1; j <= 1 && !touch; j++) {
        for (let i = -1; i <= 1; i++) {
          if (i === 0 && j === 0) continue;
          if (!diagonal && i !== 0 && j !== 0) continue;
          const c = get(g, x + i, y + j);
          if (c !== '.' && c !== ch) {
            touch = true;
            break;
          }
        }
      }
      if (touch) marks.push([x, y]);
    }
  }
  for (const [x, y] of marks) g[y]![x] = ch;
}

/**
 * Light from the upper left: cells holding `base` inside the given circle become `hi` on the lit rim
 * and `lo` on the shaded side (bands chosen by the cell's position along the light direction).
 */
export function shade(
  g: Grid,
  cx: number,
  cy: number,
  r: number,
  base: string,
  hi: string,
  lo: string,
  hiAt = -0.5,
  loAt = 0.42,
): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) {
      if (g[y]![x] !== base) continue;
      const d = (x + 0.5 - cx + (y + 0.5 - cy)) / (Math.SQRT2 * r);
      if (d <= hiAt) g[y]![x] = hi;
      else if (d >= loAt) g[y]![x] = lo;
    }
  }
}

/** Replaces every `from` cell with `to`. */
export function recolor(g: Grid, from: string, to: string): void {
  for (const row of g) for (let x = 0; x < row.length; x++) if (row[x] === from) row[x] = to;
}

/** Mirrors a grid left ↔ right (a copy). */
export function mirror(g: Grid): Grid {
  return g.map((r) => [...r].reverse());
}

export function rowsOf(g: Grid): string[] {
  return g.map((r) => r.join(''));
}

/** A 14×14 item icon from hand-drawn rows (outline key `o` is always available). */
export function icon(id: string, palette: Record<string, string>, rows: readonly string[]): SpriteDef {
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [[...rows]] };
}

/** A 14×14 item icon drawn with the raster helpers. */
export function drawIcon(id: string, palette: Record<string, string>, draw: (g: Grid) => void): SpriteDef {
  const g = grid(14, 14);
  draw(g);
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [rowsOf(g)] };
}

/** An empty row of `w` cells. */
export function blankRow(w: number): string {
  return '.'.repeat(w);
}

/** A frame of `h` rows of width `w` with `rows` placed from (x, top); everything else transparent. */
export function frameAt(w: number, h: number, x: number, top: number, rows: readonly string[]): string[] {
  const g = grid(w, h);
  stamp(g, x, top, rows);
  return rowsOf(g);
}
