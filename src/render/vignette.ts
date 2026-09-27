/**
 * The red hurt vignette (polish batch 2): a room-sized overlay, clear in the middle and red toward the edges, in
 * pixel-art bands. Built once with one ImageData (no per-pixel fill calls), drawn with a fading alpha by the run
 * scene over the room only (never over the HUD).
 */

import { ctx2d, makeCanvas } from './canvas';

let cached: HTMLCanvasElement | null = null;
let cachedW = 0;
let cachedH = 0;

/** The vignette for a w × h room rect (cached for the last size asked). */
export function hurtVignette(w: number, h: number): HTMLCanvasElement {
  if (cached && cachedW === w && cachedH === h) return cached;
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  // Distance to the nearest edge, as a fraction of a band 34 px deep; quantised to 4 steps.
  const band = 34;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (e >= band) continue;
      const k = Math.ceil((1 - e / band) * 4) / 4;
      const i = (y * w + x) * 4;
      d[i] = 200;
      d[i + 1] = 24;
      d[i + 2] = 40;
      d[i + 3] = Math.round(255 * k * k);
    }
  }
  ctx.putImageData(img, 0, 0);
  cached = c;
  cachedW = w;
  cachedH = h;
  return c;
}
