/**
 * Pixel-exact primitives (no anti-aliasing): ellipses, circles, panels. Anything reused per frame
 * is baked into a cached canvas.
 */

import { ctx2d, makeCanvas } from './canvas';

/** Filled ellipse made of horizontal spans (crisp at 1:1 back-buffer resolution). */
export function fillPixelEllipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number): void {
  const y0 = Math.ceil(-ry);
  const y1 = Math.floor(ry);
  for (let dy = y0; dy <= y1; dy++) {
    const t = dy / (ry + 0.5);
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - t * t)));
    ctx.fillRect(Math.round(cx) - half, Math.round(cy) + dy, half * 2 + 1, 1);
  }
}

const shadowCache = new Map<number, HTMLCanvasElement>();

/** Soft-looking pixel shadow (two-tone ellipse), cached per width. Draw centred. */
export function shadowSprite(width: number): HTMLCanvasElement {
  let c = shadowCache.get(width);
  if (c) return c;
  const rx = Math.max(1, Math.floor(width / 2));
  const ry = Math.max(1, Math.round(width / 5));
  c = makeCanvas(rx * 2 + 1, ry * 2 + 1);
  const ctx = ctx2d(c);
  ctx.fillStyle = 'rgba(4,5,10,0.28)';
  fillPixelEllipse(ctx, rx, ry, rx, ry);
  ctx.fillStyle = 'rgba(4,5,10,0.22)';
  fillPixelEllipse(ctx, rx, ry, Math.max(1, rx - 2), Math.max(0.5, ry - 1));
  shadowCache.set(width, c);
  return c;
}

export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number): void {
  const s = shadowSprite(width);
  ctx.drawImage(s, Math.round(x) - (s.width >> 1), Math.round(y) - (s.height >> 1));
}

const circleCache = new Map<string, HTMLCanvasElement>();

/**
 * Cached pixel circle of radius r: optional fill and a 1 px ring (stroke). Draw centred:
 * the canvas is (2r+1)² with the centre at (r, r).
 */
export function pixelCircle(r: number, fill: string | null, stroke: string | null, strokeWidth = 1): HTMLCanvasElement {
  const key = `${r}|${fill}|${stroke}|${strokeWidth}`;
  let c = circleCache.get(key);
  if (c) return c;
  const size = r * 2 + 1;
  c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const rOut = r + 0.5;
  const rIn = r + 0.5 - strokeWidth;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - r;
      const dy = y - r;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > rOut) continue;
      if (stroke && d > rIn) {
        ctx.fillStyle = stroke;
        ctx.fillRect(x, y, 1, 1);
      } else if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  circleCache.set(key, c);
  return c;
}

/**
 * Panel with 1 px cut corners: fill + 1 px border (+ optional highlight line along the top inside).
 */
export function drawPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  border: string,
  highlight: string | null = null,
): void {
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillStyle = border;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  if (highlight) {
    ctx.fillStyle = highlight;
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
  }
}

/** A simple pixel "glow": concentric filled circles of decreasing alpha, baked. Draw with 'lighter'. */
export function glowSprite(r: number, rgb: string, peak: number): HTMLCanvasElement {
  const key = `glow|${r}|${rgb}|${peak}`;
  let c = circleCache.get(key);
  if (c) return c;
  const size = r * 2 + 1;
  c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - r) ** 2 + (y - r) ** 2) / (r + 0.5);
      if (d >= 1) continue;
      // Quantised falloff = pixel-art bands instead of a smooth blur.
      const band = Math.ceil((1 - d) * 3) / 3;
      ctx.fillStyle = `rgba(${rgb},${(peak * band * band).toFixed(3)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  circleCache.set(key, c);
  return c;
}
