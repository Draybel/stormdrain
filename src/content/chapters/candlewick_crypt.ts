/**
 * Chapter 2 (alt track): wax, candles, moths (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'candlewick_crypt' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'candlewick_crypt',
    name: 'The Candlewick Crypt',
    floors: [3, 4],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_candlewick_crypt',
    curses: ['darkness', 'blind', 'unknown'],
  },
];

export default chapters;
