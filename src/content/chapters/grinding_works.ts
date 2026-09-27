/**
 * Chapter 3 (main track): clockwork sewer, gears, steam (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'grinding_works' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { WORKS_GEAR, WORKS_BOLTS, WORKS_OIL, WORKS_PIPE_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'grinding_works',
    name: 'The Grinding Works',
    floors: [5, 6],
    track: 'main',
    palette: {
      floor: '#343a3a',
      floorLight: '#434b4a',
      floorDark: '#2a2f2f',
      mortar: '#1b1f1f',
      deep: '#0a0c0c',
      brick: '#4c5552',
      brickShade: '#3b4340',
      brickLight: '#667370',
      moss: '#8a6a2e',
      mossLight: '#c49a45',
      stone: '#6a6f68',
      stoneLight: '#939a90',
      stoneShade: '#4a4e49',
      void: '#050606',
      voidSpeck: '#111414',
      water: '#3f6a62',
      waterLight: '#79ada2',
      leaf: '#b0813a',
      leafLight: '#e0b25c',
    },
    tileset: 'plate/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_grinding_works',
    curses: ['lostMap', 'maze', 'deluge'],
    // Riveted green-grey plates and brass; loose gears, bolts, oil stains, pipes along the walls.
    decor: { floor: [WORKS_GEAR, WORKS_BOLTS, WORKS_OIL], wall: [WORKS_PIPE_TRIM], count: [3, 6], ambience: 'motes' },
  },
];

export default chapters;
