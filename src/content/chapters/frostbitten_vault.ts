/**
 * Chapter 5 (alt track): ice, frozen treasure (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'frostbitten_vault' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'frostbitten_vault',
    name: 'The Frostbitten Vault',
    floors: [9, 10],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_frostbitten_vault',
    curses: ['deluge', 'blind', 'maze'],
  },
];

export default chapters;
