/**
 * Per-chapter tile art: the tileset patterns (content/sprites/tilesets.ts) and the shared rock / pit /
 * corner pixel maps recoloured with a ChapterDef's palette, plus its decor. Built once per chapter
 * (new SpriteDef objects, so the sprite cache rasterises each chapter's frames once) and cached.
 */

import { CHAPTERS } from '../content/registry';
import { CORNER_SPRITE, PIT_SPRITE, ROCK_SPRITE } from '../content/sprites/gutterways';
import { OUTLINE } from '../content/sprites/palette';
import { tilesetPatterns } from '../content/sprites/tilesets';
import type { ChapterAmbience, ChapterDef, SpriteDef } from '../sim/types';
import { parseHexColor } from './canvas';

export interface ChapterArt {
  id: string;
  floor: SpriteDef;
  wall: SpriteDef;
  corner: SpriteDef;
  rock: SpriteDef;
  pit: SpriteDef;
  /** Pit side rims / the floor edge below a pit. */
  pitRim: string;
  pitEdge: string;
  /** Wall streak colour as 'rgba(…)' (null = none). */
  streak: string | null;
  decals: readonly SpriteDef[];
  trims: readonly SpriteDef[];
  decalCount: readonly [number, number];
  ambience: ChapterAmbience;
  /** Accent colours for ambience / UI (moss, mossLight, waterLight). */
  accent: string;
  accentLight: string;
  glow: string;
}

const cache = new Map<string, ChapterArt>();

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Linear mix of two #rrggbb colours. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  return `#${hex2(ca[0]! + (cb[0]! - ca[0]!) * t)}${hex2(ca[1]! + (cb[1]! - ca[1]!) * t)}${hex2(ca[2]! + (cb[2]! - ca[2]!) * t)}`;
}

function rgba(hex: string, a: number): string {
  const c = parseHexColor(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function build(c: ChapterDef): ChapterArt {
  const p = c.palette as Readonly<Record<string, string>>;
  const col = (k: string, fallback: string): string => p[k] ?? fallback;
  const pat = tilesetPatterns(c.tileset);
  const wallPal = {
    k: col('deep', '#0b0d14'),
    m: col('mortar', '#181c29'),
    W: col('brick', '#39435a'),
    w: col('brickShade', '#2c3447'),
    L: col('brickLight', '#4b5773'),
    g: col('moss', '#35523a'),
    G: col('mossLight', '#4f7447'),
  };
  const floor: SpriteDef = {
    id: `ch.${c.id}.floor.${pat.floorName}`,
    w: 16,
    h: 16,
    palette: {
      a: col('floor', '#283044'),
      b: col('floorLight', '#2e374c'),
      c: col('floorDark', '#232a3b'),
      m: col('mortar', '#181c29'),
      g: col('moss', '#35523a'),
      G: col('mossLight', '#4f7447'),
      i: col('stoneShade', '#3e455a'),
      I: col('stone', '#5c6580'),
      k: col('deep', '#0b0d14'),
    },
    frames: pat.floor,
  };
  const wall: SpriteDef = { id: `ch.${c.id}.wall.${pat.wallName}`, w: 16, h: 16, palette: wallPal, frames: pat.wall };
  const corner: SpriteDef = { ...CORNER_SPRITE, id: `ch.${c.id}.corner`, palette: wallPal };
  const rock: SpriteDef = {
    ...ROCK_SPRITE,
    id: `ch.${c.id}.rock`,
    palette: {
      o: OUTLINE,
      R: col('stone', '#5c6580'),
      L: col('stoneLight', '#8691ad'),
      r: col('stoneShade', '#3e455a'),
      g: col('moss', '#35523a'),
      G: col('mossLight', '#4f7447'),
    },
  };
  const deep = col('deep', '#0b0d14');
  const voidC = col('void', '#05060a');
  const pit: SpriteDef = {
    ...PIT_SPRITE,
    id: `ch.${c.id}.pit`,
    palette: {
      v: voidC,
      u: col('voidSpeck', '#0c0f18'),
      L: mixHex(col('floorLight', '#2e374c'), col('stoneLight', '#8691ad'), 0.25),
      S: col('floorDark', '#232a3b'),
      m: col('mortar', '#181c29'),
      s: mixHex(col('mortar', '#181c29'), deep, 0.4),
      t: mixHex(deep, voidC, 0.3),
      d: mixHex(deep, voidC, 0.7),
    },
  };
  const d = c.decor;
  return {
    id: c.id,
    floor,
    wall,
    corner,
    rock,
    pit,
    pitRim: mixHex(col('floorDark', '#232a3b'), col('floorLight', '#2e374c'), 0.6),
    pitEdge: col('floorLight', '#2e374c'),
    streak: d?.streak ? rgba(d.streak, 0.16) : null,
    decals: d?.floor ?? [],
    trims: d?.wall ?? [],
    decalCount: d?.count ?? [4, 8],
    ambience: d?.ambience ?? 'none',
    accent: col('moss', '#35523a'),
    accentLight: col('mossLight', '#4f7447'),
    glow: col('waterLight', '#6d9ac0'),
  };
}

/** The art for a chapter id (unknown ids get the Gutterways). */
export function chapterArt(id: string): ChapterArt {
  let a = cache.get(id);
  if (!a) {
    const def = CHAPTERS.get(id) ?? CHAPTERS.get('gutterways') ?? [...CHAPTERS.values()][0]!;
    a = build(def);
    cache.set(id, a);
  }
  return a;
}
