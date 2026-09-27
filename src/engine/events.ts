/**
 * GameEvent ring buffer: the ONLY way the headless sim talks to render/audio.
 * Event objects are preallocated and reused; `emit` never allocates.
 * At the start of every step the sim discards the events consumers already saw after the
 * previous step, so after `sim.step()` the queue holds that tick's events (preceded by anything
 * emitted between ticks, e.g. by debug hooks). When full, the oldest event is overwritten
 * (and counted).
 */

export type GameEventType =
  /** player fired: x,y = muzzle (room px), a,b = direction */
  | 'shoot'
  /** marble ended: x,y = ground position; a = 1 hit a wall/rock/target, 0 landed on floor, 2 fell into a pit;
   *  b = height above the ground (px) where it burst */
  | 'splash'
  /** something took damage: x,y = where; a = damage; b = remaining hp; id = target kind */
  | 'hit'
  /** a training dummy popped: x,y; id = kind (enemies use 'enemyKilled') */
  | 'pop'
  /** something (re)appeared: x,y; id = kind */
  | 'spawn'
  /** player got hurt: x,y; a = half hearts lost; b = damage source (sim/combat.ts DMG_*) */
  | 'hurt'
  /** player died: x,y */
  | 'death'
  /** request screen shake: a = trauma amount (0..1) */
  | 'shake'
  /** play a named sound: id = sfx name, x,y = position for panning */
  | 'sfx'
  /** a pickup was collected: x,y; a = pickup kind (sim/pickupKinds PK); b = amount gained */
  | 'pickup'
  /** a pickup landed from its pop arc: x,y; a = pickup kind; b = impact speed */
  | 'land'
  /** loot popped out (chest, tile, table): x,y; a = number of pickups */
  | 'loot'
  /** an item was taken (banner + hold pose): x,y; id = item id; a = 0 passive 1 active 2 trinket 3 consumable;
   *  b = 1 if fresh */
  | 'item'
  /** a chest opened: x,y; a = pickup kind (satchel / lockbox) */
  | 'chest'
  /** an action was refused: x,y; id = reason ('noBombs' | 'noActive' | 'notCharged' | 'noConsumable' | 'locked') */
  | 'denied'
  /** red health restored: x,y; a = half hearts (b = 1 for heart containers / bonus hearts) */
  | 'heal'
  /** bonus hearts emptied: x,y; a = 1 tin; b = how many */
  | 'heartBreak'
  /** fire nova (Ember heart broke, items): x,y; a = radius; id = flavour ('ember') */
  | 'nova'
  /** a bomb was placed: x,y */
  | 'bombPlaced'
  /** explosion: x,y; a = radius; b = damage */
  | 'explosion'
  /** a breakable tile took a hit: x,y = cell centre; a = tile id; b = hits left */
  | 'tileHit'
  /** a tile was destroyed / put out: x,y = cell centre; a = tile id */
  | 'tileBreak'
  /** active item (a = 0) or consumable (a = 1) used: x,y; id = item id */
  | 'activeUse'
  /** the active item became fully charged: id = item id */
  | 'charged'
  /** an item trigger fired: x,y; id = source item id */
  | 'triggered'
  // ── Enemies (Phase 2C) — id = enemy def id unless noted ──
  /** an enemy poofed into the room: x,y; a = radius; b = champion index + 1 (0 = none) */
  | 'enemySpawn'
  /** first time this run an enemy kind appeared (bestiary): x,y */
  | 'enemySeen'
  /** an enemy took damage: x,y; a = damage; b = source (sim/hittable SRC_*) */
  | 'enemyHit'
  /** an enemy died (bestiary + death burst): x,y; a = radius; b = flags (1 frozen/shattered, 2 champion, 4 big) */
  | 'enemyKilled'
  /** telegraph started: x,y; a = 1 for a dash wind-up, 0 for an attack */
  | 'enemyWindup'
  /** an enemy fired: x,y; a = shots; b = shot style index */
  | 'enemyShoot'
  /** an enemy lobbed: x,y; a = shots; b = shot style index */
  | 'enemyLob'
  /** an enemy called minions: x,y; a = how many */
  | 'enemySummon'
  /** a hopper took off / landed: x,y; a = radius */
  | 'enemyHop'
  | 'enemyLand'
  /** a dasher started charging: x,y; a,b = direction */
  | 'enemyDash'
  /** a dasher hit a wall: x,y = impact point; a = radius */
  | 'bonk'
  /** burrower: x,y; a = 0 dug in, 1 rumbling (about to surface), 2 surfaced; b = radius */
  | 'burrow'
  /** teleporter: x,y; a = 0 fading out, 1 reappeared; b = radius */
  | 'blink'
  /** a ground shockwave started: x,y; a = final radius; b = speed */
  | 'shockwave'
  /** an enemy shot ended: x,y; a = 1 hit something, 0 fizzled; b = shot style index */
  | 'eshotPop'
  /** a lob landed: x,y; a = splash radius; b = shot style index */
  | 'lobLand'
  /** a status took hold: x,y; a = status (sim/enemies/status ST_*); b = source; id = def id or 'dummy' */
  | 'status'
  /** room doors: a = 1 slam shut, 0 open; b = wave number */
  | 'doors'
  /** every enemy of the wave is dead: x,y = where the reward drops; a = wave number */
  | 'roomClear';

export interface GameEvent {
  type: GameEventType;
  x: number;
  y: number;
  a: number;
  b: number;
  id: string;
}

export class EventQueue {
  readonly capacity: number;
  private readonly buf: GameEvent[];
  private head = 0;
  count = 0;
  /** Events overwritten because the queue was full (diagnostics). */
  dropped = 0;

  constructor(capacity = 256) {
    this.capacity = capacity;
    this.buf = new Array<GameEvent>(capacity);
    for (let i = 0; i < capacity; i++) this.buf[i] = { type: 'sfx', x: 0, y: 0, a: 0, b: 0, id: '' };
  }

  emit(type: GameEventType, x = 0, y = 0, a = 0, b = 0, id = ''): void {
    let idx: number;
    if (this.count < this.capacity) {
      idx = (this.head + this.count) % this.capacity;
      this.count++;
    } else {
      idx = this.head;
      this.head = (this.head + 1) % this.capacity;
      this.dropped++;
    }
    const e = this.buf[idx] as GameEvent;
    e.type = type;
    e.x = x;
    e.y = y;
    e.a = a;
    e.b = b;
    e.id = id;
  }

  /** i-th oldest event (0 <= i < count). */
  at(i: number): GameEvent {
    return this.buf[(this.head + i) % this.capacity] as GameEvent;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }

  /** Drops the `n` oldest events (all of them if n >= count). */
  discard(n: number): void {
    if (n <= 0) return;
    if (n >= this.count) {
      this.clear();
      return;
    }
    this.head = (this.head + n) % this.capacity;
    this.count -= n;
  }
}
