import { expect, test } from '@playwright/test';

/**
 * Phase 4A: the production build is an installable, offline-capable app — the manifest and icons are
 * linked, dist/sw.js is served, and main.ts registers it (where the browser supports service workers).
 */

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
