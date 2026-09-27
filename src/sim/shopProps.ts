/**
 * Coin-operated props (pedestal slots with `prop` set, see sim/pedestals.ts):
 * - the DONATION JAR (Magpie's Stall): leaning on it drops a coin in every `jarEvery` s; the run's total
 *   passes luck thresholds (+luck each), and `counters.donated` feeds unlocks later;
 * - the GUMBALL GAMBLER (some normal rooms): 1 coin → a spin → a seeded outcome from the loot stream
 *   (mostly nothing, sometimes coins, a heart, a bomb, a key, rarely a trinket); a blast breaks it open
 *   and it spills coins.
 * A blast that breaks the jar or the gambler open counts as robbing a shop ('robbed': Sable's SMASH AND GRAB);
 * a smashed jar spills a few coins, Magpie squawks, and it takes no more donations.
 * Pure sim; events drive the presentation ('donate', 'slots', 'robbed').
 */

import { recomputePlayer } from './effects';
import { addCounter } from './inventory';
import type { Pedestal } from './pedestals';
import { pickupKindOf, type PickupKind } from './pickupKinds';
import { spawnLoot } from './pickups';
import { SHOP_TUNING } from './tuning';
import type { PickupName } from './types';
import type { World } from './world';

/** Pedestal `prop` kinds (0 = an ordinary item pedestal / goods). */
export const PROP_NONE = 0;
export const PROP_JAR = 1;
export const PROP_SLOTS = 2;
/** Old Pell, the wandering trader (offers `item` for `keys`). */
export const PROP_TRADER = 3;

/** Gumball Gambler outcomes: [pickup ('' = nothing), count, weight]. */
const SLOT_OUTCOMES: readonly (readonly [PickupName | '', number, number])[] = [
  ['', 0, 46],
  ['coin', 2, 16],
  ['coin', 3, 7],
  ['heart', 1, 8],
  ['bomb', 1, 7],
  ['key', 1, 7],
  ['goldCoin', 1, 2],
  ['trinket', 1, 3],
  ['sparkSmall', 1, 4],
];
const SLOT_KINDS: readonly (PickupKind | -1)[] = SLOT_OUTCOMES.map(([n]) => (n ? pickupKindOf(n) : -1));
let slotTotal = 0;
for (const o of SLOT_OUTCOMES) slotTotal += o[2];

/** Leaning on the donation jar: one coin every `jarEvery` s while there are coins. */
export function donate(w: World, ped: Pedestal): void {
  const inv = w.player.inv;
  if (ped.broken || ped.coolT > 0 || inv.coins <= 0) return;
  ped.coolT = SHOP_TUNING.jarEvery;
  addCounter(inv, 'coins', -1);
  inv.version++;
  const total = ++w.counters.donated;
  const lucky = SHOP_TUNING.jarThresholds.includes(total);
  if (lucky) {
    w.player.luckBonus += SHOP_TUNING.jarLuck;
    recomputePlayer(w);
  }
  ped.changedT = 0;
  w.events.emit('donate', ped.x, ped.y - 14, total, lucky ? 1 : 0);
}

/** Bumping the Gumball Gambler: 1 coin starts a spin (the result comes when it stops). */
export function playSlots(w: World, ped: Pedestal): void {
  if (ped.broken || ped.spinT > 0 || ped.coolT > 0) return;
  const inv = w.player.inv;
  if (inv.coins <= 0) {
    w.events.emit('denied', ped.x, ped.y - 16, 1, 0, 'poor');
    ped.blocked = true;
    return;
  }
  addCounter(inv, 'coins', -1);
  inv.version++;
  w.counters.slotPlays++;
  ped.spinT = SHOP_TUNING.slotSpin;
  ped.changedT = 0;
  w.events.emit('slots', ped.x, ped.y - 12, 0, 0);
}

/** The spin stopped: a seeded outcome (loot stream) pops out of the chute. */
export function slotsPayout(w: World, ped: Pedestal): void {
  let r = w.lootRng.next() * slotTotal;
  let pick = 0;
  for (let i = 0; i < SLOT_OUTCOMES.length; i++) {
    const wt = SLOT_OUTCOMES[i]![2];
    if (r < wt) {
      pick = i;
      break;
    }
    r -= wt;
  }
  const kind = SLOT_KINDS[pick]!;
  const count = SLOT_OUTCOMES[pick]![1];
  ped.coolT = SHOP_TUNING.slotCool;
  ped.changedT = 0;
  if (kind >= 0) for (let i = 0; i < count; i++) spawnLoot(w, kind as PickupKind, undefined, ped.x, ped.y + 4);
  w.events.emit('slots', ped.x, ped.y - 12, 1, kind >= 0 ? 1 : 0);
  if (kind >= 0) w.events.emit('loot', ped.x, ped.y + 4, count);
}

/** A blast broke the machine open: coins spill out; it stays as a wreck. */
export function breakSlots(w: World, ped: Pedestal): void {
  if (ped.broken) return;
  ped.broken = true;
  ped.spinT = 0;
  ped.changedT = 0;
  const [lo, hi] = SHOP_TUNING.slotBreakCoins;
  const n = w.lootRng.int(lo, hi);
  const coin = pickupKindOf('coin');
  for (let i = 0; i < n; i++) spawnLoot(w, coin, undefined, ped.x, ped.y + 2);
  w.events.emit('slots', ped.x, ped.y - 10, 2, 0);
  w.events.emit('loot', ped.x, ped.y, n);
  w.events.emit('robbed', ped.x, ped.y - 10, n, 0, 'slots');
}

/**
 * A blast smashed Magpie's donation jar: a few coins spill out (more if you fed it), Magpie squawks at the thief,
 * and the wreck takes no more donations. The luck already earned stays.
 */
export function breakJar(w: World, ped: Pedestal): void {
  if (ped.broken) return;
  ped.broken = true;
  ped.changedT = 0;
  const [lo, hi] = SHOP_TUNING.jarBreakCoins;
  const n = w.lootRng.int(lo, hi) + Math.min(SHOP_TUNING.jarBreakBonus, Math.floor(w.counters.donated / 5));
  const coin = pickupKindOf('coin');
  for (let i = 0; i < n; i++) spawnLoot(w, coin, undefined, ped.x, ped.y + 2);
  w.events.emit('loot', ped.x, ped.y, n);
  w.events.emit('robbed', ped.x, ped.y - 10, n, 0, 'jar');
  const props = w.props;
  if (props.npc !== 0) {
    props.npcMood = 2;
    props.npcT = 0;
    w.events.emit('npcSay', props.npcX, -8, 0, 0, 'MAGPIE: MY JAR! THIEF! THIEF!');
  }
}
