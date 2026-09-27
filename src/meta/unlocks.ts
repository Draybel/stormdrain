/**
 * What is unlocked, read from the meta save (ARCHITECTURE §7): items flagged `unlock` roll in runs only
 * once unlocked, characters with `unlock` are playable once unlocked, and the route / ending flags open
 * the hidden route into chapter 6 ('ending1') and the whirlpool to floor 13 ('ending1' + 'ending2').
 *
 * An item / character counts as unlocked when its id is in the meta unlock set OR the achievement its
 * `unlock` names has been earned (so content added after the achievement was earned is unlocked too).
 * `runUnlocks()` is the snapshot a new run takes (`RunOptions.unlocked`): it never changes mid-run.
 */

import { allAchievements, allCharacters, allItems } from '../content/registry';
import type { RunSeedInfo } from '../sim/run/types';
import type { CharacterDef, ItemDef } from '../sim/types';
import type { MetaState, MetaStore } from './metaState';

/** The meta unlock-set name for each achievement reward kind (UnlockRef.kind). */
export const UNLOCK_SET: Readonly<Record<string, string>> = {
  item: 'items',
  character: 'characters',
  route: 'routes',
  ending: 'endings',
  challenge: 'challenges',
  chapter: 'chapters',
  feature: 'features',
};

function has(m: MetaState, kind: string, id: string): boolean {
  return m.unlocks[kind]?.has(id) ?? false;
}

export function itemUnlocked(m: MetaState, def: ItemDef): boolean {
  if (def.unlock === undefined) return true;
  return has(m, 'items', def.id) || def.unlock in m.achievements;
}

export function characterUnlocked(m: MetaState, def: CharacterDef): boolean {
  if (def.unlock === undefined) return true;
  return has(m, 'characters', def.id) || def.unlock in m.achievements;
}

/** Playable characters (registry order). */
export function unlockedCharacters(m: MetaState): CharacterDef[] {
  return allCharacters().filter((c) => characterUnlocked(m, c));
}

/** Items flagged `unlock` that are still locked (the collection page shows them as locked). */
export function lockedItems(m: MetaState): string[] {
  return allItems()
    .filter((d) => d.unlock !== undefined && !itemUnlocked(m, d))
    .map((d) => d.id);
}

/**
 * The unlock snapshot a new run carries (`RunOptions.unlocked`): every unlocked `unlock`-flagged item,
 * the endings reached ('ending1'...) and the routes opened. Sorted, so the same meta gives the same list.
 */
export function runUnlocks(m: MetaState): string[] {
  const out = new Set<string>();
  for (const d of allItems()) if (d.unlock !== undefined && itemUnlocked(m, d)) out.add(d.id);
  for (const id of m.unlocks.endings) out.add(id);
  for (const id of m.unlocks.routes) out.add(id);
  return [...out].sort();
}

/**
 * The unlock snapshot a run starts with (`RunOptions.unlocked`) — the rule that makes a seed recreate its run:
 * - a typed code ('custom') or a daily: the CANONICAL snapshot of a fresh save (nothing unlocked: only ungated items
 *   roll, no route / ending flags), so the same code gives the same floors, items and bosses on every save and
 *   before or after any unlock (and every player's daily is the same run);
 * - a random run: the player's own unlocks (`runUnlocks`);
 * - `fixed` (RETRY SEED): the finished run's stored `RunData.unlocked`, so the retry is the same run as the original.
 */
export function unlocksForRun(m: MetaState, seed: RunSeedInfo | null | undefined, fixed?: readonly string[]): string[] {
  if (fixed) return [...new Set(fixed)].sort();
  if (seed && seed.kind !== 'random') return [];
  return runUnlocks(m);
}

/**
 * Debug (the debug menu's UNLOCK ALL, Phase 5): every `unlock`-flagged item and character, and every reward an
 * achievement's `unlocks` names (the endings — so the hidden route and the whirlpool open —, routes,
 * challenges…) go into the meta unlock sets. No achievement is earned by it. Returns how many were new.
 * Runs already under way keep their snapshot; the next new run has everything.
 */
export function unlockEverything(meta: MetaStore): number {
  let n = 0;
  for (const d of allItems()) if (d.unlock !== undefined && meta.unlock('items', d.id)) n++;
  for (const c of allCharacters()) if (c.unlock !== undefined && meta.unlock('characters', c.id)) n++;
  for (const a of allAchievements()) {
    for (const u of a.unlocks) if (meta.unlock(UNLOCK_SET[u.kind] ?? `${u.kind}s`, u.id)) n++;
  }
  return n;
}
