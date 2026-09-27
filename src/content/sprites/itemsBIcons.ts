/**
 * 14×14 icons for the "items B" passives (all original pixel maps): the Toybox, Ossuary, Tidewalker
 * and Glimmer set members plus the general items. Style: 1 px dark outline, a highlight and a shade,
 * dark-but-cute. Familiar items reuse `iconFrom` (the familiar on a soft glow disc).
 */

import type { SpriteDef } from '../../sim/types';
import { iconFrom } from './attack';
import { GUTTER_FERRET_SPRITE, THREADBARE_BEAR_SPRITE, TIN_SENTRY_SPRITE } from './itemsBFamiliars';
import { OUTLINE } from './palette';

const o = OUTLINE;

function icon(id: string, palette: Record<string, string>, rows: string[]): SpriteDef {
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [rows] };
}

// ── Toybox ───────────────────────────────────────────────────────────────────

export const ICON_TIN_SENTRY = iconFrom(TIN_SENTRY_SPRITE, 'item.tin-sentry', '#2e3450');

export const ICON_THREADBARE_BEAR = iconFrom(THREADBARE_BEAR_SPRITE, 'item.threadbare-bear', '#3a3040');

/** Chattering Teeth: a wind-up set of toy teeth on little orange feet, key in its side. */
export const ICON_CHATTERING_TEETH = icon('chattering-teeth', {
  P: '#e87a9a',
  W: '#fffbe8',
  w: '#d8d0b8',
  k: '#3a1a2a',
  Y: '#ffa040',
  K: '#e0b040',
  s: '#c8d0e0',
}, [
  '..............',
  '..s.......s...',
  '.s...........s',
  '...oooooooo...',
  '..oPPPPPPPPo..',
  '.oPWwWwWwWwPoK',
  '.oPkkkkkkkkPoo',
  '.oPWwWwWwWwPoK',
  '..oPPPPPPPPo..',
  '...oooooooo...',
  '...oYo..oYo...',
  '..oYYo..oYYo..',
  '..oooo..oooo..',
  '..............',
]);

/** Stacking Blocks: two lettered wooden blocks with a third balanced on top. */
export const ICON_STACKING_BLOCKS = icon('stacking-blocks', {
  R: '#e0515a',
  r: '#9a2430',
  h: '#fff0d0',
  W: '#f3e6c8',
  B: '#4a7ad0',
  b: '#2a4a90',
  G: '#5fbf6a',
  g: '#2f7a3c',
}, [
  '..............',
  '....oooooo....',
  '....ohRRRo....',
  '....oRWWRo....',
  '....oRWRRo....',
  '....orrrro....',
  '.oooooooooooo.',
  '.ohBBBoohGGGo.',
  '.oBWBBooGWWGo.',
  '.oBWWBooGWGGo.',
  '.oBBWBooGWWGo.',
  '.obbbbooggggo.',
  '.oooooooooooo.',
  '..............',
]);

/** Paper Crown: a folded gold paper crown with jewel dots. */
export const ICON_PAPER_CROWN = icon('paper-crown', { Y: '#ffd35a', h: '#fff4b0', y: '#c9962a', R: '#e0515a', B: '#4fb0e8', s: '#fff27a' }, [
  '..............',
  '...........s..',
  '..s...........',
  '.o....oo....o.',
  'oYo..oYYo..oYo',
  'oYYooYYYYooYYo',
  'oYhYYYYYYYYYYo',
  'oYhYYYYYYYYYyo',
  'oyyRyyByyRyyyo',
  'oYYYYYYYYYYYyo',
  'oyyyyyyyyyyyyo',
  '.oooooooooooo.',
  '..............',
  '..............',
]);

/** Marble Run: a zigzag wooden track, one golden marble at the top and one rolling off the end. */
export const ICON_MARBLE_RUN = icon('marble-run', { M: '#ffcf57', h: '#fffbe8', W: '#c8913e' }, [
  '.oo...........',
  'oMho..........',
  'oMMooo........',
  '.ooWWWoo......',
  '...ooWWWoo....',
  '.....ooWWWoo..',
  '.......ooWWWo.',
  '.........oWWo.',
  '.......ooWWWo.',
  '.....ooWWWoo..',
  '...ooWWWoo.oo.',
  '.ooWWWoo..oMho',
  'oWWWoo....oMMo',
  'oooo.......oo.',
]);

// ── Ossuary ──────────────────────────────────────────────────────────────────

/** Tin Ribcage: a little ribcage of tin around a bony spine. */
export const ICON_TIN_RIBCAGE = icon('tin-ribcage', { S: '#9aa6c0', T: '#c9d3e6', h: '#ffffff' }, [
  '..............',
  '......oo......',
  '.....oSSo.....',
  '..ooooSSoooo..',
  '.ohTTTSSTTTTo.',
  '.oooooSSooooo.',
  'ohTTTTSSTTTTTo',
  'ooooooSSoooooo',
  '.ohTTTSSTTTTo.',
  '..ooooSSoooo..',
  '...ohTSSTTo...',
  '....ooSSoo....',
  '......oo......',
  '..............',
]);

/** Merrythought: a forked bone (the old word for a wishbone), a wish sparkling over it. */
export const ICON_MERRYTHOUGHT = icon('merrythought', { W: '#f0e6cc', w: '#c8b898', h: '#ffffff', y: '#fff27a' }, [
  '......y.......',
  '.oo........oo.',
  'ohWo......oWWo',
  '.oWWo....oWWo.',
  '..oWWo..oWWo..',
  '...oWWooWWo...',
  '....oWWWWo....',
  '.....oWWo.....',
  '.....oWWo.....',
  '.....oWwo.....',
  '.....oWwo.....',
  '....oWWwwo....',
  '....oooooo....',
  '..............',
]);

/** Bone Jacks: two crossed bones from a graveyard game of jacks. */
export const ICON_BONE_JACKS = icon('bone-jacks', { W: '#f0e6cc', w: '#c8b898', h: '#ffffff' }, [
  '.oo........oo.',
  'ohWo......oWWo',
  'oWhWo....oWWwo',
  '.oWWWo..oWWwo.',
  '..oWWWooWWwo..',
  '...oWWWWWwo...',
  '....oWWWWo....',
  '...oWWWWWWo...',
  '..oWWwooWWWo..',
  '.oWWwo..oWWwo.',
  'oWWwo....oWWwo',
  'oWwo......oWwo',
  '.oo........oo.',
  '..............',
]);

/** Crow's Jawbone: a U-shaped jawbone full of little teeth, a black crow feather tucked under it. */
export const ICON_CROWS_JAWBONE = icon('crows-jawbone', { W: '#f0e6cc', w: '#c8b898', t: '#ffffff', K: '#2a2438', h: '#8a80b0', q: '#6a6080' }, [
  '..............',
  '.oo........oo.',
  'oWWo......oWWo',
  'oWto......otWo',
  'oWto......otWo',
  'oWWto....otWwo',
  '.oWWtooootWwo.',
  '..oWWttttWwo..',
  '...owWWWWwo.oo',
  '....oooooooKKo',
  '.........oKho.',
  '........oKKo..',
  '.......oKqo...',
  '......oqo.....',
]);

/** Spine Rattle: a baby rattle with a little skull on a handle of vertebrae, mid-shake. */
export const ICON_SPINE_RATTLE = icon('spine-rattle', {
  W: '#f0e6cc',
  w: '#c8b898',
  h: '#ffffff',
  k: '#2a2230',
  V: '#e0d4b8',
  v: '#a89878',
  s: '#c8d0e0',
}, [
  '....oooooo....',
  '.s.oWWWWWWo.s.',
  '..oWhWWWWWWo..',
  '..oWkkWWkkWo..',
  '..oWWWWWWWwo..',
  '...oWoWoWwo...',
  '....oooooo....',
  '.....oVVo.....',
  '....oVvvVo....',
  '.....oVVo.....',
  '....oVvvVo....',
  '.....oVVo.....',
  '.....oooo.....',
  '..............',
]);

/** Skeleton Key: an iron-grey key whose bow is a tiny grinning skull. */
export const ICON_SKELETON_KEY = icon('skeleton-key', { W: '#e8dcc0', w: '#b8a888', h: '#ffffff', k: '#1d1830' }, [
  '....oooooo....',
  '...oWhWWWwo...',
  '...oWkWWkwo...',
  '...oWkWWkwo...',
  '...oWWkkWwo...',
  '....oWWWwo....',
  '.....oWwo.....',
  '.....oWwo.....',
  '.....oWwo.....',
  '.....oWwooo...',
  '.....oWWWwo...',
  '.....oWwooo...',
  '.....oWWwo....',
  '.....ooooo....',
]);

// ── Tidewalker ───────────────────────────────────────────────────────────────

/** Squelchy Galoshes: a pair of green rubber boots standing in a puddle. */
export const ICON_SQUELCHY_GALOSHES = icon('squelchy-galoshes', { G: '#4fae5a', g: '#2e6e3a', h: '#9be08a', d: '#1f3a24', b: '#6d9ac0', B: '#bfe8ff' }, [
  '..............',
  '.oooo..oooo...',
  '.oggo..oggo...',
  '.ohGo..ohGo...',
  '.ohGo..ohGo...',
  '.oGGo..oGGo...',
  '.oGGGo.oGGGo..',
  '.oGGGGooGGGGo.',
  '.oddddooddddo.',
  '.oooooooooooo.',
  '.b..........b.',
  'bBb..bbbb..bBb',
  '..bbbb..bbbb..',
  '..............',
]);

/** Skipping Stone: a flat pebble skimming over the water, ripples behind it. */
export const ICON_SKIPPING_STONE = icon('skipping-stone', { S: '#8a94b0', s: '#5a6480', h: '#c8d0e0', b: '#6d9ac0', B: '#bfe8ff' }, [
  '..............',
  '.h.........h..',
  '.....oooo.....',
  '...ooSSSSoo...',
  '..oShSSSSSSo..',
  '..oSSSSSSSso..',
  '...oossssoo...',
  '.....oooo.....',
  '..............',
  '..h...h...h...',
  '.bbb..bbb..bbb',
  'b.B.bb.B.bb.Bb',
  '..............',
  '..............',
]);

/** Leaky Bucket: a dented tin bucket spurting water from its holes. */
export const ICON_LEAKY_BUCKET = icon('leaky-bucket', {
  S: '#9aa6c0',
  s: '#5a6480',
  h: '#dfe6f5',
  w: '#3b6f8e',
  k: '#1d2838',
  b: '#6d9ac0',
  B: '#bfe8ff',
}, [
  '....oooooo....',
  '...o......o...',
  '..oooooooooo..',
  '..oSwwwwwwSo..',
  '..oSSSSSSSSo..',
  '..ohSSSSSSso..',
  '...ohSSkSso.b.',
  '...ohSSSSso.b.',
  '.b.okSSSSso...',
  '....oSSSSo....',
  '....oooooo....',
  '.b..........b.',
  'bBb..bbbb..bBb',
  '..............',
]);

/** Tadpole Jar: a corked jar of gutter water with a tadpole wriggling inside. */
export const ICON_TADPOLE_JAR = icon('tadpole-jar', {
  L: '#b98040',
  G: '#9ab4d0',
  h: '#e8f4ff',
  w: '#3b6f8e',
  t: '#2a3a50',
  k: '#1d2838',
  e: '#eaf7ff',
  b: '#bfe8ff',
}, [
  '..............',
  '....oooooo....',
  '....oLLLLo....',
  '...oooooooo...',
  '..oGhwwwbwGo..',
  '..oGhwwwwwGo..',
  '..oGwwwkkkGo..',
  '..oGtttkkeGo..',
  '..oGwwwkkkGo..',
  '..oGwbwwwwGo..',
  '..oGwwwwwwGo..',
  '..oGGGGGGGGo..',
  '...oooooooo...',
  '..............',
]);

/** Startled Frog: a green pond frog, eyes wide, a startled droplet flying off it. */
export const ICON_STARTLED_FROG = icon('startled-frog', { G: '#5fbf6a', g: '#2f7a3c', h: '#b8f0a0', W: '#fffbe8', k: '#1d1830', b: '#8fc4ec' }, [
  '......b.......',
  '..oo..b...oo..',
  '.oWWo....oWWo.',
  '.oWko....okWo.',
  '.ooGGooooGGoo.',
  'oGGhGGGGGGGGGo',
  'oGGGGGGGGGGGGo',
  'oGGkkkkkkkkGGo',
  '.oGGGGGGGGGGo.',
  '.ogGGGGGGGGgo.',
  'oGGo......oGGo',
  'oooo......oooo',
  '..............',
  '..............',
]);

// ── Glimmer ──────────────────────────────────────────────────────────────────

/** Cracked Cat's-Eye: a mint glass marble with a golden swirl and a crack running through it. */
export const ICON_CRACKED_CATS_EYE = icon('cracked-cats-eye', { G: '#9fe8d8', g: '#4aa898', h: '#ffffff', E: '#ffcf57', k: '#1d2838', s: '#c9f4ff' }, [
  '..............',
  '....oooooo....',
  '..ooGGGGGGoo..',
  '.oGhhGGGGGGgo.',
  '.oGhGGEEGGGgo.',
  'oGGGGEEkGGGggo',
  'oGGGEEGkkGGggo',
  'oGGGEEGGkGGggo',
  'oGGGGEEGkkGggo',
  '.oGGGGEEGGkgo.',
  '.ogGGGGGGGggo.',
  '..ooggggggoo..',
  '....oooooo....',
  '.s.........s..',
]);

/** Pocket Prism: a glass prism splitting a beam of light into a little rainbow. */
export const ICON_POCKET_PRISM = icon('pocket-prism', {
  P: '#bfe8ff',
  h: '#ffffff',
  W: '#fffbe8',
  R: '#ff5a78',
  Y: '#ffcf57',
  G: '#7ee06a',
  B: '#6fb3e0',
  y: '#fff27a',
}, [
  '..............',
  '..........y...',
  '..............',
  '.......o...R..',
  '......oPo.RY..',
  '.....oPhPoRYG.',
  '....oPhPPPoYGB',
  'WWWoPhPPPPPoGB',
  '..oPhPPPPPPPoB',
  '.ooooooooooooo',
  '..............',
  '..y.......y...',
  '..............',
  '..............',
]);

/** Rock Salt Crystal: three pink salt cubes stacked up, grains glinting around them. */
export const ICON_ROCK_SALT_CRYSTAL = icon('rock-salt-crystal', { W: '#fff0f4', h: '#ffffff', p: '#e8b0c4', P: '#b87890', s: '#ffe0ec' }, [
  '.s....oo....s.',
  '.....ohWo.....',
  '....oWWWWo....',
  '....opWWPo....',
  '....oppPPo....',
  '.....opPo.....',
  '...oo.oo.oo...',
  '..ohWo..ohWo..',
  '.oWWWWooWWWWo.',
  '.opWWPoopWWPo.',
  '.oppPPooppPPo.',
  '..opPo..opPo..',
  '...oo....oo...',
  's...........s.',
]);

/** Amethyst Heart: a faceted violet crystal in the shape of a heart. */
export const ICON_AMETHYST_HEART = icon('amethyst-heart', { A: '#b07ae8', a: '#7a4ab8', h: '#f0e0ff', F: '#d8b8ff', s: '#ffffff' }, [
  '...........s..',
  '..ooo....ooo..',
  '.oAAAo..oAAAo.',
  'oAhhAAooAAAaao',
  'oAhAAAAFAAAaao',
  'oAAAAAFAAAaaao',
  '.oAAAAFAAAaao.',
  '..oAAAAAAaao..',
  '...oAAAAaao...',
  '....oAAaao....',
  '.....oaao.....',
  '......oo......',
  '..............',
  '..............',
]);

/** Glowstone Pendant: a glowing teal crystal on a cord, humming near hidden things. */
export const ICON_GLOWSTONE_PENDANT = icon('glowstone-pendant', { C: '#7fe8d8', c: '#3aa89a', h: '#ffffff', M: '#e0b040', s: '#c8b898', g: '#bff8f0' }, [
  '..s.......s...',
  '...s.....s....',
  '....s...s.....',
  '.....s.s......',
  '......s.......',
  '.....oMo......',
  '....oCCCo.....',
  '.g.oCChCCo....',
  '...oCChCCo.g..',
  '...oCCCCco....',
  '...ocCCCco....',
  '....occco.....',
  '.g...oco......',
  '......o.......',
]);

// ── General ──────────────────────────────────────────────────────────────────

/** Hot Water Bottle: a ribbed red rubber bottle with a little gold heart on it. */
export const ICON_HOT_WATER_BOTTLE = icon('hot-water-bottle', { R: '#d8404a', r: '#9a2430', h: '#ff9a9a', S: '#e8dcc0', W: '#ffcf57' }, [
  '.....oooo.....',
  '.....oSSo.....',
  '....oooooo....',
  '...oRRRRRRo...',
  '..oRhRRRRRRo..',
  '..oRhRWRWRro..',
  '..oRRRWWWRro..',
  '..orrrrWrrro..',
  '..oRRRRRRRro..',
  '..orrrrrrrro..',
  '..oRRRRRRRro..',
  '..oRRRRRRrro..',
  '...oooooooo...',
  '..............',
]);

/** Sardine Tin: an opened tin, lid rolled back, two sleepy sardines in golden oil. */
export const ICON_SARDINE_TIN = icon('sardine-tin', {
  T: '#9aa6c0',
  L: '#c9d3e6',
  h: '#ffffff',
  F: '#c8d8e8',
  f: '#7a8aa8',
  e: '#1d1830',
  k: '#c89a40',
}, [
  '....ooooooo...',
  '...oLhLLLLLo..',
  '....ooooooo...',
  '.oooooooooooo.',
  'oTTTTTTTTTTTTo',
  'oTFFFFFFFFFFTo',
  'oTFeFFFFFFffTo',
  'oTkkkkkkkkkkTo',
  'oTFFFFFFFFFFTo',
  'oTffFFFFFFeFTo',
  'oTTTTTTTTTTTTo',
  '.oooooooooooo.',
  '..............',
  '..............',
]);

/** Warming Pan: an old copper bed-warming pan, embers glowing through the holes in its lid. */
export const ICON_WARMING_PAN = icon('warming-pan', { C: '#c8773a', c: '#8a4a24', h: '#f0b070', O: '#ffcf57', H: '#8a5a2b', f: '#ff8a30' }, [
  '..........f...',
  '........f.....',
  '.........f....',
  '......oooooo..',
  '.....oChCCCCo.',
  '....oChOCCOCCo',
  'oooooCCCOCCOCo',
  'HHHHoCOCCOCCCo',
  'ooooocCCCCCCco',
  '.....occcccco.',
  '......oooooo..',
  '..............',
  '..............',
  '..............',
]);

/** Clover in Amber: a four-leaf clover kept forever in a drop of amber. */
export const ICON_CLOVER_IN_AMBER = icon('clover-in-amber', { A: '#f0a030', a: '#b86a18', h: '#ffe0a0', G: '#5fbf6a', g: '#2f7a3c' }, [
  '..............',
  '.....oooo.....',
  '...ooAAAAoo...',
  '..oAhAAAAAAo..',
  '.oAhGGAAGGAao.',
  '.oAAGGAAGGAao.',
  '.oAAAAGGAAAao.',
  '.oAAGGAAGGAao.',
  '.oAAGGAAGGaao.',
  '.oAAAAAgAAaao.',
  '..oAAAAAgaao..',
  '...ooaaaaoo...',
  '.....oooo.....',
  '..............',
]);

/** Bent Horseshoe: a lucky horseshoe with one arm knocked crooked. */
export const ICON_BENT_HORSESHOE = icon('bent-horseshoe', { S: '#aab4cc', s: '#6a7490', h: '#e8eef8', k: '#1d1830', y: '#fff27a' }, [
  '..............',
  '....y.........',
  '.oo.........oo',
  'ohSo.......oSo',
  'ohko......oSo.',
  'ohSo.....oSSo.',
  'ohko.....okSo.',
  'ohSo.....oSSo.',
  'oSSSo...oSSso.',
  '.oSSSoooSSso..',
  '..osSSSSSso...',
  '...ooooooo....',
  '..y.......y...',
  '..............',
]);

/** Grudge Pebble: a small, very grumpy grey pebble. */
export const ICON_GRUDGE_PEBBLE = icon('grudge-pebble', { S: '#8a94b0', s: '#5a6480', h: '#c8d0e0', k: '#1d1830', e: '#fffbe8', x: '#e0515a' }, [
  '..............',
  '...........x..',
  '..........x.x.',
  '....oooooo....',
  '..ooSSSSSSoo..',
  '.oShSSSSSSSso.',
  '.oShkkSSkkSso.',
  'oSSSSkSSkSSsso',
  'oSSSSeSSeSSsso',
  'oSSSSSkkSSSsso',
  '.oSSSkSSkSsso.',
  '..oossssssoo..',
  '....oooooo....',
  '..............',
]);

/** Spare Spoon: a soup spoon with a red drop of something restorative. */
export const ICON_SPARE_SPOON = icon('spare-spoon', { S: '#c9d3e6', s: '#7d89a8', h: '#ffffff', R: '#e0515a' }, [
  '.........ooo..',
  '........oSSSo.',
  '.......oShSSSo',
  '.......oSSSRSo',
  '.......oSSSSo.',
  '......oSSSoo..',
  '.....oSSo.....',
  '....oSSo....R.',
  '...oSSo.......',
  '..oSSo.....R..',
  '.oSso.........',
  'oSso..........',
  'oso...........',
  '.o............',
]);

/** Stray Cat's Bell: a red collar with a golden bell, still ringing. */
export const ICON_STRAY_CATS_BELL = icon('stray-cats-bell', {
  R: '#d8404a',
  r: '#9a2430',
  M: '#c9d3e6',
  Y: '#ffcf57',
  y: '#c9962a',
  h: '#fff4b0',
  k: '#2a2230',
  s: '#fff27a',
}, [
  '..............',
  '.oooooooooooo.',
  'oRRRRRRRRRRRRo',
  'orrrrrMMrrrrro',
  '.oooooMMooooo.',
  '.....oooo.....',
  '.s..oYYYYo..s.',
  '...oYhYYYyo...',
  '...oYhYYYyo...',
  '..oYYYYYYYyo..',
  '..oyyyykyyyo..',
  '..oooooooooo..',
  '......oko.....',
  '..............',
]);

/** Tin Lunchbox: a blue-lidded tin lunchbox with a latch and an apple label. */
export const ICON_TIN_LUNCHBOX = icon('tin-lunchbox', {
  B: '#4a7ad0',
  b: '#2a4a90',
  h: '#dfe6f5',
  R: '#d8404a',
  r: '#9a2430',
  M: '#c9d3e6',
  W: '#f3e6c8',
  G: '#5fbf6a',
}, [
  '..............',
  '.....oooo.....',
  '....o....o....',
  '.oooooooooooo.',
  'oBBBBBBBBBBBBo',
  'ohBBBBBBBBBBbo',
  'ooooooMMoooooo',
  'oRhRRRMMRRRRro',
  'oRhRRWWWWRRRro',
  'oRRRRWGGWRRRro',
  'oRRRRRRRRRRRro',
  'orrrrrrrrrrrro',
  '.oooooooooooo.',
  '..............',
]);

/** Thunder Egg: an egg-shaped stone with a bolt of lightning glowing through its crack. */
export const ICON_THUNDER_EGG = icon('thunder-egg', { R: '#8a7a6a', r: '#5a4a40', h: '#b8a898', Y: '#fff27a', y: '#bfe8ff' }, [
  '...y......y...',
  '.....oooo.....',
  '....oRRRRo....',
  '...oRhRRYRo...',
  '..oRhRRYYRro..',
  '..oRRRYYRRro..',
  '..oRRYYYYRro..',
  '..oRRRRYYRro..',
  '..oRRRYYRRro..',
  '..oRRRYRRrro..',
  '...oRRRRrro...',
  '....oooooo....',
  '.y........y...',
  '..............',
]);

/** Chipped Piggy Bank: a pink piggy bank with a chip in its side and a coin going in. */
export const ICON_CHIPPED_PIGGY_BANK = icon('chipped-piggy-bank', {
  P: '#f0a0b0',
  p: '#c07080',
  h: '#ffd0d8',
  e: '#1d1830',
  S: '#e07a8a',
  Y: '#ffcf57',
  c: '#8a5060',
  k: '#1d1830',
}, [
  '......ooo.....',
  '......oYo.....',
  '....ooooo.....',
  '..ooPPkkPoo...',
  '.oPPPPPPPPPoo.',
  'oPhPPPPPPPePo.',
  'oPhPPPPPPPPPSo',
  'oPPcPPPPPPPPSo',
  'oPPPcPPPPPPPo.',
  '.oppppppppppo.',
  '..oPo.oo.oPo..',
  '..ooo....ooo..',
  '..............',
  '..............',
]);

/** Leather Apron: a scorched leather apron with a little bomb peeking out of its pocket. */
export const ICON_LEATHER_APRON = icon('leather-apron', { L: '#8a5a3a', l: '#5a3a24', h: '#b8845a', K: '#2a2438', y: '#fff27a' }, [
  '...o......o...',
  '....o....o....',
  '....oooooo....',
  '....oLhLLo....',
  '....oLLLLo....',
  'oooooLLLLooooo',
  '..oLLLLLLLLo..',
  '..oLhLLLLLLo..',
  '..oLoooyoLLo..',
  '..oLoKKKoLLo..',
  '..oLoKKKoLLo..',
  '..oLoooooLLo..',
  '..oLLLLLLLlo..',
  '..oooooooooo..',
]);

/** Rusty Toll Box: a rusted coin box with a slot and a tin heart riveted on the front. */
export const ICON_RUSTY_TOLL_BOX = icon('rusty-toll-box', { R: '#a8583a', r: '#6a3424', h: '#d88a60', k: '#1d1830', T: '#c9d3e6', Y: '#ffcf57' }, [
  '......ooo.....',
  '......oYo.....',
  '.oooooooooooo.',
  '.oRhRRkkkRRRo.',
  '.oRhRRRRRRrRo.',
  '.oRRRTTRTTRro.',
  '.oRRRTTTTTRro.',
  '.oRrRRTTTRRro.',
  '.oRRRRRTRRRro.',
  '.orrrrrrrrrro.',
  '.oooooooooooo.',
  '..oo......oo..',
  '..............',
  '..............',
]);

/** Hand-Me-Down Pockets: a patched denim pocket with a coin and a key peeking out. */
export const ICON_HAND_ME_DOWN_POCKETS = icon('hand-me-down-pockets', {
  D: '#4a6aa0',
  s: '#e0b040',
  P: '#c05a4a',
  p: '#e08a70',
  Y: '#ffcf57',
  K: '#c9d3e6',
}, [
  '...oo.....o...',
  '..oYYo...oKo..',
  '..oYYo...oKo..',
  '...oo....oKo..',
  'oooooooooooooo',
  'oDDDDDDDDDDDDo',
  'oDsDsDsDsDsDDo',
  'oDDDDDDDDDDDDo',
  'oDDDDPPPDDDDDo',
  'oDDDDPpPDDDDDo',
  '.oDDDPPPDDDDo.',
  '..oDDDDDDDDo..',
  '...oooooooo...',
  '..............',
]);

/** Bundle of Balloons: red, blue and yellow balloons on tangled strings. */
export const ICON_BUNDLE_OF_BALLOONS = icon('bundle-of-balloons', { R: '#e0515a', B: '#4a7ad0', Y: '#ffcf57', h: '#ffffff', s: '#d8d0b8' }, [
  '.ooo.....ooo..',
  'ohRRo...ohBBo.',
  'oRRRo...oBBBo.',
  'oRRRoooooBBBo.',
  '.oRoohYYooBo..',
  '..o.oYYYo.o...',
  '...soYYYos....',
  '....soYos.....',
  '.....sos......',
  '......s.......',
  '......s.......',
  '.....s........',
  '......s.......',
  '..............',
]);

/** Bedsheet Ghost: a kid-sized bedsheet ghost going "boo". */
export const ICON_BEDSHEET_GHOST = icon('bedsheet-ghost', { W: '#e8eef8', w: '#b8c0d8', h: '#ffffff', k: '#1d1830' }, [
  '..............',
  '....oooooo....',
  '...oWWWWWWo...',
  '..oWhWWWWWWo..',
  '..oWhWWWWWwo..',
  '..oWkkWWkkwo..',
  '..oWkkWWkkwo..',
  '.oWWWWWWWWWwo.',
  '.oWWWWkkWWWwo.',
  'oWWWWWkkWWWwwo',
  'oWWWWWWWWWWwwo',
  'oWWWWWWWWWWwwo',
  'owWowWWowWwowo',
  '..............',
]);

/** Cast-Iron Kettle: a heavy black kettle, steaming. */
export const ICON_CAST_IRON_KETTLE = icon('cast-iron-kettle', { K: '#3a3a48', k: '#23232e', h: '#8a8aa0', s: '#d8e0f0' }, [
  '..........s...',
  '....oooo..s...',
  '...o....o.....',
  '...o....o.....',
  '..oooooooo....',
  '.oKKhKKKKKo.oo',
  'oKKhKKKKKKKoKo',
  'oKhKKKKKKKKoKo',
  'oKhKKKKKKKKKo.',
  'oKKKKKKKKKKko.',
  'okkkkkkkkkkko.',
  '.ooooooooooo..',
  '..............',
  '..............',
]);

/** Burnt Coffee Bean: one very dark, very jittery coffee bean. */
export const ICON_BURNT_COFFEE_BEAN = icon('burnt-coffee-bean', { C: '#7a4a2a', c: '#4a2a18', h: '#b87a4a', k: '#241208', s: '#c8c0b8', y: '#fff27a' }, [
  '..............',
  '....s...s.....',
  '.....s...s....',
  '....oooooo....',
  '..ooCCCCkCoo..',
  '.oChCCCCkCCco.',
  '.oChCCCkCCCco.',
  'yoCCCCCkCCCcoy',
  '.oCCCCkCCCCco.',
  '.oCCCCkCCCcco.',
  '..ooCCkCCcoo..',
  '....oooooo....',
  '..............',
  '..............',
]);

/** Kaleidoscope: a blue tube with a many-coloured star at its end. */
export const ICON_KALEIDOSCOPE = icon('kaleidoscope', {
  B: '#6fb3e0',
  P: '#c9a0ff',
  Y: '#ffcf57',
  R: '#ff5a78',
  W: '#fffbe8',
  G: '#7ee06a',
  T: '#5a7ab0',
  t: '#3a4a80',
  h: '#9ab8e8',
  E: '#e0b040',
}, [
  '....oooooo....',
  '...oBPYYPBo...',
  '..oGYWRRWYGo..',
  '..oYRWWWWRYo..',
  '..oGYWRRWYGo..',
  '...oBPYYPBo...',
  '....oooooo....',
  '....oTTTTo....',
  '....ohTTto....',
  '....ohTTto....',
  '....oTTTto....',
  '...oEEEEEEo...',
  '...oooooooo...',
  '..............',
]);

export const ICON_GUTTER_FERRET = iconFrom(GUTTER_FERRET_SPRITE, 'item.gutter-ferret', '#35506a');
