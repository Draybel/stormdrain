import { describe, expect, it } from 'vitest';
import { WREN } from '../src/content/characters/wren';
import { Rng } from '../src/engine/rng';
import { collectItem, fireTrigger, recomputePlayer, triggerChance, useActive } from '../src/sim/effects';
import { ITEMS, getItem, registerItem } from '../src/content/registry';
import { countItem } from '../src/sim/inventory';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK } from '../src/sim/pickupKinds';
import type { ItemDef, TriggerEffect } from '../src/sim/types';
import { makeInput, makeSim, stepN } from './helpers/sim';

/** An empty 13×7 room with the player in the middle (nothing to bump into). */
const EMPTY = ['.............', '.............', '.............', '......@......', '.............', '.............', '.............'];

function emptySim(seed: number | string = 1) {
  return makeSim(seed, { room: EMPTY });
}

/** Registers an ad-hoc test item once (items are looked up by id when stats are recomputed). */
function testItem(def: ItemDef): ItemDef {
  if (!ITEMS.has(def.id)) registerItem(def);
  return ITEMS.get(def.id)!;
}

describe('item pickup flow', () => {
  it('touching a pedestal takes the item: inventory, stats, hold pose, banner event', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    spawnPedestal(w, p.x + 20, p.y, 'brick-chip');
    const st = stepN(sim, makeInput({ moveX: 1 }), 30);
    expect(p.inv.passives).toEqual(['brick-chip']);
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage + 1, 6);
    expect(st.events.item).toBe(1);
    expect(p.holdItem).toBe('brick-chip');
    expect(w.pedestals.items[0]!.item).toBe('');
    // The hold pose ends after ~0.8 s.
    stepN(sim, makeInput(), 60);
    expect(p.holdItem).toBe('');
    // The pedestal is solid: the player never walked through it.
    expect(p.x).toBeLessThan(w.pedestals.items[0]!.x);
  });

  it('passive duplicates are kept and stack', () => {
    const sim = emptySim();
    sim.giveItem('wind-up-crank');
    sim.giveItem('wind-up-crank');
    const p = sim.world.player;
    expect(countItem(p.inv, 'wind-up-crank')).toBe(2);
    // +0.45 each (polish batch 4: was +0.75).
    expect(p.stats.fireRate).toBeCloseTo(WREN.stats.fireRate + 0.9, 6);
  });

  it('health up adds a filled container (and heals), once per fresh copy', () => {
    const sim = emptySim();
    const p = sim.world.player;
    sim.hurtPlayer(3);
    sim.giveItem('thermos-of-soup');
    expect(p.redMax).toBe(8);
    expect(p.red).toBe(8);
    recomputePlayer(sim.world); // recomputes never re-run one-time effects
    expect(p.redMax).toBe(8);
  });

  it('actives swap: the old one (with its charge) goes back on the pedestal and needs a step away', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    sim.giveItem('jar-of-lightning');
    p.inv.active!.charge = 1; // partly used
    const ped = spawnPedestal(w, p.x + 16, p.y, 'picnic-basket')!;
    stepN(sim, makeInput({ moveX: 1 }), 20);
    expect(p.inv.active?.id).toBe('picnic-basket');
    expect(p.inv.active?.charge).toBe(p.inv.active?.max); // fresh = charged
    expect(ped.item).toBe('jar-of-lightning');
    expect(ped.charge).toBe(1);
    expect(ped.fresh).toBe(false);
    // Still touching it: no ping-pong.
    stepN(sim, makeInput({ moveX: 1 }), 30);
    expect(p.inv.active?.id).toBe('picnic-basket');
    // Step away and come back: swapped again, the jar keeps its old charge.
    stepN(sim, makeInput({ moveX: -1 }), 20);
    stepN(sim, makeInput({ moveX: 1 }), 30);
    expect(p.inv.active?.id).toBe('jar-of-lightning');
    expect(p.inv.active?.charge).toBe(1);
    expect(ped.item).toBe('picnic-basket');
  });

  it('trinkets: one slot; a new one drops the old one on the floor (not re-taken until you step off)', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    sim.giveItem('fridge-magnet');
    expect(p.flags.magnet).toBe(true);
    sim.giveItem('worn-bandage');
    expect(p.inv.trinkets).toEqual(['worn-bandage']);
    expect(p.flags.magnet).toBe(false);
    expect(p.triggers.hurt.length).toBe(1);
    const dropped = w.pickups.items.slice(0, w.pickups.count).find((k) => k.kind === PK.Trinket)!;
    expect(dropped.itemId).toBe('fridge-magnet');
    expect(dropped.fresh).toBe(false);
    // Standing still: it lands next to us but isn't taken back.
    stepN(sim, makeInput(), 60);
    expect(p.inv.trinkets).toEqual(['worn-bandage']);
  });

  it('extraTrinket flag gives a second trinket slot', () => {
    const sim = emptySim();
    const w = sim.world;
    const extra: ItemDef = {
      id: 'test-pocket',
      name: 'Test Pocket',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: [],
      effects: [{ type: 'flag', flag: 'extraTrinket' }],
      sprite: 'test',
    };
    collectItem(w, testItem(extra));
    expect(w.player.inv.trinketSlots).toBe(2);
    sim.giveItem('fridge-magnet');
    sim.giveItem('worn-bandage');
    expect(w.player.inv.trinkets).toEqual(['fridge-magnet', 'worn-bandage']);
  });

  it('consumables: use from the button; empty slot is refused', () => {
    const sim = emptySim();
    const p = sim.world.player;
    sim.giveItem('lucky-sticker');
    expect(p.inv.consumables).toEqual(['lucky-sticker']);
    const keys = p.inv.keys;
    stepN(sim, makeInput({ consumable: true }), 1);
    expect(p.inv.keys).toBe(keys + 1);
    expect(p.inv.consumables).toEqual([]);
    const st = stepN(sim, makeInput({ consumable: true }), 1);
    expect(st.events.denied).toBe(1);
  });

  it('a consumable stat effect is temporary (duration) and heals now', () => {
    const sim = emptySim();
    const p = sim.world.player;
    sim.hurtPlayer(4);
    sim.giveItem('fizz-tonic');
    stepN(sim, makeInput({ consumable: true }), 1);
    expect(p.red).toBe(6);
    expect(p.stats.moveSpeed).toBe(WREN.stats.moveSpeed + 24);
    stepN(sim, makeInput(), 8 * 60 + 2);
    expect(p.stats.moveSpeed).toBe(WREN.stats.moveSpeed);
  });

  it('actives: use when charged, refuse when not, recharge on room clear; timed ones refill over time', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    sim.giveItem('jar-of-lightning');
    let st = stepN(sim, makeInput({ active: true }), 1);
    expect(st.events.activeUse).toBe(1);
    expect(st.events.nova).toBe(1);
    expect(p.inv.active!.charge).toBe(0);
    st = stepN(sim, makeInput({ active: true }), 1);
    expect(st.events.denied).toBe(1);
    sim.roomCleared();
    expect(p.inv.active!.charge).toBe(1);
    sim.roomCleared();
    expect(p.inv.active!.charge).toBe(2);
    sim.roomCleared();
    expect(p.inv.active!.charge).toBe(2); // capped

    sim.giveItem('picnic-basket');
    expect(p.inv.active!.timed).toBe(true);
    expect(useActive(w)).toBe(true);
    expect(w.pickups.count).toBeGreaterThanOrEqual(2); // the basket's snacks (plus the dropped jar pedestal)
    stepN(sim, makeInput(), 60 * 10);
    expect(p.inv.active!.charge).toBeCloseTo(10, 1);
    sim.roomCleared(); // timed items don't use room charge
    expect(p.inv.active!.charge).toBeCloseTo(10, 1);
    st = stepN(sim, makeInput(), 60 * 16);
    expect(p.inv.active!.charge).toBe(25);
    expect(st.events.charged).toBe(1);
  });
});

describe('effect triggers', () => {
  const trig = (chance: number, luck = 0): TriggerEffect => ({ type: 'trigger', on: 'kill', chance, luck, effects: [] });

  it('chance scales with luck and clamps', () => {
    expect(triggerChance(trig(0.3, 0.05), 0)).toBeCloseTo(0.3);
    expect(triggerChance(trig(0.3, 0.05), 4)).toBeCloseTo(0.5);
    expect(triggerChance(trig(0.3, 0.05), 100)).toBe(1);
    expect(triggerChance(trig(0.3, 0.05), -10)).toBe(0);
    expect(triggerChance({ ...trig(0.3, 0.1), maxChance: 0.6 }, 10)).toBe(0.6);
    expect(triggerChance({ type: 'trigger', on: 'hurt', effects: [] }, 0)).toBe(1);
  });

  function coinTrigger(chance: number, luck: number): ItemDef {
    return {
      id: `test-coin-on-kill-${chance}-${luck}`,
      name: 'Test',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: [],
      effects: [{ type: 'trigger', on: 'kill', chance, luck, effects: [{ type: 'pickups', coins: 1 }] }],
      sprite: 'test',
    };
  }

  it('fires at roughly its chance, more often with luck, and deterministically by seed', () => {
    const count = (seed: number, luck: number): number => {
      const sim = emptySim(seed);
      const w = sim.world;
      collectItem(w, testItem(coinTrigger(0.25, 0.05)));
      w.player.luckBonus = luck;
      recomputePlayer(w);
      let fired = 0;
      for (let i = 0; i < 300; i++) {
        const before = w.player.inv.coins;
        fireTrigger(w, 'kill', 0, 0);
        if (w.player.inv.coins > before) fired++;
        w.player.inv.coins = 0;
      }
      return fired;
    };
    const plain = count(9, 0);
    const lucky = count(9, 10); // 25 % + 10 × 5 % = 75 %
    expect(plain).toBeGreaterThan(50);
    expect(plain).toBeLessThan(110);
    expect(lucky).toBeGreaterThan(190);
    expect(count(9, 0)).toBe(plain); // same seed, same rolls
  });

  it('always-on triggers fire every time; chance 0 never does; cooldown limits the rate', () => {
    const sim = emptySim();
    const w = sim.world;
    const def: ItemDef = {
      id: 'test-bomb-on-hurt',
      name: 'Test',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: [],
      effects: [
        { type: 'trigger', on: 'hurt', effects: [{ type: 'pickups', bombs: 1 }] },
        { type: 'trigger', on: 'hurt', chance: 0, effects: [{ type: 'pickups', keys: 1 }] },
        { type: 'trigger', on: 'fire', cooldown: 1, effects: [{ type: 'pickups', coins: 1 }] },
      ],
      sprite: 'test',
    };
    collectItem(w, testItem(def));
    const bombs = w.player.inv.bombs;
    sim.hurtPlayer(1);
    expect(w.player.inv.bombs).toBe(bombs + 1);
    expect(w.player.inv.keys).toBe(0);
    // Fire for 3 s at 3 shots/s: the 1 s cooldown lets it pay out ~3 times, not 9.
    stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 180);
    expect(w.player.inv.coins).toBeGreaterThanOrEqual(2);
    expect(w.player.inv.coins).toBeLessThanOrEqual(4);
  });

  it('a trigger that grants a stat makes it temporary until the room is left', () => {
    const sim = emptySim();
    const w = sim.world;
    collectItem(w, testItem({
      id: 'test-rage',
      name: 'Test',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: [],
      effects: [{ type: 'trigger', on: 'hurt', effects: [{ type: 'stat', stat: 'damage', add: 2 }] }],
      sprite: 'test',
    }));
    sim.hurtPlayer(1);
    expect(w.player.stats.damage).toBeCloseTo(WREN.stats.damage + 2);
    sim.loadRoom(EMPTY);
    expect(w.player.stats.damage).toBeCloseTo(WREN.stats.damage);
  });

  it('the Worn Bandage can drop a half heart when hurt (seeded)', () => {
    let drops = 0;
    for (let seed = 0; seed < 40; seed++) {
      const sim = emptySim(seed);
      sim.giveItem('worn-bandage');
      sim.hurtPlayer(1);
      drops += sim.world.pickups.items.slice(0, sim.world.pickups.count).filter((k) => k.kind === PK.HalfHeart).length;
    }
    expect(drops).toBeGreaterThan(4);
    expect(drops).toBeLessThan(25);
  });

  it('recursion is bounded (trigger → pickup → trigger …)', () => {
    const sim = emptySim();
    const w = sim.world;
    collectItem(w, testItem({
      id: 'test-loop',
      name: 'Test',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: [],
      effects: [{ type: 'trigger', on: 'use', effects: [{ type: 'hook', hook: 'shockwave' }] }],
      sprite: 'test',
    }));
    sim.giveItem('jar-of-lightning');
    expect(() => useActive(w)).not.toThrow();
  });
});

describe('item pools', () => {
  it('the training room rolls three different treasure passives and a carrier, deterministically by seed', () => {
    const a = makeSim('pedestals').summary().pedestals;
    const b = makeSim('pedestals').summary().pedestals;
    expect(a).toEqual(b);
    // Phase 2D: 3 rotating treasure pedestals, 2 actives, a rotating carrier, and the bell.
    expect(a.length).toBe(7);
    expect(a.filter((p) => p.bell)).toHaveLength(1);
    expect(a.filter((p) => p.rotate)).toHaveLength(4);
    expect(getItem(a[5]!.item).tags).toContain('starter-attack');
    const treasure = a.slice(0, 3).map((p) => p.item);
    expect(new Set(treasure).size).toBe(3);
    for (const id of treasure) {
      expect(getItem(id).pools).toContain('treasure');
      expect(getItem(id).kind).toBe('passive');
    }
    const seen = new Set<string>();
    for (let s = 0; s < 30; s++) for (const p of makeSim(s).summary().pedestals.slice(0, 3)) seen.add(p.item);
    expect(seen.size).toBeGreaterThanOrEqual(20);
    // Rng is fine to use for this sanity check.
    expect(new Rng(1).next()).toBe(new Rng(1).next());
  });
});
