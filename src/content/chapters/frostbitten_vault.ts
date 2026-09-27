/**
 * Chapter 5 (alt track): ice, frozen treasure (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'frostbitten_vault' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { VAULT_SNOW, VAULT_CRYSTAL, VAULT_COIN, VAULT_ICICLE_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'frostbitten_vault',
    name: 'The Frostbitten Vault',
    floors: [9, 10],
    track: 'alt',
    palette: {
      floor: '#4a6680',
      floorLight: '#6a8aa6',
      floorDark: '#3d566e',
      mortar: '#2a3c50',
      deep: '#101a26',
      brick: '#5a7a96',
      brickShade: '#48647e',
      brickLight: '#86a8c6',
      moss: '#c8e6f5',
      mossLight: '#f2fbff',
      stone: '#7e9ab4',
      stoneLight: '#b8d4ea',
      stoneShade: '#56708a',
      void: '#081018',
      voidSpeck: '#1a2a3e',
      water: '#6aa0d0',
      waterLight: '#c0e4ff',
      leaf: '#d8c070',
      leafLight: '#fff0a0',
    },
    tileset: 'slab/blocks',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_frostbitten_vault',
    curses: ['deluge', 'blind', 'maze'],
    // Pale ice slabs and frosted blocks; snow drifts, ice crystals, coins frozen in the floor, icicles.
    decor: { floor: [VAULT_SNOW, VAULT_CRYSTAL, VAULT_COIN], wall: [VAULT_ICICLE_TRIM], count: [3, 6], ambience: 'snow' },
  },
];

export default chapters;
