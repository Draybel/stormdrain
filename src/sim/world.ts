/** All mutable simulation state for the current room. */

import { EventQueue } from '../engine/events';
import { Pool } from '../engine/pool';
import type { Rng } from '../engine/rng';
import { CAP_DUMMIES, CAP_PROJECTILES } from './constants';
import { Dummy } from './dummies';
import { Player } from './player';
import { Projectile } from './projectiles';
import { RoomGrid } from './room';
import type { CharacterDef } from './types';

export interface WorldCounters {
  shots: number;
  hits: number;
  pops: number;
}

export class World {
  readonly room = new RoomGrid();
  readonly player: Player;
  readonly projectiles = new Pool<Projectile>(CAP_PROJECTILES, () => new Projectile());
  readonly dummies = new Pool<Dummy>(CAP_DUMMIES, () => new Dummy());
  readonly events = new EventQueue(512);
  /** In-room randomness (serialized with the run later). */
  readonly combatRng: Rng;
  tick = 0;
  time = 0;
  readonly counters: WorldCounters = { shots: 0, hits: 0, pops: 0 };

  constructor(character: CharacterDef, combatRng: Rng) {
    this.player = new Player(character);
    this.combatRng = combatRng;
  }
}
