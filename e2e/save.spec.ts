import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 4A in real WebKit: the run save survives a page reload (New Run → walk through a door → reload →
 * Continue resumes the same floor, room and items), a finished run leaves no Continue, and settings /
 * meta progress persist across reloads.
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

async function visible(page: Page, id: string): Promise<boolean> {
  return page.evaluate((i) => window.__SD.buttons().some((b) => b.id === i), id);
}

test('a run save survives a reload: Continue resumes the same floor and room', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);
  await tap(page, 'title.newRun');
  await waitScene(page, 'run');
  await page.evaluate(() => window.__SD.debug.god(true));
  // Something to carry: an item and a few coins.
  await page.evaluate(() => {
    window.__SD.debug.give('brick-chip');
    window.__SD.debug.add(5, 0, 0);
  });

  // Walk through an open door into the next room.
  const before = (await page.evaluate(() => window.__SD.run()))!.run!;
  const side = before.doors.findIndex((d) => d.kind !== 0 && d.kind !== 6 && d.state === 2);
  expect(side).toBeGreaterThanOrEqual(0);
  const to = before.doors[side]!.to;
  const key = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][side]!;
  await page.evaluate((s) => {
    window.__SD.sim!.world.player.placeAt([104, 190, 104, 18][s]!, [18, 56, 94, 56][s]!);
  }, side);
  await page.keyboard.down(key);
  await page.waitForFunction((t) => window.__SD.run()!.run!.room === t, to, { timeout: 5000 });
  await page.keyboard.up(key);
  await page.waitForFunction(() => !window.__SD.presentation()!.slide);
  const at = (await page.evaluate(() => window.__SD.run()))!;
  const seed = await page.evaluate(() => window.__SD.sim!.seed);
  expect(at.inv.passives).toContain('brick-chip');
  const meta = await page.evaluate(() => window.__SD.meta());
  expect(meta.hasRun).toBe(true);
  expect(meta.runSaves).toBeGreaterThanOrEqual(2);
  expect(meta.stats.runs).toBe(1);

  // Reload the page: the title offers Continue.
  await page.reload();
  await waitScene(page, 'title');
  await page.waitForFunction(() => window.__SD.buttons().some((b) => b.id === 'title.continue'));
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  const back = (await page.evaluate(() => window.__SD.run()))!;
  expect(await page.evaluate(() => window.__SD.sim!.seed)).toBe(seed);
  expect(back.run!.floor).toBe(at.run!.floor);
  expect(back.run!.room).toBe(to);
  expect(back.run!.visited).toBe(at.run!.visited);
  expect(back.inv).toEqual(at.inv);
  expect(back.health).toBe(at.health);
  // Continuing is not a new run.
  expect((await page.evaluate(() => window.__SD.meta())).stats.runs).toBe(1);
  // It keeps playing.
  const t0 = back.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 20, t0);
  expect(errors).toEqual([]);
});

test('a finished run leaves no Continue; progress and settings persist across reloads', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'run');
  // A setting changed during the run.
  await page.evaluate(() => window.__SD.debug.aim360(true));
  // An achievement toast shows without stopping play.
  await page.evaluate(() => window.__SD.save.achievement('first-splash'));
  await page.waitForFunction(() => window.__SD.toast()?.title.includes('FIRST SPLASH') ?? false);
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 10, t0);
  expect(await page.evaluate(() => window.__SD.scene)).toBe('run');

  // Death ends the run: its save is gone at once.
  await page.evaluate(() => window.__SD.debug.kill());
  await page.waitForFunction(() => !window.__SD.meta().hasRun);
  await page.waitForFunction(() => window.__SD.presentation()?.ending === 'death', undefined, { timeout: 6000 });
  await page.waitForTimeout(900);
  await tap(page, 'run.end');
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);

  await page.reload();
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);
  const m = await page.evaluate(() => window.__SD.meta());
  expect(m.loaded).toBe('ok');
  expect(m.stats.runs).toBe(1);
  expect(m.stats.deaths).toBe(1);
  expect(m.achievements).toContain('first-splash');
  // The setting came back from the save.
  await tap(page, 'title.newRun');
  await waitScene(page, 'run');
  expect(await page.evaluate(() => window.__SD.meta().stats.runs)).toBe(2);
  const aim = await page.evaluate(() => {
    const raw = localStorage.getItem('stormdrain.meta');
    return raw ? (JSON.parse(raw).data.settings.aim360 as boolean) : null;
  });
  expect(aim).toBe(true);
  expect(errors).toEqual([]);
});
