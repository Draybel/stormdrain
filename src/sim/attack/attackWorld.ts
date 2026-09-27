/**
 * Per-world state of the attack pipeline (`world.atk`): beams and swipes pools, the per-tick target
 * snapshot, queues (delayed specs, explosions), familiars, orbit blades and per-tick guardrail counters.
 * Projectiles live in `world.projectiles` (they predate the pipeline and tests read them there).
 */

import { Pool } from '../../engine/pool';
import { ATTACK_TUNING } from '../tuning';
import { Beam } from './beam';
import { Familiars } from './familiars';
import { PendingSpecs } from './fire';
import { ExplosionQueue } from './impacts';
import { Swipe } from './melee';
import { OrbitBlades } from './orbit';
import { TargetSnapshot } from './targets';

export class AttackWorld {
  readonly beams = new Pool<Beam>(ATTACK_TUNING.capBeams, () => new Beam());
  readonly swipes = new Pool<Swipe>(ATTACK_TUNING.capSwipes, () => new Swipe());
  readonly targets = new TargetSnapshot();
  readonly pending = new PendingSpecs();
  readonly explosions = new ExplosionQueue();
  readonly familiars = new Familiars();
  readonly orbit = new OrbitBlades();
  /** Chain-lightning arcs drawn this tick (cap 32). */
  arcsThisTick = 0;
  /** Player puddles spawned this tick (merge-limited). */
  puddlesThisTick = 0;

  /** A new room: clear everything in flight (familiars stay, they regroup at the player). */
  clearRoom(): void {
    this.beams.clear();
    this.swipes.clear();
    this.pending.n = 0;
    this.pending.profile.fill(null);
    this.explosions.clear();
    this.orbit.clear();
    this.arcsThisTick = 0;
    this.puddlesThisTick = 0;
  }
}
