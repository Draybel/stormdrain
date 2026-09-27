/**
 * Chapter 5 (main track): bone trees, crows, lanterns (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'bone_orchard' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'bone_orchard',
    name: 'The Bone Orchard',
    floors: [9, 10],
    track: 'main',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_bone_orchard',
    curses: ['darkness', 'lostMap', 'unknown'],
  },
];

export default chapters;
