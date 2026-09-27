/**
 * The Mushroom Hollow bosses (chapter 4, main track) — original art, painted with ./paint.ts. One
 * sprite per phase look (bossesBKit.ts: frame order, the phase-look swap).
 *
 *   Grandmother Gill  48×52  an ancient toadstool: a wide spotted plum cap, a pale stem with sleepy eyes
 *                              behind little brass spectacles, a moss shawl, a twig cane and root feet.
 *                              Sporulating: wide awake, glowing gills and spots, spores rising. Overripe:
 *                              a torn, rotting cap sprouting little mushrooms, a cracked lens.
 *   Bramblehorn       56×42  a huge mossy rhinoceros beetle seen from the side, a bark-brown thorny
 *                              horn, little pink mushrooms growing on its shell. Taking Wing: the shell
 *                              flung open over buzzing see-through wings, moss veins glowing, a red eye.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';
import { Pix, hash2 } from './paint';
import { bossAnims, bossSprite, puff } from './bossesBKit';

const o = OUTLINE;

// ── Grandmother Gill ─────────────────────────────────────────────────────────

const GILL_PAL: Record<string, string> = {
  o,
  P: '#8a3a6e',
  Q: '#c05a96',
  p: '#5a2448',
  S: '#f2e8dc',
  g: '#e8d0c0',
  h: '#b8988a',
  T: '#e8dcc0',
  V: '#fff6e0',
  t: '#b4a484',
  w: '#fbfbf2',
  k: '#1a1014',
  Y: '#e0c060',
  M: '#3a1420',
  b: '#e89aa8',
  m: '#3f7a4a',
  n: '#66b86a',
  R: '#8a6a4a',
  D: '#5a4430',
  c: '#7fe0d8',
  C: '#e0fffa',
  r: '#4a1e3c',
  O: '#e08a3a',
  W: '#ffffff',
};

const GILL_PAL_SPORE: Record<string, string> = { ...GILL_PAL, P: '#7e3a78', Q: '#b064a8', p: '#4e2450', g: '#9ee8dc', h: '#4ab0a8' };
const GILL_PAL_RIPE: Record<string, string> = { ...GILL_PAL, P: '#6e2e4e', Q: '#9a4a72', p: '#401a30', g: '#c8b890', h: '#8a7a5a', T: '#d8ccaa', V: '#eee4c8', t: '#a0906c' };

interface GillPose {
  /** 0 dozing, 1 sporulating, 2 overripe. */
  look: number;
  /** Cap raise (+ up), px. */
  lift: number;
  /** Root feet shuffle 0-2. */
  step: number;
  /** 0 sleepy, 1 squint, 2 wide, 3 shut. */
  eyes: number;
  /** 0 smile, 1 sneeze (open), 2 pursed. */
  mouth: number;
  /** Spore drift frame. */
  drift: number;
}

function gill(q: GillPose): string[] {
  const W = 48;
  const H = 52;
  const p = new Pix(W, H);
  const cx = 24;
  const capY = 16 - q.lift;
  const stemTop = capY + 3;
  const stemBot = 47;

  // Root feet.
  const sh = q.step === 1 ? 1 : q.step === 2 ? -1 : 0;
  p.line(cx - 6, stemBot - 2, cx - 13 + sh, 50, 'R').line(cx - 6, stemBot - 1, cx - 12 + sh, 51, 'D');
  p.line(cx - 2, stemBot, cx - 4 - sh, 51, 'R');
  p.line(cx + 3, stemBot, cx + 5 + sh, 51, 'R');
  p.line(cx + 6, stemBot - 2, cx + 13 - sh, 50, 'R').line(cx + 6, stemBot - 1, cx + 12 - sh, 51, 'D');

  // The stem (her body): a bulging pale column.
  for (let y = stemTop; y <= stemBot; y++) {
    const t = (y - stemTop) / (stemBot - stemTop);
    const hw = 8.5 + 2.6 * Math.sin(t * Math.PI * 0.9 + 0.2);
    p.rect(Math.round(cx - hw), y, Math.round(hw * 2), 1, 'T');
  }
  p.shade('T', 'V', 't');
  p.map((x, y, c) => (c === 'T' && x > cx + 5 && y > stemTop + 8 ? 't' : null));

  // Twig cane with a curled handle, held by a little root hand.
  const caneX = cx + 15;
  p.line(caneX, capY + 16, caneX + 1, 50, 'R').line(caneX + 1, capY + 17, caneX + 2, 50, 'D');
  p.set(caneX - 1, capY + 15, 'R').set(caneX - 2, capY + 14, 'R').set(caneX - 2, capY + 13, 'R').set(caneX - 1, capY + 12, 'R').set(caneX, capY + 12, 'R');
  p.line(cx + 9, capY + 21, caneX, capY + 20, 'R').set(caneX, capY + 21, 'D');

  // Moss shawl over the shoulders with a fringe.
  const shY = capY + 19;
  p.ellipse(cx, shY, 13.5, 4.2, 'm');
  p.map((x, y, c) => (c === 'm' && y < shY - 1 && hash2(x, y, 4) > 0.45 ? 'n' : null));
  for (let x = cx - 12; x <= cx + 12; x += 2) p.rect(x, shY + 3, 1, 1 + ((x * 7) % 3 === 0 ? 2 : 1), 'm');

  // The cap: a dome with gills underneath.
  p.ellipse(cx, capY + 3, 20.5, 3.6, 'g');
  p.map((x, y, c) => (c === 'g' && x % 2 === 0 && y > capY + 2 ? 'h' : null));
  const cap = new Pix(W, H);
  cap.ellipse(cx, capY, 22.5, 13, 'P');
  cap.map((x, y, c) => (c === 'P' && y > capY + 2 ? '.' : null));
  if (q.look === 2) {
    // A torn, drooping rim.
    for (const [nx, d] of [
      [4, 3],
      [15, 2],
      [36, 3],
      [43, 2],
    ] as const) {
      for (let y = capY - 1; y <= capY + 2; y++) for (let x = nx - 1; x <= nx + 1; x++) if (y > capY + 2 - d && (x !== nx + 1 || y > capY)) cap.set(x, y, '.');
    }
    cap.rect(8, capY + 3, 3, 2, 'P').rect(30, capY + 3, 2, 3, 'P');
  }
  cap.shade('P', 'Q', 'p');
  cap.ellipse(15, capY - 7, 5, 2.4, 'Q');
  // Spots (glowing once she wakes).
  const spot = q.look === 1 ? 'c' : q.look === 2 ? 'g' : 'S';
  const spots: [number, number, number][] = [
    [13, capY - 4, 2.8],
    [25, capY - 8, 3.4],
    [35, capY - 3, 2.6],
    [6, capY, 1.6],
    [20, capY - 1, 1.8],
    [31, capY - 10, 1.5],
    [41, capY - 1, 1.4],
  ];
  for (const [sx, sy, r] of spots) {
    cap.map((x, y, c) => (c !== '.' && Math.hypot(x + 0.5 - sx, (y + 0.5 - sy) * 1.2) <= r ? spot : null));
    if (q.look === 1) cap.set(sx - 1, sy - 1, 'C');
  }
  if (q.look === 2) {
    // Rot creeping in, little mushrooms sprouting from the cap.
    for (const [rx, ry, rr] of [
      [9, capY - 1, 3.2],
      [21, capY - 6, 2.4],
      [38, capY - 5, 3],
      [29, capY + 1, 2.2],
    ] as const) {
      cap.map((x, y, c) => {
        if (c === '.') return null;
        const d = Math.hypot(x + 0.5 - rx, (y + 0.5 - ry) * 1.3);
        return d <= rr ? 'r' : d <= rr + 1.2 && hash2(x, y, 9) > 0.5 ? 'p' : null;
      });
    }
    cap.set(9, capY + 3, 'r').set(9, capY + 4, 'r').set(38, capY + 3, 'r');
    for (const [mx, my] of [
      [30, capY - 11],
      [11, capY - 8],
    ] as const) {
      cap.rect(mx, my, 1, 3, 'T');
      cap.ellipse(mx + 0.5, my, 2.4, 1.4, 'O');
      cap.set(mx - 1, my - 1, 'S');
    }
  }
  p.paste(cap, 0, 0);
  if (q.look === 2) {
    // A mushroom sprouting from her shawl.
    p.rect(cx - 11, shY - 4, 1, 3, 'T');
    p.ellipse(cx - 10.5, shY - 4, 2.2, 1.3, 'O');
  }

  // Face.
  const ey = capY + 9;
  for (const [ex, lens] of [
    [cx - 5, 0],
    [cx + 5, 1],
  ] as const) {
    // Spectacle rim.
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      p.set(Math.round(ex + Math.cos(a) * 3.6 - 0.5), Math.round(ey + Math.sin(a) * 3.3 - 0.5), 'Y');
    }
    if (q.eyes === 3) {
      p.line(ex - 2, ey, ex + 1, ey, 'k');
    } else {
      const ry = q.eyes === 2 ? 2.4 : q.eyes === 1 ? 1 : 2;
      p.ellipse(ex, ey, 2.3, ry, 'w');
      const pupil = q.look === 1 ? 'c' : 'k';
      p.rect(ex, ey - (q.eyes === 2 ? 1 : 0), 1, q.eyes === 1 ? 1 : 2, pupil).set(ex - 1, ey, pupil);
      if (q.eyes === 0 && q.look !== 1) {
        // Sleepy lids.
        p.line(ex - 2, ey - 1, ex + 1, ey - 1, 't').line(ex - 1, ey - 2, ex, ey - 2, 't');
      }
    }
    if (q.look === 2 && lens === 1) p.line(ex - 1, ey - 3, ex + 2, ey + 1, 'W');
  }
  p.set(cx - 1, ey - 1, 'Y').set(cx, ey - 1, 'Y');
  p.rect(cx - 10, ey + 3, 2, 1, 'b').rect(cx + 9, ey + 3, 2, 1, 'b');
  const my = ey + 5;
  if (q.mouth === 1) {
    p.ellipse(cx, my + 1, 2.6, 2.2, 'M');
  } else if (q.mouth === 2) {
    p.rect(cx - 1, my, 2, 2, 'M');
  } else {
    p.set(cx - 2, my, 'k').line(cx - 1, my + 1, cx + 1, my + 1, 'k').set(cx + 2, my, 'k');
  }

  // Spores drifting up (awake).
  if (q.look >= 1) {
    for (let i = 0; i < 6; i++) {
      const sx = 6 + ((i * 11 + q.drift * 5) % 36);
      const sy = capY - 13 - ((i * 3 + q.drift * 2) % 4) + (i % 2);
      if (sy >= 0) p.set(sx, sy, q.look === 1 ? 'c' : 'g');
    }
    if (q.mouth === 1) puff(p, cx + 6, my + 2, 2, q.look === 1 ? 'c' : 'g', 'C');
  }
  return p.outline('o').rows();
}

function gillFrames(look: number): string[][] {
  const f = (lift: number, step: number, eyes: number, mouth: number, drift: number): string[] => gill({ look, lift, step, eyes, mouth, drift });
  const awake = look === 0 ? 0 : 2;
  return [f(0, 0, awake, 0, 0), f(1, 0, awake, 0, 1), f(1, 1, awake, 0, 2), f(0, 2, awake, 0, 3), f(-2, 0, 1, 2, 1), f(2, 0, 2, 1, 2), f(-3, 0, 1, 2, 3), f(-1, 0, 3, 1, 0)];
}

export const GRANDMOTHER_GILL_SPRITE: SpriteDef = bossSprite('boss.grandmotherGill', 48, 52, 40, GILL_PAL, gillFrames(0), bossAnims(2, 4, 8));
export const GRANDMOTHER_GILL_SPORE_SPRITE: SpriteDef = bossSprite('boss.grandmotherGill.spore', 48, 52, 40, GILL_PAL_SPORE, gillFrames(1), bossAnims(4, 5, 8));
export const GRANDMOTHER_GILL_RIPE_SPRITE: SpriteDef = bossSprite('boss.grandmotherGill.ripe', 48, 52, 40, GILL_PAL_RIPE, gillFrames(2), bossAnims(5, 6, 10));

// ── Bramblehorn ─────────────────────────────────────────────────────────────

const BEETLE_PAL: Record<string, string> = {
  o,
  E: '#2c4a3a',
  F: '#467a5a',
  e: '#172a20',
  H: '#9ad0b0',
  m: '#3f7a4a',
  n: '#66b86a',
  P: '#c05a96',
  Q: '#ff8ad0',
  T: '#efe4c8',
  h: '#6a5238',
  j: '#9a7c56',
  i: '#43321f',
  L: '#1c2a22',
  w: '#f4f6ee',
  k: '#0f0d18',
  x: '#d6f2e2b0',
  v: '#8ab8a0',
  r: '#ff4a3a',
};

const BEETLE_PAL_WING: Record<string, string> = { ...BEETLE_PAL, E: '#2a5a40', F: '#4e9066', e: '#153222', n: '#8aff9a', H: '#c8ffe0' };

interface BeetlePose {
  /** 0 rooting, 1 taking wing. */
  look: number;
  /** Body raise (+ up), px. */
  lift: number;
  /** Leg cycle 0-3. */
  step: number;
  /** Horn tilt: −1 lowered (charge), 0, +1 raised (roar). */
  horn: number;
  /** Wings: 0 folded, 1 out (up), 2 out (down). */
  wings: number;
  /** 0 open, 1 narrowed, 3 shut. */
  eyes: number;
}

function beetle(q: BeetlePose): string[] {
  const W = 56;
  const H = 42;
  const p = new Pix(W, H);
  const by = 25 - q.lift;
  const open = q.wings > 0;

  // Far legs (darker), then wings behind everything.
  const legX = [16, 25, 34];
  for (let i = 0; i < 3; i++) {
    const ph = (q.step + i) % 4;
    const dx = ph === 0 ? -2 : ph === 2 ? 2 : 0;
    const x0 = legX[i]! + 2;
    p.line(x0, by + 4, x0 + dx - 3, by + 10, 'L').line(x0 + dx - 3, by + 10, x0 + dx - 1, 40, 'L');
  }
  if (open) {
    const up = q.wings === 1 ? -3 : 1;
    p.ellipse(13, by - 12 + up, 13, 5, 'x');
    p.ellipse(9, by - 5 + up, 10, 4, 'x');
    p.line(22, by - 8, 2, by - 14 + up, 'v').line(20, by - 6, 1, by - 5 + up, 'v').line(12, by - 11 + up, 6, by - 16 + up, 'v');
  }

  // Abdomen / shell.
  if (!open) {
    p.ellipse(22, by - 3, 17, 12, 'E');
    p.map((x, y, c) => (c === 'E' && y > by + 6 ? '.' : null));
    p.rect(7, by + 5, 30, 2, 'e');
    p.shade('E', 'F', 'e');
    // The elytra seam and a glossy streak.
    p.line(38, by - 11, 26, by - 6, 'e').line(26, by - 6, 7, by + 1, 'e');
    p.line(14, by - 11, 24, by - 13, 'H').line(12, by - 9, 13, by - 10, 'H');
  } else {
    // The exposed ribbed abdomen and the shell lifted high over it.
    p.ellipse(22, by, 15, 7, 'e');
    p.map((x, y, c) => (c === 'e' && y > by + 6 ? '.' : c === 'e' && x % 4 === 0 ? 'L' : null));
    p.ellipse(25, by - 12, 14, 6.5, 'E');
    p.shade('E', 'F', 'e');
    p.line(14, by - 16, 26, by - 18, 'H');
    p.line(38, by - 11, 13, by - 8, 'e');
  }
  // Moss on its back (glowing veins when it takes wing) and little pink mushrooms.
  const top = open ? by - 18 : by - 15;
  for (let x = 10; x <= 34; x++) {
    for (let y = top - 1; y <= top + 4; y++) {
      const c = p.get(x, y);
      if ((c === 'E' || c === 'F' || c === 'H') && p.get(x, y - 2) === '.' && hash2(x, y, 3) > 0.35) p.set(x, y, hash2(x, y, 5) > 0.5 ? 'm' : 'n');
    }
  }
  if (q.look === 1) {
    for (let x = 12; x < 36; x += 5) p.line(x, top + 3, x - 3, top + 9, 'n');
  }
  for (const [mx, h, r] of [
    [17, 4, 2.6],
    [23, 6, 3.2],
    [29, 3, 2.2],
  ] as const) {
    const base = top + 1;
    p.rect(mx, base - h, 1, h, 'T').set(mx + 1, base - h + 1, 'T');
    p.ellipse(mx + 0.5, base - h, r, r * 0.6, 'P');
    p.set(mx - 1, base - h - 1, 'Q').set(mx, base - h - 1, 'Q');
  }

  // Pronotum, head and near legs.
  p.ellipse(40, by - 3, 7.5, 8.5, 'E');
  p.shade('E', 'F', 'e');
  const hx = 46;
  const hy = by + 1 + (q.horn < 0 ? 2 : 0);
  p.ellipse(hx, hy, 6, 5.4, 'E');
  p.set(hx - 3, hy - 4, 'F').set(hx - 2, hy - 4, 'F').set(hx - 1, hy - 4, 'F');
  for (let i = 0; i < 3; i++) {
    const ph = (q.step + i + 2) % 4;
    const dx = ph === 0 ? -2 : ph === 2 ? 2 : 0;
    const x0 = i === 2 ? 42 : legX[i]!;
    p.line(x0, by + 5, x0 + dx + 3, by + 10, 'e').line(x0 + dx + 3, by + 10, x0 + dx + 2, 40, 'e');
    p.set(x0 + dx + 3, 40, 'i');
  }
  // The thorny horn: a thick bark-brown spike curling back, with a forked tip.
  const len = q.horn < 0 ? 17 : 21;
  const th0 = -Math.PI / 2 + (q.horn < 0 ? 0.75 : q.horn > 0 ? -0.05 : 0.22);
  const bend = q.horn < 0 ? 0.45 : 0.75;
  let x = hx + 2;
  let y = hy - 3;
  let forkX = x;
  let forkY = y;
  let forkA = th0;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const th = th0 - bend * t;
    const r = 3.1 - 2.2 * t;
    p.disc(x, y, r, t < 0.3 ? 'i' : t < 0.65 ? 'h' : 'j');
    // A lit back edge and thorns on the front edge.
    p.set(x + Math.cos(th - Math.PI / 2) * (r - 0.5), y + Math.sin(th - Math.PI / 2) * (r - 0.5), 'j');
    if (i === 5 || i === 10) {
      const nx = x + Math.cos(th + Math.PI / 2) * (r + 1);
      const ny = y + Math.sin(th + Math.PI / 2) * (r + 1);
      p.set(nx, ny, 'h').set(nx + Math.cos(th) * 0.8, ny - 0.8, 'j');
    }
    if (i === 12) {
      forkX = x;
      forkY = y;
      forkA = th;
    }
    x += (Math.cos(th) * len) / 16;
    y += (Math.sin(th) * len) / 16;
  }
  p.line(forkX, forkY, forkX + Math.cos(forkA + 1) * 5, forkY + Math.sin(forkA + 1) * 5, 'j');
  // Eye and mandibles.
  if (q.eyes === 3) {
    p.line(hx - 2, hy, hx + 1, hy, 'k');
  } else {
    p.disc(hx - 1, hy, q.eyes === 1 ? 1.3 : 2.1, q.look === 1 ? 'r' : 'w');
    p.rect(hx - 1, hy - (q.eyes === 1 ? 0 : 1), 2, q.eyes === 1 ? 1 : 2, 'k');
    if (q.eyes !== 1) p.set(hx - 2, hy - 1, 'w');
  }
  p.line(hx + 4, hy + 3, hx + 7, hy + 4, 'i').set(hx + 6, hy + 2, 'i');
  if (open) {
    // Wing buzz lines.
    p.set(1, by - 20 + q.wings, 'v').set(3, by - 21 + q.wings, 'v');
  }
  return p.outline('o').rows();
}

function beetleFrames(look: number): string[][] {
  const wOpen = look === 1 ? 1 : 0;
  const f = (lift: number, step: number, horn: number, wings: number, eyes: number): string[] => beetle({ look, lift, step, horn, wings, eyes });
  return [
    f(0, 0, 0, wOpen, 0),
    f(1, 0, 0, wOpen ? 2 : 0, 0),
    f(1, 1, 0, wOpen, 0),
    f(0, 3, 0, wOpen ? 2 : 0, 0),
    f(-2, 2, -1, 0, 1),
    f(1, 0, 1, wOpen ? 1 : 0, 0),
    f(3, 1, 0, 1, 1),
    f(-1, 2, -1, 0, 3),
  ];
}

const BEETLE_ANIMS = { ...bossAnims(3, 8, 14, 6), slam: { frames: [4], fps: 1, loop: true } };
const BEETLE_WING_ANIMS = {
  ...BEETLE_ANIMS,
  idle: { frames: [0, 1], fps: 14, loop: true },
  move: { frames: [2, 3], fps: 16, loop: true },
  charge: { frames: [2, 3], fps: 18, loop: true },
  air: { frames: [6, 1], fps: 16, loop: true },
};

export const BRAMBLEHORN_SPRITE: SpriteDef = bossSprite('boss.bramblehorn', 56, 42, 30, BEETLE_PAL, beetleFrames(0), BEETLE_ANIMS);
export const BRAMBLEHORN_WING_SPRITE: SpriteDef = bossSprite('boss.bramblehorn.wing', 56, 42, 30, BEETLE_PAL_WING, beetleFrames(1), BEETLE_WING_ANIMS);
