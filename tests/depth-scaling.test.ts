/**
 * Polish batch 4 (B4-3): the deep floors stay dangerous. After floor 3 almost no run died, fights ended inside the
 * enemies' spawn poof and bosses fell inside their intros. Now: a damage soft cap (like the fire rate's), enemy and boss
 * HP that grow with the floor, whole-heart hits from chapter 4 and from the finals, a minimum time per boss phase — and
 * the boss burrow soft-lock the longer fights exposed.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, findEnemy, registerBoss } from '../src/content/registry';
import { DMG_ENEMY, damagePlayer, enemyHitMin } from '../src/sim/combat';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { depthHpMul } from '../src/sim/enemies/spawn';
import { bossHpFor } from '../src/sim/bosses/select';
import { SRC_PLAYER } from '../src/sim/hittable';
import { DAMAGE_SOFTCAP, FIRE_RATE_SOFTCAP, computeStats, makeStats, softCapDamage, softCapFireRate } from '../src/sim/stats';
import { Sim } from '../src/sim/sim';
import { Tile } from '../src/sim/tiles';
import { BOSS_TUNING, ENEMY_TUNING } from '../src/sim/tuning';
import { makeInput, makeSim, stepN } from './helpers/sim';
import { SODDEN_SNARL_SPRITE } from '../src/content/sprites/bosses';

describe('the damage soft cap', () => {
  it('is linear up to the knee, logarithmic after, monotonic and continuous (slope 1 at the knee)', () => {
    const { knee } = DAMAGE_SOFTCAP;
    for (let x = 0; x <= knee; x += 0.5) expect(softCapDamage(x)).toBeCloseTo(x, 9);
    let prev = -Infinity;
    for (let x = 0; x <= 400; x += 0.25) {
      const v = softCapDamage(x);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    const e = 1e-6;
    expect(softCapDamage(knee + e) - softCapDamage(knee - e)).toBeCloseTo(2 * e, 9);
    // Stacking still pays, just less: a 40-damage build hits ~25, a 100 one ~35.
    expect(softCapDamage(40)).toBeGreaterThan(20);
    expect(softCapDamage(40)).toBeLessThan(30);
    expect(softCapDamage(100)).toBeLessThan(40);
    // It mirrors the fire rate's cap.
    expect(softCapFireRate(FIRE_RATE_SOFTCAP.knee + 4)).toBeLessThan(FIRE_RATE_SOFTCAP.knee + 4);
  });

  it('applies to the damage stat before the clamp', () => {
    const base = makeStats({ damage: 3.5, fireRate: 3, shotSpeed: 200, range: 150, moveSpeed: 96, shotSize: 3, knockback: 70 });
    const out = computeStats(base, [{ stat: 'damage', add: 30 }, { stat: 'damage', mul: 2 }], makeStats());
    expect(out.damage).toBeCloseTo(softCapDamage((3.5 + 30) * 2), 9);
    expect(out.damage).toBeLessThan(50);
  });
});

describe('enemy HP grows with the floor', () => {
  it('spawnEnemy scales a regular enemy by the floor (split copies keep the HP they are given)', () => {
    const def = findEnemy('scurrier')!;
    const hpAt = (floor: number): number => {
      const sim = makeSim(`depth-${floor}`);
      sim.world.floor = floor;
      return sim.spawnEnemy('scurrier', 60, 60, { champion: false })!.maxHp;
    };
    expect(hpAt(1)).toBeCloseTo(def.hp, 9);
    let prev = 0;
    for (let f = 1; f <= 13; f++) {
      const hp = hpAt(f);
      expect(hp).toBeCloseTo(def.hp * depthHpMul(f), 6);
      expect(hp).toBeGreaterThan(prev);
      prev = hp;
    }
    expect(depthHpMul(2)).toBeCloseTo(1 + ENEMY_TUNING.hpPerFloor, 9);
    // Steeper past the late knee.
    const early = depthHpMul(ENEMY_TUNING.hpLateFrom) - depthHpMul(ENEMY_TUNING.hpLateFrom - 1);
    const late = depthHpMul(ENEMY_TUNING.hpLateFrom + 1) - depthHpMul(ENEMY_TUNING.hpLateFrom);
    expect(late).toBeGreaterThan(early);
    const sim = makeSim('depth-split');
    sim.world.floor = 9;
    expect(sim.spawnEnemy('scurrier', 60, 60, { champion: false, hp: 5 })!.maxHp).toBe(5);
  });

  it('the chapter-4 dip is gone: a floor-7 enemy has more HP than a floor-6 one of the same kind, and real floors carry the floor', () => {
    expect(depthHpMul(7)).toBeGreaterThan(depthHpMul(6));
    const sim = Sim.newRun(5, { floor: 7, curse: null });
    expect(sim.world.floor).toBe(7);
    expect(sim.world.chapterNo).toBe(4);
  });

  it('bossHpFor scales every boss per floor', () => {
    for (const d of BOSSES.values()) {
      if (d.kind === 'final') continue;
      expect(bossHpFor(d, 1)).toBe(d.hp);
      expect(bossHpFor(d, 6)).toBe(Math.round(d.hp * (1 + 5 * BOSS_TUNING.hpPerFloor)));
      expect(bossHpFor(d, 12)).toBeGreaterThan(bossHpFor(d, 6));
    }
  });
});

describe('heavier hits from chapter 4 on', () => {
  it('an enemy shot costs a whole heart from chapter 4, half a heart before', () => {
    for (const [chapterNo, want] of [
      [1, 1],
      [3, 1],
      [4, 2],
      [6, 2],
    ] as const) {
      const sim = makeSim(`deep-hit-${chapterNo}`);
      const w = sim.world;
      w.chapterNo = chapterNo;
      w.safeT = 0;
      const h = w.player.health;
      const before = h.red;
      spawnEnemyShot(w, w.player.x - 20, w.player.y, 200, 0, 1, 3, 0, false, 0);
      stepN(sim, makeInput(), 12);
      expect(before - h.red, `chapter ${chapterNo}`).toBe(want);
    }
  });

  it("the Leaky Roof still adds one; spikes and the Thorn toll don't get the deep minimum", () => {
    const sim = makeSim('deep-leak');
    const w = sim.world;
    w.chapterNo = 5;
    w.curse = 'leak';
    w.safeT = 0;
    const h = w.player.health;
    const before = h.red;
    damagePlayer(w, 1, DMG_ENEMY);
    expect(before - h.red).toBe(3);
    expect(enemyHitMin(w)).toBe(2);
  });

  it('a final boss hits for at least a whole heart anywhere', () => {
    const sim = makeSim('final-hit', { room: ['.............', '.............', '.............', '.............', '.............', '.............', '.............'] });
    const w = sim.world;
    expect(enemyHitMin(w)).toBe(1);
    sim.startBossFight('old-thunderhead', 160, 56, { intro: false });
    expect(enemyHitMin(w)).toBe(BOSS_TUNING.finalHit);
  });
});

describe('the minimum phase time', () => {
  it('a boss hit by a 10,000-damage blow every tick still lasts at least phases × minPhase, and sees every phase', () => {
    for (const id of ['sodden-snarl', 'brimwell', 'old-governor', 'old-thunderhead']) {
      const def = BOSSES.get(id)!;
      const sim = makeSim(`minphase-${id}`, { room: ['.............', '.............', '.............', '.............', '.............', '.............', '.............'] });
      const w = sim.world;
      w.godMode = true;
      w.player.placeAt(24, 56);
      sim.startBossFight(id, 160, 56, { intro: false });
      const min = def.kind === 'final' ? BOSS_TUNING.minPhaseFinal : BOSS_TUNING.minPhase;
      let ticks = 0;
      let maxPhase = 0;
      let hits = 0;
      for (; ticks < 60 * 120 && !w.boss.done; ticks++) {
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (e.boss && e.hittable) {
            e.hurt(10_000, SRC_PLAYER, 0, 0);
            hits++;
          }
        }
        sim.step(makeInput());
        if (w.boss.active) maxPhase = Math.max(maxPhase, w.boss.phase);
      }
      expect(w.boss.done, id).toBe(true);
      expect(maxPhase, id).toBe(def.phases.length - 1);
      expect(ticks / 60, id).toBeGreaterThanOrEqual(def.phases.length * min);
      expect(hits, id).toBeGreaterThan(0);
    }
  });

  it('the hits still land while the phase is young (a flash, not immunity)', () => {
    const sim = makeSim('minphase-flash');
    const w = sim.world;
    sim.startBossFight('brimwell', 160, 56, { intro: false });
    stepN(sim, makeInput(), 30);
    const e = w.enemies.items.find((o) => o.boss)!;
    const hp = w.boss.hp;
    e.hurt(1e6, SRC_PLAYER, 0, 0);
    expect(e.flash).toBeGreaterThan(0);
    expect(w.boss.hp).toBeLessThan(hp);
    // …but it stops just short of the next phase until the phase is BOSS_TUNING.minPhase old.
    sim.step(makeInput());
    expect(w.boss.phase).toBe(0);
    expect(w.boss.hp / w.boss.maxHp).toBeGreaterThan(w.boss.marks[1]!);
  });
});

describe('a burrowing boss never gets stuck underground', () => {
  it('overdue under a spot too tight to surface in, it tunnels to the nearest open spot and comes up', () => {
    registerBoss({
      id: 't-depth-mole',
      name: 'Depth Mole',
      kind: 'boss',
      chapters: ['gutterways'],
      hp: 5000,
      size: 14,
      speed: 20,
      sprite: SODDEN_SNARL_SPRITE,
      shot: 'muck',
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.05, 0.05], patterns: [{ kind: 'burrow', params: { dig: 0.2, under: 0.5, rise: 0.3 } }] },
        { at: 0.01, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
      ],
    });
    // Wren stands in a one-cell nook walled by crates: nothing the boss's size can surface in near her.
    const room = [
      '.............',
      '.............',
      '.....xxx.....',
      '.....x@x.....',
      '.....x.x.....',
      '.............',
      '.............',
    ];
    const sim = makeSim('stuck-mole', { room });
    const w = sim.world;
    w.godMode = true;
    const boss = sim.startBossFight('t-depth-mole', 180, 90, { intro: false })!;
    let under = 0;
    let longest = 0;
    let surfaced = 0;
    for (let t = 0; t < 60 * 30; t++) {
      sim.step(makeInput());
      if (boss.burrowed) under++;
      else {
        if (under > 0) surfaced++;
        under = 0;
      }
      longest = Math.max(longest, under);
    }
    expect(surfaced).toBeGreaterThan(1);
    // Tunnel 0.5 s + half a second overdue + at most 3 s heading for open floor + the rise.
    expect(longest / 60).toBeLessThan(5);
    expect(w.room.get(6, 3)).toBe(Tile.Floor);
  });
});
