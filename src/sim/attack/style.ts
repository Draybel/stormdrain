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

import type { CharacterDef, ShapeHint, TrailKind } from '../types';
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
  boomerang: ['#dfe6f2', 0.35],
  melee: ['#f4f7ff', 0.35],
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

export function composeStyle(p: AttackProfile, character: CharacterDef): ShotStyle {
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
    const avg = hex(r / wSum, g / wSum, b / wSum);
    const t = Math.min(0.8, wSum / (wSum + 1.2));
    body = mix(base, avg, t);
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
  const glowR = Math.min(6, 2 + Math.round(wSum * 0.5));
  let jitter = p.primary === 'lance' ? 1 : 0.35;
  if (p.mod('chain') > 0) jitter += 0.4;
  return build(body, rim, accents, shape, trails, trailColors, glowR, jitter);
}

/** Wren's keeper marble: the same combo, gilded, star-shaped, extra glow. */
export function composeKeeperStyle(s: ShotStyle): ShotStyle {
  const body = mix(s.body, '#fff4c0', 0.55);
  return build(body, '#e0a020', s.accents, 'star', s.trails, s.trailColors, 6, s.beamJitter);
}
