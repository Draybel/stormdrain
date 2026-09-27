/**
 * Hand-made chapter rooms (src/content/rooms/<chapterId>.ts) and special-room variants
 * (src/content/rooms/special-*.ts): counts per chapter and type, validateTemplate in every mirroring,
 * fairness rules stricter than the validator, and seeded picking over 500 seeds per chapter.
 */

import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/registry';
import {
  BLOCKING_CHARS,
  DOOR_FRONTS,
  HAZARD_CHARS,
  ROOM_TEMPLATES,
  TEMPLATE_COLS,
  TEMPLATE_ROWS,
  fitsChapter,
  generateFloor,
  pickTemplates,
  templateGrid,
  templateRng,
  validateTemplate,
  validateTemplates,
  type RoomTemplate,
  type RoomType,
} from '../src/sim/floor';

// ── The files under test ──────────────────────────────────────────────────────────────────────

const modules = import.meta.glob<{ default: readonly RoomTemplate[] }>('../src/content/rooms/*.ts', { eager: true });
const FILES = new Map<string, readonly RoomTemplate[]>(
  Object.entries(modules).map(([path, mod]) => [path.replace(/^.*\//, '').replace(/\.ts$/, ''), mod.default]),
);
const CHAPTER_IDS = [...CHAPTERS.keys()].sort();
const chapterFile = (id: string): readonly RoomTemplate[] => FILES.get(id) ?? [];
const CHAPTER_ROOMS = CHAPTER_IDS.flatMap(chapterFile);
const SPECIAL_ROOMS = [...FILES.entries()]
  .filter(([name]) => name.startsWith('special-'))
  .flatMap(([, list]) => list);
const OURS = [...CHAPTER_ROOMS, ...SPECIAL_ROOMS];
const BY_ID = new Map(ROOM_TEMPLATES.map((t) => [t.id, t]));

/** Types a special-room variant file may hold, and the ones the set must cover. */
const SPECIAL_TYPES: readonly RoomType[] = ['treasure', 'secret', 'deepSecret', 'challenge', 'cursed', 'boss', 'miniboss'];
const REQUIRED_SPECIALS: readonly RoomType[] = ['treasure', 'secret', 'challenge', 'cursed', 'boss'];

// ── Grid helpers ──────────────────────────────────────────────────────────────────────────────

const SIDES = 'NESW';
/** The tile one step further in from each door front (where you land after entering). */
const INWARD: readonly (readonly [number, number])[] = [
  [6, 1],
  [11, 3],
  [6, 5],
  [1, 3],
];

function flood(grid: readonly string[], pass: (ch: string) => boolean): Uint8Array {
  const seen = new Uint8Array(TEMPLATE_COLS * TEMPLATE_ROWS);
  const [c0, r0] = DOOR_FRONTS[0]!;
  if (!pass(grid[r0]![c0]!)) return seen;
  const stack = [r0 * TEMPLATE_COLS + c0];
  seen[stack[0]!] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % TEMPLATE_COLS;
    const r = (i - c) / TEMPLATE_COLS;
    for (const [dc, dr] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= TEMPLATE_COLS || nr >= TEMPLATE_ROWS) continue;
      const j = nr * TEMPLATE_COLS + nc;
      if (seen[j] || !pass(grid[nr]![nc]!)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return seen;
}

function count(t: RoomTemplate, chars: string): number {
  let n = 0;
  for (const row of t.grid) for (const ch of row) if (chars.includes(ch)) n++;
  return n;
}

const blocking = (ch: string): boolean => BLOCKING_CHARS.includes(ch);
const hazard = (ch: string): boolean => HAZARD_CHARS.includes(ch);

/** Enemy spawns per difficulty for normal rooms: [min, max] and whether an elite is required / allowed. */
const SPAWN_BUDGET: Readonly<Record<1 | 2 | 3, { min: number; max: number; elite: 'never' | 'maybe' | 'always' }>> = {
  1: { min: 2, max: 5, elite: 'never' },
  2: { min: 3, max: 7, elite: 'maybe' },
  3: { min: 5, max: 10, elite: 'always' },
};

/**
 * House rules for hand-made rooms, on top of validateTemplate:
 * - no enemy spawn and no hazard within 2 steps of a door front (you never enter into a hit);
 * - the tile right after each door front is open, safe floor;
 * - braziers are solid in the sim, so nothing may be reachable only through fire;
 * - every safe tile is reachable without touching spikes or fire (Thorn Rooms may guard loot with thorns);
 * - at most two tinted rocks (guaranteed loot);
 * - normal rooms: spawn budget per difficulty, at most one free pickup/chest, enough open floor;
 * - boss arenas: boss spawn in the centre, a clear 5×5 fighting area around it and no hazards.
 */
function fairness(t: RoomTemplate): string[] {
  const out: string[] = [];
  const g = t.grid;
  for (let r = 0; r < TEMPLATE_ROWS; r++) {
    for (let c = 0; c < TEMPLATE_COLS; c++) {
      const ch = g[r]![c]!;
      if (!'eE^f'.includes(ch)) continue;
      for (let d = 0; d < 4; d++) {
        const [dc, dr] = DOOR_FRONTS[d]!;
        if (Math.abs(c - dc) + Math.abs(r - dr) < 3) out.push(`"${ch}" at ${c},${r} is within 2 steps of door ${SIDES[d]}`);
      }
    }
  }
  for (let d = 0; d < 4; d++) {
    const [c, r] = INWARD[d]!;
    const ch = g[r]![c]!;
    if (blocking(ch) || hazard(ch)) out.push(`door ${SIDES[d]} opens onto "${ch}" at ${c},${r}`);
  }
  const noFire = flood(g, (ch) => !blocking(ch) && ch !== 'f');
  const safe = flood(g, (ch) => !blocking(ch) && !hazard(ch));
  for (let r = 0; r < TEMPLATE_ROWS; r++) {
    for (let c = 0; c < TEMPLATE_COLS; c++) {
      const ch = g[r]![c]!;
      const i = r * TEMPLATE_COLS + c;
      if (!blocking(ch) && ch !== 'f' && !noFire[i]) out.push(`"${ch}" at ${c},${r} is only reachable through fire`);
      if (t.type !== 'cursed' && !blocking(ch) && !hazard(ch) && !safe[i]) {
        out.push(`"${ch}" at ${c},${r} is only reachable over spikes or fire`);
      }
    }
  }
  if (count(t, '$') > 2) out.push('at most two tinted rocks (each one is guaranteed loot)');
  if (t.type === 'normal') {
    const spawns = count(t, 'eE');
    const elites = count(t, 'E');
    const b = SPAWN_BUDGET[t.difficulty];
    if (spawns < b.min || spawns > b.max) out.push(`${spawns} spawns; difficulty ${t.difficulty} wants ${b.min}-${b.max}`);
    if (b.elite === 'never' && elites > 0) out.push('difficulty 1 rooms have no elite spawns');
    if (b.elite === 'always' && elites === 0) out.push('difficulty 3 rooms need an elite spawn');
    if (count(t, 'cp') > 1) out.push('at most one free chest/pickup in a normal room');
    if (count(t, '.eEcp^f') < 45) out.push('too cramped: fewer than 45 open tiles');
  }
  if (t.type === 'boss' || t.type === 'miniboss') {
    if (g[3]![6] !== 'B') out.push('boss spawn must be the centre tile');
    for (let r = 1; r <= 5; r++) {
      for (let c = 4; c <= 8; c++) if (blocking(g[r]![c]!)) out.push(`boss area blocked at ${c},${r}`);
    }
    if (count(t, HAZARD_CHARS) > 0) out.push('no hazards in boss arenas');
  }
  return out;
}

// ── Counts & naming ───────────────────────────────────────────────────────────────────────────

describe('chapter room files', () => {
  it('every chapter has its own file of at least 5 normal rooms made only for it', () => {
    expect(CHAPTER_IDS).toHaveLength(12);
    for (const id of CHAPTER_IDS) {
      const list = chapterFile(id);
      expect(list.filter((t) => t.type === 'normal').length, `${id} normal rooms`).toBeGreaterThanOrEqual(5);
      for (const t of list) expect(t.chapters, t.id).toEqual([id]);
    }
  });

  it('ships at least 64 new templates: 60+ chapter rooms and 4+ special variants', () => {
    expect(CHAPTER_ROOMS.filter((t) => t.type === 'normal').length).toBeGreaterThanOrEqual(60);
    expect(SPECIAL_ROOMS.length).toBeGreaterThanOrEqual(4);
    expect(OURS.length).toBeGreaterThanOrEqual(64);
  });

  it('ids use one prefix per chapter: <prefix>.normal.<name>', () => {
    const prefixes = new Set<string>();
    for (const id of CHAPTER_IDS) {
      const own = new Set(chapterFile(id).map((t) => t.id.split('.')[0]));
      expect(own.size, `${id} uses one id prefix`).toBe(1);
      const [p] = [...own];
      expect(prefixes.has(p!), `prefix ${p} shared`).toBe(false);
      prefixes.add(p!);
      for (const t of chapterFile(id)) expect(t.id).toMatch(new RegExp(`^${p}\\.${t.type}\\.[a-z_]+$`));
    }
  });

  it('difficulty rises with the chapter depth and every chapter mixes difficulties', () => {
    const avg = (id: string) => {
      const list = chapterFile(id).filter((t) => t.type === 'normal');
      return list.reduce((s, t) => s + t.difficulty, 0) / list.length;
    };
    const byFloor = [...CHAPTER_IDS].sort((a, b) => CHAPTERS.get(a)!.floors[0] - CHAPTERS.get(b)!.floors[0]);
    for (const id of CHAPTER_IDS) {
      const ds = new Set(chapterFile(id).map((t) => t.difficulty));
      expect(ds.size, `${id} mixes difficulties`).toBeGreaterThanOrEqual(2);
    }
    for (let i = 1; i < byFloor.length; i++) {
      const prev = byFloor[i - 1]!;
      const cur = byFloor[i]!;
      if (CHAPTERS.get(cur)!.floors[0] > CHAPTERS.get(prev)!.floors[0]) {
        expect(avg(cur), `${cur} vs ${prev}`).toBeGreaterThanOrEqual(avg(prev));
      }
    }
    const all = new Set(CHAPTER_ROOMS.map((t) => t.difficulty));
    expect([...all].sort()).toEqual([1, 2, 3]);
    expect(avg('gutterways')).toBeLessThan(1.6);
    expect(avg('eye_of_storm')).toBeGreaterThan(2.6);
  });

  it('special variants cover treasure, secret, challenge, cursed and boss rooms and fit every chapter', () => {
    const types = new Set(SPECIAL_ROOMS.map((t) => t.type));
    for (const type of REQUIRED_SPECIALS) expect(types.has(type), type).toBe(true);
    for (const t of SPECIAL_ROOMS) {
      expect(SPECIAL_TYPES, t.id).toContain(t.type);
      expect(t.chapters, t.id).toEqual(['*']);
      expect(t.id).toMatch(new RegExp(`^special\\.${t.type.toLowerCase()}\\.[a-z_]+$`));
    }
    const boss = SPECIAL_ROOMS.filter((t) => t.type === 'boss');
    expect(boss.length).toBeGreaterThanOrEqual(2);
    // "Boss arenas with some cover": every boss variant has something to hide behind.
    for (const t of boss) expect(count(t, BLOCKING_CHARS), t.id).toBeGreaterThanOrEqual(4);
  });

  it('every chapter id a template names exists', () => {
    for (const t of ROOM_TEMPLATES) {
      for (const c of t.chapters) if (c !== '*') expect(CHAPTERS.has(c), `${t.id} → ${c}`).toBe(true);
    }
  });
});

// ── Validation & fairness ─────────────────────────────────────────────────────────────────────

describe('hand-made rooms validate', () => {
  it('the whole library validates with unique ids', () => {
    expect(validateTemplates(ROOM_TEMPLATES)).toEqual([]);
  });

  it.each(OURS.map((t) => [t.id, t] as const))('%s passes validateTemplate in every mirroring', (_id, t) => {
    for (let flip = 0; flip < 4; flip++) expect(validateTemplate({ ...t, grid: templateGrid(t, flip) })).toEqual([]);
  });

  it.each(OURS.map((t) => [t.id, t] as const))('%s is fair', (_id, t) => {
    expect(fairness(t)).toEqual([]);
  });

  it('no two hand-made rooms share a layout (mirrorings included)', () => {
    const seen = new Map<string, string>();
    for (const t of OURS) {
      for (let flip = 0; flip < 4; flip++) {
        const key = `${t.type}|${templateGrid(t, flip).join('/')}`;
        const other = seen.get(key);
        if (other && other !== t.id) expect.fail(`${t.id} repeats ${other}`);
        seen.set(key, t.id);
      }
    }
    for (const t of ROOM_TEMPLATES) {
      if (OURS.includes(t)) continue;
      const other = seen.get(`${t.type}|${t.grid.join('/')}`);
      expect(other, `${other} copies ${t.id}`).toBeUndefined();
    }
  });

  it('the fairness rules catch the usual mistakes', () => {
    const base: RoomTemplate = {
      id: 'test.fair',
      chapters: ['*'],
      type: 'normal',
      difficulty: 1,
      grid: ['.............', '.............', '...e.....e...', '.............', '.............', '.............', '.............'],
    };
    expect(fairness(base)).toEqual([]);
    const withRow = (r: number, row: string, extra: Partial<RoomTemplate> = {}): RoomTemplate => ({
      ...base,
      ...extra,
      grid: base.grid.map((x, i) => (i === r ? row : x)),
    });
    expect(fairness(withRow(1, '.....e.......')).join()).toMatch(/door N/);
    expect(fairness(withRow(3, '..^..........')).join()).toMatch(/"\^" at 2,3 is within 2 steps of door W/);
    expect(fairness(withRow(5, '......#......')).join()).toMatch(/door S opens onto "#"/);
    expect(fairness(withRow(3, '...........ff')).join()).toMatch(/door E/);
    expect(fairness(withRow(2, '...eE....e...')).join()).toMatch(/no elite/);
    expect(fairness({ ...base, difficulty: 3 }).join()).toMatch(/difficulty 3 wants 5-10/);
    const fenced: RoomTemplate = {
      ...base,
      grid: ['.............', '.............', '...e.....e...', '.............', '.#f#.........', '.#p#.........', '.###.........'],
    };
    expect(fairness(fenced).join()).toMatch(/"p" at 2,5 is only reachable through fire/);
    const thorny: RoomTemplate = {
      ...base,
      grid: ['.............', '.............', '...e.....e...', '.............', '.#^#.........', '.#p#.........', '.###.........'],
    };
    expect(fairness(thorny).join()).toMatch(/only reachable over spikes/);
    expect(fairness({ ...thorny, type: 'cursed', grid: thorny.grid.map((r) => r.replace(/p/, 'c')) })).toEqual([]);
  });
});

// ── Seeded picking ────────────────────────────────────────────────────────────────────────────

interface PickStats {
  problems: string[];
  normal: number;
  own: number;
  picks: Map<string, number>;
}

function pickOverSeeds(chapterId: string, seeds: number): PickStats {
  const ch = CHAPTERS.get(chapterId)!;
  const stats: PickStats = { problems: [], normal: 0, own: 0, picks: new Map() };
  for (let seed = 1; seed <= seeds; seed++) {
    for (const f of ch.floors) {
      const L = generateFloor(seed, f, ch.track);
      pickTemplates(L, ROOM_TEMPLATES, chapterId, templateRng(seed, f, ch.track));
      const ids = L.rooms.map((r) => [r.type, r.templateId] as const);
      ids.push(['nook', L.nook.templateId]);
      for (const [type, id] of ids) {
        const t = id === null ? undefined : BY_ID.get(id);
        if (!t || t.type !== type || !fitsChapter(t, chapterId)) {
          if (stats.problems.length < 5) stats.problems.push(`seed ${seed} floor ${f}: ${type} got ${id}`);
          continue;
        }
        stats.picks.set(t.id, (stats.picks.get(t.id) ?? 0) + 1);
        if (type !== 'normal') continue;
        stats.normal++;
        if (t.chapters.includes(chapterId)) stats.own++;
      }
    }
  }
  return stats;
}

describe('generation picks chapter rooms', () => {
  it.each(CHAPTER_IDS)('%s: 500 seeds on both of its floors use its own layouts', (id) => {
    const s = pickOverSeeds(id, 500);
    expect(s.problems).toEqual([]);
    expect(s.normal).toBeGreaterThan(2500);
    // Chapter layouts get ×3 weight: well over a third of the normal rooms come from the chapter file.
    expect(s.own / s.normal).toBeGreaterThan(0.4);
    // Even a layout far from the chapter's difficulty (e.g. a difficulty-3 room on floors 3-4) shows up.
    for (const t of chapterFile(id)) expect(s.picks.get(t.id) ?? 0, `${t.id} picks`).toBeGreaterThanOrEqual(50);
  });

  it('every special variant turns up across the chapters', () => {
    const all = new Map<string, number>();
    for (const id of CHAPTER_IDS) {
      const s = pickOverSeeds(id, 200);
      expect(s.problems).toEqual([]);
      for (const [k, v] of s.picks) all.set(k, (all.get(k) ?? 0) + v);
    }
    for (const t of SPECIAL_ROOMS) expect(all.get(t.id) ?? 0, `${t.id} picks`).toBeGreaterThanOrEqual(5);
  });
});
