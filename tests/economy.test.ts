/**
 * Polish batch 4 (B4-2): the economy after the balance harness (tests/helpers/balance.ts). Fewer free items and scarcer
 * coins / keys / bombs sized for locked shops, fewer forced champions, a Gumball Gambler that is a gamble, a Storm Lance
 * whose chance doesn't shrink as the pools grow, and a Broker's Nook that only deals in items worth a heart container.
 * The harness numbers behind them are in DECISIONS.md "Polish batch 4".
 */

import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { allChampions, allItems, findItem, getDropTable, registerItem } from '../src/content/registry';
import { generateFloor, templateRng } from '../src/sim/floor/generate';
import { ROOM_TEMPLATES } from '../src/sim/floor/library';
import { pickTemplates } from '../src/sim/floor/templates';
import { chapterFor } from '../src/sim/run/chapters';
import { ELITE_CHANCE, rollFloorContents } from '../src/sim/run/contents';
import { GOODS_PRICE } from '../src/sim/run/contents';
import { ITEM_PRICE, QUALITY_WEIGHT, TRINKET_PRICE, itemPrice, lockedItemIds, rollItem, rollWeight } from '../src/sim/run/pools';
import { SLOT_OUTCOMES } from '../src/sim/shopProps';
import { ENEMY_TUNING, RUN_TUNING } from '../src/sim/tuning';
import type { ItemDef, PickupName } from '../src/sim/types';

const FRESH_LOCKED = new Set(lockedItemIds(new Set()));

function testItem(id: string, quality: ItemDef['quality'], weight?: number): ItemDef {
  const d: ItemDef = { id, name: id.toUpperCase(), desc: 'TEST', kind: 'passive', quality, pools: ['test-econ' as never], tags: [], effects: [], sprite: 'test' };
  if (weight !== undefined) d.weight = weight;
  if (!findItem(id)) registerItem(d);
  return findItem(id)!;
}

describe('item pools and prices', () => {
  it('rollItem reads a fixed weight when an item sets one, the quality weight otherwise', () => {
    const plain = testItem('econ-plain-q4', 4);
    const fixed = testItem('econ-fixed-q4', 4, 1);
    const common = testItem('econ-common-q1', 1);
    expect(rollWeight(plain)).toBe(QUALITY_WEIGHT[4]);
    expect(rollWeight(fixed)).toBe(1);
    expect(rollWeight(common)).toBe(1);
    const counts = new Map<string, number>();
    const rng = new Rng('econ-weights');
    const N = 6000;
    for (let i = 0; i < N; i++) {
      const id = rollItem(rng, ['test-econ' as never], new Set(), new Set(), false);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Shares ≈ 0.35 : 1 : 1 of 2.35.
    const share = (id: string) => (counts.get(id) ?? 0) / N;
    expect(share('econ-plain-q4')).toBeCloseTo(0.35 / 2.35, 1);
    expect(share('econ-fixed-q4')).toBeCloseTo(1 / 2.35, 1);
    expect(share('econ-fixed-q4') / share('econ-plain-q4')).toBeGreaterThan(2.3);
  });

  it('the Storm Lance keeps a fixed weight, rolls in the arena too, and every weight is sane', () => {
    const lance = findItem('storm-lance')!;
    expect(lance.quality).toBe(4);
    expect(lance.weight).toBeGreaterThan(QUALITY_WEIGHT[4]);
    expect(lance.pools).toEqual(expect.arrayContaining(['treasure', 'boss', 'challenge']));
    expect(lance.unlock).toBeUndefined();
    for (const d of allItems()) if (d.weight !== undefined) expect(d.weight, d.id).toBeGreaterThan(0);
  });

  it("Magpie's prices: 15-40 by quality, trinkets 12, consumables 5 + quality", () => {
    expect([...ITEM_PRICE]).toEqual([15, 18, 22, 30, 40]);
    expect(TRINKET_PRICE).toBe(12);
    for (const d of allItems()) {
      if (d.tags.includes('test')) continue;
      const p = itemPrice(d.id);
      if (d.kind === 'trinket') expect(p).toBe(12);
      else if (d.kind === 'consumable') expect(p).toBe(5 + d.quality);
      else expect(p).toBe(ITEM_PRICE[d.quality]);
    }
  });
});

describe('the Gumball Gambler is a gamble', () => {
  it('a spin is worth less than the coin it costs (coins at face value, prizes at their shop price)', () => {
    const value: Partial<Record<PickupName, number>> = {
      coin: 1,
      silverCoin: 5,
      goldCoin: 10,
      heart: GOODS_PRICE.heart,
      bomb: GOODS_PRICE.bomb,
      key: GOODS_PRICE.key,
      sparkSmall: GOODS_PRICE.sparkFull! / 2,
      trinket: TRINKET_PRICE,
    };
    let total = 0;
    let ev = 0;
    let wins = 0;
    for (const [name, count, weight] of SLOT_OUTCOMES) {
      total += weight;
      if (!name) continue;
      wins += weight;
      expect(value[name], name).toBeDefined();
      ev += weight * count * value[name]!;
    }
    ev /= total;
    expect(ev).toBeLessThan(1);
    expect(ev).toBeGreaterThan(0.7);
    // Still fun: about one spin in four pays out.
    expect(wins / total).toBeGreaterThan(0.2);
  });
});

describe('drop tables', () => {
  it('champions no longer always drop; room clears and chests pay less', () => {
    const champ = getDropTable('champion');
    expect(champ.nothing ?? 0).toBeGreaterThanOrEqual(40);
    const w = (id: string, kind: string) => getDropTable(id).entries.find((e) => e.kind === kind)?.weight ?? 0;
    const share = (id: string, kind: string) => {
      const t = getDropTable(id);
      const sum = t.entries.reduce((a, e) => a + e.weight, 0) + (t.nothing ?? 0);
      return w(id, kind) / sum;
    };
    // Coins, keys and Tin on a room clear: under half the old shares (0.26, 0.088, 0.029).
    expect(share('roomClear', 'coin')).toBeLessThan(0.13);
    expect(share('roomClear', 'key')).toBeLessThan(0.044);
    expect(share('roomClear', 'tinHeart')).toBeLessThan(0.02);
    expect(w('tintedRock', 'bomb')).toBe(14);
    expect(w('satchel', 'tinHeart')).toBe(2);
    expect(w('champion', 'tinHeart')).toBe(3);
    // Keys: the late floors' many clears and champions banked 15 keys by floor 12 at 3; 2 keeps it near a dozen.
    expect(w('roomClear', 'key')).toBe(2);
    expect(w('champion', 'key')).toBe(2);
  });
});

/** The share of spawns that are champions on a floor, over `seeds` runs' pre-rolled contents (E markers + the base roll). */
function championShare(floor: number, seeds: number): number {
  let enemies = 0;
  let champs = 0;
  const base = ENEMY_TUNING.championBase;
  for (let seed = 1; seed <= seeds; seed++) {
    const layout = generateFloor(seed, floor, 'main', {});
    const chapter = chapterFor(floor, 'main').id;
    pickTemplates(layout, ROOM_TEMPLATES, chapter, templateRng(seed, floor, 'main'));
    const { rooms } = rollFloorContents(layout, chapter, { locked: FRESH_LOCKED, seen: new Set(), challengeWaves: RUN_TUNING.challengeWaves });
    for (const r of rooms) {
      for (let w = 0; w < r.waves.length; w++) {
        for (let i = 0; i < r.waves[w]!.length; i++) {
          enemies++;
          champs += r.champs[w]![i] ? 1 : base;
        }
      }
    }
  }
  return champs / Math.max(1, enemies);
}

describe('champions are uncommon', () => {
  it("an 'E' marker holds a champion 40 % of the time (pre-rolled), so ~15-25 % of late spawns are champions", () => {
    expect(ELITE_CHANCE).toBeGreaterThan(0.3);
    expect(ELITE_CHANCE).toBeLessThan(0.6);
    const early = championShare(2, 400);
    const late = championShare(11, 400);
    expect(early).toBeLessThan(0.15);
    expect(late).toBeGreaterThan(0.12);
    expect(late).toBeLessThan(0.25);
  });

  it('the pick is seeded with the floor: the same seed gives the same champions', () => {
    const roll = (seed: number) => {
      const layout = generateFloor(seed, 9, 'main', {});
      const chapter = chapterFor(9, 'main').id;
      pickTemplates(layout, ROOM_TEMPLATES, chapter, templateRng(seed, 9, 'main'));
      return JSON.stringify(rollFloorContents(layout, chapter, { locked: FRESH_LOCKED, seen: new Set(), challengeWaves: 3 }).rooms.map((r) => r.champs));
    };
    expect(roll(77)).toBe(roll(77));
    expect(allChampions().length).toBeGreaterThan(0);
  });
});

describe("the Broker's Nook deals only in quality 3-4", () => {
  it('over 300 floors every deal is quality 3+ and costs 1 heart (2 for quality 4)', () => {
    let deals = 0;
    for (let seed = 1; seed <= 100; seed++) {
      for (const floor of [2, 5, 9]) {
        const layout = generateFloor(seed, floor, 'main', {});
        const chapter = chapterFor(floor, 'main').id;
        pickTemplates(layout, ROOM_TEMPLATES, chapter, templateRng(seed, floor, 'main'));
        const { nook } = rollFloorContents(layout, chapter, { locked: FRESH_LOCKED, seen: new Set(), challengeWaves: 3 });
        nook.items.forEach((id, i) => {
          if (!id) return;
          deals++;
          const q = findItem(id)!.quality;
          expect(q, id).toBeGreaterThanOrEqual(3);
          expect(nook.hearts[i]).toBe(q >= 4 ? 2 : 1);
        });
      }
    }
    expect(deals).toBeGreaterThan(200);
  });
});
