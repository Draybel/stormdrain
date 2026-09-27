/**
 * The Candlewick Crypt bosses (boss pack A), painted with ./paint.ts: 1 px dark outline, lit from the
 * top-left, side views face RIGHT. Each has a second sprite (same size and anchor) for its later
 * phases, swapped in by content/hooks/bosses-a.ts.
 *
 *   Vesperwing   56×42  a great dusty moth whose wing eyespots look like candle flames. Singed: holes
 *                       burnt through the wings, charred edges, little flames licking the tips.
 *   Wickwarden   42×54  a hunched warden made of fused church candles on a brass tray, a tall flame
 *                       for a head. Melting: slumped and dripping, the tray overflowing, flames gone
 *                       blue-hot, one shoulder candle bent over.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';

const o = OUTLINE;

// ── Vesperwing ───────────────────────────────────────────────────────────────

const MOTH_PAL = {
  o,
  // wings: dusty lilac
  v: '#a898b8',
  V: '#cbbde0',
  u: '#7a6a8e',
  U: '#54466a',
  // eyespots: a candle flame on each wing
  c: '#f2e2b4',
  g: '#e8a040',
  G: '#ffd46a',
  // fuzzy body
  b: '#e8dcc4',
  B: '#b8a888',
  W: '#fff8ea',
  k: '#16121e',
  K: '#5a4a80',
  e: '#ffffff',
  // Singed: embers, char, flames
  x: '#2e2224',
  X: '#5a3a30',
  f: '#ff7a2a',
  F: '#ffd06a',
};

interface MothPose {
  /** 0 wings raised, 1 level, 2 lowered. */
  flap: number;
  /** Body bob (px). */
  bob: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Antennae: 0 up, 1 swept back (telegraph), 2 flared (roar). */
  ant: number;
  /** Flame flicker (singed tips). */
  flick: number;
  singed: boolean;
}

function moth(ps: MothPose): string[] {
  const W = 56;
  const H = 42;
  const p = new Pix(W, H);
  const cx = 28;
  const s = ps.singed;
  const fy = ps.flap === 0 ? -4 : ps.flap === 2 ? 3 : 0;
  const fr = ps.flap === 0 ? 7.2 : ps.flap === 2 ? 7 : 8.2;
  const b = ps.bob;

  // Wings: each side a big rounded forewing over a smaller hindwing, rim banded dark.
  const wing = (side: number): void => {
    const hx = cx + side * 10;
    const hy = 26 + b + fy * 0.4;
    const fx = cx + side * 14;
    const fyC = 13 + b + fy;
    const inHind = (x: number, y: number): number => {
      const dx = (x + 0.5 - hx) / 10;
      const dy = (y + 0.5 - hy) / 6.4;
      return dx * dx + dy * dy;
    };
    const inFore = (x: number, y: number): number => {
      // Tilted up toward the tip.
      const lx = (x + 0.5 - fx) * side;
      const ly = y + 0.5 - fyC + lx * (ps.flap === 0 ? 0.35 : ps.flap === 2 ? -0.1 : 0.15);
      const dx = lx / 14;
      const dy = ly / fr;
      return dx * dx + dy * dy;
    };
    p.map((x, y, c) => {
      if ((x - cx) * side < 2) return null;
      const h = inHind(x, y);
      const f = inFore(x, y);
      if (f <= 1) return f > 0.72 ? 'U' : f > 0.55 && hash2(x, y, 1) > 0.5 ? 'u' : 'v';
      if (h <= 1) return h > 0.7 ? 'U' : 'u';
      return c === '.' ? null : null;
    });
    // Light on the top-left of each wing, veins.
    p.map((x, y, c) => (c === 'v' && inFore(x, y) < 0.55 && y < fyC - 2 ? 'V' : null));
    for (let i = 3; i < 22; i += 2) {
      const vx = cx + side * i;
      const vy = Math.round(fyC + 1 - (i - 3) * (ps.flap === 0 ? 0.35 : ps.flap === 2 ? -0.1 : 0.15) + (i % 4 === 1 ? 1 : 0));
      if (p.get(vx, vy) === 'v' || p.get(vx, vy) === 'V') p.set(vx, vy, 'u');
    }
    // The eyespot: a candle flame on each forewing.
    const ex = cx + side * 15;
    const ey = Math.round(fyC - side * 0 - 1 - (ps.flap === 0 ? 3 : ps.flap === 2 ? -1 : 1) * 0.6);
    p.ellipse(ex, ey, 3.6, 3.4, 'c').ellipse(ex, ey + 0.5, 2.2, 2.4, 'g').ellipse(ex, ey + 0.8, 1, 1.4, 'G');
    p.set(ex, ey - 3, 'g').set(ex, ey - 2, 'G');
    // A small spot on the hindwing.
    p.disc(hx + side * 3, hy + 1, 1.4, 'c').set(hx + side * 3, hy + 1, 'u');
  };
  wing(-1);
  wing(1);

  if (s) {
    // Burnt-through holes with glowing edges, charred rims, flames on the tips.
    const holes = [
      [cx - 20, 15 + b + fy, 2.2],
      [cx - 8, 25 + b, 1.8],
      [cx + 21, 18 + b + fy, 2.6],
      [cx + 11, 9 + b + fy, 1.6],
      [cx + 12, 28 + b, 1.6],
    ];
    for (const [hx, hy, r] of holes) {
      p.map((x, y, c) => {
        if (c === '.') return null;
        const d = Math.hypot(x + 0.5 - hx!, y + 0.5 - hy!);
        if (d <= r!) return '.';
        if (d <= r! + 1.2) return hash2(x, y, 7) > 0.4 ? 'f' : 'X';
        return null;
      });
    }
    p.map((x, y, c) => (c === 'U' ? (hash2(x, y, 3) > 0.35 ? 'x' : 'X') : null));
    const tip = (tx: number, ty: number): void => {
      const k = ps.flick;
      p.set(tx, ty, 'f').set(tx, ty - 1, 'F').set(tx + (k ? 1 : -1), ty - 2, 'f').set(tx - 1, ty, 'f').set(tx + 1, ty - 1, 'f');
    };
    for (const side of [-1, 1]) {
      // The outermost pixel of each forewing tip.
      let best = -1;
      let by = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (p.get(x, y) === '.' || (x - cx) * side < 16) continue;
          const d = (x - cx) * side - y * 0.8;
          if (d > best) {
            best = d;
            by = y;
          }
        }
      }
      const tx = side > 0 ? Math.min(W - 2, cx + Math.round(best + by * 0.8)) : Math.max(1, cx - Math.round(best + by * 0.8));
      tip(tx - side, by);
    }
  }

  // Body: abdomen, fuzzy thorax, head.
  p.ellipse(cx, 29 + b, 3.8, 7, 'b');
  for (let y = 25 + b; y <= 35 + b; y += 3) for (let x = cx - 3; x <= cx + 3; x++) if (p.get(x, y) === 'b') p.set(x, y, 'B');
  p.ellipse(cx, 19 + b, 5, 5.6, 'b');
  p.map((x, y, c) => (c === 'b' && x > cx + 2 ? 'B' : c === 'b' && x < cx - 2 && y < 20 + b ? 'W' : null));
  // Fuzzy ruff.
  for (let i = -5; i <= 5; i += 2) p.set(cx + i, 14 + b + (Math.abs(i) > 3 ? 1 : 0), 'W');
  p.set(cx - 6, 17 + b, 'b').set(cx + 6, 17 + b, 'B');
  // Legs.
  p.line(cx - 3, 23 + b, cx - 6, 27 + b, 'k').line(cx + 3, 23 + b, cx + 6, 27 + b, 'k').line(cx - 2, 25 + b, cx - 4, 30 + b, 'k').line(cx + 2, 25 + b, cx + 4, 30 + b, 'k');
  // Head with big dark eyes.
  const hy = 10 + b;
  // Feathery antennae (behind the head).
  const ant = (side: number): void => {
    const x0 = cx + side * 2;
    const y0 = hy - 4;
    const ang = ps.ant === 1 ? 0.3 : ps.ant === 2 ? 1.0 : 0.7;
    const x1 = x0 + side * Math.round(9 * Math.sin(ang));
    const y1 = Math.max(0, y0 - Math.round(8 * Math.cos(ang)));
    p.line(x0, y0, x1, y1, 'B');
    for (let i = 3; i <= 8; i += 2) {
      const t = i / 9;
      const ax = Math.round(x0 + (x1 - x0) * t);
      const ay = Math.round(y0 + (y1 - y0) * t);
      p.set(ax + side, ay + 1, 'b');
    }
  };
  ant(-1);
  ant(1);
  p.disc(cx, hy, 5.2, 'b');
  p.map((x, y, c) => (c === 'b' && y < hy + 6 && x > cx + 2 && Math.hypot(x + 0.5 - cx, y + 0.5 - hy) > 3.6 ? 'B' : null));
  p.set(cx - 3, hy - 3, 'W').set(cx - 2, hy - 4, 'W').set(cx - 4, hy - 2, 'W');
  const eye = (ex: number): void => {
    if (ps.eyes === 3) {
      p.line(ex - 1, hy, ex + 1, hy + 1, 'k');
      return;
    }
    const ry = ps.eyes === 1 ? 1.2 : ps.eyes === 2 ? 3.3 : 2.8;
    p.ellipse(ex, hy + 0.5, 1.9, ry, 'k');
    if (ps.eyes !== 1) p.set(ex - 1, hy - 1, s ? 'F' : 'e').set(ex, hy - 1, s ? 'f' : 'e').set(ex, hy + 2, 'K');
  };
  eye(cx - 3);
  eye(cx + 4);
  p.set(cx, hy + 3, 'B').set(cx + 1, hy + 3, 'B');
  if (s) {
    // Singed fuzz.
    p.set(cx + 3, 17 + b, 'x').set(cx - 4, 21 + b, 'X').set(cx + 1, 31 + b, 'x').set(cx + 4, 12 + b, 'X');
  }
  return p.outline('o').rows();
}

function vesperFrames(singed: boolean): string[][] {
  const base: MothPose = { flap: 1, bob: 0, eyes: 0, ant: 0, flick: 0, singed };
  return [
    moth({ ...base, flap: 0 }),
    moth({ ...base, flap: 1, bob: 1, flick: 1 }),
    moth({ ...base, flap: 2, bob: 1 }),
    moth({ ...base, flap: 1, flick: 1 }),
    moth({ ...base, flap: 0, eyes: 1, ant: 1, bob: 1 }),
    moth({ ...base, flap: 2, eyes: 2, ant: 2, flick: 1 }),
    moth({ ...base, flap: 1, eyes: 3, ant: 1, bob: 2 }),
  ];
}

const VESPER_ANIMS = {
  idle: { frames: [0, 1, 2, 3], fps: 8, loop: true },
  move: { frames: [0, 1, 2, 3], fps: 11, loop: true },
  charge: { frames: [0, 2], fps: 16, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [0, 2], fps: 14, loop: true },
  hurt: { frames: [6], fps: 1, loop: true },
};

export const VESPERWING_SPRITE: SpriteDef = {
  id: 'boss.vesperwing',
  anchorY: 28,
  w: 56,
  h: 42,
  palette: MOTH_PAL,
  frames: vesperFrames(false),
  anims: VESPER_ANIMS,
};

export const VESPERWING_SINGED_SPRITE: SpriteDef = {
  id: 'boss.vesperwing.singed',
  anchorY: 28,
  w: 56,
  h: 42,
  palette: MOTH_PAL,
  frames: vesperFrames(true),
  anims: VESPER_ANIMS,
};

// ── Wickwarden ───────────────────────────────────────────────────────────────

const WAX_PAL = {
  o,
  // tallow
  c: '#f0e6cc',
  C: '#fffaee',
  v: '#d2c19a',
  V: '#a8966e',
  // brass tray
  g: '#c8a04a',
  G: '#f2d484',
  r: '#86652a',
  // face holes and their glow
  k: '#2a1a14',
  y: '#ffb040',
  Y: '#fff4c0',
  // flames
  f: '#ff8a2a',
  F: '#ffd04a',
  // Melting: blue-hot flames
  b: '#3a7aff',
  B: '#8ac4ff',
  Z: '#eaf6ff',
};

interface WaxPose {
  /** Flame flicker 0..2. */
  flick: number;
  /** Body slump (px lower top) and squash. */
  slump: number;
  /** Flame height multiplier. */
  flare: number;
  /** 0 steady, 1 narrowed, 2 wide, 3 guttered. */
  eyes: number;
  /** 0 grim, 1 roaring. */
  mouth: number;
  /** Shoulder candles: 0 at rest, 1 raised (telegraph / roar). */
  arms: number;
  melting: boolean;
}

function warden(ps: WaxPose): string[] {
  const W = 42;
  const H = 54;
  const p = new Pix(W, H);
  const m = ps.melting;
  const cx = 21;
  const hot = m ? { f: 'b', F: 'B', Y: 'Z', y: 'B' } : { f: 'f', F: 'F', Y: 'Y', y: 'y' };

  // The brass tray.
  p.ellipse(cx, 49, 17, 4, 'g');
  p.ellipse(cx, 48.4, 14.6, 2.6, 'r');
  p.ellipse(cx - 1, 48, 13, 1.6, 'G');
  p.ellipse(37, 47, 3, 2.4, 'g').ellipse(37, 47, 1.4, 1, '.');
  p.set(5, 48, 'G').set(6, 47, 'G');

  // Main pillar candle, melted into a hunch.
  const top = (m ? 28 : 22) + ps.slump;
  const bodyL = 11 - (m ? 1 : 0);
  const bodyR = 31 + (m ? 1 : 0);
  for (let x = bodyL; x <= bodyR; x++) {
    const lump = Math.round(hash2(x, 1, m ? 6 : 2) * 2.2 + Math.abs(x - cx) * 0.18);
    for (let y = top + lump; y <= 47; y++) p.set(x, y, 'c');
  }
  // Wax pooled on the tray (overflowing when melting).
  p.ellipse(cx, 46.5, m ? 15 : 12, m ? 2.6 : 1.8, 'c');
  if (m) {
    p.ellipse(8, 49.5, 3.4, 1.8, 'c').ellipse(33, 50, 3, 1.6, 'c');
    p.rect(5, 50, 2, 2, 'c').set(5, 52, 'v').rect(35, 50, 2, 3, 'c').set(36, 53, 'v');
  }
  // Drips down the front.
  const drips = m ? [13, 16, 19, 24, 27, 30] : [14, 19, 25, 29];
  for (const dx of drips) {
    const len = 4 + Math.round(hash2(dx, 3, 9) * (m ? 12 : 8));
    const y0 = top + 2;
    p.rect(dx, y0, 1, len, 'C').set(dx, y0 + len, 'C').set(dx + 1, y0 + len, 'v');
  }
  // Shading: lit left, shaded right.
  p.map((x, y, c) => (c === 'c' ? (x <= bodyL + 1 ? 'C' : x >= bodyR - 1 ? 'V' : x >= bodyR - 4 ? 'v' : null) : null));

  // Shoulder candles, fused on with blobs of wax.
  const shoulder = (x: number, y0: number, h: number, bend: number): void => {
    for (let i = 0; i < h; i++) {
      const bx = x + Math.round(bend * (1 - i / h) * (1 - i / h) * 4);
      p.rect(bx, y0 + i, 5, 1, i === 0 ? 'C' : 'c').set(bx + 4, y0 + i, 'v').set(bx, y0 + i, 'C');
    }
    const tx = x + Math.round(bend * 4) + 2;
    const ty = y0 - 1;
    p.set(tx, ty, 'k');
    // Little flame.
    const fl = ps.flick;
    p.set(tx, ty - 1, hot.f).set(tx, ty - 2, hot.F).set(tx, ty - 3, hot.F).set(tx + (fl === 1 ? 1 : fl === 2 ? -1 : 0), ty - 4, hot.f);
    p.set(tx - 1, ty - 2, hot.f).set(tx + 1, ty - 2, hot.f).set(tx, ty - 1, hot.Y);
  };
  const ay = ps.arms === 1 ? -4 : 0;
  shoulder(4, 27 + ay + ps.slump, 15 - ay, 0);
  if (m) shoulder(33, 30 + ps.slump, 12, 1.2);
  else shoulder(33, 25 + ay + ps.slump, 17 - ay, 0);
  p.ellipse(10, 34 + ps.slump, 2.4, 3, 'c').ellipse(32, 33 + ps.slump, 2.4, 3, 'v');

  // Carved face with a glow inside.
  const fyE = top + 9;
  const eye = (ex: number): void => {
    if (ps.eyes === 3) {
      p.line(ex - 2, fyE + 1, ex + 1, fyE + 1, 'k');
      return;
    }
    const h = ps.eyes === 1 ? 2 : ps.eyes === 2 ? 5 : 4;
    p.ellipse(ex + 0.5, fyE + 4 - h / 2, 2, h / 2 + 0.3, 'k');
    if (ps.eyes !== 1) p.set(ex, fyE + 3, hot.y).set(ex, fyE + 2, hot.Y).set(ex + 1, fyE + 3, hot.y);
    else p.set(ex, fyE + 3, hot.y);
  };
  eye(cx - 5);
  eye(cx + 5);
  // Heavy brow ridge of wax.
  p.line(cx - 8, fyE - 1, cx - 3, fyE + 1, 'v').line(cx + 3, fyE + 1, cx + 8, fyE - 1, 'v');
  const my = fyE + 8;
  if (ps.mouth === 1) {
    p.rect(cx - 4, my - 1, 9, 4, 'k');
    p.rect(cx - 2, my + 1, 5, 1, hot.y).set(cx, my + 2, hot.Y);
    p.set(cx - 3, my - 1, 'c').set(cx + 1, my - 1, 'c').set(cx - 1, my + 2, 'c').set(cx + 3, my + 2, 'c');
  } else {
    p.rect(cx - 4, my, 9, 2, 'k').set(cx - 2, my, 'c').set(cx + 2, my, 'c').set(cx, my + 1, hot.y);
  }

  // The great wick and its flame (the head).
  const wy = top + Math.round(hash2(cx, 1, m ? 6 : 2) * 2.2) - 1;
  p.rect(cx, wy - 1, 1, 2, 'k');
  const fh = Math.round((m ? 14 : 16) * ps.flare);
  const sway = ps.flick === 1 ? 1 : ps.flick === 2 ? -1 : 0;
  for (let i = 0; i < fh; i++) {
    const t = i / fh;
    const wdt = Math.sin(Math.min(1, (1 - t) * 1.35) * Math.PI * 0.62) * (m ? 4.2 : 4.6);
    const fxc = cx + 0.5 + sway * t * t * 2;
    const y = wy - 2 - i;
    for (let x = Math.floor(fxc - wdt); x <= Math.ceil(fxc - 1 + wdt); x++) {
      const d = Math.abs(x + 0.5 - fxc) / Math.max(0.5, wdt);
      p.set(x, y, d > 0.66 ? hot.f : d > 0.3 || t > 0.62 ? hot.F : hot.Y);
    }
  }
  // Sparks.
  p.set(cx - 5 + sway, wy - fh + 2, hot.F).set(cx + 6, wy - fh + 5 + ps.flick, hot.f);
  return p.outline('o').rows();
}

function wardenFrames(melting: boolean): string[][] {
  const base: WaxPose = { flick: 0, slump: 0, flare: 1, eyes: 0, mouth: 0, arms: 0, melting };
  return [
    warden({ ...base }),
    warden({ ...base, flick: 1, flare: 1.08 }),
    warden({ ...base, flick: 2, slump: 1, flare: 0.94 }),
    warden({ ...base, flick: 1, slump: 1 }),
    warden({ ...base, flick: 2, slump: 2, eyes: 1, arms: 1, flare: 0.8 }),
    warden({ ...base, flick: 1, eyes: 2, mouth: 1, arms: 1, flare: 1.22 }),
    warden({ ...base, flick: 0, slump: 3, eyes: 3, mouth: 1, flare: 0.5 }),
  ];
}

const WARDEN_ANIMS = {
  idle: { frames: [0, 1], fps: 4, loop: true },
  move: { frames: [2, 1, 3, 0], fps: 6, loop: true },
  charge: { frames: [2, 3], fps: 10, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [5], fps: 1, loop: true },
  hurt: { frames: [6], fps: 1, loop: true },
};

export const WICKWARDEN_SPRITE: SpriteDef = {
  id: 'boss.wickwarden',
  anchorY: 42,
  w: 42,
  h: 54,
  palette: WAX_PAL,
  frames: wardenFrames(false),
  anims: WARDEN_ANIMS,
};

export const WICKWARDEN_MELTING_SPRITE: SpriteDef = {
  id: 'boss.wickwarden.melting',
  anchorY: 42,
  w: 42,
  h: 54,
  palette: WAX_PAL,
  frames: wardenFrames(true),
  anims: WARDEN_ANIMS,
};
