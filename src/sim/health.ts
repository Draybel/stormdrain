/**
 * Health model (ARCHITECTURE §3). Everything is in HALF-HEART units.
 *
 * - `redMax` (containers × 2) and `red`.
 * - Bonus hearts stack after the red ones in the order gained:
 *     Tin   — shield hearts, absorb damage, gone when depleted.
 *     Ember — bonus hearts that release a fire nova when one is emptied.
 * - Damage order: the LAST gained bonus heart first, then the one before … then red. Damage spills
 *   over (a full-heart hit on half a Tin heart empties it and takes half a red heart).
 * - Cap: containers + bonus hearts ≤ HEART_CAP hearts (12, i.e. two HUD rows of 6).
 *
 * Pure data + functions, no world access: i-frames, events and the nova live in sim/combat.ts.
 */

export const BONUS_TIN = 1;
export const BONUS_EMBER = 2;
export type BonusKind = typeof BONUS_TIN | typeof BONUS_EMBER;

/** Max hearts (containers + bonus hearts). */
export const HEART_CAP = 12;

export class Health {
  /** Red capacity in half hearts (always even). */
  redMax = 0;
  red = 0;
  /** Bonus hearts in the order gained: kind and filled halves (1 or 2). */
  readonly bonusKind = new Uint8Array(HEART_CAP);
  readonly bonusHalves = new Uint8Array(HEART_CAP);
  bonusCount = 0;
}

export interface DamageResult {
  /** Half hearts actually removed. */
  taken: number;
  /** Ember hearts emptied by this hit (each releases a nova). */
  emberBroken: number;
  tinBroken: number;
  /** Half hearts taken from red. */
  redTaken: number;
  dead: boolean;
}

export function makeDamageResult(): DamageResult {
  return { taken: 0, emberBroken: 0, tinBroken: 0, redTaken: 0, dead: false };
}

export function containers(h: Health): number {
  return h.redMax >> 1;
}

/** Total bonus half hearts. */
export function bonusHalves(h: Health): number {
  let n = 0;
  for (let i = 0; i < h.bonusCount; i++) n += h.bonusHalves[i]!;
  return n;
}

export function bonusHalvesOf(h: Health, kind: BonusKind): number {
  let n = 0;
  for (let i = 0; i < h.bonusCount; i++) if (h.bonusKind[i] === kind) n += h.bonusHalves[i]!;
  return n;
}

/** Half hearts of any kind left. */
export function totalHalves(h: Health): number {
  return h.red + bonusHalves(h);
}

export function isDead(h: Health): boolean {
  return h.red <= 0 && bonusHalves(h) <= 0;
}

/** Room left for more hearts (containers or bonus hearts), in whole hearts. */
export function heartRoom(h: Health): number {
  return Math.max(0, HEART_CAP - containers(h) - h.bonusCount);
}

export function canHeal(h: Health): boolean {
  return h.red < h.redMax;
}

/** Heals red health; returns the half hearts actually restored. */
export function heal(h: Health, halves: number): number {
  if (halves <= 0) return 0;
  const before = h.red;
  h.red = Math.min(h.redMax, h.red + Math.floor(halves));
  return h.red - before;
}

/**
 * Adds (or removes, if negative) whole heart containers. Added containers are filled.
 * Returns the number of containers actually changed (signed).
 */
export function addContainers(h: Health, n: number): number {
  n = Math.trunc(n);
  if (n > 0) {
    const add = Math.min(n, heartRoom(h));
    h.redMax += add * 2;
    h.red += add * 2;
    return add;
  }
  if (n < 0) {
    const remove = Math.min(-n, containers(h));
    h.redMax -= remove * 2;
    if (h.red > h.redMax) h.red = h.redMax;
    return -remove;
  }
  return 0;
}

/** True if at least half a bonus heart of `kind` would fit. */
export function canAddBonus(h: Health, kind: BonusKind): boolean {
  const last = h.bonusCount - 1;
  if (last >= 0 && h.bonusKind[last] === kind && h.bonusHalves[last]! < 2) return true;
  return heartRoom(h) > 0;
}

/**
 * Adds bonus half hearts. Tops up the last heart if it is a half of the same kind, otherwise
 * starts new hearts while there is room. Returns the half hearts actually added.
 */
export function addBonus(h: Health, kind: BonusKind, halves: number): number {
  let added = 0;
  let left = Math.floor(halves);
  while (left > 0) {
    const last = h.bonusCount - 1;
    if (last >= 0 && h.bonusKind[last] === kind && h.bonusHalves[last]! < 2) {
      h.bonusHalves[last] = 2;
    } else if (heartRoom(h) > 0) {
      h.bonusKind[h.bonusCount] = kind;
      h.bonusHalves[h.bonusCount] = 1;
      h.bonusCount++;
    } else {
      break;
    }
    left--;
    added++;
  }
  return added;
}

/**
 * Applies `halves` of damage in the documented order (last bonus heart first, then red).
 * Writes the outcome into `out` (reused) and returns it.
 */
export function damageHealth(h: Health, halves: number, out: DamageResult): DamageResult {
  out.taken = 0;
  out.emberBroken = 0;
  out.tinBroken = 0;
  out.redTaken = 0;
  let left = Math.max(0, Math.floor(halves));
  while (left > 0 && h.bonusCount > 0) {
    const i = h.bonusCount - 1;
    const take = Math.min(left, h.bonusHalves[i]!);
    h.bonusHalves[i] = h.bonusHalves[i]! - take;
    left -= take;
    out.taken += take;
    if (h.bonusHalves[i] === 0) {
      if (h.bonusKind[i] === BONUS_EMBER) out.emberBroken++;
      else out.tinBroken++;
      h.bonusCount--;
    }
  }
  if (left > 0 && h.red > 0) {
    const take = Math.min(left, h.red);
    h.red -= take;
    out.taken += take;
    out.redTaken = take;
  }
  out.dead = isDead(h);
  return out;
}

/** Resets `h` from a character's HeartSpec-like numbers. */
export function initHealth(h: Health, redMax: number, red: number, tin: number, ember: number): void {
  h.redMax = Math.max(0, Math.min(HEART_CAP * 2, Math.floor(redMax / 2) * 2));
  h.red = Math.max(0, Math.min(h.redMax, red));
  h.bonusCount = 0;
  addBonus(h, BONUS_TIN, tin);
  addBonus(h, BONUS_EMBER, ember);
}

/** Compact text for summaries/tests, e.g. "R5/6 T2 E1" (bonus in stack order). */
export function describeHealth(h: Health): string {
  let s = `R${h.red}/${h.redMax}`;
  for (let i = 0; i < h.bonusCount; i++) s += ` ${h.bonusKind[i] === BONUS_EMBER ? 'E' : 'T'}${h.bonusHalves[i]}`;
  return s;
}
