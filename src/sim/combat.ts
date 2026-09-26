/**
 * Damage in both directions: the player getting hurt (health order, i-frames, Ember novas,
 * death, the 'hurt' trigger) and area damage to hittables (explosions, novas, item hooks).
 * Hittables are the training dummies today; enemies join `damageArea` when they exist.
 */

import { damageDummy } from './dummies';
import { fireTrigger } from './effects';
import { damageHealth, makeDamageResult } from './health';
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
export function damagePlayer(w: World, halves: number, source = DMG_GENERIC): boolean {
  const p = w.player;
  if (p.dead || halves <= 0 || p.invuln > 0) return false;
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

/** Debug/test hook (window.__SD.debug.hurt, Sim.hurtPlayer). */
export function hurtPlayer(w: World, halfHearts = 1): void {
  damagePlayer(w, halfHearts, DMG_GENERIC);
}

/**
 * Damages every hittable whose circle overlaps (x, y, radius), knocked away from the centre.
 * Returns how many were hit.
 */
export function damageArea(w: World, x: number, y: number, radius: number, damage: number, knock = 140): number {
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
    damageDummy(w, d, damage, nx, ny, knock);
    hits++;
  }
  return hits;
}

/** An Ember heart broke: a ring of fire around (x, y). */
export function emberNova(w: World, x: number, y: number): void {
  w.events.emit('nova', x, y - 4, ITEM_TUNING.novaRadius, 0, 'ember');
  damageArea(w, x, y, ITEM_TUNING.novaRadius, ITEM_TUNING.novaDamage);
}
