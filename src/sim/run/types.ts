/**
 * Run state shapes (plain JSON: numbers, strings, booleans, arrays, plain objects — the run save
 * stores them as they are). See sim/run/run.ts for how they are used and ARCHITECTURE §6b.
 */

import type { RngState } from '../../engine/rng';
import type { FloorCurse, FloorLayout, FloorTrack } from '../floor/types';
import type { MinimapState } from '../floor/minimap';
import type { WorldCounters } from '../world';

/** Bump when RunSnapshot changes shape (the run save migrates or drops older snapshots). */
export const RUN_SNAPSHOT_VERSION = 2;

/**
 * How the run's seed came about (Phase 4B, optional so older snapshots load): the 8-character code players
 * see (`meta/seedCode.ts`; the sim seed is its hash), and whether it was rolled at random, typed in (Enter
 * Seed / a restart of the same seed — practice: single-run achievements and ending unlocks don't count) or
 * the daily run (`date` = the UTC date key; `scored` = this is the day's one recorded attempt).
 */
export interface RunSeedInfo {
  code: string;
  kind: 'random' | 'custom' | 'daily';
  date?: string;
  scored?: boolean;
}

export interface RunOptions {
  /** First floor (debug / tests; default 1). */
  floor?: number;
  /** Track of the first floor (default 'main'). */
  track?: FloorTrack;
  /** Curse on every floor: undefined = rolled per floor (default), null = never, an id = always that one. */
  curse?: FloorCurse | null;
  /** Meta snapshot taken at run start: items that are not unlocked yet (never rolled this run). */
  lockedItems?: readonly string[];
  /**
   * Meta snapshot: what is unlocked — item ids (items flagged `unlock` only roll when listed here) and
   * route / ending flags: 'ending1' opens the alt route into chapter 6, 'ending1' + 'ending2' open the
   * whirlpool to floor 13 after a final boss. M3 feeds it from the meta save.
   */
  unlocked?: readonly string[];
  /** The seed as players see it (Phase 4B): stored in RunData.seedInfo. */
  seedInfo?: RunSeedInfo;
}

/** A pickup left lying in a room (kind = sim/pickupKinds PK). */
export interface SavedPickup {
  k: number;
  x: number;
  y: number;
  item: string;
  fresh: boolean;
  opened: boolean;
}

export interface SavedPedestal {
  x: number;
  y: number;
  item: string;
  charge: number;
  fresh: boolean;
  price: number;
  hearts: number;
  /** Phase 3B (optional so older rooms load): keys price, goods (pickup kind, -1), choice group, prop, broken. */
  keys?: number;
  goods?: number;
  group?: number;
  prop?: number;
  broken?: boolean;
}

/**
 * One room of the floor: what the floor stream pre-rolled for it (never changes) and what happened
 * in it (runtime). Marker lists follow the order `parseRoomLayout` returns markers in (row-major on the
 * mirrored template grid).
 */
export interface RoomState {
  // ── Pre-rolled contents (from (seed, floor, track, meta) only) ──
  /** Enemy ids per wave, one per e / E marker (challenge rooms have several waves). */
  waves: string[][];
  /** Forced champion ids per wave and marker ('' = the usual seeded roll; E markers get one). */
  champs: string[][];
  /** Pickup names for the 'p' markers. */
  loot: string[];
  /** 'satchel' | 'lockbox' for the 'c' markers. */
  chests: string[];
  /** Item ids for the 'i' markers (treasure, secret, challenge / cursed rewards, nook deals). */
  items: string[];
  /** Coin price per 'S' shop slot, with the item in `shop`. */
  shop: string[];
  prices: number[];
  /** Heart containers per 'i' (Broker's Nook deals; 0 = free). */
  hearts: number[];
  /**
   * The 'B' marker's boss / miniboss / final: a BossDef id (sim/bosses) — or, only when no boss content
   * exists at all, an enemy id for a placeholder — and its HP ('' = none).
   */
  boss: string;
  bossHp: number;
  /** Boss reward item (appears with the trapdoor). */
  reward: string;
  /** Magpie's Stall: a pickup name for sale per 'S' slot ('' = the slot sells the item in `shop`). */
  goods: string[];
  /** 'i' markers that hold a chest instead of an item ('' = the item): Thorn Room / Forgotten Pocket. */
  alts: string[];
  /** Extra loot scattered on the first visit (a Forgotten Pocket's "big loot"). */
  bonus: string[];
  /** The room's items are a choice (Broker's Nook: take one, the others vanish). */
  choice: boolean;
  /** A Gumball Gambler stands here (normal rooms). */
  slots: boolean;
  /** Old Pell's offer ('' = he isn't in this room). */
  trader: string;
  // ── Runtime ──
  visited: boolean;
  cleared: boolean;
  /** Next wave to spawn. */
  wave: number;
  /** Door bits opened for good: secret walls blasted, locks opened with a key. */
  opened: number;
  /** Tiles / hits / debris after the last visit (encodeGrid), null = the template as picked. */
  grid: string | null;
  /** What lay in the room when the player left it (null = never visited: spawn the pre-rolls). */
  pickups: SavedPickup[] | null;
  pedestals: SavedPedestal[] | null;
  /** The boss is dead: the trapdoor is open. */
  trapdoor: boolean;
  /** Rain Barrel Arena: 0 waiting for the pressure plate, 1 fighting, 2 done. */
  plate: number;
  /** Hidden-route drain grate: 0 none, 1 cracked (bomb it), 2 open. */
  grate: number;
  /** After a final boss: 1 = the whirlpool (floor 13) and the skylight (the ending) stand here. */
  exits: number;
}

export interface RunStats {
  roomsVisited: number;
  roomsCleared: number;
  floorsCleared: number;
  secretsFound: number;
  keysUsed: number;
  /** Boss / miniboss fights won. */
  bossesBeaten: number;
}

/** Everything about the run besides the World / player (JSON). */
export interface RunData {
  v: number;
  seed: number;
  character: string;
  floor: number;
  track: FloorTrack;
  /** Chapter id of the current floor. */
  chapter: string;
  /** 'roll' | 'none' | a curse id (RunOptions.curse). */
  curseMode: string;
  /** Meta snapshot: locked item ids (RunOptions.lockedItems + unlock-flagged items not unlocked). */
  locked: string[];
  /** Meta snapshot: unlocked ids (items, 'ending1', 'ending2'…). */
  unlocked: string[];
  /** Items seen this run (pedestals, shops, traders, taken): never rolled again. */
  seen: string[];
  layout: FloorLayout;
  map: MinimapState;
  rooms: RoomState[];
  /** The Broker's Nook contents, pre-rolled (moved into `rooms` when the nook opens). */
  nook: RoomState;
  current: number;
  /** Side the player came in through (-1 = the middle: floor start, trapdoor, debug). */
  entrySide: number;
  /** A floor just began: fire the 'floorStart' trigger / event after the start room loads. */
  floorStartPending: boolean;
  /** The player got hurt on this floor (Broker's Nook odds, meta stats). */
  tookDamage: boolean;
  /** world.counters.hurts when the floor began. */
  hurtsAtFloor: number;
  /** Seconds played this run. */
  time: number;
  stats: RunStats;
  /** 0 running, 1 won. */
  won: number;
  /** The ending reached (1 Clear Skies, 2 The Quiet Hive, 3 What the Rain Kept; 0 none yet). */
  ending: number;
  /** The seed code / kind (Phase 4B; absent on debug runs and older saves). */
  seedInfo?: RunSeedInfo;
}

/** The player at a room entry (JSON). Derived state (stats, flags, loadout, profile) is recomputed. */
export interface PlayerSnap {
  redMax: number;
  red: number;
  /** Bonus hearts in stack order: [kind, halves] pairs flattened. */
  bonus: number[];
  coins: number;
  bombs: number;
  keys: number;
  passives: string[];
  active: { id: string; charge: number; max: number; timed: boolean } | null;
  trinkets: string[];
  consumables: string[];
  luckBonus: number;
  /** Temporary effects (the effect by value; time -1 = until the room is left). */
  temps: { effect: unknown; time: number; source: string }[];
  /** Trigger cooldowns: [trigger event, index in that list, ready time]. */
  triggerReady: [string, number, number][];
  x: number;
  y: number;
  faceX: number;
  faceY: number;
  aimX: number;
  aimY: number;
  eyeSide: number;
  walkDist: number;
  sinceShot: number;
  shotsFired: number;
  fireCooldown: number;
  hurtTimer: number;
  invuln: number;
  holdItem: string;
  holdTime: number;
  atkDirX: number;
  atkDirY: number;
  keeper: boolean;
  dead: boolean;
  /** Transformations earned this run (item set ids; optional so older snapshots load). */
  sets?: string[];
  /** Synergies already announced this run (their one-time part ran). */
  synergiesSeen?: string[];
}

export interface WorldSnap {
  tick: number;
  time: number;
  counters: WorldCounters;
  seen: string[];
  enemySerial: number;
  combat: RngState;
  loot: RngState;
  god: boolean;
}

/** `Sim.snapshot()`: the whole run at the moment the player entered the current room. */
export interface RunSnapshot {
  v: number;
  run: RunData;
  world: WorldSnap;
  player: PlayerSnap;
}
