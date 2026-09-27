/**
 * The Glimmer Grotto boss (chapter 4, alt track) — original art, painted with ./paint.ts. One sprite
 * per phase look (bossesBKit.ts: frame order, the phase-look swap).
 *
 *   Hushwing  56×44  a great grotto bat, wings spread wide, huge pink-lined ears, a leaf nose, tiny fangs
 *                     and milky blind eyes; cyan and violet crystals grow from its shoulders, wrists and
 *                     head. Resonating: the crystals grow big and bright, the eyes glow violet.
 *                     Shattering: the crystals snapped to stubs, torn wings, shards falling, white eyes.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix } from './paint';
import { bossAnims, bossSprite, shard, tri } from './bossesBKit';

const o = OUTLINE;

const BAT_PAL: Record<string, string> = {
  o,
  M: '#2e2650',
  N: '#211b3c',
  B: '#7a68a8',
  F: '#5e4e78',
  G: '#80709c',
  f: '#3a2e50',
  b: '#9a88b8',
  p: '#c07ab8',
  w: '#e8e4f4',
  q: '#a89ac8',
  k: '#140e1e',
  t: '#f4f0ff',
  C: '#8ae8ff',
  c: '#3a8ab0',
  D: '#d8b0ff',
  d: '#8a5ac8',
  W: '#ffffff',
  V: '#d8b0ff',
};

const BAT_PAL_RING: Record<string, string> = { ...BAT_PAL, M: '#36285e', N: '#271d48', F: '#66508a', C: '#b8f6ff', D: '#ecd4ff', c: '#4aa8d0', d: '#a070e0', w: '#d8b0ff', q: '#ffffff' };
const BAT_PAL_SHATTER: Record<string, string> = { ...BAT_PAL, M: '#2a2444', N: '#1e1a34', F: '#54486c', G: '#72668e', w: '#ffffff', q: '#e0f8ff' };

interface BatPose {
  /** 0 listening, 1 resonating, 2 shattering. */
  look: number;
  /** Wing beat: negative = up, positive = down (px). */
  flap: number;
  /** Wings folded in (0) … spread (1). */
  spread: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 shut, 1 fangs, 2 screech. */
  mouth: number;
  /** Body raise (+ up), px. */
  lift: number;
  /** Falling-shard frame (shattering). */
  bits: number;
}

function bat(q: BatPose): string[] {
  const W = 56;
  const H = 44;
  const p = new Pix(W, H);
  const cx = 28;
  const by = 28 - q.lift;
  const grow = q.look === 1 ? 1.5 : q.look === 2 ? 0.45 : 1;

  // Wings: a membrane between the arm and three long fingers, a scalloped trailing edge.
  const wingPts: { sx: number; sy: number; wx: number; wy: number; f: [number, number][]; hx: number; hy: number }[] = [];
  for (const s of [-1, 1]) {
    const sp = q.spread;
    const sx = cx + s * 6;
    const sy = by - 7;
    const wx = cx + s * (9 + 8 * sp);
    const wy = by - 12 + q.flap;
    const f: [number, number][] = [
      [cx + s * (13 + 14 * sp), by - 14 + q.flap * 1.6 - 4 * sp],
      [cx + s * (14 + 13 * sp), by - 1 + q.flap * 1.1],
      [cx + s * (11 + 10 * sp), by + 8 + q.flap * 0.5],
    ];
    const hx = cx + s * 5;
    const hy = by + 6;
    tri(p, wx, wy, f[0]![0], f[0]![1], f[1]![0], f[1]![1], 'M');
    tri(p, wx, wy, f[1]![0], f[1]![1], f[2]![0], f[2]![1], 'M');
    tri(p, wx, wy, f[2]![0], f[2]![1], hx, hy, 'M');
    tri(p, wx, wy, hx, hy, sx, sy, 'M');
    // Scallops between the finger tips.
    const edges: [number, number, number, number][] = [
      [f[0]![0], f[0]![1], f[1]![0], f[1]![1]],
      [f[1]![0], f[1]![1], f[2]![0], f[2]![1]],
      [f[2]![0], f[2]![1], hx, hy],
    ];
    for (const [ax, ay, bx, by2] of edges) {
      const mx = (ax + bx) / 2 - s * 1.5;
      const my = (ay + by2) / 2 + 0.5;
      p.ellipse(mx, my, 2.6, 2.6, '.');
    }
    p.map((x, y, c) => (c === 'M' && Math.abs(x - cx) < 12 && y > by - 4 ? 'N' : null));
    wingPts.push({ sx, sy, wx, wy, f, hx, hy });
  }
  if (q.look === 2) {
    // Torn holes in the membrane.
    p.ellipse(cx - 18, by - 4 + q.flap, 1.6, 1.2, '.');
    p.ellipse(cx + 20, by - 7 + q.flap, 1.3, 1.8, '.');
    p.ellipse(cx + 14, by + 3 + q.flap * 0.6, 1.2, 1, '.');
  }
  // Bones on top of the membrane.
  for (const { sx, sy, wx, wy, f } of wingPts) {
    p.line(sx, sy, wx, wy, 'B').line(sx, sy + 1, wx, wy + 1, 'B');
    for (const [fx, fy] of f) p.line(wx, wy, fx, fy, 'B');
    p.set(wx, wy - 1, 'B').set(wx + (wx > cx ? 1 : -1), wy - 2, 'w');
  }

  // Ears.
  for (const s of [-1, 1]) {
    tri(p, cx + s * 2, by - 14, cx + s * 9, by - 26, cx + s * 8, by - 11, 'F');
    tri(p, cx + s * 4, by - 14, cx + s * 8.5, by - 23, cx + s * 7, by - 13, 'p');
  }
  // Body, head, belly.
  p.ellipse(cx, by, 7.5, 9, 'F');
  p.ellipse(cx, by - 10, 7.2, 6, 'F');
  p.shade('F', 'G', 'f');
  p.ellipse(cx, by + 2, 4, 5.2, 'b');
  p.map((x, y, c) => (c === 'b' && (x + y) % 3 === 0 ? 'G' : null));
  // Feet.
  p.line(cx - 3, by + 8, cx - 4, by + 11, 'B').line(cx + 3, by + 8, cx + 4, by + 11, 'B');
  p.set(cx - 5, by + 11, 'B').set(cx + 5, by + 11, 'B');

  // Face.
  const ey = by - 11;
  for (const ex of [cx - 3.5, cx + 3.5]) {
    if (q.eyes === 3) {
      p.line(ex - 1.5, ey, ex + 1.5, ey, 'k');
      continue;
    }
    const ry = q.eyes === 1 ? 0.8 : q.eyes === 2 ? 2.3 : 1.8;
    p.ellipse(ex, ey, 2.2, ry, 'w');
    if (q.eyes !== 1) p.set(ex - 1, ey - 1, 'q');
  }
  // Leaf nose.
  p.set(cx - 1, ey + 2, 'p').set(cx, ey + 2, 'p').set(cx - 1, ey + 3, 'p').set(cx, ey + 3, 'p').set(cx - 1, ey + 1, 'p');
  const my = ey + 5;
  if (q.mouth === 2) {
    p.ellipse(cx - 0.5, my + 1, 3, 2.2, 'k');
    p.set(cx - 3, my, 't').set(cx + 2, my, 't').set(cx - 3, my + 1, 't').set(cx + 2, my + 1, 't');
  } else {
    p.line(cx - 3, my, cx + 2, my, 'k');
    if (q.mouth === 1) p.set(cx - 2, my + 1, 't').set(cx + 1, my + 1, 't');
  }

  // Crystals: shoulders, wrists, head (bigger when resonating, stubs when shattered).
  const crystal = (x: number, y: number, len: number, a: number, violet: boolean): void => {
    const L = Math.max(2.5, len * grow);
    shard(p, x, y, L, a, Math.max(2.5, L * 0.62), violet ? 'D' : 'C', violet ? 'd' : 'c', 'W');
    if (q.look === 2) p.set(x + Math.cos(a) * L, y + Math.sin(a) * L, 'W');
  };
  crystal(cx - 6, by - 7, 9, -2.3, false);
  crystal(cx - 8, by - 5, 6, -2.8, true);
  crystal(cx + 6, by - 7, 9, -0.85, false);
  crystal(cx + 8, by - 5, 6, -0.35, true);
  for (const { wx, wy } of wingPts) {
    const s = wx > cx ? 1 : -1;
    crystal(wx, wy - 1, 6.5, -Math.PI / 2 + s * 0.4, s > 0);
  }
  crystal(cx + 2, by - 15, 5.5, -1.3, true);
  if (q.look === 1) {
    crystal(cx - 2, by - 15, 4.5, -1.9, false);
    crystal(cx - 5, by + 4, 4, -2.7, true);
    crystal(cx + 5, by + 4, 4, -0.45, false);
  }
  if (q.look === 2) {
    // Shards dropping off.
    for (let i = 0; i < 4; i++) {
      const x = cx - 14 + ((i * 9 + q.bits * 5) % 28);
      const y = by + 10 + ((i * 3 + q.bits * 2) % 6);
      p.set(x, y, i % 2 === 0 ? 'C' : 'D').set(x, y - 1, 'W');
    }
  }
  return p.outline('o').rows();
}

function batFrames(look: number): string[][] {
  const f = (flap: number, spread: number, eyes: number, mouth: number, lift: number, bits: number): string[] =>
    bat({ look, flap, spread, eyes, mouth, lift, bits });
  const m = look === 0 ? 0 : 1;
  return [
    f(-3, 1, 0, m, 0, 0),
    f(3, 1, 0, m, 1, 1),
    f(-1, 1, 0, m, 1, 2),
    f(4, 1, 0, m, 0, 3),
    f(4, 0.25, 1, 1, -2, 0),
    f(-5, 1, 2, 2, 2, 1),
    f(-6, 0.7, 1, 1, 3, 2),
    f(6, 0.6, 3, 1, -1, 3),
  ];
}

export const HUSHWING_SPRITE: SpriteDef = bossSprite('boss.hushwing', 56, 44, 32, BAT_PAL, batFrames(0), bossAnims(5, 7, 12));
export const HUSHWING_RING_SPRITE: SpriteDef = bossSprite('boss.hushwing.ring', 56, 44, 32, BAT_PAL_RING, batFrames(1), bossAnims(7, 9, 14));
export const HUSHWING_SHATTER_SPRITE: SpriteDef = bossSprite('boss.hushwing.shatter', 56, 44, 32, BAT_PAL_SHATTER, batFrames(2), bossAnims(8, 10, 14));
