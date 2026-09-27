import { expect, test, type Page } from '@playwright/test';
import { PERF_SLACK } from '../tests/helpers/perf';

/**
 * Phase 4B menus in real WebKit (both iPhone projects): every title item opens with a real touchscreen tap at
 * the button's centre and BACK returns; the seed modal takes typed input and starts a seeded run; settings
 * survive a reload; the pause menu shows the stats and the items; the daily run's one scored attempt; save
 * export / import; retry-same-seed; keyboard navigation. No console errors anywhere.
 * Polish batch 3 (B3-5): the DOM modal on an iPhone — Import opens without the keyboard, PASTE fills and checks the
 * code, a backdrop tap never throws a pasted code away, the panel follows a rotation to portrait (NEXT still works)
 * and back, and nothing can be pinch-zoomed inside it.
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

/** Every visible button of the top scene is at least 44 CSS px tall (≈ 44 pt), except full-area regions. */
async function expectThumbSized(page: Page): Promise<void> {
  const small = await page.evaluate(() =>
    window.__SD
      .buttons()
      .filter((b) => b.css.h < 44 && !/\.(grid|list|items|skip|title)$/.test(b.id))
      .map((b) => `${b.id} ${b.css.h.toFixed(1)}`),
  );
  expect(small).toEqual([]);
}

async function screen<T = Record<string, unknown>>(page: Page): Promise<T> {
  return (await page.evaluate(() => window.__SD.screen().info)) as T;
}

async function startFromTitle(page: Page): Promise<void> {
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
}

test('every title item opens with a real tap, and back returns', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await expectThumbSized(page);
  const pages: [string, string, string][] = [
    ['title.newRun', 'chars', 'chars.back'],
    ['title.daily', 'chars', 'chars.back'],
    ['title.collection', 'collection', 'collection.back'],
    ['title.bestiary', 'bestiary', 'bestiary.back'],
    ['title.stats', 'stats', 'stats.back'],
    ['title.achievements', 'achievements', 'achievements.back'],
    ['title.settings', 'settings', 'settings.back'],
  ];
  for (const [open, scene, back] of pages) {
    await tap(page, open);
    await waitScene(page, scene);
    await expectThumbSized(page);
    await tap(page, back);
    await waitScene(page, 'title');
  }
  // The bestiary's tabs switch.
  await tap(page, 'title.bestiary');
  await waitScene(page, 'bestiary');
  await tap(page, 'bestiary.tab.bosses');
  expect((await screen<{ tab: string }>(page)).tab).toBe('bosses');
  await tap(page, 'bestiary.back');
  await waitScene(page, 'title');
  // Enter Seed: the DOM modal; its Cancel (a real tap) returns.
  await tap(page, 'title.seed');
  await waitScene(page, 'modal');
  expect((await page.evaluate(() => window.__SD.modal())).kind).toBe('seed');
  await page.locator('[data-sd-modal] [data-action="cancel"]').tap();
  await waitScene(page, 'title');
  expect((await page.evaluate(() => window.__SD.modal())).open).toBe(false);
  // Continue (only with a saved run): make one, quit, continue.
  expect(await page.evaluate(() => window.__SD.buttons().some((b) => b.id === 'title.continue'))).toBe(false);
  await startFromTitle(page);
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});

test('the seed modal takes typed input and starts a seeded run', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.seed');
  await waitScene(page, 'modal');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
  // Too short: an error, still open.
  await page.keyboard.type('abc');
  await page.keyboard.press('Enter');
  const m = await page.evaluate(() => window.__SD.modal());
  expect(m.open).toBe(true);
  expect(m.error).toBe(true);
  expect(m.note).toContain('TOO SHORT');
  // Typed lowercase with a space: uppercased, accepted.
  await page.keyboard.type('d 2345');
  expect((await page.evaluate(() => window.__SD.modal())).value).toBe('ABCD 2345');
  await page.keyboard.press('Enter');
  await waitScene(page, 'chars');
  const chars = await screen<{ seed: { code: string; kind: string } }>(page);
  expect(chars.seed).toEqual({ code: 'ABCD2345', kind: 'custom' });
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const info = await page.evaluate(() => ({ seed: window.__SD.sim!.seed, info: window.__SD.sim!.run!.data.seedInfo }));
  expect(info.info).toEqual({ code: 'ABCD2345', kind: 'custom' });
  // The pause menu shows it (a practice run).
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  const p = await screen<{ seed: string; tag: string }>(page);
  expect(p.seed).toBe('SEED ABCD 2345');
  expect(p.tag).toBe('PRACTICE');
  // The same code gives the same run.
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  await tap(page, 'title.seed');
  await waitScene(page, 'modal');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
  await page.keyboard.type('ABCD-2345');
  await page.locator('[data-sd-modal] [data-action="start"]').tap();
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  expect(await page.evaluate(() => window.__SD.sim!.seed)).toBe(info.seed);
  expect(errors).toEqual([]);
});

test('settings changes persist after a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  // Tap the master volume track at a quarter: the knob jumps there.
  const b = (await page.evaluate(() => window.__SD.button('settings.master')))!;
  const v = await page.evaluate(() => window.__SD.view);
  const trackX0 = b.x + 56;
  const trackX1 = b.x + b.w - 28;
  const at = (f: number) => v.x + (trackX0 + f * (trackX1 - trackX0)) * v.scale;
  await page.touchscreen.tap(at(0.25), b.css.cy);
  await page.waitForFunction(() => (window.__SD.screen().info as { masterVolume: number }).masterVolume === 0.25);
  // Drag the music knob to the far right (synthetic touch pointers: down, moves, up).
  const mb = (await page.evaluate(() => window.__SD.button('settings.music')))!;
  await page.evaluate(
    async ([x0, x1, y]) => {
      const canvas = document.getElementById('screen')!;
      const fire = (type: string, x: number) =>
        canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
      fire('pointerdown', x0!);
      for (let i = 1; i <= 8; i++) {
        fire('pointermove', x0! + ((x1! - x0!) * i) / 8);
        await new Promise((r) => setTimeout(r, 20));
      }
      fire('pointerup', x1!);
    },
    [at(0.5), v.x + (mb.x + mb.w - 10) * v.scale, mb.css.cy],
  );
  await page.waitForFunction(() => (window.__SD.screen().info as { musicVolume: number }).musicVolume === 1);
  await tap(page, 'settings.lefty');
  await tap(page, 'settings.fps');
  await tap(page, 'settings.aim');
  // Polish batch 2: REDUCE FLASHING (off by default) persists too.
  expect((await screen<{ reduceFlashing: boolean }>(page)).reduceFlashing).toBe(false);
  await tap(page, 'settings.flash');
  const s = await screen<{ leftHanded: boolean; showFps: boolean; aim360: boolean; reduceFlashing: boolean }>(page);
  expect([s.leftHanded, s.showFps, s.aim360, s.reduceFlashing]).toEqual([true, true, true, true]);
  await tap(page, 'settings.back');
  await waitScene(page, 'title');

  await page.reload();
  await waitScene(page, 'title');
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  const after = await screen<{ masterVolume: number; musicVolume: number; leftHanded: boolean; showFps: boolean; aim360: boolean; reduceFlashing: boolean }>(page);
  expect(after).toMatchObject({ masterVolume: 0.25, musicVolume: 1, leftHanded: true, showFps: true, aim360: true, reduceFlashing: true });
  // Left-handed in a run: the active button moved to the left margin.
  await tap(page, 'settings.back');
  await waitScene(page, 'title');
  await startFromTitle(page);
  const active = (await page.evaluate(() => window.__SD.button('run.active')))!;
  expect(active.x).toBeLessThan(40);
  expect(errors).toEqual([]);
});

type Rect = { id: string; x: number; y: number; w: number; h: number };

/** STATS block pieces that overlap each other or leave the panel (game px, from the pause scene's layout). */
function statsProblems(info: { statRects: Rect[]; panel: Rect; gridTop: number }): string[] {
  const out: string[] = [];
  const { statRects: rects, panel } = info;
  for (const r of rects) {
    if (r.x < panel.x + 2 || r.y < panel.y + 2 || r.x + r.w > panel.x + panel.w - 2 || r.y + r.h > panel.y + panel.h - 2) out.push(`${r.id} outside`);
    if (r.id !== 'items.label' && r.y + r.h > info.gridTop - 8) out.push(`${r.id} too low`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]!;
      const b = rects[j]!;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`${a.id} × ${b.id}`);
    }
  }
  return out;
}

test('the pause menu shows the stats and the items; tap one to read it', async ({ page }, testInfo) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await startFromTitle(page);
  await page.evaluate(() => {
    window.__SD.debug.god(true);
    window.__SD.debug.give('twin-straws');
    window.__SD.debug.give('twin-straws');
    window.__SD.debug.give('brick-chip');
  });
  await page.waitForTimeout(400);
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  const info = await screen<{
    character: string;
    stats: Record<string, number>;
    health: string;
    items: { id: string; count: number }[];
    itemCells: { id: string; x: number; y: number }[];
    info: string[];
    seed: string;
    statRects: Rect[];
    panel: Rect;
    gridTop: number;
  }>(page);
  expect(info.character).toBe('wren');
  // HEALTH first, then damage, fire rate, shot speed, range, speed and luck — none overlapping, all in the panel.
  expect(info.health).toBe('3/3');
  expect(Object.keys(info.stats).sort()).toEqual(['damage', 'fireRate', 'luck', 'moveSpeed', 'range', 'shotSpeed']);
  expect(statsProblems(info)).toEqual([]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `e2e/__screens__/pause-stats-${testInfo.project.name}.png` });
  for (const v of Object.values(info.stats)) expect(Number.isFinite(v)).toBe(true);
  expect(info.items).toEqual(expect.arrayContaining([{ id: 'twin-straws', count: 2 }, { id: 'brick-chip', count: 1 }]));
  expect(info.info[0]).toContain('FLOOR 1');
  expect(info.seed).toMatch(/^SEED [A-Z0-9]{4} [A-Z0-9]{4}$/);
  // Tap the brick chip's cell → its details.
  const cell = info.itemCells.find((c) => c.id === 'brick-chip')!;
  const v = await page.evaluate(() => window.__SD.view);
  await page.touchscreen.tap(v.x + cell.x * v.scale, v.y + cell.y * v.scale);
  expect((await screen<{ selected: { id: string } | null }>(page)).selected?.id).toBe('brick-chip');
  // Settings from the pause menu, then back to the pause menu, then resume.
  await tap(page, 'pause.settings');
  await waitScene(page, 'settings');
  expect((await screen<{ importEnabled: boolean }>(page)).importEnabled).toBe(false);
  await tap(page, 'settings.back');
  await waitScene(page, 'pause');
  await tap(page, 'pause.resume');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});

test('daily run: one scored attempt per day, replays are practice', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.daily');
  await waitScene(page, 'chars');
  const c = await screen<{ seed: { kind: string; scored: boolean; date: string; code: string } }>(page);
  expect(c.seed.kind).toBe('daily');
  expect(c.seed.scored).toBe(true);
  expect(c.seed.code).toMatch(/^[A-Z2-9]{8}$/);
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  // The attempt is claimed at once (quitting can't reset it).
  const today = await page.evaluate(() => {
    const m = JSON.parse(localStorage.getItem('stormdrain.meta')!).data;
    return m.stats.daily as Record<string, { seed: string; done?: boolean }>;
  });
  expect(today[c.seed.date]?.seed).toBe(c.seed.code);
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  expect((await screen<{ tag: string }>(page)).tag).toBe('DAILY');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  expect((await screen<{ dailyDone: boolean }>(page)).dailyDone).toBe(true);
  await tap(page, 'title.daily');
  await waitScene(page, 'chars');
  const again = await screen<{ seed: { scored: boolean; code: string } }>(page);
  expect(again.seed.scored).toBe(false);
  expect(again.seed.code).toBe(c.seed.code);
  expect(errors).toEqual([]);
});

test("a daily picked just before UTC midnight and started after it is the new day's one scored attempt", async ({ page }) => {
  const errors = trackErrors(page);
  await page.clock.setFixedTime(new Date('2026-09-27T23:59:50Z'));
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.daily');
  await waitScene(page, 'chars');
  const before = await screen<{ seed: { date: string; code: string; scored: boolean } }>(page);
  expect(before.seed.date).toBe('2026-09-27');
  expect(before.seed.scored).toBe(true);
  // Midnight passes while the character select is open: the page switches to the new day's daily.
  await page.clock.setFixedTime(new Date('2026-09-28T00:00:20Z'));
  await page.waitForFunction(() => (window.__SD.screen().info as { newDay?: boolean } | null)?.newDay === true);
  const after = await screen<{ seed: { date: string; code: string; scored: boolean } }>(page);
  expect(after.seed.date).toBe('2026-09-28');
  expect(after.seed.scored).toBe(true);
  expect(after.seed.code).not.toBe(before.seed.code);
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const info = await page.evaluate(() => window.__SD.sim!.run!.data.seedInfo);
  expect(info).toMatchObject({ kind: 'daily', date: '2026-09-28', scored: true, code: after.seed.code });
  // Exactly one scored daily in the save: the new day's (yesterday's was never claimed).
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('stormdrain.meta');
    return !!raw && '2026-09-28' in (JSON.parse(raw).data.stats.daily ?? {});
  });
  const days = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('stormdrain.meta')!).data.stats.daily ?? {}));
  expect(days).toEqual(['2026-09-28']);
  expect(errors).toEqual([]);
});

test('export a save code, then import it back (with a bad code first)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await page.evaluate(() => window.__SD.save.achievement('first-splash'));
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  await tap(page, 'settings.export');
  await waitScene(page, 'modal');
  const code = (await page.evaluate(() => window.__SD.modal())).value;
  expect(code.startsWith('SD1:')).toBe(true);
  await page.locator('[data-sd-modal] [data-action="done"]').tap();
  await waitScene(page, 'settings');
  // Wipe the progress, then import the code.
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await waitScene(page, 'title');
  expect((await page.evaluate(() => window.__SD.meta())).achievements).toEqual([]);
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  await tap(page, 'settings.import');
  await waitScene(page, 'modal');
  await page.locator('[data-sd-modal] textarea').fill('SD1:not-a-real-code');
  await page.locator('[data-sd-modal] [data-action="check"]').tap();
  expect((await page.evaluate(() => window.__SD.modal())).error).toBe(true);
  await page.locator('[data-sd-modal] textarea').fill(code);
  await page.locator('[data-sd-modal] [data-action="check"]').tap();
  await page.locator('[data-sd-modal] [data-action="replace"]').tap();
  await waitScene(page, 'settings');
  await page.waitForFunction(() => window.__SD.toast()?.title === 'SAVE IMPORTED');
  expect((await page.evaluate(() => window.__SD.meta())).achievements).toContain('first-splash');
  expect(errors).toEqual([]);
});

/** The open modal panel's rect (CSS px). */
async function panelRect(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await page.locator('[data-sd-modal] .sdm-panel').boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

test('B3-5: Import opens without the keyboard; PASTE fills and checks the code; a backdrop tap keeps a pasted code', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await page.evaluate(() => window.__SD.save.achievement('first-splash'));
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  await tap(page, 'settings.export');
  await waitScene(page, 'modal');
  const code = (await page.evaluate(() => window.__SD.modal())).value;
  await page.locator('[data-sd-modal] [data-action="done"]').tap();
  await waitScene(page, 'settings');
  // A clipboard that holds the code (WebKit can't grant clipboard-read to a test: stub it).
  await page.evaluate((c) => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText: async () => c, writeText: async () => {} } });
  }, code);

  await tap(page, 'settings.import');
  await waitScene(page, 'modal');
  // No focused field (the iPhone keyboard would cover the buttons); the buttons sit above the field.
  expect(await page.evaluate(() => document.activeElement?.tagName ?? '')).not.toBe('TEXTAREA');
  const order = await page.evaluate(() => {
    const panel = document.querySelector('[data-sd-modal] .sdm-panel')!;
    const kids = [...panel.children].map((c) => (c.tagName === 'TEXTAREA' ? 'field' : c.classList.contains('sdm-actions') ? 'actions' : ''));
    return kids.filter((k) => k);
  });
  expect(order).toEqual(['actions', 'field']);
  // The field allows the iOS paste callout; the layer blocks pinch-zoom.
  const css = await page.evaluate(() => ({
    field: getComputedStyle(document.querySelector('[data-sd-modal] textarea')!).getPropertyValue('-webkit-touch-callout'),
    root: getComputedStyle(document.querySelector('[data-sd-modal]')!).touchAction,
    panel: getComputedStyle(document.querySelector('[data-sd-modal] .sdm-panel')!).touchAction,
  }));
  expect(css.root).toBe('pan-x pan-y');
  expect(css.panel).toBe('pan-x pan-y');
  if (css.field) expect(css.field).toBe('default');
  // A backdrop tap with an EMPTY field cancels (the old behaviour for a stray open).
  const box = await panelRect(page);
  const backdrop = { x: Math.max(4, box.x - 20), y: box.y + 20 };
  await page.touchscreen.tap(backdrop.x, backdrop.y);
  await waitScene(page, 'settings');
  // PASTE: fills the field and checks it at once → the confirmation.
  await tap(page, 'settings.import');
  await waitScene(page, 'modal');
  await page.locator('[data-sd-modal] [data-action="paste"]').tap();
  await page.locator('[data-sd-modal] [data-action="replace"]').waitFor();
  await page.locator('[data-sd-modal] [data-action="back"]').tap();
  expect((await page.evaluate(() => window.__SD.modal())).value).toBe(code);
  // A backdrop tap with the code in the field keeps the modal AND the code (it only dismisses the keyboard).
  await page.locator('[data-sd-modal] textarea').focus();
  await page.touchscreen.tap(backdrop.x, backdrop.y);
  const m = await page.evaluate(() => window.__SD.modal());
  expect(m.open).toBe(true);
  expect(m.value).toBe(code);
  expect(await page.evaluate(() => document.activeElement?.tagName ?? '')).not.toBe('TEXTAREA');
  // A refused clipboard: a plain-language note, and the field takes a manual paste.
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: () => Promise.reject(new Error('NotAllowedError')), writeText: async () => {} },
    });
  });
  await page.locator('[data-sd-modal] textarea').fill('');
  await page.locator('[data-sd-modal] [data-action="paste"]').tap();
  await page.waitForFunction(() => window.__SD.modal().error);
  expect((await page.evaluate(() => window.__SD.modal())).note).toContain('LONG-PRESS');
  await page.locator('[data-sd-modal] textarea').fill(code);
  await page.locator('[data-sd-modal] [data-action="check"]').tap();
  await page.locator('[data-sd-modal] [data-action="replace"]').tap();
  await waitScene(page, 'settings');
  await page.waitForFunction(() => window.__SD.toast()?.title === 'SAVE IMPORTED');
  expect((await page.evaluate(() => window.__SD.meta())).achievements).toContain('first-splash');
  expect(errors).toEqual([]);
});

test('B3-5: ENTER SEED survives a rotation to portrait (inside the screen, NEXT works) and back', async ({ page }) => {
  const errors = trackErrors(page);
  const land = page.viewportSize()!;
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.seed');
  await waitScene(page, 'modal');
  await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
  await page.keyboard.type('ABCD2345');
  const landscape = await panelRect(page);
  const view = await page.evaluate(() => window.__SD.view);
  expect(landscape.x).toBeGreaterThanOrEqual(view.x - 0.5);
  expect(landscape.x + landscape.width).toBeLessThanOrEqual(view.x + view.w + 0.5);
  // Rotate to portrait: the panel is laid out for the tall screen (no rotate card behind it).
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForFunction(() => window.__SD.portrait);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const portrait = await panelRect(page);
  expect(portrait.x).toBeGreaterThanOrEqual(0);
  expect(portrait.y).toBeGreaterThanOrEqual(0);
  expect(portrait.x + portrait.width).toBeLessThanOrEqual(393 + 0.5);
  expect(portrait.y + portrait.height).toBeLessThanOrEqual(852 + 0.5);
  expect(portrait.width).toBeGreaterThan(300);
  // Back to landscape: the landscape layout returns.
  await page.setViewportSize(land);
  await page.waitForFunction(() => !window.__SD.portrait);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const again = await panelRect(page);
  expect(Math.abs(again.x - landscape.x)).toBeLessThan(1);
  expect(Math.abs(again.width - landscape.width)).toBeLessThan(1);
  // Portrait once more, and NEXT (a real tap) still works there.
  await page.setViewportSize({ width: 393, height: 852 });
  await page.waitForFunction(() => window.__SD.portrait);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.locator('[data-sd-modal] [data-action="start"]').tap();
  await waitScene(page, 'chars');
  expect((await page.evaluate(() => window.__SD.modal())).open).toBe(false);
  await page.setViewportSize(land);
  await page.waitForFunction(() => !window.__SD.portrait);
  expect(((await page.evaluate(() => window.__SD.screen().info)) as { seed: { code: string } }).seed.code).toBe('ABCD2345');
  expect(errors).toEqual([]);
});

test('game over: retry replays the same seed as practice; keyboard navigation works', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  // Keyboard: down to DAILY RUN, Enter opens character select, Escape goes back.
  await page.keyboard.press('ArrowDown');
  expect((await screen<{ focus: string }>(page)).focus).toBe('title.daily');
  await page.keyboard.press('Enter');
  await waitScene(page, 'chars');
  await page.keyboard.press('Escape');
  await waitScene(page, 'title');
  await page.keyboard.press('KeyN');
  await waitScene(page, 'chars');
  await page.keyboard.press('Enter');
  await waitScene(page, 'run');
  const code = await page.evaluate(() => window.__SD.sim!.run!.data.seedInfo!.code);
  await page.evaluate(() => window.__SD.debug.kill());
  await waitScene(page, 'over');
  await page.waitForTimeout(500);
  await tap(page, 'over.retry');
  await waitScene(page, 'run');
  expect(await page.evaluate(() => window.__SD.sim!.run!.data.seedInfo)).toEqual({ code, kind: 'custom' });
  expect(await page.evaluate(() => window.__SD.sim!.world.player.dead)).toBe(false);
  expect(errors).toEqual([]);
});

test('START never freezes the page: the rAF gap across the tap stays short', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await page.waitForTimeout(400);
  const f0 = await page.evaluate(() => window.__SD.perf.frame);
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  // A second of play behind the floor card (the floor's sprites warm up a couple of ms a frame meanwhile).
  await page.waitForTimeout(1000);
  const s = await page.evaluate((f) => window.__SD.perfFrames(f), f0);
  const gap = Math.max(...s.gaps);
  const worst = Math.max(...s.costs);
  console.log(`START: max rAF gap ${gap.toFixed(0)} ms, worst frame ${worst.toFixed(1)} ms over ${s.costs.length} frames`);
  // It used to build ~2,500 canvases inside the tap: a 0.45-0.7 s gap.
  expect(gap).toBeLessThan(150 * PERF_SLACK);
  expect(errors).toEqual([]);
});
