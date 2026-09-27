/**
 * Run state shapes (plain JSON: numbers, strings, booleans, arrays, plain objects — the run save
 * stores them as they are). See sim/run/run.ts for how they are used and ARCHITECTURE §6b.
 */

import type { RngState } from '../../engine/rng';
import type { FloorCurse, FloorLayout, FloorTrack } from '../floor/types';
import type { MinimapState } from '../floor/minimap';
import type { WorldCounters } from '../world';

/** Bump when RunSnapshot changes shape (the run save migrates or drops older snapshots). */
export const RUN_SNAPSHOT_VERSION = 1;

export interface RunOptions {
  /** First floor (debug / tests; default 1). */
  floor?: number;
  /** Track of the first floor (default 'main'). */
  track?: FloorTrack;
  /** Curse on every floor: undefined = rolled per floor (default), null = never, an id = always that one. */
  curse?: FloorCurse | null;
  /** Meta snapshot taken at run start: items that are not unlocked yet (never rolled this run). */
  lockedItems?: readonly string[];
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
  /** Enemy placed on the 'B' marker (placeholder boss / miniboss; '' = none). */
  boss: string;
  /** Boss reward item (appears with the trapdoor). */
  reward: string;
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
}

export interface RunStats {
  roomsVisited: number;
  roomsCleared: number;
  floorsCleared: number;
  secretsFound: number;
  keysUsed: number;
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
  /** Meta snapshot: locked item ids. */
  locked: string[];
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
