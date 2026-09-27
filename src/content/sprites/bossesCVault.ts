/**
 * Boss pack C — The Frostbitten Vault (chapter 5 alt) and the Glimmer Grotto sprites, painted with
 * ./paint.ts (+ bossesCPaint.ts). 1 px dark outline, lit from the top-left, side views face RIGHT.
 * Each has a second sprite for its later phase (swapped in by content/hooks/bosses-c.ts).
 *
 *   Hoarquill      48×40  a round frost hedgehog whose icicle quills are stuck full of frozen coins;
 *                         it curls into a spiky ball to roll. Shedding: quills snapped, coins falling,
 *                         frost cracks, red-rimmed eyes, puffs of cold breath.
 *   The Vaultwarden 40×54 an empty suit of frozen armour with a giant key for a sword and a vault-dial
 *                         shield. Cracked Plate: the helm splits and a pale draught of light spills out,
 *                         a pauldron is gone, the breastplate is cracked, the key is chipped.
 *   Shiverwing     36×26  a frost bat with crystal-studded wings (miniboss, Glimmer Grotto / the Vault).
 *                         Shattering: the crystals crack and glow pink, a wing is torn.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, bossSprite, crack, hash2, poly, repaint, thick } from './bossesCPaint';

const o = OUTLINE;

// ── Hoarquill ───────────────────────────────────────────────────────────────

const QUILL_PAL = {
  o,
  F: '#8fbcd8',
  f: '#5a88a8',
  G: '#d0ecfa',
  Q: '#effcff',
  q: '#9fd4ee',
  u: '#4a7ea8',
  C: '#ffd35a',
  c: '#c89c3c',
  D: '#ff6ad8',
  N: '#ff8a9a',
  n: '#f0a0b8',
  k: '#10122a',
  w: '#ffffff',
  m: '#2a1020',
  t: '#e05a78',
  P: '#6a7a9a',
  p: '#46526e',
  R: '#ff4a5a',
  X: '#35607e',
  W: '#f4fbff',
};

const QUILL_PAL_2 = repaint(QUILL_PAL, { F: '#9cc6de', f: '#62869e', G: '#e4f4fc' });

interface QuillPose {
  /** Breath (body swells, px). */
  breathe: number;
  /** Feet: 0 planted, 1 front up, 2 back up. */
  step: number;
  /** Quill length bonus (px; raised on telegraphs, negative = flattened). */
  bristle: number;
  /** 0 shut, 1 open (roar). */
  mouth: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Rolled into a ball: the roll angle (rad), or -1 = standing. */
  roll: number;
}

function hoarquill(pose: QuillPose, shed: boolean): string[] {
  const W = 48;
  const H = 40;
  const p = new Pix(W, H);
  if (pose.roll >= 0) {
    // Curled up: a spiky ball of quills with a nose peeking out.
    const cx = 24;
    const cy = 22;
    const n = 20;
    for (let i = 0; i < n; i++) {
      const a = pose.roll + (i / n) * Math.PI * 2;
      const snapped = shed && hash2(i, 7, 1) > 0.45;
      const len = (snapped ? 4 : 8) + hash2(i, 3, 2) * 2;
      const bx = cx + Math.cos(a) * 9;
      const by = cy + Math.sin(a) * 9;
      thick(p, bx, by, bx + Math.cos(a) * len * 0.55, by + Math.sin(a) * len * 0.55, 2.2, 'q');
      thick(p, bx + Math.cos(a) * len * 0.5, by + Math.sin(a) * len * 0.5, bx + Math.cos(a) * len, by + Math.sin(a) * len, 1, snapped ? 'u' : 'Q');
      if (!shed && i % 5 === 2) p.disc(bx + Math.cos(a) * len * 0.6 + 0.5, by + Math.sin(a) * len * 0.6 + 0.5, 1.4, 'C');
    }
    p.disc(cx + 0.5, cy + 0.5, 11, 'F');
    p.map((x, y, c) => (c === 'F' && hash2(x, y, Math.round(pose.roll * 10)) > 0.8 ? 'f' : null));
    // A curl line and the nose tucked in.
    const na = pose.roll + 0.9;
    p.disc(cx + Math.cos(na) * 5 + 0.5, cy + Math.sin(na) * 5 + 0.5, 1.4, 'N');
    for (let t = 0; t < 10; t++) {
      const a = pose.roll + t * 0.45;
      p.set(cx + Math.cos(a) * (8 - t * 0.5), cy + Math.sin(a) * (8 - t * 0.5), 'f');
    }
    if (shed) crack(p, cx - 6, cy - 4, 0.6, 9, 'X', 'Ff', 11);
    p.shade('F', 'G', 'f');
    return p.outline('o').rows();
  }

  const cx = 21;
  const cy = 26 - pose.breathe * 0.5;
  const rx = 17 + pose.breathe * 0.5;
  const ry = 10.5 + pose.breathe * 0.5;
  // Quills first (behind the body): swept back over the top.
  const n = 22;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = Math.PI * (0.88 + t * 1.02);
    const snapped = shed && hash2(i, 5, 3) > 0.4;
    const tilt = -0.28;
    const len = (snapped ? 3.5 : 7.5 + hash2(i, 2, 4) * 3) + pose.bristle;
    const bx = cx + Math.cos(a) * rx * 0.8;
    const by = cy + Math.sin(a) * ry * 0.8;
    const qa = a + tilt;
    const tx = bx + Math.cos(qa) * (len + 4);
    const ty = by + Math.sin(qa) * (len + 4);
    thick(p, bx, by, bx + (tx - bx) * 0.6, by + (ty - by) * 0.6, 2.3, 'q');
    thick(p, bx + (tx - bx) * 0.55, by + (ty - by) * 0.55, tx, ty, 1, snapped ? 'u' : 'Q');
    if (!shed && (i === 4 || i === 9 || i === 15)) {
      const mx = bx + (tx - bx) * 0.62;
      const my = by + (ty - by) * 0.62;
      p.disc(mx + 0.5, my + 0.5, 1.7, 'C');
      p.set(mx + 1, my + 1, 'c');
    }
    if (!shed && i === 12) p.disc(bx + (tx - bx) * 0.6 + 0.5, by + (ty - by) * 0.6 + 0.5, 1.2, 'D');
  }
  // Feet.
  const foot = (x: number, lift: number): void => {
    p.ellipse(x + 0.5, 37.5 - lift, 2.6, 1.8, 'P');
    p.set(x - 1, 38 - lift, 'p').set(x + 1, 38 - lift, 'p');
  };
  foot(10, pose.step === 2 ? 1 : 0);
  foot(19, pose.step === 1 ? 1 : 0);
  foot(29, pose.step === 2 ? 1 : 0);
  foot(36, pose.step === 1 ? 1 : 0);
  // The body.
  p.ellipse(cx + 0.5, cy + 0.5, rx, ry, 'F');
  p.map((x, y, c) => (c === 'F' && y > cy + ry * 0.35 ? 'G' : null));
  // Fur: short strokes swept back.
  p.map((x, y, c) => (c === 'F' && hash2(x, y, 17) > 0.84 && hash2(x + 1, y, 17) <= 0.84 ? 'f' : null));
  p.map((x, y, c) => (c === 'F' && p.get(x + 1, y + 1) === 'f' && hash2(x, y, 19) > 0.5 ? 'f' : null));
  // The face: a pointed snout to the right.
  const sx = 38;
  const sy = cy + 3;
  p.ellipse(sx + 0.5, sy + 0.5, 5.5, 4, 'G');
  p.ellipse(sx + 4.5, sy, 2.4, 2.2, 'G');
  p.rect(sx + 6, sy - 1, 2, 2, 'N').set(sx + 6, sy - 1, 'w');
  p.ellipse(sx - 1.5, sy + 2, 1.8, 1.1, 'n');
  // Mouth.
  if (pose.mouth === 1) {
    p.ellipse(sx + 3.5, sy + 3, 2.6, 1.6, 'm');
    p.set(sx + 3, sy + 3, 't');
  } else {
    p.line(sx + 2, sy + 2, sx + 5, sy + 2, 'm');
  }
  // Eye.
  const ex = sx - 1;
  const ey = sy - 4;
  if (pose.eyes === 3) {
    p.line(ex - 1, ey, ex + 1, ey, 'k');
  } else {
    const h = pose.eyes === 1 ? 1 : pose.eyes === 2 ? 2.4 : 1.8;
    p.ellipse(ex + 0.5, ey + 0.5, 1.8, h, 'k');
    if (pose.eyes !== 1) p.set(ex + 1, ey - 1, 'w');
    if (shed) {
      p.set(ex - 1, ey + 1, 'R').set(ex + 1, ey + 1, 'R');
      // Angry brow.
      p.line(ex - 2, ey - 3, ex + 2, ey - 2, 'f');
    }
  }
  if (shed) {
    // Frost cracks, coins falling out, cold breath.
    crack(p, cx - 8, cy - 5, 0.9, 10, 'X', 'Ff', 3);
    crack(p, cx + 4, cy - 7, 1.9, 8, 'X', 'Ff', 4);
    for (const [x, y] of [
      [8, 36],
      [27, 37],
      [15, 35],
    ] as const) {
      p.disc(x + 0.5, y + 0.5 - (pose.breathe > 0 ? 1 : 0), 1.3, 'C');
    }
    if (pose.mouth === 1 || pose.breathe > 0) {
      p.set(sx + 8, sy + 1, 'W').set(sx + 9, sy, 'W').set(sx + 10, sy + 1, 'W').set(sx + 9, sy + 2, 'W');
    }
  }
  p.shade('F', 'G', 'f');
  return p.outline('o').rows();
}

const QUILL_POSES: QuillPose[] = [
  { breathe: 0, step: 0, bristle: 0, mouth: 0, eyes: 0, roll: -1 },
  { breathe: 1, step: 0, bristle: 0, mouth: 0, eyes: 0, roll: -1 },
  { breathe: 0, step: 1, bristle: 0, mouth: 0, eyes: 0, roll: -1 },
  { breathe: 0, step: 2, bristle: 0, mouth: 0, eyes: 0, roll: -1 },
  { breathe: 0, step: 0, bristle: 0, mouth: 0, eyes: 0, roll: 0 },
  { breathe: 0, step: 0, bristle: 0, mouth: 0, eyes: 0, roll: Math.PI / 10 },
  { breathe: 1, step: 0, bristle: 3, mouth: 0, eyes: 1, roll: -1 },
  { breathe: 1, step: 0, bristle: 2, mouth: 1, eyes: 2, roll: -1 },
  { breathe: 0, step: 0, bristle: -3, mouth: 0, eyes: 3, roll: -1 },
];
const QUILL_ANIMS = { idle: [0, 1], move: [2, 3], charge: [4, 5], windup: [6], roar: [7], slam: [6], air: [4, 5], hurt: [8], fps: { idle: 2, move: 6, charge: 14, air: 14 } };

export const HOARQUILL_SPRITE: SpriteDef = bossSprite('boss.hoarquill', 48, 40, 30, QUILL_PAL, QUILL_POSES.map((q) => hoarquill(q, false)), QUILL_ANIMS);
export const HOARQUILL_SHEDDING_SPRITE: SpriteDef = bossSprite(
  'boss.hoarquill.shedding',
  48,
  40,
  30,
  QUILL_PAL_2,
  QUILL_POSES.map((q) => hoarquill(q, true)),
  QUILL_ANIMS,
);

// ── The Vaultwarden ───────────────────────────────────────────────────────────

const WARDEN_PAL = {
  o,
  S: '#6a7a9a',
  s: '#3e4a66',
  T: '#9aaac8',
  t: '#c8d4ea',
  F: '#e4f8ff',
  f: '#9ad8f0',
  V: '#8ff0ff',
  v: '#e8ffff',
  b: '#0c1020',
  K: '#d8b050',
  n: '#8a6a2a',
  Y: '#f2d880',
  D: '#2a3048',
  d: '#c8d4ea',
  I: '#bfe8ff',
  G: '#bff0ff',
  g: '#6fc8e8',
  x: '#1c2436',
};

interface WardenPose {
  bob: number;
  /** Legs: 0 stand, 1 left forward, 2 right forward. */
  step: number;
  /** Key: 0 at rest, 1 raised overhead, 2 swung down in front. */
  key: number;
  /** Shield thrust forward (px). */
  shove: number;
  /** Visor: 0 lit, 1 narrowed, 2 flaring, 3 dark. */
  visor: number;
}

function warden(pose: WardenPose, cracked: boolean): string[] {
  const W = 40;
  const H = 54;
  const p = new Pix(W, H);
  const b = pose.bob;
  const lean = pose.shove > 0 ? 1 : 0;

  // The key-sword (behind the right arm when at rest / raised).
  const key = (): void => {
    if (pose.key === 2) {
      // Swung down in front: the shaft points down-right from the gauntlet.
      thick(p, 30, 30 + b, 38, 48, 2.2, 'K');
      p.line(30, 29 + b, 37, 46, 'Y');
      p.rect(35, 46, 4, 3, 'K').rect(36, 49, 2, 3, 'K');
      if (!cracked) p.set(38, 50, 'K');
      p.disc(29.5, 29.5 + b, 2.6, 'K');
      p.set(29, 29 + b, 'b');
      return;
    }
    const top = pose.key === 1 ? 1 + b : 5 + b;
    const hand = pose.key === 1 ? 24 + b : 32 + b;
    thick(p, 33, top + 6, 33, hand, 2.2, 'K');
    p.line(32, top + 7, 32, hand - 1, 'Y');
    // The bit (teeth) at the top, frosted.
    p.rect(34, top + 1, 4, 4, 'K').rect(34, top + 6, 3, 2, 'K');
    if (!cracked) p.rect(34, top + 9, 4, 2, 'K');
    p.set(35, top + 2, 'n').set(35, top + 7, 'n');
    p.rect(33, top, 2, 2, 'F');
    // The bow (a ring) below the gauntlet.
    p.disc(33.5, hand + 3.5, 3, 'K');
    p.disc(33.5, hand + 3.5, 1.2, '.');
    p.set(31, hand + 2, 'Y');
  };
  key();

  // Legs and sabatons.
  const leg = (x: number, fwd: number): void => {
    const y1 = 51;
    p.rect(x, 38 + b, 5, y1 - (38 + b), 'S');
    p.rect(x, 43, 5, 2, 'T');
    p.rect(x - 1 + fwd, y1 - 1, 7, 3, 'S');
    p.set(x + 1, 44, 't');
  };
  leg(13, pose.step === 1 ? 1 : 0);
  leg(22, pose.step === 2 ? 1 : 0);
  // Tassets.
  poly(p, [11, 33 + b, 29, 33 + b, 30, 40 + b, 10, 40 + b], 'S');
  p.line(11, 36 + b, 29, 36 + b, 's');
  p.line(20, 33 + b, 20, 40 + b, 's');
  // Breastplate.
  p.ellipse(20.5 + lean, 26 + b, 8.5, 8.5, 'S');
  p.line(20 + lean, 20 + b, 20 + lean, 32 + b, 'T');
  p.rect(12 + lean, 32 + b, 17, 2, 's');
  // Pauldrons (the left one is gone when cracked).
  if (!cracked) {
    p.ellipse(11.5 + lean, 19.5 + b, 4.8, 3.6, 'S');
    p.ellipse(11.5 + lean, 21.5 + b, 4.2, 2.4, 'S');
    p.line(8 + lean, 21 + b, 15 + lean, 21 + b, 's');
    p.rect(9 + lean, 16 + b, 5, 1, 'F');
  } else {
    p.disc(12.5 + lean, 20.5 + b, 2.4, 'x');
    p.set(11 + lean, 20 + b, 'g');
  }
  p.ellipse(29.5 + lean, 19.5 + b, 4.8, 3.6, 'S');
  p.ellipse(29.5 + lean, 21.5 + b, 4.2, 2.4, 'S');
  p.line(26 + lean, 21 + b, 33 + lean, 21 + b, 's');
  p.rect(27 + lean, 16 + b, 5, 1, 'F');
  // Right arm down to the gauntlet on the key.
  if (pose.key !== 2) thick(p, 31 + lean, 23 + b, 32, (pose.key === 1 ? 24 : 32) + b, 3.2, 'S');
  else thick(p, 31 + lean, 23 + b, 30, 29 + b, 3.2, 'S');
  // The helm: a great helm with a glowing visor slit and an icicle crest.
  const hx = 20.5 + lean;
  const hy = 10 + b;
  p.ellipse(hx, hy, 6.6, 7.4, 'S');
  p.rect(Math.round(hx - 6), Math.round(hy), 13, 5, 'S');
  for (const [dx, h] of [
    [-3, 2],
    [-1, 4],
    [1, 5],
    [3, 3],
  ] as const) {
    p.line(Math.round(hx + dx), Math.round(hy - 7), Math.round(hx + dx), Math.round(hy - 7 - h), 'I');
  }
  const vy = Math.round(hy);
  p.rect(Math.round(hx - 5), vy - 1, 11, 2, 'b');
  if (pose.visor !== 3) {
    const g = pose.visor === 2 ? 'v' : 'V';
    p.rect(Math.round(hx - 3), vy - 1, 2, pose.visor === 1 ? 1 : 2, g);
    p.rect(Math.round(hx + 2), vy - 1, 2, pose.visor === 1 ? 1 : 2, g);
    if (pose.visor === 2) p.set(Math.round(hx - 4), vy - 1, 'V').set(Math.round(hx + 4), vy - 1, 'V');
  }
  for (let y = vy + 2; y < vy + 5; y += 2) for (let x = Math.round(hx - 3); x <= hx + 3; x += 2) p.set(x, y, 's');
  if (cracked) {
    // The helm split open over the visor: pale light spilling out.
    poly(p, [hx - 1, hy - 7, hx + 3, hy - 6, hx + 1, hy - 2, hx + 4, hy + 1, hx - 2, hy - 1], 'G');
    p.set(Math.round(hx), Math.round(hy - 4), 'v').set(Math.round(hx + 1), Math.round(hy - 3), 'v');
    crack(p, hx - 3, hy - 4, 2.2, 5, 'x', 'ST', 21);
    crack(p, hx + 5, hy - 2, 0.8, 4, 'x', 'ST', 22);
    for (let i = 0; i < 3; i++) {
      const x = Math.round(hx - 1 + hash2(i, pose.bob + 2, 6) * 4);
      const y = Math.round(hy - 9 - i * 2);
      if (!p.on(x, y)) p.set(x, y, i === 1 ? 'g' : 'G');
    }
  }
  // Frost on the shoulders / helm.
  p.rect(Math.round(hx - 4), Math.round(hy - 7), 3, 1, 'F');
  // The vault-dial shield on the left, in front.
  const sx = 8.5 + pose.shove;
  const sy = 31.5 + b;
  p.disc(sx, sy, 7.6, 'S');
  p.disc(sx, sy, 6.2, 'T');
  p.disc(sx, sy, 3.6, 'D');
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.set(sx - 0.5 + Math.cos(a) * 5, sy - 0.5 + Math.sin(a) * 5, i % 3 === 0 ? 'D' : 's');
  }
  p.line(Math.round(sx - 0.5), Math.round(sy - 0.5), Math.round(sx - 0.5 + 2), Math.round(sy - 0.5 - 2), 'd');
  p.set(Math.round(sx - 0.5), Math.round(sy - 0.5), 'd');
  // Icicles hanging off the shield rim.
  p.set(Math.round(sx - 4), Math.round(sy + 7), 'f').set(Math.round(sx - 4), Math.round(sy + 8), 'F');
  p.set(Math.round(sx + 2), Math.round(sy + 7), 'f');
  if (cracked) {
    crack(p, 17 + lean, 22 + b, 1.2, 12, 'x', 'ST', 23, 'g');
    crack(p, 24 + lean, 25 + b, 1.9, 8, 'x', 'ST', 24);
    crack(p, sx - 3, sy - 5, 1.1, 7, 'x', 'ST', 25);
  }
  p.shade('S', 'T', 's');
  return p.outline('o').rows();
}

const WARDEN_POSES: WardenPose[] = [
  { bob: 0, step: 0, key: 0, shove: 0, visor: 0 },
  { bob: 1, step: 0, key: 0, shove: 0, visor: 0 },
  { bob: 0, step: 1, key: 0, shove: 0, visor: 0 },
  { bob: 0, step: 2, key: 0, shove: 0, visor: 0 },
  { bob: 1, step: 0, key: 1, shove: 0, visor: 1 },
  { bob: 1, step: 0, key: 2, shove: 0, visor: 2 },
  { bob: 0, step: 1, key: 0, shove: 3, visor: 1 },
  { bob: 0, step: 0, key: 1, shove: 0, visor: 2 },
  { bob: 2, step: 0, key: 2, shove: 0, visor: 3 },
];
const WARDEN_ANIMS = { idle: [0, 1], move: [2, 3], windup: [4], slam: [5], charge: [6], roar: [7], air: [4], hurt: [8], fps: { idle: 2, move: 5 } };

export const VAULTWARDEN_SPRITE: SpriteDef = bossSprite('boss.vaultwarden', 40, 54, 42, WARDEN_PAL, WARDEN_POSES.map((q) => warden(q, false)), WARDEN_ANIMS);
export const VAULTWARDEN_CRACKED_SPRITE: SpriteDef = bossSprite(
  'boss.vaultwarden.cracked',
  40,
  54,
  42,
  WARDEN_PAL,
  WARDEN_POSES.map((q) => warden(q, true)),
  WARDEN_ANIMS,
);

// ── Shiverwing (miniboss) ─────────────────────────────────────────────────────

const BAT_PAL = {
  o,
  B: '#4a4a7a',
  b: '#2e2e52',
  L: '#7a7ab0',
  M: '#34507a',
  m: '#22385a',
  N: '#56789e',
  C: '#b8f6ff',
  c: '#6fd8f0',
  X: '#3a8ab0',
  E: '#8ff0ff',
  e: '#ffffff',
  W: '#f4fbff',
  k: '#10102a',
  P: '#ff6ad8',
  p: '#c040a0',
};

interface BatPose {
  /** Wing tip height: -1 up … 1 down. */
  flap: number;
  /** Wings folded in (telegraph). */
  fold: boolean;
  /** 0 shut, 1 open (screech). */
  mouth: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
}

function bat(pose: BatPose, shattered: boolean): string[] {
  const W = 36;
  const H = 26;
  const p = new Pix(W, H);
  const cx = 18;
  const reach = pose.fold ? 11 : 16.5;
  const tipY = 9 + pose.flap * 5;
  // Wings: membrane polygons with finger bones and crystal spikes, mirrored.
  const wing = (side: number): void => {
    const sx = cx + side * 3;
    const ex = cx + side * (reach * 0.55);
    const ey = 6 + pose.flap * 2.5;
    const tx = cx + side * reach;
    const ty = tipY;
    // Trailing edge: scallops between the finger tips, back to the hip.
    const f1x = cx + side * reach * 0.82;
    const f1y = ty + 7;
    const f2x = cx + side * reach * 0.5;
    const f2y = ty + 9 - pose.flap;
    const torn = shattered && side > 0;
    poly(
      p,
      [sx, 10, ex, ey, tx, ty, cx + side * reach * 0.9, ty + 4, f1x, f1y, cx + side * reach * 0.66, f1y - (torn ? 4 : 1), f2x, f2y, cx + side * 6.5, 17, sx, 16],
      'M',
    );
    if (torn) p.ellipse(cx + side * reach * 0.72 + 0.5, ty + 3.5, 1.6, 1.4, '.');
    // Bones: arm and fingers.
    p.line(Math.round(sx), 10, Math.round(ex), Math.round(ey), 'B');
    p.line(Math.round(ex), Math.round(ey), Math.round(tx), Math.round(ty), 'B');
    p.line(Math.round(ex), Math.round(ey), Math.round(f1x), Math.round(f1y), 'b');
    p.line(Math.round(ex), Math.round(ey), Math.round(f2x), Math.round(f2y), 'b');
    // Crystal spikes along the arm.
    for (const t of [0.3, 0.65, 1]) {
      const x = Math.round(sx + (tx - sx) * t);
      const y = Math.round(10 + (ty - 10) * t - (t === 1 ? 0 : 1));
      const g = shattered ? (t === 0.65 ? 'P' : 'C') : 'C';
      p.set(x, y - 1, g).set(x, y - 2, g).set(x + side, y - 1, shattered ? 'p' : 'c');
      if (!shattered || t !== 0.3) p.set(x, y - 3, 'C');
    }
    // Membrane: lit near the arm, darker toward the trailing edge.
    p.map((x, y, c) => (c !== 'M' ? null : y <= Math.min(ey, ty) + 2 ? 'N' : y > ty + 5 ? 'm' : null));
  };
  wing(-1);
  wing(1);
  // Body and head.
  p.ellipse(cx + 0.5, 15, 4.6, 5.6, 'B');
  p.ellipse(cx + 0.5, 16.5, 2.6, 3, 'L');
  p.disc(cx + 0.5, 8.5, 4.6, 'B');
  // Ears (tall, pointed) and a crystal crest.
  poly(p, [cx - 4, 7, cx - 5, 0, cx - 1, 5], 'B');
  poly(p, [cx + 5, 7, cx + 6, 0, cx + 2, 5], 'B');
  p.set(cx - 4, 3, 'L').set(cx + 5, 3, 'L');
  p.set(cx, 3, 'C').set(cx + 1, 2, 'C').set(cx + 1, 3, 'c').set(cx, 4, 'c');
  if (shattered) p.set(cx + 1, 1, 'P').set(cx + 2, 3, 'P');
  // Eyes.
  const eye = (ex: number): void => {
    if (pose.eyes === 3) {
      p.set(ex, 8, 'k').set(ex + 1, 8, 'k');
      return;
    }
    const g = shattered ? 'P' : 'E';
    if (pose.eyes === 1) p.rect(ex, 8, 2, 1, g);
    else {
      p.rect(ex, 7, 2, 2, g).set(ex, 7, 'e');
      if (pose.eyes === 2) p.set(ex + 1, 9, g);
    }
  };
  eye(cx - 3);
  eye(cx + 2);
  // Mouth and fangs.
  if (pose.mouth === 1) {
    p.ellipse(cx + 0.5, 12, 2.2, 1.6, 'k');
    p.set(cx - 1, 11, 'W').set(cx + 2, 11, 'W').set(cx - 1, 12, 'W').set(cx + 2, 12, 'W');
  } else {
    p.line(cx - 1, 11, cx + 2, 11, 'k');
    p.set(cx - 1, 12, 'W').set(cx + 2, 12, 'W');
  }
  // Little feet.
  p.set(cx - 1, 21, 'b').set(cx + 2, 21, 'b');
  if (shattered) crack(p, cx - 2, 13, 1.2, 5, 'p', 'BL', 31);
  p.shade('B', 'L', 'b');
  return p.outline('o').rows();
}

const BAT_POSES: BatPose[] = [
  { flap: -1, fold: false, mouth: 0, eyes: 0 },
  { flap: 0, fold: false, mouth: 0, eyes: 0 },
  { flap: 1, fold: false, mouth: 0, eyes: 0 },
  { flap: 0, fold: false, mouth: 0, eyes: 0 },
  { flap: 0.5, fold: true, mouth: 0, eyes: 1 },
  { flap: -1, fold: false, mouth: 1, eyes: 2 },
  { flap: 1, fold: true, mouth: 0, eyes: 3 },
];
const BAT_ANIMS = { idle: [0, 1, 2, 3], move: [0, 1, 2, 3], charge: [4], windup: [4], roar: [5], slam: [4], air: [0, 1, 2, 3], hurt: [6], fps: { idle: 8, move: 12, air: 12 } };

export const SHIVERWING_SPRITE: SpriteDef = bossSprite('boss.shiverwing', 36, 26, 18, BAT_PAL, BAT_POSES.map((q) => bat(q, false)), BAT_ANIMS);
export const SHIVERWING_SHATTERED_SPRITE: SpriteDef = bossSprite(
  'boss.shiverwing.shattered',
  36,
  26,
  18,
  BAT_PAL,
  BAT_POSES.map((q) => bat(q, true)),
  BAT_ANIMS,
);
