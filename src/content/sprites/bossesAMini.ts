/**
 * Boss pack A minibosses (chapters 1-2, both tracks), painted with ./paint.ts: 1 px dark outline, lit
 * from the top-left, side views face RIGHT. Each has a second sprite (same size and anchor) for its
 * later phase, swapped in by content/hooks/bosses-a.ts.
 *
 *   Bumbershoot   34×32  a lost umbrella gone batty: big round eyes and a fanged grin on the canopy,
 *                        a crook handle for a tail. Inside Out: the canopy blown into a torn cup, the
 *                        spokes sticking up.
 *   Puddlestomp   32×30  a pair of lost red galoshes with something peeking out of each. Odd Boots:
 *                        they split up — each part is ONE scuffed, patched boot.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix } from './paint';

const o = OUTLINE;

// ── Bumbershoot ──────────────────────────────────────────────────────────────

const BROLLY_PAL = {
  o,
  // canopy fabric: dark plum panels
  u: '#4a2a5a',
  U: '#6a3a7c',
  L: '#8e5aa2',
  x: '#2a1636',
  // the inside lining (Inside Out)
  l: '#b27ac2',
  m: '#d4a4de',
  // metal spokes, ferrule, shaft
  z: '#c8ccd8',
  Z: '#7a7e90',
  // crook handle
  h: '#a86a3a',
  H: '#d8964e',
  // face
  e: '#fff4c0',
  E: '#ffffff',
  k: '#140c1a',
  // rain
  w: '#8cc8ea',
};

interface BrollyPose {
  /** 0 wide open, 1 half closed (the flap), 2 snapped shut (telegraph). */
  open: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 grin, 1 wide open (shriek). */
  mouth: number;
  /** Handle swing -1..1. */
  swing: number;
  /** Bob (px). */
  bob: number;
  inside: boolean;
}

function brolly(ps: BrollyPose): string[] {
  const W = 34;
  const H = 32;
  const p = new Pix(W, H);
  const cx = 17;
  const b = ps.bob;
  const rx = ps.open === 0 ? 15.5 : ps.open === 1 ? 12.5 : 8.5;
  const ry = ps.open === 0 ? 12 : ps.open === 1 ? 14 : 16;
  const ins = ps.inside;

  if (!ins) {
    // The dome, its scalloped hem hanging between the spoke tips.
    const edge = 18 + b;
    const spokes = 6;
    p.map((x, y) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - edge) / ry;
      if (dx * dx + dy * dy > 1 || y > edge) return null;
      // Scallops: the hem curls up between spokes.
      const t = ((x + 0.5 - (cx - rx)) / (2 * rx)) * spokes;
      const frac = t - Math.floor(t);
      if (y > edge - 2.4 * Math.sin(Math.PI * frac) - 0.2) return null;
      // Panels by the angle from the tip.
      const a = Math.atan2(y + 0.5 - (edge - ry), x + 0.5 - cx);
      const k = Math.floor((a / Math.PI) * spokes + 100);
      return k % 2 === 0 ? 'u' : 'U';
    });
    p.map((x, y, c) => (c !== '.' && (x + 0.5 - cx) / rx + (y + 0.5 - (edge - ry)) / ry < -0.1 && (x + 0.5 - cx) < 0 && y < edge - ry * 0.45 ? 'L' : null));
    // Seams and spoke tips.
    const tipY = edge - ry;
    for (let i = 0; i <= spokes; i++) {
      const sx = cx - rx + (i / spokes) * 2 * rx;
      p.line(cx, tipY + 1, sx, edge - 1, 'x');
      p.set(sx, edge, 'z').set(sx, edge + 1, 'Z');
    }
    // The ferrule on top.
    p.rect(cx, tipY - 3, 1, 4, 'z').set(cx, tipY - 4, 'Z');
    // Face on the canopy: big round eyes and a fanged grin.
    const ey = edge - ry * 0.45;
    const eye = (ex: number): void => {
      if (ps.eyes === 3) {
        p.line(ex - 2, ey, ex + 2, ey, 'k');
        return;
      }
      const r = ps.eyes === 1 ? 1.4 : ps.eyes === 2 ? 3.4 : 3;
      p.ellipse(ex, ey, 3, r, 'e');
      if (ps.eyes !== 1) p.rect(ex, ey - 1, 2, 2, 'k').set(ex - 1, ey - 2, 'E');
      else p.rect(ex - 1, ey, 3, 1, 'k');
    };
    eye(cx - 5);
    eye(cx + 5);
    const my = Math.round(ey + 5);
    if (ps.mouth === 1) {
      p.ellipse(cx, my + 0.5, 4, 2, 'k').set(cx - 2, my, 'E').set(cx + 2, my, 'E');
    } else {
      p.line(cx - 5, my - 1, cx - 2, my, 'k').line(cx - 2, my, cx + 2, my, 'k').line(cx + 2, my, cx + 5, my - 1, 'k');
      p.set(cx - 2, my + 1, 'E').set(cx + 2, my + 1, 'E');
    }
    // Shaft and crook handle (the tail).
    const sb = edge + 1;
    const hx = cx + ps.swing;
    p.line(cx, sb, hx, sb + 7, 'Z');
    p.line(hx, sb + 7, hx, sb + 9, 'h').line(hx, sb + 10, hx + 1, sb + 11, 'h').line(hx + 2, sb + 11, hx + 3, sb + 10, 'h').line(hx + 4, sb + 9, hx + 4, sb + 8, 'H');
    p.set(hx - 1, sb + 9, 'H');
  } else {
    // Inside out: a torn cup of lining with the bare spokes sticking up.
    const top = 6 + b;
    const bowlRy = 12;
    const spokes = 6;
    for (let i = 0; i <= spokes; i++) {
      const sx = cx - rx + (i / spokes) * 2 * rx;
      const tx = cx + (sx - cx) * 1.25;
      p.line(cx, top + bowlRy - 1, tx, top - 5 + Math.abs(i - 3), 'Z');
      p.set(tx, top - 6 + Math.abs(i - 3), 'z');
    }
    p.map((x, y, c) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - top) / bowlRy;
      if (dx * dx + dy * dy > 1 || y < top) return null;
      if (y < top + 3 && ((x * 7) % 5 === 0 || (x * 3) % 7 === 0)) return null;
      const a = Math.atan2(y + 0.5 - (top + bowlRy), x + 0.5 - cx);
      const k = Math.floor((a / Math.PI) * spokes + 100);
      if (y < top + 3) return k % 2 === 0 ? 'm' : 'l';
      return k % 2 === 0 ? 'l' : 'U';
    });
    // Torn flaps hanging off two spokes.
    p.line(cx - rx - 1, top - 1, cx - rx - 3, top + 5, 'u').line(cx - rx, top, cx - rx - 2, top + 6, 'U');
    p.line(cx + rx + 1, top + 1, cx + rx + 2, top + 6, 'u').set(cx + rx + 3, top + 7, 'u');
    // Face on the lining.
    const ey = top + 5;
    const eye = (ex: number): void => {
      if (ps.eyes === 3) {
        p.line(ex - 2, ey, ex + 2, ey, 'k');
        return;
      }
      const r = ps.eyes === 1 ? 1.4 : ps.eyes === 2 ? 3.4 : 3;
      p.ellipse(ex, ey, 3, r, 'e');
      if (ps.eyes !== 1) p.rect(ex - 1, ey, 2, 2, 'k').set(ex - 1, ey - 2, 'E');
      else p.rect(ex - 1, ey, 3, 1, 'k');
    };
    eye(cx - 5);
    eye(cx + 5);
    const my = ey + 5;
    p.ellipse(cx, my + 0.5, ps.mouth === 1 ? 4 : 3, ps.mouth === 1 ? 2.2 : 1.2, 'k').set(cx - 2, my, 'E').set(cx + 2, my, 'E').set(cx, my + 1, 'E');
    // Shaft and handle below the cup.
    const sb = top + bowlRy;
    const hx = cx + ps.swing;
    p.line(cx, sb, hx, sb + 7, 'Z');
    p.line(hx, sb + 7, hx, sb + 9, 'h').line(hx, sb + 10, hx + 1, sb + 11, 'h').line(hx + 2, sb + 11, hx + 3, sb + 10, 'h').line(hx + 4, sb + 9, hx + 4, sb + 8, 'H');
    // Rain caught in the cup, spilling.
    p.set(cx - 3, top + 1, 'w').set(cx + 4, top + 2, 'w').set(cx + rx - 1, top + 9, 'w');
  }
  return p.outline('o').rows();
}

function brollyFrames(inside: boolean): string[][] {
  const base: BrollyPose = { open: 0, eyes: 0, mouth: 0, swing: 0, bob: 0, inside };
  return [
    brolly({ ...base }),
    brolly({ ...base, open: 1, bob: 1, swing: 1 }),
    brolly({ ...base, open: 0, bob: 1, swing: -1 }),
    brolly({ ...base, open: 2, eyes: 1, bob: -1 }),
    brolly({ ...base, open: 0, eyes: 2, mouth: 1, swing: 1 }),
    brolly({ ...base, open: 1, eyes: 3, mouth: 1, bob: 2, swing: -1 }),
  ];
}

const BROLLY_ANIMS = {
  idle: { frames: [0, 1], fps: 4, loop: true },
  move: { frames: [0, 1, 2, 1], fps: 8, loop: true },
  charge: { frames: [3], fps: 1, loop: true },
  windup: { frames: [3], fps: 1, loop: true },
  slam: { frames: [4], fps: 1, loop: true },
  roar: { frames: [4], fps: 1, loop: true },
  air: { frames: [0, 1], fps: 12, loop: true },
  hurt: { frames: [5], fps: 1, loop: true },
};

export const BUMBERSHOOT_SPRITE: SpriteDef = {
  id: 'boss.bumbershoot',
  anchorY: 20,
  w: 34,
  h: 32,
  palette: BROLLY_PAL,
  frames: brollyFrames(false),
  anims: BROLLY_ANIMS,
};

export const BUMBERSHOOT_INSIDE_OUT_SPRITE: SpriteDef = {
  id: 'boss.bumbershoot.insideOut',
  anchorY: 20,
  w: 34,
  h: 32,
  palette: BROLLY_PAL,
  frames: brollyFrames(true),
  anims: BROLLY_ANIMS,
};

// ── Puddlestomp ──────────────────────────────────────────────────────────────

const BOOT_PAL = {
  o,
  // red rubber
  r: '#d8403a',
  R: '#f47e60',
  d: '#9a2a2a',
  D: '#6a1a1e',
  s: '#3a2a2a',
  S: '#5a4644',
  // the dark inside, the eyes peeking out
  k: '#120a10',
  y: '#ffe06a',
  Y: '#fff8c8',
  // water
  w: '#8cc8ea',
  W: '#d8f0ff',
  // Odd Boots: scuffs, mud, tape
  m: '#6a4a2a',
  t: '#b8b8c0',
  T: '#e0e0e8',
};

interface BootPose {
  /** Lift of the back / front boot (px). */
  liftA: number;
  liftB: number;
  /** Squash (shaft shorter, px). */
  sq: number;
  /** 0 peeking, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Water splash: 0 none, 1 from the tops, 2 at the soles. */
  splash: number;
  /** One boot only (the split parts). */
  single: boolean;
}

function boot(p: Pix, bx: number, gy: number, sq: number, eyes: number, scuffed: boolean): void {
  const top = gy - 18 + sq;
  // Shaft.
  p.rect(bx, top, 9, gy - 3 - top, 'r');
  // Foot with a rounded toe pointing right.
  p.ellipse(bx + 8, gy - 3, 8, 3.6, 'r');
  p.rect(bx, gy - 5, 8, 3, 'r');
  // Sole with tread.
  for (let x = bx - 1; x <= bx + 15; x++) {
    if (p.get(x, gy - 1) === 'r' || p.get(x, gy - 2) === 'r') {
      p.set(x, gy - 1, 's');
      if (x % 3 === 0) p.set(x, gy, 'S');
    }
  }
  // Shading: shine on the left, shade on the right.
  p.map((x, y, c) => (c === 'r' && y >= top && y < gy - 1 ? (x === bx || x === bx + 1 ? 'R' : x >= bx + 7 && y < gy - 5 ? 'd' : y >= gy - 3 && x > bx + 12 ? 'd' : null) : null));
  p.line(bx + 2, top + 3, bx + 2, top + 8, 'R');
  // The opening, something peeking out of it.
  p.ellipse(bx + 4.5, top, 5, 1.8, 'd').ellipse(bx + 4.5, top, 3.8, 1.1, 'k');
  if (eyes === 3) p.line(bx + 3, top, bx + 6, top, 'd');
  else if (eyes === 1) p.set(bx + 3, top, 'y').set(bx + 6, top, 'y');
  else {
    p.set(bx + 3, top, 'Y').set(bx + 6, top, 'Y');
    if (eyes === 2) p.set(bx + 3, top - 1, 'y').set(bx + 6, top - 1, 'y');
  }
  // Pull tab at the back.
  p.rect(bx - 2, top + 1, 2, 3, 'd').set(bx - 2, top + 2, 'k');
  if (scuffed) {
    // Scuffs, mud, a strip of tape over a split, a hole at the toe.
    p.line(bx + 3, gy - 9, bx + 6, gy - 7, 'D').set(bx + 5, top + 5, 'D').set(bx + 11, gy - 4, 'm').set(bx + 12, gy - 3, 'm').set(bx + 4, gy - 3, 'm');
    p.rect(bx + 1, top + 7, 7, 2, 't').rect(bx + 1, top + 7, 7, 1, 'T');
    p.ellipse(bx + 13, gy - 4, 1.6, 1.2, 'k').set(bx + 13, gy - 4, 'y');
    p.set(bx - 2, top + 3, '.').set(bx - 1, top + 3, 'd');
  }
}

/** The back boot sits in shadow: every red one step darker. */
const SHADOWED: Readonly<Record<string, string>> = { R: 'r', r: 'd', d: 'D' };

function galoshes(ps: BootPose): string[] {
  const W = 32;
  const H = 30;
  const p = new Pix(W, H);
  if (ps.single) {
    const b = new Pix(W, H);
    boot(b, 8, 28 - ps.liftB, ps.sq, ps.eyes, true);
    p.paste(b.outline('o'), 0, 0);
  } else {
    // The back boot higher (further away) and in shadow; each boot keeps its own outline so the
    // pair never melts into one red lump.
    const a = new Pix(W, H);
    boot(a, 15, 25 - ps.liftA, ps.sq, ps.eyes, false);
    a.map((_x, _y, c) => SHADOWED[c] ?? null);
    const b = new Pix(W, H);
    boot(b, 3, 29 - ps.liftB, ps.sq, ps.eyes, false);
    p.paste(a.outline('o'), 0, 0).paste(b.outline('o'), 0, 0);
  }
  const s = new Pix(W, H);
  if (ps.splash === 1) {
    const tx = ps.single ? 12 : 8;
    s.set(tx - 3, 7, 'w').set(tx + 6, 6, 'w').set(tx - 4, 5, 'W').set(tx + 8, 4, 'W').set(tx + 1, 3, 'w');
  } else if (ps.splash === 2) {
    s.set(1, 26, 'w').set(0, 24, 'W').set(30, 25, 'w').set(31, 23, 'W').set(28, 28, 'w').set(2, 28, 'W');
  }
  p.paste(s.outline('o'), 0, 0);
  return p.rows();
}

function puddleFrames(single: boolean): string[][] {
  const base: BootPose = { liftA: 0, liftB: 0, sq: 0, eyes: 0, splash: 0, single };
  return [
    galoshes({ ...base }),
    galoshes({ ...base, sq: 1, eyes: 0 }),
    galoshes({ ...base, liftA: 3 }),
    galoshes({ ...base, liftB: 3, splash: single ? 0 : 1 }),
    galoshes({ ...base, sq: 3, eyes: 1 }),
    galoshes({ ...base, liftA: 1, liftB: 1, sq: -1, eyes: 2, splash: 1 }),
    galoshes({ ...base, liftA: 3, liftB: 3, sq: -1, eyes: 2 }),
    galoshes({ ...base, sq: 2, eyes: 1, splash: 2 }),
    galoshes({ ...base, sq: 2, eyes: 3 }),
  ];
}

const PUDDLE_ANIMS = {
  idle: { frames: [0, 1], fps: 3, loop: true },
  move: { frames: [2, 0, 3, 0], fps: 9, loop: true },
  charge: { frames: [2, 3], fps: 14, loop: true },
  windup: { frames: [4], fps: 1, loop: true },
  roar: { frames: [5], fps: 1, loop: true },
  air: { frames: [6], fps: 1, loop: true },
  slam: { frames: [7], fps: 1, loop: true },
  hurt: { frames: [8], fps: 1, loop: true },
};

export const PUDDLESTOMP_SPRITE: SpriteDef = {
  id: 'boss.puddlestomp',
  anchorY: 23,
  w: 32,
  h: 30,
  palette: BOOT_PAL,
  frames: puddleFrames(false),
  anims: PUDDLE_ANIMS,
};

export const PUDDLESTOMP_ODD_BOOT_SPRITE: SpriteDef = {
  id: 'boss.puddlestomp.oddBoot',
  anchorY: 23,
  w: 32,
  h: 30,
  palette: BOOT_PAL,
  frames: puddleFrames(true),
  anims: PUDDLE_ANIMS,
};
