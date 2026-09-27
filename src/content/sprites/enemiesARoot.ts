/**
 * The Rootcellar (chapter 2, main track) enemy sprites: roots, jars, pickles and moles in earthy
 * browns and brine greens. 1 px dark outline, big (or at least grumpy) eyes, `idle` + `move`,
 * `windup` / `air` where it matters. Side views face RIGHT (the renderer mirrors them).
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const k = '#10122a';
const w = '#f4fbff';

/** Creeping Taproot — a gnarled root knot with beady glowing eyes and wriggling rootlets (14×12). */
const ROOT_TOP = ['......oo......', '.....oMMo.....', '...oooRRooo...', '..oRRhRRRRRo..', '.oRhRRRRRRRRo.'];
const ROOT_FACE = ['oRRRRRRRRRRrot', '.orRRRmmRRRro.', '..orrRRRRrro..'];
export const CREEPING_TAPROOT_SPRITE: SpriteDef = {
  id: 'enemy.creepingTaproot',
  w: 14,
  h: 12,
  palette: {
    o,
    k,
    R: '#8a6a4a',
    r: '#5a4230',
    h: '#b8946a',
    t: '#7a5c3c',
    M: '#6aa04e',
    E: '#e8f080',
    X: '#ff7a4a',
    m: '#2a1a14',
  },
  frames: [
    [...ROOT_TOP, 'toRREERREERRo.', '.oRREkRREkRRo.', ...ROOT_FACE, '.t.oorrrroo.t.', 't..t..oo..t..t'],
    [...ROOT_TOP, '.oRREERREERRot', 'toRREkRREkRRo.', ...ROOT_FACE, 't..oorrrroo..t', '.t.t..oo..t.t.'],
    [...ROOT_TOP, 'toRRXXRRXXRRot', 'toRRXkRRXkRRot', 'oRRRRRRRRRRrot', '.orRRmkkmRRro.', '..orrmmmmrro..', 't..oorrrroo..t', '.t.t..oo..t.t.'],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 7, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Brine Jar — a jar of forgotten pickles on stubby legs, glaring through the glass (12×16). */
const JAR_LID = ['..oooooooo..', '.oLLLhLLLLo.', '.ollllllllo.'];
const JAR_GLASS = [
  '..oooooooo..',
  '.ohGGGGGGGo.',
  'ohGGPGGGGGGo',
  'ohGwwGGGwwGo',
  'oGGwkGPGwkGo',
  'oGPGGmmGGPGo',
  'oGPPGGGGPPGo',
  'oGGPGGGGGPgo',
  'ogGGGGGGGggo',
  '.oggggggggo.',
  '..oooooooo..',
];
export const BRINE_JAR_SPRITE: SpriteDef = {
  id: 'enemy.brineJar',
  w: 12,
  h: 16,
  palette: {
    o,
    k,
    w,
    L: '#b0a8b8',
    l: '#6a6280',
    h: '#e0f6cc',
    G: '#8ac47a',
    g: '#4e8a4e',
    P: '#3e6e2a',
    m: '#23401f',
    f: '#6a4a3a',
  },
  frames: [
    ['............', ...JAR_LID, ...JAR_GLASS, '..of....fo..'],
    [
      '............',
      ...JAR_LID,
      '..oooooooo..',
      '.ohGGGGGGGo.',
      'ohGGGGGPGGGo',
      'ohGwwGGGwwGo',
      'oGGwkGGGwkGo',
      'oGGPGmmGPGGo',
      'oGPPGGGGPPGo',
      'oGPGGGGGGPgo',
      'ogGGGGGGGggo',
      '.oggggggggo.',
      '..oooooooo..',
      '..of....fo..',
    ],
    ['............', ...JAR_LID, ...JAR_GLASS, '.of......fo.'],
    [
      '..oooooooo..',
      '.oLLLhLLLLo.',
      '.ollllllllo.',
      '...P...P....',
      '..oooooooo..',
      '.ohGGGGGGGo.',
      'ohGGPGGGGGGo',
      'ohGooGGGooGo',
      'oGGwkGPGwkGo',
      'oGPGGmmGGPGo',
      'oGPPGmmGPPGo',
      'oGGPGGGGGPgo',
      'ogGGGGGGGggo',
      '.oggggggggo.',
      '..oooooooo..',
      '..of....fo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 1.5, loop: true },
    move: { frames: [0, 2], fps: 5, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Gherkling — a bumpy little pickle on stubby legs (10×10), side view. */
export const GHERKLING_SPRITE: SpriteDef = {
  id: 'enemy.gherkling',
  w: 10,
  h: 10,
  palette: { o, k, w, P: '#6aa84a', p: '#3e7a2e', h: '#b4dc84', m: '#1e3a14' },
  frames: [
    ['..........', '..........', '..oooooo..', '.ohPpPwwo.', 'oPPPPPwkPo', 'oPpPPpPPPo', 'oPPPpPPPmo', '.oppPPppo.', '..oooooo..', '..op..op..'],
    ['..........', '..........', '..........', '..oooooo..', '.ohPpPwwo.', 'oPPPPPwkPo', 'oPpPPpPPmo', 'oPPPpPPPPo', '.oppoooppo', '..op..op..'],
    ['..........', '..oooooo..', '.ohPpPwwo.', 'oPPPPPwkPo', 'oPpPPpPPPo', 'oPPPpPPmmo', '.oppPPppo.', '..oooooo..', '...op.op..', '..........'],
  ],
  anims: {
    idle: { frames: [0, 0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 6, loop: true },
    air: { frames: [2], fps: 1, loop: true },
    windup: { frames: [1], fps: 1, loop: true },
  },
};

/** Grumblemole — a stout, scowling mole with a big pink nose and digging claws (14×13), front view. */
const MOLE_HEAD = ['....oooooo....', '..ooMMhMMMoo..', '.oMMhMMMMMMMo.'];
const MOLE_BODY = ['CoMMBBBBBBMMoC', 'CCoBBBBBBBBoCC', '.CoBBBBBBBBoC.', '..oMMMMMMMMo..'];
export const GRUMBLEMOLE_SPRITE: SpriteDef = {
  id: 'enemy.grumblemole',
  w: 14,
  h: 13,
  palette: {
    o,
    k,
    M: '#6a5664',
    h: '#9a8494',
    B: '#a8949e',
    N: '#f0909a',
    n: '#c05a6a',
    C: '#f0c0b0',
    m: '#2a1420',
    t: '#f4fbff',
  },
  frames: [
    [...MOLE_HEAD, '.oMooMMMMooMo.', 'oMMMkMMMMkMMMo', 'oMMMMMNNMMMMMo', 'oMMMMNNnNMMMMo', 'oMMMMMmmMMMMMo', ...MOLE_BODY, '...oo....oo...'],
    [...MOLE_HEAD, '.oMooMMMMooMo.', 'oMMMkMMMMkMMMo', 'oMMMMMNNMMMMMo', 'oMMMMNNnNMMMMo', 'oMMMMMmmMMMMMo', ...MOLE_BODY, '..oo......oo..'],
    [
      ...MOLE_HEAD,
      'CoMooMMMMooMoC',
      'CoMMkMMMMkMMoC',
      '.oMMMMNNMMMMo.',
      'oMMMMNNnNMMMMo',
      'oMMMMmttmMMMMo',
      'oMMMMmmmmMMMMo',
      '.oMBBBBBBBBMo.',
      '.oBBBBBBBBBBo.',
      '..oMMMMMMMMo..',
      '...oo....oo...',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 1.5, loop: true },
    move: { frames: [0, 1], fps: 6, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Radish Rammer — a furious red radish with a leafy mop, charging head first (13×13), side view. */
const RADISH_LEAVES = ['..oo..oo.....', '.oLLooLLo....', '..oLLlLLo....', '...olLlo.....'];
export const RADISH_RAMMER_SPRITE: SpriteDef = {
  id: 'enemy.radishRammer',
  w: 13,
  h: 13,
  palette: {
    o,
    k,
    w,
    L: '#6ab84e',
    l: '#3a7a34',
    R: '#d84a5a',
    r: '#9a2a3e',
    h: '#f49098',
    W: '#f0e6dc',
    m: '#4a0e1a',
  },
  frames: [
    [
      ...RADISH_LEAVES,
      '....oooooo...',
      '...oRRRhhRo..',
      '..oRRRRRhwwo.',
      '.oRRRRRRRwko.',
      'ooRRRRRRRRmo.',
      'WWorRRRRRRRo.',
      '..orRRRRRrro.',
      '...orrrrrro..',
      '....oW..Wo...',
    ],
    [
      '.oo...oo.....',
      '..oLooLLo....',
      '..oLLlLLo....',
      '...olLlo.....',
      '....oooooo...',
      '...oRRRhhRo..',
      '..oRRRRRhwwo.',
      '.oRRRRRRRwko.',
      'ooRRRRRRRRmo.',
      '.WorRRRRRRRo.',
      'W.orRRRRRrro.',
      '...orrrrrro..',
      '...oW...Wo...',
    ],
    [
      'oo..oo.......',
      'oLLooLLo.....',
      '.oLLlLLo.....',
      '..olLlo......',
      '...ooooooo...',
      '..oRRRRhhRo..',
      '.oRRRRRRkkoo.',
      'ooRRRRRRRwko.',
      'WoRRRRRRRRmo.',
      'WWrRRRRRRRRo.',
      '..orRRRRRrro.',
      '...orrrrrro..',
      '..oW....oW...',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 8, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};
