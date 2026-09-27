/**
 * Boss pack C — The Eye of the Storm (chapter 6 main) sprite, painted with ./paint.ts
 * (+ bossesCPaint.ts). 1 px dark outline, lit from the top-left, facing RIGHT.
 *
 *   Squallvane  48×56  the iron rooster weathervane torn off the tallest roof in town, still bolted
 *                      to a chunk of slate: a glaring rooster on a lightning rod, the arrow, the
 *                      compass bar. Struck (phase 2): charged white-hot, sparks and crackling strands.
 *                      Unmoored (phase 3): the rod snapped, the roof gone, the arrow bent, tumbling.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, bossSprite, crack, curve, hash2, poly, repaint, shear, thick } from './bossesCPaint';

const o = OUTLINE;

const VANE_PAL = {
  o,
  I: '#6c7288',
  i: '#3c4054',
  J: '#9ca4ba',
  j: '#d2dae8',
  R: '#a0582a',
  r: '#6a3418',
  U: '#c8783a',
  S: '#3e4a5c',
  s: '#2a3444',
  Z: '#5a687e',
  Y: '#ffe36a',
  W: '#fff7c0',
  B: '#8ab8ff',
  b: '#4a78d8',
  E: '#ffd35a',
  k: '#141726',
  C: '#c83a3a',
  c: '#e0605a',
};

/** Struck: scorched iron, glowing seams. */
const VANE_PAL_2 = repaint(VANE_PAL, { I: '#6a6a7c', J: '#b0b0c2', j: '#f0ecd8', R: '#7a4430', U: '#9a5a36' });
/** Unmoored: storm-blue sheen on the iron. */
const VANE_PAL_3 = repaint(VANE_PAL, { I: '#5c6a8e', J: '#8ea2c8', j: '#c8d8f4', R: '#8a5240', U: '#b06a44' });

interface VanePose {
  /** Arrow turn: 1 side-on, down to 0.4 (foreshortened while it spins). */
  turn: number;
  /** Arrow pointing right (1) or left (-1). */
  dir: number;
  /** Beak open (crow / roar). */
  beak: boolean;
  /** 0 glare, 1 narrowed, 2 wide, 3 shut. */
  eye: number;
  /** Sparks on the crest (telegraph). */
  spark: boolean;
  /** Wobble (px). */
  bob: number;
}

function vane(pose: VanePose, stage: 0 | 1 | 2): string[] {
  const W = 48;
  const H = 56;
  const p = new Pix(W, H);
  const b = pose.bob;
  const rx = 23;
  const rodBottom = stage === 2 ? 41 : 49;
  // The rod (and the lightning spike above the rooster).
  thick(p, rx + 0.5, 1 + b, rx + 0.5, rodBottom, 2, 'J');
  p.set(rx, 0 + b, 'j');
  // The roof chunk it is still bolted to (gone once unmoored).
  if (stage < 2) {
    poly(p, [12, 47, 35, 45, 37, 49, 34, 55, 29, 53, 24, 55, 18, 54, 13, 55, 10, 51], 'S');
    for (let y = 47; y < 56; y += 3) for (let x = 10; x < 38; x++) if (p.get(x, y) === 'S') p.set(x, y, 's');
    for (let x = 12; x < 38; x += 5) for (let y = 46; y < 56; y++) if (p.get(x + ((y / 3) & 1) * 2, y) === 'S') p.set(x + ((y / 3) & 1) * 2, y, 's');
    p.map((x, y, c) => (c === 'S' && y <= 47 ? 'Z' : null));
    p.rect(rx - 2, 43, 6, 4, 'I').rect(rx - 3, 46, 8, 1, 'i');
  } else {
    // A jagged snapped end.
    p.set(rx - 1, rodBottom + 1, 'J').set(rx + 1, rodBottom + 2, 'J').set(rx, rodBottom + 1, 'i');
  }
  // The compass bar with ball ends and a ring.
  const cy = 35 + b;
  thick(p, 8, cy, 39, cy, 2, 'I');
  p.disc(7.5, cy + 0.5, 2.3, 'I').disc(40.5, cy + 0.5, 2.3, 'I');
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    p.set(rx + 0.5 + Math.cos(t) * 4.5, cy + 0.5 + Math.sin(t) * 3.5, 'I');
  }
  // The arrow: fletching at the tail, a broad head.
  const ay = 25 + b;
  const half = 19 * pose.turn;
  const tail = rx - half * pose.dir;
  const head = rx + half * pose.dir;
  const bent = stage === 2 ? 3 : 0;
  thick(p, tail, ay, rx, ay, 2, 'I');
  thick(p, rx, ay, head, ay - bent, 2, 'I');
  const hw = Math.max(2, 5 * pose.turn);
  poly(p, [head + pose.dir * 5 * pose.turn, ay - bent + 0.5, head - pose.dir * 1, ay - bent - hw, head - pose.dir * 1, ay - bent + hw + 1], 'I');
  poly(p, [tail, ay - 4, tail + pose.dir * 5 * pose.turn, ay - 0.5, tail + pose.dir * 5 * pose.turn, ay + 1.5, tail, ay + 5, tail - pose.dir * 2, ay + 5, tail - pose.dir * 2 + pose.dir * 3 * pose.turn, ay + 0.5, tail - pose.dir * 2, ay - 4], 'I');
  // The rooster on top (facing right).
  const ry = 13 + b;
  // Tail feathers: a fan of curves to the left.
  curve(p, 20, ry + 2, 13, ry - 2, 11, ry - 9, 3, 1.5, 'I');
  curve(p, 20, ry + 3, 12, ry + 1, 8, ry - 4, 2.6, 1.3, 'I');
  curve(p, 20, ry + 4, 13, ry + 5, 9, ry + 2, 2.4, 1.2, 'I');
  p.ellipse(24.5, ry + 1.5, 7, 4.8, 'I');
  p.disc(30.5, ry - 4.5, 3.2, 'I');
  thick(p, 28, ry - 2, 30, ry - 4, 3, 'I');
  // Comb and wattle.
  p.set(29, ry - 8, 'C').set(30, ry - 9, 'C').set(31, ry - 8, 'C').set(32, ry - 9, 'C').set(30, ry - 8, 'C').set(31, ry - 7, 'c');
  p.set(33, ry - 2, 'C').set(33, ry - 1, 'C');
  // Beak.
  if (pose.beak) {
    p.line(34, ry - 5, 37, ry - 7, 'U').line(34, ry - 3, 37, ry - 2, 'U');
    p.set(35, ry - 4, 'k');
  } else {
    poly(p, [33.5, ry - 6, 37.5, ry - 4.5, 33.5, ry - 3], 'U');
  }
  // The glaring eye.
  if (pose.eye === 3) p.line(30, ry - 5, 32, ry - 5, 'k');
  else {
    const g = stage === 1 ? 'W' : 'E';
    p.rect(30, ry - 6, 2, pose.eye === 1 ? 1 : 2, g).set(31, ry - 5, pose.eye === 1 ? g : 'k');
    p.line(29, ry - 8 + (pose.eye === 1 ? 1 : 0), 32, ry - 7 + (pose.eye === 1 ? 1 : 0), 'i');
  }
  // Legs to the rod, a wing line.
  p.line(23, ry + 6, 23, ry + 8, 'i').line(26, ry + 6, 25, ry + 8, 'i');
  curve(p, 20, ry, 25, ry - 1, 28, ry + 3, 1, 1, 'J');
  // Rust.
  p.map((x, y, c) => (c === 'I' && hash2(x, y, 41) > 0.89 ? (hash2(x, y, 42) > 0.5 ? 'R' : 'r') : null));
  // Crest sparks (telegraph).
  if (pose.spark) {
    p.set(rx - 2, 1 + b, 'Y').set(rx + 3, 2 + b, 'Y').set(rx + 1, 0 + b, 'W').set(rx - 3, 3 + b, 'W');
  }
  if (stage === 1) {
    // Charged: white-hot rod, crackling strands along the arrow and bar, sparks around.
    thick(p, rx + 0.5, 2 + b, rx + 0.5, rodBottom - 4, 1, 'W');
    let y = ay;
    for (let x = Math.round(Math.min(tail, head)) + 2; x < Math.max(tail, head) - 2; x += 2) {
      y = ay + (hash2(x, Math.round(pose.turn * 10), 7) > 0.5 ? -1 : 1) * (hash2(x, 3, 8) > 0.6 ? 2 : 1);
      p.set(x, y, (x & 2) === 0 ? 'Y' : 'W');
    }
    for (let x = 10; x < 38; x += 3) p.set(x, cy - 1 + ((x * 7) % 3), 'Y');
    for (let i = 0; i < 7; i++) {
      const sx = Math.round(4 + hash2(i, pose.bob + 11, 3) * 40);
      const sy = Math.round(2 + hash2(i, Math.round(pose.turn * 5), 4) * 40);
      if (!p.on(sx, sy)) p.set(sx, sy, i % 3 === 0 ? 'W' : 'Y');
    }
  } else if (stage === 2) {
    // Unmoored: dented, crackling blue.
    crack(p, 24, ry, 0.8, 6, 'i', 'IRr', 51);
    for (let i = 0; i < 6; i++) {
      const sx = Math.round(6 + hash2(i, pose.bob + 21, 3) * 36);
      const sy = Math.round(4 + hash2(i, Math.round(pose.turn * 5) + 2, 4) * 36);
      if (!p.on(sx, sy)) p.set(sx, sy, i % 2 === 0 ? 'B' : 'b');
    }
    p.set(rx - 1, ry - 8, 'B').set(rx + 2, ry - 10, 'B');
  }
  p.shade('I', 'J', 'i');
  const out = stage === 2 ? shear(p, pose.dir * 0.22, 28) : p;
  return out.outline('o').rows();
}

const VANE_POSES: VanePose[] = [
  { turn: 1, dir: 1, beak: false, eye: 0, spark: false, bob: 0 },
  { turn: 0.94, dir: 1, beak: false, eye: 0, spark: false, bob: 1 },
  { turn: 0.6, dir: 1, beak: false, eye: 0, spark: false, bob: 0 },
  { turn: 0.6, dir: -1, beak: false, eye: 0, spark: false, bob: 1 },
  { turn: 1, dir: 1, beak: false, eye: 1, spark: true, bob: 0 },
  { turn: 0.8, dir: 1, beak: true, eye: 2, spark: true, bob: 0 },
  { turn: 0.45, dir: -1, beak: true, eye: 2, spark: false, bob: 1 },
  { turn: 1, dir: 1, beak: false, eye: 3, spark: false, bob: 2 },
];
const VANE_ANIMS = {
  idle: [0, 1],
  move: [0, 2, 1, 3],
  charge: [2, 6, 3, 6],
  windup: [4],
  roar: [5],
  slam: [4],
  air: [2, 3],
  hurt: [7],
  fps: { idle: 2, move: 6, charge: 16, air: 12 },
};

export const SQUALLVANE_SPRITE: SpriteDef = bossSprite('boss.squallvane', 48, 56, 40, VANE_PAL, VANE_POSES.map((q) => vane(q, 0)), VANE_ANIMS);
export const SQUALLVANE_STRUCK_SPRITE: SpriteDef = bossSprite(
  'boss.squallvane.struck',
  48,
  56,
  40,
  VANE_PAL_2,
  VANE_POSES.map((q) => vane(q, 1)),
  VANE_ANIMS,
);
export const SQUALLVANE_UNMOORED_SPRITE: SpriteDef = bossSprite(
  'boss.squallvane.unmoored',
  48,
  56,
  40,
  VANE_PAL_3,
  VANE_POSES.map((q) => vane(q, 2)),
  VANE_ANIMS,
);
