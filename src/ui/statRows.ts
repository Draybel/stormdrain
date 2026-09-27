/**
 * The six visible stats as the menus show them (pause menu, character select): an icon, a label, the value
 * (text cached per value — no allocation while it doesn't change) and a colour against the character's base.
 */

import type { Stats } from '../sim/types';
import { STAT_DAMAGE, STAT_LUCK, STAT_RANGE, STAT_RATE, STAT_SHOTSPEED, STAT_SPEED } from '../content/sprites/menuIcons';
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
