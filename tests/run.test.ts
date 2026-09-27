/**
 * Phase 3A: real runs — floors from the generator, template rooms, doors, transitions, clears, the
 * trapdoor, curses and run snapshots, all headless.
 */

import { describe, expect, it } from 'vitest';
import { clearEdges, type InputState } from '../src/engine/inputState';
import { DK, DOOR_X, DOOR_Y, DS, TRAPDOOR_OPEN_TIME } from '../src/sim/doors';
import { DIR_OPPOSITE, FLOOR_CURSES, type FloorCurse } from '../src/sim/floor/types';
import { MapVis, roomVis } from '../src/sim/floor/minimap';
import { chapterFor } from '../src/sim/run/chapters';
import { decodeGrid, encodeGrid } from '../src/sim/run/run';
import type { RoomState, RunSnapshot } from '../src/sim/run/types';
import { RoomGrid } from '../src/sim/room';
import { Sim } from '../src/sim/sim';
import { CHAPTERS } from '../src/content/registry';
import { makeInput, stepN } from './helpers/sim';

/** Kills everything in the room until it counts as cleared (challenge rooms have two waves). */
function clearHere(sim: Sim): void {
  const run = sim.run!;
  const input = makeInput();
  for (let i = 0; i < 12 && !run.state.cleared; i++) {
    sim.clearRoom();
    stepN(sim, input, 2);
  }
  expect(run.state.cleared).toBe(true);
  expect(sim.world.arena.active).toBe(false);
}

/** Bombs the wall slot on `side` from inside the room (god mode keeps Wren safe). */
function bombWall(sim: Sim, side: number): void {
  const x = Math.min(200, Math.max(8, DOOR_X[side]!));
  const y = Math.min(104, Math.max(8, DOOR_Y[side]!));
  sim.explode(x, y);
}

/**
 * Visits every room reachable from the start through doors (bombing secret walls, using keys on
 * locks), clearing each one in god mode, and walks back the way it came. Returns the room order.
 */
function explore(sim: Sim): number[] {
  const run = sim.run!;
  sim.world.godMode = true;
  const order: number[] = [];
  const visit = (): void => {
    const here = run.data.current;
    order.push(here);
    clearHere(sim);
    for (let side = 0; side < 4; side++) {
      const slot = sim.world.doors.slots[side]!;
      if (slot.kind === DK.None || order.includes(slot.to)) continue;
      if (slot.state === DS.Hidden) {
        bombWall(sim, side);
        expect(slot.state).toBe(DS.Open);
      }
      if (slot.state === DS.Locked) {
        sim.addPickups(0, 0, 1);
        expect(run.goThroughDoor(side)).toBe(false);
        expect(slot.state).toBe(DS.Open);
      }
      const to = slot.to;
      expect(run.goThroughDoor(side)).toBe(true);
      expect(run.data.current).toBe(to);
      visit();
      expect(run.goThroughDoor(DIR_OPPOSITE[side]!)).toBe(true);
      expect(run.data.current).toBe(here);
    }
  };
  visit();
  return order;
}

describe('starting a run', () => {
  it('New Run = floor 1 of the main track in the Gutterways, standing in the start room', () => {
    const sim = Sim.newRun(77);
    const s = sim.summary();
    expect(s.run).not.toBeNull();
    expect(s.run!.floor).toBe(1);
    expect(s.run!.track).toBe('main');
    expect(s.run!.chapter).toBe('gutterways');
    expect(s.run!.roomType).toBe('start');
    expect(s.run!.cleared).toBe(true);
    expect(sim.trainingRoom).toBe(false);
    expect(sim.world.doors.enabled).toBe(true);
    expect(sim.world.dummies.count).toBe(0);
    // Standing in the middle; the map knows the start room and its neighbours.
    expect(sim.world.player.x).toBe(104);
    expect(sim.world.player.y).toBe(56);
    const run = sim.run!;
    expect(roomVis(run.data.map, run.data.layout.start)).toBe(MapVis.Visited);
  });

  it('the training yard and custom rooms have no run', () => {
    expect(new Sim({ seed: 1 }).run).toBeNull();
    expect(new Sim({ seed: 1 }).trainingRoom).toBe(true);
    expect(new Sim({ seed: 1, room: ['.............', '.............', '.............', '.............', '.............', '.............', '.............'] }).run).toBeNull();
  });

  it('floors 1-12 map to the chapters of their track', () => {
    for (let f = 1; f <= 12; f++) {
      for (const track of ['main', 'alt'] as const) {
        const c = chapterFor(f, track);
        expect(c.track).toBe(track);
        expect(c.floors).toContain(f);
      }
    }
    expect(CHAPTERS.size).toBe(12);
  });

  it('floor contents depend only on the seed (and the items already seen), not on play', () => {
    // Items seen earlier in the run leave the pools (Phase 3B), so only item picks may differ.
    const strip = (rooms: RoomState[]) => rooms.map((r) => [r.waves, r.champs, r.loot, r.chests, r.boss, r.bossHp, r.goods, r.slots, r.grate, r.alts]);
    const items = (rooms: RoomState[]) => rooms.map((r) => [r.items, r.shop, r.prices, r.hearts, r.reward, r.trader]);
    const a = Sim.newRun('same-seed');
    const b = Sim.newRun('same-seed');
    expect(strip(a.run!.data.rooms)).toEqual(strip(b.run!.data.rooms));
    expect(items(a.run!.data.rooms)).toEqual(items(b.run!.data.rooms));
    // Play b a bit (hurt, bombs, walking through doors) before both drop to floor 2.
    b.world.godMode = false;
    b.hurtPlayer(1);
    b.placeBomb();
    stepN(b, makeInput({ moveX: 1 }), 120);
    explore(b);
    a.run!.skipFloor();
    b.run!.skipFloor();
    expect(a.run!.data.floor).toBe(2);
    expect(b.run!.data.floor).toBe(2);
    expect(JSON.stringify(a.run!.data.layout)).toBe(JSON.stringify(b.run!.data.layout));
    expect(strip(a.run!.data.rooms)).toEqual(strip(b.run!.data.rooms));
    // b saw floor 1's items: none of them is offered again on floor 2.
    const seen = new Set(b.run!.data.seen);
    expect(seen.size).toBeGreaterThan(1);
    for (const r of b.run!.data.rooms) for (const id of [...r.items, ...r.shop, r.reward, r.trader]) if (id) expect(seen.has(id)).toBe(false);
  });

  it('rooms load from their templates with enemies on the markers of normal rooms', () => {
    const sim = Sim.newRun(5);
    const run = sim.run!;
    sim.world.godMode = true;
    const normal = run.data.layout.rooms.find((r) => r.type === 'normal')!;
    run.teleport(normal.index);
    expect(run.data.current).toBe(normal.index);
    expect(sim.world.arena.active).toBe(true);
    const st = run.state;
    expect(sim.world.enemies.count).toBe(st.waves[0]!.filter((id) => id).length);
    const ids = new Set(sim.summary().enemies.map((e) => e.id));
    for (const id of ids) expect(st.waves[0]).toContain(id);
    // Doors shut while they live.
    stepN(sim, makeInput(), 20);
    expect(sim.world.arena.doors).toBe(1);
  });
});

describe('exploring floors', () => {
  it.each([11, 2024, 9001])('seed %s: every room of floors 1-2 is reachable; god mode clears them all', (seed) => {
    const sim = Sim.newRun(seed, { curse: null });
    for (let floor = 1; floor <= 2; floor++) {
      const run = sim.run!;
      expect(run.data.floor).toBe(floor);
      const order = explore(sim);
      const layout = run.data.layout;
      // Every room of the floor: secret + deep secret included, and the nook when it opened after the boss.
      const expected = layout.rooms.map((r) => r.index);
      expect([...new Set(order)].sort((x, y) => x - y)).toEqual(expected);
      for (const i of expected) {
        expect(run.data.rooms[i]!.visited).toBe(true);
        expect(run.data.rooms[i]!.cleared).toBe(true);
      }
      expect(run.data.stats.secretsFound).toBeGreaterThanOrEqual(2);
      // The boss room has the trapdoor now.
      run.teleport(layout.boss);
      expect(sim.world.trapdoor.active).toBe(true);
      run.skipFloor();
    }
    expect(sim.run!.data.floor).toBe(3);
  });

  it('cleared rooms stay cleared (no enemies, doors open) when revisited', () => {
    const sim = Sim.newRun(314, { curse: null });
    const run = sim.run!;
    explore(sim);
    for (const r of run.data.layout.rooms) {
      if (r.type === 'nook') continue;
      run.teleport(r.index);
      expect(sim.world.enemies.count).toBe(0);
      expect(sim.world.arena.active).toBe(false);
      stepN(sim, makeInput(), 3);
      expect(sim.world.arena.doors).toBe(0);
    }
  });

  it('what was left in a room is still there later (pickups, pedestals, broken tiles)', () => {
    const sim = Sim.newRun(99, { curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    const treasure = run.data.layout.rooms.find((r) => r.type === 'treasure')!;
    run.teleport(treasure.index);
    const peds = sim.summary().pedestals.map((p) => p.item);
    expect(peds.length).toBeGreaterThanOrEqual(1);
    expect(peds[0]).toBe(run.state.items[0]);
    sim.spawnPickup('key', 40, 40);
    sim.explode(30, 30);
    const grid = encodeGrid(sim.world.room);
    run.teleport(run.data.layout.start);
    run.teleport(treasure.index);
    expect(sim.summary().pedestals.map((p) => p.item)).toEqual(peds);
    expect(sim.summary().pickups.some((p) => p.kind === 'key')).toBe(true);
    expect(encodeGrid(sim.world.room)).toBe(grid);
  });

  it('grids survive encode/decode', () => {
    const sim = Sim.newRun(3);
    const g = new RoomGrid();
    decodeGrid(encodeGrid(sim.world.room), g);
    expect(Array.from(g.tiles)).toEqual(Array.from(sim.world.room.tiles));
  });
});

describe('doors', () => {
  it('walking into an open door changes the room; the player comes in through the opposite door', () => {
    const sim = Sim.newRun(1234, { curse: null });
    const run = sim.run!;
    const side = sim.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.state === DS.Open);
    expect(side).toBeGreaterThanOrEqual(0);
    const to = sim.world.doors.slots[side]!.to;
    const input = makeInput({ moveX: [0, 1, 0, -1][side]!, moveY: [-1, 0, 1, 0][side]! });
    let entered = -1;
    for (let t = 0; t < 180 && run.data.current !== to; t++) {
      sim.step(input);
      clearEdges(input);
      for (let e = 0; e < sim.events.count; e++) if (sim.events.at(e).type === 'roomEnter') entered = sim.events.at(e).b;
    }
    expect(run.data.current).toBe(to);
    expect(entered).toBe(DIR_OPPOSITE[side]);
    const opp = DIR_OPPOSITE[side]!;
    // Standing just inside the opposite door, safe for a moment.
    expect(Math.abs(sim.world.player.x - [104, 200, 104, 8][opp]!)).toBeLessThan(1);
    expect(Math.abs(sim.world.player.y - [8, 56, 104, 56][opp]!)).toBeLessThan(1);
    expect(sim.world.safeT).toBeGreaterThan(0);
  });

  it('a locked Keepsake Room door (floor 3+) takes a key; without one it stays shut', () => {
    let checked = 0;
    for (let seed = 1; seed < 40 && checked < 3; seed++) {
      const sim = Sim.newRun(seed, { floor: 3, curse: null });
      const run = sim.run!;
      const layout = run.data.layout;
      const treasure = layout.rooms.find((r) => r.type === 'treasure' && r.lockedDoors !== 0);
      if (!treasure) continue;
      const side = [0, 1, 2, 3].find((s) => (treasure.lockedDoors & (1 << s)) !== 0)!;
      const outside = layout.cells[(treasure.gy + [-1, 0, 1, 0][side]!) * layout.width + treasure.gx + [0, 1, 0, -1][side]!]!;
      run.teleport(outside);
      sim.world.godMode = true;
      clearHere(sim);
      const back = DIR_OPPOSITE[side]!;
      const slot = sim.world.doors.slots[back]!;
      expect(slot.kind).toBe(DK.Treasure);
      expect(slot.state).toBe(DS.Locked);
      sim.world.player.inv.keys = 0;
      expect(run.goThroughDoor(back)).toBe(false);
      expect(slot.state).toBe(DS.Locked);
      expect(sim.events.count > 0 && [...Array(sim.events.count).keys()].some((i) => sim.events.at(i).id === 'locked')).toBe(true);
      sim.addPickups(0, 0, 2);
      expect(run.goThroughDoor(back)).toBe(false); // unlocks
      expect(sim.world.player.inv.keys).toBe(1);
      expect(slot.state).toBe(DS.Open);
      expect(run.goThroughDoor(back)).toBe(true);
      expect(run.data.current).toBe(treasure.index);
      // Open from inside too, and it stays open: no second key.
      expect(sim.world.doors.slots[side]!.state).toBe(DS.Open);
      expect(run.goThroughDoor(side)).toBe(true);
      expect(run.goThroughDoor(back)).toBe(true);
      expect(sim.world.player.inv.keys).toBe(1);
      expect(run.data.stats.keysUsed).toBe(1);
      checked++;
    }
    expect(checked).toBe(3);
  });

  it('floors 1-2 have no locked doors', () => {
    for (let seed = 1; seed < 20; seed++) {
      const sim = Sim.newRun(seed);
      expect(sim.run!.data.layout.rooms.every((r) => r.lockedDoors === 0)).toBe(true);
    }
  });

  it('secret walls are invisible until bombed; bombing opens both sides and marks the map', () => {
    const sim = Sim.newRun(4242, { curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    const layout = run.data.layout;
    const secret = layout.rooms[layout.secret]!;
    const side = [0, 1, 2, 3].find((s) => (secret.secretDoors & (1 << s)) !== 0)!;
    const outside = layout.cells[(secret.gy + [-1, 0, 1, 0][side]!) * layout.width + secret.gx + [0, 1, 0, -1][side]!]!;
    run.teleport(outside);
    clearHere(sim);
    const wall = DIR_OPPOSITE[side]!;
    const slot = sim.world.doors.slots[wall]!;
    expect(slot.kind).toBe(DK.Secret);
    expect(slot.state).toBe(DS.Hidden);
    expect(roomVis(run.data.map, secret.index)).toBe(MapVis.Unknown);
    expect(run.goThroughDoor(wall)).toBe(false);
    // A bomb at the wall.
    sim.world.player.placeAt(104, 56);
    sim.explode(Math.min(200, Math.max(8, DOOR_X[wall]!)), Math.min(104, Math.max(8, DOOR_Y[wall]!)));
    expect(slot.state).toBe(DS.Open);
    expect(roomVis(run.data.map, secret.index)).toBeGreaterThanOrEqual(MapVis.Seen);
    expect(run.data.stats.secretsFound).toBe(1);
    expect(run.goThroughDoor(wall)).toBe(true);
    expect(run.data.current).toBe(secret.index);
    expect(sim.world.doors.slots[side]!.state).toBe(DS.Open);
    // A room without a secret wall ignores bombs at its walls.
    run.teleport(layout.start);
    const before = JSON.stringify(sim.world.doors.slots);
    for (let s = 0; s < 4; s++) bombWall(sim, s);
    expect(sim.world.doors.slots.filter((d) => d.state === DS.Hidden).length).toBe(0);
    expect(JSON.stringify(sim.world.doors.slots.map((d) => d.kind))).toBe(JSON.stringify(JSON.parse(before).map((d: { kind: number }) => d.kind)));
  });

  it('Thorn Room doors cost half a heart each way', () => {
    for (let seed = 1; seed < 80; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      const layout = run.data.layout;
      const cursed = layout.rooms.find((r) => r.type === 'cursed');
      if (!cursed) continue;
      const side = [0, 1, 2, 3].find((s) => (cursed.doors & ~cursed.secretDoors & (1 << s)) !== 0)!;
      const outside = layout.cells[(cursed.gy + [-1, 0, 1, 0][side]!) * layout.width + cursed.gx + [0, 1, 0, -1][side]!]!;
      run.teleport(outside);
      sim.world.godMode = true;
      clearHere(sim);
      sim.world.godMode = false;
      const back = DIR_OPPOSITE[side]!;
      expect(sim.world.doors.slots[back]!.kind).toBe(DK.Cursed);
      const red = sim.world.player.red;
      expect(run.goThroughDoor(back)).toBe(true);
      expect(sim.world.player.red).toBe(red - 1);
      sim.world.godMode = true;
      clearHere(sim);
      sim.world.godMode = false;
      sim.world.player.invuln = 1; // i-frames don't dodge the toll
      expect(run.goThroughDoor(side)).toBe(true);
      expect(sim.world.player.red).toBe(red - 2);
      return;
    }
    throw new Error('no cursed room in 80 seeds');
  });
});

describe('floors', () => {
  it('the boss falls → trapdoor → floor 2 of the same track (floor start trigger, fresh map)', () => {
    const sim = Sim.newRun(55, { curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.boss);
    expect(sim.world.enemies.count).toBe(1);
    const boss = sim.summary().enemies[0]!;
    expect(boss.maxHp).toBeGreaterThanOrEqual(90);
    clearHere(sim);
    expect(sim.world.trapdoor.active).toBe(true);
    // The boss reward waits on a pedestal.
    expect(sim.summary().pedestals.length).toBeGreaterThanOrEqual(1);
    // Too early: the trapdoor is still opening.
    sim.world.player.placeAt(sim.world.trapdoor.x, sim.world.trapdoor.y);
    const input = makeInput();
    let floorStart = 0;
    for (let t = 0; t < Math.ceil(TRAPDOOR_OPEN_TIME * 60) + 5 && run.data.floor === 1; t++) {
      sim.world.player.placeAt(sim.world.trapdoor.x, sim.world.trapdoor.y);
      sim.step(input);
      for (let e = 0; e < sim.events.count; e++) if (sim.events.at(e).type === 'floorStart') floorStart = sim.events.at(e).a;
    }
    expect(run.data.floor).toBe(2);
    expect(floorStart).toBe(2);
    expect(run.data.track).toBe('main');
    expect(run.data.chapter).toBe('gutterways');
    expect(run.data.current).toBe(run.data.layout.start);
    expect(run.data.layout.floorIndex).toBe(2);
    expect(run.data.stats.floorsCleared).toBe(1);
    // Floor 3 → chapter 2 (The Rootcellar).
    run.skipFloor();
    expect(run.data.chapter).toBe('rootcellar');
  });

  it('the last floor\'s boss wins the run', () => {
    const sim = Sim.newRun(8, { floor: 12, curse: null });
    const run = sim.run!;
    run.skipFloor();
    expect(run.data.won).toBe(1);
    expect(sim.summary().run!.won).toBe(true);
  });

  it('the Broker\'s Nook may open next to the boss room after the boss (a new room + door)', () => {
    let opened = 0;
    for (let seed = 1; seed < 30; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      run.teleport(run.data.layout.boss);
      const rooms = run.data.layout.rooms.length;
      clearHere(sim);
      if (run.data.layout.nook.room < 0) continue;
      opened++;
      expect(run.data.layout.rooms.length).toBe(rooms + 1);
      expect(run.data.rooms.length).toBe(rooms + 1);
      const side = run.data.layout.nook.side;
      expect(sim.world.doors.slots[side]!.kind).toBe(DK.Nook);
      expect(run.goThroughDoor(side)).toBe(true);
      expect(run.room.type).toBe('nook');
      // Deals cost heart containers.
      const peds = sim.world.pedestals;
      expect(peds.count).toBeGreaterThanOrEqual(2);
      const ped = peds.items[0]!;
      const price = ped.hearts;
      expect(price).toBeGreaterThanOrEqual(1);
      const containers = sim.world.player.health.redMax;
      sim.world.player.placeAt(ped.x, ped.y + 12);
      stepN(sim, makeInput(), 2);
      expect(sim.world.player.health.redMax).toBe(containers - price * 2);
      expect(sim.world.player.inv.passives.length + (sim.world.player.inv.active ? 1 : 0)).toBe(1);
    }
    expect(opened).toBeGreaterThan(3);
  });

  it('shop items cost coins: refused when poor, bought when rich', () => {
    for (let seed = 1; seed < 20; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      const shop = run.data.layout.rooms.find((r) => r.type === 'shop');
      if (!shop) continue;
      run.teleport(shop.index);
      const ped = sim.world.pedestals.items[0]!;
      expect(ped.price).toBeGreaterThan(0);
      const item = ped.item;
      sim.world.player.inv.coins = 0;
      sim.world.player.placeAt(ped.x, ped.y + 12);
      stepN(sim, makeInput(), 2);
      expect(ped.item).toBe(item);
      sim.world.player.placeAt(104, 56);
      stepN(sim, makeInput(), 2);
      sim.addPickups(ped.price + 3, 0, 0);
      sim.world.player.placeAt(ped.x, ped.y + 12);
      stepN(sim, makeInput(), 2);
      expect(ped.item === '' || ped.item !== item).toBe(true);
      expect(sim.world.player.inv.coins).toBe(3);
      return;
    }
    throw new Error('no shop found');
  });
});

describe('curses', () => {
  const forCurse = (c: FloorCurse): Sim => Sim.newRun(21, { curse: c });

  it('every floor gets the forced curse and the world knows it', () => {
    for (const c of FLOOR_CURSES) {
      const sim = forCurse(c);
      expect(sim.run!.data.layout.curse).toBe(c);
      expect(sim.world.curse).toBe(c);
      expect(sim.summary().run!.curse).toBe(c);
      sim.run!.skipFloor();
      expect(sim.world.curse).toBe(c);
    }
    expect(Sim.newRun(21, { curse: null }).world.curse).toBeNull();
  });

  it('Lost Map hides every room but the current one', () => {
    const sim = forCurse('lostMap');
    const run = sim.run!;
    expect(run.data.map.lostMap).toBe(true);
    for (const r of run.data.layout.rooms) {
      if (r.index !== run.data.current) expect(roomVis(run.data.map, r.index)).toBe(MapVis.Unknown);
    }
  });

  it('Deluge: slippery floors (slow to start, long slide)', () => {
    const speedAfter = (c: FloorCurse | null, ticks: number): number => {
      const sim = Sim.newRun(21, { curse: c });
      stepN(sim, makeInput({ moveX: 1 }), ticks);
      return Math.hypot(sim.world.player.vx, sim.world.player.vy);
    };
    expect(speedAfter(null, 5)).toBeGreaterThan(90);
    expect(speedAfter('deluge', 5)).toBeLessThan(50);
  });

  it('Maze: some doors lead to another visited room', () => {
    const sim = forCurse('maze');
    const run = sim.run!;
    sim.world.godMode = true;
    // Visit a few rooms first (no maze shuffles into unvisited rooms).
    const layout = run.data.layout;
    for (const r of layout.rooms) if (!r.secret && r.type !== 'nook') run.teleport(r.index);
    let shuffled = 0;
    for (let i = 0; i < 60; i++) {
      clearHere(sim);
      const side = sim.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.state === DS.Open && s.kind !== DK.Secret);
      const to = sim.world.doors.slots[side]!.to;
      if (sim.world.doors.slots[side]!.kind === DK.Cursed) continue;
      expect(run.goThroughDoor(side)).toBe(true);
      if (run.data.current !== to) shuffled++;
    }
    expect(shuffled).toBeGreaterThan(2);
    expect(shuffled).toBeLessThan(30);
  });
});

describe('snapshots', () => {
  /** A deterministic input script (walks, shoots, bombs now and then). */
  function scripted(t: number, input: InputState): void {
    const phase = Math.floor(t / 45) % 6;
    input.moveX = [1, 0, -1, 0, 0.7, -0.7][phase]!;
    input.moveY = [0, 1, 0, -1, 0.7, -0.7][phase]!;
    input.aimX = [0, 1, 0, -1, 1, 0][phase]!;
    input.aimY = [1, 0, -1, 0, 0, 1][phase]!;
    input.fireHeld = t % 90 < 70;
    input.firePressed = t % 90 === 0;
    input.bomb = t % 200 === 17;
  }

  it('JSON-safe, taken at room entries, and the restored run plays on identically', () => {
    const a = Sim.newRun('snapshots', { curse: null });
    const run = a.run!;
    a.world.godMode = true;
    a.giveItem('lantern-moth');
    a.giveItem('lamplet');
    a.addPickups(12, 3, 1);
    // Walk into the first open neighbour (mid-floor: the start room is behind us).
    const side = a.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.state === DS.Open);
    stepN(a, makeInput(), 30);
    expect(run.goThroughDoor(side)).toBe(true);
    const snap = a.snapshot();
    const text = JSON.stringify(snap);
    const b = Sim.fromSnapshot(JSON.parse(text) as RunSnapshot);
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
    expect(JSON.stringify(b.snapshot())).toBe(text);

    const ia = makeInput();
    const ib = makeInput();
    for (let t = 0; t < 900; t++) {
      scripted(t, ia);
      scripted(t, ib);
      a.step(ia);
      b.step(ib);
      clearEdges(ia);
      clearEdges(ib);
      if (t % 150 === 149) {
        // Clear and move on in both, through the same door.
        a.clearRoom();
        b.clearRoom();
      }
      if (t % 150 === 0 && t > 0 && !a.world.arena.active) {
        const s = a.world.doors.slots.findIndex((d) => d.kind !== DK.None && d.state === DS.Open && d.kind !== DK.Cursed);
        if (s >= 0) {
          expect(a.run!.goThroughDoor(s)).toBe(b.run!.goThroughDoor(s));
        }
      }
      if (t % 60 === 0) expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
    }
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
    // Future floors match too.
    a.run!.skipFloor();
    b.run!.skipFloor();
    expect(JSON.stringify(b.run!.data.layout)).toBe(JSON.stringify(a.run!.data.layout));
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
  });

  it('a snapshot keeps inventory, health, pickups and flags', () => {
    const a = Sim.newRun(606, { curse: 'darkness' });
    a.giveItem('storm-lance');
    a.giveItem('jar-of-lightning');
    a.addPickups(7, 4, 2);
    a.hurtPlayer(1);
    a.world.player.invuln = 0;
    const side = a.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.state === DS.Open);
    a.world.godMode = true;
    a.run!.goThroughDoor(side);
    const b = Sim.fromSnapshot(a.snapshot());
    const sa = a.summary();
    const sb = b.summary();
    expect(sb.inv).toEqual(sa.inv);
    expect(sb.health).toBe(sa.health);
    expect(sb.stats).toEqual(sa.stats);
    expect(sb.attack.primary).toBe('lance');
    expect(b.world.curse).toBe('darkness');
    expect(sb.run).toEqual(sa.run);
  });

  it('snapshots are only for runs, and bad ones are refused', () => {
    expect(() => new Sim({ seed: 1 }).snapshot()).toThrow();
    expect(() => Sim.fromSnapshot({} as RunSnapshot)).toThrow();
  });
});

describe('room details', () => {
  it('standing on the hatch when it opens does not drop you; stepping off and back on does', () => {
    const sim = Sim.newRun(55, { curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.boss);
    const t = sim.world.trapdoor;
    sim.clearRoom();
    // Stand where the hatch will open.
    sim.world.player.placeAt(104, 56);
    const input = makeInput();
    stepN(sim, input, 2);
    expect(t.active).toBe(true);
    for (let i = 0; i < 90; i++) {
      sim.world.player.placeAt(t.x, t.y);
      sim.step(input);
    }
    expect(run.data.floor).toBe(1);
    sim.world.player.placeAt(t.x + 30, t.y);
    stepN(sim, input, 1);
    sim.world.player.placeAt(t.x, t.y);
    stepN(sim, input, 1);
    expect(run.data.floor).toBe(2);
  });

  it('the Rain Barrel Arena: a pressure plate starts three waves behind locked doors, then the reward', () => {
    for (let seed = 1; seed < 60; seed++) {
      const sim = Sim.newRun(seed, { floor: 2, curse: null });
      const run = sim.run!;
      const room = run.data.layout.rooms.find((r) => r.type === 'challenge');
      if (!room) continue;
      sim.world.godMode = true;
      run.teleport(room.index);
      expect(run.state.waves.length).toBe(3);
      // Calm until the plate is pressed: no enemies, doors open, the plate in the middle.
      expect(sim.world.arena.active).toBe(false);
      expect(sim.world.enemies.count).toBe(0);
      expect(sim.world.pedestals.count).toBe(0);
      const plate = sim.world.props.plate;
      expect(plate.active).toBe(true);
      expect(plate.state).toBe(0);
      const cleared = sim.world.counters.roomsCleared;
      sim.world.player.placeAt(plate.x, plate.y);
      stepN(sim, makeInput(), 2);
      expect(plate.state).toBe(1);
      expect(run.state.plate).toBe(1);
      expect(sim.world.arena.active).toBe(true);
      for (let wave = 1; wave <= 3; wave++) {
        expect(run.state.cleared).toBe(false);
        // The doors stay locked between waves too.
        expect(run.goThroughDoor(sim.world.doors.slots.findIndex((s) => s.kind !== DK.None))).toBe(false);
        sim.clearRoom();
        stepN(sim, makeInput(), 2);
        if (wave < 3) {
          expect(sim.world.arena.locked).toBe(true);
          expect(sim.world.counters.roomsCleared).toBe(cleared);
          stepN(sim, makeInput(), 70);
          expect(sim.world.arena.active).toBe(true);
        }
      }
      expect(run.state.cleared).toBe(true);
      expect(run.state.plate).toBe(2);
      expect(sim.world.arena.locked).toBe(false);
      expect(sim.world.counters.roomsCleared).toBe(cleared + 1);
      expect(sim.world.pedestals.count + sim.world.pickups.count).toBeGreaterThan(0);
      return;
    }
    throw new Error('no challenge room in 60 seeds');
  });

  it('special doors look the part from both sides', () => {
    const sim = Sim.newRun(2024, { curse: null });
    const run = sim.run!;
    const layout = run.data.layout;
    for (const type of ['boss', 'treasure', 'shop'] as const) {
      const r = layout.rooms.find((x) => x.type === type)!;
      const side = [0, 1, 2, 3].find((s) => (r.doors & ~r.secretDoors & (1 << s)) !== 0)!;
      const outside = layout.cells[(r.gy + [-1, 0, 1, 0][side]!) * layout.width + r.gx + [0, 1, 0, -1][side]!]!;
      const kind = { boss: DK.Boss, treasure: DK.Treasure, shop: DK.Shop }[type];
      run.teleport(outside);
      expect(sim.world.doors.slots[DIR_OPPOSITE[side]!]!.kind).toBe(kind);
      run.teleport(r.index);
      expect(sim.world.doors.slots[side]!.kind).toBe(kind);
    }
  });

  it('boss rooms hold real bosses (sim/bosses), sturdier deeper down', () => {
    for (let floor = 1; floor <= 11; floor += 2) {
      const sim = Sim.newRun(7, { floor, curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      run.teleport(run.data.layout.boss);
      const e = sim.world.enemies.items[0]!;
      expect(sim.world.enemies.count).toBe(1);
      expect(e.boss).not.toBeNull();
      expect(sim.world.boss.active).toBe(true);
      const def = e.boss!.def;
      expect(e.maxHp).toBeGreaterThanOrEqual(def.hp);
      // Met below its home chapter (fallback pools), it's tougher.
      if (floor >= 3 && def.chapters[0] === 'gutterways') expect(e.maxHp).toBeGreaterThan(def.hp);
    }
  });

  it('a snapshot is small plain JSON', () => {
    const sim = Sim.newRun(1, { floor: 11, curse: null });
    explore(sim);
    const text = JSON.stringify(sim.snapshot());
    expect(text.length).toBeLessThan(60_000);
    expect(JSON.parse(text)).toEqual(sim.snapshot());
  });
});
