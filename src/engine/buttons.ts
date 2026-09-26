/**
 * On-screen button registry (game px rects). Input hit-tests these BEFORE the virtual sticks:
 * a pointer that starts on a button is owned by that button for its whole life.
 *
 * - trigger 'press'   → activates on pointer-down (in-game action buttons: bomb, pause, …)
 * - trigger 'release' → activates on pointer-up inside the same button (menus), so a thumb
 *                       can slide off to cancel.
 */

import type { InputAction } from './inputState';

export interface HitButton {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Extra invisible hit margin (game px) — thumbs are fat. */
  pad: number;
  enabled: boolean;
  visible: boolean;
  trigger: 'press' | 'release';
  /** InputState edge flag to raise on activation (game buttons). */
  action: InputAction | null;
  /** Callback on activation (menu buttons). */
  onActivate: (() => void) | null;
  /** Pointers currently holding this button (for pressed visuals). */
  held: number;
  /** True while a holding pointer is inside the rect (release would activate). */
  armed: boolean;
  /** Seconds since last activation (for a little flash); owners may advance it. */
  flash: number;
}

export function makeButton(init: Partial<HitButton> & { id: string }): HitButton {
  return {
    x: 0,
    y: 0,
    w: 24,
    h: 24,
    pad: 2,
    enabled: true,
    visible: true,
    trigger: 'release',
    action: null,
    onActivate: null,
    held: 0,
    armed: false,
    flash: 1,
    ...init,
  };
}

export function buttonContains(b: HitButton, x: number, y: number, extra = 0): boolean {
  const p = b.pad + extra;
  return x >= b.x - p && x < b.x + b.w + p && y >= b.y - p && y < b.y + b.h + p;
}

export class ButtonRegistry {
  private list: readonly HitButton[] = [];

  /** Replace the active set (the top scene's buttons). The array is referenced, not copied. */
  use(list: readonly HitButton[]): void {
    // Drop pressed/flash state on buttons that leave the registry so visuals never stick
    // (e.g. the HUD pause button would otherwise stay lit under the pause overlay, because the
    // covered run scene no longer ticks its flash timer).
    for (const b of this.list) {
      if (!list.includes(b)) {
        b.held = 0;
        b.armed = false;
        b.flash = 1;
      }
    }
    this.list = list;
  }

  get buttons(): readonly HitButton[] {
    return this.list;
  }

  /** Topmost (last-listed) enabled, visible button under (x, y), or null. */
  hitTest(x: number, y: number): HitButton | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i] as HitButton;
      if (b.enabled && b.visible && buttonContains(b, x, y)) return b;
    }
    return null;
  }

  has(b: HitButton): boolean {
    return this.list.includes(b);
  }
}
