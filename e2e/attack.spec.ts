import { expect, test, type Page } from '@playwright/test';
import { PERF_SLACK } from '../tests/helpers/perf';

/**
 * Phase 2 part B in real WebKit: the attack pipeline. The Storm Lance charges while the shoot key is
 * held and fires its beam on release; stacked modifiers, riders and familiars render without errors.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function startRun(page: Page): Promise<void> {
  await page.goto('./');
  await page.waitForFunction(() => window.__SD?.scene === 'title');
  const b = await page.evaluate(() => window.__SD.button('title.newRun'));
  await page.touchscreen.tap(b!.css.cx, b!.css.cy);
  // Character select (Phase 4B): START with the default character.
  await page.waitForFunction(() => window.__SD?.scene === 'chars');
  const s = await page.evaluate(() => window.__SD.button('chars.start'));
  await page.touchscreen.tap(s!.css.cx, s!.css.cy);
  await page.waitForFunction(() => window.__SD?.scene === 'run');
  // Phase 2 features live in the training yard (New Run starts a real floor run since Phase 3A).
  await page.evaluate(() => window.__SD.debug.yard());
  await page.waitForFunction(() => window.__SD.sim?.trainingRoom === true);
}

test('Storm Lance: hold to charge, release to fire a beam to the far wall', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    window.__SD.debug.god(true);
    window.__SD.debug.give('storm-lance');
    window.__SD.sim!.world.player.placeAt(40, 40);
  });
  expect((await page.evaluate(() => window.__SD.run()))!.attack.primary).toBe('lance');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__SD.run()!.attack.charge >= 1, undefined, { timeout: 5000 });
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__SD.counts.beams > 0);
  const beam = await page.evaluate(() => {
    const b = window.__SD.sim!.world.atk.beams.items[0]!;
    return { endWall: b.endWall, endX: b.endX, width: b.width };
  });
  expect(beam.endWall).toBe(true);
  expect(beam.endX).toBeGreaterThan(200);
  expect(beam.width).toBeGreaterThanOrEqual(10);
  // ~0.5 s later the beam is gone.
  await page.waitForFunction(() => window.__SD.counts.beams === 0, undefined, { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('stacked modifiers, riders and familiars fire and render without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    const d = window.__SD.debug;
    d.god(true);
    for (const id of ['lantern-moth', 'geode', 'rooftop-rod', 'party-popper', 'toadstool-cap', 'twin-straws', 'tin-pinwheel', 'lamplet', 'bottlecap-beetle', 'broken-oar']) d.give(id);
    window.__SD.sim!.world.player.placeAt(40, 40);
  });
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => (window.__SD.run()?.enemies.length ?? 0) >= 4);
  // Familiars join on the next tick after their items are picked up.
  await page.waitForFunction(() => window.__SD.run()!.attack.familiars.length === 2);
  const a = (await page.evaluate(() => window.__SD.run()))!.attack;
  expect(a.primary).toBe('melee');
  expect(a.riders).toContain('orbit');
  expect(a.familiars).toEqual(expect.arrayContaining(['lamplet', 'bottlecap-beetle']));
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__SD.run()!.counters.hits > 5, undefined, { timeout: 10000 });
  await page.keyboard.up('ArrowRight');
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 60, t0);
  expect(errors).toEqual([]);
});

test('an absurd build (every item ×3) keeps rendering while its lances fill the room', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    const d = window.__SD.debug;
    d.god(true);
    for (const id of d.items()) for (let k = 0; k < 3; k++) d.give(id);
    const w = window.__SD.sim!.world;
    w.pedestals.clear();
    w.pickups.clear();
    w.player.placeAt(104, 56);
    d.wave(8);
  });
  expect((await page.evaluate(() => window.__SD.run()))!.attack.primary).toBe('lance');
  // Polish batch 2 (B2-6): judged on RAW frames — the p95 of the update + render cost of every frame while the lances
  // are out, and the worst rAF-to-rAF gap — not on the smoothed average (which read ~11 ms over 25-50 ms spikes).
  const costs: number[] = [];
  const gaps: number[] = [];
  const heavy: number[] = [];
  for (let k = 0; k < 2; k++) {
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(() => window.__SD.run()!.attack.charge >= 1, undefined, { timeout: 8000 });
    const f0 = await page.evaluate(() => window.__SD.perf.frame);
    await page.keyboard.up('ArrowRight');
    await page.waitForFunction(() => window.__SD.counts.beams >= 12);
    const f1 = await page.evaluate(() => window.__SD.perf.frame);
    await page.waitForFunction(() => window.__SD.counts.beams === 0, undefined, { timeout: 8000 });
    const s = await page.evaluate((f) => window.__SD.perfFrames(f), f0);
    costs.push(...s.costs);
    gaps.push(...s.gaps.slice(1));
    // The beam-heavy stretch (from the first frame with 12+ lances out).
    heavy.push(...s.costs.slice(Math.max(0, f1 - f0 - 1)));
  }
  const sorted = [...costs].sort((a, b) => a - b);
  const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
  const hs = [...heavy].sort((a, b) => a - b);
  const median = hs[hs.length >> 1]!;
  const maxGap = Math.max(...gaps);
  console.log(`absurd build: ${costs.length} frames, p95 ${p95.toFixed(1)} ms, heavy median ${median.toFixed(1)} ms, max gap ${maxGap.toFixed(0)} ms`);
  // (Stroking every beam trace step on its own used to cost ~80 ms a frame here; one fill per lance per pass ~20-30.)
  expect(p95).toBeLessThan(45 * PERF_SLACK);
  expect(maxGap).toBeLessThan(120 * PERF_SLACK);
  expect(errors).toEqual([]);
});

test('the Storm Lance flash never hides an enemy shot', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    window.__SD.debug.god(true);
    window.__SD.debug.give('storm-lance');
    window.__SD.sim!.world.player.placeAt(40, 56);
  });
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.__SD.run()!.attack.charge >= 1, undefined, { timeout: 5000 });
  // A still enemy shot well off the beam's line (a muck orb, radius 3).
  expect(await page.evaluate(() => window.__SD.debug.enemyShot(120, 20, 0, 0, 0, 3))).toBe(true);
  /** The display canvas pixel at the shot's centre and 2 px left of it (its body), for the next `frames` frames. */
  const sample = (frames: number) =>
    page.evaluate(async (n) => {
      const v = window.__SD.view;
      const c = document.getElementById('screen') as HTMLCanvasElement;
      const g = c.getContext('2d')!;
      const rect = c.getBoundingClientRect();
      const k = c.width / rect.width;
      // Room px → game px (ROOM_X 88, ROOM_Y 64, shots fly 5 px up) → canvas px.
      const at = (gx: number, gy: number) => {
        // The room is drawn shifted by this frame's screen shake.
        gx += window.__SD.shake.x;
        gy += window.__SD.shake.y;
        const x = Math.floor((v.x + (gx + 0.5) * v.scale) * k);
        const y = Math.floor((v.y + (gy + 0.5) * v.scale) * k);
        const d = g.getImageData(x, y, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const out: number[][][] = [];
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        out.push([at(88 + 120, 64 + 20 - 5), at(88 + 118, 64 + 20 - 5)]);
      }
      return out;
    }, frames);
  const before = (await sample(3))[2]!;
  const luma = (p: number[]) => 0.299 * p[0]! + 0.587 * p[1]! + 0.114 * p[2]!;
  // The shot's dark core really is there (a foe's shot).
  expect(luma(before[0]!)).toBeLessThan(60);
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.__SD.counts.beams > 0);
  const after = await sample(8);
  for (const [core, body] of after) {
    // The flash is drawn under enemy shots: the core stays dark and the body keeps its colour.
    expect(luma(core!)).toBeLessThan(60);
    const dist = Math.hypot(body![0]! - before[1]![0]!, body![1]! - before[1]![1]!, body![2]! - before[1]![2]!);
    expect(dist).toBeLessThan(40);
  }
  expect(errors).toEqual([]);
});
