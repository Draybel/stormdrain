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
import type { HudRect } from '../render/hud';
import type { PickupName } from '../sim/types';
import type { DebugActions } from './actions';
import type { FloorCurse } from '../sim/floor/types';
import type { RunOptions } from '../sim/run/types';
import { findAchievement } from '../content/registry';

/** Meta progress at a glance (window.__SD.meta()). */
export interface MetaSummary {
  /** Earned achievement ids (sorted). */
  achievements: string[];
  /** Unlock sets (sorted ids per kind). */
  unlocks: Record<string, string[]>;
  stats: Record<string, number>;
  counters: Record<string, number>;
  /** Items seen / collected, enemies seen / killed (distinct ids). */
  collection: { seen: number; collected: number };
  bestiary: { seen: number; killed: number };
  /** A run save exists (the title shows Continue); run saves written this session; saves that failed. */
  hasRun: boolean;
  runSaves: number;
  lastRunError: string | null;
  /** The meta save's load status ('ok' | 'empty' | 'restored' | 'corrupt' | 'future'). */
  loaded: string;
  /** The unlock snapshot a new run would carry. */
  runUnlocks: string[];
}

/** The run scene's presentation state (window.__SD.presentation()). */
export interface Presentation {
  slide: boolean;
  iris: number;
  card: boolean;
  ending: string;
  bossCard: boolean;
  slowmo: boolean;
  endingId: number;
}

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
  /** Loop cost (smoothed ms): one sim tick incl. event handling, one render; steps dropped so far. */
  readonly perf: { updateMs: number; renderMs: number; droppedSteps: number };
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
  /** In-run HUD element rects (game px): hearts, counters, charge bar, trinkets, banner. */
  hud(): HudRect[];
  readonly counts: { particles: number; projectiles: number; enemies: number; enemyShots: number; beams: number };
  readonly debug: {
    overlay(on?: boolean): boolean;
    hurt(): void;
    kill(): void;
    /** Gives an item by id (as a fresh pickup). */
    give(id: string): void;
    /** Puts an item on a pedestal next to the player. */
    spawnItem(id: string): boolean;
    /** Gives n random treasure passives; returns their ids. */
    giveRandom(n: number): string[];
    /** Every item id / enemy id the debug menu lists. */
    items(): string[];
    enemies(): string[];
    /** Red health back to full. */
    heal(): void;
    /** Adds coins / bombs / keys (default +10 each). */
    add(coins?: number, bombs?: number, keys?: number): void;
    /** Kills every enemy, clears enemy shots and creep (a running wave then clears). */
    clearRoom(): void;
    /** Drops every held item. */
    resetItems(): void;
    /** Training yard: endless waves on/off. */
    autoWaves(on: boolean): void;
    /** Opens (true) / closes (false) / toggles the debug menu; returns whether it is open. */
    menu(open?: boolean): boolean;
    /** Pops a pickup out next to the player. */
    spawn(kind: PickupName): void;
    /** Counts as clearing the room (charges actives, fires roomClear triggers). */
    roomClear(): void;
    /** Training-yard arena: spawns a wave of chapter 1 enemies (like F / the bell). Returns the count. */
    wave(count?: number): number;
    /** Spawns one enemy by id (optionally forcing a champion id, or false for none). */
    spawnEnemy(id: string, champion?: string | false): boolean;
    /** Kills every enemy in the room. */
    killEnemies(): void;
    /** God mode: the player takes no damage. */
    god(on: boolean): void;
    aim360(on: boolean): void;
    newRun(): void;
    title(): void;
    pause(): void;
    // ── Floor runs (Phase 3A) ──
    /** The training yard (a new yard scene). */
    yard(): void;
    /** Walk through the door on side 0 N, 1 E, 2 S, 3 W (a locked one takes a key first). True if the room changed. */
    door(side: number): boolean;
    /** Jump to a room (default: the boss room). */
    teleport(room?: number): boolean;
    /** Drop to the next floor; returns the floor number. */
    skipFloor(): number;
    revealMap(): boolean;
    /** Set / lift the floor curse. */
    curse(c: FloorCurse | null): void;
    /** Opens the big map overlay. */
    map(): void;
    /**
     * Restarts the run scene on any floor / track (curse: undefined rolled, null none; unlocked: item ids /
     * 'ending1' / 'ending2'); returns false without a run scene.
     */
    runAt(floor: number, track?: 'main' | 'alt', curse?: FloorCurse | null, seed?: number | string, unlocked?: string[]): boolean;
    // ── Bosses (Phase 3B) ──
    /** Every boss id. */
    bosses(): string[];
    /** Starts a boss fight in the current room (default: the debug menu's selection). */
    boss(id?: string): boolean;
  };
  /**
   * Run-scene presentation: camera slide, iris phase (1 closing, 2 opening), floor card, ending (and the
   * ending id), the boss intro card, boss-death slow motion.
   */
  presentation(): Presentation | null;
  /** Meta progress (Phase 4A): achievements, unlocks, lifetime stats, collection / bestiary sizes, the run save. */
  meta(): MetaSummary;
  /** The toast on screen (achievement / notice), and how many are waiting. */
  toast(): { kind: number; title: string; line: string; pending: number } | null;
  /** Saving (Phase 4A): save the run now; grant an achievement by id (true if newly earned). */
  save: {
    now(): boolean;
    achievement(id: string): boolean;
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
  /** HUD rects of the run scene (empty when there is none). */
  getHudRects(): HudRect[];
  /** The debug actions (shared with the debug menu). */
  actions: DebugActions;
  /** The run scene's transition state (null without a run scene). */
  getPresentation(): Presentation | null;
  /** Restarts the run scene's run (debug). */
  restartRun(opts: RunOptions, seed?: number | string): boolean;
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
    get perf() {
      return { updateMs: loop.updateMs, renderMs: loop.renderMs, droppedSteps: loop.droppedSteps };
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
    hud() {
      return d.getHudRects();
    },
    get counts() {
      const w = d.getSim()?.world;
      return {
        particles: app.particles.count,
        projectiles: w?.projectiles.count ?? 0,
        enemies: w?.enemies.count ?? 0,
        enemyShots: w?.enemyShots.count ?? 0,
        beams: w?.atk.beams.count ?? 0,
      };
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
      give(id: string) {
        d.getSim()?.giveItem(id);
      },
      spawnItem(id: string) {
        return d.actions.spawnItem(id);
      },
      giveRandom(n: number) {
        return d.actions.giveRandom(n);
      },
      items() {
        return d.actions.items().map((x) => x.id);
      },
      enemies() {
        return d.actions.enemies().map((x) => x.id);
      },
      heal() {
        d.actions.fullHeal();
      },
      add(coins = 10, bombs = 10, keys = 10) {
        d.getSim()?.addPickups(coins, bombs, keys);
      },
      clearRoom() {
        d.actions.clearRoom();
      },
      resetItems() {
        d.actions.resetItems();
      },
      autoWaves(on: boolean) {
        d.actions.autoWaves(on);
      },
      menu(open?: boolean) {
        const isOpen = app.scenes.name === 'debug';
        if (open === undefined || open !== isOpen) app.nav.debug();
        return app.scenes.name === 'debug';
      },
      spawn(kind: PickupName) {
        d.getSim()?.spawnPickup(kind);
      },
      roomClear() {
        d.getSim()?.roomCleared();
      },
      wave(count?: number) {
        return d.getSim()?.startWave(count === undefined ? {} : { count }) ?? 0;
      },
      spawnEnemy(id: string, champion?: string | false) {
        return !!d.getSim()?.spawnEnemy(id, undefined, undefined, { champion: champion === undefined ? true : champion });
      },
      killEnemies() {
        d.getSim()?.killEnemies();
      },
      god(on: boolean) {
        const sim = d.getSim();
        if (sim) sim.world.godMode = on;
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
      yard() {
        app.nav.yard();
      },
      door(side: number) {
        return d.getSim()?.run?.goThroughDoor(side) ?? false;
      },
      teleport(room?: number) {
        return d.actions.teleport(room);
      },
      skipFloor() {
        return d.actions.skipFloor();
      },
      revealMap() {
        return d.actions.revealMap();
      },
      curse(c: FloorCurse | null) {
        d.actions.curse(c);
      },
      map() {
        app.nav.map();
      },
      runAt(floor: number, track: 'main' | 'alt' = 'main', curse?: FloorCurse | null, seed?: number | string, unlocked?: string[]) {
        return d.restartRun({ floor, track, curse, unlocked }, seed);
      },
      bosses() {
        return d.actions.bosses();
      },
      boss(id?: string) {
        return d.actions.bossFight(id);
      },
    },
    presentation() {
      return d.getPresentation();
    },
    meta() {
      const s = app.save;
      const m = s.meta.state;
      const unlocks: Record<string, string[]> = {};
      for (const [k, set] of Object.entries(m.unlocks)) unlocks[k] = [...set].sort();
      const stats: Record<string, number> = {};
      for (const [k, v] of Object.entries(m.stats)) if (typeof v === 'number') stats[k] = v;
      let seen = 0;
      let collected = 0;
      for (const e of Object.values(m.collection)) {
        if (e.seen > 0) seen++;
        if (e.collected > 0) collected++;
      }
      let met = 0;
      let killed = 0;
      for (const e of Object.values(m.bestiary)) {
        if (e.seen > 0) met++;
        if (e.killed > 0) killed++;
      }
      return {
        achievements: Object.keys(m.achievements).sort(),
        unlocks,
        stats,
        counters: { ...m.stats.counters },
        collection: { seen, collected },
        bestiary: { seen: met, killed },
        hasRun: s.hasRun(),
        runSaves: s.runSaves,
        lastRunError: s.lastRunError,
        loaded: s.meta.loaded.status,
        runUnlocks: s.unlockedForRun(),
      };
    },
    toast() {
      const t = app.toasts.showing;
      return t ? { ...t, pending: app.toasts.pending } : null;
    },
    save: {
      now() {
        return app.save.saveRunNow();
      },
      achievement(id: string) {
        const def = findAchievement(id);
        return def ? app.save.achievements.grant(def) : false;
      },
    },
  };
  window.__SD = hooks;
  return hooks;
}
