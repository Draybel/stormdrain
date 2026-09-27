/**
 * ShotStyle (§4.6): how the player's shots LOOK, composed once per profile so combos are visible at a
 * glance — base colour from the character, tinted by every modifier's colour (weighted by stacks),
 * a rim in the dominant modifier's colour, up to three accent colours (drawn as sparkle pixels), a
 * shape hint (carrier first, then the strongest modifier with a shape), trail kinds and glow.
 * Beams get core / glow colours and jitter from the same style.
 *
 * Pure data (hex strings, numbers): render/attackRenderer.ts bakes and caches sprites per
 * (style.key, size bucket).
 */

import type { CharacterDef, ShapeHint, StyleOverride, TrailKind } from '../types';
import { MODIFIERS } from './modifiers/index';
import type { AttackProfile } from './profile';

export interface ShotStyle {
  /** Cache key (render bakes one sprite set per key). */
  readonly key: string;
  readonly body: string;
  readonly rim: string;
  readonly hi: string;
  /** Dark outline. */
  readonly line: string;
  /** Additive glow 'r,g,b'. */
  readonly glow: string;
  /** Up to 3 modifier colours (sparkle pixels on the shot). */
  readonly accents: readonly string[];
  readonly shape: ShapeHint;
  /** Up to 3 trail kinds with their colours. */
  readonly trails: readonly TrailKind[];
  readonly trailColors: readonly string[];
  /** Extra glow radius (px). */
  readonly glowR: number;
  /** Beams: bright core, glow 'r,g,b', edge colour, lightning jitter (0..1.5). */
  readonly beamCore: string;
  readonly beamGlow: string;
  readonly beamEdge: string;
  readonly beamJitter: number;
}

/** Candle-gold (Wren's marbles). */
export const DEFAULT_SHOT_COLOR = '#ffcf57';

/** Carrier tints: [colour, how much of it replaces the base]. */
const CARRIER_TINT: Readonly<Partial<Record<string, readonly [string, number]>>> = {
  lance: ['#9fdcff', 1],
  laser: ['#ff5a78', 0.75],
  boomerang: ['#dfe6f2', 0.7],
  melee: ['#f4f7ff', 0.8],
};

// ── Colour maths (hex strings; profile builds only, never per frame) ──

function parse(hex: string): [number, number, number] {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!;
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hex(r: number, g: number, b: number): string {
  const c = (v: number): string => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mix(a: string, b: string, t: number): string {
  const x = parse(a);
  const y = parse(b);
  return hex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

export function darker(c: string, k: number): string {
  const x = parse(c);
  return hex(x[0] * (1 - k), x[1] * (1 - k), x[2] * (1 - k));
}

export function lighter(c: string, k: number): string {
  return mix(c, '#ffffff', k);
}

export function rgbTriple(c: string): string {
  const x = parse(c);
  return `${x[0]},${x[1]},${x[2]}`;
}

/** RGB (0..255) → HSV (h 0..6, s 0..1, v 0..1). */
function toHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [h, max > 0 ? d / max : 0, max / 255];
}

function fromHsv(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  const i = Math.floor(h) % 6;
  const [r, g, b] = i === 0 ? [c, x, 0] : i === 1 ? [x, c, 0] : i === 2 ? [0, c, x] : i === 3 ? [0, x, c] : i === 4 ? [x, 0, c] : [c, 0, x];
  return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Weighted blend of modifier colours that stays vivid: the hue of the RGB mean, but the inputs'
 * average saturation and brightness (a plain RGB mean of many different hues goes grey-beige).
 * When the hues cancel out, the heaviest colour's hue wins.
 */
export function vividBlend(colors: readonly { color: string; w: number }[]): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let s = 0;
  let v = 0;
  let wSum = 0;
  for (const c of colors) {
    const x = parse(c.color);
    const hsv = toHsv(x[0], x[1], x[2]);
    r += x[0] * c.w;
    g += x[1] * c.w;
    b += x[2] * c.w;
    s += hsv[1] * c.w;
    v += hsv[2] * c.w;
    wSum += c.w;
  }
  if (wSum <= 0) return '#ffffff';
  const mean = toHsv(r / wSum, g / wSum, b / wSum);
  let hue = mean[0];
  if (mean[1] < 0.08 && colors.length > 0) {
    const top = parse(colors[0]!.color);
    hue = toHsv(top[0], top[1], top[2])[0];
  }
  return fromHsv(hue, Math.min(1, Math.max(mean[1], s / wSum)), Math.max(0.8, v / wSum));
}

/**
 * `mix(a, b, t)` that keeps the colour alive: complementary colours (the lance's blue + explode's
 * orange) average to a washed-out grey, so the result gets the inputs' interpolated saturation and
 * brightness back, keeping the mixed hue.
 */
export function mixVivid(a: string, b: string, t: number): string {
  const m = parse(mix(a, b, t));
  const x = parse(a);
  const y = parse(b);
  const hm = toHsv(m[0], m[1], m[2]);
  const ha = toHsv(x[0], x[1], x[2]);
  const hb = toHsv(y[0], y[1], y[2]);
  const s = ha[1] * (1 - t) + hb[1] * t;
  const v = Math.max(hm[2], ha[2] * (1 - t) + hb[2] * t);
  if (hm[1] < 0.05) return fromHsv(t >= 0.5 ? hb[0] : ha[0], s, v);
  return fromHsv(hm[0], Math.max(hm[1], s), v);
}

/** Saturated, brighter version for glows (so additive halos read as coloured light). */
function glowOf(c: string): string {
  const [r, g, b] = parse(c);
  const m = Math.max(r, g, b, 1);
  const k = 255 / m;
  return `${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)}`;
}

function build(
  body: string,
  rim: string,
  accents: readonly string[],
  shape: ShapeHint,
  trails: readonly TrailKind[],
  trailColors: readonly string[],
  glowR: number,
  jitter: number,
): ShotStyle {
  const line = darker(rim, 0.72);
  return {
    key: `${body}|${rim}|${accents.join(',')}|${shape}|${glowR}`,
    body,
    rim,
    hi: lighter(body, 0.65),
    line,
    glow: glowOf(body),
    accents,
    shape,
    trails,
    trailColors,
    glowR,
    beamCore: mix('#ffffff', body, 0.12),
    beamGlow: glowOf(body),
    beamEdge: lighter(body, 0.25),
    beamJitter: jitter,
  };
}

const NO_OVERRIDES: readonly StyleOverride[] = [];

/**
 * Composes the player's ShotStyle. `overrides` (transformations, active synergies — Loadout.styles) apply
 * last, in order: a colour takes over most of the body and joins the accents first, a shape replaces the
 * composed one, a trail goes first in the trail list, glow adds to the glow radius.
 */
export function composeStyle(p: AttackProfile, character: CharacterDef, overrides: readonly StyleOverride[] = NO_OVERRIDES): ShotStyle {
  let base = character.shotColor ?? DEFAULT_SHOT_COLOR;
  const tint = CARRIER_TINT[p.primary];
  if (tint) base = mix(base, tint[0], tint[1]);

  // Modifier colours weighted by stacks.
  let wSum = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const colored: { color: string; w: number; order: number }[] = [];
  const shaped: { shape: ShapeHint; w: number; order: number }[] = [];
  const trailed: { trail: TrailKind; color: string; w: number }[] = [];
  for (const st of p.held) {
    const d = MODIFIERS.get(st.id)!;
    const w = st.stacks;
    if (d.color) {
      const c = parse(d.color);
      r += c[0] * w;
      g += c[1] * w;
      b += c[2] * w;
      wSum += w;
      colored.push({ color: d.color, w, order: d.order });
    }
    if (d.shape) shaped.push({ shape: d.shape, w, order: d.order });
    if (d.trail) trailed.push({ trail: d.trail, color: d.color ?? base, w });
  }
  let body = base;
  let rim = darker(base, 0.3);
  colored.sort((x, y) => y.w - x.w || x.order - y.order);
  if (wSum > 0) {
    // One or two colours: a plain mean reads fine; many: keep it vivid (no grey-beige mud).
    const avg = colored.length <= 2 ? hex(r / wSum, g / wSum, b / wSum) : vividBlend(colored);
    const t = Math.min(0.8, wSum / (wSum + 1.2));
    body = mixVivid(base, avg, t);
    rim = darker(mix(body, colored[0]!.color, 0.6), 0.28);
  }
  const accents: string[] = [];
  for (const c of colored) {
    if (accents.length >= 3) break;
    if (!accents.includes(c.color)) accents.push(c.color);
  }

  // Shape: the carrier decides first, then the strongest shaped modifier.
  let shape: ShapeHint = 'marble';
  if (p.primary === 'boomerang') shape = 'blade';
  else if (p.primary === 'melee') shape = 'crescent';
  else if (p.riderBomb > 0) shape = 'bomb';
  else if (shaped.length > 0) {
    shaped.sort((x, y) => y.w - x.w || y.order - x.order);
    shape = shaped[0]!.shape;
  }

  trailed.sort((x, y) => y.w - x.w);
  const trails: TrailKind[] = [];
  const trailColors: string[] = [];
  for (const t of trailed) {
    if (trails.length >= 3) break;
    if (trails.includes(t.trail)) continue;
    trails.push(t.trail);
    trailColors.push(t.color);
  }
  if (p.riderBomb > 0 && !trails.includes('sparks')) {
    trails.push('sparks');
    trailColors.push('#ffcf57');
  }
  let glowR = Math.min(6, 2 + Math.round(wSum * 0.5));
  for (const o of overrides) {
    if (o.color) {
      body = mixVivid(body, o.color, 0.75);
      rim = darker(mix(body, o.color, 0.6), 0.28);
      const at = accents.indexOf(o.color);
      if (at >= 0) accents.splice(at, 1);
      accents.unshift(o.color);
      if (accents.length > 3) accents.length = 3;
    }
    if (o.shape) shape = o.shape;
    if (o.trail && o.trail !== 'none' && !trails.includes(o.trail)) {
      trails.unshift(o.trail);
      trailColors.unshift(o.color ?? body);
      if (trails.length > 3) {
        trails.length = 3;
        trailColors.length = 3;
      }
    }
    if (o.glow) glowR = Math.max(0, Math.min(10, glowR + Math.round(o.glow)));
  }
  let jitter = p.primary === 'lance' ? 1 : 0.35;
  if (p.mod('chain') > 0) jitter += 0.4;
  return build(body, rim, accents, shape, trails, trailColors, glowR, jitter);
}

/** Wren's keeper marble: the same combo, gilded, star-shaped, extra glow. */
export function composeKeeperStyle(s: ShotStyle): ShotStyle {
  const body = mix(s.body, '#fff4c0', 0.55);
  return build(body, '#e0a020', s.accents, 'star', s.trails, s.trailColors, 6, s.beamJitter);
}
