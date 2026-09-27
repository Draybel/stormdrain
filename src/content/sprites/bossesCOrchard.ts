/**
 * Boss pack C — The Bone Orchard (chapter 5 main) sprites, painted with ./paint.ts (+ bossesCPaint.ts).
 * 1 px dark outline, lit from the top-left, side views face RIGHT. Each boss has a second sprite for
 * its later phase(s) (swapped in by its boss hook, content/hooks/bosses-c.ts) with the same animations.
 *
 *   Marrowbough     52×56  the bone tree the orchard grew from: a ribcage trunk, a knothole face,
 *                          lanterns on its limbs, a crow on its shoulder. Withered: cracks of glowing
 *                          marrow, ember eyes, a burning ribcage, snapped twigs, the crow gone.
 *   The Gloamkeeper 40×54  a tall hooded lantern-bearer on a crooked bone staff. Guttering: the lantern
 *                          glass cracks and a wild green flame gets loose; the cloak frays.
 *   Tatterjack      30×34  a scarecrow that hops about on its pole (miniboss). Unstuffed: straw bursts
 *                          out, a button eye pops off, the hat blows away.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, bossSprite, crack, curve, curveAt, hash2, repaint, thick } from './bossesCPaint';

const o = OUTLINE;

// ── Marrowbough ─────────────────────────────────────────────────────────────

const TREE_PAL = {
  o,
  B: '#ece4cc',
  b: '#c9bea2',
  c: '#9a8f76',
  d: '#6e6554',
  k: '#1a1420',
  E: '#9aff7a',
  e: '#e8ffd8',
  L: '#ffcf57',
  l: '#e8862e',
  I: '#3a3438',
  C: '#3c3c5e',
  h: '#7070a4',
  y: '#f0a838',
  m: '#5c5a3a',
  M: '#8a8656',
  R: '#ff7a3a',
  Y: '#ffd060',
  r: '#a8402a',
  W: '#fff6c0',
};

/** Ashen bone for the withered phase (same chars, darker, warmer). */
const TREE_PAL_2 = repaint(TREE_PAL, { B: '#d8ccb0', b: '#aa9f86', c: '#7a705c', d: '#50483e', m: '#4a3a2e', M: '#6a5440' });

interface TreePose {
  /** Branch tips sway (px). */
  sway: number;
  /** Roots: 0 planted, 1 left pair lifted, 2 right pair lifted. */
  step: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** 0 grim, 1 roaring. */
  mouth: number;
  /** Limbs raised (+) or drooping (-), px. */
  raise: number;
  /** Crouch (px). */
  squash: number;
}

function tree(pose: TreePose, withered: boolean): string[] {
  const W = 52;
  const H = 56;
  const p = new Pix(W, H);
  const cx = 26;
  const top = 15 + pose.squash;
  const base = 47;
  const sw = pose.sway;
  const up = pose.raise;

  // Limbs and twigs (behind the trunk): a lopsided fan of finger bones.
  const L1 = [22, top + 6, 13, top + 1, 4 + sw, 9 - up] as const;
  const R1 = [30, top + 6, 39, top + 1, 48 + sw, 8 - up] as const;
  const R2 = [28, top + 3, 31, 6, 33 + sw, 1 - up] as const;
  curve(p, ...L1, 4.2, 2, 'b');
  curve(p, ...R1, 4.2, 2, 'b');
  curve(p, 24, top + 3, 22, 7, 19 + sw, 1 - up, 3, 1.5, 'b');
  curve(p, ...R2, 3, 1.5, 'b');
  curve(p, 14, top + 2, 11, 9, 10 + sw, 3 - up, 2.2, 1, 'b');
  curve(p, 38, top + 2, 42, 9, 44 + sw, 2 - up, 2.2, 1, 'b');
  if (!withered) {
    curve(p, 5 + sw, 9 - up, 2, 11, 1 + sw, 15 - up, 1.6, 1, 'b');
    curve(p, 47 + sw, 8 - up, 50, 10, 51 + sw, 13 - up, 1.6, 1, 'b');
  } else {
    // Snapped twigs: stubs.
    thick(p, 5 + sw, 9 - up, 3 + sw, 11 - up, 1.4, 'b');
    thick(p, 47 + sw, 8 - up, 49 + sw, 10 - up, 1.4, 'b');
  }
  // Knuckles on the tips.
  for (const [x, y] of [
    [4 + sw, 9 - up],
    [48 + sw, 8 - up],
    [19 + sw, 1 - up],
    [33 + sw, 1 - up],
    [10 + sw, 3 - up],
    [44 + sw, 2 - up],
  ] as const) {
    p.disc(x + 0.5, y + 0.5, 1.3, 'B');
  }

  // The trunk: fused bones, widening into the roots.
  for (let y = top; y <= base + 2; y++) {
    const k = y - top;
    const hw = 6.5 + (k < 4 ? (4 - k) * 0.9 : 0) + (y > base - 9 ? (y - (base - 9)) * 0.7 : 0) + Math.sin(y * 0.7) * 0.6;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) p.set(x, y, 'b');
  }
  // Grain: vertical bone strands.
  p.map((x, y, cur) => (cur === 'b' && y > top + 2 && (x + 100 - cx) % 4 === 1 && hash2(x, y, 3) > 0.25 ? 'c' : null));

  // Roots, splayed like finger bones.
  const liftL = pose.step === 1 ? 3 : 0;
  const liftR = pose.step === 2 ? 3 : 0;
  curve(p, cx - 6, base, cx - 15, base + 1, 4, 53 - liftL, 3.4, 2.2, 'b');
  curve(p, cx - 3, base + 2, cx - 6, base + 6, 14, 55 - liftL, 3.4, 2.2, 'b');
  curve(p, cx + 3, base + 2, cx + 6, base + 6, 38, 55 - liftR, 3.4, 2.2, 'b');
  curve(p, cx + 6, base, cx + 15, base + 1, 48, 53 - liftR, 3.4, 2.2, 'b');
  for (const [x, y] of [
    [4, 53 - liftL],
    [14, 54 - liftL],
    [38, 54 - liftR],
    [48, 53 - liftR],
  ] as const) {
    p.disc(x + 0.5, y + 0.5, 1.4, 'B');
  }

  // The ribcage hollow in the lower trunk (dark; burning when withered).
  const ry = base - 7;
  p.ellipse(cx + 0.5, ry, 4.6, 6.2, withered ? 'R' : 'k');
  if (withered) p.ellipse(cx + 0.5, ry + 1, 2.4, 3.8, 'Y');
  for (let i = 0; i < 4; i++) {
    const yy = ry - 5 + i * 3;
    for (let x = cx - 6; x <= cx + 7; x++) {
      const dy = Math.round(Math.abs(x - cx - 0.5) * 0.22);
      if (p.get(x, yy + dy) !== '.') p.set(x, yy + dy, 'B');
    }
  }
  // Moss.
  p.ellipse(cx - 6, top + 17, 2, 1.4, 'm').set(cx - 7, top + 16, 'M');
  p.ellipse(cx + 8, base - 2, 2, 1.3, 'm').set(cx + 7, base - 3, 'M');

  // The knothole face.
  const ey = top + 7;
  const eye = (ex: number): void => {
    if (pose.eyes === 3) {
      p.line(ex - 2, ey, ex + 2, ey, 'k');
      return;
    }
    const h = pose.eyes === 1 ? 1.5 : pose.eyes === 2 ? 3.6 : 3;
    p.ellipse(ex + 0.5, ey + 0.5, 2.7, h, 'k');
    const g = withered ? 'R' : 'E';
    const hot = withered ? 'Y' : 'e';
    if (pose.eyes === 1) p.rect(ex - 1, ey, 3, 1, g);
    else {
      p.rect(ex - 1, ey - 1, 2, 2, g).set(ex, ey - 1, hot);
      if (pose.eyes === 2) p.set(ex - 1, ey + 1, g).set(ex, ey + 1, g);
    }
  };
  eye(cx - 4);
  eye(cx + 5);
  // Brow knobs.
  p.line(cx - 7, ey - 4 + (pose.eyes === 1 ? 1 : 0), cx - 2, ey - 3, 'B');
  p.line(cx + 3, ey - 3, cx + 8, ey - 4 + (pose.eyes === 1 ? 1 : 0), 'B');
  // Mouth: a jagged split with bony teeth (gaping when it roars).
  const my = top + 12;
  if (pose.mouth === 1) {
    p.ellipse(cx + 0.5, my + 1.5, 4.6, 3, 'k');
    p.set(cx - 2, my - 1, 'B').set(cx + 1, my - 1, 'B').set(cx + 3, my, 'B').set(cx - 1, my + 4, 'B').set(cx + 2, my + 4, 'B');
    if (withered) p.rect(cx, my + 1, 2, 2, 'R');
  } else {
    for (let x = cx - 5; x <= cx + 6; x++) p.set(x, my + ((x & 1) === 0 ? 0 : 1), 'k');
    p.set(cx - 3, my + 1, 'B').set(cx + 1, my + 1, 'B').set(cx + 4, my + 1, 'B');
  }

  // Lanterns hanging from the big limbs.
  const lantern = (t: number, limb: readonly [number, number, number, number, number, number], swing: number): void => {
    const [lx0, ly0] = curveAt(...limb, t);
    const lx = Math.round(lx0 + swing);
    const ly = Math.round(ly0) + 2;
    p.line(Math.round(lx0), Math.round(ly0) + 1, lx, ly, 'I');
    p.rect(lx - 1, ly + 1, 4, 5, 'I');
    p.rect(lx - 2, ly + 1, 6, 1, 'I');
    p.rect(lx, ly + 2, 2, 3, withered ? 'Y' : 'L');
    p.set(lx, ly + 2, 'W').set(lx + 1, ly + 4, 'l');
  };
  lantern(0.5, L1, sw > 0 ? 1 : 0);
  lantern(0.6, R1, sw < 0 ? -1 : 0);

  if (!withered) {
    // A crow perched on the right limb, facing left.
    const [bx0, by0] = curveAt(...R2, 0.55);
    const bx = Math.round(bx0) + 1;
    const by = Math.round(by0) - 3 + (sw > 0 ? 1 : 0);
    p.ellipse(bx + 1.5, by + 0.5, 3, 2, 'C');
    p.disc(bx - 1.5, by - 1.5, 1.7, 'C');
    p.set(bx - 4, by - 1, 'y').set(bx - 3, by - 1, 'y');
    p.set(bx - 2, by - 2, 'e');
    p.line(bx + 3, by - 1, bx + 6, by - 2, 'C');
    p.set(bx, by - 1, 'h').set(bx + 1, by, 'h');
  } else {
    // Glowing cracks of marrow, and embers drifting off the limbs.
    crack(p, cx - 4, top + 3, Math.PI / 2 + 0.25, 16, 'R', 'bBc', 1, 'Y');
    crack(p, cx + 5, top + 14, Math.PI / 2 - 0.3, 14, 'R', 'bBc', 2);
    crack(p, 18, top + 4, Math.PI + 0.4, 7, 'R', 'bBc', 3);
    crack(p, 34, top + 4, -0.3, 7, 'R', 'bBc', 4);
    crack(p, cx - 8, base - 2, Math.PI * 0.8, 6, 'r', 'bBc', 5);
    for (let i = 0; i < 6; i++) {
      const x = 6 + Math.round(hash2(i, sw + 3, 21) * 40);
      const y = 1 + Math.round(hash2(i, pose.step + 5, 22) * 10);
      if (!p.on(x, y) && !p.on(x, y + 1)) p.set(x, y, i & 1 ? 'Y' : 'R');
    }
  }

  p.shade('b', 'B', 'c');
  return p.outline('o').rows();
}

const TREE_POSES: TreePose[] = [
  { sway: 0, step: 0, eyes: 0, mouth: 0, raise: 0, squash: 0 },
  { sway: 1, step: 0, eyes: 0, mouth: 0, raise: 0, squash: 0 },
  { sway: -1, step: 1, eyes: 0, mouth: 0, raise: 0, squash: 0 },
  { sway: 1, step: 2, eyes: 0, mouth: 0, raise: 0, squash: 0 },
  { sway: 0, step: 0, eyes: 1, mouth: 0, raise: 3, squash: 1 },
  { sway: 0, step: 0, eyes: 2, mouth: 1, raise: 3, squash: 0 },
  { sway: -1, step: 0, eyes: 1, mouth: 1, raise: -2, squash: 2 },
  { sway: 0, step: 0, eyes: 3, mouth: 0, raise: -2, squash: 1 },
];
const TREE_ANIMS = { idle: [0, 1], move: [2, 3], windup: [4], roar: [5], slam: [6], air: [5], hurt: [7], fps: { idle: 2, move: 4 } };

export const MARROWBOUGH_SPRITE: SpriteDef = bossSprite(
  'boss.marrowbough',
  52,
  56,
  45,
  TREE_PAL,
  TREE_POSES.map((q) => tree(q, false)),
  TREE_ANIMS,
);
export const MARROWBOUGH_WITHERED_SPRITE: SpriteDef = bossSprite(
  'boss.marrowbough.withered',
  52,
  56,
  45,
  TREE_PAL_2,
  TREE_POSES.map((q) => tree(q, true)),
  TREE_ANIMS,
);

// ── The Gloamkeeper ─────────────────────────────────────────────────────────

const KEEPER_PAL = {
  o,
  A: '#6a5a80',
  a: '#4a3c5e',
  z: '#2e2440',
  Z: '#8a7aa0',
  k: '#0c0a10',
  E: '#ffcf57',
  e: '#fff6c0',
  S: '#c9bea2',
  s: '#8a806a',
  I: '#3a3438',
  i: '#5a5258',
  L: '#ffcf57',
  l: '#e8862e',
  W: '#fff6c0',
  G: '#6af0c8',
  g: '#2aa888',
  H: '#d8fff0',
  n: '#b8a8cc',
};

const KEEPER_PAL_2 = repaint(KEEPER_PAL, { A: '#5e4c72', a: '#3e3050', z: '#241a34', Z: '#7a6a92', E: '#6af0c8', e: '#d8fff0' });

interface KeeperPose {
  /** Float bob (px, + = lower). */
  bob: number;
  /** Tatter wave phase. */
  wave: number;
  /** Lantern lifted (px). */
  lift: number;
  /** 0 open, 1 narrowed, 2 wide, 3 shut. */
  eyes: number;
  /** Lantern flare. */
  flare: boolean;
  /** Hood tipped back (roar). */
  tip: number;
}

function keeper(pose: KeeperPose, guttering: boolean): string[] {
  const W = 40;
  const H = 54;
  const p = new Pix(W, H);
  const b = pose.bob;
  const hx = 18;
  const hy = 12 + b - pose.tip;
  // The cloak: a long bell from the shoulders to a tattered hem.
  const halfAt = (y: number): number => 7 + Math.pow(Math.max(0, (y - (17 + b)) / 32), 0.8) * 8.5;
  const leanAt = (y: number): number => -((y - (17 + b)) / 32) * 1.5;
  for (let y = 17 + b; y <= 49 + b; y++) {
    const half = halfAt(y);
    const lean = leanAt(y);
    for (let x = Math.round(hx + lean - half); x <= Math.round(hx + lean + half); x++) p.set(x, y, 'A');
  }
  // Tattered hem: ragged teeth that wave (longer and torn through when guttering).
  const hem = 49 + b;
  for (let x = 2; x < 36; x++) {
    if (!p.on(x, hem)) continue;
    const len = 1 + Math.round(2.5 * (0.5 + 0.5 * Math.sin(x * 1.3 + pose.wave))) + (guttering && hash2(x, 3, 4) > 0.6 ? 2 : 0);
    for (let j = 1; j <= len; j++) if (hem + j < H - 1) p.set(x, hem + j, (x + j) % 3 === 0 ? 'z' : 'a');
  }
  // Long folds falling from the mantle.
  for (const f of [-0.6, -0.22, 0.2, 0.58]) {
    for (let y = 21 + b; y <= hem; y++) {
      const x = Math.round(hx + leanAt(y) + f * halfAt(y) + Math.sin(y * 0.35 + pose.wave + f * 4) * 0.6);
      if (p.get(x, y) === 'A') p.set(x, y, (y & 3) === 0 ? 'z' : 'a');
    }
  }
  if (guttering) {
    // Holes torn right through the cloth near the hem.
    for (const [x, y, r] of [
      [hx - 7, hem - 4, 1.6],
      [hx + 6, hem - 7, 1.4],
      [hx - 1, hem - 2, 1.2],
    ] as const) {
      p.ellipse(x + 0.5, y + 0.5, r, r + 0.6, '.');
    }
  }
  // The hood.
  p.ellipse(hx + 0.5, hy, 7.5, 8, 'A');
  p.ellipse(hx + 2, hy + 2 + pose.tip * 0.5, 4.8, 5.2, 'k');
  // A mantle over the shoulders.
  p.ellipse(hx + 0.5, 18 + b, 10, 3.5, 'a');
  p.ellipse(hx - 0.5, 17 + b, 9, 2.5, 'A');
  // Ember eyes in the dark of the hood.
  const ey = hy + 2 + pose.tip;
  const eye = (ex: number): void => {
    if (pose.eyes === 3) {
      p.set(ex, ey, 'z').set(ex + 1, ey, 'z');
      return;
    }
    const e1 = guttering ? 'G' : 'E';
    const e2 = guttering ? 'H' : 'e';
    if (pose.eyes === 1) p.rect(ex, ey, 2, 1, e1);
    else {
      p.rect(ex, ey - 1, 2, 2, e1).set(ex + 1, ey - 1, e2);
      if (pose.eyes === 2) p.set(ex, ey + 1, e1);
    }
  };
  eye(hx - 1);
  eye(hx + 4);
  // The staff (bone), held out front on the right.
  const sx = 31;
  const top = 5 + b - pose.lift;
  thick(p, sx, top + 2, sx - 1, 52, 2, 'S');
  for (let y = top + 4; y < 52; y += 5) p.set(sx - 1, y, 's');
  // The crook at the top, hooking right, and the lantern hanging from it.
  curve(p, sx, top + 2, sx + 2, top - 3, sx + 6, top + 1, 2, 1.6, 'S');
  const lx = sx + 5;
  const ly = top + 4;
  p.line(lx + 1, top + 2, lx + 1, ly - 1, 'I');
  if (!guttering) {
    p.rect(lx - 1, ly, 5, 7, 'I');
    p.rect(lx, ly + 1, 3, 5, pose.flare ? 'W' : 'L');
    p.set(lx + 1, ly + 2, 'W').set(lx, ly + 5, 'l').set(lx + 2, ly + 5, 'l');
    p.rect(lx - 1, ly - 1, 5, 1, 'i');
    if (pose.flare) p.set(lx - 2, ly + 3, 'L').set(lx + 4, ly + 2, 'L').set(lx + 1, ly - 2, 'L');
  } else {
    // Cracked glass, the flame loose: a tall green fire licking out of the frame.
    p.rect(lx - 1, ly, 5, 7, 'I');
    p.rect(lx, ly + 1, 3, 5, 'g');
    const fh = pose.flare ? 9 : 6 + (pose.wave > 1 ? 1 : 0);
    for (let j = 0; j < fh; j++) {
      const w = Math.max(0, 2.5 - j * 0.3);
      const fx = lx + 1.5 + Math.sin(j * 0.9 + pose.wave) * 1;
      p.ellipse(fx, ly + 3 - j, w + 0.2, 1, j < 2 ? 'H' : j < 5 ? 'G' : 'g');
    }
    p.set(lx, ly + 2, 'H').set(lx + 2, ly + 4, 'H');
    p.set(lx - 1, ly + 3, 'k').set(lx + 3, ly + 5, 'k');
  }
  // A sleeve reaching to the staff.
  thick(p, hx + 6, 24 + b, sx - 1, 26 + b - Math.round(pose.lift / 2), 3, 'a');
  p.disc(sx - 0.5, 26.5 + b - Math.round(pose.lift / 2), 1.6, 'n');
  // A second, bony hand on the chest clasp.
  p.set(hx - 2, 22 + b, 'n').set(hx - 1, 22 + b, 'n');
  if (guttering) {
    // Frayed: torn slits and embers of green drifting up.
    crack(p, hx - 6, 36 + b, Math.PI / 2, 10, 'z', 'Aa', 7);
    crack(p, hx + 7, 30 + b, Math.PI / 2 + 0.2, 12, 'z', 'Aa', 8);
    for (let i = 0; i < 4; i++) {
      const x = lx - 3 + Math.round(hash2(i, Math.round(pose.wave * 3), 9) * 8);
      const y = Math.max(0, top - 4 - Math.round(hash2(i, 2, Math.round(pose.wave * 3)) * 4));
      if (!p.on(x, y)) p.set(x, y, i & 1 ? 'G' : 'H');
    }
  }
  p.shade('A', 'Z', 'a');
  return p.outline('o').rows();
}

const KEEPER_POSES: KeeperPose[] = [
  { bob: 0, wave: 0, lift: 0, eyes: 0, flare: false, tip: 0 },
  { bob: 1, wave: 1.6, lift: 0, eyes: 0, flare: false, tip: 0 },
  { bob: 0, wave: 0.8, lift: 1, eyes: 0, flare: false, tip: 0 },
  { bob: 1, wave: 2.4, lift: 1, eyes: 0, flare: false, tip: 0 },
  { bob: 0, wave: 1.2, lift: 4, eyes: 1, flare: true, tip: 0 },
  { bob: 0, wave: 2, lift: 3, eyes: 2, flare: true, tip: 1 },
  { bob: 2, wave: 0.4, lift: -1, eyes: 3, flare: false, tip: -1 },
];
const KEEPER_ANIMS = { idle: [0, 1], move: [2, 3], windup: [4], roar: [5], slam: [4], air: [5], hurt: [6], fps: { idle: 3, move: 5 } };

export const GLOAMKEEPER_SPRITE: SpriteDef = bossSprite(
  'boss.gloamkeeper',
  40,
  54,
  40,
  KEEPER_PAL,
  KEEPER_POSES.map((q) => keeper(q, false)),
  KEEPER_ANIMS,
);
export const GLOAMKEEPER_GUTTERING_SPRITE: SpriteDef = bossSprite(
  'boss.gloamkeeper.guttering',
  40,
  54,
  40,
  KEEPER_PAL_2,
  KEEPER_POSES.map((q) => keeper(q, true)),
  KEEPER_ANIMS,
);

// ── Tatterjack (miniboss) ───────────────────────────────────────────────────

const JACK_PAL = {
  o,
  P: '#8a6a3a',
  p: '#5a4222',
  Q: '#b08850',
  J: '#6a4a3a',
  j: '#4a3228',
  K: '#8a6a52',
  q: '#a0503a',
  T: '#e8c860',
  t: '#b8943a',
  S: '#c8a878',
  s: '#9a7c52',
  U: '#e0c898',
  k: '#1a1420',
  m: '#3a2a20',
  r: '#d8483a',
  H: '#7a5a2a',
  h: '#a07a3a',
  C: '#3c3c5e',
  c: '#7070a4',
  y: '#f0a838',
  E: '#ffcf57',
};

interface JackPose {
  /** Body raised on its pole (px, + = up). */
  lift: number;
  /** Pole bend (px at the bottom). */
  bend: number;
  /** Arms: 0 level, 1 raised, -1 drooping. */
  arms: number;
  /** 0 grin, 1 open. */
  mouth: number;
  /** Straw tufts wave. */
  wave: number;
  /** Eyes shut (hurt). */
  shut: boolean;
}

function jack(pose: JackPose, unstuffed: boolean): string[] {
  const W = 30;
  const H = 34;
  const p = new Pix(W, H);
  const y0 = 3 - pose.lift;
  // The pole, from the crossbar down to the ground (bends on landings).
  thick(p, 15, y0 + 18, 15 + pose.bend, 33, 2, 'P');
  p.set(15 + pose.bend, 30, 'p').set(15, y0 + 24, 'p');
  // The crossbar and the coat sleeves over it, straw sticking out of the cuffs.
  const ay = y0 + 13 - pose.arms * 2;
  thick(p, 3, ay, 27, ay, 2, 'P');
  // Coat body.
  for (let y = y0 + 11; y <= y0 + 23; y++) {
    const half = 5 + (y - (y0 + 11)) * 0.35;
    for (let x = Math.round(15 - half); x <= Math.round(15 + half); x++) p.set(x, y, 'J');
  }
  // Sleeves.
  thick(p, 5, ay, 12, y0 + 12, 3.4, 'J');
  thick(p, 18, y0 + 12, 25, ay, 3.4, 'J');
  // Patches and stitches.
  p.rect(10, y0 + 16, 3, 3, 'q').set(11, y0 + 17, 'r');
  p.rect(18, y0 + 19, 3, 2, 'K');
  p.set(15, y0 + 14, 'm').set(15, y0 + 17, 'm').set(15, y0 + 20, 'm');
  // Straw tufts: cuffs, collar, hem (a lot more when unstuffed).
  const tuft = (x: number, y: number, dx: number, dy: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(dy, dx) + (i - (n - 1) / 2) * 0.45 + Math.sin(pose.wave + i) * 0.15;
      const l = 2 + ((i + (pose.wave > 1 ? 1 : 0)) % 2);
      p.line(x, y, Math.round(x + Math.cos(a) * l), Math.round(y + Math.sin(a) * l), i & 1 ? 't' : 'T');
    }
  };
  tuft(3, ay, -1, 0.2, 3);
  tuft(27, ay, 1, 0.2, 3);
  tuft(15, y0 + 24, 0, 1, unstuffed ? 5 : 3);
  if (unstuffed) {
    // Torn open: a dark rip in the coat with straw bursting out of it (and out of the seams).
    p.ellipse(14.5, y0 + 17.5, 2.6, 2, 'm');
    tuft(14, y0 + 17, -1, -0.3, 3);
    tuft(15, y0 + 17, 1, 0.4, 3);
    tuft(14, y0 + 18, 0, 1, 2);
    tuft(10, y0 + 21, -1, 0.6, 3);
    tuft(20, y0 + 15, 1, 0.3, 3);
    tuft(15, y0 + 11, 0, -1, 3);
  }
  // The sack head.
  const hy = y0 + 6;
  p.ellipse(15, hy + 0.5, 6.2, 5.6, 'S');
  p.map((x, y, c) => (c === 'S' && (x + y * 3) % 5 === 0 ? 's' : null));
  // Tie at the neck.
  p.rect(12, hy + 5, 6, 1, 'm');
  // Button eyes (one pops off when unstuffed: a glowing hole).
  if (pose.shut) {
    p.line(11, hy, 13, hy, 'k').line(16, hy, 18, hy, 'k');
  } else {
    p.rect(11, hy - 1, 2, 2, 'k').set(12, hy - 1, 'U');
    if (unstuffed) p.rect(16, hy - 1, 2, 2, 'E');
    else p.rect(16, hy - 1, 2, 2, 'r').set(17, hy - 1, 'U');
  }
  // A stitched grin.
  if (pose.mouth === 1) {
    p.ellipse(14.5, hy + 3, 3.4, 1.4, 'k');
    p.set(12, hy + 3, 'U').set(15, hy + 3, 'U');
  } else {
    p.line(11, hy + 2, 13, hy + 3, 'm').line(13, hy + 3, 17, hy + 3, 'm').line(17, hy + 3, 19, hy + 2, 'm');
    p.set(12, hy + 4, 'm').set(14, hy + 4, 'm').set(16, hy + 4, 'm').set(18, hy + 3, 'm');
  }
  if (!unstuffed) {
    // A floppy straw hat with a crow on the brim.
    p.ellipse(15, hy - 4, 9, 1.6, 'H');
    p.ellipse(15, hy - 6, 5, 3, 'H');
    p.rect(10, hy - 5, 10, 1, 'q');
    p.map((x, y, c) => (c === 'H' && (x + y) % 4 === 0 ? 'h' : null));
    const cx = 21;
    const cy = hy - 9 + (pose.wave > 1 ? 1 : 0);
    p.ellipse(cx + 0.5, cy + 0.5, 2.6, 1.8, 'C');
    p.disc(cx + 3, cy - 1, 1.4, 'C');
    p.set(cx + 4, cy - 1, 'y').set(cx + 5, cy - 1, 'y').set(cx + 3, cy - 2, 'c');
    p.line(cx - 2, cy, cx - 4, cy - 1, 'C');
  } else {
    // Torn sack: a rip with straw poking out.
    p.line(18, hy - 5, 20, hy - 2, 'm');
    p.set(19, hy - 6, 'T').set(20, hy - 6, 't').set(21, hy - 5, 'T');
  }
  p.shade('J', 'K', 'j');
  p.shade('S', 'U', 's');
  return p.outline('o').rows();
}

const JACK_POSES: JackPose[] = [
  { lift: 0, bend: 0, arms: 0, mouth: 0, wave: 0, shut: false },
  { lift: 1, bend: 0, arms: 0, mouth: 0, wave: 1.5, shut: false },
  { lift: 0, bend: 1, arms: 1, mouth: 0, wave: 0.8, shut: false },
  { lift: 1, bend: -1, arms: -1, mouth: 0, wave: 2.2, shut: false },
  { lift: -2, bend: 2, arms: 1, mouth: 0, wave: 0.3, shut: false },
  { lift: 0, bend: 0, arms: 1, mouth: 1, wave: 2, shut: false },
  { lift: 3, bend: 0, arms: 1, mouth: 1, wave: 1, shut: false },
  { lift: -2, bend: -2, arms: -1, mouth: 1, wave: 0.5, shut: false },
  { lift: -1, bend: 1, arms: -1, mouth: 0, wave: 0, shut: true },
];
const JACK_ANIMS = { idle: [0, 1], move: [2, 3], windup: [4], roar: [5], air: [6], slam: [7], hurt: [8], fps: { idle: 3, move: 6 } };

export const TATTERJACK_SPRITE: SpriteDef = bossSprite('boss.tatterjack', 30, 34, 27, JACK_PAL, JACK_POSES.map((q) => jack(q, false)), JACK_ANIMS);
export const TATTERJACK_UNSTUFFED_SPRITE: SpriteDef = bossSprite(
  'boss.tatterjack.unstuffed',
  30,
  34,
  27,
  JACK_PAL,
  JACK_POSES.map((q) => jack(q, true)),
  JACK_ANIMS,
);
