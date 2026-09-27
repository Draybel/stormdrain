/**
 * Shot sprites as pure pixel maps (polish batch 2): the renderers turn them into canvases with ONE ImageData +
 * putImageData each (no per-pixel fill calls), and tests can read them without a DOM.
 *
 * Friend or foe at a glance (B2-3): player shots and enemy shots may share a colour (a lime Rubber Ball build next to a
 * Spitshell's muck), so each side gets a signature the other never uses —
 * - PLAYER shots: a white-hot centre pixel (and their additive halo and trails, drawn elsewhere);
 * - ENEMY shots: a dark 1 px outline, a DARK core (a dark disc in the middle: hollow-looking rings of colour), and a
 *   dark drop-halo baked around them instead of an additive light glow.
 */

import type { ShotStyle } from '../sim/attack/style';
import { parseHexColor } from './canvas';

export interface PixelSprite {
  /** Width = height (px). */
  size: number;
  /** RGBA, row-major. */
  data: Uint8ClampedArray;
}

/** Perceived brightness 0..255 (Rec. 601). */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** The player shots' white-hot centre. */
export const PLAYER_CORE = '#ffffff';

/** Signed "radius" of a shape at angle `a` (outline test: inside when d <= shapeR). */
function shapeR(shape: number, a: number, r: number): number {
  switch (shape) {
    case 1: // spiky
      return r * (0.78 + 0.42 * Math.pow(Math.max(0, Math.cos(a * 4)), 6));
    case 3: // blade: 4 curved points
      return r * (0.32 + 0.78 * Math.pow(Math.max(0, Math.cos(a * 2 + 0.35 * Math.sin(a * 2))), 3));
    case 5: // star
      return r * (0.52 + 0.55 * Math.pow(Math.abs(Math.cos(a * 2.5)), 3));
    case 6: // gear
      return r * (Math.cos(a * 6) > 0 ? 1 : 0.78);
    case 7: // shard: a long diamond along +x
      return r / (Math.abs(Math.cos(a)) * 0.8 + Math.abs(Math.sin(a)) * 1.45);
    default:
      return r;
  }
}

/**
 * A player shot of `style` in shape index `shape` (attackRenderer SHAPE_INDEX: 0 marble, 1 spiky, 2 bomb, 3 blade,
 * 4 crescent, 5 star, 6 gear, 7 shard, 8 bubble), radius `r`, rotated by `rot`: dark outline, rim, body, highlight,
 * up to three accent pixels, and the white-hot centre (every shape with a middle: all but the crescent and bubble).
 */
export function playerShotPixels(style: ShotStyle, shape: number, r: number, rot: number): PixelSprite {
  const pad = shape === 1 || shape === 3 || shape === 5 || shape === 7 ? 3 : 2;
  const R = Math.ceil(r * 1.25) + pad;
  const size = R * 2 + 1;
  const d8 = new Uint8ClampedArray(size * size * 4);
  const body = shape === 2 ? '#2a2230' : style.body;
  const cols = [parseHexColor(style.line), parseHexColor(style.rim), parseHexColor(body), parseHexColor(style.hi)];
  const bladeBody = shape === 3 ? parseHexColor('#e8eef8') : null;
  const put = (x: number, y: number, rgb: Uint8ClampedArray, a = 255): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    d8[i] = rgb[0]!;
    d8[i + 1] = rgb[1]!;
    d8[i + 2] = rgb[2]!;
    d8[i + 3] = a;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - R;
      const dy = y - R;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.atan2(dy, dx) - rot;
      if (shape === 4) {
        // Crescent: a thick arc facing +x (rotated).
        const ca = Math.cos(a);
        const inArc = d <= r + 0.5 && d >= r * 0.45 && ca > -0.15;
        const edge = inArc && (d > r - 0.6 || d < r * 0.45 + 1 || ca < 0.05);
        const out = !inArc && d <= r + 1.4 && d >= r * 0.45 - 1 && ca > -0.3;
        if (inArc) put(x, y, edge ? cols[1]! : d > r * 0.75 ? cols[3]! : cols[2]!);
        else if (out) put(x, y, cols[0]!);
        continue;
      }
      if (shape === 8) {
        // Bubble: a ring with a highlight.
        if (d <= r + 0.5 && d > r - 1.2) put(x, y, cols[2]!);
        else if (d <= r + 1.4 && d > r + 0.5) put(x, y, cols[0]!, 200);
        else if (d <= r - 1.2) put(x, y, cols[2]!, 70);
        continue;
      }
      const sr = shapeR(shape, a, r);
      if (d <= sr + 0.4) {
        let col: Uint8ClampedArray;
        if (d > sr - 0.9 || (dx + dy > sr * 0.8 && d > sr * 0.4)) col = cols[1]!;
        else col = bladeBody ?? cols[2]!;
        put(x, y, col);
      } else if (d <= sr + 1.4) {
        put(x, y, cols[0]!);
      }
    }
  }
  // Highlight and accents (combo colours) on round-ish shapes.
  const hr = Math.max(1, Math.round(r * 0.45));
  put(R - hr, R - hr, cols[3]!);
  if (r >= 3) put(R - hr + 1, R - hr, cols[3]!);
  const acc = style.accents;
  if (shape !== 4 && acc.length > 0) {
    const ar = Math.max(1, r * 0.62);
    for (let k = 0; k < acc.length; k++) {
      const aa = 0.9 + (k * Math.PI * 2) / 3 + rot;
      put(Math.round(R + Math.cos(aa) * ar), Math.round(R + Math.sin(aa) * ar), parseHexColor(acc[k]!));
      if (r >= 4) put(Math.round(R + Math.cos(aa) * ar) + 1, Math.round(R + Math.sin(aa) * ar), parseHexColor(acc[k]!));
    }
  }
  if (shape === 2) {
    // Bomb: a little fuse on top.
    const fx = R + Math.round(r * 0.5);
    put(fx, R - r - 1, cols[0]!);
    put(fx + 1, R - r - 2, parseHexColor('#c8a060'));
  }
  // The player's signature: a white-hot centre (never on an enemy shot).
  if (shape !== 4 && shape !== 8) {
    const w = parseHexColor(PLAYER_CORE);
    put(R, R, w);
    if (r >= 5) {
      put(R + 1, R, w);
      put(R, R + 1, w);
      put(R + 1, R + 1, w);
    }
  }
  return { size, data: d8 };
}

/** An enemy shot look (enemyRenderer SHOT_LOOKS). */
export interface EnemyShotLook {
  body: string;
  rim: string;
  hi: string;
  /** Dark outline and core. */
  line: string;
}

/** The enemy shots' drop-halo: black at this alpha, one pixel outside the outline. */
export const ENEMY_HALO_ALPHA = 110;

/**
 * An enemy (hostile) shot of radius `r`: dark outline, rim, body, a glint, a DARK core — a dark disc a third of its
 * radius wide (at least the centre pixel) — and a translucent dark drop-halo around it. `hostile` false (allied shots:
 * charmed foes, ice shards on your side) keeps the old bright look: no dark core, no halo.
 */
export function enemyShotPixels(look: EnemyShotLook, r: number, hostile = true): PixelSprite {
  const R = r + 2;
  const size = R * 2 + 1;
  const d8 = new Uint8ClampedArray(size * size * 4);
  const line = parseHexColor(look.line);
  const rim = parseHexColor(look.rim);
  const body = parseHexColor(look.body);
  const hi = parseHexColor(look.hi);
  const put = (x: number, y: number, rgb: Uint8ClampedArray | null, a = 255): void => {
    const i = (y * size + x) * 4;
    d8[i] = rgb ? rgb[0]! : 0;
    d8[i + 1] = rgb ? rgb[1]! : 0;
    d8[i + 2] = rgb ? rgb[2]! : 0;
    d8[i + 3] = a;
  };
  const core = Math.max(0.6, r * 0.34);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - R;
      const dy = y - R;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R + 0.4) continue;
      if (d > r + 1.4) {
        if (hostile) put(x, y, null, ENEMY_HALO_ALPHA);
        continue;
      }
      if (d > r + 0.4) {
        put(x, y, line);
        continue;
      }
      let col = d > r - 0.8 || dx + dy > r * 0.9 ? rim : body;
      if (hostile && d <= core) col = line;
      put(x, y, col);
    }
  }
  // A glint up and to the left (on the body's edge, clear of the dark core).
  const g = Math.max(1, Math.round(r * 0.6));
  put(R - g, R - g, hi);
  if (r >= 3) put(R - g + 1, R - g, hi);
  return { size, data: d8 };
}
