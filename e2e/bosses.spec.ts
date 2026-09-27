import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 3B in real WebKit: a boss fight (intro card, the HP bar in the HUD band, the death sequence in
 * slow motion, the trapdoor), a final boss ending the run with its ending card, and Magpie's Stall.
 */

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function waitScene(page: Page, name: string): Promise<void> {
  await page.waitForFunction((n) => window.__SD?.scene === n, name);
}

async function startRun(page: Page): Promise<void> {
  await page.goto('./');
  await waitScene(page, 'title');
  await page.evaluate(() => window.__SD.debug.newRun());
  await waitScene(page, 'run');
}

test('a boss fight: intro card, HP bar in the HUD band, slow-motion death, trapdoor', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    window.__SD.debug.runAt(1, 'main', null, 55);
    window.__SD.debug.god(true);
  });
  await page.waitForFunction(() => !window.__SD.presentation()!.card, undefined, { timeout: 6000 });
  await page.evaluate(() => window.__SD.debug.teleport());
  await page.waitForFunction(() => window.__SD.presentation()!.bossCard);
  const s = (await page.evaluate(() => window.__SD.run()))!;
  expect(s.boss).not.toBeNull();
  expect(s.boss!.phases).toBeGreaterThanOrEqual(2);
  // The bar lives in the top band, never over the room.
  const bar = (await page.evaluate(() => window.__SD.hud())).find((r) => r.id === 'bossBar');
  expect(bar).toBeDefined();
  expect(bar!.y + bar!.h).toBeLessThanOrEqual(48);
  // Knock it down through every phase; the last blow starts the death sequence.
  await page.waitForFunction(() => !window.__SD.presentation()!.bossCard, undefined, { timeout: 6000 });
  for (let i = 0; i < 8; i++) {
    const dying = await page.evaluate(() => {
      const w = window.__SD.sim!.world;
      for (let k = 0; k < w.enemies.count; k++) {
        const e = w.enemies.items[k]!;
        if (e.boss && !e.dead) e.hurt(99999, 0, 0, 0);
      }
      return w.boss.dying || w.boss.done;
    });
    if (dying) break;
    await page.waitForTimeout(1300);
  }
  await page.waitForFunction(() => window.__SD.presentation()!.slowmo || window.__SD.sim!.world.boss.done, undefined, { timeout: 5000 });
  await page.waitForFunction(() => window.__SD.run()!.run!.trapdoor, undefined, { timeout: 10000 });
  expect((await page.evaluate(() => window.__SD.run()))!.boss).toBeNull();
  expect(errors).toEqual([]);
});

test('a final boss ends the run with its ending card', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    window.__SD.debug.runAt(12, 'alt', null, 4);
    window.__SD.debug.god(true);
    window.__SD.debug.teleport();
  });
  await page.waitForFunction(() => window.__SD.run()!.boss?.id === 'nestmother');
  await page.evaluate(() => window.__SD.debug.killEnemies());
  await page.waitForFunction(() => window.__SD.presentation()?.ending === 'win', undefined, { timeout: 6000 });
  const p = (await page.evaluate(() => window.__SD.presentation()))!;
  expect(p.endingId).toBe(2);
  expect((await page.evaluate(() => window.__SD.run()))!.run!.ending).toBe(2);
  expect(errors).toEqual([]);
});

test("Magpie's Stall: walking onto an item with enough coins buys it", async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  let found = false;
  for (const seed of [3, 5, 8, 13, 21]) {
    await page.evaluate((s) => {
      window.__SD.debug.runAt(1, 'main', null, s);
      window.__SD.debug.god(true);
    }, seed);
    const shop = await page.evaluate(() => window.__SD.sim!.run!.data.layout.rooms.findIndex((r) => r.type === 'shop'));
    if (shop < 0) continue;
    await page.evaluate((i) => window.__SD.debug.teleport(i), shop);
    const ped = await page.evaluate(() => window.__SD.run()!.pedestals.find((p) => p.item && p.price > 0) ?? null);
    if (!ped) continue;
    await page.evaluate(([price]) => void (window.__SD.sim!.world.player.inv.coins = price! + 2), [ped.price]);
    await page.evaluate(([x, y]) => window.__SD.sim!.world.player.placeAt(x!, y! + 12), [ped.x, ped.y]);
    await page.waitForFunction((item) => !window.__SD.run()!.pedestals.some((p) => p.item === item), ped.item, { timeout: 4000 });
    expect((await page.evaluate(() => window.__SD.run()))!.inv.coins).toBe(2);
    found = true;
    break;
  }
  expect(found).toBe(true);
  expect(errors).toEqual([]);
});
