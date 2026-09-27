/**
 * The Drowned Nursery (chapter 1, alt track) enemy sprites, plus the two cross-chapter foes that live
 * in its file (Dust Bunny, Lost Balloon). Soggy toys in faded pastels: 1 px dark outline, big eyes,
 * `idle` + `move` animations, `windup` (telegraph pose) and `air` where it matters. Side views face
 * RIGHT (the renderer mirrors them). Hurt flash and death bursts come from the renderer.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const o = OUTLINE;
const k = '#10122a';
const w = '#f4fbff';

/** Bathtub Paddler — a wind-up bath duck (16×12), side view; the key on its back turns. */
const DUCK_HEAD = ['..oK.Ko..oooo...', '...oKo..ohhYYo..', '....j..ohYYYYYo.', 'o...j..oYYwwYYo.'];
const DUCK_KEY_TURNED = ['...oKo...oooo...', '...oKo..ohhYYo..', '....j..ohYYYYYo.', 'o...j..oYYwwYYo.'];
const DUCK_BODY = ['oo.oooooYYwkYBBo', 'oYoYhhYYYYYYYbbo', 'oYhYYYYYYYYYYoo.', '.oYYYYYYYYYYyo..', '..oyyyyyyyyyo...'];
export const BATHTUB_PADDLER_SPRITE: SpriteDef = {
  id: 'enemy.bathtubPaddler',
  w: 16,
  h: 12,
  palette: {
    o,
    k,
    w,
    Y: '#e8c14a',
    y: '#b0822a',
    h: '#fff2a8',
    B: '#f07a32',
    b: '#b84a1e',
    K: '#c4ccdc',
    j: '#6a7390',
  },
  frames: [
    ['................', '...ooo..........', ...DUCK_HEAD, ...DUCK_BODY, '...oBo..oBo.....'],
    ['................', '....o...........', ...DUCK_KEY_TURNED, ...DUCK_BODY, '...oBo..oBo.....'],
    ['................', '....o...........', ...DUCK_KEY_TURNED, ...DUCK_BODY, '..oBo....oBo....'],
    [
      '................',
      '...ooo..........',
      ...DUCK_HEAD,
      'oo.oooooYYwkYBBo',
      'oYoYhhYYYYYYYoo.',
      'oYhYYYYYYYYYYbbo',
      '.oYYYYYYYYYYyoo.',
      '..oyyyyyyyyyo...',
      '...oBo..oBo.....',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 2, 1, 2], fps: 10, loop: true },
    windup: { frames: [3], fps: 1, loop: true },
  },
};

/** Lullaby Box — a music box with its lid up and a tiny dancer spinning on top (14×15). */
const BOX_TOP = ['......oo......', '.oooooSSooooo.', '.opMMoSSoMMpo.'];
const BOX_BODY = ['oGGGGGggGGGGGo', 'ohPPPPPPPPPPPo', 'oPPwwPPPPwwPPo', 'oPPwkPPPPwkPPo'];
const BOX_FOOT = ['oggggggggggggo', 'oooooooooooooo', '.oGo......oGo.'];
export const LULLABY_BOX_SPRITE: SpriteDef = {
  id: 'enemy.lullabyBox',
  w: 14,
  h: 15,
  palette: {
    o,
    k,
    w,
    M: '#9fd4e8',
    p: '#7a3656',
    S: '#f6dccb',
    T: '#e8f4ff',
    G: '#f0c860',
    g: '#a97e2a',
    P: '#d98aa8',
    h: '#f6c0d2',
    m: '#4a1a30',
  },
  frames: [
    [
      ...BOX_TOP,
      '.opMoSTTSoMpo.',
      '.opoTTTTTTopo.',
      '.opppoSSopppo.',
      ...BOX_BODY,
      'oPPPPPmmPPPPPo',
      'oPPPPPPPPPPPPo',
      ...BOX_FOOT,
    ],
    [
      ...BOX_TOP,
      '.opMMoTToMMpo.',
      '.opoTTTTTTopo.',
      '.opppoSSopppo.',
      ...BOX_BODY,
      'oPPPPPmmPPPPPo',
      'oPPPPPPPPPPPPo',
      ...BOX_FOOT,
    ],
    [
      '.....oSSo.....',
      '.oooooSSooooo.',
      '.opMMoTToMMpo.',
      '.opoTTTTTTopo.',
      '.opMoTTTToMpo.',
      '.opppoSSopppo.',
      ...BOX_BODY,
      'oPPPPommoPPPPo',
      'oPPPPommoPPPPo',
      ...BOX_FOOT,
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 3, loop: true },
    move: { frames: [0, 1], fps: 3, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Puddle Poppet — a soaked rag doll with button eyes and yarn hair (12×15), front view. */
const DOLL_HEAD = [
  '...oooooo...',
  '..oHHHHhHo..',
  '.oHHFFFFHHo.',
  '.oHFFFFFFHo.',
  'oHFbBFFbBFHo',
  'oHFBBFFBBFHo',
];
export const PUDDLE_POPPET_SPRITE: SpriteDef = {
  id: 'enemy.puddlePoppet',
  w: 12,
  h: 15,
  palette: {
    o,
    H: '#6d83a8',
    h: '#9cb2d4',
    F: '#e8d5c0',
    f: '#b89c84',
    B: '#2a2238',
    b: '#8a7aa0',
    x: '#5a3048',
    D: '#5e9a9a',
    d: '#3e6a6e',
    W: '#6fc0f0',
  },
  frames: [
    [
      ...DOLL_HEAD,
      'oHFxFFFFxFHo',
      '.oHFxxxxFHo.',
      'W.ooffffoo..',
      '..oDDDDDDo..',
      '.oFoDDDDoFo.',
      '.oFoDDDDoFo.',
      '.oDDDDDDDDo.',
      '.oddddddddo.',
      '..oFo..oFo.W',
    ],
    [
      ...DOLL_HEAD,
      'oHFxFFFFxFHo',
      '.oHFxxxxFHo.',
      '...ooffffoo.',
      'W.oDDDDDDo..',
      '.oFoDDDDoFo.',
      '.oFoDDDDoFoW',
      '.oDDDDDDDDo.',
      '.oddddddddo.',
      '..oFo..oFo..',
    ],
    [
      ...DOLL_HEAD,
      'oHFFFooFFFHo',
      '.oHFFooFFHo.',
      'oFooffffooFo',
      'oFoDDDDDDoFo',
      '.ooDDDDDDoo.',
      'W.oDDDDDDo.W',
      '.oDDDDDDDDo.',
      '.oddddddddo.',
      '..oFo..oFo..',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2, loop: true },
    move: { frames: [0, 1], fps: 4, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/**
 * Sprung Jack — a sodden jack-in-the-box (14×17). Idle = the shut box (eyes peek from under the lid now
 * and then), windup = the lid bursting open, move = the grinning head bobbing on its spring.
 */
const JACK_LID = ['..oooooooooo..', '..oTTTTTTTTo..', '..orrrrrrrro..'];
const JACK_BOX = [
  '..ohRRLLRRRo..',
  '..oRRLLLLRRo.o',
  '..oRLLLLLLRoCC',
  '..oRRLLLLRRo.o',
  '..oRRRLLRRRo..',
  '..orrrrrrrro..',
  '..oooooooooo..',
];
const JACK_RIM = '..oooooooooo..';
const JACK_HEAD = [
  '.......o......',
  '......oAo.....',
  '.....oAaAo....',
  '....oAAAAAo...',
  '...ooFFFFFoo..',
  '...oFwkFwkFo..',
  '...oFFFnFFFo..',
  '....oFmmmFo...',
];
const BLANK14 = '..............';
export const SPRUNG_JACK_SPRITE: SpriteDef = {
  id: 'enemy.sprungJack',
  w: 14,
  h: 17,
  palette: {
    o,
    k,
    w,
    R: '#c05a5a',
    r: '#843442',
    h: '#e08a86',
    L: '#6d8ac0',
    T: '#de8a80',
    C: '#c4ccdc',
    A: '#5ab0a0',
    a: '#f0e0a0',
    F: '#f2dcc0',
    n: '#e0405a',
    m: '#5a1a2a',
    Z: '#d8cc98',
  },
  frames: [
    [BLANK14, BLANK14, BLANK14, BLANK14, BLANK14, BLANK14, BLANK14, ...JACK_LID, ...JACK_BOX],
    [BLANK14, BLANK14, BLANK14, BLANK14, BLANK14, BLANK14, '..oooooooooo..', '..oTTTTTTTTo..', JACK_RIM, '..okkwkkwkko..', ...JACK_BOX],
    [
      BLANK14,
      BLANK14,
      BLANK14,
      BLANK14,
      '.oooooooooooo.',
      '.oTTTTTTTTTTo.',
      '.oooooooooooo.',
      '...oFwkFwkFo..',
      '....oFmmmFo...',
      '..o..oZZo..o..',
      JACK_RIM,
      ...JACK_BOX.slice(1),
    ],
    [...JACK_HEAD, '.....ooooo....', '......oZo.....', JACK_RIM, ...JACK_BOX.slice(1)],
    [BLANK14, ...JACK_HEAD, '.....ooooo....', JACK_RIM, ...JACK_BOX.slice(1)],
  ],
  anims: {
    idle: { frames: [0, 0, 0, 0, 1], fps: 2, loop: true },
    move: { frames: [3, 4], fps: 6, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Dust Bunny — a fuzzy ball of lint with long floppy ears and big worried eyes (12×14). Cross-chapter. */
const BUNNY_BODY = [
  '..ohDDDDDo..',
  'l.hDDDDDDDo.',
  'ohDwwDDwwDDo',
  'oDDwkDDwkDdo',
  'oDDDDppDDDdo',
  '.oDDDDDDDdol',
  '..odDdDddo..',
  '...oooooo...',
];
export const DUST_BUNNY_SPRITE: SpriteDef = {
  id: 'enemy.dustBunny',
  w: 12,
  h: 14,
  palette: { o, k, w, D: '#aaa6b8', d: '#76728a', h: '#d8d4e2', p: '#e8a0b0', l: '#6a667e' },
  frames: [
    ['..oo....oo..', '.ohDo..ohDo.', '.oDpo..oDpo.', '.oDpo..oDpo.', '.oDpo..oDpo.', '..oDo..oDo..', ...BUNNY_BODY],
    ['............', '.oo......oo.', 'ohDo....ohDo', 'oDpo....oDpo', '.oDpo..oDpo.', '..oDo..oDo..', ...BUNNY_BODY],
    [
      '..oo....oo..',
      '.ohDo..ohDo.',
      '.oDpo..oDpo.',
      '.oDpo..oDpo.',
      '.oDpo..oDpo.',
      '..oDo..oDo..',
      '..ohDDDDDo..',
      'l.hDDDDDDDo.',
      'ohDoDDDDoDDo',
      'oDDDoDDoDDdo',
      'oDDDDooDDDdo',
      '.oDDDooDDdol',
      '..odDdDddo..',
      '...oooooo...',
    ],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 2.5, loop: true },
    move: { frames: [0, 1], fps: 6, loop: true },
    windup: { frames: [2], fps: 1, loop: true },
  },
};

/** Lost Balloon — a sagging party balloon with a sad face and a trailing string (11×16). Cross-chapter. */
const BALLOON = [
  '...ooooo...',
  '..oRRRRRo..',
  '.oRhhRRRRo.',
  'oRhRRRRRRro',
  'oRRwkRwkRro',
  'oRRRRRRRRro',
  'oRRRRmmRRro',
  '.oRRRRRRro.',
  '.orRRRRrro.',
  '..orrrrro..',
  '...ooKoo...',
  '....oKo....',
];
export const LOST_BALLOON_SPRITE: SpriteDef = {
  id: 'enemy.lostBalloon',
  w: 11,
  h: 16,
  palette: { o, k, w, R: '#d86a6a', r: '#9a3e4a', h: '#f6b0a8', m: '#4a1a24', K: '#e0c070', s: '#c8c0d8' },
  frames: [
    [...BALLOON, '.....s.....', '....s......', '....s......', '.....s.....'],
    [...BALLOON, '.....s.....', '......s....', '......s....', '.....s.....'],
  ],
  anims: {
    idle: { frames: [0, 1], fps: 1.5, loop: true },
    move: { frames: [0, 1], fps: 2.5, loop: true },
  },
};
