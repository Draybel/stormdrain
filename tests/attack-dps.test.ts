/**
 * Polish batch 2 (B2-2): synergies never make the aimed attack weaker. Against a pinned, boss-sized, static target
 * at 30 / 70 / 110 px and 20 s of perfect play (tests/helpers/dps.ts), adding any single carrier rider, the orbit
 * rider / Tiny Moon, or the Crown of Storms / Thunder Furrow synergies to the Storm Lance, Neon Tube, marble or Broken
 * Oar primaries keeps at least 90 % of the primary's aimed DPS (80 % for the pure-motion ones). Plus: the charge
 * rider pays off (Wren + Coiled Spring ≥ Wren, Bolt within 10 % of Wren), a homing lance keeps its path from tick to
 * tick, and the Lasso Laser never drags a spitter onto Wren.
 */

import { describe, expect, it } from 'vitest';
import { findSynergy } from '../src/content/registry';
import { BK_LANCE } from '../src/sim/attack/beam';
import type { Sim } from '../src/sim/sim';
import { carrierItem } from './helpers/attack';
import { aimedDps } from './helpers/dps';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const DISTS = [30, 70, 110] as const;

interface Add {
  name: string;
  items: string[];
  /** Pure motion (it reshapes the path): 80 % instead of 90 %. */
  motion?: boolean;
}

/** What may join each primary without replacing it (lower-precedence carriers, the rider-only ones, orbits). */
function addsFor(primary: string): Add[] {
  const marble = carrierItem('marble');
  const all: Record<string, Add> = {
    laser: { name: 'Neon Tube (laser rider)', items: ['neon-tube'] },
    boomerang: { name: 'Rusty Boomerang (boomerang rider)', items: ['rusty-boomerang'], motion: true },
    melee: { name: 'Broken Oar (melee rider)', items: ['broken-oar'] },
    marble: { name: 'a marble rider', items: [marble] },
    bomb: { name: 'Firecracker Pouch (bomb rider)', items: ['firecracker-pouch'] },
    charge: { name: 'Coiled Spring (charge rider)', items: ['coiled-spring'] },
    orbit: { name: 'Tin Pinwheel (orbit rider)', items: ['tin-pinwheel'] },
    tinyMoon: { name: 'Tiny Moon', items: ['tiny-moon'], motion: true },
    tinyMoon2: { name: 'two Tiny Moons', items: ['tiny-moon', 'tiny-moon'], motion: true },
  };
  const order = ['lance', 'laser', 'boomerang', 'melee', 'marble'];
  const rank = order.indexOf(primary);
  return Object.entries(all)
    .filter(([id]) => !order.includes(id) || order.indexOf(id) > rank)
    .map(([, a]) => a);
}

const PRIMARIES: Record<string, string[]> = {
  lance: ['storm-lance'],
  laser: ['neon-tube'],
  marble: [],
  melee: ['broken-oar'],
};

describe('aimed DPS: synergies never weaken the aimed attack', () => {
  for (const [primary, items] of Object.entries(PRIMARIES)) {
    it(`${primary} primary keeps ≥ 90 % (80 % pure motion) with every rider and orbit`, () => {
      const worst: string[] = [];
      for (const d of DISTS) {
        const base = aimedDps({ dist: d, items });
        // Out of the primary's reach (a swipe at 110 px): nothing to keep.
        if (base < 1) continue;
        for (const add of addsFor(primary)) {
          const v = aimedDps({ dist: d, items: [...items, ...add.items] });
          const need = add.motion ? 0.8 : 0.9;
          if (v < base * need) worst.push(`${add.name} @${d}px: ${((v / base) * 100).toFixed(0)} % (${v.toFixed(1)} vs ${base.toFixed(1)})`);
        }
      }
      expect(worst).toEqual([]);
    });
  }

  it('Crown of Storms and Thunder Furrow add to the Storm Lance', () => {
    expect(findSynergy('crown-of-storms')).toBeTruthy();
    expect(findSynergy('thunder-furrow')).toBeTruthy();
    for (const d of DISTS) {
      const base = aimedDps({ dist: d, items: ['storm-lance'] });
      // Tin Pinwheel + the lance = Crown of Storms; Firecracker Pouch + the lance = Thunder Furrow.
      const crown = aimedDps({ dist: d, items: ['storm-lance', 'tin-pinwheel'] });
      const furrow = aimedDps({ dist: d, items: ['storm-lance', 'firecracker-pouch'] });
      expect(crown).toBeGreaterThanOrEqual(base * 0.9);
      expect(furrow).toBeGreaterThanOrEqual(base * 0.9);
    }
  });

  it('the charge rider pays off: Wren + Coiled Spring ≥ Wren, and Bolt is within 10 % of Wren', () => {
    for (const d of [30, 70]) {
      const wren = aimedDps({ dist: d, items: [], seconds: 30 });
      const spring = aimedDps({ dist: d, items: ['coiled-spring'], seconds: 30 });
      const bolt = aimedDps({ dist: d, items: [], character: 'bolt', seconds: 30 });
      expect(spring).toBeGreaterThanOrEqual(wren);
      expect(Math.abs(bolt - wren) / wren).toBeLessThanOrEqual(0.1);
    }
  });
});

describe('Tiny Moon on the Storm Lance', () => {
  it('the aimed lance stays on the aim at full damage; the crown copies turn a full circle', () => {
    const sim = makeSim('dps-moon', { room: OPEN_ROOM });
    sim.world.godMode = true;
    sim.world.player.placeAt(40, 56);
    sim.giveItem('storm-lance');
    sim.giveItem('tiny-moon');
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    const p = sim.world.player;
    for (let t = 0; t < 150 && p.atk.charge < 1; t++) stepN(sim, input, 1);
    input.fireHeld = false;
    stepN(sim, input, 1);
    const beams = sim.world.atk.beams;
    const lances = beams.items.slice(0, beams.count).filter((b) => b.kind === BK_LANCE);
    expect(lances.length).toBe(2);
    const aimed = lances.find((b) => !b.ring)!;
    const ring = lances.find((b) => b.ring)!;
    expect(aimed).toBeTruthy();
    expect(ring.dmg).toBeCloseTo(aimed.dmg * 0.6, 6);
    const start = ring.dir;
    let turned = 0;
    let last = ring.dir;
    while (beams.count > 0 && ring.alive) {
      expect(Math.abs(aimed.dir)).toBeLessThan(1e-9);
      stepN(sim, input, 1);
      if (!ring.alive) break;
      turned += Math.abs(ring.dir - last);
      last = ring.dir;
    }
    expect(turned).toBeGreaterThanOrEqual(Math.PI * 2 * 0.95);
    void start;
  });
});

/** End-point movement (px) of the main lance per tick over `seconds` of releases, with 2 Lantern Moths. */
function homingJumps(layout: readonly (readonly [string, number, number])[], seed: string, seconds = 20): number[] {
  const sim: Sim = makeSim(seed, { room: OPEN_ROOM });
  const w = sim.world;
  w.godMode = true;
  w.player.placeAt(24, 56);
  for (const id of ['storm-lance', 'lantern-moth', 'lantern-moth']) sim.giveItem(id);
  for (const [id, x, y] of layout) {
    const e = sim.spawnEnemy(id, x, y, { champion: false })!;
    e.spawnT = 0;
    e.hp = e.maxHp = 1e6;
  }
  const input = makeInput({ aimX: 1, aimY: 0 });
  const p = w.player;
  const out: number[] = [];
  for (let k = 0; k < 60 * seconds; k++) {
    input.fireHeld = !(p.atk.charging && p.atk.charge >= 1);
    const b = w.atk.beams.count > 0 ? w.atk.beams.items[0]! : null;
    const bx = b ? b.endX : 0;
    const by = b ? b.endY : 0;
    const age = b ? b.age : 0;
    stepN(sim, input, 1);
    p.placeAt(24, 56);
    const b2 = w.atk.beams.count > 0 ? w.atk.beams.items[0]! : null;
    if (b && b2 === b && b2.age > age) out.push(Math.hypot(b2.endX - bx, b2.endY - by));
  }
  return out;
}

describe('homing lance', () => {
  it('two (or four) targets that tie never make the end point jump more than 20 px a tick', () => {
    const layouts = [
      [
        ['grate-gazer', 100, 30],
        ['grate-gazer', 100, 82],
      ],
      [
        ['grate-gazer', 90, 30],
        ['grate-gazer', 90, 82],
        ['grate-gazer', 150, 20],
        ['grate-gazer', 150, 92],
      ],
    ] as const;
    for (const l of layouts) {
      const jumps = homingJumps(l, 'dps-tie');
      expect(jumps.length).toBeGreaterThan(200);
      expect(Math.max(...jumps)).toBeLessThanOrEqual(20);
    }
  });

  it('in a moving crowd it keeps its path almost every tick (no looping round the room)', () => {
    const crowd = [
      ['scurrier', 100, 30],
      ['scurrier', 100, 82],
      ['sogwing', 150, 56],
      ['drizzle-blob', 130, 40],
      ['mudleech', 170, 90],
    ] as const;
    for (const seed of ['dps-crowd-a', 'dps-crowd-b']) {
      const jumps = homingJumps(crowd, seed);
      const big = jumps.filter((d) => d > 20).length;
      expect(big / jumps.length).toBeLessThan(0.04);
    }
  });
});

describe('Lasso Laser', () => {
  it('keeps 3 Spitshells at least 30 px away over 10 s', () => {
    const sim = makeSim('dps-lasso', { room: OPEN_ROOM });
    const w = sim.world;
    w.godMode = true;
    w.player.placeAt(24, 56);
    sim.giveItem('neon-tube');
    sim.giveItem('rusty-boomerang');
    const foes = [70, 100, 130].map((x, i) => {
      const e = sim.spawnEnemy('spitshell', x, 50 + i * 6, { champion: false })!;
      e.spawnT = 0;
      e.hp = e.maxHp = 1e6;
      return e;
    });
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    let closest = Infinity;
    const far0 = foes[2]!.x;
    for (let t = 0; t < 600; t++) {
      stepN(sim, input, 1);
      w.player.placeAt(24, 56);
      for (const e of foes) closest = Math.min(closest, Math.hypot(e.x - w.player.x, e.y - w.player.y));
    }
    // The far one was pulled in (the lasso works)…
    expect(foes[2]!.x).toBeLessThan(far0 - 15);
    // …but never onto her.
    expect(closest).toBeGreaterThanOrEqual(30);
  });
});
