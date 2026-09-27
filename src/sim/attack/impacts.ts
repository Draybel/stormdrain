/**
 * What player attacks leave behind when they connect (used by the hit / expire modifiers and the bomb
 * rider): explosions (queued, merged and capped), damaging player puddles, split children and chain
 * lightning. Guardrails (§4.5) degrade gracefully and conserve damage: explosions over the live cap
 * wait and merge; split children that don't fit in the pool merge into fewer, stronger shots; chain
 * arcs over the per-tick cap add their damage to the hit that triggered them.
 */

import { damageArea } from '../combat';
import { spawnCreep } from '../enemies/shots';
import { SRC_PLAYER, type Hittable } from '../hittable';
import { pushPickups } from '../pickups';
import { ROOM_H, ROOM_W, TILE } from '../constants';
import { explodeTiles, hitTileWithShot } from '../tileFx';
import { shotBreakable } from '../tiles';
import { ENEMY_SHOT_STYLES } from '../types';
import { ATTACK_TUNING, BOMB_TUNING, ENEMY_TUNING } from '../tuning';
import type { World } from '../world';
import { allocShot, finishShot } from './shot';
import type { AttackProfile } from './profile';
import { F_BOMB, F_CHILD, F_MINI, F_PHASE, F_SIDELASER, MOD_INDEX, SK_BLADE, SK_BOMB, SK_CRESCENT, SK_MARBLE, rememberHit, type ShotState } from './state';

const T = ATTACK_TUNING;

// ── Explosions ─────────────────────────────────────────────────────────────

const EXPLODE = MOD_INDEX.explode;

/**
 * Bomb-rider blast radius (px, before the volley scale) and damage multiplier (× shot damage) of a
 * profile: the explode stack's bomb numbers (the rider's copies are implicit explode stacks, and
 * explode items stack on top), or the plain bomb numbers.
 */
export function bombBlastRadius(prof: AttackProfile): number {
  const st = prof.stacks[EXPLODE];
  return st ? st.v2 : T.bombRadius + T.bombRadiusStack * Math.max(0, prof.riderBomb - 1);
}

export function bombBlastMul(prof: AttackProfile): number {
  const st = prof.stacks[EXPLODE];
  return st ? st.v3 : T.bombDamage;
}

export class ExplosionQueue {
  readonly x = new Float64Array(T.explosionQueue);
  readonly y = new Float64Array(T.explosionQueue);
  readonly r = new Float64Array(T.explosionQueue);
  readonly dmg = new Float64Array(T.explosionQueue);
  readonly rocks = new Uint8Array(T.explosionQueue);
  n = 0;
  /** Times of the most recent explosions (ring) — the "live" count for the cap. */
  readonly recent = new Float64Array(T.capExplosionsLive).fill(-1e9);
  head = 0;
  clear(): void {
    this.n = 0;
    this.recent.fill(-1e9);
    this.head = 0;
  }
}

/**
 * Queues a player-owned explosion (never hurts the player). Processed at the end of the attack
 * update; a full queue merges the new blast into the nearest queued one (damage summed).
 */
export function queueExplosion(w: World, x: number, y: number, radius: number, dmg: number, breakRocks: boolean): void {
  const q = w.atk.explosions;
  if (q.n < q.x.length) {
    const i = q.n++;
    q.x[i] = x;
    q.y[i] = y;
    q.r[i] = radius;
    q.dmg[i] = dmg;
    q.rocks[i] = breakRocks ? 1 : 0;
    return;
  }
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < q.n; i++) {
    const dx = q.x[i]! - x;
    const dy = q.y[i]! - y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  q.dmg[best] = q.dmg[best]! + dmg;
  q.r[best] = Math.min(72, Math.max(q.r[best]!, radius) + 3);
  if (breakRocks) q.rocks[best] = 1;
}

/** How many explosions went off within the live window. */
export function liveExplosions(w: World): number {
  const q = w.atk.explosions;
  let n = 0;
  for (let i = 0; i < q.recent.length; i++) if (w.time - q.recent[i]! < T.explosionWindow) n++;
  return n;
}

/** Processes queued explosions within the per-tick and live caps (the rest wait a tick). */
export function flushExplosions(w: World): void {
  const q = w.atk.explosions;
  if (q.n === 0) return;
  // Merge queued blasts that overlap heavily (one big boom instead of five small ones).
  for (let i = 0; i < q.n; i++) {
    for (let j = q.n - 1; j > i; j--) {
      const dx = q.x[i]! - q.x[j]!;
      const dy = q.y[i]! - q.y[j]!;
      const rr = Math.min(q.r[i]!, q.r[j]!) * 0.5;
      if (dx * dx + dy * dy > rr * rr) continue;
      q.dmg[i] = q.dmg[i]! + q.dmg[j]!;
      q.r[i] = Math.min(72, Math.max(q.r[i]!, q.r[j]!) + 2);
      if (q.rocks[j]) q.rocks[i] = 1;
      removeAt(q, j);
    }
  }
  const room = Math.max(0, T.capExplosionsLive - liveExplosions(w));
  const n = Math.min(q.n, T.explosionsPerTick, room);
  for (let k = 0; k < n; k++) {
    playerExplosion(w, q.x[k]!, q.y[k]!, q.r[k]!, q.dmg[k]!, q.rocks[k] === 1);
    q.recent[q.head] = w.time;
    q.head = (q.head + 1) % q.recent.length;
  }
  // Shift the unprocessed ones to the front (they go off next tick).
  for (let k = n; k < q.n; k++) {
    const d = k - n;
    q.x[d] = q.x[k]!;
    q.y[d] = q.y[k]!;
    q.r[d] = q.r[k]!;
    q.dmg[d] = q.dmg[k]!;
    q.rocks[d] = q.rocks[k]!;
  }
  q.n -= n;
}

function removeAt(q: ExplosionQueue, j: number): void {
  const last = q.n - 1;
  q.x[j] = q.x[last]!;
  q.y[j] = q.y[last]!;
  q.r[j] = q.r[last]!;
  q.dmg[j] = q.dmg[last]!;
  q.rocks[j] = q.rocks[last]!;
  q.n = last;
}

/**
 * A player-owned blast: hurts enemies and dummies, cracks crates / urns / fires (and rocks for bomb
 * shots), shoves pickups, lights placed bombs. Never hurts the player.
 */
export function playerExplosion(w: World, x: number, y: number, radius: number, dmg: number, breakRocks: boolean): void {
  w.events.emit('explosion', x, y, radius, dmg, 'shot');
  damageArea(w, x, y, radius, dmg, 180, SRC_PLAYER);
  if (breakRocks) explodeTiles(w, x, y, radius * 0.55);
  else crackProps(w, x, y, radius * 0.5);
  pushPickups(w, x, y, radius * 1.3, 220);
  const bombs = w.bombs;
  for (let i = 0; i < bombs.count; i++) {
    const b = bombs.items[i]!;
    const dx = b.x - x;
    const dy = b.y - y;
    const rr = radius + b.r;
    if (dx * dx + dy * dy < rr * rr && b.fuse > BOMB_TUNING.chainFuse) b.fuse = BOMB_TUNING.chainFuse;
  }
}

/** Small blasts only crack shot-breakable props (crates, urns, fires) — rocks need bombs. */
function crackProps(w: World, x: number, y: number, r: number): void {
  const room = w.room;
  const c0 = Math.max(0, Math.floor((x - r) / TILE));
  const c1 = Math.min(room.cols - 1, Math.floor((x + r) / TILE));
  const r0 = Math.max(0, Math.floor((y - r) / TILE));
  const r1 = Math.min(room.rows - 1, Math.floor((y + r) / TILE));
  for (let row = r0; row <= r1; row++) {
    for (let col = c0; col <= c1; col++) {
      if (!shotBreakable(room.get(col, row))) continue;
      const cx = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
      const cy = Math.max(row * TILE, Math.min(y, (row + 1) * TILE));
      if ((cx - x) * (cx - x) + (cy - y) * (cy - y) < r * r) hitTileWithShot(w, row * room.cols + col);
    }
  }
}

// ── Puddles ────────────────────────────────────────────────────────────────

const WATER = ENEMY_SHOT_STYLES.indexOf('water');

/**
 * A damaging puddle on the player's side (allied creep: hurts enemies, never the player). A puddle
 * already close by is refreshed and grown instead (merging keeps the 48-puddle cap useful).
 */
export function spawnPlayerPuddle(w: World, x: number, y: number, r: number, life: number, dmgPerTick: number): void {
  const pool = w.creep;
  for (let i = 0; i < pool.count; i++) {
    const c = pool.items[i]!;
    if (!c.allied) continue;
    const dx = c.x - x;
    const dy = c.y - y;
    if (dx * dx + dy * dy < c.r * c.r) {
      c.life = c.maxLife = Math.max(c.life, life);
      c.r = Math.min(20, Math.max(c.r, r) + 0.5);
      c.dmg = Math.max(c.dmg, dmgPerTick);
      return;
    }
  }
  // Allied creep deals dmg × allyDamage × 0.5 per 0.5 s: convert from player damage.
  spawnCreep(w, x, y, r, life, dmgPerTick / (ENEMY_TUNING.allyDamage * 0.5), WATER, true);
}

// ── Split ──────────────────────────────────────────────────────────────────

/**
 * Splits a shot that hit `t` into `count` children fanned around its heading (half damage each,
 * smaller, one generation deeper). If the pool can't hold them all, fewer children carry the same
 * total damage; if none fit, the target takes that damage right away.
 */
export function splitShot(w: World, s: ShotState, t: Hittable, count: number): void {
  if (s.depth >= T.maxSplitDepth) return;
  const pool = w.projectiles;
  const room = Math.max(0, pool.free - T.poolReserve);
  const total = s.damage * 0.5 * count;
  const k = Math.min(count, room);
  if (k <= 0) {
    t.hurt(total, SRC_PLAYER, 0, 0);
    return;
  }
  const prof = s.profile!;
  const each = total / k;
  const grow = Math.sqrt(count / k);
  const th = s.ang + s.angOff;
  const fan = (100 * Math.PI) / 180;
  const kind = s.kind === SK_BLADE || s.kind === SK_CRESCENT || s.kind === SK_BOMB ? s.kind : SK_MARBLE;
  const off = t.r + 2;
  for (let j = 0; j < k; j++) {
    const c = allocShot(w);
    if (!c) break;
    const a = th + (k > 1 ? (j / (k - 1) - 0.5) * fan : 0);
    c.kind = kind;
    c.x = Math.max(1, Math.min(ROOM_W - 1, s.x + Math.cos(th) * off));
    c.y = Math.max(1, Math.min(ROOM_H - 1, s.y + Math.sin(th) * off));
    c.z = s.z > 0 ? s.z : T.flyHeight;
    c.ang = a;
    c.baseSpeed = c.speed = Math.max(60, s.baseSpeed * 0.9);
    c.baseDamage = each;
    c.baseSize = Math.max(1.5, s.baseSize * 0.75 * grow);
    c.range = prof.range * 0.5 * s.scale + 20;
    c.knock = s.knock * 0.6;
    c.flags = (s.flags & (F_PHASE | F_BOMB | F_MINI | F_SIDELASER)) | F_CHILD;
    c.depth = s.depth + 1;
    c.profile = prof;
    c.style = s.style;
    c.anchor = s.anchor;
    c.ownerKind = s.ownerKind;
    c.scale = s.scale;
    c.spin = j & 1 ? -1 : 1;
    c.vIndex = j;
    c.life = T.maxAge;
    c.rehit = T.rehitTicks;
    rememberHit(c, t, w.tick);
    finishShot(w, c);
  }
  w.events.emitFx('shotSplit', s.x, s.y, k, s.depth + 1, s.style?.body ?? '');
}

// ── Chain lightning ────────────────────────────────────────────────────────

const visited: (Hittable | null)[] = new Array<Hittable | null>(16).fill(null);

/**
 * Lightning jumps from `t` to up to `jumps` more targets within `range` (each hit once), dealing
 * `dmg` and re-applying the shot's status effects. Capped per tick; unspent arcs add their damage to
 * `t` instead (conserved).
 */
export function chainFrom(w: World, s: ShotState, t: Hittable, jumps: number, range: number, dmg: number): void {
  const a = w.atk;
  const targets = a.targets;
  let n = 0;
  visited[n++] = t;
  let cur: Hittable = t;
  for (let j = 0; j < jumps && n < visited.length; j++) {
    if (a.arcsThisTick >= T.capChainArcs) {
      // Over the cap: the remaining jumps' damage lands on the first target.
      t.hurt(dmg * (jumps - j) * 0.5, SRC_PLAYER, 0, 0);
      break;
    }
    let best: Hittable | null = null;
    let bestD = range;
    for (let i = 0; i < targets.n; i++) {
      const h = targets.refs[i]!;
      if (!h.hittable) continue;
      let seen = false;
      for (let v = 0; v < n; v++) {
        if (visited[v] === h) {
          seen = true;
          break;
        }
      }
      if (seen) continue;
      const dx = h.x - cur.x;
      const dy = h.y - cur.y;
      const d = Math.sqrt(dx * dx + dy * dy) - h.r;
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best === null) break;
    a.arcsThisTick++;
    w.events.emit('chainArc', cur.x, cur.y - cur.r * 0.6, best.x, best.y - best.r * 0.6, s.style?.body ?? '');
    const dx = best.x - cur.x;
    const dy = best.y - cur.y;
    const l = Math.sqrt(dx * dx + dy * dy);
    best.hurt(dmg, SRC_PLAYER, l > 1e-6 ? (dx / l) * 60 : 0, l > 1e-6 ? (dy / l) * 60 : 0);
    const st = s.profile?.statusHooks;
    if (st) for (let k = 0; k < st.length; k++) st[k]!.def.hit!(s, best, st[k]!.stack, w);
    visited[n++] = best;
    cur = best;
  }
  for (let v = 0; v < n; v++) visited[v] = null;
}
