/**
 * Polish batch 2 (B2-1): the juice pass, headless with the real WorldFx + ScreenShake + ParticleSystem — shake
 * ceilings in a stacked build, the lance's short flash (and REDUCE FLASHING), a real hurt reaction, rate-limited
 * hit-stop, and no white-out for foes standing in the lance.
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import type { GameEvent } from '../src/engine/events';
import { HITSTOP, HITSTOP_GAP, HitStop } from '../src/render/hitStop';
import { ParticleSystem } from '../src/render/particles';
import { SHAKE_BIG, SHAKE_HIT, SHAKE_KILL, ScreenShake } from '../src/render/shake';
import { REDUCED_FLASH_MAX, WorldFx } from '../src/render/worldFx';
import type { Sim } from '../src/sim/sim';
import { ENEMY_TUNING } from '../src/sim/tuning';
import { OPEN_ROOM } from './helpers/enemies';
import { makeInput, makeSim } from './helpers/sim';

const DT = 1 / 60;

/** The 15-item build of the audit (8 named + 7 more attack items). */
const BUILD = [
  'twin-straws',
  'acorn-buckshot',
  'crab-claws',
  'lantern-moth',
  'geode',
  'rooftop-rod',
  'party-popper',
  'toadstool-cap',
  'rubber-ball',
  'firecracker-pouch',
  'static-cling',
  'leaky-bucket',
  'kaleidoscope',
  'magnifying-glass',
  'trick-candle',
];
const FOES = ['scurrier', 'spitshell', 'grate-gazer', 'drizzle-blob', 'sogwing', 'puddle-toad'];

interface Rig {
  sim: Sim;
  fx: WorldFx;
  shake: ScreenShake;
  particles: ParticleSystem;
}

function rig(seed: string): Rig {
  const sim = makeSim(seed, { room: OPEN_ROOM });
  const particles = new ParticleSystem();
  const shake = new ScreenShake();
  const fx = new WorldFx(particles, shake);
  return { sim, fx, shake, particles };
}

/** One tick the way the run scene does it: step, feed the events, tick the presentation. */
function tick(r: Rig, input = makeInput(), onEvent?: (e: GameEvent) => void): void {
  r.sim.step(input);
  clearEdges(input);
  const q = r.sim.events;
  for (let i = 0; i < q.count; i++) {
    const e = q.at(i);
    r.fx.onEvent(e);
    onEvent?.(e);
  }
  r.fx.tickFlash(DT);
  r.fx.tick(r.sim.world, DT);
  r.particles.update(DT);
  r.shake.update(DT);
}

/** Keeps `n` foes alive (a steady wave) at spots across the room from the player. */
function keepWave(sim: Sim, n: number, k: { i: number }): void {
  const w = sim.world;
  let alive = 0;
  for (let i = 0; i < w.enemies.count; i++) if (!w.enemies.items[i]!.dead) alive++;
  while (alive < n) {
    const j = k.i++;
    const e = sim.spawnEnemy(FOES[j % FOES.length]!, 120 + ((j * 37) % 80), 16 + ((j * 23) % 80), { champion: false });
    if (!e) break;
    alive++;
  }
}

/** Aims at the nearest living foe and holds fire. */
function aimAtNearest(sim: Sim, input = makeInput()): ReturnType<typeof makeInput> {
  const w = sim.world;
  const p = w.player;
  let bx = 1;
  let by = 0;
  let bd = Infinity;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (e.dead) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bd) {
      bd = d;
      bx = e.x - p.x;
      by = e.y - p.y;
    }
  }
  const l = Math.hypot(bx, by) || 1;
  input.aimX = bx / l;
  input.aimY = by / l;
  input.fireHeld = true;
  return input;
}

describe('screen shake ceilings', () => {
  it('a source only raises trauma up to its ceiling', () => {
    const s = new ScreenShake();
    for (let i = 0; i < 50; i++) s.add(0.06, SHAKE_HIT);
    expect(s.trauma).toBeCloseTo(SHAKE_HIT, 6);
    s.add(0.5, SHAKE_KILL);
    expect(s.trauma).toBeCloseTo(SHAKE_KILL, 6);
    // A lower ceiling never lowers what is there.
    s.add(0.2, SHAKE_HIT);
    expect(s.trauma).toBeCloseTo(SHAKE_KILL, 6);
    s.add(1, SHAKE_BIG);
    expect(s.trauma).toBe(1);
    // Kicks are capped too: a burst of hits can't stack into a lurch.
    for (let i = 0; i < 20; i++) s.kick(1.5, 0, 1.5);
    s.update(0);
    expect(Math.abs(s.x)).toBeLessThanOrEqual(1.5 + 5 + 1);
  });

  it('a 15-item build firing for 30 s into a 6-foe wave keeps under 10 % of ticks at 3 px or more', () => {
    const r = rig('juice-shake');
    const w = r.sim.world;
    w.godMode = true;
    w.player.placeAt(40, 56);
    for (const id of BUILD) r.sim.giveItem(id);
    const k = { i: 0 };
    let big = 0;
    let kills = 0;
    const ticks = 30 * 60;
    for (let t = 0; t < ticks; t++) {
      keepWave(r.sim, 6, k);
      tick(r, aimAtNearest(r.sim), (e) => {
        if (e.type === 'enemyKilled') kills++;
      });
      if (r.shake.offset >= 3) big++;
    }
    // It really fought (so the shake had every chance to pile up).
    expect(kills).toBeGreaterThan(30);
    expect(big / ticks).toBeLessThan(0.1);
  });

  it('a lance release and a hurt still reach 3-4 px', () => {
    // The lance: charge a full meter, release.
    const r = rig('juice-lance');
    r.sim.world.godMode = true;
    r.sim.world.player.placeAt(40, 56);
    r.sim.giveItem('storm-lance');
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 150 && r.sim.world.player.atk.charge < 1; t++) tick(r, input);
    input.fireHeld = false;
    let lance = 0;
    for (let t = 0; t < 20; t++) {
      tick(r, input);
      lance = Math.max(lance, r.shake.offset);
    }
    expect(lance).toBeGreaterThanOrEqual(3);

    // A hurt by a foe's touch: the hard shake plus a kick away from it.
    const h = rig('juice-hurt');
    h.sim.world.player.placeAt(60, 56);
    const foe = h.sim.spawnEnemy('scurrier', 72, 56, { champion: false })!;
    foe.spawnT = 0;
    let hurt = 0;
    let hurts = 0;
    for (let t = 0; t < 120 && hurts === 0; t++) {
      tick(h, makeInput(), (e) => {
        if (e.type === 'hurt') hurts++;
      });
    }
    expect(hurts).toBe(1);
    for (let t = 0; t < 12; t++) {
      hurt = Math.max(hurt, h.shake.offset);
      tick(h);
    }
    expect(hurt).toBeGreaterThanOrEqual(3);
    // The vignette runs.
    expect(h.fx.hurtAlpha(false) + h.fx.hurtAlpha(true)).toBeGreaterThanOrEqual(0);
  });
});

describe('the Storm Lance flash', () => {
  it('fades below 0.1 within 6 frames, and never exceeds 0.2 with reduce flashing', () => {
    const r = rig('juice-flash');
    r.sim.world.godMode = true;
    r.sim.world.player.placeAt(40, 56);
    r.sim.giveItem('storm-lance');
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 150 && r.sim.world.player.atk.charge < 1; t++) tick(r, input);
    input.fireHeld = false;
    let fired = -1;
    const full: number[] = [];
    const reduced: number[] = [];
    for (let t = 0; t < 20; t++) {
      tick(r, input, (e) => {
        if (e.type === 'lanceFire' && e.id !== 'mini') fired = t;
      });
      if (fired >= 0) {
        full.push(r.fx.flashAlpha(1, false));
        reduced.push(r.fx.flashAlpha(1, true));
      }
    }
    expect(fired).toBeGreaterThanOrEqual(0);
    // Bright on the release frame, gone by the sixth.
    expect(full[0]!).toBeGreaterThan(0.2);
    expect(full[0]!).toBeLessThanOrEqual(0.45);
    expect(full[5]!).toBeLessThan(0.1);
    expect(full.filter((a) => a > 0.2).length).toBeLessThanOrEqual(4);
    expect(Math.max(...reduced)).toBeLessThanOrEqual(REDUCED_FLASH_MAX);
    // Shake turned off: the flash is softer still.
    expect(r.fx.flashAlpha(0, false)).toBeLessThanOrEqual(full[full.length - 1]!);
  });

  it('every full-screen flash is capped with reduce flashing (explosions, novas, boss moments)', () => {
    const r = rig('juice-flashes');
    const ev = (type: GameEvent['type'], a = 0, b = 0, id = ''): GameEvent => ({ type, x: 100, y: 50, a, b, id });
    for (const e of [ev('explosion', 30, 10), ev('nova', 40), ev('bossDying'), ev('bossDefeated', 20), ev('bossPhase'), ev('transform')]) {
      r.fx.flash = 0;
      r.fx.onEvent(e);
      expect(r.fx.flashAlpha(1, false)).toBeGreaterThan(0);
      expect(r.fx.flashAlpha(1, true)).toBeLessThanOrEqual(REDUCED_FLASH_MAX);
    }
  });
});

describe('hit-stop', () => {
  const ev = (type: GameEvent['type'], b = 0, id = ''): GameEvent => ({ type, x: 0, y: 0, a: 0, b, id });

  it('a hurt starts a hit-stop even right after another one; others are rate-limited', () => {
    const h = new HitStop();
    h.onEvent(ev('lanceFire'), 0);
    expect(h.ticks).toBe(HITSTOP.lance);
    // Within the gap: a big kill doesn't restart it...
    h.ticks = 0;
    h.onEvent(ev('enemyKilled', 4), 0.1);
    expect(h.ticks).toBe(0);
    // ...a hurt always does.
    h.onEvent(ev('hurt'), 0.12);
    expect(h.ticks).toBe(HITSTOP.hurt);
    h.ticks = 0;
    h.onEvent(ev('enemyKilled', 4), 0.12 + HITSTOP_GAP);
    expect(h.ticks).toBe(HITSTOP.big);
    h.ticks = 0;
    h.onEvent(ev('bossPhase'), 1);
    expect(h.ticks).toBe(HITSTOP.phase);
    // Familiar lances don't stop the picture.
    h.ticks = 0;
    h.onEvent(ev('lanceFire', 0, 'mini'), 2);
    expect(h.ticks).toBe(0);
  });

  it('melee connects stop 1 tick at most every 0.2 s, and a press cancels a hit-stop', () => {
    const h = new HitStop();
    let n = 0;
    for (let t = 0; t < 60; t++) {
      const before = h.started;
      h.onEvent(ev('swipeHit'), t / 60);
      if (h.started > before) n++;
      h.hold(false);
    }
    // One second of swings: at most 4-5 stops (0.25 s global gap).
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    h.reset();
    h.request(5, 10, true);
    expect(h.hold(false)).toBe(true);
    expect(h.hold(true)).toBe(false);
    expect(h.ticks).toBe(0);
  });

  it('a real hurt in a sim asks for a hit-stop', () => {
    const r = rig('juice-stop');
    const h = new HitStop();
    r.sim.world.player.placeAt(60, 56);
    r.sim.hurtPlayer(1);
    let t = 0;
    tick(r, makeInput(), (e) => h.onEvent(e, (t += DT)));
    expect(h.ticks).toBe(HITSTOP.hurt);
  });
});

describe('no white-out in the lance', () => {
  it('a foe in the beam flashes white only now and then, tinted pale in between', () => {
    const r = rig('juice-whiteout');
    const w = r.sim.world;
    w.godMode = true;
    w.player.placeAt(40, 56);
    r.sim.giveItem('storm-lance');
    const foe = r.sim.spawnEnemy('grate-gazer', 120, 56, { champion: false })!;
    foe.spawnT = 0;
    foe.hp = foe.maxHp = 1e6;
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    for (let t = 0; t < 150 && w.player.atk.charge < 1; t++) tick(r, input);
    input.fireHeld = false;
    let white = 0;
    let pale = 0;
    let hits = 0;
    for (let t = 0; t < 40; t++) {
      tick(r, input, (e) => {
        if (e.type === 'enemyHit') hits++;
      });
      if (foe.flash > 0) white++;
      else if (foe.hitTint > 0) pale++;
    }
    expect(hits).toBeGreaterThanOrEqual(8);
    // The old rule kept it white the whole ~0.5 s beam (30 ticks); now at most ~a third of it.
    expect(white).toBeLessThanOrEqual(Math.ceil((30 * ENEMY_TUNING.hitFlash) / ENEMY_TUNING.hitFlashGap) + 6);
    expect(pale).toBeGreaterThan(0);
  });
});
