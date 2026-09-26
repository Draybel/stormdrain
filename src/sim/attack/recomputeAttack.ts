/**
 * Attack pipeline entry point for item changes (ARCHITECTURE §4.1).
 *
 * STUB (Phase 2 part A): recomputePlayer() already gathers every 'mod', 'carrier' and 'familiar'
 * effect the player holds into `player.loadout` (see sim/loadout.ts) and calls this function right
 * after the stats are recomputed. Part B replaces the body with `buildAttackProfile(player)`:
 * resolve the primary carrier + riders, sort modifier hooks per stage, compose the ShotStyle, and
 * cache the result on the player. Until then marbles keep using the plain stats.
 */

import type { Player } from '../player';

export function recomputeAttack(player: Player): void {
  // Part B: player.attack = buildAttackProfile(player);
  player.attackVersion = player.loadout.version;
}
