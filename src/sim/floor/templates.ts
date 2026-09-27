/**
 * Room templates: validation, per-room picking and mirroring (ARCHITECTURE §5 legend).
 * Pure: no DOM. Templates come from src/content/rooms/*.ts (see library.ts).
 */

import type { Rng } from '../../engine/rng';
import { ROOM_TYPES, type ChapterId, type FloorLayout, type RoomTemplate, type RoomType } from './types';

export const TEMPLATE_COLS = 13;
export const TEMPLATE_ROWS = 7;
export const CENTER_COL = 6;
export const CENTER_ROW = 3;

/** Every legal template character (ARCHITECTURE §5). */
export const TEMPLATE_CHARS = '.#$MO^fxueEcpiSB';
/** Tiles you cannot walk through without flying (rocks, tinted rocks, metal, pits, crates, urns). */
export const BLOCKING_CHARS = '#$MOxu';
/** Walkable but harmful. */
export const HAZARD_CHARS = '^f';
/** Non-tile markers (they stand on floor). */
export const MARKER_CHARS = 'eEcpiSB';

/**
 * The tile just inside each door, by side (0 N, 1 E, 2 S, 3 W): [col, row].
 * These must be plain floor in every template, so any door mask fits any template (and mirrored
 * templates stay valid, since the fronts are symmetric).
 */
export const DOOR_FRONTS: readonly (readonly [number, number])[] = [
  [CENTER_COL, 0],
  [TEMPLATE_COLS - 1, CENTER_ROW],
  [CENTER_COL, TEMPLATE_ROWS - 1],
  [0, CENTER_ROW],
];

/** Most enemy spawns a template may hold (keeps rooms inside the enemy caps). */
export const MAX_SPAWNS = 10;

interface TypeRule {
  /** Marker characters allowed in this room type (tiles are always allowed). */
  allow: string;
  /** Checks on marker counts; returns an error message or null. */
  check?(n: Readonly<Record<string, number>>): string | null;
  /** The centre tile must be walkable (trapdoors, rewards, player start spawn there). */
  center?: boolean;
}

const sum = (n: Readonly<Record<string, number>>, chars: string): number => {
  let s = 0;
  for (const ch of chars) s += n[ch] ?? 0;
  return s;
};

const TYPE_RULES: Readonly<Record<RoomType, TypeRule>> = {
  start: { allow: 'p', center: true },
  normal: { allow: 'eEcp', check: (n) => (sum(n, 'eE') >= 1 ? null : 'needs at least one enemy spawn (e/E)') },
  treasure: { allow: 'icp', check: (n) => (sum(n, 'i') >= 1 ? null : 'needs an item pedestal (i)') },
  shop: {
    allow: 'Sp',
    check: (n) => (sum(n, 'S') >= 2 && sum(n, 'S') <= 6 ? null : 'needs 2-6 shop slots (S)'),
  },
  boss: { allow: 'B', center: true, check: (n) => (sum(n, 'B') === 1 ? null : 'needs exactly one boss spawn (B)') },
  miniboss: {
    allow: 'B',
    center: true,
    check: (n) => (sum(n, 'B') === 1 ? null : 'needs exactly one boss spawn (B)'),
  },
  secret: { allow: 'icp', check: (n) => (sum(n, 'icp') >= 1 ? null : 'needs loot (i/c/p)') },
  deepSecret: { allow: 'icp', check: (n) => (sum(n, 'ic') >= 1 ? null : 'needs an item or chest (i/c)') },
  challenge: {
    allow: 'eEicp',
    center: true,
    check: (n) =>
      sum(n, 'eE') < 2 ? 'needs at least two wave spawns (e/E)' : sum(n, 'ic') < 1 ? 'needs a reward (i/c)' : null,
  },
  cursed: { allow: 'eEicp', check: (n) => (sum(n, 'ic') >= 1 ? null : 'needs a reward (i/c)') },
  nook: {
    allow: 'ip',
    check: (n) => (sum(n, 'i') >= 2 && sum(n, 'i') <= 4 ? null : 'needs 2-4 item pedestals (i)'),
  },
};

const blocking = (ch: string): boolean => BLOCKING_CHARS.includes(ch);
const hazard = (ch: string): boolean => HAZARD_CHARS.includes(ch);

/** Flood fill over the grid from (c0, r0); `pass` decides which characters can be entered. */
function flood(grid: readonly string[], c0: number, r0: number, pass: (ch: string) => boolean): Uint8Array {
  const seen = new Uint8Array(TEMPLATE_COLS * TEMPLATE_ROWS);
  if (!pass(grid[r0]![c0]!)) return seen;
  const stack: number[] = [r0 * TEMPLATE_COLS + c0];
  seen[stack[0]!] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % TEMPLATE_COLS;
    const r = (i - c) / TEMPLATE_COLS;
    const next = [
      [c, r - 1],
      [c + 1, r],
      [c, r + 1],
      [c - 1, r],
    ] as const;
    for (const [nc, nr] of next) {
      if (nc < 0 || nr < 0 || nc >= TEMPLATE_COLS || nr >= TEMPLATE_ROWS) continue;
      const j = nr * TEMPLATE_COLS + nc;
      if (seen[j] || !pass(grid[nr]![nc]!)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

/**
 * Checks one template. Returns human-readable problems (empty = valid):
 * - id, type, difficulty 1-3, chapters (non-empty; '*' only on its own)
 * - 7 rows × 13 legal characters
 * - the tile in front of each door is plain floor '.', with no enemy spawn next to it
 * - every walkable tile (markers, spikes and fire included) is reachable from every other
 *   without flying: rocks, tinted rocks, metal, pits, crates and urns block
 * - all four doors are connected by a hazard-free path (you can always walk through unharmed)
 * - markers fit the room type (e.g. shop slots only in shops, exactly one B in boss rooms)
 * - at most MAX_SPAWNS enemy spawns
 */
export function validateTemplate(t: RoomTemplate): string[] {
  const errs: string[] = [];
  const where = typeof t?.id === 'string' && t.id ? `template "${t.id}"` : 'template';
  if (typeof t?.id !== 'string' || !/^[a-z0-9_.-]+$/i.test(t.id)) errs.push(`${where}: bad id`);
  if (!ROOM_TYPES.includes(t?.type)) errs.push(`${where}: unknown type "${String(t?.type)}"`);
  if (t?.difficulty !== 1 && t?.difficulty !== 2 && t?.difficulty !== 3) errs.push(`${where}: difficulty must be 1, 2 or 3`);
  if (!Array.isArray(t?.chapters) || t.chapters.length === 0) {
    errs.push(`${where}: chapters must be a non-empty list`);
  } else {
    if (t.chapters.some((c) => typeof c !== 'string' || c.length === 0)) errs.push(`${where}: empty chapter id`);
    if (t.chapters.includes('*') && t.chapters.length > 1) errs.push(`${where}: '*' must be the only chapter`);
  }
  if (t?.weight !== undefined && !(t.weight > 0)) errs.push(`${where}: weight must be > 0`);

  const g = t?.grid;
  if (!Array.isArray(g) || g.length !== TEMPLATE_ROWS) {
    errs.push(`${where}: grid needs ${TEMPLATE_ROWS} rows`);
    return errs;
  }
  let shapeOk = true;
  for (let r = 0; r < TEMPLATE_ROWS; r++) {
    const row = g[r];
    if (typeof row !== 'string' || row.length !== TEMPLATE_COLS) {
      errs.push(`${where}: row ${r} needs ${TEMPLATE_COLS} characters`);
      shapeOk = false;
      continue;
    }
    for (let c = 0; c < TEMPLATE_COLS; c++) {
      if (!TEMPLATE_CHARS.includes(row[c]!)) {
        errs.push(`${where}: illegal character "${row[c]}" at ${c},${r}`);
        shapeOk = false;
      }
    }
  }
  if (!shapeOk) return errs;

  // Doors.
  for (let d = 0; d < 4; d++) {
    const [c, r] = DOOR_FRONTS[d]!;
    if (g[r]![c] !== '.') errs.push(`${where}: tile in front of door ${'NESW'[d]} (${c},${r}) must be floor '.'`);
    for (const [dc, dr] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= TEMPLATE_COLS || nr >= TEMPLATE_ROWS) continue;
      if ('eE'.includes(g[nr]![nc]!)) errs.push(`${where}: enemy spawn next to door ${'NESW'[d]} at ${nc},${nr}`);
    }
  }

  // Reachability (walk, no flying).
  const [c0, r0] = DOOR_FRONTS[0]!;
  const walk = flood(g, c0, r0, (ch) => !blocking(ch));
  for (let r = 0; r < TEMPLATE_ROWS; r++) {
    for (let c = 0; c < TEMPLATE_COLS; c++) {
      if (!blocking(g[r]![c]!) && !walk[r * TEMPLATE_COLS + c]) {
        errs.push(`${where}: unreachable tile "${g[r]![c]}" at ${c},${r}`);
      }
    }
  }
  const safe = flood(g, c0, r0, (ch) => !blocking(ch) && !hazard(ch));
  for (let d = 1; d < 4; d++) {
    const [c, r] = DOOR_FRONTS[d]!;
    if (!safe[r * TEMPLATE_COLS + c]) errs.push(`${where}: no hazard-free path from door N to door ${'NESW'[d]}`);
  }

  // Markers per type.
  const counts: Record<string, number> = {};
  for (const row of g) for (const ch of row) if (MARKER_CHARS.includes(ch)) counts[ch] = (counts[ch] ?? 0) + 1;
  const rule = TYPE_RULES[t.type];
  if (rule) {
    for (const ch of Object.keys(counts)) {
      if (!rule.allow.includes(ch)) errs.push(`${where}: marker "${ch}" is not allowed in a ${t.type} room`);
    }
    const msg = rule.check?.(counts);
    if (msg) errs.push(`${where}: ${msg}`);
    if (rule.center && blocking(g[CENTER_ROW]![CENTER_COL]!)) errs.push(`${where}: centre tile must be walkable`);
  }
  if (sum(counts, 'eE') > MAX_SPAWNS) errs.push(`${where}: more than ${MAX_SPAWNS} enemy spawns`);
  return errs;
}

/** Validates a whole set: every template, plus duplicate ids. */
export function validateTemplates(list: readonly RoomTemplate[]): string[] {
  const errs: string[] = [];
  const ids = new Set<string>();
  for (const t of list) {
    errs.push(...validateTemplate(t));
    if (ids.has(t.id)) errs.push(`duplicate room template id "${t.id}"`);
    ids.add(t.id);
  }
  return errs;
}

export function fitsChapter(t: RoomTemplate, chapterId: ChapterId): boolean {
  return t.chapters.includes('*') || t.chapters.includes(chapterId);
}

/** Character at (col, row) of a template seen through a mirroring (bit 1 = left/right, bit 2 = top/bottom). */
export function templateChar(t: RoomTemplate, flip: number, col: number, row: number): string {
  const c = flip & 1 ? TEMPLATE_COLS - 1 - col : col;
  const r = flip & 2 ? TEMPLATE_ROWS - 1 - row : row;
  return t.grid[r]![c]!;
}

/** The template's rows with the mirroring applied (feed to parseRoomLayout). */
export function templateGrid(t: RoomTemplate, flip = 0): string[] {
  const out: string[] = [];
  for (let r = 0; r < TEMPLATE_ROWS; r++) {
    const src = t.grid[flip & 2 ? TEMPLATE_ROWS - 1 - r : r]!;
    out.push(flip & 1 ? src.split('').reverse().join('') : src);
  }
  return out;
}

/**
 * Difficulty the floor asks for at a room: 1.0 on floor 1 rising to 3.0 on floor 13, plus up to
 * +0.35 for rooms far from the start (the way to the boss gets tougher).
 */
export function targetDifficulty(floorIndex: number, dist: number, bossDist: number): number {
  return 1 + (floorIndex - 1) / 6 + (0.35 * Math.min(dist, bossDist)) / Math.max(1, bossDist);
}

function difficultyWeight(target: number, d: number): number {
  const x = d - target;
  return Math.exp(-(x * x) / 0.8);
}

const CHAPTER_BONUS = 3;
const REPEAT_PENALTY = 0.15;

/**
 * Chooses a template (and a random mirroring) for every room of the layout, plus the Broker's
 * Nook reserve. Filters by room type and chapter ('*' templates fit every chapter; templates
 * made for this chapter get a ×3 weight), weights by difficulty against targetDifficulty, and
 * avoids repeating a layout on the same floor. Writes `templateId`/`flip` into the rooms (null when
 * no template of that type fits) and returns the same layout.
 *
 * Deterministic for the same (layout, template set, chapterId, rng state); candidates are sorted
 * by id so file order never matters. Use templateRng(seed, floor, track) for `rng`.
 */
export function pickTemplates(
  layout: FloorLayout,
  templates: readonly RoomTemplate[],
  chapterId: ChapterId,
  rng: Rng,
): FloorLayout {
  const groups = new Map<RoomType, RoomTemplate[]>();
  for (const t of templates) {
    if (!fitsChapter(t, chapterId)) continue;
    let g = groups.get(t.type);
    if (!g) groups.set(t.type, (g = []));
    g.push(t);
  }
  for (const g of groups.values()) g.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const used = new Set<string>();
  const weights: number[] = [];
  const pick = (type: RoomType, dist: number): { id: string | null; flip: number } => {
    const roll = rng.next();
    const flip = rng.nextU32() & 3;
    const g = groups.get(type);
    if (!g || g.length === 0) return { id: null, flip: 0 };
    const target = targetDifficulty(layout.floorIndex, dist, layout.bossDist);
    weights.length = 0;
    let total = 0;
    for (const t of g) {
      let w = (t.weight ?? 1) * difficultyWeight(target, t.difficulty);
      if (t.chapters.includes(chapterId)) w *= CHAPTER_BONUS;
      if (used.has(t.id)) w *= REPEAT_PENALTY;
      weights.push(w);
      total += w;
    }
    let r = roll * total;
    let chosen = g[g.length - 1]!;
    for (let i = 0; i < g.length; i++) {
      if (r < weights[i]!) {
        chosen = g[i]!;
        break;
      }
      r -= weights[i]!;
    }
    used.add(chosen.id);
    return { id: chosen.id, flip };
  };

  for (const room of layout.rooms) {
    if (room.type === 'nook') continue; // handled with the reserve below
    const p = pick(room.type, room.dist);
    room.templateId = p.id;
    room.flip = p.flip;
  }
  const n = pick('nook', layout.bossDist + 1);
  layout.nook.templateId = n.id;
  layout.nook.flip = n.flip;
  if (layout.nook.room >= 0) {
    const nr = layout.rooms[layout.nook.room]!;
    nr.templateId = n.id;
    nr.flip = n.flip;
  }
  return layout;
}
