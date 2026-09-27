/**
 * The Rust Foundry boss (chapter 3, alt track) — original art, painted with ./paint.ts. One sprite per
 * phase look (bossesBKit.ts: frame order, the phase-look swap).
 *
 *   Bellowbelly  48×52  a pot-bellied cast-iron stove on stubby legs: a stovepipe top hat puffing smoke,
 *                        ember eyes under heavy brows, a furnace door for a mouth and a leather bellows
 *                        for each arm. Red Hot: the iron glows at the seams, the door hangs open, flames
 *                        lick out of the pipe. Meltdown: orange iron split by white-hot cracks, slag
 *                        dripping from its belly, the pipe bent.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix } from './paint';
import { bossAnims, bossSprite, crack, puff } from './bossesBKit';

const o = OUTLINE;

const STOVE_PAL: Record<string, string> = {
  o,
  I: '#45404a',
  J: '#6a6472',
  K: '#2c2830',
  r: '#8a4a2a',
  q: '#b0643a',
  F: '#ff7a2a',
  G: '#ffc84a',
  W: '#fff4c0',
  f: '#c83a1a',
  L: '#7a4a2a',
  M: '#a8703e',
  N: '#4e2c18',
  H: '#9a6a3a',
  s: '#6a6470',
  S: '#a49ea8',
  k: '#0f0d18',
};

const STOVE_PAL_RED: Record<string, string> = {
  ...STOVE_PAL,
  I: '#5c2c28',
  J: '#8e4234',
  K: '#3a1a1a',
  r: '#c85a2a',
  q: '#ff8a3a',
};

const STOVE_PAL_MELT: Record<string, string> = {
  ...STOVE_PAL,
  I: '#8e3c22',
  J: '#c8622e',
  K: '#5a2014',
  r: '#ff9a3a',
  q: '#ffd060',
  L: '#6a3620',
  M: '#8e5430',
};

interface StovePose {
  /** 0 stoked, 1 red hot, 2 meltdown. */
  look: number;
  /** Body raise (+ up, − squat), px. */
  lift: number;
  /** 0 stand, 1 left foot up, 2 right foot up. */
  legs: number;
  /** Bellows fullness (0 squeezed … 2 full). */
  pump: number;
  /** 0 grate shut, 1 door flung open (blast). */
  mouth: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Smoke / flame frame 0-2. */
  smoke: number;
}

function stove(q: StovePose): string[] {
  const W = 48;
  const H = 52;
  const p = new Pix(W, H);
  const cx = 24;
  const cy = 33 - q.lift;

  // Stubby legs with clawed feet.
  for (const [x0, side] of [
    [15, 1],
    [28, 2],
  ] as const) {
    const up = q.legs === side ? 2 : 0;
    const bot = 50 - up;
    p.rect(x0, cy + 10, 6, bot - cy - 10, 'I').rect(x0, cy + 10, 1, bot - cy - 10, 'J').rect(x0 + 5, cy + 10, 1, bot - cy - 10, 'K');
    p.rect(x0 - 1, bot, 8, 2, 'K').set(x0 - 1, bot + 1, 'I').set(x0 + 2, bot + 1, 'I').set(x0 + 6, bot + 1, 'I');
  }
  if (q.look === 2) {
    // Slag dripping between the legs.
    p.rect(23, cy + 12, 2, 5 + (q.smoke % 2), 'F').set(23, cy + 17 + (q.smoke % 2), 'G');
    p.rect(12, cy + 10, 1, 3, 'F');
    p.rect(35, cy + 9, 1, 2 + (q.smoke % 3), 'F');
  }

  // The bellows arms (behind the belly's edge).
  for (const s of [-1, 1]) {
    const x0 = cx + s * 18;
    const by = cy + 1;
    const rx = 3 + q.pump * 0.9;
    p.ellipse(x0, by, rx, 7, 'L');
    p.map((x, y, c) => (c === 'L' && (y - by) % 3 === 0 ? 'N' : c === 'L' && x * s > x0 * s + rx * 0.4 ? 'M' : null));
    // Wooden boards along the outer edges, a handle on top, the brass-tipped nozzle below.
    p.line(x0 + s * Math.round(rx), by - 6, x0 + s, by + 6, 'H');
    p.line(x0 - s * Math.round(rx - 1), by - 6, x0 - s, by + 6, 'H');
    p.rect(x0 - 1, by - 9, 3, 2, 'H');
    p.rect(x0 - 1, by + 7, 2, 3, 'J').set(x0, by + 9, 'K');
  }

  // The iron belly.
  p.ellipse(cx, cy, 15.5, 14, 'I');
  p.shade('I', 'J', 'K');
  p.ellipse(18, cy - 8, 4.5, 2.4, 'J');
  // Rust patches and a riveted band.
  p.ellipse(35, cy + 6, 2.2, 1.6, 'r').set(35, cy + 5, 'q');
  p.ellipse(12, cy + 8, 1.6, 1.2, 'r');
  for (let x = cx - 13; x <= cx + 13; x += 3) if (p.get(x, cy - 3) !== '.') p.set(x, cy - 3, 'K');
  for (let x = cx - 12; x <= cx + 12; x += 6) if (p.get(x, cy - 4) !== '.') p.set(x, cy - 4, 'J');
  if (q.look >= 1) {
    // Glowing seams just inside the silhouette.
    const src = p.copy();
    p.map((x, y, c) => {
      if (c !== 'I' && c !== 'J' && c !== 'K') return null;
      const edge = src.get(x - 1, y) === '.' || src.get(x + 1, y) === '.' || src.get(x, y + 1) === '.';
      return edge && y > cy - 10 ? (q.look === 2 ? 'F' : 'f') : null;
    });
  }

  // The furnace door (the mouth).
  const dx0 = cx - 8;
  const dy0 = cy + 1;
  const open = q.mouth === 1 || q.look >= 1;
  p.rect(dx0, dy0, 17, 10, 'K');
  p.rect(dx0 + 1, dy0 + 1, 15, 8, open ? 'F' : 'f');
  if (open) {
    const wide = q.mouth === 1;
    p.ellipse(cx, dy0 + 5, wide ? 6.5 : 5, wide ? 3.6 : 2.8, 'G');
    p.ellipse(cx, dy0 + 5.5, wide ? 3.5 : 2.4, wide ? 1.8 : 1.2, 'W');
    // Little iron fangs at the top of the opening.
    p.set(dx0 + 3, dy0 + 1, 'J').set(dx0 + 13, dy0 + 1, 'J').set(dx0 + 4, dy0 + 1, 'K').set(dx0 + 12, dy0 + 1, 'K');
    if (wide) p.set(dx0 + 3, dy0 + 2, 'J').set(dx0 + 13, dy0 + 2, 'J');
    // The door itself swung aside on its hinge.
    p.rect(dx0 - 4, dy0, 3, 10, 'J').rect(dx0 - 4, dy0, 1, 10, 'K').set(dx0 - 3, dy0 + 4, 'H');
  } else {
    for (let x = dx0 + 2; x < dx0 + 16; x += 2) p.rect(x, dy0 + 1, 1, 8, 'K');
    p.rect(dx0 + 3, dy0 + 5, 11, 3, 'F');
    for (let x = dx0 + 3; x < dx0 + 14; x += 2) p.set(x, dy0 + 6, 'G');
    p.set(dx0 + 8, dy0 + 6, 'W');
    for (let x = dx0 + 2; x < dx0 + 16; x += 2) p.rect(x, dy0 + 1, 1, 8, 'K');
    p.rect(dx0 + 15, dy0 + 4, 2, 2, 'H');
  }

  // Ember eyes under heavy iron brows, glowing cheeks.
  const ey = cy - 7;
  for (const ex of [cx - 6, cx + 6]) {
    if (q.eyes === 3) {
      p.line(ex - 3, ey, ex + 2, ey, 'K').line(ex - 2, ey + 1, ex + 1, ey + 1, 'f');
      continue;
    }
    const ry = q.eyes === 1 ? 0.9 : q.eyes === 2 ? 3 : 2.1;
    p.ellipse(ex, ey, 2.9, ry, q.look === 2 ? 'W' : 'G');
    if (q.eyes !== 1) p.set(ex + 1, ey, q.look === 2 ? 'G' : 'W').set(ex, ey, q.look === 2 ? 'G' : 'W');
    if (q.eyes === 2) p.set(ex - 2, ey + 2, 'F').set(ex + 2, ey + 2, 'F');
  }
  const bl = q.eyes === 1 || q.look >= 1 ? 1 : 0;
  p.rect(cx - 10, ey - 4 + bl, 8, 2, 'K').set(cx - 3, ey - 2 + bl, 'K');
  p.rect(cx + 3, ey - 4 + bl, 8, 2, 'K').set(cx + 2, ey - 2 + bl, 'K');
  p.rect(cx - 12, ey + 4, 2, 1, 'f').rect(cx + 11, ey + 4, 2, 1, 'f');

  // Stovepipe top hat.
  const bend = q.look === 2 ? 2 : 0;
  const hatBase = cy - 15;
  p.rect(cx - 9, hatBase, 19, 2, 'K').rect(cx - 9, hatBase, 19, 1, 'J');
  p.rect(cx - 3, hatBase - 9, 7, 9, 'I').rect(cx - 3, hatBase - 9, 1, 9, 'J').rect(cx + 3, hatBase - 9, 1, 9, 'K');
  p.rect(cx - 3 + bend, hatBase - 15, 7, 7, 'I').rect(cx - 3 + bend, hatBase - 15, 1, 7, 'J').rect(cx + 3 + bend, hatBase - 15, 1, 7, 'K');
  p.rect(cx - 4 + bend, hatBase - 16, 9, 2, 'J').rect(cx - 4 + bend, hatBase - 15, 9, 1, 'K');
  p.rect(cx - 3, hatBase - 7, 7, 1, 'K');
  if (q.look === 2) crack(p, cx + 1, hatBase - 12, cx + 2, hatBase - 5, 'k', 'G', 3);
  const tx = cx + bend;
  const ty = hatBase - 17;
  if (q.look === 0) {
    // Smoke rings drifting up.
    if (q.smoke >= 1) puff(p, tx - 1, ty - 1, 1.8, 's', 'S');
    if (q.smoke >= 2) puff(p, tx + 3, ty - 2, 2.2, 's', 'S');
  } else {
    // Flames licking out of the pipe.
    const h = 2 + (q.smoke % 3);
    p.ellipse(tx, ty, 3, 1.6, 'F');
    p.line(tx - 2, ty, tx - 2 - (q.smoke % 2), ty - h + 1, 'F');
    p.line(tx, ty, tx + (q.smoke === 1 ? 1 : 0), ty - h - 1, 'G');
    p.line(tx + 2, ty, tx + 2, ty - h + 1, 'F');
    p.set(tx, ty - 1, 'W');
  }

  if (q.look === 2) {
    // White-hot cracks across the belly.
    crack(p, cx - 13, cy - 1, cx - 7, cy + 11, 'W', 'G', 1);
    crack(p, cx + 9, cy - 10, cx + 13, cy + 6, 'W', 'G', 2);
    crack(p, cx - 4, cy - 13, cx - 1, cy - 9, 'G', 'F', 4);
  }
  return p.outline('o').rows();
}

function stoveFrames(look: number): string[][] {
  const f = (lift: number, legs: number, pump: number, mouth: number, eyes: number, smoke: number): string[] =>
    stove({ look, lift, legs, pump, mouth, eyes, smoke });
  return [
    f(0, 0, 0.6, 0, 0, 1),
    f(1, 0, 1.6, 0, 0, 2),
    f(1, 1, 1, 0, 0, 0),
    f(1, 2, 0.4, 0, 0, 1),
    f(-2, 0, 2, 0, 1, 2),
    f(1, 0, 0, 1, 2, 2),
    f(-3, 0, 1.2, 0, 1, 0),
    f(-1, 0, 0.3, 1, 3, 1),
  ];
}

export const BELLOWBELLY_SPRITE: SpriteDef = bossSprite('boss.bellowbelly', 48, 52, 38, STOVE_PAL, stoveFrames(0), bossAnims(3, 6, 12));
export const BELLOWBELLY_RED_SPRITE: SpriteDef = bossSprite('boss.bellowbelly.red', 48, 52, 38, STOVE_PAL_RED, stoveFrames(1), bossAnims(5, 7, 12));
export const BELLOWBELLY_MELT_SPRITE: SpriteDef = bossSprite('boss.bellowbelly.melt', 48, 52, 38, STOVE_PAL_MELT, stoveFrames(2), bossAnims(7, 8, 14));
