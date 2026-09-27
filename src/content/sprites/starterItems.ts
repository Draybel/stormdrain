/**
 * Starter item art (Phase 2 part D, all original pixel maps): 14×14 icons for the modifier and
 * "weird" items, costume layers for the major ones, and three more familiars (Dustwing, Roly-Poly,
 * Wick Wisp). Style: 1 px dark outline, a highlight and a shade, dark-but-cute.
 *
 * Costumes are anchored like Wren (14 wide, feet at the bottom row): a 16-row layer lines up with her
 * frame row for row; the 20-row hats reach 4 rows above her hood.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

function icon(id: string, palette: Record<string, string>, rows: string[]): SpriteDef {
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [rows] };
}

// ── Modifier item icons ──────────────────────────────────────────────────────

/** Twin Straws: a striped soda cup with two bendy straws. */
export const ICON_TWIN_STRAWS = icon('twin-straws', { Y: '#ffcf57', C: '#6fd0e8', W: '#f3e6c8', R: '#d8404a', r: '#9a2430', h: '#ffffff' }, [
  '..o........o..',
  '.oYo......oCo.',
  '..oYo....oCo..',
  '...oYo..oCo...',
  '....oYooCo....',
  '..oooooooooo..',
  '..ohWWWWWWWo..',
  '..oRRRRRRRro..',
  '...ohWWWWWo...',
  '...oRRRRRro...',
  '....ohWWWo....',
  '....oRRrro....',
  '....oooooo....',
  '..............',
]);

/** Acorn Buckshot: a big acorn and two little ones flying out to the sides. */
export const ICON_ACORN_BUCKSHOT = icon('acorn-buckshot', { C: '#7a4f2a', c: '#5a3a1e', N: '#d09050', n: '#9a6030', h: '#f6c890', s: '#4a3018' }, [
  '......oo......',
  '.....oso......',
  '...oooooooo...',
  '..oCcCcCcCco..',
  '..occcccccco..',
  '...ohNNNNno...',
  '...ohNNNNno...',
  '...oNNNNNno...',
  '....oNNNno....',
  '.oo..oNno..oo.',
  'oCco..oo..oCco',
  'ohno......ohno',
  '.oo........oo.',
  '..............',
]);

/** Crab Claws: a little red crab waving both claws. */
export const ICON_CRAB_CLAWS = icon('crab-claws', { R: '#e05a4a', r: '#a8362c', h: '#ffa890', e: '#fffbe8' }, [
  '..............',
  '.oo........oo.',
  'oRRo.o..o.oRRo',
  'oR.o.e..e.o.Ro',
  'oRRo.r..r.oRRo',
  '.oRo.r..r.oRo.',
  '..oooooooooo..',
  '.ohRRRRRRRRro.',
  '.oRRRRRRRRRro.',
  '..orrrrrrrro..',
  '..oooooooooo..',
  '.o.o.o..o.o.o.',
  'o.o........o.o',
  '..............',
]);

/** Lantern Moth: a pale moth with a glowing lantern belly. */
export const ICON_LANTERN_MOTH = icon('lantern-moth', { W: '#e8dcc0', w: '#b8a888', s: '#8a6a4a', B: '#ffd878', b: '#e8a040' }, [
  '..............',
  '...o......o...',
  '....o.oo.o....',
  '.ooo.oBBo.ooo.',
  'oWWWooBBooWWWo',
  'oWsWWoBBoWWsWo',
  'oWssWoBBoWssWo',
  'owWWwoBBowWWwo',
  '.oooooBBooooo.',
  '..oWWoBBoWWo..',
  '..owWobbowWo..',
  '...oooooooo...',
  '......bb......',
  '..............',
]);

/** Moth-Eaten Scarf: a tattered purple scarf shedding dust. */
export const ICON_MOTH_EATEN_SCARF = icon('moth-eaten-scarf', { P: '#8a5ab0', p: '#5e3a80', h: '#c09ae0', Y: '#e0b040', d: '#e8dcc0' }, [
  '............d.',
  '...oooooooo...',
  '..ohPYPP.YPo..',
  '.ohPoooooopPo.',
  '.oPo......oPo.',
  '.oPPoooooopPo.',
  '..oPPYPPYPPo..',
  '...oPPo.oPPo..',
  '...oYPo.oPYo..',
  '.d.oPPo..oPPo.',
  '...oPpo..oPYo.',
  '...o.o...oPpo.',
  '.........o.o..',
  '..............',
]);

/** Snail Shell: a spiral shell on a sleepy snail, dripping slime. */
export const ICON_SNAIL_SHELL = icon('snail-shell', { S: '#e8a860', s: '#9a5a2a', h: '#ffd8a8', B: '#a8c8a0', b: '#6a9070', e: '#fffbe8', g: '#8fe0d0' }, [
  '..............',
  '...oooooo.....',
  '..ohSSSSSo.e.e',
  '..oSssssSo.b.b',
  '..oSsSSsSo.bob',
  '..oSsSssSo.oBo',
  '..oSsSSSSooBBo',
  '..ohSSSSSSoBBo',
  '.ooooooooooBBo',
  'oBBBBBBBBBBBo.',
  '.obbbbbbbbbo..',
  '..ooooooooo...',
  '.g....g.......',
  'ggg..ggg......',
]);

/** Tiny Moon: a sleepy crescent with little orbiting sparks. */
export const ICON_TINY_MOON = icon('tiny-moon', { M: '#e8e4ff', m: '#a8a0e0', h: '#ffffff', s: '#9f9fff', k: '#3a3060' }, [
  '.......s......',
  '....ooooo...s.',
  '...oMMMMmo....',
  '..oMMMmoo.....',
  '.ohMMmo.......',
  '.oMMMo........',
  '.oMkMo...s....',
  '.oMMMo........',
  '.ohMMmo.......',
  '..oMMMmoo.....',
  '...oMMMMmo....',
  's...ooooo.....',
  '..........s...',
  '..............',
]);

/** Yo-Yo String: a red yo-yo on its string, loop and all. */
export const ICON_YO_YO_STRING = icon('yo-yo-string', { R: '#e0515a', r: '#9a2430', h: '#ff9aa0', W: '#f3efe0', s: '#d8d0b8' }, [
  '..ooo.........',
  '..o.o.........',
  '..ooos........',
  '......s.......',
  '......s.......',
  '.....oooo.....',
  '....ohRRRo....',
  '...ohRWWRRo...',
  '...oRWRRWRo...',
  '...oRWRRWro...',
  '...oRRWWRro...',
  '....oRRrro....',
  '.....oooo.....',
  '..............',
]);

/** Rocket Sock: a striped sock zooming along on a puff of fire. */
export const ICON_ROCKET_SOCK = icon('rocket-sock', { R: '#e05a4a', r: '#a8362c', W: '#f3efe0', h: '#ffffff', F: '#ffcf57', f: '#ff7a3a' }, [
  '..............',
  '..............',
  '....oooooo....',
  '....ohWWWo....',
  '....oRRRRo....',
  '.ff.oWWWWo....',
  'fFf.oRRRRo....',
  '.ff.oWWWWoooo.',
  'fFf.oRRRRRRRRo',
  '.ff.ohWWWWWWWo',
  '.....oRRRRRRro',
  '......oooooooo',
  '..............',
  '..............',
]);

/** Rubber Ball: a green bouncy ball with a yellow stripe, bouncing. */
export const ICON_RUBBER_BALL = icon('rubber-ball', { G: '#9be35a', g: '#5a9a30', h: '#e0ffc0', Y: '#ffcf57', d: '#c8d0e0' }, [
  '..............',
  '.....oooo.....',
  '...ooGGGGoo...',
  '..ohhGGGGYgo..',
  '..ohGGGGYYgo..',
  '.oGGGGGYYGggo.',
  '.oGGGGYYGGggo.',
  '.oGGGYYGGGggo.',
  '..oGYYGGGggo..',
  '..oYYGGGgggo..',
  '...oogggggo...',
  '.....oooo.....',
  '..............',
  '.d.d......d.d.',
]);

/** Wisp in a Bottle: a corked bottle with a little ghost inside. */
export const ICON_WISP_IN_A_BOTTLE = icon('wisp-in-a-bottle', { C: '#b98040', c: '#8a5a2b', G: '#9ab4d0', h: '#ffffff', d: '#2a3a50', W: '#e8f4ff', w: '#a8c8e8', k: '#2a3050' }, [
  '.....oooo.....',
  '.....oCCo.....',
  '.....ocCo.....',
  '....oGGGGo....',
  '...oGddddGo...',
  '..oGddWWddGo..',
  '..oGdWWWWdGo..',
  '..ohdWkWkdGo..',
  '..ohdWWWWdGo..',
  '..oGdWWWWdGo..',
  '..oGdWwWwdGo..',
  '..oGGGGGGGGo..',
  '...oooooooo...',
  '..............',
]);

/** Knitting Needle: a ball of pink yarn skewered on a long needle. */
export const ICON_KNITTING_NEEDLE = icon('knitting-needle', { N: '#c8d0e0', k: '#e8c060', Y: '#e05a8a', y: '#9a3060', h: '#ffb0d0' }, [
  '............oo',
  '...........oko',
  '..........oNo.',
  '.........oNo..',
  '....oooooNo...',
  '...oYYYYNoo...',
  '..oYhYYNYYyo..',
  '..oYYYNYYYyo..',
  '..oYYNYYYyyo..',
  '..oYNYYYyyyo..',
  '...oyyyyyyo...',
  '...Noooooo....',
  '..No..........',
  '.No...........',
]);

/** Geode: a split rock full of glittering crystals. */
export const ICON_GEODE = icon('geode', { S: '#6a6480', s: '#4a4460', C: '#7fe8ff', c: '#3aa8d0', P: '#c9a0ff', h: '#ffffff' }, [
  '..............',
  '....oooooo....',
  '..ooSSSSSSoo..',
  '.oSSooooooSSo.',
  '.oSoCChPCcoSo.',
  'oSoCChPPPCcoSo',
  'oSoChCPhPCcoso',
  'oSocCPPPCCcoso',
  '.oSocCCCccoSo.',
  '.oSSoooooosso.',
  '..ooSSSSssoo..',
  '....oooooo....',
  '..h........h..',
  '..............',
]);

/** Rooftop Rod: a lightning rod on a little roof, just struck. */
export const ICON_ROOFTOP_ROD = icon('rooftop-rod', { M: '#9aa6c0', m: '#5a6480', Y: '#fff27a', W: '#ffffff', R: '#8a4a3a', r: '#5a2e24' }, [
  '..........YY..',
  '.........YY...',
  '........YYYY..',
  '..........YY..',
  '.......W.YY...',
  '......oWoY....',
  '......oMo.....',
  '.....ooMoo....',
  '.....oMmMo....',
  '.....ooMoo....',
  '......oMo.....',
  '....ooMMMoo...',
  '..ooRRRRRRRoo.',
  '.oRRrRRrRRrRRo',
]);

/** Party Popper: a striped popper spraying confetti. */
export const ICON_PARTY_POPPER = icon('party-popper', { P: '#e0515a', Y: '#ffcf57', b: '#6fd0e8', g: '#9be35a', v: '#c9a0ff', y: '#fff27a' }, [
  '.......b..y...',
  '..y.......v...',
  '.....g.b....g.',
  '.........y....',
  '...v...b...v..',
  '......g..y....',
  '......ooo.....',
  '.....oYPPo....',
  '....oPYYPo....',
  '...oPPPYo.....',
  '..oPYPPo......',
  '.oPPYo........',
  'oPYoo.........',
  'ooo...........',
]);

/** Toadstool Cap: a spotted red toadstool with a worried little face. */
export const ICON_TOADSTOOL_CAP = icon('toadstool-cap', { R: '#d8404a', r: '#9a2430', W: '#f3efe0', S: '#e8dcc0', s: '#b8a888', h: '#fffbe8', k: '#2a2230', g: '#7ee06a' }, [
  '..........g...',
  '....oooooo..g.',
  '..ooRRWRRRoo..',
  '.oRWRRRRRWRro.',
  'oRRRRWRRRRRRro',
  'oRWRRRRRWRRrro',
  '.oorrrrrrrroo.',
  '...oSSSSSSo...',
  '...oSkSSkSo...',
  '...oSSSSSso...',
  '...oSSkkSso...',
  '...ohSSSSso...',
  '....oooooo....',
  '..g......g....',
]);

/** Drippy Candle: a stubby wax candle with a fat flame. */
export const ICON_DRIPPY_CANDLE = icon('drippy-candle', { W: '#f3e6c8', w: '#c8b898', F: '#ffcf57', f: '#ff8a30', h: '#fffbe8', k: '#2a2230' }, [
  '......o.......',
  '.....oFo......',
  '....oFhFo.....',
  '....ofhfo.....',
  '.....ofo......',
  '......k.......',
  '...oooooooo...',
  '...oWWWWWwo...',
  '...oWhWWWwo...',
  '..owWhWWWwo...',
  '..owohWWWwo...',
  '...oWWWWwwo...',
  '...oWWWWwwo...',
  '...oooooooo...',
]);

/** Ice Cube Tray: one very cold, very smug ice cube. */
export const ICON_ICE_CUBE_TRAY = icon('ice-cube-tray', { I: '#bff0ff', i: '#7fc8e8', d: '#4a90c0', h: '#ffffff', k: '#2a3a60' }, [
  '.h............',
  '......oo......',
  '....ooIIoo....',
  '..ooIIhIIIoo..',
  '.oIIIIIIIIIIo.',
  '.oiiIIIIIIddo.',
  '.oiiiiIIddddo.',
  '.oiiiiidddddo.',
  '.oikiikdddddo.',
  '.oiiiiidddddo.',
  '.oiikiiddddho.',
  '..ooiiidddoo..',
  '....ooiddo....',
  '......oo....h.',
]);

/** Paper Valentine: a folded paper heart. */
export const ICON_PAPER_VALENTINE = icon('paper-valentine', { R: '#ff6a9a', r: '#c83a6a', W: '#fff0f4', h: '#ffffff', P: '#ffb0cc' }, [
  '..............',
  '..ooo....ooo..',
  '.oRRRo..oRRRo.',
  'oRhRRRooRRRRro',
  'oRhPRRRRRRRRro',
  'oRRRPRRRRRRRro',
  'oRRRRPRRRRRrro',
  '.oRRRRPRRRrro.',
  '..oRRRRPRrro..',
  '...oRRRRrro...',
  '....oRRrro....',
  '.....oRro.....',
  '......oo......',
  '..............',
]);

// ── Weird item icons ─────────────────────────────────────────────────────────

/** Backwards Cap: a blue ball cap with its brim the wrong way round. */
export const ICON_BACKWARDS_CAP = icon('backwards-cap', { B: '#4a7ad0', b: '#2a4a90', h: '#8ab0f0', Y: '#ffcf57', W: '#f3efe0' }, [
  '..............',
  '..............',
  '......oYo.....',
  '....ooBBBoo...',
  '...oBhhBBBBo..',
  '..oBhBBWWBBbo.',
  '..oBBBBWWBBbo.',
  '..oBBBBBBBbbo.',
  'ooobbbbbbbbbo.',
  'oBBBooooooooo.',
  '.ooo..........',
  '....W.........',
  '...WWWWWW.....',
  '....W.........',
]);

/** Paperweight: a heavy glass dome with a pressed flower inside. */
export const ICON_PAPERWEIGHT = icon('paperweight', { G: '#8ab4d0', g: '#4a7090', h: '#ffffff', F: '#ff8ad0', f: '#c04a90', L: '#7ee06a', B: '#3a3040', b: '#5a5060' }, [
  '..............',
  '..............',
  '.....oooo.....',
  '...ooGhhGoo...',
  '..oGhhGGGGgo..',
  '..oGhGFFGGgo..',
  '.oGGGFffFGGgo.',
  '.oGGGGFFGGggo.',
  '.oGGLGLGLGggo.',
  '.oGGGLLLGgggo.',
  '.oooooooooooo.',
  'oBBBBBBBBBBBbo',
  '.oooooooooooo.',
  '..............',
]);

/** Dizzy Top: a striped spinning top, mid-spin. */
export const ICON_DIZZY_TOP = icon('dizzy-top', { R: '#e05a4a', r: '#a8362c', h: '#ffa890', Y: '#ffcf57', B: '#4a7ad0', k: '#b98040', s: '#c8d0e0' }, [
  '......oo......',
  '.....okko.....',
  '.....okko.....',
  '...oooooooo...',
  '..oRRRRRRRRo..',
  'sohRRRRRRRRros',
  '.oYYYYYYYYYYo.',
  's.oBBBBBBBBo.s',
  '...oRRRRRRo...',
  '....oYYYYo....',
  '.....oBBo.....',
  '......oo......',
  '..s........s..',
  '...ssssssss...',
]);

/** Crumbly Biscuit: a nibbled biscuit shedding crumbs. */
export const ICON_CRUMBLY_BISCUIT = icon('crumbly-biscuit', { C: '#d8a060', c: '#a86a3a', h: '#f6d0a0', k: '#6a3a1e' }, [
  '..............',
  '....oooo......',
  '..ooCChCoo....',
  '.oCChCCkCCo...',
  '.oCkCCCCCCo.c.',
  'oCCCCCkCCo....',
  'oCCkCCCCCo..c.',
  'oCCCCCCCCCo...',
  '.oCCkCCCkCco..',
  '.ocCCCCCCcco..',
  '..occcccco....',
  '...ooooo..c...',
  '.c.....c......',
  '..............',
]);

/** Teacup Tempest: a teacup with its very own thundercloud. */
export const ICON_TEACUP_TEMPEST = icon('teacup-tempest', { W: '#f3efe0', w: '#c8c0a8', b: '#6fb3e0', G: '#8a94b0', g: '#5a6480', Y: '#fff27a', T: '#8a5a2b' }, [
  '....oooo......',
  '..ooGGGGoo....',
  '.oGGGGGGGGo...',
  '.oggggggggo...',
  '..ooooYYoo....',
  '.....YY.......',
  '..ooooYoooo...',
  '..oTTTTTTTo...',
  '..oWWWWWWWoo..',
  '..oWbWWbWWo.o.',
  '...oWWWWWoo...',
  '.oooooooooooo.',
  'owwwwwwwwwwwwo',
  '.oooooooooooo.',
]);

// ── Familiars (anchored at the feet; 2 frames = idle flap / wiggle / flicker) ──

/** Dustwing: a dusty little moth that hovers along and shoots with you. */
export const DUSTWING_SPRITE: SpriteDef = {
  id: 'fam.dustwing',
  w: 11,
  h: 8,
  anchorX: 5,
  anchorY: 7,
  palette: { o, W: '#e8dcc0', w: '#b8a888', s: '#8a6a4a', b: '#6a5a48', k: '#fff2a8' },
  frames: [
    ['...o...o...', '.oo.oko.oo.', 'oWWoobooWWo', 'oWsWoboWsWo', 'owWWoboWWwo', '.ooooboooo.', '....obo....', '.....o.....'],
    ['...o...o...', '....oko....', '.oo.obo.oo.', 'oWWoobooWWo', 'oWsWoboWsWo', 'owWWoboWWwo', '.ooooboooo.', '.....o.....'],
  ],
};

/** Roly-Poly: a pill bug that curls up and rolls into enemies. */
export const ROLY_POLY_SPRITE: SpriteDef = {
  id: 'fam.roly-poly',
  w: 10,
  h: 7,
  anchorX: 5,
  anchorY: 6,
  palette: { o, G: '#6a7088', g: '#4a5068', h: '#9aa0b8', e: '#fffbe8' },
  frames: [
    ['..oooooo..', '.ohGhGhGo.', 'oGGgGGgGGo', 'oGGgGGgGeo', 'oggggggggo', '.oooooooo.', '..o.o.o.o.'],
    ['..oooooo..', '.ohGhGhGo.', 'oGGgGGgGGo', 'oGGgGGgGeo', 'oggggggggo', '.oooooooo.', '.o.o.o.o..'],
  ],
};

/** Wick Wisp: a candle flame with a face that guards you and spits sparks. */
export const WICK_WISP_SPRITE: SpriteDef = {
  id: 'fam.wick-wisp',
  w: 7,
  h: 8,
  anchorX: 3,
  anchorY: 7,
  palette: { o, F: '#ffcf57', f: '#ff8a30', h: '#fffbe8', k: '#3a1a10' },
  frames: [
    ['...o...', '..oFo..', '.oFhFo.', 'oFhhFfo', 'oFkhkfo', 'ofFFFfo', '.offfo.', '..ooo..'],
    ['....o..', '...oFo.', '..oFhFo', '.oFhhFo', 'oFkhkfo', 'ofFFFfo', '.offfo.', '..ooo..'],
  ],
};

// ── Costumes ─────────────────────────────────────────────────────────────────

const EMPTY_ROW = '..............';

/** A costume frame of `h` rows with `rows` placed from row `top` (other rows transparent). */
function layer(h: number, top: number, rows: readonly string[]): string[] {
  const out: string[] = [];
  for (let y = 0; y < h; y++) out.push(y >= top && y < top + rows.length ? rows[y - top]! : EMPTY_ROW);
  return out;
}

/** A 16-row eyes layer from (x, y, colour key) points, like Wren's frame rows. */
function eyes(points: readonly (readonly [number, number, string])[]): string[] {
  const rows: string[][] = [];
  for (let y = 0; y < 16; y++) rows.push(EMPTY_ROW.split(''));
  for (const [x, y, c] of points) rows[y]![x] = c;
  return rows.map((r) => r.join(''));
}

/** Backwards Cap: a ball cap on the hood, brim pointing backwards (down, up, side frames). */
export const COSTUME_BACKWARDS_CAP: SpriteDef = {
  id: 'costume.backwards-cap',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, B: '#4a7ad0', b: '#2a4a90', h: '#8ab0f0', Y: '#ffcf57' },
  frames: [
    layer(20, 1, ['......oo......', '....ooYYoo....', '...oBhBBBBo...', '..oBBBBBBBBo..', '..obbboobbbo..']),
    layer(20, 1, ['......oo......', '....ooYYoo....', '...oBhBBBBo...', '..oBBBBBBBBo..', '.oobbbbbbbboo.', '..oBBBBBBBBo..', '...oooooooo...']),
    layer(20, 1, ['.....oo.......', '...ooYYoo.....', '..oBhBBBBo....', '.ooBBBBBBBo...', 'oBBbbbbbbbo...', '.ooo..........']),
  ],
};

/** Rooftop Rod: a little lightning-rod antenna on the hood, sparking at the tip (animated). */
export const COSTUME_ROOFTOP_ROD: SpriteDef = {
  id: 'costume.rooftop-rod',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, M: '#9aa6c0', y: '#fff27a', W: '#ffffff' },
  frames: [
    layer(20, 0, ['..........y...', '.........yWy..', '..........y...', '..........M...', '..........M...', '.........oMo..']),
    layer(20, 0, ['.........y.y..', '..........W...', '.........y.y..', '..........M...', '..........M...', '.........oMo..']),
  ],
};

/** Tin Pinwheel: a pinwheel on a stick poking out of the hood (animated spin). */
export const COSTUME_TIN_PINWHEEL: SpriteDef = {
  id: 'costume.tin-pinwheel',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, S: '#c9d3e6', P: '#ff7ad9', k: '#ffcf57', M: '#7d89a8' },
  frames: [
    layer(20, 0, ['.S.P..........', 'SSoPP.........', '.oko..........', 'PPoSS.........', '.P.S..........', '..M...........', '..M...........']),
    layer(20, 0, ['S...P.........', '.SoP..........', '..k...........', '.PoS..........', 'P...S.........', '..M...........', '..M...........']),
  ],
};

/** Moth-Eaten Scarf: a tattered purple scarf with a trailing end (down, up, side). */
export const COSTUME_MOTH_SCARF: SpriteDef = {
  id: 'costume.moth-scarf',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { o, P: '#8a5ab0', p: '#5e3a80', h: '#c09ae0' },
  frames: [
    layer(16, 9, ['..ohPPPPPPPo..', '..oppppPpppo..', '........oPo...', '........oPo...', '........opo...', '........o.o...']),
    layer(16, 9, ['..oPPPPPPPho..', '..opppPppppo..', '...oPo........', '...oPo........', '...opo........', '...o.o........']),
    layer(16, 9, ['.ohPPPPPPPo...', '.oppppppppo...', 'oPPo..........', 'opo...........', 'o.o...........']),
  ],
};

/** Firecracker Pouch: a leather pouch of firecrackers on the hip (down, up, side). */
export const COSTUME_FIRECRACKER_POUCH: SpriteDef = {
  id: 'costume.firecracker-pouch',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { o, B: '#8a6a42', b: '#b89363', R: '#e0404a', y: '#fff27a' },
  frames: [
    layer(16, 9, ['...y.......y..', '...o...y...o..', '..oRo.oRo.oRo.', 'oBBbBBBBbBBBbo', '.oooooooooooo.']),
    layer(16, 9, ['..............', '..............', '..............', 'oBBbBBBBbBBBbo', '.oooooooooooo.']),
    layer(16, 9, ['..y...........', '..o...........', '.oRoRo........', 'oBBbBBBBbBBBo.', '.ooooooooooo..']),
  ],
};

/** Neon Tube: a glowing pink visor across the eyes (down, up = hidden, side). */
export const COSTUME_NEON_VISOR: SpriteDef = {
  id: 'costume.neon-visor',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { P: '#ff5a88', p: '#c83a6a', W: '#ffe8f0' },
  frames: [
    eyes([[4, 6, 'P'], [5, 6, 'W'], [6, 6, 'P'], [7, 6, 'P'], [8, 6, 'W'], [9, 6, 'P'], [4, 7, 'p'], [5, 7, 'p'], [6, 7, 'p'], [7, 7, 'p'], [8, 7, 'p'], [9, 7, 'p']]),
    eyes([]),
    eyes([[9, 6, 'P'], [10, 6, 'W'], [11, 6, 'P'], [12, 6, 'W'], [13, 6, 'P'], [9, 7, 'p'], [10, 7, 'p'], [11, 7, 'p'], [12, 7, 'p'], [13, 7, 'p']]),
  ],
};

/** Ice Cube Tray: frosty eyes. */
export const COSTUME_FROST_EYES: SpriteDef = {
  id: 'costume.frost-eyes',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { W: '#bff4ff', C: '#3ab8ff', F: '#dff8ff' },
  frames: [
    eyes([[5, 6, 'W'], [8, 6, 'W'], [5, 7, 'C'], [8, 7, 'C'], [4, 4, 'F'], [6, 4, 'F'], [9, 4, 'F'], [3, 5, 'F'], [10, 5, 'F']]),
    eyes([]),
    eyes([[10, 6, 'W'], [12, 6, 'W'], [10, 7, 'C'], [12, 7, 'C'], [9, 4, 'F'], [11, 4, 'F'], [13, 4, 'F'], [8, 5, 'F']]),
  ],
};

/** Paper Valentine: love-struck pink eyes. */
export const COSTUME_HEART_EYES: SpriteDef = {
  id: 'costume.heart-eyes',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { P: '#ff8ad0', p: '#ff4a9a' },
  frames: [
    eyes([[5, 6, 'P'], [8, 6, 'P'], [5, 7, 'p'], [8, 7, 'p']]),
    eyes([]),
    eyes([[10, 6, 'P'], [12, 6, 'P'], [10, 7, 'p'], [12, 7, 'p']]),
  ],
};

/** Lantern Moth: a pale moth perched on the hood, flapping (animated). */
export const COSTUME_LANTERN_MOTH: SpriteDef = {
  id: 'costume.lantern-moth',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, W: '#e8dcc0', w: '#b8a888', B: '#ffd878' },
  frames: [
    layer(20, 1, ['.......oo.oo..', '......oWWoWWo.', '......owWBWwo.', '.......ooBoo..']),
    layer(20, 1, ['.......o...o..', '.......oWoWo..', '.......owBwo..', '........oBo...']),
  ],
};
