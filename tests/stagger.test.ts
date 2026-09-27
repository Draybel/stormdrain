/**
 * Polish batch 2 (B2-9): direct hits visibly stagger light enemies — a charging Scurrier under fire reaches Wren
 * noticeably later than one she ignores — while bosses, DoT and statuses never stagger anything.
 */

import { describe, expect, it } from 'vitest';
import { SRC_PLAYER, SRC_STATUS } from '../src/sim/hittable';
import { ENEMY_TUNING } from '../src/sim/tuning';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

/** Ticks until a tanky Scurrier charging from 150 px reaches Wren (who fires right, or not). */
function reachTicks(fire: boolean, stunMul: number = ENEMY_TUNING.hitStunMul): number {
  const T = ENEMY_TUNING as { hitStunMul: number };
  const keep = T.hitStunMul;
  T.hitStunMul = stunMul;
  try {
    return reach(fire);
  } finally {
    T.hitStunMul = keep;
  }
}

function reach(fire: boolean): number {
  const sim = makeSim('stagger', { room: OPEN_ROOM });
  const w = sim.world;
  w.godMode = true;
  w.player.placeAt(24, 56);
  const e = sim.spawnEnemy('scurrier', 174, 56, { champion: false })!;
  e.spawnT = 0;
  e.hp = e.maxHp = 1e6;
  const input = makeInput(fire ? { aimX: 1, aimY: 0, fireHeld: true } : {});
  for (let t = 1; t < 600; t++) {
    stepN(sim, input, 1);
    const d = Math.hypot(e.x - w.player.x, e.y - w.player.y);
    if (d <= e.r + w.player.r + 2) return t;
  }
  return 600;
}

describe('hit stagger', () => {
  it('a Scurrier charging through marbles reaches Wren at least 0.3 s later', () => {
    const calm = reachTicks(false);
    const under = reachTicks(true);
    // The same fire with the stagger switched off (knockback alone).
    const knockOnly = reachTicks(true, 1);
    expect(calm).toBeLessThan(200);
    expect(under - calm).toBeGreaterThanOrEqual(18);
    // The stagger itself is worth at least 0.3 s over the knockback.
    expect(under - knockOnly).toBeGreaterThanOrEqual(18);
  });

  it('refreshes rather than stacks, and only direct hits stagger (not DoT)', () => {
    const sim = makeSim('stagger-refresh', { room: OPEN_ROOM });
    const e = sim.spawnEnemy('scurrier', 150, 56, { champion: false })!;
    e.spawnT = 0;
    e.hp = e.maxHp = 1e6;
    // Damage over time never staggers.
    e.hurt(1, SRC_STATUS, 0, 0);
    expect(e.hitStunT).toBe(0);
    sim.world.player.placeAt(24, 56);
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    let most = 0;
    for (let t = 0; t < 240; t++) {
      stepN(sim, input, 1);
      most = Math.max(most, e.hitStunT);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(ENEMY_TUNING.hitStun + 1e-9);
    // A direct hit through hurt() alone (a blast, a chain arc) doesn't stagger: only the pipeline's hit paths do.
    const f = sim.spawnEnemy('scurrier', 180, 90, { champion: false })!;
    f.hurt(1, SRC_PLAYER, 0, 0);
    expect(f.hitStunT).toBe(0);
  });

  it('bosses are never staggered', () => {
    const sim = makeSim('stagger-boss', { room: OPEN_ROOM });
    sim.world.godMode = true;
    sim.world.player.placeAt(24, 56);
    sim.startBossFight('sodden-snarl', 150, 56, { intro: false });
    const boss = sim.world.enemies.items.find((e) => e.boss !== null && !e.dead)!;
    expect(boss).toBeTruthy();
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    let hits = 0;
    for (let t = 0; t < 300; t++) {
      const hp = boss.hp;
      stepN(sim, input, 1);
      if (boss.hp < hp) hits++;
      expect(boss.hitStunT).toBe(0);
    }
    expect(hits).toBeGreaterThan(0);
  });
});
