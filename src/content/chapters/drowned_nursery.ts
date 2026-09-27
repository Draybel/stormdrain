/**
 * Chapter 1 (alt track): soggy toys, music boxes (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'drowned_nursery' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'drowned_nursery',
    name: 'The Drowned Nursery',
    floors: [1, 2],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_drowned_nursery',
    curses: ['darkness', 'blind', 'deluge'],
  },
];

export default chapters;
