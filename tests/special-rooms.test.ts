/**
 * Phase 3B: special rooms and the economy (seeded contents, Magpie's Stall, the donation jar, the
 * Gumball Gambler, Old Pell, the Thorn Room, the Forgotten Pocket, the Broker's Nook), item pools
 * (seen / locked items), hidden routes and the endings flow.
 */

import { describe, expect, it } from 'vitest';
import { floorRng } from '../src/engine/rng';
import { allItems, findItem, registerItem } from '../src/content/registry';
import { generateFloor } from '../src/sim/floor/generate';
import { BONUS_TIN, addBonus, bonusHalvesOf, initHealth } from '../src/sim/health';
import { NPC_BROKER, NPC_MAGPIE } from '../src/sim/roomProps';
import { altRouteAllowed } from '../src/sim/run/run';
import { itemPrice, lockedItemIds, rollItem } from '../src/sim/run/pools';
import type { RoomState } from '../src/sim/run/types';
import { SHOP_TUNING } from '../src/sim/tuning';
import { Sim } from '../src/sim/sim';
import type { ItemDef, PoolId } from '../src/sim/types';
import { Rng } from '../src/engine/rng';
import { fightBoss } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

/** Kills everything in the room until it counts as cleared (bosses included). */
function clearHere(sim: Sim): void {
  const run = sim.run!;
  for (let i = 0; i < 20 && !run.state.cleared; i++) {
    sim.clearRoom();
    stepN(sim, makeInput(), 2);
  }
  expect(run.state.cleared).toBe(true);
}

/** Touches a pedestal for `ticks` ticks (standing just below it). */
function touch(sim: Sim, x: number, y: number, ticks = 2): void {
  for (let i = 0; i < ticks; i++) {
    sim.world.player.placeAt(x, y + 12);
    sim.step(makeInput());
  }
}

function stepAway(sim: Sim): void {
  sim.world.player.placeAt(104, 56);
  stepN(sim, makeInput(), 2);
}

function countEvents(sim: Sim, type: string, id?: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) {
    const e = sim.events.at(i);
    if (e.type === type && (id === undefined || e.id === id)) n++;
  }
  return n;
}

/** The first seed (from `from`) whose floor has a room matching `pick`. */
function findRun(pick: (sim: Sim) => number, opts: Parameters<typeof Sim.newRun>[1] = {}, from = 1, to = 200): { sim: Sim; room: number } {
  for (let seed = from; seed < to; seed++) {
    const sim = Sim.newRun(seed, { curse: null, ...opts });
    const room = pick(sim);
    if (room >= 0) return { sim, room };
  }
  throw new Error('no such run');
}

const roomOfType = (type: string) => (sim: Sim) => sim.run!.data.layout.rooms.findIndex((r) => r.type === type);
const roomWith = (f: (st: RoomState) => boolean) => (sim: Sim) => sim.run!.data.rooms.findIndex(f);

describe('seeded special rooms', () => {
  it('populate deterministically: the same seed rolls the same rooms and puts the same things in them', () => {
    for (const seed of [3, 17, 42, 'magpie']) {
      const a = Sim.newRun(seed, { curse: null, floor: 2 });
      const b = Sim.newRun(seed, { curse: null, floor: 2 });
      expect(JSON.stringify(a.run!.data.rooms)).toBe(JSON.stringify(b.run!.data.rooms));
      for (const r of a.run!.data.layout.rooms) {
        if (!['treasure', 'shop', 'secret', 'deepSecret', 'cursed', 'boss', 'miniboss'].includes(r.type) && !a.run!.data.rooms[r.index]!.slots && !a.run!.data.rooms[r.index]!.trader) continue;
        a.run!.teleport(r.index);
        b.run!.teleport(r.index);
        const sa = a.summary();
        const sb = b.summary();
        expect(sb.pedestals).toEqual(sa.pedestals);
        expect(sb.pickups.map((p) => p.kind)).toEqual(sa.pickups.map((p) => p.kind));
        expect(sb.enemies.map((e) => e.id)).toEqual(sa.enemies.map((e) => e.id));
        expect(b.world.props.npc).toBe(a.world.props.npc);
      }
    }
  });

  it('the Keepsake Room offers a treasure-pool item', () => {
    const { sim, room } = findRun(roomOfType('treasure'));
    sim.run!.teleport(room);
    const items = sim.summary().pedestals.filter((p) => p.item);
    expect(items.length).toBeGreaterThanOrEqual(1);
    for (const p of items) expect(findItem(p.item)!.pools).toContain('treasure');
    expect(sim.run!.seen(items[0]!.item)).toBe(true);
  });
});

describe("Magpie's Stall", () => {
  const shopRun = () => findRun(roomOfType('shop'));

  it('Magpie perches on the wall over 3-5 slots: items priced by quality and pickups for a few coins, plus a donation jar', () => {
    for (let k = 0; k < 5; k++) {
      const { sim, room } = findRun(roomOfType('shop'), {}, 1 + k * 13);
      sim.run!.teleport(room);
      expect(sim.world.props.npc).toBe(NPC_MAGPIE);
      const peds = sim.summary().pedestals;
      const forSale = peds.filter((p) => p.price > 0);
      expect(forSale.length).toBeGreaterThanOrEqual(3);
      expect(forSale.length).toBeLessThanOrEqual(5);
      const items = forSale.filter((p) => p.item);
      const goods = forSale.filter((p) => p.goods);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(goods.length).toBeGreaterThanOrEqual(1);
      for (const p of items) expect(p.price).toBe(itemPrice(p.item));
      for (const p of goods) {
        expect(p.price).toBeGreaterThanOrEqual(2);
        expect(p.price).toBeLessThanOrEqual(7);
      }
      expect(peds.filter((p) => p.prop === 'jar').length).toBe(1);
    }
  });

  it('buying deducts the price; without the coins it is refused', () => {
    const { sim, room } = shopRun();
    sim.run!.teleport(room);
    const ped = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.item && p.price > 0)!;
    const item = ped.item;
    const price = ped.price;
    sim.world.player.inv.coins = price - 1;
    touch(sim, ped.x, ped.y);
    expect(ped.item).toBe(item);
    expect(sim.world.player.inv.coins).toBe(price - 1);
    stepAway(sim);
    sim.addPickups(4, 0, 0);
    touch(sim, ped.x, ped.y);
    expect(sim.world.player.inv.coins).toBe(3);
    expect([...sim.world.player.inv.passives, sim.world.player.inv.active?.id, ...sim.world.player.inv.trinkets, ...sim.world.player.inv.consumables]).toContain(item);
  });

  it('pickups for sale are handed over only when she can use them', () => {
    const { sim, room } = findRun((s) => {
      const i = s.run!.data.layout.rooms.findIndex((r) => r.type === 'shop');
      return i >= 0 && s.run!.data.rooms[i]!.goods.includes('heart') ? i : -1;
    });
    sim.run!.teleport(room);
    const ped = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.goods === 9)!;
    expect(ped).toBeDefined();
    const price = ped.price;
    sim.addPickups(20, 0, 0);
    // Full health: no sale.
    touch(sim, ped.x, ped.y);
    expect(sim.world.player.inv.coins).toBe(20);
    stepAway(sim);
    // Hurt: bought and healed.
    sim.world.player.health.red = 2;
    touch(sim, ped.x, ped.y);
    expect(sim.world.player.inv.coins).toBe(20 - price);
    expect(sim.world.player.health.red).toBe(4);
    // Sold: the slot is gone.
    expect(sim.summary().pedestals.filter((p) => p.goods === 'heart').length).toBe(sim.run!.state.goods.filter((g) => g === 'heart').length - 1);
  });

  it("the 'haggler' flag takes 25 % off coin prices", () => {
    registerItem({
      id: 't-haggle',
      name: 'Haggle',
      desc: 'Test item.',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: ['test'],
      effects: [{ type: 'flag', flag: 'haggler' }],
      sprite: 'test',
    });
    const { sim, room } = shopRun();
    sim.run!.teleport(room);
    const base = sim.summary().pedestals.filter((p) => p.price > 0).map((p) => p.price);
    sim.giveItem('t-haggle');
    const cut = sim.summary().pedestals.filter((p) => p.price > 0).map((p) => p.price);
    expect(cut).toEqual(base.map((p) => Math.max(1, Math.round(p * 0.75))));
  });

  it('the donation jar takes coins while you lean on it; thresholds bring luck', () => {
    const { sim, room } = shopRun();
    sim.run!.teleport(room);
    const jar = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.prop === 1)!;
    sim.addPickups(20, 0, 0);
    const luck = sim.world.player.stats.luck;
    let lucky = 0;
    for (let t = 0; t < 60 * 3; t++) {
      touch(sim, jar.x, jar.y, 1);
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'donate' && sim.events.at(i).b === 1) lucky++;
    }
    expect(sim.world.counters.donated).toBeGreaterThanOrEqual(SHOP_TUNING.jarThresholds[0]!);
    expect(sim.world.player.inv.coins).toBe(20 - sim.world.counters.donated);
    expect(lucky).toBeGreaterThanOrEqual(1);
    expect(sim.world.player.stats.luck).toBeGreaterThan(luck);
  });
});

describe('the Gumball Gambler and Old Pell', () => {
  it('one coin per spin, seeded outcomes; a blast breaks it open for coins', () => {
    const play = (): { coins: number; pickups: string[]; sim: Sim } => {
      const { sim, room } = findRun(roomWith((st) => st.slots));
      sim.world.godMode = true;
      sim.run!.teleport(room);
      clearHere(sim);
      sim.world.pickups.clear();
      const g = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.prop === 2)!;
      expect(g).toBeDefined();
      sim.addPickups(10, 0, 0);
      for (let t = 0; t < 60 * 8; t++) touch(sim, g.x, g.y, 1);
      return { coins: sim.world.player.inv.coins, pickups: sim.summary().pickups.map((p) => p.kind).sort(), sim };
    };
    const a = play();
    const b = play();
    expect(a.sim.world.counters.slotPlays).toBeGreaterThanOrEqual(5);
    expect(a.coins).toBe(b.coins);
    expect(a.pickups).toEqual(b.pickups);
    // Bomb it.
    const sim = a.sim;
    const g = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.prop === 2)!;
    stepAway(sim);
    const before = sim.world.pickups.count;
    sim.explode(g.x + 6, g.y);
    expect(g.broken).toBe(true);
    expect(sim.world.pickups.count).toBeGreaterThan(before);
    // Broken: no more spins.
    const coins = sim.world.player.inv.coins;
    touch(sim, g.x, g.y, 10);
    expect(sim.world.player.inv.coins).toBeGreaterThanOrEqual(coins);
  });

  it('Old Pell trades his item for three keys', () => {
    const { sim, room } = findRun(roomWith((st) => st.trader !== ''));
    sim.world.godMode = true;
    const offer = sim.run!.data.rooms[room]!.trader;
    sim.run!.teleport(room);
    clearHere(sim);
    const pell = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.prop === 3)!;
    expect(pell.item).toBe(offer);
    expect(pell.keys).toBe(SHOP_TUNING.traderKeys);
    sim.world.player.inv.keys = 2;
    touch(sim, pell.x, pell.y);
    expect(pell.item).toBe(offer);
    stepAway(sim);
    sim.addPickups(0, 0, 1);
    touch(sim, pell.x, pell.y);
    expect(pell.item).toBe('');
    expect(sim.world.player.inv.keys).toBe(0);
    expect(sim.run!.seen(offer)).toBe(true);
  });
});

describe('Thorn Room, Forgotten Pocket', () => {
  it('a Thorn Room offers a curse-pool item or a chest', () => {
    let items = 0;
    let chests = 0;
    for (let seed = 1; seed < 150 && (items === 0 || chests === 0); seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      for (const r of sim.run!.data.layout.rooms) {
        if (r.type !== 'cursed') continue;
        const st = sim.run!.data.rooms[r.index]!;
        st.items.forEach((id, i) => {
          if (id) {
            items++;
            const pools = findItem(id)!.pools;
            expect(pools.includes('cursed') || pools.includes('treasure')).toBe(true);
          } else if (st.alts[i]) {
            chests++;
            expect(st.alts[i]).toBe('lockbox');
          }
        });
      }
    }
    expect(items).toBeGreaterThan(0);
    expect(chests).toBeGreaterThan(0);
  });

  it('a Forgotten Pocket holds a better item or a big pile of loot', () => {
    let better = 0;
    let loot = 0;
    for (let seed = 1; seed < 60; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const st = sim.run!.data.rooms[sim.run!.data.layout.deepSecret]!;
      if (st.bonus.length > 0) {
        loot++;
        expect(st.bonus.length).toBeGreaterThanOrEqual(5);
      } else if (st.items.some((id) => id)) {
        better++;
        for (const id of st.items) if (id) expect(findItem(id)!.quality).toBeGreaterThanOrEqual(3);
      }
    }
    expect(better).toBeGreaterThan(5);
    expect(loot).toBeGreaterThan(5);
  });
});

describe("the Broker's Nook", () => {
  it('opens after the boss with 25 % odds, 60 % after a floor without damage', () => {
    let opened = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const sim = Sim.newRun(seed, { curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      const hurt = seed % 2 === 0;
      run.teleport(run.data.layout.boss);
      if (hurt) run.data.tookDamage = true;
      expect(run.nookChance()).toBe(hurt ? 0.25 : 0.6);
      const roll = floorRng(sim.seed, 1, 'main').fork('nook').next();
      clearHere(sim);
      const expected = roll < (hurt ? 0.25 : 0.6) && run.data.layout.nook.templateId !== null;
      expect(run.data.layout.nook.room >= 0).toBe(expected);
      if (expected) opened++;
    }
    expect(opened).toBeGreaterThan(8);
  });

  it('the Moth Broker offers two deals for heart containers; taking one makes the other vanish', () => {
    const { sim } = findRun((s) => {
      const run = s.run!;
      s.world.godMode = true;
      run.teleport(run.data.layout.boss);
      clearHere(s);
      return run.data.layout.nook.room;
    });
    const run = sim.run!;
    expect(run.goThroughDoor(run.data.layout.nook.side)).toBe(true);
    expect(run.room.type).toBe('nook');
    expect(sim.world.props.npc).toBe(NPC_BROKER);
    const deals = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).filter((p) => p.item);
    expect(deals.length).toBe(2);
    for (const d of deals) {
      expect(d.hearts === 1 || d.hearts === 2).toBe(true);
      expect(d.group).toBe(1);
      expect(findItem(d.item)!.pools.includes('broker') || findItem(d.item)!.pools.includes('treasure')).toBe(true);
    }
    initHealth(sim.world.player.health, 8, 8, 0, 0);
    const d = deals[0]!;
    const price = d.hearts;
    let vanished = 0;
    for (let t = 0; t < 2; t++) {
      touch(sim, d.x, d.y, 1);
      vanished += countEvents(sim, 'pedestalVanish');
    }
    expect(sim.world.player.health.redMax).toBe(8 - price * 2);
    expect(vanished).toBe(1);
    expect(sim.world.pedestals.items.slice(0, sim.world.pedestals.count).filter((p) => p.item).length).toBe(0);
  });

  it('with no heart containers the price is 3 Tin hearts per container', () => {
    const { sim } = findRun((s) => {
      const run = s.run!;
      s.world.godMode = true;
      run.teleport(run.data.layout.boss);
      clearHere(s);
      return run.data.layout.nook.room;
    });
    const run = sim.run!;
    run.goThroughDoor(run.data.layout.nook.side);
    const d = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.item)!;
    const h = sim.world.player.health;
    const need = d.hearts * SHOP_TUNING.tinPerContainer * 2;
    // Exactly the price and nothing else: refused (it would leave nothing to live on).
    initHealth(h, 0, 0, need, 0);
    touch(sim, d.x, d.y);
    expect(d.item).not.toBe('');
    stepAway(sim);
    // One Tin heart more: paid.
    addBonus(h, BONUS_TIN, 2);
    touch(sim, d.x, d.y);
    expect(bonusHalvesOf(h, BONUS_TIN)).toBe(2);
  });
});

describe('item pools', () => {
  const lockedItem: ItemDef = {
    id: 't-locked-treasure',
    name: 'Locked Thing',
    desc: 'Only after an unlock.',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'boss', 'shop', 'secret', 'deepSecret', 'challenge', 'cursed', 'broker', 'trader'],
    tags: [],
    effects: [],
    unlock: 'some-achievement',
    sprite: 'locked',
  };

  it('items flagged unlock never roll until the run lists them as unlocked', () => {
    registerItem(lockedItem);
    expect(lockedItemIds(new Set())).toContain(lockedItem.id);
    expect(lockedItemIds(new Set([lockedItem.id]))).not.toContain(lockedItem.id);
    const offered = (unlocked: string[]): number => {
      let n = 0;
      for (let seed = 1; seed <= 25; seed++) {
        const sim = Sim.newRun(seed, { curse: null, unlocked });
        for (const st of sim.run!.data.rooms) for (const id of [...st.items, ...st.shop, st.reward, st.trader]) if (id === lockedItem.id) n++;
      }
      return n;
    };
    expect(offered([])).toBe(0);
    expect(offered([lockedItem.id])).toBeGreaterThan(0);
  });

  it('seen items are skipped while anything else is left; an exhausted pool falls back instead of emptying', () => {
    const rng = new Rng(5);
    const pools: PoolId[] = ['treasure'];
    const all = allItems().filter((d) => d.pools.includes('treasure') && !d.tags.includes('test') && (d.kind === 'passive' || d.kind === 'active'));
    const keep = all[3]!.id;
    const used = new Set(all.map((d) => d.id).filter((id) => id !== keep));
    expect(rollItem(rng, pools, used, new Set(), false)).toBe(keep);
    // Everything seen: still an item (a repeat), never ''.
    expect(rollItem(rng, pools, used, new Set(), false)).not.toBe('');
    // Locked items never come back, even as a fallback.
    const locked = new Set(all.map((d) => d.id).filter((id) => id !== keep));
    for (let i = 0; i < 20; i++) expect(rollItem(rng, pools, new Set(), locked, false)).toBe(keep);
  });
});

describe('hidden routes', () => {
  it('a cracked grate in the secret room: bomb it open, drop in, the next floor is on the alt track', () => {
    const { sim } = findRun((s) => {
      const l = s.run!.data.layout;
      return l.hiddenRoute >= 0 && l.hiddenRoute === l.secret ? l.secret : -1;
    });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.secret);
    const g = sim.world.props.grate;
    expect(g.active).toBe(true);
    expect(g.state).toBe(0);
    // Closed: standing on it does nothing.
    sim.world.player.placeAt(g.x, g.y);
    stepN(sim, makeInput(), 3);
    expect(run.data.floor).toBe(1);
    sim.world.player.placeAt(g.x + 60 > 200 ? g.x - 60 : g.x + 60, g.y);
    sim.explode(g.x, g.y);
    expect(g.state).toBe(1);
    expect(run.state.grate).toBe(2);
    stepN(sim, makeInput(), 3);
    sim.world.player.placeAt(g.x, g.y);
    let via = '';
    for (let t = 0; t < 5 && run.data.floor === 1; t++) {
      sim.step(makeInput());
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'trapdoor' && sim.events.at(i).a === 1) via = sim.events.at(i).id;
    }
    expect(via).toBe('grate');
    expect(run.data.floor).toBe(2);
    expect(run.data.track).toBe('alt');
    expect(run.data.chapter).toBe('drowned_nursery');
    // Boss trapdoors keep the (alt) track.
    run.teleport(run.data.layout.boss);
    clearHere(sim);
    const t = sim.world.trapdoor;
    stepN(sim, makeInput(), 60);
    sim.world.player.placeAt(t.x + 30, t.y);
    stepN(sim, makeInput(), 1);
    sim.world.player.placeAt(t.x, t.y);
    stepN(sim, makeInput(), 2);
    expect(run.data.floor).toBe(3);
    expect(run.data.track).toBe('alt');
    expect(run.data.chapter).toBe('candlewick_crypt');
  });

  it('in the boss room the grate only shows after the boss', () => {
    const { sim } = findRun((s) => {
      const l = s.run!.data.layout;
      return l.hiddenRoute >= 0 && l.hiddenRoute === l.boss ? l.boss : -1;
    });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.boss);
    expect(sim.world.props.grate.active).toBe(false);
    clearHere(sim);
    expect(sim.world.props.grate.active).toBe(true);
    // Still there on a later visit.
    run.teleport(run.data.layout.start);
    run.teleport(run.data.layout.boss);
    expect(sim.world.props.grate.active).toBe(true);
  });

  it("the alt route into chapter 6 needs Ending 1; without it the alt track rejoins the main one", () => {
    const none = new Set<string>();
    const e1 = new Set(['ending1']);
    expect(altRouteAllowed(9, 'main', none)).toBe(true);
    expect(altRouteAllowed(10, 'main', none)).toBe(false);
    expect(altRouteAllowed(11, 'main', none)).toBe(false);
    expect(altRouteAllowed(10, 'main', e1)).toBe(true);
    expect(altRouteAllowed(12, 'main', e1)).toBe(false);
    expect(altRouteAllowed(4, 'alt', e1)).toBe(false);
    for (let seed = 1; seed < 40; seed++) {
      expect(generateFloor(seed, 10, 'main', { allowAltNext: altRouteAllowed(10, 'main', none) }).hiddenRoute).toBe(-1);
    }
    const a = Sim.newRun(3, { floor: 10, track: 'alt', curse: null });
    expect(a.run!.trackAfter(10, 'alt')).toBe('main');
    a.run!.skipFloor();
    expect(a.run!.data.track).toBe('main');
    expect(a.run!.data.chapter).toBe('eye_of_storm');
    const b = Sim.newRun(3, { floor: 10, track: 'alt', curse: null, unlocked: ['ending1'] });
    b.run!.skipFloor();
    expect(b.run!.data.track).toBe('alt');
    expect(b.run!.data.chapter).toBe('hollow_nest');
  });

  it('hidden routes appear on some main-track floors', () => {
    let grates = 0;
    for (let seed = 1; seed <= 40; seed++) if (Sim.newRun(seed, { curse: null }).run!.data.layout.hiddenRoute >= 0) grates++;
    expect(grates).toBeGreaterThan(5);
    expect(grates).toBeLessThan(35);
  });
});

describe('endings', () => {
  function finalRun(floor: number, track: 'main' | 'alt', unlocked: string[] = []): Sim {
    const sim = Sim.newRun(21, { floor, track, curse: null, unlocked });
    sim.world.godMode = true;
    sim.run!.teleport(sim.run!.data.layout.boss);
    return sim;
  }

  it('Old Thunderhead (floor 12, main) ends the run with Ending 1', () => {
    const sim = finalRun(12, 'main');
    expect(sim.run!.state.boss).toBe('old-thunderhead');
    expect(sim.world.boss.kind).toBe(2);
    let ending = -1;
    const input = makeInput();
    const res = fightBoss(sim, 300 * 60);
    expect(res.won).toBe(true);
    for (let t = 0; t < 5 && ending < 0; t++) {
      sim.step(input);
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'runEnd') ending = sim.events.at(i).b;
    }
    expect(sim.run!.data.won).toBe(1);
    expect(sim.run!.data.ending).toBe(1);
    expect(sim.summary().run!.ending).toBe(1);
    expect(sim.world.trapdoor.active).toBe(false);
  });

  it('The Nestmother (floor 12, alt) ends it with Ending 2', () => {
    const sim = finalRun(12, 'alt');
    expect(sim.run!.state.boss).toBe('nestmother');
    clearHere(sim);
    stepN(sim, makeInput(), 2);
    expect(sim.run!.data.ending).toBe(2);
  });

  it('with Endings 1 and 2 unlocked: a whirlpool to floor 13 and a skylight (the ending) appear instead', () => {
    const sim = finalRun(12, 'main', ['ending1', 'ending2']);
    clearHere(sim);
    stepN(sim, makeInput(), 2);
    const run = sim.run!;
    expect(run.data.won).toBe(0);
    expect(run.state.exits).toBe(1);
    const sky = sim.world.props.skylight;
    const pool = sim.world.props.whirlpool;
    expect(sky.active && pool.active).toBe(true);
    // The skylight: Ending 1 after all.
    const alt = finalRun(12, 'main', ['ending1', 'ending2']);
    clearHere(alt);
    stepN(alt, makeInput(), 60);
    const s2 = alt.world.props.skylight;
    alt.world.player.placeAt(s2.x, s2.y);
    stepN(alt, makeInput(), 2);
    expect(alt.run!.data.ending).toBe(1);
    // The whirlpool: floor 13, The Undertow, Ending 3.
    stepN(sim, makeInput(), 60);
    sim.world.player.placeAt(pool.x, pool.y);
    stepN(sim, makeInput(), 2);
    expect(run.data.floor).toBe(13);
    expect(run.data.layout.finalBoss).toBe('undertow');
    run.teleport(run.data.layout.boss);
    expect(run.state.boss).toBe('undertow');
    clearHere(sim);
    stepN(sim, makeInput(), 2);
    expect(run.data.won).toBe(1);
    expect(run.data.ending).toBe(3);
  });

});

describe('prop placement', () => {
  /** Door fronts reachable on foot from each other, with every pedestal-like prop as a wall. */
  function doorsConnected(sim: Sim): boolean {
    const w = sim.world;
    const blocked = new Uint8Array(91);
    for (let i = 0; i < 91; i++) if (w.room.blocksWalkAt(i % 13, Math.floor(i / 13))) blocked[i] = 1;
    for (let i = 0; i < w.pedestals.count; i++) {
      const p = w.pedestals.items[i]!;
      blocked[Math.floor(p.y / 16) * 13 + Math.floor(p.x / 16)] = 1;
    }
    const fronts = [6, 3 * 13 + 12, 6 * 13 + 6, 3 * 13];
    const open = fronts.filter((f, side) => w.doors.slots[side]!.kind !== 0 && !blocked[f]);
    if (open.length < 2) return true;
    const seen = new Uint8Array(91);
    const queue = [open[0]!];
    seen[open[0]!] = 1;
    while (queue.length) {
      const c = queue.pop()!;
      const x = c % 13;
      const y = Math.floor(c / 13);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx > 12 || ny > 6) continue;
        const n = ny * 13 + nx;
        if (seen[n] || blocked[n]) continue;
        seen[n] = 1;
        queue.push(n);
      }
    }
    return open.every((f) => seen[f] === 1);
  }

  it('gamblers, traders and jars never cut a room in two', () => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const sim = Sim.newRun(seed, { curse: null, floor: 1 + (seed % 3) });
      const run = sim.run!;
      sim.world.godMode = true;
      for (const r of run.data.layout.rooms) {
        const st = run.data.rooms[r.index]!;
        if (!st.slots && !st.trader && r.type !== 'shop') continue;
        run.teleport(r.index);
        expect(doorsConnected(sim), `seed ${seed} room ${r.index}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(40);
  });
});
