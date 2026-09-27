/**
 * The Nestmother (final boss, Ending 2) — the paper-wasp queen of the Hollow Nest, seen from the front:
 * a crown of paper cells, big garnet compound eyes, four papery wings, six legs and a heavy striped
 * abdomen with a stinger. Painted with ./paint.ts (1 px outline). One sprite per phase (the boss hook
 * swaps them when a phase begins), 56×56, the same anchor:
 *
 *   phase 1  Queen's Court   clean amber and black, wings whole, crown intact
 *   phase 2  Swarming        wings torn, a cracked crown, honey oozing from the abdomen, a scowl
 *   phase 3  Hive Fury       the stripes glow ember-red, the eyes burn, wings in tatters, the stinger
 *                            bared and dripping
 *
 * Frames: 0-1 idle (wing beat), 2-3 move (a faster beat, leaning), 4 windup (abdomen raised, stinger
 * out, mandibles open), 5 roar (mandibles wide, antennae back), 6 air (a dive: wings swept, legs
 * tucked, stinger down), 7 hurt (eyes shut, wings drooping — the death sequence).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const W = 56;
const H = 56;
const ANCHOR_Y = 33;
const CX = 28;

const POSE_IDLE = 0;
const POSE_WINDUP = 1;
const POSE_ROAR = 2;
const POSE_AIR = 3;
const POSE_HURT = 4;

interface Pose {
  ph: number;
  /** Wing beat: 0 up, 1 down. */
  flap: number;
  pose: number;
  /** Sideways lean of the whole body (moving), px. */
  lean: number;
  /** Honey drip frame. */
  drip: number;
}

/** A filled ellipse turned by `ang` (rad). */
function rotEllipse(p: Pix, cx: number, cy: number, rx: number, ry: number, ang: number, c: string): void {
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const R = Math.max(rx, ry) + 1;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++) {
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = (dx * cs + dy * sn) / rx;
      const v = (-dx * sn + dy * cs) / ry;
      if (u * u + v * v <= 1) p.set(x, y, c);
    }
  }
}

/** One wing (left side; the right one is mirrored): paper with veins, torn in later phases. */
function wing(p: Pix, cx: number, cy: number, rx: number, ry: number, ang: number, ph: number, seed: number): void {
  const wp = new Pix(W, H);
  rotEllipse(wp, cx, cy, rx, ry, ang, 'w');
  // Veins fan out from the root (the inner end of the wing).
  const cs = Math.cos(ang);
  const sn = Math.sin(ang);
  const rootX = cx + cs * rx * 0.95;
  const rootY = cy + sn * rx * 0.95;
  for (let k = -1; k <= 1; k++) {
    const tx = cx - cs * rx * 0.7 - sn * ry * 0.55 * k;
    const ty = cy - sn * rx * 0.7 + cs * ry * 0.55 * k;
    wp.line(rootX, rootY, tx, ty, 'v');
  }
  // The rim.
  const src = wp.copy();
  wp.map((x, y, c) => (c === 'w' && (!src.on(x - 1, y) || !src.on(x + 1, y) || !src.on(x, y - 1) || !src.on(x, y + 1)) ? 'x' : null));
  // Tears: bites out of the outer edge.
  if (ph > 0) {
    const bites = ph === 1 ? 2 : 4;
    for (let i = 0; i < bites; i++) {
      const t = 0.35 + 0.5 * hash2(i, seed, 11);
      const side = hash2(i, seed, 12) < 0.5 ? -1 : 1;
      const bx = cx - cs * rx * t * 0.9 - sn * ry * 0.8 * side;
      const by = cy - sn * rx * t * 0.9 + cs * ry * 0.8 * side;
      wp.disc(bx, by, 1.4 + ph * 0.5, '.');
    }
    if (ph === 2) wp.disc(cx - cs * rx * 0.2, cy - sn * rx * 0.2 + 1, 1.2, '.');
  }
  p.paste(wp, 0, 0);
}

function wasp(pose: Pose): string[] {
  const p = new Pix(W, H);
  const ph = pose.ph;
  const air = pose.pose === POSE_AIR;
  const hurt = pose.pose === POSE_HURT;
  const lx = pose.lean;
  // ── Wings (behind everything): long, narrow, raised up and out from the shoulders ──
  const upA = air ? 0.15 : hurt ? -0.35 : pose.flap === 0 ? 0.75 : 0.38;
  const lowA = air ? 0 : hurt ? -0.5 : pose.flap === 0 ? 0.3 : -0.05;
  const half = new Pix(W, H);
  const wingAt = (rootX: number, rootY: number, len: number, wide: number, ang: number, seed: number): void => {
    wing(half, rootX - Math.cos(ang) * len, rootY - Math.sin(ang) * len, len, wide, ang, ph, seed);
  };
  wingAt(22 + lx, 24, 9.5, 3, lowA, 2);
  wingAt(22 + lx, 20, 12.5, 3.6, upA, 1);
  // Mirror the left pair onto the right (keeping the left as painted).
  for (let y = 0; y < H; y++) for (let x = 0; x < CX; x++) if (half.on(x, y)) p.set(x, y, half.get(x, y)).set(2 * CX - 1 - x + 2 * lx, y, half.get(x, y));

  // ── Legs ──
  const legs: readonly (readonly number[])[] = air
    ? [
        [22, 25, 19, 28, 20, 31],
        [23, 28, 20, 32, 22, 35],
        [24, 31, 22, 35, 24, 38],
      ]
    : [
        [22, 24, 16, 29, 14, 35],
        [23, 27, 17, 34, 16, 41],
        [24, 30, 19, 38, 19, 45],
      ];
  for (const l of legs) {
    for (const s of [1, -1]) {
      const X = (x: number): number => (s > 0 ? x : 2 * CX - 1 - x) + lx;
      p.line(X(l[0]!), l[1]!, X(l[2]!), l[3]!, 'K').line(X(l[2]!), l[3]!, X(l[4]!), l[5]!, 'K');
      p.set(X(l[2]!), l[3]!, 'L').set(X(l[4]!) + (s > 0 ? -1 : 1), l[5]!, 'K');
    }
  }

  // ── Abdomen ──
  const raise = pose.pose === POSE_WINDUP ? -3 : hurt ? 2 : 0;
  const ay = 38 + raise;
  const arx = ph === 2 ? 10.2 : 9.5;
  const ary = ph === 2 ? 12.4 : 12;
  // A wasp's abdomen: full at the top, tapering to the sting.
  p.map((x, y) => {
    const t = (y + 0.5 - ay) / ary;
    if (t < -1 || t > 1) return null;
    const hw = arx * Math.sqrt(1 - t * t) * (1 - 0.38 * Math.max(0, t));
    return Math.abs(x + 0.5 - CX - lx) <= hw ? 'A' : null;
  });
  p.map((x, y, c) => {
    if (c !== 'A') return null;
    // Bands bow downward with the curve of the body.
    const u = (x + 0.5 - CX - lx) / arx;
    const band = (y - (ay - ary) - u * u * 3 + 60) % 6;
    if (y > ay - ary + 4) {
      if (ph === 2 && band < 3) return band === 1 && Math.abs(u) < 0.7 ? 'G' : 'F';
      if (ph < 2 && band < 2) return 'K';
    }
    if (x < CX + lx - arx * 0.5) return 'B';
    if (x > CX + lx + arx * 0.55) return 'C';
    return null;
  });
  // The narrow waist.
  p.rect(CX + lx - 1, ay - ary - 2, 3, 4, 'L');
  // The stinger.
  const sy = ay + ary - 1;
  const sting = pose.pose === POSE_WINDUP || air || ph === 2 ? 5 : 3;
  for (let i = 0; i < sting; i++) {
    const wdt = Math.max(0, Math.round((sting - i) / 2) - 1);
    p.rect(CX + lx - wdt, sy + i, wdt * 2 + 1, 1, i === sting - 1 ? 'S' : 'k');
  }
  p.set(CX + lx, sy + sting - 1, 'S');
  // Honey oozing down the abdomen (phase 2+) — and venom on the stinger (phase 3).
  if (ph > 0) {
    const d = pose.drip & 1;
    const ooze = (x: number, y: number, len: number): void => {
      p.rect(x, y, 3, 2, 'H').rect(x + 1, y + 2, 2, len, 'H').set(x + 1, y, 'h').set(x + 2, y + 2 + len, 'H');
      p.set(x + 2, y + 3 + len + d, 'h');
    };
    ooze(CX + lx - 8, ay + 3, 3 + d);
    ooze(CX + lx + 4, ay + 6, 2 + (1 - d));
  }
  if (ph === 2) p.set(CX + lx, sy + sting, 'P').set(CX + lx, sy + sting + 1 + (pose.drip & 1), 'P');

  // ── Thorax ──
  p.ellipse(CX + lx, 22, 7, 5, 'L');
  p.map((x, y, c) => (c === 'L' && hash2(x, y, 6) > 0.8 ? 'l' : null));
  p.disc(CX + lx - 4.5, 21, 1.6, 'A').disc(CX + lx + 4.5, 21, 1.6, 'A');
  // ── Head ──
  const hy = 12;
  p.ellipse(CX + lx, hy, 8.4, 6.8, 'A');
  p.map((x, y, c) => (c === 'A' && y < hy - 3 ? 'K' : c === 'A' && x < CX + lx - 4 && y < hy + 2 ? 'B' : null));
  // The wasp's forehead mark.
  p.rect(CX + lx - 1, hy - 3, 3, 1, 'K').set(CX + lx, hy - 2, 'K').set(CX + lx, hy - 1, 'K');
  // Big glossy compound eyes.
  const eyeC = ph === 2 ? 'G' : 'r';
  const eyeD = ph === 2 ? 'F' : 'q';
  for (const s of [-1, 1]) {
    const ex = CX + lx + s * 5.4;
    if (hurt) {
      p.line(ex - 2, hy + 1, ex + 2, hy, 'k');
      continue;
    }
    p.ellipse(ex, hy + 0.5, 3.3, pose.pose === POSE_ROAR ? 5 : 4.6, eyeC);
    p.map((x, y, c) => (c === eyeC && y > hy + 1 && (x + y) % 2 === 0 ? eyeD : null));
    p.rect(ex - (s > 0 ? 1 : 2), hy - 2, 2, 2, 'Y').set(ex - (s > 0 ? -1 : 0), hy + 2, 'R');
    // A scowl from phase 2 on.
    if (ph > 0) p.line(ex - 3 * s, hy - 5, ex + 2 * s, hy - 3, 'K').line(ex - 3 * s, hy - 4, ex + 1 * s, hy - 3, 'K');
  }
  // Mandibles.
  const open = pose.pose === POSE_ROAR ? 3 : pose.pose === POSE_WINDUP ? 2 : 0;
  for (const s of [-1, 1]) {
    const mx = CX + lx + s * 2;
    p.line(mx, hy + 5, mx + s * (1 + open), hy + 8, 's').set(mx + s * (1 + open), hy + 8, 'K');
    p.set(mx + s * (1 + open) - s, hy + 8, 's');
  }
  if (open > 1) p.rect(CX + lx - 1, hy + 5, 3, 2, 'k');
  // Antennae (swept back when roaring or diving, limp when hurt).
  for (const s of [-1, 1]) {
    const bx = CX + lx + s * 2.5;
    const back = pose.pose === POSE_ROAR || air;
    const tx = bx + s * (back ? 10 : 7);
    const ty = hurt ? hy - 2 : back ? hy - 7 : hy - 11;
    p.line(bx, hy - 5, tx, ty, 'K');
    p.set(tx + s, ty + (hurt ? 1 : 1), 'K').set(tx + s, ty + 2, 'K');
  }
  // The crown: a ring of paper cells, the middle one tallest.
  const cy = hy - 6;
  for (let k = -2; k <= 2; k++) {
    const x0 = CX + lx + k * 3 - 1;
    const h = 5 - Math.abs(k) - (ph > 0 && k === 1 ? 2 : 0);
    p.rect(x0, cy - h, 3, h + 1, 'y');
    p.set(x0, cy - h, 'Y').set(x0 + 1, cy - h, 'u');
    p.set(x0 + 2, cy, 'u');
  }
  // Phase 2+: one cell crumpled, a crack down the crown.
  if (ph > 0) p.set(CX + lx + 2, cy - 1, 'k').set(CX + lx + 3, cy - 2, 'k');
  return p.outline('o').rows();
}

const COMMON = {
  o: OUTLINE,
  K: '#2a1c14',
  L: '#4a3424',
  l: '#6a4c34',
  k: '#140e10',
  s: '#f4e8c8',
  S: '#d8dcec',
  y: '#e8d6a8',
  Y: '#fffbe8',
  u: '#a08a60',
  v: '#b8ac92',
  x: '#cfc4a8',
  H: '#e89a22',
  h: '#ffcf57',
};

const PALETTES = [
  // Queen's Court: glossy dark eyes.
  { ...COMMON, A: '#e8a430', B: '#ffd070', C: '#b87818', w: '#efe9dcb8', r: '#3a1c34', q: '#5c2a4c', R: '#c86a8a', F: '#e05a2a', G: '#ffb040', P: '#b8f070' },
  // Swarming: a deeper amber, honey everywhere, the eyes gone red.
  { ...COMMON, A: '#e0901e', B: '#f8c050', C: '#a86410', w: '#e6dcc8b0', r: '#8a1424', q: '#4a0a18', R: '#ff6a6a', F: '#e05a2a', G: '#ffb040', P: '#b8f070' },
  // Hive Fury: burnt amber, smouldering stripes, burning eyes.
  { ...COMMON, A: '#a85a16', B: '#c87a2a', C: '#6a3a10', w: '#dccdb4a8', r: '#c0202a', q: '#6a1020', R: '#ffe0a0', F: '#ff5a1e', G: '#ffd060', P: '#c8ff7a', Y: '#fffbe0' },
];

function frames(ph: number): string[][] {
  return [
    wasp({ ph, flap: 0, pose: POSE_IDLE, lean: 0, drip: 0 }),
    wasp({ ph, flap: 1, pose: POSE_IDLE, lean: 0, drip: 1 }),
    wasp({ ph, flap: 0, pose: POSE_IDLE, lean: 1, drip: 0 }),
    wasp({ ph, flap: 1, pose: POSE_IDLE, lean: 1, drip: 1 }),
    wasp({ ph, flap: 1, pose: POSE_WINDUP, lean: 0, drip: 0 }),
    wasp({ ph, flap: 0, pose: POSE_ROAR, lean: 0, drip: 1 }),
    wasp({ ph, flap: 0, pose: POSE_AIR, lean: 0, drip: 0 }),
    wasp({ ph, flap: 1, pose: POSE_HURT, lean: 0, drip: 1 }),
  ];
}

const ANIMS = {
  idle: { frames: [0, 1], fps: 10, loop: true },
  move: { frames: [2, 3], fps: 14, loop: true },
  charge: { frames: [6], fps: 1, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5, 1], fps: 12, loop: true },
  air: { frames: [6, 0], fps: 16, loop: true },
  hurt: { frames: [7], fps: 1, loop: true },
};

function sprite(ph: number): SpriteDef {
  return { id: `boss.nestmother.${ph + 1}`, w: W, h: H, anchorY: ANCHOR_Y, palette: PALETTES[ph]!, frames: frames(ph), anims: ANIMS };
}

export const NESTMOTHER_1: SpriteDef = sprite(0);
export const NESTMOTHER_2: SpriteDef = sprite(1);
export const NESTMOTHER_3: SpriteDef = sprite(2);
/** By phase index. */
export const NESTMOTHER_PHASES: readonly SpriteDef[] = [NESTMOTHER_1, NESTMOTHER_2, NESTMOTHER_3];
