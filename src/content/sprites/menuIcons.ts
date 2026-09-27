/**
 * Menu art (Phase 4B): the title's page tiles (collection jar, bestiary book, stats chart, trophy, gear),
 * 7 px stat icons for the pause menu and the character cards, and small marks (lock, tick). All original.
 */

import type { SpriteDef } from '../../sim/types';
import { Pix } from './paint';
import { OUTLINE } from './palette';

const o = OUTLINE;

/** A glass jar of marbles (Collection). */
export const ICON_COLLECTION: SpriteDef = {
  id: 'menu.collection',
  w: 16,
  h: 16,
  palette: { o, K: '#b98040', k: '#8a5a2b', g: '#22364e', l: '#9fc3e0', y: '#ffcf57', Y: '#fff3c4', b: '#6fd0ff', w: '#ffffff', r: '#e0515a' },
  frames: [
    [
      '................',
      '.....oooooo.....',
      '....oKKKKKKo....',
      '....okkkkkko....',
      '....oooooooo....',
      '.....ollggo.....',
      '..oolggggggggoo.',
      '.olgggyyggbbggo.',
      '.olggyYyggbwbgo.',
      '.olggyyyggbbbgo.',
      '.olgggyggggbggo.',
      '.olggrrggyygggo.',
      '.olgrrrrgyYyggo.',
      '.olggrrgggyyggo.',
      '..oggggggggggo..',
      '...oooooooooo...',
    ],
  ],
};

/** An open book with a creature's eye on the page (Bestiary). */
export const ICON_BESTIARY: SpriteDef = {
  id: 'menu.bestiary',
  w: 16,
  h: 16,
  palette: { o, p: '#e9dfc4', P: '#b9ab88', k: '#6b5a44', c: '#7a3f2c', e: '#ffffff', i: '#e0515a', n: OUTLINE },
  frames: [
    [
      '................',
      '................',
      '.oooooo..oooooo.',
      'oppppppooppppppo',
      'opkkkkpoopeeeepo',
      'opkkkppooeeiieeo',
      'oppppppooeinnieo',
      'opkkkkpooeeiieeo',
      'oppppppoopeeeepo',
      'opkkkppooppppppo',
      'oppppppooppppppo',
      'oPPPPPPooPPPPPPo',
      'occcccccccccccco',
      '.oooooooooooooo.',
      '................',
      '................',
    ],
  ],
};

/** A little bar chart (Stats). */
export const ICON_STATS: SpriteDef = {
  id: 'menu.stats',
  w: 16,
  h: 16,
  palette: { o, F: '#141a2a', a: '#ffcf57', b: '#6fd0ff', r: '#e0515a', w: '#e9edf7' },
  frames: [
    [
      '................',
      '................',
      '.oooooooooooooo.',
      '.oFFFFFFFFFFFFo.',
      '.oFFFFFFFFFaaFo.',
      '.oFFFFFFFFFaaFo.',
      '.oFFFFFFbbFaaFo.',
      '.oFFFFFFbbFaaFo.',
      '.oFFFrrFbbFaaFo.',
      '.oFFFrrFbbFaaFo.',
      '.oFwwrrFbbFaaFo.',
      '.oFwwrrFbbFaaFo.',
      '.oFwwrrFbbFaaFo.',
      '.oFFFFFFFFFFFFo.',
      '.oooooooooooooo.',
      '................',
    ],
  ],
};

/** A gold cup (Achievements). */
export const ICON_TROPHY: SpriteDef = {
  id: 'menu.trophy',
  w: 16,
  h: 16,
  palette: { o, g: '#ffcf57', h: '#fff3c4', d: '#c98a1e', b: '#6a4a2a' },
  frames: [
    [
      '................',
      '..oooooooooooo..',
      'oooghhgggggdgooo',
      'o.oghgggggggdo.o',
      'o.oghgggggggdo.o',
      '.ooghgggggggdoo.',
      '...oggggggddo...',
      '....ogggggdo....',
      '.....ogggdo.....',
      '......oggo......',
      '......oddo......',
      '.....oggggo.....',
      '....obbbbbbo....',
      '....obbbbbbo....',
      '....oooooooo....',
      '................',
    ],
  ],
};

/** A trophy that isn't earned yet (grey). */
export const ICON_TROPHY_DIM: SpriteDef = {
  ...ICON_TROPHY,
  id: 'menu.trophyDim',
  palette: { o, g: '#3a4460', h: '#56648a', d: '#28304a', b: '#232a3b' },
};

/** A cog (Settings), painted. */
export const ICON_GEAR: SpriteDef = (() => {
  const p = new Pix(13, 13);
  const c = 6.5;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    p.disc(c + Math.cos(a) * 4.6, c + Math.sin(a) * 4.6, 1.3, 's');
  }
  p.disc(c, c, 4.2, 's');
  p.disc(c - 0.8, c - 0.8, 2.6, 'l');
  p.disc(c, c, 2.9, 's');
  p.disc(c, c, 1.6, '.');
  p.outline('o');
  return { id: 'menu.gear', w: 13, h: 13, palette: { o, s: '#8e98b5', l: '#c9d3f0' }, frames: [p.rows()] };
})();

// ── 7 px stat icons (pause menu, character select) ───────────────────────────

export const STAT_DAMAGE: SpriteDef = {
  id: 'menu.stat.damage',
  w: 7,
  h: 7,
  palette: { r: '#e0515a', R: '#ff9a9a', W: '#ffffff' },
  frames: [['...r...', '.r.r.r.', '..rRr..', 'rrRWRrr', '..rRr..', '.r.r.r.', '...r...']],
};

export const STAT_RATE: SpriteDef = {
  id: 'menu.stat.rate',
  w: 7,
  h: 7,
  palette: { y: '#ffcf57' },
  frames: [['y..y...', 'yy.yy..', '.yy.yy.', '..yy.yy', '.yy.yy.', 'yy.yy..', 'y..y...']],
};

export const STAT_SHOTSPEED: SpriteDef = {
  id: 'menu.stat.shotSpeed',
  w: 7,
  h: 7,
  palette: { b: '#6fd0ff', w: '#e9f8ff' },
  frames: [['.......', '....b..', '.....b.', 'bbbbbbw', '.....b.', '....b..', '.......']],
};

export const STAT_RANGE: SpriteDef = {
  id: 'menu.stat.range',
  w: 7,
  h: 7,
  palette: { g: '#8fe0a0', w: '#ffffff' },
  frames: [['..ggg..', '.g...g.', 'g..g..g', 'g.gwg.g', 'g..g..g', '.g...g.', '..ggg..']],
};

export const STAT_SPEED: SpriteDef = {
  id: 'menu.stat.speed',
  w: 7,
  h: 7,
  palette: { c: '#d8a860', d: '#9a6a30', w: '#e9edf7' },
  frames: [['..cc...', '..cc...', '..cc.w.', '..ccw..', '.ccccc.', 'cccccdd', 'ddddddd']],
};

export const STAT_LUCK: SpriteDef = {
  id: 'menu.stat.luck',
  w: 7,
  h: 7,
  palette: { g: '#6fcf6f', G: '#aef0a0', s: '#3f8a3f' },
  frames: [['.gg.gg.', 'gGg.gGg', '.ggsgg.', '..sss..', '.ggsgg.', 'gGg.gGg', '.gg.gg.']],
};

/** A small padlock (locked items, characters, achievements). */
export const ICON_LOCK: SpriteDef = {
  id: 'menu.lock',
  w: 7,
  h: 9,
  palette: { o: '#8e98b5', y: '#3a4460', k: '#0d0b14' },
  frames: [['..ooo..', '.o...o.', '.o...o.', 'ooooooo', 'oyyyyyo', 'oyykyyo', 'oyykyyo', 'oyyyyyo', 'ooooooo']],
};

/** A tick (the daily run was played today; earned achievements). */
export const ICON_TICK: SpriteDef = {
  id: 'menu.tick',
  w: 7,
  h: 6,
  palette: { g: '#8fe0a0' },
  frames: [['......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....']],
};

/** Every menu icon (a unit test checks their row widths). */
export const MENU_ICONS: readonly SpriteDef[] = [
  ICON_COLLECTION,
  ICON_BESTIARY,
  ICON_STATS,
  ICON_TROPHY,
  ICON_TROPHY_DIM,
  ICON_GEAR,
  STAT_DAMAGE,
  STAT_RATE,
  STAT_SHOTSPEED,
  STAT_RANGE,
  STAT_SPEED,
  STAT_LUCK,
  ICON_LOCK,
  ICON_TICK,
];
