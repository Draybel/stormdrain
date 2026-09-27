/**
 * In-run touch HUD: the floating sticks (translucent base ring + knob) and the action buttons
 * (pixel icons). Laid out from Settings.buttonScale; drawn in the HUD layer.
 */

import type { Input } from '../engine/input';
import { GAME_H, GAME_W } from '../engine/screen';
import type { VirtualStick } from '../engine/sticks';
import { drawSprite, getFrame } from '../render/sprites';
import { drawTextCentered, type TextStyle } from '../render/font';
import { drawPanel, pixelCircle } from '../render/pixel';
import { ICON_ACTIVE, ICON_BOMB, ICON_CONSUMABLE, ICON_MAP, ICON_PAUSE } from '../content/sprites/ui';
import { ICON_DASH } from '../content/sprites/characters';
import { UI } from '../content/sprites/palette';
import { uiButton, type UiButton } from './widgets';

export interface RunButtons {
  pause: UiButton;
  map: UiButton;
  active: UiButton;
  bomb: UiButton;
  consumable: UiButton;
  /** Pip's burrow (only visible for a character with a dash: sim/mechanics.ts characterDashes). */
  dash: UiButton;
  all: UiButton[];
}

export function createRunButtons(): RunButtons {
  const mk = (id: string, action: UiButton['action'], icon: UiButton['icon']): UiButton =>
    uiButton({ id: `run.${id}`, trigger: 'press', action, icon, kind: 'hud', pad: 4 });
  const pause = mk('pause', 'pause', ICON_PAUSE);
  const map = mk('map', 'map', ICON_MAP);
  const active = mk('active', 'active', ICON_ACTIVE);
  const bomb = mk('bomb', 'bomb', ICON_BOMB);
  const consumable = mk('consumable', 'consumable', ICON_CONSUMABLE);
  const dash = mk('dash', 'dash', ICON_DASH);
  dash.visible = false;
  return { pause, map, active, bomb, consumable, dash, all: [map, active, bomb, consumable, dash, pause] };
}

/** Base button size in game px (24 px ≈ 46 pt on iPhone 15). */
const BASE = 24;
const GAP = 6;
const EDGE = 4;

/** Top of the left-handed action column: below the hearts and the coin / bomb / key counters. */
const LEFTY_TOP = 56;

/**
 * Right margin column: pause (top-right corner), active, bomb (then Pip's DASH). Minimap to the left of pause.
 * Left margin: consumable at mid height (hearts/counters own the top-left).
 * Left-handed (Settings): the thumb columns swap — active + bomb (+ dash) go down the left margin (under the
 * counters), the consumable to the right margin under pause; pause and the minimap stay top-right.
 * The DASH button sits on the AIM thumb's side, under the bomb: the move thumb keeps steering, so the burrow
 * goes where Pip is heading (burrowing stops the firing anyway). `dash` = the character has one (it is hidden
 * otherwise and the layout is unchanged).
 */
export function layoutRunButtons(b: RunButtons, scale: number, leftHanded = false, dash = false): void {
  const s = Math.round(BASE * scale);
  const right = GAME_W - EDGE - s;
  b.dash.visible = dash;
  place(b.pause, right, EDGE, s, s);
  const mw = Math.round(36 * scale);
  const mh = Math.round(26 * scale);
  place(b.map, right - GAP - mw, EDGE, mw, mh);
  if (leftHanded) {
    let top = Math.max(LEFTY_TOP, EDGE + (s + GAP) * 2);
    // With a third button, big button sizes lift the column (never above the counters) so it fits.
    if (dash) top = Math.max(LEFTY_TOP, Math.min(top, GAME_H - EDGE - 3 * s - 2 * GAP));
    place(b.active, EDGE, top, s, s);
    place(b.bomb, EDGE, top + s + GAP, s, s);
    place(b.dash, EDGE, top + (s + GAP) * 2, s, s);
    place(b.consumable, right, EDGE + s + GAP, s, s);
    return;
  }
  place(b.active, right, EDGE + s + GAP, s, s);
  place(b.bomb, right, EDGE + (s + GAP) * 2, s, s);
  place(b.dash, right, EDGE + (s + GAP) * 3, s, s);
  place(b.consumable, EDGE, EDGE + (s + GAP) * 2, s, s);
}

/** The DASH button's cooldown: the part still recharging is shaded (0 = ready, 1 = just used). */
export function drawDashCooldown(ctx: CanvasRenderingContext2D, b: UiButton, left: number): void {
  if (!b.visible || left <= 0) return;
  const h = Math.max(1, Math.round((b.h - 2) * Math.min(1, left)));
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#07080d';
  ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 1, b.w - 2, h);
  ctx.globalAlpha = 1;
}

function place(b: UiButton, x: number, y: number, w: number, h: number): void {
  b.x = x;
  b.y = y;
  b.w = w;
  b.h = h;
}

/** Draws one HUD action button: translucent panel + centred icon. */
export function drawHudButton(ctx: CanvasRenderingContext2D, b: UiButton): void {
  if (!b.visible) return;
  const pressed = b.held > 0;
  ctx.globalAlpha = pressed ? 0.85 : 0.55;
  drawPanel(ctx, b.x, b.y, b.w, b.h, pressed ? '#2a3350' : '#10141f', pressed ? '#c9d3f0' : '#56648a');
  ctx.globalAlpha = pressed ? 1 : b.dim ? 0.3 : 0.8;
  if (b.icon) {
    const img = getFrame(b.icon, 0);
    drawSprite(ctx, b.icon, 0, b.x + (b.w - img.width) / 2, b.y + (b.h - img.height) / 2 + (pressed ? 1 : 0));
  }
  ctx.globalAlpha = 1;
  if (b.flash < 0.12) {
    ctx.globalAlpha = 0.5 * (1 - b.flash / 0.12);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 1, b.w - 2, b.h - 2);
    ctx.globalAlpha = 1;
  }
}

/** Placeholder minimap: a 3×3 cell sketch with the current room lit (real map in Phase 3). */
export function drawMinimapButton(ctx: CanvasRenderingContext2D, b: UiButton): void {
  if (!b.visible) return;
  const pressed = b.held > 0;
  ctx.globalAlpha = pressed ? 0.85 : 0.55;
  drawPanel(ctx, b.x, b.y, b.w, b.h, pressed ? '#2a3350' : '#10141f', pressed ? '#c9d3f0' : '#56648a');
  ctx.globalAlpha = 0.9;
  const cw = Math.max(4, Math.floor((b.w - 8) / 3) - 1);
  const ch = Math.max(3, Math.floor((b.h - 6) / 3) - 1);
  const ox = Math.round(b.x + (b.w - (cw + 1) * 3 + 1) / 2);
  const oy = Math.round(b.y + (b.h - (ch + 1) * 3 + 1) / 2);
  ctx.fillStyle = '#3a4460';
  ctx.fillRect(ox + (cw + 1), oy, cw, ch);
  ctx.fillRect(ox, oy + (ch + 1), cw, ch);
  ctx.fillRect(ox + (cw + 1) * 2, oy + (ch + 1), cw, ch);
  ctx.fillStyle = UI.text;
  ctx.fillRect(ox + (cw + 1), oy + (ch + 1), cw, ch);
  ctx.globalAlpha = 1;
}

// ── Sticks ───────────────────────────────────────────────────────────────────
const RING = 24;
const KNOB = 8;
const HINT_STYLE: TextStyle = { color: '#c9d3f0', shadow: '#07080d' };

const MOVE_KNOB_BASE = { x: 44, y: GAME_H - 44 };
const AIM_KNOB_BASE = { x: GAME_W - 44, y: GAME_H - 44 };

/** Stick graphics, baked once on first use. */
interface StickArt {
  ring: HTMLCanvasElement;
  ringHot: HTMLCanvasElement;
  knob: HTMLCanvasElement;
  knobHot: HTMLCanvasElement;
  mark: HTMLCanvasElement;
  hintRing: HTMLCanvasElement;
  hintKnob: HTMLCanvasElement;
}
let art: StickArt | null = null;
function stickArt(): StickArt {
  return (art ??= {
    ring: pixelCircle(RING, 'rgba(10,12,22,0.28)', 'rgba(233,237,247,0.4)'),
    ringHot: pixelCircle(RING, 'rgba(10,12,22,0.28)', 'rgba(255,215,106,0.55)'),
    knob: pixelCircle(KNOB, 'rgba(233,237,247,0.45)', 'rgba(255,255,255,0.8)'),
    knobHot: pixelCircle(KNOB, 'rgba(255,215,106,0.5)', 'rgba(255,255,255,0.8)'),
    mark: pixelCircle(3, 'rgba(255,215,106,0.9)', null),
    hintRing: pixelCircle(RING, 'rgba(10,12,22,0.18)', 'rgba(233,237,247,0.3)'),
    hintKnob: pixelCircle(KNOB, null, 'rgba(233,237,247,0.35)'),
  });
}

function drawStick(ctx: CanvasRenderingContext2D, st: VirtualStick, aim: boolean): void {
  const a = stickArt();
  const hot = aim && st.hasDir;
  const ox = Math.round(st.originX);
  const oy = Math.round(st.originY);
  ctx.drawImage(hot ? a.ringHot : a.ring, ox - RING, oy - RING);
  if (hot) {
    // Marker on the rim showing the (snapped) firing direction.
    ctx.drawImage(a.mark, Math.round(ox + st.dirX * (RING - 4)) - 3, Math.round(oy + st.dirY * (RING - 4)) - 3);
  }
  ctx.drawImage(hot ? a.knobHot : a.knob, Math.round(st.originX + st.knobDX) - KNOB, Math.round(st.originY + st.knobDY) - KNOB);
}

function drawStickHint(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, alpha: number): void {
  const a = stickArt();
  ctx.globalAlpha = alpha;
  ctx.drawImage(a.hintRing, x - RING, y - RING);
  ctx.drawImage(a.hintKnob, x - KNOB, y - KNOB);
  drawTextCentered(ctx, label, x, y + RING + 3, HINT_STYLE);
  ctx.globalAlpha = 1;
}

/**
 * @param hintAlpha 0..1 opacity of the resting-position hints (touch devices, early in a run)
 */
export function drawSticks(ctx: CanvasRenderingContext2D, input: Input, hintAlpha: number): void {
  const m = input.moveStick;
  const a = input.aimStick;
  // Left-handed: the move stick rests on the right, the shoot stick on the left.
  const lefty = input.isLeftHanded;
  const mb = lefty ? AIM_KNOB_BASE : MOVE_KNOB_BASE;
  const ab = lefty ? MOVE_KNOB_BASE : AIM_KNOB_BASE;
  if (m.active) drawStick(ctx, m, false);
  else if (hintAlpha > 0.01) drawStickHint(ctx, mb.x, mb.y - 6, 'MOVE', hintAlpha);
  if (a.active) drawStick(ctx, a, true);
  else if (hintAlpha > 0.01) drawStickHint(ctx, ab.x, ab.y - 6, 'SHOOT', hintAlpha);
}
