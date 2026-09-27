/**
 * Chapter 4 (alt track): crystals, echo bats (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'glimmer_grotto' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'glimmer_grotto',
    name: 'The Glimmer Grotto',
    floors: [7, 8],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_glimmer_grotto',
    curses: ['darkness', 'maze', 'deluge'],
  },
];

export default chapters;
