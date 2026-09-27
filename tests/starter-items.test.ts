/**
 * Phase 2D: the starter item set, the training yard's rotating pedestals / bell / endless waves, and
 * the debug actions (headless).
 */

import { describe, expect, it } from 'vitest';
import { WREN } from '../src/content/characters/wren';
import { FAMILIARS, allItems, getItem } from '../src/content/registry';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { DebugActions } from '../src/debug/actions';
import { clearEdges } from '../src/engine/inputState';
import { F_CIRCLING } from '../src/sim/attack/state';
import { CARRIER_RANK } from '../src/sim/attack/profile';
import { recomputePlayer } from '../src/sim/effects';
import { hasHook } from '../src/sim/hooks';
import { spawnPedestal } from '../src/sim/pedestals';
import { cellCenterX, cellCenterY } from '../src/sim/room';
import { computeStats, makeStats } from '../src/sim/stats';
import { YARD_TUNING } from '../src/sim/tuning';
import {
  CARRIER_IDS,
  MOD_IDS,
  PLAYER_FLAGS,
  POOL_IDS,
  STAT_IDS,
  TRIGGER_EVENTS,
  costumeList,
  type Effect,
  type ItemDef,
  type StatEffect,
} from '../src/sim/types';
import type { Sim } from '../src/sim/sim';
import { arenaSim, checkAttackInvariants, damageDealt, give } from './helpers/attack';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const STARTER_TAGS = ['starter-attack', 'modifier', 'weird', 'familiar'];
const STARTERS: readonly ItemDef[] = allItems().filter((d) => d.tags.some((t) => STARTER_TAGS.includes(t)));
const DESIGN_SETS = ['stormcaller', 'mothkin', 'clockwork', 'sporeling', 'waxen', 'toybox', 'ossuary', 'tidewalker', 'glimmer'];

/** Every effect, triggers flattened (with whether it sits inside a trigger). */
function flatEffects(list: readonly Effect[], inTrigger = false, out: { e: Effect; inTrigger: boolean }[] = []): { e: Effect; inTrigger: boolean }[] {
  for (const e of list) {
    out.push({ e, inTrigger });
    if (e.type === 'trigger') flatEffects(e.effects, true, out);
  }
  return out;
}

describe('starter item defs', () => {
  it('the set is the right size and shape', () => {
    const tagged = (t: string): ItemDef[] => STARTERS.filter((d) => d.tags.includes(t));
    expect(tagged('starter-attack')).toHaveLength(7);
    expect(tagged('modifier').length).toBeGreaterThanOrEqual(18);
    expect(tagged('weird').length).toBeGreaterThanOrEqual(5);
    expect(tagged('familiar').length).toBeGreaterThanOrEqual(3);
    // ~26 attack items (carriers + modifiers) plus the familiars and the weird ones.
    expect(tagged('starter-attack').length + tagged('modifier').length).toBeGreaterThanOrEqual(24);
    expect(getItem('storm-lance').quality).toBe(4);
  });

  it.each(STARTERS.map((d) => [d.id, d] as const))('%s is valid', (_id, d) => {
    expect(d.kind).toBe('passive');
    expect(d.name.length).toBeGreaterThan(2);
    expect(d.desc.length).toBeGreaterThan(8);
    expect(d.desc.length).toBeLessThanOrEqual(46);
    expect(d.desc).toBe(d.desc.toUpperCase());
    expect(d.quality).toBeGreaterThanOrEqual(0);
    expect(d.quality).toBeLessThanOrEqual(4);
    expect(d.pools.length).toBeGreaterThan(0);
    for (const p of d.pools) expect(POOL_IDS).toContain(p);
    expect(d.effects.length).toBeGreaterThan(0);
    // A real 14×14 icon.
    expect(typeof d.sprite).not.toBe('string');
    if (typeof d.sprite !== 'string') {
      expect(d.sprite.w).toBe(14);
      expect(d.sprite.h).toBe(14);
      expect(validateSpriteDef(d.sprite)).toEqual([]);
    }
    for (const c of costumeList(d.costume)) expect(validateSpriteDef(c.sprite)).toEqual([]);
    for (const { e, inTrigger } of flatEffects(d.effects)) {
      switch (e.type) {
        case 'stat':
          expect(STAT_IDS).toContain(e.stat);
          expect(e.add !== undefined || e.mul !== undefined).toBe(true);
          break;
        case 'mod':
          expect(MOD_IDS).toContain(e.mod);
          expect(e.stacks ?? 1).toBeGreaterThan(0);
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
      // Persistent effects granted by a trigger need a duration (else they'd last the whole room).
      if (inTrigger && (e.type === 'stat' || e.type === 'mod' || e.type === 'carrier')) expect(e.duration ?? 0).toBeGreaterThan(0);
    }
  });

  it('names are unique and every item has a DESIGN set tag or a clear category', () => {
    const names = STARTERS.map((d) => d.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
    const withSet = STARTERS.filter((d) => d.tags.some((t) => DESIGN_SETS.includes(t)));
    expect(withSet.length).toBeGreaterThanOrEqual(Math.floor(STARTERS.length * 0.7));
    // Every DESIGN.md set has at least one starter item to grow from.
    for (const s of DESIGN_SETS) expect(STARTERS.some((d) => d.tags.includes(s)), s).toBe(true);
  });

  it('together they cover every carrier and every modifier (as held effects)', () => {
    const carriers = new Set<string>();
    const mods = new Set<string>();
    for (const d of STARTERS) {
      for (const e of d.effects) {
        if (e.type === 'carrier') carriers.add(e.carrier);
        if (e.type === 'mod') mods.add(e.mod);
      }
    }
    for (const c of CARRIER_IDS) if (c !== 'marble') expect(carriers.has(c), c).toBe(true);
    for (const m of MOD_IDS) expect(mods.has(m), m).toBe(true);
  });

  it('major items wear costumes (the Storm Lance and most quality 3+ items)', () => {
    expect(costumeList(getItem('storm-lance').costume).length).toBeGreaterThanOrEqual(2);
    const major = STARTERS.filter((d) => d.quality >= 3);
    const dressed = major.filter((d) => d.costume);
    expect(dressed.length).toBeGreaterThanOrEqual(Math.ceil(major.length / 2));
  });
});

/** A 13×7 open room with Wren in the middle. */
function pickupSim(seed: string): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(104, 56);
  return sim;
}

/** Walks Wren into a pedestal carrying `id` (the real pickup path). */
function walkInto(sim: Sim, id: string): void {
  const p = sim.world.player;
  spawnPedestal(sim.world, p.x + 20, p.y, id);
  stepN(sim, makeInput({ moveX: 1 }), 30);
  stepN(sim, makeInput(), 2);
}

describe('picking up each starter item applies its effect', () => {
  it.each(STARTERS.map((d) => [d.id, d] as const))('%s', (_id, d) => {
    const sim = pickupSim(`pickup-${d.id}`);
    walkInto(sim, d.id);
    const p = sim.world.player;
    expect(p.inv.passives).toEqual([d.id]);
    // Stats: exactly the item's stat effects over Wren's base.
    const statEffects = d.effects.filter((e): e is StatEffect => e.type === 'stat');
    const want = computeStats(WREN.stats, statEffects, makeStats());
    for (const k of STAT_IDS) expect(p.stats[k], k).toBeCloseTo(want[k], 6);
    for (const e of d.effects) {
      switch (e.type) {
        case 'mod':
          expect(p.attack.mod(e.mod), e.mod).toBe(e.stacks ?? 1);
          break;
        case 'carrier':
          expect(p.attack.stacksOf(e.carrier)).toBe(1);
          if (CARRIER_RANK[e.carrier] > 0) expect(p.attack.primary).toBe(e.carrier);
          else expect(p.attack.primary).toBe('marble');
          break;
        case 'familiar': {
          const fams = sim.summary().attack.familiars;
          expect(fams).toContain(e.familiar);
          break;
        }
        case 'trigger':
          expect(p.triggers[e.on].some((t) => t.source === d.id)).toBe(true);
          break;
        default:
          break;
      }
    }
    if (d.costume) expect(p.loadout.costumes).toContain(d.id);
    // And it fires cleanly for a couple of seconds in an arena.
    const arena = arenaSim(`fire-${d.id}`, 2, 1);
    give(arena, d.id);
    const input = makeInput({ aimX: 1, aimY: 0 });
    for (let t = 0; t < 140; t++) {
      input.fireHeld = t % 70 < 64; // hold / release (the lance and the charge rider fire on release)
      input.firePressed = t % 70 === 0;
      arena.step(input);
      clearEdges(input);
      checkAttackInvariants(arena);
    }
    expect(damageDealt(arena)).toBeGreaterThan(0);
  });

  it('duplicates stack (two Geodes split wider, two Rooftop Rods arc further)', () => {
    const sim = pickupSim('dupes');
    give(sim, 'geode', 2);
    give(sim, 'rooftop-rod', 2);
    const p = sim.world.player;
    expect(p.attack.mod('split')).toBe(2);
    expect(p.attack.mod('chain')).toBe(2);
    expect(p.stats.damage).toBeCloseTo(WREN.stats.damage + 2, 6);
  });
});

describe('the weird items do their weird thing', () => {
  const volley = (sim: Sim): void => {
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true });
    sim.step(input);
  };

  it('Backwards Cap: shots fly out behind you too', () => {
    const sim = pickupSim('cap');
    give(sim, 'backwards-cap');
    volley(sim);
    const shots = sim.world.projectiles;
    let back = 0;
    for (let i = 0; i < shots.count; i++) if (shots.items[i]!.vx < -50) back++;
    expect(back).toBe(2);
  });

  it('Paperweight: huge, slow shots that linger', () => {
    const plain = pickupSim('pw-plain');
    volley(plain);
    const sim = pickupSim('pw');
    give(sim, 'paperweight');
    volley(sim);
    const a = plain.world.projectiles.items[0]!;
    const b = sim.world.projectiles.items[0]!;
    expect(b.size).toBeGreaterThan(a.size * 1.5);
    expect(b.baseDamage).toBeGreaterThan(a.baseDamage * 1.4);
    stepN(sim, makeInput(), 30);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(Math.hypot(a.vx, a.vy) * 0.5);
  });

  it('Dizzy Top: shots take a lap around you first', () => {
    const sim = pickupSim('top');
    give(sim, 'dizzy-top');
    volley(sim);
    const s = sim.world.projectiles.items[0]!;
    expect(s.flags & F_CIRCLING).not.toBe(0);
  });

  it('Crumbly Biscuit: big shots that crumble apart on a hit', () => {
    const sim = arenaSim('biscuit', 1, 0);
    give(sim, 'crumbly-biscuit');
    const st = stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 60);
    expect(st.events.shotSplit ?? 0).toBeGreaterThan(0);
  });

  it('Teacup Tempest: a rare chance (luck helps) sends shots feral for a few seconds', () => {
    const sim = arenaSim('teacup', 2, 1);
    give(sim, 'teacup-tempest');
    const p = sim.world.player;
    p.luckBonus = 50; // chance clamps at maxChance (15 %)
    recomputePlayer(sim.world);
    let said = 0;
    let fired = -1;
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 1200 && fired < 0; t++) {
      sim.step(input);
      const q = sim.events;
      for (let i = 0; i < q.count; i++) {
        if (q.at(i).type === 'say') {
          said++;
          fired = t;
        }
      }
    }
    expect(said).toBe(1);
    expect(p.attack.mod('homing')).toBe(1);
    expect(p.attack.mod('chain')).toBe(1);
    expect(p.attack.mod('explode')).toBe(1);
    expect(p.attack.mod('extraShots')).toBe(2);
    // Four seconds later the spell has worn off.
    stepN(sim, makeInput(), 250);
    expect(p.attack.mod('homing')).toBe(0);
    expect(p.temps).toHaveLength(0);
  });
});

describe('stacking every starter item at once', () => {
  const builds: [string, (d: ItemDef) => boolean, boolean][] = [
    ['everything (Storm Lance primary)', () => true, true],
    ['everything but the lance (laser primary)', (d) => d.id !== 'storm-lance', true],
    ['modifiers + weird + familiars (marble primary)', (d) => !d.tags.includes('starter-attack'), false],
  ];
  for (const [name, keep, beams] of builds) {
    it(`${name}: 10 s of firing in an arena stays under the caps with no NaN`, () => {
      const sim = arenaSim(`stack-${name}`, 3, 4);
      const p = sim.world.player;
      for (const d of STARTERS) if (keep(d)) p.inv.passives.push(d.id);
      p.inv.version++;
      recomputePlayer(sim.world);
      const input = makeInput({ aimX: 1, aimY: 0 });
      let total = 0;
      let maxBeams = 0;
      let peakShots = 0;
      for (let t = 0; t < 600; t++) {
        // Hold long enough for a full lance charge at the stack's (lowered) fire rate, then release.
        const phase = t % 100;
        input.fireHeld = phase < 92;
        input.firePressed = phase === 0;
        input.aimX = input.fireHeld ? Math.cos(t * 0.01) : 0;
        input.aimY = input.fireHeld ? Math.sin(t * 0.01) * 0.3 : 0;
        input.moveY = Math.sin(t * 0.03) * 0.5;
        const t0 = performance.now();
        sim.step(input);
        total += performance.now() - t0;
        clearEdges(input);
        checkAttackInvariants(sim);
        maxBeams = Math.max(maxBeams, sim.world.atk.beams.count);
        peakShots = Math.max(peakShots, sim.world.projectiles.count);
      }
      expect(total / 600, 'ms per step').toBeLessThan(10);
      if (beams) expect(maxBeams).toBeGreaterThan(0);
      expect(peakShots).toBeGreaterThan(0);
      expect(damageDealt(sim)).toBeGreaterThan(0);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    });
  }

  it('the full stack snowballs: far more damage than a bare marble', () => {
    const run = (withItems: boolean): number => {
      const sim = arenaSim('snowball', 3, 2);
      if (withItems) {
        for (const d of STARTERS) if (d.id !== 'storm-lance') sim.world.player.inv.passives.push(d.id);
        sim.world.player.inv.version++;
        recomputePlayer(sim.world);
      }
      stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 300);
      return damageDealt(sim);
    };
    expect(run(true)).toBeGreaterThan(run(false) * 5);
  });
});

describe('training yard', () => {
  const rotating = (sim: Sim) => sim.world.pedestals.items.slice(0, sim.world.pedestals.count).filter((p) => p.rotate);

  it('rotating pedestals offer new items over time, but not while you stand next to them', () => {
    const sim = makeSim('rotate');
    const peds = rotating(sim);
    expect(peds).toHaveLength(4);
    const before = peds.map((p) => p.item);
    // Park Wren next to the first rotating pedestal.
    sim.world.player.placeAt(peds[0]!.x - 16, peds[0]!.y - 16);
    const t = Math.ceil((YARD_TUNING.rotatePeriod + YARD_TUNING.rotateStagger * 3 + 0.5) * 60);
    const st = stepN(sim, makeInput(), t);
    const after = peds.map((p) => p.item);
    expect(after[0]).toBe(before[0]);
    expect(after.slice(1).filter((id, i) => id !== before[i + 1]).length).toBe(3);
    expect(st.events.pedestalRoll ?? 0).toBeGreaterThanOrEqual(3);
    // Items on different pedestals never repeat.
    const ids = rotating(sim).map((p) => p.item);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('an emptied rotating pedestal refills once you step away', () => {
    const sim = makeSim('refill');
    const ped = rotating(sim)[0]!;
    const taken = ped.item;
    sim.world.player.placeAt(ped.x - 14, ped.y);
    stepN(sim, makeInput({ moveX: 1 }), 20);
    expect(sim.world.player.inv.passives).toContain(taken);
    expect(ped.item).toBe('');
    stepN(sim, makeInput({ moveX: -1 }), 30);
    stepN(sim, makeInput(), Math.ceil(YARD_TUNING.refillDelay * 60) + 5);
    expect(ped.item).not.toBe('');
  });

  it('bumping the bell calls a wave; bumping it mid-wave just rings', () => {
    const sim = makeSim('bell');
    const bell = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).find((p) => p.bell)!;
    expect(bell).toBeDefined();
    expect(bell.x).toBe(cellCenterX(1));
    expect(bell.y).toBe(cellCenterY(5));
    sim.world.player.placeAt(bell.x + 14, bell.y);
    const st = stepN(sim, makeInput({ moveX: -1 }), 20);
    expect(st.events.bell).toBe(1);
    expect(sim.world.arena.active).toBe(true);
    const wave = sim.world.arena.wave;
    stepN(sim, makeInput({ moveX: 1 }), 20);
    const again = stepN(sim, makeInput({ moveX: -1 }), 20);
    expect(again.events.bell).toBe(1);
    expect(sim.world.arena.wave).toBe(wave);
  });

  it('endless waves: the next wave starts a moment after a clear', () => {
    const sim = makeSim('endless');
    sim.world.godMode = true;
    sim.autoWaves = true;
    stepN(sim, makeInput(), 2);
    expect(sim.world.arena.active).toBe(true);
    sim.clearRoom();
    stepN(sim, makeInput(), 2);
    expect(sim.world.arena.active).toBe(false);
    stepN(sim, makeInput(), Math.ceil(YARD_TUNING.autoWaveDelay * 60) + 2);
    expect(sim.world.arena.active).toBe(true);
    expect(sim.world.arena.wave).toBe(2);
  });
});

describe('debug actions (headless)', () => {
  const setup = (seed: string) => {
    const sim = makeSim(seed);
    let perf = false;
    const act = new DebugActions({
      sim: () => sim,
      perf: (on) => (perf = on ?? !perf),
      perfVisible: () => perf,
    });
    return { sim, act };
  };

  it('lists every content item (attack types first) and every enemy', () => {
    const { act } = setup('lists');
    const items = act.items();
    expect(items.length).toBe(allItems().filter((d) => !d.tags.includes('test')).length);
    expect(items[0]!.tags).toContain('starter-attack');
    expect(items.map((d) => d.id)).toContain('teacup-tempest');
    expect(act.enemies().length).toBeGreaterThanOrEqual(8);
  });

  it('spawns an item on a pedestal next to the player, even when every slot is taken', () => {
    const { sim, act } = setup('spawn-item');
    const p = sim.world.player;
    for (let i = 0; i < 8; i++) expect(act.spawnItem('geode')).toBe(true);
    const near = sim.world.pedestals.items.slice(0, sim.world.pedestals.count).filter((d) => d.item === 'geode');
    expect(near.length).toBeGreaterThanOrEqual(5);
    for (const d of near) expect(Math.hypot(d.x - p.x, d.y - p.y)).toBeLessThan(60);
    // Walk into the nearest one: it's a real pedestal.
    expect(() => act.spawnItem('no-such-item')).toThrow();
  });

  it('gives items, random items, and drops them all', () => {
    const { sim, act } = setup('give');
    expect(act.giveItem('storm-lance')).toBe(true);
    expect(sim.world.player.attack.primary).toBe('lance');
    expect(act.giveRandom(5)).toHaveLength(5);
    expect(sim.world.player.inv.passives).toHaveLength(6);
    act.resetItems();
    expect(sim.world.player.inv.passives).toHaveLength(0);
    expect(sim.world.player.attack.primary).toBe('marble');
  });

  it('spawns enemies (champions on request), god mode, heal, pickups, clear room, waves', () => {
    const { sim, act } = setup('cheats');
    const w = sim.world;
    expect(act.spawnEnemy('scurrier')).toBe(true);
    expect(act.spawnEnemy('scurrier', true)).toBe(true);
    const ids = w.enemies.items.slice(0, w.enemies.count).map((e) => e.def.id);
    expect(ids).toEqual(['scurrier', 'scurrier']);
    expect(w.enemies.items[1]!.champion).not.toBeNull();

    expect(act.god()).toBe(true);
    sim.hurtPlayer(2);
    expect(w.player.red).toBe(6);
    expect(act.god(false)).toBe(false);
    sim.hurtPlayer(2);
    expect(w.player.red).toBe(4);
    act.fullHeal();
    expect(w.player.red).toBe(6);

    act.addCoins();
    act.addBombs();
    act.addKeys(3);
    expect(w.player.inv.coins).toBe(10);
    expect(w.player.inv.bombs).toBe(11);
    expect(w.player.inv.keys).toBe(3);

    act.clearRoom();
    expect(w.enemies.count).toBe(0);
    expect(act.wave()).toBeGreaterThan(0);
    expect(w.arena.active).toBe(true);
    expect(act.wave()).toBe(0);
    act.clearRoom();
    const st = stepN(sim, makeInput(), 2);
    expect(st.events.roomClear).toBe(1);
    expect(w.arena.active).toBe(false);

    expect(act.autoWaves()).toBe(true);
    expect(act.isAutoWaves()).toBe(true);
    expect(act.perf()).toBe(true);
    expect(act.isPerf()).toBe(true);
    expect(act.perf(false)).toBe(false);
  });

  it('does nothing (and says so) without a run', () => {
    const act = new DebugActions({ sim: () => null });
    expect(act.spawnItem('geode')).toBe(false);
    expect(act.giveItem('geode')).toBe(false);
    expect(act.spawnEnemy('scurrier')).toBe(false);
    expect(act.god()).toBe(false);
    expect(act.wave()).toBe(0);
    expect(act.perf()).toBe(false);
  });
});
