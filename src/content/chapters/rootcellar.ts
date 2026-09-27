/**
 * Chapter 2 (main track): roots, jars, pickles, moles (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'rootcellar' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { CELLAR_ROOTS, CELLAR_JAR, CELLAR_POTATO, CELLAR_ROOT_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'rootcellar',
    name: 'The Rootcellar',
    floors: [3, 4],
    track: 'main',
    palette: {
      floor: '#3e3024',
      floorLight: '#4f3d2d',
      floorDark: '#32261c',
      mortar: '#221912',
      deep: '#0f0b08',
      brick: '#5a4330',
      brickShade: '#473424',
      brickLight: '#76593e',
      moss: '#556b2f',
      mossLight: '#7a9440',
      stone: '#6e6152',
      stoneLight: '#978773',
      stoneShade: '#4d4338',
      void: '#070504',
      voidSpeck: '#15100b',
      water: '#56663a',
      waterLight: '#8fa35a',
      leaf: '#8c5a36',
      leafLight: '#b07a4a',
    },
    tileset: 'earth/timber',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_rootcellar',
    curses: ['darkness', 'lostMap', 'maze'],
    // Packed brown earth and timber walls, pickle-green moss; roots, pickle jars, stray potatoes.
    decor: { floor: [CELLAR_ROOTS, CELLAR_JAR, CELLAR_POTATO], wall: [CELLAR_ROOT_TRIM], count: [4, 7], ambience: 'motes' },
  },
];

export default chapters;
