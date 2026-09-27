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
import { pixelsToCanvas } from './canvas';
import { playerShotPixels } from './shotPixels';
import { drawShadow, glowSprite } from './pixel';
import { ROOM_OUTER_H, ROOM_OUTER_W, WALL } from './layout';
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
/** Above this many projectiles their shadows are skipped. */
const MAX_SHOT_SHADOWS = 150;
/** Synergy tethers (ShotStyle.tether) drawn per frame at most, and the kinks in each line. */
const MAX_TETHERS = 24;
const TETHER_JAGS = 5;

interface StyleCache {
  sprites: Map<number, (HTMLCanvasElement | undefined)[]>;
  glows: Map<number, HTMLCanvasElement>;
}
/**
 * Sprite caches by LOOK (polish batch 2): keyed by `style.key` — body, rim, accents, shape, glow radius: everything
 * rasterShot and shotGlow read (line, hi and glow derive from them) — in a small LRU of looks. composeStyle builds a
 * new ShotStyle object on every recompute (timed triggers run it all the time), so a cache per OBJECT re-rasterised
 * identical sprites again and again; the WeakMap only remembers which look an object has.
 */
const STYLE_LRU = 8;
const lookCaches = new Map<string, StyleCache>();
const styleCaches = new WeakMap<ShotStyle, StyleCache>();
/** Shot sprites and glows rasterised so far (tests / tools). */
export const SHOT_RASTER_STATS = { sprites: 0, glows: 0 };

/** Looks held in the LRU (tests / tools). */
export function shotLookCount(): number {
  return lookCaches.size;
}

function cacheOf(style: ShotStyle): StyleCache {
  let c = styleCaches.get(style);
  if (c) return c;
  c = lookCaches.get(style.key);
  if (c) {
    // Most recently used look last (a Map keeps insertion order).
    lookCaches.delete(style.key);
  } else {
    c = { sprites: new Map(), glows: new Map() };
    if (lookCaches.size >= STYLE_LRU) {
      const oldest = lookCaches.keys().next().value;
      if (oldest !== undefined) lookCaches.delete(oldest);
    }
  }
  lookCaches.set(style.key, c);
  styleCaches.set(style, c);
  return c;
}

/** A player shot sprite: shotPixels.ts playerShotPixels (white-hot centre), one putImageData. */
function rasterShot(style: ShotStyle, shape: number, r: number, rot: number): HTMLCanvasElement {
  SHOT_RASTER_STATS.sprites++;
  return pixelsToCanvas(playerShotPixels(style, shape, r, rot));
}

/** A player shot sprite of a look, shape, radius and rotation frame (rasterised on first use, cached per look). */
export function shotSprite(style: ShotStyle, shape: number, r: number, frame: number): HTMLCanvasElement {
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
    SHOT_RASTER_STATS.glows++;
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

/**
 * Direction (rad) of a beam polyline at point `i` (central difference; one-sided at the ends); a
 * zero-length step keeps `prev`.
 */
function heading(px: Float32Array, py: Float32Array, first: number, last: number, i: number, prev: number): number {
  const a = i > first ? i - 1 : i;
  const c = i < last ? i + 1 : i;
  const dx = px[c]! - px[a]!;
  const dy = py[c]! - py[a]!;
  return dx * dx + dy * dy > 1e-6 ? Math.atan2(dy, dx) : prev;
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

/**
 * Costume layers of the held items and the transformations (rebuilt when the loadout changes). A
 * transformation's layers SWAP OUT item layers of the same slot (a set's hat replaces an item's hat).
 */
class CostumeCache {
  version = -1;
  behind: CostumeDef[] = [];
  front: CostumeDef[] = [];
  update(p: Player): void {
    if (p.loadout.version === this.version) return;
    this.version = p.loadout.version;
    this.behind = [];
    this.front = [];
    const setLayers = new Set<string>();
    for (const id of p.loadout.costumes) {
      if (!id.startsWith('set:')) continue;
      for (const c of costumeList(findSet(id.slice(4))?.costume)) setLayers.add(c.layer);
    }
    for (const id of p.loadout.costumes) {
      const set = id.startsWith('set:');
      const spec = set ? findSet(id.slice(4))?.costume : findItem(id)?.costume;
      for (const c of costumeList(spec)) {
        if (!set && setLayers.has(c.layer)) continue;
        (c.behind ? this.behind : this.front).push(c);
      }
    }
  }
}

// ── The renderer ─────────────────────────────────────────────────────────────

const LANCE_GLOW = '120,190,255';
/** Beam lite mode above this many lances (forked ones count 1.5) or lance trace points on screen. */
const LITE_LANCES = 12;
const LITE_POINTS = 2000;
/** In lite mode only this many lances keep their bright edge pass. */
const LITE_EDGES = 4;
/** Lances batched per frame (the beam pool's cap). */
const MAX_LANCES = 48;
/** Lance passes, in drawing order: wide glow, glow, edge (additive), white-hot core (normal), three strands. */
const PASS_WIDE = 0;
const PASS_GLOW = 1;
const PASS_EDGE = 2;
const PASS_CORE = 3;
const PASS_STRAND1 = 4;
const PASS_STRAND2 = 5;
const PASS_COUNT = 7;

export class AttackRenderer {
  private readonly costumes = new CostumeCache();
  private readonly flare = glowSprite(12, '170,220,255', 0.9);
  private readonly flareSmall = glowSprite(6, '190,230,255', 0.85);
  private readonly famGlow = glowSprite(8, '255,190,90', 0.5);
  private readonly chargeGlow = glowSprite(10, LANCE_GLOW, 0.7);
  private frame = 0;
  /** Glow dimming when many lances overlap (additive glows would wash the room out to white). */
  private crowd = 1;
  /**
   * Lots of beam on screen (an absurd build's ring of lances): each beam is drawn with fewer passes
   * (one glow, the core, one strand) so the frame keeps up; it's a wall of light either way.
   */
  private lite = false;
  /** This frame's lances and their per-lance numbers (fixed scratch, no allocation). */
  private readonly lances: (Beam | null)[] = new Array<Beam | null>(MAX_LANCES).fill(null);
  private readonly wk = new Float32Array(MAX_LANCES);
  private readonly outro = new Float32Array(MAX_LANCES);
  private readonly done = new Uint8Array(MAX_LANCES);

  /** Called once per rendered frame (animation counters). */
  begin(): void {
    this.frame++;
  }

  // ── Shadows (drawn with the world's shadow pass) ──
  drawShadows(ctx: CanvasRenderingContext2D, w: World, alpha: number, ox: number, oy: number): void {
    const shots = w.projectiles;
    // A storm of shots: no per-shot shadows (hundreds of small fills a frame nobody can see under the glow).
    const n = shots.count > MAX_SHOT_SHADOWS ? 0 : shots.count;
    for (let i = 0; i < n; i++) {
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
    this.drawTethers(ctx, w, alpha, ox, oy);
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

  /**
   * Tethers (ShotStyle.tether, special synergies): a thin crackling line from each thrown shot back to
   * whoever threw it (the player or a familiar), under the shots. Split children and orbit blades don't
   * get one; at most MAX_TETHERS per frame. The jag is re-rolled every other frame, no allocation.
   */
  private drawTethers(ctx: CanvasRenderingContext2D, w: World, alpha: number, ox: number, oy: number): void {
    const shots = w.projectiles;
    const f = this.frame >> 1;
    let drawn = 0;
    for (let i = 0; i < shots.count && drawn < MAX_TETHERS; i++) {
      const s = shots.items[i]!;
      const style = s.style;
      const a = s.anchor;
      if (!style || style.tether === '' || a === null || !a.alive || s.kind === SK_ORBIT || (s.flags & F_CHILD) !== 0) continue;
      drawn++;
      const x1 = a.x + ox;
      const y1 = a.y + oy - PLAYER_TUNING.shotHeight;
      const x2 = lerp(s.prevX, s.x, alpha) + ox;
      const y2 = lerp(s.prevY, s.y, alpha) + oy - lerp(s.prevZ, s.z, alpha);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 3) continue;
      const nx = -dy / len;
      const ny = dx / len;
      ctx.strokeStyle = style.tether;
      for (let pass = 0; pass < 2; pass++) {
        ctx.globalCompositeOperation = pass === 0 ? 'lighter' : 'source-over';
        ctx.globalAlpha = pass === 0 ? 0.3 : 0.85;
        ctx.lineWidth = pass === 0 ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        for (let k = 1; k < TETHER_JAGS; k++) {
          const t = k / TETHER_JAGS;
          const j = ((Math.imul(f + i * 7 + k * 13, 0x9e3779b1) >>> 0) % 5) - 2;
          ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
    }
    if (drawn > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 1;
    }
  }

  // ── Beams ──
  /**
   * Beams, clipped to the room. The lances of a frame are drawn PASS BY PASS (wide glow, glow, edge, white-hot core,
   * lightning strands), each pass as ONE path per (colour, quantised alpha): every lance's filled outline (or strand)
   * is added to the same path and filled / stroked once. The outlines share a winding, so a nonzero fill unions them —
   * a volley of 48 lances costs a handful of fills instead of ~150 separate rasterisations, and overlapping lances no
   * longer pile their additive glows up into a white room. Lasers, feathers and side zaps are thin and drawn one by one.
   */
  drawBeams(ctx: CanvasRenderingContext2D, w: World, ox: number, oy: number, time: number): void {
    const beams = w.atk.beams;
    if (beams.count === 0) return;
    const h = ATTACK_TUNING.beamHeight;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    let n = 0;
    let weight = 0;
    let points = 0;
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.kind !== BK_LANCE || b.n < 2 || n >= MAX_LANCES) continue;
      this.lances[n++] = b;
      weight += b.nseg > 1 ? 1.5 : 1;
      points += b.n;
    }
    // The union fill stops overlaps from adding up, so a crowd only dims a little (it used to take the glow to 0.3).
    this.crowd = weight <= 2 ? 1 : Math.max(0.6, 1.25 / Math.sqrt(weight));
    this.lite = weight > LITE_LANCES || points > LITE_POINTS;
    // Beams (and their glows / flares) stay inside the room: never over the HUD margins.
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox - WALL, oy - WALL, ROOM_OUTER_W, ROOM_OUTER_H);
    ctx.clip();
    if (n > 0) this.drawLances(ctx, n, ox, oy - h, time);
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.n < 2 || b.kind === BK_LANCE) continue;
      this.drawThin(ctx, b, ox, oy - h, time);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) this.lances[i] = null;
  }

  /**
   * Draws segment `seg` of a beam at a width multiplier in `color`. A beam of even width is ONE stroked path; a
   * tapering / flaring one (grow, shrink, accelerate, decelerate) is ONE filled outline (see `outline`) — never a call
   * per trace step.
   */
  private strokeSeg(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, wMul: number, wAdd: number, color: string): void {
    const s0 = b.segStart[seg]!;
    const n = b.segLen[seg]!;
    if (n < 2) return;
    const px = b.px;
    const py = b.py;
    const pw = b.pw;
    let lo = pw[s0]!;
    let hi = lo;
    for (let k = 1; k < n; k++) {
      const v = pw[s0 + k]!;
      if (v < lo) lo = v;
      else if (v > hi) hi = v;
    }
    if ((hi - lo) * wMul <= 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, ((lo + hi) / 2) * wMul + wAdd);
      ctx.beginPath();
      ctx.moveTo(px[s0]! + ox, py[s0]! + oy);
      for (let k = 1; k < n; k++) ctx.lineTo(px[s0 + k]! + ox, py[s0 + k]! + oy);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    this.outline(ctx, b, seg, ox, oy, wMul, wAdd);
    ctx.fill();
  }

  /**
   * Adds segment `seg`'s outline to the current path (no beginPath / fill): the left edge out, a round tip, the right
   * edge back, a round tail — always in that order, so every outline has the same winding and a nonzero fill of many
   * of them is their union.
   */
  private outline(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, wMul: number, wAdd: number): void {
    const s0 = b.segStart[seg]!;
    const n = b.segLen[seg]!;
    if (n < 2) return;
    const px = b.px;
    const py = b.py;
    const pw = b.pw;
    const last = s0 + n - 1;
    let th = 0;
    let th0 = 0;
    for (let k = 0; k < n; k++) {
      th = heading(px, py, s0, last, s0 + k, th);
      if (k === 0) th0 = th;
      const r = Math.max(0.5, (pw[s0 + k]! * wMul + wAdd) / 2);
      const x = px[s0 + k]! + ox - Math.sin(th) * r;
      const y = py[s0 + k]! + oy + Math.cos(th) * r;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const rEnd = Math.max(0.5, (pw[last]! * wMul + wAdd) / 2);
    ctx.arc(px[last]! + ox, py[last]! + oy, rEnd, th + Math.PI / 2, th - Math.PI / 2, true);
    for (let k = n - 1; k >= 0; k--) {
      th = heading(px, py, s0, last, s0 + k, th);
      const r = Math.max(0.5, (pw[s0 + k]! * wMul + wAdd) / 2);
      ctx.lineTo(px[s0 + k]! + ox + Math.sin(th) * r, py[s0 + k]! + oy - Math.cos(th) * r);
    }
    const r0 = Math.max(0.5, (pw[s0]! * wMul + wAdd) / 2);
    ctx.arc(px[s0]! + ox, py[s0]! + oy, r0, th0 - Math.PI / 2, th0 + Math.PI / 2, true);
    ctx.closePath();
  }

  /** Adds a jagged lightning strand along a segment (1 px) to the current path, re-rolled every other frame. */
  private strandPath(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, amp: number, salt: number, stride: number): void {
    const s0 = b.segStart[seg]!;
    const n = b.segLen[seg]!;
    if (n < 2) return;
    const px = b.px;
    const py = b.py;
    const f = (this.frame >> 1) + salt * 17;
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
  }

  /** A strand of one segment on its own path (thin beams). */
  private strand(ctx: CanvasRenderingContext2D, b: Beam, seg: number, ox: number, oy: number, amp: number, salt: number, stride: number): void {
    ctx.beginPath();
    this.strandPath(ctx, b, seg, ox, oy, amp, salt, stride);
    ctx.stroke();
  }

  /** The colour a lance uses in pass `p` ('' = it skips the pass). */
  private passColor(p: number, i: number): string {
    const b = this.lances[i]!;
    const st = b.style;
    switch (p) {
      case PASS_WIDE:
        return this.lite ? '' : rgbCss(st ? st.beamGlow : LANCE_GLOW);
      case PASS_GLOW:
        return rgbCss(st ? st.beamGlow : LANCE_GLOW);
      case PASS_EDGE:
        // Lite: only the first few lances keep their bright edge.
        return this.lite && i >= LITE_EDGES ? '' : st ? st.beamEdge : '#bfe8ff';
      case PASS_CORE:
        return st ? st.beamCore : '#ffffff';
      case PASS_STRAND1:
        return '#e6f6ff';
      case PASS_STRAND2:
        return this.lite ? '' : '#8fd0ff';
      default:
        return this.lite ? '' : '#ffffff';
    }
  }

  /** A lance's alpha in pass `p` (quantised to 1/24 so a volley's lances share one path per pass). */
  private passAlpha(p: number, i: number, flick: number): number {
    const outro = this.outro[i]!;
    const k = this.crowd;
    const bright = 0.5 + 0.5 * k;
    let a: number;
    switch (p) {
      case PASS_WIDE:
        a = 0.16 * outro * flick * k;
        break;
      case PASS_GLOW:
        a = 0.3 * outro * k;
        break;
      case PASS_EDGE:
        a = 0.65 * outro * (0.4 + 0.6 * k);
        break;
      case PASS_CORE:
        // Lite (a wall of lances): the cores are thinner and a little dimmer, so the room under them still shows.
        a = Math.min(1, 0.95 * outro + 0.2) * bright * (this.lite ? 0.75 : 1);
        break;
      case PASS_STRAND1:
      case PASS_STRAND2:
        a = 0.9 * outro * bright;
        break;
      default:
        a = 0.6 * outro;
        break;
    }
    return Math.round(Math.min(1, a) * 24) / 24;
  }

  /** Adds lance `i`'s geometry for pass `p` to the current path (every segment it draws in that pass). */
  private passGeometry(ctx: CanvasRenderingContext2D, p: number, i: number, ox: number, oy: number): void {
    const b = this.lances[i]!;
    const wk = this.wk[i]!;
    const k = this.crowd;
    const jit = b.style ? b.style.beamJitter : 1;
    for (let s = 0; s < b.nseg; s++) {
      const depthK = s === 0 ? 1 : 0.6;
      switch (p) {
        case PASS_WIDE:
          this.outline(ctx, b, s, ox, oy, (1.6 + 1.2 * k) * wk * depthK, 4 * k);
          break;
        case PASS_GLOW:
          this.outline(ctx, b, s, ox, oy, 1.7 * wk * depthK, 2);
          break;
        case PASS_EDGE:
          if (!this.lite || s === 0) this.outline(ctx, b, s, ox, oy, 1.0 * wk * depthK, 0);
          break;
        case PASS_CORE:
          this.outline(ctx, b, s, ox, oy, (this.lite ? 0.26 : 0.42) * wk * depthK, 0.6);
          break;
        case PASS_STRAND1:
          this.strandPath(ctx, b, s, ox, oy, 0.9 * jit, 1, 2);
          break;
        case PASS_STRAND2:
          this.strandPath(ctx, b, s, ox, oy, 1.3 * jit, 2, 3);
          break;
        default:
          if (s === 0) this.strandPath(ctx, b, s, ox, oy, 1.7 * jit, 3, 4);
          break;
      }
    }
  }

  /**
   * The frame's lances: blast in (a fat white-hot flash), hold, then thin out and fade — drawn pass by pass, one path
   * per (colour, alpha) group per pass (see drawBeams).
   */
  private drawLances(ctx: CanvasRenderingContext2D, n: number, ox: number, oy: number, time: number): void {
    for (let i = 0; i < n; i++) {
      const b = this.lances[i]!;
      const t = b.age / Math.max(1e-6, b.life);
      const intro = b.age < 0.07 ? 1.7 - (b.age / 0.07) * 0.7 : 1;
      const outro = t > 0.7 ? Math.max(0.2, 1 - (t - 0.7) / 0.3) : 1;
      this.wk[i] = intro * outro;
      this.outro[i] = outro;
    }
    const flick = 0.85 + 0.15 * Math.sin(time * 60);
    const done = this.done;
    for (let p = 0; p < PASS_COUNT; p++) {
      const strand = p >= PASS_STRAND1;
      ctx.globalCompositeOperation = p === PASS_CORE ? 'source-over' : 'lighter';
      if (strand) ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) done[i] = 0;
      for (let i = 0; i < n; i++) {
        if (done[i]) continue;
        done[i] = 1;
        const color = this.passColor(p, i);
        if (color === '') continue;
        const alpha = this.passAlpha(p, i, flick);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        if (strand) ctx.strokeStyle = color;
        else ctx.fillStyle = color;
        ctx.beginPath();
        this.passGeometry(ctx, p, i, ox, oy);
        for (let j = i + 1; j < n; j++) {
          if (done[j] || this.passColor(p, j) !== color || this.passAlpha(p, j, flick) !== alpha) continue;
          done[j] = 1;
          this.passGeometry(ctx, p, j, ox, oy);
        }
        if (strand) ctx.stroke();
        else ctx.fill();
      }
    }
    // Muzzle flares and the flares where they bite into the wall.
    ctx.globalCompositeOperation = 'lighter';
    const fl = this.flare;
    for (let i = 0; i < n; i++) {
      const b = this.lances[i]!;
      const outro = this.outro[i]!;
      ctx.globalAlpha = Math.min(1, 0.8 * this.wk[i]!);
      ctx.drawImage(fl, Math.round(b.px[0]! + ox) - (fl.width >> 1), Math.round(b.py[0]! + oy) - (fl.height >> 1));
      if (b.endWall) {
        ctx.globalAlpha = 0.9 * outro * (0.85 + 0.15 * Math.sin(time * 60 + b.slot));
        ctx.drawImage(fl, Math.round(b.endX + ox) - (fl.width >> 1), Math.round(b.endY + oy) - (fl.height >> 1));
      }
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
    const glow = rgbCss(feather ? LANCE_GLOW : style ? style.beamGlow : '255,90,120');
    ctx.globalCompositeOperation = 'lighter';
    for (let s = 0; s < b.nseg; s++) {
      ctx.globalAlpha = (side ? 0.3 : 0.4) * fade;
      this.strokeSeg(ctx, b, s, ox, oy, 2.6, 1, glow);
    }
    ctx.lineWidth = 1;
    ctx.globalAlpha = fade;
    const core = feather ? '#e6f6ff' : style ? style.beamCore : '#ffe0e8';
    for (let s = 0; s < b.nseg; s++) {
      if (b.kind === BK_LASER && !side) this.strokeSeg(ctx, b, s, ox, oy, 0.6, 0, core);
      ctx.strokeStyle = core;
      ctx.lineWidth = 1;
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
    if (c <= 0) {
      // Recharging (the lance's beam is still out): with the stick held, the empty meter shows up with a dim fill
      // tracking the wait, so a re-press right after a release reads as "wait", not a dropped input.
      if (st.busy > 0 && p.firing && st.busyMax > 0) {
        ctx.fillStyle = '#0d0b14';
        ctx.fillRect(bx - 1, by - 1, 18, 5);
        ctx.fillStyle = '#23283a';
        ctx.fillRect(bx, by, 16, 3);
        ctx.fillStyle = lance ? '#2c4a6a' : '#5a4a22';
        ctx.fillRect(bx, by, Math.round(16 * Math.max(0, Math.min(1, 1 - st.busy / st.busyMax))), 3);
      }
      return;
    }
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
