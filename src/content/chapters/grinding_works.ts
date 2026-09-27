/**
 * Chapter 3 (main track): clockwork sewer, gears, steam (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'grinding_works' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'grinding_works',
    name: 'The Grinding Works',
    floors: [5, 6],
    track: 'main',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_grinding_works',
    curses: ['lostMap', 'maze', 'deluge'],
  },
];

export default chapters;
