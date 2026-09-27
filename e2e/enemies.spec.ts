import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2 part C in real WebKit: the training-yard arena. F (and the bell button) call a wave of
 * chapter 1 enemies, the doors shut, clearing the wave opens them again and counts a room clear.
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
  const b = await page.evaluate(() => window.__SD.button('title.newRun'));
  await page.touchscreen.tap(b!.css.cx, b!.css.cy);
  await waitScene(page, 'run');
}

/** Room interior in game px (walls excluded). */
const INTERIOR = { x: 88, y: 64, w: 208, h: 112 };

test('F calls a wave: doors shut, enemies fight, clearing opens the doors and counts a room clear', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => window.__SD.debug.god(true));
  const fight = await page.evaluate(() => window.__SD.button('run.fight'));
  expect(fight, 'bell button').not.toBeNull();
  expect(fight!.enabled).toBe(true);
  // The bell lives in the side margin, never over the room.
  const r = fight!;
  expect(r.x + r.w <= INTERIOR.x || r.x >= INTERIOR.x + INTERIOR.w || r.y + r.h <= INTERIOR.y).toBe(true);

  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => (window.__SD.run()?.enemies.length ?? 0) >= 4);
  await page.waitForFunction(() => window.__SD.run()!.arena.doors === 1);
  const during = (await page.evaluate(() => window.__SD.run()))!;
  expect(during.arena.active).toBe(true);
  expect(await page.evaluate(() => window.__SD.buttons().some((b) => b.id === 'run.fight'))).toBe(false);

  // Let them move and attack for a while (god mode): shots fly, nothing breaks.
  await page.waitForFunction(() => window.__SD.run()!.counters.enemyShots > 0 || window.__SD.run()!.tick > 400, undefined, { timeout: 15000 });
  const cleared = during.counters.roomsCleared;
  await page.evaluate(() => window.__SD.debug.killEnemies());
  await page.waitForFunction((c) => window.__SD.run()!.counters.roomsCleared === c + 1, cleared);
  await page.waitForFunction(() => window.__SD.run()!.arena.doors === 0);
  const after = (await page.evaluate(() => window.__SD.run()))!;
  expect(after.arena.active).toBe(false);
  expect(after.enemies.length).toBe(0);
  expect(after.counters.kills).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});

test('the bell button calls the next wave with a tap', async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone15-homescreen', 'touch profile only');
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => window.__SD.debug.god(true));
  const b = (await page.evaluate(() => window.__SD.button('run.fight')))!;
  expect(b.css.h).toBeGreaterThanOrEqual(40);
  await page.touchscreen.tap(b.css.cx, b.css.cy);
  await page.waitForFunction(() => window.__SD.run()!.arena.active);
  expect((await page.evaluate(() => window.__SD.run()))!.arena.wave).toBe(1);
  // Hit-stop never freezes the game for good: ticks keep coming while enemies die.
  await page.evaluate(() => window.__SD.debug.killEnemies());
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 30, t0);
  expect(errors).toEqual([]);
});
