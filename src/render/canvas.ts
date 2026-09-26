/** Canvas creation helpers (browser only). */

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** 2D context with smoothing off (pixel art). Throws if the browser refuses a context. */
export function ctx2d(c: HTMLCanvasElement, opts?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', opts);
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

const colorCache = new Map<string, Uint8ClampedArray>();

/** Parses '#rgb', '#rgba', '#rrggbb' or '#rrggbbaa' into RGBA bytes (cached). */
export function parseHexColor(css: string): Uint8ClampedArray {
  let c = colorCache.get(css);
  if (c) return c;
  let h = css.startsWith('#') ? css.slice(1) : css;
  if (h.length === 3 || h.length === 4) h = [...h].map((ch) => ch + ch).join('');
  const n = (i: number): number => parseInt(h.slice(i, i + 2), 16);
  c = new Uint8ClampedArray([n(0), n(2), n(4), h.length >= 8 ? n(6) : 255]);
  colorCache.set(css, c);
  return c;
}
