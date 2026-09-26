/**
 * Canvas-drawn UI buttons. They are HitButtons (engine/buttons.ts) plus a label/icon; menu
 * buttons activate on pointer-up inside themselves (thumb can slide off to cancel).
 * Size rule: >= 24 game px tall ≈ 44 pt on an iPhone 15 (1 game px ≈ 1.9 pt).
 */

import { makeButton, type HitButton } from '../engine/buttons';
import type { SpriteDef } from '../sim/types';
import { UI } from '../content/sprites/palette';
import { drawTextCentered, FONT_H, type TextStyle } from '../render/font';
import { drawPanel } from '../render/pixel';

export type ButtonKind = 'primary' | 'secondary' | 'hud';

export interface UiButton extends HitButton {
  label: string;
  icon: SpriteDef | null;
  kind: ButtonKind;
  /** Text scale (menu buttons use 2 for thumb-friendly labels). */
  textScale: number;
}

export function uiButton(init: Partial<UiButton> & { id: string }): UiButton {
  const base = makeButton({ pad: 3, ...init });
  return {
    ...base,
    label: init.label ?? '',
    icon: init.icon ?? null,
    kind: init.kind ?? 'secondary',
    textScale: init.textScale ?? 2,
  };
}

const LABEL_PRIMARY: TextStyle = { color: '#fff3c4', shadow: '#3a2410' };
const LABEL_SECONDARY: TextStyle = { color: UI.text, shadow: UI.shadow };
const LABEL_DISABLED: TextStyle = { color: UI.textDim, shadow: UI.shadow };

/** Scaled copies of the label styles, created once (no per-frame allocation). */
const styleCache = new Map<TextStyle, TextStyle[]>();
function scaled(base: TextStyle, scale: number): TextStyle {
  let arr = styleCache.get(base);
  if (!arr) {
    arr = [];
    styleCache.set(base, arr);
  }
  return (arr[scale] ??= { ...base, scale });
}

/** Draws a menu button: raised panel with a drop edge; pressed = sunk 1 px and brighter. */
export function drawMenuButton(ctx: CanvasRenderingContext2D, b: UiButton): void {
  if (!b.visible) return;
  const pressed = b.held > 0 && b.armed;
  const primary = b.kind === 'primary';
  const x = Math.round(b.x);
  const y = Math.round(b.y) + (pressed ? 1 : 0);
  const h = b.h - 1;
  if (!pressed) {
    ctx.fillStyle = UI.shadow;
    ctx.fillRect(x + 1, Math.round(b.y) + h, b.w - 2, 1);
  }
  const fill = pressed ? (primary ? '#3b4870' : '#2a3350') : primary ? '#2b3553' : UI.panel;
  const border = !b.enabled ? '#3a4460' : primary ? UI.borderHot : pressed ? '#8a98c4' : UI.border;
  drawPanel(ctx, x, y, b.w, h, fill, border, primary ? '#44527c' : '#28304a');
  // Activation flash.
  if (b.flash < 0.15) {
    ctx.globalAlpha = 0.35 * (1 - b.flash / 0.15);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, y + 1, b.w - 2, h - 2);
    ctx.globalAlpha = 1;
  }
  const style = scaled(!b.enabled ? LABEL_DISABLED : primary ? LABEL_PRIMARY : LABEL_SECONDARY, b.textScale);
  const ty = y + Math.round((h - FONT_H * b.textScale) / 2);
  drawTextCentered(ctx, b.label, x + b.w / 2, ty, style);
}

/** Advance per-button flash timers (call from the owning scene's update). */
export function tickButtons(buttons: readonly HitButton[], dt: number): void {
  for (const b of buttons) if (b.flash < 1) b.flash = Math.min(1, b.flash + dt);
}
