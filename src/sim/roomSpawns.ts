/**
 * Explicit entity placements for a room (the test room today; the floor generator may reuse this
 * for pre-rolled pickups/pedestals, or replace it with its own RoomTemplate markers).
 * Positions are grid cells (+ optional px offsets from the cell centre).
 */

import type { ItemId, ItemKind, PickupName, PoolId } from './types';

interface At {
  col: number;
  row: number;
  dx?: number;
  dy?: number;
}

export interface PickupSpawn extends At {
  kind: 'pickup';
  pickup: PickupName;
  /** Trinket / consumable pickups: a fixed item, or a random one with `tag`. */
  item?: ItemId;
  tag?: string;
}

export interface PedestalSpawn extends At {
  kind: 'pedestal';
  /** A fixed item, or a random one matching `tag` / `itemKind` / `pool` (never repeating within the room). */
  item?: ItemId;
  tag?: string;
  itemKind?: ItemKind;
  pool?: PoolId;
  /**
   * Training yard: the pedestal keeps offering new items from its filter — a new one every few
   * seconds while nobody stands next to it, and a refill shortly after its item was taken.
   */
  rotate?: boolean;
}

/** Training yard: a bell on a post — bump into it to start a wave. */
export interface BellSpawn extends At {
  kind: 'bell';
}

export type RoomSpawn = PickupSpawn | PedestalSpawn | BellSpawn;
