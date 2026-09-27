/**
 * Melee swipes (§4.2 / §4.3): a short-lived arc hitbox (~110°, ~26 px, a few ticks) centred on its
 * owner. Strong damage + knockback, each target hit once per swipe, hostile enemy shots inside the
 * arc are destroyed, breakable props are cracked. Hits run the profile's hit hooks through a pseudo
 * shot (SK_SWIPE), so statuses, chain, split, explode… all work with melee. The crescent wave that
 * flies out of a melee volley is an ordinary projectile (carriers/melee.ts).
 *
 * Pooled (cap 16, `world.atk.swipes`), no allocation per tick.
 */

import type { Poolable } from '../../engine/pool';
import { SRC_PLAYER, type Hittable } from '../hittable';
import { hitTileWithShot } from '../tileFx';
import { shotBreakable } from '../tiles';
import { TILE } from '../constants';
import { ATTACK_TUNING } from '../tuning';
import type { World } from '../world';
import { queueExplosion } from './impacts';
import type { AttackProfile } from './profile';
import { runHitHooks } from './shot';
import { F_BOMB, OWN_PLAYER, SK_SWIPE, ShotState, type Anchor } from './state';
import type { ShotStyle } from './style';

const T = ATTACK_TUNING;
const HITS = 16;

export class Swipe implements Poolable {
  alive = false;
  slot = 0;
  anchor: Anchor | null = null;
  ownerKind = OWN_PLAYER;
  /** Centre (follows the anchor) and facing. */
  x = 0;
  y = 0;
  ang = 0;
  /** Half-arc (rad) and reach (px). */
  arc: number = T.meleeArc;
  reach: number = T.meleeReach;
  age = 0;
  life: number = T.meleeLife;
  dmg = 0;
  knock = 0;
  scale = 1;
  bomb = false;
  profile: AttackProfile | null = null;
  style: ShotStyle | null = null;
  readonly hit: (Hittable | null)[] = new Array<Hittable | null>(HITS).fill(null);
  nHit = 0;
  readonly cells = new Int16Array(8);
  nCells = 0;
}

export function spawnSwipe(
  w: World,
  profile: AttackProfile,
  anchor: Anchor | null,
  x: number,
  y: number,
  ang: number,
  reach: number,
  dmg: number,
  knock: number,
  scale: number,
  ownerKind: number,
): Swipe | null {
  const s = w.atk.swipes.alloc();
  if (!s) return null;
  s.anchor = anchor;
  s.ownerKind = ownerKind;
  s.x = anchor ? anchor.x : x;
  s.y = anchor ? anchor.y : y;
  s.ang = ang;
  s.arc = T.meleeArc;
  s.reach = reach;
  s.age = 0;
  s.life = T.meleeLife;
  s.dmg = dmg;
  s.knock = knock;
  s.scale = scale;
  s.bomb = profile.riderBomb > 0;
  s.profile = profile;
  s.style = profile.style;
  s.hit.fill(null);
  s.nHit = 0;
  s.nCells = 0;
  w.events.emit('swipe', s.x, s.y, Math.cos(ang), Math.sin(ang), ownerKind === OWN_PLAYER ? '' : 'mini');
  if (s.bomb) {
    // Bomb rider: the swipe's tip explodes.
    const r = (T.bombRadius + T.bombRadiusStack * Math.max(0, profile.riderBomb - 1)) * 0.8 * Math.sqrt(scale);
    queueExplosion(w, s.x + Math.cos(ang) * reach, s.y + Math.sin(ang) * reach, r, dmg * 0.8, true);
  }
  return s;
}

/** Pseudo shot handed to hit hooks. */
const P = new ShotState();

function inArc(s: Swipe, x: number, y: number, r: number): boolean {
  const dx = x - s.x;
  const dy = y - s.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > s.reach + r) return false;
  if (d < 8 + r) return true;
  let a = Math.atan2(dy, dx) - s.ang;
  a = Math.atan2(Math.sin(a), Math.cos(a));
  return Math.abs(a) <= s.arc + Math.asin(Math.min(1, r / d));
}

function strike(w: World, s: Swipe, h: Hittable): void {
  const dx = h.x - s.x;
  const dy = h.y - s.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const nx = d > 1e-6 ? dx / d : Math.cos(s.ang);
  const ny = d > 1e-6 ? dy / d : Math.sin(s.ang);
  h.hurt(s.dmg, SRC_PLAYER, nx * s.knock, ny * s.knock);
  w.events.emit('swipeHit', h.x, h.y - h.r, nx, ny, s.style?.body ?? '');
  const prof = s.profile;
  if (!prof || prof.hitHooks.length === 0) return;
  P.kind = SK_SWIPE;
  P.x = h.x - nx * h.r;
  P.y = h.y - ny * h.r;
  P.z = T.flyHeight;
  P.ang = Math.atan2(ny, nx);
  P.angOff = 0;
  P.speed = P.baseSpeed = prof.shotSpeed;
  P.vx = nx * P.speed;
  P.vy = ny * P.speed;
  P.damage = P.baseDamage = s.dmg;
  P.size = P.baseSize = prof.size;
  P.knock = s.knock;
  P.depth = 0;
  P.flags = s.bomb ? F_BOMB : 0;
  P.profile = prof;
  P.style = s.style;
  P.scale = s.scale;
  P.anchor = s.anchor;
  P.ownerKind = s.ownerKind;
  P.ax = s.x;
  P.ay = s.y;
  runHitHooks(w, P, h);
}

export function updateSwipes(w: World, dt: number): void {
  const pool = w.atk.swipes;
  const targets = w.atk.targets;
  for (let i = pool.count - 1; i >= 0; i--) {
    const s = pool.items[i]!;
    s.age += dt;
    if (s.age > s.life + 1e-6 || (s.anchor !== null && !s.anchor.alive)) {
      pool.release(s);
      continue;
    }
    if (s.anchor) {
      s.x = s.anchor.x;
      s.y = s.anchor.y;
    }
    for (let k = 0; k < targets.n; k++) {
      const h = targets.refs[k]!;
      if (!h.hittable || !inArc(s, h.x, h.y, h.r)) continue;
      let seen = false;
      for (let j = 0; j < s.nHit; j++) {
        if (s.hit[j] === h) {
          seen = true;
          break;
        }
      }
      if (seen || s.nHit >= HITS) continue;
      s.hit[s.nHit++] = h;
      strike(w, s, h);
    }
    // Swat hostile shots out of the air.
    const shots = w.enemyShots;
    for (let k = shots.count - 1; k >= 0; k--) {
      const e = shots.items[k]!;
      if (e.allied || e.lob || !inArc(s, e.x, e.y, e.r)) continue;
      w.events.emit('eshotPop', e.x, e.y, 1, e.style, '');
      shots.release(e);
    }
    // Crack breakable props in reach (once per swipe).
    const room = w.room;
    const r = s.reach + TILE / 2;
    const c0 = Math.max(0, Math.floor((s.x - r) / TILE));
    const c1 = Math.min(room.cols - 1, Math.floor((s.x + r) / TILE));
    const r0 = Math.max(0, Math.floor((s.y - r) / TILE));
    const r1 = Math.min(room.rows - 1, Math.floor((s.y + r) / TILE));
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (!shotBreakable(room.get(col, row))) continue;
        const cell = row * room.cols + col;
        if (!inArc(s, col * TILE + TILE / 2, row * TILE + TILE / 2, TILE / 2)) continue;
        let done = false;
        for (let j = 0; j < s.nCells; j++) if (s.cells[j] === cell) done = true;
        if (done || s.nCells >= s.cells.length) continue;
        s.cells[s.nCells++] = cell;
        hitTileWithShot(w, cell);
      }
    }
  }
}
