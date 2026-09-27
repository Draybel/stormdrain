/** All mutable simulation state for the current room (plus the run-level player and loot stream). */

import { EventQueue } from '../engine/events';
import { Pool } from '../engine/pool';
import type { Rng } from '../engine/rng';
import { Arena } from './arena';
import { BossFight } from './bosses/state';
import { AttackWorld } from './attack/attackWorld';
import { Shot } from './attack/shot';
import { Bomb } from './bombs';
import {
  CAP_BOMBS,
  CAP_CREEP,
  CAP_DUMMIES,
  CAP_ENEMIES,
  CAP_ENEMY_SHOTS,
  CAP_PEDESTALS,
  CAP_PICKUPS,
  CAP_PROJECTILES,
  CAP_WAVES,
  ROOM_COLS,
  ROOM_ROWS,
} from './constants';
import { RoomDoors, Trapdoor } from './doors';
import { Dummy } from './dummies';
import type { FloorCurse } from './floor/types';
import { Enemy } from './enemies/enemy';
import { FlowField } from './enemies/pathfield';
import { Creep, EnemyShot, Wave } from './enemies/shots';
import { TileTarget } from './hittable';
import type { HookApi } from './hooks';
import { Pedestal } from './pedestals';
import { Pickup } from './pickups';
import { Player } from './player';
import { RoomGrid } from './room';
import { RoomProps } from './roomProps';
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
  /** Enemies spawned / killed, and enemy projectiles fired. */
  enemiesSpawned: number;
  kills: number;
  enemyShots: number;
  /** Bosses and minibosses defeated. */
  bossKills: number;
  /** Coins put in donation jars (luck thresholds, unlocks later) and Gumball Gambler plays. */
  donated: number;
  slotPlays: number;
}

export class World {
  readonly room = new RoomGrid();
  readonly player: Player;
  /** Player-side projectiles of the attack pipeline (marbles, blades, crescents, bombs, orbit blades…). */
  readonly projectiles = new Pool<Shot>(CAP_PROJECTILES, () => new Shot());
  /** The rest of the attack pipeline: beams, swipes, familiars, queues, target snapshot (sim/attack). */
  readonly atk = new AttackWorld();
  readonly dummies = new Pool<Dummy>(CAP_DUMMIES, () => new Dummy(this));
  readonly pickups = new Pool<Pickup>(CAP_PICKUPS, () => new Pickup());
  readonly bombs = new Pool<Bomb>(CAP_BOMBS, () => new Bomb());
  readonly pedestals = new Pool<Pedestal>(CAP_PEDESTALS, () => new Pedestal());
  readonly enemies = new Pool<Enemy>(CAP_ENEMIES, () => new Enemy(this));
  readonly enemyShots = new Pool<EnemyShot>(CAP_ENEMY_SHOTS, () => new EnemyShot());
  readonly creep = new Pool<Creep>(CAP_CREEP, () => new Creep());
  readonly waves = new Pool<Wave>(CAP_WAVES, () => new Wave());
  /** One Hittable adapter per grid cell (crates, urns, fires) — see sim/hittable.ts. */
  readonly tileTargets: TileTarget[] = [];
  /** Shared path-finding field of the current room (chasePath). */
  readonly flow = new FlowField();
  /** Room combat flow (waves, doors, clear). */
  readonly arena = new Arena();
  /** Enemy kinds met this run (the 'enemySeen' event fires once per kind — bestiary). */
  readonly seenEnemies = new Set<string>();
  /** Last enemy uid handed out. */
  enemySerial = 0;
  /** Big enough for absurd builds (dozens of beams hitting everything on one tick). */
  readonly events = new EventQueue(1024);
  /** In-room randomness (pop arcs, trigger rolls, enemy AI, champion rolls; serialized with the run later). */
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
    enemiesSpawned: 0,
    kills: 0,
    enemyShots: 0,
    bossKills: 0,
    donated: 0,
    slotPlays: 0,
  };
  /**
   * Floor code hook: an explosion reached a secret wall tile or a wall's door slot at (x, y)
   * (room px; door slots are the four wall centres). The floor decides whether a secret room is there.
   */
  onSecretWallBombed: ((x: number, y: number) => void) | null = null;
  /** Floor code hook: an explosion that breaks tiles went off (slot machines, the hidden-route grate). */
  onExplosion: ((x: number, y: number, radius: number) => void) | null = null;
  /** Debug god mode: the player takes no damage. */
  godMode = false;
  /**
   * Current room presentation state set by the floor run (sim/run): door slots, the trapdoor, the
   * chapter whose palette the room uses, and the floor curse (render + deluge movement).
   */
  readonly doors = new RoomDoors();
  readonly trapdoor = new Trapdoor();
  /** The room's boss fight (intro card, HP bar, phases; sim/bosses). */
  readonly boss = new BossFight();
  /** Floor objects and wall NPCs of special rooms (plate, grate, whirlpool, skylight, Magpie…). */
  readonly props = new RoomProps();
  chapter = 'gutterways';
  curse: FloorCurse | null = null;
  /** Seconds of spawn protection after entering a room: damagePlayer refuses all damage meanwhile. */
  safeT = 0;
  /** The training-yard bell was bumped this tick (the Sim starts a wave). */
  bellRung = false;
  /** Nesting depth of trigger execution (guards against trigger → effect → trigger loops). */
  triggerDepth = 0;
  /** Services for content hooks (built lazily by sim/effects.ts). */
  hookApi: HookApi | null = null;

  constructor(character: CharacterDef, combatRng: Rng, lootRng: Rng) {
    this.player = new Player(character);
    this.combatRng = combatRng;
    this.lootRng = lootRng;
    for (let row = 0; row < ROOM_ROWS; row++) {
      for (let col = 0; col < ROOM_COLS; col++) this.tileTargets.push(new TileTarget(this, row * ROOM_COLS + col, col, row));
    }
  }
}
