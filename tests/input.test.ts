/**
 * Input (touch + keyboard → InputState) driven headlessly: a stub canvas/window/document built on
 * node's EventTarget, and a Display stand-in whose client coordinates ARE game pixels.
 * Covers the multi-touch contract of ARCHITECTURE §2: two thumbs at once, buttons hit-tested
 * before sticks, buttons usable while a stick is held, and edge flags.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ButtonRegistry, makeButton, type HitButton } from '../src/engine/buttons';
import type { Display } from '../src/engine/display';
import type { Input as InputClass } from '../src/engine/input';
import type { Vec2 } from '../src/engine/math';
import { GAME_H, GAME_W } from '../src/engine/screen';

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

function pointer(target: EventTarget, type: string, id: number, x: number, y: number, pointerType = 'touch'): void {
  const e = new Event(type, { cancelable: true });
  t += 20;
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
