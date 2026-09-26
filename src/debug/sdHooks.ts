/**
 * `window.__SD` — read-only accessors + debug actions for E2E tests and the debug menu
 * (ARCHITECTURE §9). Present in all builds; it exposes nothing sensitive.
 */

import type { Insets } from '../engine/display';
import type { Sim, SimSummary } from '../sim/sim';
import { vec2 } from '../engine/math';
import type { App } from '../ui/app';
import type { PerfOverlay } from './perfOverlay';
import type { Loop } from '../engine/loop';
import type { ButtonRegistry } from '../engine/buttons';

export interface CssRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Centre, in CSS px (what a test taps). */
  cx: number;
  cy: number;
}

export interface ButtonInfo {
  id: string;
  /** Game-pixel rect. */
  x: number;
  y: number;
  w: number;
  h: number;
  enabled: boolean;
  css: CssRect;
}

export interface SDHooks {
  readonly scene: string;
  readonly stack: string[];
  readonly fps: number;
  readonly ticks: number;
  /** Where the game image is drawn (CSS px) + viewport info. */
  readonly view: { x: number; y: number; w: number; h: number; scale: number; cssW: number; cssH: number; dpr: number };
  readonly safe: Insets;
  readonly portrait: boolean;
  /** The currently hit-testable buttons (top scene). */
  buttons(): ButtonInfo[];
  button(id: string): ButtonInfo | null;
  readonly sim: Sim | null;
  run(): SimSummary | null;
  readonly counts: { particles: number; projectiles: number };
  readonly debug: {
    overlay(on?: boolean): boolean;
    hurt(): void;
    kill(): void;
    aim360(on: boolean): void;
    newRun(): void;
    title(): void;
    pause(): void;
  };
}

declare global {
  interface Window {
    __SD: SDHooks;
  }
}

export interface SdDeps {
  app: App;
  loop: Loop;
  perf: PerfOverlay;
  registry: ButtonRegistry;
  /** Returns the live run sim if a run scene exists. */
  getSim(): Sim | null;
}

export function installSdHooks(d: SdDeps): SDHooks {
  const { app, loop, perf, registry } = d;
  const tmp = vec2();
  const info = (b: { id: string; x: number; y: number; w: number; h: number; enabled: boolean }): ButtonInfo => {
    app.display.toClient(b.x, b.y, tmp);
    const x = tmp.x;
    const y = tmp.y;
    app.display.toClient(b.x + b.w, b.y + b.h, tmp);
    const w = tmp.x - x;
    const h = tmp.y - y;
    return { id: b.id, x: b.x, y: b.y, w: b.w, h: b.h, enabled: b.enabled, css: { x, y, w, h, cx: x + w / 2, cy: y + h / 2 } };
  };
  const hooks: SDHooks = {
    get scene() {
      return app.scenes.name;
    },
    get stack() {
      return app.scenes.names;
    },
    get fps() {
      return loop.fps;
    },
    get ticks() {
      return loop.ticks;
    },
    get view() {
      const v = app.display.view;
      return { x: v.x, y: v.y, w: v.w, h: v.h, scale: v.scale, cssW: app.display.cssW, cssH: app.display.cssH, dpr: app.display.dpr };
    },
    get safe() {
      return { ...app.display.safe };
    },
    get portrait() {
      return app.display.portrait;
    },
    buttons() {
      return registry.buttons.filter((b) => b.visible).map(info);
    },
    button(id: string) {
      const b = registry.buttons.find((x) => x.id === id);
      return b ? info(b) : null;
    },
    get sim() {
      return d.getSim();
    },
    run() {
      return d.getSim()?.summary() ?? null;
    },
    get counts() {
      return { particles: app.particles.count, projectiles: d.getSim()?.world.projectiles.count ?? 0 };
    },
    debug: {
      overlay(on?: boolean) {
        if (on === undefined || on !== perf.visible) perf.toggle();
        return perf.visible;
      },
      hurt() {
        d.getSim()?.hurtPlayer(1);
      },
      kill() {
        d.getSim()?.killPlayer();
      },
      aim360(on: boolean) {
        app.settings.update({ aim360: on });
      },
      newRun() {
        app.nav.newRun();
      },
      title() {
        app.nav.title();
      },
      pause() {
        app.nav.pause();
      },
    },
  };
  window.__SD = hooks;
  return hooks;
}
