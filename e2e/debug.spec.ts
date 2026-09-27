import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 2D in real WebKit: the hidden debug menu (5 taps on the PAUSED title, or Backquote), its
 * scrollable item list (drag to scroll, tap to spawn a pedestal), cheats, and the training-yard bell.
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
  // Phase 2 features live in the training yard (New Run starts a real floor run since Phase 3A).
  await page.evaluate(() => window.__SD.debug.yard());
  await page.waitForFunction(() => window.__SD.sim?.trainingRoom === true);
}

/** Touch pointer events on the canvas at game-pixel positions (a drag gesture). */
async function drag(page: Page, gx: number, gy0: number, gy1: number, steps: number): Promise<void> {
  await page.evaluate(
    ([gx, gy0, gy1, steps]) => {
      const canvas = document.getElementById('screen')!;
      const v = window.__SD.view;
      const fire = (type: string, gy: number): void => {
        canvas.dispatchEvent(
          new PointerEvent(type, {
            pointerId: 7,
            pointerType: 'touch',
            bubbles: true,
            cancelable: true,
            clientX: v.x + gx * v.scale,
            clientY: v.y + gy * v.scale,
          }),
        );
      };
      fire('pointerdown', gy0);
      for (let i = 1; i <= steps; i++) fire('pointermove', gy0 + ((gy1 - gy0) * i) / steps);
      fire('pointerup', gy1);
    },
    [gx, gy0, gy1, steps] as const,
  );
}

test('5 taps on the PAUSED title open the debug menu; tapping an item spawns it on a pedestal', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  for (let i = 0; i < 5; i++) await tap(page, 'pause.title');
  await waitScene(page, 'debug');

  // The first row of the item list is the Storm Lance (attack types come first).
  const list = (await page.evaluate(() => window.__SD.button('debug.list')))!;
  const lances = (): Promise<number> => page.evaluate(() => window.__SD.run()!.pedestals.filter((p) => p.item === 'storm-lance').length);
  const before = await lances();
  await page.touchscreen.tap(list.css.x + 20, list.css.y + 12);
  await page.waitForFunction((n) => window.__SD.run()!.pedestals.filter((p) => p.item === 'storm-lance').length > n, before);
  const peds = (await page.evaluate(() => window.__SD.run()))!.pedestals;
  // Next to Wren.
  const p = (await page.evaluate(() => window.__SD.run()))!.player;
  expect(peds.some((d) => d.item === 'storm-lance' && Math.hypot(d.x - p.x, d.y - p.y) < 60)).toBe(true);

  // Dragging the list scrolls instead of tapping (no second pedestal).
  const n = peds.filter((p) => p.item !== '').length;
  await drag(page, list.x + 40, list.y + list.h - 10, list.y + 10, 8);
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__SD.run()))!.pedestals.filter((p) => p.item !== '').length).toBe(n);

  // Cheats: god mode on.
  await tap(page, 'debug.tab.cheats');
  await tap(page, 'debug.cheat.0');
  expect(await page.evaluate(() => window.__SD.sim!.world.godMode)).toBe(true);

  // Close → back to the pause menu → resume.
  await tap(page, 'debug.close');
  await waitScene(page, 'pause');
  await tap(page, 'pause.resume');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});

test('Backquote toggles the debug menu; __SD.debug drives the same actions', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.keyboard.press('Backquote');
  await waitScene(page, 'debug');
  await page.keyboard.press('Backquote');
  await waitScene(page, 'run');
  await page.evaluate(() => {
    const d = window.__SD.debug;
    d.add(10, 10, 10);
    d.spawnItem('geode');
    d.spawnEnemy('scurrier', false);
  });
  const s = (await page.evaluate(() => window.__SD.run()))!;
  expect(s.inv.coins).toBe(10);
  expect(s.inv.keys).toBe(10);
  expect(s.pedestals.some((p) => p.item === 'geode')).toBe(true);
  expect(s.enemies.length).toBe(1);
  await page.evaluate(() => window.__SD.debug.clearRoom());
  expect((await page.evaluate(() => window.__SD.run()))!.enemies.length).toBe(0);
  expect(await page.evaluate(() => window.__SD.debug.menu(true))).toBe(true);
  expect(await page.evaluate(() => window.__SD.debug.menu(false))).toBe(false);
  expect(errors).toEqual([]);
});

test('walking into the yard bell calls a wave', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const bell = (await page.evaluate(() => window.__SD.run()))!.pedestals.find((p) => p.bell)!;
  expect(bell).toBeDefined();
  await page.evaluate(([x, y]) => {
    window.__SD.debug.god(true);
    window.__SD.sim!.world.player.placeAt(x! + 16, y!);
  }, [bell.x, bell.y]);
  await page.keyboard.down('KeyA');
  await page.waitForFunction(() => window.__SD.run()!.arena.active, undefined, { timeout: 5000 });
  await page.keyboard.up('KeyA');
  expect((await page.evaluate(() => window.__SD.run()))!.enemies.length).toBeGreaterThanOrEqual(4);
  expect(errors).toEqual([]);
});
