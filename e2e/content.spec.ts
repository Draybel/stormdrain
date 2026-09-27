import { expect, test, type Page } from '@playwright/test';

/**
 * The Phase 6 content merge in real WebKit: a Mystery Tonic drunk from the HUD's consumable button stays
 * identified across a reload + Continue (the run save carries the tonics); a new active item fires from
 * the HUD's active button; enemies of the new chapters spawn, animate and fight without errors.
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
  await page.evaluate(() => window.__SD.debug.god(true));
}

async function ticksPass(page: Page, n: number): Promise<void> {
  const t0 = await page.evaluate(() => window.__SD.ticks);
  await page.waitForFunction((t) => window.__SD.ticks > t[0] + t[1], [t0, n] as const);
}

test('a Mystery Tonic drunk from the HUD stays identified after a reload and Continue', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const bottle = 'tonic-crimson';
  await page.evaluate((id) => window.__SD.debug.give(id), bottle);
  expect(await page.evaluate(() => window.__SD.sim!.world.player.inv.consumables)).toContain(bottle);
  const known = (id: string) => page.evaluate((i) => window.__SD.sim!.world.tonics?.known.includes(i) ?? false, id);
  expect(await known(bottle)).toBe(false);
  const deal = await page.evaluate(() => JSON.stringify(window.__SD.sim!.world.tonics!.map));

  await tap(page, 'run.consumable');
  await page.waitForFunction((i) => window.__SD.sim!.world.tonics!.known.includes(i), bottle);
  expect(await page.evaluate(() => window.__SD.sim!.world.player.inv.consumables)).not.toContain(bottle);

  // The next room: its entry is the checkpoint the run save stores.
  const to = await page.evaluate(() => {
    const run = window.__SD.sim!.run!;
    for (let side = 0; side < 4; side++) if (run.goThroughDoor(side)) return run.data.current;
    return -1;
  });
  expect(to).toBeGreaterThanOrEqual(0);
  await ticksPass(page, 5);
  await page.evaluate(() => window.__SD.save.now());

  await page.reload();
  await waitScene(page, 'title');
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  expect((await page.evaluate(() => window.__SD.run()))!.run!.room).toBe(to);
  expect(await known(bottle)).toBe(true);
  expect(await page.evaluate(() => JSON.stringify(window.__SD.sim!.world.tonics!.map))).toBe(deal);
  expect(errors).toEqual([]);
});

test('a new active fires from the HUD; new chapter enemies spawn and fight', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await page.evaluate(() => window.__SD.debug.give('rumble-drum'));
  expect(await page.evaluate(() => window.__SD.sim!.world.player.inv.active?.id)).toBe('rumble-drum');
  await tap(page, 'run.active');
  await page.waitForFunction(() => window.__SD.sim!.world.player.inv.active?.charge === 0);

  // One from each depth of the new rosters (chapters 1 alt to 6).
  const foes = ['bathtub-paddler', 'grumblemole', 'waxwraith', 'runaway-cog', 'slag-crucible', 'puffcap', 'echo-bat', 'gravecaw', 'rimechest', 'stormkite', 'brood-comb'];
  for (const id of foes) expect(await page.evaluate((i) => window.__SD.debug.spawnEnemy(i, false), id), id).toBe(true);
  await ticksPass(page, 90);
  const count = await page.evaluate(() => window.__SD.sim!.world.enemies.count);
  expect(count).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__SD.scene)).toBe('run');
  expect(errors).toEqual([]);
});
