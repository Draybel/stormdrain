/**
 * The visible stats as the menus show them (pause menu, character select): HEALTH (hearts: red as current / max,
 * then Tin and Ember on top) and the six attack / movement stats — an icon, a label, the value (text cached per
 * value — no allocation while it doesn't change) and a colour against the character's base.
 */

import type { Stats } from '../sim/types';
import { BONUS_EMBER, BONUS_TIN, bonusHalvesOf, type Health } from '../sim/health';
import { STAT_DAMAGE, STAT_LUCK, STAT_RANGE, STAT_RATE, STAT_SHOTSPEED, STAT_SPEED } from '../content/sprites/menuIcons';
import { HEART_SPRITE } from '../content/sprites/ui';
import { UI } from '../content/sprites/palette';
import { drawText, measureText, type TextStyle } from '../render/font';
import { drawSprite } from '../render/sprites';
import type { SpriteDef } from '../sim/types';

export type StatKey = 'damage' | 'fireRate' | 'shotSpeed' | 'range' | 'moveSpeed' | 'luck';

export interface StatRow {
  key: StatKey;
  label: string;
  icon: SpriteDef;
  /** Decimals shown. */
  dp: number;
  /** The character-select bar is full at this value. */
  max: number;
}

export const STAT_ROWS: readonly StatRow[] = [
  { key: 'damage', label: 'DAMAGE', icon: STAT_DAMAGE, dp: 2, max: 7 },
  { key: 'fireRate', label: 'FIRE RATE', icon: STAT_RATE, dp: 2, max: 6 },
  { key: 'shotSpeed', label: 'SHOT SPEED', icon: STAT_SHOTSPEED, dp: 0, max: 300 },
  { key: 'range', label: 'RANGE', icon: STAT_RANGE, dp: 0, max: 300 },
  { key: 'moveSpeed', label: 'SPEED', icon: STAT_SPEED, dp: 0, max: 160 },
  { key: 'luck', label: 'LUCK', icon: STAT_LUCK, dp: 1, max: 5 },
];

const LABEL: TextStyle = { color: UI.textDim };
const VALUE: TextStyle = { color: UI.text, shadow: UI.shadow };
const UP: TextStyle = { color: '#8fe0a0', shadow: UI.shadow };
const DOWN: TextStyle = { color: '#ff8a8a', shadow: UI.shadow };

const valueText = new Map<number, string>();
/** `v` with `dp` decimals (cached per rounded value). */
export function statText(v: number, dp: number): string {
  const k = Math.round(v * 100) * 10 + dp;
  let s = valueText.get(k);
  if (s === undefined) {
    s = v.toFixed(dp);
    if (valueText.size > 2000) valueText.clear();
    valueText.set(k, s);
  }
  return s;
}

/**
 * One stat line: icon, label, then the value right-aligned at `x + w` (green above the base, red below).
 */
export function drawStatLine(ctx: CanvasRenderingContext2D, row: StatRow, stats: Readonly<Stats>, base: Readonly<Stats> | null, x: number, y: number, w: number): void {
  drawSprite(ctx, row.icon, 0, x, y - 1);
  drawText(ctx, row.label, x + 10, y, LABEL);
  const v = stats[row.key];
  const b = base ? base[row.key] : v;
  const text = statText(v, row.dp);
  const style = v > b + 1e-6 ? UP : v < b - 1e-6 ? DOWN : VALUE;
  drawText(ctx, text, x + w - measureText(text), y, style);
}

// ── HEALTH ───────────────────────────────────────────────────────────────────

const RED_T: TextStyle = { color: '#ff9aa0', shadow: UI.shadow };
const TIN_T: TextStyle = { color: '#d8e0ee', shadow: UI.shadow };
const EMBER_T: TextStyle = { color: '#ffb050', shadow: UI.shadow };

/** One piece of the HEALTH value, in its heart's colour. */
export interface HealthPart {
  text: string;
  style: TextStyle;
}

/** Half hearts as hearts: 6 → '3', 5 → '2.5'. */
function hearts(halves: number): string {
  return halves % 2 === 0 ? String(halves / 2) : (halves / 2).toFixed(1);
}

/**
 * The HEALTH value: red hearts as current / max ('2.5/3'), then '+2 TIN' and '+1 EMBER' when she has any. A
 * character without red containers (Marrow) shows only her Tin: '3 TIN'.
 */
export function healthParts(h: Health): HealthPart[] {
  const tin = bonusHalvesOf(h, BONUS_TIN);
  const ember = bonusHalvesOf(h, BONUS_EMBER);
  const out: HealthPart[] = [];
  if (h.redMax > 0 || (tin === 0 && ember === 0)) out.push({ text: `${hearts(h.red)}/${hearts(h.redMax)}`, style: RED_T });
  if (tin > 0) out.push({ text: `${out.length ? '+' : ''}${hearts(tin)} TIN`, style: TIN_T });
  if (ember > 0) out.push({ text: `${out.length ? '+' : ''}${hearts(ember)} EMBER`, style: EMBER_T });
  return out;
}

/** The HEALTH value as one string ('2.5/3 +2 TIN +1 EMBER'). */
export function healthText(h: Health): string {
  return healthParts(h)
    .map((p) => p.text)
    .join(' ');
}

/** The HEALTH line (pause menu): heart icon, label, then the parts right-aligned at `x + w`. */
export function drawHealthLine(ctx: CanvasRenderingContext2D, parts: readonly HealthPart[], x: number, y: number, w: number): void {
  drawSprite(ctx, HEART_SPRITE, 0, x - 1, y - 2);
  drawText(ctx, 'HEALTH', x + 10, y, LABEL);
  let rx = x + w;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]!;
    rx -= measureText(p.text);
    drawText(ctx, p.text, rx, y, p.style);
    rx -= 5;
  }
}

/** A stat with a bar (character select): icon, label, bar, value. */
export function drawStatBar(ctx: CanvasRenderingContext2D, row: StatRow, stats: Readonly<Stats>, x: number, y: number, w: number, hidden: boolean): void {
  drawSprite(ctx, row.icon, 0, x, y - 1);
  drawText(ctx, row.label, x + 10, y, LABEL);
  const text = hidden ? '???' : statText(stats[row.key], row.dp);
  const bx = x + 62;
  const bw = w - 62 - 26;
  ctx.fillStyle = '#0b0f18';
  ctx.fillRect(bx, y, bw, 5);
  if (!hidden) {
    const f = Math.max(0, Math.min(1, stats[row.key] / row.max));
    ctx.fillStyle = '#56648a';
    ctx.fillRect(bx, y, Math.max(1, Math.round(bw * f)), 5);
    ctx.fillStyle = '#8a98c4';
    ctx.fillRect(bx, y, Math.max(1, Math.round(bw * f)), 1);
  }
  drawText(ctx, text, x + w - measureText(text), y, VALUE);
}
