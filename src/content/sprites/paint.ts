/**
 * A tiny pixel painter for big sprites (bosses): shapes, lines, textures and an automatic 1 px outline
 * on a character grid, turned into the `SpriteDef` row strings the renderer rasterises. Hand-typing
 * 56-column frames is error-prone; composing them from shapes keeps silhouettes clean and every frame
 * consistent. DOM-free and deterministic (pure functions of the inputs; `hash2` instead of randomness).
 */

/** Deterministic 0..1 noise for (x, y, seed). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class Pix {
  readonly w: number;
  readonly h: number;
  private readonly px: string[];

  constructor(w: number, h: number, fill = '.') {
    this.w = w;
    this.h = h;
    this.px = new Array<string>(w * h).fill(fill);
  }

  get(x: number, y: number): string {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return '.';
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, c: string): this {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = c;
    return this;
  }

  /** Opaque (not '.')? */
  on(x: number, y: number): boolean {
    return this.get(x, y) !== '.';
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
    return this;
  }

  /** Filled ellipse (pixel centres inside). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Runs `fn` on every pixel; a returned char replaces it (null keeps it). */
  map(fn: (x: number, y: number, cur: string) => string | null): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const r = fn(x, y, this.px[y * this.w + x]!);
        if (r !== null) this.px[y * this.w + x] = r;
      }
    }
    return this;
  }

  /**
   * Light from the top-left: pixels of `body` whose upper-left neighbour is empty (or another
   * material) become `light`, those whose lower-right neighbour is empty become `dark`.
   */
  shade(body: string, light: string, dark: string): this {
    const src = this.copy();
    return this.map((x, y, cur) => {
      if (cur !== body) return null;
      if (src.get(x - 1, y - 1) !== body && src.get(x - 1, y) !== body) return light;
      if (src.get(x + 1, y + 1) === '.' || src.get(x, y + 1) === '.') return dark;
      return null;
    });
  }

  /** A 1 px outline: every empty pixel touching an opaque one (4-neighbourhood) becomes `c`. */
  outline(c = 'o'): this {
    const src = this.copy();
    return this.map((x, y, cur) => {
      if (cur !== '.') return null;
      return src.on(x - 1, y) || src.on(x + 1, y) || src.on(x, y - 1) || src.on(x, y + 1) ? c : null;
    });
  }

  copy(): Pix {
    const p = new Pix(this.w, this.h);
    for (let i = 0; i < this.px.length; i++) p.px[i] = this.px[i]!;
    return p;
  }

  /** Pastes another grid at (dx, dy) (its '.' pixels are transparent). */
  paste(src: Pix, dx: number, dy: number): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.px[y * src.w + x]!;
        if (c !== '.') this.set(x + dx, y + dy, c);
      }
    }
    return this;
  }

  /** Mirrors the left half onto the right (symmetric bodies). */
  mirrorX(): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w >> 1; x++) this.px[y * this.w + (this.w - 1 - x)] = this.px[y * this.w + x]!;
    }
    return this;
  }

  rows(): string[] {
    const out: string[] = [];
    for (let y = 0; y < this.h; y++) out.push(this.px.slice(y * this.w, (y + 1) * this.w).join(''));
    return out;
  }
}
