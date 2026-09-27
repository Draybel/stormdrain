/**
 * Mystery Tonics (DESIGN.md "Pickups") and the sim services behind the item-C hooks.
 *
 * TONICS — ten coloured bottles (content/items/consumables-tonics.ts, `consumable: 'tonic'`) and ten
 * effects (TonicDef). Which colour holds which effect is shuffled per run; a bottle stays
 * unidentified ('??? CRIMSON TONIC') until one of its colour is drunk, and from then on shows its
 * real name everywhere for the rest of the run (`itemName` / `itemDesc`, used by the HUD banner).
 * The `readLabels` flag (Cracked Monocle) reads every label while held.
 *
 * Run state: `w.tonics` — a TonicState, plain JSON (bottle → effect map + identified bottles). Save
 * it with the run (`snapshotTonics`) and hand it back with `restoreTonics`. The run setup should call
 * `initTonics(world, runSeed)` so the shuffle depends on the run seed alone; without that the state
 * is made the first time the SIM needs it (a drink, a Cracked Monocle pickup) from a fork of the
 * run's lootRng — still seeded and replayable. Queries made by render / UI code (`itemName`,
 * `itemDesc`, `isIdentified`, `isUnidentifiedTonic`, `snapshotTonics`) never create it, so drawing
 * or saving can't change a run.
 *
 * Drinking: sim/effects.ts `useConsumable` runs the bottle's own `use` (the shared "glug"), then
 * `drinkTonic(w, def)`, which identifies the bottle and returns the effect list to run.
 *
 * Also here: the services content/hooks/itemsC.ts needs (ITEMS_C_TOOLS, installed at load — content
 * hooks may not import sim modules) and FLOOR_LINKS, the floor code's entry points for the map-reveal
 * and teleport items (null until floors are wired: those items then refund themselves).
 */

import { Rng } from '../engine/rng';
import { ITEMS_C_TOOLS, type MapReveal, type TeleportTarget } from '../content/hooks/itemsC';
import { TONICS, TONIC_BOTTLES } from '../content/items/consumables-tonics';
import { findItem } from '../content/registry';
import { nearestFreeSpot } from './arena';
import { spawnBomb } from './bombs';
import { damagePlayer } from './combat';
import { chargeActive, executeEffects, recomputePlayer } from './effects';
import { SRC_BOMB, SRC_PLAYER } from './hittable';
import { addConsumable } from './inventory';
import { pickItem } from './itemPools';
import { setPedestalItem, type Pedestal } from './pedestals';
import { isItemPickup } from './pickupKinds';
import { spawnItemPickup, spawnPickup, type Pickup } from './pickups';
import type { Effect, ItemDef, TonicDef } from './types';
import type { World } from './world';

/** Shape version of TonicState (run saves). */
export const TONIC_STATE_VERSION = 1;

/** This run's Mystery Tonics — plain JSON. */
export interface TonicState {
  v: number;
  /** Bottle item id → TonicDef id. */
  map: Record<string, string>;
  /** Bottle item ids identified this run, in the order they were found out. */
  known: string[];
}

declare module './world' {
  interface World {
    /** Mystery Tonics this run (sim/tonics.ts): set by initTonics / restoreTonics, or on first use. */
    tonics?: TonicState;
  }
}

let byId: Map<string, TonicDef> | null = null;

function tonicDef(id: string): TonicDef | undefined {
  byId ??= new Map(TONICS.map((t) => [t.id, t]));
  return byId.get(id);
}

function shuffled(rng: Rng): TonicState {
  const ids = TONICS.map((t) => t.id);
  rng.shuffle(ids);
  const map: Record<string, string> = {};
  for (let i = 0; i < TONIC_BOTTLES.length; i++) map[TONIC_BOTTLES[i]!.id] = ids[i % ids.length]!;
  return { v: TONIC_STATE_VERSION, map, known: [] };
}

/** Deals the run's tonics from the run seed alone (call once at run start). */
export function initTonics(w: World, runSeed: number | string): TonicState {
  w.tonics = shuffled(new Rng(runSeed).fork('tonics'));
  return w.tonics;
}

/**
 * The run's tonic state, made from a fork of the lootRng when initTonics wasn't called. SIM ONLY:
 * creating it must happen at a deterministic moment (a tick), never from drawing or saving.
 */
export function tonicState(w: World): TonicState {
  w.tonics ??= shuffled(w.lootRng.fork('tonics'));
  return w.tonics;
}

/** A deep copy for a run save (null while the tonics haven't been dealt yet). */
export function snapshotTonics(w: World): TonicState | null {
  const s = w.tonics;
  return s ? { v: s.v, map: { ...s.map }, known: [...s.known] } : null;
}

/**
 * Restores a saved state. Unknown effects / bottles are dropped and bottles the save didn't know
 * (new content) get the effects no bottle holds. Returns false (state untouched) for garbage.
 */
export function restoreTonics(w: World, data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as { map?: unknown; known?: unknown };
  if (!d.map || typeof d.map !== 'object' || !Array.isArray(d.known)) return false;
  const src = d.map as Record<string, unknown>;
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const b of TONIC_BOTTLES) {
    const id = Object.prototype.hasOwnProperty.call(src, b.id) ? src[b.id] : undefined;
    if (typeof id === 'string' && tonicDef(id) && !used.has(id)) {
      map[b.id] = id;
      used.add(id);
    }
  }
  const free = TONICS.map((t) => t.id).filter((id) => !used.has(id));
  for (const b of TONIC_BOTTLES) if (map[b.id] === undefined) map[b.id] = free.shift() ?? TONICS[0]!.id;
  const known: string[] = [];
  for (const id of d.known) if (typeof id === 'string' && map[id] !== undefined && !known.includes(id)) known.push(id);
  w.tonics = { v: TONIC_STATE_VERSION, map, known };
  return true;
}

export function isTonicBottle(def: ItemDef | undefined): boolean {
  return def?.consumable === 'tonic';
}

/** The effect a bottle holds this run (null for anything that isn't a tonic bottle, or before the deal). */
export function tonicOf(w: World, bottleId: string): TonicDef | null {
  const s = w.tonics;
  if (!s || !isTonicBottle(findItem(bottleId))) return null;
  const id = s.map[bottleId];
  return id ? (tonicDef(id) ?? null) : null;
}

/** Can the player tell what this bottle is (drunk before, or reading labels)? */
export function isIdentified(w: World, bottleId: string): boolean {
  const s = w.tonics;
  if (!s) return false;
  return w.player.flags.readLabels || s.known.includes(bottleId);
}

/** Marks a bottle as identified; true if it was news. */
export function identifyTonic(w: World, bottleId: string): boolean {
  const s = tonicState(w);
  if (s.known.includes(bottleId)) return false;
  s.known.push(bottleId);
  return true;
}

/**
 * Drinking a consumable (sim/effects.ts useConsumable): for a tonic bottle, identifies it and
 * returns the effect list its colour holds this run; null for anything else.
 */
export function drinkTonic(w: World, def: ItemDef): readonly Effect[] | null {
  if (!isTonicBottle(def)) return null;
  tonicState(w);
  const tonic = tonicOf(w, def.id);
  if (!tonic) return null;
  identifyTonic(w, def.id);
  return tonic.use;
}

/** An unidentified tonic bottle (the HUD marks it with a '?'). */
export function isUnidentifiedTonic(w: World, id: string): boolean {
  return isTonicBottle(findItem(id)) && !isIdentified(w, id);
}

const mysteryNames = new Map<string, string>();

/**
 * The name to show for an item this run: a tonic bottle is '??? <Colour> Tonic' until identified,
 * then its effect's name. Everything else: the item's own name. Cached — no allocation per call.
 */
export function itemName(w: World | null, id: string): string {
  const def = findItem(id);
  if (!def) return id;
  if (!w || !isTonicBottle(def)) return def.name;
  if (isIdentified(w, id)) return tonicOf(w, id)?.name ?? def.name;
  let n = mysteryNames.get(id);
  if (n === undefined) {
    n = `??? ${def.name}`;
    mysteryNames.set(id, n);
  }
  return n;
}

/** The one-line description to show for an item this run (tonics: the mystery line until identified). */
export function itemDesc(w: World | null, id: string): string {
  const def = findItem(id);
  if (!def) return '';
  if (w && isTonicBottle(def) && isIdentified(w, id)) return tonicOf(w, id)?.desc ?? def.desc;
  return def.desc;
}

// ── Floor wiring ─────────────────────────────────────────────────────────────

/**
 * Entry points the floor code sets once floors exist (src/sim/floor): the Treasure Map Sticker
 * reveals the map, the Keepsake Sticker / Hopscotch Chalk teleport. Return false when nothing
 * happened (the item then refunds itself / Hopscotch blinks inside the room instead). A teleport
 * should queue the room change for the end of the tick rather than load a room mid-update.
 */
export const FLOOR_LINKS: {
  revealMap: ((w: World, level: MapReveal) => boolean) | null;
  teleport: ((w: World, to: TeleportTarget) => boolean) | null;
} = { revealMap: null, teleport: null };

// ── Services for content/hooks/itemsC.ts ────────────────────────────────────

const pedExclude = new Set<string>();

function rerollPedestal(w: World, ped: Pedestal): boolean {
  const old = findItem(ped.item);
  if (!old) return false;
  pedExclude.clear();
  const peds = w.pedestals;
  for (let i = 0; i < peds.count; i++) {
    const o = peds.items[i]!;
    if (o.item) pedExclude.add(o.item);
  }
  const def =
    pickItem(w.lootRng, { pool: old.pools[0], kind: old.kind, exclude: pedExclude }) ??
    pickItem(w.lootRng, { kind: old.kind, exclude: pedExclude });
  if (!def) return false;
  setPedestalItem(ped, def.id);
  w.events.emit('pedestalRoll', ped.x, ped.y - 16, 1, 0, def.id);
  return true;
}

function copyPickup(w: World, pk: Pickup): boolean {
  const copy = isItemPickup(pk.kind) ? spawnItemPickup(w, pk.itemId, pk.x, pk.y, true) : spawnPickup(w, pk.kind, pk.x, pk.y, true);
  return copy !== null;
}

function refund(w: World, source: string): void {
  const def = findItem(source);
  if (!def) return;
  const p = w.player;
  if (def.kind === 'active') {
    if (p.inv.active?.id === source) chargeActive(w, 'full');
  } else if (def.kind === 'consumable') {
    const dropped = addConsumable(p.inv, source);
    if (dropped) spawnItemPickup(w, dropped, p.x, p.y, false);
  }
}

// Arrow wrappers: sim/effects.ts imports this module (the imports may still be initialising).
ITEMS_C_TOOLS.t = {
  run: (w, effects, x, y, source) => executeEffects(w, effects, x, y, source),
  chargeActive: (w, amount) => chargeActive(w, amount),
  recompute: (w) => recomputePlayer(w),
  hurtPlayer: (w, halves) => damagePlayer(w, halves),
  hurt: (t, damage, kx, ky) => {
    t.hurt(damage, SRC_BOMB, kx, ky);
  },
  status: (t, kind, duration, power) => t.applyStatus(kind, duration, power, SRC_PLAYER),
  spawnBomb: (w, x, y, fuse) => spawnBomb(w, x, y, fuse) !== null,
  rerollPedestal: (w, ped) => rerollPedestal(w, ped),
  copyPickup: (w, pk) => copyPickup(w, pk),
  refund: (w, source) => refund(w, source),
  dealTonics: (w) => {
    tonicState(w);
  },
  freeSpot: (w, x, y, out) => nearestFreeSpot(w, x, y, out),
  revealMap: (w, level) => FLOOR_LINKS.revealMap?.(w, level) ?? false,
  teleport: (w, to) => FLOOR_LINKS.teleport?.(w, to) ?? false,
};
