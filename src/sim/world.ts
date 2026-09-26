/** All mutable simulation state for the current room (plus the run-level player and loot stream). */

import { EventQueue } from '../engine/events';
import { Pool } from '../engine/pool';
import type { Rng } from '../engine/rng';
import { Bomb } from './bombs';
import { CAP_BOMBS, CAP_DUMMIES, CAP_PEDESTALS, CAP_PICKUPS, CAP_PROJECTILES } from './constants';
import { Dummy } from './dummies';
import type { HookApi } from './hooks';
import { Pedestal } from './pedestals';
import { Pickup } from './pickups';
import { Player } from './player';
import { Projectile } from './projectiles';
import { RoomGrid } from './room';
import type { CharacterDef } from './types';

export interface WorldCounters {
  shots: number;
  hits: number;
  pops: number;
  /** Pickups collected (coins, hearts…; not items). */
  pickups: number;
  /** Items taken (pedestals, trinket/consumable pickups, gifts). */
  items: number;
  bombsPlaced: number;
  explosions: number;
  tilesBroken: number;
  chestsOpened: number;
  hurts: number;
  roomsCleared: number;
}

export class World {
  readonly room = new RoomGrid();
  readonly player: Player;
  readonly projectiles = new Pool<Projectile>(CAP_PROJECTILES, () => new Projectile());
  readonly dummies = new Pool<Dummy>(CAP_DUMMIES, () => new Dummy());
  readonly pickups = new Pool<Pickup>(CAP_PICKUPS, () => new Pickup());
  readonly bombs = new Pool<Bomb>(CAP_BOMBS, () => new Bomb());
  readonly pedestals = new Pool<Pedestal>(CAP_PEDESTALS, () => new Pedestal());
  readonly events = new EventQueue(512);
  /** In-room randomness (pop arcs, trigger rolls…; serialized with the run later). */
  readonly combatRng: Rng;
  /** Run-level loot stream (drop tables, chest contents; serialized with the run later). */
  readonly lootRng: Rng;
  tick = 0;
  time = 0;
  readonly counters: WorldCounters = {
    shots: 0,
    hits: 0,
    pops: 0,
    pickups: 0,
    items: 0,
    bombsPlaced: 0,
    explosions: 0,
    tilesBroken: 0,
    chestsOpened: 0,
    hurts: 0,
    roomsCleared: 0,
  };
  /**
   * Floor code hook: an explosion reached a secret wall tile or a wall's door slot at (x, y)
   * (room px; door slots are the four wall centres). The floor decides whether a secret room is there.
   */
  onSecretWallBombed: ((x: number, y: number) => void) | null = null;
  /** Nesting depth of trigger execution (guards against trigger → effect → trigger loops). */
  triggerDepth = 0;
  /** Services for content hooks (built lazily by sim/effects.ts). */
  hookApi: HookApi | null = null;

  constructor(character: CharacterDef, combatRng: Rng, lootRng: Rng) {
    this.player = new Player(character);
    this.combatRng = combatRng;
    this.lootRng = lootRng;
  }
}
