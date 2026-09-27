/**
 * What the player's items add up to, besides plain stats (rebuilt by recomputePlayer in
 * sim/effects.ts whenever the inventory changes, never per tick):
 * - flags (flight, magnet, extra slots…),
 * - trigger lists per event,
 * - the attack LOADOUT: modifier stacks, carriers and familiars, consumed by the attack pipeline
 *   (recomputeAttack in sim/attack/recomputeAttack.ts) to build the AttackProfile (ARCHITECTURE §4).
 */

import {
  PLAYER_FLAGS,
  TRIGGER_EVENTS,
  type CarrierId,
  type Effect,
  type FamiliarId,
  type ModId,
  type PlayerFlag,
  type StyleOverride,
  type TriggerEffect,
  type TriggerOn,
} from './types';

export type PlayerFlags = Record<PlayerFlag, boolean>;

export function makeFlags(): PlayerFlags {
  const f = {} as PlayerFlags;
  for (const k of PLAYER_FLAGS) f[k] = false;
  return f;
}

export function clearFlags(f: PlayerFlags): void {
  for (let i = 0; i < PLAYER_FLAGS.length; i++) f[PLAYER_FLAGS[i]!] = false;
}

/** One held trigger effect and who granted it. */
export interface TriggerInstance {
  readonly eff: TriggerEffect;
  readonly source: string;
}

export type TriggerLists = Readonly<Record<TriggerOn, readonly TriggerInstance[]>>;

/** Fresh lists (recompute builds NEW arrays, so a trigger loop in progress is never mutated). */
export function makeTriggerLists(): Record<TriggerOn, TriggerInstance[]> {
  const t = {} as Record<TriggerOn, TriggerInstance[]>;
  for (const k of TRIGGER_EVENTS) t[k] = [];
  return t;
}

/** A persistent-type effect granted temporarily (from a use or a trigger). */
export interface TempEffect {
  readonly effect: Effect;
  /** Seconds left; Infinity = until the player leaves the room. */
  time: number;
  readonly source: string;
}

export interface ModStackRecord {
  /** Total stacks from every source. */
  stacks: number;
  /** Numeric params summed across sources. */
  params: Record<string, number>;
  /** Item/synergy ids contributing (duplicates = several copies). */
  sources: string[];
}

export class Loadout {
  readonly mods = new Map<ModId, ModStackRecord>();
  readonly carriers = new Set<CarrierId>();
  /** Copies of each carrier held (duplicates stack: thicker lances, more orbit blades…). */
  readonly carrierStacks = new Map<CarrierId, number>();
  readonly familiars = new Map<FamiliarId, number>();
  /** Item ids with a costume (in pickup order; duplicates collapsed), then 'set:<id>' per transformation. */
  readonly costumes: string[] = [];
  /** Shot look overrides of the transformations and active synergies (composeStyle applies them in order). */
  readonly styles: StyleOverride[] = [];
  /** Bumped on every rebuild (the attack pipeline can cache on it). */
  version = 0;

  clear(): void {
    this.mods.clear();
    this.carriers.clear();
    this.carrierStacks.clear();
    this.familiars.clear();
    this.costumes.length = 0;
    this.styles.length = 0;
  }

  addCarrier(c: CarrierId, stacks = 1): void {
    this.carriers.add(c);
    this.carrierStacks.set(c, (this.carrierStacks.get(c) ?? 0) + stacks);
  }

  addMod(mod: ModId, stacks: number, params: Readonly<Record<string, number>> | undefined, source: string): void {
    let r = this.mods.get(mod);
    if (!r) {
      r = { stacks: 0, params: {}, sources: [] };
      this.mods.set(mod, r);
    }
    r.stacks += stacks;
    r.sources.push(source);
    if (params) for (const k of Object.keys(params)) r.params[k] = (r.params[k] ?? 0) + params[k]!;
  }

  addFamiliar(id: FamiliarId, count: number): void {
    this.familiars.set(id, (this.familiars.get(id) ?? 0) + count);
  }
}
