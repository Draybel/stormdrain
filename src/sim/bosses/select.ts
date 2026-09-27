/**
 * Which boss a floor gets (deterministic, seeded). Pools follow the same union rule as enemies: a
 * chapter's explicit `bossPool` / `minibossPool` ∪ every boss of that kind whose `chapters` lists it
 * (registry.bossesInChapter). While a chapter has no bosses of its own yet, every boss of the kind is a
 * candidate (scaled up for depth, see bossHpFor). Final bosses are picked by their `final` key.
 */

import { floorRng } from '../../engine/rng';
import { BOSSES, CHAPTERS, bossesInChapter } from '../../content/registry';
import { BOSS_TUNING } from '../tuning';
import type { BossDef, Track } from '../types';

type BossKind = BossDef['kind'];

/** Candidates of a kind for a chapter (registry order). */
export function bossPool(chapterId: string, kind: BossKind): BossDef[] {
  const own = bossesInChapter(chapterId, kind);
  if (own.length > 0) return own;
  const all: BossDef[] = [];
  for (const d of BOSSES.values()) if (d.kind === kind) all.push(d);
  return all;
}

/** The final boss for a floor's `finalBoss` key (first in registry order), or undefined. */
export function finalBossDef(key: string): BossDef | undefined {
  for (const d of BOSSES.values()) if (d.kind === 'final' && d.final === key) return d;
  return undefined;
}

/**
 * The seeded pick for a floor's boss (or miniboss) room: `floorRng(seed, floor, track).fork(kind)`,
 * weighted by `BossDef.weight`. `avoid` (the previous floor's pick in the same chapter) is skipped when
 * there is an alternative, so a chapter's two floors show two different bosses when it has them.
 */
export function pickBoss(seed: number, floor: number, track: Track, chapterId: string, kind: BossKind, avoid = ''): BossDef | null {
  const list = bossPool(chapterId, kind);
  if (list.length === 0) return null;
  const cands = avoid && list.length > 1 ? list.filter((d) => d.id !== avoid) : list;
  return floorRng(seed, floor, track).fork(kind).weightedPick(cands, (d) => d.weight ?? 1);
}

/** The first floor of a boss's home chapter (1 when unknown). */
export function homeFloor(def: BossDef): number {
  const ch = def.chapters.length > 0 ? CHAPTERS.get(def.chapters[0]!) : undefined;
  return ch ? ch.floors[0] : 1;
}

/** A boss's HP on a floor: its own HP, scaled up when it appears deeper than its home chapter. */
export function bossHpFor(def: BossDef, floor: number): number {
  const deeper = Math.max(0, floor - homeFloor(def) - 1);
  return Math.round(def.hp * (1 + BOSS_TUNING.hpPerFloor * deeper));
}
