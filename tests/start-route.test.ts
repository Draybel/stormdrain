/**
 * Polish batch 1 (B1-3): the hidden route to the alt track's floor 1 (the Drowned Nursery I). On main floor 1 the
 * start room may hold a cracked drain grate (a seeded 50 % from its own 'startRoute' fork): bomb it open and step
 * in, and floor 1 restarts on the alt track with the same seed and inventory — not a cleared floor. Leaving the
 * start room first seals it for good.
 */

import { describe, expect, it } from 'vitest';
import { FLOOR_VARIANT } from '../src/content/sprites/gutterways';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { DK, DS } from '../src/sim/doors';
import { FLOOR_LOOK, floorLookAt } from '../src/sim/floorLook';
import { describeHealth } from '../src/sim/health';
import { START_ROUTE_CHANCE } from '../src/sim/run/run';
import type { RunSnapshot } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';
import { TILE } from '../src/sim/constants';
import { makeInput, stepN } from './helpers/sim';

/** Inventory + health as one comparable string. */
function kit(sim: Sim): string {
  const p = sim.world.player;
  const inv = p.inv;
  return JSON.stringify({
    coins: inv.coins,
    bombs: inv.bombs,
    keys: inv.keys,
    passives: inv.passives,
    active: inv.active ? [inv.active.id, inv.active.charge] : null,
    trinkets: inv.trinkets,
    consumables: inv.consumables,
    health: describeHealth(p.health),
  });
}

/** Blasts the start room's grate open from a safe distance (god mode). */
function blastGrate(sim: Sim): void {
  const g = sim.world.props.grate;
  sim.world.player.placeAt(g.x + 60 > 200 ? g.x - 60 : g.x + 60, g.y);
  sim.explode(g.x, g.y);
  stepN(sim, makeInput(), 3);
}

/** Steps onto the open grate; returns the 'trapdoor' event's via (or ''). */
function stepIn(sim: Sim): string {
  const g = sim.world.props.grate;
  const run = sim.run!;
  const track = run.data.track;
  sim.world.player.placeAt(g.x, g.y);
  let via = '';
  for (let t = 0; t < 5 && run.data.track === track; t++) {
    sim.step(makeInput());
    for (let i = 0; i < sim.events.count; i++) {
      const e = sim.events.at(i);
      if (e.type === 'trapdoor' && e.a === 1) via = e.id;
    }
  }
  return via;
}

describe('the start-room grate on main floor 1', () => {
  it('rolls about half the time, from its own stream (nothing else on the floor moves)', () => {
    expect(START_ROUTE_CHANCE).toBe(0.5);
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      const st = run.data.rooms[run.data.layout.start]!;
      if (st.grate === 1) n++;
      expect(sim.world.props.grate.active).toBe(st.grate === 1);
      // Same seed → same answer.
      expect(Sim.newRun(seed, { curse: null }).run!.data.rooms[run.data.layout.start]!.grate).toBe(st.grate);
      if (seed <= 20) {
        // Forcing it on or off changes nothing but the start room's grate.
        const on = Sim.newRun(seed, { curse: null, startRouteChance: 1 }).run!.data;
        const off = Sim.newRun(seed, { curse: null, startRouteChance: 0 }).run!.data;
        const strip = (d: typeof on) => JSON.stringify({ layout: d.layout, rooms: d.rooms.map((r, i) => (i === d.layout.start ? { ...r, grate: 0 } : r)), nook: d.nook });
        expect(strip(on)).toBe(strip(off));
        expect(strip(on)).toBe(strip(run.data));
        expect(on.rooms[on.layout.start]!.grate).toBe(1);
        expect(off.rooms[off.layout.start]!.grate).toBe(0);
      }
    }
    expect(n).toBeGreaterThan(70);
    expect(n).toBeLessThan(130);
  });

  it('sits on plain floor: never on the spawn cell, a door front, a marker or a decorative grate', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const sim = Sim.newRun(seed, { curse: null, startRouteChance: 1 });
      const g = sim.world.props.grate;
      expect(g.active).toBe(true);
      expect(g.state).toBe(0);
      const c = Math.floor(g.x / TILE);
      const r = Math.floor(g.y / TILE);
      const room = sim.world.room;
      // The player spawns in the middle.
      expect([sim.world.player.x, sim.world.player.y]).toEqual([104, 56]);
      expect([c, r]).not.toEqual([6, 3]);
      expect(floorLookAt(room.styleSeed, c, r, room.get(c, r), room.deco[r * 13 + c]!)).not.toBe(FLOOR_LOOK.grate);
      expect([`6,0`, `12,3`, `6,6`, `0,3`]).not.toContain(`${c},${r}`);
    }
    // The renderer and the sim agree on which frame is the decorative grate.
    expect(FLOOR_LOOK).toEqual(FLOOR_VARIANT);
  });

  it('bomb it open and step in: floor 1 again, on the alt track (Drowned Nursery), same kit, no floor cleared', () => {
    const sim = Sim.newRun('start-route', { curse: null, startRouteChance: 1 });
    const run = sim.run!;
    sim.world.godMode = true;
    sim.addPickups(7, 2, 1);
    const before = kit(sim);
    const g = sim.world.props.grate;
    // Cracked: standing on it does nothing.
    sim.world.player.placeAt(g.x, g.y);
    stepN(sim, makeInput(), 3);
    expect(run.data.track).toBe('main');
    blastGrate(sim);
    expect(g.state).toBe(1);
    expect(run.state.grate).toBe(2);
    const seed = run.data.seed;
    let floorStarts = 0;
    const via = stepIn(sim);
    for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'floorStart') floorStarts++;
    expect(via).toBe('startGrate');
    expect(floorStarts).toBe(1);
    expect(run.data.floor).toBe(1);
    expect(run.data.track).toBe('alt');
    expect(run.data.chapter).toBe('drowned_nursery');
    expect(run.data.seed).toBe(seed);
    expect(run.data.stats.floorsCleared).toBe(0);
    expect(run.room.type).toBe('start');
    expect(kit(sim)).toBe(before);
    // The alt floor 1 has no start-room grate of its own.
    expect(run.state.grate).toBe(0);
    expect(sim.world.props.grate.active).toBe(false);
  });

  it('the alt floor 1 trapdoor leads to alt floor 2', () => {
    const sim = Sim.newRun('start-route-2', { curse: null, startRouteChance: 1 });
    const run = sim.run!;
    sim.world.godMode = true;
    blastGrate(sim);
    expect(stepIn(sim)).toBe('startGrate');
    expect([run.data.floor, run.data.track]).toEqual([1, 'alt']);
    run.teleport(run.data.layout.boss);
    for (let i = 0; i < 20 && !run.state.cleared; i++) {
      sim.clearRoom();
      stepN(sim, makeInput(), 2);
    }
    const t = sim.world.trapdoor;
    stepN(sim, makeInput(), 60);
    sim.world.player.placeAt(t.x + 30, t.y);
    stepN(sim, makeInput(), 1);
    sim.world.player.placeAt(t.x, t.y);
    stepN(sim, makeInput(), 2);
    expect([run.data.floor, run.data.track, run.data.chapter]).toEqual([2, 'alt', 'drowned_nursery']);
    expect(run.data.stats.floorsCleared).toBe(1);
  });

  it('a snapshot in the start room restores the grate cracked (1) or open (2)', () => {
    const sim = Sim.newRun('start-route-snap', { curse: null, startRouteChance: 1 });
    const snap = sim.snapshot();
    const a = Sim.fromSnapshot(JSON.parse(JSON.stringify(snap)) as RunSnapshot);
    expect(a.run!.state.grate).toBe(1);
    expect(a.world.props.grate.active).toBe(true);
    expect(a.world.props.grate.state).toBe(0);
    expect([a.world.props.grate.x, a.world.props.grate.y]).toEqual([sim.world.props.grate.x, sim.world.props.grate.y]);
    const open = JSON.parse(JSON.stringify(snap)) as RunSnapshot;
    open.run.rooms[open.run.layout.start]!.grate = 2;
    const b = Sim.fromSnapshot(open);
    b.world.godMode = true;
    expect(b.world.props.grate.active).toBe(true);
    expect(b.world.props.grate.state).toBe(1);
    // (It arms once she has been off it: she starts in the middle.)
    stepN(b, makeInput(), 1);
    expect(stepIn(b)).toBe('startGrate');
    expect([b.run!.data.floor, b.run!.data.track]).toEqual([1, 'alt']);
  });

  it('leaving the start room (a door or a teleport) seals the grate for good', () => {
    // Through a door and back.
    const sim = Sim.newRun('start-route-seal', { curse: null, startRouteChance: 1 });
    const run = sim.run!;
    sim.world.godMode = true;
    const start = run.data.layout.start;
    const side = sim.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.state === DS.Open);
    expect(side).toBeGreaterThanOrEqual(0);
    expect(run.goThroughDoor(side)).toBe(true);
    expect(run.data.rooms[start]!.grate).toBe(0);
    // The checkpoint of the next room already has it sealed.
    expect(sim.snapshot().run.rooms[start]!.grate).toBe(0);
    for (let i = 0; i < 20 && !run.state.cleared; i++) {
      sim.clearRoom();
      stepN(sim, makeInput(), 2);
    }
    expect(run.goThroughDoor((side + 2) & 3)).toBe(true);
    expect(run.data.current).toBe(start);
    expect(sim.world.props.grate.active).toBe(false);
    // Bombed open, then left: still sealed.
    const b = Sim.newRun('start-route-seal', { curse: null, startRouteChance: 1 });
    b.world.godMode = true;
    blastGrate(b);
    expect(b.run!.state.grate).toBe(2);
    expect(b.run!.queueTeleport('random')).toBe(true);
    stepN(b, makeInput(), 1);
    expect(b.run!.data.current).not.toBe(start);
    expect(b.run!.data.rooms[start]!.grate).toBe(0);
    b.run!.teleport(start);
    expect(b.world.props.grate.active).toBe(false);
  });

  it('never on the alt floor 1 or on main floor 2 and deeper', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const [floor, track] of [
        [1, 'alt'],
        [2, 'main'],
        [5, 'main'],
      ] as const) {
        const sim = Sim.newRun(seed, { floor, track, curse: null, startRouteChance: 1 });
        const run = sim.run!;
        expect(run.data.rooms[run.data.layout.start]!.grate).toBe(0);
        expect(sim.world.props.grate.active).toBe(false);
      }
      // Down the trapdoor from a floor 1 that had one: floor 2's start room has none.
      const s = Sim.newRun(seed, { curse: null, startRouteChance: 1 });
      s.run!.skipFloor();
      expect(s.run!.data.floor).toBe(2);
      expect(s.run!.state.grate).toBe(0);
      expect(s.world.props.grate.active).toBe(false);
    }
  });

  it('the meta save counts a hidden route taken, but no finished (or clean) floor', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage, { now: () => 1_000_000 });
    const sim = Sim.newRun('start-route-meta', { curse: null, startRouteChance: 1 });
    sim.world.godMode = true;
    save.tracker.startRun(sim);
    const m = save.meta.state;
    blastGrate(sim);
    save.tracker.afterStep();
    const g = sim.world.props.grate;
    sim.world.player.placeAt(g.x, g.y);
    for (let t = 0; t < 5 && sim.run!.data.track === 'main'; t++) {
      sim.step(makeInput());
      save.tracker.afterStep();
    }
    expect(sim.run!.data.track).toBe('alt');
    expect(m.stats.floorsCleared).toBe(0);
    expect(m.stats.counters.noDamageFloors ?? 0).toBe(0);
    expect(m.stats.counters.altRoutesTaken).toBe(1);
  });
});
