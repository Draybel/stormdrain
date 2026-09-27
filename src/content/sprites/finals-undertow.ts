/**
 * The Undertow (final boss, Ending 3) — the living whirlpool at the bottom of every drain: a funnel of
 * spiralling water seen from above at an angle, a foamy lip, one enormous eye in the middle, and the
 * things the town lost bobbing round the rim (a paper boat, a rubber duck, a red button, a key, one of
 * Wren's glowing marbles). Painted with ./paint.ts (1 px outline). One sprite per phase (the boss hook
 * swaps them when a phase begins), 56×56, the same anchor (the funnel's centre):
 *
 *   phase 1  The Current         blue, a heavy-lidded eye, a little spray
 *   phase 2  Churning            deeper and tighter, a bloodshot glare, more lost things
 *   phase 3  The Deep            two water tentacles rise from the rim, the iris glows
 *   phase 4  What the Rain Kept  four tentacles, a cracked, blazing eye, the lost things shining gold
 *
 * Frames: 0-3 spin (the arms turn, the lost things drift round), 4 windup (the eye narrows, tentacles
 * coil), 5 roar (the eye wide, tentacles and spray flung up), 6 hurt (the eye closes, the water calms).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const W = 56;
const H = 56;
const CX = 28;
const CY = 36;
const RX = 26.5;
const RY = 17;
const ANCHOR_Y = CY;

const POSE_SPIN = 0;
const POSE_WINDUP = 1;
const POSE_ROAR = 2;
const POSE_HURT = 3;

interface Pose {
  ph: number;
  /** Spin frame 0-3. */
  turn: number;
  pose: number;
}

/** A water tentacle rising from (x, y): discs thinning upward, swaying, a foamy curl at the tip. */
function tentacle(p: Pix, x: number, y: number, height: number, sway: number, phase: number): void {
  const t0 = new Pix(W, H);
  const steps = Math.max(8, Math.round(height * 1.5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x + Math.sin(t * Math.PI * 1.3 + phase) * sway * t;
    const py = y - t * height;
    t0.disc(px, py, 3.6 - t * 2.5, 'c');
  }
  // A bright streak just inside its left side, darker down its right, a foamy curl at the tip.
  const src = t0.copy();
  t0.map((px, py, c) => {
    if (c !== 'c') return null;
    const wide = src.on(px - 2, py) || src.on(px + 2, py);
    if (!wide) return null;
    if (!src.on(px + 1, py)) return 'b';
    if (!src.on(px - 2, py) && src.on(px - 1, py)) return 'd';
    return null;
  });
  const tx = x + Math.sin(Math.PI * 1.3 + phase) * sway;
  const ty = y - height;
  const dir = Math.cos(Math.PI * 1.3 + phase) >= 0 ? 1 : -1;
  t0.set(tx, ty, 'f').set(tx, ty - 1, 'f').set(tx + dir, ty - 1, 'e').set(tx + dir * 2, ty - 1, 'e').set(tx + dir * 2, ty, 'f').set(tx + dir * 2, ty + 1, 'e');
  for (let i = 1; i < 3; i++) t0.set(tx - dir, ty + i * 3, 'e');
  p.paste(t0, 0, 0);
}

function lostThing(p: Pix, kind: number, x: number, y: number, gold: boolean): void {
  switch (kind) {
    case 0: // a paper boat
      p.rect(x - 3, y, 7, 1, 'x').rect(x - 2, y + 1, 5, 1, 'x').line(x, y - 3, x, y - 1, 'w').line(x + 1, y - 2, x + 2, y - 1, 'w').set(x + 1, y - 1, 'w');
      break;
    case 1: // a rubber duck
      p.rect(x - 2, y - 1, 4, 2, 'Y').rect(x, y - 3, 2, 2, 'Y').set(x + 2, y - 2, 'O').set(x + 1, y - 3, 'k').set(x - 2, y - 2, 'Y');
      break;
    case 2: // a red button
      p.disc(x, y, 1.9, 'r').set(x - 1, y, 'k').set(x + 1, y, 'k');
      break;
    case 3: // a key
      p.line(x - 3, y, x + 1, y, 'g').disc(x + 2.5, y, 1.5, 'g').set(x + 2, y, 'a').set(x - 3, y + 1, 'g').set(x - 1, y + 1, 'g');
      break;
    default: // one of Wren's marbles
      p.disc(x, y, 1.8, 'g').set(x - 1, y - 1, 'W');
      break;
  }
  if (gold) p.set(x, y - 3, 'W').set(x - 3, y - 1, 'G').set(x + 3, y - 2, 'G');
}

function vortex(pose: Pose): string[] {
  const p = new Pix(W, H);
  const ph = pose.ph;
  const turn = pose.turn;
  const calm = pose.pose === POSE_HURT;
  const arms = ph === 0 ? 3 : ph === 1 ? 4 : ph === 2 ? 4 : 5;
  const twist = (ph >= 1 ? 6.5 : 5) + (pose.pose === POSE_WINDUP ? 1.5 : 0);
  const spinAng = turn * (Math.PI / 2) / arms;

  // ── Tentacles rising behind the far rim (phases 3-4) ──
  const tents = ph === 2 ? 2 : ph === 3 ? 4 : 0;
  if (tents > 0 && !calm) {
    const lift = pose.pose === POSE_ROAR ? 5 : pose.pose === POSE_WINDUP ? -4 : 0;
    const xs = tents === 2 ? [11, 45] : [7, 19, 37, 49];
    for (let i = 0; i < tents; i++) {
      const side = xs[i]! < CX ? -1 : 1;
      const base = CY - RY * Math.sqrt(Math.max(0, 1 - ((xs[i]! - CX) / RX) ** 2)) + 3;
      const hgt = (tents === 2 ? 20 : i === 0 || i === 3 ? 16 : 24) + lift + (turn & 1);
      tentacle(p, xs[i]!, base, hgt, 3 * side, turn * 0.8 + i * 1.3);
    }
  }

  // ── The funnel ──
  p.map((x, y, cur) => {
    const dx = (x + 0.5 - CX) / RX;
    const dy = (y + 0.5 - CY) / RY;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return null;
    const a = Math.atan2(dy, dx);
    const s = Math.sin(arms * a + Math.log(r + 0.04) * twist - spinAng * arms - (calm ? 1 : 0));
    if (r < 0.14) return 'a';
    // Deeper toward the middle: the funnel.
    const depth = r < 0.35 ? 1 : r < 0.6 ? 0.5 : 0;
    if (calm) return s > 0.6 ? 'd' : s > -0.2 ? 'c' : 'b';
    if (s > 0.72 && depth < 1) return r > 0.72 ? 'e' : 'd';
    if (s > 0.2) return depth >= 1 ? 'b' : 'c';
    if (s > -0.5) return depth >= 1 ? 'a' : 'b';
    return cur === '.' ? 'a' : 'a';
  });
  // The foamy lip: a solid band at the front edge, thinner and broken at the back.
  p.map((x, y, c) => {
    if (c === '.') return null;
    const dx = (x + 0.5 - CX) / RX;
    const dy = (y + 0.5 - CY) / RY;
    const r = Math.sqrt(dx * dx + dy * dy);
    const edge = dy > 0 ? 0.86 - dy * 0.04 : 0.93;
    if (r > 1 || r <= edge) return null;
    const churn = Math.sin(Math.atan2(dy, dx) * 9 + turn * 1.6);
    if (dy <= 0 && churn < -0.3) return null;
    return churn > 0.55 || r > 0.97 ? 'f' : 'e';
  });
  // Foam streaks riding the spiral.
  for (let i = 0; i < 10 + ph * 3; i++) {
    const a = (i / (10 + ph * 3)) * Math.PI * 2 + spinAng * 2 + hash2(i, ph, 1);
    const r = 0.45 + 0.4 * hash2(i, ph, 2);
    const x = CX + Math.cos(a) * RX * r;
    const y = CY + Math.sin(a) * RY * r;
    p.set(x, y, 'e').set(x + Math.sin(a) * 1.2, y - Math.cos(a) * 0.8, 'f');
  }

  // ── The lost things bobbing round the rim ──
  const things = [2, 3, 4, 5][ph]!;
  for (let i = 0; i < things; i++) {
    const a = (i / things) * Math.PI * 2 + turn * 0.35 + 0.6;
    const x = Math.round(CX + Math.cos(a) * RX * 0.76);
    const y = Math.round(CY + Math.sin(a) * RY * 0.72);
    lostThing(p, (i + (ph === 3 ? 4 : 0)) % 5, x, y, ph === 3);
  }

  // ── The eye: the funnel's throat opens on it ──
  const ex = CX;
  const ey = CY - 1;
  const rx = ph >= 2 ? 10 : 9;
  p.ellipse(ex, ey + 0.5, rx + 2.2, 7.4, 'a');
  if (calm) {
    // Shut: a pale lid and a line of lashes.
    p.ellipse(ex, ey, rx - 1, 3.4, 'c');
    p.ellipse(ex, ey - 1, rx - 2.5, 1.6, 'd');
    p.line(ex - rx + 1, ey + 1, ex - 4, ey + 3, 'f').line(ex - 4, ey + 3, ex + 4, ey + 3, 'f').line(ex + 4, ey + 3, ex + rx - 1, ey + 1, 'f');
    for (let i = -2; i <= 2; i++) p.set(ex + i * 3, ey + 4, 'e');
  } else {
    const open = pose.pose === POSE_ROAR ? 6 : pose.pose === POSE_WINDUP ? 2.6 : ph === 0 ? 4.4 : 4.8;
    // The sclera, the iris and a slit pupil.
    p.ellipse(ex, ey, rx, open, 'w');
    if (ph >= 1) {
      // Bloodshot.
      p.line(ex - rx + 1, ey + 1, ex - rx + 3, ey, 'v').set(ex - rx + 4, ey + 1, 'v');
      p.line(ex + rx - 1, ey + 1, ex + rx - 3, ey + 2, 'v').set(ex + rx - 4, ey + 1, 'v');
    }
    const ic = ph >= 2 ? 'j' : 'i';
    const ir = Math.min(open + 0.3, 4.4);
    p.ellipse(ex, ey, 4.2, ir, ic);
    p.ellipse(ex, ey + 0.5, 3, Math.max(1, ir - 1.2), ph >= 2 ? 'J' : 'I');
    p.rect(ex - 0.5, ey - Math.min(open, 3.4), 1, Math.min(open, 3.4) * 2, 'k');
    p.rect(ex - 1, ey - 1, 3, 2, 'k');
    p.set(ex - 3, ey - 2, 'W').set(ex - 2, ey - 2, 'W').set(ex - 2, ey - 3, 'W');
    // A heavy upper lid (drowsy at first, glaring later).
    const lid = ph === 0 ? 0.38 : 0.26;
    p.map((x, y, c) => {
      if (c !== 'w' && c !== ic && c !== 'J' && c !== 'I' && c !== 'k' && c !== 'W' && c !== 'v') return null;
      const t = (y + 0.5 - (ey - open)) / (open * 2);
      const slant = ph >= 1 ? ((x + 0.5 - ex) / rx) * ((x + 0.5 - ex) / rx) * -0.18 : 0;
      return t < lid + slant ? 'c' : null;
    });
    // The lid's rim.
    const lidY = ey - open + open * 2 * lid;
    for (let x = Math.ceil(ex - rx + 1); x <= ex + rx - 1; x++) {
      const u = (x + 0.5 - ex) / rx;
      const y = Math.round(lidY + (ph >= 1 ? -u * u * 0.18 * open * 2 : 0));
      if (p.get(x, y) !== 'a') p.set(x, y, 'k');
    }
    // The last stand: a glowing crack across the eye.
    if (ph === 3) p.line(ex - 7, ey - 3, ex - 3, ey + 1, 'J').line(ex - 3, ey + 1, ex + 1, ey - 1, 'J').line(ex + 1, ey - 1, ex + 6, ey + 3, 'J');
  }

  // ── Spray thrown up off the rim ──
  const drops = calm ? 2 : 6 + ph * 2 + (pose.pose === POSE_ROAR ? 6 : 0);
  for (let i = 0; i < drops; i++) {
    const a = Math.PI + (i / Math.max(1, drops - 1)) * Math.PI;
    const x = CX + Math.cos(a) * RX * (0.8 + 0.25 * hash2(i, turn, 5));
    const up = 2 + ((i * 3 + turn * 2) % (pose.pose === POSE_ROAR ? 10 : 6));
    const y = CY + Math.sin(a) * RY - up;
    if (p.get(x, y) !== '.') continue;
    p.set(x, y, 'e');
    if (i % 3 === 0) p.set(x, y - 1, 'f');
  }
  return p.outline('o').rows();
}

const COMMON = { o: OUTLINE, k: '#0a0a14', W: '#ffffff', w: '#f4f0e0', x: '#c8c0a8', Y: '#ffd84a', O: '#f08a2a', r: '#d04040', g: '#ffcf57', G: '#fff2a8', v: '#d04a5a', I: '#8ad8d8' };

const PALETTES = [
  // The Current.
  { ...COMMON, a: '#0f2440', b: '#1c3d66', c: '#2f6296', d: '#5a95c8', e: '#a8d4f0', f: '#e6f6ff', i: '#3a9aa8', j: '#5af0ff', J: '#c8fcff' },
  // Churning: deeper, a bloodshot glare.
  { ...COMMON, a: '#0a1a30', b: '#133456', c: '#1f5580', d: '#3f84b8', e: '#8cc4e8', f: '#d8f0ff', i: '#2a8a8a', j: '#5af0ff', J: '#c8fcff' },
  // The Deep: tentacles, the iris glowing.
  { ...COMMON, a: '#070f1f', b: '#0e2544', c: '#174070', d: '#2c6aa8', e: '#6cc4f0', f: '#c8f4ff', i: '#2a8a8a', j: '#3ae0ff', J: '#c8fcff' },
  // What the Rain Kept: violent, a blazing crack, the lost things shining.
  { ...COMMON, a: '#081026', b: '#123a66', c: '#1e66a0', d: '#3aa0d8', e: '#8ae8ff', f: '#ffffff', i: '#2a8a8a', j: '#6af8ff', J: '#f0ffff' },
];

function frames(ph: number): string[][] {
  return [
    vortex({ ph, turn: 0, pose: POSE_SPIN }),
    vortex({ ph, turn: 1, pose: POSE_SPIN }),
    vortex({ ph, turn: 2, pose: POSE_SPIN }),
    vortex({ ph, turn: 3, pose: POSE_SPIN }),
    vortex({ ph, turn: 1, pose: POSE_WINDUP }),
    vortex({ ph, turn: 2, pose: POSE_ROAR }),
    vortex({ ph, turn: 0, pose: POSE_HURT }),
  ];
}

const ANIMS = {
  idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
  move: { frames: [0, 1, 2, 3], fps: 9, loop: true },
  charge: { frames: [0, 1, 2, 3], fps: 14, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [5], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [5], fps: 1, loop: true },
  hurt: { frames: [6], fps: 1, loop: true },
};

function sprite(ph: number): SpriteDef {
  return { id: `boss.undertow.${ph + 1}`, w: W, h: H, anchorY: ANCHOR_Y, palette: PALETTES[ph]!, frames: frames(ph), anims: ANIMS };
}

export const UNDERTOW_1: SpriteDef = sprite(0);
export const UNDERTOW_2: SpriteDef = sprite(1);
export const UNDERTOW_3: SpriteDef = sprite(2);
export const UNDERTOW_4: SpriteDef = sprite(3);
/** By phase index. */
export const UNDERTOW_PHASES: readonly SpriteDef[] = [UNDERTOW_1, UNDERTOW_2, UNDERTOW_3, UNDERTOW_4];
