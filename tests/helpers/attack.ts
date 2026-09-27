/** Helpers for the attack-pipeline tests: loadouts from test-only items, target rooms, invariants. */

import { expect } from 'vitest';
import { ITEMS, registerItem } from '../../src/content/registry';
import { ROOM_H, ROOM_W } from '../../src/sim/constants';
import { recomputePlayer } from '../../src/sim/effects';
import type { Enemy } from '../../src/sim/enemies/enemy';
import type { Sim } from '../../src/sim/sim';
import { CAP_CREEP, CAP_ENEMIES, CAP_ENEMY_SHOTS, CAP_PROJECTILES } from '../../src/sim/constants';
import { ATTACK_TUNING } from '../../src/sim/tuning';
import type { CarrierId, ItemDef, ModId } from '../../src/sim/types';
import { makeSim } from './sim';
import { OPEN_ROOM, testEnemy } from './enemies';

const ICON = 'test-icon';

function testItem(id: string, effects: ItemDef['effects']): string {
  if (!ITEMS.has(id)) {
    registerItem({ id, name: id, desc: 'test item', kind: 'passive', quality: 0, pools: [], tags: ['test'], effects, sprite: ICON });
  }
  return id;
}

export function carrierItem(c: CarrierId): string {
  return testItem(`t.carrier.${c}`, [{ type: 'carrier', carrier: c }]);
}

export function modItem(m: ModId): string {
  return testItem(`t.mod.${m}`, [{ type: 'mod', mod: m }]);
}

export function familiarItem(f: string): string {
  return testItem(`t.fam.${f}`, [{ type: 'familiar', familiar: f }]);
}

/** Puts `n` copies of an item into the player's passives (no pickup ceremony) and recomputes. */
export function give(sim: Sim, id: string, n = 1): void {
  const p = sim.world.player;
  for (let i = 0; i < n; i++) p.inv.passives.push(id);
  p.inv.version++;
  recomputePlayer(sim.world);
}

/** A target that never dies (huge HP), optionally moving (wander). */
export function tankDef(moving: boolean): string {
  const id = moving ? 't-tank-moving' : 't-tank';
  testEnemy(id, {
    hp: 1e9,
    radius: 6,
    speed: moving ? 40 : 0,
    contact: 0,
    move: moving ? { kind: 'wander' } : { kind: 'idle' },
    attacks: [],
  });
  return id;
}

/**
 * An open room with Wren on the left aiming right: a line of `inLine` still targets in front of her
 * (so something is always in line) plus `movers` wandering targets around the room.
 */
export function arenaSim(seed: string, inLine = 2, movers = 2): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.godMode = true;
  sim.world.player.placeAt(40, 56);
  const still = tankDef(false);
  const moving = tankDef(true);
  for (let i = 0; i < inLine; i++) {
    const e = sim.spawnEnemy(still, 100 + i * 45, 56, { champion: false });
    if (e) e.spawnT = 0;
  }
  // One close by (in reach of orbiting shots and corkscrews).
  const near = sim.spawnEnemy(still, 40, 28, { champion: false });
  if (near) near.spawnT = 0;
  for (let i = 0; i < movers; i++) {
    const e = sim.spawnEnemy(moving, 110 + i * 50, i % 2 === 0 ? 24 : 92, { champion: false });
    if (e) e.spawnT = 0;
  }
  return sim;
}

/** Total hp lost by live enemies (tanks never die). */
export function damageDealt(sim: Sim): number {
  let d = 0;
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e: Enemy = pool.items[i]!;
    d += e.maxHp - e.hp;
  }
  return d;
}

const MARGIN = 16;

/** No NaN, everything inside the room (+margin), counts within the caps. */
export function checkAttackInvariants(sim: Sim): void {
  const w = sim.world;
  const shots = w.projectiles;
  expect(shots.count).toBeLessThanOrEqual(CAP_PROJECTILES);
  for (let i = 0; i < shots.count; i++) {
    const s = shots.items[i]!;
    const ok =
      Number.isFinite(s.x) &&
      Number.isFinite(s.y) &&
      Number.isFinite(s.z) &&
      Number.isFinite(s.vx) &&
      Number.isFinite(s.vy) &&
      Number.isFinite(s.damage) &&
      Number.isFinite(s.size);
    if (!ok) throw new Error(`NaN shot kind ${s.kind} at ${s.x},${s.y}`);
    if (s.x < -MARGIN || s.y < -MARGIN || s.x > ROOM_W + MARGIN || s.y > ROOM_H + MARGIN) {
      throw new Error(`shot kind ${s.kind} out of the room at ${s.x.toFixed(1)},${s.y.toFixed(1)}`);
    }
    if (s.depth > ATTACK_TUNING.maxSplitDepth) throw new Error(`split depth ${s.depth}`);
  }
  const beams = w.atk.beams;
  expect(beams.count).toBeLessThanOrEqual(ATTACK_TUNING.capBeams);
  for (let i = 0; i < beams.count; i++) {
    const b = beams.items[i]!;
    expect(b.n).toBeLessThanOrEqual(ATTACK_TUNING.beamBudget);
    for (let k = 0; k < b.nseg; k++) expect(b.segLen[k]!).toBeLessThanOrEqual(ATTACK_TUNING.beamMaxPoints);
    for (let k = 0; k < b.n; k++) {
      const x = b.px[k]!;
      const y = b.py[k]!;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(b.pw[k]!)) throw new Error('NaN beam point');
      if (x < -MARGIN || y < -MARGIN || x > ROOM_W + MARGIN || y > ROOM_H + MARGIN) {
        throw new Error(`beam point out of the room at ${x.toFixed(1)},${y.toFixed(1)}`);
      }
    }
    expect(Number.isFinite(b.dmg)).toBe(true);
  }
  expect(w.atk.swipes.count).toBeLessThanOrEqual(ATTACK_TUNING.capSwipes);
  expect(w.enemyShots.count).toBeLessThanOrEqual(CAP_ENEMY_SHOTS);
  expect(w.enemies.count).toBeLessThanOrEqual(CAP_ENEMIES);
  expect(w.creep.count).toBeLessThanOrEqual(CAP_CREEP);
  expect(w.atk.arcsThisTick).toBeLessThanOrEqual(ATTACK_TUNING.capChainArcs);
  for (const f of w.atk.familiars.list) {
    if (!f.alive) continue;
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) throw new Error('NaN familiar');
  }
  const p = w.player;
  if (!Number.isFinite(p.atk.charge)) throw new Error('NaN charge');
}
