/**
 * Character mechanics (DESIGN.md "Characters", CharacterDef.mechanic): the ONE unique rule each character
 * plays by, on top of what its data already gives (stats, hearts, start items, `innate` effects — a carrier,
 * a modifier, flags or familiars that can't be lost, added by recomputePlayer).
 *
 * The sim knows the mechanics by id (MECH_*); a content hook of the same name is registered for validation
 * (content/hooks/characters.ts), like Wren's keeper marble, which lives in the attack pipeline. Numbers come
 * from MECHANIC_TUNING (sim/tuning.ts), overridden per character by `mechanicParams`.
 *
 * - Pip, BURROW (`pip.burrow`): the dash input (DASH button / Shift) ducks underground for `time` s, moving
 *   fast in the stick's direction (else where Pip faces). Underground = untouchable: no damage of any kind,
 *   enemy shots, contact, creep and shockwaves pass over, spikes and fire don't bite; no firing. Cooldown from
 *   the dig-in; a short grace on surfacing. Rooms reset it (Pip surfaces on entry).
 * - Marrow, BONE TOSS (`marrow.boneToss`): data only — no red containers (tin hearts), the `noRedHearts` flag
 *   (red pickups and heals from items become Tin; heart containers from items become 2 Tin halves each,
 *   sim/effects.ts), the boomerang carrier innate.
 * - Juniper, FIREFLY JAR (`juniper.fireflyJar`): two innate fireflies; every room cleared adds a temporary one
 *   (up to `max` in all); a hit scares one temporary firefly off; a new floor empties the jar back to the two.
 * - Bolt, WIND-UP (`bolt.windUp`): the charge rider innate; the held active also recharges over time — a room
 *   of charge every `every` s (fractional charge, the HUD bar fills smoothly), timed actives `timedMul` × faster.
 * - Sable, PICKPOCKET (`sable.pickpocket`): the melee carrier and `haggler` innate; a hit of hers may knock a
 *   coin loose (`chance` + luck, capped), at most `perEnemy` coins per enemy (`bigMax` for bosses / big ones).
 * - Mosswick, BOG BLOOD (`mosswick.bogBlood`): the puddle modifier innate; standing in Mosswick's own puddles
 *   restores half a Tin heart every `every` s, up to `cap` Tin halves.
 *
 * Everything here is allocation-free per tick. The state that must survive a run save (Juniper's temporary
 * fireflies, timers) is in PlayerSnap.mech (sim/run/snapshot.ts).
 */

import type { InputState } from '../engine/inputState';
import { BONUS_TIN, addBonus, bonusHalvesOf } from './health';
import { SRC_PLAYER } from './hittable';
import { addCharge, isCharged } from './inventory';
import { PK } from './pickupKinds';
import { spawnLoot } from './pickups';
import { ENEMY_TUNING, MECHANIC_TUNING } from './tuning';
import type { CharacterDef } from './types';
import type { Enemy } from './enemies/enemy';
import type { Player } from './player';
import type { World } from './world';

export const MECH_WREN = 'wren.luckyMarble';
export const MECH_PIP = 'pip.burrow';
export const MECH_MARROW = 'marrow.boneToss';
export const MECH_JUNIPER = 'juniper.fireflyJar';
export const MECH_BOLT = 'bolt.windUp';
export const MECH_SABLE = 'sable.pickpocket';
export const MECH_MOSSWICK = 'mosswick.bogBlood';

/** Numeric mechanic kinds (Player.mech.kind). */
export const MK_NONE = 0;
export const MK_BURROW = 1;
export const MK_FIREFLIES = 2;
export const MK_WINDUP = 3;
export const MK_PICKPOCKET = 4;
export const MK_SOAK = 5;

/** 'mechanic' GameEvent codes (field a): what happened, for render / audio. */
export const ME_FIREFLY_JOIN = 0;
export const ME_FIREFLY_FLEE = 1;
export const ME_WOUND = 2;
export const ME_PICKPOCKET = 3;
export const ME_SOAK = 4;

/** The character has a dash (Pip's burrow): the run HUD shows the DASH button, Shift triggers it. */
export function characterDashes(c: CharacterDef): boolean {
  return c.mechanic === MECH_PIP;
}

/** The familiar Juniper's jar holds (content/familiars/characters.ts). */
export const FIREFLY_ID = 'firefly';

function kindOf(mechanic: string): number {
  switch (mechanic) {
    case MECH_PIP:
      return MK_BURROW;
    case MECH_JUNIPER:
      return MK_FIREFLIES;
    case MECH_BOLT:
      return MK_WINDUP;
    case MECH_SABLE:
      return MK_PICKPOCKET;
    case MECH_MOSSWICK:
      return MK_SOAK;
    default:
      return MK_NONE;
  }
}

/** A tuning number: the character's `mechanicParams[key]`, else the default. */
function param(c: CharacterDef, key: string, fallback: number): number {
  const v = c.mechanicParams?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const POCKET_SLOTS = 64;

/** Per-player mechanic state (numbers resolved once from the character; timers per run). */
export class MechanicState {
  readonly kind: number;
  // Burrow
  readonly dashTime: number;
  readonly dashSpeed: number;
  readonly dashCooldown: number;
  readonly surfaceGrace: number;
  /** Seconds left underground (> 0 = burrowed). */
  dashT = 0;
  /** Seconds until the next dig-in. */
  dashCd = 0;
  dashX = 0;
  dashY = 1;
  rumbleT = 0;
  // Fireflies
  readonly fliesMax: number;
  readonly fliesPerClear: number;
  /** Fireflies the character always has (its innate familiar count). */
  readonly fliesBase: number;
  /** Temporary fireflies (room clears add, hits and floors take away). Saved with the run. */
  flies = 0;
  // Wind-up
  readonly windEvery: number;
  readonly windTimedMul: number;
  // Pickpocket
  readonly pickChance: number;
  readonly pickLuck: number;
  readonly pickMax: number;
  readonly pickPerEnemy: number;
  readonly pickBig: number;
  readonly pickSilver: number;
  /** Coins already knocked loose per enemy uid (a small hash ring: uid & 63). */
  readonly pocketUid = new Int32Array(POCKET_SLOTS);
  readonly pocketN = new Uint8Array(POCKET_SLOTS);
  // Soak
  readonly soakEvery: number;
  readonly soakCap: number;
  /** Seconds spent in own puddles toward the next half Tin heart. Saved with the run. */
  soakT = 0;

  constructor(c: CharacterDef) {
    this.kind = kindOf(c.mechanic);
    const B = MECHANIC_TUNING.burrow;
    this.dashTime = param(c, 'time', B.time);
    this.dashSpeed = param(c, 'speed', B.speed);
    this.dashCooldown = param(c, 'cooldown', B.cooldown);
    this.surfaceGrace = param(c, 'surfaceGrace', B.surfaceGrace);
    const F = MECHANIC_TUNING.fireflies;
    this.fliesMax = param(c, 'max', F.max);
    this.fliesPerClear = param(c, 'perClear', F.perClear);
    let base = 0;
    for (const e of c.innate ?? []) if (e.type === 'familiar' && e.familiar === FIREFLY_ID) base += e.count ?? 1;
    this.fliesBase = base;
    const W = MECHANIC_TUNING.windUp;
    this.windEvery = Math.max(0.5, param(c, 'every', W.every));
    this.windTimedMul = param(c, 'timedMul', W.timedMul);
    const P = MECHANIC_TUNING.pickpocket;
    this.pickChance = param(c, 'chance', P.chance);
    this.pickLuck = param(c, 'luck', P.luck);
    this.pickMax = param(c, 'maxChance', P.maxChance);
    this.pickPerEnemy = param(c, 'perEnemy', P.perEnemy);
    this.pickBig = param(c, 'bigMax', P.bigMax);
    this.pickSilver = param(c, 'silver', P.silver);
    const S = MECHANIC_TUNING.soak;
    this.soakEvery = Math.max(0.25, param(c, 'soakEvery', S.every));
    this.soakCap = param(c, 'cap', S.cap);
  }

  /** Pip is underground (untouchable, not firing). */
  get underground(): boolean {
    return this.dashT > 0;
  }

  /** A new room: Pip surfaces (the cooldown keeps running). */
  resetRoom(): void {
    this.dashT = 0;
    this.rumbleT = 0;
  }
}

// ── Per tick (from updatePlayer, before movement) ─────────────────────────────

/**
 * The tick's mechanic work: Pip's dig-in / tunnelling / surfacing, Bolt's wind-up, Mosswick's soak. Returns
 * true while Pip is underground (updatePlayer then steers the dash and skips firing).
 */
export function updateMechanic(w: World, input: InputState, dt: number): boolean {
  const p = w.player;
  const m = p.mech;
  switch (m.kind) {
    case MK_BURROW:
      return updateBurrow(w, p, m, input, dt);
    case MK_WINDUP:
      windUp(w, p, m, dt);
      return false;
    case MK_SOAK:
      soak(w, p, m, dt);
      return false;
    default:
      return false;
  }
}

function updateBurrow(w: World, p: Player, m: MechanicState, input: InputState, dt: number): boolean {
  if (m.dashCd > 0) m.dashCd = Math.max(0, m.dashCd - dt);
  if (m.dashT > 0) {
    m.dashT -= dt;
    m.rumbleT -= dt;
    if (m.dashT <= 0) {
      m.dashT = 0;
      // Surfacing: a puff of dirt and a blink of grace so a shot in the way doesn't land on the same tick.
      p.invuln = Math.max(p.invuln, m.surfaceGrace);
      w.events.emit('burrow', p.x, p.y, 2, 6, 'pip');
      return false;
    }
    if (m.rumbleT <= 0) {
      m.rumbleT = MECHANIC_TUNING.burrow.rumbleEvery;
      w.events.emit('burrow', p.x, p.y, 1, 4, 'pip');
    }
    return true;
  }
  if (!input.dash || m.dashCd > 0 || p.dead) return false;
  // Dig in: along the stick, else the way Pip faces.
  let dx = input.moveX;
  let dy = input.moveY;
  if (p.flags.confused) {
    dx = -dx;
    dy = -dy;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len > 0.3) {
    dx /= len;
    dy /= len;
  } else {
    dx = p.faceX;
    dy = p.faceY;
    if (dx === 0 && dy === 0) dy = 1;
  }
  m.dashX = dx;
  m.dashY = dy;
  m.dashT = m.dashTime;
  m.dashCd = m.dashCooldown;
  m.rumbleT = MECHANIC_TUNING.burrow.rumbleEvery;
  w.events.emit('burrow', p.x, p.y, 0, 6, 'pip');
  return true;
}

/** Bolt: the held active winds itself up over time (as well as per room). */
function windUp(w: World, p: Player, m: MechanicState, dt: number): void {
  const slot = p.inv.active;
  if (!slot || p.dead || slot.max <= 0 || isCharged(slot)) return;
  // Timed actives already charge by the second (sim/effects.ts): Bolt adds the extra.
  const amount = slot.timed ? dt * (m.windTimedMul - 1) : dt / m.windEvery;
  if (amount <= 0) return;
  const before = Math.floor(slot.charge);
  addCharge(slot, amount);
  if (isCharged(slot)) {
    p.inv.version++;
    w.events.emit('charged', p.x, p.y - 16, 0, 0, slot.id);
  } else if (!slot.timed && Math.floor(slot.charge) > before) {
    // A whole room of charge wound up: the key turns (a click, sparks).
    p.inv.version++;
    w.events.emit('mechanic', p.x, p.y - 10, ME_WOUND, 0, p.character.id);
  }
}

/** Mosswick: standing in an own (allied) puddle soaks up Tin hearts, slowly. */
function soak(w: World, p: Player, m: MechanicState, dt: number): void {
  if (p.dead || p.flags.flying || bonusHalvesOf(p.health, BONUS_TIN) >= m.soakCap) return;
  const pool = w.creep;
  let wet = false;
  for (let i = 0; i < pool.count; i++) {
    const c = pool.items[i]!;
    if (!c.allied) continue;
    // Puddles are flat ellipses (half as tall as wide), as creep damage checks them.
    const dx = p.x - c.x;
    const dy = (p.y - c.y) * 2;
    const rr = c.r + p.r * 0.4;
    if (dx * dx + dy * dy < rr * rr) {
      wet = true;
      break;
    }
  }
  if (!wet) return;
  m.soakT += dt;
  if (m.soakT < m.soakEvery) return;
  m.soakT -= m.soakEvery;
  // Tops up a half Tin heart, or starts a new one while the hearts aren't capped.
  if (addBonus(p.health, BONUS_TIN, 1) > 0) {
    p.inv.version++;
    w.events.emit('heal', p.x, p.y - 12, 1, 1);
    w.events.emit('mechanic', p.x, p.y - 8, ME_SOAK, 0, p.character.id);
  }
}

// ── Moments (called by effects / combat / enemies) ────────────────────────────

/** A room was cleared. Returns true when the loadout changed (the caller recomputes). */
export function mechanicRoomClear(w: World): boolean {
  const p = w.player;
  const m = p.mech;
  if (m.kind !== MK_FIREFLIES || p.dead) return false;
  const room = Math.max(0, m.fliesMax - m.fliesBase - m.flies);
  const add = Math.min(room, Math.max(0, Math.floor(m.fliesPerClear)));
  if (add <= 0) return false;
  m.flies += add;
  w.events.emit('mechanic', p.x, p.y - 12, ME_FIREFLY_JOIN, m.flies, p.character.id);
  return true;
}

/** The player took a hit (and lives). Returns true when the loadout changed. */
export function mechanicHurt(w: World): boolean {
  const p = w.player;
  const m = p.mech;
  if (m.kind !== MK_FIREFLIES || m.flies <= 0) return false;
  m.flies--;
  w.events.emit('mechanic', p.x, p.y - 12, ME_FIREFLY_FLEE, m.flies, p.character.id);
  return true;
}

/** A new floor began. Returns true when the loadout changed. */
export function mechanicFloorStart(w: World): boolean {
  const m = w.player.mech;
  if (m.kind !== MK_FIREFLIES || m.flies <= 0) return false;
  m.flies = 0;
  return true;
}

/** Extra familiars the mechanic adds to the loadout right now (Juniper's temporary fireflies). */
export function mechanicFamiliars(p: Player): number {
  return p.mech.kind === MK_FIREFLIES ? p.mech.flies : 0;
}

/**
 * An enemy took a hit that landed (enemies/damage.ts). Sable's pickpocket: a player hit may knock a coin loose
 * (combatRng roll; the coin itself pops out on the loot stream like any drop).
 */
export function mechanicEnemyHit(w: World, e: Enemy, source: number): void {
  const p = w.player;
  const m = p.mech;
  if (m.kind !== MK_PICKPOCKET || source !== SRC_PLAYER || p.dead) return;
  const slot = pocketSlot(w, m, e.uid);
  const big = e.boss !== null || (e.def.big ?? e.r >= ENEMY_TUNING.bigRadius);
  if (m.pocketN[slot]! >= (big ? m.pickBig : m.pickPerEnemy)) return;
  const chance = Math.min(m.pickMax, Math.max(0, m.pickChance + p.stats.luck * m.pickLuck));
  if (w.combatRng.next() >= chance) return;
  m.pocketN[slot] = m.pocketN[slot]! + 1;
  const silver = w.combatRng.next() < m.pickSilver;
  spawnLoot(w, silver ? PK.SilverCoin : PK.Coin, undefined, e.x, e.y - 2);
  w.events.emit('mechanic', e.x, e.y - e.r - 4, ME_PICKPOCKET, silver ? 5 : 1, p.character.id);
}

/**
 * Sable's per-enemy coin count lives in a small open-addressed table keyed by enemy uid (no Enemy field):
 * the uid's own slot, else the next ones. A slot is reused only when its enemy is gone — two live enemies
 * whose uids share a slot (uids 64 apart: a boss and its 64th add) keep separate counts, so a boss never
 * yields more than its three coins. At most 64 enemies live at once, so a slot is always free for a new one.
 */
function pocketSlot(w: World, m: MechanicState, uid: number): number {
  const mask = POCKET_SLOTS - 1;
  let reuse = -1;
  for (let k = 0; k < POCKET_SLOTS; k++) {
    const s = (uid + k) & mask;
    const owner = m.pocketUid[s]!;
    if (owner === uid) return s;
    if (owner === 0) {
      if (reuse < 0) reuse = s;
      break;
    }
    if (reuse < 0 && !enemyLive(w, owner)) reuse = s;
  }
  // (Unreachable with ≤ 64 live enemies; fall back to the uid's own slot.)
  if (reuse < 0) reuse = uid & mask;
  m.pocketUid[reuse] = uid;
  m.pocketN[reuse] = 0;
  return reuse;
}

/** Is the enemy with this uid still in the room (alive, not yet swept)? */
function enemyLive(w: World, uid: number): boolean {
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.items[i]!;
    if (e.uid === uid && !e.dead) return true;
  }
  return false;
}

// ── Save / restore ─────────────────────────────────────────────────────────────

/** The mechanic state a run save keeps (PlayerSnap.mech). */
export interface MechanicSnap {
  flies: number;
  soakT: number;
  dashCd: number;
}

export function captureMechanic(p: Player): MechanicSnap {
  const m = p.mech;
  return { flies: m.flies, soakT: m.soakT, dashCd: m.dashCd };
}

export function restoreMechanic(p: Player, s: MechanicSnap | undefined): void {
  const m = p.mech;
  m.flies = Math.max(0, Math.floor(s?.flies ?? 0));
  m.soakT = s?.soakT ?? 0;
  m.dashCd = s?.dashCd ?? 0;
  m.dashT = 0;
  m.rumbleT = 0;
}
