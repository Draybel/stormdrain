/**
 * The enemy entity (pooled, cap CAP_ENEMIES). Everything an enemy does comes from its EnemyDef:
 * a movement behaviour + attack behaviours + on-death effects from the shared library
 * (sim/enemies/behaviors), compiled once per def (numeric params resolved with defaults).
 *
 * Enemies are Hittables: `hurt(dmg, source, kx, ky)` / `applyStatus(kind, duration, power, source)`.
 * A killed enemy is only flagged `dead` (it stops being hittable at once) and is released from the
 * pool by the next sweep, so killing things while iterating the pool is always safe.
 */

import type { Poolable } from '../../engine/pool';
import { HIT_ENEMY, type Hittable } from '../hittable';
import type { ChampionDef, EnemyDef, SpriteDef, StatusKind } from '../types';
import type { World } from '../world';
import type { CompiledAttack, CompiledEnemy } from './behaviors/common';
import { applyEnemyStatus, damageEnemy } from './damage';
import { StatusSet } from './status';

/** Attack slots per enemy (content validation enforces it). */
export const MAX_ATTACKS = 4;

export class Enemy implements Poolable, Hittable {
  alive = false;
  slot = 0;
  readonly hitKind = HIT_ENEMY;
  readonly w: World;
  def!: EnemyDef;
  cfg!: CompiledEnemy;
  /** Resolved sprite (null while the def uses a placeholder string). */
  sprite: SpriteDef | null = null;
  /** Unique serial within the world (targeting, minion ownership). */
  uid = 0;
  /** Killed: no longer hittable / active; released by the next sweep. */
  dead = false;

  // ── Body ─────────────────────────────────────────────────────────────────
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  /** Height above the ground (hop arcs); flyers keep 0 (their hover is cosmetic). */
  z = 0;
  prevZ = 0;
  /** Self-propelled velocity, and the velocity the behaviour wants this tick. */
  vx = 0;
  vy = 0;
  tvx = 0;
  tvy = 0;
  /** Set by a behaviour: take (tvx, tvy) exactly this tick (dashes, hops) instead of accelerating. */
  snap = false;
  /** Knockback velocity (decays). */
  kx = 0;
  ky = 0;
  /** Separation push for this tick (px). */
  sepX = 0;
  sepY = 0;
  r = 6;
  /** Sprite scale (split children and big champions). */
  scale = 1;
  hp = 1;
  maxHp = 1;
  mass = 1;
  /** Walking speed after champion modifiers (statuses apply per tick). */
  speed = 0;
  /** Attack cooldown multiplier (champions). */
  cdMul = 1;
  /** Status duration multiplier (bosses < 1). */
  resist = 1;
  flying = false;
  /** Ignores knockback and separation (turrets, wall crawlers). */
  pinned = false;
  /** Positions itself (wall crawlers): no grid collision. */
  noCollide = false;
  /** Collision this tick pushed against its motion: normal of the push. */
  blocked = false;
  wallNX = 0;
  wallNY = 0;

  // ── Identity / variants ──────────────────────────────────────────────────
  champion: ChampionDef | null = null;
  /** Split generation (0 = original). */
  gen = 0;
  /** uid of the enemy that spawned it (minions), 0 = none. */
  parent = 0;

  // ── Behaviour state ──────────────────────────────────────────────────────
  /** Seconds of spawn protection left (inactive, harmless). */
  spawnT = 0;
  age = 0;
  mode = 0;
  modeT = 0;
  /** Behaviour target point (hop landing, wander goal, teleport destination…). */
  tx = 0;
  ty = 0;
  /** Locked direction (dash) / last heading. */
  dirX = 0;
  dirY = 1;
  /** Behaviour scratch slots. */
  m0 = 0;
  m1 = 0;
  m2 = 0;
  m3 = 0;
  /** Current target (the player, or the nearest hostile enemy when charmed). */
  tgtX = 0;
  tgtY = 0;
  hasTgt = false;
  /** The target is the player (not an enemy picked while charmed). */
  tgtPlayer = false;
  /** Seconds until each attack may be used again. */
  readonly atkT = new Float32Array(MAX_ATTACKS);
  /** Attack being telegraphed (-1 = none) and its wind-up timer. */
  windAtk = -1;
  windT = 0;
  /** Any telegraph (attack wind-up, hop crouch, dash wind-up, rising burrower…): seconds left / total. */
  teleT = 0;
  teleMax = 0;
  /** Burst attack in progress: shots left, timer, the attack. */
  burstLeft = 0;
  burstT = 0;
  burstA: CompiledAttack | null = null;
  /** Volleys fired (alternating patterns). */
  volleys = 0;
  /** Underground (burrowers): not hittable, harmless, drawn as a mound. */
  burrowed = false;
  /** Blinking (teleporters mid-jump): not hittable, harmless. */
  hidden = false;
  /** Phantom champions in their faded phase: not hittable, harmless. */
  faded = false;
  /** Dazed after a dash bonk / knockback status (s). */
  stun = 0;

  // ── Feedback ─────────────────────────────────────────────────────────────
  flash = 0;
  /** Seconds since the last hit (regrow delay, render squash). */
  hurtT = 9;
  /** 1 = facing right, -1 = left. */
  face = 1;
  moving = false;
  readonly status = new StatusSet();
  /** Direction of the last hit (knockback status). */
  lastHitX = 0;
  lastHitY = 1;
  /** Charmed contact / allied creep damage cooldown (s). */
  allyT = 0;
  /** Last allied shockwave that hit it (each wave hits once). */
  waveId = 0;

  constructor(w: World) {
    this.w = w;
  }

  /** Harmless and untouchable right now (underground, blinking, faded)? */
  get intangible(): boolean {
    return this.burrowed || this.hidden || this.faded;
  }

  get hittable(): boolean {
    return this.alive && !this.dead && !this.burrowed && !this.hidden && !this.faded;
  }

  hurt(dmg: number, source: number, kx: number, ky: number): boolean {
    return damageEnemy(this.w, this, dmg, source, kx, ky);
  }

  applyStatus(kind: StatusKind, duration: number, power: number, source: number): void {
    applyEnemyStatus(this.w, this, kind, duration, power, source);
  }
}
