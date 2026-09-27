/**
 * Boss pack B minibosses (chapters 3-4, both tracks) — original art, painted with ./paint.ts. One
 * sprite per phase look (bossesBKit.ts: frame order, the phase-look swap).
 *
 *   Canshell  32×28  a hermit crab living in a dented tin can lying on its side, a peeling red label,
 *                     eyes on stalks and one oversized claw. Tucked In: it hides inside and rolls, only
 *                     the big claw and two glowing eyes showing from the dark, the can badly dented.
 *   Glowtail  36×30  a plump pale cave grub curled like a question mark, big glossy eyes, its tail
 *                     arched over its back ending in a glowing lantern bulb. Flare: the bulb blazes coral
 *                     red and every segment lights up with glowing spots.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix } from './paint';
import { bossAnims, bossSprite } from './bossesBKit';

const o = OUTLINE;

// ── Canshell ─────────────────────────────────────────────────────────────────

const CAN_PAL: Record<string, string> = {
  o,
  A: '#9aa4ac',
  B: '#d0dade',
  C: '#5e6870',
  v: '#141820',
  L: '#c84a3a',
  l: '#f0e8d8',
  R: '#d8663a',
  S: '#f09a5a',
  r: '#8a3a22',
  k: '#0f0d18',
  e: '#ffffff',
  y: '#ffd35a',
};

const CAN_PAL_ROLL: Record<string, string> = { ...CAN_PAL, A: '#8a8e90', B: '#bcc4c4', C: '#4e5458', R: '#e8583a', S: '#ff9a6a', y: '#ff9a3a' };

interface CanPose {
  /** 0 walking, 1 tucked in and rolling. */
  look: number;
  /** Label rotation (rolling) 0-3. */
  roll: number;
  /** Claw: 0 shut, 1 open, 2 wide open (snap). */
  claw: number;
  /** Legs 0-1. */
  step: number;
  /** 0 open, 1 narrowed, 3 shut. */
  eyes: number;
  /** Body raise (+ up), px. */
  lift: number;
}

function canshell(q: CanPose): string[] {
  const W = 32;
  const H = 28;
  const p = new Pix(W, H);
  const cy = 16 - q.lift;
  const tucked = q.look === 1;

  // Walking legs from under the can's mouth.
  if (!tucked) {
    const d = q.step === 1 ? 1 : 0;
    p.line(20, cy + 5, 17 - d, cy + 9, 'R').line(17 - d, cy + 9, 16 - d, 27, 'r');
    p.line(22, cy + 6, 22 + d, cy + 10, 'R').line(22 + d, cy + 10, 21 + d, 27, 'r');
    p.line(24, cy + 5, 26 - d, cy + 9, 'R').line(26 - d, cy + 9, 27 - d, 27, 'r');
  }

  // The can on its side.
  p.rect(3, cy - 7, 16, 15, 'A');
  p.ellipse(3.5, cy + 0.5, 2.6, 7.5, 'C');
  p.map((x, y, c) => (c === 'A' && y <= cy - 6 ? 'B' : c === 'A' && y >= cy + 5 ? 'C' : null));
  for (const rx of [7, 11, 15]) for (let y = cy - 6; y <= cy + 6; y++) if (p.get(rx, y) === 'A') p.set(rx, y, (y + rx) % 5 === 0 ? 'B' : 'C');
  // A torn paper label, turning with the can when it rolls.
  const band = tucked ? [-6, -3, 0, 3][q.roll % 4]! : -5;
  for (let y = cy + band; y < cy + band + 7; y++) {
    if (y < cy - 7 || y > cy + 7) continue;
    for (let x = 6; x <= 14; x++) p.set(x, y, y === cy + band + 3 ? 'l' : 'L');
  }
  if (!tucked) p.set(6, cy - 8, 'L').set(7, cy - 8, 'L').set(6, cy - 9, 'l');
  // Dents.
  p.set(12, cy + 4, 'C').set(13, cy + 3, 'C').set(5, cy - 3, 'C');
  if (tucked) {
    p.set(9, cy + 5, 'C').set(10, cy + 6, 'C').set(16, cy - 5, 'C').set(17, cy - 4, 'v');
    p.ellipse(8, cy - 1, 1.4, 1.1, 'v');
  }
  // The open end.
  p.ellipse(19, cy + 0.5, 3, 7.6, 'B');
  p.ellipse(19.5, cy + 0.5, 2, 6.4, 'v');

  // The crab.
  if (!tucked) {
    p.ellipse(21.5, cy + 1, 3.6, 4.4, 'R');
    p.set(20, cy - 2, 'S').set(21, cy - 3, 'S');
    // Eye stalks.
    const ey = q.eyes === 1 ? cy - 7 : cy - 9;
    p.line(21, cy - 2, 20, ey + 1, 'r').line(23, cy - 2, 24, ey + 2, 'r');
    for (const [ex, dy] of [
      [20, 0],
      [24, 1],
    ] as const) {
      if (q.eyes === 3) p.line(ex - 1, ey + dy, ex + 1, ey + dy, 'k');
      else {
        p.disc(ex, ey + dy, 1.4, 'k');
        p.set(ex, ey + dy - 1, 'e');
      }
    }
    // The little claw.
    p.ellipse(24.5, cy + 5, 1.8, 1.4, 'R').set(26, cy + 4, 'r');
  } else {
    // Two glowing eyes in the dark.
    if (q.eyes !== 3) p.set(19, cy - 2, 'y').set(21, cy - 2, 'y');
  }
  // The big claw.
  const cx0 = tucked ? 23 : 27;
  const ccy = tucked ? cy + 2 : cy - 1;
  p.line(tucked ? 20 : 23, cy + 1, cx0 - 2, ccy + 1, 'R').line(tucked ? 20 : 23, cy + 2, cx0 - 2, ccy + 2, 'R');
  p.ellipse(cx0, ccy + 1, 3.4, 3, 'R');
  p.set(cx0 - 2, ccy - 1, 'S').set(cx0 - 1, ccy - 1, 'S');
  const gap = q.claw === 2 ? 3 : q.claw === 1 ? 1.5 : 0;
  p.line(cx0 + 2, ccy - 1, cx0 + 5, ccy - 2 - gap, 'R').line(cx0 + 2, ccy, cx0 + 4, ccy - 1 - gap, 'S');
  p.line(cx0 + 2, ccy + 3, cx0 + 5, ccy + 2 + gap * 0.5, 'R');
  p.set(cx0 + 5, ccy - 2 - gap, 'r');
  return p.outline('o').rows();
}

function canFrames(look: number): string[][] {
  const f = (roll: number, claw: number, step: number, eyes: number, lift: number): string[] => canshell({ look, roll, claw, step, eyes, lift });
  return [f(0, 0, 0, 0, 0), f(1, 1, 0, 0, 0), f(1, 0, 1, 0, 1), f(2, 1, 0, 0, 0), f(3, 2, 0, 1, -1), f(2, 2, 1, 0, 1), f(0, 1, 0, 1, -2), f(3, 0, 0, 3, -1)];
}

export const CANSHELL_SPRITE: SpriteDef = bossSprite('boss.canshell', 32, 28, 21, CAN_PAL, canFrames(0), bossAnims(3, 8, 12));
export const CANSHELL_ROLL_SPRITE: SpriteDef = bossSprite('boss.canshell.roll', 32, 28, 21, CAN_PAL_ROLL, canFrames(1), {
  ...bossAnims(4, 10, 16),
  move: { frames: [0, 2, 3, 6], fps: 10, loop: true },
  charge: { frames: [0, 2, 3, 6], fps: 18, loop: true },
});

// ── Glowtail ────────────────────────────────────────────────────────────────

const GRUB_PAL: Record<string, string> = {
  o,
  G: '#d8cfa8',
  H: '#f4eed6',
  g: '#9a8e68',
  k: '#140e10',
  e: '#ffffff',
  M: '#3a1a14',
  j: '#6a5238',
  b: '#e8a0a0',
  Y: '#ffe98a',
  W: '#fffbe0',
  y: '#d0a840',
  z: '#fff2a080',
  s: '#b8e060',
};

const GRUB_PAL_FLARE: Record<string, string> = { ...GRUB_PAL, Y: '#ff8a5a', W: '#fff0e0', y: '#c0402a', z: '#ffb08090', s: '#ffb060', G: '#e0c8a8', g: '#a0805e' };

interface GrubPose {
  /** 0 glowing, 1 flare. */
  look: number;
  /** Tail: −1 drawn back, 0, +1 thrust forward over the head. */
  tail: number;
  /** Bulb radius. */
  bulb: number;
  /** Halo on. */
  halo: boolean;
  /** Inch-worm squash (−1 bunched … +1 stretched). */
  inch: number;
  /** 0 open, 1 narrowed, 3 shut. */
  eyes: number;
  /** Mouth open. */
  open: boolean;
  /** Head lowered, px. */
  duck: number;
}

function glowtail(q: GrubPose): string[] {
  const W = 36;
  const H = 30;
  const p = new Pix(W, H);
  const sq = 1 - q.inch * 0.08;
  // Segment centres (head first), the tail arching over the back.
  const body: [number, number, number][] = [
    [27, 21 + q.duck, 6.3],
    [21 * sq + 27 * (1 - sq), 22.5, 5.4],
    [15.5 * sq + 27 * (1 - sq), 22.5, 5],
    [10.5 * sq + 27 * (1 - sq), 20.5, 4.6],
  ];
  const k = q.tail;
  const tail: [number, number, number][] = [
    [7 - k, 16, 4],
    [6.5 - k * 0.5, 11 - Math.max(0, -k), 3.5],
    [8.5 + k * 1.5, 7 - Math.max(0, -k), 3],
    [12 + k * 3.5, 4.5 + Math.max(0, k), 2.6],
  ];
  const bx = 16.5 + k * 6;
  const by = 5 + Math.max(0, k) * 1.5 - Math.max(0, -k) * 0.5;

  // Draw back to front: tail tip, tail, body, head (each with a darker ring = segment lines).
  const seg = (x: number, y: number, r: number): void => {
    p.disc(x, y, r, 'g');
    p.disc(x - 0.3, y - 0.3, r - 1, 'G');
  };
  for (let i = tail.length - 1; i >= 0; i--) seg(tail[i]![0], tail[i]![1], tail[i]![2]);
  for (let i = body.length - 1; i >= 0; i--) seg(body[i]![0], body[i]![1], body[i]![2]);
  p.shade('G', 'H', 'g');
  // Stubby legs.
  for (const lx of [19, 23, 26]) p.rect(lx, 27, 1, 2, 'g');
  // Glowing spots along the segments (flare).
  if (q.look === 1) {
    for (const [x, y] of [...body.slice(1), ...tail]) p.set(x, y - 1, 's').set(x + 1, y - 1, 's');
  }

  // The lantern bulb on its stalk.
  if (q.halo) {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.set(bx + Math.cos(a) * (q.bulb + 2.2), by + Math.sin(a) * (q.bulb + 2), 'z');
    }
  }
  p.disc(bx, by, q.bulb, 'Y');
  p.map((x, y, c) => (c === 'Y' && y > by + q.bulb * 0.35 ? 'y' : null));
  p.disc(bx - 0.6, by - 0.6, Math.max(1, q.bulb * 0.5), 'W');

  // Face.
  const [hx, hy] = body[0]!;
  const ey = hy - 2;
  for (const [ex, dy] of [
    [hx + 0.5, 0],
    [hx + 4, 1],
  ] as const) {
    if (q.eyes === 3) {
      p.line(ex - 1, ey + dy, ex + 1, ey + dy, 'k');
      continue;
    }
    p.ellipse(ex, ey + dy, 1.5, q.eyes === 1 ? 0.9 : 2.1, 'k');
    if (q.eyes !== 1) p.set(ex - 1, ey + dy - 1, 'e');
  }
  p.set(hx - 2, hy + 1, 'b').set(hx - 1, hy + 1, 'b');
  if (q.open) p.ellipse(hx + 4, hy + 3.5, 1.6, 1.3, 'M');
  else p.line(hx + 3, hy + 3, hx + 5, hy + 3, 'M');
  p.set(hx + 6, hy + 3, 'j').set(hx + 6, hy + 4, 'j').set(hx + 5, hy + 5, 'j');
  return p.outline('o').rows();
}

function grubFrames(look: number): string[][] {
  const big = look === 1 ? 0.6 : 0;
  const f = (tail: number, bulb: number, halo: boolean, inch: number, eyes: number, open: boolean, duck: number): string[] =>
    glowtail({ look, tail, bulb: bulb + big, halo: halo || look === 1, inch, eyes, open, duck });
  return [
    f(0, 3.3, false, 0, 0, false, 0),
    f(0, 3.8, true, 0.3, 0, false, 0),
    f(0.2, 3.4, false, -1, 0, false, 0),
    f(-0.2, 3.6, true, 1, 0, false, 0),
    f(-1, 2.9, false, -0.6, 1, false, 1),
    f(1, 4.4, true, 0.6, 0, true, 0),
    f(0.5, 3.6, true, -1, 1, false, 2),
    f(-0.5, 2.6, false, 0, 3, true, 1),
  ];
}

export const GLOWTAIL_SPRITE: SpriteDef = bossSprite('boss.glowtail', 36, 30, 22, GRUB_PAL, grubFrames(0), bossAnims(3, 5, 10));
export const GLOWTAIL_FLARE_SPRITE: SpriteDef = bossSprite('boss.glowtail.flare', 36, 30, 22, GRUB_PAL_FLARE, grubFrames(1), bossAnims(5, 6, 12));
