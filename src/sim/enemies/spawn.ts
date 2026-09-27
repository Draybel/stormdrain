/** Spawning enemies (with the seeded champion roll) and champion odds. */

import type { Rng } from '../../engine/rng';
import { CHAMPIONS, allChampions } from '../../content/registry';
import { ROOM_H, ROOM_W } from '../constants';
import { ENEMY_TUNING } from '../tuning';
import type { ChampionDef, EnemyDef } from '../types';
import type { World } from '../world';
import { compileEnemy } from './behaviors/index';
import type { Enemy } from './enemy';
import { clearStatuses } from './status';

export interface SpawnOpts {
  /** true (default) = roll for a champion, false = never, a champion id = force that one. */
  champion?: boolean | string;
  /** Size multiplier (split copies). */
  scale?: number;
  /** Exact starting HP (split copies). */
  hp?: number;
  /** Split generation. */
  gen?: number;
  /** Spawn protection override (s). */
  spawnT?: number;
  /** Emit the spawn poof (default true). */
  seen?: boolean;
}

/** Chance that a championable enemy spawns as a champion: base + luck × perLuck, capped. */
export function championChance(luck: number): number {
  const T = ENEMY_TUNING;
  const c = T.championBase + luck * T.championPerLuck;
  return c < 0 ? 0 : c > T.championMax ? T.championMax : c;
}

/**
 * Rolls a champion on `rng` (deterministic for a given rng state): one roll for "is it a champion",
 * a second (only on success) for which one, weighted.
 */
export function rollChampion(rng: Rng, luck: number): ChampionDef | null {
  if (rng.next() >= championChance(luck)) return null;
  const list = allChampions();
  if (list.length === 0) return null;
  return rng.weightedPick(list, (c) => c.weight);
}

const NO_OPTS: SpawnOpts = {};

/** Spawns an enemy at (x, y) (room px). Returns null at the cap. */
export function spawnEnemy(w: World, def: EnemyDef, x: number, y: number, opts: SpawnOpts = NO_OPTS): Enemy | null {
  const cfg = compileEnemy(def); // before alloc: a bad def must not leave a half-made enemy behind
  const e = w.enemies.alloc();
  if (!e) return null;
  const rng = w.combatRng;
  e.def = def;
  e.cfg = cfg;
  e.sprite = typeof def.sprite === 'string' ? null : def.sprite;
  e.uid = ++w.enemySerial;
  e.dead = false;

  let ch: ChampionDef | null = null;
  if (typeof opts.champion === 'string') ch = CHAMPIONS.get(opts.champion) ?? null;
  else if (opts.champion !== false && def.championable) ch = rollChampion(rng, w.player.stats.luck);
  e.champion = ch;

  const scale = (opts.scale ?? 1) * (ch?.sizeMul ?? 1);
  e.scale = scale;
  e.r = def.radius * scale;
  e.maxHp = e.hp = opts.hp ?? def.hp * (ch?.hpMul ?? 1);
  // Small split copies scurry a little faster.
  e.speed = def.speed * (ch?.speedMul ?? 1) * (scale < 1 ? 1 + (1 - scale) * 0.4 : 1);
  e.cdMul = ch?.cooldownMul ?? 1;
  e.mass = (def.mass ?? 1) * scale;
  e.resist = def.resist ?? 1;
  const beh = cfg.move.beh;
  e.flying = !!def.flying || !!beh.flying;
  e.pinned = !!beh.pinned;
  e.noCollide = !!beh.noCollide;

  e.x = e.prevX = Math.min(ROOM_W - e.r, Math.max(e.r, x));
  e.y = e.prevY = Math.min(ROOM_H - e.r, Math.max(e.r, y));
  e.z = e.prevZ = 0;
  e.vx = e.vy = e.tvx = e.tvy = e.kx = e.ky = e.sepX = e.sepY = 0;
  e.snap = false;
  e.blocked = false;
  e.wallNX = e.wallNY = 0;
  e.gen = opts.gen ?? 0;
  e.parent = 0;
  e.boss = null;
  e.dying = false;
  e.anchor = 0;
  e.anchorR = e.anchorA = e.anchorW = 0;
  e.spawnT = opts.spawnT ?? ENEMY_TUNING.spawnTime;
  e.age = 0;
  e.mode = 0;
  e.modeT = 0;
  e.tx = e.x;
  e.ty = e.y;
  e.dirX = 0;
  e.dirY = 1;
  e.m0 = e.m1 = e.m2 = e.m3 = 0;
  e.hasTgt = false;
  e.tgtPlayer = false;
  const atks = cfg.attacks;
  for (let i = 0; i < e.atkT.length; i++) {
    const a = atks[i];
    if (!a) {
      e.atkT[i] = 0;
      continue;
    }
    const first = a.p.first!;
    e.atkT[i] = first >= 0 ? first : a.cooldown * (0.4 + 0.6 * rng.next());
  }
  e.windAtk = -1;
  e.windT = 0;
  e.teleT = e.teleMax = 0;
  e.burstLeft = 0;
  e.burstT = 0;
  e.burstA = null;
  e.volleys = 0;
  e.burrowed = e.hidden = e.faded = false;
  e.stun = 0;
  e.flash = 0;
  e.hurtT = 9;
  e.face = rng.next() < 0.5 ? -1 : 1;
  e.moving = false;
  clearStatuses(e.status);
  e.lastHitX = 0;
  e.lastHitY = 1;
  e.allyT = 0;
  e.waveId = 0;
  beh.init?.(w, e, cfg.move.p);

  w.counters.enemiesSpawned++;
  if (!w.seenEnemies.has(def.id)) {
    w.seenEnemies.add(def.id);
    w.events.emit('enemySeen', e.x, e.y, 0, 0, def.id);
  }
  if (opts.seen !== false) w.events.emit('enemySpawn', e.x, e.y, e.r, ch ? allChampions().indexOf(ch) + 1 : 0, def.id);
  return e;
}

/** Enemies alive (not yet killed) in the room. */
export function livingEnemies(w: World): number {
  let n = 0;
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) if (!pool.items[i]!.dead) n++;
  return n;
}
