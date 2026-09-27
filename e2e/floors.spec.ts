import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 3A in real WebKit: New Run starts a floor run — floor card, the minimap (tap to expand),
 * walking through a door slides to the next room, the trapdoor drops to floor 2, every chapter's
 * look renders, curses render, and death ends the run back at the title.
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
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
}

test('New Run: floor 1 with its card; the minimap expands on a tap and closes on the next', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const s = (await page.evaluate(() => window.__SD.run()))!;
  expect(s.run!.floor).toBe(1);
  expect(s.run!.chapter).toBe('gutterways');
  expect((await page.evaluate(() => window.__SD.presentation()))!.card).toBe(true);
  // The minimap sits in its HUD slot, outside the room.
  const map = (await page.evaluate(() => window.__SD.button('run.map')))!;
  expect(map.y + map.h).toBeLessThanOrEqual(48);
  await tap(page, 'run.map');
  await waitScene(page, 'map');
  // The run is paused under the big map.
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__SD.run()))!.tick).toBe(t0);
  await tap(page, 'map.close');
  await waitScene(page, 'run');
  // Tab toggles it too.
  await page.keyboard.press('Tab');
  await waitScene(page, 'map');
  await page.keyboard.press('Tab');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});

test('walking into an open door slides the camera to the next room', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => window.__SD.debug.runAt(1, 'main', null, 1234));
  await page.evaluate(() => window.__SD.debug.god(true));
  const before = (await page.evaluate(() => window.__SD.run()))!.run!;
  const side = before.doors.findIndex((d) => d.kind !== 0 && d.state === 2);
  expect(side).toBeGreaterThanOrEqual(0);
  const to = before.doors[side]!.to;
  const key = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][side]!;
  await page.evaluate((side) => {
    window.__SD.sim!.world.player.placeAt([104, 190, 104, 18][side]!, [18, 56, 94, 56][side]!);
  }, side);
  await page.keyboard.down(key);
  await page.waitForFunction((to) => window.__SD.run()!.run!.room === to, to, { timeout: 5000 });
  await page.keyboard.up(key);
  expect((await page.evaluate(() => window.__SD.presentation()))!.slide).toBe(true);
  await page.waitForFunction(() => !window.__SD.presentation()!.slide);
  // The map knows two rooms now.
  expect((await page.evaluate(() => window.__SD.run()))!.run!.visited).toBe(2);
  expect(errors).toEqual([]);
});

test('the boss falls, the trapdoor opens, and floor 2 begins behind an iris', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => {
    window.__SD.debug.runAt(1, 'main', null, 55);
    window.__SD.debug.god(true);
    window.__SD.debug.teleport();
  });
  await page.waitForFunction(() => (window.__SD.run()?.enemies.length ?? 0) >= 1);
  await page.evaluate(() => window.__SD.debug.killEnemies());
  await page.waitForFunction(() => window.__SD.run()!.run!.trapdoor);
  await page.waitForTimeout(900);
  // Step onto the hatch.
  await page.evaluate(() => {
    const t = window.__SD.sim!.world.trapdoor;
    window.__SD.sim!.world.player.placeAt(t.x, t.y);
  });
  await page.waitForFunction(() => window.__SD.run()!.run!.floor === 2, undefined, { timeout: 5000 });
  expect((await page.evaluate(() => window.__SD.presentation()))!.iris).toBeGreaterThan(0);
  await page.waitForFunction(() => window.__SD.presentation()!.iris === 0);
  expect((await page.evaluate(() => window.__SD.presentation()))!.card).toBe(true);
  expect(errors).toEqual([]);
});

test('every chapter and every curse renders', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  for (const [floor, track] of [
    [1, 'main'], [1, 'alt'], [3, 'main'], [3, 'alt'], [5, 'main'], [5, 'alt'],
    [7, 'main'], [7, 'alt'], [9, 'main'], [9, 'alt'], [11, 'main'], [11, 'alt'],
  ] as const) {
    await page.evaluate(([f, t]) => window.__SD.debug.runAt(f, t, null, 3), [floor, track] as const);
    const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
    await page.waitForFunction((t) => window.__SD.run()!.tick > t + 5, t0);
    const s = (await page.evaluate(() => window.__SD.run()))!.run!;
    expect(s.floor).toBe(floor);
    expect(s.track).toBe(track);
  }
  for (const curse of ['darkness', 'lostMap', 'maze', 'blind', 'unknown', 'deluge'] as const) {
    await page.evaluate((c) => window.__SD.debug.runAt(2, 'main', c, 9), curse);
    const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
    await page.waitForFunction((t) => window.__SD.run()!.tick > t + 5, t0);
    expect((await page.evaluate(() => window.__SD.run()))!.run!.curse).toBe(curse);
  }
  // The darkness layer keeps the frame cheap.
  await page.evaluate(() => window.__SD.debug.runAt(1, 'main', 'darkness', 9));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__SD.perf.renderMs)).toBeLessThan(30);
  expect(errors).toEqual([]);
});

test('dying ends the run; a tap goes back to the title', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => window.__SD.debug.kill());
  await page.waitForFunction(() => window.__SD.presentation()?.ending === 'death', undefined, { timeout: 6000 });
  await page.waitForTimeout(900);
  await waitScene(page, 'over');
  await tap(page, 'over.title');
  await waitScene(page, 'title');
  expect(errors).toEqual([]);
});
