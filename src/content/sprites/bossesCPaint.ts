/**
 * Small drawing helpers shared by the boss pack C sprites (bossesC*.ts), on top of the pixel painter
 * in ./paint.ts: thick strokes, tapering quadratic curves, jagged cracks, palette variants and the
 * frame/anim bundling every boss sprite uses. Pure and deterministic (no randomness, no DOM).
 */

import type { SpriteDef } from '../../sim/types';
import { Pix, hash2 } from './paint';

/** A stroke `w` px thick from (x0, y0) to (x1, y1). */
export function thick(p: Pix, x0: number, y0: number, x1: number, y1: number, w: number, c: string): void {
  const len = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= len; i++) {
    const t = i / len;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (w <= 1.2) p.set(x, y, c);
    else p.disc(x + 0.5, y + 0.5, w / 2, c);
  }
}

/** A quadratic curve (x0,y0) → (x1,y1) bent toward (cx,cy), tapering from w0 to w1 px. */
export function curve(p: Pix, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, w0: number, w1: number, c: string): void {
  const est = Math.hypot(cx - x0, cy - y0) + Math.hypot(x1 - cx, y1 - cy);
  const n = Math.max(4, Math.ceil(est * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const w = w0 + (w1 - w0) * t;
    if (w <= 1.2) p.set(x, y, c);
    else p.disc(x + 0.5, y + 0.5, w / 2, c);
  }
}

/** A point on the quadratic curve at t (for hanging things off branches). */
export function curveAt(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
}

/**
 * A jagged crack from (x0, y0) heading along `angle` for `len` px, drawn only over opaque pixels whose
 * char is in `on` (so it never spills past the body). `glow` (optional) is painted beside it.
 */
export function crack(p: Pix, x0: number, y0: number, angle: number, len: number, c: string, on: string, seed: number, glow = ''): void {
  let x = x0;
  let y = y0;
  let a = angle;
  for (let i = 0; i < len; i++) {
    a += (hash2(i, seed, 5) - 0.5) * 1.1;
    x += Math.cos(a);
    y += Math.sin(a);
    const px = Math.round(x);
    const py = Math.round(y);
    if (on.includes(p.get(px, py))) p.set(px, py, c);
    if (glow && on.includes(p.get(px + 1, py))) p.set(px + 1, py, glow);
    // A short branch now and then.
    if (i > 2 && hash2(i, seed, 11) > 0.82) {
      const b = a + (hash2(i, seed, 13) > 0.5 ? 1 : -1) * 0.9;
      for (let k = 1; k <= 2; k++) {
        const bx = Math.round(x + Math.cos(b) * k);
        const by = Math.round(y + Math.sin(b) * k);
        if (on.includes(p.get(bx, by))) p.set(bx, by, c);
      }
    }
  }
}

/** Fills a polygon (flat x, y pairs; even-odd rule, pixel centres). */
export function poly(p: Pix, pts: readonly number[], c: string): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 1; i < pts.length; i += 2) {
    minY = Math.min(minY, pts[i]!);
    maxY = Math.max(maxY, pts[i]!);
  }
  const n = pts.length / 2;
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const cy = y + 0.5;
    for (let x = 0; x < p.w; x++) {
      const cx = x + 0.5;
      let inside = false;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i * 2]!;
        const yi = pts[i * 2 + 1]!;
        const xj = pts[j * 2]!;
        const yj = pts[j * 2 + 1]!;
        if (yi > cy !== yj > cy && cx < ((xj - xi) * (cy - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) p.set(x, y, c);
    }
  }
}

/** A sheared copy (x shifts by `k` px per row away from `pivotY`): a cheap lean / tumble. */
export function shear(src: Pix, k: number, pivotY: number): Pix {
  const out = new Pix(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    const dx = Math.round((y - pivotY) * k);
    for (let x = 0; x < src.w; x++) {
      const c = src.get(x, y);
      if (c !== '.') out.set(x + dx, y, c);
    }
  }
  return out;
}

/** Replaces every `from[i]` char with `to[i]` (e.g. recolour a material for a pose). */
export function swap(p: Pix, from: string, to: string): void {
  p.map((_x, _y, cur) => {
    const i = from.indexOf(cur);
    return i >= 0 ? to[i]! : null;
  });
}

/** A copy of a palette with some colours replaced. */
export function repaint(pal: Readonly<Record<string, string>>, changes: Readonly<Record<string, string>>): Record<string, string> {
  return { ...pal, ...changes };
}

/** The standard boss animation set, by frame index. */
export interface BossFrames {
  idle: number[];
  move: number[];
  windup: number[];
  roar: number[];
  slam?: number[];
  air?: number[];
  charge?: number[];
  hurt: number[];
  fps?: { idle?: number; move?: number; charge?: number; air?: number };
}

/** Bundles painted frames into a boss SpriteDef with the renderer's animation names. */
export function bossSprite(id: string, w: number, h: number, anchorY: number, palette: Record<string, string>, frames: string[][], a: BossFrames): SpriteDef {
  const fps = a.fps ?? {};
  const anims: NonNullable<SpriteDef['anims']> = {
    idle: { frames: a.idle, fps: fps.idle ?? 3, loop: true },
    move: { frames: a.move, fps: fps.move ?? 6, loop: true },
    windup: { frames: a.windup, fps: 6, loop: true },
    roar: { frames: a.roar, fps: 8, loop: true },
    slam: { frames: a.slam ?? a.windup, fps: 6, loop: true },
    air: { frames: a.air ?? a.roar, fps: fps.air ?? 8, loop: true },
    charge: { frames: a.charge ?? a.move, fps: fps.charge ?? 12, loop: true },
    hurt: { frames: a.hurt, fps: 4, loop: true },
  };
  return { id, w, h, anchorY, palette, frames, anims };
}

export { Pix, hash2 };
