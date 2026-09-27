/**
 * Chapter 6 (alt track): wasp paper, amber, larvae (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'hollow_nest' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { NEST_AMBER, NEST_SCRAP, NEST_LARVA, NEST_PAPER_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'hollow_nest',
    name: 'The Hollow Nest',
    floors: [11, 12],
    track: 'alt',
    palette: {
      floor: '#5a4a36',
      floorLight: '#6e5c44',
      floorDark: '#4a3c2c',
      mortar: '#2e251a',
      deep: '#130f0a',
      brick: '#6a5840',
      brickShade: '#564632',
      brickLight: '#8a7454',
      moss: '#c88a2a',
      mossLight: '#ffc04a',
      stone: '#7a6a50',
      stoneLight: '#a08c6a',
      stoneShade: '#56493a',
      void: '#0c0906',
      voidSpeck: '#241c12',
      water: '#b07a2a',
      waterLight: '#f0b050',
      leaf: '#e8dcc0',
      leafLight: '#fffaf0',
    },
    tileset: 'hex/paper',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_hollow_nest',
    curses: ['darkness', 'maze', 'blind', 'leak'],
    // Wasp-paper cells and layered paper walls, amber plugs; amber drops, scraps, sleepy larvae.
    decor: { floor: [NEST_AMBER, NEST_SCRAP, NEST_LARVA], wall: [NEST_PAPER_TRIM], count: [3, 6], ambience: 'motes' },
  },
];

export default chapters;
