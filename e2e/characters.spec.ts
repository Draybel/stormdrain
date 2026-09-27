import { expect, test, type Page } from '@playwright/test';

/**
 * Characters & achievements in real WebKit (both iPhone projects): the character select shows all eight
 * characters (the secret one's hint hidden) (locked ones as silhouettes with their unlock hint, START disabled), an earned achievement
 * unlocks one, Pip's DASH button appears only for Pip, sits inside the game image clear of the room, and a
 * real touch tap (or Shift) burrows; the achievements page lists the whole roster. No console errors.
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

interface CharsInfo {
  characters: { id: string; unlocked: boolean }[];
  selected: string;
  canStart: boolean;
}

async function chars(page: Page): Promise<CharsInfo> {
  return (await page.evaluate(() => window.__SD.screen().info)) as unknown as CharsInfo;
}

test('character select: eight characters, locked silhouettes, an achievement unlocks Pip; his DASH burrows', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  let info = await chars(page);
  expect(info.characters.map((c) => c.id)).toEqual(['wren', 'pip', 'marrow', 'juniper', 'bolt', 'sable', 'mosswick', 'drizzle']);
  expect(info.characters.filter((c) => c.unlocked).map((c) => c.id)).toEqual(['wren']);
  // A locked one can be looked at (silhouette + hint) but not started.
  await tap(page, 'chars.slot.pip');
  info = await chars(page);
  expect(info.selected).toBe('pip');
  expect(info.canStart).toBe(false);
  await tap(page, 'chars.back');
  await waitScene(page, 'title');

  // Earn Pip's achievement (UNDER THE ROOTS): Pip can start; the toast names him.
  expect(await page.evaluate(() => window.__SD.save.achievement('under-the-roots'))).toBe(true);
  await page.waitForFunction(() => (window.__SD.toast()?.title ?? '').includes('UNDER THE ROOTS'));
  expect((await page.evaluate(() => window.__SD.toast()))?.line).toBe('NEW CHARACTER: PIP');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.slot.pip');
  info = await chars(page);
  expect(info.canStart).toBe(true);
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const run = await page.evaluate(() => window.__SD.run());
  expect(run?.inv.active?.id).toBe('rusty-trowel');

  // Pip's DASH button: visible, inside the game image, clear of the room (the right margin).
  const view = await page.evaluate(() => window.__SD.view);
  const dash = (await page.evaluate(() => window.__SD.buttons().find((b) => b.id === 'run.dash')))!;
  expect(dash).toBeTruthy();
  expect(dash.css.h).toBeGreaterThanOrEqual(40);
  expect(dash.x).toBeGreaterThanOrEqual(312);
  expect(dash.css.y + dash.css.h).toBeLessThanOrEqual(view.y + view.h + 0.5);
  const bomb = (await page.evaluate(() => window.__SD.button('run.bomb')))!;
  expect(dash.y).toBeGreaterThanOrEqual(bomb.y + bomb.h);
  // Wait out the floor card, then a real tap burrows.
  await page.waitForFunction(() => !window.__SD.presentation()?.card);
  await tap(page, 'run.dash');
  await page.waitForFunction(() => window.__SD.sim?.world.player.underground === true);
  await page.waitForFunction(() => window.__SD.sim?.world.player.underground === false);
  // Shift on a keyboard does the same (after the cooldown).
  await page.waitForTimeout(1600);
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => window.__SD.sim?.world.player.underground === true);

  // Wren's run has no DASH button.
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.slot.wren');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  expect(await page.evaluate(() => window.__SD.buttons().some((b) => b.id === 'run.dash'))).toBe(false);
  expect(errors).toEqual([]);
});

test('the achievements page lists the whole roster with icons and rewards', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await page.evaluate(() => window.__SD.save.achievement('clear-skies'));
  await tap(page, 'title.achievements');
  await waitScene(page, 'achievements');
  const info = (await page.evaluate(() => window.__SD.screen().info)) as { earned: number; total: number; rows: { id: string; earned: boolean }[] };
  expect(info.total).toBeGreaterThanOrEqual(48);
  expect(info.earned).toBe(1);
  expect(info.rows.find((r) => r.id === 'clear-skies')?.earned).toBe(true);
  // Scroll to the bottom and back (every row draws: badges, faces, item icons).
  const list = (await page.evaluate(() => window.__SD.button('achievements.list')))!;
  for (let i = 0; i < 12; i++) await page.keyboard.press('PageDown');
  await page.waitForTimeout(300);
  await page.touchscreen.tap(list.css.cx, list.css.cy);
  await tap(page, 'achievements.back');
  await waitScene(page, 'title');
  // Mosswick came with CLEAR SKIES.
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  const c = await chars(page);
  expect(c.characters.filter((d) => d.unlocked).map((d) => d.id)).toEqual(['wren', 'mosswick']);
  expect(errors).toEqual([]);
});
