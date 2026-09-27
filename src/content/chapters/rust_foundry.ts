/**
 * Chapter 3 (alt track): molten slag, furnaces (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'rust_foundry' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { FOUNDRY_CRACK, FOUNDRY_SLAG, FOUNDRY_CHAIN, FOUNDRY_CHAIN_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'rust_foundry',
    name: 'The Rust Foundry',
    floors: [5, 6],
    track: 'alt',
    palette: {
      floor: '#2e2522',
      floorLight: '#3b2f2b',
      floorDark: '#251d1a',
      mortar: '#171210',
      deep: '#080505',
      brick: '#4a302a',
      brickShade: '#3a241f',
      brickLight: '#66423a',
      moss: '#c2521e',
      mossLight: '#ff9a3c',
      stone: '#5a4a44',
      stoneLight: '#7d6860',
      stoneShade: '#3e332f',
      void: '#120503',
      voidSpeck: '#3a1206',
      water: '#8a3a14',
      waterLight: '#e0702a',
      leaf: '#7a3a22',
      leafLight: '#b85a30',
    },
    tileset: 'plate/brick',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_rust_foundry',
    curses: ['darkness', 'maze', 'leak'],
    // Scorched iron plates and soot brick, glowing slag in every seam; embers drift up.
    decor: { floor: [FOUNDRY_CRACK, FOUNDRY_SLAG, FOUNDRY_CHAIN], wall: [FOUNDRY_CHAIN_TRIM], count: [3, 6], streak: '#6a2a14', ambience: 'embers' },
  },
];

export default chapters;
