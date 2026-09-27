/**
 * Floor-run door art (original): one 24×16 sprite per door kind, authored for the TOP wall (the
 * opening faces down into the room) and rotated by the renderer for the other walls. The middle 16
 * columns are the doorway (frame + opening), 4 columns each side decorate the wall around it.
 *
 * Frames: 0 open, 1-5 iron bars sliding down (5 = shut while a wave lives), 6 locked (a door leaf with
 * a padlock). Kinds follow sim/doors.ts DK: normal, boss (storm-red frame, horns, glowing studs),
 * treasure (gilded, gems), shop (Magpie's striped awning), challenge (rain barrels), cursed (thorns),
 * miniboss (studded iron, little horns), nook (dusty moth wings), secret (a blasted hole in the wall).
 * Plus: the secret-wall hint crack, the trapdoor and the '?' icon the Curse of the Blind puts on items.
 */

import type { SpriteDef } from '../../sim/types';
import { OUTLINE } from './palette';

const W = 24;
const H = 16;
const WING = 4;
/** Doorway rows under the frame top. */
const VOID_ROWS = 12;

type Rows = string[];

function blank(): string[][] {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
}

function toRows(g: string[][]): Rows {
  return g.map((r) => r.join(''));
}

/** Iron bars inside the opening (same pattern as the Phase 2 door). */
function barChar(c: number, r: number, barRows: number, fallback: string): string {
  if (r >= barRows) return fallback;
  const bar = c === 1 || c === 4 || c === 5 || c === 8;
  if (r === 2 || r === barRows - 1) return bar ? 'b' : 'I';
  return bar ? (c === 5 ? 'i' : 'I') : fallback;
}

const LOCK = ['.LLL.', 'L...L', 'YYYYY', 'YYvYY', 'YYYYY'];

/** The 16-wide doorway (frame + opening) at columns 4-19. */
function doorway(g: string[][], barRows: number, locked: boolean): void {
  const top = ['.oooooooooooooo.', 'ohhhhhhkkhhhhhho', 'oSSSSSSkkSSSSSSo', 'oSSooooooooooSSo'];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 16; c++) g[r]![WING + c] = top[r]![c]!;
  for (let r = 0; r < VOID_ROWS; r++) {
    const row = g[4 + r]!;
    row[WING] = 'o';
    row[WING + 1] = 'S';
    row[WING + 2] = 'o';
    row[WING + 13] = 'o';
    row[WING + 14] = 'S';
    row[WING + 15] = 'o';
    for (let c = 0; c < 10; c++) {
      let ch: string;
      if (locked) {
        ch = c % 3 === 2 ? 'p' : 'P';
        if (r >= 3 && r < 8 && c >= 2 && c < 7) {
          const l = LOCK[r - 3]![c - 2]!;
          if (l !== '.') ch = l;
        }
      } else {
        ch = barChar(c, r, barRows, r > 8 ? 'd' : 'v');
      }
      row[WING + 3 + c] = ch;
    }
  }
}

/** A wing pattern (4 columns, 16 rows) left of the doorway, mirrored on the right. */
function wings(g: string[][], wing: readonly string[]): void {
  for (let r = 0; r < H; r++) {
    const w = wing[r] ?? '....';
    for (let c = 0; c < WING; c++) {
      const ch = w[c]!;
      if (ch === '.') continue;
      g[r]![c] = ch;
      g[r]![W - 1 - c] = ch;
    }
  }
}

const BAR_ROWS = [0, 3, 5, 8, 10, 12];

function doorSprite(
  id: string,
  frame: Record<string, string>,
  wing: readonly string[] | null,
  extra?: (g: string[][]) => void,
): SpriteDef {
  const frames: Rows[] = [];
  for (let f = 0; f < 7; f++) {
    const g = blank();
    doorway(g, f < 6 ? BAR_ROWS[f]! : 0, f === 6);
    if (wing) wings(g, wing);
    extra?.(g);
    frames.push(toRows(g));
  }
  return {
    id,
    w: W,
    h: H,
    palette: {
      o: OUTLINE,
      v: '#05060a',
      d: '#0c0f18',
      I: '#59617d',
      i: '#3a4258',
      b: '#9aa6c0',
      P: '#6a4a2e',
      p: '#4a321e',
      L: '#b8c2d8',
      Y: '#e0b040',
      k: '#8a96b8',
      ...frame,
    },
    frames,
  };
}

const EMPTY_WING: readonly string[] = [];

export const DOOR_NORMAL = doorSprite('door.normal', { S: '#56607c', h: '#8a96b8', k: '#b8c2d8' }, EMPTY_WING);

export const DOOR_BOSS = doorSprite(
  'door.boss',
  { S: '#5a2a34', h: '#9a4450', k: '#ff6a4a', A: '#7a2a2a', e: '#ff5a4a' },
  ['A...', 'AA..', '.AA.', '..AA', '...A', '...o', '..oe', '...o', '...A', '..oe', '...o', '...A', '..oe', '...o', '...A', '..AA'],
);

export const DOOR_TREASURE = doorSprite(
  'door.treasure',
  { S: '#8a6a2e', h: '#e0b85a', k: '#fff0a0', G: '#4ad0c0', y: '#ffd86a' },
  ['....', '....', '...o', '..oG', '...o', '....', '...o', '..oy', '...o', '....', '...o', '..oy', '...o', '....', '....', '....'],
);

export const DOOR_SHOP = doorSprite(
  'door.shop',
  { S: '#6e4a2e', h: '#a8784a', k: '#e8e0d0', n: '#1a2030', w: '#e8eef8', t: '#3aa8a0' },
  null,
  (g) => {
    // Magpie's awning over the whole door: black / white / teal stripes with a scalloped edge.
    for (let c = 0; c < W; c++) {
      const band = Math.floor(c / 3) % 3;
      const ch = band === 0 ? 'n' : band === 1 ? 'w' : 't';
      g[0]![c] = 'o';
      g[1]![c] = ch;
      g[2]![c] = ch;
      g[3]![c] = c % 3 === 1 ? ch : c % 3 === 0 ? 'o' : '.';
    }
  },
);

export const DOOR_CHALLENGE = doorSprite(
  'door.challenge',
  { S: '#5e4a34', h: '#8c7050', k: '#b8c2d8', B: '#8a5a32', r: '#b8c2d8' },
  ['....', '....', '....', '.oo.', 'oBBo', 'orro', 'oBBo', 'oBBo', 'orro', 'oBBo', '.oo.', '....', '....', '....', '....', '....'],
);

export const DOOR_CURSED = doorSprite(
  'door.cursed',
  { S: '#3a2440', h: '#6a4a78', k: '#c86ad8', t: '#2a1a30', T: '#8a5a9a' },
  ['.t..', 'tTt.', '.tTt', '..tT', '.tTt', 'tTt.', '.tTt', '..tT', '.tTt', 'tTt.', '.tTt', '..tT', '.tTt', 'tTt.', '.tt.', '..t.'],
);

export const DOOR_MINIBOSS = doorSprite(
  'door.miniboss',
  { S: '#4a4a5a', h: '#8a8aa0', k: '#e05a3a', A: '#c8c0b0', s: '#b8c2d8' },
  ['....', '.A..', '.AA.', '..AA', '...o', '....', '...s', '....', '....', '...s', '....', '....', '...s', '....', '....', '....'],
);

export const DOOR_NOOK = doorSprite(
  'door.nook',
  { S: '#5a4a6a', h: '#9a88b0', k: '#e0d0ff', m: '#8a7aa0', M: '#c8b8e0' },
  ['....', '.mm.', 'mMMm', 'mMmM', '.mMM', '..mM', '.mMM', 'mMmM', 'mMMm', '.mm.', '....', '....', '....', '....', '....', '....'],
);

/** A hole blasted through the wall: rubble edges around the opening (bars / leaf frames reuse it). */
function holeSprite(): SpriteDef {
  const frames: Rows[] = [];
  // Half-width of the opening per row (grows toward the room), with a jagged edge.
  const half = [3, 4, 5, 6, 6, 7, 7, 7, 7, 8, 7, 8, 8, 7, 8, 8];
  const jag = [0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0];
  for (let f = 0; f < 7; f++) {
    const g = blank();
    const barRows = f < 6 ? BAR_ROWS[f]! : 0;
    for (let r = 1; r < H; r++) {
      const hw = half[r]!;
      const l = 12 - hw - jag[r]!;
      const rr = 11 + hw + jag[(r + 5) % H]!;
      for (let c = l - 1; c <= rr + 1; c++) {
        if (c < 0 || c >= W) continue;
        if (c === l - 1 || c === rr + 1) g[r]![c] = (r + c) % 3 === 0 ? 'R' : 'r';
        else {
          const ic = c - (12 - 5);
          const inner = r >= 4 && ic >= 0 && ic < 10;
          g[r]![c] = inner && f > 0 && f < 6 ? barChar(ic, r - 4, barRows, r > 9 ? 'd' : 'v') : r > 9 ? 'd' : 'v';
        }
      }
    }
    // Loose stones on the lip.
    g[0]![10] = 'r';
    g[0]![14] = 'R';
    frames.push(toRows(g));
  }
  return {
    id: 'door.secret',
    w: W,
    h: H,
    palette: { v: '#05060a', d: '#0c0f18', r: '#6a7290', R: '#3e455a', I: '#59617d', i: '#3a4258', b: '#9aa6c0' },
    frames,
  };
}

export const DOOR_SECRET = holeSprite();

/** Door sprites indexed by sim/doors DK (0 = none). */
export const DOOR_SPRITES: readonly (SpriteDef | null)[] = [
  null,
  DOOR_NORMAL,
  DOOR_BOSS,
  DOOR_TREASURE,
  DOOR_SHOP,
  DOOR_CHALLENGE,
  DOOR_CURSED,
  DOOR_MINIBOSS,
  DOOR_NOOK,
  DOOR_SECRET,
];

/** A subtle crack in a hidden secret wall (top wall; rotated for the others). */
export const SECRET_HINT_SPRITE: SpriteDef = {
  id: 'door.hint',
  w: 16,
  h: 16,
  palette: { c: '#10131b', C: '#1f2433', w: '#6d9ac0' },
  frames: [
    [
      '................',
      '................',
      '................',
      '.......c........',
      '......cC........',
      '.......c........',
      '........c.......',
      '.......Cc.......',
      '......c...c.....',
      '.....c.....c....',
      '.......c........',
      '........c.......',
      '........w.......',
      '................',
      '........w.......',
      '................',
    ],
  ],
};

/** The trapdoor: 0 shut hatch, 1 swinging open, 2 open (a hole with a rung). */
export const TRAPDOOR_SPRITE: SpriteDef = {
  id: 'trapdoor',
  w: 16,
  h: 16,
  palette: { o: OUTLINE, w: '#6a4a2e', W: '#9a6c42', i: '#8a96b8', v: '#05060a', d: '#10131b', r: '#3e455a', R: '#5c6580' },
  frames: [
    [
      '................',
      '..oooooooooooo..',
      '.oWWWWWWWWWWWWo.',
      '.oWwwWWwwWWwwWo.',
      '.oWWWWWWWWWWWWo.',
      '.oWwwWWwwWWwwWo.',
      '.oWWWWWiiWWWWWo.',
      '.oWwwWiWWiwwWWo.',
      '.oWWWWWiiWWWWWo.',
      '.oWwwWWwwWWwwWo.',
      '.oWWWWWWWWWWWWo.',
      '.oWwwWWwwWWwwWo.',
      '.oWWWWWWWWWWWWo.',
      '..oooooooooooo..',
      '................',
      '................',
    ],
    [
      '..oooooooooooo..',
      '.oWWWWWWWWWWWWo.',
      '.oWwwWWwwWWwwWo.',
      '.oWWWWWiiWWWWWo.',
      '..oooooooooooo..',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvddvvddvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rrvvvvvvvvvvrr.',
      '..rrrrrrrrrrrr..',
      '................',
      '................',
    ],
    [
      '................',
      '..RRRRRRRRRRRR..',
      '.RrrrrrrrrrrrrR.',
      '.rvvvvvvvvvvvvr.',
      '.rvvRRRRRRRRvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvRRRRRRRRvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rvvRRRRRRRRvvr.',
      '.rvvvvvvvvvvvvr.',
      '.rrvvvvvvvvvvrr.',
      '..rrrrrrrrrrrr..',
      '................',
      '................',
    ],
  ],
};

/** Curse of the Blind: what every pedestal shows instead of its item (14×14). */
export const BLIND_ITEM_SPRITE: SpriteDef = {
  id: 'item.blind',
  w: 14,
  h: 14,
  palette: { o: OUTLINE, q: '#c9d3f0', Q: '#ffffff', s: '#56648a' },
  frames: [
    [
      '..............',
      '....oooooo....',
      '...oQQQQqqo...',
      '..oQqoooqqqo..',
      '..oqqo..oqqo..',
      '...oo..oqqqo..',
      '......oqqqo...',
      '.....oqqqo....',
      '.....oqqo.....',
      '......oo......',
      '.....oqqo.....',
      '.....oqqo.....',
      '......oo......',
      '..............',
    ],
  ],
};
