/**
 * Chapter 4 (main track): spores, glowcaps, beetles (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'mushroom_hollow' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'mushroom_hollow',
    name: 'The Mushroom Hollow',
    floors: [7, 8],
    track: 'main',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_mushroom_hollow',
    curses: ['darkness', 'lostMap', 'blind'],
  },
];

export default chapters;
