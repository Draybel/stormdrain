/**
 * Stress: every special synergy with ALL its items at 2 stacks (the active once, in its slot), 5 s of
 * real fighting — charge-and-release firing in four directions, shooters and fodder respawning, statuses
 * on the crowd so the kill hooks' filters pass, bombs, active uses and the rarer triggers (hurt, pickup,
 * room clear, floor start) every so often. After every tick: no NaN anywhere, every pool within its cap,
 * the chain-arc / explosion / event guardrails hold, the synergy stays on and its temps stay bounded.
 */

import { describe, expect, it } from 'vitest';
import { ITEMS, SYNERGIES, getItem } from '../src/content/registry';
import { clearEdges } from '../src/engine/inputState';
import { liveExplosions } from '../src/sim/attack/impacts';
import { CAP_CREEP, CAP_ENEMIES, CAP_ENEMY_SHOTS, CAP_PROJECTILES, CAP_WAVES } from '../src/sim/constants';
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
/** The active the "all at once" build holds (the others can't share the one active slot). */
const ALL_ACTIVE = 'pot-lid';

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

/**
 * After every tick. Plain comparisons that throw — no `expect` per tick: 60+ synergies × 300 ticks of
 * matcher calls would make this file a CPU hog next to the timing-sensitive tests running beside it. The
 * full attack invariants (beam segments, everything inside the room…) run every FULL_EVERY ticks.
 */
const FULL_EVERY = 30;

function fail(label: string, what: string): never {
  throw new Error(`${label}: ${what}`);
}

function checkWorld(sim: Sim, label: string, tick: number, mustHave?: string): void {
  if (tick % FULL_EVERY === 0) checkAttackInvariants(sim);
  const w = sim.world;
  const a = w.atk;
  if (w.projectiles.count > CAP_PROJECTILES) fail(label, `projectiles ${w.projectiles.count}`);
  if (a.beams.count > ATTACK_TUNING.capBeams) fail(label, `beams ${a.beams.count}`);
  if (a.swipes.count > ATTACK_TUNING.capSwipes) fail(label, `swipes ${a.swipes.count}`);
  if (a.arcsThisTick > ATTACK_TUNING.capChainArcs) fail(label, `chain arcs ${a.arcsThisTick}`);
  if (w.enemies.count > CAP_ENEMIES) fail(label, `enemies ${w.enemies.count}`);
  if (w.enemyShots.count > CAP_ENEMY_SHOTS) fail(label, `enemy shots ${w.enemyShots.count}`);
  if (w.creep.count > CAP_CREEP) fail(label, `puddles ${w.creep.count}`);
  if (w.waves.count > CAP_WAVES) fail(label, `waves ${w.waves.count}`);
  if (a.explosions.n > a.explosions.x.length) fail(label, 'explosion queue overflow');
  if (liveExplosions(w) > ATTACK_TUNING.capExplosionsLive) fail(label, `live explosions ${liveExplosions(w)}`);
  if (a.familiars.count() > ATTACK_TUNING.familiarMax) fail(label, `familiars ${a.familiars.count()}`);
  for (let i = 0; i < w.projectiles.count; i++) {
    const s = w.projectiles.items[i]!;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.damage) || !Number.isFinite(s.size)) fail(label, `NaN shot kind ${s.kind}`);
  }
  for (let i = 0; i < a.beams.count; i++) {
    const b = a.beams.items[i]!;
    if (b.n > ATTACK_TUNING.beamBudget || !Number.isFinite(b.dmg)) fail(label, 'bad beam');
    for (let k = 0; k < b.n; k++) if (!Number.isFinite(b.px[k]!) || !Number.isFinite(b.py[k]!)) fail(label, 'NaN beam point');
  }
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.kx) || !Number.isFinite(e.ky) || Number.isNaN(e.hp)) {
      fail(label, `NaN enemy ${e.def.id}`);
    }
  }
  for (let i = 0; i < w.enemyShots.count; i++) {
    const s = w.enemyShots.items[i]!;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy) || !Number.isFinite(s.dmg)) {
      fail(label, 'NaN enemy shot');
    }
  }
  for (let i = 0; i < w.creep.count; i++) {
    const c = w.creep.items[i]!;
    // Synergy hooks grow puddles to 20 px at most; a big puddle-modifier stack makes bigger ones itself
    // (8 + 2 per stack) — still well inside the puddle sprite cache's key range.
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.r) || !Number.isFinite(c.dmg) || c.r <= 0 || c.r > 63) {
      fail(label, `bad puddle x ${c.x} y ${c.y} r ${c.r} dmg ${c.dmg} allied ${c.allied} style ${c.style}`);
    }
  }
  for (let i = 0; i < w.waves.count; i++) if (!Number.isFinite(w.waves.items[i]!.rad)) fail(label, 'NaN wave');
  const p = w.player;
  for (const k of STAT_IDS) if (!Number.isFinite(p.stats[k])) fail(label, `NaN stat ${k}`);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) fail(label, 'NaN player');
  if (mustHave !== undefined && !p.synergies.includes(mustHave)) fail(label, 'switched off');
}

function aimAt(input: ReturnType<typeof makeInput>, t: number): void {
  const ph = t % 80;
  input.fireHeld = ph < 74;
  input.firePressed = ph === 0;
  input.fireReleased = ph === 74;
  const a = AIMS[Math.floor(t / 80) % 4]!;
  input.aimX = input.fireHeld ? a[0] : 0;
  input.aimY = input.fireHeld ? a[1] : 0;
}

/** Fodder keeps coming (shooters make hostile shots to bat back / slow / reflect). */
function feed(sim: Sim, t: number): void {
  const w = sim.world;
  if (t % 15 === 0 && w.enemies.count < 14) {
    const e = sim.spawnEnemy(FODDER[(t / 15) % FODDER.length]!, w.combatRng.range(16, 192), w.combatRng.range(12, 100), { champion: false });
    if (e) e.spawnT = 0;
  }
}

function stress(syn: SynergyDef, ticks: number): { ms: number; kills: number } {
  const sim = stressSim(syn);
  const w = sim.world;
  const p = w.player;
  const input = makeInput();
  let total = 0;
  let maxOwnTemps = 0;
  for (let t = 0; t < ticks; t++) {
    aimAt(input, t);
    input.moveX = Math.sin(t * 0.05) * 0.7;
    input.moveY = Math.cos(t * 0.037) * 0.7;
    feed(sim, t);
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
    checkWorld(sim, syn.id, t, syn.id);
    let own = 0;
    for (let i = 0; i < p.temps.length; i++) if (p.temps[i]!.source === syn.id) own++;
    if (own > maxOwnTemps) maxOwnTemps = own;
  }
  expect(sim.events.dropped, `${syn.id}: events dropped`).toBe(0);
  // The synergy's own timed boosts never pile up (cooldowns + durations). The items' temps are theirs:
  // "more damage this room" per hit, 8 hits in 5 s without i-frames, 2 copies each.
  expect(maxOwnTemps, `${syn.id}: its temps piled up`).toBeLessThanOrEqual(8);
  expect(p.temps.length, `${syn.id}: temps piled up`).toBeLessThan(120);
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
    setActive(p.inv, getItem(ALL_ACTIVE));
    p.inv.version++;
    recomputePlayer(w);
    // Every synergy is on except the ones that need another active in the one slot.
    const needsOtherActive = (s: SynergyDef): boolean =>
      s.requires.some((r) => typeof r === 'string' && getItem(r).kind === 'active' && r !== ALL_ACTIVE);
    const expected = all.filter((s) => !needsOtherActive(s)).map((s) => s.id);
    expect(expected.length).toBeGreaterThanOrEqual(44);
    for (const id of expected) expect(p.synergies, id).toContain(id);
    const input = makeInput();
    for (let t = 0; t < 300; t++) {
      aimAt(input, t);
      feed(sim, t);
      if (t % 40 === 5) {
        fireTrigger(w, 'hurt', p.x, p.y);
        fireTrigger(w, 'pickup', p.x, p.y);
      }
      sim.step(input);
      clearEdges(input);
      checkWorld(sim, 'all at once', t);
    }
    expect(sim.events.dropped).toBe(0);
    expect(w.counters.kills).toBeGreaterThan(0);
  });
});
