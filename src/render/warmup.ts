/**
 * Idle-time warm-up (polish batch 2, B2-8): rasterising sprites ahead of their first draw, a little at a time.
 *
 * The START tap used to rasterise every enemy and boss of all twelve chapters (~2,500 canvases) inside the input
 * handler — a ~0.6 s freeze, the music scheduler starved, and all of it kept for the session. Now a floor start queues
 * only what that floor can show (its chapter's enemies, bosses, minibosses and their phase looks, the enemy shots,
 * the doors) and the run scene works through the queue for WARM_BUDGET_MS each frame, behind the floor card; boss
 * fights, champions and new items queue their own extras (phase tints, silhouettes, costumes) when they appear.
 * Anything not warmed yet is still rasterised on demand by its first draw (sprites.ts caches are lazy), so nothing
 * depends on the queue having finished.
 */

import type { SpriteDef } from '../sim/types';
import { getFlash, getFlipped, getFrame } from './sprites';

/** Milliseconds of warm-up work per rendered frame. */
export const WARM_BUDGET_MS = 2;

export class Warmup {
  private readonly jobs: (() => void)[] = [];
  private head = 0;
  private readonly keys = new Set<string>();
  private readonly sprites = new WeakSet<SpriteDef>();
  /** Jobs run so far (tests / tools). */
  done = 0;

  /** Jobs waiting. */
  get pending(): number {
    return this.jobs.length - this.head;
  }

  /** Queues a job once per `key` (later adds with the same key are ignored). */
  add(key: string, job: () => void): void {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    this.jobs.push(job);
  }

  /**
   * Queues every frame of a sprite (with its white flash and mirrored variants when `variants`), one job per frame so
   * a big boss spreads over a few frames. Each sprite is queued once.
   */
  addSprite(def: SpriteDef | string | undefined, variants = true): void {
    if (!def || typeof def === 'string' || this.sprites.has(def)) return;
    this.sprites.add(def);
    for (let f = 0; f < def.frames.length; f++) {
      this.jobs.push(() => {
        getFrame(def, f);
        if (variants) {
          getFlash(def, f);
          getFlipped(def, f);
        }
      });
    }
  }

  /** Runs queued jobs until `budgetMs` has passed (always at least one while any wait). Returns how many are left. */
  step(budgetMs = WARM_BUDGET_MS, now: () => number = () => performance.now()): number {
    if (this.head >= this.jobs.length) return 0;
    const t0 = now();
    do {
      const job = this.jobs[this.head]!;
      this.jobs[this.head] = NOOP;
      this.head++;
      job();
      this.done++;
    } while (this.head < this.jobs.length && now() - t0 < budgetMs);
    if (this.head >= this.jobs.length) {
      this.jobs.length = 0;
      this.head = 0;
    }
    return this.pending;
  }

  /** Runs everything queued (tests; a loading beat). */
  flush(): void {
    while (this.pending > 0) this.step(Infinity);
  }
}

function NOOP(): void {}

/** The game's warm-up queue (the sprite caches it fills are global too). */
export const warmup = new Warmup();
