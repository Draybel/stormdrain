/**
 * Chapter lookups for floor runs: which ChapterDef a (floor, track) uses and which enemies it rolls.
 * Floors 1-12 → chapters 1-6 (two floors each) on the main or alt track (DESIGN.md "Chapters");
 * floor 13 (The Undertow) has no chapter of its own yet and borrows the Eye of the Storm.
 */

import { CHAPTERS, ENEMIES, enemiesInChapter } from '../../content/registry';
import type { FloorTrack } from '../floor/types';
import type { ChapterDef, EnemyDef } from '../types';

const FALLBACK_CHAPTER = 'gutterways';
const UNDERTOW_STAND_IN = 'eye_of_storm';

/** The chapter a floor of a track belongs to. */
export function chapterFor(floor: number, track: FloorTrack): ChapterDef {
  if (floor >= 13) return CHAPTERS.get(UNDERTOW_STAND_IN) ?? CHAPTERS.get(FALLBACK_CHAPTER)!;
  for (const c of CHAPTERS.values()) {
    if (c.track === track && (c.floors[0] === floor || c.floors[1] === floor)) return c;
  }
  // A track without that chapter (content missing): the main track's, then chapter 1.
  for (const c of CHAPTERS.values()) {
    if (c.track === 'main' && (c.floors[0] === floor || c.floors[1] === floor)) return c;
  }
  return CHAPTERS.get(FALLBACK_CHAPTER) ?? [...CHAPTERS.values()][0]!;
}

/** Chapter number 1-6 of a chapter (from its floors). */
export function chapterNumber(c: ChapterDef): number {
  return Math.ceil(c.floors[0] / 2);
}

/**
 * Enemies a chapter's rooms roll: its pool (explicit list ∪ enemies listing the chapter), or — while a
 * chapter has no enemies yet (content in progress) — every rollable enemy. Registry order.
 */
export function chapterEnemies(chapterId: string): EnemyDef[] {
  const list = enemiesInChapter(chapterId);
  if (list.length > 0) return list;
  const all: EnemyDef[] = [];
  for (const d of ENEMIES.values()) if (d.weight > 0) all.push(d);
  return all;
}
