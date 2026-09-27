/**
 * Damage in both directions: the player getting hurt (health order, i-frames, Ember novas,
 * death, the 'hurt' trigger) and area damage to hittables — enemies and training dummies
 * (explosions, novas, item hooks).
 */

import { damageDummy } from './dummies';
import { fireTrigger } from './effects';
import { damageHealth, makeDamageResult } from './health';
import { ST_CHARM, hasStatus } from './enemies/status';
import { SRC_BOMB, SRC_PLAYER } from './hittable';
import { ITEM_TUNING, PLAYER_TUNING } from './tuning';
import type { World } from './world';

/** Damage sources (GameEvent 'hurt' field b). */
export const DMG_GENERIC = 0;
export const DMG_SPIKES = 1;
export const DMG_FIRE = 2;
export const DMG_EXPLOSION = 3;
export const DMG_ENEMY = 4;

const result = makeDamageResult();

/**
 * Hurts the player by `halves` half hearts (bonus hearts first — see sim/health.ts). Ignored while
 * dead or invulnerable. Starts ~1 s of i-frames (the renderer flickers the sprite), releases a fire
 * nova for every Ember heart emptied, fires the 'hurt' trigger, and kills at zero health.
 * Returns true if any damage was taken.
 */
export function damagePlayer(w: World, halves: number, source = DMG_GENERIC, by = 0): boolean {
  const p = w.player;
  if (p.dead || halves <= 0 || p.invuln > 0 || w.godMode || w.safeT > 0) return false;
  damageHealth(p.health, halves, result);
  if (result.taken <= 0) return false;
  const emberBroken = result.emberBroken;
  const tinBroken = result.tinBroken;
  const dead = result.dead;
  p.hurtTimer = PLAYER_TUNING.hurtPose;
  p.invuln = PLAYER_TUNING.hurtInvuln;
  p.inv.version++;
  w.counters.hurts++;
  w.events.emit('hurt', p.x, p.y - 8, result.taken, source);
  if (tinBroken > 0) w.events.emit('heartBreak', p.x, p.y - 10, 1, tinBroken);
  for (let i = 0; i < emberBroken; i++) emberNova(w, p.x, p.y);
  if (dead) {
    w.killedBy = source;
    w.killer = by > 0 ? enemyIdByUid(w, by) : '';
    killPlayer(w);
    return true;
  }
  fireTrigger(w, 'hurt', p.x, p.y);
  return true;
}

export function killPlayer(w: World): void {
  const p = w.player;
  if (p.dead) return;
  p.dead = true;
  p.deathTime = 0;
  p.vx = p.vy = 0;
  w.events.emit('death', p.x, p.y - 8);
}

/**
 * The def id of the enemy with this uid — searched over the whole pool, released slots included (a shot's
 * owner may already be dead; its pooled object keeps the uid until the slot is reused). '' if not found.
 */
function enemyIdByUid(w: World, uid: number): string {
  const items = w.enemies.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i]!;
    if (e.uid === uid) return e.boss ? e.boss.def.id : (e.def?.id ?? '');
  }
  return '';
}

/** Debug/test hook (window.__SD.debug.hurt, Sim.hurtPlayer). */
export function hurtPlayer(w: World, halfHearts = 1): void {
  damagePlayer(w, halfHearts, DMG_GENERIC);
}

/**
 * Damages every hittable (enemies, standing dummies) whose circle overlaps (x, y, radius), knocked
 * away from the centre. Player-side area damage (bombs, novas, item blasts). Returns how many were hit.
 * Blasts from the player's own attacks (SRC_PLAYER: explode, the bomb rider) spare charmed enemies —
 * like every other player attack (they are left out of the attack target snapshot); placed bombs and
 * novas hurt everything in reach.
 */
export function damageArea(
  w: World,
  x: number,
  y: number,
  radius: number,
  damage: number,
  knock = 140,
  source: number = SRC_BOMB,
): number {
  let hits = 0;
  const pool = w.dummies;
  for (let i = 0; i < pool.count; i++) {
    const d = pool.items[i]!;
    if (d.popped) continue;
    const dx = d.x - x;
    const dy = d.y - y;
    const rr = radius + d.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const len = Math.sqrt(d2);
    const nx = len > 1e-6 ? dx / len : 0;
    const ny = len > 1e-6 ? dy / len : 1;
    damageDummy(w, d, damage, nx, ny, knock, source);
    hits++;
  }
  // Enemies killed here are only flagged dead (released by the next sweep), so the loop stays valid;
  // anything they spawn on death is appended and may be caught by this blast too.
  const enemies = w.enemies;
  const spareCharmed = source === SRC_PLAYER;
  for (let i = 0; i < enemies.count; i++) {
    const e = enemies.items[i]!;
    if (!e.hittable || (spareCharmed && hasStatus(e.status, ST_CHARM))) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const rr = radius + e.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    const len = Math.sqrt(d2);
    const nx = len > 1e-6 ? dx / len : 0;
    const ny = len > 1e-6 ? dy / len : 1;
    e.hurt(damage, source, nx * knock * 1.6, ny * knock * 1.6);
    hits++;
  }
  return hits;
}

/** An Ember heart broke: a ring of fire around (x, y). */
export function emberNova(w: World, x: number, y: number): void {
  w.events.emit('nova', x, y - 4, ITEM_TUNING.novaRadius, 0, 'ember');
  damageArea(w, x, y, ITEM_TUNING.novaRadius, ITEM_TUNING.novaDamage);
}
