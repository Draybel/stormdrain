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
import { DK, DS } from '../src/sim/doors';
import { RUN_SNAPSHOT_VERSION, type RunSnapshot } from '../src/sim/run/types';
import { Sim } from '../src/sim/sim';
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
