import { expect, test, type Page } from '@playwright/test';
import type { ButtonInfo } from '../src/debug/sdHooks';

/** Collects console errors and uncaught page errors for the whole test. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function scene(page: Page): Promise<string> {
  return page.evaluate(() => window.__SD.scene);
}

async function waitScene(page: Page, name: string): Promise<void> {
  await page.waitForFunction((n) => window.__SD?.scene === n, name);
}

async function button(page: Page, id: string): Promise<ButtonInfo> {
  const b = await page.evaluate((i) => window.__SD.button(i), id);
  expect(b, `button ${id} should be registered`).not.toBeNull();
  return b!;
}

/** Real touch tap at the centre of an on-screen button (game rect → CSS px via __SD). */
async function tap(page: Page, id: string): Promise<void> {
  const b = await button(page, id);
  await page.touchscreen.tap(b.css.cx, b.css.cy);
}

test('boots to the title, taps into a run, pauses and resumes — no errors', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await expect(page.locator('canvas#screen')).toBeVisible();
  expect(await page.title()).toBe('Stormdrain');

  // The game image must lie inside the viewport (and inside the safe area).
  const geo = await page.evaluate(() => ({
    view: window.__SD.view,
    safe: window.__SD.safe,
    iw: window.innerWidth,
    ih: window.innerHeight,
  }));
  const { view, safe, iw, ih } = geo;
  expect(view.w).toBeGreaterThan(100);
  expect(view.h).toBeCloseTo(view.w / 2, 0);
  expect(view.x).toBeGreaterThanOrEqual(safe.left - 0.5);
  expect(view.y).toBeGreaterThanOrEqual(safe.top - 0.5);
  expect(view.x + view.w).toBeLessThanOrEqual(iw - safe.right + 0.5);
  expect(view.y + view.h).toBeLessThanOrEqual(ih - safe.bottom + 0.5);

  // Menu buttons are thumb-sized (>= 44 CSS px tall on a phone) and on screen.
  const newRun = await button(page, 'title.newRun');
  expect(newRun.css.h).toBeGreaterThanOrEqual(44);
  expect(newRun.css.x).toBeGreaterThanOrEqual(view.x);
  expect(newRun.css.x + newRun.css.w).toBeLessThanOrEqual(view.x + view.w + 0.5);

  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const run = await page.evaluate(() => window.__SD.run());
  expect(run).not.toBeNull();
  // A real run: floor 1 of the Gutterways, in the start room.
  expect(run!.run?.floor).toBe(1);
  expect(run!.run?.roomType).toBe('start');

  // Every in-run HUD button sits inside the drawn game rect.
  const hud = await page.evaluate(() => window.__SD.buttons());
  expect(hud.map((b) => b.id)).toEqual(expect.arrayContaining(['run.pause', 'run.bomb', 'run.active', 'run.consumable', 'run.map']));
  for (const b of hud) {
    expect(b.css.x).toBeGreaterThanOrEqual(view.x - 0.5);
    expect(b.css.y).toBeGreaterThanOrEqual(view.y - 0.5);
    expect(b.css.x + b.css.w).toBeLessThanOrEqual(view.x + view.w + 0.5);
    expect(b.css.y + b.css.h).toBeLessThanOrEqual(view.y + view.h + 0.5);
  }

  // The sim is actually ticking.
  const t0 = run!.tick;
  await page.waitForFunction((t) => (window.__SD.run()?.tick ?? 0) > t + 10, t0);

  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  const frozen = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__SD.run()))!.tick).toBe(frozen);

  await tap(page, 'pause.resume');
  await waitScene(page, 'run');

  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');

  expect(errors).toEqual([]);
});

test('touch sticks move and shoot', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  // The training yard (no doors to walk through by accident).
  await page.evaluate(() => window.__SD.debug.yard());
  await page.waitForFunction(() => window.__SD.sim?.trainingRoom === true);

  // Drive the floating sticks with synthetic touch pointers (two fingers at once).
  const start = (await page.evaluate(() => window.__SD.run()))!;
  await page.evaluate(async () => {
    const canvas = document.getElementById('screen')!;
    const v = window.__SD.view;
    const at = (gx: number, gy: number) => ({ clientX: v.x + gx * v.scale, clientY: v.y + gy * v.scale });
    const fire = (type: string, id: number, gx: number, gy: number) =>
      canvas.dispatchEvent(
        new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true, ...at(gx, gy) }),
      );
    fire('pointerdown', 1, 40, 150); // left thumb
    fire('pointerdown', 2, 340, 150); // right thumb
    for (let i = 1; i <= 6; i++) {
      fire('pointermove', 1, 40, 150 + i * 4); // push down
      fire('pointermove', 2, 340 + i * 4, 150); // aim right
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 600));
    fire('pointerup', 1, 40, 174);
    fire('pointerup', 2, 364, 150);
  });
  const end = (await page.evaluate(() => window.__SD.run()))!;
  expect(end.player.y).toBeGreaterThan(start.player.y + 10);
  expect(end.counters.shots).toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('portrait shows the rotate screen and pauses the run', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const vp = page.viewportSize()!;
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForFunction(() => window.__SD.portrait === true);
  await waitScene(page, 'pause');
  // The pause menu is hidden behind the rotate card: tapping where "Resume" would be (and
  // pressing Escape) must not unpause the run.
  await tap(page, 'pause.resume');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect(await scene(page)).toBe('pause');
  await page.setViewportSize(vp);
  await page.waitForFunction(() => window.__SD.portrait === false);
  expect(await scene(page)).toBe('pause');
  await tap(page, 'pause.resume');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});
