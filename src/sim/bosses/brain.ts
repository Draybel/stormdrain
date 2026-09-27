/**
 * The boss brain (ARCHITECTURE §6c). A boss is an ordinary pooled Enemy (hits, statuses, knockback,
 * collisions, rendering) whose `boss` state replaces the movement / attack step of the enemy update:
 *
 *   intro (idle while the card is up) → baseline movement + phase attacks for a rest → a pattern
 *   (telegraph → action) → rest → the next pattern (cycled or seeded-random) → …
 *
 * The fight (`world.boss`) sums the HP of every part (split bosses); when it falls to the next phase's
 * threshold every part roars (brief invulnerability, flash, colour shift), swaps to the phase's
 * movement / attacks / patterns and runs the phase's `enter` pattern (split, shields, summon…).
 * When the last part falls the death sequence plays: adds die, hostile shots fizzle, chain explosions
 * for a couple of seconds, then the kill (drops, 'enemyKilled') and the room clears as usual.
 * Everything random uses combatRng, so a fight replays exactly from a snapshot.
 */

import { CHAPTERS, findEnemy } from '../../content/registry';
import { DMG_ENEMY, damagePlayer } from '../combat';
import { ROOM_H, ROOM_W, TILE } from '../constants';
import { updateAttacks } from '../enemies/attackRunner';
import { feared } from '../enemies/behaviors/common';
import { killEnemy } from '../enemies/damage';
import type { Enemy } from '../enemies/enemy';
import { spawnEnemyShot, spawnLob } from '../enemies/shots';
import { spawnEnemy } from '../enemies/spawn';
import { ST_CHARM, hasStatus } from '../enemies/status';
import { SRC_HAZARD, SRC_PLAYER } from '../hittable';
import { BOSS_TUNING } from '../tuning';
import { ENEMY_SHOT_STYLES, type BossDef } from '../types';
import type { World } from '../world';
import { compileBoss, type CompiledPattern, type CompiledPhase } from './compile';
import { getBossHook, type BossHookApi, type BossHookCtx } from './hooks';
import { setHookRunner, setSplitHandler } from './patterns';
import { BossState, FIGHT_BOSS, FIGHT_FINAL, FIGHT_MINIBOSS } from './state';

export interface BossSpawnOpts {
  /** Starting HP (default the def's). */
  hp?: number;
  /** Play the intro (default true). */
  intro?: boolean;
  /**
   * Minimum phase time (s; default BOSS_TUNING.minPhase, finals minPhaseFinal). Tests that force phase changes with
   * direct damage pass 0.
   */
  minPhase?: number;
}

export function fightKind(def: BossDef): number {
  return def.kind === 'miniboss' ? FIGHT_MINIBOSS : def.kind === 'final' ? FIGHT_FINAL : FIGHT_BOSS;
}

function stop(e: Enemy): void {
  e.tvx = 0;
  e.tvy = 0;
}

function restTime(w: World, b: BossState, ph: CompiledPhase): number {
  return (ph.rest[0] + w.combatRng.next() * Math.max(0, ph.rest[1] - ph.rest[0])) / b.pace;
}

/**
 * Starts a boss fight: spawns the boss at (x, y) (room px) and fills `world.boss` (intro card, HP bar).
 * Returns the boss enemy (null at the enemy cap).
 */
export function spawnBoss(w: World, def: BossDef, x: number, y: number, opts: BossSpawnOpts = {}): Enemy | null {
  const c = compileBoss(def);
  const ph = c.phases[0]!;
  const hp = Math.max(1, Math.round(opts.hp ?? def.hp));
  const e = spawnEnemy(w, ph.enemy, x, y, { champion: false, hp });
  if (!e) return null;
  const b = new BossState(def, c);
  b.group = e.uid;
  b.pace = ph.pace;
  b.minPhase = opts.minPhase ?? (def.kind === 'final' ? BOSS_TUNING.minPhaseFinal : BOSS_TUNING.minPhase);
  b.introT = opts.intro === false ? 0 : def.kind === 'miniboss' ? BOSS_TUNING.minibossIntro : BOSS_TUNING.intro;
  b.rest = restTime(w, b, ph) * 0.6;
  // The first phase's own entrance (e.g. shields) comes right after the intro.
  b.enterPending = ph.enter !== null;
  e.boss = b;
  const f = w.boss;
  f.reset();
  f.active = true;
  f.id = def.id;
  f.name = def.name;
  f.title = def.title ?? '';
  f.chapter = CHAPTERS.get(w.chapter)?.name ?? '';
  f.kind = fightKind(def);
  f.group = e.uid;
  f.maxHp = f.hp = hp;
  f.phases = c.phases.length;
  for (const m of c.marks) f.marks.push(m);
  f.introT = f.introMax = Math.max(0.01, b.introT);
  f.ending = def.ending ?? 0;
  w.events.emit('bossIntro', e.x, e.y, f.kind, b.introT, def.id);
  return e;
}

/** A part split off `src` (same def, phase and fight), `hp` health, `scale` size, pushed along `a`. */
function spawnPart(w: World, src: Enemy, sb: BossState, scale: number, hp: number, a: number, push: number): Enemy | null {
  const ph = sb.c.phases[sb.phase]!;
  const x = src.x + Math.cos(a) * src.r * 0.6;
  const y = src.y + Math.sin(a) * src.r * 0.6;
  const e = spawnEnemy(w, ph.enemy, x, y, { champion: false, hp, scale, spawnT: 0.2, seen: false });
  if (!e) return null;
  const b = new BossState(sb.def, sb.c);
  b.group = sb.group;
  b.phase = sb.phase;
  b.pace = sb.pace;
  b.phaseT = sb.phaseT;
  b.live = sb.live;
  b.minPhase = sb.minPhase;
  b.rest = restTime(w, b, ph) * (0.5 + w.combatRng.next() * 0.5);
  e.boss = b;
  e.kx = Math.cos(a) * push;
  e.ky = Math.sin(a) * push;
  return e;
}

setSplitHandler((w, e, b, cp) => {
  const n = cp.p.count!;
  const scale = cp.p.scale!;
  const share = Math.max(1, e.hp / n);
  const off = w.combatRng.next() * Math.PI * 2;
  e.scale *= scale;
  e.r = b.def.size * e.scale;
  e.mass *= scale;
  e.hp = e.maxHp = share;
  e.speed *= 1 + (1 - scale) * 0.5;
  e.kx = Math.cos(off) * cp.p.spread!;
  e.ky = Math.sin(off) * cp.p.spread!;
  for (let i = 1; i < n; i++) spawnPart(w, e, b, e.scale, share, off + (i / n) * Math.PI * 2, cp.p.spread!);
  w.events.emit('bossSplit', e.x, e.y, n, 0, e.def.id);
});

// ── Hooks (per-boss code) ────────────────────────────────────────────────────

const hookCtx: BossHookCtx = {
  w: null as unknown as World,
  e: null as unknown as Enemy,
  b: null as unknown as BossState,
  api: null as unknown as BossHookApi,
  dt: 0,
  t: 0,
  params: {},
};

(hookCtx as { api: BossHookApi }).api = {
  shoot(x, y, angle, speed, dmg = 1, size = 3, style) {
    const e = hookCtx.e;
    const si = style ? Math.max(0, ENEMY_SHOT_STYLES.indexOf(style)) : Math.max(0, ENEMY_SHOT_STYLES.indexOf(e.def.shot ?? 'muck'));
    spawnEnemyShot(hookCtx.w, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, dmg, size, si, hasStatus(e.status, ST_CHARM), e.uid);
  },
  ring(n, speed, offset = 0) {
    const e = hookCtx.e;
    for (let i = 0; i < n; i++) hookCtx.api.shoot(e.x, e.y, offset + (i / n) * Math.PI * 2, speed);
    hookCtx.w.events.emit('enemyShoot', e.x, e.y, n, 0, e.def.id);
  },
  drop(x, y, air, bolt = false) {
    const e = hookCtx.e;
    const s = spawnLob(hookCtx.w, x, y, x, y, air, bolt ? 120 : 90, 1, bolt ? 2 : 3, 0, hasStatus(e.status, ST_CHARM), e.uid);
    if (s) {
      s.fall = bolt ? 2 : 1;
      s.splash = 9;
    }
  },
  summon(id, x, y) {
    const def = findEnemy(id);
    if (!def) return false;
    const m = spawnEnemy(hookCtx.w, def, x, y, { champion: false });
    if (m) m.parent = hookCtx.e.uid;
    return !!m;
  },
  random() {
    return hookCtx.w.combatRng.next();
  },
};

function ctxFor(w: World, e: Enemy, b: BossState, dt: number): BossHookCtx {
  hookCtx.w = w;
  hookCtx.e = e;
  hookCtx.b = b;
  hookCtx.dt = dt;
  return hookCtx;
}

setHookRunner((w, e, b, cp, dt) => {
  const h = getBossHook(cp.hook);
  if (!h?.pattern) return true;
  const ctx = ctxFor(w, e, b, dt);
  ctx.t = b.k;
  ctx.params = cp.p;
  return h.pattern(ctx);
});

function phaseHook(w: World, e: Enemy, b: BossState): void {
  const name = b.def.hook;
  if (!name) return;
  getBossHook(name)?.phase?.(ctxFor(w, e, b, 0), b.phase);
}

// ── Patterns ────────────────────────────────────────────────────────────────

/** Undoes whatever a pattern left behind (burrowed, hidden, airborne, beams, markers). */
function stopPattern(e: Enemy, b: BossState): void {
  b.pat = null;
  b.anim = '';
  b.fade = 1;
  b.tellLine = false;
  b.markT = 0;
  b.beams[0]!.on = false;
  b.beams[1]!.on = false;
  e.burrowed = false;
  e.hidden = false;
  e.z = 0;
  e.teleT = 0;
}

function beginPattern(w: World, e: Enemy, b: BossState, cp: CompiledPattern): void {
  stopPattern(e, b);
  b.pat = cp;
  b.mode = 0;
  b.t = 0;
  b.n = 0;
  b.k = 0;
  e.windAtk = -1;
  e.burstLeft = 0;
  cp.beh.start(w, e, b, cp);
}

function endPattern(w: World, e: Enemy, b: BossState): void {
  stopPattern(e, b);
  const ph = b.c.phases[b.phase]!;
  b.rest = restTime(w, b, ph);
  // The baseline movement starts over (its state machine was interrupted).
  e.mode = 0;
  e.modeT = 0;
  ph.cfg.move.beh.init?.(w, e, ph.cfg.move.p);
}

/** The next pattern of the phase: in order, or a seeded weighted pick that avoids repeats. */
function nextPattern(w: World, b: BossState): CompiledPattern | null {
  const list = b.c.phases[b.phase]!.patterns;
  const n = list.length;
  if (n === 0) return null;
  if (!b.c.phases[b.phase]!.random || n === 1) {
    b.cycle = (b.cycle + 1) % n;
    return list[b.cycle]!;
  }
  let total = 0;
  for (let i = 0; i < n; i++) if (i !== b.cycle) total += list[i]!.weight;
  let r = w.combatRng.next() * total;
  let pick = n - 1;
  for (let i = 0; i < n; i++) {
    if (i === b.cycle) continue;
    const wt = list[i]!.weight;
    if (r < wt) {
      pick = i;
      break;
    }
    r -= wt;
  }
  b.cycle = pick;
  return list[pick]!;
}

function startPhase(w: World, e: Enemy, b: BossState, i: number): void {
  stopPattern(e, b);
  const ph = b.c.phases[i]!;
  b.phase = i;
  e.def = ph.enemy;
  e.cfg = ph.cfg;
  e.speed = ph.enemy.speed * (e.scale < 1 ? 1 + (1 - e.scale) * 0.5 : 1);
  const atks = ph.cfg.attacks;
  for (let k = 0; k < e.atkT.length; k++) {
    const a = atks[k];
    e.atkT[k] = a ? (a.p.first! >= 0 ? a.p.first! : a.cooldown * (0.5 + 0.5 * w.combatRng.next())) : 0;
  }
  e.windAtk = -1;
  e.burstLeft = 0;
  e.burstA = null;
  e.mode = 0;
  e.modeT = 0;
  ph.cfg.move.beh.init?.(w, e, ph.cfg.move.p);
  b.pace = ph.pace;
  b.invulnT = BOSS_TUNING.phaseInvuln;
  b.phaseT = 0;
  b.live = 0;
  b.enterPending = ph.enter !== null;
  b.cycle = -1;
  b.rest = restTime(w, b, ph) * 0.5;
  b.anim = 'roar';
  telegraph(e, BOSS_TUNING.phaseInvuln);
  w.events.emit('bossPhase', e.x, e.y, i, b.c.phases.length, e.def.id);
  phaseHook(w, e, b);
}

function telegraph(e: Enemy, t: number): void {
  e.teleT = e.teleMax = t;
}

// ── Enemy beams ───────────────────────────────────────────────────────────────

function updateBeams(w: World, e: Enemy, b: BossState): void {
  const room = w.room;
  const p = w.player;
  const ally = hasStatus(e.status, ST_CHARM);
  for (let i = 0; i < 2; i++) {
    const bm = b.beams[i]!;
    if (!bm.on) continue;
    const c = Math.cos(bm.angle);
    const s = Math.sin(bm.angle);
    let len = e.r * 0.5;
    // March to the first wall or rock (rocks are cover; pits aren't).
    while (len < 320) {
      const nx = e.x + c * (len + 4);
      const ny = e.y + s * (len + 4);
      if (nx < 0 || ny < 0 || nx > ROOM_W || ny > ROOM_H) break;
      if (room.blocksShotsAt(Math.floor(nx / TILE), Math.floor(ny / TILE))) break;
      len += 4;
    }
    bm.len = len + 2;
    if (bm.tele || ally || p.dead) continue;
    const px = p.x - e.x;
    const py = p.y - e.y;
    const t = Math.max(0, Math.min(bm.len, px * c + py * s));
    const dx = px - c * t;
    const dy = py - s * t;
    const rr = bm.width / 2 + p.r * BOSS_TUNING.beamGrace;
    if (dx * dx + dy * dy < rr * rr) damagePlayer(w, bm.dmg, DMG_ENEMY, e.uid, e.x + c * t, e.y + s * t);
  }
}

// ── Death sequence ────────────────────────────────────────────────────────────

function dyingUpdate(w: World, e: Enemy, b: BossState, dt: number): void {
  stop(e);
  e.vx = e.vy = e.kx = e.ky = 0;
  if (!b.swept) {
    b.swept = true;
    stopPattern(e, b);
    b.anim = 'hurt';
    // Its adds fall with it; hostile shots, creep and shockwaves fizzle out.
    const pool = w.enemies;
    for (let i = 0; i < pool.count; i++) {
      const o = pool.items[i]!;
      if (o !== e && !o.dead) killEnemy(w, o, SRC_HAZARD);
    }
    const shots = w.enemyShots;
    for (let i = shots.count - 1; i >= 0; i--) {
      const s = shots.items[i]!;
      if (s.allied) continue;
      w.events.emitFx('eshotPop', s.x, s.y, 0, s.style);
      shots.release(s);
    }
    const creep = w.creep;
    for (let i = creep.count - 1; i >= 0; i--) if (!creep.items[i]!.allied) creep.release(creep.items[i]!);
    const waves = w.waves;
    for (let i = waves.count - 1; i >= 0; i--) if (!waves.items[i]!.allied) waves.release(waves.items[i]!);
  }
  // A boss's own send-off (finals: lightning, a crumbling hive, the water growing still…).
  const own = b.def.hook ? getBossHook(b.def.hook) : undefined;
  if (own?.dying) {
    const ctx = ctxFor(w, e, b, dt);
    ctx.t = b.dieT;
    own.dying(ctx);
  }
  b.dieT -= dt;
  b.boomT -= dt;
  if (b.boomT <= 0 && b.dieT > 0.35) {
    b.boomT += BOSS_TUNING.boomEvery;
    const rng = w.combatRng;
    const sprH = typeof b.def.sprite === 'string' ? e.r * 2 : b.def.sprite.h * e.scale;
    w.events.emit('bossBoom', e.x + (rng.next() - 0.5) * e.r * 2, e.y - rng.next() * sprH * 0.85, 3 + rng.int(0, 3), 0, e.def.id);
  }
  if (b.dieT > 0) return;
  const f = w.boss;
  w.events.emit('bossDefeated', e.x, e.y, e.r, fightKind(b.def), e.def.id);
  e.dying = false;
  killEnemy(w, e, SRC_PLAYER);
  if (f.group === b.group && f.active) endFight(w);
}

// ── Per tick ──────────────────────────────────────────────────────────────────

/** The fight is over (the last part is dead): the HP bar goes, the kill counts. */
function endFight(w: World): void {
  const f = w.boss;
  f.active = false;
  f.done = true;
  f.dying = false;
  f.hp = 0;
  w.counters.bossKills++;
}

/**
 * Fight bookkeeping (start of the enemy update): total HP over the parts, the phase, the intro clock,
 * and the end of the fight (no part left).
 */
export function updateBossFight(w: World, dt: number): void {
  const f = w.boss;
  if (!f.active) return;
  f.age += dt;
  if (f.introT > 0) f.introT = Math.max(0, f.introT - dt);
  let hp = 0;
  let parts = 0;
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const o = pool.items[i]!;
    if (o.dead || o.boss === null || o.boss.group !== f.group) continue;
    parts++;
    hp += Math.max(0, o.hp);
  }
  if (parts === 0) {
    endFight(w);
    return;
  }
  f.hp = hp;
  const frac = hp / f.maxHp;
  let target = f.phase;
  for (let i = f.phase + 1; i < f.marks.length; i++) if (frac <= f.marks[i]!) target = i;
  f.phase = target;
}

/**
 * One boss part's tick, in place of the enemy movement + attack step (sim/enemies/update.ts). Writes
 * the desired velocity; the shared integrator moves it. `spd` = its speed after statuses, `rate` = the
 * attack clock rate (slowed bosses attack less often).
 */
export function updateBoss(w: World, e: Enemy, dt: number, spd: number, rate: number): void {
  const b = e.boss!;
  if (e.dying) {
    dyingUpdate(w, e, b, dt);
    return;
  }
  b.phaseT += dt;
  if (b.markT > 0) b.markT = Math.max(0, b.markT - dt);
  const f = w.boss;
  if (b.introT > 0) {
    b.introT -= dt;
    stop(e);
    if (e.hasTgt) e.face = e.tgtX >= e.x ? 1 : -1;
    if (b.introT <= 0) phaseHook(w, e, b);
    return;
  }
  if (f.group === b.group && f.phase > b.phase) startPhase(w, e, b, f.phase);
  if (b.invulnT > 0) {
    b.invulnT -= dt;
    stop(e);
    if (b.invulnT <= 0) b.anim = '';
    return;
  }
  // The phase is being fought (the minimum phase time counts from here).
  b.live += dt;
  // A phase's entrance (split, shields, summon…) runs once, after the intro / the roar.
  if (b.enterPending) {
    b.enterPending = false;
    const enter = b.c.phases[b.phase]!.enter;
    if (enter) {
      beginPattern(w, e, b, enter);
      return;
    }
  }
  // Bosses shrug off dazes; fear makes them back off for a moment (no new patterns).
  e.stun = 0;
  const hook = b.def.hook ? getBossHook(b.def.hook) : undefined;
  if (hook?.tick) hook.tick(ctxFor(w, e, b, dt));
  if (b.pat) {
    if (b.pat.beh.update(w, e, b, b.pat, dt * rate)) endPattern(w, e, b);
    else updateBeams(w, e, b);
    return;
  }
  if (feared(e)) {
    const p = w.player;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) {
      e.tvx = (dx / d) * spd;
      e.tvy = (dy / d) * spd;
    }
    return;
  }
  // Baseline: the phase's movement and attacks, until the rest is over.
  const mv = e.cfg.move;
  if (e.windAtk >= 0 && e.cfg.attacks[e.windAtk]!.p.still! > 0 && e.z <= 0) stop(e);
  else mv.beh.update(w, e, mv.p, dt, spd);
  updateAttacks(w, e, dt, rate);
  b.rest -= dt * rate;
  if (b.rest <= 0 && e.windAtk < 0 && e.burstLeft <= 0 && e.z <= 0 && !e.burrowed && !e.hidden) {
    const cp = nextPattern(w, b);
    if (cp) beginPattern(w, e, b, cp);
    else b.rest = restTime(w, b, b.c.phases[b.phase]!);
  }
}
