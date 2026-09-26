import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2 part A in real WebKit: item pedestals + banner, the bomb button, the active item button,
 * and the HUD staying out of the room.
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

async function tap(page: Page, id: string): Promise<void> {
  const b = await page.evaluate((i) => window.__SD.button(i), id);
  expect(b, `button ${id}`).not.toBeNull();
  await page.touchscreen.tap(b!.css.cx, b!.css.cy);
}

async function startRun(page: Page): Promise<void> {
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'run');
}

/** Room interior in game px (walls excluded): x 88..296, y 64..176. */
const INTERIOR = { x: 88, y: 64, w: 208, h: 112 };

function overlaps(a: { x: number; y: number; w: number; h: number }, b: typeof a): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

test('walking into a pedestal takes the item: stats, banner, HUD outside the room', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const before = (await page.evaluate(() => window.__SD.run()))!;
  const ped = before.pedestals[0]!;
  expect(ped.item).not.toBe('');
  // Stand just left of the first pedestal and walk right into it.
  await page.evaluate(([x, y]) => window.__SD.sim!.world.player.placeAt(x! - 14, y!), [ped.x, ped.y]);
  await page.keyboard.down('KeyD');
  await page.waitForFunction(() => (window.__SD.run()?.inv.passives.length ?? 0) >= 1);
  await page.keyboard.up('KeyD');
  const after = (await page.evaluate(() => window.__SD.run()))!;
  expect(after.inv.passives).toEqual([ped.item]);
  expect(after.pedestals[0]!.item).toBe('');
  expect(after.counters.items).toBe(1);

  const hud = await page.evaluate(() => window.__SD.hud());
  const ids = hud.map((r) => r.id);
  expect(ids).toEqual(expect.arrayContaining(['hearts', 'counters', 'banner']));
  for (const r of hud) {
    expect(r.x, r.id).toBeGreaterThanOrEqual(0);
    expect(r.y, r.id).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w, r.id).toBeLessThanOrEqual(384);
    expect(r.y + r.h, r.id).toBeLessThanOrEqual(192);
    expect(overlaps(r, INTERIOR), `${r.id} must not cover the room`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test('bomb button places a bomb that explodes; active button uses a charged item', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  // Somewhere open, away from everything.
  await page.evaluate(() => window.__SD.sim!.world.player.placeAt(40, 40));
  const a = (await page.evaluate(() => window.__SD.run()))!;
  expect(a.inv.bombs).toBe(1);
  await tap(page, 'run.bomb');
  await page.waitForFunction(() => window.__SD.run()!.bombs === 1);
  expect((await page.evaluate(() => window.__SD.run()))!.inv.bombs).toBe(0);
  // Step away from the blast, then wait for the boom.
  await page.evaluate(() => window.__SD.sim!.world.player.placeAt(150, 100));
  await page.waitForFunction(() => window.__SD.run()!.counters.explosions >= 1, undefined, { timeout: 5000 });
  const b = (await page.evaluate(() => window.__SD.run()))!;
  expect(b.bombs).toBe(0);
  expect(b.player.red).toBe(6);

  // No active item yet: the button just refuses (let the sim consume the press). Then give one and use it.
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await tap(page, 'run.active');
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 3, t0);
  await page.evaluate(() => window.__SD.debug.give('jar-of-lightning'));
  const c = (await page.evaluate(() => window.__SD.run()))!;
  expect(c.inv.active).toEqual({ id: 'jar-of-lightning', charge: 2, max: 2 });
  await tap(page, 'run.active');
  await page.waitForFunction(() => window.__SD.run()!.inv.active?.charge === 0);
  const hud = await page.evaluate(() => window.__SD.hud());
  expect(hud.map((r) => r.id)).toContain('charge');
  await page.evaluate(() => window.__SD.debug.roomClear());
  expect((await page.evaluate(() => window.__SD.run()))!.inv.active?.charge).toBe(1);
  expect(errors).toEqual([]);
});
