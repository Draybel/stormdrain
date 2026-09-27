import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 5, real WebKit (both iPhone profiles): the FULL in-run HUD — two rows of hearts, the coin / bomb /
 * key counters, the active item with its charge bar, the consumable with two trinkets beside it, the
 * minimap, pause, bomb (and Pip's DASH button) — lies inside the drawn game image, the game image inside
 * the viewport and the safe area, every button is thumb-sized, nothing overlaps another button and no HUD
 * element covers the room. Checked in the default layout, left-handed, at 150 % buttons and both at once;
 * the home-screen profile repeats it all with the iPhone 15's landscape insets (Dynamic Island + home
 * indicator) applied.
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

/** Title → NEW RUN → START by real taps; god mode; every HUD slot filled. */
async function fullHudRun(page: Page): Promise<void> {
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await fill(page);
}

async function fill(page: Page): Promise<void> {
  await page.evaluate(() => {
    const d = window.__SD.debug;
    d.god(true);
    // Hearts past one row, 99 of everything, an active with a charge bar, two trinkets, a consumable.
    for (const id of ['sardine-tin', 'sardine-tin', 'hand-me-down-pockets', 'rusty-thimble', 'pocket-lint', 'jar-of-lightning', 'bomb-sticker']) d.give(id);
    d.add(99, 99, 99);
  });
  await page.waitForFunction(() => {
    const ids = window.__SD.hud().map((r) => r.id);
    return ['hearts', 'counters', 'charge', 'trinkets'].every((i) => ids.includes(i));
  });
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Room interior in game px (walls excluded). */
const INTERIOR: Rect = { x: 88, y: 64, w: 208, h: 112 };

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Every HUD element and button in CSS px vs the image, the viewport and the safe area. */
async function checkHud(page: Page, label: string, dash: boolean): Promise<void> {
  const g = await page.evaluate(() => ({
    view: window.__SD.view,
    safe: window.__SD.safe,
    iw: window.innerWidth,
    ih: window.innerHeight,
    hud: window.__SD.hud(),
    buttons: window.__SD.buttons(),
    health: window.__SD.run()!.health,
  }));
  const { view, safe, iw, ih } = g;
  const eps = 0.51;
  // The game image: inside the viewport, inside the safe area.
  expect(view.x, `${label}: image left`).toBeGreaterThanOrEqual(Math.max(0, safe.left) - eps);
  expect(view.y, `${label}: image top`).toBeGreaterThanOrEqual(Math.max(0, safe.top) - eps);
  expect(view.x + view.w, `${label}: image right`).toBeLessThanOrEqual(iw - safe.right + eps);
  expect(view.y + view.h, `${label}: image bottom`).toBeLessThanOrEqual(ih - safe.bottom + eps);
  const css = (r: Rect): Rect => ({ x: view.x + r.x * view.scale, y: view.y + r.y * view.scale, w: r.w * view.scale, h: r.h * view.scale });
  const inside = (r: Rect, what: string): void => {
    expect(r.x, `${label}: ${what} left`).toBeGreaterThanOrEqual(Math.max(view.x, safe.left) - eps);
    expect(r.y, `${label}: ${what} top`).toBeGreaterThanOrEqual(Math.max(view.y, safe.top) - eps);
    expect(r.x + r.w, `${label}: ${what} right`).toBeLessThanOrEqual(Math.min(view.x + view.w, iw - safe.right) + eps);
    expect(r.y + r.h, `${label}: ${what} bottom`).toBeLessThanOrEqual(Math.min(view.y + view.h, ih - safe.bottom) + eps);
  };
  // HUD elements (game px from the run scene): all there, on screen, never over the room.
  const ids = g.hud.map((r) => r.id);
  expect(ids, label).toEqual(expect.arrayContaining(['hearts', 'counters', 'charge', 'trinkets']));
  for (const r of g.hud) {
    inside(css(r), r.id);
    expect(overlaps(r, INTERIOR), `${label}: ${r.id} covers the room`).toBe(false);
  }
  // Two rows of hearts (more than six).
  const hearts = g.hud.find((r) => r.id === 'hearts')!;
  expect(hearts.h, `${label}: two heart rows (${g.health})`).toBeGreaterThan(12);
  // Buttons: the HUD's own (active, consumable, bomb, pause, minimap, dash) all there, thumb-sized, apart.
  const want = ['run.pause', 'run.bomb', 'run.active', 'run.consumable', 'run.map', ...(dash ? ['run.dash'] : [])];
  const byId = new Map(g.buttons.map((b) => [b.id, b]));
  for (const id of want) expect(byId.has(id), `${label}: ${id}`).toBe(true);
  const hudButtons = g.buttons.filter((b) => b.id.startsWith('run.'));
  for (const b of hudButtons) {
    inside(b.css, b.id);
    expect(overlaps(b, INTERIOR), `${label}: ${b.id} covers the room`).toBe(false);
    if (b.id !== 'run.map') expect(b.css.h, `${label}: ${b.id} is thumb-sized`).toBeGreaterThanOrEqual(40);
  }
  for (let i = 0; i < hudButtons.length; i++) {
    for (let j = i + 1; j < hudButtons.length; j++) {
      const a = hudButtons[i]!;
      const b = hudButtons[j]!;
      expect(overlaps(a, b), `${label}: ${a.id} overlaps ${b.id}`).toBe(false);
    }
  }
  // The counters and hearts don't sit under a button.
  for (const r of g.hud.filter((x) => x.id === 'hearts' || x.id === 'counters')) {
    for (const b of hudButtons) expect(overlaps(r, b), `${label}: ${r.id} under ${b.id}`).toBe(false);
  }
}

const LAYOUTS: { name: string; buttonScale: number; leftHanded: boolean }[] = [
  { name: 'default', buttonScale: 1, leftHanded: false },
  { name: 'left-handed', buttonScale: 1, leftHanded: true },
  { name: '150 % buttons', buttonScale: 1.5, leftHanded: false },
  { name: 'left-handed, 150 % buttons', buttonScale: 1.5, leftHanded: true },
];

async function everyLayout(page: Page, dash: boolean, prefix: string): Promise<void> {
  for (const l of LAYOUTS) {
    await page.evaluate((s) => window.__SD.debug.settings({ buttonScale: s.buttonScale, leftHanded: s.leftHanded }), l);
    // The run scene lays its buttons out again on the next frame.
    await page.waitForFunction(
      (s) => {
        const set = window.__SD.debug.settings();
        const pause = window.__SD.button('run.pause');
        return set.buttonScale === s.buttonScale && set.leftHanded === s.leftHanded && !!pause;
      },
      l,
    );
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await checkHud(page, `${prefix}${l.name}`, dash);
  }
}

test('the full HUD is on screen, inside the safe area and off the room in every layout', async ({ page }) => {
  const errors = trackErrors(page);
  await fullHudRun(page);
  await everyLayout(page, false, '');
  expect(errors).toEqual([]);
});

test("Pip's DASH button joins the HUD without crowding it", async ({ page }) => {
  const errors = trackErrors(page);
  await fullHudRun(page);
  // A fresh run as Pip (the debug restart keeps everything else as a new run would).
  await page.evaluate(() => window.__SD.debug.runAt(1, 'main', null, 11, [], 'pip'));
  await page.waitForFunction(() => window.__SD.sim?.world.player.character.id === 'pip' && !!window.__SD.button('run.dash'));
  await fill(page);
  await everyLayout(page, true, 'pip, ');
  expect(errors).toEqual([]);
});

test('with the iPhone 15 landscape insets applied, nothing leaves the safe area', async ({ page }) => {
  // Home-screen (full 852 pt width) only: the 734 pt Safari profile already excludes the side areas.
  test.skip((page.viewportSize()?.width ?? 0) < 800, 'insets apply to the full-screen viewport');
  const errors = trackErrors(page);
  await fullHudRun(page);
  // Playwright's WebKit reports zero insets; emulate the iPhone 15 landscape ones (Dynamic Island side 59 pt,
  // home indicator 21 pt) on the probe the display reads.
  await page.evaluate(() => {
    const probe = document.getElementById('safe-probe')!;
    probe.style.padding = '0px 59px 21px 59px';
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => window.__SD.safe.left === 59 && window.__SD.safe.bottom === 21);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await everyLayout(page, false, 'insets, ');
  expect(errors).toEqual([]);
});
