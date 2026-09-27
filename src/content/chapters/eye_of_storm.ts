/**
 * Chapter 6 (main track): clouds, lightning, wind (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'eye_of_storm' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { STORM_SCORCH, STORM_WISP, STORM_BOLT, STORM_WIND_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'eye_of_storm',
    name: 'The Eye of the Storm',
    floors: [11, 12],
    track: 'main',
    palette: {
      floor: '#363b48',
      floorLight: '#454b5a',
      floorDark: '#2c303b',
      mortar: '#1c1f27',
      deep: '#0a0b10',
      brick: '#474d5e',
      brickShade: '#383d4b',
      brickLight: '#60687e',
      moss: '#8a93a8',
      mossLight: '#c4cad8',
      stone: '#666d80',
      stoneLight: '#9098ad',
      stoneShade: '#474c5c',
      void: '#05060a',
      voidSpeck: '#2a2f45',
      water: '#4a5a7a',
      waterLight: '#8aa0c8',
      leaf: '#e8d24a',
      leafLight: '#fff79a',
    },
    tileset: 'flagstone/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_eye_of_storm',
    curses: ['darkness', 'lostMap', 'deluge', 'unknown'],
    // Slate storm stone and cloud-grey blocks, lightning yellow; scorch marks, cloud wisps, wind.
    decor: { floor: [STORM_SCORCH, STORM_WISP, STORM_BOLT], wall: [STORM_WIND_TRIM], count: [3, 6], streak: '#c4cad8', ambience: 'wind' },
  },
];

export default chapters;
