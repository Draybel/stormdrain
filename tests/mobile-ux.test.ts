/**
 * Polish batch 3 — mobile UX, saving and PWA, the DOM-free parts:
 * - B3-2: the run buttons' layout on both iPhone viewports (the home-screen app with its insets, a Safari tab) and
 *   without insets, right / left-handed, every BUTTON SIZE step, with and without Pip's DASH: every button >= 44 CSS px,
 *   no hit rect in a stick zone, on another button, on the hearts / counters or the room, decorations (charge bar,
 *   trinkets) clear too;
 * - B3-3: the loop's error hook (an exception no longer freezes the game);
 * - B3-4: where the game runs (a Safari tab / the home-screen app) and the Settings save status line;
 * - B3-5: where the DOM modal's panel goes (landscape over the image, portrait across the screen, above the keyboard).
 */

import { describe, expect, it } from 'vitest';
import { Loop } from '../src/engine/loop';
import { BUTTON_SCALE_MAX, BUTTON_SCALE_MIN, SettingsStore, defaultSettings } from '../src/meta/settings';
import { isIosSafariTab, isIosWebKit, isStandalone, platformInfo, type PlatformEnv } from '../src/pwa/platform';
import { chargeRect, hudCornerRects, trinketRect } from '../src/render/hud';
import { modalRect } from '../src/ui/domModal';
import { saveStatus } from '../src/ui/settingsPanel';
import {
  BASE,
  STICK_REST_L,
  STICK_REST_R,
  STICK_RING,
  STICK_ZONE_R,
  buttonSizeFor,
  createRunButtons,
  layoutRunButtons,
  minTapSize,
  type RunButtons,
} from '../src/ui/touchControls';
import { uiButton } from '../src/ui/widgets';
import { GAME_H, GAME_W } from '../src/engine/screen';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const INTERIOR: Rect = { x: 88, y: 64, w: 208, h: 112 };

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function hit(b: Rect & { pad: number }): Rect {
  return { x: b.x - b.pad, y: b.y - b.pad, w: b.w + 2 * b.pad, h: b.h + 2 * b.pad };
}

/** Distance from a point to the nearest point of a rect. */
function dist(r: Rect, p: { x: number; y: number }): number {
  const dx = Math.max(0, r.x - p.x, p.x - (r.x + r.w));
  const dy = Math.max(0, r.y - p.y, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** The display scales (CSS px per game px) of the iPhone 15 viewports the game runs in. */
const VIEWS: [string, number][] = [
  ['home-screen app, insets', 734 / GAME_W],
  ['home-screen app, no insets', 2],
  ['Safari tab', 5 / 3],
];

function problems(r: RunButtons, view: number, label: string): string[] {
  const out: string[] = [];
  const buttons = [r.pause, r.map, r.active, r.bomb, r.consumable, ...(r.dash.visible ? [r.dash] : [])];
  const corner = hudCornerRects();
  const decorations = [
    { owner: r.active, rect: chargeRect(r.active) },
    { owner: r.consumable, rect: trinketRect(r.consumable, 2) },
  ];
  for (const b of buttons) {
    const h = hit(b);
    if (Math.min(b.w, b.h) * view < 44 - 1e-6) out.push(`${label}: ${b.id} is ${(Math.min(b.w, b.h) * view).toFixed(1)} CSS px`);
    if (b.x < 0 || b.y < 0 || b.x + b.w > GAME_W || b.y + b.h > GAME_H) out.push(`${label}: ${b.id} leaves the image`);
    if (overlaps(b, INTERIOR)) out.push(`${label}: ${b.id} covers the room`);
    for (const rest of [STICK_REST_L, STICK_REST_R]) {
      if (dist(h, rest) < STICK_RING) out.push(`${label}: ${b.id} is on a stick ring`);
      if (dist(h, rest) < STICK_ZONE_R) out.push(`${label}: ${b.id} is in a stick zone`);
    }
    for (const c of corner) if (overlaps(h, c)) out.push(`${label}: ${b.id} covers the ${c.id}`);
    for (const o of buttons) if (o !== b && overlaps(h, o)) out.push(`${label}: ${b.id}'s hit rect covers ${o.id}`);
    for (const d of decorations) if (d.owner !== b && overlaps(h, d.rect)) out.push(`${label}: ${b.id} covers ${d.owner.id}'s ${d.rect.id}`);
  }
  for (const d of decorations) if (overlaps(d.rect, INTERIOR)) out.push(`${label}: ${d.rect.id} covers the room`);
  return out;
}

describe('run button layout (B3-2)', () => {
  it('every viewport × hand × BUTTON SIZE step × DASH: thumb-sized, off the stick zones, the HUD, each other and the room', () => {
    const all: string[] = [];
    let cases = 0;
    for (const [name, view] of VIEWS) {
      const min = minTapSize(view);
      for (const lefty of [false, true]) {
        for (const dash of [false, true]) {
          for (let scale = 0.75; scale <= 1.5 + 1e-9; scale += 0.05) {
            const r = createRunButtons();
            layoutRunButtons(r, scale, lefty, dash, { minSize: min });
            all.push(...problems(r, view, `${name}, ${lefty ? 'left' : 'right'}-handed${dash ? ', dash' : ''}, ${Math.round(scale * 100)} %`));
            // The thumb column is on the shoot thumb's side, the consumable on the other.
            const thumbRight = !lefty;
            for (const b of dash ? [r.active, r.bomb, r.dash] : [r.active, r.bomb]) {
              if (b.x > GAME_W / 2 !== thumbRight) all.push(`${name} ${lefty} ${dash} ${scale}: ${b.id} on the wrong side`);
            }
            if (r.consumable.x > GAME_W / 2 === thumbRight) all.push(`${name} ${lefty} ${dash} ${scale}: consumable on the thumb side`);
            cases++;
          }
        }
      }
    }
    expect(cases).toBeGreaterThan(150);
    expect(all).toEqual([]);
  });

  it('100 % is the 44 pt floor: 24 px in the home-screen app, 27 px in a Safari tab; 150 % is bigger', () => {
    expect(minTapSize(734 / GAME_W)).toBe(24);
    expect(minTapSize(5 / 3)).toBe(27);
    expect(minTapSize(2)).toBe(22);
    expect(buttonSizeFor(1, 24)).toBe(24);
    expect(buttonSizeFor(1, 27)).toBe(27);
    expect(buttonSizeFor(1, 22)).toBe(BASE);
    // A saved 75 % reads as 100 % (never under the floor).
    expect(buttonSizeFor(0.75, 27)).toBe(27);
    expect(buttonSizeFor(1.5, 24)).toBe(36);
    for (const [, view] of VIEWS) {
      const r = createRunButtons();
      layoutRunButtons(r, 1.5, false, false, { minSize: minTapSize(view) });
      expect(r.bomb.w).toBeGreaterThan(minTapSize(view));
    }
  });

  it('right-handed, the active item and the bomb sit just above the resting shoot thumb (not up by the pause button)', () => {
    const r = createRunButtons();
    layoutRunButtons(r, 1, false, false, { minSize: 24 });
    // Bottom-aligned on the stick zone: the bomb ends within a few px of it, the active right above.
    expect(r.bomb.y + r.bomb.h).toBeGreaterThanOrEqual(108);
    expect(r.active.y).toBeGreaterThanOrEqual(56);
    expect(r.active.y + r.active.h).toBeLessThanOrEqual(r.bomb.y - 4);
    // Pause and the minimap keep the top-right corner.
    expect([r.pause.x + r.pause.w, r.pause.y]).toEqual([GAME_W - 4, 4]);
    expect(r.map.x + r.map.w).toBeLessThan(r.pause.x);
  });

  it("the yard's bell stays clear of the stick zone too", () => {
    for (const [, view] of VIEWS) {
      for (const lefty of [false, true]) {
        for (const scale of [1, 1.25, 1.5]) {
          const r = createRunButtons();
          const bell = uiButton({ id: 'run.fight', trigger: 'release', kind: 'hud', pad: 4 });
          layoutRunButtons(r, scale, lefty, false, { minSize: minTapSize(view), bell });
          for (const rest of [STICK_REST_L, STICK_REST_R]) expect(dist(hit(bell), rest)).toBeGreaterThanOrEqual(STICK_RING);
          expect(overlaps(hit(bell), r.consumable)).toBe(false);
          expect(overlaps(bell, INTERIOR)).toBe(false);
        }
      }
    }
  });

  it('the runtime settings keep BUTTON SIZE within 100-150 % (an old 75 % save reads as 100 %)', () => {
    expect(BUTTON_SCALE_MIN).toBe(1);
    const s = new SettingsStore({ ...defaultSettings(), buttonScale: 0.75 });
    expect(s.value.buttonScale).toBe(1);
    s.update({ buttonScale: 9 });
    expect(s.value.buttonScale).toBe(BUTTON_SCALE_MAX);
    s.update({ buttonScale: Number.NaN });
    expect(s.value.buttonScale).toBe(1);
    s.update({ buttonScale: 1.25 });
    expect(s.value.buttonScale).toBe(1.25);
  });
});

describe('the loop survives an exception (B3-3 crash guard)', () => {
  it('update / render errors go to the error hook; the loop keeps rendering', () => {
    const errors: string[] = [];
    let renders = 0;
    let updates = 0;
    let boom = true;
    const loop = new Loop({
      update() {
        updates++;
        if (boom) throw new Error('scene update failed');
      },
      render() {
        renders++;
      },
      error(err, phase) {
        errors.push(`${phase}: ${(err as Error).message}`);
        boom = false; // the guard recovers (main.ts: back to the title)
      },
    });
    let t = 1000;
    for (let i = 0; i < 5; i++) loop.tick((t += 1000 / 60));
    expect(errors).toEqual(['update: scene update failed']);
    // Every frame still rendered, including the one that threw, and the game ticks on.
    expect(renders).toBe(5);
    expect(updates).toBeGreaterThanOrEqual(4);
    expect(loop.errors).toBe(1);
  });

  it('a render error is reported too; without the hook an error still propagates (old behaviour for tools)', () => {
    const seen: string[] = [];
    const loop = new Loop({
      update() {},
      render() {
        throw new Error('draw');
      },
      error(_e, phase) {
        seen.push(phase);
      },
    });
    loop.tick(0);
    loop.tick(16.7);
    expect(seen).toEqual(['render', 'render']);
    const bare = new Loop({
      update() {
        throw new Error('bare');
      },
      render() {},
    });
    expect(() => bare.tick(0)).toThrow('bare');
  });
});

describe('where the game runs (B3-4)', () => {
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const IPAD_DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
  const env = (p: Partial<PlatformEnv>): PlatformEnv => ({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false, displayStandalone: false, ...p });

  it('an iPhone Safari tab: iOS WebKit, touch, navigator.standalone false, no standalone display mode', () => {
    expect(isIosSafariTab(env({}))).toBe(true);
    expect(platformInfo(env({}))).toEqual({ ios: true, standalone: false, safariTab: true });
    // iPadOS asking for desktop sites (a Mac user agent with touch points) too; a real Mac never.
    expect(isIosSafariTab(env({ userAgent: IPAD_DESKTOP }))).toBe(true);
    expect(isIosWebKit(env({ userAgent: IPAD_DESKTOP, maxTouchPoints: 0 }))).toBe(false);
  });

  it('the home-screen app is standalone (the flag or the display mode), never a Safari tab', () => {
    expect(isStandalone(env({ standalone: true }))).toBe(true);
    expect(isIosSafariTab(env({ standalone: true }))).toBe(false);
    expect(isStandalone(env({ displayStandalone: true }))).toBe(true);
    expect(isIosSafariTab(env({ displayStandalone: true }))).toBe(false);
  });

  it('desktop / Android browsers, and test browsers that only borrow an iPhone user agent, are not Safari tabs', () => {
    expect(isIosSafariTab(env({ userAgent: ANDROID }))).toBe(false);
    // No navigator.standalone at all: not iOS WebKit's Safari (a desktop engine with an iPhone UA).
    expect(isIosSafariTab(env({ standalone: undefined }))).toBe(false);
    expect(isIosSafariTab(env({ maxTouchPoints: 0 }))).toBe(false);
  });

  it("Settings' save status: Safari tabs warn unless storage was made persistent", () => {
    expect(saveStatus(true, true, null)).toEqual({ text: 'SAVED IN SAFARI · MAY BE CLEARED', warn: true });
    expect(saveStatus(true, true, false).warn).toBe(true);
    expect(saveStatus(true, true, true)).toEqual({ text: 'SAVED IN SAFARI · PROTECTED', warn: false });
    expect(saveStatus(true, false, null)).toEqual({ text: 'SAVED ON THIS DEVICE', warn: false });
    expect(saveStatus(false, true, true).warn).toBe(true);
  });
});

describe('the DOM modal panel (B3-5)', () => {
  const safe = { top: 0, right: 0, bottom: 0, left: 0 };
  it('landscape: over the game image; with the keyboard up it stays inside the visible part and scrolls', () => {
    const view = { x: 59, y: 2.5, w: 734, h: 367, scale: 734 / GAME_W };
    const r = modalRect({ portrait: false, view, safe }, { x: 0, y: 0, w: 852, h: 393 });
    expect(r.x).toBeGreaterThanOrEqual(view.x);
    expect(r.x + r.w).toBeLessThanOrEqual(view.x + view.w);
    expect(r.y).toBeCloseTo(view.y + 8, 5);
    // The keyboard takes the bottom 230 pt: the panel ends above it.
    const k = modalRect({ portrait: false, view, safe }, { x: 0, y: 0, w: 852, h: 163 });
    expect(k.y + k.maxH).toBeLessThanOrEqual(163 - 8 + 1e-6);
    // Safari scrolled the page up under the keyboard: the panel follows the visible area.
    const s = modalRect({ portrait: false, view, safe }, { x: 0, y: 120, w: 852, h: 163 });
    expect(s.y).toBeGreaterThanOrEqual(128);
  });

  it('portrait: across the screen under the safe-area top, never off screen', () => {
    const view = { x: 0, y: 330, w: 393, h: 196, scale: 393 / GAME_W };
    const r = modalRect({ portrait: true, view, safe: { top: 59, right: 0, bottom: 34, left: 0 } }, { x: 0, y: 0, w: 393, h: 852 });
    expect(r.w).toBe(393 - 24);
    expect(r.x).toBe(12);
    expect(r.y).toBe(59 + 8);
    expect(r.y + r.maxH).toBeLessThanOrEqual(852);
  });
});
