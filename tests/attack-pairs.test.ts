/**
 * The attack pipeline stress matrix (ARCHITECTURE §4): every carrier as the primary × every modifier,
 * every pair of carriers, every carrier at 1 and 5 stacks — fired for 3 s in a headless room with
 * moving targets. No exceptions, no NaN, everything stays in the room, counts never exceed the caps,
 * and damage lands when a target is in line.
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { BK_FEATHER, type Beam } from '../src/sim/attack/beam';
import { liveExplosions } from '../src/sim/attack/impacts';
import { recomputeAttack } from '../src/sim/attack/recomputeAttack';
import { F_KEEPER, F_MINI, OWN_FAMILIAR, OWN_PLAYER, SK_ORBIT } from '../src/sim/attack/state';
import { ROOM_W } from '../src/sim/constants';
import { recomputePlayer } from '../src/sim/effects';
import type { Enemy } from '../src/sim/enemies/enemy';
import type { Sim } from '../src/sim/sim';
import { ATTACK_TUNING } from '../src/sim/tuning';
import { CARRIER_IDS, MOD_IDS, type CarrierId, type ModId } from '../src/sim/types';
import {
  arenaSim,
  carrierItem,
  checkAttackInvariants,
  damageDealt,
  familiarItem,
  give,
  modItem,
  tankDef,
} from './helpers/attack';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

/** Fires for `ticks` (hold ~1.2 s, release, repeat — charge carriers need releases). */
function fire(sim: Sim, ticks: number, check = true): void {
  const input = makeInput({ aimX: 1, aimY: 0 });
  for (let t = 0; t < ticks; t++) {
    const phase = t % 80;
    const held = phase < 74;
    input.fireHeld = held;
    input.firePressed = phase === 0;
    input.fireReleased = phase === 74;
    input.aimX = held ? 1 : 0;
    sim.step(input);
    clearEdges(input);
    if (check) checkAttackInvariants(sim);
  }
}

function withCarrier(sim: Sim, c: CarrierId, n = 1): void {
  if (c !== 'marble' || n > 1) give(sim, carrierItem(c), n);
}

describe('every carrier as the primary × every modifier (3 s each)', () => {
  for (const c of CARRIER_IDS) {
    for (const m of MOD_IDS) {
      it(`${c} + ${m}`, () => {
        const sim = arenaSim(`${c}-${m}`);
        withCarrier(sim, c);
        give(sim, modItem(m as ModId));
        fire(sim, 180);
        expect(damageDealt(sim), 'damage dealt').toBeGreaterThan(0);
      });
    }
  }
});

describe('every pair of carriers merges (3 s each)', () => {
  for (let i = 0; i < CARRIER_IDS.length; i++) {
    for (let j = i + 1; j < CARRIER_IDS.length; j++) {
      const a = CARRIER_IDS[i]!;
      const b = CARRIER_IDS[j]!;
      it(`${a} + ${b}`, () => {
        const sim = arenaSim(`${a}-${b}`);
        give(sim, carrierItem(a));
        give(sim, carrierItem(b));
        const prof = sim.world.player.attack;
        // The higher-ranked one is the primary, the other rides along.
        expect(prof.stacksOf(a)).toBeGreaterThan(0);
        expect(prof.stacksOf(b)).toBeGreaterThan(0);
        fire(sim, 180);
        expect(damageDealt(sim), 'damage dealt').toBeGreaterThan(0);
      });
    }
  }
});

describe('every carrier at 1 and 5 stacks', () => {
  for (const c of CARRIER_IDS) {
    for (const n of [1, 5]) {
      it(`${c} ×${n}`, () => {
        const sim = arenaSim(`${c}-x${n}`);
        give(sim, carrierItem(c), n);
        fire(sim, 180);
        expect(damageDealt(sim)).toBeGreaterThan(0);
      });
    }
  }
});

// ── Targeted behaviour ─────────────────────────────────────────────────────────

/** A room with only the player (no dummies) at (x, y). */
function emptySim(seed: string, x = 40, y = 56): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.godMode = true;
  sim.world.player.placeAt(x, y);
  return sim;
}

function spawnTank(sim: Sim, x: number, y: number, moving = false): Enemy {
  const e = sim.spawnEnemy(tankDef(moving), x, y, { champion: false })!;
  e.spawnT = 0;
  return e;
}

/** One tap of fire to the right (a single volley). */
function tap(sim: Sim, ax = 1, ay = 0): void {
  const input = makeInput({ aimX: ax, aimY: ay, firePressed: true, fireReleased: true });
  sim.step(input);
}

function idle(sim: Sim, ticks: number, each?: (s: Sim) => void): void {
  const input = makeInput();
  for (let t = 0; t < ticks; t++) {
    sim.step(input);
    each?.(sim);
  }
}

/** Holds fire right for `ticks`, then releases (charge carriers fire on release). */
function holdRelease(sim: Sim, ticks: number, ax = 1, ay = 0): void {
  const input = makeInput({ aimX: ax, aimY: ay, fireHeld: true, firePressed: true });
  for (let t = 0; t < ticks; t++) {
    sim.step(input);
    clearEdges(input);
  }
  input.fireHeld = false;
  input.aimX = input.aimY = 0;
  input.fireReleased = true;
  sim.step(input);
}

function countEvents(sim: Sim, type: string): number {
  const q = sim.events;
  let n = 0;
  for (let i = 0; i < q.count; i++) if (q.at(i).type === type) n++;
  return n;
}

describe('targeted modifier behaviour', () => {
  it('homing turns a shot toward a target off the aim line', () => {
    const closest = (homing: boolean): number => {
      const sim = emptySim(`homing-${homing}`);
      if (homing) give(sim, modItem('homing'));
      const e = spawnTank(sim, 130, 20);
      tap(sim);
      const s = sim.world.projectiles.items[0]!;
      let best = Infinity;
      for (let t = 0; t < 50 && s.alive; t++) {
        idle(sim, 1);
        best = Math.min(best, Math.hypot(s.x - e.x, s.y - e.y));
      }
      return best;
    };
    const straight = closest(false);
    const seeking = closest(true);
    expect(straight).toBeGreaterThan(20);
    expect(seeking).toBeLessThan(10);
  });

  it('bounce: 2 bounces per stack, then the shot ends on the next wall', () => {
    for (const stacks of [1, 2]) {
      const sim = emptySim(`bounce-${stacks}`);
      give(sim, modItem('bounce'), stacks);
      sim.world.player.attack.range = 5000;
      tap(sim);
      let bounces = countEvents(sim, 'shotBounce');
      let t = 0;
      while (sim.world.projectiles.count > 0 && t < 360) {
        idle(sim, 1);
        bounces += countEvents(sim, 'shotBounce');
        t++;
      }
      expect(sim.world.projectiles.count).toBe(0);
      expect(bounces).toBe(2 * stacks);
    }
  });

  it('split: children stop at depth min(3, stacks)', () => {
    for (const [stacks, cap] of [
      [1, 1],
      [5, 3],
    ] as const) {
      const sim = emptySim(`split-${stacks}`);
      give(sim, modItem('split'), stacks);
      // A ring of tanks so children keep finding something to split on.
      for (let k = 0; k < 8; k++) spawnTank(sim, 120 + Math.cos(k) * 30, 56 + Math.sin(k) * 30);
      spawnTank(sim, 100, 56);
      let maxDepth = 0;
      const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true });
      for (let t = 0; t < 240; t++) {
        sim.step(input);
        clearEdges(input);
        const pool = sim.world.projectiles;
        for (let i = 0; i < pool.count; i++) maxDepth = Math.max(maxDepth, pool.items[i]!.depth);
      }
      expect(maxDepth).toBe(cap);
    }
  });

  it('chain: lightning jumps to at most 1 + stacks more targets per hit', () => {
    for (const stacks of [1, 3]) {
      const sim = emptySim(`chain-${stacks}`);
      give(sim, modItem('chain'), stacks);
      spawnTank(sim, 100, 56);
      for (let k = 0; k < 7; k++) spawnTank(sim, 110 + (k % 3) * 14, 30 + Math.floor(k / 3) * 22);
      tap(sim);
      let arcs = 0;
      let hits = 0;
      for (let t = 0; t < 60; t++) {
        idle(sim, 1);
        arcs += countEvents(sim, 'chainArc');
        hits += countEvents(sim, 'splash');
      }
      expect(hits).toBeGreaterThanOrEqual(1);
      expect(arcs).toBe(1 + stacks);
    }
  });

  it('explode: player blasts hurt enemies, never the player', () => {
    const sim = emptySim('explode');
    sim.world.godMode = false;
    give(sim, modItem('explode'), 3);
    const e = spawnTank(sim, 60, 56);
    const red = sim.world.player.red;
    tap(sim);
    idle(sim, 30);
    expect(e.maxHp - e.hp).toBeGreaterThan(0);
    expect(sim.world.player.red).toBe(red);
  });

  it('puddle: leaves allied puddles that hurt enemies', () => {
    const sim = emptySim('puddle');
    give(sim, modItem('puddle'), 2);
    spawnTank(sim, 90, 56);
    tap(sim);
    idle(sim, 20);
    let allied = 0;
    for (let i = 0; i < sim.world.creep.count; i++) if (sim.world.creep.items[i]!.allied) allied++;
    expect(allied).toBeGreaterThan(0);
  });

  it('status modifiers apply their status on hit', () => {
    for (const m of ['poison', 'burn', 'slow'] as const) {
      const sim = emptySim(`status-${m}`);
      give(sim, modItem(m));
      const e = spawnTank(sim, 90, 56);
      tap(sim);
      idle(sim, 25);
      expect(e.status.mask, m).not.toBe(0);
    }
  });
});

describe('Storm Lance', () => {
  it('the beam trace reaches the far wall (through rocks) and pierces every enemy in a line', () => {
    const room = ['.............', '.............', '.............', '......#......', '.............', '.............', '.............'];
    const sim = makeSim('lance-line', { room });
    sim.world.godMode = true;
    sim.world.player.placeAt(24, 56);
    give(sim, carrierItem('lance'));
    const line = [60, 80, 130, 160, 190].map((x) => spawnTank(sim, x, 56));
    const ready = Math.ceil(sim.world.player.attack.chargeTime * 60) + 2;
    holdRelease(sim, ready);
    expect(countEvents(sim, 'lanceFire')).toBe(1);
    const b = sim.world.atk.beams.items[0]!;
    expect(sim.world.atk.beams.count).toBe(1);
    expect(b.endWall).toBe(true);
    expect(b.endX).toBeGreaterThan(ROOM_W - 3);
    expect(Math.abs(b.endY - 56)).toBeLessThan(2);
    idle(sim, 40);
    for (const e of line) expect(e.maxHp - e.hp).toBeGreaterThan(0);
    // Rapid ticks over ~0.5 s: several damage ticks per target.
    expect(line[4]!.maxHp - line[4]!.hp).toBeGreaterThan(sim.world.player.attack.lanceTick * 5);
  });

  it('releasing early only fizzles', () => {
    const sim = emptySim('fizzle');
    give(sim, carrierItem('lance'));
    holdRelease(sim, 10);
    expect(countEvents(sim, 'lanceFizzle')).toBe(1);
    expect(sim.world.atk.beams.count).toBe(0);
  });

  it('charge time scales inversely with fire rate (1 s at 3/s, clamped to 0.25 s)', () => {
    const ticksToReady = (rate: number): number => {
      const sim = emptySim(`rate-${rate}`);
      give(sim, carrierItem('lance'));
      sim.world.player.stats.fireRate = rate;
      recomputeAttack(sim.world.player);
      const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true });
      for (let t = 1; t < 200; t++) {
        sim.step(input);
        clearEdges(input);
        if (countEvents(sim, 'lanceReady') > 0) return t;
      }
      return -1;
    };
    expect(ticksToReady(3)).toBe(60);
    expect(ticksToReady(6)).toBe(30);
    expect(ticksToReady(20)).toBe(15);
    expect(ticksToReady(1.5)).toBe(120);
  });

  it('beam + bounce reflects off the wall', () => {
    const sim = emptySim('beam-bounce', 24, 56);
    give(sim, carrierItem('lance'));
    give(sim, modItem('bounce'));
    holdRelease(sim, 64);
    const b = sim.world.atk.beams.items[0]!;
    let maxX = 0;
    let after = Infinity;
    for (let i = 0; i < b.segLen[0]!; i++) {
      const x = b.px[i]!;
      if (x > maxX) {
        maxX = x;
        after = Infinity;
      } else after = Math.min(after, x);
    }
    expect(maxX).toBeGreaterThan(ROOM_W - 6);
    expect(after).toBeLessThan(maxX - 60);
  });

  it('beam + split forks at the first enemy on the path', () => {
    const sim = emptySim('beam-split', 24, 56);
    give(sim, carrierItem('lance'));
    give(sim, modItem('split'));
    const e = spawnTank(sim, 100, 56);
    holdRelease(sim, 64);
    const b = sim.world.atk.beams.items[0]!;
    expect(b.nseg).toBeGreaterThanOrEqual(3);
    const s1 = b.segStart[1]!;
    expect(Math.hypot(b.px[s1]! - e.x, b.py[s1]! - e.y)).toBeLessThan(e.r + 8);
    expect(b.segDepth[1]).toBe(1);
  });

  it('beam + orbitPlayer makes a rotating ring of beams', () => {
    const sim = emptySim('beam-orbit', 104, 56);
    give(sim, carrierItem('lance'));
    give(sim, modItem('orbitPlayer'));
    holdRelease(sim, 64);
    const beams = sim.world.atk.beams;
    expect(beams.count).toBeGreaterThanOrEqual(2);
    const a0 = beams.items[0]!.dir;
    const a1 = beams.items[1]!.dir;
    const gap = Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)));
    expect(gap).toBeCloseTo(Math.PI, 1);
    idle(sim, 10);
    const turned = Math.atan2(Math.sin(beams.items[0]!.dir - a0), Math.cos(beams.items[0]!.dir - a0));
    expect(Math.abs(turned)).toBeGreaterThan(0.3);
  });

  it('beam + extraShots fans the beams out', () => {
    const sim = emptySim('beam-extra', 24, 56);
    give(sim, carrierItem('lance'));
    give(sim, modItem('extraShots'), 2);
    holdRelease(sim, 64);
    const beams = sim.world.atk.beams;
    expect(beams.count).toBe(3);
    const dirs = [0, 1, 2].map((i) => beams.items[i]!.dir).sort((x, y) => x - y);
    expect(dirs[1]! - dirs[0]!).toBeGreaterThan(0.05);
    expect(dirs[2]! - dirs[1]!).toBeGreaterThan(0.05);
  });

  it('beam + homing bends toward an enemy off the line', () => {
    const sim = emptySim('beam-homing', 24, 56);
    give(sim, carrierItem('lance'));
    give(sim, modItem('homing'), 2);
    const e = spawnTank(sim, 150, 24);
    holdRelease(sim, 64);
    const b = sim.world.atk.beams.items[0]!;
    let best = Infinity;
    for (let i = 0; i < b.segLen[0]!; i++) best = Math.min(best, Math.hypot(b.px[i]! - e.x, b.py[i]! - e.y));
    expect(best).toBeLessThan(e.r + b.width / 2);
  });

  it('a familiar with the lance charges with you and fires its own smaller beam', () => {
    const sim = emptySim('fam-lance', 60, 56);
    give(sim, carrierItem('lance'));
    give(sim, familiarItem('lamplet'));
    idle(sim, 30); // let it catch up behind the player
    holdRelease(sim, 64);
    const beams = sim.world.atk.beams;
    let player: Beam | null = null;
    let fam: Beam | null = null;
    for (let i = 0; i < beams.count; i++) {
      const b = beams.items[i]!;
      if (b.ownerKind === OWN_PLAYER) player = b;
      if (b.ownerKind === OWN_FAMILIAR) fam = b;
    }
    expect(player).not.toBeNull();
    expect(fam).not.toBeNull();
    expect(fam!.width).toBeLessThan(player!.width);
    expect(fam!.dmg).toBeLessThan(player!.dmg);
  });
});

describe('rider merges are visible', () => {
  it('laser rider: lance feathers, marble side-zaps', () => {
    const lance = emptySim('laser-lance', 24, 56);
    give(lance, carrierItem('lance'));
    give(lance, carrierItem('laser'));
    holdRelease(lance, 64);
    let feathers = 0;
    for (let i = 0; i < lance.world.atk.beams.count; i++) if (lance.world.atk.beams.items[i]!.kind === BK_FEATHER) feathers++;
    expect(feathers).toBe(2);

    const marble = emptySim('laser-marble', 24, 56);
    give(marble, carrierItem('laser'));
    give(marble, carrierItem('marble'));
    expect(marble.world.player.attack.primary).toBe('laser');
  });

  it('melee rider: projectile volleys come with a swipe; beams sweep', () => {
    const sim = emptySim('melee-rider');
    give(sim, carrierItem('melee'));
    give(sim, carrierItem('boomerang'));
    expect(sim.world.player.attack.primary).toBe('boomerang');
    tap(sim);
    expect(sim.world.atk.swipes.count).toBe(1);
    const lance = emptySim('melee-lance', 24, 56);
    give(lance, carrierItem('lance'));
    give(lance, carrierItem('melee'));
    holdRelease(lance, 64);
    const b = lance.world.atk.beams.items[0]!;
    const d0 = b.dir;
    idle(lance, 10);
    expect(Math.abs(b.dir - d0)).toBeGreaterThan(0.2);
  });

  it('boomerang rider: the lance bends back into a U', () => {
    const sim = emptySim('boom-lance', 24, 56);
    give(sim, carrierItem('lance'));
    give(sim, carrierItem('boomerang'));
    holdRelease(sim, 64);
    const b = sim.world.atk.beams.items[0]!;
    let maxX = 0;
    for (let i = 0; i < b.segLen[0]!; i++) maxX = Math.max(maxX, b.px[i]!);
    const last = b.segLen[0]! - 1;
    expect(maxX).toBeGreaterThan(80);
    expect(b.px[last]!).toBeLessThan(maxX - 40);
  });

  it('bomb rider: shots explode; the lance explodes along its length', () => {
    const sim = emptySim('bomb-rider');
    give(sim, carrierItem('bomb'));
    spawnTank(sim, 90, 56);
    tap(sim);
    let booms = 0;
    for (let t = 0; t < 40; t++) {
      idle(sim, 1);
      const q = sim.events;
      for (let i = 0; i < q.count; i++) if (q.at(i).type === 'explosion' && q.at(i).id === 'shot') booms++;
    }
    expect(booms).toBeGreaterThan(0);
    const lance = emptySim('bomb-lance', 24, 56);
    give(lance, carrierItem('lance'));
    give(lance, carrierItem('bomb'));
    holdRelease(lance, 64);
    idle(lance, 1);
    expect(lance.world.atk.explosions.n + liveExplosions(lance.world)).toBeGreaterThanOrEqual(3);
  });

  it('charge rider: release multiplies the volley by the charge', () => {
    const sim = emptySim('charge-rider');
    give(sim, carrierItem('charge'));
    holdRelease(sim, 80);
    const s = sim.world.projectiles.items[0]!;
    expect(sim.world.projectiles.count).toBe(1);
    expect(s.baseDamage).toBeCloseTo(sim.world.player.stats.damage * ATTACK_TUNING.chargeMaxMul, 5);
  });

  it('orbit rider: blades circle you and fire mini volleys with you', () => {
    const sim = emptySim('orbit-rider', 104, 56);
    give(sim, carrierItem('orbit'), 2);
    idle(sim, 2);
    let blades = 0;
    for (let i = 0; i < sim.world.projectiles.count; i++) if (sim.world.projectiles.items[i]!.kind === SK_ORBIT) blades++;
    expect(blades).toBe(3);
    tap(sim);
    let minis = 0;
    for (let i = 0; i < sim.world.projectiles.count; i++) if ((sim.world.projectiles.items[i]!.flags & F_MINI) !== 0) minis++;
    expect(minis).toBe(3);
  });

  it("Wren's keeper marble: the first volley in an uncleared room pierces for triple damage", () => {
    const sim = emptySim('keeper');
    expect(sim.startWave({ count: 1, pool: ['scurrier'] })).toBe(1);
    tap(sim);
    const k = sim.world.projectiles.items[0]!;
    expect(k.flags & F_KEEPER).not.toBe(0);
    expect(k.baseDamage).toBeCloseTo(sim.world.player.stats.damage * 3, 5);
    idle(sim, 20);
    tap(sim);
    let keepers = 0;
    for (let i = 0; i < sim.world.projectiles.count; i++) if ((sim.world.projectiles.items[i]!.flags & F_KEEPER) !== 0) keepers++;
    expect(keepers).toBeLessThanOrEqual(1);
  });
});

describe('guardrails', () => {
  const allMods = (sim: Sim, n: number): void => {
    for (const m of MOD_IDS) {
      const p = sim.world.player;
      for (let i = 0; i < n; i++) p.inv.passives.push(modItem(m as ModId));
    }
    sim.world.player.inv.version++;
    recomputePlayer(sim.world);
  };

  for (const primary of ['marble', 'lance'] as const) {
    it(`every modifier at 5 stacks (${primary}) for 10 s stays under the caps, < 4 ms per step`, () => {
      const sim = arenaSim(`all-mods-${primary}`, 3, 4);
      if (primary !== 'marble') give(sim, carrierItem(primary));
      give(sim, carrierItem('orbit'));
      allMods(sim, 5);
      const input = makeInput({ aimX: 1, aimY: 0 });
      let total = 0;
      let peakShots = 0;
      for (let t = 0; t < 600; t++) {
        const phase = t % 80;
        input.fireHeld = phase < 74;
        input.firePressed = phase === 0;
        input.aimX = input.fireHeld ? 1 : 0;
        input.moveY = Math.sin(t * 0.03) * 0.5;
        const t0 = performance.now();
        sim.step(input);
        total += performance.now() - t0;
        clearEdges(input);
        checkAttackInvariants(sim);
        peakShots = Math.max(peakShots, sim.world.projectiles.count);
      }
      const avg = total / 600;
      expect(avg, `average step ${avg.toFixed(3)} ms`).toBeLessThan(4);
      expect(peakShots).toBeLessThanOrEqual(700);
      expect(liveExplosions(sim.world)).toBeLessThanOrEqual(ATTACK_TUNING.capExplosionsLive);
      expect(damageDealt(sim)).toBeGreaterThan(0);
    });
  }
});
