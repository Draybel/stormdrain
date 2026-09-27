/**
 * "Items B": 42 passives (src/content/items/passives-b-*.ts), their four sets (Toybox, Ossuary,
 * Tidewalker, Glimmer — src/content/sets), four familiars and two hooks. Data checks, then headless
 * checks that every item does what its banner says, that duplicates and sets snowball, and that the
 * whole lot ×3 stays inside the caps.
 */

import { describe, expect, it } from 'vitest';
import { WREN } from '../src/content/characters/wren';
import B_FAMILIARS from '../src/content/familiars/itemsB';
import GENERAL from '../src/content/items/passives-b-general';
import SET_ITEMS from '../src/content/items/passives-b-sets';
import { ACHIEVEMENTS, FAMILIARS, ITEMS, SETS, allItems, allSets, getItem } from '../src/content/registry';
import GLIMMER from '../src/content/sets/glimmer';
import OSSUARY from '../src/content/sets/ossuary';
import TIDEWALKER from '../src/content/sets/tidewalker';
import TOYBOX from '../src/content/sets/toybox';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { validateContent } from '../src/content/validate';
import { clearEdges } from '../src/engine/inputState';
import { recomputePlayer } from '../src/sim/effects';
import { ST_FEAR } from '../src/sim/enemies/status';
import { BONUS_EMBER, BONUS_TIN, bonusHalvesOf } from '../src/sim/health';
import { hasHook } from '../src/sim/hooks';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK } from '../src/sim/pickupKinds';
import { computeStats, makeStats, softCapFireRate } from '../src/sim/stats';
import type { Sim } from '../src/sim/sim';
import {
  CARRIER_IDS,
  MOD_IDS,
  PLAYER_FLAGS,
  STAT_IDS,
  TRIGGER_EVENTS,
  costumeList,
  type Effect,
  type ItemDef,
  type ItemSetDef,
  type StatEffect,
} from '../src/sim/types';
import { arenaSim, checkAttackInvariants, damageDealt, give } from './helpers/attack';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const ITEMS_B: readonly ItemDef[] = [...SET_ITEMS, ...GENERAL];
const SETS_B: readonly ItemSetDef[] = [...TOYBOX, ...OSSUARY, ...TIDEWALKER, ...GLIMMER];
const SET_IDS = ['toybox', 'ossuary', 'tidewalker', 'glimmer'] as const;
/** Characters the pixel font can draw (render/font.ts GLYPHS; lowercase is drawn uppercase). */
const FONT = /^[A-Z0-9 .,!?:;'"\-+=\/()[\]%*#<>_&°·♥¤←→↑↓]+$/;

function flat(list: readonly Effect[], inTrigger = false, out: { e: Effect; inTrigger: boolean }[] = []): { e: Effect; inTrigger: boolean }[] {
  for (const e of list) {
    out.push({ e, inTrigger });
    if (e.type === 'trigger') flat(e.effects, true, out);
  }
  return out;
}

const has = (d: ItemDef, pred: (e: Effect) => boolean): boolean => flat(d.effects).some(({ e }) => pred(e));

/** A test enemy with no loot (so pickups on the floor come from items only). */
function foe(): string {
  testEnemy('tb-foe', { hp: 6, radius: 5, contact: 0, speed: 0 });
  return 'tb-foe';
}

/** An open room, Wren in the middle, no enemies. */
function roomSim(seed: string): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(104, 56);
  return sim;
}

function countPickups(sim: Sim, kind: number): number {
  const pool = sim.world.pickups;
  let n = 0;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.kind === kind) n++;
  return n;
}

/** Hurts the player once, ignoring the i-frames of an earlier hit. */
function hurt(sim: Sim, halves = 1): void {
  sim.world.player.invuln = 0;
  sim.hurtPlayer(halves);
}

describe('items B: data', () => {
  it('42 new passives, all registered, ids and names unique', () => {
    expect(ITEMS_B).toHaveLength(42);
    const ids = ITEMS_B.map((d) => d.id);
    expect(new Set(ids).size).toBe(42);
    for (const d of ITEMS_B) expect(ITEMS.get(d.id)).toBe(d);
    const names = allItems().map((d) => d.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
    expect(validateContent()).toEqual([]);
  });

  it.each(ITEMS_B.map((d) => [d.id, d] as const))('%s is well-formed', (_id, d) => {
    expect(d.kind).toBe('passive');
    // Gated items (characters & achievements pass) name a real achievement.
    if (d.unlock !== undefined) expect(ACHIEVEMENTS.has(d.unlock)).toBe(true);
    expect(d.name.length).toBeGreaterThan(2);
    expect(d.desc.length).toBeGreaterThan(8);
    expect(d.desc.length).toBeLessThanOrEqual(46);
    expect(d.desc).toBe(d.desc.toUpperCase());
    expect(d.desc).toMatch(FONT);
    expect(d.name.toUpperCase()).toMatch(FONT);
    expect(d.quality).toBeGreaterThanOrEqual(0);
    expect(d.quality).toBeLessThanOrEqual(4);
    expect(d.pools.length).toBeGreaterThan(0);
    // Passives never roll from trinket / consumable pools.
    for (const p of d.pools) expect(['chest', 'trader']).not.toContain(p);
    expect(d.tags.length).toBeGreaterThan(0);
    expect(d.effects.length).toBeGreaterThan(0);
    expect(typeof d.sprite).not.toBe('string');
    if (typeof d.sprite !== 'string') {
      expect([d.sprite.w, d.sprite.h]).toEqual([14, 14]);
      expect(validateSpriteDef(d.sprite)).toEqual([]);
    }
    for (const c of costumeList(d.costume)) expect(validateSpriteDef(c.sprite)).toEqual([]);
    if (d.set) {
      expect(SET_IDS).toContain(d.set);
      expect(d.tags).toContain(d.set);
    }
    for (const { e, inTrigger } of flat(d.effects)) {
      switch (e.type) {
        case 'stat':
          expect(STAT_IDS).toContain(e.stat);
          expect(e.add !== undefined || e.mul !== undefined).toBe(true);
          break;
        case 'mod':
          expect(MOD_IDS).toContain(e.mod);
          break;
        case 'carrier':
          expect(CARRIER_IDS).toContain(e.carrier);
          break;
        case 'familiar':
          expect(FAMILIARS.has(e.familiar)).toBe(true);
          break;
        case 'flag':
          expect(PLAYER_FLAGS).toContain(e.flag);
          break;
        case 'hook':
          expect(hasHook(e.hook)).toBe(true);
          break;
        case 'trigger':
          expect(TRIGGER_EVENTS).toContain(e.on);
          expect(e.effects.length).toBeGreaterThan(0);
          break;
        default:
          break;
      }
      // Timed buffs from triggers need a duration (else they would last the whole room).
      if (inTrigger && (e.type === 'stat' || e.type === 'mod' || e.type === 'carrier')) expect(e.duration ?? 0).toBeGreaterThan(0);
    }
  });

  it('four sets with 5-6 members each, a strong bonus and a transformation costume', () => {
    expect(SETS_B.map((s) => s.id)).toEqual([...SET_IDS]);
    for (const s of SETS_B) {
      expect(SETS.get(s.id)).toBe(s);
      expect(s.need).toBe(3);
      expect(s.desc.length).toBeLessThanOrEqual(46);
      expect(s.desc).toMatch(FONT);
      const members = allItems().filter((d) => d.set === s.id);
      expect(members.length, s.id).toBeGreaterThanOrEqual(5);
      expect(members.length, s.id).toBeLessThanOrEqual(6);
      expect(s.effects.length).toBeGreaterThanOrEqual(2);
      const layers = costumeList(s.costume);
      expect(layers.length).toBeGreaterThan(0);
      for (const c of layers) expect(validateSpriteDef(c.sprite)).toEqual([]);
    }
  });

  it('covers the brief: familiars, health, luck, triggers, economy, flight, spectral, multipliers, hooks', () => {
    const count = (pred: (e: Effect) => boolean): number => ITEMS_B.filter((d) => has(d, pred)).length;
    expect(count((e) => e.type === 'familiar')).toBeGreaterThanOrEqual(3);
    expect(count((e) => e.type === 'hearts' && (e.containers ?? 0) > 0)).toBeGreaterThanOrEqual(2);
    expect(count((e) => e.type === 'hearts' && (e.tin ?? 0) > 0)).toBeGreaterThanOrEqual(2);
    expect(count((e) => e.type === 'hearts' && (e.ember ?? 0) > 0)).toBeGreaterThanOrEqual(2);
    expect(count((e) => e.type === 'stat' && e.stat === 'luck' && (e.add ?? 0) > 0)).toBeGreaterThanOrEqual(4);
    for (const on of ['hurt', 'kill', 'roomClear'] as const) expect(count((e) => e.type === 'trigger' && e.on === on), on).toBeGreaterThanOrEqual(3);
    expect(count((e) => e.type === 'pickups' && ((e.coins ?? 0) > 0 || (e.keys ?? 0) > 0 || (e.bombs ?? 0) > 0))).toBeGreaterThanOrEqual(4);
    expect(count((e) => e.type === 'flag' && e.flag === 'flying')).toBeGreaterThanOrEqual(1);
    expect(count((e) => e.type === 'flag' && e.flag === 'spectral')).toBeGreaterThanOrEqual(1);
    expect(count((e) => e.type === 'stat' && (e.mul ?? 1) > 1)).toBeGreaterThanOrEqual(2);
    expect(count((e) => e.type === 'hook' && e.hook.startsWith('itemsB.'))).toBeGreaterThanOrEqual(2);
    expect(B_FAMILIARS.every((f) => FAMILIARS.get(f.id) === f)).toBe(true);
    // Major items wear costumes.
    const major = ITEMS_B.filter((d) => d.quality >= 3);
    expect(major.length).toBeGreaterThan(0);
    for (const d of major) expect(d.costume, d.id).toBeDefined();
  });

  it('sprite ids are unique across every item icon, costume layer and set costume', () => {
    const ids: string[] = [];
    for (const d of allItems()) {
      if (typeof d.sprite !== 'string') ids.push(d.sprite.id);
      for (const c of costumeList(d.costume)) ids.push(c.sprite.id);
    }
    for (const s of allSets()) for (const c of costumeList(s.costume)) ids.push(c.sprite.id);
    // The same layer may be shared by design only through the same item; ours are all distinct.
    const mine = new Set<string>();
    for (const d of ITEMS_B) {
      if (typeof d.sprite !== 'string') mine.add(d.sprite.id);
      for (const c of costumeList(d.costume)) mine.add(c.sprite.id);
    }
    for (const s of SETS_B) for (const c of costumeList(s.costume)) mine.add(c.sprite.id);
    for (const id of mine) expect(ids.filter((x) => x === id), id).toHaveLength(1);
  });
});

describe('items B: picking each one up applies it', () => {
  it.each(ITEMS_B.map((d) => [d.id, d] as const))('%s', (_id, d) => {
    const sim = roomSim(`b-pick-${d.id}`);
    const p = sim.world.player;
    spawnPedestal(sim.world, p.x + 20, p.y, d.id);
    stepN(sim, makeInput({ moveX: 1 }), 30);
    stepN(sim, makeInput(), 2);
    expect(p.inv.passives).toEqual([d.id]);
    const statEffects = d.effects.filter((e): e is StatEffect => e.type === 'stat');
    const want = computeStats(WREN.stats, statEffects, makeStats());
    for (const k of STAT_IDS) expect(p.stats[k], k).toBeCloseTo(want[k], 6);
    let wantContainers = WREN.hearts.redMax;
    let wantTin = 0;
    let wantEmber = 0;
    let coins = WREN.startPickups.coins;
    let bombs = WREN.startPickups.bombs;
    let keys = WREN.startPickups.keys;
    for (const e of d.effects) {
      switch (e.type) {
        case 'hearts':
          wantContainers += (e.containers ?? 0) * 2;
          wantTin += e.tin ?? 0;
          wantEmber += e.ember ?? 0;
          break;
        case 'pickups':
          coins += e.coins ?? 0;
          bombs += e.bombs ?? 0;
          keys += e.keys ?? 0;
          break;
        case 'flag':
          expect(p.flags[e.flag], e.flag).toBe(true);
          break;
        case 'mod':
          expect(p.attack.mod(e.mod), e.mod).toBe(e.stacks ?? 1);
          break;
        case 'carrier':
          expect(p.attack.stacksOf(e.carrier)).toBe(1);
          break;
        case 'familiar':
          expect(sim.summary().attack.familiars).toContain(e.familiar);
          break;
        case 'trigger':
          expect(p.triggers[e.on].some((t) => t.source === d.id)).toBe(true);
          break;
        default:
          break;
      }
    }
    expect(p.redMax).toBe(wantContainers);
    expect(p.red).toBe(wantContainers); // health ups come filled
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(wantTin);
    expect(bonusHalvesOf(p.health, BONUS_EMBER)).toBe(wantEmber);
    expect([p.inv.coins, p.inv.bombs, p.inv.keys]).toEqual([coins, bombs, keys]);
    if (d.costume) expect(p.loadout.costumes).toContain(d.id);
    // And the attack still works with it for a couple of seconds.
    const arena = arenaSim(`b-fire-${d.id}`, 2, 1);
    give(arena, d.id);
    const input = makeInput({ aimX: 1, aimY: 0 });
    for (let t = 0; t < 120; t++) {
      input.fireHeld = t % 60 < 54;
      input.firePressed = t % 60 === 0;
      arena.step(input);
      clearEdges(input);
      checkAttackInvariants(arena);
    }
    expect(damageDealt(arena)).toBeGreaterThan(0);
  });
});

describe('items B: duplicates snowball', () => {
  it('stat multipliers multiply, flat stats add', () => {
    const sim = roomSim('b-mul');
    give(sim, 'cast-iron-kettle', 2);
    give(sim, 'burnt-coffee-bean', 2);
    give(sim, 'paper-crown', 2); // (two members of one set: no transformation yet)
    const s = sim.world.player.stats;
    expect(s.damage).toBeCloseTo((WREN.stats.damage + 0.6) * 1.3 * 1.3, 6);
    expect(s.fireRate).toBeCloseTo(softCapFireRate((WREN.stats.fireRate + 0.4) * 1.2 * 1.2), 6);
    expect(s.luck).toBeCloseTo(2, 6);
  });

  it('modifier and carrier items stack (bounces, shards, blades)', () => {
    const sim = roomSim('b-mods');
    give(sim, 'skipping-stone', 2);
    give(sim, 'cracked-cats-eye', 2);
    give(sim, 'bone-jacks', 2);
    const a = sim.world.player.attack;
    expect(a.mod('bounce')).toBe(2);
    expect(a.mod('split')).toBe(2);
    expect(a.stacksOf('orbit')).toBe(2);
  });

  it('every familiar item adds another helper', () => {
    const sim = roomSim('b-fams');
    give(sim, 'tin-sentry', 2);
    give(sim, 'gutter-ferret', 1);
    give(sim, 'tadpole-jar', 1);
    stepN(sim, makeInput(), 2);
    const fams = sim.summary().attack.familiars;
    expect(fams.filter((f) => f === 'tin-sentry')).toHaveLength(2);
    expect(fams).toContain('gutter-ferret');
    expect(fams).toContain('tadpole');
  });
});

describe('items B: the four transformations', () => {
  it('two members are not enough; the third completes a set (bonus + costume)', () => {
    const sim = roomSim('b-sets');
    const p = sim.world.player;
    give(sim, 'tin-sentry');
    give(sim, 'paper-crown');
    expect(p.sets).not.toContain('toybox');
    give(sim, 'threadbare-bear');
    expect(p.sets).toContain('toybox');
    expect(p.loadout.costumes).toContain('set:toybox');
    stepN(sim, makeInput(), 2);
    const fams = sim.summary().attack.familiars;
    // One Tin Sentry from the item, two from the set, and the bear.
    expect(fams.filter((f) => f === 'tin-sentry')).toHaveLength(3);
    expect(fams).toContain('threadbare-bear');
  });

  it('Ossuary: bone blades orbit you and every floor starts with a Tin heart', () => {
    const sim = roomSim('b-ossuary');
    const p = sim.world.player;
    give(sim, 'tin-ribcage');
    give(sim, 'merrythought');
    expect(p.attack.stacksOf('orbit')).toBe(0);
    give(sim, 'spine-rattle');
    expect(p.sets).toContain('ossuary');
    expect(p.attack.stacksOf('orbit')).toBe(1);
    give(sim, 'bone-jacks');
    expect(p.attack.stacksOf('orbit')).toBe(2);
    const tin = bonusHalvesOf(p.health, BONUS_TIN);
    sim.floorStarted();
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(tin + 2);
  });

  it('Tidewalker: shots bounce and puddle, speed up', () => {
    const sim = roomSim('b-tide');
    const p = sim.world.player;
    give(sim, 'skipping-stone');
    give(sim, 'leaky-bucket');
    give(sim, 'tadpole-jar');
    expect(p.sets).toContain('tidewalker');
    expect(p.attack.mod('bounce')).toBe(2);
    expect(p.attack.mod('puddle')).toBe(2);
    expect(p.stats.moveSpeed).toBeCloseTo(WREN.stats.moveSpeed + 16, 6);
  });

  it('Glimmer: shots burst into shards (and it stacks with the split items)', () => {
    const sim = roomSim('b-glimmer');
    const p = sim.world.player;
    give(sim, 'pocket-prism');
    give(sim, 'amethyst-heart');
    give(sim, 'glowstone-pendant');
    expect(p.sets).toContain('glimmer');
    expect(p.attack.mod('split')).toBe(1);
    give(sim, 'cracked-cats-eye');
    expect(p.attack.mod('split')).toBe(2);
    const arena = arenaSim('b-glimmer-fire', 2, 0);
    for (const id of ['pocket-prism', 'rock-salt-crystal', 'glowstone-pendant']) give(arena, id);
    const st = stepN(arena, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 90);
    expect(st.events.shotSplit ?? 0).toBeGreaterThan(0);
  });
});

describe('items B: triggers and hooks', () => {
  it('Chattering Teeth: getting hurt bops everything nearby; each copy bops again', () => {
    const one = (copies: number): number => {
      const sim = roomSim(`b-teeth-${copies}`);
      const e = sim.spawnEnemy(foe(), 130, 56)!;
      e.hp = e.maxHp = 1000;
      give(sim, 'chattering-teeth', copies);
      hurt(sim);
      expect(sim.world.player.attack.mod('knockback')).toBe(copies);
      return e.maxHp - e.hp;
    };
    const a = one(1);
    expect(a).toBeGreaterThan(0);
    expect(one(2)).toBeCloseTo(a * 2, 6);
  });

  it('Spine Rattle: getting hurt scares nearby foes (status burst hook) and shots scare for a while', () => {
    const sim = roomSim('b-rattle');
    const near = sim.spawnEnemy(foe(), 150, 56)!;
    const far = sim.spawnEnemy(foe(), 206, 104)!;
    give(sim, 'spine-rattle');
    const st = { nova: 0 };
    hurt(sim);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) if (q.at(i).type === 'nova') st.nova++;
    expect(st.nova).toBe(1);
    expect(near.status.t[ST_FEAR]).toBeGreaterThan(0);
    expect(far.status.t[ST_FEAR]).toBe(0);
    expect(sim.world.player.attack.mod('fear')).toBe(1);
    stepN(sim, makeInput(), 7 * 60);
    expect(sim.world.player.attack.mod('fear')).toBe(0);
  });

  it('Grudge Pebble and Startled Frog: hurt buffs pile up, then wear off', () => {
    const sim = roomSim('b-grudge');
    const p = sim.world.player;
    give(sim, 'grudge-pebble');
    give(sim, 'startled-frog');
    const base = p.stats.damage;
    hurt(sim);
    hurt(sim);
    expect(p.stats.damage).toBeCloseTo(base + 4, 6);
    expect(p.stats.fireRate).toBeGreaterThan(WREN.stats.fireRate + 2);
    expect(p.stats.moveSpeed).toBeGreaterThan(WREN.stats.moveSpeed + 50);
    stepN(sim, makeInput(), 11 * 60);
    expect(p.stats.damage).toBeCloseTo(base, 6);
    expect(p.stats.fireRate).toBeCloseTo(WREN.stats.fireRate, 6);
  });

  it('Chipped Piggy Bank and Rusty Toll Box: coins in, coins out, a Tin heart for the toll', () => {
    const sim = roomSim('b-coins');
    const p = sim.world.player;
    give(sim, 'chipped-piggy-bank', 2);
    sim.roomCleared();
    expect(p.inv.coins).toBe(2);
    p.inv.coins = 10;
    give(sim, 'rusty-toll-box');
    sim.roomCleared(); // +2 from the banks, −4 for the toll
    expect(p.inv.coins).toBe(8);
    expect(countPickups(sim, PK.TinHeart)).toBe(1);
    p.inv.coins = 1;
    sim.roomCleared(); // +2 (3 coins): not enough for the toll
    expect(p.inv.coins).toBe(3);
    expect(countPickups(sim, PK.TinHeart)).toBe(1);
  });

  it('Skeleton Key, Leather Apron, Hand-Me-Down Pockets: keys, bombs, slots', () => {
    const sim = roomSim('b-econ');
    const p = sim.world.player;
    sim.giveItem('skeleton-key');
    sim.giveItem('leather-apron');
    sim.giveItem('hand-me-down-pockets');
    expect(p.inv.keys).toBe(2);
    expect(p.inv.bombs).toBe(WREN.startPickups.bombs + 3);
    expect(p.inv.trinketSlots).toBe(2);
    expect(p.inv.consumableSlots).toBe(2);
    // Your own blasts can't hurt you.
    const red = p.red;
    sim.explode(p.x, p.y);
    expect(p.red).toBe(red);
  });

  it('chance triggers pay out with luck: Merrythought, Skeleton Key, Tin Lunchbox, Thunder Egg', () => {
    const sim = roomSim('b-luck');
    const p = sim.world.player;
    give(sim, 'merrythought');
    give(sim, 'skeleton-key');
    give(sim, 'tin-lunchbox');
    give(sim, 'thunder-egg');
    sim.giveItem('jar-of-lightning');
    p.luckBonus = 50;
    recomputePlayer(sim.world);
    let charged = 0;
    for (let i = 0; i < 30; i++) {
      p.inv.active!.charge = 0;
      sim.roomCleared();
      if (p.inv.active!.charge >= 2) charged++;
    }
    expect(countPickups(sim, PK.TinHeart)).toBeGreaterThan(0);
    expect(countPickups(sim, PK.Key)).toBeGreaterThan(0);
    expect(charged).toBeGreaterThan(0);
    expect(sim.world.pickups.count).toBeGreaterThan(10);
  });

  it("kill triggers: Crow's Jawbone drops Tin hearts, Spare Spoon heals, the Bell makes shots hunt", () => {
    const sim = roomSim('b-kills');
    const p = sim.world.player;
    give(sim, 'crows-jawbone');
    give(sim, 'spare-spoon');
    give(sim, 'stray-cats-bell');
    p.luckBonus = 50;
    recomputePlayer(sim.world);
    hurt(sim, 3);
    const hurtRed = p.red;
    for (let i = 0; i < 60; i++) {
      sim.spawnEnemy(foe(), 60 + (i % 5) * 20, 20);
      sim.killEnemies();
      if (i === 0) expect(p.attack.mod('homing')).toBe(1);
      stepN(sim, makeInput(), 31);
    }
    expect(countPickups(sim, PK.TinHeart)).toBeGreaterThan(0);
    expect(p.red).toBeGreaterThan(hurtRed);
  });

  it('Clover in Amber: a lucky coin every floor', () => {
    const sim = roomSim('b-clover');
    give(sim, 'clover-in-amber', 2);
    sim.floorStarted();
    expect(countPickups(sim, PK.LuckyCoin)).toBe(2);
  });

  it('flight, spectral shots and the health items', () => {
    const sim = roomSim('b-flags');
    const p = sim.world.player;
    sim.giveItem('bundle-of-balloons');
    sim.giveItem('bedsheet-ghost');
    sim.giveItem('warming-pan');
    sim.giveItem('glowstone-pendant');
    expect(p.flags.flying && p.flags.spectral && p.flags.fireImmune).toBe(true);
    expect(p.flags.seeSecrets && p.flags.darkVision).toBe(true);
    expect(p.attack.mod('phase')).toBeGreaterThan(0);
    expect(p.attack.phase).toBe(true);
    sim.giveItem('hot-water-bottle');
    sim.giveItem('amethyst-heart');
    sim.giveItem('sardine-tin');
    expect(p.redMax).toBe(WREN.hearts.redMax + 4);
    expect(bonusHalvesOf(p.health, BONUS_EMBER)).toBe(4 + 2);
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(2 + 6);
  });
});

describe('items B: every one of them ×3 at once', () => {
  it('10 s of waves: under the caps, no NaN, no event overflow, sets complete, kills happen', () => {
    const sim = makeSim('b-absurd', { room: OPEN_ROOM });
    const w = sim.world;
    w.godMode = true;
    for (const d of ITEMS_B) for (let i = 0; i < 3; i++) w.player.inv.passives.push(d.id);
    w.player.inv.version++;
    recomputePlayer(w);
    for (const s of SET_IDS) expect(w.player.sets).toContain(s);
    sim.startWave({ count: 8 });
    const input = makeInput();
    let total = 0;
    for (let t = 0; t < 600; t++) {
      const ph = t % 80;
      input.fireHeld = ph < 74;
      input.firePressed = ph === 0;
      input.fireReleased = ph === 74;
      input.aimX = input.fireHeld ? Math.cos(t * 0.02) : 0;
      input.aimY = input.fireHeld ? Math.sin(t * 0.02) : 0;
      input.moveX = Math.sin(t * 0.02) * 0.6;
      input.moveY = Math.cos(t * 0.031) * 0.6;
      const t0 = performance.now();
      sim.step(input);
      total += performance.now() - t0;
      clearEdges(input);
      checkAttackInvariants(sim);
      // The arena's own clear fires the 'roomClear' triggers (piggy banks, toll boxes, lunchboxes…).
      if (w.enemies.count === 0 && !w.arena.active) sim.startWave({ count: 8 });
    }
    expect(total / 600, 'ms per step').toBeLessThan(6);
    expect(sim.events.dropped).toBe(0);
    expect(w.counters.kills).toBeGreaterThan(10);
    expect(Number.isFinite(w.player.x) && Number.isFinite(w.player.y)).toBe(true);
    expect(getItem('storm-lance').quality).toBe(4); // untouched
  });
});
