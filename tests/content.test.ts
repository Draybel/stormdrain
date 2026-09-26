import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../src/sim/types';
import { validateSpriteDef } from '../src/content/sprites/validate';
import * as wren from '../src/content/sprites/wren';
import * as props from '../src/content/sprites/props';
import * as gutter from '../src/content/sprites/gutterways';
import * as ui from '../src/content/sprites/ui';
import { TEST_ROOM } from '../src/content/testRoom';
import { RoomGrid, parseRoomLayout } from '../src/sim/room';

function spriteDefsIn(mod: Record<string, unknown>): SpriteDef[] {
  return Object.values(mod).filter(
    (v): v is SpriteDef => typeof v === 'object' && v !== null && 'frames' in v && 'palette' in v,
  );
}

describe('sprite data', () => {
  const defs = [wren, props, gutter, ui].flatMap((m) => spriteDefsIn(m as Record<string, unknown>));

  it('finds the sprites', () => {
    expect(defs.length).toBeGreaterThanOrEqual(12);
  });

  it.each(defs.map((d) => [d.id, d] as const))('%s is well-formed', (_id, def) => {
    expect(validateSpriteDef(def)).toEqual([]);
  });

  it('sprite ids are unique', () => {
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Wren has idle, 4-direction walk, hurt and death animations', () => {
    const a = wren.WREN_SPRITE.anims!;
    for (const k of ['idleDown', 'walkDown', 'walkUp', 'walkSide', 'hurt', 'death']) expect(a[k]).toBeDefined();
    expect(a.walkDown!.frames.length).toBeGreaterThanOrEqual(3);
    expect(a.death!.frames.length).toBeGreaterThanOrEqual(2);
  });
});

describe('test room', () => {
  it('parses with a player start and 2-3 dummies', () => {
    const grid = new RoomGrid();
    const markers = parseRoomLayout(TEST_ROOM, grid);
    expect(markers.filter((m) => m.ch === '@')).toHaveLength(1);
    const dummies = markers.filter((m) => m.ch === 'D').length;
    expect(dummies).toBeGreaterThanOrEqual(2);
    expect(dummies).toBeLessThanOrEqual(3);
  });

  it('rejects malformed layouts', () => {
    expect(() => parseRoomLayout(['...'], new RoomGrid())).toThrow();
  });
});

/** src/sim must stay headless (ARCHITECTURE §3). */
describe('sim purity', () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
    });
  }
  const banned = /\b(window|document|navigator|localStorage|AudioContext|HTMLCanvasElement|requestAnimationFrame)\b/;

  it.each(files(join(__dirname, '../src/sim')))('%s has no DOM access', (file) => {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(banned);
  });
});
