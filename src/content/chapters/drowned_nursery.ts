/**
 * Chapter 1 (alt track): soggy toys, music boxes (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'drowned_nursery' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { NURSERY_BLOCK, NURSERY_DUCK, NURSERY_MARBLE, NURSERY_BUNTING } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'drowned_nursery',
    name: 'The Drowned Nursery',
    floors: [1, 2],
    track: 'alt',
    palette: {
      floor: '#3b4a5c',
      floorLight: '#56697a',
      floorDark: '#2e3a49',
      mortar: '#1f2733',
      deep: '#0e1219',
      brick: '#5d4a63',
      brickShade: '#4a3a50',
      brickLight: '#7a6480',
      moss: '#3f6a6a',
      mossLight: '#5f9290',
      stone: '#8a7d92',
      stoneLight: '#b3a6ba',
      stoneShade: '#5e5468',
      void: '#06080d',
      voidSpeck: '#101722',
      water: '#4a7890',
      waterLight: '#86b6cc',
      leaf: '#c96a7a',
      leafLight: '#f0a6b6',
    },
    tileset: 'checker/panel',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_drowned_nursery',
    curses: ['darkness', 'blind', 'deluge'],
    // Waterlogged nursery tiles and faded mauve wallpaper, teal algae; toy blocks, rubber ducks, marbles, bunting.
    decor: { floor: [NURSERY_BLOCK, NURSERY_DUCK, NURSERY_MARBLE], wall: [NURSERY_BUNTING], count: [3, 6], streak: '#86b6cc', ambience: 'drips' },
  },
];

export default chapters;
