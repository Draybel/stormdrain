/**
 * Achievement badges (AchievementDef.icon, the achievements page and the achievement toast): a 16×16 medallion
 * with a small glyph. An achievement may also show an item's icon ('item:<id>') or a character's face
 * ('char:<id>'; 'win:<id>' adds a little crown) — resolved by render/achievementIcon.ts. All original art.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;

/**
 * A medallion badge: a round plate (rim + face colours) with a 10×10 glyph centred on it. Glyph characters are
 * looked up in `glyphPalette` ('.' = the plate shows through).
 */
function badge(name: string, face: string, rim: string, glyph: readonly string[], glyphPalette: Readonly<Record<string, string>>): SpriteDef {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      let c = d <= 7.6 ? (d > 6.6 ? 'o' : d > 5.6 ? 'R' : 'F') : '.';
      // A glint on the rim, top-left.
      if (c === 'R' && dx < -2 && dy < -2) c = 'H';
      const gx = x - 3;
      const gy = y - 3;
      if (gx >= 0 && gx < 10 && gy >= 0 && gy < 10) {
        const g = glyph[gy]![gx]!;
        if (g !== '.') c = g;
      }
      row += c;
    }
    rows.push(row);
  }
  return {
    id: `badge.${name}`,
    w: 16,
    h: 16,
    palette: { o, F: face, R: rim, H: '#fff3c4', ...glyphPalette },
    frames: [rows],
  };
}

const GOLD = '#c98a1e';
const NAVY = '#1c2336';

/** A horned skull: bosses. */
const BOSS = badge(
  'boss',
  NAVY,
  GOLD,
  ['h........h', 'hh......hh', '.hhkkkkhh.', '.kWWWWWWk.', 'kWWWWWWWWk', 'kWppWWppWk', 'kWppWWppWk', 'kWWWWWWWWk', '.kWkWkWkk.', '..kkkkkk..'],
  { k: o, W: '#efe8d6', p: '#e0515a', h: '#d8a860' },
);

/** A splash of rainwater: the first kill. */
const SPLASH = badge(
  'splash',
  NAVY,
  GOLD,
  ['....bb....', '...bwb....', '...bbb....', '..bbwbb...', '..bbbbb...', 'b.bbbbb.b.', 'bb.bbb.bb.', '.b.....b..', 'bbb...bbb.', '..........'],
  { b: '#6d9ac0', w: '#e6f6ff' },
);

/** The sun breaking through: Ending 1. */
const SUN = badge(
  'sun',
  '#3a5a8a',
  GOLD,
  ['....yy....', '.y..yy..y.', '..yoooooy.', '..oYYYYYo.', 'yyoYYWYYoy', 'yyoYYYYYoy', '..oYYYYYo.', '..yoooooy.', '.y..yy..y.', '....yy....'],
  { y: '#ffcf57', Y: '#ffe08a', W: '#fffbe8' },
);

/** A paper hive asleep: Ending 2. */
const HIVE = badge(
  'hive',
  NAVY,
  GOLD,
  ['....oo....', '...oppo...', '..oPPPPo..', '.oppppppo.', '.oPPPPPPo.', 'opppppppo.', 'oPPPkkPPo.', '.oppkkppo.', '..oooooo..', '..........'],
  { p: '#e8c890', P: '#c8a060', k: '#2a1a10' },
);

/** A whirlpool: Ending 3 and the Undertow. */
const WHIRL = badge(
  'whirl',
  '#1a2a44',
  '#8e98b5',
  ['..bbbbb...', '.b.....b..', 'b..www..b.', 'b.w...w.b.', 'b.w.bw.wb.', 'b.w..w..b.', 'b..ww..b..', '.b.....b..', '..bbbbb...', '..........'],
  { b: '#6d9ac0', w: '#e6f6ff' },
);

/** A moth taking wing: transformations. */
const BUTTERFLY = badge(
  'butterfly',
  NAVY,
  GOLD,
  ['.ooo..ooo.', 'oppo..oppo', 'opPPokPPpo', 'opPPokPPpo', '.oppkkppo.', '..oookoo..', '.oppokppo.', '.oppo.oppo', '..oo...oo.', '..........'],
  { p: '#c9a0ff', P: '#fff3c4', k: '#3a2a4a' },
);

/** A crown: wins and big game. */
const CROWN = badge(
  'crown',
  NAVY,
  GOLD,
  ['..........', 'y...y...y.', 'yy.yyy.yy.', 'yyyyyyyyy.', 'yryyByyry.', 'yyyyyyyyy.', 'ddddddddd.', '..........', '..........', '..........'],
  { y: '#ffcf57', d: '#c98a1e', r: '#e0515a', B: '#6fd0ff' },
);

/** Stairs going down: floors and chapters. */
const STAIRS = badge(
  'stairs',
  NAVY,
  GOLD,
  ['..........', 'wwww......', 'ssss......', 'dddwwww...', 'dddssss...', 'ddddddwwww', 'ddddddssss', 'dddddddddd', '..........', '..........'],
  { w: '#e9edf7', s: '#8e98b5', d: '#56648a' },
);

/** A peeking eye: secrets. */
const EYE = badge(
  'eye',
  NAVY,
  GOLD,
  ['..........', '..........', '...oooo...', '.ooWWWWoo.', 'oWWbbbbWWo', 'oWWbkkbWWo', '.ooWbbWoo.', '...oooo...', '..........', '..........'],
  { W: '#e9edf7', b: '#6fcf6f', k: '#07080d' },
);

/** A calendar page: the daily run. */
const CALENDAR = badge(
  'calendar',
  NAVY,
  GOLD,
  ['.o.....o..', 'orrrrrrro.', 'orrrrrrro.', 'owwwwwwwo.', 'owkwkwkwo.', 'owwwwwwwo.', 'owkwkwyyo.', 'owwwwwyyo.', 'ooooooooo.', '..........'],
  { r: '#e0515a', w: '#efe6c8', k: '#56648a', y: '#ffcf57' },
);

/** A rain barrel: challenge rooms. */
const BARREL = badge(
  'barrel',
  NAVY,
  GOLD,
  ['..oooooo..', '.obbbbbbo.', '.oSSSSSSo.', 'obbbbbbbbo', 'obbbbbbbbo', 'oSSSSSSSSo', 'obbbbbbbbo', '.obbbbbbo.', '.oSSSSSSo.', '..oooooo..'],
  { b: '#9a6430', S: '#56648a' },
);

/** Two sparks crossing: synergies. */
const SPARK = badge(
  'spark',
  NAVY,
  GOLD,
  ['.....y....', '....yy....', '...yy..b..', '..yyyybb..', '....yyb...', '...byyy...', '..bbyyyy..', '..b..yy...', '....yy....', '....y.....'],
  { y: '#ffcf57', b: '#6fd0ff' },
);

/** A skull: deaths and kills. */
const SKULL = badge(
  'skull',
  NAVY,
  '#8e98b5',
  ['..oooooo..', '.oWWWWWWo.', 'oWWWWWWWWo', 'oWkkWWkkWo', 'oWkkWWkkWo', 'oWWWkkWWWo', '.oWWWWWWo.', '..oWoWoo..', '..oooooo..', '..........'],
  { W: '#efe8d6', k: '#07080d' },
);

/** A storm cloud: the Eye of the Storm. */
const CLOUD = badge(
  'cloud',
  '#2a3350',
  GOLD,
  ['...ooo....', '..owwwo...', '.owwwwwoo.', 'owwwwwwwwo', 'owccwwccwo', '.oooooooo.', '...yy.....', '..yy......', '...yy.....', '....y.....'],
  { w: '#c9d3f0', c: '#8e98b5', y: '#ffcf57' },
);

/** A cracked drain grate: the hidden route. */
const GRATE = badge(
  'grate',
  NAVY,
  GOLD,
  ['..........', '.oooooooo.', '.oSkSkSko.', '.oSkSkSko.', '.oSkSSkSo.', '.oSSkSkSo.', '.oSkSkSko.', '.oooooooo.', '..........', '..........'],
  { S: '#8691ad', k: '#07080d' },
);

/** A gumball machine: robbing a shop. */
const GUMBALL = badge(
  'gumball',
  NAVY,
  GOLD,
  ['...oooo...', '..oabcdo..', '.oadbacdo.', '.obcadbao.', '..odcbao..', '...oooo...', '..ommmmo..', '..omkkmo..', '..ommmmo..', '..oooooo..'],
  { a: '#ff6a8a', b: '#6ad0ff', c: '#ffe06a', d: '#8aff9a', m: '#c0403a', k: '#1a0e10' },
);

/** A sock on a line: a floor without a hit. */
const SOCK = badge(
  'sock',
  NAVY,
  GOLD,
  ['..........', '...oooo...', '...oyyo...', '...owwo...', '...oyyo...', '...owwo...', '..oyyyo...', '.oyyyyo...', '.oooooo...', '..........'],
  { y: '#f5c52e', w: '#e9edf7' },
);

/** A little satchel: chests. */
const CHEST = badge(
  'chest',
  NAVY,
  GOLD,
  ['..........', '...oooo...', '..o....o..', '.oooooooo.', '.obbbbbbo.', '.oBBkkBBo.', '.obbyybbo.', '.obbbbbbo.', '.oooooooo.', '..........'],
  { b: '#8a5a2b', B: '#b98040', k: '#3a2410', y: '#ffcf57' },
);

/** A gold coin: coins held. */
const COIN = badge(
  'coin',
  NAVY,
  GOLD,
  ['..........', '...oooo...', '..oyyyyo..', '.oyYyyyyo.', '.oyYyddyo.', '.oyyyddyo.', '.oyyyyyyo.', '..oyyyyo..', '...oooo...', '..........'],
  { y: '#ffcf57', Y: '#fff3c4', d: '#c98a1e' },
);

/** A bundle tied with string: carrying lots of things. */
const BAG = badge(
  'bag',
  NAVY,
  GOLD,
  ['...o..o...', '....oo....', '...oyyo...', '..obbbbo..', '.obbBbbbo.', '.obBbbbbo.', '.obbbbbbo.', '.obbbbbbo.', '..oooooo..', '..........'],
  { b: '#6a4a8a', B: '#9a7ac0', y: '#ffcf57' },
);

/** Every badge by name (AchievementDef.icon). */
export const ACHIEVEMENT_BADGES: Readonly<Record<string, SpriteDef>> = {
  boss: BOSS,
  splash: SPLASH,
  sun: SUN,
  hive: HIVE,
  whirl: WHIRL,
  butterfly: BUTTERFLY,
  crown: CROWN,
  stairs: STAIRS,
  eye: EYE,
  calendar: CALENDAR,
  barrel: BARREL,
  spark: SPARK,
  skull: SKULL,
  cloud: CLOUD,
  grate: GRATE,
  gumball: GUMBALL,
  sock: SOCK,
  chest: CHEST,
  coin: COIN,
  bag: BAG,
};

/** A tiny crown drawn over a character's face for 'win:<id>' icons. */
export const WIN_CROWN: SpriteDef = {
  id: 'badge.winCrown',
  w: 7,
  h: 5,
  palette: { o, y: '#ffcf57', r: '#e0515a' },
  frames: [['y..y..y', 'yy.y.yy', 'yyyyyyy', 'yyryryy', 'ooooooo']],
};
