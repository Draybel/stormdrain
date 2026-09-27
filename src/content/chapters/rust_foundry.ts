/**
 * Chapter 3 (alt track): molten slag, furnaces (DESIGN.md).
 * Stub created before parallel content work: palette/tileset are placeholders until the chapter art pass.
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'rust_foundry' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'rust_foundry',
    name: 'The Rust Foundry',
    floors: [5, 6],
    track: 'alt',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_rust_foundry',
    curses: ['darkness', 'maze', 'unknown'],
  },
];

export default chapters;
