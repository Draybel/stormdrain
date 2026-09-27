/**
 * Phase 2 verification: modifiers must COMPOSE (ARCHITECTURE §4 — "any combination must work, nothing
 * is silently replaced"). A composition matrix over every trajectory-shaping modifier pair on every
 * primary, plus targeted checks for the defects the verification pass found and fixed: homing chasing
 * targets it could never reach, the tiny-planet orbit overriding homing / wavy / spiral, spiral
 * ignoring wavy, accelerate / decelerate / phase doing nothing on the Storm Lance, a beam orbit ring
 * swallowing extra / back shots, explode items not stacking onto the bomb rider, beam hit slots being
 * evicted in crowds, orbit blades losing init effects on a new item, swipes over the cap losing their
 * damage, lasers + circle-first never facing the aim, cosmetic events crowding the event queue.
 */

import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/content/registry';
import { EventQueue } from '../src/engine/events';
import { clearEdges } from '../src/engine/inputState';
import { BK_LANCE, BK_LASER, type Beam } from '../src/sim/attack/beam';
import { fireVolley } from '../src/sim/attack/fire';
import { AttackSource, OWN_PLAYER, SK_CRESCENT, SK_ORBIT } from '../src/sim/attack/state';
import { recomputePlayer } from '../src/sim/effects';
import { ST_CHARM } from '../src/sim/enemies/status';
import type { Enemy } from '../src/sim/enemies/enemy';
import { playerExplosion } from '../src/sim/attack/impacts';
import type { Sim } from '../src/sim/sim';
import { ATTACK_TUNING } from '../src/sim/tuning';
import type { CarrierId, ModId } from '../src/sim/types';
import { carrierItem, damageDealt, familiarItem, give, modItem, tankDef } from './helpers/attack';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

const T = ATTACK_TUNING;

// ── helpers ─────────────────────────────────────────────────────────────────

function emptySim(seed: string, x = 40, y = 56): Sim {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  sim.world.godMode = true;
  sim.world.player.placeAt(x, y);
  return sim;
}

function tank(sim: Sim, x: number, y: number): Enemy {
  const e = sim.spawnEnemy(tankDef(false), x, y, { champion: false })!;
  e.spawnT = 0;
  return e;
}

function loadout(sim: Sim, primary: CarrierId, mods: [ModId, number][]): void {
  if (primary !== 'marble') give(sim, carrierItem(primary));
  for (const [m, n] of mods) give(sim, modItem(m), n);
}

/** Holds fire right for `ticks` then releases (lances fire on release), then idles `after` ticks. */
function holdRelease(sim: Sim, ticks: number, after = 0): void {
  const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true, firePressed: true });
  for (let t = 0; t < ticks; t++) {
    sim.step(input);
    clearEdges(input);
  }
  input.fireHeld = false;
  input.aimX = 0;
  input.fireReleased = true;
  sim.step(input);
  clearEdges(input);
  for (let t = 0; t < after; t++) sim.step(input);
}

/** Fires right in bursts for `ticks` (hold 74, release, repeat — charge carriers need releases). */
function fireFor(sim: Sim, ticks: number): void {
  const input = makeInput({ aimX: 1, aimY: 0 });
  for (let t = 0; t < ticks; t++) {
    const ph = t % 80;
    input.fireHeld = ph < 74;
    input.firePressed = ph === 0;
    input.fireReleased = ph === 74;
    input.aimX = input.fireHeld ? 1 : 0;
    sim.step(input);
    clearEdges(input);
  }
}

function firstBeam(sim: Sim, kind: number): Beam {
  const beams = sim.world.atk.beams;
  for (let i = 0; i < beams.count; i++) if (beams.items[i]!.kind === kind) return beams.items[i]!;
  throw new Error('no beam');
}

// ── the composition matrix ─────────────────────────────────────────────────────

/** Every modifier that shapes where / how shots and beams travel (spawn + motion stages). */
const SHAPERS: ModId[] = [
  'extraShots',
  'spread',
  'backShot',
  'sideShots',
  'circleFirst',
  'inaccuracy',
  'homing',
  'wavy',
  'spiral',
  'orbitPlayer',
  'boomerang',
  'grow',
  'shrink',
  'accelerate',
  'decelerate',
];

/** A hash of every projectile / beam point / swipe over 100 ticks of firing (an enemy off the aim line). */
function trajectory(prim: CarrierId, mods: ModId[]): string {
  const sim = emptySim('traj', 60, 56);
  tank(sim, 150, 30);
  loadout(
    sim,
    prim,
    mods.map((m) => [m, 1]),
  );
  const w = sim.world;
  const input = makeInput({ aimX: 1, aimY: 0 });
  let h = 0;
  const acc = (v: number): void => {
    h = (h * 1.000001 + v * 0.7310585) % 1e12;
  };
  for (let t = 0; t < 100; t++) {
    input.fireHeld = t < 66;
    input.firePressed = t === 0;
    input.fireReleased = t === 66;
    input.aimX = input.fireHeld ? 1 : 0;
    sim.step(input);
    clearEdges(input);
    for (let i = 0; i < w.projectiles.count; i++) {
      const s = w.projectiles.items[i]!;
      acc(s.x * 3 + s.y * 7 + s.size * 11);
    }
    for (let i = 0; i < w.atk.beams.count; i++) {
      const b = w.atk.beams.items[i]!;
      for (let k = 0; k < b.n; k += 2) acc(b.px[k]! * 3 + b.py[k]! * 5 + b.pw[k]! * 7);
    }
    for (let i = 0; i < w.atk.swipes.count; i++) acc(w.atk.swipes.items[i]!.ang * 13);
  }
  return h.toFixed(4);
}

describe('modifiers compose: no pair of shapers silently replaces or cancels the other', () => {
  for (const prim of ['marble', 'lance', 'laser', 'melee', 'boomerang'] as CarrierId[]) {
    it(`${prim}: every shaper changes the attack, every pair differs from each of its parts`, () => {
      const base = trajectory(prim, []);
      const single = new Map<ModId, string>();
      const lost: string[] = [];
      for (const m of SHAPERS) {
        const f = trajectory(prim, [m]);
        single.set(m, f);
        if (f === base) lost.push(`${m} alone does nothing`);
      }
      for (let i = 0; i < SHAPERS.length; i++) {
        for (let j = i + 1; j < SHAPERS.length; j++) {
          const a = SHAPERS[i]!;
          const b = SHAPERS[j]!;
          const f = trajectory(prim, [a, b]);
          if (f === single.get(a)) lost.push(`${a} + ${b} == ${a} alone`);
          if (f === single.get(b)) lost.push(`${a} + ${b} == ${b} alone`);
        }
      }
      expect(lost).toEqual([]);
    });
  }
});

// ── homing ─────────────────────────────────────────────────────────────────────

describe('homing only chases what it can reach', () => {
  /** A target straight ahead plus closer ones beside and behind the player (the old trap). */
  function homingDamage(prim: CarrierId, stacks: number): { ahead: number; total: number } {
    const sim = emptySim(`homing-${prim}-${stacks}`);
    const ahead = tank(sim, 100, 56);
    tank(sim, 40, 26); // beside, closer than the one ahead
    tank(sim, 12, 56); // behind
    loadout(sim, prim, stacks > 0 ? [['homing', stacks]] : []);
    fireFor(sim, 240);
    return { ahead: ahead.maxHp - ahead.hp, total: damageDealt(sim) };
  }

  for (const prim of ['marble', 'melee', 'lance', 'laser'] as CarrierId[]) {
    it(`${prim}: homing never loses the target straight ahead to a closer one beside you`, () => {
      const plain = homingDamage(prim, 0);
      expect(plain.ahead).toBeGreaterThan(0);
      for (const stacks of [1, 3]) {
        const h = homingDamage(prim, stacks);
        expect(h.total, `${stacks} stacks`).toBeGreaterThanOrEqual(plain.total * 0.9);
        expect(h.ahead, `${stacks} stacks`).toBeGreaterThan(0);
      }
    });
  }

  it('a piercing homing shot moves on to the next target after a hit', () => {
    const sim = emptySim('homing-pierce');
    const a = tank(sim, 90, 56);
    const b = tank(sim, 130, 90);
    loadout(sim, 'marble', [
      ['homing', 2],
      ['pierce', 2],
    ]);
    sim.world.player.attack.range = 400;
    holdRelease(sim, 1, 90);
    expect(a.maxHp - a.hp).toBeGreaterThan(0);
    expect(b.maxHp - b.hp).toBeGreaterThan(0);
  });

  it('a homing lance bends onto an enemy off the line after passing through the one ahead', () => {
    const sim = emptySim('homing-lance', 24, 56);
    const a = tank(sim, 80, 56);
    const b = tank(sim, 160, 88);
    loadout(sim, 'lance', [['homing', 1]]);
    holdRelease(sim, 64, 30);
    expect(a.maxHp - a.hp).toBeGreaterThan(0);
    expect(b.maxHp - b.hp).toBeGreaterThan(0);
  });
});

// ── orbit (tiny planet) composes ────────────────────────────────────────────────

describe('orbitPlayer composes with homing and bounce', () => {
  it('orbit + homing: the ring locks onto an enemy outside it that a plain orbit never touches', () => {
    const run = (homing: boolean): number => {
      const sim = emptySim(`orbit-homing-${homing}`, 104, 56);
      const e = tank(sim, 104 + 62, 56);
      loadout(sim, 'marble', homing ? [['orbitPlayer', 1], ['homing', 2]] : [['orbitPlayer', 1]]);
      const input = makeInput({ aimX: 0, aimY: -1, fireHeld: true, firePressed: true });
      for (let t = 0; t < 210; t++) {
        if (t === 150) input.fireHeld = false;
        sim.step(input);
        clearEdges(input);
      }
      return e.maxHp - e.hp;
    };
    expect(run(false)).toBe(0);
    expect(run(true)).toBeGreaterThan(0);
  });

  it('an orbiting shot bounces off a wall once per contact instead of burning every bounce at once', () => {
    const sim = emptySim('orbit-bounce', 200, 56);
    loadout(sim, 'marble', [
      ['orbitPlayer', 2],
      ['bounce', 1],
    ]);
    const input = makeInput({ aimX: 0, aimY: -1, firePressed: true, fireReleased: true });
    sim.step(input);
    clearEdges(input);
    const s = sim.world.projectiles.items[0]!;
    expect(s.bounceLeft).toBe(2);
    let first = -1;
    for (let t = 0; t < 120 && s.alive; t++) {
      sim.step(input);
      if (first < 0 && s.bounceLeft < 2) {
        first = t;
        // One contact, one bounce — and the shot lives on.
        expect(s.bounceLeft).toBe(1);
        expect(s.alive).toBe(true);
      }
    }
    expect(first).toBeGreaterThanOrEqual(0);
  });
});

// ── the Storm Lance with speed / phase modifiers ────────────────────────────────

describe('Storm Lance: accelerate, decelerate and phase all do something', () => {
  function lance(mods: [ModId, number][]): { beam: Beam; dmg: number; life: number } {
    const sim = emptySim(`lance-${mods.map((m) => m[0]).join('-')}`, 24, 56);
    const far = tank(sim, 190, 56);
    loadout(sim, 'lance', mods);
    holdRelease(sim, 64);
    const beam = firstBeam(sim, BK_LANCE);
    const snapshot = { beam, life: beam.life, dmg: 0 };
    const input = makeInput();
    for (let t = 0; t < 60; t++) sim.step(input);
    snapshot.dmg = far.maxHp - far.hp;
    return snapshot;
  }

  it('accelerate tapers the beam into a thinner, harder-hitting tip', () => {
    const plain = lance([]);
    const acc = lance([['accelerate', 2]]);
    const b = acc.beam;
    const last = b.segLen[0]! - 1;
    expect(b.pw[last]!).toBeLessThan(b.pw[0]! * 0.8);
    expect(acc.dmg).toBeGreaterThan(plain.dmg * 1.2);
  });

  it('decelerate flares the beam out and makes it linger', () => {
    const plain = lance([]);
    const dec = lance([['decelerate', 2]]);
    const b = dec.beam;
    const last = b.segLen[0]! - 1;
    expect(b.pw[last]!).toBeGreaterThan(b.pw[0]! * 1.3);
    expect(dec.life).toBeGreaterThan(plain.life * 1.2);
  });

  it('phase (the lance already passes rocks) makes it hit harder', () => {
    const plain = lance([]);
    const ph = lance([['phase', 2]]);
    expect(ph.dmg).toBeGreaterThan(plain.dmg * 1.2);
  });

  it('a beam orbit ring multiplies with extra / back shots instead of swallowing them', () => {
    const sim = emptySim('ring-extra', 104, 56);
    loadout(sim, 'lance', [
      ['orbitPlayer', 1],
      ['extraShots', 1],
      ['backShot', 1],
    ]);
    holdRelease(sim, 64);
    // (1 main + 1 extra + 1 back) × (1 + 1 orbit stack) evenly around the circle.
    let lances = 0;
    for (let i = 0; i < sim.world.atk.beams.count; i++) if (sim.world.atk.beams.items[i]!.kind === BK_LANCE) lances++;
    expect(lances).toBe(6);
  });

  it('a laser with circle-first sweeps its circle and still ends on the aim', () => {
    const sim = emptySim('laser-circle', 104, 56);
    loadout(sim, 'laser', [['circleFirst', 1]]);
    const input = makeInput({ aimX: 1, aimY: 0, firePressed: true, fireReleased: true });
    sim.step(input);
    const b = firstBeam(sim, BK_LASER);
    const idle = makeInput();
    let dir = b.dir;
    const life = Math.round(b.life * 60);
    for (let t = 0; t < life - 2 && b.alive; t++) {
      sim.step(idle);
      dir = b.dir;
    }
    expect(Math.abs(Math.atan2(Math.sin(dir), Math.cos(dir)))).toBeLessThan(0.05);
  });
});

// ── explode + bomb rider ────────────────────────────────────────────────────────

describe('explode items stack onto the bomb rider', () => {
  /** The biggest shot blast (radius, damage) of one bomb-rider shot hitting a target. */
  function blast(explodeItems: number): { r: number; dmg: number } {
    const sim = emptySim(`bomb-explode-${explodeItems}`);
    tank(sim, 90, 56);
    give(sim, carrierItem('bomb'));
    if (explodeItems > 0) give(sim, modItem('explode'), explodeItems);
    const input = makeInput({ aimX: 1, aimY: 0, firePressed: true, fireReleased: true });
    sim.step(input);
    const idle = makeInput();
    const out = { r: 0, dmg: 0 };
    for (let t = 0; t < 40; t++) {
      sim.step(idle);
      const q = sim.events;
      for (let i = 0; i < q.count; i++) {
        const e = q.at(i);
        if (e.type !== 'explosion' || e.id !== 'shot') continue;
        out.r = Math.max(out.r, e.a);
        out.dmg = Math.max(out.dmg, e.b);
      }
    }
    return out;
  }

  it('each explode item grows the bomb blast and its damage (they used to be swallowed by the bomb numbers)', () => {
    const bomb = blast(0);
    const plus1 = blast(1);
    const plus3 = blast(3);
    expect(bomb.r).toBeCloseTo(T.bombRadius, 5);
    expect(plus1.r).toBeGreaterThan(bomb.r);
    expect(plus3.r).toBeGreaterThan(plus1.r);
    expect(plus1.dmg).toBeGreaterThan(bomb.dmg * 1.1);
    expect(plus3.dmg).toBeGreaterThan(plus1.dmg * 1.1);
  });
});

// ── guardrails ─────────────────────────────────────────────────────────────────

describe('guardrails keep damage honest', () => {
  it('a lance through a crowd bigger than its hit slots never hits anyone faster than its tick rate', () => {
    const sim = emptySim('lance-crowd', 24, 56);
    const crowd: Enemy[] = [];
    for (let i = 0; i < 40; i++) crowd.push(tank(sim, 60 + (i % 20) * 7, 52 + Math.floor(i / 20) * 8));
    loadout(sim, 'lance', []);
    holdRelease(sim, 64, 60);
    const tick = sim.world.player.attack.lanceTick;
    const maxTicks = Math.ceil((T.lanceLife * 60) / T.lanceEvery) + 1;
    let hit = 0;
    for (const e of crowd) {
      const d = e.maxHp - e.hp;
      if (d > 0) hit++;
      expect(d).toBeLessThanOrEqual(tick * maxTicks + 1e-6);
    }
    // (Overlapping tanks drift apart; more than the old 16 slots still get their ticks.)
    expect(hit).toBeGreaterThan(20);
  });

  it('orbit blades keep their init effects (knockback ×) after a new item rebuilds the profile', () => {
    const sim = emptySim('blade-knock', 104, 56);
    give(sim, carrierItem('orbit'));
    give(sim, modItem('knockback'), 2);
    sim.step(makeInput());
    const blade = (): number => {
      for (let i = 0; i < sim.world.projectiles.count; i++) {
        const s = sim.world.projectiles.items[i]!;
        if (s.kind === SK_ORBIT) return s.knock;
      }
      return -1;
    };
    const before = blade();
    expect(before).toBeGreaterThan(sim.world.player.attack.knockback * 2);
    give(sim, modItem('wavy'));
    sim.step(makeInput());
    expect(blade()).toBeCloseTo(before, 5);
  });

  it('a melee volley at the swipe cap puts the swipe damage on its crescent', () => {
    const sim = emptySim('swipe-cap');
    give(sim, carrierItem('melee'));
    const w = sim.world;
    const src = new AttackSource();
    src.ownerKind = OWN_PLAYER;
    src.anchor = w.player;
    // Fill the swipe pool with volleys in other directions.
    for (let i = 0; i < T.capSwipes; i++) {
      const a = (i / T.capSwipes) * Math.PI * 2;
      fireVolley(w, src, w.player, { x: Math.cos(a), y: Math.sin(a) }, w.player.attack, 1);
    }
    expect(w.atk.swipes.free).toBe(0);
    const before = w.projectiles.count;
    fireVolley(w, src, w.player, { x: 1, y: 0 }, w.player.attack, 1);
    const c = w.projectiles.items[before]!;
    expect(c.kind).toBe(SK_CRESCENT);
    const p = w.player.attack;
    const expected = p.damage * T.crescentDamage + p.damage * T.meleeDamage;
    expect(c.baseDamage).toBeCloseTo(expected, 5);
  });

  it('cosmetic events stop at the fx cap; gameplay events always get in', () => {
    const q = new EventQueue(64, 16);
    for (let i = 0; i < 40; i++) q.emitFx('shotBounce', i);
    expect(q.count).toBe(16);
    expect(q.fxSkipped).toBe(24);
    q.emit('enemyKilled', 1);
    expect(q.count).toBe(17);
    expect(q.at(16).type).toBe('enemyKilled');
  });

  it("the player's own shot blasts spare charmed enemies (like every other player attack); bombs do not", () => {
    const sim = emptySim('charm-blast');
    const e = tank(sim, 120, 56);
    e.applyStatus('charm', 5, 0, 0);
    expect(e.status.t[ST_CHARM]).toBeGreaterThan(0);
    playerExplosion(sim.world, 120, 56, 30, 20, false);
    expect(e.hp).toBe(e.maxHp);
    sim.explode(120, 56);
    expect(e.hp).toBeLessThan(e.maxHp);
  });
});

// ── the absurd build ───────────────────────────────────────────────────────────

describe('every item ×3: an absurd build in a live arena', () => {
  function absurd(seed: string): Sim {
    const sim = makeSim(seed, { room: OPEN_ROOM });
    const w = sim.world;
    w.godMode = true;
    for (const def of ITEMS.values()) {
      if (def.tags.includes('test')) continue;
      for (let i = 0; i < 3; i++) w.player.inv.passives.push(def.id);
    }
    w.player.inv.version++;
    recomputePlayer(w);
    sim.startWave({ count: 8 });
    return sim;
  }

  function play(sim: Sim, ticks: number, each?: (ms: number) => void): void {
    const input = makeInput();
    const aims = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const;
    for (let t = 0; t < ticks; t++) {
      const ph = t % 80;
      input.fireHeld = ph < 74;
      input.firePressed = ph === 0;
      input.fireReleased = ph === 74;
      const a = aims[Math.floor(t / 80) % 4]!;
      input.aimX = input.fireHeld ? a[0] : 0;
      input.aimY = input.fireHeld ? a[1] : 0;
      input.moveX = Math.sin(t * 0.02) * 0.6;
      input.moveY = Math.cos(t * 0.031) * 0.6;
      const t0 = performance.now();
      sim.step(input);
      each?.(performance.now() - t0);
      clearEdges(input);
      if (sim.world.enemies.count === 0 && !sim.world.arena.active) sim.startWave({ count: 8 });
    }
  }

  it('20 s of waves: under the caps, < 4 ms per step on average, the event queue never overflows', () => {
    const sim = absurd('absurd-perf');
    const w = sim.world;
    let total = 0;
    let n = 0;
    let maxEvents = 0;
    play(sim, 1200, (ms) => {
      total += ms;
      n++;
      maxEvents = Math.max(maxEvents, sim.events.count);
      expect(w.projectiles.count).toBeLessThanOrEqual(700);
      expect(w.atk.beams.count).toBeLessThanOrEqual(T.capBeams);
    });
    expect(total / n).toBeLessThan(4);
    expect(sim.events.dropped).toBe(0);
    expect(maxEvents).toBeLessThan(sim.events.capacity);
    expect(w.counters.kills).toBeGreaterThan(20);
  });

  it('is deterministic: the same seed and inputs give the same fight', () => {
    const fingerprint = (sim: Sim): string => {
      const w = sim.world;
      const parts: string[] = [`${w.counters.kills}`, `${w.counters.hits}`, `${w.projectiles.count}`, `${w.atk.beams.count}`];
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i]!;
        parts.push(`${e.def.id}:${e.x.toFixed(4)},${e.y.toFixed(4)}:${e.hp.toFixed(4)}`);
      }
      return parts.join('|');
    };
    const a = absurd('absurd-det');
    const b = absurd('absurd-det');
    play(a, 360);
    play(b, 360);
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});

// ── every hit / status modifier lands through every delivery ─────────────────────

describe('every hit / status modifier lands through every way of dealing damage', () => {
  const HIT_MODS: ModId[] = ['poison', 'burn', 'freeze', 'slow', 'charm', 'fear', 'chain', 'split', 'explode', 'puddle', 'knockback'];
  type Delivery = 'marble' | 'lance' | 'laser' | 'boomerang' | 'swipe' | 'blade' | 'familiar';
  const DELIVERIES: Delivery[] = ['marble', 'lance', 'laser', 'boomerang', 'swipe', 'blade', 'familiar'];

  /** 200 ticks of one delivery with 5 stacks of `mod` against a target (and a neighbour for chain). */
  function landed(del: Delivery, mod: ModId): boolean {
    const sim = emptySim(`dlv-${del}-${mod}`, 60, 56);
    const w = sim.world;
    // Swipes reach ~26 px; orbit blades circle 22 px out; everything else shoots from range.
    const tx = del === 'swipe' ? 78 : del === 'blade' ? 60 : 110;
    const ty = del === 'blade' ? 34 : 56;
    const main = tank(sim, tx, ty);
    const second = tank(sim, tx + 14, ty + 18);
    if (del === 'lance' || del === 'laser' || del === 'boomerang') give(sim, carrierItem(del));
    if (del === 'swipe') give(sim, carrierItem('melee'));
    if (del === 'blade') give(sim, carrierItem('orbit'));
    if (del === 'familiar') give(sim, familiarItem('lamplet'));
    give(sim, modItem(mod), 5);
    const x0 = main.x;
    const y0 = main.y;
    let arcs = 0;
    let splits = 0;
    let booms = 0;
    let status = 0;
    const input = makeInput({ aimX: 1, aimY: 0 });
    for (let t = 0; t < 200; t++) {
      const fire = del !== 'blade';
      const ph = t % 80;
      input.fireHeld = fire && ph < 74;
      input.firePressed = fire && ph === 0;
      input.fireReleased = fire && ph === 74;
      sim.step(input);
      clearEdges(input);
      if (del === 'familiar') {
        // Only the familiar's shots count: the player's own are removed as they appear.
        for (let i = w.projectiles.count - 1; i >= 0; i--) {
          const s = w.projectiles.items[i]!;
          if (s.ownerKind === OWN_PLAYER && s.depth === 0) w.projectiles.release(s);
        }
      }
      status |= main.status.mask | second.status.mask;
      const q = sim.events;
      for (let i = 0; i < q.count; i++) {
        const e = q.at(i);
        if (e.type === 'chainArc') arcs++;
        else if (e.type === 'shotSplit') splits++;
        else if (e.type === 'explosion' && e.id === 'shot') booms++;
      }
      for (let i = 0; i < w.atk.beams.count; i++) if (w.atk.beams.items[i]!.nseg > 1) splits++;
    }
    let puddles = 0;
    for (let i = 0; i < w.creep.count; i++) if (w.creep.items[i]!.allied) puddles++;
    switch (mod) {
      case 'chain':
        return arcs > 0;
      case 'split':
        return splits > 0;
      case 'explode':
        return booms > 0;
      case 'puddle':
        return puddles > 0;
      case 'knockback':
        return Math.hypot(main.x - x0, main.y - y0) > 2;
      default:
        return status !== 0;
    }
  }

  for (const del of DELIVERIES) {
    it(`${del}: poison, burn, freeze, slow, charm, fear, chain, split, explode, puddle, knockback`, () => {
      const missing = HIT_MODS.filter((m) => !landed(del, m));
      expect(missing).toEqual([]);
    });
  }
});
