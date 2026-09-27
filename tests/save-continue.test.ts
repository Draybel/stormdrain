/**
 * Phase 4A: the run save wired to the Sim — snapshot → RunSaveStore → a "reload" (fresh stores on the
 * same storage) → Sim.fromSnapshot resumes the same room with the same inventory, and plays on
 * identically. Plus the GameSave service: host runs, Continue results, damaged / newer / old saves,
 * abandoning a saved run.
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { GameSave, RUN_SNAPSHOT_MIGRATIONS } from '../src/meta/save';
import { RunSaveStore, RUN_KEY } from '../src/meta/runSave';
import { encodeEnvelope } from '../src/meta/saveCodec';
import { MemoryStorage } from '../src/meta/storage';
import { DK, DOOR_FRONT_X, DOOR_FRONT_Y, DS } from '../src/sim/doors';
import { SRC_PLAYER } from '../src/sim/hittable';
import { RUN_SNAPSHOT_VERSION, type RunSnapshot } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';
import { identifyTonic, isIdentified } from '../src/sim/tonics';
import { Tile } from '../src/sim/tiles';
import { ITEM_TUNING } from '../src/sim/tuning';
import { TONIC_BOTTLES } from '../src/content/items/consumables-tonics';
import { makeInput, stepN } from './helpers/sim';

function openSide(sim: Sim): number {
  return sim.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.kind !== DK.Cursed && s.state === DS.Open);
}

/** A run with some items and pickups, one room in (the start room is behind the player). */
function runOneRoomIn(seed: string): Sim {
  const sim = Sim.newRun(seed, { curse: null });
  sim.world.godMode = true;
  sim.giveItem('brick-chip');
  sim.giveItem('lamplet');
  sim.giveItem('jar-of-lightning');
  sim.addPickups(7, 2, 1);
  stepN(sim, makeInput(), 20);
  expect(sim.run!.goThroughDoor(openSide(sim))).toBe(true);
  return sim;
}

function runStore(storage: MemoryStorage): RunSaveStore {
  return new RunSaveStore({ storage, version: RUN_SNAPSHOT_VERSION, migrations: RUN_SNAPSHOT_MIGRATIONS });
}

describe('run save round trip', () => {
  it('snapshot → RunSaveStore → reload → restore: the same room, floor, inventory and health, then identical play', () => {
    const storage = new MemoryStorage();
    const a = runOneRoomIn('continue-1');
    expect(runStore(storage).save(a.snapshot())).toMatchObject({ ok: true });

    // "Reload the page": new stores on the same storage.
    const loaded = runStore(storage).load<RunSnapshot>();
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.migratedFrom).toBe(RUN_SNAPSHOT_VERSION);
    const b = Sim.fromSnapshot(loaded.data);
    const sa = a.summary();
    const sb = b.summary();
    expect(b.seed).toBe(a.seed);
    expect(sb.run!.floor).toBe(sa.run!.floor);
    expect(sb.run!.room).toBe(sa.run!.room);
    expect(sb.run!.visited).toBe(2);
    expect(sb.inv).toEqual(sa.inv);
    expect(sb.inv.passives).toEqual(['brick-chip', 'lamplet']);
    expect(sb.inv.active?.id).toBe('jar-of-lightning');
    expect(sb.health).toBe(sa.health);
    expect(sb.player).toEqual(sa.player);
    expect(JSON.stringify(sb)).toBe(JSON.stringify(sa));

    // Both play on the same way.
    const ia = makeInput({ moveX: 0.6, moveY: 0.3, aimX: 1, fireHeld: true });
    const ib = makeInput({ moveX: 0.6, moveY: 0.3, aimX: 1, fireHeld: true });
    for (let t = 0; t < 240; t++) {
      a.step(ia);
      b.step(ib);
      clearEdges(ia);
      clearEdges(ib);
    }
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
  });

  it('a transformation-free snapshot restores what was earned before it (sets / announced synergies stay)', () => {
    const a = runOneRoomIn('continue-sets');
    const snap = a.snapshot();
    expect(snap.player.sets).toEqual([]);
    expect(snap.player.synergiesSeen).toEqual([]);
    snap.player.sets = ['imaginary-set'];
    const b = Sim.fromSnapshot(snap);
    // Unknown set ids are kept (a later version may know them) and give nothing.
    expect(b.world.player.sets).toEqual(['imaginary-set']);
    expect(b.summary().stats).toEqual(a.summary().stats);
  });
});

describe('GameSave (the save service)', () => {
  it('saves the host run, offers it for Continue, and clears it', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    expect(save.hasRun()).toBe(false);
    expect(save.loadRun()).toMatchObject({ ok: false, reason: 'empty' });
    // No host run: saving only flushes meta.
    expect(save.saveRunNow()).toBe(true);
    expect(save.hasRun()).toBe(false);

    const sim = runOneRoomIn('continue-2');
    save.host = { savableRun: () => sim };
    expect(save.saveRunNow()).toBe(true);
    expect(save.runSaves).toBe(1);
    expect(save.hasRun()).toBe(true);

    // After a reload.
    const again = new GameSave(storage);
    expect(again.hasRun()).toBe(true);
    const r = again.loadRun();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restored).toBe(false);
    const back = Sim.fromSnapshot(r.snapshot);
    expect(back.run!.data.current).toBe(sim.run!.data.current);
    expect(back.summary().inv).toEqual(sim.summary().inv);

    again.clearRun();
    expect(again.hasRun()).toBe(false);
    expect(storage.get(RUN_KEY)).toBeNull();
    expect(storage.get(`${RUN_KEY}.bak`)).toBeNull();
  });

  it('a damaged latest save continues from the previous room (restored)', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    const sim = runOneRoomIn('continue-3');
    save.host = { savableRun: () => sim };
    save.saveRunNow();
    const firstRoom = sim.run!.data.current;
    stepN(sim, makeInput(), 30);
    sim.clearRoom();
    stepN(sim, makeInput(), 5);
    const side = openSide(sim);
    expect(sim.run!.goThroughDoor(side)).toBe(true);
    save.saveRunNow();
    expect(sim.run!.data.current).not.toBe(firstRoom);
    // Bit rot in the latest copy.
    storage.set(RUN_KEY, storage.get(RUN_KEY)!.replace('"floor":1', '"floor":9'));
    const r = new GameSave(storage).loadRun();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.restored).toBe(true);
    expect(r.snapshot.run.current).toBe(firstRoom);
  });

  it('a run from a newer version is left alone; an unknown old one is reported as damaged', () => {
    const storage = new MemoryStorage();
    storage.set(RUN_KEY, encodeEnvelope(RUN_SNAPSHOT_VERSION + 1, { v: RUN_SNAPSHOT_VERSION + 1, run: {} }));
    const save = new GameSave(storage);
    expect(save.loadRun()).toMatchObject({ ok: false, reason: 'future' });
    // Read-only: a new save never overwrites it.
    const sim = runOneRoomIn('continue-4');
    save.host = { savableRun: () => sim };
    expect(save.saveRunNow()).toBe(false);
    expect(save.lastRunError).toMatch(/newer/);

    const old = new MemoryStorage();
    old.set(RUN_KEY, encodeEnvelope(1, { seed: 'phase-3a' }));
    expect(new GameSave(old).loadRun()).toMatchObject({ ok: false, reason: 'corrupt' });
  });

  it('a New Run over a saved run abandons it: a quit (the win streak ends), the save is gone', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    save.meta.state.stats.winStreak = 3;
    const sim = runOneRoomIn('continue-5');
    save.host = { savableRun: () => sim };
    save.saveRunNow();
    save.abandonSavedRun();
    expect(save.hasRun()).toBe(false);
    expect(save.meta.state.stats.winStreak).toBe(0);
    expect(save.meta.state.stats.deaths).toBe(0);
  });

  it('saveRunNow({ refresh }) re-takes a settled cleared room; a plain save keeps the checkpoint as it is', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    const sim = runOneRoomIn('continue-refresh');
    save.host = { savableRun: () => sim };
    stepN(sim, makeInput(), 30);
    sim.clearRoom();
    stepN(sim, makeInput(), 5);
    expect(sim.run!.state.cleared).toBe(true);
    // Progress after the clear: coins.
    const coins = sim.world.player.inv.coins;
    sim.addPickups(9, 0, 0);
    save.saveRunNow();
    expect(new GameSave(storage).loadRun()).toMatchObject({ ok: true, snapshot: { player: { coins } } });
    save.saveRunNow({ refresh: true });
    expect(new GameSave(storage).loadRun()).toMatchObject({ ok: true, snapshot: { player: { coins: coins + 9 } } });
  });

  it('a finished or dead run is never written (the host decides), and the unlock snapshot comes from meta', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    save.host = { savableRun: () => null };
    save.saveRunNow();
    expect(save.hasRun()).toBe(false);
    expect(save.unlockedForRun()).toEqual([]);
    save.meta.unlock('endings', 'ending1');
    expect(save.unlockedForRun()).toEqual(['ending1']);
  });
});

// ── Polish batch 3 (B3-3): a cleared room is a checkpoint too ────────────────────────────────────────────────────

function bossParts(sim: Sim) {
  const out = [];
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) out.push(pool.items[i]!);
  return out;
}

/** Steps with the meta tracker reading each tick (as the run scene does). */
function play(sim: Sim, save: GameSave | null, n: number, input = makeInput()): void {
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
    save?.tracker.afterStep();
  }
}

/** Floor 1's boss room of a run, walked into through its door; `hurtUntil` beats the boss down that far (0 = dead). */
function bossRun(seed: string, save: GameSave | null, hurtUntil = 0): { sim: Sim; entry: number } {
  const sim = Sim.newRun(seed, { curse: null });
  sim.world.godMode = true;
  const run = sim.run!;
  save?.tracker.startRun(sim);
  run.teleport(run.data.layout.boss);
  const entry = run.data.entrySide;
  play(sim, save, 2);
  for (let t = 0; t < 60 * 120 && !run.state.cleared; t++) {
    const f = sim.world.boss;
    if (hurtUntil > 0 && f.active && f.hp > 0 && f.hp / f.maxHp <= hurtUntil) break;
    for (const b of bossParts(sim)) if (b.hittable) b.hurt(hurtUntil > 0 ? 6 : 40, SRC_PLAYER, 0, 0);
    play(sim, save, 1);
  }
  return { sim, entry };
}

/** Touches the room's free item pedestal (the boss reward) until the item is taken; returns its id. */
function takeReward(sim: Sim, save: GameSave | null): string {
  const w = sim.world;
  const p = w.player;
  const reach = p.r + ITEM_TUNING.pedestalRadius + ITEM_TUNING.pedestalReach - 0.5;
  for (let i = 0; i < w.pedestals.count; i++) {
    const ped = w.pedestals.items[i]!;
    if (!ped.alive || ped.gone || ped.bell || !ped.item || ped.price > 0 || ped.hearts > 0 || ped.prop) continue;
    const id = ped.item;
    for (const [ox, oy] of [
      [0, reach],
      [0, -reach],
      [reach, 0],
      [-reach, 0],
    ] as const) {
      const x = ped.x + ox;
      const y = ped.y + oy;
      if (x < p.r || y < p.r || x > 208 - p.r || y > 112 - p.r) continue;
      if (w.room.get(Math.floor(x / 16), Math.floor(y / 16)) !== Tile.Floor) continue;
      p.placeAt(x, y);
      play(sim, save, 20);
      break;
    }
    // Step away from the pedestal.
    p.placeAt(40, 20);
    play(sim, save, 2);
    return id;
  }
  return '';
}

function held(sim: Sim): string[] {
  const inv = sim.world.player.inv;
  return [...inv.passives, ...(inv.active ? [inv.active.id] : []), ...inv.trinkets];
}

describe('room-clear checkpoints (polish batch 3, B3-3)', () => {
  it('a beaten boss stays beaten: the clear, the trapdoor, the kill and the reward taken survive a save → Continue', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    const { sim, entry } = bossRun('clear-checkpoint-boss', save);
    const run = sim.run!;
    expect(run.state.cleared).toBe(true);
    expect(sim.world.counters.bossKills).toBe(1);
    expect(save.meta.state.stats.bossKills).toBe(1);
    const reward = takeReward(sim, save);
    expect(reward).not.toBe('');
    expect(held(sim)).toContain(reward);
    // Pause / background / quit: the run scene's save (the host) with the refresh.
    save.host = { savableRun: () => sim };
    expect(save.saveRunNow({ refresh: true })).toBe(true);

    // "The app was killed": a fresh save service on the same storage, Continue.
    const again = new GameSave(storage);
    const r = again.loadRun();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = Sim.fromSnapshot(r.snapshot);
    again.tracker.resumeRun(back);
    const s = back.summary();
    expect(s.run!.roomType).toBe('boss');
    expect(s.run!.cleared).toBe(true);
    expect(s.run!.trapdoor).toBe(true);
    expect(s.boss).toBeNull();
    expect(s.enemies.filter((e) => e.hp > 0)).toEqual([]);
    expect(back.world.counters.bossKills).toBe(1);
    expect(held(back)).toContain(reward);
    // No second copy of the reward on a pedestal.
    expect(s.pedestals.filter((p) => p.item === reward)).toEqual([]);
    // She walks back in through the door she came by.
    expect([back.world.player.x, back.world.player.y]).toEqual([DOOR_FRONT_X[entry]!, DOOR_FRONT_Y[entry]!]);
    // The meta tracker doesn't count the boss again.
    play(back, again, 120);
    expect(again.meta.state.stats.bossKills).toBe(1);
    expect(back.world.counters.bossKills).toBe(1);
  });

  it('without a refresh, the checkpoint taken AT the clear already has the trapdoor and the reward on its pedestal', () => {
    const { sim } = bossRun('clear-checkpoint-plain', null);
    const snap = sim.snapshot();
    const run = snap.run.rooms[snap.run.current]!;
    expect(run.cleared).toBe(true);
    expect(run.trapdoor).toBe(true);
    const back = Sim.fromSnapshot(snap);
    const s = back.summary();
    expect(s.run!.trapdoor).toBe(true);
    expect(s.boss).toBeNull();
    const reward = s.pedestals.find((p) => p.item && p.price === 0 && !p.prop);
    expect(reward).toBeDefined();
    expect(back.world.counters.bossKills).toBe(1);
  });

  it('mid-fight nothing is refreshed: the save is still the room entry (the boss at full health)', () => {
    const { sim, entry } = bossRun('clear-checkpoint-midfight', null, 0.6);
    const f = sim.world.boss;
    expect(f.active).toBe(true);
    expect(f.hp).toBeLessThan(f.maxHp);
    sim.world.player.placeAt(60, 80);
    expect(sim.refreshCheckpoint()).toBe(false);
    const back = Sim.fromSnapshot(sim.snapshot());
    back.step(makeInput());
    expect(back.run!.state.cleared).toBe(false);
    expect(back.world.boss.hp).toBe(back.world.boss.maxHp);
    expect(back.world.counters.bossKills).toBe(0);
    expect([back.world.player.x, back.world.player.y]).toEqual([DOOR_FRONT_X[entry]!, DOOR_FRONT_Y[entry]!]);
    expect(back.run!.data.entrySide).toBe(entry);
  });

  it('a restored cleared room replays identically (two restores, 300 ticks of the same input)', () => {
    const { sim } = bossRun('clear-checkpoint-replay', null);
    takeReward(sim, null);
    expect(sim.refreshCheckpoint()).toBe(true);
    const snap = sim.snapshot();
    const a = Sim.fromSnapshot(snap);
    const b = Sim.fromSnapshot(JSON.parse(JSON.stringify(snap)) as RunSnapshot);
    // The restored run's own checkpoint is the one it came from.
    expect(JSON.stringify(a.snapshot())).toBe(JSON.stringify(snap));
    const ia = makeInput({ moveX: -0.4, moveY: 0.7, aimX: 0, aimY: -1, fireHeld: true });
    const ib = makeInput({ moveX: -0.4, moveY: 0.7, aimX: 0, aimY: -1, fireHeld: true });
    for (let t = 0; t < 300; t++) {
      a.step(ia);
      b.step(ib);
      clearEdges(ia);
      clearEdges(ib);
    }
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
  });

  it('pickups and tonic identifications after a clear survive a refreshed save', () => {
    const sim = runOneRoomIn('clear-checkpoint-tonic');
    stepN(sim, makeInput(), 30);
    sim.clearRoom();
    stepN(sim, makeInput(), 5);
    const bottle = TONIC_BOTTLES[0]!.id;
    expect(isIdentified(sim.world, bottle)).toBe(false);
    identifyTonic(sim.world, bottle);
    const coins = sim.world.player.inv.coins;
    sim.addPickups(4, 0, 0);
    expect(sim.refreshCheckpoint()).toBe(true);
    const back = Sim.fromSnapshot(sim.snapshot());
    expect(isIdentified(back.world, bottle)).toBe(true);
    expect(back.world.player.inv.coins).toBe(coins + 4);
  });

  it("a checkpoint inside the start room leaves its hidden-route grate open (only leaving it seals the grate)", () => {
    const sim = Sim.newRun('clear-checkpoint-grate', { curse: null, startRouteChance: 1 });
    const run = sim.run!;
    expect(run.room.type).toBe('start');
    expect(run.state.grate).toBe(1);
    stepN(sim, makeInput(), 10);
    expect(sim.refreshCheckpoint()).toBe(true);
    expect(run.state.grate).toBe(1);
    const back = Sim.fromSnapshot(sim.snapshot());
    expect(back.run!.state.grate).toBe(1);
    expect(back.world.props.grate.active).toBe(true);
  });
});
