/**
 * Characters / test-infrastructure verification pass (after the characters pass and Phase 5): regressions for
 * what the pass found, and proof that the stress test's / play-bot's per-tick invariants really catch broken
 * states (a check that can never fail proves nothing).
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { CHARACTERS } from '../src/content/registry';
import { ParticleSystem } from '../src/render/particles';
import { damageEnemy } from '../src/sim/enemies/damage';
import { SRC_PLAYER } from '../src/sim/hittable';
import { ME_PICKPOCKET } from '../src/sim/mechanics';
import { MECHANIC_TUNING } from '../src/sim/tuning';
import type { CharacterDef } from '../src/sim/types';
import type { Sim } from '../src/sim/sim';
import { STRESS_ROOM, TEMPS_MAX, checkCapacities, checkWorld } from './helpers/stress';
import { makeInput, makeSim } from './helpers/sim';

function step(sim: Sim, n: number): void {
  const input = makeInput();
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
  }
}

function character(id: string, patch: Partial<CharacterDef> = {}): CharacterDef {
  return { ...CHARACTERS.get(id)!, ...patch };
}

describe("Sable's pickpocket: the per-enemy cap holds for every enemy", () => {
  it('a boss and an add whose uids share a pocket slot keep separate counts (the boss gives three coins, no more)', () => {
    const sure = character('sable', { mechanicParams: { chance: 1, maxChance: 1 } });
    const sim = makeSim('pocket-slots', { room: STRESS_ROOM, character: sure });
    const w = sim.world;
    w.godMode = true;
    const boss = sim.startBossFight('sodden-snarl', 160, 56, { intro: false })!;
    step(sim, 150);
    // The add's uid lands 64 after the boss's: the same slot of the 64-slot table.
    w.enemySerial = boss.uid + 63;
    const add = sim.spawnEnemy('scurrier', 60, 90)!;
    expect(add.uid).toBe(boss.uid + 64);
    step(sim, 30);
    let bossCoins = 0;
    let addCoins = 0;
    for (let i = 0; i < 12; i++) {
      for (const [e, isBoss] of [
        [boss, true],
        [add, false],
      ] as const) {
        const before = sim.events.count;
        damageEnemy(w, e, 0.01, SRC_PLAYER, 0, 0);
        for (let k = before; k < sim.events.count; k++) {
          const ev = sim.events.at(k);
          if (ev.type === 'mechanic' && ev.a === ME_PICKPOCKET) {
            if (isBoss) bossCoins++;
            else addCoins++;
          }
        }
      }
    }
    expect(bossCoins).toBe(MECHANIC_TUNING.pickpocket.bigMax);
    expect(addCoins).toBe(MECHANIC_TUNING.pickpocket.perEnemy);
  });
});

describe('the per-tick invariants (stress test + play-bot) catch broken states', () => {
  function fresh(id = 'wren'): Sim {
    const sim = makeSim('invariants', { room: STRESS_ROOM, character: character(id) });
    step(sim, 5);
    expect(checkWorld(sim, null)).toBe('');
    return sim;
  }

  it('the pools are the documented sizes', () => {
    const sim = fresh();
    expect(checkCapacities(sim, new ParticleSystem())).toBe('');
  });

  it('health out of range, red hearts on Marrow, hearts past the cap', () => {
    let sim = fresh();
    const h = sim.world.player.health;
    h.red = h.redMax + 2;
    expect(checkWorld(sim, null)).toContain('health out of range');
    sim = fresh('marrow');
    sim.world.player.health.redMax = 2;
    sim.world.player.health.red = 2;
    expect(checkWorld(sim, null)).toContain('noRedHearts');
    sim = fresh();
    sim.world.player.health.redMax = 26;
    sim.world.player.health.red = 26;
    expect(checkWorld(sim, null)).toContain('hearts over the cap');
  });

  it('counters, an overcharged active, a runaway mechanic, piling temporary effects', () => {
    let sim = fresh();
    sim.world.player.inv.coins = 100;
    expect(checkWorld(sim, null)).toContain('coins');
    sim = fresh('bolt');
    const a = sim.world.player.inv.active!;
    a.charge = a.max + 0.5;
    expect(checkWorld(sim, null)).toContain('charge');
    sim = fresh('juniper');
    sim.world.player.mech.flies = 9;
    expect(checkWorld(sim, null)).toContain('fireflies');
    sim = fresh();
    const temps = sim.world.player.temps;
    for (let i = 0; i <= TEMPS_MAX; i++) temps.push({ effect: { type: 'flag', flag: 'magnet' }, time: 5, source: 'test' } as never);
    expect(checkWorld(sim, null)).toContain('temporary effects');
  });

  it('an enemy alive at 0 HP (a room that could never clear) and a lost event', () => {
    let sim = fresh();
    const e = sim.spawnEnemy('scurrier', 60, 56)!;
    e.hp = 0;
    expect(checkWorld(sim, null)).toContain('alive at');
    sim = fresh();
    for (let i = 0; i <= sim.world.events.capacity; i++) sim.world.events.emit('sfx');
    expect(checkWorld(sim, null)).toContain('overflowed');
  });
});
