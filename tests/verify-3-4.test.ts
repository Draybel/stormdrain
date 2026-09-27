/**
 * Phase 3-4 verification: regression tests for what the independent pass found (see DECISIONS.md
 * "Phase 3-4 verification"). The big soak lives in tests/explorer.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { GameSave } from '../src/meta/save';
import { META_KEY, MetaStore } from '../src/meta/metaState';
import { encodeEnvelope } from '../src/meta/saveCodec';
import { MemoryStorage } from '../src/meta/storage';
import { PK } from '../src/sim/pickupKinds';
import { spawnPickup } from '../src/sim/pickups';
import { Sim } from '../src/sim/sim';
import { RUN_TUNING } from '../src/sim/tuning';
import { makeInput, stepN } from './helpers/sim';

const RUN_KEY = 'stormdrain.run';

/** Teleports into the boss room and kills the boss (debug kill: the room clears on the next ticks). */
function beatBoss(sim: Sim): void {
  const run = sim.run!;
  sim.world.godMode = true;
  run.teleport(run.data.layout.boss);
  for (let i = 0; i < 12 && !run.state.cleared; i++) {
    sim.clearRoom();
    stepN(sim, makeInput(), 2);
  }
  expect(run.state.cleared).toBe(true);
}

describe('boss rewards keep clear of the trapdoor', () => {
  it('the reward pedestal lands two cells from the hatch, off the door lanes; loot settles off the hatch', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      beatBoss(sim);
      const w = sim.world;
      const t = w.trapdoor;
      expect(t.active).toBe(true);
      const hatchCol = Math.floor(t.x / 16);
      const hatchRow = Math.floor(t.y / 16);
      let items = 0;
      for (let i = 0; i < w.pedestals.count; i++) {
        const p = w.pedestals.items[i]!;
        if (!p.item) continue;
        items++;
        const col = Math.floor(p.x / 16);
        const row = Math.floor(p.y / 16);
        expect(Math.max(Math.abs(col - hatchCol), Math.abs(row - hatchRow))).toBeGreaterThanOrEqual(2);
        // Off the lanes from the doors to the hatch: never in her face as she walks in.
        expect(col !== hatchCol && row !== hatchRow).toBe(true);
      }
      expect(items).toBe(1);
      // Loot settles off the hatch (the heart pops out from its own cell; spills slide off).
      stepN(sim, makeInput(), 90);
      for (let i = 0; i < w.pickups.count; i++) {
        const k = w.pickups.items[i]!;
        expect(Math.hypot(k.x - t.x, k.y - t.y)).toBeGreaterThan(RUN_TUNING.trapdoorReach + 2);
      }
    }
  });

  it('a pickup lying on the open hatch slides off, so taking it never drops her', () => {
    const sim = Sim.newRun('hatch-loot', { curse: null });
    beatBoss(sim);
    const w = sim.world;
    const t = w.trapdoor;
    const coin = spawnPickup(w, PK.Coin, t.x + 1, t.y, false)!;
    stepN(sim, makeInput(), 60);
    expect(coin.alive).toBe(true);
    expect(Math.hypot(coin.x - t.x, coin.y - t.y)).toBeGreaterThan(RUN_TUNING.trapdoorReach + 2);
    expect(sim.run!.data.floor).toBe(1);
  });
});

describe('snapshots of an opened Broker’s Nook', () => {
  it('the nook room is a copy (not the pre-roll object), so a restore matches the live run', () => {
    let checked = 0;
    for (let seed = 1; seed < 40 && checked < 4; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      beatBoss(sim);
      const run = sim.run!;
      const n = run.data.layout.nook.room;
      if (n < 0) continue;
      checked++;
      expect(run.data.rooms[n]).not.toBe(run.data.nook);
      expect(run.goThroughDoor(run.data.layout.nook.side)).toBe(true);
      const clone = Sim.fromSnapshot(sim.snapshot());
      expect(JSON.stringify(clone.run!.data)).toBe(JSON.stringify(run.data));
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('save robustness at boot', () => {
  it('a meta save damaged beyond repair starts fresh and is written back once (no warning every launch)', () => {
    const storage = new MemoryStorage();
    storage.set(META_KEY, 'nope');
    storage.set(`${META_KEY}.bak`, 'nope');
    const meta = new MetaStore({ storage });
    expect(meta.loaded.status).toBe('corrupt');
    meta.endTick();
    const again = new MetaStore({ storage });
    expect(again.loaded.status).toBe('ok');
    expect(storage.get(`${META_KEY}.corrupt`)).toBe('nope');
  });

  it('an older meta version is stored in the current format after the first tick', () => {
    const storage = new MemoryStorage();
    storage.set(META_KEY, encodeEnvelope(0, { masterVolume: 0.3, achievements: ['first-kill'], oddField: 7 }));
    const meta = new MetaStore({ storage });
    expect(meta.loaded.migratedFrom).toBe(0);
    meta.endTick();
    const raw = JSON.parse(storage.get(META_KEY)!) as { v: number; data: Record<string, unknown> };
    expect(raw.v).toBe(1);
    expect(raw.data.oddField).toBe(7);
    // The old text is the backup.
    expect((JSON.parse(storage.get(`${META_KEY}.bak`)!) as { v: number }).v).toBe(0);
  });

  it('a run save with every copy damaged is dropped at boot and reported once', () => {
    const storage = new MemoryStorage();
    storage.set(RUN_KEY, '{"v":2,"sum":"00000000","data":{}}');
    storage.set(`${RUN_KEY}.bak`, 'garbage');
    const save = new GameSave(storage);
    expect(save.hasRun()).toBe(false);
    expect(save.dropDamagedRun()).toBe(true);
    expect(storage.get(RUN_KEY)).toBeNull();
    expect(storage.get(`${RUN_KEY}.corrupt`)).not.toBeNull();
    expect(new GameSave(storage).dropDamagedRun()).toBe(false);
  });

  it('a readable run save is never dropped', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    const sim = Sim.newRun('keep-me');
    save.host = { savableRun: () => sim };
    save.saveRunNow();
    expect(new GameSave(storage).dropDamagedRun()).toBe(false);
    expect(new GameSave(storage).hasRun()).toBe(true);
  });
});
