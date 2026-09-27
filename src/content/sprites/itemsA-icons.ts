/**
 * Items pack A — 14×14 item icons (all original). Dark-but-cute: 1 px dark outline, a highlight and a
 * shade per material. Round things use the raster helpers in ./itemsA (clean curves, consistent light
 * from the upper left); the rest is hand-drawn. Familiar items use `iconFrom` (sprite on a glow disc)
 * like the starter familiars.
 */

import type { SpriteDef } from '../../sim/types';
import { iconFrom } from './attack';
import {
  drawIcon,
  ellipse,
  gear,
  icon,
  line,
  outline,
  polygon,
  put,
  rect,
  shade,
  stamp,
  starPoints,
  type Grid,
} from './itemsA';
import { BLINKBUG_SPRITE, GLOAMWING_SPRITE, TALLOW_TOT_SPRITE, TIN_CUCKOO_SPRITE, TODDLECAP_SPRITE } from './itemsA-familiars';

/** Recolours the cells of `g` that hold one of `from` when (x, y) passes `test`. */
function paintIf(g: Grid, from: string, to: string, test: (x: number, y: number) => boolean): void {
  for (let y = 0; y < g.length; y++) {
    for (let x = 0; x < g[y]!.length; x++) if (from.includes(g[y]![x]!) && test(x, y)) g[y]![x] = to;
  }
}

// ── Stormcaller (lightning) ────────────────────────────────────────────────────

/** Brass Kite Key: an old brass key dangling from a kite string, sparks crackling round it. */
export const ICON_BRASS_KITE_KEY = icon(
  'brass-kite-key',
  { s: '#d8d0b8', K: '#e0b04a', k: '#9a6a24', h: '#fff0a8', y: '#fff27a', Y: '#ffffff' },
  [
    '......s.......',
    '.......s...y..',
    '......s...yY..',
    '.....ooo...y..',
    '....oKhKo.....',
    '...oKo.oKo....',
    '...oKo.oko....',
    '....oKKko.....',
    '.y...oKo......',
    'yYy..oKo......',
    '.y...oKKKo....',
    '.....oKko.....',
    '.....oKKko....',
    '......ooo.....',
  ],
);

/** Wool Mitten: a fuzzy red mitten, crackling with static. */
export const ICON_WOOL_MITTEN = icon(
  'wool-mitten',
  { R: '#d8504a', r: '#8a2a2a', h: '#ff9a8a', W: '#f3efe0', w: '#c8c0a8', y: '#fff27a' },
  [
    'y.........y...',
    '.y..oooo...y..',
    '...oRRRRo.....',
    '..oRhRRRRo.o..',
    '..oRhRRRRooRo.',
    '..oRRRRRRoRRo.',
    '..oRRRRRRRRro.',
    '..oRRRRRRRrro.',
    '..oRRRRRRrrro.',
    '...oRRRRrrro..',
    '..oWWWWWWWwo..',
    '..oWwWwWwWwo..',
    '..oooooooooo..',
    '.y..........y.',
  ],
);

/** Crackle Candy: a wrapped sweet that fizzes and pops. */
export const ICON_CRACKLE_CANDY = icon(
  'crackle-candy',
  { P: '#ff7ad9', p: '#b04a98', C: '#7fd8ff', c: '#3a8ac0', h: '#e8fbff', y: '#fff27a' },
  [
    '.....y....y...',
    '..y....y......',
    '.........y....',
    '.o...oooo...o.',
    'oPo.oChhCo.oPo',
    'oPPoChCCCCoPPo',
    'oPpPCCCCCCPPpo',
    'oPPoCCCCCcoPPo',
    'oPo.oCCCco.oPo',
    '.o...oooo...o.',
    '..............',
    '...y.....y....',
    '.......y......',
    '..............',
  ],
);

/** Falling Barometer: a brass dial whose needle has dropped to STORMY. */
export const ICON_FALLING_BAROMETER = drawIcon(
  'falling-barometer',
  { K: '#d8a84a', k: '#8a6424', h: '#fff0a8', W: '#f3efe0', w: '#9a948a', R: '#e0404a', b: '#6fc8ff', n: '#3a3040' },
  (g) => {
    ellipse(g, 6.5, 6, 5.5, 5.5, 'K');
    ellipse(g, 6.5, 6, 4.1, 4.1, 'W');
    shade(g, 6.5, 6, 5.5, 'K', 'h', 'k');
    // Tick marks round the face.
    put(g, 6, 3, 'w');
    put(g, 3, 4, 'w');
    put(g, 9, 4, 'w');
    put(g, 3, 7, 'w');
    put(g, 9, 7, 'w');
    // The needle, pivoting in the middle and pointing down-left.
    put(g, 6, 6, 'n');
    line(g, 5, 7, 4, 8, 'R');
    outline(g);
    // Raindrops.
    put(g, 2, 13, 'b');
    put(g, 10, 13, 'b');
    put(g, 12, 12, 'b');
  },
);

/** Blinkbug: the familiar on a glow disc. */
export const ICON_BLINKBUG = iconFrom(BLINKBUG_SPRITE, 'item.blinkbug', '#3a5078');

/** Static Cling: a purple balloon, rubbed until it crackles (and clings). */
export const ICON_STATIC_CLING = drawIcon(
  'static-cling',
  { B: '#8a6ad8', b: '#5a3a98', h: '#d8c8ff', s: '#d8d0b8', y: '#fff27a' },
  (g) => {
    ellipse(g, 6.5, 5.8, 4.5, 4.7, 'B');
    shade(g, 6.5, 5.8, 4.7, 'B', 'h', 'b');
    put(g, 6, 10, 'b');
    outline(g);
    put(g, 6, 12, 's');
    put(g, 7, 13, 's');
    // Crackles.
    put(g, 12, 2, 'y');
    put(g, 13, 3, 'y');
    put(g, 12, 4, 'y');
    put(g, 1, 7, 'y');
    put(g, 0, 8, 'y');
    put(g, 1, 9, 'y');
    put(g, 11, 11, 'y');
    put(g, 2, 1, 'y');
  },
);

// ── Mothkin (moths & wings) ────────────────────────────────────────────────────

/** Feathery Antennae: a hairband with two feathery moth antennae. */
export const ICON_FEATHERY_ANTENNAE = icon(
  'feathery-antennae',
  { F: '#e8dcc0', a: '#8a6a4a', H: '#8a5ab0', h: '#c09ae0', d: '#5e3a80' },
  [
    '.o..........o.',
    'oFo........oFo',
    'oFFo......oFFo',
    '.oaFo....oFao.',
    '..oaFo..oFao..',
    '...oao..oao...',
    '...oao..oao...',
    '....oa..ao....',
    '...oooooooo...',
    '..ohHHHHHHHo..',
    '.ohHHHHHHHHdo.',
    '.oHHddddddHdo.',
    '..oo......oo..',
    '..............',
  ],
);

/** Pouch of Wing Dust: a little drawstring pouch spilling shimmering moth dust. */
export const ICON_WING_DUST_POUCH = icon(
  'wing-dust-pouch',
  { B: '#9a7ab8', b: '#5e4a80', h: '#d0b8f0', t: '#e0b040', d: '#f8f0c8', D: '#ffd878' },
  [
    '..........d...',
    '.....oo.D...d.',
    '....oddo..d...',
    '...otttto.D...',
    '...oBhBBo.....',
    '..oBhBBBBo.d..',
    '.oBBBBBBBBo...',
    '.oBhBBBBBbo.D.',
    '.oBBBBBBbbo...',
    '.oBBBBBbbbo.d.',
    '..obbbbbbo....',
    '...oooooo..d..',
    '.d.......D....',
    '....d.........',
  ],
);

/** Porch Bulb: a warm light bulb with two moths that can't stay away. */
export const ICON_PORCH_BULB = icon(
  'porch-bulb',
  { G: '#fff4b0', g: '#e8c060', h: '#ffffff', M: '#9aa6c0', m: '#5e6a88', W: '#e8dcc0', k: '#6a5a48' },
  [
    '.....oooo..WkW',
    '...ooGGGGoo.k.',
    '..oGhhGGGGGo..',
    '..oGhGGGGGgo..',
    '..oGGGGGGGgo..',
    '..oGGGGGGggo..',
    '...oGGGGggo...',
    '....oGGggo....',
    'WkW.oMMMmo....',
    '.k..ommmmo....',
    '....oMMMmo....',
    '.....ommo.....',
    '......oo......',
    '..............',
  ],
);

/** Eyespot Charm: a moth-wing pendant with a big staring eyespot (it spooks things). */
export const ICON_EYESPOT_CHARM = drawIcon(
  'eyespot-charm',
  { W: '#e8dcc0', w: '#b8a888', d: '#7a6a58', E: '#ffd878', e: '#e8862e', k: '#1d1830', H: '#ffffff', K: '#e0b040' },
  (g) => {
    ellipse(g, 6.5, 7.6, 5.3, 4.6, 'W');
    shade(g, 6.5, 7.6, 5.3, 'W', 'W', 'w', -1, 0.45);
    // Scalloped lower edge.
    put(g, 3, 11, 'd');
    put(g, 6, 12, 'd');
    put(g, 9, 11, 'd');
    // The eyespot: dark ring, gold ring, dark pupil, a glint.
    ellipse(g, 6.5, 7.4, 3.3, 3.0, 'k');
    ellipse(g, 6.5, 7.4, 2.5, 2.2, 'E');
    put(g, 7, 8, 'e');
    put(g, 5, 8, 'e');
    ellipse(g, 6.5, 7.4, 1.3, 1.2, 'k');
    put(g, 6, 6, 'H');
    outline(g);
    // The little brass loop it hangs from.
    stamp(g, 5, 0, ['.KK.', 'K..K']);
  },
);

/** Gloamwing: the familiar on a glow disc. */
export const ICON_GLOAMWING = iconFrom(GLOAMWING_SPRITE, 'item.gloamwing', '#4a4466');

/** Snug Cocoon: a silky cocoon on a thread, with a little heart. */
export const ICON_SNUG_COCOON = drawIcon(
  'snug-cocoon',
  { C: '#e8dcc0', h: '#fffbe8', c: '#b8a888', s: '#d8d0b8', R: '#e0515a', r: '#ff9aa0' },
  (g) => {
    ellipse(g, 6.5, 7.5, 3.6, 5.2, 'C');
    shade(g, 6.5, 7.5, 4.4, 'C', 'h', 'c');
    // Silk wrapping: diagonal bands.
    paintIf(g, 'Ch', 'c', (x, y) => (x + 2 * y) % 5 === 0);
    outline(g);
    put(g, 6, 0, 's');
    stamp(g, 9, 9, ['.o.o.', 'oRoro', 'oRRRo', '.oRo.', '..o..']);
  },
);

// ── Clockwork (gears & springs) ────────────────────────────────────────────────

/** Pocket Metronome: tick… tock… tick… */
export const ICON_POCKET_METRONOME = icon(
  'pocket-metronome',
  { W: '#b8703a', w: '#7a4a24', h: '#e0a060', M: '#c9d3e6', F: '#f3efe0', K: '#ffcf57', s: '#8a94b0' },
  [
    '.s....oo....s.',
    's....oMMo....s',
    '.s...oMMo...s.',
    '....ooMMoo....',
    '....oWMMWo....',
    '...ooKKKKoo...',
    '...oWoKKoWo...',
    '...oWWMMWWo...',
    '..oWhWMMWWwo..',
    '..oWhWMMWwwo..',
    '.oWWWWooWwwwo.',
    '.oFFFFFFFFFFo.',
    '.oooooooooooo.',
    '..............',
  ],
);

/** Loose Mainspring: a clock spring that has come unwound (and wants to boing). */
export const ICON_LOOSE_MAINSPRING = drawIcon(
  'loose-mainspring',
  { S: '#e0b040', s: '#9a6a1c', h: '#fff4a0', w: '#c8d0e0' },
  (g) => {
    // The loose end curls away bottom-left, then the spiral winds inward (top/left lit, bottom/right shaded).
    line(g, 1, 12, 3, 10, 's');
    line(g, 3, 10, 3, 3, 'S');
    line(g, 3, 3, 10, 3, 'h');
    line(g, 10, 3, 10, 10, 's');
    line(g, 10, 10, 5, 10, 's');
    line(g, 5, 10, 5, 5, 'S');
    line(g, 5, 5, 8, 5, 'S');
    line(g, 8, 5, 8, 8, 's');
    line(g, 8, 8, 7, 8, 's');
    outline(g);
    put(g, 12, 0, 'w');
    put(g, 13, 1, 'w');
    put(g, 12, 2, 'w');
  },
);

/** Tin Cuckoo: the familiar on a glow disc. */
export const ICON_TIN_CUCKOO = iconFrom(TIN_CUCKOO_SPRITE, 'item.tin-cuckoo', '#4a4a5e');

/** Ratchet Wrench: a box-end ratchet with a red grip. */
export const ICON_RATCHET_WRENCH = icon(
  'ratchet-wrench',
  { M: '#c9d3e6', m: '#7d89a8', h: '#ffffff', r: '#e0404a', R: '#ff8a80', d: '#9a2430' },
  [
    '.........oooo.',
    '........ohMMmo',
    '........oMoomo',
    '........oMoomo',
    '.......oMMmmo.',
    '......ohMoo...',
    '.....oMmo.....',
    '....oMmo......',
    '...oRro.......',
    '..oRrdo.......',
    '.oRrdo........',
    'oRrdo.........',
    'ordo..........',
    '.oo...........',
  ],
);

/** Clockwork Heart: a red heart with a brass wheel ticking inside and a wind-up key on top. */
export const ICON_CLOCKWORK_HEART = icon(
  'clockwork-heart',
  { R: '#e0515a', r: '#9a2430', h: '#ff9aa0', K: '#e0b040', k: '#9a6a1c', y: '#fff4a0' },
  [
    '....oKyKo.....',
    '..ooo.K.ooo...',
    '.oRhRoKoRRRo..',
    'oRhRRRoRRRRro.',
    'oRRRoKKKoRRro.',
    'oRRoKyKKkoRro.',
    'oRRoKKoKkoRro.',
    '.oRooKkkooro..',
    '..oRoooooro...',
    '...oRRRRro....',
    '....oRRro.....',
    '.....oro......',
    '......o.......',
    '..............',
  ],
);

/** Whirring Cog: a brass cog spinning so fast it whistles. */
export const ICON_WHIRRING_COG = drawIcon(
  'whirring-cog',
  { K: '#e0b040', k: '#9a6a1c', h: '#fff4a0', w: '#c8d0e0' },
  (g) => {
    gear(g, 6.5, 6.5, 5.1, 1.6, 8, 0.2, 'K', 1.5);
    shade(g, 6.5, 6.5, 5.1, 'K', 'h', 'k', -0.45, 0.4);
    outline(g);
    // Motion swooshes.
    put(g, 0, 2, 'w');
    put(g, 1, 1, 'w');
    put(g, 2, 0, 'w');
    put(g, 13, 11, 'w');
    put(g, 12, 12, 'w');
    put(g, 11, 13, 'w');
  },
);

// ── Sporeling (mushrooms) ──────────────────────────────────────────────────────

/** Earthstar: a round spore sac sitting on a star of split skin, coughing up a cloud of spores. */
export const ICON_EARTHSTAR = drawIcon(
  'earthstar',
  { P: '#e8d8b0', h: '#fff8e0', p: '#b09a70', d: '#8a7a50', S: '#9a6a3a', s: '#5a3a20', g: '#b8e070', G: '#7ea848' },
  (g) => {
    // The star of rays it sits on (a squashed 7-pointed star, seen from a little above).
    const pts: [number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i * Math.PI) / 7 + 0.22;
      const r = i % 2 === 0 ? 6.7 : 2.5;
      pts.push([6.5 + Math.cos(a) * r, 9.8 + Math.sin(a) * r * 0.58]);
    }
    polygon(g, pts, 'S');
    paintIf(g, 'S', 's', (_x, y) => y >= 11);
    // The spore sac.
    ellipse(g, 6.5, 6.8, 3.4, 3.1, 'P');
    shade(g, 6.5, 6.8, 3.4, 'P', 'h', 'p');
    put(g, 5, 7, 'd');
    put(g, 8, 6, 'd');
    put(g, 7, 8, 'd');
    outline(g);
    put(g, 6, 3, 'o');
    stamp(g, 3, 0, ['.g..G.g', 'G.g...G']);
  },
);

/** Foxfire Cap: a soft blue-green glowing mushroom. */
export const ICON_GLOWCAP = drawIcon(
  'foxfire-cap',
  { G: '#7ef0d8', h: '#e8fff8', g: '#3aa8a0', S: '#e8f0d8', s: '#a8b8a0', y: '#d8fff0' },
  (g) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 14; x++) {
        const dx = (x + 0.5 - 6.5) / 5.6;
        const dy = (y + 0.5 - 7) / 5.2;
        if (dx * dx + dy * dy <= 1) put(g, x, y, 'G');
      }
    }
    shade(g, 6.5, 5, 5.6, 'G', 'h', 'g', -0.6, 0.55);
    rect(g, 1, 6, 11, 6, 'g');
    rect(g, 5, 7, 8, 11, 'S');
    rect(g, 8, 7, 8, 11, 's');
    put(g, 4, 3, 'y');
    put(g, 8, 3, 'y');
    put(g, 9, 5, 'y');
    put(g, 3, 5, 'y');
    outline(g);
    put(g, 0, 1, 'y');
    put(g, 13, 2, 'y');
    put(g, 12, 10, 'y');
    put(g, 1, 11, 'y');
  },
);

/** Fairy Ring: a ring of tiny red mushrooms around a glimmer of something magic. */
export const ICON_FAIRY_RING = drawIcon(
  'fairy-ring',
  { R: '#d8403a', W: '#fff4e0', S: '#f0e0c0', y: '#fff27a', Y: '#ffffff', g: '#4f7447' },
  (g) => {
    const mush = (x: number, y: number): void => {
      put(g, x, y - 1, 'R');
      put(g, x - 1, y, 'R');
      put(g, x, y, 'W');
      put(g, x + 1, y, 'R');
      put(g, x, y + 1, 'S');
    };
    mush(3, 4);
    mush(10, 4);
    mush(2, 8);
    mush(11, 8);
    mush(4, 11);
    mush(9, 11);
    outline(g);
    put(g, 6, 7, 'y');
    put(g, 7, 7, 'Y');
    put(g, 7, 6, 'y');
    put(g, 6, 8, 'y');
    put(g, 6, 2, 'g');
    put(g, 7, 2, 'g');
    put(g, 6, 12, 'g');
    put(g, 7, 12, 'g');
  },
);

/** Toddlecap: the familiar on a glow disc. */
export const ICON_TODDLECAP = iconFrom(TODDLECAP_SPRITE, 'item.toddlecap', '#2e4430');

/** Shelf Fungus: orange bracket fungi growing bigger and bigger up an old stump. */
export const ICON_SHELF_FUNGUS = drawIcon(
  'shelf-fungus',
  { B: '#6a4a30', b: '#4a3020', T: '#b89060', F: '#e0a050', h: '#f8d090', f: '#9a5a2a' },
  (g) => {
    rect(g, 2, 1, 5, 12, 'B');
    rect(g, 2, 1, 5, 1, 'T');
    put(g, 3, 4, 'b');
    put(g, 4, 7, 'b');
    put(g, 3, 10, 'b');
    const shelf = (cy: number, rx: number, ry: number): void => {
      for (let y = 0; y < 14; y++) {
        for (let x = 6; x < 14; x++) {
          const dx = (x + 0.5 - 6) / rx;
          const dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) put(g, x, y, y + 0.5 > cy + ry * 0.3 ? 'f' : 'F');
        }
      }
    };
    shelf(3.8, 3.4, 1.5);
    shelf(7.6, 5, 1.8);
    shelf(11.2, 6.4, 1.4);
    paintIf(g, 'F', 'h', (x, y) => get2(g, x, y - 1) === '.');
    outline(g);
  },
);

/** The cell above, treating the edges as transparent (for rim highlights). */
function get2(g: Grid, x: number, y: number): string {
  return y < 0 || y >= g.length ? '.' : (g[y]![x] ?? '.');
}

// ── Waxen (candles) ────────────────────────────────────────────────────────────

/** Trick Candle: a candy-striped birthday candle that keeps relighting itself. */
export const ICON_TRICK_CANDLE = icon(
  'trick-candle',
  { F: '#ffcf57', f: '#ff8a30', H: '#fffbe8', k: '#3a1a10', P: '#ff8ad0', W: '#fff4f8', C: '#fff4e0', c: '#ffc8e0', S: '#c8905a', y: '#fff27a', Y: '#ffffff' },
  [
    '......o.......',
    '.....oFo...y..',
    '....oFHFo.yYy.',
    '....ofHfo..y..',
    '.....oko......',
    '....oWPPo.....',
    '....oPPWo.....',
    '....oPWWo.....',
    '....oWWPo.....',
    '....oWPPo.....',
    '..ooooooooo...',
    '.oCCcCCCcCCo..',
    '.oSSSSSSSSSo..',
    '..ooooooooo...',
  ],
);

/** Sealing Wax: a fresh red wax seal with a star pressed in, and the lit stick that made it. */
export const ICON_SEALING_WAX = drawIcon(
  'sealing-wax',
  { R: '#c8303a', r: '#7a1420', h: '#ff7a80', F: '#ffcf57', H: '#fffbe8', K: '#e0b040', k: '#3a1a10' },
  (g) => {
    ellipse(g, 4.5, 8.7, 3.9, 3.9, 'R');
    shade(g, 4.5, 8.7, 3.9, 'R', 'h', 'r', -0.55, 0.55);
    polygon(g, starPoints(4.5, 8.9, 2.5, 1.1), 'K');
    outline(g);
    stamp(g, 9, 0, [
      '..F.',
      '.FHF',
      '.oko',
      'oRRo',
      'ohRo',
      'oRRo',
      'oKKo',
      'oRRo',
      'oRro',
      'oRro',
      'oooo',
    ]);
  },
);

/** Candelabra: three brass arms, three little flames. */
export const ICON_CANDELABRA = icon(
  'candelabra',
  { F: '#ffcf57', H: '#fffbe8', k: '#3a1a10', W: '#f3ead0', w: '#c8b890', K: '#e0b040', h: '#fff4a0', d: '#9a6a1c' },
  [
    '..o...o...o...',
    '.oFo.oFo.oFo..',
    '.oHo.oHo.oHo..',
    '..k...k...k...',
    '.oWo.oWo.oWo..',
    '.oWo.oWo.oWo..',
    '.owo.owo.owo..',
    'ohKKohKKohKdo.',
    '.oKoooKoooKo..',
    '.ohKKKKKKKddo.',
    '..ooooKoooo...',
    '.....oKo......',
    '....ohKdo.....',
    '....ooooo.....',
  ],
);

/** Candle Snuffer: a little brass bell on a handle, a curl of smoke rising from it. */
export const ICON_CANDLE_SNUFFER = icon(
  'candle-snuffer',
  { K: '#e0b040', k: '#9a6a1c', h: '#fff4a0', s: '#9aa0b8', S: '#d8dcec' },
  [
    '...........s..',
    '..........S.s.',
    '.........ooo..',
    '........oKhKo.',
    '.......oKhKKKo',
    '.......oKKKKko',
    '......oooooooo',
    '.....okKo.....',
    '....oKko......',
    '...oKko.......',
    '..oKko........',
    '.oKko.........',
    'oKko..........',
    'ooo...........',
  ],
);

/** Tallow Tot: the familiar on a glow disc. */
export const ICON_TALLOW_TOT = iconFrom(TALLOW_TOT_SPRITE, 'item.tallow-tot', '#4a2a2a');

// ── General ────────────────────────────────────────────────────────────────────

/** Lead Marble: a heavy grey marble that cracks the floor where it sits. */
export const ICON_LEAD_MARBLE = drawIcon(
  'lead-marble',
  { L: '#7d8598', h: '#c8d0e0', H: '#ffffff', l: '#4a5064', d: '#3a3448' },
  (g) => {
    ellipse(g, 6.5, 6, 5, 5, 'L');
    shade(g, 6.5, 6, 5, 'L', 'h', 'l', -0.5, 0.35);
    put(g, 4, 3, 'H');
    put(g, 3, 4, 'H');
    put(g, 4, 4, 'h');
    outline(g);
    stamp(g, 1, 12, ['.d.d......d.', 'd...d....d.d']);
  },
);

/** Cold Brew Can: a frosty can of very strong coffee. */
export const ICON_COLD_BREW_CAN = icon(
  'cold-brew-can',
  { M: '#c9d3e6', m: '#7d89a8', B: '#3a6ab0', b: '#244a80', h: '#8ab0f0', C: '#8a5a2b', c: '#5a3a1a', W: '#e8f8ff' },
  [
    '..............',
    '....oooooo....',
    '...oMmMMMmo...',
    '..oMMMMMMMmo..',
    '..oBhBBBBBbo.W',
    '..ohBBCCBBbo..',
    'W.oBBCcCCBbo..',
    '..oBBCCcCBbo..',
    '..ohBBCCBBbo.W',
    '..oBhBBBBBbo..',
    '.WoBBBBBBbbo..',
    '..oMMMMMMMmo..',
    '...oooooooo...',
    '..............',
  ],
);

/** Magnifying Glass: everything looks bigger through it. */
export const ICON_MAGNIFYING_GLASS = drawIcon(
  'magnifying-glass',
  { K: '#e0b040', k: '#9a6a1c', y: '#fff4a0', G: '#bfe8ff', g: '#7ab8e0', H: '#ffffff', W: '#8a5a2b', w: '#5a3a1a' },
  (g) => {
    ellipse(g, 5.5, 5.5, 4.7, 4.7, 'K');
    ellipse(g, 5.5, 5.5, 3.3, 3.3, 'G');
    shade(g, 5.5, 5.5, 4.7, 'K', 'y', 'k');
    shade(g, 5.5, 5.5, 3.3, 'G', 'H', 'g', -0.35, 0.5);
    line(g, 9, 9, 12, 12, 'W');
    line(g, 9, 10, 11, 12, 'w');
    line(g, 10, 9, 12, 11, 'w');
    outline(g);
  },
);

/** Slingshot Band: a forked stick with a snappy red band and a marble in the pouch. */
export const ICON_SLINGSHOT_BAND = drawIcon(
  'slingshot-band',
  { W: '#b98040', w: '#7a4f2a', R: '#e0404a', M: '#ffcf57', m: '#e8862e' },
  (g) => {
    rect(g, 6, 8, 7, 12, 'W');
    rect(g, 7, 9, 7, 12, 'w');
    line(g, 6, 8, 2, 2, 'W');
    line(g, 7, 8, 11, 2, 'W');
    line(g, 6, 7, 3, 2, 'W');
    line(g, 7, 7, 10, 2, 'w');
    outline(g);
    line(g, 2, 1, 5, 5, 'R');
    line(g, 11, 1, 8, 5, 'R');
    put(g, 6, 5, 'M');
    put(g, 7, 5, 'm');
    put(g, 6, 6, 'm');
    put(g, 7, 6, 'm');
  },
);

/** Gold Star Badge: a shiny gold star on a blue ribbon — for trying your best. */
export const ICON_GOLD_STAR_BADGE = drawIcon(
  'gold-star-badge',
  { Y: '#ffcf57', h: '#fff4b0', y: '#c8862e', B: '#3f7fbf', b: '#264e7a' },
  (g) => {
    stamp(g, 3, 9, ['BB....BB', 'BBb..bBB', '.Bb..bB.', '.b....b.']);
    polygon(g, starPoints(6.5, 5.6, 5.9, 2.5), 'Y');
    shade(g, 6.5, 5.6, 4.5, 'Y', 'h', 'y', -0.4, 0.45);
    outline(g);
  },
);

/** Wishing Penny: a copper penny fished out of a wishing well, still dripping, star-stamped. */
export const ICON_WISHING_PENNY = drawIcon(
  'wishing-penny',
  { C: '#d88a4a', c: '#8a4a24', h: '#ffc890', k: '#6a3418', b: '#6fb3e0', B: '#3b5f7e', y: '#fff27a', Y: '#ffffff' },
  (g) => {
    ellipse(g, 6.5, 6, 4.8, 4.8, 'C');
    shade(g, 6.5, 6, 4.8, 'C', 'h', 'c', -0.55, 0.45);
    // An engraved rim and a stamped star.
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const d = Math.hypot(x + 0.5 - 6.5, y + 0.5 - 6);
        if (d > 3.3 && d < 3.9 && get3(g, x, y) !== '.') put(g, x, y, 'c');
      }
    }
    polygon(g, starPoints(6.5, 6.2, 2.5, 1.05), 'k');
    outline(g);
    // Drips and the well's ripples below.
    put(g, 4, 12, 'b');
    put(g, 9, 12, 'b');
    stamp(g, 2, 13, ['BbbB.BbbB.']);
    put(g, 12, 1, 'y');
    put(g, 13, 2, 'Y');
    put(g, 12, 3, 'y');
  },
);

function get3(g: Grid, x: number, y: number): string {
  return g[y]?.[x] ?? '.';
}

/** Weighted Die: a die that always seems to land just right (red pips, suspiciously heavy). */
export const ICON_WEIGHTED_DIE = icon(
  'weighted-die',
  { W: '#f3efe0', w: '#b8b0a0', h: '#ffffff', k: '#2a2438', R: '#e0404a' },
  [
    '..............',
    '..oooooooooo..',
    '.ohhhhhhhhhWo.',
    '.ohkkWWWWkkWo.',
    '.ohkkWWWWkkWo.',
    '.ohWWWWWWWWwo.',
    '.ohWWWRRWWWwo.',
    '.ohWWWRRWWWwo.',
    '.ohWWWWWWWWwo.',
    '.ohkkWWWWkkwo.',
    '.oWkkWWWWkkwo.',
    '.oWwwwwwwwwwo.',
    '..oooooooooo..',
    '..............',
  ],
);

/** Ladybug Brooch: a lucky little ladybug pin. */
export const ICON_LADYBUG_BROOCH = drawIcon(
  'ladybug-brooch',
  { R: '#e0404a', h: '#ff9a90', r: '#9a2430', k: '#1d1830', e: '#fffbe8', K: '#e0b040' },
  (g) => {
    ellipse(g, 6.5, 3.2, 2.4, 1.8, 'k');
    ellipse(g, 6.5, 8, 4.9, 4.4, 'R');
    shade(g, 6.5, 8, 4.9, 'R', 'h', 'r');
    for (let y = 4; y <= 12; y++) put(g, 6, y, 'k');
    put(g, 4, 6, 'k');
    put(g, 3, 9, 'k');
    put(g, 4, 10, 'k');
    put(g, 8, 6, 'k');
    put(g, 9, 9, 'k');
    put(g, 8, 10, 'k');
    put(g, 5, 2, 'e');
    put(g, 7, 2, 'e');
    outline(g);
    put(g, 12, 1, 'K');
    put(g, 13, 2, 'K');
    put(g, 12, 3, 'K');
  },
);

/** Tracing Paper: a see-through sheet over a doodle — trace it and you've got two. */
export const ICON_TRACING_PAPER = drawIcon(
  'tracing-paper',
  { W: '#cfe0ee', w: '#9ab4c8', k: '#5a6a90', B: '#f3efe0', b: '#3a3448', s: '#c8c0a8' },
  (g) => {
    // The original underneath (white paper, dark doodle lines).
    rect(g, 4, 3, 12, 12, 'B');
    rect(g, 12, 3, 12, 12, 's');
    // The tracing sheet on top (pale blue, the copied lines show through fainter).
    rect(g, 0, 0, 9, 10, 'o');
    rect(g, 1, 1, 8, 9, 'W');
    put(g, 8, 1, 'w');
    put(g, 7, 1, 'w');
    put(g, 8, 2, 'w');
    for (const y of [3, 5, 7]) {
      line(g, 2, y, y === 5 ? 5 : 6, y, 'k');
      line(g, 10, y + 2, 11, y + 2, 'b');
    }
    line(g, 5, 11, 11, 11, 'b');
    outline(g);
  },
);

/** Carousel Horse: a painted merry-go-round horse on its brass pole. */
export const ICON_CAROUSEL_HORSE = drawIcon(
  'carousel-horse',
  { W: '#f3efe0', w: '#b8b0a0', P: '#ff8ad0', R: '#e0404a', K: '#ffcf57', k: '#c8862e', e: '#1d1830' },
  (g) => {
    ellipse(g, 7.2, 7.2, 3.9, 2.2, 'W');
    ellipse(g, 3.2, 4.4, 1.7, 2.1, 'W');
    rect(g, 3, 5, 4, 7, 'W');
    put(g, 1, 5, 'W');
    put(g, 2, 6, 'W');
    line(g, 5, 9, 4, 11, 'W');
    line(g, 9, 9, 10, 11, 'W');
    line(g, 10, 8, 12, 10, 'w');
    paintIf(g, 'W', 'w', (_x, y) => y >= 9);
    put(g, 4, 2, 'P');
    put(g, 5, 3, 'P');
    put(g, 5, 4, 'P');
    put(g, 3, 4, 'e');
    put(g, 7, 5, 'R');
    put(g, 8, 5, 'R');
    put(g, 12, 7, 'P');
    put(g, 13, 8, 'P');
    outline(g);
    rect(g, 7, 0, 7, 13, 'K');
    put(g, 7, 6, 'k');
    put(g, 7, 12, 'k');
  },
);

/** Snail Mail Stamp: a postage stamp with a very patient snail on it. */
export const ICON_SNAIL_MAIL_STAMP = icon(
  'snail-mail-stamp',
  { W: '#f3efe0', w: '#c8c0a8', B: '#8ac8f0', S: '#e8a860', s: '#9a5a2a', g: '#a8c8a0', G: '#4f8a4a', k: '#3a3040' },
  [
    '..............',
    '.W.W.W.W.W.W..',
    '..WWWWWWWWW...',
    '.WWBBBBBBBWW..',
    '..WBBSSSBBW...',
    '.WWBSssSkBWW..',
    '..WBSsSSBkW...',
    '.WWBSSSSggWW..',
    '..WBggggggW...',
    '.WWGGGGGGGWW..',
    '..WWWWWWWWW...',
    '.W.W.W.W.W.W..',
    '..............',
    '..............',
  ],
);

/** Rearview Mirror: a little round mirror — the shots in it are closer than they appear. */
export const ICON_REARVIEW_MIRROR = icon(
  'rearview-mirror',
  { M: '#5e6a88', m: '#3a4258', G: '#bfe0f0', g: '#8ab0c8', h: '#ffffff', Y: '#ffcf57', y: '#e8862e', w: '#f3efe0' },
  [
    '......oo......',
    '......oMo.....',
    '..ooooomoooo..',
    '.oMMMMMMMMMMo.',
    'oMGGhGGGGGGgMo',
    'oMGhGGGGGGggMo',
    'oMhGGYYowwggMo',
    'oMGGGYyoggggMo',
    'oMGGGGGGGgggMo',
    '.oMmmmmmmmmmo.',
    '..oooooooooo..',
    '..............',
    '..............',
    '..............',
  ],
);

/** Greasy Gloves: slippery yellow gloves — a marble is already sliding out. */
export const ICON_GREASY_GLOVES = icon(
  'greasy-gloves',
  { Y: '#ffd84a', y: '#c89a20', h: '#fff8c8', d: '#5a3a1a', W: '#f3efe0', w: '#c8c0a8', M: '#ffcf57', m: '#e8862e' },
  [
    '..........oo..',
    '....o.o..oMMo.',
    '...oYoYo.oMmo.',
    '...oYoYoo.oo..',
    '.o.oYoYoYo....',
    'oYooYYYYYo....',
    'oYYoYhYYYo....',
    '.oYYhYYYyo....',
    '..oYhYYyyo....',
    '...oYYyyo.....',
    '...oWWWwo.....',
    '...ooooooo....',
    '....d..d......',
    '....d.........',
  ],
);

/** Spyglass: a brass pocket telescope pulled out to full length, its lens catching the light. */
export const ICON_SPYGLASS = drawIcon(
  'spyglass',
  { K: '#e0b040', k: '#9a6a1c', y: '#fff4a0', d: '#5a3a14', G: '#bfe8ff', H: '#ffffff' },
  (g) => {
    // Along the diagonal from the eyepiece (bottom left) to the lens (top right), three segments that
    // widen toward the lens.
    const ax = 2.2;
    const ay = 11.8;
    const len = Math.hypot(9.4, 9.4);
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 14; x++) {
        const dx = x + 0.5 - ax;
        const dy = y + 0.5 - ay;
        const along = (dx - dy) / Math.SQRT2;
        const across = (dx + dy) / Math.SQRT2;
        if (along < 0 || along > len) continue;
        const f = along / len;
        const hw = f < 0.34 ? 1.2 : f < 0.67 ? 1.7 : 2.3;
        if (Math.abs(across) > hw) continue;
        let ch = 'K';
        if (Math.abs(f - 0.34) < 0.05 || Math.abs(f - 0.67) < 0.05) ch = 'd';
        else if (across < -hw + 0.8) ch = 'y';
        else if (across > hw - 0.8) ch = 'k';
        if (along > len - 1) ch = 'G';
        put(g, x, y, ch);
      }
    }
    outline(g);
    put(g, 12, 1, 'H');
  },
);

/** Every icon of the pack (the tests validate them all). */
export const ITEMS_A_ICONS: readonly SpriteDef[] = [
  ICON_BRASS_KITE_KEY,
  ICON_WOOL_MITTEN,
  ICON_CRACKLE_CANDY,
  ICON_FALLING_BAROMETER,
  ICON_BLINKBUG,
  ICON_STATIC_CLING,
  ICON_FEATHERY_ANTENNAE,
  ICON_WING_DUST_POUCH,
  ICON_PORCH_BULB,
  ICON_EYESPOT_CHARM,
  ICON_GLOAMWING,
  ICON_SNUG_COCOON,
  ICON_POCKET_METRONOME,
  ICON_LOOSE_MAINSPRING,
  ICON_TIN_CUCKOO,
  ICON_RATCHET_WRENCH,
  ICON_CLOCKWORK_HEART,
  ICON_WHIRRING_COG,
  ICON_EARTHSTAR,
  ICON_GLOWCAP,
  ICON_FAIRY_RING,
  ICON_TODDLECAP,
  ICON_SHELF_FUNGUS,
  ICON_TRICK_CANDLE,
  ICON_SEALING_WAX,
  ICON_CANDELABRA,
  ICON_CANDLE_SNUFFER,
  ICON_TALLOW_TOT,
  ICON_LEAD_MARBLE,
  ICON_COLD_BREW_CAN,
  ICON_MAGNIFYING_GLASS,
  ICON_SLINGSHOT_BAND,
  ICON_GOLD_STAR_BADGE,
  ICON_WISHING_PENNY,
  ICON_WEIGHTED_DIE,
  ICON_LADYBUG_BROOCH,
  ICON_TRACING_PAPER,
  ICON_CAROUSEL_HORSE,
  ICON_SNAIL_MAIL_STAMP,
  ICON_REARVIEW_MIRROR,
  ICON_GREASY_GLOVES,
  ICON_SPYGLASS,
];
