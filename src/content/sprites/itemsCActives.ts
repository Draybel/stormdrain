/**
 * Active item art for the item-C set (all original pixel maps): 14×14 icons, the Tin Soldier familiar
 * and costume layers for the major actives. Style as in starterItems.ts: 1 px dark outline, one
 * highlight and one shade, dark-but-cute.
 *
 * Costumes are anchored like Wren (14 wide, feet at the bottom row): 16-row layers line up with her
 * frame row for row; 20-row layers reach 4 rows above her hood.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

function icon(id: string, palette: Record<string, string>, rows: string[]): SpriteDef {
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [rows] };
}

// ── Active item icons ────────────────────────────────────────────────────────

/** Rumble Drum: a toy drum with crossed sticks and a zigzag band. */
export const ICON_RUMBLE_DRUM = icon('rumble-drum', { W: '#f3efe0', k: '#8a5a2b', Y: '#e0b040', R: '#d8404a', r: '#9a2430', h: '#ff8a8a' }, [
  '..............',
  '..W........W..',
  '...k......k...',
  '....k....k....',
  '..oooooooooo..',
  '.oWWWWWWWWWWo.',
  '.oYYYYYYYYYYo.',
  '.oYRRRYRRRYRo.',
  '.ohYRYRYRYRYo.',
  '.oRRYRRRYRRro.',
  '.oYYYYYYYYYYo.',
  '..oooooooooo..',
  '..............',
  '..............',
]);

/** Storm Kite: a blue diamond kite with a lightning bolt and a bowed tail. */
export const ICON_STORM_KITE = icon('storm-kite', { B: '#4a7ad0', b: '#2a4a90', Y: '#fff27a', s: '#c8d0e0', r: '#e0515a' }, [
  '.......o......',
  '......oBo.....',
  '.....oBBbo....',
  '....oBBYbbo...',
  '...oBBYYbbbo..',
  '..oBBYYYYbbbo.',
  '...oBBBYYbbo..',
  '....oBBYbbo...',
  '.....oBbbo....',
  '......obo.....',
  '.......o......',
  '......s.......',
  '.....rsr......',
  '......s.......',
]);

/** Shaken Snow Globe: a little house in a snowing glass dome on a wooden base. */
export const ICON_SHAKEN_SNOW_GLOBE = icon('shaken-snow-globe', { G: '#a8d8f0', h: '#ffffff', W: '#ffffff', R: '#d8404a', D: '#f3e6c8', k: '#6a3a1e', K: '#a86a3a' }, [
  '..............',
  '....oooooo....',
  '...oGGhGGGo...',
  '..oGhGGWGGGo..',
  '..oGWGGGGWGo..',
  '..oGGGoRoGGo..',
  '..oGGoRRRoWo..',
  '..oWGoDkDoGo..',
  '...oGoDkDoo...',
  '..oooooooooo..',
  '..oKKKKKKKKo..',
  '..okkkkkkkko..',
  '...oooooooo...',
  '..............',
]);

/** Tin Soldier Tin: a toy soldier in a red shako, rifle at his side. */
export const ICON_TIN_SOLDIER_TIN = icon('tin-soldier-tin', { R: '#d8404a', Y: '#ffcf57', S: '#f6c8a0', k: '#2a2230', B: '#3a5ab0', W: '#f3efe0', K: '#9aa6c0' }, [
  '.....ooo......',
  '....oRRRo.....',
  '....oRYRo..o..',
  '....ooooo.oKo.',
  '....oSSSo.oKo.',
  '....okSko.oKo.',
  '...ooooooooKo.',
  '..oBBBBBBBoKo.',
  '..oBYBBBYBoKo.',
  '..oBBBBBBBooo.',
  '...oWWoWWo....',
  '...oWWoWWo....',
  '...okkokko....',
  '...ooooooo....',
]);

/** Hopscotch Chalk: a stick of pink chalk shedding sparkly dust. */
export const ICON_HOPSCOTCH_CHALK = icon('hopscotch-chalk', { P: '#ff9ad0', h: '#ffd0e8', W: '#f3efe0', v: '#c9a0ff' }, [
  '..........oo..',
  '.........ohPo.',
  '........ohPPo.',
  '.......ohPPo..',
  '......ohPPo...',
  '.....ohPPo....',
  '....ohPPo.....',
  '...oWPPo......',
  '...oWWo.......',
  '....oo........',
  '.v.......v....',
  '...v..v.....v.',
  '.....v...v....',
  '..v.......v...',
]);

/** Frozen Pocketwatch: a gold watch with frost creeping over its face. */
export const ICON_FROZEN_POCKETWATCH = icon('frozen-pocketwatch', { Y: '#e0b040', W: '#e8f4ff', k: '#2a3350', C: '#8fe0ff' }, [
  '......oo......',
  '.....oYYo.....',
  '....oooooo....',
  '...oYYYYYYo...',
  '..oYWWWWWWYo..',
  '..oYWWkWWCYo..',
  '..oYWWkWCWYo..',
  '..oYWWkkWWYo..',
  '..oYCWWWWWYo..',
  '..oYWCWWWCYo..',
  '...oYYYYYYo...',
  '....oooooo....',
  '.C.........C..',
  '..C.......C...',
]);

/** Pot Lid: a dented kitchen lid with a knob, still ringing. */
export const ICON_POT_LID = icon('pot-lid', { K: '#3a3a48', M: '#b8c0d0', m: '#7a8498', h: '#ffffff', s: '#fff27a' }, [
  '..............',
  '......oo......',
  '.....oKKo.....',
  '....ooKKoo....',
  '..ooMMMMMMoo..',
  '.oMhhMMMMMMMo.',
  'oMhMMMMMMMMmMo',
  'oMMMMMMMMMmmMo',
  '.ommmmmmmmmmo.',
  '..oooooooooo..',
  '..............',
  '.s..........s.',
  '..s........s..',
  '...s......s...',
]);

/** Bomb Parasol: a striped parasol raining little lit bombs. */
export const ICON_BOMB_PARASOL = icon('bomb-parasol', { R: '#e0515a', W: '#f3efe0', k: '#8a5a2b', K: '#3a3a48', h: '#9aa6c0', y: '#fff27a' }, [
  '......oo......',
  '....ooRWoo....',
  '..ooRWRWRWoo..',
  '.oRWRWRWRWRWo.',
  'oRWRWRWRWRWRWo',
  'ooooookooooooo',
  '..y...k....y..',
  '.oyo..k...oyo.',
  'oKKKo.k..oKKKo',
  'oKhKo.k..oKhKo',
  '.ooo..k...ooo.',
  '.....ok.......',
  '......o.......',
  '..............',
]);

/** Coin-Op Cocoa: a steaming mug of cocoa and the coin it costs. */
export const ICON_COIN_OP_COCOA = icon('coin-op-cocoa', { w: '#c8d0e0', C: '#6a3a1e', W: '#f3efe0', h: '#ffffff', R: '#e0515a', Y: '#ffcf57', y: '#c8903a' }, [
  '...w..w.......',
  '....w..w......',
  '...w..w.......',
  '..oooooooo....',
  '..oCCCCCCo....',
  '..oWWWWWWooo..',
  '..ohRWRWWo.o..',
  '..oWRRRWWo.o..',
  '..oWWRWWWooo..',
  '..oWWWWWWo....',
  '...oooooo.oo..',
  '.........oYYo.',
  '.........oyYo.',
  '..........oo..',
]);

/** Carbon Paper: a written page with its blue copy peeking out behind. */
export const ICON_CARBON_PAPER = icon('carbon-paper', { W: '#f3efe0', k: '#8e98b5', B: '#4a6ad0', b: '#2a3a80' }, [
  '..............',
  '.oooooooo.....',
  '.oWWWWWWo.....',
  '.oWkkkkWoooo..',
  '.oWWWWWWoBBo..',
  '.oWkkkkWobBo..',
  '.oWWWWWWoBBo..',
  '.oWkkWWWobBo..',
  '.oWWWWWWoBBo..',
  '.oooooooobBo..',
  '...obBbbBBBo..',
  '...ooooooooo..',
  '..............',
  '..............',
]);

/** Friendship Bracelet: a beaded bracelet with a little heart charm. */
export const ICON_FRIENDSHIP_BRACELET = icon('friendship-bracelet', { P: '#ff8ad0', Y: '#ffcf57', B: '#6fb3e0', R: '#e0515a' }, [
  '..............',
  '....oooooo....',
  '...oPYBPYBo...',
  '..oBo....oPo..',
  '.oYo......oYo.',
  '.oPo......oBo.',
  '.oBo......oPo.',
  '.oYo......oYo.',
  '..oPo....oBo..',
  '...oBYPoPYo...',
  '.....oRoRo....',
  '.....oRRRo....',
  '......oRo.....',
  '.......o......',
]);

/** Rusty Trowel: a garden trowel over a patch of dug-up dirt. */
export const ICON_RUSTY_TROWEL = icon('rusty-trowel', { k: '#8a5a2b', M: '#9aa6c0', h: '#e8eef8', R: '#b0603a', d: '#6a4a2a' }, [
  '..........ooo.',
  '.........okko.',
  '........okko..',
  '.......okko...',
  '......oMMo....',
  '....ooMMMo....',
  '...oMhMMMMo...',
  '..oMhMRMMMo...',
  '..oMMMMRMo....',
  '..oMRMMMo.....',
  '...oMMMo......',
  '....ooo.......',
  '.d..d.d..d....',
  'dddddddddd....',
]);

/** Jack-in-the-Box: a grinning clown on a spring, popping out of a checkered box. */
export const ICON_JACK_IN_THE_BOX = icon('jack-in-the-box', { W: '#f3efe0', k: '#2a2230', R: '#e0515a', Y: '#c9d3e6', B: '#4a7ad0' }, [
  '....oooo......',
  '...oWWWWo.....',
  '..oWkWWkWo....',
  '..oWWRRWWo....',
  '...oWWWWo.....',
  '....oYYo......',
  '.....oYo......',
  '....oYo.......',
  '..oooooooooo..',
  '..oRRBBRRBBo..',
  '..oBBRRBBRRo..',
  '..oRRBBRRBBo..',
  '..oBBRRBBRRo..',
  '..oooooooooo..',
]);

/** Shrieking Kettle: a red enamel kettle puffing steam out of its spout. */
export const ICON_WHISTLING_KETTLE = icon('shrieking-kettle', { T: '#d8503a', h: '#ffa890', K: '#3a3a48', w: '#c8d0e0' }, [
  '..........w.w.',
  '...........w..',
  '.....oo...w...',
  '....oKKo......',
  '..oooooooo....',
  '.oTTTTTTTTo...',
  'oTThTTTTTToo..',
  'oThTTTTTTTTTTo',
  'oTTTTTTTTTToTo',
  'oTTTTTTTTTTo.o',
  '.oTTTTTTTTo...',
  '..oooooooo....',
  '..............',
  '..............',
]);

/** Weather Vane: a brass rooster above the arrow. */
export const ICON_WEATHER_VANE = icon('weather-vane', { R: '#e0515a', Y: '#e0b040', k: '#2a2230', O: '#e8862e', M: '#7d89a8', A: '#9aa6c0' }, [
  '.....oo.......',
  '....oRRo......',
  '...oRYYo......',
  '..oYkYYo......',
  '.oOYYYYo...oo.',
  '..ooYYYYo.oYo.',
  '....oYYYYoYYo.',
  '....oYYYYYYo..',
  '.....ooooooo..',
  '.......oMo....',
  '.oooooooMoooo.',
  'oAAAAAAAMAAAAo',
  '.oooooooMoooo.',
  '.......oMo....',
]);

/** Rain Stick: a long hollow stick that sounds like rain, dripping. */
export const ICON_RAIN_STICK = icon('rain-stick', { B: '#c89050', b: '#8a5a2b', d: '#6fb3e0' }, [
  '...........oo.',
  '..........oBBo',
  '.........oBbBo',
  '........oBbBo.',
  '.......oBbBo..',
  '......oBbBo...',
  '.....oBbBo....',
  '....oBbBo.....',
  '...oBbBo......',
  '..oBbBo.......',
  '.oBBBo..d..d..',
  '.oooo.........',
  '......d.....d.',
  '...d.....d....',
]);

/** Static Balloon: a blue balloon crackling with static. */
export const ICON_STATIC_BALLOON = icon('static-balloon', { B: '#4a7ad0', b: '#2a4a90', h: '#bfe8ff', y: '#fff27a', s: '#c8d0e0' }, [
  '....oooooo....',
  '...oBBBBBBo...',
  '..oBhhBBBBBo..',
  '..oBhBBBBBBo.y',
  'y.oBBBBBBBBo..',
  '..oBBBBBBBBoy.',
  '..oBBBBBBBbo..',
  '...obBBBBbo...',
  '....obbbbo..y.',
  '.y...oBBo.....',
  '......oo......',
  '.......s......',
  '......s.......',
  '.......s......',
]);

/** Crank Radio: a teal wind-up radio with a dial, a speaker and a crank. */
export const ICON_CRANK_RADIO = icon('crank-radio', { R: '#3a8a80', W: '#f3e6c8', k: '#2a2230', M: '#6a7088', h: '#c9d3e6', K: '#b98040' }, [
  '.........o....',
  '........o.....',
  '.......o......',
  '..ooooooooo...',
  '.oRRRRRRRRRo..',
  '.oRWWWoMMMRo..',
  '.oRWkWoMhMRooo',
  '.oRWWWoMMMRoKo',
  '.oRRRRRRRRRoKo',
  '.oRkRkRkRkRo.o',
  '.ooooooooooo..',
  '..oo.....oo...',
  '..............',
  '..............',
]);

/** Moth-Wing Fan: a folding fan of dusty moth wings. */
export const ICON_MOTH_WING_FAN = icon('moth-wing-fan', { W: '#e8dcc0', w: '#b8a888', s: '#8a6a4a', k: '#6a3a1e' }, [
  '...oooooooo...',
  '..oWwWwWwWwo..',
  '.oWsWwWsWwWso.',
  'oWwWwWwWwWwWwo',
  'oWsWwWsWwWsWwo',
  '.oWwWwWwWwWwo.',
  '..oWwWwWwWwo..',
  '...oWwWwWwo...',
  '....oWwWwo....',
  '.....oWwo.....',
  '......oo......',
  '......kk......',
  '......kk......',
  '......oo......',
]);

/** Drain Plunger: a red rubber cup on a wooden handle. */
export const ICON_DRAIN_PLUNGER = icon('drain-plunger', { k: '#b98040', R: '#d8404a', r: '#9a2430', h: '#ff9aa0' }, [
  '......oo......',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '....oooooo....',
  '...oRRRRRRo...',
  '..oRhRRRRRRo..',
  '..oRRRRRRRRo..',
  '.oRRRRRRRRRro.',
  '.oooooooooooo.',
  '..............',
]);

/** Puffball: a round mushroom puffing out green spores. */
export const ICON_PUFFBALL = icon('puffball', { P: '#e8d8b0', h: '#fffbe8', p: '#b8a070', S: '#8a9a6a', g: '#a8e070' }, [
  '...g...g......',
  '.....g...g....',
  '...g..oo..g...',
  '.....oPPo.....',
  '...ooPPPPoo...',
  '..oPhPPPPPPo..',
  '.oPhPPpPPPpPo.',
  '.oPPPPPPpPPPo.',
  '.oPpPPPPPPPpo.',
  '..oPPPpPPPpo..',
  '...oooooooo...',
  '....oSSSSo....',
  '....oooooo....',
  '..............',
]);

/** Birthday Candles: three lit candles on a slice of frosted cake. */
export const ICON_BIRTHDAY_CANDLES = icon('birthday-candles', {
  y: '#fffbe8',
  Y: '#ffcf57',
  k: '#2a2230',
  P: '#ff8ad0',
  B: '#6fb3e0',
  G: '#9be35a',
  W: '#f3efe0',
  C: '#fff4d8',
  F: '#c8844a',
  f: '#8a5a2b',
}, [
  '..y...y...y...',
  '.yYy.yYy.yYy..',
  '..k...k...k...',
  '.oPo.oBo.oGo..',
  '.oWo.oWo.oWo..',
  '.oPo.oBo.oGo..',
  '.oWo.oWo.oWo..',
  '.oPo.oBo.oGo..',
  'oooooooooooooo',
  'oCCCCCCCCCCCCo',
  'oFCFFCFFFCFFCo',
  'oFFFFFFFFFFFFo',
  'offffffffffffo',
  '.oooooooooooo.',
]);

/** Roller Skate: a red boot skate on yellow wheels. */
export const ICON_ROLLER_SKATE = icon('roller-skate', { R: '#e0515a', W: '#f3efe0', h: '#ff9aa0', M: '#ffcf57' }, [
  '..............',
  '...ooooo......',
  '...oRWRo......',
  '...oRWRo......',
  '...oRWRo......',
  '...oRRRoooo...',
  '...oRRRRRRRo..',
  '...ohRRRRRRRo.',
  '...ooooooooooo',
  '....oo....oo..',
  '...oMMo..oMMo.',
  '...oMMo..oMMo.',
  '....oo....oo..',
  '..............',
]);

/** Wishing Bucket: a well bucket with a coin tumbling in. */
export const ICON_WISHING_BUCKET = icon('wishing-bucket', { Y: '#ffcf57', y: '#c8903a', s: '#fff4b0', K: '#8a5a2b', k: '#6a3a1e', M: '#9aa6c0' }, [
  '.......oo.....',
  '......oYYo..s.',
  '......oYyo....',
  '.......oo..s..',
  '...oooooooo...',
  '..o........o..',
  '.oooooooooooo.',
  '.oKKKKKKKKKKo.',
  '.oKkKKKKKKkKo.',
  '.oMMMMMMMMMMo.',
  '..oKKKKKKKKo..',
  '..oKkKKKKkKo..',
  '..oMMMMMMMMo..',
  '...oooooooo...',
]);

/** Stormglass: a glass orb holding a thundercloud, on a brass stand. */
export const ICON_STORMGLASS = icon('stormglass', { g: '#2a3a66', G: '#8a94b0', Y: '#fff27a', h: '#bfe8ff', K: '#b98040', k: '#8a5a2b' }, [
  '....oooooo....',
  '...ogggggho...',
  '..ogGGGGGGho..',
  '.ogGGGGGGGGgo.',
  '.ogGGGGYGGGgo.',
  '.oggggYYggggo.',
  '.ogggYYgggggo.',
  '..ogggYggggo..',
  '...ogYgggho...',
  '....oooooo....',
  '...oKKKKKKo...',
  '..oKkKKKKkKo..',
  '..oooooooooo..',
  '..............',
]);

/** Grave Bell: a bronze hand bell with a bone handle. */
export const ICON_GRAVE_BELL = icon('grave-bell', { W: '#e8e0c8', B: '#c8903a', b: '#8a5a2b', h: '#ffd8a0' }, [
  '.....oWWo.....',
  '....oWooWo....',
  '.....oWWo.....',
  '......oo......',
  '.....oBBo.....',
  '....oBhBBo....',
  '...oBhBBBBo...',
  '...oBhBBBBo...',
  '..oBBBBBBBBo..',
  '..oBBBBBBBbo..',
  '.obbbbbbbbbbo.',
  '.oooooooooooo.',
  '......oWo.....',
  '.......o......',
]);

// ── Familiar ─────────────────────────────────────────────────────────────────

/** Tin Soldier: a wind-up toy soldier that marches along and shoots (2 frames: left / right step). */
export const TIN_SOLDIER_SPRITE: SpriteDef = {
  id: 'fam.tin-soldier',
  w: 9,
  h: 12,
  anchorX: 4,
  anchorY: 11,
  palette: { o, R: '#d8404a', Y: '#ffcf57', S: '#f6c8a0', k: '#2a2230', B: '#3a5ab0', W: '#f3efe0', K: '#9aa6c0' },
  frames: [
    ['...ooo...', '..oRRRo..', '..oRYRo..', '..ooooo.o', '..oSSSo.K', '..okSko.K', '.oooooooK', '.oBBBBBoK', '.oBYBYBoK', '.oBBBBBoo', '..oWoWo..', '..okoko..'],
    ['...ooo...', '..oRRRo..', '..oRYRo..', '..ooooo.o', '..oSSSo.K', '..okSko.K', '.oooooooK', '.oBBBBBoK', '.oBYBYBoK', '.oBBBBBoo', '..oWoWo..', '...ok.ko.'],
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

/** Storm Kite: the kite flies over Wren's shoulder on its string, bobbing in the wind (animated). */
export const COSTUME_STORM_KITE: SpriteDef = {
  id: 'costume.storm-kite',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, B: '#4a7ad0', b: '#2a4a90', Y: '#fff27a', s: '#c8d0e0' },
  frames: [
    layer(20, 0, ['..........o...', '.........oBo..', '........oBYbo.', '.........obo..', '..........o...', '..........s...', '...........s..', '..........s...', '.........s....', '.........s....', '..........s...']),
    layer(20, 0, ['...........o..', '..........oBo.', '.........oBYbo', '..........obo.', '...........o..', '...........s..', '..........s...', '..........s...', '.........s....', '.........s....', '..........s...']),
  ],
};

/** Stormglass: a small grumpy thundercloud follows over Wren's head, dripping and now and then flashing. */
export const COSTUME_STORM_CLOUD: SpriteDef = {
  id: 'costume.storm-cloud',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, G: '#8a94b0', g: '#5a6480', d: '#6fb3e0', Y: '#fff27a' },
  frames: [
    layer(20, 0, ['.....oooo.....', '...ooGGGGoo...', '..oGGGGGGGGo..', '..oggggggggo..', '...oooooooo...', '....d...d.....', '......d...d...']),
    layer(20, 0, ['.....oooo.....', '...ooGGGGoo...', '..oGGGGGGGGo..', '..oggggggggo..', '...oooooooo...', '......d...d...', '....d...d.....']),
    layer(20, 0, ['.....oooo.....', '...ooGGGGoo...', '..oGGGYGGGGo..', '..ogggYYgggo..', '...ooooYoooo..', '.......Y......', '......Y.......']),
  ],
};

/** Bomb Parasol: the striped parasol held up over the hood. */
export const COSTUME_BOMB_PARASOL: SpriteDef = {
  id: 'costume.bomb-parasol',
  w: 14,
  h: 20,
  anchorX: 7,
  anchorY: 19,
  palette: { o, R: '#e0515a', W: '#f3efe0' },
  frames: [layer(20, 0, ['......oo......', '....ooRWoo....', '..ooRWRWRWoo..', '.oRWRWRWRWRWo.', 'oooooooooooooo'])],
};

/** Shaken Snow Globe: a little snow keeps falling around Wren (animated). */
export const COSTUME_SNOWFALL: SpriteDef = {
  id: 'costume.snowfall',
  w: 14,
  h: 16,
  anchorX: 7,
  anchorY: 15,
  palette: { W: '#ffffff' },
  frames: [
    ['..W.......W...', '..............', 'W.........W...', '.............W', '..............', '.W..........W.', '..............', 'W...........W.', '..............', '.W.........W..', '..............', 'W............W', '..............', '.W..........W.', '..............', '..............'],
    ['..............', '..W.......W...', '..............', 'W.........W...', '.............W', '..............', '.W..........W.', '..............', 'W...........W.', '..............', '.W.........W..', '..............', 'W............W', '..............', '.W..........W.', '..............'],
  ],
};
