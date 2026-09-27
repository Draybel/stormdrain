/**
 * Phase 4A: the item-set transformation engine and the special synergy engine (sim/effects.ts), with
 * test fixtures only (the real sets are content: src/content/sets).
 * - Transformations: `need` DISTINCT held items of a set (duplicates don't count) → 'transform' once,
 *   persistent effects as a loadout source, costume layers, style, one-time instants + hook; kept for the
 *   run (losing an item doesn't undo it) and saved with it.
 * - Synergies: active while every requirement (items and/or distinct tag counts) holds, switched off when
 *   one no longer does; 'synergy' + one-time instants + hook only the first time in a run; style override.
 */

import { describe, expect, it } from 'vitest';
import { getItem, ITEMS, registerItem, registerSet, registerSynergy } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { recomputePlayer, requirementMet, setProgress } from '../src/sim/effects';
import { registerHook } from '../src/sim/hooks';
import { removePassive } from '../src/sim/inventory';
import { DK, DS } from '../src/sim/doors';
import { Sim } from '../src/sim/sim';
import type { GameEventType } from '../src/engine/events';
import type { ItemDef } from '../src/sim/types';
import { makeInput, makeSim, stepN } from './helpers/sim';

const icon = getItem('brick-chip').sprite;
function item(def: Partial<ItemDef> & { id: string }): ItemDef {
  const d: ItemDef = { name: def.id.toUpperCase(), desc: 'TEST', kind: 'passive', quality: 1, pools: [], tags: ['test'], effects: [], sprite: icon, ...def };
  if (!ITEMS.has(d.id)) registerItem(d);
  return ITEMS.get(d.id)!;
}

const calls = { set: 0, syn: 0 };
registerHook('t.set-hook', () => {
  calls.set++;
});
registerHook('t.syn-hook', () => {
  calls.syn++;
});

const HAT = { id: 't-set-hat', layer: 'hat' as const, sprite: typeof icon === 'string' ? (null as never) : icon };
item({ id: 't-set-a', set: 't-set', costume: { id: 't-item-hat', layer: 'hat', sprite: HAT.sprite } });
item({ id: 't-set-b', set: 't-set' });
item({ id: 't-set-c', set: 't-set' });
item({ id: 't-set-d', set: 't-set' });
registerSet({
  id: 't-set',
  name: 'Test Parade',
  desc: 'A TEST TRANSFORMATION',
  need: 3,
  effects: [
    { type: 'stat', stat: 'damage', add: 2 },
    { type: 'flag', flag: 'flying' },
    { type: 'mod', mod: 'pierce' },
    { type: 'hearts', containers: 1 },
  ],
  costume: HAT,
  hook: 't.set-hook',
  style: { color: '#33ff66', trail: 'sparks' },
});

item({ id: 't-tag-1', tags: ['test', 't-tag'] });
item({ id: 't-tag-2', tags: ['test', 't-tag'] });
registerSynergy({
  id: 't-syn',
  name: 'Test Chorus',
  requires: ['brick-chip', { tag: 't-tag', count: 2 }],
  effects: [
    { type: 'stat', stat: 'range', add: 50 },
    { type: 'pickups', coins: 3 },
  ],
  style: { shape: 'star', color: '#ff33ff' },
  hook: 't.syn-hook',
});

function count(sim: Sim, type: GameEventType, id?: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) {
    const e = sim.events.at(i);
    if (e.type === type && (id === undefined || e.id === id)) n++;
  }
  return n;
}

describe('fixtures', () => {
  it('validate like real content', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('item set transformations', () => {
  it('3 DISTINCT items transform once: event, effects as a loadout source, costume, style, one-time hearts + hook', () => {
    calls.set = 0;
    const sim = makeSim('sets-1');
    const p = sim.world.player;
    const damage0 = p.stats.damage;
    const style0 = p.attack.style;
    const red0 = p.redMax;
    sim.giveItem('t-set-a');
    sim.giveItem('t-set-b');
    sim.giveItem('t-set-b');
    expect(setProgress(p, 't-set')).toBe(2);
    expect(p.sets).toEqual([]);
    expect(count(sim, 'transform')).toBe(0);
    expect(p.stats.damage).toBe(damage0);

    sim.giveItem('t-set-c');
    expect(p.sets).toEqual(['t-set']);
    expect(count(sim, 'transform', 't-set')).toBe(1);
    expect(p.stats.damage).toBeCloseTo(damage0 + 2, 6);
    expect(p.flags.flying).toBe(true);
    expect(p.loadout.mods.get('pierce')!.sources).toContain('t-set');
    expect(p.loadout.costumes).toContain('set:t-set');
    expect(p.loadout.styles).toContainEqual({ color: '#33ff66', trail: 'sparks' });
    expect(p.attack.style.body).not.toBe(style0.body);
    expect(p.attack.style.trails).toContain('sparks');
    expect(p.attack.style.accents[0]).toBe('#33ff66');
    // One-time part: +1 heart container, the hook — once.
    expect(p.redMax).toBe(red0 + 2);
    expect(calls.set).toBe(1);

    // A fourth set item, a recompute: no second transformation.
    sim.giveItem('t-set-d');
    recomputePlayer(sim.world);
    expect(count(sim, 'transform')).toBe(1);
    expect(calls.set).toBe(1);
    expect(p.redMax).toBe(red0 + 2);

    // Losing set items doesn't undo it.
    removePassive(p.inv, 't-set-a');
    removePassive(p.inv, 't-set-b');
    removePassive(p.inv, 't-set-b');
    recomputePlayer(sim.world);
    expect(setProgress(p, 't-set')).toBe(2);
    expect(p.sets).toEqual(['t-set']);
    expect(p.stats.damage).toBeCloseTo(damage0 + 2, 6);
    expect(p.flags.flying).toBe(true);
  });

  it('is saved with the run: a restored run keeps it without a second fanfare', () => {
    calls.set = 0;
    const a = Sim.newRun('sets-2', { curse: null });
    a.world.godMode = true;
    for (const id of ['t-set-a', 't-set-b', 't-set-c']) a.giveItem(id);
    expect(a.world.player.sets).toEqual(['t-set']);
    // The item that completed it can go; the transformation stays in the save.
    removePassive(a.world.player.inv, 't-set-c');
    recomputePlayer(a.world);
    stepN(a, makeInput(), 10);
    const side = a.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.kind !== DK.Cursed && s.state === DS.Open);
    expect(a.run!.goThroughDoor(side)).toBe(true);
    const snap = a.snapshot();
    expect(snap.player.sets).toEqual(['t-set']);
    const b = Sim.fromSnapshot(JSON.parse(JSON.stringify(snap)));
    const p = b.world.player;
    expect(p.sets).toEqual(['t-set']);
    expect(p.flags.flying).toBe(true);
    expect(b.summary().stats).toEqual(a.summary().stats);
    expect(p.redMax).toBe(a.world.player.redMax);
    expect(count(b, 'transform')).toBe(0);
    expect(calls.set).toBe(1);
  });

  it('the debug "drop all items" forgets transformations', () => {
    const sim = makeSim('sets-3');
    for (const id of ['t-set-a', 't-set-b', 't-set-c']) sim.giveItem(id);
    sim.resetItems();
    expect(sim.world.player.sets).toEqual([]);
    expect(sim.world.player.flags.flying).toBe(false);
  });
});

describe('special synergies', () => {
  it('switch on when every requirement holds (distinct tag counts), off when one fails; announced once', () => {
    calls.syn = 0;
    const sim = makeSim('syn-1');
    const p = sim.world.player;
    const range0 = p.stats.range;
    const shape0 = p.attack.style.shape;
    sim.giveItem('brick-chip');
    sim.giveItem('t-tag-1');
    sim.giveItem('t-tag-1');
    expect(requirementMet(p, { tag: 't-tag', count: 2 })).toBe(false);
    expect(p.synergies).toEqual([]);

    const coins0 = p.inv.coins;
    sim.giveItem('t-tag-2');
    expect(p.synergies).toEqual(['t-syn']);
    expect(count(sim, 'synergy', 't-syn')).toBe(1);
    expect(p.stats.range).toBeCloseTo(range0 + 50, 6);
    expect(p.attack.style.shape).toBe('star');
    expect(p.inv.coins).toBe(coins0 + 3);
    expect(calls.syn).toBe(1);

    // Losing a required item switches it off (effects and style gone).
    removePassive(p.inv, 'brick-chip');
    recomputePlayer(sim.world);
    expect(p.synergies).toEqual([]);
    expect(p.stats.range).toBeCloseTo(range0, 6);
    expect(p.attack.style.shape).toBe(shape0);

    // Back on: effects again, but no second banner / one-time effects.
    sim.giveItem('brick-chip');
    expect(p.synergies).toEqual(['t-syn']);
    expect(p.stats.range).toBeCloseTo(range0 + 50, 6);
    expect(count(sim, 'synergy')).toBe(1);
    expect(calls.syn).toBe(1);
    expect(p.inv.coins).toBe(coins0 + 3);
    expect(p.synergiesSeen).toEqual(['t-syn']);
  });

  it('the announcement is remembered by a saved run', () => {
    calls.syn = 0;
    const a = Sim.newRun('syn-2', { curse: null });
    a.world.godMode = true;
    for (const id of ['brick-chip', 't-tag-1', 't-tag-2']) a.giveItem(id);
    expect(calls.syn).toBe(1);
    stepN(a, makeInput(), 10);
    const side = a.world.doors.slots.findIndex((s) => s.kind !== DK.None && s.kind !== DK.Cursed && s.state === DS.Open);
    a.run!.goThroughDoor(side);
    const b = Sim.fromSnapshot(a.snapshot());
    expect(b.world.player.synergies).toEqual(['t-syn']);
    expect(b.world.player.synergiesSeen).toEqual(['t-syn']);
    expect(calls.syn).toBe(1);
    expect(count(b, 'synergy')).toBe(0);
  });
});
