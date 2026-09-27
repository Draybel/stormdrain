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

const cssCache = new Map<string, Uint8ClampedArray>();

/**
 * RGBA bytes of a CSS colour: '#rgb' / '#rrggbb' / '#rrggbbaa' (parseHexColor) or 'rgb(r,g,b)' / 'rgba(r,g,b,a)'
 * (a 0..1). Cached. Used to bake canvases with one ImageData instead of a fillStyle + fillRect per pixel.
 */
export function parseCssColor(css: string): Uint8ClampedArray {
  if (css.charCodeAt(0) === 35) return parseHexColor(css);
  let c = cssCache.get(css);
  if (c) return c;
  const m = /rgba?\(([^)]*)\)/.exec(css);
  const parts = m ? m[1]!.split(',').map((s) => Number(s.trim())) : [0, 0, 0, 1];
  const a = parts.length > 3 ? parts[3]! : 1;
  c = new Uint8ClampedArray([parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, Math.round(Math.max(0, Math.min(1, a)) * 255)]);
  cssCache.set(css, c);
  return c;
}

/** A canvas holding a square RGBA pixel map (one ImageData + putImageData — no per-pixel fill calls). */
export function pixelsToCanvas(p: { size: number; data: Uint8ClampedArray }): HTMLCanvasElement {
  return rgbaToCanvas(p.size, p.size, p.data);
}

/** A w × h canvas from RGBA bytes (one putImageData). */
export function rgbaToCanvas(w: number, h: number, data: Uint8ClampedArray): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(w, h);
  img.data.set(data);
  ctx.putImageData(img, 0, 0);
  return c;
}
