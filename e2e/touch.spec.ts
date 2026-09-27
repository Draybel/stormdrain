import { expect, test, type Page } from '@playwright/test';
import type { SimSummary } from '../src/sim/sim';

/**
 * Multi-touch contract (ARCHITECTURE §2) in real WebKit: synthetic touch PointerEvents with
 * distinct pointerIds, dispatched on the canvas at game-pixel positions.
 * Polish batch 3 (B3-1): with the iPhone 15 home-screen insets, thumbs that land on the black letterbox beside the
 * image still drive the sticks all the way (full speed to the left, firing to the right), and the perf overlay's
 * gesture can't be set off in play.
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

/** Starts a run and installs `window.__touch(type, id, gx, gy)` (game px → client px). */
async function startRun(page: Page): Promise<void> {
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  // Phase 2 features live in the training yard (New Run starts a real floor run since Phase 3A).
  await page.evaluate(() => window.__SD.debug.yard());
  await page.waitForFunction(() => window.__SD.sim?.trainingRoom === true);
  await page.evaluate(() => {
    const canvas = document.getElementById('screen')!;
    (window as unknown as { __touch: unknown }).__touch = (type: string, id: number, gx: number, gy: number) => {
      const v = window.__SD.view;
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: 'touch',
          isPrimary: false,
          bubbles: true,
          cancelable: true,
          clientX: v.x + gx * v.scale,
          clientY: v.y + gy * v.scale,
        }),
      );
    };
  });
}

type Touch = (type: string, id: number, gx: number, gy: number) => void;

/** A touch event at CLIENT (CSS) px — anywhere on the page, the letterbox included. */
async function touchClient(page: Page, type: string, id: number, cx: number, cy: number): Promise<void> {
  await page.evaluate(
    ([t, i, x, y]) => {
      document.getElementById('screen')!.dispatchEvent(
        new PointerEvent(t as string, {
          pointerId: i as number,
          pointerType: 'touch',
          isPrimary: false,
          bubbles: true,
          cancelable: true,
          clientX: x as number,
          clientY: y as number,
        }),
      );
    },
    [type, id, cx, cy] as const,
  );
}

/** The iPhone 15 landscape insets on the probe the display reads (Playwright's WebKit reports none). */
async function applyInsets(page: Page): Promise<void> {
  await page.evaluate(() => {
    const probe = document.getElementById('safe-probe')!;
    probe.style.padding = '0px 59px 21px 59px';
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => window.__SD.safe.left === 59 && window.__SD.view.x >= 58);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** Puts Wren at the left end of row 2, which is open floor all the way across (~2 s of walking). */
async function placeInOpenRow(page: Page): Promise<void> {
  await page.evaluate(() => window.__SD.sim!.world.player.placeAt(8, 40));
}

async function touch(page: Page, type: string, id: number, gx: number, gy: number): Promise<void> {
  await page.evaluate(
    ([t, i, x, y]) => (window as unknown as { __touch: Touch }).__touch(t as string, i as number, x as number, y as number),
    [type, id, gx, gy] as const,
  );
}

async function run(page: Page): Promise<SimSummary> {
  return (await page.evaluate(() => window.__SD.run()))!;
}

/** Game-pixel centre of a registered button. */
async function centre(page: Page, id: string): Promise<{ x: number; y: number }> {
  const b = (await page.evaluate((i) => window.__SD.button(i), id))!;
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

test('two thumbs: moving and shooting at the same time', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await placeInOpenRow(page);
  const a = await run(page);
  await touch(page, 'pointerdown', 11, 40, 150);
  await touch(page, 'pointerdown', 12, 330, 150);
  await touch(page, 'pointermove', 11, 62, 150); // walk right
  await touch(page, 'pointermove', 12, 330, 128); // shoot up
  await page.waitForTimeout(700);
  const b = await run(page); // both still held
  expect(b.player.x).toBeGreaterThan(a.player.x + 15);
  expect(b.player.vx).toBeGreaterThan(50);
  expect(b.counters.shots - a.counters.shots).toBeGreaterThanOrEqual(2);
  // Lift only the move thumb: firing continues, walking stops.
  await touch(page, 'pointerup', 11, 62, 150);
  await page.waitForTimeout(450);
  const c = await run(page);
  expect(Math.hypot(c.player.vx, c.player.vy)).toBe(0);
  expect(c.counters.shots).toBeGreaterThan(b.counters.shots);
  await touch(page, 'pointerup', 12, 330, 128);
  await page.waitForTimeout(400);
  const d = await run(page);
  await page.waitForTimeout(400);
  expect((await run(page)).counters.shots).toBe(d.counters.shots);
  expect(errors).toEqual([]);
});

test('a finger that starts on a button never moves or shoots', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const bomb = await centre(page, 'run.bomb');
  const cons = await centre(page, 'run.consumable');
  const a = await run(page);
  // Start on bomb (right side) and drag across the shoot half; start on the consumable
  // button (left side) and drag across the move half.
  await touch(page, 'pointerdown', 21, bomb.x, bomb.y);
  await touch(page, 'pointerdown', 22, cons.x, cons.y);
  for (let i = 1; i <= 5; i++) {
    await touch(page, 'pointermove', 21, bomb.x - i * 8, bomb.y + i * 10);
    await touch(page, 'pointermove', 22, cons.x + i * 8, cons.y + i * 10);
  }
  await page.waitForTimeout(500);
  const b = await run(page);
  expect(b.counters.shots).toBe(a.counters.shots);
  expect(b.player.x).toBe(a.player.x);
  expect(b.player.y).toBe(a.player.y);
  await touch(page, 'pointerup', 21, bomb.x - 40, bomb.y + 50);
  await touch(page, 'pointerup', 22, cons.x + 40, cons.y + 50);

  // Same for the pause button: it pauses, and the drag that follows does nothing.
  const pause = await centre(page, 'run.pause');
  await touch(page, 'pointerdown', 23, pause.x, pause.y);
  await waitScene(page, 'pause');
  await touch(page, 'pointermove', 23, pause.x - 60, pause.y + 100);
  await touch(page, 'pointerup', 23, pause.x - 60, pause.y + 100);
  expect(await page.evaluate(() => window.__SD.scene)).toBe('pause');
  await tap(page, 'pause.resume');
  await waitScene(page, 'run');
  await page.waitForTimeout(300);
  const c = await run(page);
  expect(c.counters.shots).toBe(a.counters.shots);
  expect(c.player.x).toBe(a.player.x);
  expect(c.player.y).toBe(a.player.y);
  expect(errors).toEqual([]);
});

test('buttons still activate while both sticks are held', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  await placeInOpenRow(page);
  await touch(page, 'pointerdown', 31, 40, 150);
  await touch(page, 'pointerdown', 32, 330, 150);
  await touch(page, 'pointermove', 31, 62, 150); // walk right
  await touch(page, 'pointermove', 32, 330, 172); // shoot down
  await page.waitForTimeout(300);
  const a = await run(page);
  // Third finger taps the (placeholder) bomb button: sticks keep working.
  const bomb = await centre(page, 'run.bomb');
  await touch(page, 'pointerdown', 33, bomb.x, bomb.y);
  await touch(page, 'pointerup', 33, bomb.x, bomb.y);
  await page.waitForTimeout(400);
  const b = await run(page);
  expect(b.player.x).toBeGreaterThan(a.player.x + 10);
  expect(b.counters.shots).toBeGreaterThan(a.counters.shots);
  // Third finger taps pause: the run pauses even though both thumbs are down.
  const pause = await centre(page, 'run.pause');
  await touch(page, 'pointerdown', 34, pause.x, pause.y);
  await touch(page, 'pointerup', 34, pause.x, pause.y);
  await waitScene(page, 'pause');
  await touch(page, 'pointerup', 31, 62, 150);
  await touch(page, 'pointerup', 32, 330, 172);
  // Menu (release-trigger) buttons work with a real tap while the pause overlay is up.
  await tap(page, 'pause.resume');
  await waitScene(page, 'run');
  expect(errors).toEqual([]);
});

test('B3-1: a move thumb landing on the left letterbox and pushing left reaches full speed', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  // The home-screen app: the 59 pt insets are the letterbox; a Safari tab has its own black bars beside the image.
  if ((page.viewportSize()?.width ?? 0) >= 800) await applyInsets(page);
  // Wren at the right end of the open row, so she can walk left for a while.
  await page.evaluate(() => window.__SD.sim!.world.player.placeAt(200, 40));
  const v = await page.evaluate(() => window.__SD.view);
  const y = v.y + 150 * v.scale;
  // The thumb lands on the black bar 10 pt left of the image and pushes to the bezel.
  expect(v.x).toBeGreaterThan(40);
  await touchClient(page, 'pointerdown', 41, v.x - 10, y);
  for (const x of [v.x - 20, v.x / 2, 8, 0]) await touchClient(page, 'pointermove', 41, x, y);
  await page.waitForTimeout(450);
  const r = await run(page);
  const max = r.stats.moveSpeed!;
  expect(r.player.vx).toBeLessThan(0);
  expect(Math.abs(r.player.vx)).toBeGreaterThanOrEqual(0.9 * max);
  expect(Math.abs(r.player.vy)).toBeLessThan(0.05 * max);
  // The stick's origin really is off the image (the drawn ring is clamped in, the stick isn't).
  expect((await page.evaluate(() => window.__SD.sticks().move)).originX).toBeLessThan(0);
  await touchClient(page, 'pointerup', 41, 0, y);
  expect(errors).toEqual([]);
});

test('B3-1: an aim thumb in the right letterbox moving right fires at 0°', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  // The home-screen app: the 59 pt insets are the letterbox; a Safari tab has its own black bars beside the image.
  if ((page.viewportSize()?.width ?? 0) >= 800) await applyInsets(page);
  await placeInOpenRow(page);
  const a = await run(page);
  const v = await page.evaluate(() => ({ ...window.__SD.view, iw: window.innerWidth }));
  const right = v.x + v.w;
  expect(v.iw - right).toBeGreaterThan(40);
  const y = v.y + 150 * v.scale;
  await touchClient(page, 'pointerdown', 42, right + 10, y);
  for (const x of [right + 20, right + 30, v.iw - 1]) await touchClient(page, 'pointermove', 42, x, y);
  await page.waitForTimeout(500);
  const aim = await page.evaluate(() => ({ stick: window.__SD.sticks().aim, ax: window.__SD.sim!.world.player.aimX, ay: window.__SD.sim!.world.player.aimY }));
  expect(aim.stick.hasDir).toBe(true);
  expect([aim.stick.dirX, aim.stick.dirY]).toEqual([1, 0]);
  expect([aim.ax, aim.ay]).toEqual([1, 0]);
  const b = await run(page);
  expect(b.counters.shots - a.counters.shots).toBeGreaterThanOrEqual(2);
  await touchClient(page, 'pointerup', 42, v.iw - 1, y);
  expect(errors).toEqual([]);
});

test('B3-1: two sticks plus a BOMB tap within 250 ms leave the perf overlay alone; the menu gesture still works', async ({ page }) => {
  const errors = trackErrors(page);
  await startRun(page);
  const bomb = await centre(page, 'run.bomb');
  // A room entry: both thumbs land and a third finger taps BOMB at once.
  await touch(page, 'pointerdown', 51, 40, 150);
  await touch(page, 'pointerdown', 52, 330, 150);
  await touch(page, 'pointerdown', 53, bomb.x, bomb.y);
  await touch(page, 'pointerup', 53, bomb.x, bomb.y);
  await page.waitForTimeout(300);
  await touch(page, 'pointerup', 51, 40, 150);
  await touch(page, 'pointerup', 52, 330, 150);
  expect((await page.evaluate(() => window.__SD.sticks())).perf).toBe(false);
  // On a menu (no sticks): three fingers on no button, held 0.7 s, lifted together — the overlay toggles.
  await page.evaluate(() => window.__SD.debug.title());
  await waitScene(page, 'title');
  const spots = [
    [110, 22],
    [192, 28],
    [270, 22],
  ] as const;
  for (let i = 0; i < 3; i++) await touch(page, 'pointerdown', 61 + i, spots[i]![0], spots[i]![1]);
  await page.waitForTimeout(700);
  for (let i = 0; i < 3; i++) await touch(page, 'pointerup', 61 + i, spots[i]![0], spots[i]![1]);
  expect((await page.evaluate(() => window.__SD.sticks())).perf).toBe(true);
  await page.evaluate(() => window.__SD.debug.overlay(false));
  expect(errors).toEqual([]);
});

test('game image and HUD stay inside simulated iPhone safe-area insets', async ({ page }) => {
  // Home-screen (full 852 pt width) only: the 734 pt Safari profile already excludes the
  // side areas, so iPhone insets on top of it would describe no real device.
  test.skip((page.viewportSize()?.width ?? 0) < 800, 'insets apply to the full-screen viewport');
  const errors = trackErrors(page);
  await startRun(page);
  // Playwright's WebKit reports zero insets; emulate the iPhone 15 landscape ones
  // (Dynamic Island side 59 pt, home indicator 21 pt) on the probe the Display reads.
  await page.evaluate(() => {
    const probe = document.getElementById('safe-probe')!;
    probe.style.padding = '0px 59px 21px 59px';
    window.dispatchEvent(new Event('resize'));
  });
  await page.waitForFunction(() => window.__SD.safe.left === 59);
  await page.waitForTimeout(100);
  const g = await page.evaluate(() => ({
    view: window.__SD.view,
    safe: window.__SD.safe,
    iw: window.innerWidth,
    ih: window.innerHeight,
    buttons: window.__SD.buttons(),
  }));
  const { view, safe, iw, ih } = g;
  expect(view.x).toBeGreaterThanOrEqual(safe.left - 0.01);
  expect(view.y).toBeGreaterThanOrEqual(safe.top - 0.01);
  expect(view.x + view.w).toBeLessThanOrEqual(iw - safe.right + 0.01);
  expect(view.y + view.h).toBeLessThanOrEqual(ih - safe.bottom + 0.01);
  // Fills the limiting dimension of the safe rect (minus at most one device pixel of rounding).
  const fitW = iw - safe.left - safe.right;
  const fitH = ih - safe.top - safe.bottom;
  expect(Math.max(view.w / fitW, view.h / fitH)).toBeGreaterThan(0.89);
  for (const b of g.buttons) {
    expect(b.css.x).toBeGreaterThanOrEqual(safe.left - 0.01);
    expect(b.css.x + b.css.w).toBeLessThanOrEqual(iw - safe.right + 0.01);
    expect(b.css.y + b.css.h).toBeLessThanOrEqual(ih - safe.bottom + 0.01);
    expect(b.css.h).toBeGreaterThanOrEqual(40); // thumb-sized
  }
  // Touch mapping honours the new layout: a tap on pause still hits it.
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  expect(errors).toEqual([]);
});
