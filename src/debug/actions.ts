/**
 * Debug actions (Phase 2D) shared by the hidden debug menu, `window.__SD.debug` and the headless
 * tests. DOM-free: everything goes through the live Sim (and an optional perf-overlay toggle), so it
 * runs in node exactly as in the browser.
 */

import { allChampions, allItems, BOSSES, ENEMIES } from '../content/registry';
import type { BossDef } from '../sim/types';
import type { Sim } from '../sim/sim';
import { FLOOR_CURSES, type FloorCurse } from '../sim/floor/types';
import type { EnemyDef, ItemDef } from '../sim/types';

export interface DebugHost {
  /** The live run's sim (null outside a run). */
  sim(): Sim | null;
  /** Perf overlay: set (true/false) or toggle (undefined); returns the new state. */
  perf?(on?: boolean): boolean;
  /** Is the perf overlay showing? */
  perfVisible?(): boolean;
  /** Go to the training yard / start a fresh real run (scene navigation). */
  yard?(): void;
  newRun?(): void;
  /** Meta progress (Phase 5): unlock everything (returns how many were new) / back to a brand-new player. */
  unlockAll?(): number;
  resetUnlocks?(): void;
}

/** List order in the menu: attack types, modifiers, weird items, familiars, other passives, actives, trinkets, consumables. */
function itemRank(d: ItemDef): number {
  if (d.kind === 'active') return 5;
  if (d.kind === 'trinket') return 6;
  if (d.kind === 'consumable') return 7;
  if (d.tags.includes('starter-attack')) return 0;
  if (d.tags.includes('modifier')) return 1;
  if (d.tags.includes('weird')) return 2;
  if (d.tags.includes('familiar')) return 3;
  return 4;
}

export class DebugActions {
  private readonly host: DebugHost;
  private itemList: ItemDef[] | null = null;
  private enemyList: EnemyDef[] | null = null;

  constructor(host: DebugHost) {
    this.host = host;
  }

  get sim(): Sim | null {
    return this.host.sim();
  }

  /** Every content item (test-only items excluded), grouped for the menu. */
  items(): readonly ItemDef[] {
    if (!this.itemList) {
      this.itemList = allItems()
        .filter((d) => !d.tags.includes('test'))
        .map((d, i) => ({ d, i }))
        .sort((a, b) => itemRank(a.d) - itemRank(b.d) || a.i - b.i)
        .map((e) => e.d);
    }
    return this.itemList;
  }

  /** Every enemy def (registry order). */
  enemies(): readonly EnemyDef[] {
    return (this.enemyList ??= [...ENEMIES.values()].filter((d) => !d.id.startsWith('t-')));
  }

  /** Puts the item on a pedestal next to the player. */
  spawnItem(id: string): boolean {
    return !!this.sim?.spawnItemPedestal(id);
  }

  /** Gives the item directly (as a fresh pickup: banner, one-time effects). */
  giveItem(id: string): boolean {
    const sim = this.sim;
    if (!sim) return false;
    sim.giveItem(id);
    return true;
  }

  /** Gives `n` random treasure-pool passives (the chaos button). Returns their ids. */
  giveRandom(n: number, random: () => number = Math.random): string[] {
    const sim = this.sim;
    if (!sim) return [];
    const pool = this.items().filter((d) => d.kind === 'passive' && d.pools.includes('treasure'));
    const out: string[] = [];
    for (let i = 0; i < n && pool.length > 0; i++) {
      const d = pool[Math.floor(random() * pool.length) % pool.length]!;
      sim.giveItem(d.id);
      out.push(d.id);
    }
    return out;
  }

  /** Spawns an enemy across the room; `champion` forces a random champion variant. */
  spawnEnemy(id: string, champion = false, random: () => number = Math.random): boolean {
    const sim = this.sim;
    if (!sim) return false;
    let ch: string | false = false;
    if (champion) {
      const all = allChampions();
      ch = all.length > 0 ? all[Math.floor(random() * all.length) % all.length]!.id : false;
    }
    const e = sim.spawnEnemy(id, undefined, undefined, { champion: ch });
    return !!e;
  }

  /** God mode: set, or toggle when `on` is omitted. Returns the new state. */
  god(on?: boolean): boolean {
    const sim = this.sim;
    if (!sim) return false;
    sim.world.godMode = on ?? !sim.world.godMode;
    return sim.world.godMode;
  }

  isGod(): boolean {
    return this.sim?.world.godMode ?? false;
  }

  fullHeal(): void {
    this.sim?.fullHeal();
  }

  addCoins(n = 10): void {
    this.sim?.addPickups(n, 0, 0);
  }

  addBombs(n = 10): void {
    this.sim?.addPickups(0, n, 0);
  }

  addKeys(n = 10): void {
    this.sim?.addPickups(0, 0, n);
  }

  /** Kills every enemy and clears hostile shots / creep (a running wave then clears normally). */
  clearRoom(): void {
    this.sim?.clearRoom();
  }

  /** Starts an arena wave now (0 if one is running). */
  wave(): number {
    return this.sim?.startWave() ?? 0;
  }

  /** Endless waves in the training yard: set, or toggle when omitted. Returns the new state. */
  autoWaves(on?: boolean): boolean {
    const sim = this.sim;
    if (!sim) return false;
    sim.autoWaves = on ?? !sim.autoWaves;
    return sim.autoWaves;
  }

  isAutoWaves(): boolean {
    return this.sim?.autoWaves ?? false;
  }

  /** Drops every held item. */
  resetItems(): void {
    this.sim?.resetItems();
  }

  /** Counts as clearing the room: +1 active charge, 'roomClear' triggers. */
  chargeActive(): void {
    this.sim?.roomCleared();
  }

  /** Leaves for the training yard (a new yard scene). */
  yard(): void {
    this.host.yard?.();
  }

  /** Starts a fresh real run. */
  newRun(): void {
    this.host.newRun?.();
  }

  /** Floor runs: drops to the next floor now. Returns the new floor (0 outside a run). */
  skipFloor(): number {
    const run = this.sim?.run;
    if (!run) return 0;
    run.skipFloor();
    return run.data.floor;
  }

  /** Floor runs: reveals the whole map (secret rooms included). */
  revealMap(): boolean {
    const run = this.sim?.run;
    if (!run) return false;
    run.revealMap();
    return true;
  }

  /** Floor runs: the current floor's curse → the next one (none → darkness → … → deluge → none). */
  nextCurse(): FloorCurse | null {
    const run = this.sim?.run;
    if (!run) return null;
    const cur = run.data.layout.curse;
    const i = cur ? FLOOR_CURSES.indexOf(cur) : -1;
    const next = i + 1 < FLOOR_CURSES.length ? FLOOR_CURSES[i + 1]! : null;
    run.setCurse(next);
    return next;
  }

  /** Floor runs: sets (or lifts) the curse. */
  curse(c: FloorCurse | null): void {
    this.sim?.run?.setCurse(c);
  }

  /** Floor runs: jumps to the boss room (or any room index). Returns false outside a run. */
  teleport(room?: number): boolean {
    const run = this.sim?.run;
    if (!run) return false;
    run.teleport(room ?? run.data.layout.boss);
    return true;
  }

  /** Every boss id (registry order): bosses, minibosses and finals. */
  bosses(): string[] {
    return [...BOSSES.keys()];
  }

  private bossList: BossDef[] | null = null;

  /** Every boss def for the menu's BOSSES tab: bosses, then minibosses, then finals (registry order within). */
  bossDefs(): readonly BossDef[] {
    const rank = { boss: 0, miniboss: 1, final: 2 } as const;
    return (this.bossList ??= [...BOSSES.values()].map((d, i) => ({ d, i })).sort((a, b) => rank[a.d.kind] - rank[b.d.kind] || a.i - b.i).map((e) => e.d));
  }

  /** Meta progress: unlocks every item, character, ending and route. Returns how many were new (-1: no save). */
  unlockAll(): number {
    return this.host.unlockAll?.() ?? -1;
  }

  /** Meta progress: back to a brand-new player (settings and the saved run stay). False without a save. */
  resetUnlocks(): boolean {
    if (!this.host.resetUnlocks) return false;
    this.host.resetUnlocks();
    return true;
  }

  private bossIndex = 0;

  /** The selected boss: what `bossFight()` without an id (`__SD.debug.boss()`) starts. */
  bossName(): string {
    const ids = this.bosses();
    const def = ids.length ? BOSSES.get(ids[this.bossIndex % ids.length]!) : undefined;
    return def ? def.name.toUpperCase() : 'NONE';
  }

  /** Selects the next boss; returns its name. */
  nextBoss(): string {
    this.bossIndex = (this.bossIndex + 1) % Math.max(1, this.bosses().length);
    return this.bossName();
  }

  /** Starts a boss fight in the current room (the selected boss, or `id`). False if one can't start. */
  bossFight(id?: string): boolean {
    const sim = this.sim;
    if (!sim) return false;
    const ids = this.bosses();
    const pick = id ?? ids[this.bossIndex % Math.max(1, ids.length)];
    if (!pick || !BOSSES.has(pick)) return false;
    return !!sim.startBossFight(pick);
  }

  /** Perf overlay: set, or toggle when omitted. Returns the new state (false without a host overlay). */
  perf(on?: boolean): boolean {
    return this.host.perf?.(on) ?? false;
  }

  isPerf(): boolean {
    return this.host.perfVisible?.() ?? false;
  }
}
