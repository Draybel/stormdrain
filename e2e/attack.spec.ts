import { expect, test, type Page } from '@playwright/test';

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
  await page.waitForFunction(() => window.__SD?.scene === 'run');
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
