/**
 * The Grinding Works bosses (chapter 3, main track) — original art, painted with ./paint.ts. One
 * sprite per phase look (bossesBKit.ts: frame order, the phase-look swap).
 *
 *   Old Governor   48×50  a riveted brass boiler on piston legs with porthole eyes, a grille mouth, a
 *                          valve wheel, a steam whistle and a spinning flyball governor on its head.
 *                          Overpressure: red-hot copper, glowing cracks, leaking steam, the flyballs
 *                          flung out wide, the gauge needle in the red.
 *   Gnawgear       48×48  a big brass-toothed gear with an iron face and a jaw that splits it across
 *                          the middle, a small steel gear riding its shoulder. Stripped: teeth snapped
 *                          off, a cracked shoulder gear, sparks and dripping oil, hot brass.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix } from './paint';
import { bossAnims, bossSprite, crack, gear, puff } from './bossesBKit';

const o = OUTLINE;

// ── Old Governor ─────────────────────────────────────────────────────────────

const GOV_PAL: Record<string, string> = {
  o,
  B: '#b8863a',
  C: '#e2b85a',
  D: '#7a5424',
  E: '#553814',
  R: '#f4d88a',
  S: '#8c979c',
  T: '#c4ced2',
  U: '#56606a',
  g: '#1a2630',
  G: '#2c4658',
  y: '#ffe07a',
  Y: '#fff6c8',
  M: '#1a0e0a',
  u: '#eef4f6',
  v: '#b8c8d0',
  r: '#d84a2a',
  k: '#0f0d18',
  Z: '#ffd24a',
};

const GOV_PAL_HOT: Record<string, string> = {
  ...GOV_PAL,
  B: '#c4643a',
  C: '#f29a5c',
  D: '#86321c',
  E: '#4e170c',
  R: '#ffd290',
  y: '#ff8a3a',
  Y: '#ffe2a8',
  G: '#4a2a30',
};

interface GovPose {
  /** 0 regulating, 1 overpressure. */
  look: number;
  /** Flyball angle around the spindle (rad). */
  spin: number;
  /** Body raise (+ up, − squat), px. */
  lift: number;
  /** 0 stand, 1 left foot up, 2 right foot up. */
  legs: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 grille, 1 open and steaming, 2 grille clenched. */
  mouth: number;
  /** Steam from the whistle: 0 none, 1 small, 2 big. */
  puff: number;
}

function governor(q: GovPose): string[] {
  const W = 48;
  const H = 50;
  const p = new Pix(W, H);
  const cx = 24;
  const cy = 30 - q.lift;
  const hot = q.look === 1;

  // Piston legs + foot plates.
  for (const [x0, side] of [
    [13, 1],
    [29, 2],
  ] as const) {
    const up = q.legs === side ? 2 : 0;
    const top = cy + 8;
    const bot = 48 - up;
    p.rect(x0 + 1, top, 4, Math.max(1, bot - top - 1), 'S').rect(x0 + 1, top, 1, Math.max(1, bot - top - 1), 'T').rect(x0 + 4, top, 1, Math.max(1, bot - top - 1), 'U');
    p.rect(x0 + 2, top + 2, 2, 1, 'U');
    p.rect(x0 - 1, bot - 1, 8, 2, 'U').rect(x0 - 1, bot - 1, 8, 1, 'S');
  }

  // The valve wheel on its left side (behind the body's edge).
  const wy = cy + 3;
  p.disc(8, wy, 4.2, 'S');
  p.disc(8, wy, 2.6, '.');
  p.line(4, wy, 12, wy, 'U').line(8, wy - 4, 8, wy + 4, 'U');
  p.set(8, wy, 'T').set(7, wy - 4, 'T').set(5, wy - 2, 'T');

  // The boiler.
  p.ellipse(cx, cy, 17, 12.5, 'B');
  p.shade('B', 'C', 'D');
  p.ellipse(18, cy - 6, 5, 2.4, 'C').set(15, cy - 7, 'R');
  p.map((x, y, c) => (c === 'B' && y > cy + 7 ? 'D' : c === 'D' && y > cy + 10 ? 'E' : null));
  // Riveted seams: a band across the belly, rivets round the rim.
  for (let x = cx - 15; x <= cx + 15; x++) if (p.get(x, cy + 4) !== '.') p.set(x, cy + 4, 'D');
  for (let x = cx - 13; x <= cx + 13; x += 4) if (p.get(x, cy + 5) !== '.') p.set(x, cy + 5, 'R');
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * (1.08 + (i / 13) * 0.84);
    const rx = Math.round(cx + Math.cos(a) * 14.5);
    const ry = Math.round(cy + Math.sin(a) * 10);
    if (hot && i === 9) continue; // a popped rivet
    p.set(rx, ry, 'R');
  }

  // The dome and its gauge.
  const dy = cy - 12;
  p.ellipse(cx, dy, 9, 4.2, 'B');
  p.map((x, y, c) => (c === 'B' && y < dy - 1 && x < cx ? 'C' : c === 'B' && y > dy + 1 ? 'D' : null));
  p.disc(cx, dy, 2.8, 'T');
  p.set(cx + 2, dy - 1, 'r').set(cx + 2, dy, 'r');
  if (hot) p.line(cx, dy, cx + 2, dy - 1, 'k');
  else p.line(cx, dy, cx - 1, dy - 2, 'k');

  // Spindle, hinge and the flyball governor.
  const top = cy - 27;
  p.rect(cx - 1, top + 1, 2, dy - top - 3, 'S').rect(cx - 1, top + 1, 1, dy - top - 3, 'T');
  p.disc(cx, top, 1.6, 'B').set(cx - 1, top - 1, 'C');
  const hinge = top + 3;
  const reach = hot ? 10.5 : 9.5;
  const tilt = hot ? 1.38 : 1.02;
  const balls: [number, number, number][] = [];
  for (const k of [0, Math.PI]) {
    const ph = q.spin + k;
    const bx = cx + Math.sin(tilt) * reach * Math.cos(ph);
    const by = hinge + Math.cos(tilt) * reach;
    balls.push([bx, by, Math.sin(ph)]);
  }
  balls.sort((a, b) => a[2] - b[2]);
  for (const [bx, by, z] of balls) {
    p.line(cx, hinge, bx, by, z < 0 ? 'U' : 'S');
    const r = z < 0 ? 2.2 : 2.9;
    p.disc(bx, by, r, hot ? 'r' : 'S');
    if (!hot) p.map((x, y, c) => (c === 'S' && Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= r && y > by ? 'U' : null));
    p.set(bx - 1, by - 1, hot ? 'Z' : 'T');
  }

  // Porthole eyes.
  for (const ex of [17, 31]) {
    const ey = cy - 3;
    p.disc(ex, ey, 5.4, 'S');
    p.map((x, y, c) => (c === 'S' && (x - ex) + (y - ey) < -5 ? 'T' : c === 'S' && (x - ex) + (y - ey) > 5 ? 'U' : null));
    p.disc(ex, ey, 3.9, 'g');
    p.map((x, y, c) => (c === 'g' && y > ey && Math.abs(x - ex) + Math.abs(y - ey) < 5 ? 'G' : null));
    if (q.eyes === 3) {
      p.rect(ex - 3, ey - 3, 7, 7, 'U');
      p.disc(ex, ey, 5.4, 'S');
      p.line(ex - 3, ey, ex + 3, ey, 'k');
      continue;
    }
    const pr = q.eyes === 2 ? 2.6 : 2;
    p.disc(ex + 1, ey, pr, 'y');
    p.set(ex, ey - 1, 'Y');
    if (q.eyes === 1) {
      // Steel lids slide down over the top half: a glowing slit.
      for (let y = ey - 5; y < ey; y++) for (let x = ex - 5; x <= ex + 5; x++) if (p.get(x, y) === 'g' || p.get(x, y) === 'y' || p.get(x, y) === 'Y' || p.get(x, y) === 'G') p.set(x, y, 'U');
      p.line(ex - 4, ey - 1, ex + 4, ey - 1, 'S');
    }
  }
  // Heavy brows (steel plates) when cross.
  if (q.eyes === 1 || q.mouth === 2 || hot) {
    p.line(12, cy - 9, 20, cy - 8, 'E').line(28, cy - 8, 36, cy - 9, 'E');
  }

  // Grille mouth.
  const my = cy + 6;
  if (q.mouth === 1) {
    p.rect(19, my - 1, 11, 6, 'M');
    p.rect(19, my - 1, 11, 1, 'E');
    puff(p, 24, my + 2, 2.4, 'u', 'v');
    p.set(21, my + 3, 'v').set(27, my + 1, 'u');
  } else {
    p.rect(19, my, 11, 4, 'M');
    for (let x = 20; x < 30; x += 2) p.rect(x, my, 1, 4, q.mouth === 2 ? 'S' : 'U');
    p.rect(19, my, 11, 1, 'E');
  }

  // Whistle pipe on the right with a puff of steam.
  p.rect(40, cy - 7, 4, 2, 'S').rect(40, cy - 7, 4, 1, 'T');
  p.rect(43, cy - 13, 2, 7, 'S').rect(43, cy - 13, 1, 7, 'T');
  p.rect(42, cy - 15, 4, 2, 'B').rect(42, cy - 15, 4, 1, 'C');
  if (q.puff >= 1) puff(p, 45, cy - 18, 2.2, 'u', 'v');
  if (q.puff >= 2) puff(p, 42, cy - 21, 2.8, 'u', 'v');

  if (hot) {
    // Glowing cracks and steam leaking out of them.
    crack(p, 11, cy - 5, 15, cy + 7, 'k', 'Z', 1);
    crack(p, 34, cy + 1, 38, cy + 9, 'k', 'Z', 2);
    crack(p, cx + 3, dy - 3, cx + 7, dy + 2, 'k', 'Z', 3);
    puff(p, 9, cy + 9 - q.puff, 2, 'u', 'v');
    if (q.puff !== 1) puff(p, 40, cy + 11, 1.8, 'v', 'u');
  }
  return p.outline('o').rows();
}

function governorFrames(look: number): string[][] {
  const f = (spin: number, lift: number, legs: number, eyes: number, mouth: number, puffs: number): string[] =>
    governor({ look, spin, lift, legs, eyes, mouth, puff: puffs });
  return [
    f(0, 0, 0, 0, look === 1 ? 2 : 0, 0),
    f(Math.PI / 2, 0, 0, 0, look === 1 ? 2 : 0, 1),
    f(Math.PI / 4, 1, 1, 0, 0, 1),
    f((3 * Math.PI) / 4, 1, 2, 0, 0, 0),
    f(Math.PI / 3, -2, 0, 1, 2, 2),
    f(Math.PI / 6, 1, 0, 2, 1, 2),
    f(0.9, -3, 0, 1, 2, 1),
    f(1.3, -1, 0, 3, 1, 2),
  ];
}

export const OLD_GOVERNOR_SPRITE: SpriteDef = bossSprite('boss.oldGovernor', 48, 50, 36, GOV_PAL, governorFrames(0), bossAnims(5, 6, 12));
export const OLD_GOVERNOR_HOT_SPRITE: SpriteDef = bossSprite('boss.oldGovernor.hot', 48, 50, 36, GOV_PAL_HOT, governorFrames(1), bossAnims(8, 8, 14));

// ── Gnawgear ────────────────────────────────────────────────────────────────

const GNAW_PAL: Record<string, string> = {
  o,
  Q: '#c08c3c',
  W: '#ecc466',
  X: '#7c5624',
  B: '#6a7472',
  C: '#93a09c',
  D: '#454d4c',
  R: '#d8e0dc',
  S: '#8c979c',
  T: '#c4ced2',
  U: '#56606a',
  w: '#f4f6f0',
  k: '#0f0d18',
  e: '#ffffff',
  M: '#1c0c10',
  t: '#e8e2c8',
  Y: '#ffe07a',
  O: '#2a2218',
  P: '#0f0d18',
};

const GNAW_PAL_HOT: Record<string, string> = {
  ...GNAW_PAL,
  Q: '#b86a34',
  W: '#f0a45a',
  X: '#6e3418',
  B: '#6e6462',
  C: '#9a8a84',
  D: '#4a3c3a',
  w: '#fff0d8',
  P: '#e8402a',
};

interface GnawPose {
  /** 0 whole, 1 stripped. */
  look: number;
  /** Rim rotation (rad). */
  rot: number;
  /** Jaw gap, px. */
  open: number;
  /** 0 normal, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Bob (+ up), px. */
  bob: number;
}

const BROKEN = [1, 5, 8] as const;

function gnawgear(q: GnawPose): string[] {
  const W = 48;
  const H = 48;
  const hot = q.look === 1;
  // Draw the wheel closed on its own grid, then open the jaw by lifting the top half.
  const g = new Pix(W, H);
  const cx = 25;
  const cy = 28 - q.bob;
  // The shoulder gear (behind), counter-rotating.
  gear(g, 11, cy - 17, 5.2, 8, 8, -q.rot * 1.5, 'S', hot ? [2, 3] : []);
  g.map((x, y, c) => (c === 'S' && x + y < 11 + cy - 17 - 3 ? 'T' : c === 'S' && x + y > 11 + cy - 17 + 4 ? 'U' : null));
  g.disc(11, cy - 17, 1.6, 'U');
  if (hot) crack(g, 9, cy - 22, 12, cy - 16, 'k', 'Y', 4);
  // The big wheel: brass teeth and rim, an iron face plate.
  gear(g, cx, cy, 16.5, 20.5, 12, q.rot, 'Q', hot ? BROKEN : []);
  g.map((x, y, c) => {
    if (c !== 'Q') return null;
    const s = x - cx + (y - cy);
    return s < -14 ? 'W' : s > 15 ? 'X' : null;
  });
  g.disc(cx, cy, 14, 'B');
  g.shade('B', 'C', 'D');
  // A groove round the face plate and rivets on it.
  g.map((x, y, c) => {
    if (c !== 'B' && c !== 'C' && c !== 'D') return null;
    const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    return r > 12.6 && r < 13.6 ? 'D' : null;
  });
  for (let i = 0; i < 10; i++) {
    const a = q.rot + (i / 10) * Math.PI * 2;
    if (hot && i === 3) continue;
    g.set(Math.round(cx + Math.cos(a) * 11.4), Math.round(cy + Math.sin(a) * 11.4), 'R');
  }
  if (hot) {
    // Sparks where teeth snapped off, a crack across the plate.
    for (const k of BROKEN) {
      const a = q.rot + (k / 12) * Math.PI * 2;
      g.set(Math.round(cx + Math.cos(a) * 19), Math.round(cy + Math.sin(a) * 19), 'Y');
      g.set(Math.round(cx + Math.cos(a + 0.12) * 20.5), Math.round(cy + Math.sin(a + 0.12) * 20.5), 'Y');
    }
    crack(g, cx - 12, cy + 4, cx - 5, cy + 10, 'k', 'Y', 2);
    crack(g, cx + 6, cy - 12, cx + 11, cy - 6, 'k', 'Y', 5);
  }

  // Compose with the jaw: rows above the split rise by `open`, the gap is the mouth.
  const split = cy + 3;
  const p = new Pix(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = g.get(x, y);
      if (c === '.') continue;
      if (y < split) p.set(x, y - q.open, c);
      else p.set(x, y, c);
    }
  }
  // Mouth: the gap between the halves across the face plate.
  const half = 13;
  if (q.open > 0) {
    for (let y = split - q.open; y < split; y++) {
      for (let x = cx - half; x <= cx + half; x++) {
        const lip = Math.hypot(x + 0.5 - cx, split - cy) <= 14 || y >= split - 1;
        if (lip) p.set(x, y, 'M');
      }
    }
    // Teeth along both lips.
    for (let x = cx - 11; x <= cx + 11; x += 3) {
      p.set(x, split - q.open, 't').set(x + 1, split - q.open, 't');
      if (q.open >= 3) p.set(x + 1, split - q.open + 1, 't');
      p.set(x + 1, split - 1, 't');
      if (q.open >= 3) p.set(x + 1, split - 2, 't');
    }
  } else {
    for (let x = cx - 12; x <= cx + 12; x++) p.set(x, split, 'M');
    for (let x = cx - 11; x <= cx + 11; x += 3) p.set(x, split - 1, 't').set(x + 1, split + 1, 't');
  }

  // Face (on the upper half, lifted with it).
  const ey = cy - 6 - q.open;
  for (const ex of [cx - 5, cx + 5]) {
    if (q.eyes === 3) {
      p.line(ex - 3, ey, ex + 3, ey, 'k').line(ex - 2, ey - 1, ex + 2, ey + 1, 'k');
      continue;
    }
    const ry = q.eyes === 1 ? 1.5 : q.eyes === 2 ? 4.2 : 3.6;
    p.ellipse(ex, ey, 3.3, ry, 'w');
    p.rect(ex + 1, ey - (q.eyes === 1 ? 0 : 1), 2, q.eyes === 1 ? 1 : 2, 'P');
    if (q.eyes !== 1) p.set(ex + 2, ey - 1, 'e');
  }
  // Angry brows (iron bars), lower on the telegraph.
  const bl = q.eyes === 1 ? 1 : 0;
  p.line(cx - 9, ey - 5 + bl, cx - 2, ey - 3 + bl, 'O').line(cx - 9, ey - 4 + bl, cx - 2, ey - 2 + bl, 'O');
  p.line(cx + 2, ey - 3 + bl, cx + 9, ey - 5 + bl, 'O').line(cx + 2, ey - 2 + bl, cx + 9, ey - 4 + bl, 'O');
  if (hot) {
    // A trail of oil from the bottom teeth.
    p.set(cx - 4, cy + 21, 'k').set(cx - 4, cy + 22, 'k');
  }
  return p.outline('o').rows();
}

function gnawFrames(look: number): string[][] {
  const T = Math.PI / 12; // half a tooth: two frames make a seamless roll
  const f = (rot: number, open: number, eyes: number, bob: number): string[] => gnawgear({ look, rot, open, eyes, bob });
  return [f(0, 0, 0, 0), f(0, 0, 0, 1), f(0, 0, 0, 0), f(T, 0, 0, 1), f(T * 0.5, 2, 1, -1), f(T, 5, 2, 1), f(0, 1, 1, -2), f(T * 0.3, 3, 3, 0)];
}

export const GNAWGEAR_SPRITE: SpriteDef = bossSprite('boss.gnawgear', 48, 48, 36, GNAW_PAL, gnawFrames(0), bossAnims(2, 10, 16));
export const GNAWGEAR_STRIPPED_SPRITE: SpriteDef = bossSprite('boss.gnawgear.stripped', 48, 48, 36, GNAW_PAL_HOT, gnawFrames(1), bossAnims(3, 12, 18));
