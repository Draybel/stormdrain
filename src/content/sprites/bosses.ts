/**
 * Boss and miniboss sprites (original art, built with the pixel painter in ./paint.ts). Every frame gets
 * a 1 px dark outline; bodies are lit from the top-left. Side views face RIGHT (the renderer mirrors).
 * The anchor (anchorY) sits in the lower body, not at the feet, so the collision circle (BossDef.size)
 * covers what you see; the renderer puts the shadow under the sprite's bottom edge.
 * Animations follow the boss renderer's names: idle, move, windup (telegraph), air (leaping), slam,
 * roar (shouting / firing), charge, hurt (the death sequence).
 *
 *   Sodden Snarl      44×38  a wad of drain hair, moss, leaves and one lost mitten — with a temper
 *   Brimwell          36×50  a rain-gauge golem: a glass tube of rainwater on stubby stone legs
 *   Pipewhip          40×30  a sewer eel lunging out of a rusty pipe (miniboss)
 *   Old Thunderhead   56×40  a grumpy storm cloud (final, placeholder art)
 *   The Nestmother    48×44  a paper-wasp queen (final, placeholder art)
 *   The Undertow      56×56  a living whirlpool with one eye (final, placeholder art)
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const o = OUTLINE;

// ── Sodden Snarl ────────────────────────────────────────────────────────────

const SNARL_PAL = {
  o,
  a: '#2b2018',
  b: '#45321f',
  c: '#634a33',
  d: '#8a6b4a',
  m: '#43663d',
  n: '#6f9a58',
  L: '#c8773a',
  Y: '#e3aa4c',
  G: '#7a9a3c',
  r: '#b8433a',
  R: '#e0705a',
  w: '#f2eedc',
  k: '#0f0d18',
  e: '#ffffff',
  M: '#1c0f12',
  t: '#e8dcbc',
  s: '#8cc0ea',
};

interface SnarlPose {
  /** Body squash: rx, ry, centre y. */
  rx: number;
  ry: number;
  cy: number;
  /** Hair texture phase (rolling). */
  phase: number;
  /** 0 normal, 1 narrowed (telegraph), 2 wide (roar), 3 shut (hurt). */
  eyes: number;
  /** 0 frown, 1 roar, 2 wobble. */
  mouth: number;
}

function snarl(pose: SnarlPose): string[] {
  const W = 44;
  const H = 38;
  const p = new Pix(W, H);
  const cx = 22;
  const { rx, ry, cy } = pose;
  // A lumpy wad: an ellipse whose edge wobbles with the angle.
  p.map((x, y) => {
    const dx = (x + 0.5 - cx) / rx;
    const dy = (y + 0.5 - cy) / ry;
    const a = Math.atan2(dy, dx);
    const lump = 0.1 * Math.sin(a * 5 + 1.3) + 0.07 * Math.sin(a * 11 + 0.4) + 0.05 * (hash2(Math.round(a * 9), 3) - 0.5);
    if (y >= H - 1) return null;
    return dx * dx + dy * dy <= 1 + lump ? 'b' : null;
  });
  // Hair texture: diagonal strands that roll with the phase.
  p.map((x, y, cur) => {
    if (cur !== 'b') return null;
    const v = Math.sin((x * 0.55 + y * 0.9 + pose.phase) * 1.7) + (hash2(x, y, 7) - 0.5) * 0.9;
    return v > 0.75 ? 'c' : v < -0.8 ? 'a' : null;
  });
  // Long strands draped over it.
  const strands: [number, number, number, number][] = [
    [9, 13, 15, 27],
    [30, 10, 35, 24],
    [18, 9, 20, 17],
    [26, 30, 31, 35],
  ];
  for (const [x0, y0, x1, y1] of strands) p.line(x0 + Math.round(pose.phase) % 2, y0, x1, y1, 'd');
  // Stray hairs sticking out of the top (silhouette).
  const top = Math.round(cy - ry);
  p.line(14, top + 2, 11, top - 2, 'c');
  p.line(21, top, 22, top - 4, 'c');
  p.line(29, top + 1, 33, top - 2, 'c');
  p.line(33, top + 4, 37, top + 1, 'b');
  // Moss patches and leaves stuck in it.
  p.ellipse(12, cy - 6, 4, 2.2, 'm').ellipse(11, cy - 7, 2, 1, 'n');
  p.ellipse(33, cy + 7, 3, 1.8, 'm');
  const leaf = (x: number, y: number, c: string, c2: string): void => {
    p.set(x, y, c).set(x + 1, y, c).set(x + 2, y, c2).set(x + 1, y - 1, c).set(x + 1, y + 1, c2);
  };
  leaf(6, cy + 1, 'L', 'Y');
  leaf(24, top + 3, 'Y', 'L');
  leaf(35, cy - 5, 'G', 'n');
  leaf(12, cy + 9, 'L', 'L');
  leaf(29, cy + 11, 'Y', 'G');
  // A lost red mitten poking out on the right.
  p.rect(37, cy + 1, 4, 4, 'r').rect(38, cy + 1, 2, 1, 'R').rect(41, cy + 2, 1, 2, 'r').rect(37, cy + 5, 4, 1, 'R');
  // Eyes.
  const eye = (ex: number, ey: number): void => {
    if (pose.eyes === 3) {
      p.line(ex - 3, ey, ex + 2, ey, 'M');
      return;
    }
    const h = pose.eyes === 1 ? 1.6 : pose.eyes === 2 ? 4 : 3.3;
    p.ellipse(ex, ey, 3.4, h, 'w');
    p.rect(ex, ey - (pose.eyes === 1 ? 0 : 1), 2, pose.eyes === 1 ? 1 : 2, 'k');
    if (pose.eyes !== 1) p.set(ex + 1, ey - 1, 'e');
  };
  eye(16, cy - 1);
  eye(28, cy - 2);
  // Grumpy brows (a thick strand over each eye).
  const bl = pose.eyes === 1 ? 1 : 0;
  p.line(12, cy - 6 + bl, 19, cy - 4 + bl, 'a').line(12, cy - 5 + bl, 19, cy - 3 + bl, 'a');
  p.line(25, cy - 4 + bl, 32, cy - 7 + bl, 'a').line(25, cy - 3 + bl, 32, cy - 6 + bl, 'a');
  // Mouth.
  const my = cy + 6;
  if (pose.mouth === 1) {
    p.ellipse(22, my + 1, 6, 3.4, 'M');
    p.set(18, my - 1, 't').set(19, my - 1, 't').set(25, my - 1, 't').set(21, my + 3, 't').set(23, my + 3, 't');
  } else if (pose.mouth === 2) {
    for (let x = 16; x <= 28; x++) p.set(x, my + (x % 3 === 0 ? 1 : 0), 'M');
  } else {
    p.line(16, my + 2, 19, my, 'M').line(19, my, 25, my, 'M').line(25, my, 28, my + 2, 'M');
    p.set(20, my + 1, 't').set(24, my + 1, 't');
  }
  // A drip of drain water.
  p.set(9, cy + 7, 's').set(9, cy + 8, 's');
  return p.outline('o').rows();
}

export const SODDEN_SNARL_SPRITE: SpriteDef = {
  id: 'boss.soddenSnarl',
  anchorY: 25,
  w: 44,
  h: 38,
  palette: SNARL_PAL,
  frames: [
    snarl({ rx: 19, ry: 14, cy: 22.5, phase: 0, eyes: 0, mouth: 0 }),
    snarl({ rx: 19.6, ry: 13.5, cy: 23, phase: 0.4, eyes: 0, mouth: 0 }),
    snarl({ rx: 19, ry: 14, cy: 22.5, phase: 1.6, eyes: 0, mouth: 2 }),
    snarl({ rx: 19.4, ry: 13.7, cy: 22.8, phase: 3.2, eyes: 0, mouth: 2 }),
    snarl({ rx: 20.5, ry: 12.2, cy: 24.4, phase: 0.8, eyes: 1, mouth: 0 }),
    snarl({ rx: 19.5, ry: 14.3, cy: 22.2, phase: 0.2, eyes: 2, mouth: 1 }),
    snarl({ rx: 18.4, ry: 13.2, cy: 23.4, phase: 2.4, eyes: 3, mouth: 2 }),
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [2, 3], fps: 7, loop: true },
    charge: { frames: [2, 3], fps: 14, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
    slam: { frames: [4], fps: 1, loop: true },
    roar: { frames: [5], fps: 1, loop: true },
    air: { frames: [5], fps: 1, loop: true },
    hurt: { frames: [6], fps: 1, loop: true },
  },
};

// ── Brimwell, the Gauge Golem ───────────────────────────────────────────────

const GAUGE_PAL = {
  o,
  g: '#9fc3de',
  G: '#e6f4ff',
  q: '#5f81a3',
  h: '#cfe6f880',
  W: '#3b78c0',
  V: '#72b4ec',
  X: '#285392',
  S: '#6b7389',
  T: '#9aa2b8',
  U: '#434a5d',
  B: '#c89c3c',
  C: '#f2d472',
  D: '#86652a',
  w: '#f4f8ff',
  k: '#0e1422',
  e: '#ffffff',
  u: '#c8ecff',
};

interface GaugePose {
  /** Body raise (legs extended) or crouch, px. */
  lift: number;
  /** Water level (row where the water starts). */
  level: number;
  /** Bubble phase. */
  bub: number;
  /** 0 normal, 1 squint, 2 wide, 3 shut. */
  eyes: number;
  /** Legs: 0 stand, 1 step L, 2 step R, 3 tucked. */
  legs: number;
  /** Spout gushing. */
  gush: boolean;
}

function gauge(pose: GaugePose): string[] {
  const W = 36;
  const H = 50;
  const p = new Pix(W, H);
  const y0 = 3 - pose.lift;
  // Stubby stone legs + base.
  const baseY = 37 - pose.lift;
  const legY = baseY + 5;
  const legs = (lx: number, drop: number): void => {
    p.rect(lx, legY, 6, 49 - legY - drop, 'S').rect(lx, legY, 2, 49 - legY - drop, 'T').rect(lx + 5, legY, 1, 49 - legY - drop, 'U');
    p.rect(lx - 1, 48 - drop, 8, 1, 'U');
  };
  if (pose.legs === 3) {
    legs(9, 5);
    legs(21, 5);
  } else {
    legs(9, pose.legs === 1 ? 2 : 0);
    legs(21, pose.legs === 2 ? 2 : 0);
  }
  p.rect(6, baseY, 24, 6, 'S').rect(6, baseY, 24, 1, 'T').rect(6, baseY + 5, 24, 1, 'U').rect(6, baseY, 1, 6, 'T');
  for (let x = 8; x < 29; x += 5) p.set(x, baseY + 2, 'U');
  // The glass tube.
  const tubeTop = y0 + 6;
  const tubeBot = baseY - 1;
  p.rect(8, tubeTop, 20, tubeBot - tubeTop + 1, 'h');
  const level = Math.max(tubeTop + 1, pose.level - pose.lift);
  p.rect(10, level, 16, tubeBot - level + 1, 'W');
  p.rect(10, level, 16, 1, 'V');
  // Depth shading of the water and its sheen.
  p.map((x, y, cur) => (cur === 'W' && (x >= 22 || y > tubeBot - 3) ? 'X' : cur === 'W' && x === 11 ? 'V' : null));
  // Glass walls and the measuring scale.
  for (let y = tubeTop; y <= tubeBot; y++) {
    p.set(8, y, 'g').set(9, y, 'G').set(26, y, 'q').set(27, y, 'g');
    if ((y - tubeTop) % 4 === 1) p.set(10, y, 'G').set(11, y, (y - tubeTop) % 8 === 1 ? 'G' : 'h');
  }
  // Bubbles rising.
  for (let i = 0; i < 4; i++) {
    const bx = 13 + ((i * 7) % 11);
    const by = tubeBot - 3 - ((pose.bub * 5 + i * 6) % Math.max(4, tubeBot - level - 3));
    if (by > level) p.set(bx, by, 'u');
  }
  // Floating eyes in the water.
  const eye = (ex: number, ey: number): void => {
    if (pose.eyes === 3) {
      p.line(ex - 2, ey, ex + 2, ey, 'k');
      return;
    }
    const r = pose.eyes === 2 ? 3.2 : pose.eyes === 1 ? 1.4 : 2.7;
    p.ellipse(ex, ey, 2.8, r, 'w');
    p.rect(ex, ey - (pose.eyes === 1 ? 0 : 1), 2, pose.eyes === 1 ? 1 : 2, 'k');
    if (pose.eyes !== 1) p.set(ex + 1, ey - 1, 'e');
  };
  const eyeY = Math.max(level + 4, tubeTop + 12);
  eye(15, eyeY);
  eye(22, eyeY - 1);
  // The brass cap and the spout.
  p.rect(6, y0, 24, 6, 'B').rect(6, y0, 24, 1, 'C').rect(6, y0 + 5, 24, 1, 'D').rect(6, y0 + 1, 1, 4, 'C');
  p.rect(10, y0 - 2, 16, 2, 'B').rect(10, y0 - 2, 16, 1, 'C');
  for (let x = 9; x < 29; x += 4) p.set(x, y0 + 3, 'D');
  p.rect(30, y0 + 1, 3, 3, 'B').rect(32, y0 + 3, 2, 3, 'B').set(32, y0 + 1, 'C').set(33, y0 + 5, 'D');
  if (pose.gush) p.rect(33, y0 + 6, 2, 4, 'V').set(34, y0 + 10, 'u').set(32, y0 + 11, 'u');
  return p.outline('o').rows();
}

export const BRIMWELL_SPRITE: SpriteDef = {
  id: 'boss.brimwell',
  anchorY: 38,
  w: 36,
  h: 50,
  palette: GAUGE_PAL,
  frames: [
    gauge({ lift: 0, level: 16, bub: 0, eyes: 0, legs: 0, gush: false }),
    gauge({ lift: 0, level: 16, bub: 1, eyes: 0, legs: 0, gush: false }),
    gauge({ lift: 1, level: 16, bub: 2, eyes: 0, legs: 1, gush: false }),
    gauge({ lift: 1, level: 16, bub: 3, eyes: 0, legs: 2, gush: false }),
    gauge({ lift: -3, level: 16, bub: 1, eyes: 1, legs: 0, gush: false }),
    gauge({ lift: 3, level: 16, bub: 2, eyes: 2, legs: 3, gush: false }),
    gauge({ lift: -2, level: 17, bub: 0, eyes: 2, legs: 0, gush: true }),
    gauge({ lift: -1, level: 20, bub: 3, eyes: 3, legs: 0, gush: false }),
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [2, 3], fps: 5, loop: true },
    charge: { frames: [2, 3], fps: 10, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
    slam: { frames: [4], fps: 1, loop: true },
    air: { frames: [5], fps: 1, loop: true },
    roar: { frames: [6], fps: 1, loop: true },
    hurt: { frames: [7], fps: 1, loop: true },
  },
};

// ── Pipewhip (miniboss) ─────────────────────────────────────────────────────

const EEL_PAL = {
  o,
  P: '#8a5a3a',
  Q: '#b8804e',
  R: '#5a3622',
  v: '#07080d',
  E: '#4f6f5a',
  F: '#7aa07e',
  H: '#2f4636',
  y: '#ffd35a',
  k: '#0f0d18',
  t: '#eae0c8',
  M: '#2a0c14',
  f: '#c8e06a',
};

/** Pipewhip: a rusty pipe mouth on the floor with the eel's body rising out of it. */
function eel(sway: number, rear: number, open: boolean, shut = false): string[] {
  const W = 40;
  const H = 30;
  const p = new Pix(W, H);
  // The pipe opening (seen from above, at the bottom).
  p.ellipse(15, 25, 11, 4.2, 'P').ellipse(15, 25, 8.5, 2.8, 'v');
  p.map((x, y, c) => (c === 'P' && y < 24 ? 'Q' : c === 'P' && y > 26 ? 'R' : null));
  p.set(5, 25, 'R').set(25, 26, 'R').set(9, 22, 'R');
  // The body: a thick curve rising from the pipe to the head.
  const hx = 27 + sway - rear;
  const hy = 9 + rear;
  const steps = 18;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bx = 15 + (hx - 15) * t + Math.sin(t * Math.PI) * (-5 + sway);
    const by = 25 + (hy - 25) * t;
    const r = 4.2 - t * 1.2;
    p.disc(bx, by, r, 'E');
  }
  // Belly stripe and back spots.
  p.map((x, y, c) => (c === 'E' && hash2(x, y, 3) > 0.86 ? 'H' : null));
  for (let i = 2; i < steps; i += 3) {
    const t = i / steps;
    const bx = 15 + (hx - 15) * t + Math.sin(t * Math.PI) * (-5 + sway);
    const by = 25 + (hy - 25) * t;
    p.set(bx + 1, by + 1, 'F');
  }
  // Back fin along the top edge.
  for (let i = 4; i < steps - 2; i += 2) {
    const t = i / steps;
    const bx = 15 + (hx - 15) * t + Math.sin(t * Math.PI) * (-5 + sway);
    const by = 25 + (hy - 25) * t;
    p.set(bx - 3, by - 2, 'f').set(bx - 4, by - 3, 'f');
  }
  // Head: a blunt snout with an underbite.
  p.ellipse(hx + 2, hy, 6, 4.6, 'E').ellipse(hx + 6, hy + 1, 3.6, 3, 'E');
  p.map((x, y, c) => (c === 'E' && y <= hy - 3 ? 'F' : null));
  if (open) {
    p.ellipse(hx + 6, hy + 3, 4, 2.4, 'M');
    p.set(hx + 4, hy + 1, 't').set(hx + 7, hy + 1, 't').set(hx + 5, hy + 5, 't').set(hx + 8, hy + 5, 't');
  } else {
    p.line(hx + 3, hy + 3, hx + 9, hy + 2, 'M');
    p.set(hx + 5, hy + 2, 't').set(hx + 8, hy + 1, 't');
  }
  // A mean yellow eye.
  if (shut) p.line(hx + 1, hy - 1, hx + 4, hy - 1, 'k');
  else p.rect(hx + 2, hy - 2, 3, 2, 'y').set(hx + 3, hy - 2, 'k').set(hx + 3, hy - 1, 'k');
  // Whisker barbels.
  p.line(hx + 8, hy + 4, hx + 11, hy + 7, 'F');
  return p.outline('o').rows();
}

export const PIPEWHIP_SPRITE: SpriteDef = {
  id: 'boss.pipewhip',
  anchorY: 24,
  w: 40,
  h: 30,
  palette: EEL_PAL,
  frames: [eel(0, 0, false), eel(1, 0, false), eel(2, 0, false), eel(-1, 0, false), eel(-2, 4, false), eel(1, -1, true), eel(0, 3, false, true)],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [2, 3], fps: 6, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
    slam: { frames: [5], fps: 1, loop: true },
    roar: { frames: [5], fps: 1, loop: true },
    air: { frames: [5], fps: 1, loop: true },
    hurt: { frames: [6], fps: 1, loop: true },
  },
};

// ── Old Thunderhead (final) ──────────────────────────────────────────────────

const CLOUD_PAL = {
  o,
  a: '#565d74',
  b: '#767e98',
  c: '#9aa3bb',
  d: '#c4cbdc',
  D: '#393e50',
  y: '#ffe36a',
  Y: '#fff7c0',
  k: '#141726',
  M: '#1c1a2a',
  t: '#dfe6f5',
  r: '#8fb8e8',
};

function cloud(frame: number, face: number): string[] {
  const W = 56;
  const H = 40;
  const p = new Pix(W, H);
  const puffs: [number, number, number][] = [
    [12, 20, 9],
    [22, 13, 11],
    [34, 12, 12],
    [45, 19, 9],
    [28, 22, 13],
    [15, 26, 8],
    [42, 26, 8],
  ];
  // Each puff lit on its own (bright rim on top, grey belly), later puffs in front of earlier ones.
  for (const [x0, y, r] of puffs) {
    const x = x0 + (frame === 1 ? (x0 < 28 ? -1 : 1) : 0);
    p.map((px, py) => {
      const dx = px + 0.5 - x;
      const dy = py + 0.5 - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > r) return null;
      if (dy < -r * 0.3 && d > r - 2.2) return 'd';
      if (dy < -r * 0.1 && d > r - 4.5) return 'c';
      if (dy > r * 0.5) return 'a';
      return 'b';
    });
  }
  p.map((x, y, c) => (c !== '.' && y > 31 ? 'D' : null));
  // A glowering face.
  const ey = 20;
  const eye = (ex: number, dir: number): void => {
    const h = face === 1 ? 1 : face === 2 ? 3 : 2;
    p.ellipse(ex, ey, 3.2, h, 'y').set(ex, ey, 'Y');
    p.line(ex - 4 * dir, ey - 4 + (face === 1 ? 1 : 0), ex + 3 * dir, ey - 2 + (face === 1 ? 1 : 0), 'k');
    p.line(ex - 4 * dir, ey - 5 + (face === 1 ? 1 : 0), ex + 3 * dir, ey - 3 + (face === 1 ? 1 : 0), 'k');
  };
  eye(22, 1);
  eye(34, -1);
  if (face === 2) {
    p.ellipse(28, 28, 6, 3.4, 'M').set(25, 26, 't').set(31, 26, 't').rect(27, 30, 2, 1, 'y');
  } else {
    p.line(22, 29, 25, 27, 'M').line(25, 27, 31, 27, 'M').line(31, 27, 34, 29, 'M');
  }
  // Little lightning bolts dangling, rain streaks.
  const bolt = (x: number, y: number): void => {
    p.line(x, y, x - 2, y + 3, 'y').line(x - 2, y + 3, x + 1, y + 3, 'y').line(x + 1, y + 3, x - 1, y + 6, 'Y');
  };
  if (frame !== 1) bolt(16, 32);
  if (frame !== 0) bolt(40, 32);
  for (let i = 0; i < 5; i++) {
    const rx = 12 + i * 8 + (frame % 2) * 3;
    p.set(rx, 36 + (i % 2), 'r').set(rx, 37 + (i % 2), 'r');
  }
  return p.outline('o').rows();
}

export const THUNDERHEAD_SPRITE: SpriteDef = {
  id: 'boss.thunderhead',
  anchorY: 27,
  w: 56,
  h: 40,
  palette: CLOUD_PAL,
  frames: [cloud(0, 0), cloud(1, 0), cloud(0, 1), cloud(2, 2), cloud(1, 3)],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 3, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
    slam: { frames: [2], fps: 1, loop: true },
    roar: { frames: [3], fps: 1, loop: true },
    air: { frames: [3], fps: 1, loop: true },
    hurt: { frames: [4], fps: 1, loop: true },
  },
};

// ── The Nestmother (final) ──────────────────────────────────────────────────

const WASP_PAL = {
  o,
  A: '#d8902c',
  B: '#f2c055',
  K: '#2a1c14',
  L: '#4a3424',
  w: '#e8e4d8a0',
  W: '#fbf8ee',
  r: '#e0503a',
  R: '#ff9a6a',
  s: '#f4e8c8',
  k: '#140e10',
  y: '#ffe08a',
};

function wasp(flap: number, curl: number, roar: boolean, shut = false): string[] {
  const W = 48;
  const H = 44;
  const p = new Pix(W, H);
  // Wings (paper, translucent) behind the body.
  const wy = flap === 0 ? 12 : 16;
  p.ellipse(13, wy, 12, 5.5, 'w').ellipse(35, wy, 12, 5.5, 'w');
  p.ellipse(10, wy + 7, 9, 4, 'w').ellipse(38, wy + 7, 9, 4, 'w');
  p.map((x, y, c) => (c === 'w' && (x + y) % 7 === 0 ? 'W' : null));
  // Legs.
  p.line(18, 24, 12, 32, 'K').line(19, 26, 14, 36, 'K').line(30, 24, 36, 32, 'K').line(29, 26, 34, 36, 'K');
  // Abdomen with stripes, curling forward on the telegraph.
  const ax = 24;
  const ay = 32 - curl;
  p.ellipse(ax, ay, 8, 9.5, 'A');
  p.map((x, y, c) => (c === 'A' && ((y - ay + 20) % 5 < 2) ? 'K' : c === 'A' && x < ax - 3 ? 'B' : null));
  p.line(ax, ay + 9, ax + (curl > 0 ? 3 : 0), ay + 12, 'k');
  // Thorax and head.
  p.ellipse(24, 20, 6, 4.5, 'L').ellipse(24, 19, 4, 2, 'K');
  p.ellipse(24, 11, 7, 6, 'A');
  p.map((x, y, c) => (c === 'A' && y <= 7 ? 'B' : null));
  // Compound eyes.
  if (shut) {
    p.line(18, 11, 21, 11, 'k').line(27, 11, 30, 11, 'k');
  } else {
    p.ellipse(19.5, 11, 2.6, 3.4, 'r').ellipse(28.5, 11, 2.6, 3.4, 'r');
    p.set(19, 9, 'R').set(28, 9, 'R');
  }
  // A paper crown and mandibles.
  p.set(20, 4, 'y').set(22, 3, 'y').set(24, 2, 'y').set(26, 3, 'y').set(28, 4, 'y').rect(20, 5, 9, 1, 'y');
  if (roar) {
    p.line(21, 16, 19, 19, 's').line(27, 16, 29, 19, 's').rect(23, 16, 3, 2, 'k');
  } else {
    p.line(21, 16, 22, 18, 's').line(27, 16, 26, 18, 's');
  }
  // Antennae.
  p.line(21, 5, 16, 0, 'K').line(27, 5, 32, 0, 'K');
  return p.outline('o').rows();
}

export const NESTMOTHER_SPRITE: SpriteDef = {
  id: 'boss.nestmother',
  anchorY: 30,
  w: 48,
  h: 44,
  palette: WASP_PAL,
  frames: [wasp(0, 0, false), wasp(1, 0, false), wasp(0, 4, false), wasp(1, 1, true), wasp(1, 2, false, true)],
  anims: {
    idle: { frames: [0, 1], fps: 8, loop: true },
    move: { frames: [0, 1], fps: 12, loop: true },
    charge: { frames: [0, 1], fps: 16, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
    slam: { frames: [2], fps: 1, loop: true },
    roar: { frames: [3], fps: 1, loop: true },
    air: { frames: [0, 1], fps: 16, loop: true },
    hurt: { frames: [4], fps: 1, loop: true },
  },
};

// ── The Undertow (final) ─────────────────────────────────────────────────────

const VORTEX_PAL = {
  o,
  a: '#0f2440',
  b: '#1c3d66',
  c: '#2f6296',
  d: '#5a95c8',
  e: '#a8d4f0',
  f: '#e6f6ff',
  w: '#f4f0e0',
  k: '#0a0a14',
  r: '#e0405a',
};

function vortex(turn: number, eye: number): string[] {
  const W = 56;
  const H = 56;
  const p = new Pix(W, H);
  const cx = 28;
  const cy = 30;
  p.map((x, y) => {
    const dx = (x + 0.5 - cx) / 26;
    const dy = (y + 0.5 - cy) / 20;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r > 1) return null;
    const a = Math.atan2(dy, dx);
    // Spiral arms: the band index follows angle + log radius.
    const s = Math.sin(a * 3 + Math.log(r + 0.05) * 5 - turn * (Math.PI / 2));
    if (r < 0.2) return 'a';
    if (s > 0.6) return r > 0.75 ? 'e' : 'd';
    if (s > 0.1) return 'c';
    if (s > -0.5) return 'b';
    return 'a';
  });
  // Foam on the rim.
  p.map((x, y, c) => {
    if (c === '.') return null;
    const dx = (x + 0.5 - cx) / 26;
    const dy = (y + 0.5 - cy) / 20;
    const r = Math.sqrt(dx * dx + dy * dy);
    return r > 0.9 && hash2(x + turn * 3, y, 9) > 0.55 ? 'f' : null;
  });
  // Spray rising above it.
  for (let i = 0; i < 6; i++) {
    const sx = 10 + i * 7 + (turn % 2) * 2;
    const sy = 8 + ((i * 5 + turn * 3) % 5);
    p.set(sx, sy, 'e').set(sx + 1, sy - 1, 'f');
  }
  // The one eye in the middle.
  if (eye === 3) {
    p.line(cx - 4, cy, cx + 4, cy, 'k');
  } else {
    const h = eye === 1 ? 1.5 : eye === 2 ? 4.5 : 3.5;
    p.ellipse(cx, cy, 5, h, 'w');
    p.disc(cx, cy, eye === 1 ? 1 : 2, 'r').set(cx, cy, 'k');
  }
  return p.outline('o').rows();
}

export const UNDERTOW_SPRITE: SpriteDef = {
  id: 'boss.undertow',
  anchorY: 34,
  w: 56,
  h: 56,
  palette: VORTEX_PAL,
  frames: [vortex(0, 0), vortex(1, 0), vortex(2, 0), vortex(3, 0), vortex(1, 1), vortex(2, 2), vortex(3, 3)],
  anims: {
    idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
    move: { frames: [0, 1, 2, 3], fps: 10, loop: true },
    charge: { frames: [0, 1, 2, 3], fps: 16, loop: true },
    windup: { frames: [4], fps: 1, loop: true },
    slam: { frames: [4], fps: 1, loop: true },
    roar: { frames: [5], fps: 1, loop: true },
    air: { frames: [5], fps: 1, loop: true },
    hurt: { frames: [6], fps: 1, loop: true },
  },
};
