/**
 * Consumable art for the item-C set (all original pixel maps, 14×14):
 * - Mystery Tonic bottles: three glass shapes (round flask, tall vial, square jar) filled with ten
 *   liquid colours — the colour is how you tell bottles apart before they are identified;
 * - stickers: one peel-off card shape (folded bottom-right corner) with an 8×8 emblem each.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

// ── Tonic bottles ────────────────────────────────────────────────────────────

/** Bottle shapes: C cork, c cork shade, G empty glass, h glint, L liquid, l liquid shade, b bubble. */
const FLASK = [
  '.....oooo.....',
  '.....oCco.....',
  '.....oooo.....',
  '.....oGGo.....',
  '....oGGGGo....',
  '...ohGGGGGo...',
  '..ohLLLLLLlo..',
  '..ohLbLLLLlo..',
  '..oLLLLLbLlo..',
  '..oLLLbLLLlo..',
  '...oLLLLLlo...',
  '....oooooo....',
  '..............',
  '..............',
];

const VIAL = [
  '......oo......',
  '.....oCco.....',
  '.....oooo.....',
  '.....oGGo.....',
  '.....ohGo.....',
  '....ohGGGo....',
  '....ohLLlo....',
  '....ohbLlo....',
  '....oLLLlo....',
  '....oLLblo....',
  '....oLLLlo....',
  '....oLbLlo....',
  '.....oooo.....',
  '..............',
];

const JAR = [
  '....oooooo....',
  '....oCCCco....',
  '....oooooo....',
  '...oGGGGGGo...',
  '..ohGGGGGGGo..',
  '..ohLLLLLLlo..',
  '..ohLLbLLLlo..',
  '..oLLLLLLblo..',
  '..oLbLLLLLlo..',
  '..oLLLLbLLlo..',
  '..oLLLLLLLlo..',
  '..oooooooooo..',
  '..............',
  '..............',
];

/** A tonic bottle: its shape and liquid colours (L body, l shade, b bubbles). */
function bottle(id: string, shape: readonly string[], liquid: string, shade: string, bubble: string): SpriteDef {
  return {
    id: `item.${id}`,
    w: 14,
    h: 14,
    palette: { o, C: '#b98040', c: '#8a5a2b', G: '#7f9fb8', h: '#ffffff', L: liquid, l: shade, b: bubble },
    frames: [shape],
  };
}

export const ICON_TONIC_CRIMSON = bottle('tonic-crimson', FLASK, '#d83a4a', '#8a1a2a', '#ff8a90');
export const ICON_TONIC_AMBER = bottle('tonic-amber', VIAL, '#e8962e', '#9a5a14', '#ffd08a');
export const ICON_TONIC_LEMON = bottle('tonic-lemon', JAR, '#f2d64a', '#a88a1a', '#fff4b0');
export const ICON_TONIC_MOSS = bottle('tonic-moss', FLASK, '#6ab04a', '#3a6a2a', '#b8e890');
export const ICON_TONIC_TEAL = bottle('tonic-teal', VIAL, '#3ac0b0', '#1a7068', '#a8f0e8');
export const ICON_TONIC_COBALT = bottle('tonic-cobalt', JAR, '#3a6ae0', '#1a3a8a', '#9ab8ff');
export const ICON_TONIC_VIOLET = bottle('tonic-violet', FLASK, '#9a5ad8', '#5a2a8a', '#d0a8ff');
export const ICON_TONIC_ROSE = bottle('tonic-rose', VIAL, '#f07ab0', '#a83a6a', '#ffc0dc');
export const ICON_TONIC_MURK = bottle('tonic-murk', JAR, '#7a6a3a', '#3e3418', '#b0a070');
export const ICON_TONIC_PEARL = bottle('tonic-pearl', FLASK, '#e8e8f0', '#a8a8c0', '#ffffff');

// ── Stickers ─────────────────────────────────────────────────────────────────

/** The card: C face, h gloss, P backing showing through the peeled corner; the emblem sits in rows 3-10, cols 3-10. */
const CARD = [
  '..oooooooooo..',
  '.oChhCCCCCCCo.',
  'oChCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCCCCo',
  'oCCCCCCCCCoPPo',
  '.oCCCCCCCCoPo.',
  '..oooooooooo..',
];

/** A sticker: the card in `card` colours with an 8×8 emblem ('.' = card) stamped in the middle. */
function sticker(id: string, card: string, gloss: string, emblem: readonly string[], palette: Record<string, string>): SpriteDef {
  const rows = CARD.map((r, y) => {
    if (y < 3 || y > 10) return r;
    const e = emblem[y - 3]!;
    let out = r.slice(0, 3);
    for (let x = 0; x < 8; x++) out += e[x] === '.' ? r[3 + x] : e[x];
    return out + r.slice(11);
  });
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, C: card, h: gloss, P: '#f3efe0', ...palette }, frames: [rows] };
}

/** Treasure Map: a dotted trail to a red X. */
export const ICON_STICKER_MAP = sticker('treasure-map-sticker', '#e8c890', '#fff4d8', [
  '....R.R.',
  '.....R..',
  '...kR.R.',
  '..k.....',
  '...k....',
  '..k.....',
  '.k......',
  'k.......',
], { R: '#d8404a', k: '#6a3a1e' });

/** Keepsake: a pedestal with a glowing keepsake above it. */
export const ICON_STICKER_KEEPSAKE = sticker('keepsake-sticker', '#4a7ad0', '#9ab8ff', [
  '...Yy...',
  '..YWWy..',
  '...Yy...',
  '........',
  '.oooooo.',
  '..oSSo..',
  '..oSSo..',
  '.oSSSSo.',
], { Y: '#ffcf57', y: '#e8962e', W: '#fffbe8', S: '#c9d3e6' });

/** Lockbox: a little golden chest with its keyhole. */
export const ICON_STICKER_LOCKBOX = sticker('lockbox-sticker', '#3a8a80', '#8ad8c8', [
  '........',
  '.oooooo.',
  'oYYYYYYo',
  'oyyyyyyo',
  'oYYkkYYo',
  'oYYkkYYo',
  'oyyyyyyo',
  '.oooooo.',
], { Y: '#ffcf57', y: '#c8903a', k: '#2a2230' });

/** Gold Rain: coins falling like rain. */
export const ICON_STICKER_GOLD_RAIN = sticker('gold-rain-sticker', '#2c4a66', '#6d9ac0', [
  'YY....YY',
  'Yy....Yy',
  '...YY...',
  '...Yy...',
  'YY....YY',
  'Yy....Yy',
  '...YY...',
  '...Yy...',
], { Y: '#ffcf57', y: '#c8903a' });

/** Bombs: a round bomb with a fizzing fuse. */
export const ICON_STICKER_BOMB = sticker('bomb-sticker', '#d8404a', '#ff9aa0', [
  '.....y.y',
  '......y.',
  '.....k..',
  '..oooo..',
  '.oKKKKo.',
  '.oKgKKo.',
  '.oKKKKo.',
  '..oooo..',
], { y: '#fff27a', k: '#b98040', K: '#3a3a48', g: '#9aa6c0' });

/** Keys: a big brass key. */
export const ICON_STICKER_KEY = sticker('key-sticker', '#4f7447', '#9ad090', [
  '........',
  '.YYY....',
  'Y...Y...',
  'Y...YYYY',
  'Y...Y.Y.',
  '.YYY..Yy',
  '......y.',
  '........',
], { Y: '#ffcf57', y: '#c8903a' });

/** Swirly: a spiral that makes things change. */
export const ICON_STICKER_SWIRLY = sticker('swirly-sticker', '#8a5ab0', '#c09ae0', [
  '..WWWW..',
  '.W....W.',
  'W..WW..W',
  'W.W..W.W',
  'W.W.W..W',
  'W..W..W.',
  '.W...W..',
  '..WWW...',
], { W: '#fffbe8' });

/** Heart: a plump red heart. */
export const ICON_STICKER_HEART = sticker('heart-sticker', '#f3a0c0', '#ffe0ec', [
  '........',
  '.RR..RR.',
  'RqRRRRRR',
  'RRRRRRRR',
  'RRRRRRRr',
  '.RRRRRr.',
  '..RRRr..',
  '...Rr...',
], { R: '#e0515a', r: '#9a2430', q: '#ffc0c0' });

/** Spark: a lightning bolt. */
export const ICON_STICKER_SPARK = sticker('spark-sticker', '#1c2436', '#4a5a80', [
  '....YY..',
  '...YY...',
  '..YY....',
  '.YYYYY..',
  '...YY...',
  '..YY....',
  '.YW.....',
  'W.......',
], { Y: '#fff27a', W: '#ffffff' });

/** Shiny Star: a gold star. */
export const ICON_STICKER_STAR = sticker('shiny-star-sticker', '#3a3060', '#7a70b0', [
  '...YY...',
  '...YY...',
  'YYYWYYYY',
  '.YYYYYY.',
  '..YYYy..',
  '.YYYYyy.',
  '.YY..yy.',
  'Y......y',
], { Y: '#ffcf57', y: '#e8962e', W: '#ffffff' });

/** Ghost: a friendly little sheet ghost. */
export const ICON_STICKER_GHOST = sticker('ghost-sticker', '#5a4a80', '#9a8ac0', [
  '..WWWW..',
  '.WWWWWW.',
  'WWkWWkWW',
  'WWWWWWWW',
  'WWWpWWWW',
  'WWWWWWWW',
  'WWWWWWWW',
  'W.WW.WW.',
], { W: '#f3efe0', k: '#2a2230', p: '#ff8ad0' });
