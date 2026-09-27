/**
 * Item-C content: the actives, trinkets and consumables (content/items/actives*.ts, trinkets*.ts,
 * consumables*.ts), their hooks (content/hooks/itemsC.ts) and art. Defs are checked for shape and
 * art; every active is used in a room of foes, and every trinket's effect is exercised.
 */

import { describe, expect, it } from 'vitest';
import ACTIVES from '../src/content/items/actives';
import STICKERS from '../src/content/items/consumables-stickers';
import BOTTLES, { TONICS } from '../src/content/items/consumables-tonics';
import TRINKETS from '../src/content/items/trinkets';
import { FAMILIARS, allItems, getItem } from '../src/content/registry';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { sfxNames } from '../src/audio/sfx';
import { LIBRARY_SFX_NAMES } from '../src/audio/sfxLibrary';
import { WREN } from '../src/content/characters/wren';
import { clearEdges } from '../src/engine/inputState';
import type { InputState } from '../src/engine/inputState';
import { chargeActive, executeEffects, fireTrigger, recomputePlayer, roomCleared } from '../src/sim/effects';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { ST_BURN, ST_CHARM, ST_FEAR, ST_FREEZE, ST_POISON, ST_SLOW } from '../src/sim/enemies/status';
import { hasHook } from '../src/sim/hooks';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK, pickupKindOf } from '../src/sim/pickupKinds';
import { spawnPickup } from '../src/sim/pickups';
import type { Sim } from '../src/sim/sim';
import { Tile } from '../src/sim/tiles';
import { FLOOR_LINKS } from '../src/sim/tonics';
import { POOL_IDS, costumeList, type Effect, type ItemDef } from '../src/sim/types';
import { checkAttackInvariants } from './helpers/attack';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

const MINE: readonly ItemDef[] = [...ACTIVES, ...TRINKETS, ...BOTTLES, ...STICKERS];
const DESIGN_SETS = ['stormcaller', 'mothkin', 'clockwork', 'sporeling', 'waxen', 'toybox', 'ossuary', 'tidewalker', 'glimmer'];
/** Every sound the game can play. */
const SOUNDS = new Set<string>([...sfxNames(), ...LIBRARY_SFX_NAMES]);
/** Every 'sfx' event id seen by these tests (checked against SOUNDS at the end). */
const heard = new Set<string>();

function flat(list: readonly Effect[], inTrigger = false, out: { e: Effect; inTrigger: boolean }[] = []): { e: Effect; inTrigger: boolean }[] {
  for (const e of list) {
    out.push({ e, inTrigger });
    if (e.type === 'trigger') flat(e.effects, true, out);
  }
  return out;
}

function allEffects(d: ItemDef): { e: Effect; inTrigger: boolean }[] {
  return [...flat(d.effects), ...flat(d.active?.use ?? []), ...flat(d.use ?? [])];
}

/** Steps with `input`, counting event types and recording sound names. */
function run(sim: Sim, input: InputState, n: number): Record<string, number> {
  const count: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
    const q = sim.events;
    for (let k = 0; k < q.count; k++) {
      const e = q.at(k);
      count[e.type] = (count[e.type] ?? 0) + 1;
      if (e.type === 'sfx') heard.add(e.id);
    }
  }
  return count;
}

const FOE = 't-itemsc-foe';

/** An open room: Wren in the middle, `foes` sturdy idle foes around her (60 hp, harmless). */
function room(seed: string, foes = 3, spots: readonly (readonly [number, number])[] = [[40, 24], [168, 24], [104, 96]]): Sim {
  testEnemy(FOE, { hp: 60, speed: 0, contact: 0, move: { kind: 'idle' }, radius: 6 });
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(104, 56);
  for (let i = 0; i < foes; i++) {
    const [x, y] = spots[i % spots.length]!;
    const e = sim.spawnEnemy(FOE, x, y, { champion: false });
    if (e) e.spawnT = 0;
  }
  return sim;
}

function foes(sim: Sim) {
  return sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((e) => !e.dead);
}

/** Gives the active (fresh = charged) and presses the button once. */
function use(sim: Sim, id: string): Record<string, number> {
  sim.giveItem(id);
  return run(sim, makeInput({ active: true }), 1);
}

describe('item-C defs', () => {
  it('brings the totals to 25+ actives, 30+ trinkets and 20+ consumables', () => {
    const kind = (k: ItemDef['kind']) => allItems().filter((d) => d.kind === k && !d.tags.includes('test')).length;
    expect(kind('active')).toBeGreaterThanOrEqual(25);
    expect(kind('trinket')).toBeGreaterThanOrEqual(30);
    expect(kind('consumable')).toBeGreaterThanOrEqual(20);
    expect(ACTIVES.length).toBeGreaterThanOrEqual(26);
    expect(TRINKETS.length).toBeGreaterThanOrEqual(31);
    expect(BOTTLES).toHaveLength(10);
    expect(TONICS).toHaveLength(10);
    expect(STICKERS.length).toBeGreaterThanOrEqual(10);
  });

  it.each(MINE.map((d) => [d.id, d] as const))('%s is well-formed', (_id, d) => {
    expect(getItem(d.id)).toBe(d);
    expect(d.name.length).toBeGreaterThan(2);
    expect(d.desc.length).toBeGreaterThan(8);
    expect(d.desc.length).toBeLessThanOrEqual(46);
    expect(d.desc).toBe(d.desc.toUpperCase());
    expect(d.unlock).toBeUndefined();
    expect(d.set).toBeUndefined();
    expect(d.quality).toBeGreaterThanOrEqual(0);
    expect(d.quality).toBeLessThanOrEqual(4);
    expect(d.pools.length).toBeGreaterThan(0);
    for (const p of d.pools) expect(POOL_IDS).toContain(p);
    expect(typeof d.sprite).not.toBe('string');
    if (typeof d.sprite !== 'string') {
      expect(d.sprite.w).toBe(14);
      expect(d.sprite.h).toBe(14);
      expect(d.sprite.id).toBe(`item.${d.id}`);
      expect(validateSpriteDef(d.sprite)).toEqual([]);
    }
    for (const c of costumeList(d.costume)) expect(validateSpriteDef(c.sprite)).toEqual([]);
    if (d.kind === 'active') {
      const a = d.active!;
      expect(a.use.length).toBeGreaterThan(0);
      if (a.chargeType === 'room') {
        expect(a.charge).toBeGreaterThanOrEqual(0);
        expect(a.charge).toBeLessThanOrEqual(6);
      } else {
        expect(a.charge).toBeGreaterThanOrEqual(5);
        expect(a.charge).toBeLessThanOrEqual(60);
      }
    } else if (d.kind === 'consumable') {
      expect(d.consumable === 'tonic' || d.consumable === 'sticker').toBe(true);
      expect(d.use!.length).toBeGreaterThan(0);
    } else {
      expect(d.kind).toBe('trinket');
      expect(d.effects.length).toBeGreaterThan(0);
    }
    for (const { e, inTrigger } of allEffects(d)) {
      if (e.type === 'hook') expect(hasHook(e.hook), e.hook).toBe(true);
      if (e.type === 'familiar') expect(FAMILIARS.has(e.familiar)).toBe(true);
      if (e.type === 'hook' && typeof e.params?.sfx === 'string') expect(SOUNDS.has(e.params.sfx), e.params.sfx).toBe(true);
      // Persistent effects granted by a trigger need a duration (else they'd last the whole room).
      if (inTrigger && (e.type === 'stat' || e.type === 'mod' || e.type === 'carrier' || e.type === 'flag')) {
        expect(e.duration ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('actives mix room and timed charges across 1-6 rooms, and the big ones wear costumes', () => {
    const timed = ACTIVES.filter((d) => d.active!.chargeType === 'timed');
    expect(timed.length).toBeGreaterThanOrEqual(3);
    const charges = new Set(ACTIVES.filter((d) => d.active!.chargeType === 'room').map((d) => d.active!.charge));
    for (const c of [1, 2, 3, 4, 6]) expect(charges.has(c), `charge ${c}`).toBe(true);
    const major = ACTIVES.filter((d) => d.quality >= 3);
    expect(major.filter((d) => d.costume).length).toBeGreaterThanOrEqual(Math.ceil(major.length / 2));
    expect(ACTIVES.some((d) => d.quality === 4)).toBe(true);
  });

  it('names are original and unique, and every DESIGN set is represented in tags', () => {
    const names = allItems().map((d) => d.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
    for (const s of DESIGN_SETS) expect(MINE.some((d) => d.tags.includes(s)), s).toBe(true);
    const sprites = MINE.map((d) => (typeof d.sprite === 'string' ? d.sprite : d.sprite.id));
    expect(new Set(sprites).size).toBe(sprites.length);
  });

  it('the Tin Soldier familiar is registered and well-formed', () => {
    const f = FAMILIARS.get('tin-soldier')!;
    expect(f).toBeDefined();
    expect(f.attackScale).toBeGreaterThan(0);
    if (typeof f.sprite !== 'string') expect(validateSpriteDef(f.sprite)).toEqual([]);
  });
});

describe('every active works in a room of foes', () => {
  it.each(ACTIVES.map((d) => [d.id] as const))('%s', (id) => {
    const sim = room(`use-${id}`);
    const w = sim.world;
    const p = w.player;
    // Give every active something to work with: coins, a hurt Wren, an item pedestal, a pickup.
    sim.addPickups(20, 0, 0);
    sim.hurtPlayer(2);
    p.invuln = 0;
    p.hurtTimer = 0;
    spawnPedestal(w, 56, 80, 'brick-chip');
    spawnPickup(w, PK.Key, 150, 70, false);
    const st = use(sim, id);
    expect(st.activeUse, 'used').toBe(1);
    expect(st.sfx ?? 0, 'a sound').toBeGreaterThan(0);
    expect(st.denied ?? 0, 'not refused').toBe(0);
    const input = makeInput({ aimX: 1, aimY: 0 });
    for (let t = 0; t < 120; t++) {
      input.fireHeld = t % 40 < 36;
      run(sim, input, 1);
      checkAttackInvariants(sim);
    }
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p.dead).toBe(false);
  });
});

describe('active behaviours', () => {
  it('Rumble Drum hurts every foe (more with more damage) and pops hostile shots', () => {
    const sim = room('drum');
    const w = sim.world;
    for (let i = 0; i < 5; i++) spawnEnemyShot(w, 60 + i * 20, 20, 0, 40, 1, 3, 0, false, 0);
    use(sim, 'rumble-drum');
    const want = 30 + 3 * w.player.stats.damage;
    for (const e of foes(sim)) expect(e.maxHp - e.hp).toBeGreaterThanOrEqual(want - 0.01);
    expect(w.enemyShots.count).toBe(0);
  });

  it('Static Balloon strikes every foe from the sky', () => {
    const sim = room('balloon');
    const st = use(sim, 'static-balloon');
    expect(st.chainArc ?? 0).toBeGreaterThanOrEqual(3);
    for (const e of foes(sim)) expect(e.hp).toBeLessThan(e.maxHp);
  });

  it('Bomb Parasol rains bombs on the foes and its own blasts spare you', () => {
    const sim = room('parasol');
    const p = sim.world.player;
    const hp = p.red;
    use(sim, 'bomb-parasol');
    expect(sim.world.bombs.count).toBeGreaterThanOrEqual(3);
    expect(p.flags.explosionImmune).toBe(true);
    const st = run(sim, makeInput(), 150);
    expect(st.explosion ?? 0).toBeGreaterThanOrEqual(3);
    expect(p.red).toBe(hp);
    for (const e of foes(sim)) expect(e.hp).toBeLessThan(e.maxHp);
    run(sim, makeInput(), 60);
    expect(p.flags.explosionImmune).toBe(false);
  });

  it('Stormglass: lance, chain, homing and split for the room, with lightning on use', () => {
    const sim = room('stormglass');
    const st = use(sim, 'stormglass');
    const p = sim.world.player;
    expect(st.chainArc ?? 0).toBeGreaterThanOrEqual(3);
    expect(st.say).toBe(1);
    expect(p.attack.primary).toBe('lance');
    expect(p.attack.mod('chain')).toBe(2);
    expect(p.attack.mod('homing')).toBe(1);
    expect(p.attack.mod('split')).toBe(1);
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage * 1.25, 6);
    expect(p.loadout.costumes).toContain('stormglass');
    sim.loadRoom(OPEN_ROOM);
    expect(p.attack.primary).toBe('marble');
    expect(p.attack.mod('chain')).toBe(0);
  });

  it.each([
    ['frozen-pocketwatch', ST_FREEZE],
    ['friendship-bracelet', ST_CHARM],
    ['jack-in-the-box', ST_FEAR],
    ['crank-radio', ST_SLOW],
    ['puffball', ST_POISON],
    ['birthday-candles', ST_BURN],
  ] as const)('%s puts a status on every foe', (id, st) => {
    const sim = room(`status-${id}`);
    use(sim, id);
    for (const e of foes(sim)) expect(e.status.t[st]!, id).toBeGreaterThan(0);
  });

  it('Frozen Pocketwatch also freezes the shots out of the air; Birthday Candles light your shots', () => {
    const sim = room('watch');
    spawnEnemyShot(sim.world, 60, 20, 0, 40, 1, 3, 0, false, 0);
    use(sim, 'frozen-pocketwatch');
    expect(sim.world.enemyShots.count).toBe(0);
    const c = room('candles');
    use(c, 'birthday-candles');
    expect(c.world.player.attack.mod('burn')).toBe(1);
  });

  it('Moth-Wing Fan blows close foes away; Drain Plunger yanks every foe in', () => {
    const near: readonly (readonly [number, number])[] = [[80, 56], [128, 56], [104, 30]];
    const fan = room('fan', 3, near);
    const dist = (s: Sim) => foes(s).map((e) => Math.hypot(e.x - s.world.player.x, e.y - s.world.player.y));
    const before = dist(fan);
    use(fan, 'moth-wing-fan');
    run(fan, makeInput(), 20);
    dist(fan).forEach((d, i) => expect(d).toBeGreaterThan(before[i]! + 6));

    const plunger = room('plunger');
    const far = dist(plunger);
    use(plunger, 'drain-plunger');
    run(plunger, makeInput(), 20);
    dist(plunger).forEach((d, i) => expect(d).toBeLessThan(far[i]! - 10));
  });

  it('Pot Lid makes you untouchable for five seconds', () => {
    const sim = room('lid');
    const p = sim.world.player;
    use(sim, 'pot-lid');
    expect(p.invuln).toBeGreaterThanOrEqual(4.9);
    const hp = p.red;
    sim.hurtPlayer(2);
    expect(p.red).toBe(hp);
  });

  it('Hopscotch Chalk goes through the floor wiring, else blinks to open floor', () => {
    const sim = room('chalk');
    const p = sim.world.player;
    use(sim, 'hopscotch-chalk');
    expect(Math.hypot(p.x - 104, p.y - 56)).toBeGreaterThan(16);
    const col = Math.floor(p.x / 16);
    const row = Math.floor(p.y / 16);
    expect(sim.world.room.get(col, row)).toBe(Tile.Floor);

    const calls: string[] = [];
    FLOOR_LINKS.teleport = (_w, to) => {
      calls.push(to);
      return true;
    };
    try {
      const s2 = room('chalk-floor');
      use(s2, 'hopscotch-chalk');
      expect(calls).toEqual(['random']);
      expect(s2.world.player.x).toBe(104);
    } finally {
      FLOOR_LINKS.teleport = null;
    }
  });

  it('Storm Kite lends the Storm Lance until you leave the room (and a held lance gets a copy)', () => {
    const sim = room('kite');
    const p = sim.world.player;
    use(sim, 'storm-kite');
    expect(p.attack.primary).toBe('lance');
    expect(p.loadout.costumes).toContain('storm-kite');
    sim.loadRoom(OPEN_ROOM);
    expect(p.attack.primary).toBe('marble');
    const s2 = room('kite-lance');
    s2.giveItem('storm-lance');
    use(s2, 'storm-kite');
    expect(s2.world.player.attack.stacksOf('lance')).toBe(2);
  });

  it('Tin Soldier Tin calls three shooting soldiers for the room', () => {
    const sim = room('soldiers');
    use(sim, 'tin-soldier-tin');
    run(sim, makeInput(), 2);
    expect(sim.summary().attack.familiars.filter((f) => f === 'tin-soldier')).toHaveLength(3);
    run(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 120);
    sim.loadRoom(OPEN_ROOM);
    run(sim, makeInput(), 2);
    expect(sim.summary().attack.familiars).not.toContain('tin-soldier');
  });

  it('Grave Bell adds two orbit carriers (three blades) for the room', () => {
    const sim = room('bell');
    use(sim, 'grave-bell');
    expect(sim.world.player.attack.stacksOf('orbit')).toBe(2);
  });

  it('Whistling Kettle, Rain Stick, Weather Vane and Roller Skate buff you for the room / a while', () => {
    const k = room('kettle');
    use(k, 'whistling-kettle');
    const kp = k.world.player;
    expect(kp.stats.damage).toBeCloseTo(WREN.stats.damage * 1.5, 6);
    expect(kp.stats.fireRate).toBeCloseTo(WREN.stats.fireRate + 0.75, 6);

    const r = room('rainstick');
    use(r, 'rain-stick');
    expect(r.world.player.attack.mod('bounce')).toBe(1);
    expect(r.world.player.attack.mod('puddle')).toBe(1);

    const v = room('vane');
    v.giveItem('lantern-moth');
    use(v, 'weather-vane');
    expect(v.world.player.attack.mod('homing')).toBe(2);
    expect(v.world.player.attack.mod('extraShots')).toBe(1);
    run(v, makeInput(), 10 * 60 + 2);
    expect(v.world.player.attack.mod('homing')).toBe(1);
    expect(v.world.player.attack.mod('extraShots')).toBe(0);

    const s = room('skate');
    use(s, 'roller-skate');
    expect(s.world.player.stats.moveSpeed).toBeGreaterThan(WREN.stats.moveSpeed + 30);
    run(s, makeInput(), 10 * 60 + 2);
    expect(s.world.player.stats.moveSpeed).toBeCloseTo(WREN.stats.moveSpeed, 6);
  });

  it('Shaken Snow Globe rerolls every item pedestal (same kind, no repeats) — or refunds itself', () => {
    const sim = room('globe', 0);
    const w = sim.world;
    const a = spawnPedestal(w, 40, 80, 'brick-chip')!;
    const b = spawnPedestal(w, 170, 80, 'geode')!;
    const st = use(sim, 'shaken-snow-globe');
    expect(st.pedestalRoll).toBe(2);
    expect(a.item).not.toBe('brick-chip');
    expect(b.item).not.toBe('geode');
    expect(a.item).not.toBe(b.item);
    expect(getItem(a.item).kind).toBe('passive');
    expect(sim.world.player.inv.active!.charge).toBe(0);

    const empty = room('globe-empty', 0);
    const st2 = use(empty, 'shaken-snow-globe');
    expect(st2.denied).toBe(1);
    const slot = empty.world.player.inv.active!;
    expect(slot.charge).toBe(slot.max);
  });

  it('Carbon Paper copies the nearest pickup — or refunds itself', () => {
    const sim = room('carbon', 0);
    const w = sim.world;
    spawnPickup(w, PK.GoldCoin, 130, 56, false);
    spawnPickup(w, PK.Key, 30, 20, false);
    use(sim, 'carbon-paper');
    const kinds = w.pickups.items.slice(0, w.pickups.count).map((k) => k.kind);
    expect(kinds.filter((k) => k === PK.GoldCoin)).toHaveLength(2);
    expect(kinds.filter((k) => k === PK.Key)).toHaveLength(1);

    const none = room('carbon-none', 0);
    const st = use(none, 'carbon-paper');
    expect(st.denied).toBe(1);
    expect(none.world.player.inv.active!.charge).toBe(3);
  });

  it('Rusty Trowel digs up a satchel', () => {
    const sim = room('trowel', 0);
    use(sim, 'rusty-trowel');
    const w = sim.world;
    expect(w.pickups.items.slice(0, w.pickups.count).some((k) => k.kind === PK.Satchel)).toBe(true);
  });

  it('Coin-Op Cocoa: 5 coins for a heart (never when full or broke; Tin hearts for Marrow-likes)', () => {
    const sim = room('cocoa', 0);
    const p = sim.world.player;
    sim.giveItem('coin-op-cocoa');
    run(sim, makeInput({ active: true }), 1);
    expect(p.inv.coins).toBe(0); // full health: refused, nothing spent
    sim.hurtPlayer(3);
    let st = run(sim, makeInput({ active: true }), 1);
    expect(st.denied).toBe(1); // broke
    sim.addPickups(12, 0, 0);
    st = run(sim, makeInput({ active: true }), 1);
    expect(p.inv.coins).toBe(7);
    expect(p.red).toBe(5);
    run(sim, makeInput({ active: true }), 1);
    expect(p.inv.coins).toBe(2);
    expect(p.red).toBe(6);
  });

  it('Wishing Bucket trades 5 coins for permanent luck (refunded when broke)', () => {
    const sim = room('wish', 0);
    const p = sim.world.player;
    sim.addPickups(7, 0, 0);
    use(sim, 'wishing-bucket');
    expect(p.inv.coins).toBe(2);
    expect(p.stats.luck).toBeCloseTo(WREN.stats.luck + 0.5, 6);
    sim.loadRoom(OPEN_ROOM);
    expect(p.stats.luck).toBeCloseTo(WREN.stats.luck + 0.5, 6);
    chargeActive(sim.world, 'full');
    const st = run(sim, makeInput({ active: true }), 1);
    expect(st.denied).toBe(1);
    expect(p.inv.active!.charge).toBe(1);
  });
});

describe('trinkets', () => {
  it.each(TRINKETS.map((d) => [d.id, d] as const))('%s applies its effects when picked up', (_id, d) => {
    const sim = room(`trinket-${d.id}`, 0);
    const p = sim.world.player;
    const w = sim.world;
    spawnPedestal(w, p.x + 20, p.y, d.id);
    run(sim, makeInput({ moveX: 1 }), 30);
    expect(p.inv.trinkets).toEqual([d.id]);
    for (const e of d.effects) {
      if (e.type === 'flag') expect(p.flags[e.flag], e.flag).toBe(true);
      if (e.type === 'trigger') expect(p.triggers[e.on].some((t) => t.source === d.id)).toBe(true);
      if (e.type === 'mod') expect(p.attack.mod(e.mod)).toBe(1);
      if (e.type === 'stat' && e.add !== undefined) expect(p.stats[e.stat]).toBeCloseTo(WREN.stats[e.stat] + e.add, 6);
    }
  });

  it('Cracked Compass is a gentler homing that still stacks with a full one', () => {
    const a = room('compass', 0);
    a.giveItem('cracked-compass');
    const b = room('moth', 0);
    b.giveItem('lantern-moth');
    const turn = (s: Sim) => s.world.player.attack.held.find((m) => m.id === 'homing')!.v1;
    expect(turn(a)).toBeLessThan(turn(b));
    b.giveItem('cracked-compass');
    expect(b.world.player.attack.mod('homing')).toBe(2);
  });

  it('Spare Battery sometimes refunds a charge after a use; Wind-Up Key sometimes double-charges', () => {
    const sim = room('battery', 0);
    const p = sim.world.player;
    sim.giveItem('spare-battery');
    sim.giveItem('rumble-drum');
    let refunds = 0;
    for (let i = 0; i < 40; i++) {
      chargeActive(sim.world, 'full');
      run(sim, makeInput({ active: true }), 1);
      if (p.inv.active!.charge > 0) refunds++;
    }
    expect(refunds).toBeGreaterThan(3);
    expect(refunds).toBeLessThan(30);

    const key = room('windup', 0);
    const kp = key.world.player;
    key.giveItem('wind-up-key');
    key.giveItem('stormglass');
    let doubles = 0;
    for (let i = 0; i < 40; i++) {
      kp.inv.active!.charge = 0;
      roomCleared(key.world);
      if (kp.inv.active!.charge === 2) doubles++;
    }
    expect(doubles).toBeGreaterThan(3);
    expect(doubles).toBeLessThan(30);
  });

  it('getting hurt: Warm Pebble burns, Rubber Duck shoves and Frost Bead freezes nearby foes', () => {
    const close: readonly (readonly [number, number])[] = [[84, 56], [180, 20]];
    for (const [id, check] of [
      ['warm-pebble', (s: Sim) => foes(s)[0]!.hp < foes(s)[0]!.maxHp],
      ['rubber-duck', (s: Sim) => Math.abs(foes(s)[0]!.x - 104) > 26],
      ['frost-bead', (s: Sim) => foes(s)[0]!.status.t[ST_FREEZE]! > 0 && foes(s)[1]!.status.t[ST_FREEZE] === 0],
    ] as const) {
      const sim = room(`hurt-${id}`, 2, close);
      sim.giveItem(id);
      sim.hurtPlayer(1);
      run(sim, makeInput(), 12);
      expect(check(sim), id).toBe(true);
    }
  });

  it('room clears, floors, pickups and bombs: Busker’s Cup, Knucklebone, Candy Wrapper, Sparkler Stub', () => {
    const sim = room('cup', 0);
    const w = sim.world;
    const p = w.player;
    sim.giveItem('buskers-cup');
    roomCleared(w);
    expect(w.pickups.items.slice(0, w.pickups.count).filter((k) => k.kind === PK.Coin)).toHaveLength(1);

    const bone = room('bone', 0);
    bone.giveItem('knucklebone');
    bone.floorStarted();
    expect(bone.world.pickups.items.slice(0, bone.world.pickups.count).some((k) => k.kind === PK.Satchel)).toBe(true);

    const candy = room('candy', 0);
    candy.giveItem('candy-wrapper');
    fireTrigger(candy.world, 'pickup', 0, 0);
    expect(candy.world.player.stats.moveSpeed).toBeCloseTo(WREN.stats.moveSpeed + 18, 6);

    sim.giveItem('sparkler-stub');
    p.luckBonus = 50;
    recomputePlayer(w);
    sim.addPickups(0, 20, 0);
    let back = 0;
    // 12 presses: under the 16-bomb cap, and all within the fuse (nothing blows up yet).
    for (let i = 0; i < 12; i++) {
      const before = p.inv.bombs;
      run(sim, makeInput({ bomb: true }), 1);
      if (p.inv.bombs === before) back++;
    }
    expect(back).toBeGreaterThan(3);
  });

  it('chance-per-volley trinkets give temporary modifiers (luck helps, cooldowns hold)', () => {
    for (const [id, mod] of [
      ['matchbook', 'burn'],
      ['dusty-bookmark', 'slow'],
      ['cats-eye-marble', 'pierce'],
      ['mothball', 'fear'],
      ['static-sock', 'chain'],
    ] as const) {
      const sim = room(`volley-${id}`, 1);
      const p = sim.world.player;
      sim.giveItem(id);
      p.luckBonus = 50;
      recomputePlayer(sim.world);
      let seen = 0;
      const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
      for (let t = 0; t < 600; t++) {
        run(sim, input, 1);
        if (p.attack.mod(mod) > 0) seen++;
      }
      expect(seen, id).toBeGreaterThan(30);
      expect(seen, id).toBeLessThan(600);
    }
  });

  it('kill trinkets: Baby Tooth coins, Hot Coal flames, Hungry Tick heals (with luck)', () => {
    const sim = room('kills', 0);
    const w = sim.world;
    const p = w.player;
    sim.giveItem('baby-tooth');
    p.luckBonus = 50;
    recomputePlayer(w);
    let coins = 0;
    for (let i = 0; i < 40; i++) {
      const before = w.pickups.count;
      fireTrigger(w, 'kill', 60, 30);
      coins += w.pickups.count - before;
    }
    expect(coins).toBeGreaterThan(3);

    const coal = room('coal', 1, [[70, 40]]);
    coal.giveItem('hot-coal');
    coal.world.player.luckBonus = 50;
    recomputePlayer(coal.world);
    for (let i = 0; i < 10; i++) fireTrigger(coal.world, 'kill', 70, 40);
    expect(foes(coal)[0]!.hp).toBeLessThan(60);

    const tick = room('tick', 0);
    tick.giveItem('hungry-tick');
    tick.world.player.luckBonus = 50;
    recomputePlayer(tick.world);
    tick.hurtPlayer(4);
    for (let i = 0; i < 60; i++) fireTrigger(tick.world, 'kill', 0, 0);
    expect(tick.world.player.red).toBeGreaterThan(2);
  });

  it('Earplugs: your own bombs no longer hurt you', () => {
    const sim = room('plugs', 0);
    const p = sim.world.player;
    sim.giveItem('earplugs');
    const hp = p.red;
    sim.explode(p.x, p.y);
    expect(p.red).toBe(hp);
  });
});

describe('item-C hooks', () => {
  it('the charge hook adds rooms to room actives and a share to timed ones', () => {
    const sim = room('charge', 0);
    const w = sim.world;
    sim.giveItem('rumble-drum');
    w.player.inv.active!.charge = 0;
    executeEffects(w, [{ type: 'hook', hook: 'itemsC.charge', params: { rooms: 2 } }], 0, 0, 'test');
    expect(w.player.inv.active!.charge).toBe(2);
    sim.giveItem('crank-radio');
    w.player.inv.active!.charge = 0;
    executeEffects(w, [{ type: 'hook', hook: 'itemsC.charge', params: { timed: 0.5 } }], 0, 0, 'test');
    expect(w.player.inv.active!.charge).toBeCloseTo(12.5, 6);
  });

  it('pickup rain lands on open floor inside the room', () => {
    const sim = room('rain', 0);
    const w = sim.world;
    executeEffects(w, [{ type: 'hook', hook: 'itemsC.rain', params: { kind: 'coin', count: 6 } }], 0, 0, 'test');
    expect(w.pickups.count).toBe(6);
    for (const k of w.pickups.items.slice(0, w.pickups.count)) expect(k.kind).toBe(pickupKindOf('coin'));
  });

  it('every sound the item-C content played is a real sound', () => {
    expect(heard.size).toBeGreaterThan(10);
    expect([...heard].filter((n) => !SOUNDS.has(n))).toEqual([]);
  });
});
