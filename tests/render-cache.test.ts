/**
 * Polish batch 2 (B2-7): shot sprites are cached per LOOK (style.key), not per ShotStyle object — composeStyle builds
 * a fresh object on every recompute (a Ratchet Wrench kill, a Stray Cat's Bell…), and the same look must never be
 * rasterised twice.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHOT_RASTER_STATS, shotLookCount, shotSprite } from '../src/render/attackRenderer';
import { recomputePlayer } from '../src/sim/effects';
import { installFakeCanvas } from './helpers/fakeCanvas';
import { makeSim } from './helpers/sim';

describe('shot sprite cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('two ShotStyle objects with the same key rasterise once', () => {
    installFakeCanvas();
    const sim = makeSim('render-cache');
    sim.giveItem('rubber-ball');
    sim.giveItem('toadstool-cap');
    const a = sim.world.player.attack.style;
    // A recompute (any timed trigger does one) composes a brand-new style object with the same look.
    recomputePlayer(sim.world);
    const b = sim.world.player.attack.style;
    expect(b).not.toBe(a);
    expect(b.key).toBe(a.key);
    const before = SHOT_RASTER_STATS.sprites;
    const s1 = shotSprite(a, 0, 3, 0);
    expect(SHOT_RASTER_STATS.sprites).toBe(before + 1);
    const s2 = shotSprite(b, 0, 3, 0);
    expect(s2).toBe(s1);
    expect(SHOT_RASTER_STATS.sprites).toBe(before + 1);
    // A different look is a different sprite.
    sim.giveItem('firecracker-pouch');
    const c = sim.world.player.attack.style;
    expect(c.key).not.toBe(a.key);
    shotSprite(c, 0, 3, 0);
    expect(SHOT_RASTER_STATS.sprites).toBe(before + 2);
  });

  it('keeps only a handful of looks (a small LRU)', () => {
    installFakeCanvas();
    const sim = makeSim('render-cache-lru');
    const first = sim.world.player.attack.style;
    shotSprite(first, 0, 2, 0);
    const n0 = SHOT_RASTER_STATS.sprites;
    const keys = new Set<string>([first.key]);
    // Ten other looks push the first one out of the LRU…
    for (const id of ['rubber-ball', 'toadstool-cap', 'firecracker-pouch', 'geode', 'lantern-moth', 'tiny-moon', 'rooftop-rod', 'twin-straws', 'crab-claws', 'party-popper']) {
      sim.giveItem(id);
      const st = sim.world.player.attack.style;
      keys.add(st.key);
      shotSprite(st, 0, 2, 0);
    }
    expect(keys.size).toBeGreaterThan(8);
    expect(shotLookCount()).toBeLessThanOrEqual(8);
    const n1 = SHOT_RASTER_STATS.sprites;
    expect(n1 - n0).toBeLessThanOrEqual(keys.size - 1);
    // …but the object that still holds it keeps its sprites (no re-raster for it).
    shotSprite(first, 0, 2, 0);
    expect(SHOT_RASTER_STATS.sprites).toBe(n1);
  });
});
