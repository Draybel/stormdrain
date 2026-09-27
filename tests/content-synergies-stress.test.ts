/**
 * Stress: every special synergy with ALL its items at 2 stacks (the active once, in its slot), 5 s of
 * real fighting — charge-and-release firing in four directions, shooters and fodder respawning, statuses
 * on the crowd so the kill hooks' filters pass, bombs, active uses and the rarer triggers (hurt, pickup,
 * room clear, floor start) every so often. After every tick: no NaN anywhere, every pool within its cap,
 * the chain-arc / explosion / event guardrails hold, the synergy stays on and temps stay bounded.
 */

import { describe, expect, it } from 'vitest';
import { ITEMS, SYNERGIES, getItem } from '../src/content/registry';
import { clearEdges } from '../src/engine/inputState';
import { liveExplosions } from '../src/sim/attack/impacts';
import { CAP_CREEP, CAP_ENEMIES, CAP_ENEMY_SHOTS, CAP_WAVES } from '../src/sim/constants';
import { chargeActive, fireTrigger, recomputePlayer, useActive } from '../src/sim/effects';
import { setActive } from '../src/sim/inventory';
import type { Sim } from '../src/sim/sim';
import { ATTACK_TUNING } from '../src/sim/tuning';
import { STAT_IDS, type ItemDef, type Requirement, type StatusKind, type SynergyDef } from '../src/sim/types';
import { checkAttackInvariants } from './helpers/attack';
import { OBSTACLE_ROOM, testEnemy } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

testEnemy('t-syn-stress-tank', { hp: 1e7, speed: 0, contact: 0, radius: 6, move: { kind: 'idle' }, attacks: [] });
testEnemy('t-syn-stress-grunt', { hp: 10, speed: 30, contact: 0, radius: 5, move: { kind: 'wander' }, attacks: [] });

const FODDER = ['spitshell', 'grate-gazer', 't-syn-stress-grunt', 't-syn-stress-grunt'] as const;
const STATUSES: readonly StatusKind[] = ['freeze', 'burn', 'poison', 'charm', 'slow', 'fear'];
const AIMS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
] as const;

function tagged(tag: string, exclude: ReadonlySet<string>): ItemDef[] {
  return [...ITEMS.values()]
    .filter((d) => d.tags.includes(tag) && (d.kind === 'passive' || d.kind === 'trinket') && !d.tags.includes('test') && !exclude.has(d.id))
    .sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'passive' ? -1 : 1));
}

function itemsOf(syn: SynergyDef): string[] {
  const held: string[] = [];
  const add = (req: Requirement): void => {
    if (typeof req === 'string') {
      if (!held.includes(req)) held.push(req);
      return;
    }
    const have = held.filter((id) => getItem(id).tags.includes(req.tag)).length;
    for (const d of tagged(req.tag, new Set(held)).slice(0, Math.max(0, (req.count ?? 1) - have))) held.push(d.id);
  };
  syn.requires.forEach(add);
  return held;
}

/** All the synergy's items at 2 stacks (actives once), fodder, tanks, bombs. */
function stressSim(syn: SynergyDef): Sim {
  const sim = makeSim(`stress-${syn.id}`, { room: OBSTACLE_ROOM });
  const w = sim.world;
  const p = w.player;
  w.godMode = true;
  p.placeAt(104, 56);
  for (const id of itemsOf(syn)) {
    const d = getItem(id);
    if (d.kind === 'active') setActive(p.inv, d);
    else if (d.kind === 'trinket') p.inv.trinkets.push(id, id);
    else p.inv.passives.push(id, id);
  }
  p.inv.version++;
  recomputePlayer(w);
  sim.addPickups(20, 99, 5);
  for (const [x, y] of [
    [24, 24],
    [184, 88],
    [184, 24],
  ] as const) {
    const e = sim.spawnEnemy('t-syn-stress-tank', x, y, { champion: false });
    if (e) e.spawnT = 0;
  }
  return sim;
}

function checkWorld(sim: Sim, syn: SynergyDef): void {
  checkAttackInvariants(sim);
  const w = sim.world;
  expect(w.enemies.count).toBeLessThanOrEqual(CAP_ENEMIES);
  expect(w.enemyShots.count).toBeLessThanOrEqual(CAP_ENEMY_SHOTS);
  expect(w.creep.count).toBeLessThanOrEqual(CAP_CREEP);
  expect(w.waves.count).toBeLessThanOrEqual(CAP_WAVES);
  expect(w.atk.explosions.n).toBeLessThanOrEqual(w.atk.explosions.x.length);
  expect(liveExplosions(w)).toBeLessThanOrEqual(ATTACK_TUNING.capExplosionsLive);
  expect(w.atk.familiars.count()).toBeLessThanOrEqual(ATTACK_TUNING.familiarMax);
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.kx) || !Number.isFinite(e.ky) || Number.isNaN(e.hp)) {
      throw new Error(`${syn.id}: NaN enemy ${e.def.id}`);
    }
  }
  for (let i = 0; i < w.enemyShots.count; i++) {
    const s = w.enemyShots.items[i]!;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy) || !Number.isFinite(s.dmg)) {
      throw new Error(`${syn.id}: NaN enemy shot`);
    }
  }
  for (let i = 0; i < w.creep.count; i++) {
    const c = w.creep.items[i]!;
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.r) || !Number.isFinite(c.dmg) || c.r > 20.01) {
      throw new Error(`${syn.id}: bad puddle`);
    }
  }
  for (let i = 0; i < w.waves.count; i++) if (!Number.isFinite(w.waves.items[i]!.rad)) throw new Error(`${syn.id}: NaN wave`);
  const p = w.player;
  for (const k of STAT_IDS) if (!Number.isFinite(p.stats[k])) throw new Error(`${syn.id}: NaN stat ${k}`);
  expect(p.synergies, `${syn.id} switched off`).toContain(syn.id);
}

function stress(syn: SynergyDef, ticks: number): { ms: number; kills: number } {
  const sim = stressSim(syn);
  const w = sim.world;
  const p = w.player;
  const input = makeInput();
  const rng = w.combatRng;
  let total = 0;
  for (let t = 0; t < ticks; t++) {
    const ph = t % 80;
    input.fireHeld = ph < 74;
    input.firePressed = ph === 0;
    input.fireReleased = ph === 74;
    const a = AIMS[Math.floor(t / 80) % 4]!;
    input.aimX = input.fireHeld ? a[0] : 0;
    input.aimY = input.fireHeld ? a[1] : 0;
    input.moveX = Math.sin(t * 0.05) * 0.7;
    input.moveY = Math.cos(t * 0.037) * 0.7;
    // Fodder keeps coming (shooters make hostile shots to bat back / slow / reflect).
    if (t % 15 === 0 && w.enemies.count < 14) {
      const e = sim.spawnEnemy(FODDER[(t / 15) % FODDER.length]!, rng.range(16, 192), rng.range(12, 100), { champion: false });
      if (e) e.spawnT = 0;
    }
    // Statuses on the crowd, so the kill hooks' `needs` filters (frozen / burning…) pass.
    if (t % 20 === 10) {
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i]!;
        if (e.hittable && e.def.id !== 't-syn-stress-tank') e.applyStatus(STATUSES[(t / 20 + i) % STATUSES.length | 0]!, 2, 1, 0);
      }
    }
    // Actives, bombs and the rarer triggers.
    if (t % 45 === 20 && p.inv.active) {
      chargeActive(w, 'full');
      useActive(w);
    }
    if (t % 60 === 30) sim.placeBomb();
    if (t % 40 === 5) {
      fireTrigger(w, 'hurt', p.x, p.y);
      fireTrigger(w, 'pickup', p.x, p.y);
      fireTrigger(w, 'roomClear', p.x, p.y);
    }
    if (t % 100 === 50) fireTrigger(w, 'floorStart', p.x, p.y);
    const t0 = performance.now();
    sim.step(input);
    total += performance.now() - t0;
    clearEdges(input);
    checkWorld(sim, syn);
  }
  expect(sim.events.dropped, `${syn.id}: events dropped`).toBe(0);
  expect(p.temps.length, `${syn.id}: temps piled up`).toBeLessThan(40);
  return { ms: total / ticks, kills: w.counters.kills };
}

describe('special synergies: 5 s stress with every item at 2 stacks', () => {
  for (const syn of SYNERGIES.values()) {
    it(`${syn.name}: no NaN, nothing over its cap, stays on`, () => {
      const r = stress(syn, 300);
      expect(r.kills, `${syn.id}: nothing died`).toBeGreaterThan(0);
      // Generous: a pathological hook would blow far past this; the real budget is checked by the
      // absurd-build test in attack-compose.
      expect(r.ms, `${syn.id}: ms per step`).toBeLessThan(12);
    });
  }

  it('every synergy at once (all their items at 2 stacks) for 5 s', () => {
    const all = [...SYNERGIES.values()];
    const sim = makeSim('stress-all', { room: OBSTACLE_ROOM });
    const w = sim.world;
    const p = w.player;
    w.godMode = true;
    const ids = new Set(all.flatMap(itemsOf));
    for (const id of ids) {
      const d = getItem(id);
      if (d.kind === 'active') continue;
      if (d.kind === 'trinket') p.inv.trinkets.push(id, id);
      else p.inv.passives.push(id, id);
    }
    setActive(p.inv, getItem('pot-lid'));
    p.inv.version++;
    recomputePlayer(w);
    expect(p.synergies.length).toBeGreaterThanOrEqual(all.length - 12);
    const input = makeInput();
    for (let t = 0; t < 300; t++) {
      const ph = t % 80;
      input.fireHeld = ph < 74;
      input.firePressed = ph === 0;
      input.fireReleased = ph === 74;
      const a = AIMS[Math.floor(t / 80) % 4]!;
      input.aimX = input.fireHeld ? a[0] : 0;
      input.aimY = input.fireHeld ? a[1] : 0;
      if (t % 15 === 0 && w.enemies.count < 14) {
        const e = sim.spawnEnemy(FODDER[(t / 15) % FODDER.length]!, w.combatRng.range(16, 192), w.combatRng.range(12, 100), { champion: false });
        if (e) e.spawnT = 0;
      }
      if (t % 40 === 5) {
        fireTrigger(w, 'hurt', p.x, p.y);
        fireTrigger(w, 'pickup', p.x, p.y);
      }
      sim.step(input);
      clearEdges(input);
      checkAttackInvariants(sim);
      expect(w.creep.count).toBeLessThanOrEqual(CAP_CREEP);
      expect(w.enemyShots.count).toBeLessThanOrEqual(CAP_ENEMY_SHOTS);
      expect(w.waves.count).toBeLessThanOrEqual(CAP_WAVES);
    }
    expect(sim.events.dropped).toBe(0);
    expect(w.counters.kills).toBeGreaterThan(0);
  });
});
