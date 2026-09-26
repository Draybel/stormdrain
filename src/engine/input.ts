/**
 * Touch + mouse + keyboard → InputState (ARCHITECTURE §2).
 *
 * Pointer Events on the canvas, multi-touch by pointerId. On pointer-down the button registry is
 * hit-tested FIRST; a pointer that starts on a button belongs to that button until it lifts.
 * Otherwise (when the current scene wants sticks) the left half spawns the floating move stick and
 * the right half the floating shoot stick. Keyboard: WASD move, arrows shoot (last pressed wins),
 * E bomb, Space active, Q consumable, Esc/P pause, Tab map, ` debug.
 *
 * Edge flags accumulate between ticks and are cleared by `endTick()` after each sim step.
 */

import type { Display } from './display';
import { buttonContains, type ButtonRegistry, type HitButton } from './buttons';
import { clearEdges, createInputState, resetInput, type InputState } from './inputState';
import { vec2 } from './math';
import { GAME_W } from './screen';
import { AIM_STICK, MOVE_STICK, VirtualStick } from './sticks';

export type InputDevice = 'touch' | 'mouse' | 'keyboard';

/** Keys whose browser default (scrolling, focus change) we suppress. */
const SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backquote']);

// Arrow index → direction.
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] as const;
const ARROW_DX = [0, 0, -1, 1] as const;
const ARROW_DY = [-1, 1, 0, 0] as const;

/** Extra slop (game px) a finger may drift outside a button and still count as "inside". */
const RELEASE_SLOP = 6;

export class Input {
  readonly state: InputState = createInputState();
  readonly moveStick = new VirtualStick(MOVE_STICK);
  readonly aimStick = new VirtualStick(AIM_STICK);
  /** The top scene wants twin sticks (in-run). */
  private sticksEnabled = false;
  /** True once a touch has been seen: show touch controls. */
  touchUsed = false;
  lastDevice: InputDevice = 'mouse';
  /**
   * Offered every fresh key press before game handling; return true to consume it (menus).
   */
  keyHandler: ((code: string) => boolean) | null = null;
  onDebugToggle: (() => void) | null = null;

  private readonly canvas: HTMLCanvasElement;
  private readonly display: Display;
  private readonly registry: ButtonRegistry;
  private readonly owners = new Map<number, HitButton | VirtualStick>();
  private readonly keys = new Set<string>();
  private readonly arrowStamp = [0, 0, 0, 0];
  private stamp = 0;
  private lastAimX = 1;
  private lastAimY = 0;
  private readonly pt = vec2();
  /** Touch pointers currently down, and when they landed (3-finger tap = perf overlay). */
  private readonly touchDown = new Map<number, number>();

  constructor(canvas: HTMLCanvasElement, display: Display, registry: ButtonRegistry) {
    this.canvas = canvas;
    this.display = display;
    this.registry = registry;
    if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) {
      this.touchUsed = true;
      this.lastDevice = 'touch';
    }

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('lostpointercapture', this.onPointerCancel);
    canvas.addEventListener('contextmenu', prevent);
    // Kill scrolling, zooming, callouts and double-tap zoom on iOS.
    const nonPassive: AddEventListenerOptions = { passive: false };
    canvas.addEventListener('touchstart', prevent, nonPassive);
    canvas.addEventListener('touchmove', prevent, nonPassive);
    canvas.addEventListener('touchend', prevent, nonPassive);
    document.addEventListener('gesturestart', prevent, nonPassive);
    document.addEventListener('gesturechange', prevent, nonPassive);
    document.addEventListener('dblclick', prevent, nonPassive);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.releaseAll);
  }

  get sticksActive(): boolean {
    return this.sticksEnabled;
  }

  /** 360° free aim instead of 4-way snapping (Settings → Aim). */
  setAim360(on: boolean): void {
    this.aimStick.snap4 = !on;
  }

  setSticksEnabled(on: boolean): void {
    if (this.sticksEnabled === on) return;
    this.sticksEnabled = on;
    if (!on) {
      this.endStick(this.moveStick);
      this.endStick(this.aimStick);
    }
  }

  /** Recompute continuous fields (move/aim/fireHeld). Call right before each sim tick. */
  poll(): void {
    const s = this.state;
    // Move: the touch stick wins while active.
    if (this.moveStick.active) {
      s.moveX = this.moveStick.outX;
      s.moveY = this.moveStick.outY;
    } else {
      const k = this.keys;
      let mx = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
      let my = (k.has('KeyS') ? 1 : 0) - (k.has('KeyW') ? 1 : 0);
      if (mx !== 0 && my !== 0) {
        mx *= Math.SQRT1_2;
        my *= Math.SQRT1_2;
      }
      s.moveX = mx;
      s.moveY = my;
    }

    // Aim: touch stick with a committed direction, else the most recently pressed held arrow.
    let held = false;
    let ax = 0;
    let ay = 0;
    if (this.aimStick.active && this.aimStick.hasDir) {
      held = true;
      ax = this.aimStick.dirX;
      ay = this.aimStick.dirY;
    } else {
      let best = 0;
      for (let i = 0; i < 4; i++) {
        if (this.keys.has(ARROWS[i]!) && this.arrowStamp[i]! > best) {
          best = this.arrowStamp[i]!;
          ax = ARROW_DX[i]!;
          ay = ARROW_DY[i]!;
          held = true;
        }
      }
    }
    if (held) {
      this.lastAimX = ax;
      this.lastAimY = ay;
      s.aimX = ax;
      s.aimY = ay;
    } else if (s.firePressed) {
      // A tap shorter than a tick still fires once, in the direction it committed to.
      s.aimX = this.lastAimX;
      s.aimY = this.lastAimY;
    } else {
      s.aimX = 0;
      s.aimY = 0;
    }
    s.fireHeld = held;
  }

  /** Clear edge flags. Call after every sim tick. */
  endTick(): void {
    clearEdges(this.state);
  }

  /** Drop every held key/pointer (focus lost, backgrounded). */
  readonly releaseAll = (): void => {
    this.keys.clear();
    this.endStick(this.moveStick);
    this.endStick(this.aimStick);
    for (const o of this.owners.values()) {
      if (!(o instanceof VirtualStick)) {
        o.held = 0;
        o.armed = false;
      }
    }
    this.owners.clear();
    this.touchDown.clear();
    resetInput(this.state);
  };

  private endStick(stick: VirtualStick): void {
    if (!stick.active) return;
    if (stick === this.aimStick && stick.hasDir) this.state.fireReleased = true;
    this.owners.delete(stick.pointerId);
    stick.end();
  }

  private activate(b: HitButton): void {
    b.flash = 0;
    if (b.action) this.state[b.action] = true;
    b.onActivate?.();
  }

  // ── Pointer events ────────────────────────────────────────────────────────
  private readonly onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    // Portrait shows the rotate card over an invisible game: nothing underneath may be pressed
    // (a tap where "Resume" would be must not unpause the run behind the card).
    if (this.display.portrait) return;
    if (e.pointerType === 'mouse') {
      if (e.button !== 0) return;
      this.lastDevice = 'mouse';
    } else {
      this.lastDevice = 'touch';
      this.touchUsed = true;
      this.touchDown.set(e.pointerId, e.timeStamp);
      this.checkThreeFingerTap(e.timeStamp);
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail for synthetic events; harmless */
    }
    const p = this.display.toGame(e.clientX, e.clientY, this.pt);
    const b = this.registry.hitTest(p.x, p.y);
    if (b) {
      this.owners.set(e.pointerId, b);
      b.held++;
      b.armed = true;
      if (b.trigger === 'press') this.activate(b);
      return;
    }
    if (!this.sticksEnabled) return;
    const stick = p.x < GAME_W / 2 ? this.moveStick : this.aimStick;
    if (stick.active) return; // one thumb per stick
    stick.begin(e.pointerId, p.x, p.y);
    this.owners.set(e.pointerId, stick);
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    const o = this.owners.get(e.pointerId);
    if (!o) return;
    e.preventDefault();
    const p = this.display.toGame(e.clientX, e.clientY, this.pt);
    if (o instanceof VirtualStick) {
      if (o.pointerId !== e.pointerId) return;
      const had = o.hasDir;
      o.move(p.x, p.y);
      if (o === this.aimStick && !had && o.hasDir) {
        this.state.firePressed = true;
        this.lastAimX = o.dirX;
        this.lastAimY = o.dirY;
      }
    } else {
      o.armed = buttonContains(o, p.x, p.y, RELEASE_SLOP);
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    this.finishPointer(e, true);
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    this.finishPointer(e, false);
  };

  private finishPointer(e: PointerEvent, allowActivate: boolean): void {
    this.touchDown.delete(e.pointerId);
    const o = this.owners.get(e.pointerId);
    if (!o) return;
    this.owners.delete(e.pointerId);
    try {
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (o instanceof VirtualStick) {
      if (o.pointerId === e.pointerId) {
        if (o === this.aimStick && o.hasDir) this.state.fireReleased = true;
        o.end();
      }
      return;
    }
    o.held = Math.max(0, o.held - 1);
    const p = this.display.toGame(e.clientX, e.clientY, this.pt);
    const inside = buttonContains(o, p.x, p.y, RELEASE_SLOP);
    if (o.held === 0) o.armed = false;
    if (allowActivate && o.trigger === 'release' && inside && o.enabled && this.registry.has(o)) this.activate(o);
  }

  /** Three fingers landing within 250 ms toggles the debug overlay (no keyboard on phones). */
  private checkThreeFingerTap(t: number): void {
    if (this.touchDown.size !== 3) return;
    for (const t0 of this.touchDown.values()) if (t - t0 > 250) return;
    this.onDebugToggle?.();
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (SWALLOW.has(code)) e.preventDefault();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    this.lastDevice = 'keyboard';
    if (e.repeat) return;
    this.keys.add(code);
    if (code === 'Backquote') {
      this.onDebugToggle?.();
      return;
    }
    if (this.display.portrait) return; // menus are hidden behind the rotate card
    if (this.keyHandler?.(code)) return;
    const s = this.state;
    switch (code) {
      case 'KeyE':
        s.bomb = true;
        break;
      case 'Space':
        s.active = true;
        break;
      case 'KeyQ':
        s.consumable = true;
        break;
      case 'Escape':
      case 'KeyP':
        s.pause = true;
        break;
      case 'Tab':
        s.map = true;
        break;
      default: {
        const i = ARROWS.indexOf(code as (typeof ARROWS)[number]);
        if (i >= 0) {
          const anyBefore = this.arrowStamp.some((st, j) => j !== i && st > 0 && this.keys.has(ARROWS[j]!));
          this.arrowStamp[i] = ++this.stamp;
          this.lastAimX = ARROW_DX[i]!;
          this.lastAimY = ARROW_DY[i]!;
          if (!anyBefore) s.firePressed = true;
        }
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const code = e.code;
    const wasArrow = ARROWS.includes(code as (typeof ARROWS)[number]) && this.keys.has(code);
    this.keys.delete(code);
    if (wasArrow && !ARROWS.some((a) => this.keys.has(a))) this.state.fireReleased = true;
  };
}

function prevent(e: Event): void {
  if (e.cancelable) e.preventDefault();
}
