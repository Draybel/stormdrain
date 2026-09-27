/**
 * Chapter 4 (main track): spores, glowcaps, beetles (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'mushroom_hollow' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { HOLLOW_GLOWCAPS, HOLLOW_PINKCAP, HOLLOW_SPORES, HOLLOW_MOSS_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'mushroom_hollow',
    name: 'The Mushroom Hollow',
    floors: [7, 8],
    track: 'main',
    palette: {
      floor: '#23332f',
      floorLight: '#2d403a',
      floorDark: '#1c2926',
      mortar: '#121c1a',
      deep: '#070c0b',
      brick: '#2f4a40',
      brickShade: '#243a32',
      brickLight: '#406655',
      moss: '#3f7a4a',
      mossLight: '#66b86a',
      stone: '#4d5e52',
      stoneLight: '#718a78',
      stoneShade: '#35423a',
      void: '#030605',
      voidSpeck: '#0c1614',
      water: '#3a8a8a',
      waterLight: '#7fe0d8',
      leaf: '#b0508a',
      leafLight: '#ff8ad0',
    },
    tileset: 'earth/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_mushroom_hollow',
    curses: ['darkness', 'lostMap', 'blind'],
    // Deep teal soil and mossy blocks; cyan glowcaps, pink caps, drifting spores.
    decor: { floor: [HOLLOW_GLOWCAPS, HOLLOW_PINKCAP, HOLLOW_SPORES], wall: [HOLLOW_MOSS_TRIM], count: [4, 8], ambience: 'spores' },
  },
];

export default chapters;
