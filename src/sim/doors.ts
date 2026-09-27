/**
 * The current room's four door slots (N, E, S, W on the wall centres) as the run sees them. Pure data
 * the renderer reads (`world.doors`); the floor run (sim/run/run.ts) fills it on every room entry and
 * whenever a lock or a secret wall opens. The training yard leaves `enabled` false and the renderer
 * draws its four decorative doors instead.
 *
 * - `kind` picks the frame (normal, boss, treasure, shop, challenge, cursed, miniboss, nook, secret hole).
 * - `state`: HIDDEN (a secret wall nobody has bombed yet — plain wall, maybe a hint), LOCKED (needs a
 *   key), OPEN. While a wave is running every open door is barred (`world.arena.doors`).
 * - `anim` 0 → 1 plays when a door appears or unlocks (lock pops, rubble falls).
 */

import { TILE } from './constants';

/** Door frame kinds (numeric: the renderer indexes sprite tables with them). */
export const DK = {
  None: 0,
  Normal: 1,
  Boss: 2,
  Treasure: 3,
  Shop: 4,
  Challenge: 5,
  Cursed: 6,
  Miniboss: 7,
  Nook: 8,
  /** A hole blasted through a secret wall. */
  Secret: 9,
} as const;
export type DoorKind = (typeof DK)[keyof typeof DK];
export const DOOR_KIND_COUNT = 10;

export const DS = { Hidden: 0, Locked: 1, Open: 2 } as const;
export type DoorState = (typeof DS)[keyof typeof DS];

/** Door-slot centres on the room edge (room px), by side 0 N, 1 E, 2 S, 3 W. */
export const DOOR_X: readonly number[] = [TILE * 6.5, TILE * 13, TILE * 6.5, 0];
export const DOOR_Y: readonly number[] = [0, TILE * 3.5, TILE * 7, TILE * 3.5];
/** Where the player stands after coming in through a side: the centre of the tile inside the door. */
export const DOOR_FRONT_X: readonly number[] = [TILE * 6.5, TILE * 12.5, TILE * 6.5, TILE * 0.5];
export const DOOR_FRONT_Y: readonly number[] = [TILE * 0.5, TILE * 3.5, TILE * 6.5, TILE * 3.5];

export class DoorSlot {
  kind: DoorKind = DK.None;
  state: DoorState = DS.Open;
  /** Room index behind the door (-1 none). */
  to = -1;
  /** A subtle crack / drip marks this (still hidden) secret wall. */
  hint = false;
  /** The wall leads to a deep secret room (renderer: a fainter hint). */
  deep = false;
  /** 0 → 1 appear / unlock animation (1 = settled). */
  anim = 1;
}

export class RoomDoors {
  /** False in the training yard (no floor): the renderer draws four plain doors. */
  enabled = false;
  readonly slots: readonly DoorSlot[] = [new DoorSlot(), new DoorSlot(), new DoorSlot(), new DoorSlot()];
  /** Bumped whenever a slot changes (render caches). */
  version = 0;

  reset(): void {
    for (const s of this.slots) {
      s.kind = DK.None;
      s.state = DS.Open;
      s.to = -1;
      s.hint = false;
      s.deep = false;
      s.anim = 1;
    }
    this.version++;
  }

  /** Advances the appear / unlock animations. */
  update(dt: number): void {
    for (let i = 0; i < 4; i++) {
      const s = this.slots[i]!;
      if (s.anim < 1) s.anim = Math.min(1, s.anim + dt * 3);
    }
  }
}

/** The trapdoor to the next floor (boss room, after the boss): position and age. */
export class Trapdoor {
  active = false;
  x = 0;
  y = 0;
  /** Seconds since it appeared (it can be used once it has fully opened). */
  t = 0;
  /** The player has been off it since it appeared (standing on it when it opens doesn't drop you). */
  armed = false;

  reset(): void {
    this.active = false;
    this.t = 0;
    this.armed = false;
  }
}

/** Seconds the trapdoor takes to open before it can be used. */
export const TRAPDOOR_OPEN_TIME = 0.8;
