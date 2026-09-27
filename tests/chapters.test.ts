/** Phase 3A chapter art: tileset patterns, palettes, decor, door / map / curse sprites. */

import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/content/registry';
import { FLOOR_PATTERNS, WALL_PATTERNS, tilesetPatterns } from '../src/content/sprites/tilesets';
import * as doors from '../src/content/sprites/doors';
import * as mapIcons from '../src/content/sprites/mapIcons';
import * as decor from '../src/content/sprites/chapterDecor';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { CHAPTER_PALETTE_KEYS, type SpriteDef } from '../src/sim/types';
import { DOOR_KIND_COUNT } from '../src/sim/doors';
import { FLOOR_CURSES } from '../src/sim/floor/types';

function spritesIn(mod: Record<string, unknown>): SpriteDef[] {
  return Object.values(mod).filter((v): v is SpriteDef => typeof v === 'object' && v !== null && 'frames' in v && 'palette' in v);
}

describe('tilesets', () => {
  it.each(Object.entries(FLOOR_PATTERNS))('floor pattern %s: five 16×16 frames in floor letters', (_name, frames) => {
    expect(frames.length).toBe(5);
    for (const f of frames) {
      expect(f.length).toBe(16);
      for (const row of f) expect(row).toMatch(/^[abcmgGiIk]{16}$/);
    }
  });

  it.each(Object.entries(WALL_PATTERNS))('wall pattern %s: two 16×16 frames in wall letters', (_name, frames) => {
    expect(frames.length).toBe(2);
    for (const f of frames) {
      expect(f.length).toBe(16);
      for (const row of f) expect(row).toMatch(/^[kmWwLgG]{16}$/);
    }
  });

  it('unknown pattern names fall back to the gutter ones', () => {
    expect(tilesetPatterns('nope/nada').floorName).toBe('flagstone');
    expect(tilesetPatterns('nope/nada').wallName).toBe('brick');
  });
});

describe('chapter looks', () => {
  const chapters = [...CHAPTERS.values()];

  it('all 12 chapters have a full palette, a known tileset and decor', () => {
    expect(chapters.length).toBe(12);
    for (const c of chapters) {
      for (const k of CHAPTER_PALETTE_KEYS) expect(c.palette[k], `${c.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
      const [f, w] = c.tileset.split('/');
      expect(FLOOR_PATTERNS[f!], c.id).toBeDefined();
      expect(WALL_PATTERNS[w!], c.id).toBeDefined();
      expect(c.decor?.floor.length ?? 0, c.id).toBeGreaterThanOrEqual(2);
      expect(c.decor?.wall?.length ?? 0, c.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('every chapter looks different (floor / wall colours and patterns)', () => {
    const looks = chapters.map((c) => `${c.tileset}|${c.palette.floor}|${c.palette.brick}`);
    expect(new Set(looks).size).toBe(12);
    expect(new Set(chapters.map((c) => c.palette.floor)).size).toBe(12);
    // At least five floor patterns and four wall patterns are in use.
    expect(new Set(chapters.map((c) => c.tileset.split('/')[0])).size).toBeGreaterThanOrEqual(5);
    expect(new Set(chapters.map((c) => c.tileset.split('/')[1])).size).toBeGreaterThanOrEqual(4);
  });

  it('chapter pools keep their enemies (the art pass never removed any)', () => {
    expect(CHAPTERS.get('gutterways')!.enemyPool.length).toBe(8);
  });
});

describe('floor-run sprites', () => {
  const defs = [doors, mapIcons, decor].flatMap((m) => spritesIn(m as Record<string, unknown>));

  it.each(defs.map((d) => [d.id, d] as const))('%s is well-formed', (_id, def) => {
    expect(validateSpriteDef(def)).toEqual([]);
  });

  it('one door sprite per door kind, 24×16 with 7 frames (open, 5 bar steps, locked)', () => {
    expect(doors.DOOR_SPRITES.length).toBe(DOOR_KIND_COUNT);
    for (const s of doors.DOOR_SPRITES.slice(1)) {
      expect(s!.w).toBe(24);
      expect(s!.h).toBe(16);
      expect(s!.frames.length).toBe(7);
    }
  });

  it('every curse has an icon and a name; every special room type an icon', () => {
    for (const c of FLOOR_CURSES) {
      expect(mapIcons.CURSE_ICONS[c]).toBeDefined();
      expect(mapIcons.CURSE_NAMES[c]).toMatch(/^CURSE OF /);
    }
    for (const t of ['boss', 'treasure', 'shop', 'miniboss', 'secret', 'deepSecret', 'challenge', 'cursed', 'nook'] as const) {
      expect(mapIcons.MAP_ICONS[t]).toBeDefined();
      expect(mapIcons.MAP_DOT_COLOR[t]).toBeDefined();
    }
  });

  it('sprite ids are unique', () => {
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
