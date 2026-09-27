/**
 * Old Thunderhead (final boss, Ending 1) — a colossal, grumpy old storm cloud with bushy brows, a bulb
 * of a nose and a droopy cloud moustache. Painted with ./paint.ts (1 px outline, lit from the top-left).
 * One sprite per phase (the boss hook swaps them when a phase begins), 56×50, the same anchor:
 *
 *   phase 1  Brooding          grey-blue, white eyes, a drizzle and one small bolt dangling
 *   phase 2  Gathering Storm   darker and towering (an anvil top), glowing yellow eyes, sparks
 *                              crackling out of its sides, heavier rain, two bolts
 *   phase 3  The Last Downpour near-black, cracked with glowing lightning veins, a crown of bolts,
 *                              white-hot eyes, a cloudburst of rain and forked lightning
 *
 * Frames: 0-1 idle (breathing), 2-3 move (leaning), 4 windup (squint + puffed cheeks, inhaling),
 * 5 roar (mouth open, bolts flaring), 6 hurt (eyes screwed shut, deflating — the death sequence).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const W = 56;
const H = 50;
const ANCHOR_Y = 29;

const FACE_IDLE = 0;
const FACE_INHALE = 1;
const FACE_ROAR = 2;
const FACE_HURT = 3;

interface Pose {
  /** Phase look 0-2. */
  ph: number;
  /** Breathing puff (0/1). */
  breathe: number;
  face: number;
  /** Rain frame. */
  rain: number;
  /** Lean (moving): -1 / 0 / 1. */
  lean: number;
}

/** Cloud puffs [x, y, r] — phase 1, then the towering storm of phases 2-3. */
const PUFFS_1: readonly (readonly [number, number, number])[] = [
  [9, 28, 7],
  [18, 20, 10],
  [29, 15, 12],
  [40, 19, 10],
  [48, 27, 7],
  [16, 30, 8],
  [40, 30, 8],
  [28, 27, 13],
];
const PUFFS_2: readonly (readonly [number, number, number])[] = [
  [5, 29, 5],
  [51, 28, 5],
  [9, 26, 8],
  [23, 9, 9],
  [35, 7, 9],
  [17, 18, 10],
  [29, 14, 12],
  [41, 17, 11],
  [48, 25, 8],
  [15, 30, 9],
  [41, 30, 9],
  [28, 27, 14],
];

/** Flat cloud base: nothing of the body below this row. */
const BASE_Y = [38, 39, 40];

function bolt(p: Pix, x: number, y: number, len: number, dir: number, hot = 'Y', edge = 'y'): void {
  // A zigzag bolt going down (dir 1) or up (dir -1).
  let cx = x;
  let cy = y;
  let side = 1;
  while (Math.abs(cy - y) < len) {
    const nx = cx + side * 2;
    const ny = cy + dir * 3;
    p.line(cx, cy, nx, ny, edge);
    p.set(cx, cy, hot);
    cx = nx;
    cy = ny;
    side = -side;
  }
  p.set(cx, cy, hot);
}

function cloud(pose: Pose): string[] {
  const p = new Pix(W, H);
  const puffs = pose.ph === 0 ? PUFFS_1 : PUFFS_2;
  const base = BASE_Y[pose.ph]!;
  const swell = (pose.breathe ? 0.6 : 0) + (pose.face === FACE_INHALE ? 0.7 : 0) + (pose.face === FACE_HURT ? -0.8 : 0);
  // Phases 2-3 tower up into an anvil sheared off downwind (to the right), thinning into wisps.
  if (pose.ph > 0) {
    const lift = pose.breathe ? 0 : 1;
    for (let x = 16; x <= 55; x++) {
      const f = (x - 16) / 39;
      const th = 7 - 5.5 * f + (hash2(x >> 1, 3, pose.breathe) - 0.5) * 1.4;
      const top = Math.round(2 + lift + f * 2 + Math.sin(x * 0.7) * 0.6);
      const bot = Math.round(top + th);
      for (let y = Math.max(0, top); y <= bot; y++) if (p.get(x + pose.lean, y) === '.') p.set(x + pose.lean, y, 'b');
    }
  }
  // The body: the union of the puffs...
  const inPuff = (px: number, py: number, k: number): boolean => {
    const [x0, y0, r0] = puffs[k]!;
    const dx = px + 0.5 - (x0 + pose.lean * (y0 < 22 ? 1 : 0));
    const dy = py + 0.5 - y0;
    const r = r0 + swell;
    return dx * dx + dy * dy <= r * r;
  };
  for (let k = 0; k < puffs.length; k++) p.map((px, py, c) => (py <= base && c === '.' && inPuff(px, py, k) ? 'b' : null));
  // ...lit from above (a bright rim on every bump of the top edge), shadowed underneath...
  const body = p.copy();
  p.map((x, y, c) => {
    if (c === '.' || c === 'c' || c === 'd') return null;
    if (!body.on(x, y - 1) || !body.on(x - 1, y - 1)) return 'd';
    if (!body.on(x, y - 2) || !body.on(x, y - 3) || !body.on(x - 2, y - 2)) return 'c';
    if (y >= base - 1) return y === base ? 'D' : 'a';
    if (!body.on(x + 1, y + 1) || !body.on(x + 2, y + 2)) return 'a';
    return null;
  });
  // ...with a crease under each upper puff where it overlaps the ones in front, and a soft lit
  // rim on the bumps of the upper puffs (cumulus lumps).
  for (let k = 0; k < puffs.length - 1; k++) {
    const [x0, y0, r0] = puffs[k]!;
    const cx = x0 + pose.lean * (y0 < 22 ? 1 : 0);
    const r = r0 + swell;
    for (let a = 0.15; a < Math.PI - 0.15; a += 0.04) {
      const px = Math.floor(cx + Math.cos(a) * r);
      const py = Math.floor(y0 + Math.sin(a) * r);
      if (p.get(px, py) === 'b' && p.get(px, py + 1) === 'b' && p.get(px, py - 1) === 'b') {
        p.set(px, py, 'a');
        if (p.get(px, py + 1) === 'b' && a > 0.5 && a < Math.PI - 0.5) p.set(px, py + 1, 'c');
      }
    }
  }
  // A little texture so it reads as vapour, not plastic.
  p.map((x, y, c) => (c === 'b' && hash2(x, y, 5 + pose.breathe) > 0.95 ? 'c' : null));
  // The face sits on a calm, even patch.
  const fy = pose.ph === 0 ? 27 : 26;
  p.map((x, y, c) => {
    if (c !== 'a' && c !== 'c') return null;
    const dx = (x + 0.5 - 28) / 15;
    const dy = (y + 0.5 - fy) / 10;
    return dx * dx + dy * dy < 1 && y < base - 2 ? 'b' : null;
  });

  // Phase 3: glowing lightning veins crack across the body (kept off the face).
  if (pose.ph === 2) {
    const veins: readonly (readonly number[])[] = [
      [3, 28, 7, 25, 6, 21, 11, 17, 10, 13],
      [52, 27, 48, 23, 50, 19, 45, 15],
      [18, 8, 22, 12, 20, 15],
      [40, 7, 36, 11, 39, 14],
      [7, 35, 11, 32, 14, 36],
      [49, 35, 45, 32, 42, 36],
    ];
    for (const v of veins) {
      for (let i = 2; i < v.length; i += 2) {
        p.line(v[i - 2]!, v[i - 1]!, v[i]!, v[i + 1]!, 'y');
        p.line(v[i - 2]! + 1, v[i - 1]!, v[i]! + 1, v[i + 1]!, 'g');
      }
      for (let i = 0; i < v.length; i += 2) p.set(v[i]!, v[i + 1]!, 'Y');
    }
    // A crown of bolts on top.
    bolt(p, 20, 3, 5, -1);
    bolt(p, 35, 2, 4, -1);
    bolt(p, 9, 12, 5, -1);
    bolt(p, 47, 11, 5, -1);
  }
  // Phase 2: sparks crackling out of its sides.
  if (pose.ph === 1) {
    bolt(p, 2, 21 + pose.rain, 4, -1);
    bolt(p, 53, 18 - pose.rain, 4, -1);
  }

  // ── The face: a grumpy old man of a cloud ──
  const ey = pose.ph === 0 ? 24 : 23;
  const exL = 21;
  const exR = 35;
  const bl = pose.face === FACE_INHALE ? 1 : pose.face === FACE_ROAR ? -1 : pose.face === FACE_HURT ? 1 : 0;
  // Sunken eye sockets.
  p.ellipse(exL, ey + 0.5, 4.2, 3.4, 'a').ellipse(exR, ey + 0.5, 4.2, 3.4, 'a');
  const eye = (ex: number, dir: number): void => {
    if (pose.face === FACE_HURT) {
      // Screwed shut: > <
      p.line(ex - 2 * dir, ey - 2, ex + 1 * dir, ey, 'k').line(ex + 1 * dir, ey, ex - 2 * dir, ey + 2, 'k');
      return;
    }
    const ry = pose.face === FACE_INHALE ? 1 : pose.face === FACE_ROAR ? 3 : 2.4;
    if (pose.ph === 0) {
      // Beady dark eyes with a glint.
      p.ellipse(ex, ey + 0.5, 2.2, ry, 'k');
      if (ry > 1.5) p.set(ex - 1, ey - 1, 'W');
    } else if (pose.ph === 1) {
      p.ellipse(ex, ey + 0.5, 2.8, ry, 'e');
      p.ellipse(ex, ey + 0.5, 1.5, Math.max(0.7, ry - 1), 'E');
    } else {
      p.ellipse(ex, ey + 0.5, 3, ry + 0.3, 'e');
      p.ellipse(ex, ey + 0.5, 2, Math.max(0.8, ry - 0.5), 'Y');
    }
  };
  eye(exL, 1);
  eye(exR, -1);
  // Bushy white brows, knitted into an angry V.
  const browL = [15, -6, 2.1, 17.5, -5, 2.4, 20.5, -4, 2.5, 23.5, -2.6, 2.1];
  for (let i = 0; i < browL.length; i += 3) {
    const bx = browL[i]!;
    const by = ey + browL[i + 1]! + bl;
    const br = browL[i + 2]!;
    p.disc(bx, by, br, 'm').disc(56 - bx, by, br, 'm');
  }
  p.map((x, y, c) => (c === 'm' && y >= ey - 3 + bl && Math.abs(x - 28) > 5 ? 'n' : null));
  // Puffed cheeks (inhaling).
  if (pose.face === FACE_INHALE) {
    p.disc(14, ey + 7, 5, 'c').disc(42, ey + 7, 5, 'c');
    p.disc(13, ey + 6, 2, 'd').disc(41, ey + 6, 2, 'd');
  }
  // A bulb of a nose.
  p.disc(28, ey + 3.5, 2.8, 'c').set(27, ey + 2, 'd').set(26, ey + 3, 'd').set(29, ey + 5, 'b');
  // The mouth, under a droopy moustache.
  const my = ey + 10;
  if (pose.face === FACE_ROAR) {
    p.ellipse(28, my + 1, 5.5, 4, 'M');
    p.ellipse(28, my + 3, 3, 1.4, 't');
    if (pose.ph === 2) p.ellipse(28, my, 2.6, 1.4, 'y');
  } else if (pose.face === FACE_INHALE) {
    p.ellipse(28, my, 1.6, 1.6, 'M');
  } else if (pose.face === FACE_HURT) {
    for (let x = 24; x <= 32; x++) p.set(x, my + ((x & 1) === 0 ? 1 : 0), 'M');
  } else {
    p.line(24, my + 2, 26, my, 'M').line(26, my, 30, my, 'M').line(30, my, 32, my + 2, 'M');
  }
  // The moustache: two big drooping puffs curling out and down.
  const mo = pose.face === FACE_ROAR ? -2 : pose.face === FACE_HURT ? 1 : 0;
  const tache = [26, 6.5, 2.4, 23, 7.2, 2.8, 20, 8, 2.7, 17.4, 9.6, 2.2, 15.8, 11.6, 1.6];
  for (let i = 0; i < tache.length; i += 3) {
    const tx = tache[i]!;
    const ty = ey + tache[i + 1]! + mo;
    const tr = tache[i + 2]!;
    p.disc(tx, ty, tr, 'm').disc(56 - tx, ty, tr, 'm');
  }
  p.map((x, y, c) => (c === 'm' && y >= ey + 8 + mo ? 'n' : null));
  p.set(22, ey + 6 + mo, 'W').set(21, ey + 6 + mo, 'W').set(34, ey + 6 + mo, 'W').set(35, ey + 6 + mo, 'W');
  // Brows and moustache cast a little shadow, so the white tufts stand off the face.
  const tufts = p.copy();
  p.map((x, y, c) => {
    if (c !== 'b' && c !== 'c' && c !== 'a') return null;
    const up = tufts.get(x, y - 1);
    return up === 'm' || up === 'n' ? 'D' : null;
  });

  // Bolts dangling under the base (outlined with the body).
  const boltsFor = [1, 2, 3][pose.ph]!;
  const bx = [40, 15, 27];
  for (let i = 0; i < boltsFor; i++) {
    if (pose.face !== FACE_ROAR && pose.ph === 0 && pose.rain === 1) break;
    const len = pose.face === FACE_ROAR ? 9 + pose.ph * 2 : 5 + pose.ph * 2;
    bolt(p, bx[i]! + (pose.rain & 1), base + 1, len, 1);
  }
  p.outline('o');

  // Rain under the cloud (no outline: thin streaks).
  const streaks = [6, 9, 13][pose.ph]!;
  for (let i = 0; i < streaks; i++) {
    const x = 6 + Math.round((i * 44) / streaks) + ((pose.rain * 3 + i) % 3);
    const y = base + 2 + ((i * 5 + pose.rain * 4) % (H - base - 5));
    if (p.on(x, y) || p.on(x, y + 1)) continue;
    p.set(x, y, 'r').set(x, y + 1, 'R');
    if (pose.ph > 0) p.set(x, y + 2, 'r');
  }
  return p.rows();
}

const COMMON = { o: OUTLINE, w: '#f4f6fb', k: '#10122a', M: '#231a2a', t: '#d0667a', W: '#ffffff', r: '#6f9fd8', R: '#bfe0ff', y: '#ffd84a', Y: '#fff7c8', g: '#a8741e' };

const PALETTES = [
  // Brooding: grey-blue.
  { ...COMMON, a: '#4c5470', b: '#6e7894', c: '#98a2bc', d: '#cdd4e6', D: '#30364a', m: '#d8dde9', n: '#a6afc6', e: '#ffe36a', E: '#fff7c0' },
  // Gathering Storm: slate indigo, glowing yellow eyes.
  { ...COMMON, a: '#30345a', b: '#474d7a', c: '#6770a2', d: '#9aa2d0', D: '#1b1e36', m: '#b8bedc', n: '#7c84ae', e: '#ffc83a', E: '#fff2a0' },
  // The Last Downpour: near-black, white-hot eyes and veins.
  { ...COMMON, a: '#16151f', b: '#232236', c: '#35345a', d: '#56548a', D: '#0a0a12', m: '#6c6a9a', n: '#46446e', e: '#ffc83a', E: '#fff2a0' },
];

function frames(ph: number): string[][] {
  return [
    cloud({ ph, breathe: 0, face: FACE_IDLE, rain: 0, lean: 0 }),
    cloud({ ph, breathe: 1, face: FACE_IDLE, rain: 1, lean: 0 }),
    cloud({ ph, breathe: 0, face: FACE_IDLE, rain: 2, lean: 1 }),
    cloud({ ph, breathe: 1, face: FACE_IDLE, rain: 3, lean: -1 }),
    cloud({ ph, breathe: 0, face: FACE_INHALE, rain: 0, lean: 0 }),
    cloud({ ph, breathe: 1, face: FACE_ROAR, rain: 1, lean: 0 }),
    cloud({ ph, breathe: 0, face: FACE_HURT, rain: 2, lean: 0 }),
  ];
}

const ANIMS = {
  idle: { frames: [0, 1], fps: 2, loop: true },
  move: { frames: [2, 3], fps: 3, loop: true },
  charge: { frames: [2, 3], fps: 8, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [5], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [5], fps: 1, loop: true },
  hurt: { frames: [6], fps: 1, loop: true },
};

function sprite(ph: number): SpriteDef {
  return { id: `boss.thunderhead.${ph + 1}`, w: W, h: H, anchorY: ANCHOR_Y, palette: PALETTES[ph]!, frames: frames(ph), anims: ANIMS };
}

/** Phase 1 (the def's sprite: intro card, bestiary). */
export const THUNDERHEAD_1: SpriteDef = sprite(0);
export const THUNDERHEAD_2: SpriteDef = sprite(1);
export const THUNDERHEAD_3: SpriteDef = sprite(2);
/** By phase index. */
export const THUNDERHEAD_PHASES: readonly SpriteDef[] = [THUNDERHEAD_1, THUNDERHEAD_2, THUNDERHEAD_3];
