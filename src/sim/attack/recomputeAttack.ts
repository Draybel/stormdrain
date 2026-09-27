/**
 * Attack pipeline entry point for item changes (ARCHITECTURE §4.1). recomputePlayer() gathers every
 * 'mod', 'carrier' and 'familiar' effect into `player.loadout` (sim/loadout.ts) and calls this right
 * after the stats were recomputed: the AttackProfile is rebuilt here — never per shot.
 */

import type { Player } from '../player';
import { buildAttackProfile } from './profile';

export function recomputeAttack(player: Player): void {
  player.attack = buildAttackProfile(player);
  player.attackVersion = player.loadout.version;
}
