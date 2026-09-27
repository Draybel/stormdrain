/**
 * Boss pack C — The Hollow Nest (chapter 6 alt) and Rust Foundry sprites, painted with ./paint.ts
 * (+ bossesCPaint.ts). 1 px dark outline, lit from the top-left, side views face RIGHT. Later phases
 * swap in their own sprites (content/hooks/bosses-c.ts).
 *
 *   Ambergut     52×36  a colossal wasp grub, pale and segmented, its belly glowing with amber.
 *                       Pupating (phase 2, 40×48): a cocoon of chewed paper with amber cracks and two
 *                       eyes peering out of the top. Hatched (phase 3, 48×44): a scruffy half-formed
 *                       wasp with crumpled paper wings, still wearing bits of its cocoon.
 *   Slagjacket   32×28  a yellowjacket forged from iron plates and molten slag (miniboss, the Rust
 *                       Foundry / the Hollow Nest). Overheated: the plates fall away, the core glows
 *                       white-hot, a wing droops.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, bossSprite, crack, curve, hash2, poly } from './bossesCPaint';

const o = OUTLINE;

// ── Ambergut ──────────────────────────────────────────────────────────────────

const GRUB_PAL = {
  o,
  G: '#f4e8c8',
  g: '#d8c8a0',
  h: '#a8906a',
  A: '#f0a830',
  a: '#ffe08a',
  d: '#b87010',
  H: '#c8a878',
  j: '#8a6a44',
  M: '#6a4020',
  k: '#1a1010',
  w: '#fff8e8',
  P: '#d8d0c0',
  p: '#8a8070',
  q: '#5a5048',
  E: '#ff8a30',
  e: '#ffe08a',
  K: '#2a1c14',
  L: '#4a3424',
  W: '#e8e4d8a0',
  V: '#fbf8ee',
  R: '#e0503a',
  N: '#7a4a24',
  n: '#a8703a',
};

interface GrubPose {
  /** Breath (segments swell, px). */
  breathe: number;
  /** Wriggle wave phase (rad) and strength (px). */
  wave: number;
  wiggle: number;
  /** Head raised (px). */
  rear: number;
  /** Mandibles: 0 shut, 1 open, 2 wide. */
  jaw: number;
  /** Flattened (slam) 0..1. */
  flat: number;
  shut: boolean;
}

function grub(pose: GrubPose): string[] {
  const W = 52;
  const H = 36;
  const p = new Pix(W, H);
  // The body follows an arched hump: the tail tucked low on the left, the back high, the head low on
  // the right. at(t) = the arc point for t (0 tail … 1 neck), its body radius and outward normal.
  const squash = 1 - pose.flat * 0.25;
  const at = (t: number): [number, number, number, number, number] => {
    const th = Math.PI * (1.1 + 0.8 * t) + Math.sin(t * 5 + pose.wave) * 0.06 * pose.wiggle;
    const x = 23 + 19.5 * Math.cos(th);
    const y = 34.5 + 21 * Math.sin(th) * squash - (t > 0.75 ? (t - 0.75) * pose.rear * 3 : 0);
    const r = (3.8 + 6.8 * Math.sin(Math.PI * Math.min(1, t * 1.08) * 0.86)) * (1 + pose.breathe * 0.05) * (t > 0.9 ? 0.9 : 1);
    return [x, y, r, Math.cos(th), Math.sin(th)];
  };
  for (let i = 0; i <= 40; i++) {
    const [x, y, r] = at(i / 40);
    p.ellipse(x + 0.5, y + 0.5, r, r * squash + (1 - squash) * 2, 'g');
  }
  // The lit back over a shadowed belly rim.
  for (let i = 0; i <= 40; i++) {
    const [x, y, r, nx, ny] = at(i / 40);
    p.map((px, py, c) => (c === 'g' && Math.hypot(px + 0.5 - (x + nx * 1.6 + 0.5), py + 0.5 - (y + ny * 1.6 + 0.5)) <= r - 1.3 ? 'G' : null));
  }
  // The amber gut glowing through the skin along the belly side.
  for (let i = 0; i <= 24; i++) {
    const t = 0.22 + (i / 24) * 0.55;
    const [x, y, r, nx, ny] = at(t);
    const gx = x - nx * r * 0.25;
    const gy = y - ny * r * 0.25;
    p.map((px, py, c) => {
      if (c !== 'G' && c !== 'A' && c !== 'a') return null;
      const d = Math.hypot(px + 0.5 - gx, py + 0.5 - gy) / (r * 0.36);
      if (d > 1) return null;
      return d < 0.4 || c === 'a' ? 'a' : 'A';
    });
  }
  // Segment creases across the body (a soft light band behind each).
  for (let i = 1; i <= 8; i++) {
    const [x, y, r, nx, ny] = at(i / 9);
    const [tx, ty] = [-ny, nx];
    for (let k = -r * 0.2; k <= r; k += 0.5) {
      const px = Math.round(x + nx * k);
      const py = Math.round(y + ny * k);
      const c = p.get(px, py);
      if (c === 'G' || c === 'A' || c === 'a') p.set(px, py, c === 'G' ? 'h' : 'd');
      const lx = Math.round(x + nx * k - tx);
      const ly = Math.round(y + ny * k - ty);
      if (p.get(lx, ly) === 'G') p.set(lx, ly, 'w');
    }
  }
  p.map((x, y, c) => (c === 'A' && hash2(x, y, 4) > 0.9 ? 'd' : null));
  // A few bristles.
  p.map((x, y, c) => (c === 'G' && hash2(x, y, 9) > 0.95 ? 'h' : null));
  // Stubby legs on the inside of the curl near the head.
  for (const t of [0.72, 0.8, 0.88]) {
    const [x, y, r, nx, ny] = at(t);
    const bx = x - nx * r;
    const by = y - ny * r;
    const kick = pose.wiggle > 0 && Math.sin(pose.wave + t * 20) > 0 ? 1 : 0;
    p.line(Math.round(bx), Math.round(by), Math.round(bx - nx * 2 + kick), Math.round(by - ny * 2), 'M');
  }
  // Paper scraps stuck to its back.
  for (const t of [0.28, 0.55]) {
    const [x, y, r, nx, ny] = at(t);
    const sx = Math.round(x + nx * (r - 1.5)) - 1;
    const sy = Math.round(y + ny * (r - 1.5)) - 1;
    p.rect(sx, sy, 4, 3, 'P');
    p.set(sx + 1, sy + 1, 'p').set(sx + 2, sy + 1, 'p');
  }
  // The head: a hard brown capsule with pincers.
  const [nx0, ny0] = at(1);
  const hx = Math.round(nx0 + 2);
  const hy = Math.round(ny0 - 2 - pose.rear * 0.6);
  p.ellipse(hx + 0.5, hy + 0.5, 5.4, 5, 'N');
  p.map((x, y, c) => (c === 'N' && x < hx - 1 && y < hy ? 'n' : null));
  const open = pose.jaw;
  curve(p, hx + 3, hy - 1, hx + 6, hy - 3 - open, hx + 7, hy + 1 - open * 0.5, 1.8, 1, 'K');
  curve(p, hx + 3, hy + 3, hx + 6, hy + 5 + open, hx + 7, hy + 2 + open * 0.5, 1.8, 1, 'K');
  if (open > 0) p.ellipse(hx + 5, hy + 1.5, 1.4, open * 0.8 + 0.4, 'k');
  if (pose.shut) p.line(hx - 1, hy - 1, hx + 1, hy - 1, 'k');
  else p.rect(hx, hy - 2, 2, 2, 'k').set(hx + 1, hy - 2, 'w');
  p.set(hx + 5, hy + 6 + open, 'A').set(hx + 5, hy + 7 + open, 'a');
  p.shade('G', 'w', 'g');
  return p.outline('o').rows();
}

const GRUB_POSES: GrubPose[] = [
  { breathe: 0, wave: 0, wiggle: 0, rear: 0, jaw: 0, flat: 0, shut: false },
  { breathe: 1, wave: 0, wiggle: 0, rear: 0, jaw: 0, flat: 0, shut: false },
  { breathe: 0, wave: 0, wiggle: 1.4, rear: 0, jaw: 0, flat: 0, shut: false },
  { breathe: 0, wave: Math.PI, wiggle: 1.4, rear: 1, jaw: 0, flat: 0, shut: false },
  { breathe: 1, wave: 1, wiggle: 0.6, rear: 5, jaw: 1, flat: 0, shut: false },
  { breathe: 1, wave: 0.5, wiggle: 0, rear: 4, jaw: 2, flat: 0, shut: false },
  { breathe: 0, wave: 0, wiggle: 0, rear: 0, jaw: 1, flat: 1, shut: false },
  { breathe: 0, wave: 2, wiggle: 0.8, rear: -1, jaw: 0, flat: 0.6, shut: true },
];

export const AMBERGUT_SPRITE: SpriteDef = bossSprite('boss.ambergut', 52, 36, 26, GRUB_PAL, GRUB_POSES.map(grub), {
  idle: [0, 1],
  move: [2, 3],
  windup: [4],
  roar: [5],
  slam: [6],
  air: [5],
  hurt: [7],
  fps: { idle: 2, move: 5 },
});

// Pupating: a cocoon of chewed paper.

interface CocoonPose {
  /** Crack glow: 0 dim, 1 bright. */
  glow: number;
  /** Shudder (px). */
  shake: number;
  /** Top split open (px). */
  split: number;
  /** 0 peering, 1 wide, 2 screaming, 3 shut. */
  eyes: number;
  /** Squash 0..1. */
  squash: number;
}

function cocoon(pose: CocoonPose): string[] {
  const W = 40;
  const H = 48;
  const p = new Pix(W, H);
  const cx = 20 + pose.shake;
  const cy = 26 + pose.squash * 2;
  const rx = 12.5 + pose.squash * 1.2;
  const ry = 19.5 - pose.squash * 2;
  p.ellipse(cx, cy, rx, ry, 'P');
  // Paper wrapped round and round: slanted bands with dark seams.
  p.map((x, y, c) => {
    if (c !== 'P') return null;
    const band = Math.floor((y + (x - cx) * 0.35 + 40) / 4);
    const edge = (y + (x - cx) * 0.35 + 40) % 4;
    if (edge < 0.9) return 'q';
    return band % 2 === 0 ? 'P' : 'p';
  });
  // Lit left side, shadowed right.
  p.map((x, y, c) => (c === 'p' && x < cx - rx * 0.55 ? 'P' : c === 'P' && x > cx + rx * 0.6 ? 'p' : null));
  // Amber cracks.
  const lit = pose.glow > 0 ? 'a' : 'A';
  crack(p, cx - 5, cy - 6, 1.4, 16, 'A', 'Ppq', 61, lit);
  crack(p, cx + 4, cy - 2, 1.9, 13, 'A', 'Ppq', 62, lit);
  crack(p, cx - 2, cy + 8, 0.9, 10, 'd', 'Ppq', 63, pose.glow > 0 ? 'A' : '');
  // The top: an opening with the eyes peering out.
  const ty = cy - ry + 5 - pose.split * 0.5;
  p.ellipse(cx, ty, 5 + pose.split * 0.6, 2.8 + pose.split * 0.5, 'k');
  if (pose.eyes === 3) p.line(Math.round(cx - 3), Math.round(ty), Math.round(cx + 2), Math.round(ty), 'L');
  else {
    const h = pose.eyes === 0 ? 1 : 2;
    p.rect(Math.round(cx - 3), Math.round(ty - (h - 1)), 2, h, 'E').rect(Math.round(cx + 1), Math.round(ty - (h - 1)), 2, h, 'E');
    p.set(Math.round(cx - 3), Math.round(ty - (h - 1)), 'e');
    if (pose.eyes === 2) p.rect(Math.round(cx - 1), Math.round(ty + 1), 2, 1, 'R');
  }
  // Ragged paper flaps round the opening and loose threads at the bottom.
  p.set(Math.round(cx - 6), Math.round(ty - 2), 'P').set(Math.round(cx + 5), Math.round(ty - 3), 'P').set(Math.round(cx + 6), Math.round(ty - 2), 'p');
  for (const x of [cx - 6, cx - 1, cx + 5]) {
    const bx = Math.round(x);
    const by = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))) - 1;
    p.line(bx, by, bx + (pose.shake > 0 ? 1 : 0), Math.min(H - 2, by + 3), 'p');
  }
  return p.outline('o').rows();
}

const COCOON_POSES: CocoonPose[] = [
  { glow: 0, shake: 0, split: 0, eyes: 0, squash: 0 },
  { glow: 1, shake: 0, split: 0, eyes: 0, squash: 0 },
  { glow: 0, shake: 1, split: 0, eyes: 0, squash: 0 },
  { glow: 1, shake: -1, split: 0, eyes: 0, squash: 0 },
  { glow: 1, shake: 0, split: 1, eyes: 1, squash: 0.3 },
  { glow: 1, shake: 0, split: 3, eyes: 2, squash: 0 },
  { glow: 1, shake: 0, split: 1, eyes: 1, squash: 1 },
  { glow: 0, shake: 0, split: 0, eyes: 3, squash: 0.4 },
];

export const AMBERGUT_PUPA_SPRITE: SpriteDef = bossSprite('boss.ambergut.pupa', 40, 48, 38, GRUB_PAL, COCOON_POSES.map(cocoon), {
  idle: [0, 1],
  move: [2, 3],
  windup: [4],
  roar: [5],
  slam: [6],
  air: [5],
  hurt: [7],
  fps: { idle: 3, move: 10 },
});

// Hatched: a scruffy young wasp.

interface WaspPose {
  /** Wing flap: -1 up … 1 down. */
  flap: number;
  /** Abdomen curled forward (stinger up), px. */
  curl: number;
  /** Mandibles open. */
  jaw: number;
  shut: boolean;
}

function hatchling(pose: WaspPose): string[] {
  const W = 48;
  const H = 44;
  const p = new Pix(W, H);
  // Crumpled paper wings behind (the left one bigger, both torn).
  const wy = 10 + pose.flap * 4;
  poly(p, [25, 16, 14, wy - 7, 5, wy - 4, 3, wy + 1, 9, wy + 3, 7, wy + 6, 16, wy + 5, 24, 19], 'W');
  poly(p, [28, 15, 33, wy - 9, 40, wy - 8, 38, wy - 4, 42, wy - 2, 34, wy + 2, 29, 18], 'W');
  for (const [x0, y0, x1, y1] of [
    [24, 17, 8, wy - 2],
    [23, 18, 12, wy + 4],
    [29, 16, 37, wy - 6],
  ] as const) {
    p.line(x0, y0, x1, y1, 'V');
  }
  // Legs dangling.
  for (const [x, dx] of [
    [24, -2],
    [27, 0],
    [30, 2],
  ] as const) {
    p.line(x, 24, x + dx, 31, 'K');
    p.line(x + dx, 31, x + dx + 1, 34, 'K');
  }
  // The abdomen: amber and black bands, stinger at the back (curls forward on the telegraph).
  const ax = 14;
  const ay = 27 - pose.curl * 0.4;
  p.ellipse(ax + 0.5, ay + 0.5, 11, 7.5, 'A');
  p.map((x, y, c) => (c === 'A' && Math.floor((x + (y - ay) * 0.3 + 40) / 4) % 2 === 0 ? 'K' : null));
  p.map((x, y, c) => (c === 'A' && y < ay - 3 ? 'a' : null));
  const sx = 3;
  const sy = Math.round(ay + 3 - pose.curl);
  poly(p, [sx + 3, sy - 2, sx - 3, sy + 1 - pose.curl * 0.3, sx + 3, sy + 2], 'K');
  // Bits of cocoon still stuck to it.
  p.rect(10, Math.round(ay - 7), 4, 2, 'P').set(11, Math.round(ay - 6), 'p');
  p.rect(18, Math.round(ay + 5), 3, 2, 'P');
  // Thorax (fuzzy) and head.
  p.ellipse(27.5, 20.5, 6, 5.2, 'L');
  p.map((x, y, c) => (c === 'L' && hash2(x, y, 5) > 0.7 ? 'K' : null));
  p.disc(35.5, 15.5, 6, 'A');
  p.map((x, y, c) => (c === 'A' && x > 33 && y > 18 ? 'd' : null));
  // A big compound eye.
  if (pose.shut) p.line(35, 13, 39, 13, 'k');
  else {
    p.ellipse(37.5, 13.5, 3, 3.6, 'E');
    p.set(37, 12, 'e').set(38, 14, 'R').set(36, 15, 'R');
  }
  // Mandibles and drool.
  curve(p, 39, 18, 43, 17 - pose.jaw, 44, 20 - pose.jaw, 1.6, 1, 'M');
  curve(p, 38, 20, 41, 22 + pose.jaw, 43, 21 + pose.jaw, 1.6, 1, 'M');
  p.set(41, 23 + pose.jaw, 'A').set(41, 24 + pose.jaw, 'a');
  // Antennae.
  curve(p, 34, 10, 36, 4, 41, 2, 1, 1, 'K');
  curve(p, 32, 10, 31, 4, 34, 1, 1, 1, 'K');
  p.shade('A', 'a', 'd');
  return p.outline('o').rows();
}

const WASP_POSES: WaspPose[] = [
  { flap: -1, curl: 0, jaw: 0, shut: false },
  { flap: 1, curl: 0, jaw: 0, shut: false },
  { flap: -1, curl: 1, jaw: 1, shut: false },
  { flap: 0.5, curl: 1, jaw: 0, shut: false },
  { flap: 0, curl: 6, jaw: 1, shut: false },
  { flap: -1, curl: 2, jaw: 3, shut: false },
  { flap: 1, curl: 0, jaw: 0, shut: true },
];

export const AMBERGUT_HATCHED_SPRITE: SpriteDef = bossSprite('boss.ambergut.hatched', 48, 44, 30, GRUB_PAL, WASP_POSES.map(hatchling), {
  idle: [0, 1],
  move: [2, 3],
  charge: [0, 3, 1, 3],
  windup: [4],
  roar: [5],
  slam: [4],
  air: [0, 1],
  hurt: [6],
  fps: { idle: 10, move: 14, charge: 18, air: 14 },
});

// ── Slagjacket (miniboss) ─────────────────────────────────────────────────────

const SLAG_PAL = {
  o,
  I: '#4a4a58',
  i: '#2e2e3a',
  J: '#7a7a8c',
  j: '#a0a0b4',
  O: '#ff8a30',
  Y: '#ffd060',
  W: '#fff0c0',
  r: '#c04818',
  E: '#ffb030',
  e: '#fff0a0',
  w: '#9aa2b8',
  v: '#6a7288',
  S: '#5a5260',
  s: '#7a7280',
};

interface SlagPose {
  /** Wing flap: -1 up … 1 down. */
  flap: number;
  /** Stinger curled forward (px). */
  curl: number;
  /** Smoke puff phase. */
  puff: number;
  /** Eye: 0 lit, 1 narrowed, 2 flaring, 3 dark. */
  eye: number;
}

function slag(pose: SlagPose, hot: boolean): string[] {
  const W = 32;
  const H = 28;
  const p = new Pix(W, H);
  // Metal-plate wings (behind), riveted; the front one droops when overheated.
  const wy = 6 + pose.flap * 2;
  p.ellipse(14.5, wy + 0.5, 7, 2.8, 'w');
  p.ellipse(19.5, wy - 0.5 + (hot ? 2 : 0), 6.5, 2.6, 'v');
  p.set(12, wy, 'J').set(16, wy, 'J').set(18, wy - 1 + (hot ? 2 : 0), 'J').set(22, wy - 1 + (hot ? 2 : 0), 'J');
  // Legs.
  p.line(17, 17, 16, 22, 'i').line(20, 18, 20, 23, 'i').line(22, 17, 24, 22, 'i');
  // The abdomen: iron plates with glowing slag seams.
  const ax = 9.5;
  const ay = 17.5 - pose.curl * 0.3;
  p.ellipse(ax, ay, 8.5, 6, 'I');
  p.map((x, y, c) => {
    if (c !== 'I' || y < ay - 7 || y > ay + 7) return null;
    const k = (x + Math.round((y - ay) * 0.4) + 30) % 4;
    if (hot) return k === 0 ? 'r' : hash2(x, y, 3) > 0.35 ? 'O' : 'Y';
    return k === 0 ? 'O' : null;
  });
  if (hot) p.ellipse(ax + 1, ay, 3.5, 2.5, 'W');
  // Stinger.
  const sy = Math.round(ay + 3 - pose.curl);
  poly(p, [3, sy - 1.5, -1, sy + 1 - pose.curl * 0.2, 3, sy + 2], 'J');
  // Thorax, riveted.
  p.ellipse(19.5, 13.5, 5, 4.5, 'I');
  p.set(18, 12, 'j').set(21, 12, 'j').set(19, 15, 'j');
  if (hot) p.line(17, 14, 22, 13, 'O');
  // Head with a glowing visor eye.
  p.disc(25.5, 10.5, 4.5, 'I');
  if (pose.eye === 3) p.line(26, 10, 29, 10, 'i');
  else {
    const g = pose.eye === 2 || hot ? 'e' : 'E';
    p.ellipse(27.5, 10, 2.6, pose.eye === 1 ? 0.9 : 2, g);
    p.set(28, 9, pose.eye === 2 || hot ? 'W' : 'e');
  }
  // Mandibles and antennae.
  p.line(29, 13, 31, 14, 'J').line(28, 14, 30, 15, 'J');
  p.line(24, 6, 26, 1, 'i').line(26, 6, 30, 2, 'i');
  // Smoke puffs over the abdomen.
  for (let i = 0; i < 2; i++) {
    const x = Math.round(6 + i * 5 + Math.sin(pose.puff + i) * 1.5);
    const y = Math.round(9 - ((pose.puff * 2 + i * 3) % 5));
    if (!p.on(x, y) && !p.on(x + 1, y)) p.set(x, y, 'S').set(x + 1, y, i ? 's' : 'S');
  }
  if (hot) {
    for (let i = 0; i < 3; i++) {
      const x = Math.round(3 + hash2(i, Math.round(pose.puff * 3), 5) * 20);
      const y = Math.round(4 + hash2(i, 7, Math.round(pose.puff * 3)) * 6);
      if (!p.on(x, y)) p.set(x, y, 'Y');
    }
  }
  p.shade('I', 'J', 'i');
  return p.outline('o').rows();
}

const SLAG_POSES: SlagPose[] = [
  { flap: -1, curl: 0, puff: 0, eye: 0 },
  { flap: 1, curl: 0, puff: 1.5, eye: 0 },
  { flap: -1, curl: 1, puff: 3, eye: 0 },
  { flap: 1, curl: 1, puff: 4.5, eye: 0 },
  { flap: 0, curl: 5, puff: 1, eye: 1 },
  { flap: -1, curl: 2, puff: 2, eye: 2 },
  { flap: 1, curl: 0, puff: 0.5, eye: 3 },
];
const SLAG_ANIMS = { idle: [0, 1], move: [2, 3], charge: [2, 3], windup: [4], roar: [5], slam: [4], air: [0, 1], hurt: [6], fps: { idle: 12, move: 16, charge: 20, air: 16 } };

export const SLAGJACKET_SPRITE: SpriteDef = bossSprite('boss.slagjacket', 32, 28, 19, SLAG_PAL, SLAG_POSES.map((q) => slag(q, false)), SLAG_ANIMS);
export const SLAGJACKET_OVERHEATED_SPRITE: SpriteDef = bossSprite(
  'boss.slagjacket.overheated',
  32,
  28,
  19,
  SLAG_PAL,
  SLAG_POSES.map((q) => slag(q, true)),
  SLAG_ANIMS,
);

