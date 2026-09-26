/**
 * Fixed-capacity object pool. All objects are created up front; nothing is allocated afterwards.
 *
 * Storage is dense: `items[0 .. count)` are alive and `items[count .. capacity)` is the free list.
 * Releasing swaps the released object with the last live one, so iteration over live objects is
 * a tight loop with no holes. To release while iterating, walk BACKWARDS:
 *
 *   for (let i = pool.count - 1; i >= 0; i--) {
 *     const p = pool.items[i]!;
 *     if (done(p)) pool.release(p);   // safe: the swapped-in object was already visited
 *   }
 *
 * Objects allocated during such a loop are appended past the cursor and first update next tick.
 */

export interface Poolable {
  alive: boolean;
  /** Index inside the pool's dense array. Managed by the pool. */
  slot: number;
}

export class Pool<T extends Poolable> {
  readonly capacity: number;
  readonly items: T[];
  /** Number of live objects (they occupy items[0 .. count)). */
  count = 0;
  /** Allocation attempts refused because the pool was full (useful for perf overlays/tests). */
  refused = 0;

  constructor(capacity: number, factory: (index: number) => T) {
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
    for (let i = 0; i < capacity; i++) {
      const it = factory(i);
      it.alive = false;
      it.slot = i;
      this.items[i] = it;
    }
  }

  get free(): number {
    return this.capacity - this.count;
  }

  /** Returns a recycled object marked alive (caller must reset its fields), or null when full. */
  alloc(): T | null {
    if (this.count >= this.capacity) {
      this.refused++;
      return null;
    }
    const it = this.items[this.count] as T;
    it.slot = this.count;
    it.alive = true;
    this.count++;
    return it;
  }

  release(it: T): void {
    if (!it.alive) return;
    it.alive = false;
    const last = this.count - 1;
    const idx = it.slot;
    if (idx !== last) {
      const moved = this.items[last] as T;
      this.items[idx] = moved;
      moved.slot = idx;
      this.items[last] = it;
      it.slot = last;
    }
    this.count = last;
  }

  clear(): void {
    for (let i = 0; i < this.count; i++) (this.items[i] as T).alive = false;
    this.count = 0;
  }
}
