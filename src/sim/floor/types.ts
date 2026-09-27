/**
 * Floor generation data shapes (ARCHITECTURE §5 RoomTemplate, §6 Floors).
 * Pure data: no DOM, no rendering. Everything here is JSON-friendly.
 */

/** Every kind of room a floor can contain (DESIGN.md "Rooms"). */
export type RoomType =
  | 'start'
  | 'normal'
  | 'treasure' // "Keepsake Room" (locked from chapter 2 = floor 3 on)
  | 'shop' // "Magpie's Stall"
  | 'boss'
  | 'miniboss'
  | 'secret' // "Hidey-Hole" (bomb in)
  | 'deepSecret' // "Forgotten Pocket" (bomb in, harder to find)
  | 'challenge' // "Rain Barrel Arena"
  | 'cursed' // "Thorn Room"
  | 'nook'; // "Broker's Nook" (opens off the boss room after the boss)

export const ROOM_TYPES: readonly RoomType[] = [
  'start',
  'normal',
  'treasure',
  'shop',
  'boss',
  'miniboss',
  'secret',
  'deepSecret',
  'challenge',
  'cursed',
  'nook',
];

/** Special rooms that must sit on a dead end (exactly one regular door). */
export const DEAD_END_TYPES: readonly RoomType[] = ['boss', 'treasure', 'shop', 'miniboss', 'challenge', 'cursed'];

/** A chapter id (content/chapters) or the wildcard '*'. */
export type ChapterId = string;

/**
 * A hand-made 13×7 room layout (content/rooms/*.ts export default RoomTemplate[]).
 * Legend (ARCHITECTURE §5): `.` floor `#` rock `$` tinted rock `M` metal `O` pit `^` spikes `f` fire
 * `x` crate `u` urn `e` enemy spawn `E` strong/elite spawn `c` chest spot `p` pickup spot
 * `i` item pedestal `S` shop slot `B` boss spawn.
 */
export interface RoomTemplate {
  /** Globally unique id (the content registry throws on duplicates). */
  id: string;
  /** Chapter ids this layout may appear in, or ['*'] for every chapter. */
  chapters: readonly ChapterId[];
  type: RoomType;
  /** 1 easy … 3 hard. Deeper floors favour harder layouts. */
  difficulty: 1 | 2 | 3;
  /** 7 rows × 13 characters. */
  grid: readonly string[];
  /** Relative pick weight inside its (type, chapter) group. Default 1. */
  weight?: number;
}

/** Track of a floor: the main chapters or the hidden alternates. Floor 13 (The Undertow) accepts either. */
export type FloorTrack = 'main' | 'alt';

/** Final boss marker for the last floor of a route. */
export type FinalBossKey = 'thunderhead' | 'nestmother' | 'undertow';

/** Floor curses (DESIGN.md "Floor curses"). */
export type FloorCurse = 'darkness' | 'lostMap' | 'maze' | 'blind' | 'unknown' | 'deluge';

export const FLOOR_CURSES: readonly FloorCurse[] = ['darkness', 'lostMap', 'maze', 'blind', 'unknown', 'deluge'];

/**
 * Door sides as bits of a 4-bit mask. Index order N, E, S, W matches DIR_DX / DIR_DY.
 * A room's door on side N connects it to the cell at (gx, gy - 1).
 */
export const DOOR_N = 1;
export const DOOR_E = 2;
export const DOOR_S = 4;
export const DOOR_W = 8;
export const DIR_BITS: readonly number[] = [DOOR_N, DOOR_E, DOOR_S, DOOR_W];
export const DIR_DX: readonly number[] = [0, 1, 0, -1];
export const DIR_DY: readonly number[] = [-1, 0, 1, 0];
/** Opposite side index: N↔S, E↔W. */
export const DIR_OPPOSITE: readonly number[] = [2, 3, 0, 1];

/** One room on the floor grid. */
export interface FloorRoom {
  /** Index in FloorLayout.rooms (also the value stored in FloorLayout.cells). */
  index: number;
  /** Grid cell. */
  gx: number;
  gy: number;
  type: RoomType;
  /** Every connection this room has (bits DOOR_N/E/S/W), secret walls included. */
  doors: number;
  /** Subset of `doors` that are hidden bombable walls (to/from secret and deep secret rooms). */
  secretDoors: number;
  /** Subset of `secretDoors` that show a subtle hint (cracked wall tile, drips) on THIS room's side. */
  hints: number;
  /** Subset of `doors` that are locked and need a key (both sides of a locked room's door). */
  lockedDoors: number;
  /** Entering this room needs a key (its entrance door is locked). */
  locked: boolean;
  /** True for secret and deep secret rooms (hidden from the map until discovered). */
  secret: boolean;
  /**
   * Steps from the start room through regular doors. Secret rooms (reachable only by bombing):
   * one more than their nearest neighbour.
   */
  dist: number;
  /** Chosen layout (pickTemplates), null until assigned or when no template exists for the type. */
  templateId: string | null;
  /** Template mirroring chosen by pickTemplates: bit 1 = mirror left/right, bit 2 = mirror top/bottom. */
  flip: number;
  /** A cracked drain grate here leads to the ALT track for the next floor (DESIGN "Hidden routes"). */
  hiddenRoute: boolean;
  /** Boss rooms of final floors: which final boss lives here. */
  finalBoss: FinalBossKey | null;
}

/** The free cell kept next to the boss room for the Broker's Nook. */
export interface NookReserve {
  gx: number;
  gy: number;
  /** Side of the BOSS room the nook door is on (0 N, 1 E, 2 S, 3 W). */
  side: number;
  /** Layout chosen by pickTemplates for when the nook opens. */
  templateId: string | null;
  flip: number;
  /** Room index once openNook() added it, else -1. */
  room: number;
}

export interface FloorLayout {
  /** FLOORGEN_VERSION that produced this layout (saves can detect generator changes). */
  version: number;
  seed: number;
  floorIndex: number;
  track: FloorTrack;
  /** 1..6 for floors 1..12 (two floors per chapter), 7 for floor 13 (The Undertow). */
  chapter: number;
  /** Grid size in cells (11 × 11). */
  width: number;
  height: number;
  /** Row-major width×height: room index occupying the cell, or -1. */
  cells: number[];
  rooms: FloorRoom[];
  /** Room indices of the key rooms (-1 when absent). */
  start: number;
  boss: number;
  secret: number;
  deepSecret: number;
  /** Door distance from start to the boss room (the maximum of all non-secret rooms). */
  bossDist: number;
  nook: NookReserve;
  curse: FloorCurse | null;
  /** Set on final floors (12 main → thunderhead, 12 alt → nestmother, 13 → undertow). */
  finalBoss: FinalBossKey | null;
  /** Room index holding the hidden-route grate, or -1. */
  hiddenRoute: number;
  /** Growth attempts used (diagnostics). */
  attempts: number;
}

export interface FloorGenOptions {
  /** Roll a floor curse (default true). */
  curses?: boolean;
  /** Curses that may be rolled (default: all six). */
  cursePool?: readonly FloorCurse[];
  /** Debug override: force this curse (null forces none). */
  forceCurse?: FloorCurse | null;
  /** Allow a hidden-route grate to the ALT track for the next floor (default false). */
  allowAltNext?: boolean;
  /** Chance of a hidden-route grate when allowed (default 0.4). */
  hiddenRouteChance?: number;
}
