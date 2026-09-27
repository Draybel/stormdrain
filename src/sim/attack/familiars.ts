/**
 * Familiars (FamiliarDef data in src/content/familiars): little helpers that follow the player.
 * - follow / hover: a follower CHAIN trailing the player along her recent path (breadcrumbs);
 * - orbit / guard: circle the player and swat enemy shots;
 * - chase: run at the nearest enemy (contact damage), come back when there is none.
 * Shooters (`attackScale` > 0) fire through fireVolley with the PLAYER'S profile at their scale, so
 * they inherit every carrier and modifier: a familiar with the Storm Lance charges with you and fires
 * its own smaller beam when you release.
 *
 * Stable slots (cap 12) so anchors stay valid; synced from the loadout on every tick (cheap).
 */

import { findFamiliar } from '../../content/registry';
import { ROOM_H, ROOM_W } from '../constants';
import { SRC_PLAYER } from '../hittable';
import { ATTACK_TUNING } from '../tuning';
import type { FamiliarDef } from '../types';
import type { World } from '../world';
import { copySource, fireVolley } from './fire';
import { AttackSource, OWN_FAMILIAR } from './state';
import { nearestTarget } from './targets';

const T = ATTACK_TUNING;
const TRAIL = 128;

export class Familiar {
  alive = false;
  /** Stable slot index. */
  readonly index: number;
  def: FamiliarDef | null = null;
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  age = 0;
  /** Seconds until it may fire again. */
  cooldown = 0;
  /** Position in the follower chain / around the orbit. */
  order = 0;
  orbitA = 0;
  /** Contact damage cooldown (s). */
  touchT = 0;
  /** 1 = facing right, -1 = left. */
  face = 1;
  readonly src = new AttackSource();

  constructor(index: number) {
    this.index = index;
    this.src.ownerKind = OWN_FAMILIAR;
    this.src.mini = true;
    this.src.quiet = true;
    this.src.anchor = this;
  }
}

export class Familiars {
  readonly list: Familiar[] = [];
  /** The player's recent path (breadcrumbs, newest at `head`). */
  readonly tx = new Float64Array(TRAIL);
  readonly ty = new Float64Array(TRAIL);
  head = 0;
  size = 0;
  /** Loadout version the familiars were synced to. */
  synced = -1;

  constructor() {
    for (let i = 0; i < T.familiarMax; i++) this.list.push(new Familiar(i));
  }

  count(): number {
    let n = 0;
    for (const f of this.list) if (f.alive) n++;
    return n;
  }

  resetTrail(x: number, y: number): void {
    this.head = 0;
    this.size = 1;
    this.tx[0] = x;
    this.ty[0] = y;
  }
}

/** Matches live familiars to the loadout's familiar counts (keeps existing ones, spawns / removes the difference). */
export function syncFamiliars(w: World): void {
  const fam = w.atk.familiars;
  const L = w.player.loadout;
  if (fam.synced === L.version) return;
  fam.synced = L.version;
  const list = fam.list;
  // Mark everything unclaimed, then claim per def.
  const claimed = claimedScratch;
  claimed.fill(0);
  for (const [id, want] of L.familiars) {
    const def = findFamiliar(id);
    if (!def) continue;
    let have = 0;
    for (const f of list) {
      if (f.alive && f.def === def && have < want && claimed[f.index] === 0) {
        claimed[f.index] = 1;
        have++;
      }
    }
    for (let k = have; k < want; k++) {
      const f = list.find((x) => !x.alive);
      if (!f) break;
      spawnFamiliar(w, f, def);
      claimed[f.index] = 1;
    }
  }
  for (const f of list) if (f.alive && claimed[f.index] === 0) f.alive = false;
  // Chain / orbit order = slot order among the living.
  let chain = 0;
  let ring = 0;
  for (const f of list) {
    if (!f.alive || !f.def) continue;
    const b = f.def.behavior;
    f.order = b === 'orbit' || b === 'guard' ? ring++ : chain++;
  }
}

const claimedScratch = new Uint8Array(T.familiarMax);

function spawnFamiliar(w: World, f: Familiar, def: FamiliarDef): void {
  const p = w.player;
  f.alive = true;
  f.def = def;
  f.x = f.prevX = p.x;
  f.y = f.prevY = p.y + 2;
  f.vx = f.vy = 0;
  f.age = 0;
  f.cooldown = 0.2;
  f.orbitA = f.index * 1.3;
  f.touchT = 0;
  w.events.emit('familiar', f.x, f.y, 1, 0, def.id);
}

/** A room was (re)loaded: familiars gather around the player. */
export function familiarsToPlayer(w: World): void {
  const fam = w.atk.familiars;
  const p = w.player;
  fam.resetTrail(p.x, p.y);
  for (const f of fam.list) {
    if (!f.alive) continue;
    f.x = f.prevX = p.x;
    f.y = f.prevY = p.y;
    f.vx = f.vy = 0;
  }
}

/** Where the k-th follower should be: `dist` px back along the player's recent path. */
function trailPoint(fam: Familiars, dist: number, out: { x: number; y: number }): void {
  let i = fam.head;
  let left = dist;
  out.x = fam.tx[i]!;
  out.y = fam.ty[i]!;
  for (let n = 1; n < fam.size; n++) {
    const j = (i - 1 + TRAIL) % TRAIL;
    const dx = fam.tx[j]! - fam.tx[i]!;
    const dy = fam.ty[j]! - fam.ty[i]!;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= left) {
      const t = d > 1e-6 ? left / d : 0;
      out.x = fam.tx[i]! + dx * t;
      out.y = fam.ty[i]! + dy * t;
      return;
    }
    left -= d;
    i = j;
    out.x = fam.tx[i]!;
    out.y = fam.ty[i]!;
  }
}

const tp = { x: 0, y: 0 };

export function updateFamiliars(w: World, dt: number): void {
  syncFamiliars(w);
  const fam = w.atk.familiars;
  const p = w.player;
  // Breadcrumbs every 2 px of player movement.
  if (fam.size === 0) fam.resetTrail(p.x, p.y);
  const hx = fam.tx[fam.head]!;
  const hy = fam.ty[fam.head]!;
  if ((p.x - hx) * (p.x - hx) + (p.y - hy) * (p.y - hy) >= 4) {
    fam.head = (fam.head + 1) % TRAIL;
    fam.tx[fam.head] = p.x;
    fam.ty[fam.head] = p.y;
    if (fam.size < TRAIL) fam.size++;
  }
  const targets = w.atk.targets;
  const list = fam.list;
  for (let li = 0; li < list.length; li++) {
    const f = list[li]!;
    if (!f.alive || !f.def) continue;
    const def = f.def;
    f.prevX = f.x;
    f.prevY = f.y;
    f.age += dt;
    if (f.cooldown > 0) f.cooldown -= dt;
    if (f.touchT > 0) f.touchT -= dt;
    const speed = def.speed ?? T.familiarSpeed;
    let gx = p.x;
    let gy = p.y;
    let snap = false;
    switch (def.behavior) {
      case 'orbit':
      case 'guard': {
        const r = def.behavior === 'guard' ? 14 : 20;
        f.orbitA += (def.behavior === 'guard' ? 2.2 : 3) * dt;
        const n = Math.max(1, ringCount(fam));
        const a = f.orbitA + (f.order / n) * Math.PI * 2;
        gx = p.x + Math.cos(a) * r;
        gy = p.y + Math.sin(a) * r * 0.9;
        snap = true;
        break;
      }
      case 'chase': {
        const i = nearestTarget(targets, f.x, f.y, 120);
        if (i >= 0) {
          gx = targets.refs[i]!.x;
          gy = targets.refs[i]!.y;
        } else {
          trailPoint(fam, T.familiarSpacing * (f.order + 1), tp);
          gx = tp.x;
          gy = tp.y;
        }
        break;
      }
      default: {
        trailPoint(fam, T.familiarSpacing * (f.order + 1), tp);
        gx = tp.x;
        gy = tp.y;
        break;
      }
    }
    if (snap) {
      // Orbiters ride their ring tightly.
      f.vx = (gx - f.x) / dt;
      f.vy = (gy - f.y) / dt;
      f.x = gx;
      f.y = gy;
    } else {
      const dx = gx - f.x;
      const dy = gy - f.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const want = Math.min(speed * 1.6, d * 9);
      const k = d > 1e-6 ? want / d : 0;
      f.vx += (dx * k - f.vx) * Math.min(1, 12 * dt);
      f.vy += (dy * k - f.vy) * Math.min(1, 12 * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
    }
    const r = def.radius;
    f.x = f.x < r ? r : f.x > ROOM_W - r ? ROOM_W - r : f.x;
    f.y = f.y < r ? r : f.y > ROOM_H - r ? ROOM_H - r : f.y;
    if (Math.abs(f.vx) > 4) f.face = f.vx > 0 ? 1 : -1;

    // Contact damage.
    const cd = def.contactDamage ?? 0;
    if (cd > 0 && f.touchT <= 0) {
      for (let i = 0; i < targets.n; i++) {
        const h = targets.refs[i]!;
        const dx = h.x - f.x;
        const dy = h.y - f.y;
        const rr = h.r + r;
        if (dx * dx + dy * dy < rr * rr && h.hittable) {
          const d = Math.sqrt(dx * dx + dy * dy);
          h.hurt(cd, SRC_PLAYER, d > 1e-6 ? (dx / d) * 90 : 0, d > 1e-6 ? (dy / d) * 90 : 0);
          f.touchT = 0.3;
          break;
        }
      }
    }
    // Shot blockers.
    if (def.blocks ?? (def.behavior === 'orbit' || def.behavior === 'guard')) {
      const shots = w.enemyShots;
      for (let i = shots.count - 1; i >= 0; i--) {
        const e = shots.items[i]!;
        if (e.allied || e.lob) continue;
        const dx = e.x - f.x;
        const dy = e.y - f.y;
        const rr = e.r + r;
        if (dx * dx + dy * dy < rr * rr) {
          w.events.emit('eshotPop', e.x, e.y, 1, e.style, '');
          shots.release(e);
        }
      }
    }
  }
}

function ringCount(fam: Familiars): number {
  let n = 0;
  const list = fam.list;
  for (let i = 0; i < list.length; i++) {
    const f = list[i]!;
    if (f.alive && f.def && (f.def.behavior === 'orbit' || f.def.behavior === 'guard')) n++;
  }
  return n;
}

const dir = { x: 1, y: 0 };
const origin = { x: 0, y: 0 };

/**
 * The player fired a volley: every shooter familiar that is ready fires its own at its scale.
 * `force` ignores the familiars' cooldowns (charge releases: they charged with you).
 */
export function familiarVolleys(w: World, dx: number, dy: number, from: AttackSource, force: boolean): void {
  const fam = w.atk.familiars;
  const prof = w.player.attack;
  dir.x = dx;
  dir.y = dy;
  const list = fam.list;
  for (let i = 0; i < list.length; i++) {
    const f = list[i]!;
    if (!f.alive || !f.def || f.def.attackScale <= 0) continue;
    if (!force && f.cooldown > 1e-7) continue;
    f.cooldown = prof.period / Math.max(0.1, f.def.fireRateMul ?? 1);
    const src = f.src;
    copySource(src, from);
    src.ownerKind = OWN_FAMILIAR;
    src.anchor = f;
    src.vx = f.vx;
    src.vy = f.vy;
    src.mini = true;
    src.quiet = true;
    origin.x = f.x + dx * 3;
    origin.y = f.y + dy * 3;
    fireVolley(w, src, origin, dir, prof, f.def.attackScale);
  }
}
