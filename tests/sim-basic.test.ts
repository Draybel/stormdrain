import { describe, expect, it } from 'vitest';
import { WALK_MODE, circleOverlapsGrid } from '../src/sim/collision';
import { ROOM_H, ROOM_W, TILE } from '../src/sim/constants';
import { PLAYER_TUNING } from '../src/sim/tuning';
import { WREN } from '../src/content/characters/wren';
import type { Sim } from '../src/sim/sim';
import { makeInput, makeSim, stepN } from './helpers/sim';

const EPS = 0.05;

/** Invariants that must hold after every tick. */
function checkInvariants(sim: Sim): void {
  const w = sim.world;
  const p = w.player;
  for (const v of [p.x, p.y, p.vx, p.vy]) expect(Number.isFinite(v)).toBe(true);
  // Never inside rocks, pits (with their lip inset) or walls.
  expect(circleOverlapsGrid(w.room, p.x, p.y, p.r - EPS, WALK_MODE)).toBe(false);
  expect(p.x).toBeGreaterThanOrEqual(p.r - EPS);
  expect(p.y).toBeGreaterThanOrEqual(p.r - EPS);
  expect(p.x).toBeLessThanOrEqual(ROOM_W - p.r + EPS);
  expect(p.y).toBeLessThanOrEqual(ROOM_H - p.r + EPS);
  // Never overlapping a standing dummy.
  for (let i = 0; i < w.dummies.count; i++) {
    const d = w.dummies.items[i]!;
    if (d.popped) continue;
    expect(Math.hypot(p.x - d.x, p.y - d.y)).toBeGreaterThanOrEqual(p.r + d.r - EPS);
  }
  for (let i = 0; i < w.projectiles.count; i++) {
    const m = w.projectiles.items[i]!;
    for (const v of [m.x, m.y, m.z, m.vx, m.vy]) expect(Number.isFinite(v)).toBe(true);
  }
}

describe('headless sim', () => {
  it('starts Wren at the marked spawn in the test room', () => {
    const sim = makeSim();
    const p = sim.world.player;
    expect(p.x).toBe(2 * TILE + 8);
    expect(p.y).toBe(3 * TILE + 8);
    expect(sim.world.dummies.count).toBe(3);
  });

  it('runs 600 scripted ticks: moves, collides, fires, despawns, damages; no NaN', () => {
    const sim = makeSim(2024);
    // Plain marbles only: the yard's pedestals would hand out attack items along the way.
    sim.world.pedestals.clear();
    const input = makeInput();
    const start = { x: sim.world.player.x, y: sim.world.player.y };
    let maxDist = 0;
    const each = (s: Sim): void => {
      checkInvariants(s);
      const p = s.world.player;
      maxDist = Math.max(maxDist, Math.hypot(p.x - start.x, p.y - start.y));
    };
    const script: [number, Partial<typeof input>][] = [
      [90, { moveX: 1, moveY: 0, aimX: 1, aimY: 0, fireHeld: true }], // toward the pit, shooting the dummy
      [90, { moveX: -0.7, moveY: -0.7, aimX: 0, aimY: -1, fireHeld: true }], // into the mossy corner rocks
      [90, { moveX: -1, moveY: 0, aimX: -1, aimY: 0, fireHeld: true }], // into the left wall
      [90, { moveX: 0, moveY: 1, aimX: 0, aimY: 0, fireHeld: false }], // down to the bottom wall
      [90, { moveX: 0.7, moveY: 0.7 }], // diagonal analog
      [150, { moveX: 0, moveY: 0 }], // idle: marbles must all land
    ];
    let shots = 0;
    let hits = 0;
    let splashes = 0;
    for (const [ticks, patch] of script) {
      Object.assign(input, patch);
      const st = stepN(sim, input, ticks, each);
      shots += st.events.shoot ?? 0;
      hits += st.events.hit ?? 0;
      splashes += st.events.splash ?? 0;
    }
    expect(sim.tick).toBe(600);
    expect(maxDist).toBeGreaterThan(40);
    // 270 ticks of held fire at 3/s → 14 shots (fires on the first tick, then every 20 ticks).
    expect(shots).toBe(14);
    expect(sim.world.counters.shots).toBe(14);
    expect(hits).toBeGreaterThan(0);
    expect(splashes).toBeGreaterThan(0);
    expect(sim.world.projectiles.count).toBe(0);
  });

  it('fires at exactly the configured rate while held, and marbles despawn afterwards', () => {
    const sim = makeSim(7);
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    let maxLive = 0;
    const st = stepN(sim, input, 600, (s) => {
      maxLive = Math.max(maxLive, s.world.projectiles.count);
    });
    // 3 shots/s over 10 s: ticks 1, 21, 41, … 581 → 30 shots.
    expect(st.events.shoot).toBe(30);
    expect(maxLive).toBeGreaterThan(0);
    expect(maxLive).toBeLessThan(6); // range/speed ≈ 0.8 s of flight + drop
    input.fireHeld = false;
    stepN(sim, input, 120);
    expect(sim.world.projectiles.count).toBe(0);

    const fast = makeSim(7);
    fast.world.player.stats.fireRate = 6;
    const st2 = stepN(fast, makeInput({ aimX: 0, aimY: 1, fireHeld: true }), 600);
    expect(st2.events.shoot).toBe(60);
  });

  it('a quick tap (press+release inside one tick) still fires once; holding never banks shots', () => {
    const sim = makeSim(3);
    const input = makeInput({ aimX: 1, aimY: 0, firePressed: true, fireReleased: true });
    const st = stepN(sim, input, 1);
    expect(st.events.shoot).toBe(1);
    // Rapid taps cannot beat the fire rate.
    let shots = 0;
    for (let i = 0; i < 60; i++) {
      input.firePressed = i % 4 === 0;
      shots += stepN(sim, input, 1).events.shoot ?? 0;
    }
    expect(shots).toBeLessThanOrEqual(3);
  });

  it('dummies take damage, flash, pop at 0 HP and grow back', () => {
    const sim = makeSim(11);
    const w = sim.world;
    const target = w.dummies.items.slice(0, w.dummies.count).find((d) => d.y < 70 && d.y > 40)!;
    expect(target).toBeDefined();
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    let sawDamage = false;
    let sawFlash = false;
    const st = stepN(sim, input, 200, () => {
      if (target.hp < target.maxHp) sawDamage = true;
      if (target.flash > 0) sawFlash = true;
    });
    expect(sawDamage).toBe(true);
    expect(sawFlash).toBe(true);
    expect(st.events.pop).toBeGreaterThanOrEqual(1);
    expect(target.popped || target.hp < target.maxHp).toBe(true);
    input.fireHeld = false;
    const st2 = stepN(sim, input, 200);
    expect(st2.events.spawn).toBeGreaterThanOrEqual(1);
    expect(target.popped).toBe(false);
    expect(target.hp).toBe(target.maxHp);
  });

  it('walls stop the player', () => {
    const sim = makeSim();
    stepN(sim, makeInput({ moveX: -1 }), 120, checkInvariants);
    expect(sim.world.player.x).toBeCloseTo(PLAYER_TUNING.radius, 1);
    stepN(sim, makeInput({ moveY: 1 }), 120, checkInvariants);
    expect(sim.world.player.y).toBeCloseTo(ROOM_H - PLAYER_TUNING.radius, 1);
  });

  it('rocks stop the player (and you slide along them)', () => {
    const sim = makeSim();
    const p = sim.world.player;
    stepN(sim, makeInput({ moveY: -1 }), 90, checkInvariants); // column 2 is clear to the top wall
    expect(p.y).toBeCloseTo(PLAYER_TUNING.radius, 1);
    stepN(sim, makeInput({ moveX: -1 }), 90, checkInvariants); // rock at (1,0), inset 1 px
    expect(p.x).toBeCloseTo(2 * TILE - 1 + PLAYER_TUNING.radius, 1);
    // Pushing diagonally into the rock slides downward along its face instead of sticking.
    const y0 = p.y;
    stepN(sim, makeInput({ moveX: -0.7, moveY: 0.7 }), 20, checkInvariants);
    expect(p.y).toBeGreaterThan(y0 + 10);
  });

  it('pits block walking but not marbles', () => {
    const sim = makeSim();
    const p = sim.world.player;
    // Row 3 runs straight into the pit at columns 6-7 (lip inset 3.5 px).
    stepN(sim, makeInput({ moveX: 1 }), 120, checkInvariants);
    expect(p.x).toBeCloseTo(6 * TILE + 3.5 - PLAYER_TUNING.radius, 1);
    // Marbles fly over the pit and reach the dummy behind it.
    const st = stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 60);
    expect(st.events.hit).toBeGreaterThanOrEqual(1);
  });

  it('movement feels snappy: full speed in ~0.08-0.12 s, stops in ~0.1 s, short slide', () => {
    const sim = makeSim();
    const p = sim.world.player;
    const top = WREN.stats.moveSpeed;
    const speed = (): number => Math.hypot(p.vx, p.vy);
    // Open floor: walk down column 2 (clear to the bottom wall).
    let ticks = 0;
    while (speed() < top - 1e-6 && ticks < 60) {
      stepN(sim, makeInput({ moveY: 1 }), 1);
      ticks++;
    }
    const startTime = ticks / 60;
    expect(startTime).toBeGreaterThanOrEqual(0.07);
    expect(startTime).toBeLessThanOrEqual(0.12);
    // Not sluggish either: half speed within 3 ticks.
    const half = makeSim();
    stepN(half, makeInput({ moveY: 1 }), 3);
    expect(Math.hypot(half.world.player.vx, half.world.player.vy)).toBeGreaterThanOrEqual(top / 2);

    const y0 = p.y;
    ticks = 0;
    while (speed() > 1e-6 && ticks < 60) {
      stepN(sim, makeInput(), 1);
      ticks++;
    }
    const stopTime = ticks / 60;
    expect(stopTime).toBeGreaterThanOrEqual(0.08);
    expect(stopTime).toBeLessThanOrEqual(0.12);
    expect(p.y - y0).toBeLessThan(6); // short slide
  });

  it('analog stick magnitude sets the walking speed; diagonals are never faster', () => {
    const top = WREN.stats.moveSpeed;
    const analog = makeSim();
    stepN(analog, makeInput({ moveX: 0.5 }), 30);
    expect(analog.world.player.vx).toBeCloseTo(top * 0.5, 3);

    // Row 2 is open floor: walk diagonally (unnormalized input) away from everything.
    const diag = makeSim();
    diag.world.player.placeAt(40, 40);
    stepN(diag, makeInput({ moveX: 1, moveY: 1 }), 12);
    const p = diag.world.player;
    expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(top, 3);
    expect(p.vx).toBeCloseTo(p.vy, 5);
  });

  it('reversing direction is quicker than starting from rest (turn boost)', () => {
    const sim = makeSim();
    const p = sim.world.player;
    p.placeAt(100, 40); // row 2: open floor both ways
    stepN(sim, makeInput({ moveX: 1 }), 12);
    expect(p.vx).toBeCloseTo(WREN.stats.moveSpeed, 3);
    let ticks = 0;
    while (p.vx > 0 && ticks < 60) {
      stepN(sim, makeInput({ moveX: -1 }), 1);
      ticks++;
    }
    // Braking to zero under reverse input beats coasting to a stop.
    expect(ticks).toBeLessThanOrEqual(4);
  });

  it('marbles inherit some player velocity and alternate eyes', () => {
    const sim = makeSim();
    const input = makeInput({ moveY: 1 });
    stepN(sim, input, 10);
    input.aimX = 1;
    input.aimY = 0;
    input.firePressed = true;
    stepN(sim, input, 1);
    const m = sim.world.projectiles.items[0]!;
    expect(m.vx).toBeCloseTo(WREN.stats.shotSpeed, 3);
    expect(m.vy).toBeGreaterThan(10); // 25% of ~96 px/s downward
    const y1 = m.y - sim.world.player.y;
    input.fireHeld = true;
    stepN(sim, input, 20);
    const second = sim.world.projectiles.items[1]!;
    const y2 = second.y - sim.world.player.y;
    expect(Math.sign(y1)).not.toBe(Math.sign(y2));
  });

  it('is deterministic for the same seed and input script', () => {
    const run = (): string => {
      const sim = makeSim('same');
      const input = makeInput();
      for (let i = 0; i < 400; i++) {
        input.moveX = Math.sin(i * 0.05);
        input.moveY = Math.cos(i * 0.031);
        input.aimX = i % 120 < 60 ? 1 : 0;
        input.aimY = i % 120 < 60 ? 0 : -1;
        input.fireHeld = i % 90 < 70;
        stepN(sim, input, 1, checkInvariants);
      }
      return JSON.stringify(sim.summary());
    };
    expect(run()).toBe(run());
  });

  it('events emitted between ticks (debug hooks) reach the next drain exactly once', () => {
    const sim = makeSim();
    const st = stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), 21); // shots on ticks 1 and 21
    expect(st.events.shoot).toBe(2);
    sim.hurtPlayer(1);
    const a = stepN(sim, makeInput(), 1);
    expect(a.events.hurt).toBe(1);
    expect(a.events.shoot).toBeUndefined(); // last step's shot was already consumed
    const b = stepN(sim, makeInput(), 1);
    expect(b.events.hurt).toBeUndefined();
    sim.killPlayer();
    expect(stepN(sim, makeInput(), 1).events.death).toBe(1);
  });

  it('hurt and death debug hooks drive the player state', () => {
    const sim = makeSim();
    const p = sim.world.player;
    sim.hurtPlayer(1);
    expect(p.red).toBe(p.redMax - 1);
    expect(p.invuln).toBeGreaterThan(0);
    sim.hurtPlayer(1); // ignored during i-frames
    expect(p.red).toBe(p.redMax - 1);
    sim.killPlayer();
    expect(p.dead).toBe(true);
    const x = p.x;
    stepN(sim, makeInput({ moveX: 1, aimX: 1, fireHeld: true }), 30);
    expect(p.x).toBe(x);
    expect(sim.world.projectiles.count).toBe(0);
  });
});
