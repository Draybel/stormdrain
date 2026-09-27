/**
 * Chapter 5 (main track): bone trees, crows, lanterns (DESIGN.md).
 * Palette / tileset / decor: the Phase 3A chapter art pass (render/chapterArt.ts recolours the tileset).
 * Enemy/boss pools are derived: every enemy/boss whose `chapters` lists 'bone_orchard' is in the pool
 * (the explicit lists below are merged in, they don't restrict).
 */

import type { ChapterDef } from '../../sim/types';
import { ORCHARD_BONE, ORCHARD_FEATHER, ORCHARD_LANTERN, ORCHARD_CHIME_TRIM } from '../sprites/chapterDecor';

const chapters: ChapterDef[] = [
  {
    id: 'bone_orchard',
    name: 'The Bone Orchard',
    floors: [9, 10],
    track: 'main',
    palette: {
      floor: '#3a3438',
      floorLight: '#4a4247',
      floorDark: '#2f2a2e',
      mortar: '#1e1a1d',
      deep: '#0c0a0c',
      brick: '#4f4550',
      brickShade: '#3e3640',
      brickLight: '#6a5e6c',
      moss: '#5c5a3a',
      mossLight: '#8a8656',
      stone: '#8a8275',
      stoneLight: '#c8bfae',
      stoneShade: '#5e584f',
      void: '#060506',
      voidSpeck: '#151215',
      water: '#5a4a6a',
      waterLight: '#9080a8',
      leaf: '#2a2630',
      leafLight: '#4a4456',
    },
    tileset: 'earth/brick',
    enemyPool: [],
    bossPool: [],
    minibossPool: [],
    music: 'ch_bone_orchard',
    curses: ['darkness', 'lostMap', 'unknown'],
    // Ashen dusk earth and mauve brick, bone-white rocks, dry grass; crow feathers, little lanterns, bone chimes.
    decor: { floor: [ORCHARD_BONE, ORCHARD_FEATHER, ORCHARD_LANTERN], wall: [ORCHARD_CHIME_TRIM], count: [3, 6], ambience: 'motes' },
  },
];

export default chapters;
