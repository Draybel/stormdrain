/**
 * Input (touch + keyboard → InputState) driven headlessly: a stub canvas/window/document built on
 * node's EventTarget, and a Display stand-in whose client coordinates ARE game pixels.
 * Covers the multi-touch contract of ARCHITECTURE §2: two thumbs at once, buttons hit-tested
 * before sticks, buttons usable while a stick is held, and edge flags.
 * Polish batch 3 (B3-1): sticks take the UNCLAMPED point (a thumb on the letterbox still pushes toward the bezel), the
 * aim stick turns in ≈ 13 game px at the rim (12 px follow radius, 51° keep angle) or at once on a flick, and the perf
 * overlay's three-finger gesture can't fire during play.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ButtonRegistry, makeButton, type HitButton } from '../src/engine/buttons';
import { Display } from '../src/engine/display';
import type { Input as InputClass } from '../src/engine/input';
import { vec2, type Vec2 } from '../src/engine/math';
import { GAME_H, GAME_W } from '../src/engine/screen';
import { AIM_STICK, FLICK_MS, MOVE_STICK, SNAP_KEEP_DEG, VirtualStick } from '../src/engine/sticks';

class FakeCanvas extends EventTarget {
  setPointerCapture(): void {}
  hasPointerCapture(): boolean {
    return false;
  }
  releasePointerCapture(): void {}
}

const fakeDisplay = {
  portrait: false,
  toGame(x: number, y: number, out: Vec2): Vec2 {
    out.x = Math.min(GAME_W - 0.001, Math.max(0, x));
    out.y = Math.min(GAME_H - 0.001, Math.max(0, y));
    return out;
  },
  // Client px ARE game px here, so the letterbox is simply x < 0 / x >= GAME_W / y >= GAME_H.
  toGameRaw(x: number, y: number, out: Vec2): Vec2 {
    out.x = x;
    out.y = y;
    return out;
  },
} as unknown as Display;

let Input: typeof InputClass;
let win: EventTarget;
let t = 0;

beforeAll(async () => {
  win = new EventTarget();
  const g = globalThis as Record<string, unknown>;
  g.window = win;
  g.document = new EventTarget();
  ({ Input } = await import('../src/engine/input'));
});

function pointer(target: EventTarget, type: string, id: number, x: number, y: number, pointerType = 'touch', at?: number): void {
  const e = new Event(type, { cancelable: true });
  t = at ?? t + 20;
  Object.defineProperty(e, 'timeStamp', { value: t });
  Object.assign(e, { pointerId: id, pointerType, clientX: x, clientY: y, button: 0 });
  target.dispatchEvent(e);
}

function key(type: 'keydown' | 'keyup', code: string): void {
  const e = new Event(type, { cancelable: true });
  Object.assign(e, { code, repeat: false, metaKey: false, ctrlKey: false, altKey: false });
  win.dispatchEvent(e);
}

describe('Input', () => {
  let canvas: FakeCanvas;
  let reg: ButtonRegistry;
  let input: InputClass;
  let bomb: HitButton;
  let menu: HitButton;
  let menuHits = 0;
  const down = (id: number, x: number, y: number) => pointer(canvas, 'pointerdown', id, x, y);
  const move = (id: number, x: number, y: number) => pointer(canvas, 'pointermove', id, x, y);
  const up = (id: number, x: number, y: number) => pointer(canvas, 'pointerup', id, x, y);

  beforeEach(() => {
    // A fresh window / document per test: each Input adds its key and gesture listeners to them (the game makes one
    // Input; reusing one stand-in here stacked a dozen and set off node's MaxListenersExceededWarning).
    win = new EventTarget();
    (globalThis as Record<string, unknown>).window = win;
    (globalThis as Record<string, unknown>).document = new EventTarget();
    canvas = new FakeCanvas();
    reg = new ButtonRegistry();
    input = new Input(canvas as unknown as HTMLCanvasElement, fakeDisplay, reg);
    menuHits = 0;
    // A press-trigger action button on the right side (like run.bomb) and a release-trigger
    // menu-style button on the left side.
    bomb = makeButton({ id: 'bomb', x: 350, y: 60, w: 24, h: 24, trigger: 'press', action: 'bomb', pad: 4 });
    menu = makeButton({ id: 'menu', x: 10, y: 10, w: 40, h: 24, trigger: 'release', onActivate: () => menuHits++ });
    reg.use([bomb, menu]);
    input.setSticksEnabled(true);
  });

  it('moves and shoots with two thumbs at the same time', () => {
    down(1, 60, 150);
    down(2, 320, 150);
    move(1, 90, 150); // full right
    move(2, 320, 120); // aim up
    input.poll();
    const s = input.state;
    expect(s.moveX).toBeCloseTo(1, 5);
    expect(s.moveY).toBe(0);
    expect([s.aimX, s.aimY]).toEqual([0, -1]);
    expect(s.fireHeld).toBe(true);
    expect(s.firePressed).toBe(true);
    input.endTick();
    input.poll();
    expect(s.firePressed).toBe(false); // edge cleared after the tick
    expect(s.fireHeld).toBe(true);
    expect(s.moveX).toBeCloseTo(1, 5);
    // Lifting the move thumb leaves the aim thumb firing, and vice versa.
    up(1, 90, 150);
    input.poll();
    expect(s.moveX).toBe(0);
    expect(s.fireHeld).toBe(true);
    up(2, 320, 120);
    input.poll();
    expect(s.fireHeld).toBe(false);
    expect(s.fireReleased).toBe(true);
  });

  it('a pointer that starts on a button never becomes a stick', () => {
    down(3, 360, 70); // on the bomb button (right half)
    input.poll();
    expect(input.state.bomb).toBe(true);
    input.endTick();
    move(3, 300, 150); // drag across the aim-stick half
    move(3, 250, 170);
    input.poll();
    expect(input.aimStick.active).toBe(false);
    expect(input.state.fireHeld).toBe(false);
    expect(input.state.aimX).toBe(0);
    up(3, 250, 170);
    input.poll();
    expect(input.state.fireReleased).toBe(false);
    expect(input.state.bomb).toBe(false); // fired once, on press only

    down(4, 20, 20); // on the menu button (left half)
    move(4, 60, 150);
    input.poll();
    expect(input.moveStick.active).toBe(false);
    expect(input.state.moveX).toBe(0);
    up(4, 60, 150); // released outside: cancelled
    expect(menuHits).toBe(0);
  });

  it('buttons still work while both sticks are held', () => {
    down(1, 60, 150);
    down(2, 320, 150);
    move(1, 60, 175);
    move(2, 345, 150);
    input.poll();
    input.endTick();
    down(3, 362, 72); // third finger taps bomb
    up(3, 362, 72);
    down(4, 30, 20); // and the menu button
    up(4, 30, 20);
    input.poll();
    const s = input.state;
    expect(s.bomb).toBe(true);
    expect(menuHits).toBe(1);
    expect(s.moveY).toBeCloseTo(1, 5);
    expect([s.aimX, s.aimY]).toEqual([1, 0]);
    expect(s.fireHeld).toBe(true);
    expect(s.fireReleased).toBe(false);
  });

  it('one thumb per stick: a second finger on the same half is ignored', () => {
    down(1, 300, 150);
    move(1, 300, 170);
    down(2, 340, 100); // second finger, right half
    move(2, 380, 100);
    input.poll();
    expect([input.state.aimX, input.state.aimY]).toEqual([0, 1]);
    up(2, 380, 100);
    input.poll();
    expect(input.state.fireHeld).toBe(true);
    expect(input.state.fireReleased).toBe(false);
  });

  it('a flick shorter than one tick still fires once, in its direction', () => {
    down(2, 300, 150);
    move(2, 300, 130);
    up(2, 300, 130);
    input.poll();
    const s = input.state;
    expect(s.fireHeld).toBe(false);
    expect(s.firePressed).toBe(true);
    expect(s.fireReleased).toBe(true);
    expect([s.aimX, s.aimY]).toEqual([0, -1]);
  });

  it('menus (no sticks) ignore touches outside buttons; disabling sticks releases them', () => {
    down(1, 300, 150);
    move(1, 330, 150);
    input.poll();
    expect(input.state.fireHeld).toBe(true);
    input.endTick();
    input.setSticksEnabled(false);
    expect(input.aimStick.active).toBe(false);
    input.poll();
    expect(input.state.fireHeld).toBe(false);
    expect(input.state.fireReleased).toBe(true);
    input.endTick();
    move(1, 360, 150);
    down(5, 100, 150);
    move(5, 130, 150);
    input.poll();
    expect(input.moveStick.active).toBe(false);
    expect(input.state.moveX).toBe(0);
    expect(input.state.fireHeld).toBe(false);
  });

  it('release-trigger buttons: slide off cancels, pointercancel never activates', () => {
    down(1, 20, 20);
    up(1, 25, 22);
    expect(menuHits).toBe(1);
    down(1, 20, 20);
    move(1, 200, 100);
    up(1, 200, 100);
    expect(menuHits).toBe(1);
    down(1, 20, 20);
    pointer(canvas, 'pointercancel', 1, 20, 20);
    expect(menuHits).toBe(1);
    expect(menu.held).toBe(0);
  });

  it('keyboard: normalized diagonal, last arrow wins, edges on first press / last release', () => {
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    input.poll();
    const s = input.state;
    expect(Math.hypot(s.moveX, s.moveY)).toBeCloseTo(1, 5);
    expect(s.moveX).toBeGreaterThan(0);
    expect(s.moveY).toBeLessThan(0);
    key('keydown', 'ArrowLeft');
    input.poll();
    expect([s.aimX, s.aimY]).toEqual([-1, 0]);
    expect(s.firePressed).toBe(true);
    input.endTick();
    key('keydown', 'ArrowUp');
    input.poll();
    expect([s.aimX, s.aimY]).toEqual([0, -1]);
    expect(s.firePressed).toBe(false); // still the same "hold"
    key('keyup', 'ArrowUp');
    input.poll();
    expect([s.aimX, s.aimY]).toEqual([-1, 0]);
    key('keyup', 'ArrowLeft');
    input.poll();
    expect(s.fireHeld).toBe(false);
    expect(s.fireReleased).toBe(true);
    key('keydown', 'Escape');
    expect(s.pause).toBe(true);
    input.endTick();
    expect(s.pause).toBe(false);
    key('keyup', 'KeyW');
    key('keyup', 'KeyD');
    key('keyup', 'Escape');
  });

  it('ignores touches and menu keys while the rotate-your-phone card is up', () => {
    const d = fakeDisplay as unknown as { portrait: boolean };
    let menuKeys = 0;
    input.keyHandler = () => {
      menuKeys++;
      return true;
    };
    d.portrait = true;
    try {
      down(1, 20, 20); // where the (invisible) menu button is
      up(1, 20, 20);
      down(2, 300, 150);
      move(2, 330, 150);
      key('keydown', 'Escape');
      input.poll();
      expect(menuHits).toBe(0);
      expect(menuKeys).toBe(0);
      expect(input.aimStick.active).toBe(false);
      expect(input.state.fireHeld).toBe(false);
    } finally {
      d.portrait = false;
      key('keyup', 'Escape');
      input.keyHandler = null;
    }
  });

  it('sticks take the unclamped point: a thumb in the letterbox pushes all the way toward the bezel', () => {
    // The move thumb lands 10 px left of the image (the home-screen app's left inset) and pushes 40 px further left.
    down(1, -10, 150);
    move(1, -50, 150);
    input.poll();
    expect(input.state.moveX).toBeCloseTo(-1, 5);
    expect(input.state.moveY).toBe(0);
    expect(input.moveStick.originX).toBeLessThan(0);
    // Landing 3 px inside the edge and pushing into the black bar: full speed as well (it used to stop at the edge).
    up(1, -50, 150);
    down(2, 3, 150);
    move(2, -30, 150);
    input.poll();
    expect(input.state.moveX).toBeCloseTo(-1, 5);
    up(2, -30, 150);
    // The aim thumb in the right letterbox (x > 384) moving right fires at 0°.
    down(3, GAME_W + 12, 150);
    move(3, GAME_W + 24, 150);
    input.poll();
    expect(input.state.fireHeld).toBe(true);
    expect([input.state.aimX, input.state.aimY]).toEqual([1, 0]);
    // …and one below the image (the home indicator strip) aiming down.
    up(3, GAME_W + 24, 150);
    down(4, 300, GAME_H + 8);
    move(4, 300, GAME_H + 20);
    input.poll();
    expect([input.state.aimX, input.state.aimY]).toEqual([0, 1]);
    up(4, 300, GAME_H + 20);
  });

  it('buttons are still hit-tested with the clamped point (a tap on the bar beside a button reaches it)', () => {
    const edge = makeButton({ id: 'edge', x: GAME_W - 24, y: 60, w: 24, h: 24, trigger: 'press', action: 'active', pad: 4 });
    reg.use([bomb, menu, edge]);
    down(5, GAME_W + 30, 70); // on the black bar right of it: clamped onto the image edge
    input.poll();
    expect(input.state.active).toBe(true);
    expect(input.aimStick.active).toBe(false);
    up(5, GAME_W + 30, 70);
  });

  it('the perf gesture: three loose fingers held 0.6 s and lifted together, never during play', () => {
    let toggles = 0;
    input.onPerfToggle = () => toggles++;
    // In play: two sticks + a bomb tap within 250 ms (the old three-finger trigger) — nothing.
    pointer(canvas, 'pointerdown', 1, 60, 150, 'touch', 10_000);
    pointer(canvas, 'pointerdown', 2, 320, 150, 'touch', 10_050);
    pointer(canvas, 'pointerdown', 3, 360, 70, 'touch', 10_100);
    pointer(canvas, 'pointerup', 3, 360, 70, 'touch', 10_150);
    expect(toggles).toBe(0);
    // Three more fingers anywhere while both sticks are held, held long and lifted together: still nothing in play.
    pointer(canvas, 'pointerdown', 4, 100, 100, 'touch', 10_200);
    pointer(canvas, 'pointerdown', 5, 200, 100, 'touch', 10_210);
    pointer(canvas, 'pointerdown', 6, 300, 100, 'touch', 10_220);
    for (const id of [4, 5, 6]) pointer(canvas, 'pointerup', id, 100, 100, 'touch', 11_000);
    for (const id of [1, 2]) pointer(canvas, 'pointerup', id, 100, 100, 'touch', 11_000);
    expect(toggles).toBe(0);
    // Menus (no sticks): a quick three-finger tap does nothing…
    input.setSticksEnabled(false);
    for (const id of [7, 8, 9]) pointer(canvas, 'pointerdown', id, 100 + id * 20, 120, 'touch', 20_000 + id);
    for (const id of [7, 8, 9]) pointer(canvas, 'pointerup', id, 100 + id * 20, 120, 'touch', 20_100 + id);
    expect(toggles).toBe(0);
    // …held long enough but lifted one by one does nothing…
    for (const id of [7, 8, 9]) pointer(canvas, 'pointerdown', id, 100 + id * 20, 120, 'touch', 30_000 + id);
    pointer(canvas, 'pointerup', 7, 240, 120, 'touch', 30_700);
    pointer(canvas, 'pointerup', 8, 260, 120, 'touch', 31_200);
    pointer(canvas, 'pointerup', 9, 280, 120, 'touch', 31_300);
    expect(toggles).toBe(0);
    // …held 0.6 s and lifted together toggles it.
    for (const id of [7, 8, 9]) pointer(canvas, 'pointerdown', id, 100 + id * 20, 120, 'touch', 40_000 + id);
    for (const id of [7, 8, 9]) pointer(canvas, 'pointerup', id, 100 + id * 20, 120, 'touch', 40_700 + id * 10);
    expect(toggles).toBe(1);
    // A finger that starts on a button never counts.
    pointer(canvas, 'pointerdown', 10, 20, 20, 'touch', 50_000); // the menu button
    pointer(canvas, 'pointerdown', 11, 200, 120, 'touch', 50_010);
    pointer(canvas, 'pointerdown', 12, 240, 120, 'touch', 50_020);
    for (const id of [10, 11, 12]) pointer(canvas, 'pointerup', id, 200, 120, 'touch', 50_800);
    expect(toggles).toBe(1);
    input.onPerfToggle = null;
  });

  it('focus loss releases everything', () => {
    down(1, 60, 150);
    move(1, 90, 150);
    key('keydown', 'ArrowRight');
    input.poll();
    win.dispatchEvent(new Event('blur'));
    input.poll();
    expect(input.state.moveX).toBe(0);
    expect(input.state.fireHeld).toBe(false);
    expect(input.moveStick.active).toBe(false);
  });
});

describe('Display.toGameRaw (polish batch 3)', () => {
  it('maps like toGame without the clamp: the letterbox is outside 0..GAME_W × 0..GAME_H', () => {
    // The home-screen app: a 59 pt inset each side, the image 734 × 367 pt from x = 59 (≈ 1.911 CSS px per game px).
    const fake = Object.assign(Object.create(Display.prototype) as object, { view: { x: 59, y: 2.5, w: 734, h: 367, scale: 734 / GAME_W }, rectLeft: 0, rectTop: 0 });
    const raw = Display.prototype.toGameRaw.call(fake as unknown as Display, 20, 380, vec2());
    expect(raw.x).toBeCloseTo((20 - 59) / (734 / GAME_W), 5);
    expect(raw.x).toBeLessThan(0);
    expect(raw.y).toBeGreaterThan(GAME_H);
    const right = Display.prototype.toGameRaw.call(fake as unknown as Display, 840, 100, vec2());
    expect(right.x).toBeGreaterThan(GAME_W);
    // toGame clamps the same point onto the image edge (buttons, menus).
    const clamped = Display.prototype.toGame.call(fake as unknown as Display, 20, 380, vec2());
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBeCloseTo(GAME_H - 0.001, 5);
    // Inside the image both agree.
    const a = Display.prototype.toGame.call(fake as unknown as Display, 400, 200, vec2());
    const b = Display.prototype.toGameRaw.call(fake as unknown as Display, 400, 200, vec2());
    expect([a.x, a.y]).toEqual([b.x, b.y]);
  });
});

describe('VirtualStick aim (polish batch 3)', () => {
  /** Thumb travel after reaching the rim (right) until a straight push up switches the 4-way aim to up. */
  function travelToUp(stick: VirtualStick, radius: number): number {
    stick.begin(1, 0, 0);
    for (let i = 1; i <= radius; i++) stick.move(i, 0);
    expect([stick.dirX, stick.dirY]).toEqual([1, 0]);
    for (let k = 1; k <= 400; k++) {
      stick.move(radius, -k * 0.25);
      if (stick.dirY === -1) return k * 0.25;
    }
    return Infinity;
  }

  it('follows at 12 px and keeps its direction to 51°: right → up at the rim takes ≤ 14 game px (was ≈ 24)', () => {
    expect(AIM_STICK.radius).toBe(12);
    expect(SNAP_KEEP_DEG).toBe(51);
    const travel = travelToUp(new VirtualStick(AIM_STICK), AIM_STICK.radius);
    expect(travel).toBeLessThanOrEqual(14);
    expect(travel).toBeGreaterThan(8); // still some hysteresis: a wobble doesn't flip it
    // The old tuning (20 px, 56°) for comparison.
    const old = travelToUp(new VirtualStick({ ...AIM_STICK, radius: 20, flickPx: 0 }), 20);
    expect(old).toBeGreaterThan(20);
    // Dragged far past the rim first (the origin follows): the same short turn.
    const s = new VirtualStick(AIM_STICK);
    s.begin(1, 0, 0);
    for (let i = 1; i <= 60; i++) s.move(i, 0);
    let k = 0;
    while (s.dirY !== -1 && k < 400) s.move(60, -(++k) * 0.25);
    expect(k * 0.25).toBeLessThanOrEqual(14);
  });

  it("a diagonal wobble within the keep angle doesn't flip the direction", () => {
    const s = new VirtualStick(AIM_STICK);
    s.begin(1, 0, 0);
    s.move(12, 0);
    // 45° + a little: still right (the 6° of hysteresis).
    s.move(12, -12 * Math.tan(49 * (Math.PI / 180)));
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
  });

  it('360° mode is unchanged: the direction is the exact thumb angle', () => {
    const s = new VirtualStick(AIM_STICK);
    s.snap4 = false;
    s.begin(1, 50, 50);
    s.move(58, 44);
    expect(s.hasDir).toBe(true);
    expect(s.dirX).toBeCloseTo(0.8, 5);
    expect(s.dirY).toBeCloseTo(-0.6, 5);
    // Flicks never apply to 360° aim.
    s.move(58, 30, 1000);
    s.move(58, 20, 1030);
    expect(s.flicks).toBe(0);
  });

  it('a flick (≥ 6 px in a new cardinal direction within 80 ms) switches at once and re-centres', () => {
    const s = new VirtualStick(AIM_STICK);
    s.begin(1, 100, 100, 0);
    s.move(112, 100, 16);
    s.move(120, 100, 200); // resting at the rim, aiming right
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
    // 7 px straight up within 40 ms: up at once (the angle test alone would still say right).
    s.move(120, 97, 1000);
    s.move(120, 93, 1040);
    expect([s.dirX, s.dirY]).toEqual([0, -1]);
    expect(s.flicks).toBe(1);
    // Re-centred behind the thumb: holding still keeps up.
    s.move(120, 93, 1100);
    expect([s.dirX, s.dirY]).toEqual([0, -1]);
    // The same 7 px spread over 200 ms is a slow drift, not a flick.
    const slow = new VirtualStick(AIM_STICK);
    slow.begin(1, 100, 100, 0);
    slow.move(112, 100, 16);
    slow.move(120, 100, 200);
    for (let i = 1; i <= 7; i++) slow.move(120, 100 - i, 1000 + i * (200 / 7));
    expect([slow.dirX, slow.dirY]).toEqual([1, 0]);
    expect(slow.flicks).toBe(0);
    expect(FLICK_MS).toBe(80);
    // A diagonal flick is ambiguous: no switch.
    const diag = new VirtualStick(AIM_STICK);
    diag.begin(1, 100, 100, 0);
    diag.move(120, 100, 200);
    diag.move(115, 95, 1000);
    diag.move(113, 93, 1030);
    expect(diag.flicks).toBe(0);
  });

  it('no flick for a wobble across the current axis, or for easing back toward the centre', () => {
    // Aiming right at the rim, the thumb swings from 30° above the axis to 30° below within 40 ms: still right.
    const s = new VirtualStick(AIM_STICK);
    s.begin(1, 100, 100, 0);
    s.move(110.4, 94, 200);
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
    s.move(110.4, 106, 1000);
    s.move(110.4, 106, 1040);
    expect([s.dirX, s.dirY]).toEqual([1, 0]);
    expect(s.flicks).toBe(0);
    // Pushed out to the rim, then quickly relaxed 8 px back toward the centre: still right (not a flick left).
    const r = new VirtualStick(AIM_STICK);
    r.begin(1, 100, 100, 0);
    r.move(112, 100, 200);
    r.move(104, 100, 1000);
    r.move(104, 100, 1030);
    expect([r.dirX, r.dirY]).toEqual([1, 0]);
    expect(r.flicks).toBe(0);
  });

  it('the move stick has no flick and keeps its 24 px radius', () => {
    expect(MOVE_STICK.radius).toBe(24);
    expect(MOVE_STICK.flickPx).toBe(0);
  });
});
