/**
 * SpriteDef (pixel map + palette) → cached canvases. Each frame is rasterised once; white-flash,
 * mirrored, tinted and 90°-rotated variants are created lazily on first use and cached too, so
 * drawing is always a single drawImage of a ready canvas.
 */

import type { SpriteDef } from '../sim/types';
import { ctx2d, makeCanvas, parseHexColor } from './canvas';

type Frames = (HTMLCanvasElement | undefined)[];

interface SpriteCache {
  normal: Frames;
  flash: Frames;
  flipped: Frames;
  flashFlipped: Frames;
  tints: Map<string, Frames>;
  tintsFlipped: Map<string, Frames>;
  silhouettes: Map<string, Frames>;
  silhouettesFlipped: Map<string, Frames>;
  rotated: Map<number, Frames>;
}

const caches = new WeakMap<SpriteDef, SpriteCache>();

function cacheFor(def: SpriteDef): SpriteCache {
  let c = caches.get(def);
  if (!c) {
    c = {
      normal: [],
      flash: [],
      flipped: [],
      flashFlipped: [],
      tints: new Map(),
      tintsFlipped: new Map(),
      silhouettes: new Map(),
      silhouettesFlipped: new Map(),
      rotated: new Map(),
    };
    caches.set(def, c);
  }
  return c;
}

type Mode = 0 | 1 | 2 | 3;
const MODE_NORMAL: Mode = 0;
const MODE_FLASH: Mode = 1;
const MODE_TINT: Mode = 2;
const MODE_SOLID: Mode = 3;

function rasterize(def: SpriteDef, frame: number, mode: Mode, tint?: Uint8ClampedArray): HTMLCanvasElement {
  const rows = def.frames[frame] ?? def.frames[0]!;
  const canvas = makeCanvas(def.w, def.h);
  const ctx = ctx2d(canvas);
  const img = ctx.createImageData(def.w, def.h);
  const d = img.data;
  for (let y = 0; y < def.h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < def.w; x++) {
      const ch = row[x];
      if (ch === undefined || ch === '.' || ch === ' ') continue;
      const css = def.palette[ch];
      if (!css) continue;
      const rgba = parseHexColor(css);
      const i = (y * def.w + x) * 4;
      if (mode === MODE_FLASH) {
        d[i] = 255;
        d[i + 1] = 255;
        d[i + 2] = 255;
      } else if (mode === MODE_SOLID && tint) {
        d[i] = tint[0]!;
        d[i + 1] = tint[1]!;
        d[i + 2] = tint[2]!;
      } else if (mode === MODE_TINT && tint) {
        // Keep shading: scale the tint by the source luminance (outlines stay dark).
        const lum = (0.3 * rgba[0]! + 0.59 * rgba[1]! + 0.11 * rgba[2]!) / 255;
        const k = Math.min(1.25, 0.15 + lum * 1.25);
        d[i] = tint[0]! * k;
        d[i + 1] = tint[1]! * k;
        d[i + 2] = tint[2]! * k;
      } else {
        d[i] = rgba[0]!;
        d[i + 1] = rgba[1]!;
        d[i + 2] = rgba[2]!;
      }
      d[i + 3] = rgba[3]!;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const ctx = ctx2d(c);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Rotates by quarter turns clockwise (lossless for pixel art). */
function rotateQuarter(src: HTMLCanvasElement, turns: number): HTMLCanvasElement {
  const t = ((turns % 4) + 4) % 4;
  const swap = t % 2 === 1;
  const c = makeCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = ctx2d(c);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((t * Math.PI) / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function getFrame(def: SpriteDef, frame: number): HTMLCanvasElement {
  const c = cacheFor(def);
  return (c.normal[frame] ??= rasterize(def, frame, MODE_NORMAL));
}

export function getFlash(def: SpriteDef, frame: number): HTMLCanvasElement {
  const c = cacheFor(def);
  return (c.flash[frame] ??= rasterize(def, frame, MODE_FLASH));
}

export function getFlipped(def: SpriteDef, frame: number, flash = false): HTMLCanvasElement {
  const c = cacheFor(def);
  if (flash) return (c.flashFlipped[frame] ??= mirror(getFlash(def, frame)));
  return (c.flipped[frame] ??= mirror(getFrame(def, frame)));
}

/** Colour-tinted variant (status effects, champion colours…), cached per colour. */
export function getTinted(def: SpriteDef, frame: number, color: string): HTMLCanvasElement {
  const c = cacheFor(def);
  let frames = c.tints.get(color);
  if (!frames) {
    frames = [];
    c.tints.set(color, frames);
  }
  return (frames[frame] ??= rasterize(def, frame, MODE_TINT, parseHexColor(color)));
}

function framesIn(map: Map<string, Frames>, key: string): Frames {
  let frames = map.get(key);
  if (!frames) {
    frames = [];
    map.set(key, frames);
  }
  return frames;
}

/** Mirrored colour-tinted variant (cached per colour). */
export function getTintedFlipped(def: SpriteDef, frame: number, color: string): HTMLCanvasElement {
  const frames = framesIn(cacheFor(def).tintsFlipped, color);
  return (frames[frame] ??= mirror(getTinted(def, frame, color)));
}

/** Solid single-colour silhouette (champion outlines, glows), optionally mirrored; cached per colour. */
export function getSilhouette(def: SpriteDef, frame: number, color: string, flipX = false): HTMLCanvasElement {
  const c = cacheFor(def);
  if (flipX) {
    const frames = framesIn(c.silhouettesFlipped, color);
    return (frames[frame] ??= mirror(getSilhouette(def, frame, color, false)));
  }
  const frames = framesIn(c.silhouettes, color);
  return (frames[frame] ??= rasterize(def, frame, MODE_SOLID, parseHexColor(color)));
}

export function getRotated(def: SpriteDef, frame: number, quarterTurns: number): HTMLCanvasElement {
  const t = ((quarterTurns % 4) + 4) % 4;
  if (t === 0) return getFrame(def, frame);
  const c = cacheFor(def);
  let frames = c.rotated.get(t);
  if (!frames) {
    frames = [];
    c.rotated.set(t, frames);
  }
  return (frames[frame] ??= rotateQuarter(getFrame(def, frame), t));
}

/** Draws a frame with its top-left at (x, y) (rounded to whole pixels). */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  def: SpriteDef,
  frame: number,
  x: number,
  y: number,
  flipX = false,
  flash = false,
): void {
  const img = flipX ? getFlipped(def, frame, flash) : flash ? getFlash(def, frame) : getFrame(def, frame);
  ctx.drawImage(img, Math.round(x), Math.round(y));
}

/** Draws a frame so its anchor (default bottom-centre) lands on (x, y). */
export function drawSpriteAnchored(
  ctx: CanvasRenderingContext2D,
  def: SpriteDef,
  frame: number,
  x: number,
  y: number,
  flipX = false,
  flash = false,
): void {
  const ax = def.anchorX ?? Math.floor(def.w / 2);
  const ay = def.anchorY ?? def.h - 1;
  // Mirroring flips the anchor too so the sprite pivots around the same pixel.
  const ox = flipX ? def.w - 1 - ax : ax;
  drawSprite(ctx, def, frame, Math.round(x) - ox, Math.round(y) - ay, flipX, flash);
}

/** Rasterise every frame (and optionally flash/flip variants) now, e.g. during a loading beat. */
export function prewarmSprite(def: SpriteDef, variants = false): void {
  for (let f = 0; f < def.frames.length; f++) {
    getFrame(def, f);
    if (variants) {
      getFlash(def, f);
      getFlipped(def, f);
    }
  }
}
