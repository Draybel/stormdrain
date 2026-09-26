import { describe, expect, it } from 'vitest';
import { WREN } from '../src/content/characters/wren';
import { FIRE_RATE_SOFTCAP, STAT_RULES, computeStats, makeStats, softCapFireRate } from '../src/sim/stats';
import {
  BONUS_EMBER,
  BONUS_TIN,
  HEART_CAP,
  Health,
  addBonus,
  addContainers,
  bonusHalves,
  canAddBonus,
  canHeal,
  damageHealth,
  describeHealth,
  heal,
  initHealth,
  isDead,
  makeDamageResult,
} from '../src/sim/health';
import { PLAYER_TUNING } from '../src/sim/tuning';
import { makeInput, makeSim, stepN } from './helpers/sim';

const BASE = WREN.stats;

describe('stats: add → mul → clamp', () => {
  it('no effects = the character base', () => {
    const out = computeStats(BASE, [], makeStats());
    expect(out).toEqual(BASE);
  });

  it('sums adds, multiplies muls, adds before muls', () => {
    const out = computeStats(
      BASE,
      [
        { stat: 'damage', add: 1 },
        { stat: 'damage', add: 0.5 },
        { stat: 'damage', mul: 2 },
        { stat: 'damage', mul: 1.5 },
        { stat: 'range', add: 45 },
      ],
      makeStats(),
    );
    expect(out.damage).toBeCloseTo((3.5 + 1.5) * 3, 6);
    expect(out.range).toBe(195);
    expect(out.fireRate).toBe(BASE.fireRate);
  });

  it('clamps every stat into its range', () => {
    const out = computeStats(
      BASE,
      [
        { stat: 'damage', add: -100 },
        { stat: 'shotSpeed', mul: 100 },
        { stat: 'range', mul: 0 },
        { stat: 'knockback', add: -1000 },
      ],
      makeStats(),
    );
    expect(out.damage).toBe(STAT_RULES.damage.min);
    expect(out.shotSpeed).toBe(STAT_RULES.shotSpeed.max);
    expect(out.range).toBe(STAT_RULES.range.min);
    expect(out.knockback).toBe(0);
  });

  it('move speed never exceeds 2× the base', () => {
    const out = computeStats(BASE, [{ stat: 'moveSpeed', add: 500 }], makeStats());
    expect(out.moveSpeed).toBe(BASE.moveSpeed * 2);
  });

  it('fire rate has diminishing returns past the knee, but keeps growing', () => {
    const { knee } = FIRE_RATE_SOFTCAP;
    expect(softCapFireRate(2)).toBe(2);
    expect(softCapFireRate(knee)).toBe(knee);
    let prev: number = knee;
    let prevGain = Infinity;
    for (let raw = knee + 1; raw <= knee + 20; raw++) {
      const v = softCapFireRate(raw);
      expect(v).toBeGreaterThan(prev); // monotonic
      expect(v).toBeLessThan(raw); // softened
      const gain = v - prev;
      expect(gain).toBeLessThan(prevGain); // diminishing
      prevGain = gain;
      prev = v;
    }
    const out = computeStats(BASE, [{ stat: 'fireRate', add: 10 }], makeStats());
    expect(out.fireRate).toBeCloseTo(softCapFireRate(13), 6);
    expect(out.fireRate).toBeLessThan(13);
  });

  it('keeps the output object identity (references stay valid)', () => {
    const out = makeStats();
    const same = computeStats(BASE, [{ stat: 'luck', add: 2 }], out);
    expect(same).toBe(out);
    expect(out.luck).toBe(2);
  });

  it('ignores non-finite adds/muls', () => {
    const out = computeStats(BASE, [{ stat: 'damage', add: NaN }, { stat: 'damage', mul: Infinity }], makeStats());
    expect(out.damage).toBe(BASE.damage);
  });
});

describe('health model', () => {
  const fresh = (redMax = 6): Health => {
    const h = new Health();
    initHealth(h, redMax, redMax, 0, 0);
    return h;
  };

  it('damage takes the LAST gained bonus heart first, then earlier ones, then red', () => {
    const h = fresh(6);
    addBonus(h, BONUS_TIN, 2); // gained 1st
    addBonus(h, BONUS_EMBER, 2); // gained 2nd
    expect(describeHealth(h)).toBe('R6/6 T2 E2');
    const r = makeDamageResult();
    damageHealth(h, 1, r); // half of the ember heart
    expect(describeHealth(h)).toBe('R6/6 T2 E1');
    expect(r.emberBroken).toBe(0);
    damageHealth(h, 1, r); // the ember heart breaks
    expect(r.emberBroken).toBe(1);
    expect(describeHealth(h)).toBe('R6/6 T2');
    damageHealth(h, 2, r); // the tin heart
    expect(r.tinBroken).toBe(1);
    expect(h.red).toBe(6);
    damageHealth(h, 1, r);
    expect(r.redTaken).toBe(1);
    expect(h.red).toBe(5);
  });

  it('damage spills over from bonus hearts into red', () => {
    const h = fresh(6);
    addBonus(h, BONUS_TIN, 1);
    const r = damageHealth(h, 2, makeDamageResult());
    expect(r.taken).toBe(2);
    expect(r.tinBroken).toBe(1);
    expect(h.red).toBe(5);
    expect(bonusHalves(h)).toBe(0);
  });

  it('half bonus hearts are topped up by the same kind, other kinds start a new heart', () => {
    const h = fresh(2);
    addBonus(h, BONUS_TIN, 1);
    addBonus(h, BONUS_TIN, 1);
    expect(h.bonusCount).toBe(1);
    addBonus(h, BONUS_EMBER, 1);
    addBonus(h, BONUS_TIN, 1);
    expect(describeHealth(h)).toBe('R2/2 T2 E1 T1');
  });

  it('caps containers + bonus hearts at 12 hearts', () => {
    const h = fresh(20);
    expect(addBonus(h, BONUS_TIN, 10)).toBe(4); // room for 2 hearts
    expect(canAddBonus(h, BONUS_TIN)).toBe(false);
    expect(canAddBonus(h, BONUS_EMBER)).toBe(false);
    expect(addContainers(h, 3)).toBe(0);
    const g = fresh(6);
    expect(addContainers(g, 20)).toBe(HEART_CAP - 3);
    expect(g.redMax).toBe(HEART_CAP * 2);
  });

  it('heals red only up to the containers; new containers come filled; removing trims red', () => {
    const h = fresh(6);
    damageHealth(h, 3, makeDamageResult());
    expect(canHeal(h)).toBe(true);
    expect(heal(h, 1)).toBe(1);
    expect(heal(h, 99)).toBe(2);
    expect(heal(h, 1)).toBe(0);
    expect(canHeal(h)).toBe(false);
    addContainers(h, 1);
    expect(h.redMax).toBe(8);
    expect(h.red).toBe(8);
    addContainers(h, -2);
    expect(h.redMax).toBe(4);
    expect(h.red).toBe(4);
  });

  it('death when red and bonus are both empty (bonus-only characters too)', () => {
    const h = new Health();
    initHealth(h, 0, 0, 4, 0); // e.g. a bonus-hearts-only character
    expect(isDead(h)).toBe(false);
    const r = damageHealth(h, 3, makeDamageResult());
    expect(r.dead).toBe(false);
    expect(damageHealth(h, 5, r).dead).toBe(true);
    expect(isDead(h)).toBe(true);
  });
});

describe('player damage in the sim', () => {
  it('i-frames last ~1 s: a second hit inside them is ignored, after them it lands', () => {
    const sim = makeSim(1, { room: ['.............', '.............', '.............', '......@......', '.............', '.............', '.............'] });
    const p = sim.world.player;
    sim.hurtPlayer(1);
    expect(p.red).toBe(5);
    expect(p.invuln).toBeCloseTo(PLAYER_TUNING.hurtInvuln, 6);
    stepN(sim, makeInput(), 50); // 0.83 s
    sim.hurtPlayer(1);
    expect(p.red).toBe(5);
    stepN(sim, makeInput(), 12); // past 1 s
    expect(p.invuln).toBe(0);
    sim.hurtPlayer(1);
    expect(p.red).toBe(4);
  });

  it('breaking an Ember heart releases a fire nova that damages nearby targets', () => {
    // A dummy right next to the player.
    const sim = makeSim(1, { room: ['.............', '.............', '.............', '.....@D......', '.............', '.............', '.............'] });
    const w = sim.world;
    addBonus(w.player.health, BONUS_EMBER, 2);
    const d = w.dummies.items[0]!;
    const hp0 = d.hp;
    sim.hurtPlayer(2);
    const st = stepN(sim, makeInput(), 1);
    expect(st.events.nova).toBe(1);
    expect(st.events.hurt).toBe(1);
    expect(d.hp).toBeLessThan(hp0);
    expect(w.player.red).toBe(6); // the ember heart soaked the hit
  });

  it('dies at zero health and stops acting', () => {
    const sim = makeSim(1);
    const p = sim.world.player;
    for (let i = 0; i < 3; i++) {
      p.invuln = 0;
      sim.hurtPlayer(2);
    }
    expect(p.dead).toBe(true);
    expect(stepN(sim, makeInput(), 1).events.death).toBe(1);
  });
});
