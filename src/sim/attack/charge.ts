/**
 * The player's trigger finger: normal fire at the fire rate, or HOLD-TO-CHARGE for the Storm Lance
 * and the charge rider (§4.2, DESIGN "Storm Lance").
 *
 * - Lance: holding charges a meter drawn over Wren (full in `chargeTime` = 1 s × 3 / fire rate, clamped
 *   0.25..2 s). Releasing at full charge fires the lance volley (flash, shake, boom); releasing early
 *   fizzles. While a lance beam is live the next charge waits. With the charge rider the meter keeps
 *   filling past 100 % (overcharge: wider, longer, stronger beam).
 * - Charge rider (any other primary): release fires one volley × (0.5 → 2.5 by charge; marble and melee primaries
 *   0.5 → 3.6, so a perfectly timed full charge beats holding the trigger — polish batch 2); a laser primary instead
 *   fires a charged BURST of lasers. Release-to-fire: never auto-released while held.
 * Familiars and orbit blades fire along with the player's volleys (they "charge with you").
 */

import type { InputState } from '../../engine/inputState';
import { fireTrigger } from '../effects';
import { ATTACK_TUNING, PLAYER_TUNING } from '../tuning';
import type { World } from '../world';
import { familiarVolleys } from './familiars';
import { fireVolley } from './fire';
import { CM_LANCE, CM_NONE } from './profile';
import { AttackSource, OWN_PLAYER } from './state';

const T = ATTACK_TUNING;

export class PlayerAttack {
  /** Charge level: 0..1, up to 2 when overcharging. */
  charge = 0;
  charging = false;
  /** Seconds to the next charge sound tick. */
  soundT = 0;
  /** Laser + charge: burst shots left, timer, damage multiplier. */
  burstLeft = 0;
  burstT = 0;
  burstMul = 1;
  /** Seconds the last lance beam is still live (no charging meanwhile), and what it started at (the meter shows it). */
  busy = 0;
  busyMax = 0;
  /** Wren's keeper marble is armed (first volley in an uncleared room). */
  keeper = false;
  /** Last aim (unit). */
  dirX = 1;
  dirY = 0;
  readonly src = new AttackSource();

  reset(): void {
    this.charge = 0;
    this.charging = false;
    this.soundT = 0;
    this.burstLeft = 0;
    this.busy = 0;
    this.busyMax = 0;
  }
}

const origin = { x: 0, y: 0 };
const dir = { x: 1, y: 0 };

/**
 * Fires one volley from the player (eye-alternating muzzle for projectiles, centre for beams) with the
 * given charge multipliers, then — for primary volleys — the 'fire' trigger and the familiars.
 */
export function firePlayerVolley(w: World, ax: number, ay: number, mul: number, sizeMul: number, lifeMul: number, primary: boolean): void {
  const p = w.player;
  const prof = p.attack;
  const st = p.atk;
  const P = PLAYER_TUNING;
  let sx = p.x + ax * P.muzzleForward;
  let sy = p.y + ay * P.muzzleForward;
  if (!prof.beam) {
    const side = p.eyeSide * P.eyeOffset;
    p.eyeSide = -p.eyeSide;
    sx += -ay * side;
    sy += ax * side;
  }
  const src = st.src;
  src.ownerKind = OWN_PLAYER;
  src.anchor = p;
  src.vx = p.vx;
  src.vy = p.vy;
  src.mul = mul;
  src.sizeMul = sizeMul;
  src.lifeMul = lifeMul;
  src.keeper = st.keeper && prof.keeperMechanic && w.arena.active;
  src.mini = false;
  src.quiet = false;
  origin.x = sx;
  origin.y = sy;
  dir.x = ax;
  dir.y = ay;
  fireVolley(w, src, origin, dir, prof, 1);
  if (src.keeper) {
    st.keeper = false;
    w.events.emit('keeper', sx, sy - P.shotHeight, ax, ay);
  }
  p.aimX = ax;
  p.aimY = ay;
  p.sinceShot = 0;
  p.shotsFired++;
  w.counters.shots++;
  if (primary) {
    fireTrigger(w, 'fire', sx, sy);
    familiarVolleys(w, ax, ay, src, prof.chargeMode !== CM_NONE);
  }
}

/** Per tick (from updatePlayer): aim, cadence, charging, releases, bursts. */
export function updatePlayerAttack(w: World, input: InputState, dt: number): void {
  const p = w.player;
  const prof = p.attack;
  const st = p.atk;
  const ax = input.aimX;
  const ay = input.aimY;
  const wants = (input.fireHeld || input.firePressed) && (ax !== 0 || ay !== 0);
  p.firing = wants;
  if (wants) {
    st.dirX = ax;
    st.dirY = ay;
  }
  // Only count down while cooling: a ready weapon (0) fires on the very tick the press arrives, and the
  // fractional remainder carries over so e.g. 3/s is exactly every 20 ticks.
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (st.busy > 0) st.busy -= dt;

  if (st.burstLeft > 0) {
    st.burstT -= dt;
    if (st.burstT <= 1e-9) {
      st.burstLeft--;
      st.burstT += T.burstGap;
      firePlayerVolley(w, st.dirX, st.dirY, st.burstMul, 1, 1, false);
    }
  }

  if (prof.chargeMode === CM_NONE) {
    st.charge = 0;
    st.charging = false;
    if (!wants) {
      // No banking shots while idle: resting at 0 means the next press fires instantly.
      if (p.fireCooldown < 0) p.fireCooldown = 0;
      return;
    }
    // Epsilon keeps the cadence exact despite float drift (3/s must be exactly every 20 ticks).
    if (p.fireCooldown > 1e-7) return;
    // Live fire rate (the cadence follows the stats even between profile rebuilds).
    p.fireCooldown += prof.periodMul / Math.max(0.1, p.stats.fireRate);
    if (p.fireCooldown < 0) p.fireCooldown = 0;
    firePlayerVolley(w, ax, ay, 1, 1, 1, true);
    return;
  }

  const lance = prof.chargeMode === CM_LANCE;
  const maxC = lance && prof.riderCharge > 0 ? T.overcharge : 1;
  if (wants) {
    if (st.busy > 0 || p.fireCooldown > 1e-7 || st.burstLeft > 0) return;
    const before = st.charge;
    const rate = before < 1 ? 1 / prof.chargeTime : 1 / (prof.chargeTime * 1.25);
    let c = Math.min(maxC, before + dt * rate);
    // Snap float drift so 1 s at 3 shots/s is exactly 60 ticks.
    if (Math.abs(c - 1) < 1e-6) c = 1;
    if (Math.abs(c - maxC) < 1e-6) c = maxC;
    st.charge = c;
    st.charging = true;
    st.soundT -= dt;
    if (st.soundT <= 0) {
      st.soundT = st.charge < 1 ? 0.1 : 0.34;
      w.events.emit(lance ? 'lanceCharge' : 'chargeTick', p.x, p.y - 10, st.charge, maxC);
    }
    if (before < 1 && st.charge >= 1) w.events.emit(lance ? 'lanceReady' : 'chargeReady', p.x, p.y - 12, 1, 0);
    if (maxC > 1 && before < maxC && st.charge >= maxC) w.events.emit('lanceReady', p.x, p.y - 12, 2, 0);
    return;
  }
  if (p.fireCooldown < 0) p.fireCooldown = 0;
  if (st.charge <= 0) return;
  // Released.
  const c = st.charge;
  st.charge = 0;
  st.charging = false;
  st.soundT = 0;
  const dx = st.dirX;
  const dy = st.dirY;
  if (lance) {
    if (c < 1 - 1e-6) {
      w.events.emit('lanceFizzle', p.x + dx * 6, p.y + dy * 6 - 6, c, 0);
      p.fireCooldown = 0.12;
      return;
    }
    const over = Math.max(0, c - 1);
    const lifeMul = 1 + 0.5 * over;
    firePlayerVolley(w, dx, dy, 1 + 0.5 * over, 1 + 0.6 * over, lifeMul, true);
    st.busy = st.busyMax = prof.lanceLife * lifeMul * 0.9;
    p.fireCooldown = 0.08;
    return;
  }
  // Charge rider.
  const full = Math.min(1, c);
  const shot = prof.primary === 'marble' || prof.primary === 'melee';
  const maxMul = (shot ? T.chargeMaxMulShot : T.chargeMaxMul) + T.chargeMulStack * Math.max(0, prof.riderCharge - 1);
  const mul = T.chargeMinMul + (maxMul - T.chargeMinMul) * full;
  const sizeMul = 0.8 + (T.chargeSizeMax - 0.8) * full;
  w.events.emit('chargeRelease', p.x, p.y - 8, full, 0);
  if (prof.primary === 'laser') {
    const n = 1 + Math.round((T.burstMax - 1) * full);
    st.burstMul = 0.8 + 0.4 * full;
    st.burstLeft = n - 1;
    st.burstT = T.burstGap;
    firePlayerVolley(w, dx, dy, st.burstMul, 1, 1, true);
  } else {
    firePlayerVolley(w, dx, dy, mul, sizeMul, 1, true);
  }
  p.fireCooldown = prof.period * 0.5;
}
