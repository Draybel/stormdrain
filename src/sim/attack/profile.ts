/**
 * AttackProfile (§4.1): everything the player's items add up to for attacking, rebuilt ONLY when the
 * inventory changes (`buildAttackProfile`, called by recomputeAttack) — never per shot.
 *
 * - Carriers: held copies per carrier, the resolved primary (lance > laser > boomerang > melee >
 *   marble) and every other held carrier as a RIDER that merges into it (§4.2).
 * - Modifiers: one ModStack per held modifier (+ implicit stacks from riders / flags: the boomerang
 *   carrier and rider add `boomerang`, the bomb rider adds `explode`, the spectral flag adds `phase`),
 *   prepared once, and pre-sorted flat hook lists per stage.
 * - Numbers from the player's stats with the carrier's multipliers, and the composed ShotStyle.
 */

import { ATTACK_TUNING } from '../tuning';
import { CARRIER_IDS, type CarrierId, type ModId, type Stats } from '../types';
import type { Player } from '../player';
import { MODIFIERS } from './modifiers/index';
import { MOD_COUNT, MOD_INDEX, MOD_SLOTS, type ModEntry, type ModStack } from './state';
import { composeKeeperStyle, composeStyle, type ShotStyle } from './style';

const T = ATTACK_TUNING;

/** Charge modes. */
export const CM_NONE = 0;
/** Storm Lance: hold to charge, release at full charge = beam (partial = fizzle). */
export const CM_LANCE = 1;
/** Charge rider: hold to charge, release = volley × charge multiplier. */
export const CM_CHARGE = 2;

/** Primary precedence (§4.2). Riders only: 0. */
export const CARRIER_RANK: Readonly<Record<CarrierId, number>> = {
  lance: 5,
  laser: 4,
  boomerang: 3,
  melee: 2,
  marble: 1,
  bomb: 0,
  charge: 0,
  orbit: 0,
};

const CARRIER_INDEX: Readonly<Record<CarrierId, number>> = (() => {
  const m = {} as Record<CarrierId, number>;
  CARRIER_IDS.forEach((c, i) => (m[c] = i));
  return m;
})();

export class AttackProfile {
  /** Loadout version it was built from. */
  version = -1;
  primary: CarrierId = 'marble';
  /** Held copies per carrier (CARRIER_IDS order). The primary counts at least 1. */
  readonly carrierStacks = new Int32Array(CARRIER_IDS.length);
  /** The primary shoots beams (lance / laser). */
  beam = false;
  /** Rider stacks (0 = not a rider). */
  riderLaser = 0;
  riderBoomerang = 0;
  riderMelee = 0;
  riderBomb = 0;
  riderCharge = 0;
  riderOrbit = 0;
  riderMarble = 0;
  chargeMode = CM_NONE;

  /** ModStack per modifier index (null = not held). */
  readonly stacks: (ModStack | null)[] = new Array<ModStack | null>(MOD_COUNT).fill(null);
  readonly held: ModStack[] = [];
  spawnHooks: ModEntry[] = [];
  initHooks: ModEntry[] = [];
  motionHooks: ModEntry[] = [];
  hitHooks: ModEntry[] = [];
  /** Status-effect hit hooks (chain lightning re-applies these). */
  statusHooks: ModEntry[] = [];
  wallHooks: ModEntry[] = [];
  expireHooks: ModEntry[] = [];
  beamHooks: ModEntry[] = [];
  /** Split stacks (beam forks read it). */
  splitStacks = 0;

  // ── Numbers ──
  /** Damage per shot (before carrier multipliers). */
  damage = 3.5;
  fireRate = 3;
  /** Seconds between volleys (carrier-adjusted) at build time; the cadence uses `periodFor(stats)`. */
  period = 1 / 3;
  /** Carrier multiplier on the time between volleys (boomerang throws are slower, …). */
  periodMul = 1;
  shotSpeed = 190;
  range = 150;
  /** Projectile radius (px). */
  size = 3;
  knockback = 70;
  luck = 0;
  /** Everything passes through rocks (phase modifier / spectral flag). */
  phase = false;
  /** Seconds to a full charge (lance / charge rider). */
  chargeTime = 1;
  lanceWidth = 12;
  lanceLife = 0.5;
  /** Lance damage per damage tick. */
  lanceTick = 3.85;
  laserWidth = 3;
  laserLife = 0.12;
  laserDamage = 3.5;
  /** Orbit rider: blades around the player. */
  orbitCount = 0;
  /** Wren's mechanic (keeper marble) is available. */
  keeperMechanic = false;

  style!: ShotStyle;
  keeperStyle!: ShotStyle;

  /** Held copies of a carrier (the primary counts ≥ 1). */
  stacksOf(c: CarrierId): number {
    return this.carrierStacks[CARRIER_INDEX[c]]!;
  }

  /** Stacks of a modifier (0 = none). */
  mod(id: ModId): number {
    return this.stacks[MOD_INDEX[id]]?.stacks ?? 0;
  }
}

function addStack(p: AttackProfile, id: ModId, stacks: number, params: Readonly<Record<string, number>>): void {
  if (stacks <= 0) return;
  const idx = MOD_INDEX[id];
  const have = p.stacks[idx];
  if (have) {
    have.stacks += stacks;
    return;
  }
  const st: ModStack = { id, index: idx, stacks, params, v0: 0, v1: 0, v2: 0, v3: 0, slot: idx * MOD_SLOTS };
  p.stacks[idx] = st;
  p.held.push(st);
}

const NO_PARAMS: Readonly<Record<string, number>> = Object.freeze({});

/** Clamped charge time: base × refRate / fireRate. */
export function chargeTimeFor(base: number, fireRate: number, min: number, max: number): number {
  const t = (base * T.lanceRefRate) / Math.max(0.1, fireRate);
  return t < min ? min : t > max ? max : t;
}

export function buildAttackProfile(player: Player): AttackProfile {
  const p = new AttackProfile();
  const L = player.loadout;
  const s: Stats = player.stats;
  p.version = L.version;
  for (const [c, n] of L.carrierStacks) p.carrierStacks[CARRIER_INDEX[c]] += n;

  // Primary: the held carrier with the highest rank (marble by default).
  let primary: CarrierId = 'marble';
  for (const c of CARRIER_IDS) {
    if (p.carrierStacks[CARRIER_INDEX[c]]! > 0 && CARRIER_RANK[c] > CARRIER_RANK[primary]) primary = c;
  }
  p.primary = primary;
  const pi = CARRIER_INDEX[primary];
  if (p.carrierStacks[pi]! < 1) p.carrierStacks[pi] = 1;
  p.beam = primary === 'lance' || primary === 'laser';
  const rider = (c: CarrierId): number => (c === primary ? 0 : p.carrierStacks[CARRIER_INDEX[c]]!);
  p.riderLaser = rider('laser');
  p.riderBoomerang = rider('boomerang');
  p.riderMelee = rider('melee');
  p.riderBomb = rider('bomb');
  p.riderCharge = rider('charge');
  p.riderOrbit = rider('orbit');
  p.riderMarble = rider('marble');
  p.chargeMode = primary === 'lance' ? CM_LANCE : p.riderCharge > 0 ? CM_CHARGE : CM_NONE;

  // Modifiers (+ implicit stacks from carriers and flags).
  for (const [id, rec] of L.mods) addStack(p, id, rec.stacks, rec.params);
  if (primary === 'boomerang') addStack(p, 'boomerang', 1, NO_PARAMS);
  addStack(p, 'boomerang', p.riderBoomerang, NO_PARAMS);
  addStack(p, 'explode', p.riderBomb, NO_PARAMS);
  if (player.flags.spectral) addStack(p, 'phase', 1, NO_PARAMS);

  // Numbers.
  p.damage = s.damage;
  p.fireRate = s.fireRate;
  p.shotSpeed = s.shotSpeed;
  p.range = s.range;
  p.size = s.shotSize;
  p.knockback = s.knockback;
  p.luck = s.luck;
  p.periodMul = primary === 'boomerang' ? T.boomerangPeriod : primary === 'melee' ? T.meleePeriod : 1;
  p.period = p.periodMul / Math.max(0.1, s.fireRate);
  p.phase = p.mod('phase') > 0;
  p.splitStacks = p.mod('split');
  const sizeK = Math.sqrt(Math.max(0.5, s.shotSize) / 3);
  const lances = p.stacksOf('lance');
  p.lanceWidth = (T.lanceWidth + T.lanceStackWidth * Math.max(0, lances - 1)) * sizeK;
  p.lanceLife = T.lanceLife;
  p.lanceTick = s.damage * T.lanceDamage * (1 + T.lanceStackDamage * Math.max(0, lances - 1));
  const lasers = p.stacksOf('laser');
  p.laserWidth = (T.laserWidth + Math.max(0, lasers - 1)) * sizeK;
  p.laserLife = T.laserLife;
  p.laserDamage = s.damage * T.laserDamage * (1 + T.laserStackDamage * Math.max(0, lasers - 1));
  p.chargeTime =
    p.chargeMode === CM_LANCE
      ? chargeTimeFor(T.lanceCharge, s.fireRate, T.lanceChargeMin, T.lanceChargeMax)
      : chargeTimeFor(T.chargeTime, s.fireRate, 0.25, T.lanceChargeMax);
  p.orbitCount = p.riderOrbit > 0 ? Math.min(T.orbitMax, 1 + p.riderOrbit) : 0;
  p.keeperMechanic = player.character.mechanic === 'wren.luckyMarble';

  // Prepare stacks, then flat hook lists sorted by order.
  for (const st of p.held) MODIFIERS.get(st.id)!.prepare?.(st, p);
  const entries: ModEntry[] = p.held.map((st) => ({ def: MODIFIERS.get(st.id)!, stack: st }));
  entries.sort((a, b) => a.def.order - b.def.order || a.stack.index - b.stack.index);
  for (const e of entries) {
    const d = e.def;
    if (d.spawn) p.spawnHooks.push(e);
    if (d.initShot) p.initHooks.push(e);
    if (d.motion) p.motionHooks.push(e);
    if (d.hit) p.hitHooks.push(e);
    if (d.hit && d.status) p.statusHooks.push(e);
    if (d.wall) p.wallHooks.push(e);
    if (d.expire) p.expireHooks.push(e);
    if (d.beamTick) p.beamHooks.push(e);
  }

  p.style = composeStyle(p, player.character);
  p.keeperStyle = composeKeeperStyle(p.style);
  return p;
}
