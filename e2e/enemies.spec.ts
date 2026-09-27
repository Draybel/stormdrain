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
  // Character select (Phase 4B): START with the default character.
  await page.waitForFunction(() => window.__SD?.scene === 'chars');
  const s = await page.evaluate(() => window.__SD.button('chars.start'));
  await page.touchscreen.tap(s!.css.cx, s!.css.cy);
  await waitScene(page, 'run');
  // Phase 2 features live in the training yard (New Run starts a real floor run since Phase 3A).
  await page.evaluate(() => window.__SD.debug.yard());
  await page.waitForFunction(() => window.__SD.sim?.trainingRoom === true);
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

test("every chapter's enemy shots next to lime, orange and cyan player builds (screenshots)", async ({ page }, info) => {
  test.skip(info.project.name !== 'iphone15-homescreen', 'one profile is enough for the look');
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  const b = await page.evaluate(() => window.__SD.button('title.newRun'));
  await page.touchscreen.tap(b!.css.cx, b!.css.cy);
  await waitScene(page, 'chars');
  const s = await page.evaluate(() => window.__SD.button('chars.start'));
  await page.touchscreen.tap(s!.css.cx, s!.css.cy);
  await waitScene(page, 'run');
  // Polish batch 2 (B2-3): foes' shots carry a dark core, outline and drop-halo; the player's a white-hot centre and a
  // light halo — side by side with builds whose colours sit right next to each chapter's shots.
  const builds = [
    ['lime', ['rubber-ball', 'toadstool-cap', 'twin-straws']],
    ['orange', ['firecracker-pouch', 'trick-candle', 'party-popper']],
    ['cyan', ['leaky-bucket', 'ice-cube-tray', 'geode']],
  ] as const;
  const floors = [
    [1, 'main'], [1, 'alt'], [3, 'main'], [3, 'alt'], [5, 'main'], [5, 'alt'],
    [7, 'main'], [7, 'alt'], [9, 'main'], [9, 'alt'], [11, 'main'], [11, 'alt'],
  ] as const;
  let both = 0;
  for (let i = 0; i < floors.length; i++) {
    const [floor, track] = floors[i]!;
    const [name, items] = builds[i % builds.length]!;
    await page.evaluate(([f, t]) => window.__SD.debug.runAt(f, t, null, 5), [floor, track] as const);
    await page.waitForFunction((fl) => window.__SD.run()?.run?.floor === fl, floor);
    // The floor card first (it covers the room).
    await page.waitForFunction(() => !window.__SD.presentation()!.card, undefined, { timeout: 8000 });
    await page.evaluate((ids) => {
      const d = window.__SD.debug;
      d.god(true);
      for (const id of ids) d.give(id);
      window.__SD.sim!.world.player.placeAt(40, 56);
      d.wave(6);
      // Tough foes, so the wave lives long enough to shoot back.
      const w = window.__SD.sim!.world;
      for (let k = 0; k < w.enemies.count; k++) w.enemies.items[k]!.hp = w.enemies.items[k]!.maxHp = 1e5;
    }, items as unknown as string[]);
    // Fire along the top of the room: her shots stream past while theirs come at her.
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(() => window.__SD.counts.enemyShots > 0 && window.__SD.counts.projectiles > 0, undefined, { timeout: 6000 }).catch(() => undefined);
    await page.waitForTimeout(250);
    const c = await page.evaluate(() => window.__SD.counts);
    if (c.enemyShots > 0 && c.projectiles > 0) both++;
    const chapter = (await page.evaluate(() => window.__SD.run()!.run!.chapter)) as string;
    const v = await page.evaluate(() => window.__SD.view);
    // The room only (72..312 × 48..192 game px).
    await page.screenshot({ path: `e2e/__screens__/b2-shots-${chapter}-${name}.png`, clip: { x: v.x + 72 * v.scale, y: v.y + 48 * v.scale, width: 240 * v.scale, height: 144 * v.scale } });
    await page.keyboard.up('ArrowUp');
  }
  // Most chapters had both sides' shots on screen at once.
  expect(both).toBeGreaterThanOrEqual(8);
  expect(errors).toEqual([]);
});
