/**
 * Chapter 6 (alt track): wasp paper, amber, larvae (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'hollow_nest' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'hollow_nest',
    name: 'The Hollow Nest',
    floors: [11, 12],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_hollow_nest',
    curses: ['darkness', 'maze', 'blind', 'unknown'],
  },
];

export default chapters;
