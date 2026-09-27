/**
 * Phase 5: the debug tools in a real run, headless — every DebugActions entry the hidden debug menu offers
 * (spawn any item / enemy / boss, god mode, skip floor, reveal map, go to the boss) plus the meta cheats
 * UNLOCK ALL / RESET UNLOCKS through GameSave. The menu itself (touch: 5 taps on PAUSED, keyboard: `) is
 * covered in real WebKit by e2e/debug.spec.ts.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, allCharacters, allItems } from '../src/content/registry';
import { DebugActions } from '../src/debug/actions';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { characterUnlocked, lockedItems, runUnlocks, unlockEverything } from '../src/meta/unlocks';
import { MetaStore } from '../src/meta/metaState';
import { Sim } from '../src/sim/sim';

function runActions(seed: string, save?: GameSave): { sim: Sim; act: DebugActions } {
  const sim = Sim.newRun(seed, {});
  const act = new DebugActions({
    sim: () => sim,
    unlockAll: save ? () => save.debugUnlockAll() : undefined,
    resetUnlocks: save ? () => save.debugResetUnlocks() : undefined,
  });
  return { sim, act };
}

describe('debug actions in a floor run', () => {
  it('spawns any item on a pedestal and any enemy in the room', () => {
    const { sim, act } = runActions('dbg-spawn');
    for (const d of act.items().slice(0, 40)) {
      expect(act.spawnItem(d.id), d.id).toBe(true);
    }
    expect(sim.world.pedestals.count).toBeGreaterThan(0);
    sim.clearRoom();
    let spawned = 0;
    for (const d of act.enemies()) {
      if (sim.world.enemies.count >= 40) sim.killEnemies();
      if (act.spawnEnemy(d.id)) spawned++;
    }
    expect(spawned).toBe(act.enemies().length);
  });

  it('the BOSSES tab lists every boss (bosses, minibosses, finals) and each one can be fought here', () => {
    const { sim, act } = runActions('dbg-boss');
    const defs = act.bossDefs();
    expect(defs.length).toBe(BOSSES.size);
    const kinds = defs.map((d) => d.kind);
    // Grouped: bosses, then minibosses, then finals.
    expect([...kinds].sort((a, b) => ['boss', 'miniboss', 'final'].indexOf(a) - ['boss', 'miniboss', 'final'].indexOf(b))).toEqual(kinds);
    sim.world.godMode = true;
    for (const d of defs) {
      sim.killEnemies();
      // Let the arena notice the room is clear before the next fight.
      for (let i = 0; i < 5; i++) sim.step(Object.assign({}, idle));
      expect(act.bossFight(d.id), d.id).toBe(true);
      expect(sim.world.boss.active).toBe(true);
      expect(sim.world.boss.id).toBe(d.id);
      // A fight already running: a second one waits.
      expect(act.bossFight(d.id)).toBe(false);
    }
  });

  it('god mode, go to the boss, reveal map, skip floor', () => {
    const { sim, act } = runActions('dbg-cheats');
    expect(act.god(true)).toBe(true);
    sim.hurtPlayer(4);
    expect(sim.world.player.dead).toBe(false);
    expect(act.teleport()).toBe(true);
    expect(sim.run!.room.type).toBe('boss');
    expect(sim.world.boss.active).toBe(true);
    expect(act.revealMap()).toBe(true);
    const map = sim.run!.data.map;
    expect(map.vis.every((v) => v > 0)).toBe(true);
    expect(act.skipFloor()).toBe(2);
    expect(sim.run!.data.floor).toBe(2);
    // Outside a run the floor cheats report failure instead of throwing.
    const none = new DebugActions({ sim: () => null });
    expect(none.skipFloor()).toBe(0);
    expect(none.revealMap()).toBe(false);
    expect(none.teleport()).toBe(false);
    expect(none.bossFight()).toBe(false);
    expect(none.unlockAll()).toBe(-1);
    expect(none.resetUnlocks()).toBe(false);
  });
});

const idle = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, fireHeld: false, firePressed: false, fireReleased: false, bomb: false, active: false, consumable: false, dash: false, pause: false, map: false };

describe('UNLOCK ALL / RESET UNLOCKS', () => {
  it('unlockEverything opens every locked item, character, ending and route', () => {
    const meta = new MetaStore({ storage: new MemoryStorage() });
    expect(lockedItems(meta.state).length).toBeGreaterThan(0);
    const n = unlockEverything(meta);
    expect(n).toBeGreaterThan(40);
    expect(lockedItems(meta.state)).toEqual([]);
    for (const c of allCharacters()) expect(characterUnlocked(meta.state, c), c.id).toBe(true);
    const snap = runUnlocks(meta.state);
    for (const e of ['ending1', 'ending2', 'ending3']) expect(snap).toContain(e);
    for (const d of allItems()) if (d.unlock) expect(snap).toContain(d.id);
    // Idempotent.
    expect(unlockEverything(meta)).toBe(0);
  });

  it('through the debug actions: unlock all, then reset to a brand-new player (settings kept)', () => {
    const storage = new MemoryStorage();
    const save = new GameSave(storage);
    save.meta.updateSettings({ musicVol: 0.25 });
    save.meta.addStat('runs', 7);
    const { act } = runActions('dbg-meta', save);
    expect(act.unlockAll()).toBeGreaterThan(40);
    expect(save.unlockedForRun()).toContain('ending2');
    // Saved at once: a fresh load sees it.
    expect(lockedItems(new GameSave(storage).meta.state)).toEqual([]);
    expect(act.resetUnlocks()).toBe(true);
    const m = save.meta.state;
    expect(Object.keys(m.achievements)).toEqual([]);
    // Like a brand-new save: only the starting character.
    for (const [kind, set] of Object.entries(m.unlocks)) expect([...set], kind).toEqual(kind === 'characters' ? ['wren'] : []);
    expect(m.stats.runs).toBe(0);
    expect(m.settings.musicVol).toBe(0.25);
    expect(lockedItems(m).length).toBeGreaterThan(0);
    // The achievement engine waits for every achievement again.
    expect(save.achievements.pending).toBeGreaterThan(40);
    const again = new GameSave(storage);
    expect(Object.keys(again.meta.state.achievements)).toEqual([]);
    expect(again.meta.state.settings.musicVol).toBe(0.25);
  });
});
