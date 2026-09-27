/**
 * Chapter 2 (alt track): wax, candles, moths (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'candlewick_crypt' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { CRYPT_STUB, CRYPT_MOTH, CRYPT_WAX, CRYPT_DRIP_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'candlewick_crypt',
    name: 'The Candlewick Crypt',
    floors: [3, 4],
    track: 'alt',
    palette: {
      floor: '#2f2a38',
      floorLight: '#3d3748',
      floorDark: '#26212e',
      mortar: '#18141f',
      deep: '#09070d',
      brick: '#443c52',
      brickShade: '#352e41',
      brickLight: '#5b5170',
      moss: '#c9b98a',
      mossLight: '#efe3b8',
      stone: '#5e566e',
      stoneLight: '#857b99',
      stoneShade: '#413b4e',
      void: '#040306',
      voidSpeck: '#100c16',
      water: '#6b4f7a',
      waterLight: '#a785b8',
      leaf: '#d9c7a0',
      leafLight: '#f5ead0',
    },
    tileset: 'slab/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_candlewick_crypt',
    curses: ['darkness', 'blind', 'unknown'],
    // Violet-grey crypt slabs and dressed blocks, cream wax everywhere; candle stubs, moths, drips.
    decor: { floor: [CRYPT_STUB, CRYPT_MOTH, CRYPT_WAX], wall: [CRYPT_DRIP_TRIM], count: [3, 6], streak: '#d9c7a0', ambience: 'motes' },
  },
];

export default chapters;
