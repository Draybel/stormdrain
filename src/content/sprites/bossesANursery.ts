/**
 * The Drowned Nursery bosses (boss pack A), painted with ./paint.ts: 1 px dark outline, lit from the
 * top-left, side views face RIGHT. Every boss has a second sprite of the same size and anchor for its
 * later phases (swapped in by the boss hook in content/hooks/bosses-a.ts), so the change of phase is a
 * change of shape, not just of colour. Animations follow the boss renderer's names: idle, move,
 * charge, windup, slam, roar, air, hurt.
 *
 *   Pirouetta       36×52  a porcelain music-box dancer on her lacquered drum. Overwound: cracked
 *                          porcelain, a snapped arm, the mainspring sprung out of the lid, glowing eyes.
 *   Sir Sopsalot    48×46  a waterlogged teddy knight with a paper-boat hat and a wooden-spoon sword.
 *                          Unstitched: the belly seam bursts, stuffing everywhere, a button eye dangling.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const o = OUTLINE;

// ── Pirouetta ────────────────────────────────────────────────────────────────

const PIR_PAL = {
  o,
  // porcelain
  p: '#f6eef2',
  P: '#fffbfd',
  q: '#cdbccb',
  // cheeks, lips, eyes
  c: '#f08aa6',
  m: '#a83a58',
  k: '#1a1024',
  e: '#ffffff',
  // hair
  h: '#4a2c32',
  H: '#74454e',
  // bodice
  b: '#e27a9a',
  B: '#f6aac2',
  d: '#a8486a',
  // tutu (soggy pink with algae on the hem)
  t: '#f2c4d2',
  T: '#fff0f5',
  u: '#c888a0',
  s: '#6fae9e',
  S: '#3f7a6c',
  // the music box: teal lacquer, brass trim, painted flowers
  l: '#3f8a8a',
  L: '#66b4ac',
  n: '#2a5e62',
  N: '#1a3c40',
  g: '#d0a44a',
  G: '#f6dc8a',
  r: '#86652a',
  f: '#f08aa6',
  F: '#fff0a0',
  w: '#8cc8ea',
  // Overwound: cracks, glowing eyes, the sprung mainspring
  x: '#3a2236',
  X: '#7ff0e0',
  z: '#d6dae6',
  Z: '#8a8ea4',
};

interface DancerPose {
  /** Dancer height offset (negative = rising). */
  lift: number;
  /** 0 front, 1 three-quarter right, 2 back, 3 three-quarter left (the pirouette). */
  view: number;
  /** 0 fifth position (arms arched overhead), 1 first (rounded low), 2 second (flung out), 3 drooped. */
  arms: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 a small smile, 1 singing 'O'. */
  mouth: number;
  /** Wind-up key turn, 0-2. */
  key: number;
  /** Tutu half-width. */
  tutu: number;
  /** Overwound (phase 2). */
  broken: boolean;
}

function dancer(ps: DancerPose): string[] {
  const W = 36;
  const H = 52;
  const p = new Pix(W, H);
  const L = ps.lift;
  const br = ps.broken;

  // The music-box drum: teal lacquer, brass bands, painted flowers.
  p.ellipse(18, 47.6, 10, 2.4, 'l');
  p.rect(8, 40, 20, 8, 'l');
  p.map((x, y, c) => (c === 'l' ? (x <= 9 ? 'L' : x >= 26 || y >= 48 ? 'n' : null) : null));
  p.rect(8, 42, 20, 1, 'G').rect(8, 43, 20, 1, 'g').rect(8, 47, 20, 1, 'r');
  for (const fx of [12, 18, 24]) {
    p.set(fx, 44, 'f').set(fx - 1, 45, 'f').set(fx + 1, 45, 'f').set(fx, 46, 'f').set(fx, 45, 'F');
  }
  p.set(15, 45, 's').set(21, 45, 's');
  // The lid: brass rim around the lacquered top.
  p.ellipse(18, 40, 10, 3, 'g');
  p.ellipse(18, 40, 8.6, 2, 'L');
  p.ellipse(18.6, 40.4, 6.4, 1.2, 'l');
  p.set(10, 39, 'G').set(11, 38, 'G').set(12, 38, 'G');
  if (br) {
    // Chipped lacquer, drips, and the mainspring bursting out of the lid.
    p.rect(11, 45, 2, 1, 'N').rect(23, 46, 2, 1, 'N').set(16, 48, 'N');
    p.set(13, 50, 'w').set(13, 51, 'w').set(24, 50, 'w');
    const zig = [12, 39, 8, 37, 12, 35, 8, 33, 12, 31, 9, 30];
    for (let i = 0; i + 3 < zig.length; i += 2) p.line(zig[i]!, zig[i + 1]!, zig[i + 2]!, zig[i + 3]!, i % 4 ? 'Z' : 'z');
    p.disc(9, 29, 1.3, 'z').set(9, 28, 'Z');
  }
  // The wind-up key on the side (it turns).
  p.rect(28, 44, 2, 2, 'r');
  if (ps.key === 0) {
    p.rect(30, 41, 2, 8, 'g').disc(31, 41.5, 1.7, 'g').disc(31, 48.5, 1.7, 'g').set(30, 41, 'G').set(30, 48, 'G');
  } else if (ps.key === 1) {
    p.line(29, 41, 33, 47, 'g').line(30, 41, 34, 47, 'g').disc(30, 41, 1.5, 'G').disc(33, 47, 1.5, 'g');
  } else {
    p.rect(30, 43, 3, 3, 'g').set(30, 43, 'G');
  }
  if (br) p.set(33, 41, 'r').set(34, 40, 'r');

  // The spindle up to her pointe shoe.
  const sy = 35 + L;
  p.rect(17, sy, 2, Math.max(1, 40 - sy), 'g').rect(17, sy, 1, Math.max(1, 40 - sy), 'G');

  // Legs: one en pointe, one bent up behind her (attitude).
  p.rect(17, 28 + L, 2, 6, 'p').rect(18, 28 + L, 1, 6, 'q');
  p.rect(17, 34 + L, 2, 1, 'b');
  const back = ps.view === 3 ? -1 : 1;
  const kx = 18 + back * 6;
  p.line(18 + back, 29 + L, kx, 32 + L, 'p').line(18 + back, 30 + L, kx, 33 + L, 'q');
  p.line(kx, 32 + L, kx + back * 2, 28 + L, 'p').line(kx + back, 32 + L, kx + back * 3, 28 + L, 'q');
  p.set(kx + back * 2, 27 + L, 'b').set(kx + back * 3, 27 + L, 'b');

  // Tutu: layered net with a soggy, algae-stained hem.
  const ty = 27 + L;
  p.ellipse(18, ty, ps.tutu, 3.6, 't');
  p.ellipse(17, ty - 1, ps.tutu - 2, 1.7, 'T');
  p.map((x, y, c) => (c === 't' && y >= ty + 1.5 ? ((x + ps.view) % 2 === 0 ? 'u' : null) : null));
  const r0 = 18 - Math.floor(ps.tutu);
  const r1 = 18 + Math.floor(ps.tutu);
  for (let x = r0; x <= r1; x++) {
    const hv = hash2(x + ps.view * 5, 3, 11);
    let yb = ty + 3;
    while (yb > ty && p.get(x, yb) === '.') yb--;
    if (hv > 0.55 && yb > ty) p.set(x, yb, hv > 0.82 ? 'S' : 's');
    if (br && hv < 0.24 && yb > ty) {
      // Torn: bites out of the hem.
      p.set(x, yb, '.');
      if (hv < 0.12) p.set(x, yb - 1, '.');
    }
  }
  if (br) p.set(r0 + 2, ty + 4, 's').set(r1 - 3, ty + 4, 'S');

  // Bodice.
  p.ellipse(18, 21.5 + L, 4, 4.8, 'b');
  p.map((x, y, c) => (c === 'b' ? (x <= 15 ? 'B' : x >= 20 ? 'd' : null) : null));
  p.rect(14, 25 + L, 9, 1, 'd').set(18, 18 + L, 'B').set(17, 18 + L, 'B');
  if (br) p.line(17, 19 + L, 19, 23 + L, 'x').set(20, 23 + L, 'x');

  // Arms (porcelain, two pixels thick).
  const arm = (pts: number[], dx: number, dy: number): void => {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      p.line(pts[i]!, pts[i + 1]! + L, pts[i + 2]!, pts[i + 3]! + L, 'p');
      p.line(pts[i]! + dx, pts[i + 1]! + L + dy, pts[i + 2]! + dx, pts[i + 3]! + L + dy, 'q');
    }
  };
  const tilt = ps.view === 1 ? 1 : ps.view === 3 ? -1 : 0;
  if (ps.arms === 0) arm([14, 18, 10 + tilt, 13, 10 + tilt, 7, 13 + tilt, 3, 16 + tilt, 2], 1, 0);
  else if (ps.arms === 1) arm([14, 18, 11, 22, 13, 25, 17, 25], 1, 0);
  else if (ps.arms === 2) arm([14, 18, 9, 16, 3, 17], 0, 1);
  else arm([14, 18, 12, 23, 12, 28], 1, 0);
  if (br) {
    // Snapped at the elbow: a jagged stump.
    const e = ps.arms === 2 ? [22, 18, 27, 16] : ps.arms === 3 ? [22, 18, 24, 23] : ps.arms === 1 ? [22, 18, 25, 22] : [22, 18, 26, 13];
    arm(e, -1, 0);
    const ex = e[2]!;
    const ey = e[3]! + L;
    p.set(ex, ey, 'q').set(ex + 1, ey - 1, 'x').set(ex - 1, ey - 1, 'x');
  } else if (ps.arms === 0) arm([22, 18, 26 + tilt, 13, 26 + tilt, 7, 23 + tilt, 3, 20 + tilt, 2], -1, 0);
  else if (ps.arms === 1) arm([22, 18, 25, 22, 23, 25, 19, 25], -1, 0);
  else if (ps.arms === 2) arm([22, 18, 27, 16, 33, 17], 0, 1);
  else arm([22, 18, 24, 23, 24, 28], -1, 0);

  // Neck and head.
  p.rect(17, 15 + L, 2, 3, 'p').set(18, 16 + L, 'q');
  const hx = ps.arms === 3 ? 19 : 18;
  const hy = 11 + L;
  p.disc(hx, hy, 5, 'p');
  p.map((x, y, c) => (c === 'p' && Math.hypot(x + 0.5 - hx, y + 0.5 - hy) < 5.1 && x - hx + (y - hy) > 4 ? 'q' : null));
  p.set(hx - 3, hy - 2, 'P').set(hx - 2, hy - 3, 'P');
  // Hair: a cap and a bun with a little algae flower pinned in it.
  const shift = ps.view === 1 ? -1 : ps.view === 3 ? 1 : 0;
  p.map((x, y, c) => {
    if (c !== 'p' && c !== 'q' && c !== 'P') return null;
    if (Math.hypot(x + 0.5 - hx, y + 0.5 - hy) > 5.2) return null;
    if (ps.view === 2) return y <= hy + 4 ? 'h' : null;
    if (y < hy - 1.5 || (y < hy + 1.5 && (x + 0.5 - hx) * shift > 2.5)) return 'h';
    return null;
  });
  p.disc(hx + shift, hy - 6, 2.5, 'h').set(hx + shift - 1, hy - 7, 'H').set(hx + shift, hy - 8, 'H');
  p.set(hx - 3, hy - 3, 'H');
  p.set(hx + 2 + shift, hy - 6, 's').set(hx + 3 + shift, hy - 6, 'F').set(hx + 3 + shift, hy - 7, 's');
  if (ps.view === 2) {
    // A ribbon on the bun, seen from behind.
    p.set(hx - 2, hy - 3, 'b').set(hx + 2, hy - 3, 'b').set(hx - 1, hy - 3, 'B').set(hx + 1, hy - 3, 'B').set(hx, hy - 3, 'd');
  } else {
    const fx = hx + shift;
    const eye = (ex: number): void => {
      const ey = hy;
      if (ps.eyes === 3) {
        p.set(ex - 1, ey, 'k').set(ex, ey - 1, 'k').set(ex + 1, ey, 'k');
        return;
      }
      const hgt = ps.eyes === 1 ? 1 : ps.eyes === 2 ? 3 : 2;
      const top = ey - (hgt > 1 ? 1 : 0);
      p.rect(ex, top, 2, hgt, 'k');
      if (ps.eyes !== 1) p.set(ex, top, br ? 'X' : 'e');
      if (br && ps.eyes !== 1) p.set(ex + 1, top + 1, 'X');
    };
    eye(fx - 3);
    eye(fx + 1);
    p.set(fx - 4, hy + 2, 'c').set(fx + 3, hy + 2, 'c');
    if (ps.mouth === 1) p.rect(fx - 1, hy + 2, 2, 2, 'm');
    else p.set(fx - 1, hy + 3, 'm').set(fx, hy + 3, 'm');
    if (br) {
      // A crack across the porcelain face.
      p.line(hx - 4, hy - 2, hx - 2, hy + 1, 'x').line(hx - 2, hy + 1, hx - 3, hy + 3, 'x');
    }
  }
  return p.outline('o').rows();
}

function pirouettaFrames(broken: boolean): string[][] {
  const base = { lift: 0, view: 0, arms: 0, eyes: 0, mouth: 0, key: 0, tutu: 11.5, broken };
  return [
    dancer({ ...base }),
    dancer({ ...base, lift: -1, key: 1, tutu: 11.9 }),
    dancer({ ...base, view: 1, key: 2, tutu: 11 }),
    dancer({ ...base, view: 2, key: 0, tutu: 10.6 }),
    dancer({ ...base, view: 3, key: 1, tutu: 11 }),
    dancer({ ...base, lift: 2, arms: 1, eyes: 1, tutu: 12.6 }),
    dancer({ ...base, lift: -1, arms: 2, eyes: 2, mouth: 1, key: 2 }),
    dancer({ ...base, lift: -1, arms: 0, eyes: 2, mouth: 1, tutu: 12.4 }),
    dancer({ ...base, lift: 1, arms: 3, eyes: 3, tutu: 10.8 }),
  ];
}

const PIROUETTA_ANIMS = {
  idle: { frames: [0, 1], fps: 2, loop: true },
  move: { frames: [0, 2, 3, 4], fps: 7, loop: true },
  charge: { frames: [0, 2, 3, 4], fps: 14, loop: true },
  windup: { frames: [5], fps: 1, loop: true },
  slam: { frames: [5], fps: 1, loop: true },
  roar: { frames: [6], fps: 1, loop: true },
  air: { frames: [7], fps: 1, loop: true },
  hurt: { frames: [8], fps: 1, loop: true },
};

export const PIROUETTA_SPRITE: SpriteDef = {
  id: 'boss.pirouetta',
  anchorY: 38,
  w: 36,
  h: 52,
  palette: PIR_PAL,
  frames: pirouettaFrames(false),
  anims: PIROUETTA_ANIMS,
};

export const PIROUETTA_OVERWOUND_SPRITE: SpriteDef = {
  id: 'boss.pirouetta.overwound',
  anchorY: 38,
  w: 36,
  h: 52,
  palette: PIR_PAL,
  frames: pirouettaFrames(true),
  anims: PIROUETTA_ANIMS,
};

// ── Sir Sopsalot ─────────────────────────────────────────────────────────────

const BEAR_PAL = {
  o,
  // wet plush
  a: '#9a7652',
  A: '#bc986c',
  s: '#72543a',
  S: '#54402e',
  // muzzle, paw pads, inner ears
  m: '#dcc49c',
  M: '#b89c74',
  n: '#2a1a16',
  // eyes: a big button and a cross-stitch
  k: '#161024',
  K: '#40365a',
  j: '#8a80b0',
  e: '#ffffff',
  x: '#e8dcc0',
  // gingham patch
  b: '#4a78b8',
  B: '#9cc0ea',
  // paper-boat hat (newspaper)
  h: '#ece4cc',
  H: '#fffaea',
  i: '#aaa08a',
  I: '#6e6858',
  // wooden-spoon sword
  w: '#c8904a',
  W: '#eab872',
  v: '#86582a',
  // bathwater
  d: '#8cc8ea',
  D: '#d8f0ff',
  // Unstitched: stuffing, thread
  f: '#f4f0e8',
  F: '#d2cac2',
  t: '#c84a4a',
};

interface BearPose {
  /** Body squash: extra half-width and vertical drop. */
  sq: number;
  /** Head / body raise (negative = up). */
  lift: number;
  /** 0 spoon held up at the side, 1 raised overhead (telegraph), 2 both arms up (roar), 3 limp. */
  arms: number;
  /** Feet: 0 planted, 1 left up, 2 right up, 3 dangling (air). */
  feet: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  mouth: number;
  drip: number;
  torn: boolean;
}

function bear(ps: BearPose): string[] {
  const W = 48;
  const H = 46;
  const p = new Pix(W, H);
  const L = ps.lift;
  const t = ps.torn;

  // Feet (sitting, stubby legs forward).
  const foot = (fx: number, up: number): void => {
    p.ellipse(fx, 41 - up, 5.2, 3.6, 'a');
    p.ellipse(fx, 41.5 - up, 3, 2.2, 'm').ellipse(fx, 42 - up, 1.5, 1, 'M');
  };
  const fl = ps.feet === 1 ? 2 : ps.feet === 3 ? -1 : 0;
  const fr = ps.feet === 2 ? 2 : ps.feet === 3 ? -1 : 0;
  // Body.
  const by = 30 + L * 0.5 + ps.sq * 0.5;
  p.ellipse(24, by, 14 + ps.sq, 11 - ps.sq * 0.4, 'a');
  foot(13, fl);
  foot(35, fr);
  // Belly: a gingham patch (Unstitched: the seam bursts, stuffing spills out).
  if (!t) {
    p.rect(19, by - 3, 9, 8, 'b');
    p.map((x, y, c) => (c === 'b' && (x + y) % 2 === 0 && (x % 3 === 0 || y % 3 === 0) ? 'B' : null));
    for (let x = 19; x < 28; x += 2) p.set(x, by - 4, 'x').set(x + 1, by + 5, 'x');
    for (let y = Math.floor(by) - 3; y < by + 5; y += 2) p.set(18, y, 'x').set(28, y, 'x');
  } else {
    // A ragged split with stuffing billowing out.
    p.ellipse(24, by + 1, 7, 5.5, 'S');
    p.disc(21, by - 1, 3.2, 'f').disc(26, by, 3.6, 'f').disc(23, by + 3, 3, 'f').disc(28, by + 3, 2.2, 'F');
    p.disc(19, by + 3, 2, 'F').set(22, by - 2, 'F').set(27, by - 1, 'F');
    // Loose stitches and a dangling patch corner.
    p.set(17, by - 3, 'x').set(31, by - 2, 'x').set(16, by + 4, 'x').set(32, by + 4, 'x');
    p.rect(29, by + 5, 4, 3, 'b').set(30, by + 6, 'B').set(32, by + 6, 'B');
    p.set(20, by + 9, 'f').set(34, by + 8, 'F');
  }
  // Arms.
  const armAt = (x: number, y: number, x2: number, y2: number): void => {
    for (let i = 0; i <= 6; i++) {
      const k = i / 6;
      p.disc(x + (x2 - x) * k, y + (y2 - y) * k, 3.1, 'a');
    }
    p.disc(x2, y2, 2.2, 'm');
  };
  const sy = by - 6;
  if (ps.arms === 2) {
    armAt(11, sy, 5, sy - 11);
    armAt(37, sy, 43, sy - 11);
  } else if (ps.arms === 3) {
    armAt(11, sy, 8, sy + 10);
    armAt(37, sy, 40, sy + 10);
  } else {
    armAt(11, sy, 7, sy + 8);
    armAt(37, sy, 41, sy + (ps.arms === 1 ? -9 : 5));
  }
  // The wooden spoon (sword) in the right paw.
  const spoon = (x: number, y: number, dx: number, dy: number): void => {
    p.line(x, y, x + dx * 9, y + dy * 9, 'w').line(x + 1, y, x + 1 + dx * 9, y + dy * 9, 'v');
    p.ellipse(x + dx * 12, y + dy * 12, 2.6, 2.6, 'w').set(x + dx * 12 - 1, y + dy * 12 - 1, 'W');
  };
  if (ps.arms === 0) spoon(42, sy + 4, 0.25, -1);
  else if (ps.arms === 1) spoon(41, sy - 10, -0.55, -0.4);
  else if (ps.arms === 2) spoon(44, sy - 12, 0.2, -0.5);
  else spoon(40, sy + 12, 0.8, 0.1);

  // Head, ears.
  const hy = 15 + L;
  const ear = (ex: number, torn: boolean): void => {
    if (torn) {
      // Half torn off, flopping.
      p.ellipse(ex - 1, hy - 6, 4, 3, 'a').ellipse(ex - 1, hy - 6, 2, 1.4, 'M').set(ex - 4, hy - 4, 'f').set(ex - 3, hy - 4, 'F');
      return;
    }
    p.disc(ex, hy - 8, 4.2, 'a').disc(ex, hy - 8, 2.2, 'M');
  };
  ear(14, false);
  ear(34, t);
  p.ellipse(24, hy, 12, 10.5, 'a');
  // Lighting: top-left light, bottom-right shade on the plush.
  p.shade('a', 'A', 's');
  // Soaked darker bottom (the water line).
  p.map((x, y, c) => ((c === 'a' || c === 'A') && y > 38 - (t ? 6 : 0) + hash2(x, 1, 5) * 2 ? 's' : null));
  // Muzzle, nose, mouth.
  p.ellipse(24, hy + 4, 5.4, 3.8, 'm');
  p.map((x, y, c) => (c === 'm' && y > hy + 5 ? 'M' : null));
  p.rect(22, hy + 1, 5, 2, 'n').set(23, hy + 1, 'e');
  if (ps.mouth === 1) {
    p.ellipse(24.5, hy + 6, 2.6, 1.8, 'n');
  } else {
    p.line(24, hy + 3, 24, hy + 4, 'n').line(22, hy + 5, 24, hy + 4, 'n').line(24, hy + 4, 26, hy + 5, 'n');
  }
  // Eyes: a big shiny button (left) and a cross-stitch (right).
  const bx = 18;
  const ey = hy - 2;
  if (ps.eyes === 3) {
    p.line(bx - 2, ey, bx + 2, ey, 'k');
  } else if (t) {
    // The button hangs by a thread below its socket.
    p.set(bx, ey - 1, 'S').set(bx + 1, ey, 'x').set(bx + 1, ey + 1, 'x').set(bx + 1, ey + 2, 'x');
    p.disc(bx + 1, ey + 5, 2.3, 'K').set(bx, ey + 4, 'j').set(bx + 1, ey + 5, 'k').set(bx + 2, ey + 5, 'k');
  } else {
    const r = ps.eyes === 2 ? 3.2 : ps.eyes === 1 ? 2 : 2.8;
    p.disc(bx, ey, r, 'K');
    p.set(bx - 1, ey - 1, 'j').set(bx, ey - 2, 'j');
    if (ps.eyes !== 1) p.set(bx - 1, ey, 'k').set(bx + 1, ey, 'k').set(bx, ey + 1, 'k').set(bx - 1, ey - 1, 'e');
  }
  const sx = 30;
  if (ps.eyes === 3) {
    p.line(sx - 2, ey, sx + 2, ey, 'k');
  } else {
    const n = ps.eyes === 2 ? 3 : 2;
    p.line(sx - n, ey - n, sx + n, ey + n, 'k').line(sx - n, ey + n, sx + n, ey - n, 'k');
    if (t) p.set(sx + n + 1, ey - n - 1, 't').set(sx + n + 2, ey - n, 't');
  }
  // Brows (grumpy when winding up).
  if (ps.eyes === 1) {
    p.line(14, ey - 5, 20, ey - 3, 'S').line(27, ey - 3, 33, ey - 5, 'S');
  }
  // A folded newspaper boat hat (soggy and torn when unstitched).
  const hatY = hy - 10;
  if (!t) {
    for (let r = 0; r < 7; r++) p.rect(24 - (r + 2), hatY - 6 + r, (r + 2) * 2 + 1, 1, r < 1 ? 'H' : 'h');
    p.rect(14, hatY + 1, 21, 2, 'h').rect(14, hatY + 1, 21, 1, 'H');
    for (let x = 17; x < 31; x += 3) p.set(x, hatY - 1, 'i').set(x + 1, hatY - 1, 'i');
    p.line(20, hatY - 3, 27, hatY - 3, 'i').set(24, hatY - 5, 'I');
    p.rect(22, hatY - 1, 5, 2, 'I').set(23, hatY, 'h');
  } else {
    // Collapsed into a wet lump, one corner hanging.
    p.ellipse(22, hatY + 0.5, 8, 2.6, 'i').ellipse(21, hatY, 6, 1.6, 'h');
    p.line(29, hatY + 1, 33, hatY + 5, 'i').set(33, hatY + 6, 'd');
    p.set(18, hatY, 'I').set(24, hatY + 1, 'I');
  }
  // Drips of bathwater.
  const dp = ps.drip;
  p.set(9 + dp, sy + 10 + dp, 'd').set(9 + dp, sy + 11 + dp, 'D');
  p.set(33 - dp, hy + 11 + dp, 'd').set(15, hy + 10 - dp, 'd');
  if (t) p.set(24, by + 11, 'd').set(12, by + 8, 'D');
  return p.outline('o').rows();
}

function sopsalotFrames(torn: boolean): string[][] {
  const base: BearPose = { sq: 0, lift: 0, arms: 0, feet: 0, eyes: 0, mouth: 0, drip: 0, torn };
  return [
    bear({ ...base }),
    bear({ ...base, sq: 0.6, lift: 1, drip: 1 }),
    bear({ ...base, feet: 1, lift: -1, drip: 1 }),
    bear({ ...base, feet: 2, lift: -1 }),
    bear({ ...base, sq: 1.6, lift: 2, arms: 1, eyes: 1 }),
    bear({ ...base, sq: -0.6, lift: -2, arms: 2, eyes: 2, mouth: 1, drip: 1 }),
    bear({ ...base, sq: -1, lift: -2, feet: 3, arms: 2, eyes: 2 }),
    bear({ ...base, sq: 2.2, lift: 3, feet: 0, arms: 3, eyes: 1, mouth: 1 }),
    bear({ ...base, sq: 1, lift: 2, arms: 3, eyes: 3, mouth: 1 }),
  ];
}

const SOPSALOT_ANIMS = {
  idle: { frames: [0, 1], fps: 2, loop: true },
  move: { frames: [2, 0, 3, 0], fps: 7, loop: true },
  charge: { frames: [2, 3], fps: 12, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [6], fps: 1, loop: true },
  slam: { frames: [7], fps: 1, loop: true },
  hurt: { frames: [8], fps: 1, loop: true },
};

export const SOPSALOT_SPRITE: SpriteDef = {
  id: 'boss.sopsalot',
  anchorY: 33,
  w: 48,
  h: 46,
  palette: BEAR_PAL,
  frames: sopsalotFrames(false),
  anims: SOPSALOT_ANIMS,
};

export const SOPSALOT_UNSTITCHED_SPRITE: SpriteDef = {
  id: 'boss.sopsalot.unstitched',
  anchorY: 33,
  w: 48,
  h: 46,
  palette: BEAR_PAL,
  frames: sopsalotFrames(true),
  anims: SOPSALOT_ANIMS,
};
