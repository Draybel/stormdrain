/**
 * Aimed-DPS harness (polish batch 2, B2-2): Wren (or another character) against one pinned, boss-sized, static
 * target straight down the aim line at a given distance, with perfect play for 20 s — normal primaries hold the
 * trigger, charge modes (the Storm Lance, the charge rider) hold to a full charge (the lance with the charge rider:
 * the full overcharge) and release on that very tick. The damage dealt is the target's HP lost.
 */

import { CHARACTERS } from '../../src/content/registry';
import { CM_NONE } from '../../src/sim/attack/profile';
import { ATTACK_TUNING } from '../../src/sim/tuning';
import { OPEN_ROOM, testEnemy } from './enemies';
import { makeInput, makeSim, stepN } from './sim';

/** A boss-sized practice target that never moves, never dies and never hurts. */
export function dpsTargetDef(): string {
  const id = 't-dps-target';
  testEnemy(id, { hp: 1e9, radius: 14, speed: 0, contact: 0, move: { kind: 'idle' }, attacks: [] });
  return id;
}

export interface DpsOptions {
  /** Distance from the player to the target's centre (px). */
  dist: number;
  /** Items given (in order) through the normal pickup code. */
  items: readonly string[];
  character?: string;
  seconds?: number;
  seed?: string;
}

/** Damage per second on the target over `seconds` of perfect play. */
export function aimedDps(o: DpsOptions): number {
  const seconds = o.seconds ?? 20;
  const character = o.character ? CHARACTERS.get(o.character) : undefined;
  const sim = makeSim(o.seed ?? `dps:${o.items.join('+')}:${o.dist}`, { room: OPEN_ROOM, character });
  const w = sim.world;
  w.godMode = true;
  const px = 24;
  const py = 56;
  w.player.placeAt(px, py);
  for (const id of o.items) sim.giveItem(id);
  const t = sim.spawnEnemy(dpsTargetDef(), px + o.dist, py, { champion: false })!;
  t.spawnT = 0;
  t.pinned = true;
  const hp0 = t.hp;
  const input = makeInput({ aimX: 1, aimY: 0 });
  const ticks = Math.round(seconds * 60);
  const p = w.player;
  for (let k = 0; k < ticks; k++) {
    const charge = p.attack.chargeMode !== CM_NONE;
    if (charge) {
      const maxC = p.attack.chargeMode !== CM_NONE && p.attack.primary === 'lance' && p.attack.riderCharge > 0 ? ATTACK_TUNING.overcharge : 1;
      // Hold to a full charge, release on the tick it is full (one tick off the trigger), hold again.
      input.fireHeld = !(p.atk.charging && p.atk.charge >= maxC - 1e-9);
    } else {
      input.fireHeld = true;
    }
    input.firePressed = input.fireHeld && k === 0;
    stepN(sim, input, 1);
    // Wren never moves: whatever shoves her (a lasso, a blast) is undone.
    p.placeAt(px, py);
  }
  return (hp0 - t.hp) / seconds;
}
