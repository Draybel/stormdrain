/**
 * Polish batch 4 (B4-5): character balance. The balance harness (tests/helpers/balance.ts) found Sable winning nearly
 * every run (her swipe dealt 2.7× Wren's damage in reach and deleted every enemy shot around it), Marrow's boomerang
 * hitting on the way out and back at 1.6×, Juniper's full jar adding only a third, Bolt dying on floor 1 in a third of
 * his runs, and Mosswick refilling her Tin after every room. Here: each character's static-target damage against
 * Wren's (tests/helpers/dps.ts, perfect aim), and the melee swat's limits. (The soak rule: tests/characters.test.ts.)
 */

import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/content/registry';
import { spawnSwipe } from '../src/sim/attack/melee';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { recomputePlayer } from '../src/sim/effects';
import { ATTACK_TUNING } from '../src/sim/tuning';
import { aimedDps, dpsTargetDef } from './helpers/dps';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const WREN = aimedDps({ dist: 40, items: [], character: 'wren' });

/** Juniper with `flies` fireflies in all (2 innate + temporary ones), holding the trigger at a pinned target. */
function juniperDps(flies: number): number {
  const sim = makeSim(`jar:${flies}`, { room: OPEN_ROOM, character: CHARACTERS.get('juniper') });
  const w = sim.world;
  w.godMode = true;
  w.player.placeAt(24, 56);
  w.player.mech.flies = flies - 2;
  recomputePlayer(w);
  const t = sim.spawnEnemy(dpsTargetDef(), 64, 56, { champion: false })!;
  t.spawnT = 0;
  t.pinned = true;
  stepN(sim, makeInput(), 30);
  const hp0 = t.hp;
  const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
  for (let k = 0; k < 1200; k++) {
    stepN(sim, input, 1);
    w.player.placeAt(24, 56);
  }
  return (hp0 - t.hp) / 20;
}

describe('static-target damage by character (× Wren, perfect aim)', () => {
  const ratio = (id: string, dist = 40): number => aimedDps({ dist, items: [], character: id }) / WREN;

  it('Wren is the yardstick (~10.5 a second at base)', () => {
    expect(WREN).toBeGreaterThan(9);
    expect(WREN).toBeLessThan(12);
  });

  it('Sable: strong up close but no longer 2.7× — and weak at range', () => {
    const near = ratio('sable', 18);
    expect(near).toBeGreaterThan(1.4);
    expect(near).toBeLessThan(2.0);
    expect(ratio('sable', 70)).toBeLessThan(0.7);
  });

  it('Marrow: the boomerang counts twice, now ~1.3×', () => {
    const r = ratio('marrow', 40);
    expect(r).toBeGreaterThan(1.1);
    expect(r).toBeLessThan(1.45);
  });

  it("Juniper: two fireflies ≈ Wren, a full jar ≈ 1.5×", () => {
    const two = juniperDps(2) / WREN;
    const six = juniperDps(6) / WREN;
    expect(two).toBeGreaterThan(0.9);
    expect(two).toBeLessThan(1.1);
    expect(six).toBeGreaterThan(1.4);
    expect(six).toBeLessThan(1.75);
  });

  it('Pip, Bolt, Mosswick and Drizzle stay near Wren', () => {
    for (const [id, lo, hi] of [
      ['pip', 0.85, 1.15],
      ['bolt', 0.85, 1.2],
      ['mosswick', 1.0, 1.5],
      ['drizzle', 0.9, 1.2],
    ] as const) {
      const r = ratio(id);
      expect(r, id).toBeGreaterThan(lo);
      expect(r, id).toBeLessThan(hi);
    }
  });

  it('Bolt starts with three red hearts and a Tin one, and hits a little harder (3.8)', () => {
    const bolt = CHARACTERS.get('bolt')!;
    expect(bolt.stats.damage).toBe(3.8);
    expect(bolt.hearts.redMax).toBe(6);
    expect(bolt.hearts.tin).toBe(2);
  });
});

describe('the melee swat', () => {
  it('knocks down at most one shot a swing, and only near the blade (the inner 70 % of its reach)', () => {
    const sim = makeSim('swat', { room: OPEN_ROOM, character: CHARACTERS.get('sable') });
    const w = sim.world;
    w.player.placeAt(60, 56);
    stepN(sim, makeInput(), 2);
    const reach = ATTACK_TUNING.meleeReach;
    // Five shots close in front of her, and one just past the swat reach (still inside the swing).
    for (let i = 0; i < 5; i++) spawnEnemyShot(w, 60 + 10, 50 + i * 3, 0, 0, 1, 2, 0, false, 0);
    const far = spawnEnemyShot(w, 60 + reach * 0.9, 56, 0, 0, 1, 2, 0, false, 0)!;
    expect(w.enemyShots.count).toBe(6);
    spawnSwipe(w, w.player.attack, null, 60, 56, 0, reach, 1, 0, 1, 0);
    stepN(sim, makeInput(), 3);
    // One swatted of the five close ones (ATTACK_TUNING.meleeSwatMax); the far one untouched.
    expect(w.enemyShots.count).toBe(6 - ATTACK_TUNING.meleeSwatMax);
    expect(ATTACK_TUNING.meleeSwatMax).toBe(1);
    expect(far.alive).toBe(true);
  });
});
