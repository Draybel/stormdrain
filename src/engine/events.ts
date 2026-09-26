/**
 * GameEvent ring buffer: the ONLY way the headless sim talks to render/audio.
 * Event objects are preallocated and reused; `emit` never allocates.
 * The sim clears the queue at the start of every step, so after `sim.step()` the queue holds
 * exactly that tick's events. When full, the oldest event is overwritten (and counted).
 */

export type GameEventType =
  /** player fired: x,y = muzzle (room px), a,b = direction */
  | 'shoot'
  /** marble ended: x,y = where; a = 1 hit a wall/rock, 0 landed on floor, 2 fell into a pit */
  | 'splash'
  /** something took damage: x,y = where; a = damage; b = remaining hp; id = target kind */
  | 'hit'
  /** a dummy (later: any destructible) popped: x,y; id = kind */
  | 'pop'
  /** something (re)appeared: x,y; id = kind */
  | 'spawn'
  /** player got hurt: x,y */
  | 'hurt'
  /** player died: x,y */
  | 'death'
  /** request screen shake: a = trauma amount (0..1) */
  | 'shake'
  /** play a named sound: id = sfx name, x,y = position for panning */
  | 'sfx';

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
}
