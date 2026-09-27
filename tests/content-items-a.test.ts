/**
 * Items pack A (content/items/passives-a-*.ts): 42 passives — the Stormcaller, Mothkin, Clockwork,
 * Sporeling and Waxen sets (with their set files and costumes), general stat multipliers, luck
 * engines and "useless alone" oddities — plus the pack's familiars, hook and art.
 */

import { describe, expect, it } from 'vitest';
import { WREN } from '../src/content/characters/wren';
import { FAMILIARS, ITEMS, SETS, getItem, getSet } from '../src/content/registry';
import { ITEMS_A_COSTUME_SPRITES } from '../src/content/sprites/itemsA-costumes';
import { ITEMS_A_FAMILIAR_SPRITES } from '../src/content/sprites/itemsA-familiars';
import { ITEMS_A_ICONS } from '../src/content/sprites/itemsA-icons';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { validateContent } from '../src/content/validate';
import { clearEdges } from '../src/engine/inputState';
import { F_CIRCLING, F_RETURNING } from '../src/sim/attack/state';
import { fireTrigger, hookApi, leftRoom, recomputePlayer } from '../src/sim/effects';
import { BONUS_EMBER, BONUS_TIN, bonusHalvesOf } from '../src/sim/health';
import { getHook, hasHook } from '../src/sim/hooks';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK } from '../src/sim/pickupKinds';
import type { Sim } from '../src/sim/sim';
import { computeStats, makeStats, softCapFireRate } from '../src/sim/stats';
import {
  MOD_IDS,
  PLAYER_FLAGS,
  POOL_IDS,
  STAT_IDS,
  TRIGGER_EVENTS,
  costumeList,
  type Effect,
  type ItemDef,
  type SpriteDef,
  type StatEffect,
} from '../src/sim/types';
import { arenaSim, checkAttackInvariants, damageDealt, give } from './helpers/attack';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

// ── The pack ────────────────────────────────────────────────────────────────────

const MODULES = import.meta.glob<{ default: ItemDef[] }>('../src/content/items/passives-a-*.ts', { eager: true });
const PACK: readonly ItemDef[] = Object.keys(MODULES)
  .sort()
  .flatMap((f) => MODULES[f]!.default);
const SET_IDS = ['stormcaller', 'mothkin', 'clockwork', 'sporeling', 'waxen'] as const;
/** Characters the pixel font can draw (render/font.ts). */
const FONT = /^[A-Z0-9 .,!?:;'"\-+=/()[\]%*#<>&°·♥¤←→↑↓]*$/;

/** Every effect, triggers flattened (with the trigger that holds it). */
function flat(list: readonly Effect[], trigger: Effect | null = null, out: { e: Effect; t: Effect | null }[] = []): { e: Effect; t: Effect | null }[] {
  for (const e of list) {
    out.push({ e, t: trigger });
    if (e.type === 'trigger') flat(e.effects, e, out);
  }
  return out;
}

const isPersistentType = (e: Effect): boolean => e.type === 'stat' || e.type === 'mod' || e.type === 'carrier' || e.type === 'familiar' || e.type === 'flag';

describe('items pack A: defs', () => {
  it('has 42 passives: 5-6 per set, ~14 without a set, 3+ familiars', () => {
    expect(PACK).toHaveLength(42);
    expect(new Set(PACK.map((d) => d.id)).size).toBe(42);
    for (const d of PACK) expect(ITEMS.get(d.id)).toBe(d);
    for (const s of SET_IDS) {
      const members = PACK.filter((d) => d.set === s);
      expect(members.length, s).toBeGreaterThanOrEqual(5);
      expect(members.length, s).toBeLessThanOrEqual(6);
    }
    expect(PACK.filter((d) => !d.set).length).toBeGreaterThanOrEqual(12);
    expect(PACK.filter((d) => d.effects.some((e) => e.type === 'familiar')).length).toBeGreaterThanOrEqual(3);
  });

  it('the whole content set still validates', () => {
    expect(validateContent()).toEqual([]);
  });

  it.each(PACK.map((d) => [d.id, d] as const))('%s is well-formed', (_id, d) => {
    expect(d.kind).toBe('passive');
    expect(d.unlock).toBeUndefined();
    expect(d.name.length).toBeGreaterThan(2);
    expect(d.name.toUpperCase()).toMatch(FONT);
    expect(d.desc.length).toBeGreaterThan(8);
    expect(d.desc.length).toBeLessThanOrEqual(46);
    expect(d.desc).toBe(d.desc.toUpperCase());
    expect(d.desc).toMatch(FONT);
    expect(d.quality).toBeGreaterThanOrEqual(0);
    expect(d.quality).toBeLessThanOrEqual(4);
    expect(d.pools.length).toBeGreaterThan(0);
    for (const p of d.pools) expect(POOL_IDS).toContain(p);
    expect(d.pools).not.toContain('chest'); // lockbox rolls are for trinkets / consumables
    expect(d.effects.length).toBeGreaterThan(0);
    // A real 14×14 icon and valid costume layers.
    expect(typeof d.sprite).not.toBe('string');
    if (typeof d.sprite !== 'string') {
      expect([d.sprite.w, d.sprite.h]).toEqual([14, 14]);
      expect(validateSpriteDef(d.sprite)).toEqual([]);
    }
    for (const c of costumeList(d.costume)) expect(validateSpriteDef(c.sprite)).toEqual([]);
    // A set member carries its set's tag too (synergies can require tags).
    if (d.set) expect(d.tags).toContain(d.set);
    for (const { e, t } of flat(d.effects)) {
      switch (e.type) {
        case 'stat':
          expect(STAT_IDS).toContain(e.stat);
          expect(e.add !== undefined || e.mul !== undefined).toBe(true);
          if (e.mul !== undefined) expect(e.mul).toBeGreaterThan(0);
          break;
        case 'mod':
          expect(MOD_IDS).toContain(e.mod);
          expect(e.stacks ?? 1).toBeGreaterThan(0);
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
          if (e.say) expect(e.say).toMatch(FONT);
          break;
        default:
          break;
      }
      // Frequent triggers (every volley / every kill) may only grant timed boosts, and per-kill boosts
      // need a cooldown, so the number of live temporary effects stays bounded however fast things die.
      if (t && t.type === 'trigger' && (t.on === 'fire' || t.on === 'kill') && isPersistentType(e)) {
        expect((e as { duration?: number }).duration ?? 0, `${d.id}: timed`).toBeGreaterThan(0);
        if (t.on === 'kill') expect(t.cooldown ?? 0, `${d.id}: kill cooldown`).toBeGreaterThan(0);
      }
    }
  });

  it('names are unique game-wide and qualities are spread out', () => {
    const names = [...ITEMS.values()].map((d) => d.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
    const qualities = new Set(PACK.map((d) => d.quality));
    expect(qualities.size).toBeGreaterThanOrEqual(3);
    // Major items wear costumes.
    const major = PACK.filter((d) => d.quality >= 3);
    expect(major.length).toBeGreaterThanOrEqual(5);
    expect(major.filter((d) => d.costume).length).toBeGreaterThanOrEqual(Math.ceil(major.length * 0.75));
  });

  it('art: every icon, familiar and costume sprite is valid and uniquely named', () => {
    const all: SpriteDef[] = [...ITEMS_A_ICONS, ...ITEMS_A_FAMILIAR_SPRITES, ...ITEMS_A_COSTUME_SPRITES];
    for (const s of all) expect(validateSpriteDef(s), s.id).toEqual([]);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const s of ITEMS_A_ICONS) expect([s.w, s.h]).toEqual([14, 14]);
    for (const s of [...ITEMS_A_FAMILIAR_SPRITES, ...ITEMS_A_COSTUME_SPRITES]) {
      expect(s.anchorX ?? 0).toBeGreaterThanOrEqual(0);
      expect(s.anchorX ?? 0).toBeLessThan(s.w);
      expect(s.anchorY ?? 0).toBeLessThan(s.h);
    }
    for (const s of ITEMS_A_FAMILIAR_SPRITES) expect(s.frames).toHaveLength(2);
    // Every pack item uses one of the pack's icons.
    const icons = new Set(ITEMS_A_ICONS);
    for (const d of PACK) expect(icons.has(d.sprite as SpriteDef), d.id).toBe(true);
  });

  it('familiars: five new helpers, each with its own behaviour mix', () => {
    const ids = ['blinkbug', 'gloamwing', 'tin-cuckoo', 'toddlecap', 'tallow-tot'];
    for (const id of ids) {
      const f = FAMILIARS.get(id)!;
      expect(f, id).toBeDefined();
      expect(f.radius).toBeGreaterThan(0);
      expect(f.attackScale > 0 || (f.contactDamage ?? 0) > 0, id).toBe(true);
    }
    expect(new Set(ids.map((id) => FAMILIARS.get(id)!.behavior)).size).toBeGreaterThanOrEqual(4);
  });
});

describe('items pack A: sets', () => {
  it.each(SET_IDS.map((s) => [s] as const))('%s: a strong bonus, a transformation costume, 3 of 5-6 members', (id) => {
    const set = getSet(id);
    expect(SETS.get(id)).toBe(set);
    expect(set.need).toBe(3);
    expect(set.name.length).toBeGreaterThan(2);
    expect(set.desc.length).toBeLessThanOrEqual(46);
    expect(set.desc).toMatch(FONT);
    expect(set.effects.length).toBeGreaterThanOrEqual(2);
    const layers = costumeList(set.costume);
    expect(layers.length).toBeGreaterThanOrEqual(1);
    for (const c of layers) expect(validateSpriteDef(c.sprite)).toEqual([]);
  });

  /** A sim holding `ids` (one copy each, no pickup ceremony). */
  const holding = (seed: string, ids: readonly string[]): Sim => {
    const sim = makeSim(seed, { room: OPEN_ROOM });
    for (const id of ids) sim.world.player.inv.passives.push(id);
    sim.world.player.inv.version++;
    recomputePlayer(sim.world);
    return sim;
  };
  const members = (s: string): string[] => PACK.filter((d) => d.set === s).map((d) => d.id);

  it('two members are not enough; any three distinct members transform', () => {
    for (const s of SET_IDS) {
      const ids = members(s);
      const two = holding(`set2-${s}`, ids.slice(0, 2));
      expect(two.world.player.sets, s).not.toContain(s);
      const three = holding(`set3-${s}`, ids.slice(-3));
      expect(three.world.player.sets, s).toContain(s);
      expect(three.world.player.loadout.costumes, s).toContain(`set:${s}`);
    }
  });

  it('the bonuses land: chain + damage, flight + dust, fire rate + gear ricochet, spore kills, burning light', () => {
    const storm = holding('storm', ['wool-mitten', 'falling-barometer', 'blinkbug']);
    const sp = storm.world.player;
    expect(sp.attack.mod('chain')).toBe(1);
    expect(sp.stats.damage).toBeCloseTo((WREN.stats.damage + 0.3 + 0.5) * 1.15, 5);

    const moth = holding('moth', ['snug-cocoon', 'gloamwing', 'eyespot-charm']);
    const mp = moth.world.player;
    expect(mp.flags.flying).toBe(true);
    expect(mp.attack.mod('slow')).toBe(1);
    expect(mp.attack.mod('puddle')).toBe(1);

    const clock = holding('clock', ['pocket-metronome', 'tin-cuckoo', 'ratchet-wrench']);
    const cp = clock.world.player;
    expect(cp.attack.mod('bounce')).toBe(1);
    expect(cp.stats.fireRate).toBeCloseTo(softCapFireRate((WREN.stats.fireRate + 0.15 + 0.5) * 1.2 * 1.2), 5);
    // One ricochet per shot (the bounce modifier's 2 per stack, trimmed by the set's params).
    clock.step(makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true }));
    expect(clock.world.projectiles.items[0]!.bounceLeft).toBe(1);

    const spore = holding('spore', ['foxfire-cap', 'toddlecap', 'shelf-fungus']);
    expect(spore.world.player.triggers.kill.some((t) => t.source === 'sporeling')).toBe(true);
    expect(getSet('sporeling').effects.some((e) => e.type === 'hearts' && e.containers === 1)).toBe(true);

    const wax = holding('wax', ['trick-candle', 'sealing-wax', 'tallow-tot']);
    const wp = wax.world.player;
    expect(wp.attack.mod('burn')).toBe(2);
    expect(wp.flags.fireImmune).toBe(true);
    expect(wp.flags.darkVision).toBe(true);
  });
});

// ── Picking things up ────────────────────────────────────────────────────────────

/** A 13×7 open room with Wren in the middle. */
function pickupSim(seed: string): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(104, 56);
  return sim;
}

/** Walks Wren into a pedestal carrying `id` (the real pickup path, one-time effects included). */
function walkInto(sim: Sim, id: string): void {
  const p = sim.world.player;
  spawnPedestal(sim.world, p.x + 20, p.y, id);
  stepN(sim, makeInput({ moveX: 1 }), 30);
  stepN(sim, makeInput(), 2);
}

describe('items pack A: picking each one up', () => {
  it.each(PACK.map((d) => [d.id, d] as const))('%s applies its effects and fires cleanly', (_id, d) => {
    const sim = pickupSim(`a-pickup-${d.id}`);
    const p = sim.world.player;
    const redMax = p.health.redMax;
    const tin = bonusHalvesOf(p.health, BONUS_TIN);
    walkInto(sim, d.id);
    expect(p.inv.passives).toEqual([d.id]);
    const statEffects = d.effects.filter((e): e is StatEffect => e.type === 'stat');
    const want = computeStats(WREN.stats, statEffects, makeStats());
    for (const k of STAT_IDS) expect(p.stats[k], k).toBeCloseTo(want[k], 6);
    const mods = new Map<string, number>();
    for (const e of d.effects) {
      switch (e.type) {
        case 'mod':
          mods.set(e.mod, (mods.get(e.mod) ?? 0) + (e.stacks ?? 1));
          break;
        case 'familiar':
          expect(sim.summary().attack.familiars).toContain(e.familiar);
          break;
        case 'trigger':
          expect(p.triggers[e.on].some((t) => t.source === d.id)).toBe(true);
          break;
        case 'flag':
          expect(p.flags[e.flag]).toBe(true);
          break;
        case 'hearts':
          expect(p.health.redMax).toBe(redMax + 2 * (e.containers ?? 0));
          expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(tin + (e.tin ?? 0));
          break;
        default:
          break;
      }
    }
    for (const [m, n] of mods) expect(p.attack.mod(m as never), m).toBe(n);
    if (d.costume) expect(p.loadout.costumes).toContain(d.id);
    // Two seconds of fighting in an arena: invariants hold and damage lands.
    const arena = arenaSim(`a-fire-${d.id}`, 2, 1);
    give(arena, d.id);
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 120; t++) {
      input.firePressed = t === 0;
      arena.step(input);
      clearEdges(input);
      checkAttackInvariants(arena);
    }
    expect(damageDealt(arena)).toBeGreaterThan(0);
  });
});

// ── Stacking ─────────────────────────────────────────────────────────────────────

describe('items pack A: duplicates and combos snowball', () => {
  it('stat items multiply: Lead Marble ×3, Gold Star Badge ×2, Pocket Metronome + Clockwork Heart', () => {
    const sim = pickupSim('mul');
    give(sim, 'lead-marble', 3);
    const p = sim.world.player;
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage * 1.3 ** 3, 5);
    give(sim, 'gold-star-badge', 2);
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage * 1.3 ** 3 * 1.1 ** 2, 5);
    expect(p.stats.range).toBeCloseTo(WREN.stats.range * 1.1 ** 2, 5);
    const clock = pickupSim('mul-rate');
    give(clock, 'pocket-metronome');
    give(clock, 'clockwork-heart');
    expect(clock.world.player.stats.fireRate).toBeCloseTo(WREN.stats.fireRate * 1.2 * 1.15, 5);
    const brew = pickupSim('mul-brew');
    give(brew, 'cold-brew-can', 2);
    expect(brew.world.player.stats.fireRate).toBeCloseTo((WREN.stats.fireRate + 1) * 1.1 ** 2, 5);
    const glass = pickupSim('mul-glass');
    give(glass, 'magnifying-glass', 2);
    expect(glass.world.player.stats.shotSize).toBeCloseTo(WREN.stats.shotSize * 1.35 ** 2, 5);
  });

  it('Candelabra: two copies fire five shots a volley (and damage per shot multiplies down)', () => {
    const sim = pickupSim('candelabra');
    give(sim, 'candelabra', 2);
    const p = sim.world.player;
    expect(p.attack.mod('extraShots')).toBe(4);
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage * 0.8 * 0.8, 5);
    sim.step(makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true }));
    expect(sim.world.projectiles.count).toBe(5);
  });

  it('the whole pack at once snowballs far past a bare marble', () => {
    const run = (withPack: boolean): number => {
      const sim = arenaSim('a-snowball', 3, 2);
      if (withPack) for (const d of PACK) give(sim, d.id);
      stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 300);
      return damageDealt(sim);
    };
    expect(run(true)).toBeGreaterThan(run(false) * 5);
  });

  it('the whole pack ×3: 8 s of waves stays under the caps, cheap and deterministic', () => {
    const build = (seed: string): Sim => {
      const sim = makeSim(seed, { room: OPEN_ROOM });
      sim.world.godMode = true;
      for (const d of PACK) for (let i = 0; i < 3; i++) sim.world.player.inv.passives.push(d.id);
      sim.world.player.inv.version++;
      recomputePlayer(sim.world);
      sim.startWave({ count: 8 });
      return sim;
    };
    const play = (sim: Sim, ticks: number): number => {
      const input = makeInput();
      let total = 0;
      for (let t = 0; t < ticks; t++) {
        const ph = t % 80;
        input.fireHeld = ph < 74;
        input.firePressed = ph === 0;
        input.aimX = input.fireHeld ? Math.cos(t * 0.02) : 0;
        input.aimY = input.fireHeld ? Math.sin(t * 0.02) : 0;
        input.moveX = Math.sin(t * 0.02) * 0.6;
        const t0 = performance.now();
        sim.step(input);
        total += performance.now() - t0;
        clearEdges(input);
        checkAttackInvariants(sim);
        if (sim.world.enemies.count === 0 && !sim.world.arena.active) sim.startWave({ count: 8 });
      }
      return total / ticks;
    };
    const a = build('a-absurd');
    const ms = play(a, 480);
    expect(ms, 'ms per step').toBeLessThan(6);
    expect(a.events.dropped).toBe(0);
    expect(a.world.counters.kills).toBeGreaterThan(10);
    // Temporary boosts stay bounded however fast things die.
    expect(a.world.player.temps.length).toBeLessThan(80);
    const b = build('a-absurd');
    play(b, 480);
    expect(b.world.counters.kills).toBe(a.world.counters.kills);
    expect(b.world.counters.hits).toBe(a.world.counters.hits);
  });
});

// ── The weird ones and the triggers ──────────────────────────────────────────────

describe('items pack A: odd items do their odd thing', () => {
  const volley = (sim: Sim): void => {
    sim.step(makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true }));
  };

  it('Carousel Horse: shots take a lap around you, then speed off', () => {
    const sim = pickupSim('carousel');
    sim.world.player.placeAt(30, 56);
    give(sim, 'carousel-horse');
    volley(sim);
    const s = sim.world.projectiles.items[0]!;
    expect(s.flags & F_CIRCLING).not.toBe(0);
    const v0 = s.speed;
    stepN(sim, makeInput(), 50);
    expect(s.flags & F_CIRCLING).toBe(0);
    expect(s.speed).toBeGreaterThan(v0);
  });

  it('Snail Mail Stamp: big, strong, slow shots', () => {
    const plain = pickupSim('stamp-plain');
    volley(plain);
    const sim = pickupSim('stamp');
    give(sim, 'snail-mail-stamp');
    volley(sim);
    const a = plain.world.projectiles.items[0]!;
    const b = sim.world.projectiles.items[0]!;
    expect(b.size).toBeGreaterThan(a.size * 1.3);
    expect(b.baseDamage).toBeGreaterThan(a.baseDamage * 1.5);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(Math.hypot(a.vx, a.vy) * 0.6);
  });

  it('Rearview Mirror: a shot flies out behind you, and shots swing back', () => {
    const sim = pickupSim('mirror');
    give(sim, 'rearview-mirror');
    volley(sim);
    const shots = sim.world.projectiles;
    let back = 0;
    for (let i = 0; i < shots.count; i++) if (shots.items[i]!.vx < -50) back++;
    expect(back).toBe(1);
    let returning = false;
    for (let t = 0; t < 60 && !returning; t++) {
      sim.step(makeInput());
      for (let i = 0; i < shots.count; i++) if (shots.items[i]!.flags & F_RETURNING) returning = true;
    }
    expect(returning).toBe(true);
  });

  it('Greasy Gloves: shots drop short and pop where they land', () => {
    const sim = pickupSim('gloves');
    sim.world.player.placeAt(24, 56);
    give(sim, 'greasy-gloves');
    const st = stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 90);
    expect(st.events.explosion ?? 0).toBeGreaterThan(0);
  });

  it('Tracing Paper: now and then (luck helps) a volley comes out doubled, briefly', () => {
    const sim = arenaSim('tracing', 1, 0);
    give(sim, 'tracing-paper');
    const p = sim.world.player;
    p.luckBonus = 50; // clamps at maxChance
    recomputePlayer(sim.world);
    let copied = -1;
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 600 && copied < 0; t++) {
      sim.step(input);
      if (p.attack.mod('extraShots') > 0) copied = t;
    }
    expect(copied).toBeGreaterThanOrEqual(0);
    stepN(sim, makeInput(), 60);
    expect(p.attack.mod('extraShots')).toBe(0);
  });

  it('Crackle Candy: now and then shots fizz with chain lightning for a moment', () => {
    const sim = arenaSim('candy', 1, 0);
    give(sim, 'crackle-candy');
    const p = sim.world.player;
    p.luckBonus = 50;
    recomputePlayer(sim.world);
    let fizz = false;
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 600 && !fizz; t++) {
      sim.step(input);
      fizz = p.attack.mod('chain') > 0;
    }
    expect(fizz).toBe(true);
    stepN(sim, makeInput(), 100);
    expect(p.attack.mod('chain')).toBe(0);
  });
});

describe('items pack A: triggers', () => {
  const weak = (): string => {
    testEnemy('t-itemsA-weak', { hp: 1, speed: 0, contact: 0, radius: 5 });
    return 't-itemsA-weak';
  };
  const tank = (): string => {
    testEnemy('t-itemsA-tank', { hp: 1e6, speed: 0, contact: 0, radius: 5 });
    return 't-itemsA-tank';
  };
  const spawn = (sim: Sim, id: string, x: number, y: number) => {
    const e = sim.spawnEnemy(id, x, y, { champion: false })!;
    e.spawnT = 0;
    return e;
  };

  it('Falling Barometer: each hit multiplies damage until you leave the room; Wool Mitten zaps around you', () => {
    const sim = pickupSim('barometer');
    const w = sim.world;
    const p = w.player;
    give(sim, 'falling-barometer');
    give(sim, 'wool-mitten');
    const near = spawn(sim, tank(), p.x + 30, p.y);
    const far = spawn(sim, tank(), p.x - 90, p.y);
    const base = p.stats.damage;
    sim.hurtPlayer(1);
    p.invuln = 0;
    sim.hurtPlayer(1);
    expect(p.stats.damage).toBeCloseTo(base * 1.25 ** 2, 5);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    leftRoom(w);
    expect(p.stats.damage).toBeCloseTo(base, 5);
  });

  it('Ratchet Wrench: kills click the fire rate up, one click per half second', () => {
    const sim = pickupSim('ratchet');
    const w = sim.world;
    const p = w.player;
    give(sim, 'ratchet-wrench');
    const base = p.stats.fireRate;
    fireTrigger(w, 'kill', 50, 50);
    fireTrigger(w, 'kill', 50, 50);
    expect(p.stats.fireRate).toBeCloseTo(base + 0.5, 5);
    stepN(sim, makeInput(), 35);
    fireTrigger(w, 'kill', 50, 50);
    expect(p.stats.fireRate).toBeCloseTo(base + 1, 5);
    stepN(sim, makeInput(), 60 * 5);
    expect(p.stats.fireRate).toBeCloseTo(base, 5);
  });

  it('Fairy Ring / Sporeling: a foe bursts into a spore cloud that poisons and hurts its neighbours', () => {
    const sim = pickupSim('fairy');
    const w = sim.world;
    const p = w.player;
    give(sim, 'fairy-ring');
    p.luckBonus = 50;
    recomputePlayer(w);
    const neighbour = spawn(sim, tank(), 165, 60);
    const distant = spawn(sim, tank(), 40, 20);
    // Each kill bursts at 80 % (luck-capped): several kills make a cloud certain.
    for (let i = 0; i < 6; i++) spawn(sim, weak(), 150, 56).hurt(5, 0, 0, 0);
    expect(neighbour.hp).toBeLessThan(neighbour.maxHp);
    expect(neighbour.status.mask & 1).toBe(1); // poisoned
    expect(distant.hp).toBe(distant.maxHp);
    // The hook on its own, anywhere.
    const fn = getHook('itemsA.sporeCloud')!;
    const d0 = distant.hp;
    fn({ w, api: hookApi(w), x: distant.x, y: distant.y, source: 'test', params: { radius: 20, dmg: 1, poison: 2 } });
    expect(distant.hp).toBeLessThan(d0);
  });

  it('Candle Snuffer, Weighted Die, Wishing Penny and Ladybug Brooch pay out more with luck', () => {
    const sim = pickupSim('luck');
    const w = sim.world;
    const p = w.player;
    for (const id of ['candle-snuffer', 'weighted-die', 'wishing-penny', 'ladybug-brooch']) give(sim, id);
    expect(p.stats.luck).toBeCloseTo(4, 5);
    p.luckBonus = 50;
    recomputePlayer(w);
    // (Tin first: bonus hearts share the 12-heart cap with the Ember hearts below.)
    const tin = bonusHalvesOf(p.health, BONUS_TIN);
    for (let i = 0; i < 10; i++) fireTrigger(w, 'hurt', p.x, p.y);
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBeGreaterThan(tin);
    for (let i = 0; i < 60; i++) fireTrigger(w, 'kill', 60, 56);
    expect(bonusHalvesOf(p.health, BONUS_EMBER)).toBeGreaterThan(0);
    let lucky = 0;
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i]!.kind === PK.LuckyCoin) lucky++;
    expect(lucky).toBeGreaterThan(0);
    const before = w.pickups.count;
    for (let i = 0; i < 30; i++) fireTrigger(w, 'roomClear', 104, 56);
    expect(w.pickups.count).toBeGreaterThan(before);
  });

  it('without luck the same items pay out rarely', () => {
    const sim = pickupSim('no-luck');
    const w = sim.world;
    const p = w.player;
    give(sim, 'weighted-die');
    p.luckBonus = -2; // cancels the die's own +2
    recomputePlayer(w);
    expect(p.stats.luck).toBeCloseTo(0, 5);
    for (let i = 0; i < 60; i++) fireTrigger(w, 'kill', 60, 56);
    let lucky = 0;
    for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i]!.kind === PK.LuckyCoin) lucky++;
    expect(lucky).toBeLessThanOrEqual(3);
  });

  it('health items grant their hearts once per fresh copy', () => {
    const sim = pickupSim('hearts');
    const p = sim.world.player;
    const before = p.health.redMax;
    walkInto(sim, 'snug-cocoon');
    expect(p.health.redMax).toBe(before + 2);
    expect(bonusHalvesOf(p.health, BONUS_TIN)).toBe(2);
    p.placeAt(40, 90);
    walkInto(sim, 'clockwork-heart');
    expect(p.health.redMax).toBe(before + 4);
    expect(getItem('clockwork-heart').costume).toBeDefined();
  });
});
