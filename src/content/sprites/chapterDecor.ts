/**
 * Chapter decorations (original pixel art): small floor decals scattered on plain floor and trims
 * hung along the top wall, one set per chapter (ChapterDef.decor). Decals may have several frames
 * (variants); the room renderer picks one per decal with a positional hash.
 */

import type { SpriteDef } from '../../sim/types';
import { LEAF_SPRITE, PUDDLE_SPRITE } from './gutterways';
import { OUTLINE } from './palette';

function art(id: string, palette: Record<string, string>, ...frames: string[][]): SpriteDef {
  return { id, w: frames[0]![0]!.length, h: frames[0]!.length, palette, frames };
}

const O = OUTLINE;

// ── The Gutterways ───────────────────────────────────────────────────────────
export const GUTTER_DRAIN_TRIM = art('decor.gutter.drain', { o: O, p: '#4b5773', P: '#8691ad', k: '#05060a', w: '#6d9ac0' }, [
  '.oooooo.',
  'oPPPPPPo',
  'opkkkkpo',
  '.oookoo.',
  '....w...',
  '....w...',
]);

// ── The Drowned Nursery ──────────────────────────────────────────────────────
const BLOCK_PAL = { o: O, r: '#c96a7a', R: '#f0a0ae', b: '#6a8ec0', B: '#a6c6f0', w: '#f5ecd8' };
export const NURSERY_BLOCK = art(
  'decor.nursery.block',
  BLOCK_PAL,
  ['.oooo.', 'oRRRRo', 'oRwwRo', 'oRwRRo', 'orrrro', '.oooo.'],
  ['.oooo.', 'oBBBBo', 'oBwBBo', 'oBwwBo', 'obbbbo', '.oooo.'],
);
export const NURSERY_DUCK = art('decor.nursery.duck', { o: O, y: '#f0c43c', Y: '#ffe68a', b: '#e8792e', k: '#0d0b14' }, [
  '..oo...',
  '.oYko..',
  '.oYYobb',
  'ooYYYo.',
  'oyyyyyo',
  '.ooooo.',
]);
export const NURSERY_MARBLE = art('decor.nursery.marble', { a: '#86b6cc', A: '#e6f6ff', c: '#4a7890' }, ['.a.', 'aAc', '.c.']);
export const NURSERY_BUNTING = art('decor.nursery.bunting', { s: '#b3a6ba', r: '#c96a7a', b: '#6a8ec0', y: '#e0c060' }, [
  's.s.s.s.s.s.s.s.',
  'srrsbbbsyyysrrrs',
  '.rr..bb..yy..rr.',
  '..r...b...y...r.',
]);

// ── The Rootcellar ───────────────────────────────────────────────────────────
export const CELLAR_ROOTS = art(
  'decor.cellar.roots',
  { r: '#6e4a2e', R: '#9c6c42' },
  ['..r.......', '.rRr...r..', 'r..RrrRr.r', '.....r..R.', '......r...'],
  ['.......r..', '..rrRrR.r.', '.r......Rr', 'R.........', '..........'],
);
export const CELLAR_JAR = art('decor.cellar.jar', { o: O, l: '#8a7a5a', g: '#6a8a3a', G: '#9aba5a', a: '#c8d8c0' }, [
  '.ooo.',
  'olllo',
  'oaGgo',
  'ogGgo',
  'oGggo',
  'oggGo',
  '.ooo.',
]);
export const CELLAR_POTATO = art('decor.cellar.potato', { o: O, p: '#a07a4a', P: '#c89a62', d: '#6a4a2a' }, [
  '.ooo.',
  'oPpPo',
  'opdpo',
  '.ooo.',
]);
export const CELLAR_ROOT_TRIM = art('decor.cellar.rootTrim', { r: '#6e4a2e', R: '#9c6c42', g: '#7a9440' }, [
  'rRrRrRrRrRrR',
  '.r..R...r.r.',
  '.r..r...R.r.',
  '.R..g...r...',
  '.r......g...',
  '.g..........',
]);

// ── The Candlewick Crypt ─────────────────────────────────────────────────────
export const CRYPT_STUB = art('decor.crypt.stub', { o: O, w: '#e8dcb4', W: '#fff4d8', f: '#ffcf57', F: '#fff3b0', d: '#b8a67a' }, [
  '...F....',
  '...f....',
  '..oWo...',
  '..oWo...',
  '.dowod..',
  'dwwwwwd.',
  '.ddddd..',
]);
export const CRYPT_MOTH = art(
  'decor.crypt.moth',
  { m: '#c8b89a', M: '#efe3c8', k: '#3a3040' },
  ['m.k.m', 'MmkmM', '.m.m.'],
  ['.mkm.', 'MMkMM', '.m.m.'],
);
export const CRYPT_WAX = art('decor.crypt.wax', { w: '#d9c7a0', W: '#f5ead0' }, ['.wWw..', 'wWWwww', '.www..']);
export const CRYPT_DRIP_TRIM = art('decor.crypt.drips', { w: '#d9c7a0', W: '#f5ead0' }, [
  'WwWwWwWwWwWwWwWw',
  '.w..W..w.....W..',
  '.w.....w.....w..',
  '.W.....w........',
  '.......W........',
]);

// ── The Grinding Works ───────────────────────────────────────────────────────
export const WORKS_GEAR = art(
  'decor.works.gear',
  { o: O, b: '#8a6a2e', B: '#c49a45', k: '#2a2f2f' },
  ['..o.o..', '.oBBBo.', 'oBbkbBo', '.Bk.kB.', 'oBbkbBo', '.oBBBo.', '..o.o..'],
);
export const WORKS_BOLTS = art('decor.works.bolts', { i: '#6a6f68', I: '#b8bfb4' }, ['I..i.', 'i.I..', '...Ii']);
export const WORKS_OIL = art('decor.works.oil', { k: '#151818', p: '#4a3a6a', g: '#2a6a5a' }, [
  '.kkkkk..',
  'kkpkgkkk',
  'kgkkkpk.',
  '..kkkk..',
]);
export const WORKS_PIPE_TRIM = art('decor.works.pipe', { o: O, p: '#4c5552', P: '#8a948f', b: '#c49a45' }, [
  'oooooooooooooooo',
  'PPPPPPbPPPPPPPPP',
  'ppppppbppppppppp',
  'oooooooooooooooo',
]);

// ── The Rust Foundry ─────────────────────────────────────────────────────────
// Polish batch 2: the floor's embers are dim and flat (no bright orb with a hot centre), so they never pass for a
// shot — the Foundry's own foes throw ember orbs.
export const FOUNDRY_CRACK = art(
  'decor.foundry.crack',
  { k: '#1a0a06', r: '#a4441a', y: '#d8702c' },
  ['..k......', '.kry.k...', 'k.yrk.rk.', '....kyrk.'],
  ['.....k...', 'k..kyrk..', '.kry...kr', '...k....k'],
);
export const FOUNDRY_SLAG = art('decor.foundry.slag', { o: O, s: '#5a3a30', r: '#8a3a1c' }, [
  '.oooo..',
  'osrsrso',
  '.ooooo.',
]);
export const FOUNDRY_CHAIN = art('decor.foundry.chain', { i: '#5a4a44', I: '#8d7870' }, ['.I..I..', 'I.iI.iI', '.i..i..']);
export const FOUNDRY_CHAIN_TRIM = art('decor.foundry.chainTrim', { i: '#5a4a44', I: '#8d7870', h: '#b8a098' }, [
  'IiIiIiIiIiIiIiIi',
  '...I.......I....',
  '...i.......i....',
  '...I.......I....',
  '..hh......hh....',
  '..h.......h.....',
]);

// ── The Mushroom Hollow ──────────────────────────────────────────────────────
export const HOLLOW_GLOWCAPS = art('decor.hollow.glowcaps', { o: O, c: '#3aa8a8', C: '#9af0e8', s: '#d8e8d0' }, [
  '.oo....',
  'oCCo.oo',
  'occo.CC',
  '.s..occ',
  '.s...s.',
  '.s...s.',
]);
export const HOLLOW_PINKCAP = art('decor.hollow.pinkcap', { o: O, p: '#b0508a', P: '#ff8ad0', s: '#e8dcc8', w: '#ffffff' }, [
  '.ooo.',
  'oPwPo',
  'opppo',
  '..s..',
  '..s..',
]);
export const HOLLOW_SPORES = art('decor.hollow.spores', { g: '#66b86a', G: '#c8ffa0' }, ['G...g', '..G..', 'g..G.', '.g...']);
export const HOLLOW_MOSS_TRIM = art('decor.hollow.mossTrim', { g: '#3f7a4a', G: '#66b86a', c: '#9af0e8' }, [
  'gGgGgGgGgGgG',
  '.g.G..g..G.g',
  '.G.g..G..c.G',
  '.c.g.....g..',
  '...G.....c..',
  '...c........',
]);

// ── The Glimmer Grotto ───────────────────────────────────────────────────────
export const GROTTO_CRYSTALS = art(
  'decor.grotto.crystals',
  { o: O, c: '#3a8ab0', C: '#8ae8ff', w: '#ffffff' },
  ['...o...', '..oCo..', 'o.oCco.', 'oCowCo.', 'oCocCoo', 'occccco', '.ooooo.'],
);
export const GROTTO_AMETHYST = art('decor.grotto.amethyst', { o: O, p: '#a06ae0', P: '#d8b0ff' }, [
  '.o..',
  'oPo.',
  'oPpo',
  'oppo',
  'oppo',
  '.oo.',
]);
export const GROTTO_GLITTER = art('decor.grotto.glitter', { c: '#8ae8ff', p: '#d8b0ff', w: '#ffffff' }, ['c...w', '..p..', 'w..c.']);
export const GROTTO_STALACTITE_TRIM = art('decor.grotto.stalactites', { s: '#48508a', S: '#6f76ad', c: '#8ae8ff' }, [
  'sSsSsSsSsSsSsSsS',
  '.Ss..sS...Ss.s..',
  '.S...s....S..s..',
  '.s...c....s.....',
  '.c........c.....',
]);

// ── The Bone Orchard ─────────────────────────────────────────────────────────
export const ORCHARD_BONE = art(
  'decor.orchard.bone',
  { o: O, b: '#c8bfae', B: '#f0e8d8' },
  ['oo...oo', 'oBBBBBo', 'oo...oo'],
  ['.o...o.', 'oBbbbBo', '.o...o.'],
);
export const ORCHARD_FEATHER = art('decor.orchard.feather', { k: '#2a2630', K: '#4a4456', p: '#6a5e7a' }, [
  '...KKk.',
  '.pKKk..',
  'pKKk...',
]);
export const ORCHARD_LANTERN = art('decor.orchard.lantern', { o: O, i: '#5e584f', y: '#ffcf57', Y: '#fff3b0' }, [
  '..o..',
  '.oio.',
  'oiYio',
  'oyYyo',
  '.ooo.',
]);
export const ORCHARD_CHIME_TRIM = art('decor.orchard.chimes', { r: '#5c5a3a', b: '#c8bfae', B: '#f0e8d8' }, [
  'rrrrrrrrrr',
  '.r..r...r.',
  '.b..r...b.',
  '.B..b...B.',
  '.b..B...b.',
  '....b.....',
]);

// ── The Frostbitten Vault ────────────────────────────────────────────────────
export const VAULT_SNOW = art('decor.vault.snow', { s: '#dcecf5', S: '#ffffff', b: '#a8c4dc' }, [
  '...SSs....',
  '.sSSSSSs..',
  'sSSSSSSSss',
  '.bbbbbbbb.',
]);
// Frost on the floor: a small flat star with a dim, hollow middle (the Vault's foes throw bright ice orbs).
export const VAULT_CRYSTAL = art('decor.vault.crystal', { c: '#8aa8c4', C: '#c8dcec' }, ['C...C', '.c.c.', 'C...C']);
export const VAULT_COIN = art('decor.vault.coin', { i: '#b8d4ea', y: '#d8c070', Y: '#fff0a0' }, ['iiii', 'iYyi', 'iyyi', 'iiii']);
export const VAULT_ICICLE_TRIM = art('decor.vault.icicles', { i: '#b8d4ea', I: '#ffffff' }, [
  'IiIiIiIiIiIiIiIi',
  '.iI..Ii..iI.Ii..',
  '.i...I...i..i...',
  '.I...i...I..I...',
  '.i.......i......',
  '.I..............',
]);

// ── The Eye of the Storm ─────────────────────────────────────────────────────
export const STORM_SCORCH = art('decor.storm.scorch', { k: '#1c1f27', d: '#2c303b', y: '#e8d24a' }, [
  '..dkd...',
  '.dkkkdy.',
  'dkkykkd.',
  '.dkkkd..',
  'y.ddd...',
]);
export const STORM_WISP = art('decor.storm.wisp', { c: '#8a93a8', C: '#c4cad8' }, ['..CCc....', '.CCCCCcc.', 'cCCCCCCCc', '..ccccc..']);
export const STORM_BOLT = art('decor.storm.bolt', { y: '#e8d24a', Y: '#fff79a' }, ['..Y.', '.Yy.', 'YYyy', '..y.', '.y..', 'y...']);
export const STORM_WIND_TRIM = art('decor.storm.wind', { c: '#8a93a8', C: '#c4cad8' }, [
  '..CCCCcc........',
  '........cCCCCc..',
  '.cccCC......ccC.',
]);

// ── The Hollow Nest ──────────────────────────────────────────────────────────
export const NEST_AMBER = art('decor.nest.amber', { o: O, a: '#c88a2a', A: '#ffc04a', w: '#fff0c0' }, [
  '.oo.',
  'oAwo',
  'oAAo',
  'oaAo',
  '.oo.',
]);
export const NEST_SCRAP = art('decor.nest.scrap', { p: '#8a7454', P: '#b8a07a' }, ['PPp...', 'pPPPp.', '.pPPPp', '...pp.']);
export const NEST_LARVA = art('decor.nest.larva', { o: O, l: '#e8dcc0', L: '#fffaf0', k: '#0d0b14' }, [
  '.oooo.',
  'oLLLko',
  'olLlLo',
  '.oooo.',
]);
export const NEST_PAPER_TRIM = art('decor.nest.paperTrim', { p: '#6a5840', P: '#a08c6a', a: '#ffc04a' }, [
  'PpPpPpPpPpPpPpPp',
  '.PPp..pPPp..PPp.',
  '..Pp...pP....p..',
  '...a....a.......',
]);

/** Chapter id → its decoration set (the chapter files reference these). */
export const GUTTER_DECOR_FLOOR: readonly SpriteDef[] = [LEAF_SPRITE, LEAF_SPRITE, PUDDLE_SPRITE];
