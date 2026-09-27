/**
 * The achievements framework (ARCHITECTURE §7a). AchievementDefs (src/content/achievements/*.ts) wait
 * either for a lifetime COUNTER (meta stats / counters / bestiary…) to reach a value, or for an EVENT the
 * meta tracker reports from a run (a boss killed, an ending reached, 10 items held…), optionally filtered
 * by id / exact value / minimum value.
 *
 * Earning one: `meta.unlockAchievement(id)` (timestamped, saved at the end of the tick), then its rewards —
 * the `unlocks` entries and every item / character whose `unlock` names it — go into the meta unlock sets,
 * and an {@link EarnedAchievement} joins the `earned` queue (the UI's toast drains it).
 *
 * DOM-free and allocation-free on the check paths (counter checks run at most once per tick, and only when
 * the tracker changed something).
 */

import { allAchievements, allItems, CHARACTERS } from '../content/registry';
import type { AchievementDef, AchievementEvent, AchievementEventCondition, UnlockRef } from '../sim/types';
import { STAT_KEYS, type MetaState, type MetaStore, type StatKey } from './metaState';
import { UNLOCK_SET } from './unlocks';

export interface EarnedAchievement {
  id: string;
  name: string;
  desc: string;
  /** What it unlocked, as short display lines ('NEW ITEM: PARTY POPPER'). */
  rewards: string[];
}

/** Reward lines for the ending / route flags. */
const FLAG_TEXT: Readonly<Record<string, string>> = {
  ending1: 'THE HIDDEN ROUTE RUNS DEEPER',
  ending2: 'THE WATER BEGINS TO TURN...',
  ending3: 'EVERYTHING COMES HOME',
};

const STAT_SET: ReadonlySet<string> = new Set(STAT_KEYS);

/**
 * The value of a counter name (see AchievementCounterCondition): a stat, a meta counter, or a keyed count
 * ('killed.<id>', 'collected.<id>', 'charWins.<id>', 'charRuns.<id>', 'achievements', 'discovered').
 */
export function counterValue(m: MetaState, name: string): number {
  const dot = name.indexOf('.');
  return dot > 0 ? resolveCounter(m, name.slice(0, dot), name.slice(dot + 1)) : resolveCounter(m, name, '');
}

/** `head` = the counter name, or the part before the dot of a keyed count; `key` = the part after it. */
function resolveCounter(m: MetaState, head: string, key: string): number {
  if (key !== '') {
    switch (head) {
      case 'killed':
        return m.bestiary[key]?.killed ?? 0;
      case 'seen':
        return m.bestiary[key]?.seen ?? 0;
      case 'collected':
        return m.collection[key]?.collected ?? 0;
      case 'charWins':
        return m.stats.charWins[key] ?? 0;
      case 'charRuns':
        return m.stats.charRuns[key] ?? 0;
      default:
        return m.stats.counters[`${head}.${key}`] ?? 0;
    }
  }
  const name = head;
  if (STAT_SET.has(name)) return m.stats[name as StatKey];
  if (name === 'achievements') {
    let n = 0;
    for (const _ in m.achievements) n++;
    return n;
  }
  if (name === 'discovered') {
    let n = 0;
    for (const k in m.collection) if (m.collection[k]!.seen > 0) n++;
    return n;
  }
  return m.stats.counters[name] ?? 0;
}

/** A counter condition, its name split once (no string work per check). */
interface CounterWatch {
  def: AchievementDef;
  head: string;
  key: string;
  atLeast: number;
}

export class AchievementEngine {
  /** Earned since the UI last drained it (oldest first). */
  readonly earned: EarnedAchievement[] = [];
  private readonly meta: MetaStore;
  private readonly defs: readonly AchievementDef[];
  /** Not yet earned: counter watches, and event conditions by event kind. */
  private readonly counters: CounterWatch[] = [];
  private readonly events = new Map<AchievementEvent, AchievementDef[]>();

  constructor(meta: MetaStore, defs: readonly AchievementDef[] = allAchievements()) {
    this.meta = meta;
    this.defs = defs;
    this.rebuild();
  }

  /** Re-reads which achievements are still to earn (after an import / a progress reset). */
  rebuild(): void {
    this.counters.length = 0;
    this.events.clear();
    for (const d of this.defs) {
      if (this.meta.hasAchievement(d.id)) continue;
      const c = d.condition;
      if (c.kind === 'event') {
        let list = this.events.get(c.event);
        if (!list) this.events.set(c.event, (list = []));
        list.push(d);
      } else {
        const dot = c.counter.indexOf('.');
        const head = dot > 0 ? c.counter.slice(0, dot) : c.counter;
        const key = dot > 0 ? c.counter.slice(dot + 1) : '';
        this.counters.push({ def: d, head, key, atLeast: c.atLeast });
      }
    }
  }

  /** Achievements still waiting (tests / UI). */
  get pending(): number {
    let n = this.counters.length;
    for (const l of this.events.values()) n += l.length;
    return n;
  }

  /** Grants every counter achievement whose counter has reached its value. Returns how many. */
  checkCounters(): number {
    const m = this.meta.state;
    let n = 0;
    for (let i = 0; i < this.counters.length; i++) {
      const c = this.counters[i]!;
      if (resolveCounter(m, c.head, c.key) < c.atLeast) continue;
      this.counters.splice(i--, 1);
      if (this.grant(c.def)) n++;
    }
    return n;
  }

  /** Something happened in a run: grants the event achievements whose filters match. */
  event(kind: AchievementEvent, id = '', value = 0): void {
    const list = this.events.get(kind);
    if (!list || list.length === 0) return;
    for (let i = 0; i < list.length; i++) {
      const d = list[i]!;
      const c = d.condition as AchievementEventCondition;
      if (c.id !== undefined && c.id !== id) continue;
      if (c.value !== undefined && c.value !== value) continue;
      if (c.atLeast !== undefined && value < c.atLeast) continue;
      list.splice(i--, 1);
      this.grant(d);
    }
  }

  /** Earns an achievement now (debug, tests, conditions). False when it was already earned. */
  grant(def: AchievementDef): boolean {
    if (!this.meta.unlockAchievement(def.id)) return false;
    const rewards = this.applyRewards(def);
    this.earned.push({ id: def.id, name: def.name, desc: def.desc, rewards });
    return true;
  }

  /** Next earned achievement for the toast (oldest first), or undefined. */
  drain(): EarnedAchievement | undefined {
    return this.earned.shift();
  }

  /**
   * Makes sure every earned achievement's rewards are unlocked (an update may add rewards to an old
   * achievement; an import may bring achievements without their unlocks). Quiet: no toasts.
   */
  syncRewards(): void {
    for (const d of this.defs) if (this.meta.hasAchievement(d.id)) this.applyRewards(d);
  }

  private applyRewards(def: AchievementDef): string[] {
    const meta = this.meta;
    const lines: string[] = [];
    for (const u of def.unlocks) if (meta.unlock(UNLOCK_SET[u.kind] ?? `${u.kind}s`, u.id)) lines.push(rewardText(u));
    for (const d of allItems()) {
      if (d.unlock === def.id && meta.unlock('items', d.id)) lines.push(`NEW ITEM: ${d.name.toUpperCase()}`);
    }
    for (const c of CHARACTERS.values()) {
      if (c.unlock === def.id && meta.unlock('characters', c.id)) lines.push(`NEW CHARACTER: ${c.name.toUpperCase()}`);
    }
    return lines;
  }
}

/**
 * Everything an achievement unlocks, as display lines (the achievements page; nothing is unlocked): its
 * `unlocks` entries, then every item / character whose `unlock` names it.
 */
export function rewardLines(def: AchievementDef): string[] {
  const lines: string[] = [];
  for (const u of def.unlocks) lines.push(rewardText(u));
  for (const d of allItems()) if (d.unlock === def.id) lines.push(`NEW ITEM: ${d.name.toUpperCase()}`);
  for (const c of CHARACTERS.values()) if (c.unlock === def.id) lines.push(`NEW CHARACTER: ${c.name.toUpperCase()}`);
  return lines;
}

function rewardText(u: UnlockRef): string {
  switch (u.kind) {
    case 'item':
      return `NEW ITEM: ${(allItems().find((d) => d.id === u.id)?.name ?? u.id).toUpperCase()}`;
    case 'character':
      return `NEW CHARACTER: ${(CHARACTERS.get(u.id)?.name ?? u.id).toUpperCase()}`;
    case 'ending':
    case 'route':
      return FLAG_TEXT[u.id] ?? `NEW ROUTE: ${u.id.toUpperCase()}`;
    case 'challenge':
      return `NEW CHALLENGE: ${u.id.toUpperCase()}`;
    default:
      return `UNLOCKED: ${u.id.toUpperCase()}`;
  }
}
