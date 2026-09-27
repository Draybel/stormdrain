/**
 * The headless play-bot (Phase 5, tests/bot.test.ts): plays a whole run through the real input path, like
 * a (god-mode) player would — sim only, no rendering, so a run of 12-13 floors takes seconds.
 *
 * - Moves only with the move stick: a grid path (8-way Dijkstra over the 13 × 7 cells: rocks, metal,
 *   crates, urns, fire and — unless flying — pits block; spikes cost extra; pedestals, props and open floor
 *   exits are walked around unless they are the goal) smoothed by line-of-sight, re-planned as she moves.
 *   A leg that makes no progress for `stuckLimit` s falls back to a teleport — logged and counted.
 * - Fights with the real attack pipeline: aims at the nearest enemy it can hit, holds / releases fire for
 *   charge attacks, closes in on a path (melee gets close), backs off and strafes, dashes (Pip), steers
 *   clear of open floor exits. Bosses go through their phases and death sequence. A fight that runs past
 *   its time limit is finished through the real damage path (logged as a fallback); a room that still
 *   won't clear is a soft-lock.
 * - Presses the Rain Barrel Arena's plate, bombs hidden walls with real bombs (walking clear of the blast),
 *   unlocks doors with keys, opens chests, picks up loot, takes items, buys in shops / the Broker's Nook /
 *   from Old Pell, feeds the donation jar and the Gumball Gambler, uses actives and consumables, blasts
 *   the hidden-route grate open and drops through it, and takes the trapdoor or the whirlpool.
 * - Every tick it checks the world invariants (tests/helpers/stress.ts `checkWorld`: no NaN, caps, nothing
 *   outside the room) and the run's: no death in god mode, no floor change without an exit, no arena that
 *   stays shut with nothing left to fight, doors that open after a clear.
 *
 * Missing coins / keys / bombs for a purchase, a lock or a wall are topped up (logged): the bot tests the
 * game's machinery, not the economy. It never throws — every problem lands in its report. Its choices
 * depend only on the Sim's state, so a run replays exactly from the same seed.
 */

import { clearEdges } from '../../src/engine/inputState';
import { Rng, hashString } from '../../src/engine/rng';
import { allItems } from '../../src/content/registry';
import { CM_NONE } from '../../src/sim/attack/profile';
import { FLY_MODE, SHOT_MODE, WALK_MODE, circleOverlapsGrid, type CollideMode } from '../../src/sim/collision';
import { ROOM_COLS, ROOM_H, ROOM_ROWS, ROOM_W, TILE } from '../../src/sim/constants';
import { DK, DOOR_FRONT_X, DOOR_FRONT_Y, DOOR_X, DOOR_Y, DS, TRAPDOOR_OPEN_TIME } from '../../src/sim/doors';
import { damageEnemy } from '../../src/sim/enemies/damage';
import type { Enemy } from '../../src/sim/enemies/enemy';
import { neighborRoom } from '../../src/sim/floor/generate';
import { SRC_PLAYER } from '../../src/sim/hittable';
import type { Pedestal } from '../../src/sim/pedestals';
import { PK } from '../../src/sim/pickupKinds';
import { wouldCollect, type Pickup } from '../../src/sim/pickups';
import type { FloorThing } from '../../src/sim/roomProps';
import { PROP_JAR, PROP_SLOTS, PROP_TRADER } from '../../src/sim/shopProps';
import type { Sim } from '../../src/sim/sim';
import { Tile } from '../../src/sim/tiles';
import { BOMB_TUNING, ITEM_TUNING, RUN_TUNING } from '../../src/sim/tuning';
import { floorPrint } from './explorer';
import { checkWorld } from './stress';
import { makeInput } from './sim';

export interface BotOptions {
  /** Stop once the run reaches this floor (14 = play to the end of the run). */
  untilFloor: number;
  /** Take the hidden-route grate whenever a floor has one (else always the trapdoor). */
  takeGrate?: boolean;
  /** Random treasure-pool passives handed over at every floor start (seeded) — the build grows. */
  itemsPerFloor?: number;
  /** Seconds of real fighting in a normal room / a boss room before the fallback finishes it. */
  roomLimit?: number;
  bossLimit?: number;
  /** Seconds without progress toward a walking target before the bot teleports there. */
  stuckLimit?: number;
  /** Tick budget for the whole run. */
  maxTicks?: number;
  /** Called at every room entry. */
  onEnter?: (sim: Sim) => void;
  /** Called after every tick (extra invariants, diagnostics); a returned string is reported as a problem. */
  onTick?: (sim: Sim) => string | void;
}

export interface BotFloor {
  floor: number;
  track: string;
  chapter: string;
  curse: string;
  rooms: number;
  visited: number;
  boss: string;
  bossSpawned: boolean;
  /** 'fight' = killed by the real attack pipeline, 'fallback' = finished after the time limit. */
  bossKilledBy: '' | 'fight' | 'fallback';
  bossSeconds: number;
  exit: 'trapdoor' | 'grate' | 'whirlpool' | 'won' | 'none';
  secretsBombed: number;
  bought: number;
  chests: number;
  itemsTaken: number;
  print: number;
}

export interface BotReport {
  /** Crashes, soft-locks, invalid states — a run with any of these failed. */
  problems: string[];
  /** Fallbacks (teleports, fight time-outs), top-ups and other things worth a look. */
  notes: string[];
  floors: BotFloor[];
  ticks: number;
  roomsEntered: number;
  /** Walking legs, and how many of them fell back to a teleport. */
  walks: number;
  teleports: number;
  /** Rooms whose real fight ran out of time (normal / boss). */
  fightFallbacks: number;
  bossFallbacks: number;
  topUps: number;
  /** Time spent inside Sim.step (ms) — the rest of a run's time is the bot thinking. */
  simMs: number;
  /** "floor track:room" per room entry, in order. */
  trace: string[];
  final: string;
}

/** A moving walk target (a pickup): its live position and whether it's still worth walking to. */
interface WalkFollow {
  x(): number;
  y(): number;
  wanted(): boolean;
}

/** `BOT_DEBUG=1`: per-fight stats (shots, hits, distance, line of sight, the build) and each teleport's scene. */
const DEBUG = typeof process !== 'undefined' && !!process.env.BOT_DEBUG;

const PUSH_X = [0, 1, 0, -1];
const PUSH_Y = [-1, 0, 1, 0];
const CELLS = ROOM_COLS * ROOM_ROWS;
const SQRT2 = Math.SQRT2;

/** Blocks the cell for pathing (solid things and exits); the goal cell is always allowed. */
const B_SOLID = 1;
const B_EXIT = 2;

function cellOf(x: number, y: number): number {
  const c = Math.max(0, Math.min(ROOM_COLS - 1, Math.floor(x / TILE)));
  const r = Math.max(0, Math.min(ROOM_ROWS - 1, Math.floor(y / TILE)));
  return r * ROOM_COLS + c;
}

function cx(cell: number): number {
  return (cell % ROOM_COLS) * TILE + TILE / 2;
}

function cy(cell: number): number {
  return Math.floor(cell / ROOM_COLS) * TILE + TILE / 2;
}

export class Bot {
  readonly report: BotReport = {
    problems: [],
    notes: [],
    floors: [],
    ticks: 0,
    roomsEntered: 0,
    walks: 0,
    teleports: 0,
    fightFallbacks: 0,
    bossFallbacks: 0,
    topUps: 0,
    simMs: 0,
    trace: [],
    final: '',
  };
  private readonly input = makeInput();
  private floorRec: BotFloor | null = null;
  private stopped = false;
  /** The bot is taking a floor exit on purpose. */
  private exiting = false;
  private doing = 'starting';
  private lastRoom = '';
  /** Arena watchdog: ticks the arena has been shut with nothing alive in it. */
  private emptyArena = 0;
  // Path-finding scratch (no per-plan allocation).
  private readonly dist = new Float64Array(CELLS);
  private readonly prev = new Int16Array(CELLS);
  private readonly done = new Uint8Array(CELLS);
  private readonly block = new Uint8Array(CELLS);
  private readonly path: number[] = [];
  private readonly roomLimit: number;
  private readonly bossLimit: number;
  private readonly stuckLimit: number;

  constructor(
    private readonly sim: Sim,
    private readonly opts: BotOptions,
  ) {
    this.roomLimit = opts.roomLimit ?? 45;
    this.bossLimit = opts.bossLimit ?? 150;
    this.stuckLimit = opts.stuckLimit ?? 4;
  }

  private get w() {
    return this.sim.world;
  }

  private get run() {
    return this.sim.run!;
  }

  private roomKey(): string {
    const d = this.run.data;
    return `${d.floor}${d.track === 'alt' ? 'alt' : ''}:${d.current}`;
  }

  private where(): string {
    const d = this.run.data;
    const room = this.run.room;
    return `seed ${d.seed} ${d.character} floor ${d.floor}${d.track === 'alt' ? ' alt' : ''} room ${d.current} (${room.type}, ${room.templateId})`;
  }

  private problem(msg: string): void {
    if (this.report.problems.length < 30) this.report.problems.push(`${this.where()}: ${msg} (while ${this.doing})`);
  }

  private note(msg: string): void {
    if (this.report.notes.length < 400) this.report.notes.push(`${this.where()}: ${msg}`);
  }

  // ── Ticking ────────────────────────────────────────────────────────────────

  /** One tick with the current input; checks every invariant. */
  private step(): void {
    const w = this.w;
    const d = this.run.data;
    const floor = d.floor;
    const track = d.track;
    // The Dizzy Tonic mirrors the stick for a few seconds: the bot compensates, like a player would.
    if (w.player.flags.confused) {
      this.input.moveX = -this.input.moveX;
      this.input.moveY = -this.input.moveY;
    }
    const t0 = performance.now();
    this.sim.step(this.input);
    this.report.simMs += performance.now() - t0;
    if (w.player.flags.confused) {
      this.input.moveX = -this.input.moveX;
      this.input.moveY = -this.input.moveY;
    }
    clearEdges(this.input);
    this.report.ticks++;
    if ((d.floor !== floor || d.track !== track) && !this.exiting) {
      const p = w.player;
      this.problem(`dropped from floor ${floor} ${track} to ${d.floor} ${d.track} without taking an exit (she was at ${p.prevX.toFixed(1)},${p.prevY.toFixed(1)})`);
      this.stopped = true;
    }
    const err = checkWorld(this.sim, null) || this.opts.onTick?.(this.sim);
    if (err) {
      this.problem(`invalid state: ${err}`);
      this.stopped = true;
    }
    if (w.player.dead) {
      this.problem('the player died in god mode');
      this.stopped = true;
    }
    // An arena that stays shut with nothing alive to fight (between challenge waves it waits ~1 s).
    if ((w.arena.active || w.arena.locked) && w.enemies.count === 0) {
      if (++this.emptyArena > 60 * 6) {
        this.problem(`soft-lock: the doors stayed shut for 6 s with nothing to fight (arena active ${w.arena.active}, locked ${w.arena.locked}, wave ${this.run.state.wave}/${this.run.state.waves.length})`);
        this.stopped = true;
      }
    } else {
      this.emptyArena = 0;
    }
    if (this.report.ticks > (this.opts.maxTicks ?? 1_500_000)) {
      this.problem('tick budget exhausted');
      this.stopped = true;
    }
  }

  private hands(): void {
    const inp = this.input;
    inp.moveX = inp.moveY = 0;
    inp.aimX = inp.aimY = 0;
    inp.fireHeld = false;
  }

  private idle(n: number): void {
    this.hands();
    for (let i = 0; i < n && !this.stopped; i++) this.step();
  }

  private roomChanged(key: string): boolean {
    return this.roomKey() !== key;
  }

  // ── The run ────────────────────────────────────────────────────────────────

  /** Plays until the run is won, reaches `untilFloor`, or something goes wrong. */
  play(): BotReport {
    try {
      this.w.godMode = true;
      while (!this.stopped) {
        const d = this.run.data;
        this.checkEntry();
        if (d.won) {
          if (this.floorRec) this.floorRec.exit = 'won';
          break;
        }
        if (d.floor >= this.opts.untilFloor) break;
        const key = this.roomKey();
        this.handleRoom();
        if (this.stopped) break;
        if (this.run.data.won || this.roomChanged(key)) continue;
        if (!this.moveOn()) break;
      }
    } catch (err) {
      const e = err as Error;
      this.problem(`exception: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 9).join('\n')}`);
    }
    this.finishFloor();
    this.report.final = JSON.stringify(this.sim.summary());
    return this.report;
  }

  /** Records a room entry (and a new floor) when the room changed since the last look. */
  private checkEntry(): void {
    const key = this.roomKey();
    if (key === this.lastRoom) return;
    const d = this.run.data;
    const floorKey = `${d.floor}${d.track}`;
    if (!this.floorRec || `${this.floorRec.floor}${this.floorRec.track}` !== floorKey) {
      this.finishFloor();
      this.startFloor();
    }
    this.lastRoom = key;
    this.report.roomsEntered++;
    this.report.trace.push(key);
    if (this.floorRec) this.floorRec.visited = d.rooms.filter((r) => r.visited).length;
    this.opts.onEnter?.(this.sim);
  }

  private startFloor(): void {
    const d = this.run.data;
    const bossRoom = d.layout.rooms[d.layout.boss];
    this.floorRec = {
      floor: d.floor,
      track: d.track,
      chapter: d.chapter,
      curse: d.layout.curse ?? '',
      rooms: d.layout.rooms.length,
      visited: 0,
      boss: bossRoom ? d.rooms[bossRoom.index]!.boss : '',
      bossSpawned: false,
      bossKilledBy: '',
      bossSeconds: 0,
      exit: 'none',
      secretsBombed: 0,
      bought: 0,
      chests: 0,
      itemsTaken: 0,
      print: floorPrint(this.sim),
    };
    // Random items: the build grows floor by floor (seeded by the run seed and the floor).
    const n = this.opts.itemsPerFloor ?? 0;
    if (n > 0) {
      const pool = allItems().filter((it) => it.kind === 'passive' && it.pools.includes('treasure') && !it.tags.includes('test'));
      const rng = new Rng(`bot-items:${d.seed}:${d.floor}:${d.track}`);
      for (let i = 0; i < n; i++) this.sim.giveItem(pool[rng.int(0, pool.length - 1)]!.id);
    }
  }

  private finishFloor(): void {
    const rec = this.floorRec;
    if (!rec) return;
    const d = this.run.data;
    if (rec.floor === d.floor && rec.track === d.track) {
      rec.visited = d.rooms.filter((r) => r.visited).length;
      rec.rooms = d.layout.rooms.length;
    }
    this.report.floors.push(rec);
    this.floorRec = null;
  }

  // ── A room ─────────────────────────────────────────────────────────────────

  private handleRoom(): void {
    const run = this.run;
    const w = this.w;
    const room = run.room;
    const st = run.state;
    const key = this.roomKey();
    const bossRoom = room.type === 'boss';
    if (bossRoom && !st.cleared && this.floorRec) {
      if (w.boss.active && w.boss.id === st.boss) this.floorRec.bossSpawned = true;
      else this.problem(`the boss '${st.boss}' did not spawn in the boss room (fight active ${w.boss.active})`);
    }
    // The Rain Barrel Arena: step on the plate.
    if (room.type === 'challenge' && !st.cleared && st.plate === 0) {
      const plate = w.props.plate;
      if (!plate.active) {
        this.problem('Rain Barrel Arena without its pressure plate');
      } else {
        this.doing = 'walking to the pressure plate';
        this.walkTo(plate.x, plate.y, RUN_TUNING.plateReach - 2, -1);
        if (this.roomChanged(key) || this.stopped) return;
        if (st.plate === 0) this.problem('standing on the pressure plate did not start the waves');
      }
    }
    this.fightRoom(bossRoom);
    if (this.stopped || this.roomChanged(key)) return;
    if (bossRoom && this.floorRec && st.cleared) {
      if (!run.data.layout.finalBoss && (!w.trapdoor.active || !st.trapdoor)) this.problem('the boss fell but no trapdoor appeared');
    }
    // The doors open once the room is clear.
    if (w.arena.active || w.arena.locked) this.problem(`room cleared but the arena is still ${w.arena.active ? 'active' : 'locked'}`);
    this.idle(20);
    if (w.arena.doors > 0.01) this.problem(`the doors stayed barred after the clear (arena.doors ${w.arena.doors.toFixed(2)})`);
    this.collect(key);
    if (this.stopped || this.roomChanged(key)) return;
    this.useItems(key);
  }

  /** Actives now and then (a teleport item moves her: the main loop sees the new room), a consumable sometimes. */
  private useItems(key: string): void {
    const w = this.w;
    const inv = w.player.inv;
    // A teleport item could land her in a final boss's room, which ends the run: not while rooms are left.
    if (this.run.data.layout.finalBoss && this.roomsLeft()) return;
    const salt = hashString(`${this.run.data.seed}:${key}`);
    if (inv.active && inv.active.charge >= inv.active.max && (salt & 3) === 0) {
      this.doing = `using the active ${inv.active.id}`;
      this.input.active = true;
      this.idle(30);
      if (this.stopped || this.roomChanged(key)) return;
      // An active may start a fight or spawn things.
      this.fightRoom(false);
      if (this.stopped || this.roomChanged(key)) return;
      this.collect(key);
    }
    if (this.stopped || this.roomChanged(key)) return;
    if (inv.consumables.length > 0 && ((salt >> 3) & 3) === 0) {
      this.doing = `using the consumable ${inv.consumables[0]}`;
      this.input.consumable = true;
      this.idle(30);
      if (this.stopped || this.roomChanged(key)) return;
      this.fightRoom(false);
    }
  }

  private busy(): boolean {
    const w = this.w;
    return w.arena.active || w.arena.locked || !this.run.state.cleared || w.enemies.count > 0;
  }

  /** Fights until the room counts as cleared: real fighting up to the limit, then the fallback. */
  private fightRoom(bossRoom: boolean): void {
    const w = this.w;
    const key = this.roomKey();
    const limit = (bossRoom || w.boss.active ? this.bossLimit : this.roomLimit) * 60;
    // Only a fight that starts with the boss alive counts for the floor record (re-entries don't).
    const bossAlive = bossRoom && this.busy();
    let t = 0;
    let quiet = 0;
    this.doing = bossRoom ? `fighting the boss ${this.run.state.boss}` : 'fighting';
    if (DEBUG) this.fightStats = { shots0: w.counters.shots, hits0: w.counters.hits, dist: 0, n: 0, blocked: 0, nofoe: 0, still: 0 };
    for (; t < limit && !this.stopped; t++) {
      if (this.roomChanged(key)) return;
      if (!this.busy()) {
        if (++quiet > 3) break;
      } else {
        quiet = 0;
      }
      this.fightTick();
    }
    this.hands();
    const secs = t / 60;
    if (DEBUG && t > 60) this.printFight(secs);
    if (bossAlive && this.floorRec && !this.busy()) {
      this.floorRec.bossKilledBy = 'fight';
      this.floorRec.bossSeconds = secs;
    }
    if (!this.busy() || this.stopped) return;
    // Out of time: finish it through the real damage path (still a real kill: drops, phases, death sequence).
    const what = this.foes();
    this.note(`the real fight ran out after ${this.limitFor(bossRoom)} s: ${what}`);
    if (bossRoom) this.report.bossFallbacks++;
    else this.report.fightFallbacks++;
    this.doing = 'finishing the fight (fallback)';
    let f = 0;
    for (; f < 60 * 40 && !this.stopped && this.busy(); f++) {
      if (this.roomChanged(key)) return;
      if (f > 10) {
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (!e.dead && e.hittable) damageEnemy(w, e, 45, SRC_PLAYER, 0, 0);
        }
      }
      this.fightTick();
    }
    this.hands();
    if (this.busy() && !this.stopped) {
      this.problem(`soft-lock: the room never cleared (cleared ${this.run.state.cleared}, arena ${w.arena.active}/${w.arena.locked}, wave ${this.run.state.wave}/${this.run.state.waves.length}; ${this.foes()})`);
      this.stopped = true;
    } else if (bossAlive && this.floorRec) {
      this.floorRec.bossKilledBy = 'fallback';
      this.floorRec.bossSeconds = (t + f) / 60;
    }
  }

  /** BOT_DEBUG: how a fight went (to tell a weak build from a bot that can't aim). */
  private printFight(secs: number): void {
    const w = this.w;
    const p = w.player;
    const S = this.fightStats;
    const pct = (k: number): string => `${((100 * k) / Math.max(1, S.n)).toFixed(0)}%`;
    const mods = p.attack.stacks.filter((m) => m !== null).map((m) => `${m!.id}x${m!.stacks}`);
    console.log(
      `[fight] ${this.where()} ${secs.toFixed(1)} s: shots ${w.counters.shots - S.shots0} hits ${w.counters.hits - S.hits0}` +
        ` avg dist ${(S.dist / Math.max(1, S.n)).toFixed(0)} blocked ${pct(S.blocked)} nofoe ${pct(S.nofoe)} still ${pct(S.still)}; ${this.foes()}` +
        ` | ${p.attack.primary}/${p.attack.chargeMode} mods ${mods.join(',')} dmg ${p.stats.damage.toFixed(1)} rate ${p.stats.fireRate.toFixed(1)}` +
        ` range ${p.stats.range.toFixed(0)} items ${p.inv.passives.join(',')}`,
    );
  }

  private limitFor(bossRoom: boolean): number {
    return bossRoom || this.w.boss.active ? this.bossLimit : this.roomLimit;
  }

  private foes(): string {
    const w = this.w;
    const out: string[] = [];
    for (let i = 0; i < w.enemies.count && out.length < 8; i++) {
      const e = w.enemies.items[i]!;
      out.push(
        `${e.def.id}@${(e.x / 16).toFixed(1)},${(e.y / 16).toFixed(1)} hp ${e.hp.toFixed(0)}/${e.maxHp.toFixed(0)}${e.hittable ? '' : ' untouchable'}${e.burrowed ? ' burrowed' : ''}${e.dying ? ' dying' : ''}`,
      );
    }
    return out.length ? out.join('; ') : 'no enemies';
  }

  private nearestFoe(): Enemy | null {
    const w = this.w;
    const p = w.player;
    let best: Enemy | null = null;
    let bd = Infinity;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead || !e.hittable) continue;
      const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  /** BOT_DEBUG fight stats. */
  private fightStats = { shots0: 0, hits0: 0, dist: 0, n: 0, blocked: 0, nofoe: 0, still: 0 };

  /** One tick of fighting: aim, fire (charge + release), close in on a path / back off / strafe. */
  private fightTick(): void {
    const w = this.w;
    const p = w.player;
    const inp = this.input;
    const tick = w.tick;
    const foe = this.nearestFoe();
    // Pip's burrow now and then — only at a foe, and never with an open exit in the room (surfacing on it drops her).
    if (foe && tick % 90 === 45 && !this.exitOpen()) inp.dash = true;
    if (!foe) {
      if (DEBUG) {
        this.fightStats.nofoe++;
        this.fightStats.n++;
      }
      // Nothing hittable (burrowed, teleporting, the intro card): drift toward the middle and wait.
      inp.fireHeld = false;
      inp.aimX = inp.aimY = 0;
      this.steerTo(ROOM_W / 2, ROOM_H / 2 + 8, 24, -1);
      this.step();
      return;
    }
    const dx = foe.x - p.x;
    const dy = foe.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (DEBUG) {
      const S = this.fightStats;
      S.n++;
      S.dist += d;
      if (Math.hypot(p.vx, p.vy) < 5) S.still++;
      if (!this.shotLine(foe.x, foe.y)) S.blocked++;
    }
    this.aimAt(foe, d);
    // Charge attacks fire on release: let go once charged.
    inp.fireHeld = !(p.attack.chargeMode !== CM_NONE && p.atk.charge >= 1 && inp.fireHeld);
    const melee = p.attack.primary === 'melee';
    const want = melee ? 16 + foe.r : 56;
    if (d > want + 18) {
      // Close in along a path (around rocks and pits).
      this.steerTo(foe.x, foe.y, want, -1);
    } else if (d < want - 14) {
      this.setMove(-dx / d, -dy / d);
    } else {
      const side = ((tick / 75) | 0) % 2 === 0 ? 1 : -1;
      this.setMove((-dy / d) * side * 0.8, (dx / d) * side * 0.8);
    }
    this.avoidExits();
    this.step();
  }

  /** Would a shot from her reach (x, y) without hitting a wall / rock / prop on the way (pits don't stop shots)? */
  private shotLine(x: number, y: number): boolean {
    const w = this.w;
    const p = w.player;
    const dx = x - p.x;
    const dy = y - p.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / 4);
    for (let i = 1; i < steps; i++) {
      const sx = p.x + (dx * i) / steps;
      const sy = p.y + (dy * i) / steps;
      if (circleOverlapsGrid(w.room, sx, sy, 1.5, SHOT_MODE)) return false;
    }
    return true;
  }

  /** Aims at where the foe will be when a shot gets there (beams land at once: no lead). */
  private aimAt(foe: Enemy, d: number): void {
    const p = this.w.player;
    const prim = p.attack.primary;
    const lead = prim === 'lance' || prim === 'laser' ? 0 : Math.min(0.5, d / Math.max(60, p.stats.shotSpeed));
    const ax = foe.x + foe.vx * lead - p.x;
    const ay = foe.y + foe.vy * lead - p.y;
    const a = Math.hypot(ax, ay) || 1;
    this.input.aimX = ax / a;
    this.input.aimY = ay / a;
  }

  /** Sets the move stick, sliding along walls instead of pushing into a doorway by accident. */
  private setMove(mx: number, my: number): void {
    const p = this.w.player;
    const edge = p.r + 3;
    if (p.y < edge && my < 0) my = 0;
    if (p.y > ROOM_H - edge && my > 0) my = 0;
    if (p.x < edge && mx < 0) mx = 0;
    if (p.x > ROOM_W - edge && mx > 0) mx = 0;
    this.input.moveX = mx;
    this.input.moveY = my;
  }

  /** Never walks onto an open floor exit by accident: pushes the stick away from one that's close. */
  private avoidExits(): void {
    const w = this.w;
    const p = w.player;
    const inp = this.input;
    const away = (t: { active: boolean; x: number; y: number }, open: boolean): void => {
      if (!t.active || !open) return;
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const d = Math.hypot(dx, dy);
      if (d > 26) return;
      const nx = d > 0.01 ? dx / d : 1;
      const ny = d > 0.01 ? dy / d : 0;
      const into = inp.moveX * nx + inp.moveY * ny;
      if (into < 0.3) {
        inp.moveX += (0.3 - into) * nx * 2;
        inp.moveY += (0.3 - into) * ny * 2;
      }
    };
    away(w.trapdoor, true);
    away(w.props.grate, w.props.grate.state === 1);
    away(w.props.whirlpool, true);
    away(w.props.skylight, true);
  }

  // ── Walking ────────────────────────────────────────────────────────────────

  private mode(): CollideMode {
    return this.w.player.flags.flying ? FLY_MODE : WALK_MODE;
  }

  /** Marks the cells solid things and open exits sit on (the goal cell stays free). */
  private markBlocks(goal: number): void {
    const w = this.w;
    const b = this.block;
    b.fill(0);
    for (let i = 0; i < w.pedestals.count; i++) {
      const ped = w.pedestals.items[i]!;
      if (!ped.gone) b[cellOf(ped.x, ped.y)]! |= B_SOLID;
    }
    const exit = (t: { active: boolean; x: number; y: number }, open: boolean): void => {
      if (t.active && open) b[cellOf(t.x, t.y)]! |= B_EXIT;
    };
    exit(w.trapdoor, true);
    exit(w.props.grate, w.props.grate.state === 1);
    exit(w.props.whirlpool, true);
    exit(w.props.skylight, true);
    if (goal >= 0) b[goal] = 0;
  }

  /** Can she stand in this cell (tiles only)? */
  private walkable(cell: number): boolean {
    const t = this.w.room.get(cell % ROOM_COLS, Math.floor(cell / ROOM_COLS));
    if (t === Tile.Floor || t === Tile.Spikes) return true;
    return t === Tile.Pit && this.w.player.flags.flying;
  }

  private cellCost(cell: number): number {
    const t = this.w.room.get(cell % ROOM_COLS, Math.floor(cell / ROOM_COLS));
    const p = this.w.player;
    return t === Tile.Spikes && !p.flags.flying && !p.flags.spikeImmune ? 6 : 1;
  }

  /**
   * Dijkstra from the player's cell to `goal` (8-way; a diagonal only when both sides are open). Fills
   * `this.path` with the cells after the start, ending at the goal. False when there is no way.
   */
  private plan(goal: number): boolean {
    const w = this.w;
    const p = w.player;
    const start = cellOf(p.x, p.y);
    this.planGoal = goal;
    this.planFrom = start;
    this.planTick = w.tick;
    this.markBlocks(goal);
    const dist = this.dist;
    const prev = this.prev;
    const done = this.done;
    dist.fill(Infinity);
    prev.fill(-1);
    done.fill(0);
    dist[start] = 0;
    for (;;) {
      let cur = -1;
      let best = Infinity;
      for (let i = 0; i < CELLS; i++) {
        if (!done[i] && dist[i]! < best) {
          best = dist[i]!;
          cur = i;
        }
      }
      if (cur < 0 || cur === goal) break;
      done[cur] = 1;
      const c0 = cur % ROOM_COLS;
      const r0 = Math.floor(cur / ROOM_COLS);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= ROOM_COLS || r >= ROOM_ROWS) continue;
          const n = r * ROOM_COLS + c;
          if (done[n] || !this.open(n, goal)) continue;
          if (dr !== 0 && dc !== 0 && !this.cornerOk(r0 * ROOM_COLS + c, r * ROOM_COLS + c0, goal)) continue;
          const nd = best + (dr !== 0 && dc !== 0 ? SQRT2 : 1) * this.cellCost(n);
          if (nd < dist[n]!) {
            dist[n] = nd;
            prev[n] = cur;
          }
        }
      }
    }
    const path = this.path;
    path.length = 0;
    if (goal === start) {
      path.push(goal);
      return (this.planOk = true);
    }
    if (!Number.isFinite(dist[goal]!)) return (this.planOk = false);
    for (let c = goal; c !== start && c >= 0; c = prev[c]!) path.push(c);
    path.reverse();
    return (this.planOk = true);
  }

  // The last plan (steering re-plans when the goal or her cell changes, else every 15 ticks).
  private planGoal = -1;
  private planFrom = -1;
  private planTick = -1e9;
  private planOk = false;
  private wpTick = -1e9;
  private wpForX = NaN;
  private wpForY = NaN;
  private wpX = 0;
  private wpY = 0;

  private replan(goal: number): boolean {
    const w = this.w;
    const from = cellOf(w.player.x, w.player.y);
    if (goal !== this.planGoal || from !== this.planFrom || w.tick - this.planTick >= 15) return this.plan(goal);
    return this.planOk;
  }

  /**
   * May she cut the corner between these two orthogonal neighbours? Both open, or one of them only holds a
   * (round) pedestal / prop and the other at most a block: there's room at the cell corners to squeeze by.
   */
  private cornerOk(a: number, b: number, goal: number): boolean {
    const ka = this.cornerKind(a, goal);
    const kb = this.cornerKind(b, goal);
    return (ka === 0 && kb === 0) || (ka === 1 && kb !== 1) || (kb === 1 && ka !== 1);
  }

  /** 0 open, 1 only a pedestal / prop on walkable floor, 2 a blocking tile or an exit. */
  private cornerKind(c: number, goal: number): number {
    if (this.open(c, goal)) return 0;
    return this.walkable(c) && (this.block[c]! & B_EXIT) === 0 ? 1 : 2;
  }

  private open(cell: number, goal: number): boolean {
    if (cell === goal) return true;
    return this.walkable(cell) && this.block[cell] === 0;
  }

  /** A straight walk from her to (x, y) is clear of blocking tiles, solid things and exits (goal excepted). */
  private clearLine(x: number, y: number, goal: number): boolean {
    const w = this.w;
    const p = w.player;
    const dx = x - p.x;
    const dy = y - p.y;
    const len = Math.hypot(dx, dy);
    const steps = Math.ceil(len / 3);
    const mode = this.mode();
    for (let i = 1; i <= steps; i++) {
      const sx = p.x + (dx * i) / steps;
      const sy = p.y + (dy * i) / steps;
      if (circleOverlapsGrid(w.room, sx, sy, p.r + 0.5, mode)) return false;
      // Keep well clear of an open exit that isn't the goal (its trigger reaches past its own cell).
      if (this.nearExitNotGoal(sx, sy, goal)) return false;
      const cell = cellOf(sx, sy);
      if (cell !== goal && this.block[cell] !== 0 && !this.nearCell(sx, sy, cellOf(p.x, p.y))) return false;
      if (cell !== goal && !this.walkable(cell)) return false;
    }
    return true;
  }

  /** Within an open exit's trigger reach (+ margin), unless that exit sits on the goal cell? */
  private nearExitNotGoal(x: number, y: number, goal: number): boolean {
    const w = this.w;
    const R = RUN_TUNING.trapdoorReach + 6;
    const hit = (t: { active: boolean; x: number; y: number }, open: boolean): boolean =>
      open && t.active && cellOf(t.x, t.y) !== goal && (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y) < R * R;
    return hit(w.trapdoor, true) || hit(w.props.grate, w.props.grate.state === 1) || hit(w.props.whirlpool, true) || hit(w.props.skylight, true);
  }

  private nearCell(x: number, y: number, cell: number): boolean {
    return cellOf(x, y) === cell;
  }

  /**
   * Steers one tick toward (x, y) along the planned path (line-of-sight smoothed). `goal` is the cell to
   * treat as passable (-1: the target's own cell). Stops the stick within `reach`.
   */
  private steerTo(x: number, y: number, reach: number, goal: number): void {
    const p = this.w.player;
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy);
    if (d <= reach) {
      this.input.moveX = this.input.moveY = 0;
      return;
    }
    const g = goal >= 0 ? goal : cellOf(x, y);
    const tick = this.w.tick;
    const planned = this.planTick;
    const ok = this.replan(g);
    // The waypoint: re-picked on a new plan, a new target, or every 4 ticks.
    if (this.planTick !== planned || x !== this.wpForX || y !== this.wpForY || tick - this.wpTick >= 4) {
      this.wpForX = x;
      this.wpForY = y;
      this.wpTick = tick;
      this.wpX = x;
      this.wpY = y;
      if (ok && !this.clearLine(x, y, g)) {
        // The farthest path cell in plain sight.
        const path = this.path;
        let k = 0;
        for (let i = path.length - 1; i >= 0; i--) {
          if (this.clearLine(cx(path[i]!), cy(path[i]!), g)) {
            k = i;
            break;
          }
        }
        this.wpX = cx(path[k]!);
        this.wpY = cy(path[k]!);
      }
      // (No way there on the grid: head straight for it — the stuck timer decides.)
    }
    const tx = this.wpX;
    const ty = this.wpY;
    const ex = tx - p.x;
    const ey = ty - p.y;
    const e = Math.hypot(ex, ey) || 1;
    // Ease off at the very end so she stops on small targets instead of orbiting them.
    const speed = Math.min(1, Math.max(0.35, d / 18));
    this.setMove((ex / e) * speed, (ey / e) * speed);
  }

  /**
   * Walks to (x, y) until within `reach` (fighting whatever shows up on the way). Falls back to a teleport
   * after `stuckLimit` s without progress (or right away when there is no path at all). Returns false if
   * the room changed or the bot stopped.
   */
  private walkTo(x: number, y: number, reach: number, goal: number, maxSeconds = 20, follow?: WalkFollow): boolean {
    const w = this.w;
    const p = w.player;
    const key = this.roomKey();
    this.report.walks++;
    let best = Infinity;
    let lastGain = 0;
    let g = goal >= 0 ? goal : cellOf(x, y);
    for (let t = 0; !this.stopped; t++) {
      if (this.roomChanged(key)) return false;
      if (follow) {
        // A moving target (loot slides): track it; give up once it's gone or no longer wanted.
        if (!follow.wanted()) {
          this.hands();
          return true;
        }
        x = follow.x();
        y = follow.y();
        if (goal < 0) g = cellOf(x, y);
      }
      const d = Math.hypot(x - p.x, y - p.y);
      if (d <= reach) {
        this.hands();
        return true;
      }
      if (d < best - 1) {
        best = d;
        lastGain = t;
      }
      const noPath = t === 0 && !this.plan(g);
      if (t - lastGain > this.stuckLimit * 60 || t > maxSeconds * 60 || noPath) {
        this.teleportTo(x, y, reach, `no progress walking to ${x.toFixed(0)},${y.toFixed(0)} for ${((t - lastGain) / 60).toFixed(1)} s (${this.doing})`);
        return !this.roomChanged(key);
      }
      // Anything alive in here? Shoot it on the way (walking doesn't stop a fight).
      const foe = w.enemies.count > 0 ? this.nearestFoe() : null;
      if (foe) {
        this.aimAt(foe, Math.hypot(foe.x - p.x, foe.y - p.y));
        this.input.fireHeld = !(p.attack.chargeMode !== CM_NONE && p.atk.charge >= 1 && this.input.fireHeld);
      } else {
        this.input.fireHeld = false;
        this.input.aimX = this.input.aimY = 0;
      }
      this.steerTo(x, y, reach, g);
      this.step();
    }
    return false;
  }

  /** The stuck fallback: puts her at (or next to) the target and says so. */
  private teleportTo(x: number, y: number, reach: number, why: string): void {
    const w = this.w;
    const p = w.player;
    this.report.teleports++;
    this.note(`teleport fallback: ${why}`);
    if (DEBUG) {
      const rows: string[] = [];
      for (let r = 0; r < ROOM_ROWS; r++) {
        let line = '';
        for (let c = 0; c < ROOM_COLS; c++) line += String(w.room.get(c, r));
        rows.push(line);
      }
      const ok = this.plan(cellOf(x, y));
      console.log(`[teleport] ${this.where()} ${why}
  player ${p.x.toFixed(1)},${p.y.toFixed(1)} v ${p.vx.toFixed(1)},${p.vy.toFixed(1)} speed ${p.stats.moveSpeed.toFixed(1)} flying ${p.flags.flying} curse ${w.curse} input ${this.input.moveX.toFixed(2)},${this.input.moveY.toFixed(2)} plan ${ok} [${this.path.map((c) => `${c % ROOM_COLS},${Math.floor(c / ROOM_COLS)}`).join(' ')}] peds ${Array.from({ length: w.pedestals.count }, (_, i) => `${w.pedestals.items[i]!.x},${w.pedestals.items[i]!.y}`).join(' ')}
  ${rows.join('\n  ')}`);
    }
    // The target itself when she fits there, else the nearest free spot within reach.
    let bx = x;
    let by = y;
    if (circleOverlapsGrid(w.room, x, y, p.r, this.mode())) {
      let bd = Infinity;
      for (let a = 0; a < 16; a++) {
        for (const rr of [reach, reach + 4, reach + 8]) {
          const sx = x + Math.cos((a / 16) * Math.PI * 2) * rr;
          const sy = y + Math.sin((a / 16) * Math.PI * 2) * rr;
          if (sx < p.r || sy < p.r || sx > ROOM_W - p.r || sy > ROOM_H - p.r) continue;
          if (circleOverlapsGrid(w.room, sx, sy, p.r, this.mode())) continue;
          const dd = Math.hypot(sx - p.x, sy - p.y);
          if (dd < bd) {
            bd = dd;
            bx = sx;
            by = sy;
          }
        }
      }
    }
    p.placeAt(Math.min(ROOM_W - p.r, Math.max(p.r, bx)), Math.min(ROOM_H - p.r, Math.max(p.r, by)));
    this.idle(2);
  }

  /** Walks to a plain floor cell at least `far` px from (x, y) (nearest such cell by path). */
  private walkAway(x: number, y: number, far: number): void {
    const w = this.w;
    const p = w.player;
    this.markBlocks(-1);
    let best = -1;
    let bd = Infinity;
    for (let cell = 0; cell < CELLS; cell++) {
      if (!this.walkable(cell) || this.block[cell] !== 0) continue;
      if (w.room.get(cell % ROOM_COLS, Math.floor(cell / ROOM_COLS)) !== Tile.Floor) continue;
      if (Math.hypot(cx(cell) - x, cy(cell) - y) < far) continue;
      const dd = Math.hypot(cx(cell) - p.x, cy(cell) - p.y);
      if (dd < bd) {
        bd = dd;
        best = cell;
      }
    }
    if (best >= 0) this.walkTo(cx(best), cy(best), 4, -1);
  }

  /** Walks into a solid thing (a pedestal / prop) until she touches it, then holds for `hold` ticks. */
  private touch(x: number, y: number, hold: number): boolean {
    const w = this.w;
    const p = w.player;
    const reach = p.r + ITEM_TUNING.pedestalRadius + ITEM_TUNING.pedestalReach - 0.5;
    const key = this.roomKey();
    if (!this.walkTo(x, y, reach, cellOf(x, y))) return false;
    for (let i = 0; i < hold && !this.stopped && !this.roomChanged(key); i++) {
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      this.setMove(dx / d, dy / d);
      this.step();
    }
    this.hands();
    return !this.roomChanged(key);
  }

  // ── Loot, items, shops ─────────────────────────────────────────────────────

  private ensure(coins: number, bombs: number, keys: number, why: string): void {
    const inv = this.w.player.inv;
    const c = Math.max(0, coins - inv.coins);
    const b = Math.max(0, bombs - inv.bombs);
    const k = Math.max(0, keys - inv.keys);
    if (c + b + k === 0) return;
    this.report.topUps++;
    this.note(`topped up ${c} coins / ${b} bombs / ${k} keys for ${why}`);
    this.sim.addPickups(c, b, k);
  }

  /** Takes free items, buys shop stock / a nook deal / Old Pell's trade, plays the props, picks up loot. */
  private collect(key: string): void {
    const w = this.w;
    const rec = this.floorRec;
    let bought = 0;
    let boughtNook = false;
    const tried = new Set<Pedestal>();
    for (let pass = 0; pass < 2 && !this.stopped; pass++) {
      for (;;) {
        if (this.stopped || this.roomChanged(key)) return;
        const ped = this.nextPedestal(tried, pass, bought, boughtNook);
        if (!ped) break;
        tried.add(ped);
        const itemsBefore = w.counters.items;
        if (ped.prop === PROP_JAR) {
          this.ensure(4, 0, 0, 'the donation jar');
          this.doing = 'leaning on the donation jar';
          if (!this.touch(ped.x, ped.y, 40)) return;
        } else if (ped.prop === PROP_SLOTS) {
          this.ensure(2, 0, 0, 'the Gumball Gambler');
          this.doing = 'playing the Gumball Gambler';
          if (!this.touch(ped.x, ped.y, 110)) return;
        } else {
          if (ped.prop === PROP_TRADER) this.ensure(0, 0, ped.keys, "Old Pell's trade");
          else if (ped.price > 0) this.ensure(ped.price, 0, 0, `a shop slot (${ped.item || `goods ${ped.goods}`})`);
          if (ped.hearts > 0) boughtNook = true;
          this.doing = `taking ${ped.item || `goods ${ped.goods}`} from a pedestal at ${ped.x},${ped.y}`;
          if (!this.touch(ped.x, ped.y, 6)) return;
          if (ped.price > 0 || ped.keys > 0 || ped.hearts > 0) {
            bought++;
            if (rec) rec.bought++;
          }
          if (rec && w.counters.items > itemsBefore) rec.itemsTaken++;
          // Step away so a swapped-out item (or a refusal) doesn't stick to her.
          this.walkAway(ped.x, ped.y, 26);
        }
      }
    }
    // Loot: coins, hearts, keys, bombs, chests (lockboxes need a key), trinkets / consumables lying about.
    const tried2 = new Set<Pickup>();
    for (let pass = 0; pass < 3 && !this.stopped; pass++) {
      this.idle(20);
      for (;;) {
        if (this.stopped || this.roomChanged(key)) return;
        const pk = this.nextPickup(tried2);
        if (!pk) break;
        tried2.add(pk);
        // Loot that landed where she can't walk (behind rocks, over a pit) stays there.
        if (!this.plan(cellOf(pk.x, pk.y))) continue;
        if (pk.kind === PK.Lockbox) this.ensure(0, 0, 1, 'a lockbox');
        const chestsBefore = w.counters.chestsOpened;
        this.doing = `picking up kind ${pk.kind} at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`;
        const follow: WalkFollow = {
          x: () => pk.x,
          y: () => pk.y,
          wanted: () => pk.alive && !pk.opened && (pk.kind === PK.Satchel || pk.kind === PK.Lockbox || wouldCollect(w, pk)),
        };
        if (!this.walkTo(pk.x, pk.y, Math.max(2, pk.r + w.player.r - 0.5), -1, 8, follow)) return;
        this.idle(3);
        if (rec && w.counters.chestsOpened > chestsBefore) rec.chests++;
      }
    }
  }

  /** The next pedestal worth a visit (nearest first), or null. */
  private nextPedestal(tried: Set<Pedestal>, pass: number, bought: number, boughtNook: boolean): Pedestal | null {
    const w = this.w;
    const p = w.player;
    let best: Pedestal | null = null;
    let bd = Infinity;
    for (let i = 0; i < w.pedestals.count; i++) {
      const ped = w.pedestals.items[i]!;
      if (!ped.alive || ped.gone || ped.bell || tried.has(ped) || ped.blocked) continue;
      if (ped.prop === PROP_JAR || ped.prop === PROP_SLOTS) {
        if (pass > 0 || ped.broken) continue;
      } else if (ped.prop === PROP_TRADER) {
        if (!ped.item) continue;
      } else if (ped.goods >= 0) {
        if (pass > 0 || bought >= 3) continue;
      } else if (!ped.item || !ped.fresh) {
        continue;
      } else if (ped.hearts > 0) {
        if (boughtNook) continue;
      } else if (ped.price > 0 && bought >= 3) {
        continue;
      }
      const d = Math.hypot(ped.x - p.x, ped.y - p.y);
      if (d < bd) {
        bd = d;
        best = ped;
      }
    }
    return best;
  }

  /** The next pickup worth walking to (nearest first), or null. */
  private nextPickup(tried: Set<Pickup>): Pickup | null {
    const w = this.w;
    const p = w.player;
    let best: Pickup | null = null;
    let bd = Infinity;
    for (let i = 0; i < w.pickups.count; i++) {
      const pk = w.pickups.items[i]!;
      if (!pk.alive || pk.opened || tried.has(pk)) continue;
      // Swapped-out trinkets / consumables would just swap back.
      if ((pk.kind === PK.Trinket || pk.kind === PK.Consumable) && (!pk.fresh || pk.waitLeave)) continue;
      // What she can't take right now (a heart at full health, coins at 99) only slides away from her.
      const chest = pk.kind === PK.Satchel || pk.kind === PK.Lockbox;
      if (!chest && !wouldCollect(w, pk)) continue;
      if (this.nearOpenExit(pk.x, pk.y, 16)) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < bd) {
        bd = d;
        best = pk;
      }
    }
    return best;
  }

  /** Is any floor exit open in this room (trapdoor, blasted grate, whirlpool, skylight)? */
  private exitOpen(): boolean {
    const w = this.w;
    const pr = w.props;
    return w.trapdoor.active || (pr.grate.active && pr.grate.state === 1) || pr.whirlpool.active || pr.skylight.active;
  }

  private nearOpenExit(x: number, y: number, r: number): boolean {
    const w = this.w;
    const near = (t: { active: boolean; x: number; y: number }, open: boolean): boolean => open && t.active && Math.hypot(t.x - x, t.y - y) < r;
    return near(w.trapdoor, true) || near(w.props.grate, w.props.grate.state === 1) || near(w.props.whirlpool, true) || near(w.props.skylight, true);
  }

  // ── Bombs ──────────────────────────────────────────────────────────────────

  /** Walks to (x, y), drops a real bomb, walks clear of the blast and waits for it to go off. */
  private bombAt(x: number, y: number, why: string): boolean {
    const w = this.w;
    const key = this.roomKey();
    this.ensure(0, 1, 0, why);
    this.doing = `walking to bomb ${why}`;
    if (!this.walkTo(x, y, 3, -1)) return false;
    const before = w.counters.explosions;
    this.input.bomb = true;
    this.step();
    if (w.bombs.count === 0) {
      this.problem(`placing a bomb for ${why} did nothing (bombs ${w.player.inv.bombs})`);
      return false;
    }
    const bx = w.bombs.items[w.bombs.count - 1]!.x;
    const by = w.bombs.items[w.bombs.count - 1]!.y;
    this.doing = `getting clear of the bomb for ${why}`;
    this.walkAway(bx, by, BOMB_TUNING.blastRadius + 14);
    if (this.roomChanged(key)) return false;
    this.hands();
    for (let i = 0; i < 180 && w.counters.explosions === before && !this.stopped; i++) this.step();
    if (w.counters.explosions === before) {
      this.problem(`the bomb for ${why} never went off`);
      return false;
    }
    this.idle(6);
    return !this.roomChanged(key);
  }

  // ── Moving on ──────────────────────────────────────────────────────────────

  /** Rooms reachable by doors from the current one (secret walls count: the bot bombs them). */
  private route(target: (i: number) => boolean): number[] | null {
    const d = this.run.data;
    const start = d.current;
    const prev = new Map<number, [number, number]>();
    prev.set(start, [-1, -1]);
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur !== start && target(cur)) {
        const sides: number[] = [];
        let c = cur;
        while (c !== start) {
          const [from, side] = prev.get(c)!;
          sides.unshift(side);
          c = from;
        }
        return sides;
      }
      for (let side = 0; side < 4; side++) {
        const nb = neighborRoom(d.layout, cur, side);
        if (nb < 0 || prev.has(nb) || !d.rooms[nb]) continue;
        prev.set(nb, [cur, side]);
        queue.push(nb);
      }
    }
    return null;
  }

  /** Unvisited rooms besides the boss room? */
  private roomsLeft(): boolean {
    const d = this.run.data;
    for (let i = 0; i < d.rooms.length; i++) if (!d.rooms[i]!.visited && i !== d.layout.boss) return true;
    return false;
  }

  /** The nearest unvisited room, else the floor's exit. False = stop. */
  private moveOn(): boolean {
    this.surface();
    const d = this.run.data;
    // A final boss ends the run: on its floor the boss room waits until every other room has been seen.
    const others = !!d.layout.finalBoss && this.roomsLeft();
    const path = this.route((i) => !d.rooms[i]!.visited && !(others && i === d.layout.boss));
    if (path) return this.goThrough(path[0]!);
    for (let i = 0; i < d.rooms.length; i++) {
      if (!d.rooms[i]!.visited) this.problem(`room ${i} (${d.layout.rooms[i]!.type}) is unreachable`);
    }
    const grateRoom = d.layout.hiddenRoute;
    const useGrate = !!this.opts.takeGrate && grateRoom >= 0 && this.noGrate !== `${d.floor}${d.track}`;
    const exitRoom = useGrate ? grateRoom : d.layout.boss;
    if (d.current !== exitRoom) {
      const p2 = this.route((i) => i === exitRoom);
      if (!p2) {
        this.problem(`no way to the exit room ${exitRoom}`);
        return false;
      }
      return this.goThrough(p2[0]!);
    }
    return useGrate ? this.takeGrate() : this.takeTrapdoor();
  }

  /** Pip: a dash still under way finishes before walking anywhere important. */
  private surface(): void {
    this.hands();
    for (let i = 0; i < 60 && this.w.player.underground && !this.stopped; i++) this.step();
  }

  /** Walks to the door on `side` and pushes into the doorway (bombing / unlocking it first). */
  private goThrough(side: number): boolean {
    const w = this.w;
    const slot = w.doors.slots[side]!;
    const key = this.roomKey();
    if (slot.kind === DK.None) {
      this.problem(`the route leads through side ${side}, which has no door`);
      return false;
    }
    if (slot.state === DS.Hidden) {
      const dx = Math.min(ROOM_W - 8, Math.max(8, DOOR_FRONT_X[side]!));
      const dy = Math.min(ROOM_H - 8, Math.max(8, DOOR_FRONT_Y[side]!));
      if (!this.bombAt(dx, dy, `the secret wall on side ${side}`)) return !this.stopped && this.roomChanged(key);
      if ((slot.state as number) === DS.Hidden) {
        // Once more, right at the wall.
        this.bombAt(dx, dy, `the secret wall on side ${side} (again)`);
        if ((slot.state as number) === DS.Hidden) {
          this.problem(`bombing the secret wall on side ${side} did not open it`);
          return false;
        }
      }
      if (this.floorRec) this.floorRec.secretsBombed++;
    }
    if (slot.state === DS.Locked) this.ensure(0, 0, 1, `the locked door on side ${side}`);
    this.doing = `walking to the door on side ${side} (kind ${slot.kind}, to room ${slot.to})`;
    if (!this.walkTo(DOOR_FRONT_X[side]!, DOOR_FRONT_Y[side]!, 3, -1)) return !this.stopped;
    this.surface();
    const p = w.player;
    this.doing = `pushing into the door on side ${side} (state ${slot.state})`;
    for (let i = 0; i < 60 * 4 && !this.stopped; i++) {
      if (this.roomChanged(key)) return true;
      // Push into the wall, keeping in line with the doorway.
      const lat = side === 0 || side === 2 ? (DOOR_X[side]! - p.x) / 8 : (DOOR_Y[side]! - p.y) / 8;
      this.input.moveX = PUSH_X[side]! + (side === 0 || side === 2 ? lat : 0);
      this.input.moveY = PUSH_Y[side]! + (side === 1 || side === 3 ? lat : 0);
      this.step();
    }
    this.hands();
    if (this.roomChanged(key)) return true;
    this.problem(`soft-lock: pushing into the ${['hidden', 'locked', 'open'][slot.state] ?? slot.state} door on side ${side} (kind ${slot.kind}, to ${slot.to}) for 4 s did not change rooms (arena ${w.arena.active}/${w.arena.locked}, keys ${w.player.inv.keys}, player ${p.x.toFixed(1)},${p.y.toFixed(1)})`);
    return false;
  }

  /** Steps onto an exit (trapdoor, grate, whirlpool): off it first so it arms, then onto it. */
  private stepOnto(t: FloorThing | { active: boolean; x: number; y: number; armed: boolean }, what: string, reach: number): boolean {
    const w = this.w;
    const d = this.run.data;
    const floor = d.floor;
    const track = d.track;
    const p = w.player;
    if (!t.armed || Math.hypot(p.x - t.x, p.y - t.y) < reach + 8) {
      this.doing = `stepping off the ${what} so it arms`;
      this.walkAway(t.x, t.y, reach + 12);
    }
    this.doing = `walking onto the ${what}`;
    this.exiting = true;
    this.walkTo(t.x, t.y, Math.max(2, reach - 3), cellOf(t.x, t.y));
    for (let i = 0; i < 30 && d.floor === floor && d.track === track && !this.stopped; i++) {
      // Stand on it (the hatch opens over 0.8 s).
      this.steerTo(t.x, t.y, 1, cellOf(t.x, t.y));
      this.step();
    }
    this.exiting = false;
    this.hands();
    if (d.floor === floor && d.track === track) {
      this.problem(`standing on the ${what} did not drop her to the next floor`);
      return false;
    }
    return true;
  }

  private takeTrapdoor(): boolean {
    const w = this.w;
    const d = this.run.data;
    const t = w.trapdoor;
    const floor = d.floor;
    if (!t.active && w.props.whirlpool.active) {
      const ok = this.stepOnto(w.props.whirlpool, 'whirlpool', RUN_TUNING.trapdoorReach + 2);
      if (ok && this.floorRec) this.floorRec.exit = 'whirlpool';
      if (ok && d.floor !== floor + 1) this.problem(`the whirlpool led to floor ${d.floor}`);
      return ok;
    }
    if (!t.active) {
      if (!d.won) this.problem('at the end of the floor in the boss room, but there is no trapdoor');
      return false;
    }
    // Let it open (0.8 s) while walking over.
    for (let i = 0; i < 60 && t.t < TRAPDOOR_OPEN_TIME && !this.stopped; i++) this.idle(1);
    const ok = this.stepOnto(t, 'trapdoor', RUN_TUNING.trapdoorReach);
    if (ok && this.floorRec) this.floorRec.exit = 'trapdoor';
    if (ok && d.floor !== floor + 1) this.problem(`the trapdoor led to floor ${d.floor}`);
    return ok;
  }

  private takeGrate(): boolean {
    const w = this.w;
    const d = this.run.data;
    const g = w.props.grate;
    const floor = d.floor;
    if (!g.active) {
      this.problem(`the hidden-route room ${d.layout.hiddenRoute} has no grate`);
      return this.trapdoorInstead();
    }
    if (g.state === 0) {
      // A cracked grate is flat floor: stand on it, drop a bomb, get clear.
      const key = this.roomKey();
      if (!this.bombAt(g.x, g.y, 'the cracked grate')) {
        if (this.stopped) return false;
        if (this.roomChanged(key)) return true;
      }
      if ((g.state as number) !== 1) {
        this.problem('bombing the cracked grate did not open it');
        return this.trapdoorInstead();
      }
    }
    const ok = this.stepOnto(g, 'grate', RUN_TUNING.trapdoorReach);
    if (ok && this.floorRec) this.floorRec.exit = 'grate';
    if (ok && (d.floor !== floor + 1 || (d.track !== 'alt' && floor + 1 < 11))) this.problem(`the grate led to floor ${d.floor} ${d.track}`);
    return ok;
  }

  /** A floor whose grate failed: take the trapdoor there instead. */
  private noGrate = '';

  private trapdoorInstead(): boolean {
    const d = this.run.data;
    this.noGrate = `${d.floor}${d.track}`;
    if (d.current === d.layout.boss) return this.takeTrapdoor();
    const path = this.route((i) => i === d.layout.boss);
    if (!path) return false;
    return this.goThrough(path[0]!);
  }
}

/** Plays a run (the Sim must be a floor run) and returns the report. */
export function playRun(sim: Sim, opts: BotOptions): BotReport {
  return new Bot(sim, opts).play();
}
