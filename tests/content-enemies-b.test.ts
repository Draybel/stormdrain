/**
 * Chapters 4-6 enemies (content/enemies/{mushroom_hollow, glimmer_grotto, bone_orchard, frostbitten_vault,
 * eye_of_storm, hollow_nest}.ts) and the behaviour-library extension they use (behaviors/ext-b.ts:
 * intercept, swoop, lurk, stream).
 */

import { describe, expect, it } from 'vitest';
import { CHAPTERS, ENEMIES, enemiesInChapter } from '../src/content/registry';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { validateContent } from '../src/content/validate';
import { ATTACKS, MOVES } from '../src/sim/enemies/behaviors/index';
import type { Enemy } from '../src/sim/enemies/enemy';
import { validateEnemyDef } from '../src/sim/enemies/validate';
import { TILE } from '../src/sim/constants';
import type { Sim } from '../src/sim/sim';
import { ATTACK_KINDS, MOVE_KINDS, type AttackSpec, type EnemyDef, type SpriteDef } from '../src/sim/types';
import { makeInput, makeSim, stepN } from './helpers/sim';
import { OBSTACLE_ROOM, OPEN_ROOM, WALL_ROOM, checkEnemyInvariants, godMode, testEnemy } from './helpers/enemies';

/** Rolled enemies per chapter (weight > 0), and the minions that only appear through another enemy. */
const ROSTER: Record<string, string[]> = {
  mushroom_hollow: ['puffcap', 'glowcap', 'mossback-beetle', 'morelob'],
  glimmer_grotto: ['echo-bat', 'quartz-creeper', 'geode-tumbler'],
  bone_orchard: ['gravecaw', 'bonebark', 'gloam-lantern', 'rattlebones'],
  frostbitten_vault: ['rimechest', 'slushpup', 'rime-wraith'],
  eye_of_storm: ['grumblecloud', 'staticling', 'whirligust', 'stormkite'],
  hollow_nest: ['papercut', 'ambertomb', 'brood-comb', 'grubling'],
};
const MINIONS = ['glint-mite'];
const ROLLED = Object.values(ROSTER).flat();
const ALL = [...ROLLED, ...MINIONS];
const defOf = (id: string): EnemyDef => ENEMIES.get(id)!;

/** Chapter depth tiers (floors 7-8, 9-10, 11-12: main + alt share a tier). */
const TIERS: string[][] = [
  ['mushroom_hollow', 'glimmer_grotto'],
  ['bone_orchard', 'frostbitten_vault'],
  ['eye_of_storm', 'hollow_nest'],
];

const spriteMods = import.meta.glob<Record<string, unknown>>('../src/content/sprites/*.ts', { eager: true });
function spritesIn(filter: (file: string) => boolean): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const file of Object.keys(spriteMods).sort()) {
    if (!filter(file)) continue;
    for (const v of Object.values(spriteMods[file]!)) {
      if (typeof v === 'object' && v !== null && 'frames' in v && 'palette' in v) out.push(v as SpriteDef);
    }
  }
  return out;
}

/** Most shots one use of the def's attacks (or its death) puts in the air. */
function shotsPerVolley(d: EnemyDef): number {
  let best = 0;
  for (const a of d.attacks) {
    const p = a.params ?? {};
    let n = 0;
    switch (a.kind) {
      case 'aimedShot':
        n = p.count ?? 1;
        break;
      case 'cardinal4':
        n = 4;
        break;
      case 'ringN':
        n = p.count ?? 8;
        break;
      case 'spreadFan':
        n = p.count ?? 3;
        break;
      case 'burst':
        n = p.count ?? 3;
        break;
      case 'lob':
        n = (p.count ?? 1) * (1 + (p.split ?? 0));
        break;
      case 'stream':
        n = (p.count ?? 12) * (p.arms ?? 1);
        break;
      case 'landShockwave':
        n = 1;
        break;
      default:
        n = 0;
    }
    best = Math.max(best, n);
  }
  for (const dth of d.onDeath ?? []) if (dth.kind === 'ringN') best = Math.max(best, dth.params?.count ?? 8);
  return best;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

describe('chapters 4-6: enemy definitions', () => {
  it('22 new rolled enemies (4 / 3 / 4 / 3 / 4 / 4) are in their chapter pools; minions are not rolled', () => {
    expect(ROLLED.length).toBe(22);
    for (const [ch, ids] of Object.entries(ROSTER)) {
      expect(CHAPTERS.has(ch), ch).toBe(true);
      const pool = enemiesInChapter(ch).map((d) => d.id);
      for (const id of ids) {
        expect(pool, `${id} in ${ch}`).toContain(id);
        expect(defOf(id).chapters).toContain(ch);
        expect(defOf(id).weight).toBeGreaterThan(0);
      }
    }
    for (const id of MINIONS) {
      expect(defOf(id).weight).toBe(0);
      expect(defOf(id).championable).toBe(false);
      for (const ch of Object.keys(ROSTER)) expect(enemiesInChapter(ch).map((d) => d.id)).not.toContain(id);
    }
  });

  it.each(ALL.map((id) => [id] as const))('%s is valid (sprite, known behaviours, sane params)', (id) => {
    const def = defOf(id);
    expect(validateEnemyDef(def, (x) => ENEMIES.has(x))).toEqual([]);
    expect(typeof def.sprite).not.toBe('string');
    const s = def.sprite as SpriteDef;
    // DESIGN: regular enemies are 10-18 px.
    expect(s.w).toBeGreaterThanOrEqual(10);
    expect(s.w).toBeLessThanOrEqual(18);
    expect(s.h).toBeGreaterThanOrEqual(8);
    expect(s.h).toBeLessThanOrEqual(18);
    expect(s.anims!.idle!.frames.length).toBeGreaterThanOrEqual(1);
    expect(s.anims!.move!.frames.length).toBeGreaterThanOrEqual(1);
    // Something animates (idle or move has 2+ frames), and every frame has the dark outline.
    expect(Math.max(s.anims!.idle!.frames.length, s.anims!.move!.frames.length)).toBeGreaterThanOrEqual(2);
    for (const f of s.frames) expect(f.join('')).toContain('o');
    expect(MOVES[def.move.kind]).toBeDefined();
    for (const a of def.attacks) expect(ATTACKS[a.kind]).toBeDefined();
    expect(def.goo?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(def.bestiary.length).toBeLessThanOrEqual(110);
    // Every attack and sudden move is telegraphed: timer attacks have a wind-up.
    for (const a of def.attacks) {
      const p = a.params ?? {};
      if (ATTACKS[a.kind].passive || (p.on ?? 0) !== 0) continue;
      expect(p.windup ?? 0.35, `${id} ${a.kind} windup`).toBeGreaterThanOrEqual(0.25);
    }
  });

  it('within each chapter every enemy has a distinct movement + attack pattern; all names are distinct', () => {
    for (const ids of Object.values(ROSTER)) {
      const defs = ids.map(defOf);
      const sig = defs.map((d) => `${d.move.kind}|${d.attacks.map((a) => a.kind).join(',')}|${(d.onDeath ?? []).map((x) => x.kind).join(',')}`);
      expect(new Set(sig).size).toBe(defs.length);
    }
    const names = [...ENEMIES.values()].filter((d) => d.weight > 0 || MINIONS.includes(d.id)).map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every ext-b behaviour is registered and used by content', () => {
    for (const k of ['intercept', 'swoop', 'lurk'] as const) {
      expect(MOVE_KINDS).toContain(k);
      expect(MOVES[k]).toBeDefined();
      expect(ALL.some((id) => defOf(id).move.kind === k), k).toBe(true);
    }
    expect(ATTACK_KINDS).toContain('stream');
    expect(ALL.some((id) => defOf(id).attacks.some((a) => a.kind === 'stream'))).toBe(true);
  });

  it('later chapters are tougher: more HP and denser volleys per tier', () => {
    const tier = (chs: string[]) => chs.flatMap((c) => ROSTER[c]!).map(defOf);
    const hp = TIERS.map((t) => mean(tier(t).map((d) => d.hp)));
    const shots = TIERS.map((t) => mean(tier(t).map(shotsPerVolley)));
    for (let i = 1; i < TIERS.length; i++) {
      expect(hp[i]!, `hp tier ${i}`).toBeGreaterThan(hp[i - 1]!);
      expect(shots[i]!, `shots tier ${i}`).toBeGreaterThan(shots[i - 1]!);
    }
    // And all of it is well above chapter 1 (the Gutterways).
    const gutter = enemiesInChapter('gutterways');
    expect(hp[0]!).toBeGreaterThan(mean(gutter.map((d) => d.hp)) * 1.5);
  });

  it('their sprites are well-formed, with ids unique across every sprite module', () => {
    const mine = spritesIn((f) => /enemiesB[A-Z]\w*\.ts$/.test(f));
    expect(mine.length).toBeGreaterThanOrEqual(ALL.length);
    for (const s of mine) expect(validateSpriteDef(s), s.id).toEqual([]);
    const all = spritesIn(() => true).map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it('content validation is clean', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('chapters 4-6: each enemy in a room with obstacles', () => {
  it.each(ALL.map((id) => [id] as const))('%s runs 10 s: no NaN, stays in bounds, never inside obstacles', (id) => {
    const sim = makeSim(`run-b-${id}`, { room: OBSTACLE_ROOM });
    godMode(sim);
    sim.world.player.placeAt(24, 88);
    for (const [x, y] of [
      [180, 24],
      [104, 56],
      [40, 104],
    ] as const) {
      expect(sim.spawnEnemy(id, x, y)).not.toBeNull();
    }
    if (defOf(id).championable) sim.spawnEnemy(id, 150, 90, { champion: 'swift' });
    const input = makeInput();
    let t = 0;
    const st = stepN(sim, input, 600, (s) => {
      t++;
      // Wren runs around the whole room (so movers chase / dive / wake up) and shoots.
      input.moveX = Math.cos(t / 40);
      input.moveY = Math.sin(t / 27);
      input.aimX = t % 240 < 120 ? 1 : -1;
      input.aimY = 0;
      input.fireHeld = true;
      checkEnemyInvariants(s);
    });
    const ev = st.events;
    expect((ev.enemyHit ?? 0) + (ev.enemyShoot ?? 0) + (ev.enemyLob ?? 0) + (ev.enemyHop ?? 0) + (ev.enemyDash ?? 0) + (ev.burrow ?? 0)).toBeGreaterThan(0);
  });

  it.each(Object.keys(ROSTER).map((c) => [c] as const))('a %s wave runs 8 s cleanly; kills trigger splits / death rings safely', (ch) => {
    const sim = makeSim(`wave-b-${ch}`, { room: OBSTACLE_ROOM });
    godMode(sim);
    sim.world.player.placeAt(104, 56);
    expect(sim.startWave({ chapter: ch, count: 8 })).toBe(8);
    for (const e of sim.summary().enemies) expect(ROSTER[ch]).toContain(e.id);
    const input = makeInput();
    let t = 0;
    stepN(sim, input, 480, (s) => {
      t++;
      input.moveX = Math.sin(t / 35);
      input.moveY = Math.cos(t / 50);
      input.aimX = Math.cos(t / 20);
      input.aimY = Math.sin(t / 20);
      input.fireHeld = true;
      checkEnemyInvariants(s);
    });
    sim.killEnemies();
    stepN(sim, input, 120, checkEnemyInvariants);
  });

  it('the densest mix (every chapter 6 enemy ×2) stays within the caps and fast', () => {
    const sim = makeSim('dense-b', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(104, 56);
    const ids = [...ROSTER.eye_of_storm!, ...ROSTER.hollow_nest!];
    ids.forEach((id, i) => {
      sim.spawnEnemy(id, 16 + (i % 8) * 25, 16, { champion: false });
      sim.spawnEnemy(id, 16 + (i % 8) * 25, 96, { champion: false });
    });
    const input = makeInput();
    stepN(sim, input, 120, checkEnemyInvariants);
    const t0 = performance.now();
    stepN(sim, input, 600);
    const ms = performance.now() - t0;
    checkEnemyInvariants(sim);
    expect(sim.world.counters.enemyShots).toBeGreaterThan(200);
    expect(ms / 600).toBeLessThan(2);
  });
});

// ── ext-b behaviours ──────────────────────────────────────────────────────────

/** Steps and collects the events of one type. */
function eventsOf(sim: Sim, n: number, type: string, each?: () => void): { x: number; y: number; a: number; b: number; tick: number }[] {
  const out: { x: number; y: number; a: number; b: number; tick: number }[] = [];
  const input = makeInput();
  for (let i = 0; i < n; i++) {
    sim.step(input);
    const q = sim.events;
    for (let k = 0; k < q.count; k++) {
      const e = q.at(k);
      if (e.type === type) out.push({ x: e.x, y: e.y, a: e.a, b: e.b, tick: i });
    }
    each?.();
  }
  return out;
}

function ready(sim: Sim, id: string, x: number, y: number): Enemy {
  const e = sim.spawnEnemy(id, x, y, { champion: false })!;
  e.spawnT = 0;
  return e;
}

describe('ext-b: stream', () => {
  const streamer = (id: string, params: AttackSpec['params']): string =>
    testEnemy(id, {
      move: { kind: 'turret' },
      hp: 500,
      contact: 0,
      attacks: [{ kind: 'stream', cooldown: 20, params: { windup: 0, first: 0, speed: 60, ...params } }],
    }).id;

  it('fires count × arms shots over count × interval, the arms evenly spaced, each step turned', () => {
    const sim = makeSim('stream', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(190, 100);
    const id = streamer('t-stream-spiral', { count: 6, arms: 2, turn: 20, interval: 0.1 });
    ready(sim, id, 104, 56);
    const shots = sim.world.enemyShots;
    const angles: number[][] = [];
    let seen = 0;
    for (let tick = 0; tick < 60; tick++) {
      sim.step(makeInput());
      if (shots.count > seen) {
        // New shots are appended at the end of the pool.
        const step: number[] = [];
        for (let i = seen; i < shots.count; i++) step.push(Math.atan2(shots.items[i]!.vy, shots.items[i]!.vx));
        angles.push(step);
        seen = shots.count;
      }
    }
    expect(sim.world.counters.enemyShots).toBe(12);
    expect(angles.length).toBe(6);
    const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
    for (const step of angles) {
      expect(step.length).toBe(2);
      expect(Math.abs(wrap(step[1]! - step[0]!))).toBeCloseTo(Math.PI, 5);
    }
    for (let i = 1; i < angles.length; i++) expect(wrap(angles[i]![0]! - angles[i - 1]![0]!)).toBeCloseTo((20 * Math.PI) / 180, 5);
  });

  it('aim = 1 centres the sweep on the target', () => {
    const sim = makeSim('stream-aim', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(190, 56);
    const id = streamer('t-stream-sweep', { count: 5, arms: 1, turn: 15, interval: 0.1, aim: 1 });
    ready(sim, id, 60, 56);
    stepN(sim, makeInput(), 40);
    const shots = sim.world.enemyShots;
    expect(shots.count).toBe(5);
    const dirs = [...Array(5).keys()].map((i) => (Math.atan2(shots.items[i]!.vy, shots.items[i]!.vx) * 180) / Math.PI);
    expect(dirs[2]!).toBeCloseTo(0, 3); // the middle shot flies straight at her
    expect(dirs[0]!).toBeCloseTo(-30, 3);
    expect(dirs[4]!).toBeCloseTo(30, 3);
  });

  it('freezing the streamer stops the stream', () => {
    const sim = makeSim('stream-freeze', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(190, 100);
    const id = streamer('t-stream-long', { count: 30, arms: 1, turn: 10, interval: 0.1 });
    const e = ready(sim, id, 104, 56);
    stepN(sim, makeInput(), 20);
    const n = sim.world.counters.enemyShots;
    expect(n).toBeGreaterThan(0);
    e.applyStatus('freeze', 3, 0, 1);
    stepN(sim, makeInput(), 120);
    expect(sim.world.counters.enemyShots).toBe(n);
  });
});

describe('ext-b: intercept', () => {
  /** First tick at which the enemy touches Wren as she runs right along the bottom of the room. */
  const catchTick = (move: EnemyDef['move'], id: string, flying: boolean): number => {
    testEnemy(id, { move, speed: 70, flying, hp: 500, contact: 0 });
    const sim = makeSim('intercept', { room: OPEN_ROOM });
    godMode(sim);
    const p = sim.world.player;
    p.placeAt(20, 100);
    const e = ready(sim, id, 150, 16);
    const input = makeInput({ moveX: 1 });
    for (let t = 0; t < 180; t++) {
      sim.step(input);
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r) return t;
    }
    return 999;
  };

  it('cuts a running player off sooner than a plain chaser', () => {
    const lead = catchTick({ kind: 'intercept', params: { lead: 1, weave: 0 } }, 't-intercept-fly', true);
    const plain = catchTick({ kind: 'chase' }, 't-chase-fly', true);
    expect(lead).toBeLessThan(999);
    expect(lead).toBeLessThan(plain);
  });

  it('a walking interceptor path-finds around a rock wall', () => {
    testEnemy('t-intercept-walk', { move: { kind: 'intercept' }, speed: 62, hp: 500 });
    const sim = makeSim('intercept-wall', { room: WALL_ROOM });
    godMode(sim);
    const p = sim.world.player;
    p.placeAt(10 * TILE + 8, 1 * TILE + 8);
    const e = ready(sim, 't-intercept-walk', 2 * TILE + 8, 1 * TILE + 8);
    let best = Infinity;
    stepN(sim, makeInput(), 480, (s) => {
      best = Math.min(best, Math.hypot(e.x - p.x, e.y - p.y));
      checkEnemyInvariants(s);
    });
    expect(best).toBeLessThan(14);
  });
});

describe('ext-b: swoop', () => {
  it('circles, hovers (telegraph), dives straight through her spot and out past it, then fires its dive-end attacks', () => {
    testEnemy('t-swoop', {
      move: { kind: 'swoop', params: { radius: 50, every: 1, windup: 0.4, diveSpeed: 200, over: 40 } },
      flying: true,
      speed: 60,
      hp: 500,
      contact: 0,
      attacks: [{ kind: 'spreadFan', cooldown: 0.2, params: { on: 4, windup: 0, count: 3 } }],
    });
    const sim = makeSim('swoop', { room: OPEN_ROOM });
    godMode(sim);
    const p = sim.world.player;
    p.placeAt(104, 56);
    const e = ready(sim, 't-swoop', 40, 56);
    const q = sim.events;
    let windup = -1;
    let dive = -1;
    let shot = -1;
    let closest = Infinity;
    let fastest = 0;
    for (let t = 0; t < 240 && shot < 0; t++) {
      sim.step(makeInput());
      for (let k = 0; k < q.count; k++) {
        const ev = q.at(k);
        if (ev.type === 'enemyWindup' && windup < 0) windup = t;
        if (ev.type === 'enemyDash' && dive < 0) dive = t;
        if (ev.type === 'enemyShoot' && dive >= 0) shot = t;
      }
      if (dive >= 0) {
        closest = Math.min(closest, Math.hypot(e.x - p.x, e.y - p.y));
        fastest = Math.max(fastest, Math.hypot(e.vx, e.vy));
      }
      checkEnemyInvariants(sim);
    }
    expect(windup).toBeGreaterThanOrEqual(0);
    expect(dive - windup).toBeGreaterThanOrEqual(Math.floor(0.4 * 60) - 1); // the hover is the telegraph
    expect(closest).toBeLessThan(6); // straight through her spot
    expect(fastest).toBeCloseTo(200, 0);
    expect(shot).toBeGreaterThan(dive);
    // …and it is circling again afterwards (not stuck on a wall).
    const x0 = e.x;
    const y0 = e.y;
    stepN(sim, makeInput(), 30, checkEnemyInvariants);
    expect(Math.hypot(e.x - x0, e.y - y0)).toBeGreaterThan(5);
  });
});

describe('ext-b: lurk', () => {
  const lurker = (id: string, params: Record<string, number>): string =>
    testEnemy(id, {
      move: { kind: 'lurk', params },
      speed: 60,
      hp: 200,
      contact: 1,
      attacks: [{ kind: 'aimedShot', cooldown: 0.5, params: { windup: 0.2, first: 0 } }],
    }).id;

  it('sleeps (no moves, no shots) until she comes close, then rouses, hunts and shoots', () => {
    const sim = makeSim('lurk', { room: OPEN_ROOM });
    godMode(sim);
    const p = sim.world.player;
    p.placeAt(20, 20);
    const e = ready(sim, lurker('t-lurk', { wake: 40, rouse: 0.5 }), 180, 90);
    const wakes = eventsOf(sim, 300, 'enemyWindup');
    expect(wakes.length).toBe(0);
    expect(sim.world.counters.enemyShots).toBe(0);
    expect(e.x).toBeCloseTo(180, 5);
    expect(e.y).toBeCloseTo(90, 5);
    // Walk up to it.
    p.placeAt(150, 90);
    const woke = eventsOf(sim, 30, 'enemyWindup');
    expect(woke.length).toBe(1);
    // Rousing (0.5 s): still harmless; afterwards it closes in and its first shot is ≥ 0.5 s away.
    const shotsAtWake = sim.world.counters.enemyShots;
    p.placeAt(40, 20);
    const d0 = Math.hypot(e.x - p.x, e.y - p.y);
    stepN(sim, makeInput(), 24);
    expect(sim.world.counters.enemyShots).toBe(shotsAtWake);
    stepN(sim, makeInput(), 90, checkEnemyInvariants);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(d0 - 30);
    expect(sim.world.counters.enemyShots).toBeGreaterThan(shotsAtWake);
  });

  it('a shot wakes it from across the room; patience wakes it on its own', () => {
    const sim = makeSim('lurk-poke', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(20, 20);
    const a = ready(sim, lurker('t-lurk-a', { wake: 20 }), 180, 90);
    stepN(sim, makeInput(), 30);
    expect(a.mode).toBe(0);
    a.hurt(1, 1, 0, 0);
    expect(eventsOf(sim, 10, 'enemyWindup').length).toBe(1);
    const b = ready(sim, lurker('t-lurk-b', { wake: 20, patience: 1 }), 180, 20);
    stepN(sim, makeInput(), 50);
    expect(b.mode).toBe(0);
    stepN(sim, makeInput(), 20);
    expect(b.mode).toBeGreaterThan(0);
  });

  it('the Rimechest plays dead until Wren walks up to it', () => {
    const sim = makeSim('rimechest', { room: OPEN_ROOM });
    godMode(sim);
    const p = sim.world.player;
    p.placeAt(20, 56);
    const e = ready(sim, 'rimechest', 180, 56);
    stepN(sim, makeInput(), 240);
    expect(sim.world.counters.enemyShots).toBe(0);
    expect(e.x).toBeCloseTo(180, 5);
    // Wren walks right until it wakes.
    let woke = -1;
    const input = makeInput({ moveX: 1 });
    for (let t = 0; t < 180 && woke < 0; t++) {
      sim.step(input);
      if (e.mode > 0) woke = t;
    }
    expect(woke).toBeGreaterThanOrEqual(0);
    expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeLessThan(defOf('rimechest').move.params!.wake! + 4);
  });
});
