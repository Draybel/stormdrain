/**
 * Phase 2 verification: gameplay rules checked end to end in the sim (pickups → health → damage →
 * statuses), plus the fixes the verification pass made outside the attack pipeline.
 */

import { describe, expect, it } from 'vitest';
import { circleOverlapsGrid, WALK_MODE } from '../src/sim/collision';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { ST_CHARM, ST_FEAR } from '../src/sim/enemies/status';
import { describeHealth } from '../src/sim/health';
import { SRC_PLAYER } from '../src/sim/hittable';
import { makeInput, makeSim } from './helpers/sim';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';

describe('debug / tool enemy spawns', () => {
  it('an enemy spawned without a position lands on free floor (never a prop, pit or training dummy)', () => {
    for (const px of [30, 180]) {
      const sim = makeSim(`spawn-free-${px}`);
      sim.world.player.placeAt(px, 40);
      const e = sim.spawnEnemy('scurrier', undefined, undefined, { champion: false })!;
      expect(e).not.toBeNull();
      expect(circleOverlapsGrid(sim.world.room, e.x, e.y, e.r, WALK_MODE)).toBe(false);
      for (let i = 0; i < sim.world.dummies.count; i++) {
        const d = sim.world.dummies.items[i]!;
        expect(Math.hypot(d.x - e.x, d.y - e.y)).toBeGreaterThan(d.r + e.r);
      }
      for (let i = 0; i < sim.world.pedestals.count; i++) {
        const p = sim.world.pedestals.items[i]!;
        expect(Math.hypot(p.x - e.x, p.y - e.y)).toBeGreaterThan(8);
      }
    }
  });
});

describe('hearts from pickups, in the order gained', () => {
  it('an enemy shot takes the last bonus heart first; an emptied Ember heart releases its nova', () => {
    const sim = makeSim('heart-order', { room: OPEN_ROOM });
    const w = sim.world;
    const p = w.player;
    p.placeAt(60, 56);
    const idle = makeInput();
    // Pops out, lands, then she steps onto it.
    const collect = (kind: 'emberHeart' | 'tinHeart'): void => {
      sim.spawnPickup(kind, 100, 56);
      for (let t = 0; t < 45; t++) sim.step(idle);
      const k = w.pickups.items[w.pickups.count - 1]!;
      p.placeAt(k.x, k.y);
      for (let t = 0; t < 5; t++) sim.step(idle);
      p.placeAt(60, 56);
    };
    // Ember first, then Tin: Tin (last gained) must go first.
    collect('emberHeart');
    collect('tinHeart');
    expect(describeHealth(p.health)).toBe('R6/6 E2 T2');
    const hit = (): void => {
      spawnEnemyShot(w, p.x + 6, p.y, -120, 0, 2, 2, 0, false, 0);
      for (let t = 0; t < 70; t++) sim.step(idle); // past the i-frames
    };
    hit();
    expect(describeHealth(p.health)).toBe('R6/6 E2');
    // A foe next to her when the Ember heart breaks gets the nova.
    const foe = sim.spawnEnemy(testEnemy('t-nova-target', { hp: 500, speed: 0, contact: 0 }).id, p.x + 16, p.y, { champion: false })!;
    foe.spawnT = 0;
    let novas = 0;
    spawnEnemyShot(w, p.x + 6, p.y, -120, 0, 2, 2, 0, false, 0);
    for (let t = 0; t < 10; t++) {
      sim.step(idle);
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'nova') novas++;
    }
    expect(novas).toBe(1);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(describeHealth(p.health)).toBe('R6/6');
  });

  it('i-frames: a second shot right after a hit pops without hurting', () => {
    const sim = makeSim('iframes', { room: OPEN_ROOM });
    const w = sim.world;
    const p = w.player;
    p.placeAt(60, 56);
    const idle = makeInput();
    spawnEnemyShot(w, p.x + 6, p.y, -120, 0, 1, 2, 0, false, 0);
    for (let t = 0; t < 5; t++) sim.step(idle);
    expect(p.red).toBe(5);
    spawnEnemyShot(w, p.x + 6, p.y, -120, 0, 1, 2, 0, false, 0);
    for (let t = 0; t < 5; t++) sim.step(idle);
    expect(p.red).toBe(5);
    expect(w.enemyShots.count).toBe(0);
  });
});

describe('statuses behave', () => {
  it('a charmed enemy never hurts the player and leaves her attack targets; fear sends it away and stops its attacks', () => {
    const sim = makeSim('charm-fear', { room: OPEN_ROOM });
    const w = sim.world;
    const p = w.player;
    p.placeAt(100, 56);
    const foe = sim.spawnEnemy('scurrier', 112, 56, { champion: false })!;
    foe.spawnT = 0;
    foe.applyStatus('charm', 5, 0, SRC_PLAYER);
    expect(foe.status.t[ST_CHARM]).toBeGreaterThan(0);
    const idle = makeInput();
    for (let t = 0; t < 90; t++) sim.step(idle);
    expect(p.red).toBe(p.redMax);
    // Your shots fly through your new friend.
    let inSnapshot = false;
    for (let i = 0; i < w.atk.targets.n; i++) if (w.atk.targets.refs[i] === foe) inSnapshot = true;
    expect(inSnapshot).toBe(false);
    // Fear (it replaces charm): it runs from the player.
    foe.applyStatus('fear', 3, 0, SRC_PLAYER);
    expect(foe.status.t[ST_CHARM]).toBe(0);
    expect(foe.status.t[ST_FEAR]).toBeGreaterThan(0);
    const d0 = Math.hypot(foe.x - p.x, foe.y - p.y);
    for (let t = 0; t < 60; t++) sim.step(idle);
    expect(Math.hypot(foe.x - p.x, foe.y - p.y)).toBeGreaterThan(d0 + 10);
  });
});
