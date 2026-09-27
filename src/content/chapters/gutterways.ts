/**
 * Chapter 1 (main track): The Gutterways — rainwater, grates, leaves, slugs (DESIGN.md).
 * Boss and miniboss pools are empty until the boss framework exists (Phase 3); `music` is the chapter
 * loop's track id (CHAPTER_MUSIC in src/audio/music/ids.ts, tracks in src/content/music).
 */

import type { ChapterDef } from '../../sim/types';
import { GUTTER } from '../sprites/palette';
import { GUTTER_DECOR_FLOOR, GUTTER_DRAIN_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'gutterways',
    name: 'The Gutterways',
    floors: [1, 2],
    track: 'main',
    palette: GUTTER,
    tileset: 'flagstone/brick',
    enemyPool: ['drizzle-blob', 'scurrier', 'sogwing', 'mudleech', 'spitshell', 'grate-gazer', 'puddle-toad', 'grate-crab'],
    bossPool: [],
    minibossPool: [],
    music: 'ch_gutterways',
    curses: ['darkness', 'lostMap', 'blind'],
    // Deep blue-grey flagstones and brick, moss, fallen leaves and puddles; rain runs down the walls.
    decor: { floor: GUTTER_DECOR_FLOOR, wall: [GUTTER_DRAIN_TRIM], count: [5, 10], streak: '#7896be', ambience: 'drips' },
  },
];

export default chapters;
