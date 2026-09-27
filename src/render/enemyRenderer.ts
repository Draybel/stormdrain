/**
 * Draws enemies and everything they throw (ARCHITECTURE §8 layers):
 * - floor layer: creep puddles, shockwave rings, lob landing markers, burrow mounds, blink markers;
 * - shadows;
 * - enemies (two passes around the player for depth): spawn poof fade-in, idle/move/windup/air frames,
 *   telegraph blink + squash, hit flash, status tints + icons, champion outline + glow, phantom fade,
 *   split copies drawn smaller;
 * - enemy shots (dark outline + bright core + additive glow, allied ones pink), lobs with shadows,
 *   falling debris (a rock over a marked spot) and lightning strikes (a bolt in the last instant);
 * - bosses (sim/bosses): the pattern's pose, the phase's colour wash, a white flash + shudder on phase
 *   changes, a teleport fade, the charge telegraph line, landing / emerging markers, enemy beams
 *   (telegraph line → water jet / lightning / ink), and the death sequence's shudder and blinking.
 * Everything is a cached canvas; nothing allocates per frame.
 */

import { lerp } from '../engine/math';
import { BOSSES, ENEMIES } from '../content/registry';
import { ROOM_H, ROOM_W } from '../sim/constants';
import { STATUS_ICON_SPRITE } from '../content/sprites/combat';
import { DEBRIS_SPRITE } from '../content/sprites/specialRooms';
import type { SpriteAnim, SpriteDef } from '../sim/types';
import type { Enemy } from '../sim/enemies/enemy';
import { ST_COUNT, ST_FREEZE } from '../sim/enemies/status';
import { ENEMY_TUNING } from '../sim/tuning';
import { ENEMY_SHOT_STYLES } from '../sim/types';
import type { World } from '../sim/world';
import { ctx2d, makeCanvas } from './canvas';
import { drawShadow, fillPixelEllipse, glowSprite } from './pixel';
import { getFlash, getFlipped, getFrame, getSilhouette, getTinted, getTintedFlipped } from './sprites';

/** Status tint colours, index = ST_*. */
export const STATUS_COLORS = ['#7ee06a', '#ff9a40', '#a8ecff', '#9aaac0', '#ff8ad0', '#b48cff'] as const;
const FROZEN_TINT = '#a8ecff';

interface ShotLook {
  body: string;
  rim: string;
  hi: string;
  line: string;
  /** Additive glow rgb, or '' for none. */
  glow: string;
}

/** Looks per ENEMY_SHOT_STYLES entry (same order). */
const SHOT_LOOKS: readonly ShotLook[] = [
  { body: '#a8c050', rim: '#5e7426', hi: '#e4f0a0', line: '#141a08', glow: '168,192,80' }, // muck
  { body: '#6fc0f0', rim: '#3b78b8', hi: '#eaf8ff', line: '#0a1628', glow: '111,192,240' }, // water
  { body: '#d8cce6', rim: '#9d8cb0', hi: '#ffffff', line: '#221a30', glow: '216,204,230' }, // dust
  { body: '#f04a6a', rim: '#9a1f3a', hi: '#ffc0cc', line: '#1a060c', glow: '240,74,106' }, // ink
  { body: '#ffa040', rim: '#c0501e', hi: '#fff0b0', line: '#2a0e04', glow: '255,160,64' }, // ember
  { body: '#c8f4ff', rim: '#6fb3e0', hi: '#ffffff', line: '#0a1a2a', glow: '160,230,255' }, // ice
  { body: '#ff8ad0', rim: '#b04a8a', hi: '#ffe4f4', line: '#240818', glow: '255,138,208' }, // charm
];
const CHARM_STYLE = ENEMY_SHOT_STYLES.indexOf('charm');
const ICE_STYLE = ENEMY_SHOT_STYLES.indexOf('ice');
const WATER_STYLE = ENEMY_SHOT_STYLES.indexOf('water');

const shotCache = new Map<number, HTMLCanvasElement>();

/** A round shot: dark outline ring, rim, body, one bright highlight. Cached per (style, radius). */
function shotSprite(style: number, r: number): HTMLCanvasElement {
  const key = style * 16 + r;
  let c = shotCache.get(key);
  if (c) return c;
  const L = SHOT_LOOKS[style] ?? SHOT_LOOKS[0]!;
  const R = r + 1;
  const size = R * 2 + 1;
  c = makeCanvas(size, size);
  const ctx = ctx2d(c);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - R;
      const dy = y - R;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > R + 0.4) continue;
      let col: string;
      if (d > r + 0.4) col = L.line;
      else if (d > r - 0.8 || dx + dy > r * 0.9) col = L.rim;
      else col = L.body;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  ctx.fillStyle = L.hi;
  ctx.fillRect(R - Math.max(1, Math.round(r * 0.45)), R - Math.max(1, Math.round(r * 0.45)), r >= 3 ? 2 : 1, 1);
  shotCache.set(key, c);
  return c;
}

const shotGlowCache = new Map<number, HTMLCanvasElement | null>();

/** Additive halo for a shot style / radius (null for styles without glow). Cached by number key. */
function shotGlow(style: number, r: number): HTMLCanvasElement | null {
  const key = style * 16 + r;
  let g = shotGlowCache.get(key);
  if (g !== undefined) return g;
  const L = SHOT_LOOKS[style];
  g = L && L.glow ? glowSprite(r + 4, L.glow, 0.45) : null;
  shotGlowCache.set(key, g);
  return g;
}

const puddleCache = new Map<number, HTMLCanvasElement>();

/**
 * Flat creep puddle (2:1 ellipse), cached per (style, radius, rim). `friendly`: an allied puddle that keeps
 * its elemental look (a synergy's burning oil, spores, frost) gets the friendly pink rim instead of its own.
 */
function puddleSprite(style: number, r: number, friendly = false): HTMLCanvasElement {
  const key = style * 64 + r + (friendly ? 4096 : 0);
  let c = puddleCache.get(key);
  if (c) return c;
  const L = SHOT_LOOKS[style] ?? SHOT_LOOKS[0]!;
  const ry = Math.max(2, Math.round(r / 2));
  c = makeCanvas(r * 2 + 3, ry * 2 + 3);
  const ctx = ctx2d(c);
  ctx.fillStyle = friendly ? SHOT_LOOKS[CHARM_STYLE]!.rim : L.rim;
  ctx.globalAlpha = 0.75;
  fillPixelEllipse(ctx, r + 1, ry + 1, r, ry);
  ctx.fillStyle = L.body;
  ctx.globalAlpha = 0.6;
  fillPixelEllipse(ctx, r + 1, ry + 1, Math.max(1, r - 1), Math.max(1, ry - 1));
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = L.hi;
  ctx.fillRect(r - 1, ry, 2, 1);
  ctx.fillRect(r + 3, ry + 1, 1, 1);
  puddleCache.set(key, c);
  return c;
}

const moundCache: HTMLCanvasElement[] = [];

/** Dirt mound of a burrower (cached per radius). */
function moundSprite(r: number): HTMLCanvasElement {
  let c = moundCache[r];
  if (c) return c;
  const w = r * 2 + 4;
  c = makeCanvas(w, 7);
  const ctx = ctx2d(c);
  ctx.fillStyle = 'rgba(4,5,10,0.4)';
  fillPixelEllipse(ctx, w / 2, 4, r + 1, 2);
  ctx.fillStyle = '#5a4636';
  fillPixelEllipse(ctx, w / 2, 3, r, 2);
  ctx.fillStyle = '#7e664e';
  fillPixelEllipse(ctx, w / 2 - 1, 2, Math.max(1, r - 2), 1);
  ctx.fillStyle = '#a08466';
  ctx.fillRect(Math.floor(w / 2) - 2, 1, 2, 1);
  ctx.fillRect(Math.floor(w / 2) + 2, 3, 1, 1);
  moundCache[r] = c;
  return c;
}

/** Ellipse ring of 1-2 px dots (shockwaves, markers). */
function ellipseRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, thick: boolean): void {
  const n = r < 8 ? 12 : r < 20 ? 20 : 32;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.5), thick ? 2 : 1, 1);
  }
}

/** Cosmetic hover height of flyers (px). */
function hover(e: Enemy, time: number): number {
  if (!e.flying) return 0;
  return e.boss ? 4 + Math.sin(time * 2 + e.uid) * 2 : 7 + Math.sin(time * 4 + e.uid) * 1.5;
}

/** Pixels from a boss sprite's anchor down to its bottom edge (where its shadow falls). */
function footOffset(e: Enemy): number {
  const s = e.sprite;
  if (!s || !e.boss) return 0;
  return (s.h - 1 - (s.anchorY ?? s.h - 1)) * e.scale;
}

/** A boss's animation for its current state (the pattern's pose, else by movement). */
function bossAnim(s: SpriteDef, e: Enemy, z: number): SpriteAnim | undefined {
  const anims = s.anims;
  if (!anims) return undefined;
  const b = e.boss!;
  const name = e.dying ? 'hurt' : b.anim;
  if (name) {
    const a = anims[name] ?? (name === 'charge' ? anims.move : name === 'slam' || name === 'roar' || name === 'hurt' ? anims.windup : undefined);
    if (a) return a;
  }
  if (z > 0.5 && anims.air) return anims.air;
  if (e.teleT > 0 && anims.windup) return anims.windup;
  if (e.moving && anims.move) return anims.move;
  return anims.idle;
}

/** Beam colours per look (0 water jet, 1 lightning, 2 ink): glow rgb prefix, core, centre. */
const BEAM_LOOKS = [
  { glow: 'rgba(111,192,240,0.3)', core: '#8fd0ff', hot: '#ffffff' },
  { glow: 'rgba(255,230,120,0.3)', core: '#fff08a', hot: '#ffffff' },
  { glow: 'rgba(240,74,106,0.3)', core: '#f04a6a', hot: '#ffd0da' },
] as const;

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/** A jagged lightning bolt from near the top of the room down onto (x, y). */
function boltPath(ctx: CanvasRenderingContext2D, x: number, y: number, seed: number): void {
  ctx.beginPath();
  const top = 44;
  ctx.moveTo(Math.round(x + (hash(seed) - 0.5) * 16), top);
  const steps = 6;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const px = x + (k === steps ? 0 : (hash(seed + k * 7) - 0.5) * 14 * (1 - t));
    ctx.lineTo(Math.round(px), Math.round(top + (y - top) * t));
  }
  ctx.stroke();
}

export class EnemyRenderer {
  private readonly championGlow = new Map<string, HTMLCanvasElement>();

  /** Rasterise enemy frames ahead of time (first appearance never hitches). */
  prepare(): void {
    for (const d of [...ENEMIES.values(), ...BOSSES.values()]) {
      if (typeof d.sprite === 'string') continue;
      for (let f = 0; f < d.sprite.frames.length; f++) {
        getFrame(d.sprite, f);
        getFlash(d.sprite, f);
        getFlipped(d.sprite, f);
      }
    }
    for (let s = 0; s < SHOT_LOOKS.length; s++) for (let r = 2; r <= 4; r++) shotSprite(s, r);
  }

  private glowFor(color: string): HTMLCanvasElement {
    let g = this.championGlow.get(color);
    if (!g) {
      const n = parseInt(color.slice(1), 16);
      g = glowSprite(12, `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`, 0.5);
      this.championGlow.set(color, g);
    }
    return g;
  }

  /** Floor layer: creep, shockwaves, lob landing markers, burrow mounds, blink destinations. */
  drawFloor(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number, time: number): void {
    const creep = world.creep;
    for (let i = 0; i < creep.count; i++) {
      const c = creep.items[i]!;
      // Allied puddles are pink; elemental ones (not plain water) keep their look with a pink rim.
      const elemental = c.allied && c.style !== WATER_STYLE && c.style !== CHARM_STYLE;
      const img = puddleSprite(c.allied && !elemental ? CHARM_STYLE : c.style, Math.round(c.r), elemental);
      const fade = Math.min(1, c.life / (c.maxLife * 0.25));
      ctx.globalAlpha = fade;
      ctx.drawImage(img, Math.round(c.x + ox - img.width / 2), Math.round(c.y + oy - img.height / 2));
    }
    ctx.globalAlpha = 1;

    const waves = world.waves;
    for (let i = 0; i < waves.count; i++) {
      const v = waves.items[i]!;
      const k = v.rad / v.maxRad;
      ctx.globalAlpha = 0.9 - k * 0.6;
      ctx.fillStyle = v.allied ? '#ff8ad0' : '#bfe6ff';
      ellipseRing(ctx, v.x + ox, v.y + oy, v.rad, true);
      ctx.globalAlpha = 0.5 - k * 0.35;
      ctx.fillStyle = '#5c7a9a';
      if (v.rad > 4) ellipseRing(ctx, v.x + ox, v.y + oy + 1, v.rad - 3, false);
    }
    ctx.globalAlpha = 1;

    // Lob landing markers: a pulsing ring that firms up as the glob comes down (debris: a double ring;
    // lightning: a crackling yellow one).
    const shots = world.enemyShots;
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (!s.lob) continue;
      const t = Math.min(1, s.age / s.air);
      ctx.globalAlpha = 0.35 + 0.5 * t;
      const blink = (Math.floor(time * 10) & 1) === 0;
      if (s.fall === 2) ctx.fillStyle = blink ? '#fff27a' : '#bfe8ff';
      else ctx.fillStyle = s.allied ? '#ff8ad0' : blink ? '#ff5a4a' : '#ffb04a';
      const r = Math.max(3, s.splash * (1.2 - 0.4 * t));
      ellipseRing(ctx, s.tx + ox, s.ty + oy, r, s.fall > 0);
      if (s.fall > 0 && r > 5) ellipseRing(ctx, s.tx + ox, s.ty + oy, r * 0.45, false);
    }
    ctx.globalAlpha = 1;

    const enemies = world.enemies;
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i]!;
      if (e.dead) continue;
      if (e.boss) this.drawBossFloor(ctx, e, alpha, ox, oy, time);
      if (e.burrowed) {
        const x = lerp(e.prevX, e.x, alpha) + ox;
        const y = lerp(e.prevY, e.y, alpha) + oy;
        const rising = e.teleT > 0;
        const jx = rising ? ((time * 40) | 0) % 3 - 1 : 0;
        const img = moundSprite(Math.max(3, Math.round(e.r * (rising ? 1.25 : 1))));
        ctx.drawImage(img, Math.round(x - img.width / 2) + jx, Math.round(y - img.height / 2));
      } else if (e.cfg.move.kind === 'teleport' && e.mode === 1) {
        // Where it is about to reappear.
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(time * 20);
        ctx.fillStyle = '#c9a0ff';
        ellipseRing(ctx, e.tx + ox, e.ty + oy, e.r + 2, false);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawShadows(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number): void {
    const enemies = world.enemies;
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i]!;
      if (e.dead || e.burrowed || e.hidden) continue;
      const x = lerp(e.prevX, e.x, alpha) + ox;
      const y = lerp(e.prevY, e.y, alpha) + oy;
      const z = lerp(e.prevZ, e.z, alpha);
      const w = Math.max(5, Math.round(e.r * 2.3 * (e.flying ? 0.75 : 1) * (z > 4 ? 0.8 : 1)));
      drawShadow(ctx, x, y + 1 + (e.flying ? 0 : footOffset(e) * 0.5), w);
    }
    const shots = world.enemyShots;
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.fall === 2) continue;
      const size = s.fall === 1 ? 3 + Math.round(5 * Math.min(1, s.age / s.air)) : s.lob ? 6 : 4;
      drawShadow(ctx, lerp(s.prevX, s.x, alpha) + ox, lerp(s.prevY, s.y, alpha) + oy + 1, size);
    }
  }

  /**
   * Enemies in two passes for depth against the player: pass 0 = walkers above (behind) the player,
   * pass 1 = walkers below + everything in the air.
   */
  drawEnemies(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number, time: number, pass: 0 | 1, playerY: number): void {
    const enemies = world.enemies;
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i]!;
      if (e.dead || e.burrowed) continue;
      const y = lerp(e.prevY, e.y, alpha);
      const front = e.flying || e.z > 2 || y > playerY;
      if ((pass === 1) !== front) continue;
      this.drawEnemy(ctx, e, lerp(e.prevX, e.x, alpha) + ox, y + oy, lerp(e.prevZ, e.z, alpha), time);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, x: number, y: number, z: number, time: number): void {
    const s = e.sprite;
    if (!s) {
      ctx.fillStyle = '#e0515a';
      fillPixelEllipse(ctx, x, y - e.r, e.r, e.r);
      return;
    }
    const st = e.status;
    const frozen = st.t[ST_FREEZE]! > 0;

    const b = e.boss;
    let a = 1;
    if (e.spawnT > 0) a = Math.max(0.15, 1 - e.spawnT / ENEMY_TUNING.spawnTime);
    if (e.faded) a *= 0.28;
    if (e.hidden) a *= b ? 0 : 0.3 + 0.3 * Math.sin(time * 30);
    if (e.cfg.move.kind === 'teleport' && e.mode === 1 && e.teleMax > 0) a *= Math.max(0.2, e.teleT / e.teleMax);
    if (b) a *= b.fade;
    if (a <= 0.01) return;
    // Bosses shudder while they roar (phase change) and while they die.
    if (b && (b.invulnT > 0 || e.dying)) {
      const k = e.dying ? 2 : 1;
      const ph = ((time * 60) | 0) % 3;
      x += ph === 0 ? k : ph === 1 ? -k : 0;
    }

    const anims = s.anims;
    let anim = anims?.idle;
    if (b) {
      anim = bossAnim(s, e, z);
    } else if (anims) {
      if (z > 0.5 && anims.air) anim = anims.air;
      else if (e.teleT > 0 && anims.windup) anim = anims.windup;
      else if (e.moving && anims.move) anim = anims.move;
    }
    let frame = 0;
    if (anim && anim.frames.length > 0) {
      const t = frozen ? 0 : time + e.uid * 0.37;
      frame = anim.frames[Math.floor(t * anim.fps) % anim.frames.length]!;
    }

    // Squash & stretch: telegraph crouch, hit jolt, stretch in the air, rise-in on spawn.
    let sx = e.scale;
    let sy = e.scale;
    if (e.teleT > 0 && e.teleMax > 0 && !anims?.windup) {
      const k = 1 - e.teleT / e.teleMax;
      sx *= 1 + 0.14 * k;
      sy *= 1 - 0.14 * k;
    }
    if (e.flash > ENEMY_TUNING.hitFlash - 0.06 && !frozen) {
      sx *= 1.12;
      sy *= 0.88;
    }
    if (z > 0.5 && !anims?.air) {
      sx *= 0.9;
      sy *= 1.12;
    }
    if (e.spawnT > 0) sy *= Math.max(0.3, 1 - e.spawnT / ENEMY_TUNING.spawnTime);
    const w = Math.max(1, Math.round(s.w * sx));
    const h = Math.max(1, Math.round(s.h * sy));
    const flip = e.face < 0;
    const ax = s.anchorX ?? Math.floor(s.w / 2);
    const ay = s.anchorY ?? s.h - 1;
    const dx = Math.round(x - (flip ? s.w - 1 - ax : ax) * (w / s.w));
    const dy = Math.round(y - z - hover(e, time) - ay * (h / s.h));

    // Hit = solid white flash; telegraph = a softer white blink over the (wind-up) pose. A dying boss
    // blinks white; a boss that just changed phase flashes.
    const flash = e.flash > 0 || (!!b && ((e.dying && (Math.floor(time * 12) & 1) === 0) || b.phaseT < 0.18));
    const blink = !flash && e.teleT > 0 && (Math.floor(time * 16) & 1) === 0;

    // Champion: coloured glow + 1 px outline.
    const ch = e.champion;
    if (ch && a > 0.2) {
      const g = this.glowFor(ch.color);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * (0.55 + 0.2 * Math.sin(time * 5 + e.uid));
      ctx.drawImage(g, Math.round(dx + w / 2 - g.width / 2), Math.round(dy + h / 2 - g.height / 2));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = a;
      const sil = getSilhouette(s, frame, ch.color, flip);
      ctx.drawImage(sil, dx - 1, dy, w, h);
      ctx.drawImage(sil, dx + 1, dy, w, h);
      ctx.drawImage(sil, dx, dy - 1, w, h);
      ctx.drawImage(sil, dx, dy + 1, w, h);
    }

    ctx.globalAlpha = a;
    let img: HTMLCanvasElement;
    if (flash) img = flip ? getFlipped(s, frame, true) : getFlash(s, frame);
    else if (frozen) img = flip ? getTintedFlipped(s, frame, FROZEN_TINT) : getTinted(s, frame, FROZEN_TINT);
    else img = flip ? getFlipped(s, frame) : getFrame(s, frame);
    ctx.drawImage(img, dx, dy, w, h);

    // A boss's phase colour: a pulsing wash that ramps in after the phase change.
    if (b && !flash) {
      const tint = b.c.phases[b.phase]!.tint;
      if (tint) {
        ctx.globalAlpha = a * Math.min(1, b.phaseT / 0.6) * (0.3 + 0.12 * Math.sin(time * 5 + e.uid));
        ctx.drawImage(flip ? getTintedFlipped(s, frame, tint) : getTinted(s, frame, tint), dx, dy, w, h);
      }
    }
    // Status tint wash (dominant status; frozen is already fully tinted).
    if (!flash && !frozen && st.mask !== 0) {
      const tint = dominantTint(st.mask);
      if (tint) {
        ctx.globalAlpha = a * (0.32 + 0.1 * Math.sin(time * 8));
        ctx.drawImage(flip ? getTintedFlipped(s, frame, tint) : getTinted(s, frame, tint), dx, dy, w, h);
      }
    }
    if (blink) {
      ctx.globalAlpha = a * 0.55;
      ctx.drawImage(flip ? getFlipped(s, frame, true) : getFlash(s, frame), dx, dy, w, h);
    }
    ctx.globalAlpha = 1;

    // Tiny status icons above the head (blinking when about to wear off).
    if (st.mask !== 0 && a > 0.2) {
      let n = 0;
      for (let k = 0; k < ST_COUNT; k++) if (st.t[k]! > 0) n++;
      let ix = Math.round(x - (n * 6 - 1) / 2);
      const iy = dy - 7;
      for (let k = 0; k < ST_COUNT; k++) {
        const t = st.t[k]!;
        if (t <= 0) continue;
        if (t < 0.6 && (Math.floor(time * 10) & 1) === 1) {
          ix += 6;
          continue;
        }
        ctx.drawImage(getFrame(STATUS_ICON_SPRITE, k), ix, iy);
        ix += 6;
      }
    }
  }

  /** A boss's floor telegraphs: the charge line and the landing / emerging marker. */
  private drawBossFloor(ctx: CanvasRenderingContext2D, e: Enemy, alpha: number, ox: number, oy: number, time: number): void {
    const b = e.boss!;
    const x = lerp(e.prevX, e.x, alpha) + ox;
    const y = lerp(e.prevY, e.y, alpha) + oy;
    if (b.tellLine) {
      // Dashes marching along the charge direction to the room's edge.
      ctx.globalAlpha = 0.45 + 0.35 * Math.sin(time * 18);
      ctx.fillStyle = '#ff5a4a';
      const off = (time * 60) % 8;
      for (let d = e.r + off; d < 260; d += 8) {
        const px = Math.round(x + b.tellX * d);
        const py = Math.round(y + b.tellY * d);
        if (px < ox || px > ox + ROOM_W || py < oy || py > oy + ROOM_H) break;
        ctx.fillRect(px - 1, py - 1, 3, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (b.markT > 0) {
      const mx = b.markX + ox;
      const my = b.markY + oy;
      ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 16);
      ctx.fillStyle = (Math.floor(time * 10) & 1) === 0 ? '#ff5a4a' : '#ffb04a';
      ellipseRing(ctx, mx, my, e.r + 3, true);
      ellipseRing(ctx, mx, my, Math.max(3, (e.r + 3) * (0.3 + 0.5 * ((time * 2) % 1))), false);
      ctx.globalAlpha = 1;
    }
  }

  private readonly boltGlow = glowSprite(10, '255,240,160', 0.8);

  /** A lightning strike: nothing but its marker until the last moment, then a bolt and a flash. */
  private drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, time: number): void {
    if (t < 0.82) return;
    const seed = Math.floor(time * 30) + Math.round(x);
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,240,140,0.55)';
    ctx.lineWidth = 4;
    boltPath(ctx, x, y, seed);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    boltPath(ctx, x, y, seed);
    ctx.globalAlpha = 0.5 * ((t - 0.82) / 0.18);
    const g = this.boltGlow;
    ctx.drawImage(g, Math.round(x - g.width / 2), Math.round(y - g.height / 2));
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Enemy beams (bosses): a thin flickering telegraph, then the damaging beam (additive). */
  drawBeams(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number, time: number): void {
    const enemies = world.enemies;
    for (let i = 0; i < enemies.count; i++) {
      const e = enemies.items[i]!;
      const b = e.boss;
      if (!b || e.dead) continue;
      for (let k = 0; k < 2; k++) {
        const bm = b.beams[k]!;
        if (!bm.on) continue;
        const L = BEAM_LOOKS[bm.look] ?? BEAM_LOOKS[0];
        const x0 = lerp(e.prevX, e.x, alpha) + ox;
        const y0 = lerp(e.prevY, e.y, alpha) + oy - 4;
        const x1 = x0 + Math.cos(bm.angle) * bm.len;
        const y1 = y0 + Math.sin(bm.angle) * bm.len;
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        if (bm.tele) {
          ctx.globalAlpha = 0.35 + 0.35 * Math.sin(time * 30);
          ctx.strokeStyle = L.core;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          const wob = 1 + 0.15 * Math.sin(time * 40);
          ctx.strokeStyle = L.glow;
          ctx.lineWidth = (bm.width + 6) * wob;
          ctx.stroke();
          ctx.globalAlpha = 0.85;
          ctx.strokeStyle = L.core;
          ctx.lineWidth = bm.width * wob;
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = L.hot;
          ctx.lineWidth = Math.max(1, bm.width / 3);
          if (bm.look === 1) {
            // Lightning: a jagged strand along the beam.
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            const n = Math.max(2, Math.floor(bm.len / 10));
            const nx = -Math.sin(bm.angle);
            const ny = Math.cos(bm.angle);
            for (let j = 1; j <= n; j++) {
              const t = j / n;
              const jit = j === n ? 0 : (hash(j * 13 + Math.floor(time * 24)) - 0.5) * bm.width;
              ctx.lineTo(x0 + (x1 - x0) * t + nx * jit, y0 + (y1 - y0) * t + ny * jit);
            }
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }

  drawShots(ctx: CanvasRenderingContext2D, world: World, alpha: number, ox: number, oy: number, time: number): void {
    const shots = world.enemyShots;
    if (shots.count === 0) return;
    // Glow pass (additive), then bodies.
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.fall > 0) continue;
      const style = s.allied && s.style !== ICE_STYLE ? CHARM_STYLE : s.style;
      const g = shotGlow(style, Math.max(1, Math.min(8, Math.round(s.r))));
      if (!g) continue;
      const x = Math.round(lerp(s.prevX, s.x, alpha) + ox);
      const y = Math.round(lerp(s.prevY, s.y, alpha) + oy - lerp(s.prevZ, s.z, alpha));
      ctx.drawImage(g, x - (g.width >> 1), y - (g.height >> 1));
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < shots.count; i++) {
      const s = shots.items[i]!;
      if (s.fall === 2) {
        this.drawBolt(ctx, s.tx + ox, s.ty + oy, s.age / s.air, time);
        continue;
      }
      if (s.fall === 1) {
        const img = getFrame(DEBRIS_SPRITE, (s.owner + i) & 1);
        const x = Math.round(lerp(s.prevX, s.x, alpha) + ox);
        const y = Math.round(lerp(s.prevY, s.y, alpha) + oy - lerp(s.prevZ, s.z, alpha));
        ctx.drawImage(img, x - (img.width >> 1), y - img.height + 2);
        continue;
      }
      const style = s.allied && s.style !== ICE_STYLE ? CHARM_STYLE : s.style;
      const r = Math.max(1, Math.min(8, Math.round(s.r)));
      const img = shotSprite(style, r);
      const x = Math.round(lerp(s.prevX, s.x, alpha) + ox);
      const wob = s.lob ? 0 : Math.round(Math.sin(time * 14 + i) * 0.5);
      const y = Math.round(lerp(s.prevY, s.y, alpha) + oy - lerp(s.prevZ, s.z, alpha)) + wob;
      // Fizzling decelerating shots fade in their last moments.
      if (s.age > s.life - 0.3) ctx.globalAlpha = Math.max(0.2, (s.life - s.age) / 0.3);
      ctx.drawImage(img, x - (img.width >> 1), y - (img.height >> 1));
      ctx.globalAlpha = 1;
    }
  }
}

/** The tint shown for a status mask: charm > fear > burn > poison > slow (freeze handled separately). */
function dominantTint(mask: number): string | null {
  if (mask & (1 << 4)) return STATUS_COLORS[4];
  if (mask & (1 << 5)) return STATUS_COLORS[5];
  if (mask & (1 << 1)) return STATUS_COLORS[1];
  if (mask & (1 << 0)) return STATUS_COLORS[0];
  if (mask & (1 << 3)) return STATUS_COLORS[3];
  return null;
}
