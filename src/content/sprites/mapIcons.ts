/**
 * Minimap room icons (5×5, drawn on the expanded map and — as coloured dots — on the compact one) and
 * floor-curse icons (7×7, HUD + floor card). Original pixel art.
 */

import type { RoomType, SpriteDef } from '../../sim/types';
import type { FloorCurse } from '../../sim/floor/types';

function icon(id: string, palette: Record<string, string>, rows: string[]): SpriteDef {
  return { id, w: rows[0]!.length, h: rows.length, palette, frames: [rows] };
}

const K = '#0d0b14';

export const MAP_ICON_BOSS = icon('map.boss', { r: '#e0515a', k: K }, ['r...r', 'rrrrr', 'rkrkr', 'rrrrr', '.rkr.']);
export const MAP_ICON_TREASURE = icon('map.treasure', { y: '#ffd76a', g: '#4ad0c0' }, ['y.y.y', 'yyyyy', 'ygygy', 'yyyyy', '.....']);
export const MAP_ICON_SHOP = icon('map.shop', { y: '#ffcf57', k: '#8a5a1a' }, ['.yyy.', 'yykyy', 'ykkky', 'yykyy', '.yyy.']);
export const MAP_ICON_MINIBOSS = icon('map.miniboss', { w: '#c8c0b0', r: '#e07a4a', k: K }, ['w...w', '.www.', 'wrrrw', 'rkrkr', '.rrr.']);
export const MAP_ICON_SECRET = icon('map.secret', { p: '#c9a0ff' }, ['.ppp.', 'p...p', '...p.', '..p..', '..p..']);
export const MAP_ICON_DEEP = icon('map.deepSecret', { p: '#8a6ad0', P: '#d8c0ff' }, ['.PPP.', 'P...P', '..PP.', '.....', '..P..']);
export const MAP_ICON_CHALLENGE = icon('map.challenge', { b: '#b07a42', h: '#d8dce8' }, ['.bbb.', 'bhhhb', 'bbbbb', 'bhhhb', '.bbb.']);
export const MAP_ICON_CURSED = icon('map.cursed', { t: '#c86ad8' }, ['t.t.t', '.ttt.', 'ttttt', '.ttt.', 't.t.t']);
export const MAP_ICON_NOOK = icon('map.nook', { m: '#c8b8e0', k: '#5a4a6a' }, ['m.k.m', 'mmkmm', '.mkm.', 'mm.mm', '.....']);

export const MAP_ICONS: Readonly<Partial<Record<RoomType, SpriteDef>>> = {
  boss: MAP_ICON_BOSS,
  treasure: MAP_ICON_TREASURE,
  shop: MAP_ICON_SHOP,
  miniboss: MAP_ICON_MINIBOSS,
  secret: MAP_ICON_SECRET,
  deepSecret: MAP_ICON_DEEP,
  challenge: MAP_ICON_CHALLENGE,
  cursed: MAP_ICON_CURSED,
  nook: MAP_ICON_NOOK,
};

/** The compact minimap's dot colour per special room type. */
export const MAP_DOT_COLOR: Readonly<Partial<Record<RoomType, string>>> = {
  boss: '#e0515a',
  treasure: '#ffd76a',
  shop: '#ffcf57',
  miniboss: '#e07a4a',
  secret: '#c9a0ff',
  deepSecret: '#8a6ad0',
  challenge: '#d8a060',
  cursed: '#c86ad8',
  nook: '#c8b8e0',
};

export const CURSE_ICON_DARKNESS = icon('curse.darkness', { m: '#8e98b5', M: '#e9edf7' }, [
  '..MMM..',
  '.MMm...',
  'MMm....',
  'MMm....',
  'MMm....',
  '.MMm...',
  '..MMM..',
]);
export const CURSE_ICON_LOSTMAP = icon('curse.lostMap', { p: '#c8b88a', P: '#e8dcb4', k: '#3a3040' }, [
  'PPpPPpP',
  'Pk.kpPp',
  'PPpPkPP',
  'pPPkPpP',
  'PpPPPPp',
  'PPpkPpP',
  'pPPpPPP',
]);
export const CURSE_ICON_MAZE = icon('curse.maze', { w: '#a8c8a0' }, [
  'wwwwwww',
  'w.....w',
  'w.www.w',
  'w.w.w.w',
  'w.w...w',
  'w.wwwww',
  'w......',
]);
export const CURSE_ICON_BLIND = icon('curse.blind', { w: '#e9edf7', k: '#0d0b14', r: '#e0515a' }, [
  '......r',
  '.wwww.r',
  'wwkkwr.',
  'wkkkrww',
  'wwkrww.',
  '.wrww..',
  'r......',
]);
/** The Leaky Roof: a cracked heart with a drop falling from its tip (every hit costs an extra half heart). */
export const CURSE_ICON_LEAK = icon('curse.leak', { h: '#e0515a', H: '#ff9a9a', k: '#0d0b14', b: '#8ec8ff' }, [
  '.hh.hh.',
  'hHhhhhh',
  'hhhkhhh',
  '.hhkhh.',
  '..hkh..',
  '...h...',
  '...b...',
]);
export const CURSE_ICON_DELUGE = icon('curse.deluge', { b: '#6d9ac0', B: '#bfe0ff' }, [
  '.B...B.',
  '.b...b.',
  '...B...',
  'B..b..B',
  'b.....b',
  '..B.B..',
  '..b.b..',
]);

export const CURSE_ICONS: Readonly<Record<FloorCurse, SpriteDef>> = {
  darkness: CURSE_ICON_DARKNESS,
  lostMap: CURSE_ICON_LOSTMAP,
  maze: CURSE_ICON_MAZE,
  blind: CURSE_ICON_BLIND,
  leak: CURSE_ICON_LEAK,
  deluge: CURSE_ICON_DELUGE,
};

/** Curse names for the floor card and the map (original names; the ids are internal). */
export const CURSE_NAMES: Readonly<Record<FloorCurse, string>> = {
  darkness: 'CURSE OF THE BLACKOUT',
  lostMap: 'CURSE OF THE SOGGY MAP',
  maze: 'CURSE OF THE SHIFTING PIPES',
  blind: 'CURSE OF THE FOGGED GLASS',
  leak: 'CURSE OF THE LEAKY ROOF',
  deluge: 'CURSE OF THE DELUGE',
};

/** Short names where space is tight (the pause menu, the debug menu). */
export const CURSE_SHORT: Readonly<Record<FloorCurse, string>> = {
  darkness: 'BLACKOUT',
  lostMap: 'SOGGY MAP',
  maze: 'SHIFTING PIPES',
  blind: 'FOGGED GLASS',
  leak: 'LEAKY ROOF',
  deluge: 'DELUGE',
};

/** What each curse does, in a line (the pause menu under the name). */
export const CURSE_HINTS: Readonly<Record<FloorCurse, string>> = {
  darkness: 'THE LIGHTS ARE OUT',
  lostMap: 'ONLY ROOMS YOU VISITED STAY ON THE MAP',
  maze: 'SOME DOORS LEAD ELSEWHERE',
  blind: 'ITEMS SHOW ONLY UP CLOSE',
  leak: 'EVERY HIT COSTS HALF A HEART MORE',
  deluge: 'SLIPPERY FLOORS',
};
