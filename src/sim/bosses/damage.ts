/**
 * The boss side of damage (called by sim/enemies/damage.ts, which must not import the brain):
 * - `bossDamage` filters a hit: nothing gets through during a phase change (the shot 'tinks'), and one
 *   blow can never skip past the next phase threshold (every phase transition is seen); until a phase has been fought
 *   for BOSS_TUNING.minPhase s (finals: minPhaseFinal) its HP stays above the next threshold — the last phase's
 *   killing blow leaves 1 HP — so a huge build still sees every phase (polish batch 4). The hit itself still lands
 *   (flash, sparks, knockback): it reads as a tough boss, not an immune one;
 * - `bossLethal` decides what a killing blow does: a part of a split boss simply dies while others
 *   stand; the LAST part starts the death sequence instead (the brain plays it out, then kills it).
 */

import type { Enemy } from '../enemies/enemy';
import { BOSS_TUNING } from '../tuning';
import type { World } from '../world';

/** The damage a boss actually takes from a hit of `dmg` (0 = absorbed). */
export function bossDamage(w: World, e: Enemy, dmg: number): number {
  const b = e.boss!;
  if (b.invulnT > 0) {
    w.events.emitFx('bossBlock', e.x, e.y - e.r, 0, 0, e.def.id);
    return 0;
  }
  const f = w.boss;
  if (!f.active || f.group !== b.group) return dmg;
  const next = b.phase + 1;
  const early = b.live < b.minPhase;
  if (next < f.marks.length && f.phase < next) {
    // Stop just past the next threshold: the phase changes on the next tick (with its roar) — or, while the phase is
    // young, just short of it.
    const floor = f.marks[next]! * f.maxHp + (early ? 0.01 : -0.01);
    if (f.hp - dmg < floor) dmg = Math.max(0, f.hp - floor);
  } else if (next >= f.marks.length && early && f.hp - dmg < 1) {
    // The last phase: its killing blow waits until the phase has had its time.
    dmg = Math.max(0, f.hp - 1);
  }
  f.hp -= dmg;
  return dmg;
}

/** A boss part's HP reached 0. Returns true if the death sequence started (don't kill it yet). */
export function bossLethal(w: World, e: Enemy): boolean {
  const b = e.boss!;
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const o = pool.items[i]!;
    if (o !== e && !o.dead && !o.dying && o.boss !== null && o.boss.group === b.group) return false;
  }
  e.dying = true;
  e.hp = 0;
  b.dieT = BOSS_TUNING.deathTime;
  b.boomT = 0;
  b.swept = false;
  const f = w.boss;
  if (f.group === b.group) {
    f.dying = true;
    f.hp = 0;
  }
  w.events.emit('bossDying', e.x, e.y, e.r, 0, e.def.id);
  return true;
}
