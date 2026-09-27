/**
 * The Rootcellar bosses (boss pack A), painted with ./paint.ts: 1 px dark outline, lit from the
 * top-left, side views face RIGHT. Each has a second sprite (same size and anchor) for its later
 * phases, swapped in by content/hooks/bosses-a.ts.
 *
 *   Grandmother Brine  44×50  an old pickle in spectacles, steeping in a dipped stoneware crock, dill for
 *                             hair. Fermenting: the crock cracks and seeps, the lid of her temper blows
 *                             (bubbles, a cracked lens, red eyes, wilted dill).
 *   Old Knotroot       44×50  a wailing mandrake half-buried in a mound of soil, a crown of leaves.
 *                             Uprooted: pulled clean out on forked root legs, bark split, leaves wilted,
 *                             eyes smouldering.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const o = OUTLINE;

// ── Grandmother Brine ────────────────────────────────────────────────────────

const BRINE_PAL = {
  o,
  // stoneware: cream glaze over a tan dip, a cobalt band
  c: '#e8dcc0',
  C: '#fff6e2',
  v: '#b8aa8a',
  a: '#c49a6a',
  A: '#e0bc88',
  u: '#8e6a40',
  b: '#4a6ab0',
  B: '#86a6e0',
  // brine
  g: '#3a5a2a',
  G: '#86a848',
  // the pickle
  P: '#6a9a3a',
  Q: '#a2cc58',
  R: '#44701e',
  U: '#8a9a2a',
  // spectacles, eyes, mouth
  w: '#c8ccd8',
  W: '#ffffff',
  l: '#bfe4f4',
  k: '#141016',
  M: '#2a1a10',
  t: '#f0e0c8',
  // dill
  d: '#5a8a3a',
  D: '#94c460',
  y: '#e8d060',
  // Fermenting: cracks, seep, bubbles, angry eyes, wilted dill
  x: '#3a2a1a',
  s: '#b8d860',
  r: '#ff5a3a',
  e: '#8a7a3a',
};

interface CrockPose {
  /** The pickle's rise out of the brine (negative = higher). */
  rise: number;
  /** Crock hop (negative = up) and squash (extra half-width). */
  hop: number;
  sq: number;
  /** Pickle sway, px. */
  sway: number;
  /** 0 kindly, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 smile, 1 shouting. */
  mouth: number;
  ferment: boolean;
}

function crock(ps: CrockPose): string[] {
  const W = 44;
  const H = 50;
  const p = new Pix(W, H);
  const f = ps.ferment;
  const cx = 22;
  const top = 20 + ps.hop;
  const bot = 47 + ps.hop;
  const span = bot - top;
  const hwAt = (y: number): number => 12.5 + ps.sq + 3 * Math.sin((Math.PI * (y - top + 1)) / (span + 2));

  // The crock body: a bulging stoneware pot, cream glaze dipped in tan.
  for (let y = top; y <= bot; y++) {
    const hw = y >= bot - 1 ? hwAt(y) - 1.5 : hwAt(y);
    for (let x = Math.ceil(cx - hw); x <= Math.floor(cx + hw); x++) {
      const dip = top + 11 + Math.round(Math.sin(x * 0.7) * 1.2);
      const edgeL = x - (cx - hw) < 2.2;
      const edgeR = cx + hw - x < 2.6;
      if (y < dip) p.set(x, y, edgeL ? 'C' : edgeR ? 'v' : 'c');
      else p.set(x, y, edgeL ? 'A' : edgeR || y >= bot - 1 ? 'u' : 'a');
    }
  }
  // Cobalt band and a painted sprig.
  const band = top + 5;
  for (let x = 0; x < W; x++) {
    if (p.get(x, band) === 'c' || p.get(x, band) === 'C' || p.get(x, band) === 'v') p.set(x, band, p.get(x, band) === 'v' ? 'b' : 'B');
    if (p.get(x, band + 1) === 'c' || p.get(x, band + 1) === 'C' || p.get(x, band + 1) === 'v') p.set(x, band + 1, 'b');
  }
  p.line(14, top + 9, 17, top + 8, 'b').set(15, top + 7, 'b').set(16, top + 10, 'B').set(12, top + 8, 'b');
  // Ear handles.
  const hwH = hwAt(top + 4);
  for (const s of [-1, 1]) {
    const hx = cx + s * (hwH + 2);
    p.ellipse(hx, top + 5, 2.2, 3, s < 0 ? 'C' : 'v').ellipse(hx, top + 5, 0.9, 1.6, '.');
  }
  // Rim and the brine inside.
  const rimY = top;
  p.ellipse(cx, rimY, 14 + ps.sq, 3.4, 'c');
  p.ellipse(cx, rimY + 0.3, 12 + ps.sq, 2.3, 'g');
  for (let x = cx - 9; x <= cx + 9; x += 3) p.set(x + (ps.sway & 1), rimY, 'G');

  // The pickle, rising out of the brine (clipped by the rim's front edge).
  const px = cx + ps.sway;
  const py = 13 + ps.rise + ps.hop;
  const pk = new Pix(W, H);
  pk.ellipse(px, py, 8.2, 11, 'P');
  pk.map((x, y, c) => {
    if (c !== 'P') return null;
    const dx = x + 0.5 - px;
    const dy = y + 0.5 - py;
    if (dx + dy < -9) return 'Q';
    if (dx > 5 || dx + dy > 8) return 'R';
    return hash2(x, y, 4) > 0.9 ? 'Q' : hash2(x, y, 9) > 0.93 ? 'R' : null;
  });
  if (f) pk.map((x, y, c) => (c === 'P' && hash2(x, y, 2) > 0.5 ? 'U' : null));
  // Dill for hair (wilted and drooping when fermenting).
  const hairY = py - 10;
  if (!f) {
    const fronds = [
      [px, hairY + 1, px - 1, hairY - 5],
      [px - 2, hairY + 2, px - 6, hairY - 3],
      [px + 2, hairY + 2, px + 6, hairY - 3],
      [px - 3, hairY + 3, px - 8, hairY + 1],
      [px + 3, hairY + 3, px + 8, hairY + 1],
    ];
    for (const [x0, y0, x1, y1] of fronds) {
      pk.line(x0!, y0!, x1!, y1!, 'd');
      pk.set(x1!, y1!, 'D').set(x1! + (x1! < px ? 1 : -1), y1! - 1, 'D');
    }
    pk.set(px - 1, hairY - 6, 'y').set(px - 6, hairY - 4, 'y').set(px + 6, hairY - 4, 'y').set(px + 1, hairY - 5, 'y');
  } else {
    pk.line(px - 1, hairY + 1, px - 7, hairY + 3, 'e').line(px + 1, hairY + 1, px + 7, hairY + 4, 'e');
    pk.line(px, hairY + 1, px + 2, hairY - 3, 'e').line(px + 2, hairY - 3, px + 4, hairY - 2, 'e');
    pk.set(px - 7, hairY + 4, 'd').set(px + 7, hairY + 5, 'd');
  }
  // Spectacles and eyes.
  const ey = py - 2;
  const lens = (lx: number, cracked: boolean): void => {
    pk.ellipse(lx, ey, 2.9, 2.6, 'w').ellipse(lx, ey, 1.9, 1.6, 'l');
    if (ps.eyes === 3) pk.line(lx - 1, ey, lx + 1, ey, 'k');
    else if (ps.eyes === 1) pk.rect(lx - 1, ey, 2, 1, 'k');
    else {
      pk.rect(lx - 1 + (ps.eyes === 2 ? 0 : 0), ey - 1, 2, ps.eyes === 2 ? 3 : 2, 'k');
      if (f) pk.set(lx, ey, 'r');
    }
    pk.set(lx - 1, ey - 1, ps.eyes === 0 || ps.eyes === 2 ? 'W' : 'l');
    if (cracked) pk.line(lx - 2, ey - 1, lx + 1, ey + 1, 'k').set(lx + 1, ey - 1, 'W');
  };
  lens(px - 4, false);
  lens(px + 4, f);
  pk.set(px, ey - 1, 'w').set(px - 1, ey - 1, 'w').set(px + 1, ey - 1, 'w');
  if (f || ps.eyes === 1) {
    // Cross brows over the lenses.
    pk.line(px - 7, ey - 4, px - 2, ey - 3, 'R').line(px + 2, ey - 3, px + 7, ey - 4, 'R');
  } else {
    pk.line(px - 6, ey - 4, px - 3, ey - 5, 'R').line(px + 3, ey - 5, px + 6, ey - 4, 'R');
  }
  // Mouth: a wrinkly smile, or a shout.
  const my = py + 3;
  if (ps.mouth === 1) {
    pk.ellipse(px, my + 1, 3, 2.4, 'M').set(px - 1, my, 't').set(px + 1, my, 't');
  } else {
    pk.line(px - 3, my, px - 1, my + 1, 'M').line(px - 1, my + 1, px + 1, my + 1, 'M').line(px + 1, my + 1, px + 3, my, 'M');
    pk.set(px - 4, my - 1, 'R').set(px + 4, my - 1, 'R');
  }
  // Clip the pickle at the brine line, then paste it into the crock.
  const brineY = rimY + 1;
  pk.map((x, y, c) => (c !== '.' && y > brineY + (Math.abs(x + 0.5 - cx) > 10 ? -2 : 0) ? '.' : null));
  p.paste(pk, 0, 0);
  // The rim's front lip over the pickle.
  p.map((x, y, c) => {
    const dx = (x + 0.5 - cx) / (14 + ps.sq);
    const dy = (y + 0.5 - rimY) / 3.4;
    const out = dx * dx + dy * dy <= 1;
    const dxi = (x + 0.5 - cx) / (12 + ps.sq);
    const dyi = (y + 0.5 - rimY - 0.3) / 2.3;
    const inner = dxi * dxi + dyi * dyi <= 1;
    if (out && !inner && y >= rimY) return x < cx - 6 ? 'C' : 'c';
    if (out && !inner && y < rimY) return 'v';
    return null;
  });
  // Brine lapping at her chin.
  p.set(px - 6, brineY, 'G').set(px + 5, brineY, 'G').set(px - 2, brineY + 1, 'G');

  if (f) {
    // Cracks running down from the rim, brine seeping through; a chunk out of the rim; bubbles.
    const crack = (pts: number[]): void => {
      for (let i = 0; i + 3 < pts.length; i += 2) p.line(pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, 'x');
      for (let i = 2; i < pts.length; i += 4) p.set(pts[i]! + 1, pts[i + 1]!, 's');
    };
    crack([cx - 6, rimY + 3, cx - 8, rimY + 8, cx - 5, rimY + 12, cx - 7, rimY + 18]);
    crack([cx + 7, rimY + 3, cx + 9, rimY + 9, cx + 6, rimY + 14, cx + 8, rimY + 20, cx + 6, rimY + 24]);
    p.set(cx - 7, rimY + 19, 's').set(cx - 7, rimY + 20, 'G').set(cx + 6, rimY + 25, 's').set(cx + 6, rimY + 26, 'G');
    for (let x = cx + 9; x <= cx + 13; x++) for (let y = rimY - 3; y <= rimY + 1; y++) if (x - cx - 9 + (rimY + 1 - y) < 5) p.set(x, y, '.');
    p.set(cx + 9, rimY + 1, 'x').set(cx + 10, rimY + 2, 'x');
    const bub = (bx: number, by: number): void => {
      p.set(bx, by, 's').set(bx + 1, by, 's').set(bx, by - 1, 'G');
    };
    bub(cx - 10, rimY - 3 - (ps.sway & 1));
    bub(cx + 7, rimY - 4 + (ps.sway & 1));
    bub(cx - 12, rimY - 7);
    p.set(cx + 11, rimY - 8, 's');
  }
  // Wet ring at the base.
  if (f) p.set(cx - 12, bot, 'G').set(cx + 10, bot, 'G').set(cx - 3, bot + 1, 'G');
  return p.outline('o').rows();
}

function brineFrames(ferment: boolean): string[][] {
  const base: CrockPose = { rise: 0, hop: 0, sq: 0, sway: 0, eyes: 0, mouth: 0, ferment };
  return [
    crock({ ...base }),
    crock({ ...base, rise: 1, sq: 0.3 }),
    crock({ ...base, hop: -1, sway: -1 }),
    crock({ ...base, hop: 0, sway: 1, sq: 0.4 }),
    crock({ ...base, rise: 6, sq: 1, hop: 1, eyes: 1 }),
    crock({ ...base, rise: -3, eyes: 2, mouth: 1 }),
    crock({ ...base, rise: -2, hop: -2, eyes: 2 }),
    crock({ ...base, rise: 2, sq: 1.5, hop: 1, eyes: 3, mouth: 1 }),
  ];
}

const BRINE_ANIMS = {
  idle: { frames: [0, 1], fps: 2, loop: true },
  move: { frames: [2, 0, 3, 0], fps: 6, loop: true },
  charge: { frames: [2, 3], fps: 10, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [6], fps: 1, loop: true },
  hurt: { frames: [7], fps: 1, loop: true },
};

export const GRANDMOTHER_BRINE_SPRITE: SpriteDef = {
  id: 'boss.grandmotherBrine',
  anchorY: 38,
  w: 44,
  h: 50,
  palette: BRINE_PAL,
  frames: brineFrames(false),
  anims: BRINE_ANIMS,
};

export const GRANDMOTHER_BRINE_FERMENTING_SPRITE: SpriteDef = {
  id: 'boss.grandmotherBrine.fermenting',
  anchorY: 38,
  w: 44,
  h: 50,
  palette: BRINE_PAL,
  frames: brineFrames(true),
  anims: BRINE_ANIMS,
};

// ── Old Knotroot ─────────────────────────────────────────────────────────────

const ROOT_PAL = {
  o,
  // root flesh
  r: '#d8c08a',
  R: '#f2dcaa',
  n: '#a88a58',
  N: '#76592f',
  // soil and pebbles
  s: '#4a3424',
  S: '#6e4e32',
  z: '#2c1e14',
  q: '#8a8070',
  // leaves
  l: '#5a8a3a',
  L: '#8cbc50',
  m: '#355a22',
  // face
  k: '#1a1010',
  e: '#ffffff',
  t: '#8ac8f0',
  T: '#d8f2ff',
  // Uprooted: wilted leaves, split bark, smouldering eyes
  w: '#9a7a3a',
  W: '#c8a456',
  x: '#4a2e1a',
  E: '#ff7a3a',
  F: '#ffd06a',
};

interface RootPose {
  /** Sink into the mound (positive = lower). */
  sink: number;
  /** Body sway, px. */
  sway: number;
  /** Leaf spread: -1 drooping, 0 normal, 1 flared. */
  leaves: number;
  /** Arms: 0 hanging out, 1 raised (wail), 2 clutching (telegraph). */
  arms: number;
  /** 0 open, 1 squeezed, 2 wide, 3 shut. */
  eyes: number;
  /** Mouth size 0..2. */
  mouth: number;
  /** Walking step for the uprooted legs: 0 / 1 / 2. */
  step: number;
  uprooted: boolean;
}

function knotroot(ps: RootPose): string[] {
  const W = 44;
  const H = 50;
  const p = new Pix(W, H);
  const up = ps.uprooted;
  const cx = 22 + ps.sway;
  const by = (up ? 25 : 28) + ps.sink;

  // Legs (uprooted) or the mound (buried) go first.
  if (up) {
    const leg = (x0: number, x1: number, lift: number): void => {
      p.line(x0, by + 10, x1, 45 - lift, 'n').line(x0 + 1, by + 10, x1 + 1, 45 - lift, 'N').line(x0 - 1, by + 10, x1 - 1, 45 - lift, 'n');
      p.line(x1, 45 - lift, x1 - 3, 47 - lift, 'n').line(x1 + 1, 45 - lift, x1 + 3, 47 - lift, 'N').line(x1, 45 - lift, x1, 48 - lift, 'n');
    };
    leg(cx - 4, cx - 8, ps.step === 1 ? 2 : 0);
    leg(cx + 4, cx + 8, ps.step === 2 ? 2 : 0);
    // Clods falling off her.
    p.set(cx - 12, by + 16, 's').set(cx - 12, by + 15, 'S').set(cx + 13, by + 12, 's').set(cx + 11, by + 19, 'S');
  }

  // The root body: a knobbly tuber with growth rings, tapering into the soil.
  p.ellipse(cx, by, 10.5, 12.5, 'r');
  p.ellipse(cx - 7, by + 4, 3, 3.4, 'r').ellipse(cx + 8, by - 3, 3, 3, 'r');
  p.ellipse(cx, by + 11, 6, 5, 'r');
  if (up) p.line(cx, by + 14, cx + 2, by + 19, 'r').line(cx + 1, by + 14, cx + 3, by + 19, 'n');
  p.map((x, y, c) => {
    if (c !== 'r') return null;
    const dx = x + 0.5 - cx;
    const dy = y + 0.5 - by;
    if (dx + dy * 0.6 < -11) return 'R';
    if (dx > 7 || dx + dy * 0.5 > 9) return 'n';
    // Growth rings.
    if ((y + 2) % 5 === 0 && Math.abs(dx) > 3 && hash2(x, y, 2) > 0.3) return 'n';
    return null;
  });
  // Rootlet hairs.
  const hairs = [
    [cx - 10, by - 2, cx - 13, by - 3],
    [cx - 10, by + 6, cx - 14, by + 8],
    [cx + 10, by + 3, cx + 14, by + 4],
    [cx + 9, by + 8, cx + 12, by + 11],
    [cx - 3, by + 15, cx - 6, by + 17],
  ];
  for (const [x0, y0, x1, y1] of hairs) p.line(x0!, y0!, x1!, y1!, 'n');
  if (up) {
    // Split bark.
    p.line(cx - 5, by - 8, cx - 3, by - 3, 'x').line(cx - 3, by - 3, cx - 6, by + 2, 'x');
    p.line(cx + 6, by + 2, cx + 4, by + 7, 'x').line(cx + 4, by + 7, cx + 6, by + 10, 'x');
    p.set(cx + 2, by + 12, 'x').set(cx + 3, by + 13, 'x');
  }

  // Arms: gnarled roots with twiggy fingers.
  const arm = (s: number): void => {
    const x0 = cx + s * 9;
    const y0 = by + 1;
    let x1: number;
    let y1: number;
    if (ps.arms === 1) {
      x1 = cx + s * 17;
      y1 = by - 11;
    } else if (ps.arms === 2) {
      x1 = cx + s * 12;
      y1 = by + 8;
    } else {
      x1 = cx + s * 16;
      y1 = by - 4;
    }
    const mx = (x0 + x1) / 2 + s * 1;
    const my = (y0 + y1) / 2 + 3;
    p.line(x0, y0, mx, my, 'n').line(x0, y0 + 1, mx, my + 1, 'N').line(mx, my, x1, y1, 'n').line(mx, my + 1, x1, y1 + 1, 'N');
    p.line(x1, y1, x1 + s * 3, y1 - 2, 'n').line(x1, y1, x1 + s, y1 - 3, 'n').line(x1, y1 + 1, x1 + s * 3, y1 + 2, 'N');
  };
  arm(-1);
  arm(1);

  // Face: hollow, weepy eyes and a wailing mouth.
  const ey = by - 3;
  const eye = (ex: number): void => {
    if (ps.eyes === 3) {
      p.line(ex - 2, ey, ex + 2, ey + 1, 'k');
      return;
    }
    const ry = ps.eyes === 1 ? 1.2 : ps.eyes === 2 ? 3.8 : 3.2;
    p.ellipse(ex, ey, 2.5, ry, 'k');
    if (ps.eyes !== 1) {
      if (up) p.set(ex, ey, 'E').set(ex - 1, ey, 'F').set(ex, ey - 1, 'E');
      else p.set(ex - 1, ey - 1, 'e');
    }
    if (!up) p.set(ex, ey + 4, 't').set(ex, ey + 5, 'T').set(ex - 1, ey + 5, 't');
  };
  eye(cx - 4);
  eye(cx + 4);
  // Brows knotted in misery (or fury).
  if (up) p.line(cx - 7, ey - 5, cx - 2, ey - 3, 'N').line(cx + 2, ey - 3, cx + 7, ey - 5, 'N');
  else p.line(cx - 6, ey - 4, cx - 2, ey - 6, 'N').line(cx + 2, ey - 6, cx + 6, ey - 4, 'N');
  const mr = ps.mouth === 2 ? 3.4 : ps.mouth === 1 ? 2.4 : 1.6;
  p.ellipse(cx, by + 5, mr * 0.85, mr, 'k');
  if (ps.mouth === 2) p.set(cx, by + 3, 'N').set(cx - 1, by + 7, 'x');

  // The crown of leaves.
  const leaf = (ang: number, len: number, c1: string, c2: string, c3: string): void => {
    const x0 = cx;
    const y0 = by - 12;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    for (let i = 1; i <= len; i++) {
      const k = i / len;
      const wdt = Math.sin(k * Math.PI) * 2.6 + 0.4;
      p.disc(x0 + dx * i, y0 + dy * i, wdt, c1);
    }
    for (let i = 2; i < len; i++) p.set(x0 + dx * i, y0 + dy * i, c2);
    p.set(x0 + dx * len, y0 + dy * len, c3);
  };
  const spread = ps.leaves;
  if (up || spread < 0) {
    // Wilted: drooping to the sides.
    const c1 = up ? 'w' : 'l';
    const c2 = up ? 'W' : 'L';
    leaf(Math.PI * 0.8, 11, c1, c2, 'm');
    leaf(Math.PI * 0.2, 11, c1, c2, 'm');
    leaf(-Math.PI * 0.62, 8, c1, c2, 'm');
    leaf(-Math.PI * 0.4, 7, 'm', c1, 'm');
  } else {
    const f = spread * 0.12;
    leaf(-Math.PI * (0.78 + f), 12, 'l', 'L', 'm');
    leaf(-Math.PI * (0.22 - f), 12, 'l', 'L', 'm');
    leaf(-Math.PI * 0.5 + ps.sway * 0.08, 13, 'l', 'L', 'm');
    leaf(-Math.PI * (0.64 + f * 0.5), 9, 'm', 'l', 'm');
    leaf(-Math.PI * (0.36 - f * 0.5), 9, 'm', 'l', 'm');
  }

  // The mound of soil she's buried in.
  if (!up) {
    const my = 44;
    p.map((x, y, c) => {
      const dx = (x + 0.5 - 22) / 19;
      const dy = (y + 0.5 - my) / 5.4;
      if (dx * dx + dy * dy > 1) return null;
      if (y < my - 2 && c !== '.' && c !== 's' && hash2(x, y, 3) > 0.5) return null;
      return y < my - 2 ? 'S' : y > my + 2 ? 'z' : hash2(x, y, 5) > 0.85 ? 'q' : 's';
    });
    p.set(8, 43, 'q').set(35, 44, 'q').set(28, 41, 'S').set(14, 41, 'S');
  }
  return p.outline('o').rows();
}

function knotrootFrames(uprooted: boolean): string[][] {
  const base: RootPose = { sink: 0, sway: 0, leaves: 0, arms: 0, eyes: 0, mouth: 0, step: 0, uprooted };
  return [
    knotroot({ ...base }),
    knotroot({ ...base, sway: 1, leaves: 1, mouth: 1 }),
    knotroot({ ...base, sway: -1, step: 1 }),
    knotroot({ ...base, sway: 1, step: 2, mouth: 1 }),
    knotroot({ ...base, sink: 4, arms: 2, eyes: 1, leaves: -1 }),
    knotroot({ ...base, sink: -1, arms: 1, eyes: 2, mouth: 2, leaves: 1 }),
    knotroot({ ...base, sink: -2, arms: 1, eyes: 2, mouth: 2, leaves: 1, step: 1 }),
    knotroot({ ...base, sink: 3, eyes: 3, mouth: 1, leaves: -1 }),
  ];
}

const KNOTROOT_ANIMS = {
  idle: { frames: [0, 1], fps: 2, loop: true },
  move: { frames: [2, 0, 3, 0], fps: 6, loop: true },
  charge: { frames: [2, 3], fps: 11, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [6], fps: 1, loop: true },
  hurt: { frames: [7], fps: 1, loop: true },
};

export const KNOTROOT_SPRITE: SpriteDef = {
  id: 'boss.knotroot',
  anchorY: 38,
  w: 44,
  h: 50,
  palette: ROOT_PAL,
  frames: knotrootFrames(false),
  anims: KNOTROOT_ANIMS,
};

export const KNOTROOT_UPROOTED_SPRITE: SpriteDef = {
  id: 'boss.knotroot.uprooted',
  anchorY: 38,
  w: 44,
  h: 50,
  palette: ROOT_PAL,
  frames: knotrootFrames(true),
  anims: KNOTROOT_ANIMS,
};
