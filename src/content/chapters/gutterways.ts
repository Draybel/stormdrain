/**
 * Chapter 1 (main track): The Gutterways — rainwater, grates, leaves, slugs (DESIGN.md).
 * Boss and miniboss pools are empty until the boss framework exists (Phase 3); the music id is the
 * track the chapter-music work registers.
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';

const chapters: ChapterDef[] = [
  {
    id: 'gutterways',
    name: 'The Gutterways',
    floors: [1, 2],
    track: 'main',
    palette: GUTTER,
    tileset: 'gutter',
    enemyPool: ['drizzle-blob', 'scurrier', 'sogwing', 'mudleech', 'spitshell', 'grate-gazer', 'puddle-toad', 'grate-crab'],
    bossPool: [],
    minibossPool: [],
    music: 'gutterways',
    curses: ['darkness', 'lostMap', 'blind'],
  },
];

export default chapters;
