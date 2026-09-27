/**
 * Combat presentation sprites: room doors (open → barred, 6 frames; authored for the TOP wall with
 * the opening facing down into the room and rotated by the renderer for the other walls), tiny
 * status icons shown over afflicted enemies, and the FIGHT button icon.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const DOOR_TOP = ['.oooooooooooooo.', 'ohhhhhhkkhhhhhho', 'oSSSSSSkkSSSSSSo', 'oSSooooooooooSSo'];
/** Door opening rows (4-15): void, darker toward the room so it reads as a passage. */
const VOID_ROWS = 12;

function doorFrame(barRows: number): string[] {
  const rows = [...DOOR_TOP];
  for (let r = 0; r < VOID_ROWS; r++) {
    let inner = '';
    for (let c = 0; c < 10; c++) {
      if (r < barRows) {
        // Iron bars (cols 1, 4, 7 inside) with a crossbar near the top.
        const bar = c === 1 || c === 4 || c === 5 || c === 8;
        inner += r === 2 || r === barRows - 1 ? (bar ? 'b' : 'I') : bar ? (c === 5 ? 'i' : 'I') : r > 8 ? 'd' : 'v';
      } else {
        inner += r > 8 ? 'd' : 'v';
      }
    }
    rows.push(`oSo${inner}oSo`);
  }
  return rows;
}

/** 16×16 door: frame 0 open, frames 1-5 bars sliding down, frame 5 = shut. */
export const DOOR_SPRITE: SpriteDef = {
  id: 'door',
  w: 16,
  h: 16,
  palette: {
    o: OUTLINE,
    S: '#56607c',
    h: '#8a96b8',
    k: '#b8c2d8',
    v: '#05060a',
    d: '#0c0f18',
    I: '#59617d',
    i: '#3a4258',
    b: '#9aa6c0',
  },
  frames: [doorFrame(0), doorFrame(3), doorFrame(5), doorFrame(8), doorFrame(10), doorFrame(12)],
};

const W = '#ffffff';

/** 5×5 status icons, index = status (sim/enemies/status ST_*): poison, burn, freeze, slow, charm, fear. */
export const STATUS_ICON_SPRITE: SpriteDef = {
  id: 'status.icons',
  w: 5,
  h: 5,
  palette: {
    o: OUTLINE,
    g: '#7ee06a',
    G: '#3f9a3a',
    f: '#ffcf57',
    F: '#ff7a2a',
    c: '#bff0ff',
    C: '#6fb3e0',
    s: '#b8c6d8',
    S: '#6e7e96',
    p: '#ff8ad0',
    P: '#c0407a',
    v: '#c9a0ff',
    V: '#7a4ad0',
    W,
  },
  frames: [
    ['..o..', '.ogo.', 'ogWgo', 'oGggo', '.ooo.'],
    ['.o.o.', 'ofoFo', 'oFfFo', 'oFfFo', '.ooo.'],
    ['c.c.c', '.cCc.', 'cCWCc', '.cCc.', 'c.c.c'],
    ['oooo.', 'osSSo', 'oSso.', '.oso.', '..o..'],
    ['.o.o.', 'opWpo', 'oppPo', '.oPo.', '..o..'],
    ['.ooo.', 'ovWvo', 'oVvVo', '.ovo.', '.oVo.'],
  ],
};

/** FIGHT button: a brass bell that calls the next wave (12×12). */
export const ICON_FIGHT: SpriteDef = {
  id: 'icon.fight',
  w: 12,
  h: 12,
  palette: { o: OUTLINE, B: '#ffcf57', b: '#c98a1f', h: '#fff3b0', r: '#b98040' },
  frames: [
    [
      '.....oo.....',
      '....orro....',
      '....oBBo....',
      '...ohBBbo...',
      '..ohBBBBbo..',
      '..oBhBBBbo..',
      '..oBBBBBbo..',
      '.ohBBBBBBbo.',
      'oBBBBBBBBBbo',
      'oooooooooooo',
      '.....oo.....',
      '.....oo.....',
    ],
  ],
};
