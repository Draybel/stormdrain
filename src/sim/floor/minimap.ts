/**
 * Minimap knowledge model (pure, JSON-serializable). The renderer reads it; the run updates it.
 *
 * Per room visibility, in increasing order:
 *   Unknown  not drawn
 *   Mapped   outline only (a map item revealed the layout; no icon, no contents)
 *   Seen     drawn dim WITH its special-room icon (a neighbour of a visited room, or revealed)
 *   Visited  drawn filled
 *
 * Rules:
 * - Entering a room marks it Visited and every room behind its regular doors Seen.
 * - Secret and deep secret rooms are never revealed through the hidden wall from outside: they
 *   become Seen only when discovered (wall bombed open → discoverRoom), entered, or revealed by an
 *   item. From inside a secret room its neighbours are revealed as usual.
 * - Special room icons are known exactly when the room is at least Seen.
 * - The Curse of the Soggy Map (id 'lostMap') shows only the rooms already VISITED: no outlines or icons of
 *   rooms seen through a door or revealed by an item. Knowledge keeps accumulating underneath, so lifting
 *   the curse (setLostMap(false)) brings the whole map back.
 */

import { neighborRoom } from './generate';
import { DIR_BITS, type FloorLayout, type RoomType } from './types';

export const MapVis = { Unknown: 0, Mapped: 1, Seen: 2, Visited: 3 } as const;
export type MapVisValue = (typeof MapVis)[keyof typeof MapVis];

/** What a map-revealing item uncovers. */
export type MapReveal = 'layout' | 'icons' | 'secrets' | 'full';

export interface MinimapState {
  /** Visibility per room index (MapVis values). */
  vis: number[];
  /** Room the player is in (-1 before the first enterRoom). */
  current: number;
  /** Soggy Map curse (lostMap) active: only visited rooms are shown. */
  lostMap: boolean;
  /** Bumped on every change so the renderer can cache its minimap canvas. */
  version: number;
}

/** Room types drawn with an icon once seen. */
export function hasIcon(type: RoomType): boolean {
  return type !== 'normal' && type !== 'start';
}

function sync(state: MinimapState, layout: FloorLayout): void {
  while (state.vis.length < layout.rooms.length) state.vis.push(MapVis.Unknown);
}

function raise(state: MinimapState, room: number, to: MapVisValue): void {
  if ((state.vis[room] ?? 0) < to) state.vis[room] = to;
}

/** New map knowledge for a floor; the player starts in the start room. */
export function createMinimap(layout: FloorLayout, lostMap = layout.curse === 'lostMap'): MinimapState {
  const state: MinimapState = { vis: [], current: -1, lostMap, version: 0 };
  sync(state, layout);
  enterRoom(state, layout, layout.start);
  return state;
}

/** The player entered `room`: visit it and reveal the rooms behind its doors. */
export function enterRoom(state: MinimapState, layout: FloorLayout, room: number): void {
  sync(state, layout);
  const r = layout.rooms[room];
  if (!r) return;
  state.current = room;
  raise(state, room, MapVis.Visited);
  for (let d = 0; d < 4; d++) {
    const bit = DIR_BITS[d]!;
    if ((r.doors & bit) === 0) continue;
    // A hidden wall seen from outside gives nothing away.
    if ((r.secretDoors & bit) !== 0 && !r.secret) continue;
    const n = neighborRoom(layout, room, d);
    if (n >= 0) raise(state, n, MapVis.Seen);
  }
  state.version++;
}

/** A room was found without entering it (secret wall bombed open, the Nook appeared...). */
export function discoverRoom(state: MinimapState, layout: FloorLayout, room: number): void {
  sync(state, layout);
  if (!layout.rooms[room]) return;
  raise(state, room, MapVis.Seen);
  state.version++;
}

/**
 * Map items: 'layout' shows every ordinary room's outline, 'icons' reveals the special rooms with
 * their icons, 'secrets' reveals secret and deep secret rooms, 'full' does all three.
 */
export function revealMap(state: MinimapState, layout: FloorLayout, what: MapReveal): void {
  sync(state, layout);
  for (const r of layout.rooms) {
    if (r.secret) {
      if (what === 'secrets' || what === 'full') raise(state, r.index, MapVis.Seen);
    } else if (hasIcon(r.type)) {
      if (what === 'icons' || what === 'full') raise(state, r.index, MapVis.Seen);
      else if (what === 'layout') raise(state, r.index, MapVis.Mapped);
    } else if (what === 'layout' || what === 'full') {
      raise(state, r.index, what === 'full' ? MapVis.Seen : MapVis.Mapped);
    }
  }
  state.version++;
}

export function setLostMap(state: MinimapState, on: boolean): void {
  if (state.lostMap !== on) {
    state.lostMap = on;
    state.version++;
  }
}

/** Visibility to draw for a room (the Soggy Map curse leaves only the visited rooms). */
export function roomVis(state: MinimapState, room: number): MapVisValue {
  const v = (state.vis[room] ?? MapVis.Unknown) as MapVisValue;
  if (state.lostMap) return v === MapVis.Visited ? v : MapVis.Unknown;
  return v;
}

export function isRoomShown(state: MinimapState, room: number): boolean {
  return roomVis(state, room) !== MapVis.Unknown;
}

/** Icon to draw for a room, or null (normal/start rooms, or not seen yet). */
export function roomIcon(state: MinimapState, layout: FloorLayout, room: number): RoomType | null {
  const r = layout.rooms[room];
  if (!r || !hasIcon(r.type)) return null;
  return roomVis(state, room) >= MapVis.Seen ? r.type : null;
}

/** Rebuilds a state from saved JSON, tolerating missing/garbage fields. */
export function loadMinimap(data: unknown, layout: FloorLayout): MinimapState {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Partial<MinimapState>;
  const vis = Array.isArray(d.vis)
    ? d.vis.map((v) => (v === 1 || v === 2 || v === 3 ? v : 0)).slice(0, layout.rooms.length)
    : [];
  const current = typeof d.current === 'number' && layout.rooms[d.current] ? d.current : layout.start;
  const state: MinimapState = {
    vis,
    current,
    lostMap: typeof d.lostMap === 'boolean' ? d.lostMap : layout.curse === 'lostMap',
    version: 0,
  };
  sync(state, layout);
  if (state.vis[current]! < MapVis.Visited) enterRoom(state, layout, current);
  return state;
}
