/**
 * Polish batch 1 (B1-4): run-state bugs that cost kills, items or health — teleport arrivals, boss contact during
 * the intro, teleports during a boss's death sequence, Pip tunnelling through the Thorn Room toll, and Coin-Op
 * Cocoa charging for nothing.
 */

import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/content/registry';
import type { TeleportTarget } from '../src/content/hooks/itemsC';
import { clearEdges } from '../src/engine/inputState';
import { SRC_PLAYER } from '../src/sim/hittable';
import { DK, DOOR_FRONT_X, DOOR_FRONT_Y, DS } from '../src/sim/doors';
import { DIR_BITS, DIR_OPPOSITE, type FloorRoom, type RoomType } from '../src/sim/floor/types';
import { BONUS_TIN, HEART_CAP, addBonus, bonusHalvesOf, heartRoom } from '../src/sim/health';
import { arrivalSide } from '../src/sim/run/run';
import { Sim } from '../src/sim/sim';
import { makeInput, stepN } from './helpers/sim';

const TARGETS: readonly RoomType[] = ['treasure', 'boss', 'miniboss', 'challenge', 'normal'];

function events(sim: Sim, type: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === type) n++;
  return n;
}

function bossParts(sim: Sim) {
  const out = [];
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) out.push(pool.items[i]!);
  return out;
}

describe('teleport arrivals come in through a door', () => {
  // A random hop lands in a normal room through a door, exactly as walking in would: after the arrival protections
  // (0.5 s of safety, the foes' 0.4 s poof) its fights are ordinary fights, so hits there only count in the first
  // half second. Special rooms must stay hit-free for the whole second.
  it('50 seeds × floors 1 / 5 / 9: no item grabbed, no plate pressed, no hit, never next to the boss', () => {
    const problems: string[] = [];
    let arrivals = 0;
    const kinds: Record<string, number> = {};
    for (let seed = 1; seed <= 50; seed++) {
      for (const floor of [1, 5, 9]) {
        for (const type of TARGETS) {
          const sim = Sim.newRun(seed, { floor, curse: null });
          const run = sim.run!;
          const rooms = run.data.layout.rooms;
          if (!rooms.some((r, i) => r.type === type && i !== run.data.current)) continue;
          // 'normal' stands for Hopscotch Chalk's random hop (to a normal room).
          const to = (type === 'normal' ? 'random' : type) as TeleportTarget;
          if (!run.queueTeleport(to)) {
            problems.push(`seed ${seed} floor ${floor}: ${type} refused`);
            continue;
          }
          const input = makeInput();
          const where = `seed ${seed} floor ${floor} ${type}`;
          for (let t = 0; t < 60; t++) {
            sim.step(input);
            if (t === 0) kinds[run.room.type] = (kinds[run.room.type] ?? 0) + 1;
            if (events(sim, 'item') > 0) problems.push(`${where}: took an item`);
            if (events(sim, 'hurt') > 0 && (type !== 'normal' || t < 30)) problems.push(`${where}: hurt at tick ${t}`);
            if (t === 0 && type === 'normal') {
              for (let i = 0; i < sim.world.enemies.count; i++) {
                const e = sim.world.enemies.items[i]!;
                const d = Math.hypot(e.x - sim.world.player.x, e.y - sim.world.player.y);
                // Out of touching range (templates keep foes off the tiles beside a door front; a diagonal is allowed).
                if (d < e.r + sim.world.player.r + 4) problems.push(`${where}: ${e.def.id} ${d.toFixed(1)} px away on arrival`);
              }
            }
            if (run.room.type === 'challenge' && (sim.world.props.plate.state !== 0 || run.state.plate !== 0)) problems.push(`${where}: pressed the plate`);
            const p = sim.world.player;
            for (const b of bossParts(sim)) {
              if (Math.hypot(b.x - p.x, b.y - p.y) < 48) problems.push(`${where}: ${Math.hypot(b.x - p.x, b.y - p.y).toFixed(1)} px from ${b.def.id} at tick ${t}`);
            }
            if (problems.length > 8) break;
          }
          arrivals++;
          // Walked in through a door of the room.
          const side = run.data.entrySide;
          if (side < 0) problems.push(`${where}: arrived with entrySide ${side}`);
        }
      }
    }
    expect(problems).toEqual([]);
    expect(arrivals).toBeGreaterThan(400);
    expect(kinds.treasure).toBeGreaterThan(100);
    expect(kinds.boss).toBeGreaterThan(100);
    expect(kinds.miniboss).toBeGreaterThan(10);
    expect(kinds.challenge).toBeGreaterThan(10);
  });

  it('a teleport enters at a door front (a restored checkpoint replays the same arrival)', () => {
    const sim = Sim.newRun('tp-door', { floor: 3, curse: null });
    const run = sim.run!;
    expect(run.queueTeleport('treasure')).toBe(true);
    sim.step(makeInput());
    const side = run.data.entrySide;
    expect(side).toBeGreaterThanOrEqual(0);
    expect(run.room.type).toBe('treasure');
    const p = sim.world.player;
    expect([Math.round(p.x), Math.round(p.y)]).toEqual([DOOR_FRONT_X[side], DOOR_FRONT_Y[side]]);
    // The locked Keepsake door opens from inside (no key needed to get out).
    expect(sim.world.doors.slots[side]!.state).toBe(DS.Open);
    const back = Sim.fromSnapshot(sim.snapshot());
    expect([back.world.player.x, back.world.player.y]).toEqual([p.x, p.y]);
  });

  it('secret rooms (hidden walls only) are entered through one of their walls', () => {
    const r = { doors: DIR_BITS[2]! | DIR_BITS[3]!, secretDoors: DIR_BITS[2]! | DIR_BITS[3]! } as FloorRoom;
    expect(arrivalSide(r)).toBe(2);
    expect(arrivalSide({ doors: DIR_BITS[1]! | DIR_BITS[3]!, secretDoors: DIR_BITS[1]! } as FloorRoom)).toBe(3);
    expect(arrivalSide({ doors: 0, secretDoors: 0 } as FloorRoom)).toBe(-1);
    const sim = Sim.newRun('tp-secret', { curse: null });
    const run = sim.run!;
    expect(run.queueTeleport('secret')).toBe(true);
    sim.step(makeInput());
    expect(run.room.type).toBe('secret');
    const side = run.data.entrySide;
    expect(side).toBeGreaterThanOrEqual(0);
    expect(sim.world.doors.slots[side]!.kind).toBe(DK.Secret);
    expect(sim.world.doors.slots[side]!.state).toBe(DS.Open);
  });

  it('a room without any door: the free spot nearest the middle, off the pedestal and away from foes', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const sim = Sim.newRun(seed, { floor: 3, curse: null });
      const run = sim.run!;
      const t = run.data.layout.rooms.find((r) => r.type === 'treasure')!;
      // Cut the room off (no such room exists in real layouts: this exercises the fallback).
      t.doors = 0;
      t.secretDoors = 0;
      expect(run.queueTeleport('treasure')).toBe(true);
      const input = makeInput();
      sim.step(input);
      expect(run.data.current).toBe(t.index);
      expect(run.data.entrySide).toBe(-2);
      for (let i = 0; i < 60; i++) {
        sim.step(input);
        expect(events(sim, 'item')).toBe(0);
      }
      const p = sim.world.player;
      for (let i = 0; i < sim.world.pedestals.count; i++) {
        const ped = sim.world.pedestals.items[i]!;
        expect(Math.hypot(ped.x - p.x, ped.y - p.y)).toBeGreaterThanOrEqual(16);
      }
    }
  });
});

describe('boss intro contact', () => {
  it('a boss standing on the player during its intro deals no damage', () => {
    const sim = Sim.newRun('intro-contact', { floor: 2, curse: null });
    const run = sim.run!;
    run.teleport(run.data.layout.boss);
    const boss = bossParts(sim)[0]!;
    expect(sim.world.boss.introT).toBeGreaterThan(0.5);
    const p = sim.world.player;
    const input = makeInput();
    let hurts = 0;
    // Past the spawn poof, right on top of it until the card is gone.
    for (let t = 0; t < 600 && sim.world.boss.introT > 0; t++) {
      sim.world.safeT = 0;
      p.invuln = 0;
      p.placeAt(boss.x, boss.y);
      sim.step(input);
      hurts += events(sim, 'hurt');
    }
    expect(hurts).toBe(0);
    // After the intro the same contact hurts.
    for (let t = 0; t < 60 && hurts === 0; t++) {
      sim.world.safeT = 0;
      p.invuln = 0;
      p.placeAt(boss.x, boss.y);
      sim.step(input);
      hurts += events(sim, 'hurt');
    }
    expect(hurts).toBeGreaterThan(0);
  });
});

describe('teleports and a boss death', () => {
  it('Hopscotch Chalk during the death sequence is refused; the room clears with its trapdoor and the kill', () => {
    const sim = Sim.newRun('chalk-death', { floor: 2, curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    const bossRoom = run.data.layout.boss;
    run.teleport(bossRoom);
    sim.giveItem('hopscotch-chalk');
    const slot = sim.world.player.inv.active!;
    expect(slot.id).toBe('hopscotch-chalk');
    const input = makeInput();
    // Beat it down (phases cap each blow, so keep hitting through the roars).
    for (let t = 0; t < 60 * 60 && !sim.world.boss.dying; t++) {
      for (const b of bossParts(sim)) if (b.hittable) b.hurt(40, SRC_PLAYER, 0, 0);
      sim.step(input);
    }
    expect(sim.world.boss.dying).toBe(true);
    slot.charge = slot.max;
    input.active = true;
    sim.step(input);
    clearEdges(input);
    input.active = false;
    // Refused: still here, the charge back.
    expect(run.data.current).toBe(bossRoom);
    expect(slot.charge).toBe(slot.max);
    expect(run.queueTeleport('random')).toBe(false);
    for (let t = 0; t < 600 && !run.state.cleared; t++) sim.step(input);
    stepN(sim, input, 2);
    expect(run.data.current).toBe(bossRoom);
    expect(run.state.cleared).toBe(true);
    expect(run.state.trapdoor).toBe(true);
    expect(sim.world.trapdoor.active).toBe(true);
    expect(sim.world.counters.bossKills).toBe(1);
    // And now the chalk works again.
    expect(run.queueTeleport('random')).toBe(true);
  });

  it('a teleport queued on the tick the last foe falls still clears the room first', () => {
    for (let seed = 1; seed < 40; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      const normal = run.data.layout.rooms.find((r) => r.type === 'normal' && run.data.rooms[r.index]!.waves.length > 0);
      if (!normal) continue;
      run.teleport(normal.index);
      stepN(sim, makeInput(), 30);
      if (!sim.world.arena.active) continue;
      sim.killEnemies();
      expect(run.queueTeleport('start')).toBe(true);
      sim.step(makeInput());
      expect(run.data.current).toBe(run.data.layout.start);
      expect(run.data.rooms[normal.index]!.cleared).toBe(true);
      return;
    }
    throw new Error('no room with a wave in 40 seeds');
  });
});

describe('the Thorn Room toll', () => {
  it('a burrowed Pip dashing into a Thorn Room door pays exactly half a heart', () => {
    const pip = CHARACTERS.get('pip')!;
    let checked = 0;
    for (let seed = 1; seed < 200 && checked < 3; seed++) {
      const sim = Sim.newRun(seed, { curse: null }, pip);
      const run = sim.run!;
      const L = run.data.layout;
      const cursed = L.rooms.find((r) => r.type === 'cursed');
      if (!cursed) continue;
      // Stand in the room outside the Thorn Room's door.
      const side = [0, 1, 2, 3].find((s) => (cursed.doors & ~cursed.secretDoors & DIR_BITS[s]!) !== 0)!;
      const outside = L.cells[(cursed.gy + [-1, 0, 1, 0][side]!) * L.width + cursed.gx + [0, 1, 0, -1][side]!]!;
      run.teleport(outside);
      sim.world.godMode = true;
      for (let i = 0; i < 20 && !run.state.cleared; i++) {
        sim.clearRoom();
        stepN(sim, makeInput(), 2);
      }
      sim.world.godMode = false;
      stepN(sim, makeInput(), 40);
      const back = DIR_OPPOSITE[side]!;
      expect(sim.world.doors.slots[back]!.kind).toBe(DK.Cursed);
      const p = sim.world.player;
      // A step inside the door, then DASH into it.
      const dx = [0, 1, 0, -1][back]!;
      const dy = [-1, 0, 1, 0][back]!;
      p.placeAt(DOOR_FRONT_X[back]! - dx * 10, DOOR_FRONT_Y[back]! - dy * 10);
      p.invuln = 0;
      const before = p.health.red + bonusHalvesOf(p.health, BONUS_TIN);
      const input = makeInput({ moveX: dx, moveY: dy });
      let hurts = 0;
      let wentUnder = false;
      input.dash = true;
      for (let t = 0; t < 40 && run.data.current === outside; t++) {
        sim.step(input);
        input.dash = false;
        if (p.underground) wentUnder = true;
        hurts += events(sim, 'hurt');
      }
      expect(wentUnder).toBe(true);
      expect(run.data.current).toBe(cursed.index);
      expect(hurts).toBe(1);
      expect(p.health.red + bonusHalvesOf(p.health, BONUS_TIN)).toBe(before - 1);
      checked++;
    }
    expect(checked).toBe(3);
  });
});

describe('Coin-Op Cocoa', () => {
  it('Marrow at the Tin cap keeps her coins and the charge (refused); with room she pays for Tin', () => {
    const marrow = CHARACTERS.get('marrow')!;
    const sim = Sim.newRun('cocoa', { curse: null }, marrow);
    const p = sim.world.player;
    expect(p.flags.noRedHearts).toBe(true);
    sim.giveItem('coin-op-cocoa');
    p.inv.coins = 20;
    addBonus(p.health, BONUS_TIN, HEART_CAP * 2);
    expect(heartRoom(p.health)).toBe(0);
    const tin = bonusHalvesOf(p.health, BONUS_TIN);
    const input = makeInput({ active: true });
    sim.step(input);
    expect(p.inv.coins).toBe(20);
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(tin);
    const slot = p.inv.active!;
    expect(slot.charge).toBe(slot.max);
    // Room for more: 5 coins buy a Tin heart.
    p.health.bonusCount -= 2;
    p.inv.version++;
    const tin2 = bonusHalvesOf(p.health, BONUS_TIN);
    clearEdges(input);
    stepN(sim, makeInput(), 5);
    sim.step(makeInput({ active: true }));
    expect(p.inv.coins).toBe(15);
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(tin2 + 2);
  });

  it('Wren at full red health is refused too (and pays when hurt)', () => {
    const sim = Sim.newRun('cocoa-wren', { curse: null });
    const p = sim.world.player;
    sim.giveItem('coin-op-cocoa');
    p.inv.coins = 20;
    sim.step(makeInput({ active: true }));
    expect(p.inv.coins).toBe(20);
    p.health.red -= 2;
    stepN(sim, makeInput(), 5);
    sim.step(makeInput({ active: true }));
    expect(p.inv.coins).toBe(15);
    expect(p.health.red).toBe(p.health.redMax);
  });
});
