/**
 * A headless god-mode explorer for floor runs (verification + soak tests): it walks every room of a
 * floor through the real doors (pushing into the doorway like a player), bombs the secret walls, uses
 * keys on locks, presses the arena plate, kills everything through the real damage path (bosses go
 * through their phases and their death sequence), takes / buys what it finds, and drops through the
 * trapdoor (or the hidden-route grate). It never throws: every problem is written into the report.
 *
 * Decisions depend only on the Sim's state (never on the explorer's own memory), so an explorer started
 * on a restored snapshot must retrace exactly what the original did from that room entry on — which is
 * how the snapshot soak test checks that a restore reproduces the same run.
 */

import { clearEdges } from '../../src/engine/inputState';
import { hashString } from '../../src/engine/rng';
import { DK, DOOR_FRONT_X, DOOR_FRONT_Y, DOOR_X, DOOR_Y, DS, TRAPDOOR_OPEN_TIME } from '../../src/sim/doors';
import { damageEnemy } from '../../src/sim/enemies/damage';
import { neighborRoom } from '../../src/sim/floor/generate';
import { DIR_BITS } from '../../src/sim/floor/types';
import { SRC_PLAYER } from '../../src/sim/hittable';
import { PK } from '../../src/sim/pickupKinds';
import { PROP_JAR, PROP_SLOTS, PROP_TRADER } from '../../src/sim/shopProps';
import { Tile } from '../../src/sim/tiles';
import { ITEM_TUNING } from '../../src/sim/tuning';
import type { Sim } from '../../src/sim/sim';
import { makeInput } from './sim';

export interface ExploreOptions {
  /** Stop once the run reaches this floor (e.g. 5 = floors 1-4 played, the floor-4 trapdoor taken). */
  untilFloor: number;
  /** Take the hidden-route grate when a floor has one (else always the trapdoor). */
  takeGrate?: boolean;
  /** Take items, buy from shops / the nook / Old Pell, open chests, pick up loot, play the gambler. */
  collect?: boolean;
  /** Called at every room entry (after the transition tick); may inspect / snapshot the sim. */
  onEnter?: (sim: Sim) => void;
  /**
   * Fight for real (aim at the nearest enemy, fire, walk toward it) for up to this many seconds per room
   * before the explorer finishes the job with direct damage (a warning names what was left). 0 = never.
   */
  fightFor?: number;
  /** Tick budget for the whole exploration. */
  maxTicks?: number;
  /** While fighting for real: press the dash (Pip's burrow) every this many ticks (0 / unset = never). */
  dashEvery?: number;
}

export interface FloorRecord {
  floor: number;
  track: string;
  chapter: string;
  curse: string;
  rooms: number;
  visited: number;
  boss: string;
  bossSpawned: boolean;
  bossDied: boolean;
  trapdoor: boolean;
  exit: 'trapdoor' | 'grate' | 'won' | 'none';
  /** A fingerprint of the floor's layout + pre-rolled contents. */
  print: number;
}

export interface ExploreReport {
  problems: string[];
  /** Rooms the real fight couldn't finish in time (see ExploreOptions.fightFor). */
  warnings: string[];
  floors: FloorRecord[];
  ticks: number;
  /** "floor:room" per room entry, in order. */
  trace: string[];
  /** The final summary (JSON) when the exploration ended. */
  final: string;
}

/** Room-local door-slot centres clamped inside the room, for bombs. */
function wallBlast(side: number): { x: number; y: number } {
  return { x: Math.min(200, Math.max(8, DOOR_X[side]!)), y: Math.min(104, Math.max(8, DOOR_Y[side]!)) };
}

const PUSH_X = [0, 1, 0, -1];
const PUSH_Y = [-1, 0, 1, 0];

export function floorPrint(sim: Sim): number {
  const d = sim.run!.data;
  const rooms = d.rooms.map((r) => [r.waves, r.champs, r.loot, r.chests, r.items, r.shop, r.prices, r.goods, r.boss, r.bossHp, r.reward, r.trader, r.slots, r.grate]);
  return hashString(JSON.stringify({ l: d.layout, r: rooms }));
}

export class Explorer {
  readonly report: ExploreReport = { problems: [], warnings: [], floors: [], ticks: 0, trace: [], final: '' };
  private readonly input = makeInput();
  private floorRec: FloorRecord | null = null;
  private stopped = false;
  /** The explorer is taking an exit on purpose (a floor change is expected). */
  private exiting = false;
  /** What the explorer is doing (for problem reports). */
  private doing = '';

  constructor(
    private readonly sim: Sim,
    private readonly opts: ExploreOptions,
  ) {}

  private get w() {
    return this.sim.world;
  }

  private get run() {
    return this.sim.run!;
  }

  private where(): string {
    const d = this.run.data;
    return `seed ${d.seed} floor ${d.floor}${d.track === 'alt' ? 'alt' : ''} room ${d.current} (${this.run.room.type}, ${this.run.room.templateId})`;
  }

  private problem(msg: string): void {
    if (this.report.problems.length < 40) this.report.problems.push(`${this.where()}: ${msg}`);
  }

  /** One tick with the current input; checks the invariants god mode must keep. */
  private step(): void {
    const w = this.w;
    const floor = this.run.data.floor;
    this.sim.step(this.input);
    clearEdges(this.input);
    if (this.run.data.floor !== floor && !this.exiting) {
      const p = this.w.player;
      this.problem(`dropped from floor ${floor} without taking an exit (while ${this.doing}; she was at ${p.prevX.toFixed(1)},${p.prevY.toFixed(1)})`);
      this.stopped = true;
    }
    this.report.ticks++;
    const p = w.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      this.problem(`player position is not finite (${p.x}, ${p.y})`);
      this.stopped = true;
    }
    if (p.dead) {
      this.problem('the player died in god mode');
      this.stopped = true;
    }
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) {
        this.problem(`enemy ${e.def.id} has a non-finite position / hp`);
        this.stopped = true;
        break;
      }
    }
    if (this.report.ticks > (this.opts.maxTicks ?? 400_000)) {
      this.problem('tick budget exhausted');
      this.stopped = true;
    }
  }

  private idle(n: number): void {
    const inp = this.input;
    inp.moveX = inp.moveY = 0;
    inp.fireHeld = false;
    for (let i = 0; i < n && !this.stopped; i++) this.step();
  }

  private noteEntry(): void {
    const d = this.run.data;
    if (this.floorRec && this.floorRec.floor === d.floor && this.floorRec.track === d.track) {
      this.floorRec.visited = d.rooms.filter((r) => r.visited).length;
      this.floorRec.rooms = d.layout.rooms.length;
    }
    this.report.trace.push(`${d.floor}:${d.current}`);
    this.opts.onEnter?.(this.sim);
  }

  /** Plays until the run reaches `untilFloor`, is won, or something goes wrong. */
  explore(): ExploreReport {
    try {
      this.w.godMode = true;
      this.startFloorRecord();
      this.noteEntry();
      while (!this.stopped) {
        const d = this.run.data;
        if (d.won) {
          if (this.floorRec) this.floorRec.exit = 'won';
          break;
        }
        if (d.floor >= this.opts.untilFloor) break;
        this.handleRoom();
        if (this.stopped) break;
        if (this.run.data.won) continue;
        if (!this.moveOn()) break;
      }
    } catch (err) {
      const e = err as Error;
      this.problem(`exception: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 8).join('\n')}`);
    }
    this.finishFloorRecord();
    this.report.final = JSON.stringify(this.sim.summary());
    return this.report;
  }

  // ── Floors ──────────────────────────────────────────────────────────────────

  private startFloorRecord(): void {
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
      bossDied: false,
      trapdoor: false,
      exit: 'none',
      print: floorPrint(this.sim),
    };
  }

  private finishFloorRecord(): void {
    const rec = this.floorRec;
    if (!rec) return;
    this.report.floors.push(rec);
    this.floorRec = null;
  }

  // ── A room ─────────────────────────────────────────────────────────────────

  private handleRoom(): void {
    const run = this.run;
    const w = this.w;
    const room = run.room;
    const st = run.state;
    const bossRoom = room.type === 'boss';
    if (bossRoom && !st.cleared && this.floorRec) {
      if (w.boss.active && w.boss.id === st.boss) this.floorRec.bossSpawned = true;
      else if (st.boss) this.problem(`boss room entered but the boss '${st.boss}' did not spawn (boss.active ${w.boss.active})`);
      else this.problem('boss room without a boss');
    }
    this.clearRoom();
    if (this.stopped) return;
    if (bossRoom && this.floorRec) {
      if (st.cleared) this.floorRec.bossDied = true;
      const final = !!run.data.layout.finalBoss;
      if (!final) {
        if (!w.trapdoor.active || !st.trapdoor) this.problem('boss cleared but no trapdoor');
        else this.floorRec.trapdoor = true;
      }
    }
    // Doors must be usable once the room is clear.
    if (w.arena.active || w.arena.locked) this.problem(`room cleared but the arena is still ${w.arena.active ? 'active' : 'locked'}`);
    this.idle(20);
    if (w.arena.doors > 0.01) this.problem(`doors still barred after the clear (arena.doors ${w.arena.doors.toFixed(2)})`);
    this.openSecrets();
    if (this.opts.collect) this.collectAll();
    // Use the active item now and then (exercises item code in real rooms).
    const inv = w.player.inv;
    if (inv.active && inv.active.charge >= inv.active.max && (hashString(`${run.data.seed}:${run.data.floor}:${run.data.current}`) & 3) === 0) {
      const before = `${run.data.floor}:${run.data.current}`;
      this.input.active = true;
      this.idle(30);
      if (this.stopped) return;
      if (`${run.data.floor}:${run.data.current}` !== before) {
        // A teleport item (Hopscotch Chalk…) took her to another room: an entry, handled from the top.
        this.noteEntry();
        this.handleRoom();
        return;
      }
      // An active may start a fight or spawn things: settle it.
      this.clearRoom();
    }
  }

  /** Kills everything (real damage path) until the room counts as cleared; presses the arena plate. */
  private clearRoom(): void {
    const run = this.run;
    const w = this.w;
    const st = run.state;
    const room = run.room;
    if (room.type === 'challenge' && !st.cleared && st.plate === 0) {
      const plate = w.props.plate;
      if (!plate.active) {
        this.problem('Rain Barrel Arena without a pressure plate');
      } else {
        w.player.placeAt(plate.x, plate.y);
        for (let i = 0; i < 10 && st.plate === 0 && !this.stopped; i++) this.step();
        if (st.plate === 0) this.problem('standing on the pressure plate did not start the waves');
      }
    }
    const limit = 60 * 90;
    let t = 0;
    let quietFor = 0;
    for (; t < limit && !this.stopped; t++) {
      const busy = w.arena.active || w.arena.locked || !st.cleared || w.enemies.count > 0;
      if (!busy) {
        quietFor++;
        if (quietFor > 3) break;
      } else {
        quietFor = 0;
      }
      const fightTicks = (this.opts.fightFor ?? 0) * 60;
      if (t < fightTicks) {
        this.fightTick();
        continue;
      }
      if (fightTicks > 0 && t === fightTicks && w.enemies.count > 0) {
        const foes = [];
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          foes.push(`${e.def.id}@${(e.x / 16).toFixed(1)},${(e.y / 16).toFixed(1)} hp ${e.hp.toFixed(0)}/${e.maxHp.toFixed(0)}${e.hittable ? '' : ' untouchable'}`);
        }
        if (this.report.warnings.length < 200) this.report.warnings.push(`${this.where()}: after ${this.opts.fightFor} s of fighting: ${foes.join('; ')} (player ${(w.player.x / 16).toFixed(1)},${(w.player.y / 16).toFixed(1)})`);
      }
      // Let enemies (and bosses) act a little before they die.
      if (t > fightTicks + 20) {
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (e.dead || !e.hittable) continue;
          damageEnemy(w, e, 45, SRC_PLAYER, 0, 0);
        }
      }
      this.idle(1);
    }
    if (t >= limit) {
      const foes = [];
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i]!;
        foes.push(`${e.def.id}@${e.x.toFixed(0)},${e.y.toFixed(0)} hp ${e.hp.toFixed(0)} hit ${e.hittable} bur ${e.burrowed} hid ${e.hidden} fad ${e.faded} dying ${e.dying} alive ${e.alive}`);
      }
      this.problem(
        `room never cleared (cleared ${st.cleared}, arena active ${w.arena.active} locked ${w.arena.locked}, wave ${st.wave}/${st.waves.length}, plate ${st.plate}, enemies [${foes.join('; ')}])`,
      );
      this.stopped = true;
    }
  }

  /** One tick of real fighting: aim at the nearest hittable enemy, fire, close in, keep moving. */
  private fightTick(): void {
    const w = this.w;
    const p = w.player;
    const inp = this.input;
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.items[i]!;
      if (e.dead || !e.hittable) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    const tick = w.tick;
    if (this.opts.dashEvery && tick % this.opts.dashEvery === 0) inp.dash = true;
    if (best) {
      const dx = best.x - p.x;
      const dy = best.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      inp.aimX = dx / d;
      inp.aimY = dy / d;
      // Charge attacks (Storm Lance, the charge rider) fire on release: let go once charged.
      inp.fireHeld = !(p.attack.chargeMode !== 0 && p.atk.charge >= 1 && inp.fireHeld);
      // Close in, but circle once near (so shots come from new angles around rocks).
      const side = ((tick / 70) | 0) % 2 === 0 ? 1 : -1;
      if (d > 56) {
        inp.moveX = dx / d;
        inp.moveY = dy / d;
      } else {
        inp.moveX = (-dy / d) * side * 0.8;
        inp.moveY = (dx / d) * side * 0.8;
      }
    } else {
      inp.fireHeld = false;
      inp.moveX = inp.moveY = 0;
    }
    this.step();
  }

  /** Bombs every hidden wall of the room (the explorer knows the layout) and checks it opens. */
  private openSecrets(): void {
    const w = this.w;
    for (let side = 0; side < 4; side++) {
      const slot = w.doors.slots[side]!;
      if (slot.kind === DK.None || slot.state !== DS.Hidden) continue;
      const b = wallBlast(side);
      this.sim.explode(b.x, b.y);
      this.idle(2);
      if ((slot.state as number) !== DS.Open) this.problem(`bombing the secret wall on side ${side} did not open it`);
    }
  }

  /** Walks next to (x, y) — the free side of a solid thing — so the player touches it. */
  private touch(x: number, y: number, reach: number, ticks: number): void {
    const w = this.w;
    const p = w.player;
    const offs = [
      [0, reach],
      [0, -reach],
      [reach, 0],
      [-reach, 0],
    ];
    for (const [ox, oy] of offs) {
      const tx = x + ox!;
      const ty = y + oy!;
      if (tx < p.r || ty < p.r || tx > 208 - p.r || ty > 112 - p.r) continue;
      const t = w.room.get(Math.floor(tx / 16), Math.floor(ty / 16));
      if (t !== Tile.Floor && t !== Tile.Spikes) continue;
      p.placeAt(tx, ty);
      this.idle(ticks);
      return;
    }
  }

  /** Takes free items, buys shop stock / nook deals / Old Pell's trade, plays props, picks up loot. */
  private collectAll(): void {
    const w = this.w;
    const p = w.player;
    const reach = p.r + ITEM_TUNING.pedestalRadius + ITEM_TUNING.pedestalReach - 0.5;
    let boughtNook = false;
    for (let pass = 0; pass < 2 && !this.stopped; pass++) {
      const peds = [];
      for (let i = 0; i < w.pedestals.count; i++) peds.push(w.pedestals.items[i]!);
      for (const ped of peds) {
        if (!ped.alive || ped.gone || ped.bell) continue;
        if (ped.prop === PROP_JAR) {
          if (pass > 0) continue;
          this.sim.addPickups(6, 0, 0);
          this.doing = 'leaning on the jar';
          this.touch(ped.x, ped.y, reach, 45);
          continue;
        }
        if (ped.prop === PROP_SLOTS) {
          if (pass > 0 || ped.broken) continue;
          this.sim.addPickups(2, 0, 0);
          this.doing = 'playing the gambler';
          this.touch(ped.x, ped.y, reach, 70);
          continue;
        }
        if (ped.prop === PROP_TRADER) {
          if (!ped.item) continue;
          this.sim.addPickups(0, 0, 3);
        } else if (ped.goods >= 0) {
          this.sim.addPickups(ped.price, 0, 0);
        } else if (!ped.item) {
          continue;
        } else if (ped.hearts > 0) {
          if (boughtNook) continue;
          boughtNook = true;
        } else if (ped.price > 0) {
          this.sim.addPickups(ped.price, 0, 0);
        }
        this.doing = `touching a pedestal at ${ped.x},${ped.y} (${ped.item || ped.goods})`;
        this.touch(ped.x, ped.y, reach, 14);
        // Step away so a swapped-out item (or a refusal) doesn't stick to her.
        this.standAside();
        this.idle(2);
      }
    }
    // Loot: chests need keys sometimes; opening them spills more.
    for (let pass = 0; pass < 3 && !this.stopped; pass++) {
      const list = [];
      for (let i = 0; i < w.pickups.count; i++) list.push(w.pickups.items[i]!);
      if (list.length === 0) break;
      for (const pk of list) {
        if (!pk.alive || pk.opened) continue;
        // No care taken around the trapdoor / grate: loot never rests on an exit (the run shoves it off), and
        // touching a pedestal never puts her on one — a drop here is a bug ("dropped without taking an exit").
        if (pk.kind === PK.Lockbox) this.sim.addPickups(0, 0, 1);
        this.doing = `picking up kind ${pk.kind} at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`;
        p.placeAt(Math.min(208 - p.r, Math.max(p.r, pk.x)), Math.min(112 - p.r, Math.max(p.r, pk.y)));
        this.idle(4);
      }
      this.idle(30);
    }
  }

  /** Is (x, y) on or next to a floor exit (trapdoor, grate, whirlpool, skylight)? */
  private nearExit(x: number, y: number): boolean {
    const w = this.w;
    const near = (a: { active: boolean; x: number; y: number }): boolean => a.active && Math.hypot(a.x - x, a.y - y) < 20;
    return near(w.trapdoor) || near(w.props.grate) || near(w.props.whirlpool) || near(w.props.skylight);
  }

  /** A plain floor cell away from the exits and pedestals (deterministic). */
  private standAside(): void {
    const w = this.w;
    for (let row = 1; row < 6; row++) {
      for (let col = 1; col < 12; col++) {
        const x = col * 16 + 8;
        const y = row * 16 + 8;
        if (w.room.get(col, row) !== Tile.Floor || this.nearExit(x, y)) continue;
        let clear = true;
        for (let i = 0; i < w.pedestals.count && clear; i++) {
          const o = w.pedestals.items[i]!;
          clear = Math.hypot(o.x - x, o.y - y) > 24;
        }
        if (!clear) continue;
        w.player.placeAt(x, y);
        return;
      }
    }
  }

  // ── Moving on ───────────────────────────────────────────────────────────────

  /** Rooms reachable from the current one by doors (secret walls count: the explorer bombs them). */
  private route(target: (i: number) => boolean): number[] | null {
    const d = this.run.data;
    const layout = d.layout;
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
        const nb = neighborRoom(layout, cur, side);
        if (nb < 0 || prev.has(nb)) continue;
        prev.set(nb, [cur, side]);
        queue.push(nb);
      }
    }
    return null;
  }

  /** Next step: the nearest unvisited room, else the floor's exit. Returns false to stop. */
  /** Pip's burrow: a dash still under way when the fight ended finishes before the explorer walks anywhere. */
  private surface(): void {
    const inp = this.input;
    inp.moveX = inp.moveY = 0;
    inp.fireHeld = false;
    for (let i = 0; i < 60 && this.w.player.underground && !this.stopped; i++) this.step();
  }

  private moveOn(): boolean {
    this.surface();
    const run = this.run;
    const d = run.data;
    const unvisited = (i: number): boolean => !d.rooms[i]!.visited;
    const path = this.route(unvisited);
    if (path) return this.goThrough(path[0]!);
    // Every reachable room seen: anything left over is unreachable.
    for (let i = 0; i < d.rooms.length; i++) {
      if (!d.rooms[i]!.visited) this.problem(`room ${i} (${d.layout.rooms[i]!.type}) is unreachable`);
    }
    // The exit: the grate if we want the alt route and the floor has one, else the boss room's trapdoor.
    const grateRoom = d.layout.hiddenRoute;
    const useGrate = !!this.opts.takeGrate && grateRoom >= 0;
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

  /** Pushes into the doorway on `side` like a player (unlocking / bombing first). */
  private goThrough(side: number): boolean {
    const w = this.w;
    const run = this.run;
    const d = run.data;
    const slot = w.doors.slots[side]!;
    if (slot.state === DS.Hidden) {
      const b = wallBlast(side);
      this.sim.explode(b.x, b.y);
      this.idle(2);
      if (slot.state === DS.Hidden) {
        this.problem(`secret wall on side ${side} would not open`);
        return false;
      }
    }
    const p = w.player;
    const before = `${d.floor}:${d.current}`;
    const walk = (): boolean => {
      this.surface();
      p.placeAt(DOOR_FRONT_X[side]!, DOOR_FRONT_Y[side]!);
      this.input.moveX = PUSH_X[side]!;
      this.input.moveY = PUSH_Y[side]!;
      for (let i = 0; i < 45 && !this.stopped; i++) {
        this.step();
        if (`${d.floor}:${d.current}` !== before || slot.state === DS.Open) {
          if (`${d.floor}:${d.current}` !== before) return true;
        }
      }
      return `${d.floor}:${d.current}` !== before;
    };
    if (slot.state === DS.Locked) {
      if (w.player.inv.keys <= 0) this.sim.addPickups(0, 0, 1);
      const through = walk();
      this.input.moveX = this.input.moveY = 0;
      if (through) {
        // She kept pushing: the key opened it and she walked on through.
        this.noteEntry();
        return true;
      }
      if ((slot.state as number) !== DS.Open) {
        this.problem(`a key did not open the locked door on side ${side}`);
        return false;
      }
      this.idle(25);
    }
    const moved = walk();
    this.input.moveX = this.input.moveY = 0;
    if (!moved) {
      this.problem(
        `walking into the ${slot.state === DS.Open ? 'open' : 'closed'} door on side ${side} (kind ${slot.kind}, to ${slot.to}) did not change rooms (arena ${w.arena.active}/${w.arena.locked}, player ${p.x.toFixed(1)},${p.y.toFixed(1)})`,
      );
      return false;
    }
    this.noteEntry();
    return true;
  }

  private descended(before: number): boolean {
    const d = this.run.data;
    if (d.floor === before) return false;
    this.finishFloorRecord();
    this.startFloorRecord();
    this.noteEntry();
    return true;
  }

  private takeTrapdoor(): boolean {
    const w = this.w;
    const d = this.run.data;
    const t = w.trapdoor;
    // After a final boss with Endings 1 + 2: the whirlpool to floor 13.
    if (!t.active && w.props.whirlpool.active) {
      const wp = w.props.whirlpool;
      const floor = d.floor;
      w.player.placeAt(Math.min(200, wp.x + 30), wp.y);
      this.idle(4);
      w.player.placeAt(wp.x, wp.y);
      this.exiting = true;
      for (let i = 0; i < 20 && d.floor === floor && !this.stopped; i++) this.step();
      this.exiting = false;
      if (this.floorRec) this.floorRec.exit = 'trapdoor';
      if (!this.descended(floor)) {
        this.problem('stepping into the whirlpool did not drop her to floor 13');
        return false;
      }
      return true;
    }
    if (!t.active) {
      if (!d.won) this.problem('in the boss room at the end of the floor, but no trapdoor');
      return false;
    }
    const floor = d.floor;
    const p = w.player;
    // Step off it (it only works once she has been off it) and let it open.
    p.placeAt(t.x + 30, t.y);
    this.idle(Math.ceil(TRAPDOOR_OPEN_TIME * 60) + 4);
    p.placeAt(t.x, t.y);
    this.exiting = true;
    for (let i = 0; i < 20 && d.floor === floor && !this.stopped; i++) this.step();
    this.exiting = false;
    if (this.floorRec) this.floorRec.exit = 'trapdoor';
    if (!this.descended(floor)) {
      this.problem('standing on the open trapdoor did not drop her to the next floor');
      return false;
    }
    if (this.floorRec && this.floorRec.floor !== floor + 1) this.problem(`the trapdoor led to floor ${this.floorRec.floor}`);
    return true;
  }

  private takeGrate(): boolean {
    const w = this.w;
    const d = this.run.data;
    const g = w.props.grate;
    if (!g.active) {
      // A boss-room grate only shows after the boss; otherwise it should be here.
      this.problem(`hidden-route room ${d.layout.hiddenRoute} has no grate`);
      return this.takeTrapdoorFallback();
    }
    const floor = d.floor;
    const p = w.player;
    if (g.state === 0) {
      this.sim.explode(g.x, g.y);
      this.idle(3);
      if ((g.state as number) !== 1) {
        this.problem('a blast on the cracked grate did not open it');
        return this.takeTrapdoorFallback();
      }
    }
    p.placeAt(Math.min(200, g.x + 30), g.y);
    this.idle(4);
    p.placeAt(g.x, g.y);
    this.exiting = true;
    for (let i = 0; i < 20 && d.floor === floor && !this.stopped; i++) this.step();
    this.exiting = false;
    if (this.floorRec) this.floorRec.exit = 'grate';
    if (!this.descended(floor)) {
      this.problem('stepping into the open grate did not drop her to the next floor');
      return false;
    }
    if (d.track !== 'alt' && floor + 1 < 11) this.problem(`the grate led to the ${d.track} track`);
    return true;
  }

  private takeTrapdoorFallback(): boolean {
    const d = this.run.data;
    if (d.current === d.layout.boss) return this.takeTrapdoor();
    const path = this.route((i) => i === d.layout.boss);
    if (!path) return false;
    for (const side of path) if (!this.goThrough(side)) return false;
    return this.takeTrapdoor();
  }
}

/** Convenience: explores a fresh run of `seed` (god mode) until `untilFloor`. */
export function exploreRun(sim: Sim, opts: ExploreOptions): ExploreReport {
  return new Explorer(sim, opts).explore();
}

export { DIR_BITS };
