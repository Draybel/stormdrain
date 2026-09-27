/**
 * Trinket art for the item-C set (all original pixel maps, 14×14): small pocket things drawn a
 * little smaller than item icons so they read as trinkets. 1 px dark outline, highlight + shade.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

function icon(id: string, palette: Record<string, string>, rows: string[]): SpriteDef {
  return { id: `item.${id}`, w: 14, h: 14, palette: { o, ...palette }, frames: [rows] };
}

/** Rusty Thimble: a dimpled thimble with rust spots. */
export const ICON_RUSTY_THIMBLE = icon('rusty-thimble', { M: '#b8c0d0', m: '#7a8498', h: '#ffffff', R: '#b0603a' }, [
  '..............',
  '..............',
  '.....oooo.....',
  '....oMMMMo....',
  '...oMhMmMMo...',
  '...oMmMMmMo...',
  '...ohMmMMRo...',
  '...oMMMmRMo...',
  '...oMRMMMmo...',
  '..oMMMMRMMMo..',
  '..oMMMMMMMMo..',
  '...oooooooo...',
  '..............',
  '..............',
]);

/** Bent Paperclip: a thin silver clip (drawn as bare wire), its outer end kinked out of shape. */
export const ICON_BENT_PAPERCLIP = icon('bent-paperclip', { S: '#c9d3e6', s: '#8e98b5', h: '#ffffff' }, [
  '..............',
  '.....hSS......',
  '....S...S.....',
  '....S...S.....',
  '....S.S.S..S..',
  '....S.S.S.S...',
  '....S.S.S.S...',
  '....S.S.S.s...',
  '....S.S.S.s...',
  '....s.S.S.s...',
  '....s.s.s.s...',
  '....s..s..s...',
  '.....sssss....',
  '..............',
]);

/** Matchbook: a red matchbook with one match already lit. */
export const ICON_MATCHBOOK = icon('matchbook', { y: '#fff27a', Y: '#ffcf57', R: '#d8404a', W: '#f3e6c8', K: '#8a6a42', k: '#5a3a1e' }, [
  '.......y......',
  '......yYy.....',
  '.......R......',
  '.......W......',
  '..oooooWoooo..',
  '..oRRRRWRRRo..',
  '..oRYYRRRRRo..',
  '..oRYYRRRRRo..',
  '..oRRRRRRRRo..',
  '..oKKKKKKKKo..',
  '..okkkkkkkko..',
  '..oooooooooo..',
  '..............',
  '..............',
]);

/** Cracked Compass: a brass compass, its glass cracked across. */
export const ICON_CRACKED_COMPASS = icon('cracked-compass', { Y: '#e0b040', W: '#e8eef8', R: '#e0515a', B: '#4a7ad0', k: '#5a6480' }, [
  '..............',
  '......oo......',
  '.....oYYo.....',
  '...oooooooo...',
  '..oYWWWWWWYo..',
  '.oYWWWRWWkWYo.',
  '.oYWWWRWkWWYo.',
  '.oYWWWokWWWYo.',
  '.oYWWkBWWWWYo.',
  '.oYWkWBWWWWYo.',
  '..oYWWBWWWYo..',
  '...oYYYYYYo...',
  '....oooooo....',
  '..............',
]);

/** Pocket Lint: a very lucky ball of fluff. */
export const ICON_POCKET_LINT = icon('pocket-lint', { L: '#a8a0b8', l: '#7a7090', s: '#9be35a' }, [
  '..............',
  '..............',
  '.....s....s...',
  '....oooo......',
  '...oLLLLoo....',
  '..oLlLLLLLo...',
  '.oLLLLlLLLLo..',
  '.oLlLLLLLlLo..',
  '..oLLLlLLLo.s.',
  '...oLLLLLo....',
  '....ooooo.....',
  '..s...........',
  '..............',
  '..............',
]);

/** Glass Eye: a glass marble eye with a blue iris. */
export const ICON_GLASS_EYE = icon('glass-eye', { W: '#f3f0f8', w: '#b8b0c8', h: '#ffffff', B: '#4a9ad0', k: '#1a1a28' }, [
  '..............',
  '..............',
  '....oooooo....',
  '...oWWWWWWo...',
  '..oWhWWWWWWo..',
  '..oWWBBBBWWo..',
  '..oWBBkkBBWo..',
  '..oWBBkkBBwo..',
  '..oWWBBBBWwo..',
  '..oWWWWWWwwo..',
  '...owwwwwwo...',
  '....oooooo....',
  '..............',
  '..............',
]);

/** Baby Tooth: somebody's first wobbly tooth. */
export const ICON_BABY_TOOTH = icon('baby-tooth', { W: '#f3efe0', w: '#c8c0a8', h: '#ffffff' }, [
  '..............',
  '..............',
  '...oooooooo...',
  '..oWWhWWWWWo..',
  '..oWhWWWWWwo..',
  '..oWWWWWWWwo..',
  '..oWWWWWWWwo..',
  '...oWWWWWwo...',
  '...oWWoWWwo...',
  '...oWo.oWwo...',
  '...oWo.oWo....',
  '....o...o.....',
  '..............',
  '..............',
]);

/** Warm Pebble: a smooth stone that stays warm, shimmering. */
export const ICON_WARM_PEBBLE = icon('warm-pebble', { O: '#e8703a', r: '#a83a1a', h: '#ffc080', y: '#ffb347' }, [
  '..............',
  '..............',
  '..............',
  '....oooooo....',
  '...oOOOOOOo...',
  '..oOhOOOOOOo..',
  '.oOhOOOOOOOro.',
  '.oOOOOOOOOrro.',
  '.oOOOOOOOrrro.',
  '..orrrrrrrro..',
  '...oooooooo...',
  '..y......y....',
  '.....y........',
  '..............',
]);

/** Spare Battery: a charged-up battery, green to the brim. */
export const ICON_SPARE_BATTERY = icon('spare-battery', { M: '#c9d3e6', G: '#9be35a', W: '#fffbe8', K: '#3a3a48', k: '#6a7088' }, [
  '..............',
  '......oo......',
  '.....oMMo.....',
  '...oooooooo...',
  '...oGGGGGGo...',
  '...oGGWGGGo...',
  '...oGWWWGGo...',
  '...oGGWGGGo...',
  '...oGGGGGGo...',
  '...oKKKKKKo...',
  '...oKKKKKKo...',
  '...oKkkkKKo...',
  '...oooooooo...',
  '..............',
]);

/** Wind-Up Key: a brass key from the back of a clockwork toy. */
export const ICON_WIND_UP_KEY = icon('wind-up-key', { Y: '#e0b040', y: '#a8781a', k: '#2a2230' }, [
  '..............',
  '..ooo....ooo..',
  '.oYYYo..oYYYo.',
  '.oYkYYooYYkYo.',
  '.oYYYYYYYYYYo.',
  '..oooYYYYooo..',
  '.....oYYo.....',
  '.....oYyo.....',
  '.....oYyo.....',
  '.....oYyo.....',
  '.....oYyooo...',
  '.....oYYYYo...',
  '.....oooooo...',
  '..............',
]);

/** Rubber Duck: a bath duck with an orange beak. */
export const ICON_RUBBER_DUCK = icon('rubber-duck', { Y: '#ffcf57', y: '#d49a20', k: '#2a2230', O: '#e8862e', h: '#fff4b0' }, [
  '..............',
  '....oooo......',
  '...oYYYYo.....',
  '...oYkYYo.....',
  '.oOOYYYYo.....',
  '...ooYYYo..oo.',
  '..oYYYYYYooYYo',
  '.oYYYYYYYYYYYo',
  '.oYhYYYYYYYYyo',
  '.oYYYYYYYYYyyo',
  '..oyyyyyyyyyo.',
  '...ooooooooo..',
  '..............',
  '..............',
]);

/** Dusty Bookmark: a purple ribbon bookmark with a moth stitched on. */
export const ICON_DUSTY_BOOKMARK = icon('dusty-bookmark', { P: '#8a5ab0', W: '#e8dcc0', k: '#6a5a48' }, [
  '..............',
  '....oooooo....',
  '....oPPPPo....',
  '....oWPPWo....',
  '....oWkkWo....',
  '....oPWWPo....',
  '....oPPPPo....',
  '....oPPPPo....',
  '....oPPPPo....',
  '....oPPPPo....',
  '....oPPPPo....',
  '....oPooPo....',
  '....oo..oo....',
  '..............',
]);

/** Wishbone: a little Y of bone, waiting to be pulled. */
export const ICON_WISHBONE = icon('wishbone', { W: '#f3efe0', w: '#c8c0a8' }, [
  '..............',
  '..............',
  '.oo........oo.',
  '.oWo......oWo.',
  '..oWo....oWo..',
  '...oWo..oWo...',
  '....oWooWo....',
  '.....oWWo.....',
  '.....oWWo.....',
  '.....oWWo.....',
  '.....oWwo.....',
  '......oo......',
  '..............',
  '..............',
]);

/** Glowworm Vial: a corked vial with a glowing worm inside. */
export const ICON_GLOWWORM_VIAL = icon('glowworm-vial', { C: '#b98040', G: '#1e3a3a', g: '#9bff7a', h: '#8fb0c8' }, [
  '..............',
  '......oo......',
  '.....oCCo.....',
  '.....oooo.....',
  '....oGGGGo....',
  '....oGgGGo....',
  '....ohgGGo....',
  '....oGggGo....',
  '....oGGgGo....',
  '....oGgGGo....',
  '....oGGGGo....',
  '.....oooo.....',
  '..............',
  '..............',
]);

/** Dowsing Twig: a forked twig that twitches near hidden things. */
export const ICON_DOWSING_TWIG = icon('dowsing-twig', { k: '#8a5a2b', G: '#6ab04a' }, [
  '..............',
  '..o........o..',
  '.oGo......oko.',
  '.okko....okko.',
  '..okko..okko..',
  '...okkookko...',
  '....okkkko....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '.....okko.....',
  '......oo......',
  '..............',
]);

/** Oven Mitt: a quilted red mitt. */
export const ICON_OVEN_MITT = icon('oven-mitt', { R: '#e0515a', W: '#f3efe0', w: '#c8c0a8' }, [
  '..............',
  '....oooo......',
  '...oRRRRo.oo..',
  '..oRRRRRRoRRo.',
  '..oRWRWRWoRRo.',
  '..oRRRRRRRRRo.',
  '..oRWRWRWRRo..',
  '..oRRRRRRRRo..',
  '..oRWRWRWRRo..',
  '..oRRRRRRRRo..',
  '..oWWWWWWWWo..',
  '..oWwWwWwWwo..',
  '..oooooooooo..',
  '..............',
]);

/** Rubber Boots: a pair of green puddle boots. */
export const ICON_RUBBER_BOOTS = icon('rubber-boots', { G: '#4fb070', g: '#2a6a40', h: '#a8e8b8' }, [
  '..............',
  '..............',
  'ooooo..ooooo..',
  'ohhho..ohhho..',
  'oGGGo..oGGGo..',
  'ohGGo..ohGGo..',
  'oGGGo..oGGGo..',
  'oGGGoo.oGGGoo.',
  'oGGGGGooGGGGGo',
  'ogggggoogggggo',
  'oooooooooooooo',
  '..............',
  '..............',
  '..............',
]);

/** Earplugs: two squishy orange foam plugs. */
export const ICON_EARPLUGS = icon('earplugs', { O: '#e8962e', h: '#ffd08a' }, [
  '..............',
  '..............',
  '...oooo.......',
  '..oOOOOo......',
  '..oOhOOo......',
  '..oOOOOo......',
  '...oOOo.......',
  '...oooo.oooo..',
  '.......oOOOOo.',
  '.......oOhOOo.',
  '.......oOOOOo.',
  '........oOOo..',
  '........oooo..',
  '..............',
]);

/** Cat's-Eye Marble: a glass marble with a golden swirl. */
export const ICON_CATS_EYE_MARBLE = icon('cats-eye-marble', { B: '#6fb3e0', b: '#3a7aa8', h: '#ffffff', Y: '#ffcf57', G: '#4f9a3a' }, [
  '..............',
  '..............',
  '....oooooo....',
  '...oBBBBBBo...',
  '..oBhBBBBBBo..',
  '..oBBBYYBBBo..',
  '..oBBYGGYBBo..',
  '..oBBYGGYBbo..',
  '..oBBBYYBBbo..',
  '..oBBBBBBbbo..',
  '...obbbbbbo...',
  '....oooooo....',
  '..............',
  '..............',
]);

/** Crow Feather: a glossy black feather. */
export const ICON_CROW_FEATHER = icon('crow-feather', { K: '#2a2a3a', b: '#4a5a80', k: '#8e98b5' }, [
  '...........o..',
  '..........oKo.',
  '.........oKbo.',
  '........oKKbo.',
  '.......oKKkbo.',
  '......oKKkKo..',
  '.....oKKkKo...',
  '....oKbkKo....',
  '...oKbkKo.....',
  '...oKkKo......',
  '..oKkoo.......',
  '..ok..........',
  '.ok...........',
  '.o............',
]);

/** Hot Coal: a lump of coal still glowing through its cracks. */
export const ICON_HOT_COAL = icon('hot-coal', { K: '#3a2a2a', O: '#ff7a3a', y: '#ffcf57' }, [
  '..............',
  '.....y..y.....',
  '......y.......',
  '....oooooo....',
  '...oKOKKKKo...',
  '..oKOOKKOKKo..',
  '..oKKKKOOKKo..',
  '..oOKKKKKKOo..',
  '..oKKOOKKKKo..',
  '...oKKKKOKo...',
  '....oooooo....',
  '..............',
  '..............',
  '..............',
]);

/** Hungry Tick: a round little tick with big hungry eyes. */
export const ICON_HUNGRY_TICK = icon('hungry-tick', { R: '#8a2a3a', W: '#fffbe8', k: '#1a1a28', h: '#c05a6a' }, [
  '..............',
  '..............',
  '...o......o...',
  '....o....o....',
  '.....oooo.....',
  '..o.oRRRRo.o..',
  '...oRWRRWRo...',
  '.o.oRkRRkRo.o.',
  '..ooRRRRRRoo..',
  '...oRhRRRRo...',
  '..o.oRRRRo.o..',
  '.....oooo.....',
  '..............',
  '..............',
]);

/** Frost Bead: an icy bead on a string, cold to the touch. */
export const ICON_FROST_BEAD = icon('frost-bead', { s: '#c8d0e0', C: '#8fe0ff', c: '#3ab8e8', h: '#ffffff', W: '#dff8ff' }, [
  '......o.......',
  '......s.......',
  '......s.......',
  '.....oooo.....',
  '....oCCCCo....',
  '...oChCCCCo...',
  '...oCCCWCCo...',
  '...oCCWCCco...',
  '...oCCCCcco...',
  '....occcco....',
  '.....oooo.....',
  '......s.......',
  '......o.......',
  '..............',
]);

/** Candy Wrapper: a twisted pink wrapper, still with a sweet in it. */
export const ICON_CANDY_WRAPPER = icon('candy-wrapper', { P: '#ff7ad9', W: '#fffbe8' }, [
  '..............',
  '..............',
  '..............',
  '..............',
  '.oo.oooooo.oo.',
  '.oPoPPWPPPoPo.',
  '.oPPPWPPWPPPo.',
  '.oPoPPPWPPoPo.',
  '.oo.oooooo.oo.',
  '..............',
  '..............',
  '..............',
  '..............',
  '..............',
]);

/** Sparkler Stub: the end of a sparkler that won't stop fizzing. */
export const ICON_SPARKLER_STUB = icon('sparkler-stub', { y: '#fff27a', Y: '#ffcf57', W: '#ffffff', k: '#8e98b5' }, [
  '..y.......y...',
  '....y.Y.y.....',
  '.y...YWY...y..',
  '...y.YWY.y....',
  '......k.......',
  '......k.......',
  '.....oko......',
  '.....oko......',
  '.....oko......',
  '.....oko......',
  '.....oko......',
  '.....oko......',
  '......o.......',
  '..............',
]);

/** Knucklebone: a bone game piece, worn smooth. */
export const ICON_KNUCKLEBONE = icon('knucklebone', { W: '#e8e0c8', w: '#b0a888' }, [
  '..............',
  '..............',
  '..oo......oo..',
  '.oWWo....oWWo.',
  '.oWWWooooWWWo.',
  '..oWWWWWWWWo..',
  '...oWWWWWWo...',
  '..oWWWWWWWWo..',
  '.oWWWooooWWwo.',
  '.oWwo....owwo.',
  '..oo......oo..',
  '..............',
  '..............',
  '..............',
]);

/** Busker's Cup: a tin cup with a coin dropping in. */
export const ICON_BUSKERS_CUP = icon('buskers-cup', { Y: '#ffcf57', y: '#c8903a', M: '#b8c0d0', m: '#7a8498', h: '#ffffff' }, [
  '..............',
  '.....oo.......',
  '....oYYo......',
  '....oYyo......',
  '.....oo.......',
  '..oooooooooo..',
  '..oMhMMMMMmo..',
  '..oMMMMMMMmo..',
  '...oMMMMMmo...',
  '...oMMMMMmo...',
  '...oMMMMMmo...',
  '....ommmmo....',
  '....oooooo....',
  '..............',
]);

/** Mothball: a white mothball, and a moth making a quick exit. */
export const ICON_MOTHBALL = icon('mothball', { W: '#f3f0e8', w: '#b8b4a8', h: '#ffffff', s: '#c8c0e0', k: '#6a5a48' }, [
  '..........o.o.',
  '.........oWkWo',
  '.....oooo.o.o.',
  '....oWWWWo....',
  '...oWhWWWWo...',
  '...oWWWWWwo...',
  '...oWWWWWwo...',
  '...oWWWWwwo...',
  '....owwwwo....',
  '.....oooo.....',
  '..............',
  '.s.........s..',
  '..............',
  '..............',
]);

/** Raindrop Earring: a blue glass drop on a silver hook. */
export const ICON_RAINDROP_EARRING = icon('raindrop-earring', { S: '#c9d3e6', B: '#6fb3e0', b: '#3a7aa8', h: '#ffffff' }, [
  '......SS......',
  '.....S..S.....',
  '.....S........',
  '......S.......',
  '......o.......',
  '.....oBo......',
  '....oBBBo.....',
  '...oBhBBBo....',
  '...oBBBBbo....',
  '...oBBBbbo....',
  '....obbbo.....',
  '.....ooo......',
  '..............',
  '..............',
]);

/** Cracked Monocle: a gold-rimmed monocle on its chain, one crack across the lens. */
export const ICON_CRACKED_MONOCLE = icon('cracked-monocle', { M: '#e0b040', G: '#bfe8ff', h: '#ffffff', k: '#5a6480', s: '#c8903a' }, [
  '..............',
  '...oooooo.....',
  '..oMMMMMMo....',
  '.oMGGhGGGMo...',
  '.oMGhGGkGMo...',
  '.oMGGGkGGMo...',
  '.oMGGkGGGMo...',
  '.oMGkGGGGMo...',
  '..oMMMMMMo....',
  '...oooooo.s...',
  '..........s...',
  '...........s..',
  '...........s..',
  '............s.',
]);

/** Tin Soldier's Medal: a gold medal on a red and blue ribbon. */
export const ICON_TIN_SOLDIER_MEDAL = icon('tin-soldier-medal', { R: '#e0515a', B: '#4a7ad0', Y: '#ffcf57', y: '#c8903a', h: '#fff4b0', M: '#c9d3e6' }, [
  '..............',
  '...oooooooo...',
  '...oRRBBRRo...',
  '...oRRBBRRo...',
  '....oRBBRo....',
  '.....oRRo.....',
  '......oo......',
  '.....oYYo.....',
  '....oYhYYo....',
  '...oYYMYYYo...',
  '...oYMMMYyo...',
  '....oYMYyo....',
  '.....oyyo.....',
  '......oo......',
]);

/** Static Sock: a striped sock crackling with static. */
export const ICON_STATIC_SOCK = icon('static-sock', { W: '#f3efe0', B: '#4a7ad0', h: '#ffffff', y: '#fff27a' }, [
  '..y.......y...',
  '...oooooo.....',
  '...ohWWWo..y..',
  '...oBBBBo.....',
  '.y.oWWWWo.....',
  '...oBBBBo.....',
  '...oWWWWo..y..',
  '...oBBBBoooo..',
  '...oWWWWWWWWo.',
  '...oBBBBBBBBo.',
  '...ohWWWWWWWo.',
  '....ooooooooo.',
  '.y........y...',
  '..............',
]);
