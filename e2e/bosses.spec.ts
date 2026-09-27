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

test("the alt chapters' second bosses: intro card, a phase change with its new look, the death sequence", async ({ page }, info) => {
  // Polish batch 4: Hammerjaw (the Rust Foundry) and Facetta (the Glimmer Grotto).
  test.skip(info.project.name !== 'iphone15-homescreen', 'rendering check on the home-screen profile');
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await startRun(page);
  for (const [id, floor] of [
    ['hammerjaw', 5],
    ['facetta', 7],
  ] as const) {
    await page.evaluate((f) => {
      window.__SD.debug.runAt(f, 'alt', null, 7);
      window.__SD.debug.god(true);
    }, floor);
    await page.waitForFunction(() => !window.__SD.presentation()!.card, undefined, { timeout: 6000 });
    expect(await page.evaluate((b) => window.__SD.debug.boss(b), id)).toBe(true);
    await page.waitForFunction(() => window.__SD.presentation()!.bossCard);
    await page.screenshot({ path: `e2e/__screens__/boss-${id}-intro.png` });
    await page.waitForFunction(() => !window.__SD.presentation()!.bossCard, undefined, { timeout: 6000 });
    const lookOf = (): Promise<string> =>
      page.evaluate(() => {
        const w = window.__SD.sim!.world;
        for (let k = 0; k < w.enemies.count; k++) {
          const e = w.enemies.items[k]!;
          if (e.boss && !e.dead) return e.sprite === null ? '' : typeof e.sprite === 'string' ? e.sprite : e.sprite.id;
        }
        return '';
      });
    const first = await lookOf();
    // Hit it until the next phase begins (the minimum phase time holds the first few blows at the threshold).
    for (let tries = 0; tries < 16; tries++) {
      await page.evaluate(() => {
        const w = window.__SD.sim!.world;
        for (let k = 0; k < w.enemies.count; k++) {
          const e = w.enemies.items[k]!;
          if (e.boss && !e.dead && e.hittable) e.hurt(99999, 0, 0, 0);
        }
      });
      const moved = await page
        .waitForFunction(() => (window.__SD.run()!.boss?.phase ?? 0) >= 1, undefined, { timeout: 1000 })
        .then(() => true)
        .catch(() => false);
      if (moved) break;
    }
    expect(await page.evaluate(() => window.__SD.run()!.boss?.phase)).toBe(1);
    await page.waitForTimeout(1300);
    expect(await lookOf()).not.toBe(first);
    await page.screenshot({ path: `e2e/__screens__/boss-${id}-phase2.png` });
    // On to the end: the death sequence plays (slow motion) and the fight is over.
    for (let i = 0; i < 30; i++) {
      const over = await page.evaluate(() => {
        const w = window.__SD.sim!.world;
        for (let k = 0; k < w.enemies.count; k++) {
          const e = w.enemies.items[k]!;
          if (e.boss && !e.dead && e.hittable) e.hurt(99999, 0, 0, 0);
        }
        return w.boss.dying || w.boss.done;
      });
      if (over) break;
      await page.waitForTimeout(700);
    }
    await page.waitForFunction(() => window.__SD.presentation()!.slowmo || window.__SD.sim!.world.boss.done, undefined, { timeout: 8000 });
    await page.waitForFunction(() => window.__SD.sim!.world.boss.done, undefined, { timeout: 10000 });
  }
  expect(errors).toEqual([]);
});

test('boss packs and finals wear a new look per phase in WebKit (pre-rendered, no errors)', async ({ page }, info) => {
  // Rendering only: one profile is enough (the layout specs cover both).
  test.skip(info.project.name !== 'iphone15-homescreen', 'rendering check on the home-screen profile');
  test.setTimeout(240_000);
  const errors = trackErrors(page);
  await startRun(page);
  // One boss per pack (A, B, C incl. the Ambergut's cocoon / wasp of other sizes) and a final.
  for (const id of ['pirouetta', 'bellowbelly', 'ambergut', 'old-thunderhead', 'hammerjaw', 'facetta']) {
    await page.evaluate(() => {
      window.__SD.debug.runAt(1, 'main', null, 7);
      window.__SD.debug.god(true);
    });
    await page.waitForFunction(() => !window.__SD.presentation()!.card, undefined, { timeout: 6000 });
    expect(await page.evaluate((b) => window.__SD.debug.boss(b), id)).toBe(true);
    await page.waitForFunction(() => window.__SD.presentation()!.bossCard);
    await page.waitForFunction(() => !window.__SD.presentation()!.bossCard, undefined, { timeout: 6000 });
    const looks: string[] = [];
    const phases = (await page.evaluate(() => window.__SD.run()!.boss!.phases))!;
    for (let ph = 0; ph < phases; ph++) {
      // The look worn now (the boss part's sprite), once the roar's flash is over.
      expect(await page.evaluate(() => window.__SD.run()!.boss?.phase)).toBe(ph);
      await page.waitForTimeout(1300);
      looks.push(
        await page.evaluate(() => {
          const w = window.__SD.sim!.world;
          for (let k = 0; k < w.enemies.count; k++) {
            const e = w.enemies.items[k]!;
            if (e.boss && !e.dead) return e.sprite === null ? '' : typeof e.sprite === 'string' ? e.sprite : e.sprite.id;
          }
          return '';
        }),
      );
      await page.screenshot({ path: `e2e/__screens__/boss-${id}-phase${ph + 1}.png` });
      // One blow takes it to the next threshold (bossDamage never skips a phase) — once it can be hit (not
      // burrowed, mid-dive or roaring).
      for (let tries = 0; ph < phases - 1 && tries < 12; tries++) {
        await page.evaluate(() => {
          const w = window.__SD.sim!.world;
          for (let k = 0; k < w.enemies.count; k++) {
            const e = w.enemies.items[k]!;
            if (e.boss && !e.dead && e.hittable) e.hurt(99999, 0, 0, 0);
          }
        });
        const moved = await page
          .waitForFunction((want) => window.__SD.run()!.boss?.phase === want, ph + 1, { timeout: 1000 })
          .then(() => true)
          .catch(() => false);
        if (moved) break;
      }
    }
    expect(new Set(looks).size, `${id}: ${looks.join(', ')}`).toBeGreaterThanOrEqual(2);
    await page.evaluate(() => window.__SD.debug.killEnemies());
  }
  expect(errors).toEqual([]);
});
