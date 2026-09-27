/**
 * The special-synergy hooks (src/content/hooks/synergies.ts) one by one, driven straight through the hook
 * registry in a controlled room, then a few synergies end to end through real play: the Crown of Storms'
 * ring of beams, the Frost Nova, burning oil slicks, the kite string, the furrow of thunder, the Mirror Lid.
 */

import { describe, expect, it } from 'vitest';
import { getItem, registerItem } from '../src/content/registry';
import { clearEdges } from '../src/engine/inputState';
import { BK_LANCE } from '../src/sim/attack/beam';
import { OWN_PLAYER, SK_BLADE } from '../src/sim/attack/state';
import { chargeActive, hookApi, recomputePlayer, useActive } from '../src/sim/effects';
import type { Enemy } from '../src/sim/enemies/enemy';
import { spawnCreep, spawnEnemyShot } from '../src/sim/enemies/shots';
import { ST_BURN, ST_CHARM, ST_FREEZE, ST_POISON, ST_SLOW } from '../src/sim/enemies/status';
import { getHook } from '../src/sim/hooks';
import { setActive } from '../src/sim/inventory';
import type { Sim } from '../src/sim/sim';
import { ENEMY_SHOT_STYLES } from '../src/sim/types';
import { OPEN_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const ICE = ENEMY_SHOT_STYLES.indexOf('ice');
const EMBER = ENEMY_SHOT_STYLES.indexOf('ember');
const MUCK = ENEMY_SHOT_STYLES.indexOf('muck');
const WATER = ENEMY_SHOT_STYLES.indexOf('water');

testEnemy('t-syn-post', { hp: 1e6, speed: 0, contact: 0, radius: 6, move: { kind: 'idle' }, attacks: [], mass: 1 });
testEnemy('t-syn-grunt', { hp: 8, speed: 0, contact: 0, radius: 5, move: { kind: 'idle' }, attacks: [] });

/** An open room, Wren at (40, 56) aiming right. */
function room(seed: string): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.player.placeAt(40, 56);
  sim.world.player.aimX = 1;
  sim.world.player.aimY = 0;
  return sim;
}

function foe(sim: Sim, x: number, y: number, id = 't-syn-post'): Enemy {
  const e = sim.spawnEnemy(id, x, y, { champion: false })!;
  e.spawnT = 0;
  return e;
}

function run(sim: Sim, name: string, params: Record<string, number | string>, x = sim.world.player.x, y = sim.world.player.y): void {
  const fn = getHook(name);
  if (!fn) throw new Error(`no hook ${name}`);
  fn({ w: sim.world, api: hookApi(sim.world), x, y, source: 't-syn', params });
}

const lost = (e: Enemy): number => e.maxHp - e.hp;
const has = (e: Enemy, st: number): boolean => (e.status.mask & (1 << st)) !== 0;

function count(sim: Sim, type: string, id?: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) {
    const e = sim.events.at(i);
    if (e.type === type && (id === undefined || e.id === id)) n++;
  }
  return n;
}

function allied(sim: Sim): number {
  let n = 0;
  const pool = sim.world.enemyShots;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.allied) n++;
  return n;
}

function alliedCreep(sim: Sim): number {
  let n = 0;
  for (let i = 0; i < sim.world.creep.count; i++) if (sim.world.creep.items[i]!.allied) n++;
  return n;
}

/** Kills a foe (flagged dead at its spot until the sweep) after giving it a status. */
function fallen(sim: Sim, x: number, y: number, status: 'freeze' | 'burn' | null): Enemy {
  const e = foe(sim, x, y, 't-syn-grunt');
  if (status) e.applyStatus(status, 3, 1, 0);
  e.hurt(1000, 2, 0, 0);
  expect(e.dead).toBe(true);
  return e;
}

describe('synergy hooks, one by one', () => {
  it('syn.debut: a ring in the current shot colour around the player', () => {
    const sim = room('h-debut');
    run(sim, 'syn.debut', {});
    expect(count(sim, 'nova', sim.world.player.attack.style.body)).toBe(1);
  });

  it('syn.burst: damage, a status and a shove inside the radius only', () => {
    const sim = room('h-burst');
    const near = foe(sim, 60, 56);
    const far = foe(sim, 160, 56);
    run(sim, 'syn.burst', { at: 'player', radius: 40, dmg: 1, status: 'burn', time: 2, push: 200, look: 'ember' });
    expect(lost(near)).toBeCloseTo(sim.world.player.stats.damage, 5);
    expect(has(near, ST_BURN)).toBe(true);
    expect(near.kx).toBeGreaterThan(0);
    expect(lost(far)).toBe(0);
    expect(has(far, ST_BURN)).toBe(false);
    expect(count(sim, 'nova', 'ember')).toBe(1);
  });

  it("'needs': a kill hook runs only when the fallen foe had that status", () => {
    const sim = room('h-needs');
    const bystander = foe(sim, 110, 56);
    const plain = fallen(sim, 100, 40, null);
    run(sim, 'syn.burst', { needs: 'freeze', radius: 60, dmg: 1 }, plain.x, plain.y);
    expect(lost(bystander)).toBe(0);
    const frozen = fallen(sim, 100, 70, 'freeze');
    run(sim, 'syn.burst', { needs: 'freeze', radius: 60, dmg: 1 }, frozen.x, frozen.y);
    expect(lost(bystander)).toBeGreaterThan(0);
  });

  it('syn.skyBolts: bolts from the sky onto the nearest foes only', () => {
    const sim = room('h-bolts');
    const a = foe(sim, 70, 56);
    const b = foe(sim, 100, 30);
    const c = foe(sim, 190, 100);
    run(sim, 'syn.skyBolts', { at: 'player', count: 2, dmg: 1, radius: 0, status: 'slow', time: 1 });
    expect(lost(a)).toBeGreaterThan(0);
    expect(lost(b)).toBeGreaterThan(0);
    expect(lost(c)).toBe(0);
    expect(has(a, ST_SLOW)).toBe(true);
    expect(count(sim, 'chainArc')).toBe(2);
    expect(count(sim, 'lobLand', 'bolt')).toBe(2);
  });

  it('syn.lineStrikes: bolts and burning craters down the aim line to the wall', () => {
    const sim = room('h-line');
    const on = foe(sim, 130, 56);
    const off = foe(sim, 130, 16);
    run(sim, 'syn.lineStrikes', { spacing: 30, max: 8, dmg: 1, radius: 14, crater: 'ember', craterR: 8, craterLife: 3, status: 'burn' });
    expect(lost(on)).toBeGreaterThan(0);
    expect(has(on, ST_BURN)).toBe(true);
    expect(lost(off)).toBe(0);
    const craters = sim.world.creep.items.slice(0, sim.world.creep.count).filter((c) => c.allied && c.style === EMBER);
    expect(craters.length).toBeGreaterThanOrEqual(5);
    for (const c of craters) expect(c.y).toBeCloseTo(56, 5);
    expect(Math.max(...craters.map((c) => c.x))).toBeLessThan(208);
  });

  it('syn.orbs: slow allied ice orbs hung along the aim', () => {
    const sim = room('h-orbs');
    run(sim, 'syn.orbs', { spacing: 24, max: 6, dmg: 1, life: 2, drift: 8 });
    const orbs = sim.world.enemyShots.items.slice(0, sim.world.enemyShots.count);
    expect(orbs.length).toBe(6);
    for (const s of orbs) {
      expect(s.allied).toBe(true);
      expect(s.style).toBe(ICE);
      expect(Math.hypot(s.vx, s.vy)).toBeLessThanOrEqual(8.01);
      expect(s.y).toBeCloseTo(56, 5);
    }
  });

  it('syn.blasts: player blasts in a ring (never hurting her) or on every foe', () => {
    const sim = room('h-blasts');
    const e = foe(sim, 58, 56);
    const red = sim.world.player.health.red;
    run(sim, 'syn.blasts', { at: 'player', mode: 'ring', n: 6, dist: 14, radius: 14, dmg: 1 });
    expect(sim.world.atk.explosions.n).toBe(6);
    stepN(sim, makeInput(), 3);
    expect(lost(e)).toBeGreaterThan(0);
    expect(sim.world.player.health.red).toBe(red);
    const sim2 = room('h-blasts-2');
    for (const [x, y] of [
      [120, 30],
      [150, 80],
      [180, 50],
    ] as const)
      foe(sim2, x, y);
    run(sim2, 'syn.blasts', { mode: 'foes', max: 12, radius: 14, dmg: 1 });
    expect(sim2.world.atk.explosions.n).toBe(3);
  });

  it('syn.waves: allied shockwave rings that hurt grounded foes once as they pass', () => {
    const sim = room('h-waves');
    const e = foe(sim, 70, 56);
    run(sim, 'syn.waves', { at: 'player', count: 3, radius: 50, speed: 160, dmg: 1 });
    expect(sim.world.waves.count).toBe(3);
    for (let i = 0; i < 3; i++) expect(sim.world.waves.items[i]!.allied).toBe(true);
    stepN(sim, makeInput(), 30);
    expect(lost(e)).toBeGreaterThan(0);
  });

  it('syn.gust: shoves foes away and pops hostile shots in reach', () => {
    const sim = room('h-gust');
    const e = foe(sim, 70, 56);
    spawnEnemyShot(sim.world, 50, 56, -30, 0, 1, 2, 0, false, 0);
    run(sim, 'syn.gust', { radius: 64, push: 240, dmg: 0.5, pop: 1 });
    expect(e.kx).toBeGreaterThan(0);
    expect(lost(e)).toBeGreaterThan(0);
    expect(sim.world.enemyShots.count).toBe(0);
  });

  it('syn.ring / syn.foeRings / syn.ghosts: allied shots from a point, from every foe with a status, at the nearest foes', () => {
    const sim = room('h-rings');
    run(sim, 'syn.ring', { at: 'player', n: 8, speed: 100, dmg: 1, style: 'charm' });
    expect(allied(sim)).toBe(8);
    const sim2 = room('h-foerings');
    const cold = foe(sim2, 120, 40);
    foe(sim2, 120, 80);
    cold.applyStatus('freeze', 3, 0, 0);
    run(sim2, 'syn.foeRings', { needs: 'freeze', n: 4, speed: 100, dmg: 1, style: 'ice' });
    const shards = sim2.world.enemyShots.items.slice(0, sim2.world.enemyShots.count);
    expect(shards.length).toBe(4);
    for (const s of shards) {
      expect(s.style).toBe(ICE);
      expect(Math.hypot(s.x - cold.x, s.y - cold.y)).toBeLessThan(12);
    }
    const sim3 = room('h-ghosts');
    const target = foe(sim3, 100, 20);
    run(sim3, 'syn.ghosts', { at: 'player', n: 1, speed: 100, dmg: 1 });
    const g = sim3.world.enemyShots.items[0]!;
    expect(g.allied).toBe(true);
    const dx = target.x - 40;
    const dy = target.y - 52;
    expect((g.vx * dx + g.vy * dy) / (Math.hypot(dx, dy) * Math.hypot(g.vx, g.vy))).toBeGreaterThan(0.99);
  });

  it('syn.reflect: a swing bats the shots in front back along the aim; "all" turns every shot around', () => {
    const sim = room('h-reflect');
    const front = spawnEnemyShot(sim.world, 60, 56, -80, 0, 1, 2, 0, false, 0)!;
    const behind = spawnEnemyShot(sim.world, 20, 56, 80, 0, 1, 2, 0, false, 0)!;
    run(sim, 'syn.reflect', { mode: 'cone', radius: 36, cone: 1.2, speed: 200, dmg: 1 });
    expect(front.allied).toBe(true);
    expect(front.vx).toBeGreaterThan(150);
    expect(behind.allied).toBe(false);
    run(sim, 'syn.reflect', { mode: 'all', speed: 180, dmg: 1 });
    expect(behind.allied).toBe(true);
    expect(behind.vx).toBeCloseTo(-180, 5);
  });

  it('syn.stall: hostile shots slow down (and stop speeding up)', () => {
    const sim = room('h-stall');
    const s = spawnEnemyShot(sim.world, 150, 56, -100, 0, 1, 2, 0, false, 0)!;
    s.accel = 50;
    run(sim, 'syn.stall', { factor: 0.4, radius: 0 });
    expect(s.vx).toBeCloseTo(-40, 5);
    expect(s.accel).toBe(0);
  });

  it('syn.contagion: a burning foe that falls passes the flame to its nearest neighbours', () => {
    const sim = room('h-contagion');
    const a = foe(sim, 110, 56);
    const b = foe(sim, 100, 80);
    const c = foe(sim, 200, 10);
    const v = fallen(sim, 100, 56, 'burn');
    run(sim, 'syn.contagion', { needs: 'burn', radius: 56, max: 2, time: 3, power: 0.35 }, v.x, v.y);
    expect(has(a, ST_BURN)).toBe(true);
    expect(has(b, ST_BURN)).toBe(true);
    expect(has(c, ST_BURN)).toBe(false);
  });

  it('syn.loot: a pickup from a fallen foe with the right status', () => {
    const sim = room('h-loot');
    const plain = fallen(sim, 100, 40, null);
    run(sim, 'syn.loot', { needs: 'burn', kind: 'emberHeart', chance: 1 }, plain.x, plain.y);
    expect(sim.world.pickups.count).toBe(0);
    const hot = fallen(sim, 100, 70, 'burn');
    run(sim, 'syn.loot', { needs: 'burn', kind: 'emberHeart', chance: 1 }, hot.x, hot.y);
    expect(sim.world.pickups.count).toBe(1);
  });

  it('syn.puddles: allied puddles turn elemental and put their status on foes standing in them', () => {
    const sim = room('h-puddles');
    const e = foe(sim, 120, 56);
    const c = spawnCreep(sim.world, 120, 56, 10, 3, 1, WATER, true)!;
    const hostile = spawnCreep(sim.world, 60, 90, 10, 3, 1, WATER, false)!;
    run(sim, 'syn.puddles', { style: 'muck', status: 'poison', time: 3, power: 0.35, grow: 1 });
    expect(c.style).toBe(MUCK);
    expect(c.r).toBe(11);
    expect(hostile.style).toBe(WATER);
    expect(has(e, ST_POISON)).toBe(true);
  });

  it('syn.conduct: foes standing in allied puddles are zapped from the water', () => {
    const sim = room('h-conduct');
    const wet = foe(sim, 120, 56);
    const dry = foe(sim, 180, 20);
    spawnCreep(sim.world, 120, 56, 10, 3, 1, WATER, true);
    spawnCreep(sim.world, 150, 56, 10, 3, 1, WATER, true);
    run(sim, 'syn.conduct', { dmg: 1, link: 44 });
    expect(lost(wet)).toBeGreaterThan(0);
    expect(lost(dry)).toBe(0);
    expect(count(sim, 'chainArc')).toBeGreaterThanOrEqual(2);
  });

  it('syn.familiarPuddles / syn.puddleRain: puddles under the familiars, puddles all over the room', () => {
    const sim = room('h-fampud');
    sim.giveItem('lamplet');
    stepN(sim, makeInput(), 2);
    expect(sim.world.atk.familiars.count()).toBe(1);
    run(sim, 'syn.familiarPuddles', { style: 'ember', r: 6, life: 2, dmg: 0.2 });
    expect(alliedCreep(sim)).toBe(1);
    const f = sim.world.atk.familiars.list.find((x) => x.alive)!;
    const c = sim.world.creep.items[0]!;
    expect(Math.hypot(c.x - f.x, c.y - f.y)).toBeLessThan(6);
    expect(c.style).toBe(EMBER);
    const sim2 = room('h-rain');
    run(sim2, 'syn.puddleRain', { n: 6, r: 8, life: 3, dmg: 0.3 });
    expect(alliedCreep(sim2)).toBeGreaterThanOrEqual(4);
  });

  it('syn.tether: the string between Wren and her blade zaps what crosses it', () => {
    const sim = room('h-tether');
    sim.giveItem('rusty-boomerang');
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true });
    sim.step(input);
    clearEdges(input);
    input.fireHeld = false;
    input.aimX = 0;
    stepN(sim, input, 8);
    const blade = sim.world.projectiles.items.slice(0, sim.world.projectiles.count).find((s) => s.kind === SK_BLADE && s.ownerKind === OWN_PLAYER)!;
    expect(blade).toBeDefined();
    // She steps aside: the string now runs where the blade never flew.
    sim.world.player.placeAt(blade.x, 100);
    const e = foe(sim, blade.x, (blade.y + 100) / 2 + 4);
    run(sim, 'syn.tether', { dmg: 1, width: 5 });
    expect(lost(e)).toBeGreaterThan(0);
    expect(count(sim, 'chainArc')).toBeGreaterThanOrEqual(1);
  });

  it('syn.lasso: foes along the aim are yanked toward her and slowed', () => {
    const sim = room('h-lasso');
    const e = foe(sim, 110, 60);
    const aside = foe(sim, 110, 10);
    run(sim, 'syn.lasso', { reach: 120, width: 20, pull: 220, dmg: 0.2, slow: 1.5 });
    expect(e.kx).toBeLessThan(0);
    expect(has(e, ST_SLOW)).toBe(true);
    expect(aside.kx).toBe(0);
  });

  it('syn.choir: every familiar zaps the foe nearest to it', () => {
    const sim = room('h-choir');
    sim.giveItem('lamplet');
    sim.giveItem('paper-boat');
    stepN(sim, makeInput(), 2);
    const e = foe(sim, 90, 56);
    run(sim, 'syn.choir', { dmg: 1, range: 150 });
    expect(lost(e)).toBeCloseTo(2 * sim.world.player.stats.damage, 5);
    expect(count(sim, 'chainArc')).toBe(2);
  });

  it('syn.vortex: foes are dragged in and around, puddles ring her', () => {
    const sim = room('h-vortex');
    const e = foe(sim, 100, 56);
    run(sim, 'syn.vortex', { radius: 120, pull: 180, swirl: 200, dmg: 1, slow: 2, puddles: 6 });
    expect(e.kx).toBeLessThan(0);
    expect(Math.abs(e.ky)).toBeGreaterThan(0);
    expect(has(e, ST_SLOW)).toBe(true);
    expect(alliedCreep(sim)).toBe(6);
  });

  it('hooks re-enter safely: a bolt that kills runs kill hooks mid-volley without scrambling the targets', () => {
    registerItem({
      id: 't-syn-reentry',
      name: 't-syn-reentry',
      desc: 'TEST',
      kind: 'passive',
      quality: 0,
      pools: [],
      tags: ['test'],
      effects: [{ type: 'trigger', on: 'kill', effects: [{ type: 'hook', hook: 'syn.ghosts', params: { n: 3, range: 400, dmg: 0 } }] }],
      sprite: 'test-icon',
    });
    const sim = room('h-reentry');
    sim.giveItem('t-syn-reentry');
    const foes = [foe(sim, 80, 56, 't-syn-grunt'), foe(sim, 110, 56, 't-syn-grunt'), foe(sim, 140, 56, 't-syn-grunt')];
    run(sim, 'syn.skyBolts', { at: 'player', count: 3, dmg: 100, radius: 0 });
    for (const e of foes) expect(e.dead).toBe(true);
    // Each kill's own nested ring of ghosts ran too.
    expect(allied(sim)).toBeGreaterThan(0);
  });

  it('syn.everyFoe: runs another hook at every foe (the Fairy Ring spore cloud)', () => {
    const sim = room('h-every');
    const foes = [foe(sim, 100, 20), foe(sim, 150, 60), foe(sim, 190, 100)];
    run(sim, 'syn.everyFoe', { hook: 'itemsA.sporeCloud', max: 12, radius: 20, dmg: 0.5, poison: 3 });
    for (const e of foes) expect(has(e, ST_POISON)).toBe(true);
    // It never runs itself.
    run(sim, 'syn.everyFoe', { hook: 'syn.everyFoe' });
  });
});

// ── End to end ─────────────────────────────────────────────────────────────────

function release(sim: Sim, aimX = 1, aimY = 0): void {
  const input = makeInput({ aimX, aimY, fireHeld: true, firePressed: true });
  for (let i = 0; i < 150 && sim.world.player.atk.charge < 1; i++) {
    sim.step(input);
    clearEdges(input);
  }
  input.fireHeld = false;
  input.aimX = 0;
  input.aimY = 0;
  input.fireReleased = true;
  sim.step(input);
}

describe('synergies end to end', () => {
  it('Crown of Storms: the lance fires a turning crown of three beams', () => {
    const sim = room('e-crown');
    sim.world.godMode = true;
    sim.giveItem('storm-lance');
    sim.giveItem('tin-pinwheel');
    expect(sim.world.player.synergies).toContain('crown-of-storms');
    release(sim);
    const beams = sim.world.atk.beams.items.slice(0, sim.world.atk.beams.count).filter((b) => b.kind === BK_LANCE && b.anchor === sim.world.player);
    expect(beams.length).toBe(3);
    const dirs = beams.map((b) => b.dir).sort((a, b) => a - b);
    const gap = (a: number, b: number): number => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
    expect(gap(dirs[0]!, dirs[1]!)).toBeCloseTo((2 * Math.PI) / 3, 1);
    const d0 = beams[0]!.dir;
    stepN(sim, makeInput(), 6);
    expect(beams[0]!.dir).not.toBeCloseTo(d0, 3);
  });

  it('Frost Nova: a frozen foe that falls bursts into a ring of ice and freezes its neighbours', () => {
    const sim = room('e-frost');
    sim.world.godMode = true;
    sim.giveItem('ice-cube-tray');
    sim.giveItem('party-popper');
    expect(sim.world.player.synergies).toContain('frost-nova');
    const v = foe(sim, 120, 56, 't-syn-grunt');
    const n = foe(sim, 140, 60);
    v.applyStatus('freeze', 3, 0, 0);
    v.hurt(1000, 0, 0, 0);
    expect(allied(sim)).toBeGreaterThanOrEqual(10 + 6);
    expect(has(n, ST_FREEZE)).toBe(true);
    expect(count(sim, 'nova', 'frost')).toBe(1);
  });

  it('Oil Slick: the puddles your shots leave turn into burning oil', () => {
    const sim = room('e-oil');
    sim.world.godMode = true;
    sim.giveItem('leaky-bucket');
    sim.giveItem('drippy-candle');
    expect(sim.world.player.synergies).toContain('oil-slick');
    foe(sim, 110, 56);
    stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 90);
    const slicks = sim.world.creep.items.slice(0, sim.world.creep.count).filter((c) => c.allied);
    expect(slicks.length).toBeGreaterThan(0);
    expect(slicks.some((c) => c.style === EMBER)).toBe(true);
  });

  it('Kite Line: thrown blades carry a tether in their style', () => {
    const sim = room('e-kite');
    sim.giveItem('rusty-boomerang');
    sim.giveItem('kite-string');
    expect(sim.world.player.attack.style.tether).toBe('#bfe8ff');
    stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 5);
    const blade = sim.world.projectiles.items.slice(0, sim.world.projectiles.count).find((s) => s.kind === SK_BLADE)!;
    expect(blade.style!.tether).toBe('#bfe8ff');
  });

  it('Thunder Furrow: releasing the lance ploughs a furrow of burning craters to the wall', () => {
    const sim = room('e-furrow');
    sim.world.godMode = true;
    sim.giveItem('storm-lance');
    sim.giveItem('firecracker-pouch');
    release(sim);
    const craters = sim.world.creep.items.slice(0, sim.world.creep.count).filter((c) => c.allied && c.style === EMBER);
    expect(craters.length).toBeGreaterThanOrEqual(4);
    expect(count(sim, 'lobLand', 'bolt')).toBeGreaterThanOrEqual(1);
  });

  it('Mirror Lid: CLANG — every hostile shot in the room turns around', () => {
    const sim = room('e-mirror');
    sim.world.godMode = true;
    sim.giveItem('rearview-mirror');
    setActive(sim.world.player.inv, getItem('pot-lid'));
    recomputePlayer(sim.world);
    expect(sim.world.player.synergies).toContain('mirror-lid');
    const shots = [spawnEnemyShot(sim.world, 180, 20, -60, 20, 1, 2, 0, false, 0)!, spawnEnemyShot(sim.world, 150, 100, -60, -30, 1, 2, 0, false, 0)!];
    chargeActive(sim.world, 'full');
    expect(useActive(sim.world)).toBe(true);
    for (const s of shots) {
      expect(s.allied).toBe(true);
      expect(s.vx).toBeGreaterThan(0);
    }
  });

  it('Heart Mail: charmed friends mail hearts at the foes around them', () => {
    const sim = room('e-heart');
    sim.world.godMode = true;
    sim.giveItem('paper-valentine');
    sim.giveItem('snail-mail-stamp');
    const pal = foe(sim, 150, 56);
    foe(sim, 170, 80);
    pal.applyStatus('charm', 5, 0, 0);
    expect(has(pal, ST_CHARM)).toBe(true);
    stepN(sim, makeInput({ aimX: 0, aimY: 1, fireHeld: true }), 3);
    expect(allied(sim)).toBeGreaterThanOrEqual(4);
  });
});
