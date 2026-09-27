/**
 * Meta tracking (ARCHITECTURE §7a): turns what happens in a floor run into lifetime progress —
 * collection (items seen / collected), bestiary (enemies & bosses seen / killed), lifetime stats
 * (runs, wins, deaths, kills, boss kills, items, floors, play time, best floor, streaks, per-character
 * wins, daily results) and the open-ended counters achievements read — and reports achievement events.
 *
 * The run scene attaches the run's Sim (`startRun` for a new run, `resumeRun` after Continue), calls
 * `afterStep()` after every Sim step (it reads that tick's GameEvents plus a few polled values) and
 * `playTime(dt)` while the run is being played. `endTick()` (once per loop tick, before `meta.endTick()`)
 * checks the counter achievements when something changed. The training yard is never tracked.
 *
 * DOM-free; no allocation per tick (the event switch only touches the MetaStore's maps).
 */

import type { GameEvent } from '../engine/events';
import { BOSSES, findItem } from '../content/registry';
import { PK } from '../sim/pickupKinds';
import type { Sim } from '../sim/sim';
import { AchievementEngine } from './achievements';
import type { MetaStore } from './metaState';

export type RunOutcome = 'win' | 'death' | 'quit';

/** A daily run: one attempt per UTC date (recorded when the run ends). */
export interface DailyInfo {
  /** UTC date key `YYYY-MM-DD` (metaState.utcDateKey). */
  date: string;
  seed: string;
}

export class MetaTracker {
  readonly meta: MetaStore;
  readonly achievements: AchievementEngine;
  private sim: Sim | null = null;
  private ended = true;
  private daily: DailyInfo | null = null;
  /** How far into run.data.seen the collection has been told. */
  private seenIdx = 0;
  /** world.counters.bossKills already recorded. */
  private bossKills = 0;
  /** world.counters.hurts when the current floor began. */
  private floorHurts = 0;
  /** The chapter number the run was last seen in (chapterReached fires on a change). */
  private chapterNo = 0;
  /** Record values reported this run (items held, coins, familiars). */
  private maxItems = 0;
  private maxCoins = 0;
  private maxFamiliars = 0;
  /** Kills this run (daily score). */
  private kills = 0;
  /** Something changed since the last counter-achievement check. */
  private dirty = true;

  constructor(meta: MetaStore, achievements: AchievementEngine = new AchievementEngine(meta)) {
    this.meta = meta;
    this.achievements = achievements;
  }

  /** The run being tracked (null when none, or it ended). */
  get tracking(): Sim | null {
    return this.ended ? null : this.sim;
  }

  /** A new run began: counts it (runs, per-character runs) and starts tracking. */
  startRun(sim: Sim, daily: DailyInfo | null = null): void {
    if (!sim.run) return;
    this.attach(sim);
    this.daily = daily;
    this.meta.recordRunStart(sim.run.data.character);
    this.reportFloor();
  }

  /** A saved run was continued: tracks it without counting a new run. */
  resumeRun(sim: Sim): void {
    if (!sim.run) return;
    this.attach(sim);
    // What the collection already knows (the run saw these before it was saved).
    this.seenIdx = sim.run.data.seen.length;
    this.reportFloor();
  }

  /** Stop tracking (the scene left the run without ending it: quit to title keeps the save). */
  detach(): void {
    this.sim = null;
    this.ended = true;
  }

  private attach(sim: Sim): void {
    const run = sim.run!;
    this.sim = sim;
    this.ended = false;
    this.daily = null;
    this.seenIdx = 0;
    this.bossKills = sim.world.counters.bossKills;
    this.floorHurts = run.data.hurtsAtFloor;
    this.chapterNo = 0;
    this.maxItems = this.maxCoins = this.maxFamiliars = 0;
    this.kills = 0;
    this.dirty = true;
  }

  /** The current floor / chapter as reached (best floor, floor & chapter achievements). */
  private reportFloor(): void {
    const run = this.sim!.run!;
    const d = run.data;
    this.meta.maxStat('bestFloor', d.floor);
    this.achievements.event('floorReached', d.chapter, d.floor);
    const no = Math.min(6, Math.ceil(d.floor / 2));
    if (no !== this.chapterNo) {
      this.chapterNo = no;
      this.achievements.event('chapterReached', d.chapter, no);
    }
    this.dirty = true;
  }

  /** After every step of the tracked run: this tick's events and the polled records. */
  afterStep(): void {
    const sim = this.sim;
    if (!sim || this.ended) return;
    const w = sim.world;
    // First: a fight that ended this tick (a final boss's kill also ends the run in the same tick).
    if (w.counters.bossKills !== this.bossKills) {
      this.bossKills = w.counters.bossKills;
      // Split bosses end once, when the last part falls.
      const id = w.boss.id;
      if (id) {
        this.meta.killEnemy(id, true);
        this.achievements.event('bossKilled', id, w.boss.kind);
        if (w.boss.kind === 1) this.meta.bump('minibossKills');
        this.dirty = true;
      }
    }
    const q = sim.events;
    for (let i = 0; i < q.count && !this.ended; i++) this.onEvent(sim, q.at(i));
    if (this.ended) return;
    this.poll(sim);
    if (w.player.dead) this.endRun('death');
  }

  /** Seconds of actual play (the scene calls it each tick the run is on screen and not over). */
  playTime(dt: number): void {
    if (!this.ended && this.sim) this.meta.addPlayTime(dt);
  }

  /**
   * The run is over. Death is detected by afterStep, a win by its 'runEnd' event; 'quit' (abandoning a
   * run) is the caller's. Streaks, per-character wins, best floor, the daily result.
   */
  endRun(outcome: RunOutcome, ending = 0): void {
    const sim = this.sim;
    if (!sim?.run || this.ended) return;
    this.ended = true;
    const d = sim.run.data;
    this.meta.recordRunEnd({ character: d.character, outcome, floor: d.floor });
    if (outcome === 'death') this.achievements.event('death', '', d.floor);
    if (outcome === 'win') {
      const e = Math.max(1, ending || d.ending || 1);
      this.achievements.event('endingReached', '', e);
      this.achievements.event('characterWin', d.character, e);
      // Endings unlock their routes whatever the achievement content says.
      this.meta.unlock('endings', `ending${e}`);
    }
    if (this.daily) {
      const won = outcome === 'win';
      const time = Math.round(d.time);
      this.meta.recordDaily(this.daily.date, {
        seed: this.daily.seed,
        character: d.character,
        won,
        floor: d.floor,
        kills: this.kills,
        timeSec: time,
        score: dailyScore(d.floor, this.kills, won, time),
      });
    }
    this.dirty = true;
  }

  /** Once per loop tick (before meta.endTick): counter achievements, when something changed. */
  endTick(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.achievements.checkCounters();
  }

  private poll(sim: Sim): void {
    const w = sim.world;
    const p = w.player;
    const inv = p.inv;
    const items = inv.passives.length + (inv.active ? 1 : 0) + inv.trinkets.length;
    if (items > this.maxItems) {
      this.maxItems = items;
      this.meta.maxCounter('maxItemsHeld', items);
      this.achievements.event('itemsHeld', '', items);
      this.dirty = true;
    }
    if (inv.coins > this.maxCoins) {
      this.maxCoins = inv.coins;
      this.meta.maxCounter('maxCoinsHeld', inv.coins);
      this.achievements.event('coinsHeld', '', inv.coins);
      this.dirty = true;
    }
    const fl = w.atk.familiars.list;
    let fam = 0;
    for (let i = 0; i < fl.length; i++) if (fl[i]!.alive && fl[i]!.def) fam++;
    if (fam > this.maxFamiliars) {
      this.maxFamiliars = fam;
      this.meta.maxCounter('maxFamiliars', fam);
      this.achievements.event('familiars', '', fam);
      this.dirty = true;
    }
    // Items shown / taken this run → the collection (hidden by the Curse of the Blind: those only count
    // once taken, which 'item' events report).
    const seen = sim.run!.data.seen;
    if (this.seenIdx < seen.length) {
      const blind = w.curse === 'blind';
      for (; this.seenIdx < seen.length; this.seenIdx++) if (!blind) this.meta.seeItem(seen[this.seenIdx]!);
      this.dirty = true;
    }
  }

  private onEvent(sim: Sim, e: GameEvent): void {
    const meta = this.meta;
    switch (e.type) {
      case 'enemySeen':
        meta.seeEnemy(e.id);
        break;
      case 'enemyKilled':
        // Bosses are recorded once per fight (afterStep), not per part.
        if (BOSSES.has(e.id)) return;
        meta.killEnemy(e.id);
        this.kills++;
        this.achievements.event('enemyKilled', e.id);
        break;
      case 'item': {
        if (e.b !== 1) return;
        meta.collectItem(e.id);
        const def = findItem(e.id);
        if (def?.kind === 'trinket') meta.bump('trinketsFound');
        const inv = sim.world.player.inv;
        this.achievements.event('itemCollected', e.id, inv.passives.length + (inv.active ? 1 : 0) + inv.trinkets.length);
        break;
      }
      case 'chest':
        meta.bump('chestsOpened');
        if (e.a === PK.Lockbox) meta.bump('keysUsed');
        this.achievements.event('chestOpened', e.a === PK.Lockbox ? 'lockbox' : 'satchel');
        break;
      case 'pickup':
        if (e.a === PK.Coin || e.a === PK.SilverCoin || e.a === PK.GoldCoin || e.a === PK.LuckyCoin) meta.bump('coinsCollected', e.b);
        else if (e.a === PK.TinHeart) meta.bump('tinHeartsGained');
        else return;
        break;
      case 'buy':
        if (e.a > 0) meta.bump('coinsSpent', e.a);
        if (e.b > 0) meta.bump('brokerDeals');
        if (findItem(e.id)) meta.bump('itemsBought');
        break;
      case 'activeUse':
        if (e.a === 0) meta.bump('activesUsed');
        else {
          meta.bump('consumablesUsed');
          const tags = findItem(e.id)?.tags;
          if (tags?.includes('tonic')) meta.bump('tonicsDrunk');
          if (tags?.includes('sticker')) meta.bump('stickersUsed');
        }
        break;
      case 'bombPlaced':
        meta.bump('bombsUsed');
        break;
      case 'secretFound':
        if (e.b === 2) return; // the Broker's Nook opening
        meta.bump(e.b === 1 ? 'deepSecretsFound' : 'secretsFound');
        this.achievements.event('secretFound', '', e.b);
        break;
      case 'doorUnlock':
        meta.bump('keysUsed');
        break;
      case 'donate':
        meta.bump('donations');
        break;
      case 'slots':
        if (e.a !== 0) return;
        meta.bump('slotPlays');
        break;
      case 'trade':
        meta.bump('trades');
        break;
      case 'nova':
        if (e.id !== 'ember') return;
        meta.bump('emberNovas');
        break;
      case 'grate':
        if (e.a !== 2) return;
        meta.bump('altRoutesTaken');
        break;
      case 'roomEnter':
        if (e.id !== 'cursed') return;
        meta.bump('cursedRoomsEntered');
        break;
      case 'roomClear': {
        const run = sim.run;
        if (!run || run.room.type !== 'challenge' || !run.state.cleared) return;
        meta.bump('challengeRoomsCleared');
        break;
      }
      case 'transform':
        meta.bump('transformations');
        this.achievements.event('transformation', e.id);
        break;
      case 'synergy':
        meta.bump('synergiesFound');
        this.achievements.event('synergy', e.id);
        break;
      case 'trapdoor':
        // Dropped through (trapdoor / grate / whirlpool / debug): floor e.b is done.
        if (e.a !== 1) return;
        this.floorDone(sim, e.b);
        break;
      case 'floorStart':
        this.floorHurts = sim.run?.data.hurtsAtFloor ?? sim.world.counters.hurts;
        this.reportFloor();
        break;
      case 'runEnd':
        if (e.a !== 1) return;
        this.floorDone(sim, sim.run?.data.floor ?? 0);
        this.endRun('win', e.b);
        break;
      default:
        return;
    }
    this.dirty = true;
  }

  /** A floor was finished: floors cleared, and whether it was done without a hit. */
  private floorDone(sim: Sim, floor: number): void {
    const clean = sim.world.counters.hurts === this.floorHurts;
    this.meta.addStat('floorsCleared');
    this.meta.bump(clean ? 'noDamageFloors' : 'damageTakenFloors');
    if (clean) this.achievements.event('noDamageFloor', '', floor);
  }
}

/** Daily-run score: depth first, then kills, a big bonus for winning, a little for speed. */
export function dailyScore(floor: number, kills: number, won: boolean, timeSec: number): number {
  return floor * 1000 + kills * 10 + (won ? 10000 + Math.max(0, 3600 - timeSec) : 0);
}
