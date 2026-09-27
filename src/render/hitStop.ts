/**
 * Hit-stop (polish batch 2): the run scene holds the picture for a few ticks on the big beats — the Storm Lance
 * release, a melee swing connecting, a big / champion kill, a boss changing phase, getting hurt. Presentation only:
 * the scene simply doesn't step the sim while it runs (the sim stays deterministic; nothing here touches it), and any
 * pending input edge (a press) cancels it, so a press is never swallowed.
 *
 * Rate limit: no new hit-stop starts within HITSTOP_GAP s of the last one — except a hurt, which always lands (and
 * is what a player most needs to notice). Melee connects are further limited to one per HITSTOP_MELEE_GAP s.
 */

import type { GameEvent } from '../engine/events';

/** Ticks of hit-stop per beat. */
export const HITSTOP = {
  lance: 3,
  melee: 1,
  big: 3,
  champion: 2,
  phase: 4,
  hurt: 5,
} as const;
/** No new hit-stop within this many seconds of the last one (a hurt ignores it). */
export const HITSTOP_GAP = 0.25;
/** Melee connects: at most one hit-stop per this many seconds. */
export const HITSTOP_MELEE_GAP = 0.2;

/** 'enemyKilled' flags (sim/enemies/damage.ts KILL_*; duplicated so render never imports sim logic). */
const KILL_CHAMPION = 2;
const KILL_BIG = 4;

export class HitStop {
  /** Ticks left to hold. */
  ticks = 0;
  /** Hit-stops started so far (tests / tools). */
  started = 0;
  private lastAt = -Infinity;
  private lastMeleeAt = -Infinity;

  /** Asks for `ticks` of hit-stop at time `now` (s). `force` skips the rate limit (hurts). Returns true if it took. */
  request(ticks: number, now: number, force = false): boolean {
    if (ticks <= 0) return false;
    if (!force && now - this.lastAt < HITSTOP_GAP) return false;
    if (ticks > this.ticks) this.ticks = ticks;
    this.lastAt = now;
    this.started++;
    return true;
  }

  /** The hit-stop a sim event asks for (at scene time `now`, s). */
  onEvent(e: GameEvent, now: number): void {
    switch (e.type) {
      case 'lanceFire':
        if (e.id !== 'mini') this.request(HITSTOP.lance, now);
        break;
      case 'swipeHit':
        if (now - this.lastMeleeAt >= HITSTOP_MELEE_GAP && this.request(HITSTOP.melee, now)) this.lastMeleeAt = now;
        break;
      case 'enemyKilled':
        if ((e.b & KILL_BIG) !== 0) this.request(HITSTOP.big, now);
        else if ((e.b & KILL_CHAMPION) !== 0) this.request(HITSTOP.champion, now);
        break;
      case 'bossPhase':
        this.request(HITSTOP.phase, now);
        break;
      case 'hurt':
        this.request(HITSTOP.hurt, now, true);
        break;
      default:
        break;
    }
  }

  /**
   * One tick of the scene: true = hold the picture (a tick of hit-stop is used up). A pending input edge
   * (`edge`) cancels the rest so the press goes through this very tick.
   */
  hold(edge: boolean): boolean {
    if (this.ticks <= 0) return false;
    if (edge) {
      this.ticks = 0;
      return false;
    }
    this.ticks--;
    return true;
  }

  reset(): void {
    this.ticks = 0;
    this.lastAt = -Infinity;
    this.lastMeleeAt = -Infinity;
  }
}
