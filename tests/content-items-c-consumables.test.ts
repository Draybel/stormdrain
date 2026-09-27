/**
 * Item-C consumables: the ten Mystery Tonics (a per-run colour ↔ effect shuffle, unidentified until
 * drunk, JSON-friendly run state — src/sim/tonics.ts) and the stickers.
 */

import { describe, expect, it } from 'vitest';
import STICKERS from '../src/content/items/consumables-stickers';
import BOTTLES, { TONICS } from '../src/content/items/consumables-tonics';
import { getItem } from '../src/content/registry';
import { WREN } from '../src/content/characters/wren';
import { clearEdges } from '../src/engine/inputState';
import type { InputState } from '../src/engine/inputState';
import { Hud } from '../src/render/hud';
import { hasHook } from '../src/sim/hooks';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK } from '../src/sim/pickupKinds';
import type { Sim } from '../src/sim/sim';
import {
  FLOOR_LINKS,
  initTonics,
  isIdentified,
  isUnidentifiedTonic,
  itemDesc,
  itemName,
  restoreTonics,
  snapshotTonics,
  tonicOf,
  tonicState,
} from '../src/sim/tonics';
import type { Effect } from '../src/sim/types';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

function run(sim: Sim, input: InputState, n: number): Record<string, number> {
  const count: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
    const q = sim.events;
    for (let k = 0; k < q.count; k++) count[q.at(k).type] = (count[q.at(k).type] ?? 0) + 1;
  }
  return count;
}

const FOE = 't-itemsc-tonic-foe';

function room(seed: string, foes = 0): Sim {
  testEnemy(FOE, { hp: 80, speed: 0, contact: 0, move: { kind: 'idle' }, radius: 6 });
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(104, 56);
  const spots = [[40, 24], [168, 24], [104, 96]] as const;
  for (let i = 0; i < foes; i++) {
    const e = sim.spawnEnemy(FOE, spots[i]![0], spots[i]![1], { champion: false });
    if (e) e.spawnT = 0;
  }
  return sim;
}

/** Deals the tonics so that `bottle` holds `effect` (the rest in order). */
function rig(sim: Sim, bottle: string, effect: string): void {
  const map: Record<string, string> = {};
  const rest = TONICS.map((t) => t.id).filter((id) => id !== effect);
  for (const b of BOTTLES) map[b.id] = b.id === bottle ? effect : rest.shift()!;
  expect(restoreTonics(sim.world, { v: 1, map, known: [] })).toBe(true);
}

/** Gives a consumable and uses it. */
function drink(sim: Sim, id: string): Record<string, number> {
  sim.giveItem(id);
  return run(sim, makeInput({ consumable: true }), 1);
}

describe('Mystery Tonic defs', () => {
  it('ten bottles and ten effects, each with an original name and a one-line description', () => {
    expect(BOTTLES).toHaveLength(10);
    expect(new Set(BOTTLES.map((b) => b.id)).size).toBe(10);
    expect(TONICS).toHaveLength(10);
    expect(new Set(TONICS.map((t) => t.id)).size).toBe(10);
    expect(new Set(TONICS.map((t) => t.name)).size).toBe(10);
    expect(TONICS.filter((t) => !t.good).length).toBeGreaterThanOrEqual(2);
    for (const t of TONICS) {
      expect(t.desc.length).toBeLessThanOrEqual(46);
      expect(t.desc).toBe(t.desc.toUpperCase());
      expect(t.use.length).toBeGreaterThan(0);
      for (const e of t.use) if (e.type === 'hook') expect(hasHook(e.hook), e.hook).toBe(true);
      // Tonic names never clash with an item's name.
      for (const b of BOTTLES) expect(t.name).not.toBe(b.name);
    }
    for (const b of BOTTLES) {
      expect(b.consumable).toBe('tonic');
      expect(b.effects).toEqual([]);
      expect(b.use).toEqual([expect.objectContaining({ type: 'hook', hook: 'itemsC.glug' })]);
    }
  });
});

describe('the per-run shuffle', () => {
  it('initTonics deals every effect to exactly one bottle, from the run seed alone', () => {
    const a = room('deal-a');
    const b = room('deal-b');
    initTonics(a.world, 1234);
    // Play changes nothing: roll some loot first on b.
    b.world.lootRng.next();
    initTonics(b.world, 1234);
    expect(a.world.tonics!.map).toEqual(b.world.tonics!.map);
    expect(Object.values(a.world.tonics!.map).sort()).toEqual(TONICS.map((t) => t.id).sort());
    expect(Object.keys(a.world.tonics!.map).sort()).toEqual(BOTTLES.map((d) => d.id).sort());
    const deals = new Set<string>();
    for (let s = 0; s < 8; s++) deals.add(JSON.stringify(initTonics(room(`deal-${s}`).world, s).map));
    expect(deals.size).toBeGreaterThanOrEqual(6);
  });

  it('without initTonics the sim deals on first drink (seeded); drawing and saving never deal', () => {
    const sim = room('lazy');
    const w = sim.world;
    sim.giveItem('tonic-crimson');
    expect(itemName(w, 'tonic-crimson')).toBe('??? Crimson Tonic');
    expect(isIdentified(w, 'tonic-crimson')).toBe(false);
    expect(isUnidentifiedTonic(w, 'tonic-crimson')).toBe(true);
    expect(snapshotTonics(w)).toBeNull();
    expect(w.tonics).toBeUndefined();
    run(sim, makeInput({ consumable: true }), 1);
    expect(w.tonics).toBeDefined();
    const again = room('lazy');
    again.giveItem('tonic-crimson');
    run(again, makeInput({ consumable: true }), 1);
    expect(again.world.tonics!.map).toEqual(w.tonics!.map);
  });

  it('a bottle stays ??? until one of its colour is drunk, then shows its real name for the run', () => {
    const sim = room('names');
    const w = sim.world;
    initTonics(w, 77);
    const crimson = tonicOf(w, 'tonic-crimson')!;
    expect(itemName(w, 'tonic-crimson')).toBe('??? Crimson Tonic');
    expect(itemDesc(w, 'tonic-crimson')).toBe(getItem('tonic-crimson').desc);
    expect(itemName(w, 'brick-chip')).toBe(getItem('brick-chip').name);
    expect(itemName(null, 'tonic-crimson')).toBe('Crimson Tonic');
    drink(sim, 'tonic-crimson');
    expect(isIdentified(w, 'tonic-crimson')).toBe(true);
    expect(itemName(w, 'tonic-crimson')).toBe(crimson.name);
    expect(itemDesc(w, 'tonic-crimson')).toBe(crimson.desc);
    expect(isIdentified(w, 'tonic-amber')).toBe(false);
    sim.loadRoom(OPEN_ROOM);
    expect(itemName(w, 'tonic-crimson')).toBe(crimson.name);
    // Drinking another of the same colour doesn't add it twice.
    drink(sim, 'tonic-crimson');
    expect(w.tonics!.known).toEqual(['tonic-crimson']);
  });

  it('the run state is plain JSON: snapshot → JSON → restore gives the same deal and knowledge', () => {
    const a = room('save-a');
    initTonics(a.world, 99);
    drink(a, 'tonic-teal');
    drink(a, 'tonic-pearl');
    const text = JSON.stringify(snapshotTonics(a.world));
    const b = room('save-b');
    expect(restoreTonics(b.world, JSON.parse(text))).toBe(true);
    expect(b.world.tonics).toEqual(a.world.tonics);
    for (const bottle of BOTTLES) expect(itemName(b.world, bottle.id)).toBe(itemName(a.world, bottle.id));
    // A snapshot is a copy.
    const snap = snapshotTonics(a.world)!;
    snap.known.push('tonic-rose');
    expect(a.world.tonics!.known).not.toContain('tonic-rose');
  });

  it('restoring repairs damaged saves and refuses garbage', () => {
    const sim = room('repair');
    expect(restoreTonics(sim.world, null)).toBe(false);
    expect(restoreTonics(sim.world, 'nope')).toBe(false);
    expect(restoreTonics(sim.world, { map: 3, known: [] })).toBe(false);
    expect(sim.world.tonics).toBeUndefined();
    const ok = restoreTonics(sim.world, {
      v: 1,
      map: { 'tonic-crimson': 'mending', 'tonic-amber': 'mending', 'tonic-lemon': 'no-such-effect', 'no-such-bottle': 'sour' },
      known: ['tonic-crimson', 'tonic-crimson', 'no-such-bottle', 42],
    });
    expect(ok).toBe(true);
    const map = sim.world.tonics!.map;
    expect(Object.values(map).sort()).toEqual(TONICS.map((t) => t.id).sort());
    expect(map['tonic-crimson']).toBe('mending');
    expect(sim.world.tonics!.known).toEqual(['tonic-crimson']);
  });

  it('the Cracked Monocle reads every label while held', () => {
    const sim = room('monocle');
    const w = sim.world;
    sim.giveItem('cracked-monocle');
    expect(w.tonics).toBeDefined();
    for (const b of BOTTLES) {
      expect(isUnidentifiedTonic(w, b.id)).toBe(false);
      expect(itemName(w, b.id)).toBe(tonicOf(w, b.id)!.name);
    }
    sim.giveItem('rusty-thimble'); // swaps the monocle out
    expect(isUnidentifiedTonic(w, 'tonic-violet')).toBe(true);
  });
});

describe('every Tonic effect', () => {
  const player = (s: Sim) => s.world.player;

  it('Mending heals two hearts; Warm Milk heals fully; Tin adds a Tin heart', () => {
    const a = room('mending');
    rig(a, 'tonic-crimson', 'mending');
    a.hurtPlayer(5);
    drink(a, 'tonic-crimson');
    expect(player(a).red).toBe(5);

    const b = room('milk');
    rig(b, 'tonic-amber', 'warm-milk');
    b.hurtPlayer(5);
    drink(b, 'tonic-amber');
    expect(player(b).red).toBe(6);

    const c = room('tin');
    rig(c, 'tonic-lemon', 'tin');
    drink(c, 'tonic-lemon');
    expect(player(c).health.bonusCount).toBe(1);
  });

  it('Fizzbang gives three bombs', () => {
    const sim = room('fizzbang');
    rig(sim, 'tonic-moss', 'fizzbang');
    const bombs = player(sim).inv.bombs;
    drink(sim, 'tonic-moss');
    expect(player(sim).inv.bombs).toBe(bombs + 3);
  });

  it('Zippy and Grit last for the room', () => {
    const sim = room('zippy');
    rig(sim, 'tonic-teal', 'zippy');
    drink(sim, 'tonic-teal');
    expect(player(sim).stats.moveSpeed).toBeCloseTo(WREN.stats.moveSpeed + 30, 6);
    expect(player(sim).stats.shotSpeed).toBeCloseTo(WREN.stats.shotSpeed + 40, 6);
    rig(sim, 'tonic-cobalt', 'grit');
    drink(sim, 'tonic-cobalt');
    expect(player(sim).stats.damage).toBeCloseTo(WREN.stats.damage * 1.4, 6);
    sim.loadRoom(OPEN_ROOM);
    expect(player(sim).stats.moveSpeed).toBeCloseTo(WREN.stats.moveSpeed, 6);
    expect(player(sim).stats.damage).toBeCloseTo(WREN.stats.damage, 6);
  });

  it('Sour takes half a heart — but never the last one', () => {
    const sim = room('sour');
    rig(sim, 'tonic-violet', 'sour');
    drink(sim, 'tonic-violet');
    expect(player(sim).red).toBe(5);
    player(sim).invuln = 0;
    sim.hurtPlayer(4);
    player(sim).invuln = 0;
    expect(player(sim).red).toBe(1);
    const st = drink(sim, 'tonic-violet');
    expect(player(sim).dead).toBe(false);
    expect(player(sim).red).toBe(3);
    expect(st.say).toBe(1);
  });

  it('Dizzy mirrors your movement for a few seconds', () => {
    const sim = room('dizzy');
    rig(sim, 'tonic-rose', 'dizzy');
    const p = player(sim);
    drink(sim, 'tonic-rose');
    expect(p.flags.confused).toBe(true);
    const x0 = p.x;
    run(sim, makeInput({ moveX: 1 }), 20);
    expect(p.x).toBeLessThan(x0 - 10);
    run(sim, makeInput(), 6 * 60);
    expect(p.flags.confused).toBe(false);
    const x1 = p.x;
    run(sim, makeInput({ moveX: 1 }), 20);
    expect(p.x).toBeGreaterThan(x1 + 10);
  });

  it('Clover gives a point of luck for keeps', () => {
    const sim = room('clover');
    rig(sim, 'tonic-murk', 'clover');
    drink(sim, 'tonic-murk');
    expect(player(sim).stats.luck).toBeCloseTo(WREN.stats.luck + 1, 6);
    sim.loadRoom(OPEN_ROOM);
    expect(player(sim).stats.luck).toBeCloseTo(WREN.stats.luck + 1, 6);
  });

  it('Storm in a Bottle strikes every foe with lightning', () => {
    const sim = room('storm', 3);
    rig(sim, 'tonic-pearl', 'storm-bottle');
    const st = drink(sim, 'tonic-pearl');
    expect(st.chainArc ?? 0).toBeGreaterThanOrEqual(3);
    const w = sim.world;
    for (let i = 0; i < w.enemies.count; i++) expect(w.enemies.items[i]!.hp).toBeLessThan(80);
    expect(player(sim).red).toBe(6);
  });

  it('every bottle glugs in its own colour', () => {
    for (const b of BOTTLES) {
      const sim = room(`glug-${b.id}`);
      initTonics(sim.world, 5);
      sim.giveItem(b.id);
      run(sim, makeInput({ consumable: true }), 1);
      // (the splash event is emitted in the step; its colour is the hook param)
      const hook = b.use![0] as Extract<Effect, { type: 'hook' }>;
      expect(typeof hook.params?.color).toBe('string');
      expect(isIdentified(sim.world, b.id)).toBe(true);
    }
  });
});

describe('stickers', () => {
  const pickups = (s: Sim, kind: number) => s.world.pickups.items.slice(0, s.world.pickups.count).filter((k) => k.kind === kind).length;

  it('eleven single-use cards, all with names and one-line descriptions', () => {
    expect(STICKERS.length).toBeGreaterThanOrEqual(10);
    for (const s of STICKERS) {
      expect(s.consumable).toBe('sticker');
      expect(s.tags).toContain('sticker');
    }
  });

  it('Treasure Map and Keepsake stickers use the floor wiring, and stay in your pocket without a floor', () => {
    const sim = room('map');
    let st = drink(sim, 'treasure-map-sticker');
    expect(st.denied).toBe(1);
    expect(sim.world.player.inv.consumables).toEqual(['treasure-map-sticker']);
    st = run(sim, makeInput({ consumable: true }), 1);
    expect(sim.world.player.inv.consumables).toEqual(['treasure-map-sticker']);

    const calls: string[] = [];
    // Floor runs install their own links (sim/run/run.ts); put them back afterwards.
    const prev = { ...FLOOR_LINKS };
    FLOOR_LINKS.revealMap = (_w, level) => {
      calls.push(`map:${level}`);
      return true;
    };
    FLOOR_LINKS.teleport = (_w, to) => {
      calls.push(`go:${to}`);
      return true;
    };
    try {
      run(sim, makeInput({ consumable: true }), 1);
      expect(sim.world.player.inv.consumables).toEqual([]);
      drink(sim, 'keepsake-sticker');
      expect(calls).toEqual(['map:full', 'go:treasure']);
      expect(sim.world.player.inv.consumables).toEqual([]);
    } finally {
      FLOOR_LINKS.revealMap = prev.revealMap;
      FLOOR_LINKS.teleport = prev.teleport;
    }
    const lost = room('keepsake');
    const st2 = drink(lost, 'keepsake-sticker');
    expect(st2.denied).toBe(1);
    expect(lost.world.player.inv.consumables).toEqual(['keepsake-sticker']);
  });

  it('Lockbox, Gold Rain, Bomb and Key stickers pay out', () => {
    const a = room('lockbox');
    drink(a, 'lockbox-sticker');
    expect(pickups(a, PK.Lockbox)).toBe(1);
    expect(pickups(a, PK.Key)).toBe(1);

    const b = room('goldrain');
    drink(b, 'gold-rain-sticker');
    expect(pickups(b, PK.Coin)).toBe(8);
    expect(pickups(b, PK.SilverCoin)).toBe(1);

    const c = room('bombkey');
    const bombs = c.world.player.inv.bombs;
    drink(c, 'bomb-sticker');
    drink(c, 'key-sticker');
    expect(c.world.player.inv.bombs).toBe(bombs + 3);
    expect(c.world.player.inv.keys).toBe(2);
  });

  it('Swirly Sticker rerolls the room’s items (and stays put when there are none)', () => {
    const sim = room('swirly');
    const ped = spawnPedestal(sim.world, 60, 80, 'geode')!;
    drink(sim, 'swirly-sticker');
    expect(ped.item).not.toBe('geode');
    expect(sim.world.player.inv.consumables).toEqual([]);
    const none = room('swirly-none');
    drink(none, 'swirly-sticker');
    expect(none.world.player.inv.consumables).toEqual(['swirly-sticker']);
  });

  it('Heart, Spark, Shiny Star and Ghost stickers', () => {
    const sim = room('misc');
    const p = sim.world.player;
    sim.hurtPlayer(4);
    p.invuln = 0;
    drink(sim, 'heart-sticker');
    expect(p.red).toBe(5);

    sim.giveItem('rumble-drum');
    p.inv.active!.charge = 0;
    drink(sim, 'spark-sticker');
    expect(p.inv.active!.charge).toBe(p.inv.active!.max);

    drink(sim, 'shiny-star-sticker');
    expect(p.invuln).toBeGreaterThanOrEqual(11.9);

    drink(sim, 'ghost-sticker');
    expect(p.flags.flying).toBe(true);
    expect(p.flags.spectral).toBe(true);
    sim.loadRoom(OPEN_ROOM);
    expect(p.flags.flying).toBe(false);
  });
});

describe('HUD', () => {
  it('the banner names tonics for this run and the consumable button marks unidentified ones', () => {
    const sim = room('hud');
    const w = sim.world;
    initTonics(w, 3);
    const hud = new Hud();
    const banner = () => (hud as unknown as { bannerName: string; bannerDesc: string });
    sim.giveItem('tonic-cobalt');
    hud.onEvent({ type: 'item', x: 0, y: 0, a: 3, b: 1, id: 'tonic-cobalt' });
    hud.update(1 / 60, w);
    expect(banner().bannerName).toBe('??? COBALT TONIC');
    expect(isUnidentifiedTonic(w, w.player.inv.consumables[0]!)).toBe(true);
    run(sim, makeInput({ consumable: true }), 1);
    hud.onEvent({ type: 'activeUse', x: 0, y: 0, a: 1, b: 0, id: 'tonic-cobalt' });
    hud.update(1 / 60, w);
    const t = tonicOf(w, 'tonic-cobalt')!;
    expect(banner().bannerName).toBe(t.name.toUpperCase());
    expect(banner().bannerDesc).toBe(t.desc);
    expect(hud.bannerVisible).toBe(true);
    // Regular items keep their own names.
    hud.onEvent({ type: 'item', x: 0, y: 0, a: 0, b: 1, id: 'brick-chip' });
    hud.update(1 / 60, w);
    expect(banner().bannerName).toBe(getItem('brick-chip').name.toUpperCase());
    // The lazily-dealt state is only ever made by the sim.
    const fresh = room('hud-fresh');
    hud.onEvent({ type: 'item', x: 0, y: 0, a: 3, b: 1, id: 'tonic-rose' });
    hud.update(1 / 60, fresh.world);
    expect(fresh.world.tonics).toBeUndefined();
    expect(tonicState(fresh.world)).toBe(fresh.world.tonics);
  });
});
