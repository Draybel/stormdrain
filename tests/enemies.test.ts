import { describe, expect, it } from 'vitest';
import { CHAPTERS, ENEMIES, enemiesInChapter } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { MOVES, ATTACKS, DEATHS } from '../src/sim/enemies/behaviors/index';
import { FlowField, UNREACHABLE } from '../src/sim/enemies/pathfield';
import { validateEnemyDef } from '../src/sim/enemies/validate';
import { TILE } from '../src/sim/constants';
import { parseRoomLayout, RoomGrid } from '../src/sim/room';
import { ATTACK_KINDS, DEATH_KINDS, MOVE_KINDS, type AttackSpec } from '../src/sim/types';
import { makeInput, makeSim, stepN } from './helpers/sim';
import { OBSTACLE_ROOM, OPEN_ROOM, WALL_ROOM, checkEnemyInvariants, godMode, testEnemy } from './helpers/enemies';

const GUTTER = [...ENEMIES.values()].filter((d) => d.chapters.includes('gutterways') && d.weight > 0);

describe('enemy definitions', () => {
  it('chapter 1 has its eight enemies, in its pool', () => {
    expect(GUTTER.map((d) => d.id).sort()).toEqual(
      ['drizzle-blob', 'grate-crab', 'grate-gazer', 'mudleech', 'puddle-toad', 'scurrier', 'sogwing', 'spitshell'].sort(),
    );
    expect(CHAPTERS.get('gutterways')!.enemyPool.length).toBe(8);
    expect(enemiesInChapter('gutterways').length).toBe(8);
  });

  it.each(GUTTER.map((d) => [d.id, d] as const))('%s is valid (sprite, known behaviours, sane params)', (_id, def) => {
    expect(validateEnemyDef(def, (id) => ENEMIES.has(id))).toEqual([]);
    expect(typeof def.sprite).not.toBe('string');
    const s = def.sprite as Exclude<typeof def.sprite, string>;
    // DESIGN: regular enemies are 10-18 px.
    expect(s.w).toBeGreaterThanOrEqual(10);
    expect(s.w).toBeLessThanOrEqual(18);
    expect(s.h).toBeGreaterThanOrEqual(8);
    expect(s.h).toBeLessThanOrEqual(18);
    expect(s.anims!.idle!.frames.length).toBeGreaterThanOrEqual(1);
    expect(s.anims!.move!.frames.length).toBeGreaterThanOrEqual(1);
    // Every frame uses the dark outline colour somewhere (readable silhouettes).
    for (const f of s.frames) expect(f.join('')).toContain('o');
    expect(MOVES[def.move.kind]).toBeDefined();
    for (const a of def.attacks) expect(ATTACKS[a.kind]).toBeDefined();
    expect(def.goo?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(def.bestiary.length).toBeLessThanOrEqual(110);
  });

  it('every chapter 1 enemy has a distinct movement + attack pattern and a distinct name', () => {
    const sig = GUTTER.map((d) => `${d.move.kind}|${d.attacks.map((a) => a.kind).join(',')}|${(d.onDeath ?? []).map((x) => x.kind).join(',')}`);
    expect(new Set(sig).size).toBe(GUTTER.length);
    expect(new Set(GUTTER.map((d) => d.name)).size).toBe(GUTTER.length);
  });

  it('the behaviour library covers every declared kind, each with sane param specs', () => {
    for (const k of MOVE_KINDS) expect(MOVES[k], k).toBeDefined();
    for (const k of ATTACK_KINDS) expect(ATTACKS[k], k).toBeDefined();
    for (const k of DEATH_KINDS) expect(DEATHS[k], k).toBeDefined();
    const specs = [...Object.values(MOVES), ...Object.values(ATTACKS), ...Object.values(DEATHS)].map((b) => b.params);
    for (const spec of specs) {
      for (const [name, [def, lo, hi]] of Object.entries(spec)) {
        expect(lo, name).toBeLessThanOrEqual(hi);
        expect(def, name).toBeGreaterThanOrEqual(lo);
        expect(def, name).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('validation catches bad defs', () => {
    const bad = {
      ...GUTTER[0]!,
      id: 'Bad_Id',
      hp: -1,
      move: { kind: 'hop' as const, params: { nope: 1, dist: 9999 } },
      attacks: [{ kind: 'spawnMinion' as const, cooldown: 0.01 }],
    };
    const errs = validateEnemyDef(bad, () => false).join('\n');
    expect(errs).toContain('kebab-case');
    expect(errs).toContain('hp=');
    expect(errs).toContain('unknown param "nope"');
    expect(errs).toContain('dist=9999');
    expect(errs).toContain('cooldown');
    expect(errs).toContain("needs a known 'enemy'");
  });

  it('content validation (enemies, champions, chapter 1) is clean', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('each enemy in a room with obstacles', () => {
  it.each(GUTTER.map((d) => [d.id] as const))('%s runs 10 s: no NaN, stays in bounds, never inside obstacles', (id) => {
    const sim = makeSim(`run-${id}`, { room: OBSTACLE_ROOM });
    godMode(sim);
    sim.world.player.placeAt(24, 88);
    const spots: [number, number][] = [
      [180, 24],
      [104, 56],
      [40, 104],
    ];
    for (const [x, y] of spots) expect(sim.spawnEnemy(id, x, y)).not.toBeNull();
    sim.spawnEnemy(id, 150, 90, { champion: 'swift' });
    const input = makeInput();
    let t = 0;
    const st = stepN(sim, input, 600, (s) => {
      t++;
      // Wren runs around (so movers chase / hop / dash all over the room) and shoots.
      input.moveX = Math.cos(t / 40);
      input.moveY = Math.sin(t / 27);
      input.aimX = t % 240 < 120 ? 1 : -1;
      input.aimY = 0;
      input.fireHeld = true;
      checkEnemyInvariants(s);
    });
    // Something happened: it moved, attacked or got shot.
    expect((st.events.enemyHit ?? 0) + (st.events.enemyShoot ?? 0) + (st.events.enemyHop ?? 0) + (st.events.enemyDash ?? 0) + (st.events.burrow ?? 0)).toBeGreaterThan(0);
  });

  it('every movement kind (and attack / death kind) runs 5 s cleanly', () => {
    const sim = makeSim('all-kinds', { room: OBSTACLE_ROOM });
    godMode(sim);
    sim.world.player.placeAt(100, 90);
    const minion = testEnemy('t-minion', { move: { kind: 'chase' }, hp: 4 });
    MOVE_KINDS.forEach((kind, i) => {
      const attacks: AttackSpec[] =
        i % 3 === 0
          ? [
              { kind: 'lob' as const, cooldown: 1, params: { creep: 1, split: 4, windup: 0.1 } },
              { kind: 'burst' as const, cooldown: 1.3, params: { count: 3 } },
            ]
          : i % 3 === 1
            ? [
                { kind: 'spawnMinion' as const, cooldown: 1, enemy: minion.id, params: { max: 2, windup: 0.1 } },
                { kind: 'leaveTrail' as const, cooldown: 0.3 },
                { kind: 'landShockwave' as const, cooldown: 0.5, params: { on: 0 } },
              ]
            : [
                { kind: 'cardinal4' as const, cooldown: 0.8 },
                { kind: 'spreadFan' as const, cooldown: 1.1, params: { accel: -40, curve: 1 } },
                { kind: 'aimedShot' as const, cooldown: 0.9, params: { phase: 1, lead: 1 } },
                { kind: 'ringN' as const, cooldown: 1.2, params: { spin: 20, aim: 1 } },
              ];
      const def = testEnemy(`t-${kind.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`, {
        move: { kind },
        attacks,
        flying: MOVES[kind].flying ?? false,
        onDeath: [
          { kind: 'ringN', params: { count: 6 } },
          { kind: 'split', params: { count: 2 } },
        ],
      });
      expect(validateEnemyDef(def, (id) => ENEMIES.has(id))).toEqual([]);
      sim.spawnEnemy(def.id, 20 + (i % 6) * 34, i < 6 ? 10 : 100);
    });
    const input = makeInput();
    let t = 0;
    stepN(sim, input, 300, (s) => {
      t++;
      input.moveX = Math.sin(t / 30);
      input.moveY = Math.cos(t / 45);
      checkEnemyInvariants(s);
    });
    // Kill everything (death effects: rings + splits) and keep running.
    sim.killEnemies();
    stepN(sim, input, 120, checkEnemyInvariants);
    expect(sim.world.counters.enemyShots).toBeGreaterThan(20);
    expect(sim.world.counters.kills).toBeGreaterThanOrEqual(MOVE_KINDS.length);
  });
});

describe('chasePath', () => {
  it('the shared flow field routes around a rock wall', () => {
    const grid = new RoomGrid();
    parseRoomLayout(WALL_ROOM, grid);
    const f = new FlowField();
    f.compute(grid, 1 * 13 + 10); // target at (10, 1)
    expect(f.dist[1 * 13 + 6]).toBe(UNREACHABLE); // the wall
    // From (2, 1) the path must go down to the gap at row 6 and back up: far longer than 8 steps.
    expect(f.dist[1 * 13 + 2]!).toBeGreaterThan(8 * 2);
    expect(f.dist[1 * 13 + 2]!).toBeLessThan(UNREACHABLE);
  });

  it('a path-finding rat reaches the player around a rock wall; a straight chaser stays stuck', () => {
    const run = (id: string): number => {
      const sim = makeSim('wall', { room: WALL_ROOM });
      godMode(sim);
      sim.world.player.placeAt(10 * TILE + 8, 1 * TILE + 8);
      const e = sim.spawnEnemy(id, 2 * TILE + 8, 1 * TILE + 8, { champion: false })!;
      let best = Infinity;
      stepN(sim, makeInput(), 480, (s) => {
        const p = s.world.player;
        best = Math.min(best, Math.hypot(e.x - p.x, e.y - p.y));
        checkEnemyInvariants(s);
      });
      return best;
    };
    const straight = testEnemy('t-straight-rat', { move: { kind: 'chase' }, speed: 62 });
    expect(run('scurrier')).toBeLessThan(12);
    expect(run(straight.id)).toBeGreaterThan(40);
  });
});

describe('determinism', () => {
  it('same seed + same input → identical waves and enemy positions', () => {
    const play = (): string => {
      const sim = makeSim('det-seed');
      godMode(sim);
      sim.startWave({ count: 6 });
      const input = makeInput({ moveX: 0.5, aimX: 1, fireHeld: true });
      stepN(sim, input, 400);
      return JSON.stringify(sim.summary().enemies) + sim.world.counters.enemyShots;
    };
    expect(play()).toBe(play());
  });
});

describe('caps and load', () => {
  it('a room full of enemies and shots stays within the caps, finite, and fast enough', () => {
    const sim = makeSim('load', { room: OPEN_ROOM });
    godMode(sim);
    const shooter = testEnemy('t-spammer', {
      move: { kind: 'float' },
      flying: true,
      attacks: [{ kind: 'ringN', cooldown: 0.2, params: { count: 24, windup: 0, speed: 40, life: 8 } }],
    });
    for (let i = 0; i < 80; i++) sim.spawnEnemy(shooter.id, 10 + (i % 13) * 16, 10 + Math.floor(i / 13) * 16, { champion: false });
    expect(sim.world.enemies.count).toBe(sim.world.enemies.capacity);
    const input = makeInput();
    stepN(sim, input, 60, checkEnemyInvariants);
    // Timing without the (slow) per-tick expect() checks.
    const t0 = performance.now();
    stepN(sim, input, 300);
    const ms = performance.now() - t0;
    checkEnemyInvariants(sim);
    expect(sim.world.enemyShots.count).toBeGreaterThan(360);
    expect(sim.world.enemyShots.refused).toBeGreaterThan(0);
    // 5 s of a maxed-out room (64 enemies, 400 shots): well under a frame per tick.
    expect(ms / 300).toBeLessThan(2);
  });
});
