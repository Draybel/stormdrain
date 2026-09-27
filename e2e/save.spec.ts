import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 4A in real WebKit: the run save survives a page reload (New Run → walk through a door → reload →
 * Continue resumes the same floor, room and items), a finished run leaves no Continue, and settings /
 * meta progress persist across reloads.
 * Polish batch 3 (B3-3): a room's clear is saved at once (a beaten boss stays beaten through a reload), pausing /
 * backgrounding a cleared room saves what was taken since, and an exception returns to the title with a toast and the
 * last good save untouched.
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

async function visible(page: Page, id: string): Promise<boolean> {
  return page.evaluate((i) => window.__SD.buttons().some((b) => b.id === i), id);
}

test('a run save survives a reload: Continue resumes the same floor and room', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await page.evaluate(() => window.__SD.debug.god(true));
  // Something to carry: an item and a few coins.
  await page.evaluate(() => {
    window.__SD.debug.give('brick-chip');
    window.__SD.debug.add(5, 0, 0);
  });

  // Walk through an open door into the next room.
  const before = (await page.evaluate(() => window.__SD.run()))!.run!;
  const side = before.doors.findIndex((d) => d.kind !== 0 && d.kind !== 6 && d.state === 2);
  expect(side).toBeGreaterThanOrEqual(0);
  const to = before.doors[side]!.to;
  const key = ['KeyW', 'KeyD', 'KeyS', 'KeyA'][side]!;
  await page.evaluate((s) => {
    window.__SD.sim!.world.player.placeAt([104, 190, 104, 18][s]!, [18, 56, 94, 56][s]!);
  }, side);
  await page.keyboard.down(key);
  await page.waitForFunction((t) => window.__SD.run()!.run!.room === t, to, { timeout: 5000 });
  await page.keyboard.up(key);
  await page.waitForFunction(() => !window.__SD.presentation()!.slide);
  const at = (await page.evaluate(() => window.__SD.run()))!;
  const seed = await page.evaluate(() => window.__SD.sim!.seed);
  expect(at.inv.passives).toContain('brick-chip');
  const meta = await page.evaluate(() => window.__SD.meta());
  expect(meta.hasRun).toBe(true);
  expect(meta.runSaves).toBeGreaterThanOrEqual(2);
  expect(meta.stats.runs).toBe(1);

  // Reload the page: the title offers Continue.
  await page.reload();
  await waitScene(page, 'title');
  await page.waitForFunction(() => window.__SD.buttons().some((b) => b.id === 'title.continue'));
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  const back = (await page.evaluate(() => window.__SD.run()))!;
  expect(await page.evaluate(() => window.__SD.sim!.seed)).toBe(seed);
  expect(back.run!.floor).toBe(at.run!.floor);
  expect(back.run!.room).toBe(to);
  expect(back.run!.visited).toBe(at.run!.visited);
  expect(back.inv).toEqual(at.inv);
  expect(back.health).toBe(at.health);
  // Continuing is not a new run.
  expect((await page.evaluate(() => window.__SD.meta())).stats.runs).toBe(1);
  // It keeps playing.
  const t0 = back.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 20, t0);
  expect(errors).toEqual([]);
});

test('a finished run leaves no Continue; progress and settings persist across reloads', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  // A setting changed during the run.
  await page.evaluate(() => window.__SD.debug.aim360(true));
  // An achievement toast shows without stopping play.
  await page.evaluate(() => window.__SD.save.achievement('first-splash'));
  await page.waitForFunction(() => window.__SD.toast()?.title.includes('FIRST SPLASH') ?? false);
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 10, t0);
  expect(await page.evaluate(() => window.__SD.scene)).toBe('run');

  // Death ends the run: its save is gone at once.
  await page.evaluate(() => window.__SD.debug.kill());
  await page.waitForFunction(() => !window.__SD.meta().hasRun);
  await page.waitForFunction(() => window.__SD.presentation()?.ending === 'death', undefined, { timeout: 6000 });
  await page.waitForTimeout(900);
  await waitScene(page, 'over');
  await tap(page, 'over.title');
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);

  await page.reload();
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);
  const m = await page.evaluate(() => window.__SD.meta());
  expect(m.loaded).toBe('ok');
  expect(m.stats.runs).toBe(1);
  expect(m.stats.deaths).toBe(1);
  expect(m.achievements).toContain('first-splash');
  // The setting came back from the save.
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  expect(await page.evaluate(() => window.__SD.meta().stats.runs)).toBe(2);
  const aim = await page.evaluate(() => {
    const raw = localStorage.getItem('stormdrain.meta');
    return raw ? (JSON.parse(raw).data.settings.aim360 as boolean) : null;
  });
  expect(aim).toBe(true);
  expect(errors).toEqual([]);
});

/** The run save's room state as stored (decoded from the envelope). */
async function storedRoom(page: Page): Promise<{ current: number; cleared: boolean; trapdoor: boolean } | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('stormdrain.run');
    if (!raw) return null;
    const data = JSON.parse(raw).data as { run: { current: number; rooms: { cleared: boolean; trapdoor: boolean }[] } };
    const st = data.run.rooms[data.run.current]!;
    return { current: data.run.current, cleared: st.cleared, trapdoor: st.trapdoor };
  });
}

test('B3-3: a cleared room is saved at once — a beaten boss stays beaten through a reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await page.evaluate(() => window.__SD.debug.god(true));
  // Into the floor's boss room (through its door, like a visitor), then beat the boss.
  await page.evaluate(() => window.__SD.debug.teleport());
  await page.waitForFunction(() => window.__SD.run()!.run!.roomType === 'boss' && !window.__SD.presentation()!.slide);
  const room = (await page.evaluate(() => window.__SD.run()))!.run!.room;
  expect((await storedRoom(page))?.cleared).toBe(false);
  await page.waitForFunction(
    () => {
      window.__SD.debug.clearRoom();
      return window.__SD.run()!.run!.cleared;
    },
    undefined,
    { timeout: 20_000, polling: 100 },
  );
  // No pause, no background: the clear itself was saved (the trapdoor and the reward with it).
  const saved = await storedRoom(page);
  expect(saved).toEqual({ current: room, cleared: true, trapdoor: true });
  expect((await page.evaluate(() => window.__SD.meta())).stats.bossKills).toBe(1);

  await page.reload();
  await waitScene(page, 'title');
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  const back = (await page.evaluate(() => window.__SD.run()))!;
  expect(back.run!.room).toBe(room);
  expect(back.run!.cleared).toBe(true);
  expect(back.run!.trapdoor).toBe(true);
  expect(back.boss).toBeNull();
  expect(back.enemies.filter((e) => e.hp > 0)).toEqual([]);
  // Not fought (or counted) again.
  const t0 = back.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 30, t0);
  expect((await page.evaluate(() => window.__SD.meta())).stats.bossKills).toBe(1);
  expect(errors).toEqual([]);
});

test('B3-3: an exception in the game returns to the title with a toast; the last good save stays', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await page.evaluate(() => window.__SD.debug.god(true));
  const to = await page.evaluate(() => {
    const run = window.__SD.sim!.run!;
    for (let side = 0; side < 4; side++) if (run.goThroughDoor(side)) return run.data.current;
    return -1;
  });
  expect(to).toBeGreaterThanOrEqual(0);
  // (A debug door skips the run scene's room-entry save: save it the way a room entry does.)
  expect(await page.evaluate(() => window.__SD.save.now())).toBe(true);
  const before = await page.evaluate(() => localStorage.getItem('stormdrain.run'));
  expect(before).not.toBeNull();
  // Something breaks inside the run's update (it used to freeze the game with no word).
  await page.evaluate(() => {
    const sim = window.__SD.sim!;
    sim.step = () => {
      throw new Error('injected test failure');
    };
  });
  await waitScene(page, 'title');
  await page.waitForFunction(() => window.__SD.toast()?.title === 'SOMETHING WENT WRONG', undefined, { timeout: 3000 });
  expect((await page.evaluate(() => window.__SD.toast()))?.line).toBe('YOUR RUN WAS SAVED AT THE LAST ROOM');
  // The crashed run was never written again.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => localStorage.getItem('stormdrain.run'))).toBe(before);
  // …and the game plays on: Continue resumes that room.
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  expect((await page.evaluate(() => window.__SD.run()))!.run!.room).toBe(to);
  const t0 = (await page.evaluate(() => window.__SD.run()))!.tick;
  await page.waitForFunction((t) => window.__SD.run()!.tick > t + 20, t0);
  expect(errors.length).toBe(1);
  expect(errors[0]).toContain('injected test failure');
});

test('backgrounding mid-room saves the room entry; damaged saves are reported at boot, never crash', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await page.evaluate(() => window.__SD.debug.god(true));
  // Into the next room, then progress inside it (coins), then the app goes to the background.
  const to = await page.evaluate(() => {
    const run = window.__SD.sim!.run!;
    for (let side = 0; side < 4; side++) if (run.goThroughDoor(side)) return run.data.current;
    return -1;
  });
  expect(to).toBeGreaterThanOrEqual(0);
  const now = (await page.evaluate(() => window.__SD.run()))!;
  const coins = now.inv.coins;
  // (Polish batch 3: a room that is already clear — no foes in it — is checkpointed again on pause / background, so
  // what was picked up in it survives; mid-fight the save stays the room entry.)
  const settled = now.run!.cleared && !now.arena.active;
  await page.evaluate(() => window.__SD.debug.add(7, 0, 0));
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await waitScene(page, 'pause');
  expect((await page.evaluate(() => window.__SD.meta())).hasRun).toBe(true);

  // Relaunch: Continue walks back into that room through the door she came by.
  await page.reload();
  await waitScene(page, 'title');
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  const back = (await page.evaluate(() => window.__SD.run()))!;
  expect(back.run!.room).toBe(to);
  expect(back.inv.coins).toBe(settled ? coins + 7 : coins);

  // The latest run save damaged: Continue uses the copy before it and says so.
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');
  await page.evaluate(() => localStorage.setItem('stormdrain.run', localStorage.getItem('stormdrain.run')!.slice(0, 120)));
  await page.reload();
  await waitScene(page, 'title');
  await tap(page, 'title.continue');
  await waitScene(page, 'run');
  // The toast is queued with the scene change and shows from the next frame on.
  await page.waitForFunction(() => window.__SD.toast() !== null, undefined, { timeout: 3000 });
  expect((await page.evaluate(() => window.__SD.toast()))?.title).toBe('RUN RESTORED');
  await tap(page, 'run.pause');
  await waitScene(page, 'pause');
  await tap(page, 'pause.quit');
  await waitScene(page, 'title');

  // Every copy of the run save damaged: no Continue, one notice, the damaged text kept aside.
  await page.evaluate(() => {
    localStorage.setItem('stormdrain.run', '{"v":2,"sum":"00000000","data":{}}');
    localStorage.setItem('stormdrain.run.bak', 'garbage');
  });
  await page.reload();
  await waitScene(page, 'title');
  expect(await visible(page, 'title.continue')).toBe(false);
  await page.waitForFunction(() => window.__SD.toast() !== null, undefined, { timeout: 3000 });
  expect((await page.evaluate(() => window.__SD.toast()))?.title).toBe('SAVED RUN LOST');
  expect(await page.evaluate(() => localStorage.getItem('stormdrain.run.corrupt'))).not.toBeNull();

  // Meta progress damaged beyond repair: a fresh start that is written back (no warning on the next launch).
  await page.evaluate(() => {
    localStorage.setItem('stormdrain.meta', 'nope');
    localStorage.setItem('stormdrain.meta.bak', 'nope');
  });
  await page.reload();
  await waitScene(page, 'title');
  await page.waitForFunction(() => window.__SD.toast() !== null, undefined, { timeout: 3000 });
  expect((await page.evaluate(() => window.__SD.toast()))?.title).toBe('SAVE DAMAGED');
  await page.waitForFunction(() => localStorage.getItem('stormdrain.meta')?.startsWith('{"v":') ?? false);
  await page.reload();
  await waitScene(page, 'title');
  expect(await page.evaluate(() => window.__SD.meta().loaded)).toBe('ok');
  // A boot toast would be showing within a few frames: give it the chance before checking there is none.
  const t0 = await page.evaluate(() => window.__SD.ticks);
  await page.waitForFunction((t) => window.__SD.ticks > t + 10, t0);
  expect(await page.evaluate(() => window.__SD.toast())).toBeNull();
  expect(errors).toEqual([]);
});
