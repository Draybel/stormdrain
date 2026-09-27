/**
 * Chapter 6 (main track): clouds, lightning, wind (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'eye_of_storm' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'eye_of_storm',
    name: 'The Eye of the Storm',
    floors: [11, 12],
    track: 'main',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_eye_of_storm',
    curses: ['darkness', 'lostMap', 'deluge', 'unknown'],
  },
];

export default chapters;
