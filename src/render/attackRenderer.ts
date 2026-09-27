/**
 * Draws the attack pipeline (ARCHITECTURE §4.6 / §8):
 * - projectiles from their ShotStyle: pre-rendered sprites per (style, shape, size bucket, rotation
 *   frame) with an outline, rim, body, highlight and up to three accent pixels (so combos read at a
 *   glance), plus an additive halo in the style's colour;
 * - beams from their traced polylines: the Storm Lance as a blinding blue-white core inside layered
 *   additive glows with jagged animated lightning strands, a muzzle flare and a wall flare; lasers as
 *   fast thin zaps; forks, feathers and side zaps the same way, thinner;
 * - melee swipes (sweeping arcs), familiars, the charge meter over the player and costume layers.
 * Every canvas is cached; nothing allocates per frame (beams are stroked straight from the sim's
 * Float32Arrays).
 */

import { lerp } from '../engine/math';
import { findItem, findSet } from '../content/registry';
import { BK_FEATHER, BK_LANCE, BK_LASER, BK_SIDE, type Beam } from '../sim/attack/beam';
import type { Familiar } from '../sim/attack/familiars';
import { CM_LANCE, CM_NONE } from '../sim/attack/profile';
import type { Shot } from '../sim/attack/shot';
import { F_BOMB, F_CHILD, F_FALLING, F_KEEPER, SK_BLADE, SK_BOMB, SK_CRESCENT, SK_ORBIT } from '../sim/attack/state';
import type { ShotStyle } from '../sim/attack/style';
import type { Player } from '../sim/player';
import { ATTACK_TUNING, PLAYER_TUNING } from '../sim/tuning';
import { costumeList, type CostumeDef, type ShapeHint } from '../sim/types';
import type { World } from '../sim/world';
import { ctx2d, makeCanvas, parseHexColor } from './canvas';
import { drawShadow, glowSprite } from './pixel';
import { getFlipped, getFrame } from './sprites';

// ── Shot sprites ─────────────────────────────────────────────────────────────

const SHAPE_INDEX: Readonly<Record<ShapeHint, number>> = {
  marble: 0,
  spiky: 1,
  bomb: 2,
  blade: 3,
  crescent: 4,
  star: 5,
  gear: 6,
  shard: 7,
  bubble: 8,
};
/** Rotation frames per shape (spinners by age, crescents / shards by heading). */
const ROT_FRAMES = [1, 8, 1, 8, 16, 8, 8, 16, 1] as const;
const MAX_R = 12;

interface StyleCache {
  sprites: Map<number, (HTMLCanvasElement | undefined)[]>;
  glows: Map<number, HTMLCanvasElement>;
}
const styleCaches = new WeakMap<ShotStyle, StyleCache>();

function cacheOf(style: ShotStyle): StyleCache {
  let c = styleCaches.get(style);
  if (!c) {
    c = { sprites: new Map(), glows: new Map() };
    styleCaches.set(style, c);
  }
  return c;
}

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

function rasterShot(style: ShotStyle, shape: number, r: number, rot: number): HTMLCanvasElement {
  const pad = shape === 1 || shape === 3 || shape === 5 || shape === 7 ? 3 : 2;
  const R = Math.ceil(r * 1.25) + pad;
  const size = R * 2 + 1;
  const c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(size, size);
  const d8 = img.data;
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
  ctx.putImageData(img, 0, 0);
  return c;
}

function shotSprite(style: ShotStyle, shape: number, r: number, frame: number): HTMLCanvasElement {
  const cache = cacheOf(style);
  const key = shape * 64 + r;
  let frames = cache.sprites.get(key);
  if (!frames) {
    frames = [];
    cache.sprites.set(key, frames);
  }
  const n = ROT_FRAMES[shape]!;
  let img = frames[frame];
  if (!img) {
    img = rasterShot(style, shape, r, (frame / n) * Math.PI * 2);
    frames[frame] = img;
  }
  return img;
}

function shotGlow(style: ShotStyle, r: number): HTMLCanvasElement {
  const cache = cacheOf(style);
  let g = cache.glows.get(r);
  if (!g) {
    g = glowSprite(Math.min(16, r + style.glowR + 2), style.glow, 0.55);
    cache.glows.set(r, g);
  }
  return g;
}

function shapeOf(s: Shot): number {
  if ((s.flags & F_KEEPER) !== 0) return SHAPE_INDEX.star;
  switch (s.kind) {
    case SK_BLADE:
      return SHAPE_INDEX.blade;
    case SK_CRESCENT:
      return SHAPE_INDEX.crescent;
    case SK_ORBIT:
      return SHAPE_INDEX.blade;
    case SK_BOMB:
      return SHAPE_INDEX.bomb;
    default:
      if ((s.flags & F_BOMB) !== 0) return SHAPE_INDEX.bomb;
      return SHAPE_INDEX[s.style?.shape ?? 'marble'];
  }
}

/** 'r,g,b' → 'rgb(r,g,b)' (cached: no string building per frame). */
const rgbCache = new Map<string, string>();
function rgbCss(triple: string): string {
  let s = rgbCache.get(triple);
  if (s === undefined) {
    s = `rgb(${triple})`;
    rgbCache.set(triple, s);
  }
  return s;
}

/** A costume layer's glow (cached per layer). */
const costumeGlows = new WeakMap<CostumeDef, HTMLCanvasElement>();
function costumeGlow(c: CostumeDef): HTMLCanvasElement {
  let g = costumeGlows.get(c);
  if (!g) {
    g = glowSprite(c.layer === 'eyes' ? 5 : 13, c.glow ?? '255,255,255', 0.6);
    costumeGlows.set(c, g);
  }
  return g;
}

// ── Costumes ─────────────────────────────────────────────────────────────────

/** Costume layers of the held items (rebuilt when the loadout changes). */
class CostumeCache {
  version = -1;
  behind: CostumeDef[] = [];
  front: CostumeDef[] = [];
  update(p: Player): void {
    if (p.loadout.version === this.version) return;
    this.version = p.loadout.version;
    this.behind = [];
    this.front = [];
    for (const id of p.loadout.costumes) {
      const spec = id.startsWith('set:') ? findSet(id.slice(4))?.costume : findItem(id)?.costume;
      for (const c of costumeList(spec)) (c.behind ? this.behind : this.front).push(c);
    }
  }
}

// ── The renderer ─────────────────────────────────────────────────────────────

const LANCE_GLOW = '120,190,255';

export class AttackRenderer {
  private readonly costumes = new CostumeCache();
  private readonly flare = glowSprite(12, '170,220,255', 0.9);
  private readonly flareSmall = glowSprite(6, '190,230,255', 0.85);
  private readonly famGlow = glowSprite(8, '255,190,90', 0.5);
  private readonly chargeGlow = glowSprite(10, LANCE_GLOW, 0.7);
  private frame = 0;
  /** Glow dimming when many lances overlap (additive glows would wash the room out to white). */
  private crowd = 1;

  /** Called once per rendered frame (animation counters). */
  begin(): void {
    this.frame++;
  }

  // ── Shadows (drawn with the world's shadow pass) ──
  drawShadows(ctx: CanvasRenderingContext2D, w: World, alpha: number, ox: number, oy: number): void {
    const shots = w.projectiles;
    for (let i = 0; i < shots.count; i++) {
      const m = shots.items[i]!;
      const r = Math.max(3, Math.min(9, Math.round(m.size * 1.6)));
      drawShadow(ctx, lerp(m.prevX, m.x, alpha) + ox, lerp(m.prevY, m.y, alpha) + oy + 1, r);
    }
    const fl = w.atk.familiars.list;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]!;
      if (!f.alive || !f.def) continue;
      drawShadow(ctx, lerp(f.prevX, f.x, alpha) + ox, lerp(f.prevY, f.y, alpha) + oy + 1, 7);
    }
  }

  // ── Projectiles ──
  drawShots(ctx: CanvasRenderingContext2D, w: World, alpha: number, ox: number, oy: number): void {
    const shots = w.projectiles;
    if (shots.count === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      const style = s.style;
      if (!style) continue;
      const r = Math.max(1, Math.min(MAX_R, Math.round(s.size)));
      const g = shotGlow(style, r);
      const x = Math.round(lerp(s.prevX, s.x, alpha) + ox);
      const y = Math.round(lerp(s.prevY, s.y, alpha) + oy - lerp(s.prevZ, s.z, alpha));
      ctx.globalAlpha = (s.flags & F_CHILD) !== 0 ? 0.6 : 0.85;
      ctx.drawImage(g, x - (g.width >> 1), y - (g.height >> 1));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      const style = s.style;
      if (!style) continue;
      const r = Math.max(1, Math.min(MAX_R, Math.round(s.size)));
      const shape = shapeOf(s);
      const n = ROT_FRAMES[shape]!;
      let frame = 0;
      if (n > 1) {
        if (shape === SHAPE_INDEX.crescent || shape === SHAPE_INDEX.shard) {
          const a = Math.atan2(s.vy, s.vx);
          frame = ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
        } else {
          frame = Math.floor(s.age * (s.kind === SK_BLADE || s.kind === SK_ORBIT ? 30 : 12)) % n;
        }
      }
      const img = shotSprite(style, shape, r, frame);
      const z = lerp(s.prevZ, s.z, alpha);
      const x = Math.round(lerp(s.prevX, s.x, alpha) + ox);
      const y = Math.round(lerp(s.prevY, s.y, alpha) + oy - z);
      if ((s.flags & F_FALLING) !== 0) ctx.globalAlpha = Math.max(0.45, Math.min(1, z / PLAYER_TUNING.shotHeight));
      ctx.drawImage(img, x - (img.width >> 1), y - (img.height >> 1));
      if ((s.flags & F_FALLING) !== 0) ctx.globalAlpha = 1;
      // Bomb shots: a sparking fuse.
      if (shape === SHAPE_INDEX.bomb && (this.frame + i) % 3 !== 0) {
        ctx.fillStyle = (this.frame + i) % 2 === 0 ? '#fff27a' : '#ff9a40';
        ctx.fillRect(x + Math.round(r * 0.5) + 1, y - r - 3, 1, 1);
      }
    }
  }

  // ── Beams ──
  drawBeams(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number, time: number): void {
    const beams = w.atk.beams;
    if (beams.count === 0) return;
    const h = ATTACK_TUNING.beamHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let lances = 0;
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.kind === BK_LANCE) lances += b.nseg > 1 ? 1.5 : 1;
    }
    this.crowd = lances <= 1.5 ? 1 : Math.max(0.3, 1.25 / Math.sqrt(lances));
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.n < 2) continue;
      if (b.kind === BK_LANCE) this.drawLance(ctx, b, ox, oy - h, time);
      else this.drawThin(ctx, b, ox, oy - h, time);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;
  }

  /** Strokes segment `seg` of a beam at a width multiplier (uniform-width path, or per segment). */
  private strokeSeg(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, wMul: number, wAdd: number): void {
    const s0 = b.segStart[seg]!;
    const n = b.segLen[seg]!;
    if (n < 2) return;
    const px = b.px;
    const py = b.py;
    const pw = b.pw;
    let uniform = true;
    const w0 = pw[s0]!;
    for (let k = 1; k < n; k++) {
      if (Math.abs(pw[s0 + k]! - w0) > 0.6) {
        uniform = false;
        break;
      }
    }
    if (uniform) {
      ctx.lineWidth = Math.max(1, w0 * wMul + wAdd);
      ctx.beginPath();
      ctx.moveTo(px[s0]! + ox, py[s0]! + oy);
      for (let k = 1; k < n; k++) ctx.lineTo(px[s0 + k]! + ox, py[s0 + k]! + oy);
      ctx.stroke();
      return;
    }
    for (let k = 1; k < n; k++) {
      ctx.lineWidth = Math.max(1, ((pw[s0 + k - 1]! + pw[s0 + k]!) / 2) * wMul + wAdd);
      ctx.beginPath();
      ctx.moveTo(px[s0 + k - 1]! + ox, py[s0 + k - 1]! + oy);
      ctx.lineTo(px[s0 + k]! + ox, py[s0 + k]! + oy);
      ctx.stroke();
    }
  }

  /** Jagged lightning strand along a segment (1 px), re-rolled every other frame. */
  private strand(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, amp: number, salt: number, stride: number): void {
    const s0 = b.segStart[seg]!;
    const n = b.segLen[seg]!;
    if (n < 2) return;
    const px = b.px;
    const py = b.py;
    const f = (this.frame >> 1) + salt * 17;
    ctx.beginPath();
    ctx.moveTo(px[s0]! + ox, py[s0]! + oy);
    for (let k = stride; k < n; k += stride) {
      const a = s0 + k;
      const dx = px[a]! - px[a - 1]!;
      const dy = py[a]! - py[a - 1]!;
      const l = Math.sqrt(dx * dx + dy * dy) || 1;
      const hsh = Math.sin((a + f) * 12.9898 + salt * 78.233) * 43758.5453;
      const j = ((hsh - Math.floor(hsh)) * 2 - 1) * amp * (b.pw[a]! * 0.5 + 1);
      ctx.lineTo(px[a]! + ox + (-dy / l) * j, py[a]! + oy + (dx / l) * j);
    }
    const last = s0 + n - 1;
    ctx.lineTo(px[last]! + ox, py[last]! + oy);
    ctx.stroke();
  }

  private drawLance(ctx: CanvasRenderingContext2D, b: Beam, ox: number, oy: number, time: number): void {
    const style = b.style;
    const glowRgb = style ? style.beamGlow : LANCE_GLOW;
    const t = b.age / Math.max(1e-6, b.life);
    // Blast in (a fat white-hot flash), hold, then thin out and fade.
    const intro = b.age < 0.07 ? 1.7 - (b.age / 0.07) * 0.7 : 1;
    const outro = t > 0.7 ? Math.max(0.2, 1 - (t - 0.7) / 0.3) : 1;
    const wk = intro * outro;
    const flick = 0.85 + 0.15 * Math.sin(time * 60 + b.slot);
    const k = this.crowd;
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < b.nseg; s++) {
      const depthK = s === 0 ? 1 : 0.6;
      ctx.globalAlpha = 0.16 * outro * flick * k;
      ctx.strokeStyle = rgbCss(glowRgb);
      this.strokeSeg(ctx, b, s, ox, oy, (1.6 + 1.2 * k) * wk * depthK, 4 * k);
      ctx.globalAlpha = 0.3 * outro * k;
      this.strokeSeg(ctx, b, s, ox, oy, 1.7 * wk * depthK, 2);
      ctx.globalAlpha = 0.65 * outro * (0.4 + 0.6 * k);
      ctx.strokeStyle = style ? style.beamEdge : '#bfe8ff';
      this.strokeSeg(ctx, b, s, ox, oy, 1.0 * wk * depthK, 0);
    }
    // White-hot core.
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(1, 0.95 * outro + 0.2);
    ctx.strokeStyle = style ? style.beamCore : '#ffffff';
    for (let s = 0; s < b.nseg; s++) this.strokeSeg(ctx, b, s, ox, oy, 0.42 * wk * (s === 0 ? 1 : 0.6), 0.6);
    // Crackling lightning strands.
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    const jit = style ? style.beamJitter : 1;
    for (let s = 0; s < b.nseg; s++) {
      ctx.globalAlpha = 0.9 * outro;
      ctx.strokeStyle = '#e6f6ff';
      this.strand(ctx, b, s, ox, oy, 0.9 * jit, 1, 2);
      ctx.strokeStyle = '#8fd0ff';
      this.strand(ctx, b, s, ox, oy, 1.3 * jit, 2, 3);
      if (s === 0) {
        ctx.globalAlpha = 0.6 * outro;
        ctx.strokeStyle = '#ffffff';
        this.strand(ctx, b, s, ox, oy, 1.7 * jit, 3, 4);
      }
    }
    // Muzzle flare and the flare where it bites into the wall.
    ctx.globalAlpha = Math.min(1, 0.8 * wk);
    const fl = this.flare;
    ctx.drawImage(fl, Math.round(b.px[0]! + ox) - (fl.width >> 1), Math.round(b.py[0]! + oy) - (fl.height >> 1));
    if (b.endWall) {
      ctx.globalAlpha = 0.9 * outro * flick;
      ctx.drawImage(fl, Math.round(b.endX + ox) - (fl.width >> 1), Math.round(b.endY + oy) - (fl.height >> 1));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawThin(ctx: CanvasRenderingContext2D, b: Beam, ox: number, oy: number, _time: number): void {
    const style = b.style;
    const t = b.age / Math.max(1e-6, b.life);
    const fade = Math.max(0.15, 1 - t * t);
    const feather = b.kind === BK_FEATHER;
    const side = b.kind === BK_SIDE;
    const glowRgb = feather ? LANCE_GLOW : style ? style.beamGlow : '255,90,120';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = rgbCss(glowRgb);
    for (let s = 0; s < b.nseg; s++) {
      ctx.globalAlpha = (side ? 0.3 : 0.4) * fade;
      this.strokeSeg(ctx, b, s, ox, oy, 2.6, 1);
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = feather ? '#e6f6ff' : style ? style.beamCore : '#ffe0e8';
    for (let s = 0; s < b.nseg; s++) {
      if (b.kind === BK_LASER && !side) this.strokeSeg(ctx, b, s, ox, oy, 0.6, 0);
      this.strand(ctx, b, s, ox, oy, side ? 1.2 : 0.35, 5 + s, side ? 2 : 3);
    }
    if (b.kind === BK_LASER) {
      ctx.globalAlpha = 0.8 * fade;
      const fl = this.flareSmall;
      ctx.drawImage(fl, Math.round(b.px[0]! + ox) - (fl.width >> 1), Math.round(b.py[0]! + oy) - (fl.height >> 1));
      if (b.endWall) ctx.drawImage(fl, Math.round(b.endX + ox) - (fl.width >> 1), Math.round(b.endY + oy) - (fl.height >> 1));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Swipes ──
  drawSwipes(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number): void {
    const swipes = w.atk.swipes;
    if (swipes.count === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < swipes.count; i++) {
      const s = swipes.items[i]!;
      const t = Math.min(1, s.age / s.life);
      const x = s.x + ox;
      const y = s.y + oy - 4;
      // The blade sweeps across the arc in the first 60 % of the swipe; the swept band lingers and fades.
      const start = s.ang - s.arc;
      const lead = start + 2 * s.arc * Math.min(1, t / 0.6);
      const r1 = s.reach;
      const r0 = s.reach * 0.5;
      const glow = s.style ? rgbCss(s.style.glow) : '#dfe6f2';
      ctx.globalAlpha = 0.32 * (1 - t);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, r1, start, lead);
      ctx.arc(x, y, r0, lead, start, true);
      ctx.closePath();
      ctx.fill();
      // Bright leading edge.
      const back = Math.max(start, lead - 0.45);
      ctx.globalAlpha = 0.9 * (1 - t * 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r1, back, lead);
      ctx.arc(x, y, r1 * 0.74, lead, back, true);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.7 * (1 - t);
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r1 + 1, start, lead);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Familiars ──
  drawFamiliars(ctx: CanvasRenderingContext2D, w: World, alpha: number, ox: number, oy: number, time: number): void {
    const p = w.player;
    const charging = p.atk.charging && p.attack.chargeMode !== CM_NONE ? Math.min(1, p.atk.charge) : 0;
    const fl = w.atk.familiars.list;
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]!;
      if (!f.alive || !f.def) continue;
      this.drawFamiliar(ctx, f, alpha, ox, oy, time, charging);
    }
  }

  private drawFamiliar(ctx: CanvasRenderingContext2D, f: Familiar, alpha: number, ox: number, oy: number, time: number, charging: number): void {
    const def = f.def!;
    const sprite = typeof def.sprite === 'string' ? null : def.sprite;
    const x = Math.round(lerp(f.prevX, f.x, alpha) + ox);
    const hover = def.behavior === 'follow' || def.behavior === 'hover' ? 4 + Math.round(Math.sin(time * 4 + f.index) * 1.5) : 1;
    const y = Math.round(lerp(f.prevY, f.y, alpha) + oy) - hover;
    if (def.glow || charging > 0) {
      ctx.globalCompositeOperation = 'lighter';
      if (def.glow) {
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 7 + f.index);
        const g = this.famGlow;
        ctx.drawImage(g, x - (g.width >> 1), y - 6 - (g.height >> 1));
      }
      if (charging > 0 && def.attackScale > 0) {
        // Shooters charge along with you.
        ctx.globalAlpha = charging * (0.6 + 0.4 * Math.sin(time * 30));
        const g = this.chargeGlow;
        ctx.drawImage(g, x - (g.width >> 1), y - 5 - (g.height >> 1));
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!sprite) {
      ctx.fillStyle = '#ffcf57';
      ctx.fillRect(x - 2, y - 4, 4, 4);
      return;
    }
    const fr = sprite.frames.length > 1 ? Math.floor(time * 4 + f.index) % sprite.frames.length : 0;
    const img = f.face < 0 ? getFlipped(sprite, fr) : getFrame(sprite, fr);
    const ax = sprite.anchorX ?? sprite.w >> 1;
    const ay = sprite.anchorY ?? sprite.h - 1;
    ctx.drawImage(img, x - (f.face < 0 ? sprite.w - 1 - ax : ax), y - ay);
  }

  // ── Player overlays ──
  /** Costume layers behind (capes, auras) or in front of (hats, eyes) the character. */
  drawCostumes(
    ctx: CanvasRenderingContext2D,
    p: Player,
    x: number,
    y: number,
    behind: boolean,
    flip: boolean,
    time: number,
  ): void {
    this.costumes.update(p);
    const list = behind ? this.costumes.behind : this.costumes.front;
    if (list.length === 0 || p.dead) return;
    // Facing frame for 'dir' layers: 0 down, 1 up, 2 side.
    const dirFrame = p.faceY < 0 ? 1 : p.faceX !== 0 ? 2 : 0;
    for (let i = 0; i < list.length; i++) {
      const c = list[i]!;
      const sp = c.sprite;
      const anim = c.frames === 'anim' || (c.frames === undefined && sp.frames.length < 3 && sp.frames.length > 1);
      let fr = anim ? Math.floor(time * (c.fps ?? 8)) % sp.frames.length : sp.frames.length >= 3 ? dirFrame : 0;
      if (fr >= sp.frames.length) fr = 0;
      const ax = sp.anchorX ?? sp.w >> 1;
      const ay = sp.anchorY ?? sp.h - 1;
      const f = flip && !anim;
      const dx = Math.round(x + (c.dx ?? 0)) - (f ? sp.w - 1 - ax : ax);
      const dy = Math.round(y + (c.dy ?? 0)) - ay;
      if (c.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = c.layer === 'eyes' ? 0.55 : 0.4 + 0.2 * Math.sin(time * 9);
        const g = costumeGlow(c);
        ctx.drawImage(g, Math.round(x) - (g.width >> 1), Math.round(y) - (c.layer === 'eyes' ? 10 : 8) - (g.height >> 1));
        ctx.globalAlpha = 1;
      }
      if (c.additive) ctx.globalCompositeOperation = 'lighter';
      if (c.layer === 'eyes' && dirFrame === 1) {
        ctx.globalCompositeOperation = 'source-over';
        continue;
      }
      ctx.drawImage(f ? getFlipped(sp, fr) : getFrame(sp, fr), dx, dy);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  /** The charge meter over the player (lance: blue-white, overcharge gold; charge rider: gold). */
  drawChargeMeter(ctx: CanvasRenderingContext2D, p: Player, x: number, y: number, time: number): void {
    const st = p.atk;
    const prof = p.attack;
    if (prof.chargeMode === CM_NONE || p.dead) return;
    const c = st.charge;
    if (c <= 0 && st.busy <= 0) return;
    const lance = prof.chargeMode === CM_LANCE;
    const full = c >= 1;
    const bx = Math.round(x) - 8;
    const by = Math.round(y) - 25;
    // Glow around the character while charging the lance.
    if (lance && c > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(1, c) * (full ? 0.75 + 0.25 * Math.sin(time * 40) : 0.45);
      const g = this.chargeGlow;
      ctx.drawImage(g, Math.round(x) - (g.width >> 1), Math.round(y) - 8 - (g.height >> 1));
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    if (c <= 0) return;
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(bx - 1, by - 1, 18, 5);
    ctx.fillStyle = '#23283a';
    ctx.fillRect(bx, by, 16, 3);
    const fill = Math.round(16 * Math.min(1, c));
    const blink = full && Math.floor(time * 12) % 2 === 0;
    ctx.fillStyle = lance ? (blink ? '#ffffff' : full ? '#bfeaff' : '#5fb0f0') : blink ? '#ffffff' : full ? '#fff27a' : '#e0b040';
    ctx.fillRect(bx, by, fill, 3);
    if (c > 1) {
      // Overcharge: a second, golden bar filling over the first.
      ctx.fillStyle = blink ? '#ffffff' : '#fff27a';
      ctx.fillRect(bx, by + 1, Math.round(16 * Math.min(1, c - 1)), 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(bx, by, fill, 1);
  }
}
