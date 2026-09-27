/**
 * The synergy stress harness (Phase 5, tests/stress-synergy.test.ts): puts a build (a loadout) into a
 * room with obstacles, keeps waves of real chapter enemies (and sometimes a boss) coming, fights them
 * with the real input path for a few seconds, then lets the room clear and settle.
 *
 * Every tick it checks the invariants the game must keep whatever the build: no exceptions; no NaN /
 * Infinity anywhere; projectiles, beams, swipes, enemies, enemy shots, shockwaves, puddles, explosions,
 * pickups, the event queue and the presentation particles never above their caps; nothing outside the
 * room (+ a margin). Step times are recorded (sim only; the particle system is timed on its own).
 * After the clear, every transient pool must return to what the build had at rest before the fight.
 *
 * Runs are deterministic (the sim is seeded; the particle layer's Math.random never feeds back), so a
 * build that fails can be replayed exactly from its label and seed.
 */

import { clearEdges } from '../../src/engine/inputState';
import { Rng } from '../../src/engine/rng';
import { CHARACTERS } from '../../src/content/registry';
import { ParticleSystem, PARTICLE_CAP } from '../../src/render/particles';
import { ScreenShake } from '../../src/render/shake';
import { WorldFx } from '../../src/render/worldFx';
import { liveExplosions } from '../../src/sim/attack/impacts';
import { SK_ORBIT } from '../../src/sim/attack/state';
import {
  CAP_BOMBS,
  CAP_CREEP,
  CAP_ENEMIES,
  CAP_ENEMY_SHOTS,
  CAP_PEDESTALS,
  CAP_PICKUPS,
  CAP_PROJECTILES,
  CAP_WAVES,
  DT,
  ROOM_H,
  ROOM_W,
} from '../../src/sim/constants';
import type { Sim } from '../../src/sim/sim';
import { ATTACK_TUNING } from '../../src/sim/tuning';
import { timingStats, type TimingStats } from './perf';
import { makeInput, makeSim } from './sim';

/** Obstacles for every wall / bounce / phase / crate / pit path, with plenty of open floor for spawns. */
export const STRESS_ROOM: readonly string[] = [
  '.............',
  '..#.......$..',
  '.....x.......',
  '.............',
  '.......O.....',
  '..u.......#..',
  '.............',
];

/** How far outside the room interior anything may be (px) before it counts as escaped. */
export const ROOM_MARGIN = 16;

export interface StressBuild {
  /** Shown in reports; with `seed` it replays the build exactly. */
  label: string;
  seed: string;
  /** Character id (default Wren). */
  character?: string;
  /** Puts the loadout together (test carrier / modifier items, or real items through the pickup flow). */
  setup: (sim: Sim) => void;
  /** Chapter whose enemies come in waves. */
  chapter: string;
  /** Enemies per wave. */
  waveSize: number;
  /** A boss to fight at the start of the fight (its adds, beams, splits, shields join the mess). */
  boss?: string;
  /** Ticks of fighting (waves keep coming). */
  fightTicks: number;
  /** Use the active item when charged and the consumables now and then. */
  useItems?: boolean;
}

export interface StressPeaks {
  projectiles: number;
  beams: number;
  swipes: number;
  enemies: number;
  enemyShots: number;
  creep: number;
  waves: number;
  explosionsLive: number;
  explosionQueue: number;
  pickups: number;
  particles: number;
  events: number;
  chainArcs: number;
}

export interface StressResult {
  label: string;
  /** The first invariant violation / exception ('' when clean). */
  error: string;
  /** What didn't return to its at-rest level after the room cleared. */
  leaks: string[];
  /** Sim step times (ms). */
  times: Float64Array;
  stats: TimingStats;
  /** Particle-layer (WorldFx + ParticleSystem) time per tick, ms. */
  fxAvg: number;
  peaks: StressPeaks;
  ticks: number;
  settleTicks: number;
  kills: number;
  eventsDropped: number;
}

/** Transient pool levels (what must return to the at-rest level after a clear). */
interface Levels {
  shots: number;
  beams: number;
  swipes: number;
  alliedCreep: number;
  particles: number;
}

function levels(sim: Sim, particles: ParticleSystem, out: Levels): Levels {
  const w = sim.world;
  let shots = 0;
  for (let i = 0; i < w.projectiles.count; i++) if (w.projectiles.items[i]!.kind !== SK_ORBIT) shots++;
  let allied = 0;
  for (let i = 0; i < w.creep.count; i++) if (w.creep.items[i]!.allied) allied++;
  out.shots = shots;
  out.beams = w.atk.beams.count;
  out.swipes = w.atk.swipes.count;
  out.alliedCreep = allied;
  out.particles = particles.count;
  return out;
}

function fin(v: number): boolean {
  return Number.isFinite(v);
}

function outside(x: number, y: number, margin = ROOM_MARGIN): boolean {
  return x < -margin || y < -margin || x > ROOM_W + margin || y > ROOM_H + margin;
}

/**
 * The per-tick invariants. Returns '' when everything holds, else what broke. Allocation-light: only
 * the failure message is built.
 */
export function checkWorld(sim: Sim, particles: ParticleSystem | null): string {
  const w = sim.world;
  const p = w.player;
  if (!fin(p.x) || !fin(p.y) || !fin(p.vx) || !fin(p.vy)) return `player not finite (${p.x}, ${p.y}, v ${p.vx}, ${p.vy})`;
  if (outside(p.x, p.y, 1)) return `player outside the room at ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  if (!fin(p.atk.charge)) return 'charge meter not finite';
  for (const k of ['damage', 'fireRate', 'shotSpeed', 'range', 'moveSpeed', 'luck', 'shotSize', 'knockback'] as const) {
    if (!fin(p.stats[k])) return `stat ${k} not finite (${p.stats[k]})`;
  }
  // Player projectiles.
  const shots = w.projectiles;
  if (shots.count > CAP_PROJECTILES) return `projectiles ${shots.count} > ${CAP_PROJECTILES}`;
  for (let i = 0; i < shots.count; i++) {
    const s = shots.items[i]!;
    if (!fin(s.x) || !fin(s.y) || !fin(s.z) || !fin(s.vx) || !fin(s.vy) || !fin(s.damage) || !fin(s.size) || !fin(s.speed)) {
      return `shot kind ${s.kind} not finite at ${s.x},${s.y} (dmg ${s.damage}, size ${s.size}, speed ${s.speed})`;
    }
    if (outside(s.x, s.y)) return `shot kind ${s.kind} outside the room at ${s.x.toFixed(1)},${s.y.toFixed(1)} (flags ${s.flags})`;
    if (s.depth > ATTACK_TUNING.maxSplitDepth) return `split depth ${s.depth}`;
  }
  // Beams.
  const beams = w.atk.beams;
  if (beams.count > ATTACK_TUNING.capBeams) return `beams ${beams.count} > ${ATTACK_TUNING.capBeams}`;
  for (let i = 0; i < beams.count; i++) {
    const b = beams.items[i]!;
    if (b.n > ATTACK_TUNING.beamBudget) return `beam with ${b.n} points > ${ATTACK_TUNING.beamBudget}`;
    if (!fin(b.dmg) || !fin(b.width)) return `beam damage / width not finite (${b.dmg}, ${b.width})`;
    for (let k = 0; k < b.nseg; k++) if (b.segLen[k]! > ATTACK_TUNING.beamMaxPoints) return `beam segment of ${b.segLen[k]} points`;
    for (let k = 0; k < b.n; k++) {
      const x = b.px[k]!;
      const y = b.py[k]!;
      if (!fin(x) || !fin(y) || !fin(b.pw[k]!)) return `beam point ${k} not finite`;
      if (outside(x, y)) return `beam point outside the room at ${x.toFixed(1)},${y.toFixed(1)} (kind ${b.kind})`;
    }
  }
  if (w.atk.swipes.count > ATTACK_TUNING.capSwipes) return `swipes ${w.atk.swipes.count} > ${ATTACK_TUNING.capSwipes}`;
  if (w.atk.arcsThisTick > ATTACK_TUNING.capChainArcs) return `chain arcs ${w.atk.arcsThisTick} > ${ATTACK_TUNING.capChainArcs}`;
  const live = liveExplosions(w);
  if (live > ATTACK_TUNING.capExplosionsLive) return `live explosions ${live} > ${ATTACK_TUNING.capExplosionsLive}`;
  if (w.atk.explosions.n > ATTACK_TUNING.explosionQueue) return `explosion queue ${w.atk.explosions.n}`;
  // Enemies.
  const en = w.enemies;
  if (en.count > CAP_ENEMIES) return `enemies ${en.count} > ${CAP_ENEMIES}`;
  for (let i = 0; i < en.count; i++) {
    const e = en.items[i]!;
    if (!fin(e.x) || !fin(e.y) || !fin(e.z) || !fin(e.vx) || !fin(e.vy) || !fin(e.hp) || !fin(e.kx) || !fin(e.ky)) {
      return `enemy ${e.def.id} not finite (${e.x}, ${e.y}, hp ${e.hp})`;
    }
    if (outside(e.x, e.y)) return `enemy ${e.def.id} outside the room at ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
  }
  const es = w.enemyShots;
  if (es.count > CAP_ENEMY_SHOTS) return `enemy shots ${es.count} > ${CAP_ENEMY_SHOTS}`;
  for (let i = 0; i < es.count; i++) {
    const s = es.items[i]!;
    if (!fin(s.x) || !fin(s.y) || !fin(s.z) || !fin(s.vx) || !fin(s.vy)) return `enemy shot not finite (${s.x}, ${s.y})`;
    if (outside(s.x, s.y)) return `enemy shot outside the room at ${s.x.toFixed(1)},${s.y.toFixed(1)} (phase ${s.phase}, lob ${s.lob})`;
  }
  if (w.creep.count > CAP_CREEP) return `puddles ${w.creep.count} > ${CAP_CREEP}`;
  for (let i = 0; i < w.creep.count; i++) {
    const c = w.creep.items[i]!;
    if (!fin(c.x) || !fin(c.y) || !fin(c.r) || !fin(c.life)) return 'puddle not finite';
    if (outside(c.x, c.y)) return `puddle outside the room at ${c.x.toFixed(1)},${c.y.toFixed(1)}`;
  }
  if (w.waves.count > CAP_WAVES) return `shockwaves ${w.waves.count} > ${CAP_WAVES}`;
  // Loot, bombs, pedestals.
  if (w.pickups.count > CAP_PICKUPS) return `pickups ${w.pickups.count} > ${CAP_PICKUPS}`;
  for (let i = 0; i < w.pickups.count; i++) {
    const k = w.pickups.items[i]!;
    if (!fin(k.x) || !fin(k.y) || !fin(k.z)) return `pickup kind ${k.kind} not finite`;
    if (outside(k.x, k.y)) return `pickup kind ${k.kind} outside the room at ${k.x.toFixed(1)},${k.y.toFixed(1)}`;
  }
  if (w.bombs.count > CAP_BOMBS) return `bombs ${w.bombs.count} > ${CAP_BOMBS}`;
  for (let i = 0; i < w.bombs.count; i++) {
    const b = w.bombs.items[i]!;
    if (!fin(b.x) || !fin(b.y)) return 'bomb not finite';
    if (outside(b.x, b.y)) return `bomb outside the room at ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  }
  if (w.pedestals.count > CAP_PEDESTALS) return `pedestals ${w.pedestals.count} > ${CAP_PEDESTALS}`;
  // Familiars.
  for (const f of w.atk.familiars.list) {
    if (!f.alive) continue;
    if (!fin(f.x) || !fin(f.y)) return `familiar ${f.def?.id} not finite`;
    if (outside(f.x, f.y, ROOM_MARGIN * 2)) return `familiar ${f.def?.id} outside the room at ${f.x.toFixed(1)},${f.y.toFixed(1)}`;
  }
  // Presentation.
  if (particles && particles.count > PARTICLE_CAP) return `particles ${particles.count} > ${PARTICLE_CAP}`;
  if (w.events.count > w.events.capacity) return `event queue ${w.events.count} > ${w.events.capacity}`;
  return '';
}

/** The nearest enemy that can be hit (null: none). */
function nearestFoe(sim: Sim): { x: number; y: number } | null {
  const w = sim.world;
  const p = w.player;
  let best: { x: number; y: number } | null = null;
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

/** One particle system shared by every build (cleared between builds): 1500 particles allocated once. */
const PARTICLES = new ParticleSystem();

/**
 * Plays one build: a short rest (the at-rest levels), the fight, the clear, then settling. Never throws —
 * an exception is reported as the result's error.
 */
export function runStress(build: StressBuild): StressResult {
  const peaks: StressPeaks = {
    projectiles: 0,
    beams: 0,
    swipes: 0,
    enemies: 0,
    enemyShots: 0,
    creep: 0,
    waves: 0,
    explosionsLive: 0,
    explosionQueue: 0,
    pickups: 0,
    particles: 0,
    events: 0,
    chainArcs: 0,
  };
  const maxTicks = build.fightTicks + 60 * 30;
  const times = new Float64Array(maxTicks);
  const res: StressResult = {
    label: build.label,
    error: '',
    leaks: [],
    times,
    stats: timingStats(times, 0),
    fxAvg: 0,
    peaks,
    ticks: 0,
    settleTicks: 0,
    kills: 0,
    eventsDropped: 0,
  };
  const particles = PARTICLES;
  particles.pool.clear();
  const shake = new ScreenShake();
  const fx = new WorldFx(particles, shake);
  let sim: Sim | null = null;
  let n = 0;
  let fxTime = 0;
  let phase = 'setup';
  try {
    const character = build.character ? CHARACTERS.get(build.character) : undefined;
    sim = makeSim(build.seed, { room: STRESS_ROOM, character });
    const s = sim;
    const w = s.world;
    w.godMode = true;
    w.player.placeAt(40, 56);
    build.setup(s);
    w.events.clear();
    const input = makeInput();
    const rng = new Rng(`${build.seed}:input`);

    const tick = (): boolean => {
      const t0 = performance.now();
      s.step(input);
      const t1 = performance.now();
      if (n < maxTicks) times[n] = t1 - t0;
      n++;
      clearEdges(input);
      const q = s.events;
      if (q.count > peaks.events) peaks.events = q.count;
      for (let i = 0; i < q.count; i++) fx.onEvent(q.at(i));
      fx.tick(w, DT);
      shake.update(DT);
      particles.update(DT);
      fxTime += performance.now() - t1;
      if (w.projectiles.count > peaks.projectiles) peaks.projectiles = w.projectiles.count;
      if (w.atk.beams.count > peaks.beams) peaks.beams = w.atk.beams.count;
      if (w.atk.swipes.count > peaks.swipes) peaks.swipes = w.atk.swipes.count;
      if (w.enemies.count > peaks.enemies) peaks.enemies = w.enemies.count;
      if (w.enemyShots.count > peaks.enemyShots) peaks.enemyShots = w.enemyShots.count;
      if (w.creep.count > peaks.creep) peaks.creep = w.creep.count;
      if (w.waves.count > peaks.waves) peaks.waves = w.waves.count;
      if (w.pickups.count > peaks.pickups) peaks.pickups = w.pickups.count;
      if (particles.count > peaks.particles) peaks.particles = particles.count;
      if (w.atk.arcsThisTick > peaks.chainArcs) peaks.chainArcs = w.atk.arcsThisTick;
      if (w.atk.explosions.n > peaks.explosionQueue) peaks.explosionQueue = w.atk.explosions.n;
      const live = liveExplosions(w);
      if (live > peaks.explosionsLive) peaks.explosionsLive = live;
      const err = checkWorld(s, particles);
      if (err) {
        res.error = `${phase} tick ${n}: ${err}`;
        return false;
      }
      return true;
    };

    const rest = (): void => {
      input.moveX = input.moveY = 0;
      input.aimX = input.aimY = 0;
      input.fireHeld = false;
    };

    // 1. At rest, before the fight: what the build keeps around with nothing to shoot at.
    phase = 'rest';
    const base: Levels = { shots: 0, beams: 0, swipes: 0, alliedCreep: 0, particles: 0 };
    const cur: Levels = { shots: 0, beams: 0, swipes: 0, alliedCreep: 0, particles: 0 };
    rest();
    for (let t = 0; t < 45; t++) {
      if (!tick()) return finish();
      levels(s, particles, cur);
      base.shots = Math.max(base.shots, cur.shots);
      base.beams = Math.max(base.beams, cur.beams);
      base.swipes = Math.max(base.swipes, cur.swipes);
      base.alliedCreep = Math.max(base.alliedCreep, cur.alliedCreep);
      base.particles = Math.max(base.particles, cur.particles);
    }
    const killsBefore = w.counters.kills;

    // 2. The fight: waves keep coming; aim at the nearest foe, charge and release, keep moving.
    phase = 'fight';
    if (build.boss) s.startBossFight(build.boss);
    for (let t = 0; t < build.fightTicks; t++) {
      if (!w.arena.active) s.startWave({ count: build.waveSize, chapter: build.chapter });
      const foe = nearestFoe(s);
      const cyc = t % 80;
      input.fireHeld = cyc < 74;
      input.firePressed = cyc === 0;
      input.fireReleased = cyc === 74;
      if (foe) {
        const dx = foe.x - w.player.x;
        const dy = foe.y - w.player.y;
        const d = Math.hypot(dx, dy) || 1;
        input.aimX = dx / d;
        input.aimY = dy / d;
      } else {
        const a = t * 0.05;
        input.aimX = Math.cos(a);
        input.aimY = Math.sin(a);
      }
      if (!input.fireHeld) input.aimX = input.aimY = 0;
      input.moveX = Math.sin(t * 0.021) * 0.8;
      input.moveY = Math.cos(t * 0.033) * 0.8;
      if (build.useItems) {
        const inv = w.player.inv;
        if (inv.active && inv.active.charge >= inv.active.max && t % 97 === 13) input.active = true;
        if (inv.consumables.length > 0 && t % 211 === 100) input.consumable = true;
        if (inv.bombs > 0 && t % 173 === 50) input.bomb = true;
        if (t % 61 === 7) input.dash = true;
      } else if (rng.next() < 0.004) {
        input.dash = true;
      }
      if (!tick()) return finish();
    }

    // 3. The room clears: no more waves; fight on until the last one falls (or 8 s), then finish them.
    phase = 'clear';
    for (let t = 0; t < 480 && (w.arena.active || w.enemies.count > 0); t++) {
      const foe = nearestFoe(s);
      input.fireHeld = t % 80 < 74;
      input.firePressed = t % 80 === 0;
      input.fireReleased = t % 80 === 74;
      if (foe && input.fireHeld) {
        const dx = foe.x - w.player.x;
        const dy = foe.y - w.player.y;
        const d = Math.hypot(dx, dy) || 1;
        input.aimX = dx / d;
        input.aimY = dy / d;
      } else {
        input.aimX = input.aimY = 0;
      }
      input.moveX = input.moveY = 0;
      if (!tick()) return finish();
    }
    if (w.enemies.count > 0) s.clearRoom();
    res.kills = w.counters.kills - killsBefore;

    // 4. Settle: hands off; every transient pool must fall back to its at-rest level.
    phase = 'settle';
    rest();
    const settled = (): boolean => {
      levels(s, particles, cur);
      return (
        cur.shots <= base.shots &&
        cur.beams <= base.beams &&
        cur.swipes <= base.swipes &&
        cur.alliedCreep <= base.alliedCreep &&
        w.enemies.count === 0 &&
        w.enemyShots.count === 0 &&
        w.waves.count === 0 &&
        w.bombs.count === 0 &&
        w.atk.pending.n === 0 &&
        w.atk.explosions.n === 0 &&
        liveExplosions(w) === 0 &&
        cur.particles <= Math.max(base.particles * 1.5, base.particles + 60)
      );
    };
    let quiet = 0;
    let t = 0;
    for (; t < 60 * 25; t++) {
      if (!tick()) return finish();
      // Hostile creep left by the fight dries up on its own; the clear already fizzled shots.
      if (settled()) {
        if (++quiet >= 30) break;
      } else {
        quiet = 0;
      }
    }
    res.settleTicks = t;
    if (quiet < 30) {
      levels(s, particles, cur);
      const L = res.leaks;
      if (cur.shots > base.shots) L.push(`projectiles ${cur.shots} (at rest ${base.shots})`);
      if (cur.beams > base.beams) L.push(`beams ${cur.beams} (at rest ${base.beams})`);
      if (cur.swipes > base.swipes) L.push(`swipes ${cur.swipes} (at rest ${base.swipes})`);
      if (cur.alliedCreep > base.alliedCreep) L.push(`puddles ${cur.alliedCreep} (at rest ${base.alliedCreep})`);
      if (w.enemies.count > 0) L.push(`enemies ${w.enemies.count}`);
      if (w.enemyShots.count > 0) L.push(`enemy shots ${w.enemyShots.count}`);
      if (w.waves.count > 0) L.push(`shockwaves ${w.waves.count}`);
      if (w.bombs.count > 0) L.push(`bombs ${w.bombs.count}`);
      if (w.atk.pending.n > 0) L.push(`pending volley specs ${w.atk.pending.n}`);
      if (w.atk.explosions.n > 0) L.push(`queued explosions ${w.atk.explosions.n}`);
      if (liveExplosions(w) > 0) L.push(`live explosions ${liveExplosions(w)}`);
      if (cur.particles > Math.max(base.particles * 1.5, base.particles + 60)) L.push(`particles ${cur.particles} (at rest ${base.particles})`);
    }
    // Temporary effects must stay bounded however many triggers fired.
    if (w.player.temps.length > 80) res.leaks.push(`temporary effects ${w.player.temps.length}`);
    res.eventsDropped = w.events.dropped;
    if (w.events.dropped > 0 && !res.error) res.error = `the event queue overflowed (${w.events.dropped} events dropped)`;
  } catch (err) {
    const e = err as Error;
    res.error = `${phase} tick ${n}: exception ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 7).join('\n')}`;
  }
  return finish();

  function finish(): StressResult {
    res.ticks = n;
    res.stats = timingStats(times, Math.min(n, maxTicks));
    res.fxAvg = n > 0 ? fxTime / n : 0;
    return res;
  }
}

/** One line per result for the report. */
export function describeResult(r: StressResult): string {
  const s = r.stats;
  return `${r.label}: avg ${s.avg.toFixed(3)} p99 ${s.p99.toFixed(2)} max ${s.max.toFixed(2)} ms · shots ${r.peaks.projectiles} beams ${r.peaks.beams} foes ${r.peaks.enemies} eshots ${r.peaks.enemyShots} particles ${r.peaks.particles} kills ${r.kills}`;
}
