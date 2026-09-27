/**
 * Hurting, killing and status-effecting enemies (the Enemy side of the Hittable interface).
 * Kills: 'enemyKilled' event (bestiary + death burst), on-death effects, champion extras, a frozen
 * enemy shatters into allied ice shards, loot, and the player's 'kill' trigger.
 */

import { allChampions } from '../../content/registry';
import { bossDamage, bossLethal } from '../bosses/damage';
import { fireTrigger } from '../effects';
import { SRC_STATUS, creditsPlayer } from '../hittable';
import { PK } from '../pickupKinds';
import { spawnDrops, spawnLoot } from '../pickups';
import { ENEMY_TUNING, STATUS_TUNING } from '../tuning';
import type { StatusKind } from '../types';
import type { World } from '../world';
import { shotStyleIndex } from './behaviors/index';
import { deathRing, splitInto } from './behaviors/death';
import type { Enemy } from './enemy';
import { spawnEnemyShot } from './shots';
import { ST_CHARM, ST_FREEZE, ST_KNOCKBACK, addStatus, hasStatus, statusIndex } from './status';

/** Flags in the 'enemyKilled' event (field b). */
export const KILL_FROZEN = 1;
export const KILL_CHAMPION = 2;
export const KILL_BIG = 4;

const ICE = shotStyleIndex('ice', undefined);
const INK = shotStyleIndex('ink', undefined);

function addKnock(e: Enemy, kx: number, ky: number): void {
  if (e.pinned || e.z > 0) return;
  e.kx += kx / e.mass;
  e.ky += ky / e.mass;
  const max = ENEMY_TUNING.maxKnock;
  const s2 = e.kx * e.kx + e.ky * e.ky;
  if (s2 > max * max) {
    const k = max / Math.sqrt(s2);
    e.kx *= k;
    e.ky *= k;
  }
}

/**
 * Damages an enemy (knockback impulse kx, ky in px/s, divided by its mass). Returns true if the hit
 * landed. `source`: SRC_* (sim/hittable.ts).
 */
export function damageEnemy(w: World, e: Enemy, dmg: number, source: number, kx: number, ky: number): boolean {
  if (!e.hittable) return false;
  const k2 = kx * kx + ky * ky;
  if (k2 > 1e-6) {
    const k = Math.sqrt(k2);
    e.lastHitX = kx / k;
    e.lastHitY = ky / k;
    addKnock(e, kx, ky);
  }
  if (!(dmg > 0)) return true;
  if (e.boss !== null) {
    // Phase changes absorb hits; one blow never skips a phase.
    dmg = bossDamage(w, e, dmg);
    if (!(dmg > 0)) return true;
  }
  e.hp -= dmg;
  e.hurtT = 0;
  // Damage over time ticks don't flash (the status tint + particles show it).
  if (source !== SRC_STATUS) e.flash = ENEMY_TUNING.hitFlash;
  w.counters.hits++;
  w.events.emit('enemyHit', e.x, e.y - e.r, dmg, source, e.def.id);
  if (e.hp <= 0) {
    // The last part of a boss plays its death sequence first (sim/bosses/brain.ts kills it after).
    if (e.boss !== null && bossLethal(w, e)) return true;
    killEnemy(w, e, source);
  }
  return true;
}

/** Kills an enemy (idempotent). */
export function killEnemy(w: World, e: Enemy, source: number): void {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  const frozen = hasStatus(e.status, ST_FREEZE);
  const big = e.def.big ?? e.r >= ENEMY_TUNING.bigRadius;
  const ch = e.champion;
  const flags = (frozen ? KILL_FROZEN : 0) | (ch ? KILL_CHAMPION : 0) | (big ? KILL_BIG : 0);
  w.counters.kills++;
  w.events.emit('enemyKilled', e.x, e.y, e.r, flags, e.def.id);

  const deaths = e.cfg.deaths;
  for (let i = 0; i < deaths.length; i++) deaths[i]!.beh.run(w, e, deaths[i]!, frozen);

  if (frozen) {
    // Shatters into ice shards that fly outward and hurt other enemies.
    const T = ENEMY_TUNING;
    const n = T.shatterShards;
    const off = w.combatRng.next() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * Math.PI * 2;
      spawnEnemyShot(w, e.x, e.y, Math.cos(a) * T.shardSpeed, Math.sin(a) * T.shardSpeed, T.shardDamage / T.allyDamage, 2.5, ICE, true, e.uid);
    }
  }

  if (ch) {
    if (ch.split && !frozen && e.gen === 0) splitInto(w, e, e.scale * 0.6, e.maxHp * 0.35, ch.split);
    if (ch.deathRing) deathRing(w, e, ch.deathRing, 85, 1, 3, INK);
    if (ch.coins) {
      const n = w.lootRng.int(ch.coins[0], ch.coins[1]);
      for (let i = 0; i < n; i++) spawnLoot(w, PK.Coin, undefined, e.x, e.y);
      if (n > 0) w.events.emit('loot', e.x, e.y, n);
    }
    if (ch.drops) spawnDrops(w, ch.drops, e.x, e.y);
  }
  if (e.def.drops) spawnDrops(w, e.def.drops, e.x, e.y);
  if (creditsPlayer(source)) fireTrigger(w, 'kill', e.x, e.y);
}

/** Applies a status (or a knockback impulse along the last hit direction) with the stacking rules. */
export function applyEnemyStatus(w: World, e: Enemy, kind: StatusKind, duration: number, power: number, source: number): void {
  if (!e.hittable) return;
  const idx = statusIndex(kind);
  if (idx === ST_KNOCKBACK) {
    const f = power > 0 ? power : STATUS_TUNING.knockPower;
    addKnock(e, e.lastHitX * f, e.lastHitY * f);
    if (duration > 0 && !e.pinned) e.stun = Math.max(e.stun, Math.min(1, duration * e.resist));
    return;
  }
  const before = e.status.mask;
  const applied = addStatus(e.status, idx, duration, power, source, e.resist);
  if (applied < 0) return;
  if ((before & (1 << applied)) === 0) {
    w.events.emit('status', e.x, e.y - e.r - 4, applied, source, e.def.id);
    // Switching sides or freezing solid drops whatever it was about to do.
    if (applied === ST_CHARM || applied === ST_FREEZE) {
      e.windAtk = -1;
      e.burstLeft = 0;
      e.teleT = 0;
    }
  }
}

/** Champion index + 1 of an enemy (0 = none) — for events and the summary. */
export function championCode(e: Enemy): number {
  return e.champion ? allChampions().indexOf(e.champion) + 1 : 0;
}
