/**
 * Items pack A — costume layers (CostumeDef sprites, ARCHITECTURE §5) for the major items and the five
 * set transformations (Stormcaller, Mothkin, Clockwork, Sporeling, Waxen). All original.
 *
 * Anchoring: a costume sprite is drawn with its (anchorX, anchorY) on Wren's feet (her own anchor is
 * (7, 15) on a 14×16 frame). So with a 14-wide sprite anchored at (7, 19) costume row r lines up with
 * Wren's row r − 4 (hats reach 4 rows above the hood); wider sprites shift x by (anchorX − 7).
 * 'dir' frames: 0 facing down, 1 up, 2 side (facing right; mirrored for left). 'anim' frames cycle.
 * Wren's hood top sits on her row 0 (x 4-9 facing down, x 3-8 sideways); her eyes on rows 5-7.
 */

import type { SpriteDef } from '../../sim/types';
import { ellipse, grid, o, outline, put, rect, rowsOf, stamp, type Grid } from './itemsA';

/** A frame drawn on a fresh w×h grid. */
function frame(w: number, h: number, draw: (g: Grid) => void): string[] {
  const g = grid(w, h);
  draw(g);
  return rowsOf(g);
}

function costume(
  id: string,
  w: number,
  h: number,
  anchorX: number,
  anchorY: number,
  palette: Record<string, string>,
  frames: string[][],
): SpriteDef {
  return { id: `costume.${id}`, w, h, anchorX, anchorY, palette: { o, ...palette }, frames };
}

// ── Item costumes ───────────────────────────────────────────────────────────────

/** Brass Kite Key: a little red-and-yellow kite flying above the hood on its string (bobs). */
function kiteFrame(bob: number, tail: number): string[] {
  return frame(14, 22, (g) => {
    const y = bob;
    stamp(g, 9, y, ['..o..', '.oRo.', 'oRRYo', '.oYo.', '..o..']);
    // String down to the hood.
    put(g, 11, y + 5, 's');
    put(g, 10, y + 6, 's');
    if (y === 0) put(g, 10, 7, 's');
    // Tail bows flicking in the wind.
    put(g, 12 + tail, y + 5, 't');
    put(g, 13 - tail, y + 6, 't');
  });
}

export const COSTUME_KITE = costume('brass-kite-key', 14, 22, 7, 21, { R: '#e05a4a', Y: '#ffcf57', s: '#d8d0b8', t: '#ff8ad0' }, [
  kiteFrame(0, 0),
  kiteFrame(1, 1),
]);

/** Static Cling: a purple balloon bobbing on a string tied to Wren, crackling. */
function balloonFrame(bob: number, spark: number): string[] {
  return frame(18, 22, (g) => {
    ellipse(g, 3, 3.6 + bob, 2.6, 3.1, 'B');
    put(g, 1, 2 + bob, 'h');
    put(g, 1, 3 + bob, 'h');
    put(g, 2, 1 + bob, 'h');
    put(g, 4, 5 + bob, 'b');
    put(g, 3, 6 + bob, 'b');
    outline(g);
    // String down to her side (her x 0 is this sprite's x 4).
    put(g, 3, 8 + bob, 's');
    put(g, 3, 9 + bob, 's');
    put(g, 4, 10 + bob, 's');
    put(g, 4, 11, 's');
    put(g, 4, 12, 's');
    // Static crackles.
    if (spark === 0) {
      put(g, 7, 1, 'y');
      put(g, 6, 2, 'y');
      put(g, 0, 8, 'y');
    } else {
      put(g, 7, 4, 'y');
      put(g, 6, 5, 'y');
      put(g, 1, 0, 'y');
    }
  });
}

export const COSTUME_STATIC_CLING = costume(
  'static-cling',
  18,
  22,
  11,
  21,
  { B: '#8a6ad8', b: '#5a3a98', h: '#d8c8ff', s: '#d8d0b8', y: '#fff27a' },
  [balloonFrame(0, 0), balloonFrame(1, 1)],
);

/** Feathery Antennae: two feathery moth antennae on the hood (they twitch). */
export const COSTUME_ANTENNAE = costume('feathery-antennae', 14, 20, 7, 19, { F: '#e8dcc0', a: '#8a6a4a' }, [
  ['.Fa........aF.', '..Fa......aF..', '...Fa....aF...', '.....a..a.....', ...emptyRows(14, 16)],
  ['..aF......Fa..', '..Fa......aF..', '...Fa....aF...', '.....a..a.....', ...emptyRows(14, 16)],
]);

function emptyRows(w: number, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push('.'.repeat(w));
  return out;
}

/** Clockwork Heart: a brass wind-up key in Wren's back, peeking over the hood and slowly turning. */
export const COSTUME_WINDUP_KEY = costume('clockwork-heart', 14, 20, 7, 19, { K: '#e0b040', k: '#9a6a1c', h: '#fff4a0' }, [
  ['...oo....oo...', '..oKKo..oKKo..', '..oKhKooKKko..', '...oKKKKKKo...', '....ooKKoo....', ...emptyRows(14, 15)],
  ['......oo......', '.....oKKo.....', '.....oKko.....', '.....oKKo.....', '......KK......', ...emptyRows(14, 15)],
]);

/** Fairy Ring: tiny red mushrooms in a ring round Wren's feet (back half behind her, front half in front). */
function ringHalf(front: boolean): string[] {
  return frame(23, 8, (g) => {
    const mush = (x: number, y: number): void => {
      put(g, x - 1, y, 'R');
      put(g, x, y, 'W');
      put(g, x + 1, y, 'R');
      put(g, x, y - 1, 'R');
      put(g, x, y + 1, 'S');
    };
    if (front) {
      mush(3, 5);
      mush(11, 6);
      mush(19, 5);
    } else {
      mush(3, 2);
      mush(11, 1);
      mush(19, 2);
    }
    outline(g);
  });
}

const RING_PALETTE = { R: '#d8403a', W: '#fff4e0', S: '#f0e0c0' };
export const COSTUME_FAIRY_RING_BACK = costume('fairy-ring.back', 23, 8, 11, 4, RING_PALETTE, [ringHalf(false)]);
export const COSTUME_FAIRY_RING_FRONT = costume('fairy-ring.front', 23, 8, 11, 4, RING_PALETTE, [ringHalf(true)]);

/** Candelabra: a little three-flame candelabra held at Wren's side (down, up, side). */
function candelabraAt(x: number): string[] {
  return frame(20, 16, (g) => {
    stamp(g, x, 4, ['F.F.F', 'W.W.W', 'W.W.W', 'KKKKK', '..K..', '..K..', '.KKK.']);
    outline(g);
    put(g, x, 3, 'H');
    put(g, x + 2, 3, 'H');
    put(g, x + 4, 3, 'H');
  });
}

// Her x 0 is this sprite's x 3: down → her right side (screen right), up → the other side, side → in front.
export const COSTUME_CANDELABRA = costume(
  'candelabra',
  20,
  16,
  10,
  15,
  { F: '#ffcf57', H: '#fffbe8', W: '#f3ead0', K: '#e0b040' },
  [candelabraAt(15), candelabraAt(0), candelabraAt(13)],
);

/** Gold Star Badge: a blue rosette with a gold star pinned on the coat (down, up = hidden, side). */
function rosetteAt(x: number | null): string[] {
  return frame(14, 16, (g) => {
    if (x === null) return;
    stamp(g, x, 9, ['.B.', 'BYB', '.B.', 'b.b']);
  });
}

export const COSTUME_GOLD_STAR = costume('gold-star-badge', 14, 16, 7, 15, { B: '#3f7fbf', b: '#264e7a', Y: '#fff4b0' }, [
  rosetteAt(3),
  rosetteAt(null),
  rosetteAt(9),
]);

// ── Set transformations ─────────────────────────────────────────────────────────

/**
 * Stormcaller — a cape of static. The back layer hangs behind Wren (flaring past her sides and hem
 * when she faces down, trailing behind her when she runs sideways); the front layer is the cape over
 * her back when she faces away, plus a lightning clasp at the collar when she faces you.
 * Sprite x = her x + 3.
 */
function capeDown(g: Grid): void {
  const rows: [number, number, number][] = [
    [8, 1, 12],
    [9, 0, 13],
    [10, -1, 14],
    [11, -1, 14],
    [12, -1, 14],
    [13, -2, 15],
    [14, -2, 15],
  ];
  for (const [y, a, b] of rows) rect(g, a + 3, y, b + 3, y, 'C');
  // A zigzag of lightning along the hem.
  for (let x = 1; x <= 18; x++) put(g, x, x % 2 === 0 ? 14 : 13, x % 4 === 1 ? 'y' : 'c');
  outline(g);
}

function capeSide(g: Grid): void {
  const rows: [number, number, number][] = [
    [8, 0, 3],
    [9, -1, 3],
    [10, -2, 3],
    [11, -2, 3],
    [12, -3, 3],
    [13, -3, 2],
    [14, -3, 1],
  ];
  for (const [y, a, b] of rows) rect(g, a + 3, y, b + 3, y, 'C');
  put(g, 1, 11, 'y');
  put(g, 2, 12, 'y');
  put(g, 1, 13, 'y');
  put(g, 0, 14, 'c');
  outline(g);
}

function capeUp(g: Grid): void {
  const rows: [number, number, number][] = [
    [8, 1, 12],
    [9, 0, 13],
    [10, 0, 13],
    [11, 0, 13],
    [12, -1, 14],
    [13, -1, 14],
    [14, -2, 15],
  ];
  for (const [y, a, b] of rows) rect(g, a + 3, y, b + 3, y, 'C');
  // A big lightning bolt emblem on the back.
  stamp(g, 8, 9, ['..yy', '.yy.', 'yyyy', '.yy.', 'yy..']);
  for (let x = 1; x <= 18; x++) if (g[14]![x] === 'C' && x % 2 === 0) put(g, x, 14, 'c');
  outline(g);
}

const CAPE_PALETTE = { C: '#2a3a78', c: '#4a6ad0', y: '#fff27a' };
export const COSTUME_STORM_CAPE_BACK = costume('set.stormcaller.cape', 20, 16, 10, 15, CAPE_PALETTE, [
  frame(20, 16, capeDown),
  frame(20, 16, () => {}),
  frame(20, 16, capeSide),
]);
export const COSTUME_STORM_CAPE_FRONT = costume('set.stormcaller.clasp', 20, 16, 10, 15, CAPE_PALETTE, [
  frame(20, 16, (g) => {
    put(g, 9, 9, 'y');
    put(g, 10, 9, 'y');
    put(g, 10, 10, 'y');
  }),
  frame(20, 16, capeUp),
  frame(20, 16, () => {}),
]);

/**
 * Mothkin — big dusty moth wings on Wren's back (behind her; they flap). Sprite x = her x + 6.
 */
/** A wing lobe: pale in the middle, a dusky band round the edge. */
function wingLobe(g: Grid, cx: number, cy: number, rx: number, ry: number, inner: string, rim: string): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      const d = dx * dx + dy * dy;
      if (d <= 1) g[y]![x] = d < 0.5 ? inner : rim;
    }
  }
}

function wingsFrame(up: boolean): string[] {
  return frame(26, 16, (g) => {
    const fy = up ? 5.2 : 7.4;
    const fry = up ? 3.6 : 2.9;
    const hy = up ? 10.8 : 11.6;
    // Where the wings meet her back (hidden behind her body).
    rect(g, 7, 7, 18, 11, 'w');
    for (const side of [0, 1]) {
      const cx = side === 0 ? 4 : 22;
      const hx = side === 0 ? 6 : 20;
      wingLobe(g, hx, hy, 3, 2.2, 'w', 'd');
      wingLobe(g, cx, fy, 4.1, fry, 'W', 'w');
      // A golden eyespot on each forewing.
      const ex = side === 0 ? 3 : 22;
      const ey = Math.round(fy - 1);
      put(g, ex, ey, 'E');
      put(g, ex, ey + 1, 'E');
      put(g, side === 0 ? ex + 1 : ex - 1, ey, 'E');
      put(g, side === 0 ? ex + 1 : ex - 1, ey + 1, 'e');
    }
    outline(g);
  });
}

export const COSTUME_MOTH_WINGS = costume(
  'set.mothkin.wings',
  26,
  16,
  13,
  15,
  { W: '#efe4cc', w: '#b8a888', d: '#7a6a58', E: '#ffd878', e: '#5e3a80' },
  [wingsFrame(true), wingsFrame(false)],
);

/** Clockwork — a ring of brass gear teeth floating over the hood like a halo (it turns). */
function haloFrame(turn: number): string[] {
  return frame(14, 20, (g) => {
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 14; x++) {
        const dx = (x + 0.5 - 7) / 5.6;
        const dy = (y + 0.5 - 2.2) / 1.7;
        const d = dx * dx + dy * dy;
        if (d <= 1 && d > 0.3) put(g, x, y, y + 0.5 > 2.2 ? 'K' : 'k');
      }
    }
    // Teeth: alternating bright studs round the rim, shifted one step per frame.
    for (let x = 1; x < 13; x++) {
      if ((x + turn) % 2 !== 0) continue;
      if (g[0]![x] !== '.' || g[1]![x] === 'k') put(g, x, 0, 'y');
      if (g[4]![x] === 'K' || g[3]![x] === 'K') put(g, x, 4, 'y');
    }
    outline(g);
  });
}

export const COSTUME_GEAR_HALO = costume('set.clockwork.halo', 14, 20, 7, 19, { K: '#e0b040', k: '#9a6a1c', y: '#fff4a0' }, [
  haloFrame(0),
  haloFrame(1),
]);

/** Sporeling — a big red toadstool cap sitting on the hood (down, up, side). Sprite x = her x + 1. */
function capFrame(shift: number): string[] {
  return frame(16, 20, (g) => {
    const cx = 7.5 + shift;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - cx) / 6.8;
        const dy = (y + 0.5 - 6) / 5.6;
        if (dx * dx + dy * dy <= 1) put(g, x, y, 'R');
      }
    }
    // Shade the right side, gills underneath, white spots on top.
    for (let y = 0; y < 6; y++) for (let x = 0; x < 16; x++) if (g[y]![x] === 'R' && x + 0.5 - cx > 3.5) put(g, x, y, 'r');
    rect(g, Math.round(cx - 5.5), 5, Math.round(cx + 4.5), 5, 'g');
    put(g, Math.round(cx - 3.5), 2, 'W');
    put(g, Math.round(cx - 2.5), 2, 'W');
    put(g, Math.round(cx + 0.5), 1, 'W');
    put(g, Math.round(cx + 2.5), 3, 'W');
    put(g, Math.round(cx - 4.5), 4, 'W');
    put(g, Math.round(cx - 0.5), 3, 'W');
    outline(g);
  });
}

export const COSTUME_TOADSTOOL_CAP = costume(
  'set.sporeling.cap',
  16,
  20,
  8,
  19,
  { R: '#d8403a', r: '#9a2424', W: '#fff4e0', g: '#f0d8c0' },
  [capFrame(0), capFrame(0), capFrame(-1)],
);

/** Waxen — a gold band on the hood with three little candles; the flames flicker. */
function crownFrame(flicker: number): string[] {
  return frame(14, 20, (g) => {
    rect(g, 2, 5, 11, 5, 'K');
    rect(g, 2, 6, 11, 6, 'k');
    put(g, 4, 5, 'R');
    put(g, 9, 5, 'R');
    rect(g, 3, 3, 3, 4, 'W');
    rect(g, 6, 2, 7, 4, 'W');
    rect(g, 10, 3, 10, 4, 'W');
    put(g, 7, 4, 'w');
    put(g, 3, 2, 'n');
    put(g, 7, 1, 'n');
    put(g, 10, 2, 'n');
    outline(g);
    // Flames (no outline: they glow).
    put(g, 3, 1, 'F');
    put(g, 7, 0, 'F');
    put(g, 10, 1, 'F');
    put(g, 3 + flicker, 0, 'H');
    put(g, 6 + flicker, 0, 'H');
    put(g, 10 - flicker, 0, 'H');
  });
}

export const COSTUME_CANDLE_CROWN = costume(
  'set.waxen.crown',
  14,
  20,
  7,
  19,
  { K: '#e0b040', k: '#9a6a1c', R: '#e0404a', W: '#f3ead0', w: '#c8b890', n: '#3a1a10', F: '#ffcf57', H: '#fffbe8' },
  [crownFrame(0), crownFrame(1)],
);

/** Every costume sprite of this pack (the tests validate them all). */
export const ITEMS_A_COSTUME_SPRITES: readonly SpriteDef[] = [
  COSTUME_KITE,
  COSTUME_STATIC_CLING,
  COSTUME_ANTENNAE,
  COSTUME_WINDUP_KEY,
  COSTUME_FAIRY_RING_BACK,
  COSTUME_FAIRY_RING_FRONT,
  COSTUME_CANDELABRA,
  COSTUME_GOLD_STAR,
  COSTUME_STORM_CAPE_BACK,
  COSTUME_STORM_CAPE_FRONT,
  COSTUME_MOTH_WINGS,
  COSTUME_GEAR_HALO,
  COSTUME_TOADSTOOL_CAP,
  COSTUME_CANDLE_CROWN,
];
