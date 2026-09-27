import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 4A: the production build is an installable, offline-capable app — the manifest and icons are
 * linked, dist/sw.js is served, and main.ts registers it (where the browser supports service workers).
 * Polish batch 3 (B3-4): an iPhone Safari tab is told to Add to Home Screen (its saves may be wiped) and gets an EXPORT
 * shortcut once there is progress; the home-screen app's first launch offers IMPORT once; a new version waiting in
 * the background shows RELOAD on the title (never mid-run), which saves and reloads — the run stays for Continue.
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

async function title(page: Page): Promise<{ notice: string; saveShortcut: string; reload: boolean; continue: boolean }> {
  return (await page.evaluate(() => window.__SD.screen().info)) as { notice: string; saveShortcut: string; reload: boolean; continue: boolean };
}

/** Makes the page an iPhone WebKit tab (`navigator.standalone` false) or the home-screen app (true). */
async function iPhone(page: Page, standalone: boolean): Promise<void> {
  await page.addInitScript((sa) => {
    Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => sa });
    if (!(navigator.maxTouchPoints > 0)) Object.defineProperty(Navigator.prototype, 'maxTouchPoints', { configurable: true, get: () => 5 });
  }, standalone);
}

/** Every visible title button is at least 44 CSS px tall and inside the game image. */
async function titleButtonsFit(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({ view: window.__SD.view, buttons: window.__SD.buttons() }));
  for (const b of r.buttons) {
    expect(b.css.h, b.id).toBeGreaterThanOrEqual(44 - 0.01);
    expect(b.x, b.id).toBeGreaterThanOrEqual(0);
    expect(b.y + b.h, b.id).toBeLessThanOrEqual(192);
  }
}

test('manifest + icons are linked, the service worker is built and registered', async ({ page, request }) => {
  await page.goto('./');
  await page.waitForFunction(() => window.__SD?.scene === 'title');
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('link[rel="manifest"], link[rel="apple-touch-icon"], link[rel="icon"]')].map((l) => (l as HTMLLinkElement).href),
  );
  expect(links.some((h) => h.endsWith('manifest.webmanifest'))).toBe(true);
  expect(links.some((h) => h.includes('apple-touch-icon'))).toBe(true);
  for (const href of links) expect((await request.get(href)).ok(), href).toBe(true);
  const manifest = await (await request.get('./manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('./');
  for (const icon of manifest.icons as { src: string }[]) expect((await request.get(`./${icon.src}`)).ok(), icon.src).toBe(true);

  const sw = await request.get('./sw.js');
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain('PRECACHE');

  const supported = await page.evaluate(() => 'serviceWorker' in navigator && window.isSecureContext);
  test.skip(!supported, 'this WebKit build has no service workers');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration()), undefined, { timeout: 15000 });
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.scope ?? '');
  expect(scope).toMatch(/\/$/);
});

test('B3-4: an iPhone Safari tab says how to keep the saves, and offers EXPORT once there is progress', async ({ page }) => {
  const errors = trackErrors(page);
  await iPhone(page, false);
  await page.goto('./');
  await waitScene(page, 'title');
  expect(await page.evaluate(() => window.__SD.pwa())).toMatchObject({ safariTab: true, standalone: false });
  let t = await title(page);
  expect(t.notice).toBe('ADD TO HOME SCREEN TO KEEP YOUR SAVES · SHARE > ADD TO HOME SCREEN');
  expect(t.saveShortcut).toBe('');
  // Settings says the saves may be cleared.
  await tap(page, 'title.settings');
  await waitScene(page, 'settings');
  expect(((await page.evaluate(() => window.__SD.screen().info)) as { status: string }).status).toMatch(/^SAVED IN SAFARI/);
  await tap(page, 'settings.back');
  await waitScene(page, 'title');
  // Progress (an achievement), then the next visit to the title: EXPORT SAVE in the corner.
  await page.evaluate(() => window.__SD.save.achievement('first-splash'));
  await page.evaluate(() => window.__SD.save.now());
  await page.reload();
  await waitScene(page, 'title');
  t = await title(page);
  expect(t.saveShortcut).toBe('export');
  await titleButtonsFit(page);
  await tap(page, 'title.saveShortcut');
  await waitScene(page, 'modal');
  const m = await page.evaluate(() => window.__SD.modal());
  expect(m.kind).toBe('export');
  expect(m.value.startsWith('SD1:')).toBe(true);
  await page.locator('[data-sd-modal] [data-action="done"]').tap();
  await waitScene(page, 'title');
  expect(errors).toEqual([]);
});

test('B3-4: the home-screen app: no Safari notice; a first launch offers IMPORT once', async ({ page }) => {
  const errors = trackErrors(page);
  await iPhone(page, true);
  await page.goto('./');
  await waitScene(page, 'title');
  expect(await page.evaluate(() => window.__SD.pwa())).toMatchObject({ safariTab: false, standalone: true, firstLaunch: true });
  let t = await title(page);
  expect(t.notice).toBe('PLAYED IN SAFARI BEFORE? IMPORT YOUR SAVE');
  expect(t.saveShortcut).toBe('import');
  await titleButtonsFit(page);
  // It opens Settings with IMPORT SAVE up.
  await tap(page, 'title.saveShortcut');
  await waitScene(page, 'modal');
  expect((await page.evaluate(() => window.__SD.modal())).kind).toBe('import');
  expect(await page.evaluate(() => window.__SD.stack)).toEqual(['title', 'settings', 'modal']);
  await page.locator('[data-sd-modal] [data-action="cancel"]').tap();
  await waitScene(page, 'settings');
  expect(((await page.evaluate(() => window.__SD.screen().info)) as { status: string }).status).toBe('SAVED ON THIS DEVICE');
  await tap(page, 'settings.back');
  await waitScene(page, 'title');
  // Only once: the next launch doesn't offer it again.
  await page.reload();
  await waitScene(page, 'title');
  t = await title(page);
  expect(t.notice).toBe('');
  expect(t.saveShortcut).toBe('');
  expect(errors).toEqual([]);
});

test('B3-4: a new version waiting: a toast mid-run, RELOAD on the title — it reloads and the run is still there', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  const room = (await page.evaluate(() => window.__SD.run()))!.run!.room;
  // The service worker reports an update mid-run: a toast, never a reload under the player.
  await page.evaluate(() => window.__SD.debug.pwaUpdate());
  await page.waitForFunction(() => window.__SD.toast()?.title === 'UPDATE READY', undefined, { timeout: 5000 });
  expect((await page.evaluate(() => window.__SD.toast()))?.line).toBe('RELOAD FROM THE TITLE');
  expect(await page.evaluate(() => window.__SD.scene)).toBe('run');
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  const t = await title(page);
  expect(t.reload).toBe(true);
  expect(t.notice).toBe('NEW VERSION READY · TAP RELOAD');
  await titleButtonsFit(page);
  // One tap: saved, reloaded (the marker is gone), and Continue is there.
  await page.evaluate(() => ((window as unknown as { __before: boolean }).__before = true));
  await tap(page, 'title.reload');
  await page.waitForFunction(() => !(window as unknown as { __before?: boolean }).__before && window.__SD?.scene === 'title', undefined, { timeout: 15000 });
  const after = await title(page);
  expect(after.continue).toBe(true);
  expect(after.reload).toBe(false);
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  expect((await page.evaluate(() => window.__SD.run()))!.run!.room).toBe(room);
  expect(errors).toEqual([]);
});
