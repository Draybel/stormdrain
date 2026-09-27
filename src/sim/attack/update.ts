/**
 * The attack pipeline's per-tick update (called by Sim.step right after the player moved and fired):
 * target snapshot → familiars → delayed specs → orbit blades → projectiles → beams → swipes → queued
 * explosions. Nothing here allocates.
 */

import type { World } from '../world';
import { updateBeams } from './beam';
import { familiarsToPlayer, updateFamiliars } from './familiars';
import { flushPending } from './fire';
import { flushExplosions } from './impacts';
import { updateSwipes } from './melee';
import { syncOrbit } from './orbit';
import { updateShots } from './shot';
import { snapshotTargets } from './targets';

export function updateAttack(w: World, dt: number): void {
  const a = w.atk;
  a.arcsThisTick = 0;
  a.puddlesThisTick = 0;
  snapshotTargets(w, a.targets);
  updateFamiliars(w, dt);
  flushPending(w);
  syncOrbit(w);
  updateShots(w, dt);
  updateBeams(w, dt);
  updateSwipes(w, dt);
  flushExplosions(w);
}

/** A room was (re)loaded: nothing of the old room's attacks survives; familiars regroup. */
export function resetAttackRoom(w: World): void {
  w.atk.clearRoom();
  w.player.atk.reset();
  familiarsToPlayer(w);
}
