/**
 * Chapter 4 (alt track): crystals, echo bats (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'glimmer_grotto' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { GROTTO_CRYSTALS, GROTTO_AMETHYST, GROTTO_GLITTER, GROTTO_STALACTITE_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'glimmer_grotto',
    name: 'The Glimmer Grotto',
    floors: [7, 8],
    track: 'alt',
    palette: {
      floor: '#262a45',
      floorLight: '#30365a',
      floorDark: '#1f2238',
      mortar: '#141627',
      deep: '#07080f',
      brick: '#343a63',
      brickShade: '#292e50',
      brickLight: '#48508a',
      moss: '#3a8ab0',
      mossLight: '#8ae8ff',
      stone: '#4a4f7a',
      stoneLight: '#6f76ad',
      stoneShade: '#33375a',
      void: '#030410',
      voidSpeck: '#1a2050',
      water: '#4a5ab8',
      waterLight: '#9aa8ff',
      leaf: '#a06ae0',
      leafLight: '#d8b0ff',
    },
    tileset: 'slab/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_glimmer_grotto',
    curses: ['darkness', 'maze', 'deluge'],
    // Indigo cave slabs, cyan crystal veins, amethysts and glitter; stalactites.
    decor: { floor: [GROTTO_CRYSTALS, GROTTO_AMETHYST, GROTTO_GLITTER], wall: [GROTTO_STALACTITE_TRIM], count: [3, 6], ambience: 'motes' },
  },
];

export default chapters;
