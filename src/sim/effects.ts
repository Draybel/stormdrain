/**
 * The effect engine: how items change the player (ARCHITECTURE §3, §5).
 *
 * Two families of effects (see the Effect docs in types.ts):
 * - PERSISTENT (stat, mod, carrier, familiar, flag, trigger) are derived from what the player holds:
 *   `recomputePlayer` rebuilds stats, flags, trigger lists and the attack loadout from the inventory
 *   (+ completed sets, active synergies and temporary effects). It runs only when something changes.
 * - INSTANT (heal, hearts, pickups, hook) run when a fresh item is first picked up, when an
 *   active/consumable is used, or when a trigger fires. Persistent effects executed in those
 *   contexts become TEMPORARY (their `duration`, or until the player leaves the room).
 *
 * Triggers: `fireTrigger(w, on, x, y)` is called by the sim at each event (hurt, roomClear, kill, fire,
 * floorStart, bomb, pickup, use). Each held trigger rolls its chance (+ luck scaling) on combatRng.
 */

import { allSets, allSynergies, findItem, findSet, getItem } from '../content/registry';
import { recomputeAttack } from './attack/recomputeAttack';
import { explode } from './bombs';
import { damageArea } from './combat';
import { BONUS_EMBER, BONUS_TIN, addBonus, addContainers, heal } from './health';
import { getHook, type HookApi, type HookCtx } from './hooks';
import {
  addCharge,
  addConsumable,
  addCounter,
  addTrinket,
  countItem,
  isCharged,
  setActive,
  takeConsumable,
  type ActiveSlot,
} from './inventory';
import { clearFlags, makeTriggerLists } from './loadout';
import { FIREFLY_ID, mechanicFamiliars, mechanicFloorStart, mechanicRoomClear } from './mechanics';
import { spawnPedestal } from './pedestals';
import { pickupKindOf } from './pickupKinds';
import { spawnDrops, spawnItemPickup, spawnLoot } from './pickups';
import { computeStats, type StatMod } from './stats';
import { drinkTonic } from './tonics';
import { ITEM_TUNING } from './tuning';
import type {
  Effect,
  HeartsEffect,
  HookEffect,
  ItemDef,
  ItemId,
  ItemSetDef,
  PickupsEffect,
  Requirement,
  SynergyDef,
  TriggerEffect,
  TriggerOn,
} from './types';
import type { Player } from './player';
import type { World } from './world';

/** Trigger → effect → trigger chains stop at this depth. */
export const MAX_TRIGGER_DEPTH = 3;

export function isPersistent(e: Effect): boolean {
  switch (e.type) {
    case 'stat':
    case 'mod':
    case 'carrier':
    case 'familiar':
    case 'flag':
    case 'trigger':
      return true;
    default:
      return false;
  }
}

/** Effective chance of a trigger for a given luck (base + luck × scaling, clamped to [0, maxChance]). */
export function triggerChance(e: TriggerEffect, luck: number): number {
  const c = (e.chance ?? 1) + luck * (e.luck ?? 0);
  const max = e.maxChance ?? 1;
  return c < 0 ? 0 : c > max ? max : c;
}

// ── Recompute (persistent effects) ────────────────────────────────────────────

const statMods: StatMod[] = [];
const luckMod = { stat: 'luck' as const, add: 0 };

function addPersistent(p: Player, e: Effect, source: string, triggers: ReturnType<typeof makeTriggerLists>): void {
  switch (e.type) {
    case 'stat':
      statMods.push(e);
      break;
    case 'flag':
      p.flags[e.flag] = true;
      break;
    case 'trigger':
      triggers[e.on].push({ eff: e, source });
      break;
    case 'mod':
      p.loadout.addMod(e.mod, e.stacks ?? 1, e.params, source);
      break;
    case 'carrier':
      p.loadout.addCarrier(e.carrier);
      break;
    case 'familiar':
      p.loadout.addFamiliar(e.familiar, e.count ?? 1);
      break;
    default:
      break;
  }
}

function addItemEffects(p: Player, def: ItemDef | undefined, triggers: ReturnType<typeof makeTriggerLists>): void {
  if (!def) return;
  if (def.costume && !p.loadout.costumes.includes(def.id)) p.loadout.costumes.push(def.id);
  for (let i = 0; i < def.effects.length; i++) {
    const e = def.effects[i]!;
    if (isPersistent(e)) addPersistent(p, e, def.id, triggers);
  }
}

/** Every held item def (passives with duplicates, the active, trinkets). */
function forEachHeld(p: Player, fn: (def: ItemDef) => void): void {
  const inv = p.inv;
  for (let i = 0; i < inv.passives.length; i++) {
    const d = findItem(inv.passives[i]!);
    if (d) fn(d);
  }
  if (inv.active) {
    const d = findItem(inv.active.id);
    if (d) fn(d);
  }
  for (let i = 0; i < inv.trinkets.length; i++) {
    const d = findItem(inv.trinkets[i]!);
    if (d) fn(d);
  }
}

/** Scratch list of distinct item ids (set / tag counting; recompute only, never per tick). */
const distinct: string[] = [];

/** How many DISTINCT held items (passives, the active, trinkets) pass `test` — duplicates count once. */
function countDistinct(p: Player, test: (d: ItemDef) => boolean): number {
  distinct.length = 0;
  forEachHeld(p, (d) => {
    if (test(d) && !distinct.includes(d.id)) distinct.push(d.id);
  });
  const n = distinct.length;
  distinct.length = 0;
  return n;
}

/** Distinct held items of an item set (a transformation needs `need` of them). */
export function setProgress(p: Player, setId: string): number {
  return countDistinct(p, (d) => d.set === setId);
}

/** A synergy requirement: an item held, or at least `count` DISTINCT held items carrying the tag. */
export function requirementMet(p: Player, req: Requirement): boolean {
  if (typeof req === 'string') return countItem(p.inv, req) > 0;
  return countDistinct(p, (d) => d.tags.includes(req.tag)) >= (req.count ?? 1);
}

/** Sets / synergies that switched on for the first time during a recompute (their one-time part runs after it). */
const firstSets: ItemSetDef[] = [];
const firstSynergies: SynergyDef[] = [];

/**
 * Rebuilds everything derived from the inventory: stats, flags, trigger lists, slot counts,
 * transformations, synergies and the attack loadout (then asks the attack pipeline to rebuild).
 * Allocates a little (fresh trigger arrays) — it only runs when items change.
 *
 * Transformations (ItemSetDef): `need` distinct held items of a set add it to `p.sets` for the rest of the
 * run; every set in `p.sets` adds its costume ('set:<id>'), style and persistent effects. Synergies
 * (SynergyDef) are active while their requirements hold. A set's / synergy's FIRST activation in the run
 * emits 'transform' / 'synergy' and runs its instant effects and hook once — after the rebuild, because
 * they may change items (and recompute again).
 */
export function recomputePlayer(w: World): void {
  const p = w.player;
  statMods.length = 0;
  clearFlags(p.flags);
  p.loadout.clear();
  const triggers = makeTriggerLists();

  forEachHeld(p, (d) => addItemEffects(p, d, triggers));

  // The character's innate effects (a carrier, a modifier, flags, familiars…) and what its mechanic adds now
  // (Juniper's temporary fireflies — sim/mechanics.ts).
  const innate = p.character.innate;
  if (innate) for (let i = 0; i < innate.length; i++) if (isPersistent(innate[i]!)) addPersistent(p, innate[i]!, p.character.id, triggers);
  const extraFlies = mechanicFamiliars(p);
  if (extraFlies > 0) p.loadout.addFamiliar(FIREFLY_ID, extraFlies);

  // Item sets (transformations): earned once, kept for the run.
  const sets = allSets();
  for (let s = 0; s < sets.length; s++) {
    const set = sets[s]!;
    if (p.sets.includes(set.id) || setProgress(p, set.id) < Math.max(1, set.need)) continue;
    p.sets.push(set.id);
    firstSets.push(set);
  }
  for (let s = 0; s < p.sets.length; s++) {
    const set = findSet(p.sets[s]!);
    if (!set) continue;
    if (set.costume) p.loadout.costumes.push(`set:${set.id}`);
    if (set.style) p.loadout.styles.push(set.style);
    for (const e of set.effects) if (isPersistent(e)) addPersistent(p, e, set.id, triggers);
  }

  // Special synergies: active while their requirements hold.
  p.synergies.length = 0;
  const syns = allSynergies();
  for (let s = 0; s < syns.length; s++) {
    const syn = syns[s]!;
    let ok = syn.requires.length > 0;
    for (let r = 0; r < syn.requires.length && ok; r++) ok = requirementMet(p, syn.requires[r]!);
    if (!ok) continue;
    p.synergies.push(syn.id);
    if (syn.style) p.loadout.styles.push(syn.style);
    for (const e of syn.effects) if (isPersistent(e)) addPersistent(p, e, syn.id, triggers);
    if (!p.synergiesSeen.includes(syn.id)) {
      p.synergiesSeen.push(syn.id);
      firstSynergies.push(syn);
    }
  }

  // Temporary effects from uses / triggers.
  for (let i = 0; i < p.temps.length; i++) addPersistent(p, p.temps[i]!.effect, p.temps[i]!.source, triggers);

  if (p.luckBonus !== 0) {
    luckMod.add = p.luckBonus;
    statMods.push(luckMod);
  }
  computeStats(p.character.stats, statMods, p.stats);
  statMods.length = 0;

  p.triggers = triggers;
  p.inv.trinketSlots = p.flags.extraTrinket ? 2 : 1;
  p.inv.consumableSlots = p.flags.extraConsumable ? 2 : 1;
  p.statsVersion++;
  p.loadout.version++;
  recomputeAttack(p);

  if (firstSets.length > 0 || firstSynergies.length > 0) runFirstActivations(w);
}

/** The one-time part of new transformations / synergies: event, instant effects, hook. */
function runFirstActivations(w: World): void {
  const p = w.player;
  // Copies: the effects below may recompute (and fill the scratch lists) again.
  const sets = firstSets.splice(0);
  const syns = firstSynergies.splice(0);
  for (const set of sets) {
    w.events.emit('transform', p.x, p.y - 12, p.sets.length, 0, set.id);
    executeEffects(w, set.effects, p.x, p.y, set.id, true);
    if (set.hook) runHook(w, { type: 'hook', hook: set.hook }, p.x, p.y, set.id);
  }
  for (const syn of syns) {
    w.events.emit('synergy', p.x, p.y - 12, 0, 0, syn.id);
    executeEffects(w, syn.effects, p.x, p.y, syn.id, true);
    if (syn.hook) runHook(w, { type: 'hook', hook: syn.hook }, p.x, p.y, syn.id);
  }
}

// ── Instant effects ───────────────────────────────────────────────────────────

/**
 * Runs an effect list at (x, y) on behalf of `source`. Instants run now; persistent effects become
 * temporary (unless `instantsOnly`, used for the one-time part of a fresh item pickup).
 */
export function executeEffects(
  w: World,
  list: readonly Effect[],
  x: number,
  y: number,
  source: string,
  instantsOnly = false,
): void {
  const p = w.player;
  let tempAdded = false;
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    switch (e.type) {
      case 'heal':
        healPlayer(w, e.amount);
        break;
      case 'hearts':
        applyHearts(w, e);
        break;
      case 'pickups':
        applyPickups(w, e, x, y);
        break;
      case 'hook':
        runHook(w, e, x, y, source);
        break;
      default:
        if (!instantsOnly) {
          const d = (e as { duration?: number }).duration;
          p.temps.push({ effect: e, time: d !== undefined && d > 0 ? d : Infinity, source });
          tempAdded = true;
        }
        break;
    }
  }
  if (tempAdded) recomputePlayer(w);
}

/**
 * Heals red health; emits a 'heal' event. Returns the half hearts restored. Without red hearts (Marrow's
 * `noRedHearts`) a heal becomes Tin instead — at most a whole Tin heart per heal.
 */
export function healPlayer(w: World, halves: number): number {
  const p = w.player;
  if (p.dead) return 0;
  const healed = p.flags.noRedHearts ? addBonus(p.health, BONUS_TIN, Math.min(2, Math.floor(halves))) : heal(p.health, halves);
  if (healed > 0) {
    p.inv.version++;
    w.events.emit('heal', p.x, p.y - 12, healed, 0);
  }
  return healed;
}

function applyHearts(w: World, e: HeartsEffect): void {
  const p = w.player;
  const h = p.health;
  let changed = false;
  // No red hearts (Marrow): a new container becomes a whole Tin heart instead (losing one costs nothing).
  if (e.containers && p.flags.noRedHearts) {
    if (e.containers > 0) changed = addBonus(h, BONUS_TIN, e.containers * 2) > 0 || changed;
  } else if (e.containers) changed = addContainers(h, e.containers) !== 0 || changed;
  if (e.red) {
    if (p.flags.noRedHearts) changed = addBonus(h, BONUS_TIN, e.red) > 0 || changed;
    else changed = heal(h, e.red) > 0 || changed;
  }
  if (e.tin) changed = addBonus(h, BONUS_TIN, e.tin) > 0 || changed;
  if (e.ember) changed = addBonus(h, BONUS_EMBER, e.ember) > 0 || changed;
  if (changed) {
    p.inv.version++;
    w.events.emit('heal', p.x, p.y - 12, 2, 1);
  }
}

function applyPickups(w: World, e: PickupsEffect, x: number, y: number): void {
  const inv = w.player.inv;
  if (e.coins) addCounter(inv, 'coins', e.coins);
  if (e.bombs) addCounter(inv, 'bombs', e.bombs);
  if (e.keys) addCounter(inv, 'keys', e.keys);
  if (e.charge !== undefined) chargeActive(w, e.charge);
  if (e.spawn) {
    for (const s of e.spawn) {
      const kind = pickupKindOf(s.kind);
      for (let i = 0; i < (s.count ?? 1); i++) spawnLoot(w, kind, undefined, x, y);
    }
  }
  if (e.table) spawnDrops(w, e.table, x, y);
}

function runHook(w: World, e: HookEffect, x: number, y: number, source: string): void {
  const fn = getHook(e.hook);
  if (!fn) return;
  const ctx: HookCtx = { w, api: hookApi(w), x, y, source, params: e.params };
  fn(ctx);
}

/** The services content hooks may use (built once per world). */
export function hookApi(w: World): HookApi {
  return (w.hookApi ??= {
    spawnPickup: (name, x, y) => {
      spawnLoot(w, pickupKindOf(name), undefined, x, y);
    },
    dropTable: (id, x, y) => spawnDrops(w, id, x, y),
    damageArea: (x, y, radius, damage) => damageArea(w, x, y, radius, damage),
    explode: (x, y, radius, damage) => explode(w, x, y, radius, damage),
    healPlayer: (halves) => healPlayer(w, halves),
    giveItem: (id) => {
      giveItem(w, id);
    },
    emit: (type, x, y, a = 0, b = 0, id = '') => w.events.emit(type, x, y, a, b, id),
  });
}

// ── Items ────────────────────────────────────────────────────────────────────

export interface CollectResult {
  /** A previously held active, to be put back on the pedestal. */
  droppedActive: ActiveSlot | null;
  /** A trinket/consumable pushed out of a full slot, to be dropped on the floor. */
  droppedItem: ItemId | null;
}

const collectResult: CollectResult = { droppedActive: null, droppedItem: null };

/** Numeric item kind for the 'item' event (a): 0 passive, 1 active, 2 trinket, 3 consumable. */
export function itemKindCode(def: ItemDef): number {
  return def.kind === 'passive' ? 0 : def.kind === 'active' ? 1 : def.kind === 'trinket' ? 2 : 3;
}

/**
 * The item pickup flow: slot the item (swapping out an active / the oldest trinket or consumable),
 * run its one-time instants if this copy is fresh, recompute, hold it overhead and raise the banner
 * event. `charge` < 0 = fully charged (actives). The result object is reused — read it right away.
 */
export function collectItem(w: World, def: ItemDef, fresh = true, charge = -1): CollectResult {
  const p = w.player;
  const inv = p.inv;
  collectResult.droppedActive = null;
  collectResult.droppedItem = null;
  switch (def.kind) {
    case 'passive':
      inv.passives.push(def.id);
      inv.version++;
      break;
    case 'active':
      collectResult.droppedActive = setActive(inv, def, fresh ? -1 : charge);
      break;
    case 'trinket':
      collectResult.droppedItem = addTrinket(inv, def.id);
      break;
    case 'consumable':
      collectResult.droppedItem = addConsumable(inv, def.id);
      break;
  }
  if (fresh) executeEffects(w, def.effects, p.x, p.y, def.id, true);
  recomputePlayer(w);
  p.holdItem = def.id;
  p.holdTime = ITEM_TUNING.holdTime;
  w.counters.items++;
  w.events.emit('item', p.x, p.y - 20, itemKindCode(def), fresh ? 1 : 0, def.id);
  return collectResult;
}

/** Gives an item as a fresh pickup (debug, start items, hooks). Swapped-out things drop nearby. */
export function giveItem(w: World, id: ItemId): void {
  const p = w.player;
  const res = collectItem(w, getItem(id), true);
  const dropped = res.droppedActive;
  const droppedItem = res.droppedItem;
  if (dropped) {
    const ped = spawnPedestal(w, p.x, Math.min(p.y + 18, 104), dropped.id);
    if (ped) {
      ped.charge = dropped.charge;
      ped.fresh = false;
      ped.blocked = true;
    }
  }
  if (droppedItem) spawnItemPickup(w, droppedItem, p.x, p.y, false);
}

// ── Actives, consumables, charge ─────────────────────────────────────────────

/** Adds active charge; emits 'charged' when it becomes full. Returns the amount added. */
export function chargeActive(w: World, amount: number | 'full'): number {
  const slot = w.player.inv.active;
  if (!slot) return 0;
  const was = isCharged(slot);
  const added = addCharge(slot, amount);
  if (added > 0) {
    w.player.inv.version++;
    if (!was && isCharged(slot)) w.events.emit('charged', w.player.x, w.player.y - 16, 0, 0, slot.id);
  }
  return added;
}

/** Active button / Space. Returns true if the item was used. */
export function useActive(w: World): boolean {
  const p = w.player;
  const slot = p.inv.active;
  if (p.dead) return false;
  if (!slot) {
    w.events.emit('denied', p.x, p.y - 12, 0, 0, 'noActive');
    return false;
  }
  if (!isCharged(slot)) {
    w.events.emit('denied', p.x, p.y - 12, 0, 0, 'notCharged');
    return false;
  }
  const def = getItem(slot.id);
  slot.charge = 0;
  p.inv.version++;
  w.events.emit('activeUse', p.x, p.y - 10, 0, 0, def.id);
  executeEffects(w, def.active?.use ?? [], p.x, p.y, def.id);
  fireTrigger(w, 'use', p.x, p.y);
  return true;
}

/** Consumable button / Q. Returns true if something was used. */
export function useConsumable(w: World): boolean {
  const p = w.player;
  if (p.dead) return false;
  const id = takeConsumable(p.inv);
  if (id === null) {
    w.events.emit('denied', p.x, p.y - 12, 0, 0, 'noConsumable');
    return false;
  }
  const def = getItem(id);
  w.events.emit('activeUse', p.x, p.y - 10, 1, 0, def.id);
  executeEffects(w, def.use ?? [], p.x, p.y, def.id);
  // Mystery Tonics: this run's colour → effect shuffle decides what the bottle does (sim/tonics.ts).
  const tonic = drinkTonic(w, def);
  if (tonic) executeEffects(w, tonic, p.x, p.y, def.id);
  recomputePlayer(w);
  return true;
}

/** Room cleared: +1 charge for room-charged actives, the character mechanic's clear rule, then the 'roomClear' trigger. */
export function roomCleared(w: World): void {
  const p = w.player;
  w.counters.roomsCleared++;
  const slot = p.inv.active;
  if (slot && !slot.timed) chargeActive(w, 1);
  if (mechanicRoomClear(w)) recomputePlayer(w);
  fireTrigger(w, 'roomClear', p.x, p.y);
}

/** Leaving a room ends the "until you leave the room" temporary effects. */
export function leftRoom(w: World): void {
  const temps = w.player.temps;
  let removed = false;
  for (let i = temps.length - 1; i >= 0; i--) {
    if (temps[i]!.time === Infinity) {
      temps.splice(i, 1);
      removed = true;
    }
  }
  if (removed) recomputePlayer(w);
}

export function floorStarted(w: World): void {
  if (mechanicFloorStart(w)) recomputePlayer(w);
  fireTrigger(w, 'floorStart', w.player.x, w.player.y);
}

/** Per tick: timed active charge and temporary effect timers. No allocation. */
export function updateEffects(w: World, dt: number): void {
  const p = w.player;
  const slot = p.inv.active;
  if (slot && slot.timed && slot.charge < slot.max && !p.dead) {
    slot.charge = Math.min(slot.max, slot.charge + dt);
    if (slot.charge >= slot.max) {
      p.inv.version++;
      w.events.emit('charged', p.x, p.y - 16, 0, 0, slot.id);
    }
  }
  const temps = p.temps;
  let expired = false;
  for (let i = temps.length - 1; i >= 0; i--) {
    const t = temps[i]!;
    if (t.time === Infinity) continue;
    t.time -= dt;
    if (t.time <= 0) {
      temps.splice(i, 1);
      expired = true;
    }
  }
  if (expired) recomputePlayer(w);
}

// ── Triggers ────────────────────────────────────────────────────────────────

/**
 * Fires every held trigger listening to `on` at (x, y). Chance rolls use combatRng (so they are
 * seeded and replayable); cooldowns use world time. Nested firing stops at MAX_TRIGGER_DEPTH.
 */
export function fireTrigger(w: World, on: TriggerOn, x: number, y: number): void {
  const p = w.player;
  const list = p.triggers[on];
  if (list.length === 0 || w.triggerDepth >= MAX_TRIGGER_DEPTH) return;
  w.triggerDepth++;
  try {
    // `list` is a snapshot: recompute builds new arrays, so effects may safely change items.
    for (let i = 0; i < list.length; i++) {
      const t = list[i]!;
      const e = t.eff;
      if (e.cooldown && w.time < (p.triggerReady.get(e) ?? -Infinity)) continue;
      const chance = triggerChance(e, p.stats.luck);
      if (chance <= 0) continue;
      if (chance < 1 && w.combatRng.next() >= chance) continue;
      if (e.cooldown) p.triggerReady.set(e, w.time + e.cooldown);
      w.events.emit('triggered', x, y, 0, 0, t.source);
      if (e.say) w.events.emit('say', x, y, 0, 0, e.say);
      executeEffects(w, e.effects, x, y, t.source);
    }
  } finally {
    w.triggerDepth--;
  }
}

/** Small spark cell charge for the held active (rooms: +1, timed: a quarter of the max). */
export function smallSparkAmount(slot: ActiveSlot): number {
  return slot.timed ? slot.max * ITEM_TUNING.smallSparkTimed : 1;
}
