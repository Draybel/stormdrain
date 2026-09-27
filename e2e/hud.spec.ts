import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 5, real WebKit (both iPhone profiles): the FULL in-run HUD — two rows of hearts, the coin / bomb /
 * key counters, the active item with its charge bar, the consumable with two trinkets beside it, the
 * minimap, pause, bomb (and Pip's DASH button) — lies inside the drawn game image, the game image inside
 * the viewport and the safe area, every button is thumb-sized, nothing overlaps another button and no HUD
 * element covers the room. Checked in the default layout, left-handed, at 150 % buttons and both at once;
 * the home-screen profile repeats it all with the iPhone 15's landscape insets (Dynamic Island + home
 * indicator) applied.
 * Polish batch 3 (B3-2): right / left-handed × 75 / 100 / 125 / 150 % × with / without Pip's DASH — no button's HIT
 * rect (rect + pad) touches a MOVE / SHOOT resting ring, another button or the HUD; every run button is >= 44 CSS px;
 * and a touch on each resting ring's centre plus a 6 px drag gets its stick (the SHOOT one fires: no bomb, no dash).
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

function hitRect(b: Rect & { pad: number }): Rect {
  return { x: b.x - b.pad, y: b.y - b.pad, w: b.w + 2 * b.pad, h: b.h + 2 * b.pad };
}

/** Distance from a point to the nearest point of a rect (game px). */
function distTo(r: Rect, p: { x: number; y: number }): number {
  return Math.hypot(Math.max(0, r.x - p.x, p.x - (r.x + r.w)), Math.max(0, r.y - p.y, p.y - (r.y + r.h)));
}

/** Synthetic touch pointers at game px (the canvas maps them like a finger). */
async function touchGame(page: Page, type: string, id: number, gx: number, gy: number): Promise<void> {
  await page.evaluate(
    ([t, i, x, y]) => {
      const v = window.__SD.view;
      document.getElementById('screen')!.dispatchEvent(
        new PointerEvent(t as string, {
          pointerId: i as number,
          pointerType: 'touch',
          isPrimary: false,
          bubbles: true,
          cancelable: true,
          clientX: v.x + (x as number) * v.scale,
          clientY: v.y + (y as number) * v.scale,
        }),
      );
    },
    [type, id, gx, gy] as const,
  );
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
    rests: window.__SD.stickRests(),
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
    // Polish batch 3: every run button (the minimap too) is at least 44 CSS px on both profiles.
    expect(Math.min(b.css.w, b.css.h), `${label}: ${b.id} is thumb-sized`).toBeGreaterThanOrEqual(44 - 0.01);
  }
  // No hit rect reaches another button, a resting stick ring, the hearts / counters or another button's decoration.
  const rests = g.rests;
  for (const b of hudButtons) {
    const h = hitRect(b);
    for (const o of hudButtons) if (o !== b) expect(overlaps(h, o), `${label}: ${b.id}'s hit rect covers ${o.id}`).toBe(false);
    for (const [name, rest] of [
      ['left', rests.left],
      ['right', rests.right],
    ] as const) {
      expect(distTo(h, rest), `${label}: ${b.id} reaches the ${name} stick ring`).toBeGreaterThanOrEqual(rests.ring);
    }
    for (const r of g.hud) {
      const own = (r.id === 'charge' && b.id === 'run.active') || (r.id === 'trinkets' && b.id === 'run.consumable');
      if (!own && r.id !== 'banner') expect(overlaps(h, r), `${label}: ${b.id}'s hit rect covers the ${r.id}`).toBe(false);
    }
  }
}

/**
 * A thumb on each resting ring's centre + a 6 px drag gets its stick: the SHOOT ring fires (no bomb, no dash), the MOVE
 * ring walks (no item used). Left-handed swaps the rings.
 */
async function checkRestTouches(page: Page, label: string, leftHanded: boolean): Promise<void> {
  const rests = await page.evaluate(() => window.__SD.stickRests());
  const shoot = leftHanded ? rests.left : rests.right;
  const move = leftHanded ? rests.right : rests.left;
  // Stand in the open, away from walls and doors.
  await page.evaluate(() => window.__SD.sim!.world.player.placeAt(104, 56));
  const a = (await page.evaluate(() => ({ run: window.__SD.run()!, dashCd: window.__SD.sim!.world.player.mech.dashCd })))!;
  await touchGame(page, 'pointerdown', 71, shoot.x, shoot.y);
  await touchGame(page, 'pointermove', 71, shoot.x, shoot.y - 6);
  await page.waitForTimeout(250);
  const b = await page.evaluate(() => ({ run: window.__SD.run()!, dashCd: window.__SD.sim!.world.player.mech.dashCd, aim: window.__SD.sticks().aim }));
  await touchGame(page, 'pointerup', 71, shoot.x, shoot.y - 6);
  expect(b.aim.hasDir, `${label}: the SHOOT ring's touch got the aim stick`).toBe(true);
  expect(b.run.counters.shots - a.run.counters.shots, `${label}: the SHOOT ring fires`).toBeGreaterThan(0);
  expect(b.run.counters.bombsPlaced - a.run.counters.bombsPlaced, `${label}: no bomb`).toBe(0);
  expect(b.dashCd, `${label}: no dash`).toBe(0);
  const inv0 = a.run.inv;
  await touchGame(page, 'pointerdown', 72, move.x, move.y);
  await touchGame(page, 'pointermove', 72, move.x + 6, move.y);
  await page.waitForTimeout(150);
  const c = await page.evaluate(() => ({ run: window.__SD.run()!, move: window.__SD.sticks().move }));
  await touchGame(page, 'pointerup', 72, move.x + 6, move.y);
  expect(c.move.active, `${label}: the MOVE ring's touch got the move stick`).toBe(true);
  expect(c.run.player.vx, `${label}: the MOVE ring walks`).toBeGreaterThan(0);
  expect(c.run.inv.consumables, `${label}: no consumable used`).toEqual(inv0.consumables);
  expect(c.run.inv.active?.charge, `${label}: no active used`).toBe(inv0.active?.charge);
  await page.waitForTimeout(100);
}

/** Right / left-handed × every BUTTON SIZE step (75 % reads as 100 %: the 44 pt floor). */
const LAYOUTS: { name: string; buttonScale: number; leftHanded: boolean }[] = [];
for (const leftHanded of [false, true]) {
  for (const buttonScale of [0.75, 1, 1.25, 1.5]) {
    LAYOUTS.push({ name: `${leftHanded ? 'left-handed' : 'right-handed'}, ${buttonScale * 100} % buttons`, buttonScale, leftHanded });
  }
}

async function everyLayout(page: Page, dash: boolean, prefix: string): Promise<void> {
  for (const l of LAYOUTS) {
    await page.evaluate((s) => window.__SD.debug.settings({ buttonScale: s.buttonScale, leftHanded: s.leftHanded }), l);
    // The run scene lays its buttons out again on the next frame (an old 75 % is kept at 100 %).
    await page.waitForFunction(
      (s) => {
        const set = window.__SD.debug.settings();
        const pause = window.__SD.button('run.pause');
        return set.buttonScale === Math.max(1, s.buttonScale) && set.leftHanded === s.leftHanded && !!pause;
      },
      l,
    );
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await checkHud(page, `${prefix}${l.name}`, dash);
    await checkRestTouches(page, `${prefix}${l.name}`, l.leftHanded);
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
  // And Pip, whose DASH makes three thumb buttons (polish batch 3).
  await page.evaluate(() => window.__SD.debug.runAt(1, 'main', null, 11, [], 'pip'));
  await page.waitForFunction(() => window.__SD.sim?.world.player.character.id === 'pip' && !!window.__SD.button('run.dash'));
  await fill(page);
  await everyLayout(page, true, 'insets, pip, ');
  expect(errors).toEqual([]);
});
