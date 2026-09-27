/**
 * Content integration (the merge of the Phase 6 content packs into the Phase 3-4 main track):
 * - validation, chapter enemy pools / room templates, the nine DESIGN.md item sets transforming through
 *   the set engine in a real run;
 * - Mystery Tonics dealt from the run seed and saved with the run snapshot (identification survives
 *   save / Continue; older snapshots without them are dealt from the seed);
 * - every new active / trinket / consumable usable from the HUD's buttons in a run (input.active /
 *   input.consumable), the floor links (map reveal, teleports) and rerolls in a run;
 * - the new items in the proper pools and on real run pedestals; the debug menu lists everything.
 */

import { describe, expect, it } from 'vitest';
import { CHAPTERS, ENEMIES, SETS, allItems, enemiesInChapter, findItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import activesC from '../src/content/items/actives';
import stickersC from '../src/content/items/consumables-stickers';
import tonicsC from '../src/content/items/consumables-tonics';
import passA1 from '../src/content/items/passives-a-clockwork';
import passA2 from '../src/content/items/passives-a-general';
import passA3 from '../src/content/items/passives-a-mothkin';
import passA4 from '../src/content/items/passives-a-sporeling';
import passA5 from '../src/content/items/passives-a-stormcaller';
import passA6 from '../src/content/items/passives-a-waxen';
import passB1 from '../src/content/items/passives-b-general';
import passB2 from '../src/content/items/passives-b-sets';
import trinketsC from '../src/content/items/trinkets';
import { DebugActions } from '../src/debug/actions';
import { clearEdges } from '../src/engine/inputState';
import { DIR_BITS } from '../src/sim/floor/types';
import { MapVis, roomVis } from '../src/sim/floor/minimap';
import { ROOM_TEMPLATES } from '../src/sim/floor/library';
import { DS } from '../src/sim/doors';
import { chapterFor } from '../src/sim/run/chapters';
import { Sim } from '../src/sim/sim';
import { isIdentified, itemName, tonicOf } from '../src/sim/tonics';
import type { ItemDef, PoolId } from '../src/sim/types';
import { makeInput, stepN } from './helpers/sim';

const PACK_PASSIVES: readonly ItemDef[] = [...passA1, ...passA2, ...passA3, ...passA4, ...passA5, ...passA6, ...passB1, ...passB2];
const PACK_ITEMS: readonly ItemDef[] = [...PACK_PASSIVES, ...activesC, ...trinketsC, ...tonicsC, ...stickersC];
const DESIGN_SETS = ['stormcaller', 'mothkin', 'clockwork', 'sporeling', 'waxen', 'toybox', 'ossuary', 'tidewalker', 'glimmer'];

/** A fresh floor-1 run in god mode, standing in the (enemy-free) start room. */
function freshRun(seed: number | string, opts: { floor?: number } = {}): Sim {
  const sim = Sim.newRun(seed, { curse: null, ...opts });
  sim.world.godMode = true;
  stepN(sim, makeInput(), 2);
  return sim;
}

/** Steps once with the input and returns this tick's events as [type, id, a]. */
function press(sim: Sim, init: Parameters<typeof makeInput>[0]): [string, string, number][] {
  const input = makeInput(init);
  sim.step(input);
  clearEdges(input);
  const out: [string, string, number][] = [];
  for (let i = 0; i < sim.events.count; i++) {
    const e = sim.events.at(i);
    out.push([e.type, e.id, e.a]);
  }
  return out;
}

/** A regular (not secret, not locked) door side of the current room. */
function openSide(sim: Sim): number {
  const run = sim.run!;
  const r = run.room;
  for (let s = 0; s < 4; s++) {
    const bit = DIR_BITS[s]!;
    if ((r.doors & bit) !== 0 && (r.secretDoors & bit) === 0 && (r.lockedDoors & bit) === 0) return s;
  }
  return -1;
}

describe('content integration: data', () => {
  it('validates, with unique display names across items, enemies and bosses', () => {
    expect(validateContent()).toEqual([]);
    const names = new Map<string, string>();
    for (const d of allItems().filter((i) => !i.tags.includes('test'))) names.set(d.name.toUpperCase(), `item ${d.id}`);
    for (const d of ENEMIES.values()) {
      if (d.id.startsWith('t-')) continue;
      expect(names.get(d.name.toUpperCase()), `enemy ${d.id} shares a name`).toBeUndefined();
    }
  });

  it('every chapter has >= 3 spawnable enemies and >= 5 of its own room templates, and its runs use them', () => {
    for (const ch of CHAPTERS.values()) {
      const pool = enemiesInChapter(ch.id).filter((e) => e.weight > 0);
      expect(pool.length, ch.id).toBeGreaterThanOrEqual(3);
      const own = ROOM_TEMPLATES.filter((t) => (t.chapters as readonly string[]).includes(ch.id));
      expect(own.length, ch.id).toBeGreaterThanOrEqual(5);
      // A run on the chapter's first floor only rolls enemies of its pool.
      const sim = Sim.newRun(`pool-${ch.id}`, { floor: ch.floors[0], track: ch.track, curse: null });
      expect(chapterFor(ch.floors[0], ch.track).id).toBe(ch.id);
      const ids = new Set(enemiesInChapter(ch.id).map((e) => e.id));
      let rolled = 0;
      for (const st of sim.run!.data.rooms) {
        for (const wave of st.waves) {
          for (const id of wave) {
            expect(ids.has(id), `${ch.id} rolled ${id}`).toBe(true);
            rolled++;
          }
        }
      }
      expect(rolled, ch.id).toBeGreaterThan(0);
    }
  });

  it('the nine DESIGN.md sets exist with >= 3 members each', () => {
    for (const id of DESIGN_SETS) {
      const set = SETS.get(id);
      expect(set, id).toBeDefined();
      const members = allItems().filter((d) => d.set === id);
      expect(members.length, id).toBeGreaterThanOrEqual(Math.max(3, set!.need));
      // Members carry the set's DESIGN tag too (synergies / tag requirements can find them).
      for (const m of members) expect(m.tags, m.id).toContain(id);
    }
  });

  it('new items sit in the proper pools', () => {
    for (const d of PACK_ITEMS) {
      expect(d.pools.length, d.id).toBeGreaterThan(0);
      if (d.kind === 'passive') expect(d.pools.some((p) => p !== 'chest'), d.id).toBe(true);
      if (d.kind === 'active') expect(d.pools.includes('treasure') || d.pools.includes('shop'), d.id).toBe(true);
      if (d.kind === 'trinket' || d.kind === 'consumable') expect(d.pools, d.id).toContain('chest');
    }
    // Every special pool has something from the packs to offer.
    const pools: PoolId[] = ['treasure', 'shop', 'boss', 'secret', 'deepSecret', 'cursed', 'broker', 'challenge', 'chest', 'trader'];
    for (const p of pools) expect(PACK_ITEMS.some((d) => d.pools.includes(p)), p).toBe(true);
    // The broker's deals are at least quality 2 (sim/run/contents.ts); packs supply some.
    expect(PACK_ITEMS.filter((d) => d.pools.includes('broker') && d.quality >= 2).length).toBeGreaterThanOrEqual(3);
  });

  it('new items turn up on real run pedestals, shelves and rewards', () => {
    const offered = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      for (const floor of [1, 3, 5]) {
        for (const st of Sim.newRun(seed, { floor, curse: null }).run!.data.rooms) {
          for (const id of [...st.items, ...st.shop, st.reward, st.trader]) if (id) offered.add(id);
        }
      }
    }
    const kinds = { passive: 0, active: 0, trinket: 0, consumable: 0 };
    for (const d of PACK_ITEMS) if (offered.has(d.id)) kinds[d.kind]++;
    expect(kinds.passive).toBeGreaterThan(PACK_PASSIVES.length * 0.5);
    expect(kinds.active).toBeGreaterThan(activesC.length * 0.5);
    expect(kinds.trinket + kinds.consumable).toBeGreaterThan(5);
  });

  it('the debug menu lists every item and every enemy', () => {
    const act = new DebugActions({ sim: () => null });
    const items = new Set(act.items().map((d) => d.id));
    for (const d of allItems()) if (!d.tags.includes('test')) expect(items.has(d.id), d.id).toBe(true);
    const foes = new Set(act.enemies().map((d) => d.id));
    for (const d of ENEMIES.values()) if (!d.id.startsWith('t-')) expect(foes.has(d.id), d.id).toBe(true);
  });
});

describe('content integration: sets transform in a run', () => {
  it.each(DESIGN_SETS)('%s: `need` distinct members transform the player once', (id) => {
    const sim = freshRun(`set-${id}`);
    const set = SETS.get(id)!;
    const members = allItems().filter((d) => d.set === id);
    let transforms = 0;
    for (let i = 0; i < set.need; i++) {
      expect(sim.world.player.sets).not.toContain(id);
      sim.giveItem(members[i]!.id);
      for (const [type, eid] of press(sim, {})) if (type === 'transform' && eid === id) transforms++;
    }
    stepN(sim, makeInput(), 30);
    expect(sim.world.player.sets).toContain(id);
    expect(transforms).toBe(1);
    // A further member doesn't transform again; the costume and style are in the loadout.
    if (members[set.need]) sim.giveItem(members[set.need]!.id);
    const again = press(sim, {}).filter(([type]) => type === 'transform');
    expect(again).toEqual([]);
    if (set.costume) expect(sim.world.player.loadout.costumes).toContain(`set:${id}`);
    expect(Number.isFinite(sim.world.player.x)).toBe(true);
  });
});

describe('content integration: Mystery Tonics and the run save', () => {
  it('are dealt from the run seed at the start of a run', () => {
    const a = Sim.newRun('tonic-deal', { curse: null });
    const b = Sim.newRun('tonic-deal', { curse: null });
    expect(a.world.tonics).toBeDefined();
    expect(a.world.tonics!.map).toEqual(b.world.tonics!.map);
    expect(Object.keys(a.world.tonics!.map)).toHaveLength(tonicsC.length);
    // Some other seed deals differently.
    const differs = [1, 2, 3, 4, 5].some((s) => JSON.stringify(Sim.newRun(s, { curse: null }).world.tonics!.map) !== JSON.stringify(a.world.tonics!.map));
    expect(differs).toBe(true);
  });

  it('identification survives the run save and Continue; an older save deals from the seed', () => {
    const sim = freshRun('tonic-save');
    const w = sim.world;
    const bottle = tonicsC[0]!.id;
    const deal = { ...w.tonics!.map };
    sim.giveItem(bottle);
    expect(isIdentified(w, bottle)).toBe(false);
    expect(itemName(w, bottle).startsWith('???')).toBe(true);
    const events = press(sim, { consumable: true });
    expect(events.some(([type, id, a]) => type === 'activeUse' && id === bottle && a === 1)).toBe(true);
    expect(isIdentified(w, bottle)).toBe(true);
    const real = tonicOf(w, bottle)!.name;
    // Next room: a checkpoint (what the run save stores).
    const side = openSide(sim);
    expect(side).toBeGreaterThanOrEqual(0);
    expect(sim.run!.goThroughDoor(side)).toBe(true);
    const snap = JSON.parse(JSON.stringify(sim.snapshot())) as ReturnType<Sim['snapshot']>;
    expect(snap.world.tonics!.known).toContain(bottle);
    const back = Sim.fromSnapshot(snap);
    expect(back.world.tonics!.map).toEqual(deal);
    expect(isIdentified(back.world, bottle)).toBe(true);
    expect(itemName(back.world, bottle)).toBe(real);
    // A snapshot from before tonics were saved: the same deal (from the seed), nothing identified yet.
    const old = JSON.parse(JSON.stringify(snap)) as { world: { tonics?: unknown } };
    delete old.world.tonics;
    const oldSim = Sim.fromSnapshot(old as ReturnType<Sim['snapshot']>);
    expect(oldSim.world.tonics!.map).toEqual(deal);
    expect(oldSim.world.tonics!.known).toEqual([]);
    // The restored run plays on exactly like the original.
    const input = makeInput({ moveX: 0.4, moveY: 0.3, aimX: 1, fireHeld: true });
    const twin = Sim.fromSnapshot(sim.snapshot());
    const back2 = Sim.fromSnapshot(sim.snapshot());
    stepN(twin, input, 120);
    stepN(back2, { ...input }, 120);
    expect(back2.world.player.x).toBe(twin.world.player.x);
    expect(back2.world.lootRng.getState()).toEqual(twin.world.lootRng.getState());
  });
});

describe('content integration: HUD buttons in a run', () => {
  it.each(activesC.map((d) => d.id))('active %s is usable from the active button', (id) => {
    const sim = freshRun(`active-${id}`);
    sim.giveItem(id);
    expect(sim.world.player.inv.active?.id).toBe(id);
    const events = press(sim, { active: true });
    const used = events.some(([type, eid, a]) => type === 'activeUse' && eid === id && a === 0);
    expect(used, `${id}: ${JSON.stringify(events.filter(([t]) => t === 'denied'))}`).toBe(true);
    stepN(sim, makeInput({ aimX: 1, fireHeld: true }), 90);
    const p = sim.world.player;
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p.dead).toBe(false);
  });

  it.each([...tonicsC, ...stickersC].map((d) => d.id))('consumable %s is usable from the consumable button', (id) => {
    const sim = freshRun(`use-${id}`);
    sim.giveItem(id);
    expect(sim.world.player.inv.consumables).toContain(id);
    const events = press(sim, { consumable: true });
    const used = events.some(([type, eid, a]) => type === 'activeUse' && eid === id && a === 1);
    expect(used).toBe(true);
    stepN(sim, makeInput({ aimX: 1, fireHeld: true }), 60);
    expect(Number.isFinite(sim.world.player.x)).toBe(true);
  });

  it('every new trinket goes into the trinket slot the HUD draws', () => {
    for (const d of trinketsC) {
      const sim = freshRun(`trinket-${d.id}`);
      sim.giveItem(d.id);
      expect(sim.world.player.inv.trinkets, d.id).toContain(d.id);
      stepN(sim, makeInput({ aimX: 1, fireHeld: true }), 20);
      expect(Number.isFinite(sim.world.player.x), d.id).toBe(true);
    }
  });

  it('the Treasure Map Sticker reveals the whole floor in a run', () => {
    const sim = freshRun('map-sticker');
    const run = sim.run!;
    sim.giveItem('treasure-map-sticker');
    const events = press(sim, { consumable: true });
    expect(events.some(([type, id]) => type === 'denied' && id === 'nothing')).toBe(false);
    expect(sim.world.player.inv.consumables).toEqual([]);
    for (const r of run.data.layout.rooms) expect(roomVis(run.data.map, r.index), `room ${r.index}`).toBeGreaterThanOrEqual(MapVis.Seen);
  });

  it('the Keepsake Sticker teleports to the Keepsake Room at the end of the tick, opening its lock from inside', () => {
    const sim = freshRun('keepsake-sticker', { floor: 3 });
    const run = sim.run!;
    const treasure = run.data.layout.rooms.findIndex((r) => r.type === 'treasure');
    expect(treasure).toBeGreaterThanOrEqual(0);
    expect(run.data.layout.rooms[treasure]!.lockedDoors).not.toBe(0);
    sim.world.player.inv.keys = 0;
    sim.giveItem('keepsake-sticker');
    press(sim, { consumable: true });
    expect(run.data.current).toBe(treasure);
    expect(sim.snapshot().run.current).toBe(treasure);
    // No key, yet not trapped: the lock opened from the inside.
    for (const slot of sim.world.doors.slots) expect(slot.state).not.toBe(DS.Locked);
    const side = openSide(sim);
    const any = [0, 1, 2, 3].find((s) => sim.world.doors.slots[s]!.to >= 0 && sim.world.doors.slots[s]!.state === DS.Open);
    expect(any ?? side).toBeGreaterThanOrEqual(0);
    stepN(sim, makeInput(), 30);
    expect(sim.run!.goThroughDoor(any!)).toBe(true);
  });

  it('Hopscotch Chalk teleports to another room of the floor', () => {
    const sim = freshRun('hopscotch');
    const run = sim.run!;
    const from = run.data.current;
    sim.giveItem('hopscotch-chalk');
    press(sim, { active: true });
    expect(run.data.current).not.toBe(from);
    expect(run.data.rooms[run.data.current]!.visited).toBe(true);
  });

  it('rerolls in a run never offer locked items and prefer items not seen this run', () => {
    const sim = freshRun('reroll');
    const run = sim.run!;
    const ped = sim.spawnItemPedestal('lead-marble');
    expect(ped).not.toBeNull();
    stepN(sim, makeInput(), 1);
    expect(run.seen('lead-marble')).toBe(true);
    for (let i = 0; i < 6; i++) {
      sim.giveItem('shaken-snow-globe');
      sim.world.player.inv.active!.charge = sim.world.player.inv.active!.max;
      const before = ped!.item;
      press(sim, { active: true });
      const now = ped!.item;
      expect(now).not.toBe(before);
      expect(run.data.locked).not.toContain(now);
      expect(findItem(now)?.kind).toBe('passive');
      stepN(sim, makeInput(), 1);
      expect(run.seen(now)).toBe(true);
    }
  });
});
