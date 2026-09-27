import { expect, test, type Page } from '@playwright/test';

/**
 * Every character, played by (synthetic) touch in real WebKit (characters / tests verification pass): picked
 * on the character select with a tap, started with START, then a wave of the chapter's enemies in the start
 * room fought with the floating move stick and the floating shoot stick (multi-touch PointerEvents on the
 * canvas, like two thumbs, driven every animation frame) until the room is clear — Pip also taps his DASH
 * button, Bolt lifts his thumb to loose charged shots. Each character's mechanic has to show up in real play
 * (the keeper marble, the burrow, a red heart walked into turning Tin, a firefly joining on the clear and
 * fleeing a hit, the wind-up, the swipes, soaking up Tin in puddles fired into a wall, the CLOUDBURST!).
 * No console errors. Plus a new player's locked roster, a queued unlock toast and the achievements page.
 * Screenshots go to e2e/__screens__ (git-ignored) for a look.
 *
 * God mode keeps the runs alive (the point is the controls and the mechanics, not the balance); the hits that
 * ARE a mechanic are landed on purpose. The play tests run on the home-screen profile only (~20 s each).
 */

const IDS = ['wren', 'pip', 'marrow', 'juniper', 'bolt', 'sable', 'mosswick', 'drizzle'] as const;

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

/** Tin halves in a health string ("R4/4 T2 T1" → 3). */
function tinOf(health: string): number {
  let n = 0;
  for (const m of health.matchAll(/T(\d+)/g)) n += Number(m[1]);
  return n;
}

async function shot(page: Page, name: string): Promise<void> {
  const project = test.info().project.name;
  await page.screenshot({ path: `e2e/__screens__/play-${name}-${project}.png` });
}

interface DriveResult {
  ms: number;
  cleared: boolean;
  dashes: number;
  releases: number;
  maxUnderground: boolean;
}

/**
 * Installs `window.__drive(opts)`: an in-page thumb pair. Every animation frame the move thumb keeps a
 * fighting distance from the nearest foe (strafing round it) and the aim thumb points at it; the aim thumb
 * lifts now and then (a charge character fires on release), and `dash` taps the DASH button every so often.
 * Runs until the room has no enemies left (after at least `minMs`) or `maxMs`.
 */
async function installDriver(page: Page): Promise<void> {
  await page.evaluate(() => {
    type W = { __drive: unknown };
    (window as unknown as W).__drive = (opts: { maxMs: number; minMs?: number; dash?: boolean; release?: number; stand?: boolean }) =>
      new Promise<DriveResult>((resolve) => {
        const canvas = document.getElementById('screen')!;
        const send = (type: string, id: number, gx: number, gy: number): void => {
          const v = window.__SD.view;
          canvas.dispatchEvent(
            new PointerEvent(type, {
              pointerId: id,
              pointerType: 'touch',
              isPrimary: id === 11,
              bubbles: true,
              cancelable: true,
              clientX: v.x + gx * v.scale,
              clientY: v.y + gy * v.scale,
            }),
          );
        };
        // Resting spots of the two thumbs (game px): the move stick bottom-left, the shoot stick bottom-right.
        const MX = 48;
        const MY = 160;
        const AX = 318;
        const AY = 164;
        const R = 18;
        // The aim thumb stays inside the aim stick's 12 px follow radius (polish batch 3), as a player aiming against the
        // ring does: pointing 18 px from a fixed spot would drag the origin round and send the aim astray.
        const RA = 10;
        let moveDown = false;
        let aimDown = false;
        let side = 1;
        let lastSide = 0;
        let lastRelease = 0;
        let lastDash = 0;
        const res: DriveResult = { ms: 0, cleared: false, dashes: 0, releases: 0, maxUnderground: false };
        const t0 = performance.now();
        const frame = (): void => {
          const now = performance.now() - t0;
          const sim = window.__SD.sim;
          const w = sim?.world;
          if (!w || window.__SD.scene !== 'run') {
            finish(false);
            return;
          }
          const p = w.player;
          if (p.underground) res.maxUnderground = true;
          let foe: { x: number; y: number } | null = null;
          let bd = Infinity;
          for (let i = 0; i < w.enemies.count; i++) {
            const e = w.enemies.items[i]!;
            if (e.dead || !e.hittable) continue;
            const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
            if (d < bd) {
              bd = d;
              foe = e;
            }
          }
          const left = w.enemies.count;
          if ((left === 0 && now > (opts.minMs ?? 0)) || now > opts.maxMs) {
            finish(left === 0);
            return;
          }
          // The shoot thumb: on the foe; lifted for a frame now and then (charge attacks fire on release).
          if (foe) {
            const dx = foe.x - p.x;
            const dy = foe.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            const every = opts.release ?? 0;
            if (aimDown && every > 0 && now - lastRelease > every) {
              send('pointerup', 12, AX + (dx / d) * RA, AY + (dy / d) * RA);
              aimDown = false;
              lastRelease = now;
              res.releases++;
            } else {
              if (!aimDown) {
                send('pointerdown', 12, AX, AY);
                aimDown = true;
              }
              send('pointermove', 12, AX + (dx / d) * RA, AY + (dy / d) * RA);
            }
            // The move thumb: keep 50-90 px away, strafing round the foe (switching sides every 1.5 s).
            if (!opts.stand) {
              if (now - lastSide > 1500) {
                side = -side;
                lastSide = now;
              }
              let mx = (-dy / d) * side * 0.8;
              let my = (dx / d) * side * 0.8;
              if (d < 50) {
                mx -= dx / d;
                my -= dy / d;
              } else if (d > 90) {
                mx += dx / d;
                my += dy / d;
              }
              // Stay off the walls (room-local 0..208 × 0..112).
              if (p.x < 20) mx = Math.max(mx, 0.5);
              if (p.x > 188) mx = Math.min(mx, -0.5);
              if (p.y < 20) my = Math.max(my, 0.5);
              if (p.y > 92) my = Math.min(my, -0.5);
              const m = Math.hypot(mx, my) || 1;
              if (!moveDown) {
                send('pointerdown', 11, MX, MY);
                moveDown = true;
              }
              send('pointermove', 11, MX + (mx / m) * R, MY + (my / m) * R);
            }
            // Pip: DASH at the foe now and then.
            if (opts.dash && now - lastDash > 1700 && d < 110) {
              const b = window.__SD.button('run.dash');
              if (b) {
                const gx = b.x + b.w / 2;
                const gy = b.y + b.h / 2;
                send('pointerdown', 13, gx, gy);
                send('pointerup', 13, gx, gy);
                res.dashes++;
                lastDash = now;
              }
            }
          } else {
            if (aimDown) send('pointerup', 12, AX, AY);
            if (moveDown) send('pointerup', 11, MX, MY);
            aimDown = moveDown = false;
          }
          requestAnimationFrame(frame);
        };
        const finish = (cleared: boolean): void => {
          if (aimDown) send('pointerup', 12, AX, AY);
          if (moveDown) send('pointerup', 11, MX, MY);
          res.ms = performance.now() - t0;
          res.cleared = cleared;
          resolve(res);
        };
        requestAnimationFrame(frame);
      });
  });
}

async function drive(page: Page, opts: { maxMs: number; minMs?: number; dash?: boolean; release?: number; stand?: boolean }): Promise<DriveResult> {
  return page.evaluate((o) => (window as unknown as { __drive: (x: typeof o) => Promise<DriveResult> }).__drive(o), opts);
}

/**
 * Walks her with the move thumb to the target the page function picks each frame (room px; null = done),
 * then lifts the thumb. Resolves true once she is within `near` px, false after `maxMs`.
 */
async function walkTo(page: Page, target: 'pickup' | 'puddle', near: number, maxMs: number): Promise<boolean> {
  return page.evaluate(
    ([what, nearPx, max]) =>
      new Promise<boolean>((resolve) => {
        const canvas = document.getElementById('screen')!;
        const send = (type: string, gx: number, gy: number): void => {
          const v = window.__SD.view;
          canvas.dispatchEvent(
            new PointerEvent(type, { pointerId: 22, pointerType: 'touch', bubbles: true, cancelable: true, clientX: v.x + gx * v.scale, clientY: v.y + gy * v.scale }),
          );
        };
        const MX = 48;
        const MY = 160;
        send('pointerdown', MX, MY);
        const t0 = performance.now();
        const frame = (): void => {
          const w = window.__SD.sim!.world;
          const p = w.player;
          let best: { x: number; y: number } | null = null;
          let bd = Infinity;
          if (what === 'pickup') {
            for (let i = 0; i < w.pickups.count; i++) {
              const k = w.pickups.items[i]!;
              const d = Math.hypot(k.x - p.x, k.y - p.y);
              if (k.alive && d < bd) {
                bd = d;
                best = k;
              }
            }
          } else {
            for (let i = 0; i < w.creep.count; i++) {
              const c = w.creep.items[i]!;
              const d = Math.hypot(c.x - p.x, c.y - p.y);
              if (c.allied && d < bd) {
                bd = d;
                best = c;
              }
            }
          }
          const done = !best || bd <= nearPx;
          if (done || performance.now() - t0 > max) {
            send('pointerup', MX, MY);
            resolve(done);
            return;
          }
          const k = Math.min(1, bd / 12);
          send('pointermove', MX + ((best!.x - p.x) / bd) * 18 * k, MY + ((best!.y - p.y) / bd) * 18 * k);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
    [target, near, maxMs] as const,
  );
}

/** Holds the shoot thumb in one direction for `ms` (touch). */
async function holdAim(page: Page, dx: number, dy: number, ms: number): Promise<void> {
  await page.evaluate(
    ([x, y, t]) =>
      new Promise<void>((resolve) => {
        const canvas = document.getElementById('screen')!;
        const send = (type: string, gx: number, gy: number): void => {
          const v = window.__SD.view;
          canvas.dispatchEvent(
            new PointerEvent(type, { pointerId: 21, pointerType: 'touch', bubbles: true, cancelable: true, clientX: v.x + gx * v.scale, clientY: v.y + gy * v.scale }),
          );
        };
        send('pointerdown', 318, 164);
        send('pointermove', 318 + x * 18, 164 + y * 18);
        setTimeout(() => {
          send('pointerup', 318 + x * 18, 164 + y * 18);
          resolve();
        }, t);
      }),
    [dx, dy, ms] as const,
  );
}

/** A hit that lands (spawn safety and i-frames cleared first; god mode off). */
async function landHit(page: Page): Promise<string> {
  return page.evaluate(() => {
    const w = window.__SD.sim!.world;
    window.__SD.debug.god(false);
    w.safeT = 0;
    w.player.invuln = 0;
    window.__SD.debug.hurt();
    return window.__SD.run()!.health;
  });
}

/** Starts a fight in the start room (a wave of the chapter's own enemies, the doors shut). */
async function startFight(page: Page): Promise<void> {
  expect(await page.evaluate(() => window.__SD.debug.wave())).toBeGreaterThan(0);
  await page.waitForFunction(() => (window.__SD.sim?.world.enemies.count ?? 0) > 0);
}

/** Title → character select (everything unlocked) → tap the character → START → the run, floor card gone. */
async function startAs(page: Page, id: string): Promise<void> {
  await page.goto('./');
  await waitScene(page, 'title');
  expect(await page.evaluate(() => window.__SD.debug.unlockAll())).toBeGreaterThanOrEqual(0);
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, `chars.slot.${id}`);
  await page.waitForFunction((c) => (window.__SD.screen().info as { selected?: string } | null)?.selected === c, id);
  const info = (await page.evaluate(() => window.__SD.screen().info)) as { canStart: boolean };
  expect(info.canStart).toBe(true);
  await page.waitForTimeout(150);
  await shot(page, `${id}-select`);
  await tap(page, 'chars.start');
  await waitScene(page, 'run');
  await page.waitForFunction((c) => window.__SD.sim?.world.player.character.id === c, id);
  await page.waitForFunction(() => !window.__SD.presentation()?.card);
  await installDriver(page);
}

for (const id of IDS) {
  test(`${id}: picked by touch, fights with the thumbs, the mechanic shows`, async ({ page }, info) => {
    // ~20 s of real play each: the full-screen home-screen profile (the way the game is played) is enough.
    test.skip(info.project.name !== 'iphone15-homescreen', 'played on the home-screen profile');
    test.setTimeout(120_000);
    const errors = trackErrors(page);
    await startAs(page, id);
    await page.evaluate(() => window.__SD.debug.god(true));

    if (id === 'drizzle') {
      // Floats; a hit bursts a cloud that slows every foe in the room.
      expect(await page.evaluate(() => window.__SD.sim!.world.player.flags.flying)).toBe(true);
      await startFight(page);
      await page.waitForTimeout(700); // spawn poofs and the entry safety
      const h0 = await page.evaluate(() => window.__SD.run()!.health);
      const h1 = await landHit(page);
      expect(h1, 'the hit landed').not.toBe(h0);
      await page.waitForFunction(() => window.__SD.presentation()?.notice === 'CLOUDBURST!');
      await page.waitForFunction(() => window.__SD.run()!.enemies.some((e) => e.status.length > 0));
      await shot(page, `${id}-cloudburst`);
      await page.evaluate(() => window.__SD.debug.god(true));
    } else {
      await startFight(page);
    }

    const before = await page.evaluate(() => window.__SD.run()!);
    const keeperArmed = await page.evaluate(() => window.__SD.sim!.world.player.atk.keeper);
    if (id === 'wren') expect(keeperArmed, 'the lucky marble is armed for the first shot').toBe(true);

    // Fight: the first ~1.4 s, then a screenshot mid-fight, then on until the room is clear.
    const charge = id === 'bolt';
    const first = await drive(page, { maxMs: 1400, minMs: 1400, dash: id === 'pip', release: charge ? 1100 : 0 });
    await shot(page, `${id}-fight`);
    if (id === 'wren') expect(await page.evaluate(() => window.__SD.sim!.world.player.atk.keeper), 'the keeper marble was fired').toBe(false);
    const rest = await drive(page, { maxMs: 30_000, dash: id === 'pip', release: charge ? 1100 : 0 });
    if (!rest.cleared) {
      // A straggler behind cover: the thumbs had their chance; finish it so the mechanic checks can run.
      const left = await page.evaluate(() => window.__SD.run()!.enemies.map((e) => `${e.id} ${e.hp.toFixed(0)}`));
      console.log(`${id}: room not cleared by touch in 30 s (${left.join(', ')})`);
      await page.evaluate(() => window.__SD.debug.clearRoom());
    }
    await page.waitForFunction(() => !window.__SD.sim!.world.arena.active);
    const after = await page.evaluate(() => window.__SD.run()!);
    expect(after.counters.shots, 'the shoot stick fired').toBeGreaterThan(before.counters.shots);
    expect(after.counters.kills, 'the thumbs killed things').toBeGreaterThan(before.counters.kills);
    const moved = Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y);
    expect(moved + first.ms, 'the move stick moved her').toBeGreaterThan(0);

    switch (id) {
      case 'pip': {
        expect(first.dashes + rest.dashes, 'DASH taps').toBeGreaterThan(0);
        expect(first.maxUnderground || rest.maxUnderground, 'Pip went underground').toBe(true);
        // Once more by hand, for the mound screenshot.
        await page.waitForFunction(() => window.__SD.sim!.world.player.mech.dashCd === 0);
        await tap(page, 'run.dash');
        await page.waitForFunction(() => window.__SD.sim!.world.player.underground === true);
        await shot(page, `${id}-burrow`);
        break;
      }
      case 'marrow': {
        expect(after.attack.primary).toBe('boomerang');
        // No red: a hit, then a red heart walked into by touch → Tin.
        expect(after.health.startsWith('R0/0')).toBe(true);
        const hurt = await landHit(page);
        expect(hurt, 'the hit landed').not.toBe(after.health);
        await page.evaluate(() => {
          const w = window.__SD.sim!.world;
          for (let i = w.pickups.count - 1; i >= 0; i--) w.pickups.release(w.pickups.items[i]!);
          window.__SD.debug.spawn('heart');
        });
        await page.waitForTimeout(400); // it pops out and lands before it can be taken
        await walkTo(page, 'pickup', 2, 4000);
        await page.waitForFunction((h) => window.__SD.run()!.health !== h, hurt, { timeout: 5000 });
        const healed = await page.evaluate(() => window.__SD.run()!.health);
        expect(healed.startsWith('R0/0'), `${hurt} → ${healed}`).toBe(true);
        expect(tinOf(healed), `${hurt} → ${healed}: the red heart became Tin`).toBeGreaterThan(tinOf(hurt));
        break;
      }
      case 'juniper': {
        expect(before.attack.familiars.filter((f) => f === 'firefly').length).toBe(2);
        // A firefly joins on the clear (the familiar appears on the next tick or two).
        await page.waitForFunction(() => window.__SD.run()!.attack.familiars.filter((f) => f === 'firefly').length === 3, undefined, { timeout: 3000 });
        expect(await page.evaluate(() => window.__SD.sim!.world.player.mech.flies)).toBe(1);
        await shot(page, `${id}-jar`);
        // A hit that lands scares the extra one off.
        await landHit(page);
        await page.waitForFunction(() => window.__SD.run()!.attack.familiars.filter((f) => f === 'firefly').length === 2);
        break;
      }
      case 'bolt': {
        expect(after.attack.riders).toContain('charge');
        expect(first.releases + rest.releases, 'charged shots released').toBeGreaterThan(0);
        // Use the Jar of Lightning, then watch it wind itself up (a room of charge every 12 s).
        await tap(page, 'run.active');
        await page.waitForFunction(() => (window.__SD.run()!.inv.active?.charge ?? 9) < 0.1);
        await page.waitForTimeout(2600);
        const c = await page.evaluate(() => window.__SD.run()!.inv.active!.charge);
        expect(c, 'wound up by itself').toBeGreaterThan(0.12);
        expect(c).toBeLessThan(1);
        await shot(page, `${id}-windup`);
        break;
      }
      case 'sable': {
        expect(after.attack.primary).toBe('melee');
        expect(await page.evaluate(() => window.__SD.sim!.world.player.flags.haggler)).toBe(true);
        break;
      }
      case 'mosswick': {
        // Against a wall, firing into it: the puddles land at her feet and she soaks up Tin.
        await page.evaluate(() => window.__SD.sim!.world.player.placeAt(198, 56));
        const tin0 = await page.evaluate(() => window.__SD.run()!.health);
        const aiming = holdAim(page, 1, 0, 6000);
        await page.waitForFunction(
          () => {
            const w = window.__SD.sim!.world;
            for (let i = 0; i < w.creep.count; i++) if (w.creep.items[i]!.allied) return true;
            return false;
          },
          undefined,
          { timeout: 3000 },
        );
        await shot(page, `${id}-puddle`);
        await page.waitForFunction((h) => window.__SD.run()!.health !== h, tin0, { timeout: 6000 });
        await aiming;
        const tin1 = await page.evaluate(() => window.__SD.run()!.health);
        expect(tinOf(tin1), `${tin0} → ${tin1}: soaked up Tin`).toBeGreaterThan(tinOf(tin0));
        expect(tin1.startsWith(tin0.split(' ')[0]!), `${tin0} → ${tin1}: red untouched`).toBe(true);
        break;
      }
      default:
        break;
    }
    expect(errors).toEqual([]);
  });
}

test('a new player: locked silhouettes, an unlock toast, the achievements page (screenshots)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('./');
  await waitScene(page, 'title');
  await tap(page, 'title.newRun');
  await waitScene(page, 'chars');
  await tap(page, 'chars.slot.pip');
  await page.waitForTimeout(150);
  await shot(page, 'locked-pip');
  await tap(page, 'chars.slot.drizzle');
  await page.waitForTimeout(150);
  await shot(page, 'locked-drizzle');
  const info = (await page.evaluate(() => window.__SD.screen().info)) as { canStart: boolean; characters: { id: string; unlocked: boolean }[] };
  expect(info.canStart).toBe(false);
  expect(info.characters.filter((c) => c.unlocked).map((c) => c.id)).toEqual(['wren']);
  await tap(page, 'chars.back');
  await waitScene(page, 'title');
  // Two unlocks at once: the toasts queue, the character first on each.
  expect(await page.evaluate(() => window.__SD.save.achievement('wound-up'))).toBe(true);
  expect(await page.evaluate(() => window.__SD.save.achievement('demolition'))).toBe(true);
  await page.waitForFunction(() => (window.__SD.toast()?.title ?? '').includes('WOUND UP'));
  expect((await page.evaluate(() => window.__SD.toast()))?.line).toBe('NEW CHARACTER: BOLT');
  await page.waitForTimeout(500);
  await shot(page, 'toast');
  await page.waitForFunction(() => (window.__SD.toast()?.title ?? '').includes('DEMOLITION'), undefined, { timeout: 8000 });
  await tap(page, 'title.achievements');
  await waitScene(page, 'achievements');
  await page.waitForTimeout(200);
  await shot(page, 'achievements-top');
  for (let i = 0; i < 30; i++) await page.keyboard.press('PageDown');
  await page.waitForTimeout(600);
  await shot(page, 'achievements-bottom');
  expect(errors).toEqual([]);
});
