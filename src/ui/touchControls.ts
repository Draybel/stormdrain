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
import { hudCornerRects } from '../render/hud';
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

/** Button size in game px at 100 % (24 px ≈ 46 pt in the iPhone 15 home-screen app). */
export const BASE = 24;
/** The smallest tap target, in CSS px (Apple's 44 pt). */
export const MIN_TAP_CSS = 44;
const GAP = 6;
/** Buttons may close up to this gap (= their hit pad): a neighbour's hit rect then just meets a button's edge. */
const MIN_GAP = 4;
const EDGE = 4;
/** The room interior (game px): no button covers it (the side walls may be covered). */
const INTERIOR_L = 88;
const INTERIOR_R = 296;
/** Room-side space a button's decoration needs: the active's charge bar (2 + 5 px), the consumable's trinkets (3 + 14). */
const CHARGE_SIDE = 7;
const TRINKET_SIDE = 17;

/** The sticks' resting spots — where the faint MOVE / SHOOT hint rings sit (the left one and the right one). */
export const STICK_REST_L = { x: 44, y: GAME_H - 50 } as const;
export const STICK_REST_R = { x: GAME_W - 44, y: GAME_H - 50 } as const;
/**
 * The stick zone around each resting spot (polish batch 3): no run button's HIT rect (rect + pad) comes within this
 * radius of it (the hint ring's 24 px + 2 px of slack), so a thumb that lands on the ring always gets its stick.
 */
export const STICK_ZONE_R = 26;

/** The smallest button (game px) that is still {@link MIN_TAP_CSS} CSS px on screen at this display scale. */
export function minTapSize(viewScale: number): number {
  return viewScale > 0 ? Math.max(1, Math.ceil(MIN_TAP_CSS / viewScale - 1e-6)) : BASE;
}

/**
 * The button size asked for: 100 % = max(BASE, the 44 pt floor), scaled by Settings → BUTTON SIZE (100-150 %; an
 * older save's 75 % reads as 100 %), never below the floor.
 */
export function buttonSizeFor(scale: number, minSize = BASE): number {
  const base = Math.max(BASE, minSize);
  return Math.max(minSize, Math.round(base * Math.max(1, scale)));
}

export interface RunLayoutOptions {
  /** The 44 pt floor in game px for the current display ({@link minTapSize}); default BASE. */
  minSize?: number;
  /** The training yard's bell (placed near the consumable, clear of the stick zone). */
  bell?: UiButton;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A column of equal square buttons along one margin: x, and the band of y its buttons may use. */
interface Column {
  x: number;
  top: number;
  bottom: number;
}

/**
 * Lays the run buttons out (polish batch 3). Pause sits in the top-right corner with the minimap left of it. The
 * THUMB column — active, bomb (and Pip's DASH) — runs down the shoot thumb's margin (the right one; the left one when
 * left-handed), bottom-aligned just above the stick zone so the resting thumb reaches it; the consumable (and the
 * yard's bell) sits in the other margin, below the hearts / counters (right-handed) or under pause (left-handed).
 * Every press button's hit rect stays out of both stick zones ({@link STICK_ZONE_R}), off the hearts / counters and
 * off the other buttons; nothing covers the room interior. When a column can't hold its buttons at the size asked
 * for, the gaps close to 4 px, then a second column opens toward the room (the active goes innermost, so its charge
 * bar faces the room), and only then does the size shrink — never below `minSize` (the 44 pt floor).
 * The DASH button is on the AIM thumb's side: the move thumb keeps steering, so the burrow goes where Pip is heading.
 */
export function layoutRunButtons(b: RunButtons, scale: number, leftHanded = false, dash = false, opts: RunLayoutOptions = {}): void {
  const minSize = Math.max(1, opts.minSize ?? BASE);
  b.dash.visible = dash;
  const want = buttonSizeFor(scale, minSize);
  for (let s = want; s >= minSize; s--) if (tryLayout(b, s, leftHanded, dash, opts.bell, false)) return;
  // Nothing fits (a display far smaller than any phone): the floor size, stacked as well as it goes.
  tryLayout(b, minSize, leftHanded, dash, opts.bell, true);
}

function tryLayout(b: RunButtons, s: number, leftHanded: boolean, dash: boolean, bell: UiButton | undefined, force: boolean): boolean {
  const pad = b.active.pad;
  const right = GAME_W - EDGE - s;
  place(b.pause, right, EDGE, s, s);
  const mw = Math.round((36 * s) / BASE);
  const mh = Math.round((26 * s) / BASE);
  place(b.map, right - GAP - mw, EDGE, mw, mh);
  const thumbSide = leftHanded ? -1 : 1;
  const thumbRest = leftHanded ? STICK_REST_L : STICK_REST_R;
  const otherRest = leftHanded ? STICK_REST_R : STICK_REST_L;
  // What sits above each margin: the HUD's top-left block (hearts, counters), or pause + the minimap.
  const aboveL: Box[] = hudCornerRects();
  const aboveR: Box[] = [b.pause, b.map];
  const thumbAbove = leftHanded ? aboveL : aboveR;
  const otherAbove = leftHanded ? aboveR : aboveL;

  // ── The thumb column(s) ──
  const items = dash ? [b.active, b.bomb, b.dash] : [b.active, b.bomb];
  let placed = false;
  for (const gap of [GAP, GAP - 1, MIN_GAP]) {
    const c0 = column(thumbSide, 0, s, gap, pad, thumbAbove, thumbRest, CHARGE_SIDE);
    if (c0 && capacity(c0, s, gap) >= items.length) {
      stack(items, c0, s, gap);
      placed = true;
      break;
    }
  }
  for (let i = 0; i < 3 && !placed; i++) {
    const gap = [GAP, GAP - 1, MIN_GAP][i]!;
    const c0 = column(thumbSide, 0, s, gap, pad, thumbAbove, thumbRest);
    const c1 = column(thumbSide, 1, s, gap, pad, thumbAbove, thumbRest, CHARGE_SIDE);
    if (!c0 || !c1) continue;
    // The outer column takes the plain buttons nearest the thumb (DASH, then BOMB); the inner one the rest with the
    // active on top — innermost, so its charge bar has the room side to itself.
    const plain = dash ? [b.bomb, b.dash] : [b.bomb];
    const k = Math.min(capacity(c0, s, gap), plain.length);
    const inner = [b.active, ...plain.slice(0, plain.length - k)];
    if (k < 1 || inner.length > capacity(c1, s, gap)) continue;
    stack(plain.slice(plain.length - k), c0, s, gap);
    stack(inner, c1, s, gap);
    placed = true;
  }
  if (!placed) {
    if (!force) return false;
    const c0 = column(thumbSide, 0, s, MIN_GAP, pad, thumbAbove, thumbRest);
    stack(items, c0 ?? { x: thumbSide > 0 ? right : EDGE, top: 0, bottom: GAME_H - EDGE }, s, MIN_GAP);
  }

  // ── The consumable (and the bell) in the other margin ──
  const otherSide = -thumbSide;
  const oc = column(otherSide, 0, s, GAP, pad, otherAbove, otherRest, TRINKET_SIDE);
  if (!oc || capacity(oc, s, GAP) < 1) {
    if (!force) return false;
  }
  let cy: number;
  if (leftHanded) {
    // Under pause, low enough that two trinkets beside it (room side) clear the minimap's hit rect.
    const trinketTop = b.map.y + b.map.h + pad;
    cy = Math.max(oc?.top ?? EDGE + s + GAP, trinketTop + 8 - Math.round((s - 14) / 2));
  } else {
    // Below the counters, where it always was at 100 % (y 64).
    cy = Math.max(oc?.top ?? 56, EDGE + (s + GAP) * 2);
  }
  if (oc) cy = Math.max(oc.top, Math.min(cy, oc.bottom - s));
  place(b.consumable, otherSide > 0 ? right : EDGE, cy, s, s);
  if (bell) placeBell(bell, b, s, otherSide);
  return true;
}

/**
 * Column `index` (0 = at the screen edge, 1 = the next one toward the room) of a margin (`side` 1 = right, -1 =
 * left): its x and the y band its buttons may use — below everything above it (hit rects clear of those rects, and
 * their pads clear of the button) and above the stick zone (hit rects outside the zone circle). Null when it (or
 * `roomSide` px beside it toward the room: a charge bar, trinkets) would cover the room interior.
 */
function column(
  side: number,
  index: number,
  s: number,
  gap: number,
  pad: number,
  above: readonly Box[],
  rest: { x: number; y: number },
  roomSide = 0,
): Column | null {
  const x = side > 0 ? GAME_W - EDGE - s - index * (s + gap) : EDGE + index * (s + gap);
  if (side > 0 ? x - roomSide < INTERIOR_R : x + s + roomSide > INTERIOR_L) return null;
  const hx0 = x - pad;
  const hx1 = x + s + pad;
  let top = EDGE;
  for (const r of above) {
    if (hx0 < r.x + r.w + pad && r.x - pad < hx1) top = Math.max(top, Math.ceil(r.y + r.h + pad));
  }
  let bottom = GAME_H - EDGE;
  const dx = Math.max(0, hx0 - rest.x, rest.x - hx1);
  if (dx < STICK_ZONE_R) {
    const zoneTop = rest.y - Math.sqrt(STICK_ZONE_R * STICK_ZONE_R - dx * dx);
    bottom = Math.min(bottom, Math.floor(zoneTop) - pad);
  }
  return { x, top, bottom };
}

function capacity(c: Column, s: number, gap: number): number {
  const room = c.bottom - c.top;
  return room < s ? 0 : 1 + Math.floor((room - s) / (s + gap));
}

/** Stacks buttons (top → bottom) bottom-aligned in the column: the last one sits just above the stick zone. */
function stack(list: readonly UiButton[], c: Column, s: number, gap: number): void {
  let y = c.bottom - s;
  for (let i = list.length - 1; i >= 0; i--) {
    place(list[i]!, c.x, y, s, s);
    y -= s + gap;
  }
}

/**
 * The training yard's bell (debug only): under the consumable, else above it, else beside it toward the room — the
 * first spot whose hit rect clears both stick zones, the HUD corner and the other buttons, and that stays off the room.
 */
function placeBell(bell: UiButton, b: RunButtons, s: number, side: number): void {
  const c = b.consumable;
  const others = [b.pause, b.map, b.active, b.bomb, b.consumable, ...(b.dash.visible ? [b.dash] : [])];
  const inward = side > 0 ? c.x - GAP - s : c.x + s + GAP;
  const spots: [number, number][] = [
    [c.x, c.y + s + GAP],
    [c.x, c.y - GAP - s],
    [inward, c.y],
    [inward, c.y + s + GAP],
    [inward, c.y - GAP - s],
  ];
  for (const [x, y] of spots) {
    if (bellFits({ x, y, w: s, h: s }, bell.pad, others)) {
      place(bell, x, y, s, s);
      return;
    }
  }
  place(bell, c.x, c.y + s + GAP, s, s);
}

function bellFits(r: Box, pad: number, others: readonly UiButton[]): boolean {
  if (r.x < 0 || r.y < 0 || r.x + r.w > GAME_W || r.y + r.h > GAME_H) return false;
  if (r.x < INTERIOR_R && r.x + r.w > INTERIOR_L) return false;
  const h = { x: r.x - pad, y: r.y - pad, w: r.w + 2 * pad, h: r.h + 2 * pad };
  for (const rest of [STICK_REST_L, STICK_REST_R]) {
    const dx = Math.max(0, h.x - rest.x, rest.x - (h.x + h.w));
    const dy = Math.max(0, h.y - rest.y, rest.y - (h.y + h.h));
    if (dx * dx + dy * dy < STICK_ZONE_R * STICK_ZONE_R) return false;
  }
  const clear = (a: Box, o: Box): boolean => a.x >= o.x + o.w || o.x >= a.x + a.w || a.y >= o.y + o.h || o.y >= a.y + a.h;
  for (const c of hudCornerRects()) if (!clear(h, c)) return false;
  for (const o of others) {
    if (!clear(h, o)) return false;
    if (!clear({ x: o.x - o.pad, y: o.y - o.pad, w: o.w + 2 * o.pad, h: o.h + 2 * o.pad }, r)) return false;
  }
  return true;
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
/** The stick rings' radius (game px): the drawn ring and the resting hint. */
export const STICK_RING = 24;
const RING = STICK_RING;
const KNOB = 8;
const HINT_STYLE: TextStyle = { color: '#c9d3f0', shadow: '#07080d' };

/** The hint rings sit on the resting spots (their centres; the MOVE / SHOOT labels under them). */
const MOVE_KNOB_BASE = STICK_REST_L;
const AIM_KNOB_BASE = STICK_REST_R;

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

/**
 * One active stick. Its origin may lie outside the image (a thumb on the letterbox: `Display.toGameRaw`), so only the
 * DRAWN ring is clamped into the image — its centre at least a knob's radius inside — and the knob keeps its offset
 * from it. A stick whose knob travel is shorter than the ring (the aim stick's 12 px) draws its knob scaled out toward
 * the rim, so a full push still reads as one.
 */
function drawStick(ctx: CanvasRenderingContext2D, st: VirtualStick, aim: boolean): void {
  const a = stickArt();
  const hot = aim && st.hasDir;
  const ox = Math.round(clampTo(st.originX, KNOB, GAME_W - KNOB));
  const oy = Math.round(clampTo(st.originY, KNOB, GAME_H - KNOB));
  ctx.drawImage(hot ? a.ringHot : a.ring, ox - RING, oy - RING);
  if (hot) {
    // Marker on the rim showing the (snapped) firing direction.
    ctx.drawImage(a.mark, Math.round(ox + st.dirX * (RING - 4)) - 3, Math.round(oy + st.dirY * (RING - 4)) - 3);
  }
  const r = st.cfg.radius;
  const k = r < RING - KNOB ? (RING - KNOB + 2) / r : 1;
  ctx.drawImage(hot ? a.knobHot : a.knob, Math.round(ox + st.knobDX * k) - KNOB, Math.round(oy + st.knobDY * k) - KNOB);
}

function clampTo(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
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
  else if (hintAlpha > 0.01) drawStickHint(ctx, mb.x, mb.y, 'MOVE', hintAlpha);
  if (a.active) drawStick(ctx, a, true);
  else if (hintAlpha > 0.01) drawStickHint(ctx, ab.x, ab.y, 'SHOOT', hintAlpha);
}
