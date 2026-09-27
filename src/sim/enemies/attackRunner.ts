/**
 * Runs an enemy's attacks: cooldown timers, range checks, the wind-up telegraph before each attack,
 * multi-shot bursts, and event-triggered attacks (hop landing, burrow emerge, teleport appear, dash
 * bonk — `triggerAttacks`, called by the movement behaviours).
 */

import type { World } from '../world';
import { ON_TIMER, targetDist, telegraph, type CompiledAttack } from './behaviors/common';
import type { Enemy } from './enemy';
import { ST_FEAR, ST_FREEZE, hasStatus } from './status';

/** Can it start an attack right now (not spawning, frozen, afraid, underground or blinking)? */
export function canAttack(e: Enemy): boolean {
  return (
    !e.dead &&
    e.spawnT <= 0 &&
    e.stun <= 0 &&
    !e.burrowed &&
    !e.hidden &&
    !hasStatus(e.status, ST_FREEZE) &&
    !hasStatus(e.status, ST_FEAR)
  );
}

export function fireAttack(w: World, e: Enemy, a: CompiledAttack): void {
  a.beh.fire(w, e, a);
  e.volleys++;
}

function beginAttack(w: World, e: Enemy, index: number, a: CompiledAttack): void {
  const wind = a.p.windup!;
  if (wind > 0.001) {
    if (e.windAtk >= 0) return;
    e.windAtk = index;
    e.windT = wind;
    telegraph(e, wind);
    w.events.emit('enemyWindup', e.x, e.y, 0, 0, e.def.id);
  } else {
    fireAttack(w, e, a);
  }
}

/** Fires every attack listening to `on` (ON_LAND, ON_EMERGE, …) that is off cooldown. */
export function triggerAttacks(w: World, e: Enemy, on: number): void {
  if (!canAttack(e)) return;
  const atks = e.cfg.attacks;
  for (let i = 0; i < atks.length; i++) {
    const a = atks[i]!;
    if (a.p.on !== on || e.atkT[i]! > 0) continue;
    e.atkT[i] = a.cooldown * e.cdMul;
    beginAttack(w, e, i, a);
  }
}

/** Per tick. `rate` scales the cooldown clocks (slowed enemies attack less often). */
export function updateAttacks(w: World, e: Enemy, dt: number, rate: number): void {
  const atks = e.cfg.attacks;
  const active = canAttack(e);
  if (!active) {
    // Frozen / afraid / underground: a pending telegraph is cancelled, bursts stop.
    e.windAtk = -1;
    e.burstLeft = 0;
  }
  if (e.windAtk >= 0) {
    e.windT -= dt;
    if (e.windT <= 0) {
      const a = atks[e.windAtk];
      e.windAtk = -1;
      if (a) fireAttack(w, e, a);
    }
  }
  if (e.burstLeft > 0 && e.burstA) {
    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.burstA.beh.fire(w, e, e.burstA);
    }
  }
  for (let i = 0; i < atks.length; i++) {
    const a = atks[i]!;
    const t = e.atkT[i]! - dt * rate;
    e.atkT[i] = t;
    if (!active || t > 0 || a.p.on !== ON_TIMER) continue;
    if (a.beh.passive) {
      fireAttack(w, e, a);
      e.atkT[i] = a.cooldown * e.cdMul;
      continue;
    }
    if (e.windAtk >= 0 || e.burstLeft > 0) continue;
    if (!e.hasTgt) {
      e.atkT[i] = 0.25;
      continue;
    }
    const d = targetDist(e);
    if (d > a.p.range! || d < a.p.minRange!) {
      e.atkT[i] = 0.2;
      continue;
    }
    e.atkT[i] = a.cooldown * e.cdMul * (0.85 + w.combatRng.next() * 0.3);
    beginAttack(w, e, i, a);
  }
}
