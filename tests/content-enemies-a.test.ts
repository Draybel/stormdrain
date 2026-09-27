/**
 * Enemy content A: the Drowned Nursery, Rootcellar, Candlewick Crypt, Grinding Works and Rust Foundry
 * rosters (+ the cross-chapter Dust Bunny and Lost Balloon) and the behaviours they brought along
 * (src/sim/enemies/behaviors/ext-a.ts: bounce, lurk, spiral).
 *
 * Counts are taken from this area's own files (other content may add enemies to the same chapters).
 */

import { describe, expect, it } from 'vitest';
import crypt from '../src/content/enemies/candlewick_crypt';
import nursery from '../src/content/enemies/drowned_nursery';
import works from '../src/content/enemies/grinding_works';
import rootcellar from '../src/content/enemies/rootcellar';
import foundry from '../src/content/enemies/rust_foundry';
import { ENEMIES, enemiesInChapter } from '../src/content/registry';
import * as spritesCrypt from '../src/content/sprites/enemiesACrypt';
import * as spritesFoundry from '../src/content/sprites/enemiesAFoundry';
import * as spritesNursery from '../src/content/sprites/enemiesANursery';
import * as spritesRoot from '../src/content/sprites/enemiesARoot';
import * as spritesWorks from '../src/content/sprites/enemiesAWorks';
import * as gutterSprites from '../src/content/sprites/gutterEnemies';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { validateContent } from '../src/content/validate';
import { ATTACKS, MOVES } from '../src/sim/enemies/behaviors/index';
import type { Enemy } from '../src/sim/enemies/enemy';
import { validateEnemyDef } from '../src/sim/enemies/validate';
import { SRC_PLAYER } from '../src/sim/hittable';
import type { AttackSpec, EnemyDef, SpriteDef } from '../src/sim/types';
import { OBSTACLE_ROOM, OPEN_ROOM, checkEnemyInvariants, godMode, testEnemy } from './helpers/enemies';
import { makeInput, makeSim, stepN } from './helpers/sim';

const OWN = ['drowned_nursery', 'rootcellar', 'candlewick_crypt', 'grinding_works', 'rust_foundry'] as const;
type OwnChapter = (typeof OWN)[number];
/** Chapter depth: 1 = floors 1-2, 2 = floors 3-4, 3 = floors 5-6. */
const TIER: Record<OwnChapter, number> = {
  drowned_nursery: 1,
  rootcellar: 2,
  candlewick_crypt: 2,
  grinding_works: 3,
  rust_foundry: 3,
};

const ALL: readonly EnemyDef[] = [...nursery, ...rootcellar, ...crypt, ...works, ...foundry];
const CROSS = ALL.filter((d) => d.chapters.length > 1);
const native = (ch: OwnChapter): EnemyDef[] => ALL.filter((d) => d.chapters.length === 1 && d.chapters[0] === ch);
const inChapter = (ch: OwnChapter): EnemyDef[] => ALL.filter((d) => d.chapters.includes(ch));
const signature = (d: EnemyDef): string =>
  `${d.move.kind}|${d.attacks.map((a) => a.kind).join(',')}|${(d.onDeath ?? []).map((x) => x.kind).join(',')}`;

function spriteDefsIn(mod: Record<string, unknown>): SpriteDef[] {
  return Object.values(mod).filter(
    (v): v is SpriteDef => typeof v === 'object' && v !== null && 'frames' in v && 'palette' in v,
  );
}

/** Most projectiles a single use of an attack puts in the air. */
function shotsPerUse(a: AttackSpec): number {
  const p = a.params ?? {};
  switch (a.kind) {
    case 'cardinal4':
      return 4;
    case 'spiral':
      return (p.count ?? 10) * (p.arms ?? 1);
    case 'lob':
      return (p.count ?? 1) * Math.max(1, p.split ?? 0);
    case 'ringN':
      return p.count ?? 8;
    case 'spreadFan':
    case 'burst':
      return p.count ?? 3;
    case 'aimedShot':
      return p.count ?? 1;
    default:
      return 0;
  }
}

describe('enemy content A: the roster', () => {
  it('has 21 chapter enemies (4 / 5 / 4 / 4 / 4) plus 2 cross-chapter ones, all registered', () => {
    expect(native('drowned_nursery')).toHaveLength(4);
    expect(native('rootcellar')).toHaveLength(5);
    expect(native('candlewick_crypt')).toHaveLength(4);
    expect(native('grinding_works')).toHaveLength(4);
    expect(native('rust_foundry')).toHaveLength(4);
    expect(CROSS.map((d) => d.id).sort()).toEqual(['dust-bunny', 'lost-balloon']);
    for (const d of CROSS) expect(d.chapters.length).toBeGreaterThanOrEqual(3);
    expect(ALL).toHaveLength(23);
    expect(new Set(ALL.map((d) => d.id)).size).toBe(ALL.length);
    for (const d of ALL) expect(ENEMIES.get(d.id)).toBe(d);
  });

  it.each(ALL.map((d) => [d.id, d] as const))('%s is valid, enemy-sized and well dressed', (_id, def) => {
    expect(validateEnemyDef(def, (id) => ENEMIES.has(id))).toEqual([]);
    const s = def.sprite as SpriteDef;
    expect(typeof def.sprite).not.toBe('string');
    // DESIGN: regular enemies are 10-18 px.
    expect(s.w).toBeGreaterThanOrEqual(10);
    expect(s.w).toBeLessThanOrEqual(18);
    expect(s.h).toBeGreaterThanOrEqual(8);
    expect(s.h).toBeLessThanOrEqual(18);
    expect(s.anims!.idle!.frames.length).toBeGreaterThanOrEqual(1);
    expect(s.anims!.move!.frames.length).toBeGreaterThanOrEqual(1);
    // At least two distinct frames (something animates) and the dark outline on every frame.
    expect(new Set(s.frames.map((f) => f.join('|'))).size).toBeGreaterThanOrEqual(2);
    for (const f of s.frames) expect(f.join('')).toContain('o');
    // Anything with a wind-up telegraph gets a dedicated wind-up pose.
    const telegraphs = def.attacks.some((a) => (a.params?.windup ?? ATTACKS[a.kind].params.windup![0]) > 0);
    if (telegraphs || ['hop', 'dash', 'lurk', 'burrow'].includes(def.move.kind)) expect(s.anims!.windup ?? s.anims!.air).toBeDefined();
    if (def.move.kind === 'hop') expect(s.anims!.air).toBeDefined();
    expect(def.goo?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(def.bestiary.length).toBeGreaterThanOrEqual(20);
    expect(def.bestiary.length).toBeLessThanOrEqual(110);
    expect(def.weight).toBeGreaterThan(0);
    for (const ch of def.chapters) expect(OWN).toContain(ch);
    expect(MOVES[def.move.kind]).toBeDefined();
    // Flying movers must be flagged as flyers (and orbiting moths are flagged too).
    if (MOVES[def.move.kind].flying) expect(def.flying).toBe(true);
  });

  it('names are unique across every enemy in the game', () => {
    const names = [...ENEMIES.values()].map((d) => d.name.toLowerCase());
    for (const d of ALL) expect(names.filter((n) => n === d.name.toLowerCase())).toHaveLength(1);
  });

  it('every enemy is in the pool of each chapter it lists', () => {
    for (const d of ALL) for (const ch of d.chapters) expect(enemiesInChapter(ch)).toContain(d);
  });

  it.each(OWN.map((ch) => [ch] as const))('%s: every enemy has its own movement and attack pattern', (ch) => {
    const defs = inChapter(ch);
    expect(new Set(defs.map(signature)).size).toBe(defs.length);
    expect(new Set(defs.map((d) => d.move.kind)).size).toBe(defs.length);
    expect(new Set(defs.map((d) => d.name)).size).toBe(defs.length);
  });

  it('is tuned to chapter depth: tougher, harder-hitting and busier further down', () => {
    const avgHp = (tier: number): number => {
      const defs = OWN.filter((ch) => TIER[ch] === tier).flatMap(native);
      return defs.reduce((a, d) => a + d.hp, 0) / defs.length;
    };
    expect(avgHp(1)).toBeLessThan(avgHp(2));
    expect(avgHp(2)).toBeLessThan(avgHp(3));
    const tier = (t: number): EnemyDef[] => OWN.filter((ch) => TIER[ch] === t).flatMap(native);
    // Chapter 1 hits for half a heart; chapter 3 has the full-heart bruisers.
    for (const d of tier(1)) {
      expect(d.contact).toBe(1);
      for (const a of d.attacks) expect(a.params?.dmg ?? 1).toBe(1);
    }
    expect(Math.max(...tier(3).map((d) => d.contact))).toBe(2);
    const busiest = (t: number): number => Math.max(...tier(t).flatMap((d) => d.attacks.map(shotsPerUse)));
    expect(busiest(3)).toBeGreaterThan(busiest(1));
    expect(Math.min(...tier(3).map((d) => d.hp))).toBeGreaterThan(Math.min(...tier(1).map((d) => d.hp)));
  });

  it('sprites are well-formed with unique ids', () => {
    const mine = [spritesNursery, spritesRoot, spritesCrypt, spritesWorks, spritesFoundry].flatMap((m) =>
      spriteDefsIn(m as Record<string, unknown>),
    );
    expect(mine).toHaveLength(ALL.length);
    for (const s of mine) expect(validateSpriteDef(s), s.id).toEqual([]);
    const ids = [...mine, ...spriteDefsIn(gutterSprites as Record<string, unknown>)].map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('content validation stays clean', () => {
    expect(validateContent()).toEqual([]);
  });
});

describe('enemy content A: each enemy in a room with obstacles', () => {
  it.each(ALL.map((d) => [d.id] as const))('%s runs 10 s: no NaN, stays in bounds, never inside obstacles', (id) => {
    const sim = makeSim(`run-a-${id}`, { room: OBSTACLE_ROOM });
    godMode(sim);
    sim.world.player.placeAt(24, 88);
    for (const [x, y] of [
      [180, 24],
      [104, 56],
      [40, 104],
    ] as const) {
      expect(sim.spawnEnemy(id, x, y)).not.toBeNull();
    }
    sim.spawnEnemy(id, 150, 90, { champion: 'swift' });
    const input = makeInput();
    let t = 0;
    const st = stepN(sim, input, 600, (s) => {
      t++;
      // Wren runs all over the room (waking lurkers, drawing chasers) and keeps shooting.
      input.moveX = Math.cos(t / 40);
      input.moveY = Math.sin(t / 27);
      input.aimX = t % 240 < 120 ? 1 : -1;
      input.aimY = 0;
      input.fireHeld = true;
      checkEnemyInvariants(s);
    });
    const ev = st.events;
    expect((ev.enemyHit ?? 0) + (ev.enemyShoot ?? 0) + (ev.enemyLob ?? 0) + (ev.enemyHop ?? 0) + (ev.enemyDash ?? 0)).toBeGreaterThan(0);
  });
});

describe('enemy content A: deaths', () => {
  function fresh(id: string, seed: string): { sim: ReturnType<typeof makeSim>; e: Enemy } {
    const sim = makeSim(seed, { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(20, 20);
    const e = sim.spawnEnemy(id, 150, 60, { champion: false })!;
    stepN(sim, makeInput(), 30);
    return { sim, e };
  }
  const count = (sim: ReturnType<typeof makeSim>, id: string): number => sim.summary().enemies.filter((x) => x.id === id).length;

  it('a Brine Jar breaks into two Gherklings', () => {
    const { sim, e } = fresh('brine-jar', 'jar');
    e.hurt(9999, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), 1);
    expect(count(sim, 'brine-jar')).toBe(0);
    expect(count(sim, 'gherkling')).toBe(2);
  });

  it('a Lost Balloon pops into a ring of eight droplets', () => {
    const { sim, e } = fresh('lost-balloon', 'pop');
    const before = sim.world.counters.enemyShots;
    e.hurt(9999, SRC_PLAYER, 0, 0);
    expect(sim.world.counters.enemyShots - before).toBe(8);
  });

  it('a Dust Bunny splits once into two smaller bunnies', () => {
    const { sim, e } = fresh('dust-bunny', 'fluff');
    e.hurt(9999, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), 1);
    const kids = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((x) => !x.dead);
    expect(kids).toHaveLength(2);
    for (const k of kids) expect(k.scale).toBeLessThan(1);
    for (const k of kids) k.hurt(9999, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), 1);
    expect(sim.world.enemies.count).toBe(0);
  });
});

describe('enemy content A: waves', () => {
  it.each(OWN.map((ch) => [ch] as const))('a %s wave draws from its pool, plays out cleanly and deterministically', (ch) => {
    const play = (): string => {
      const sim = makeSim(`wave-a-${ch}`, { room: OBSTACLE_ROOM });
      godMode(sim);
      sim.world.player.placeAt(24, 56);
      expect(sim.startWave({ chapter: ch, count: 8 })).toBeGreaterThan(0);
      const pool = new Set(enemiesInChapter(ch).map((d) => d.id));
      for (const e of sim.summary().enemies) expect(pool.has(e.id)).toBe(true);
      const input = makeInput();
      let t = 0;
      stepN(sim, input, 480, (s) => {
        t++;
        input.moveX = Math.cos(t / 33);
        input.moveY = Math.sin(t / 21);
        input.aimX = t % 180 < 90 ? 1 : -1;
        input.fireHeld = true;
        checkEnemyInvariants(s);
      });
      return JSON.stringify(sim.summary().enemies) + sim.world.counters.enemyShots;
    };
    expect(play()).toBe(play());
  });
});

// ── The behaviours of ext-a ─────────────────────────────────────────────────

describe('bounce (ricochets / patrols)', () => {
  it('a diagonal bouncer holds its speed and diagonal heading, ricochets and fires its on:4 attacks', () => {
    const sim = makeSim('bounce-diag', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(16, 16);
    testEnemy('t-a-bounce', {
      move: { kind: 'bounce', params: { axis: 0, seek: 0 } },
      speed: 80,
      contact: 0,
      attacks: [{ kind: 'ringN', cooldown: 0.1, params: { on: 4, windup: 0, count: 4 } }],
    });
    const e = sim.spawnEnemy('t-a-bounce', 104, 56, { champion: false })!;
    let flipsX = 0;
    let flipsY = 0;
    let dx = e.dirX;
    let dy = e.dirY;
    let path = 0;
    const input = makeInput();
    stepN(sim, input, 30); // spawn protection
    const st = stepN(sim, input, 900, (s) => {
      checkEnemyInvariants(s);
      expect(Math.abs(Math.abs(e.dirX) - Math.SQRT1_2)).toBeLessThan(1e-9);
      expect(Math.abs(Math.abs(e.dirY) - Math.SQRT1_2)).toBeLessThan(1e-9);
      if (Math.sign(e.dirX) !== Math.sign(dx)) flipsX++;
      if (Math.sign(e.dirY) !== Math.sign(dy)) flipsY++;
      dx = e.dirX;
      dy = e.dirY;
      path += Math.hypot(e.x - e.prevX, e.y - e.prevY);
    });
    expect(flipsX).toBeGreaterThanOrEqual(2);
    expect(flipsY).toBeGreaterThanOrEqual(3);
    // Loses at most a little distance on each ricochet.
    expect(path / 15).toBeGreaterThan(80 * 0.9);
    expect(path / 15).toBeLessThan(80 * 1.05);
    expect(st.events.enemyShoot ?? 0).toBeGreaterThanOrEqual(flipsX + flipsY - 2);
  });

  it('axis 1 patrols a row back and forth; axis 2 a column', () => {
    for (const axis of [1, 2]) {
      const sim = makeSim(`bounce-axis-${axis}`, { room: OPEN_ROOM });
      godMode(sim);
      sim.world.player.placeAt(16, 16);
      testEnemy(`t-a-patrol-${axis}`, { move: { kind: 'bounce', params: { axis } }, speed: 70, contact: 0 });
      const e = sim.spawnEnemy(`t-a-patrol-${axis}`, 104, 56, { champion: false })!;
      let lo = Infinity;
      let hi = -Infinity;
      stepN(sim, makeInput(), 480, (s) => {
        checkEnemyInvariants(s);
        const along = axis === 1 ? e.x : e.y;
        const across = axis === 1 ? e.y : e.x;
        expect(Math.abs(across - (axis === 1 ? 56 : 104))).toBeLessThan(0.5);
        lo = Math.min(lo, along);
        hi = Math.max(hi, along);
      });
      // Reached (near) both walls.
      expect(lo).toBeLessThan(10);
      expect(hi).toBeGreaterThan((axis === 1 ? 208 : 112) - 10);
    }
  });

  it('a re-winding bouncer stops and telegraphs after each ricochet', () => {
    const sim = makeSim('bounce-pause', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(16, 16);
    testEnemy('t-a-rewind', { move: { kind: 'bounce', params: { axis: 1, pause: 0.5 } }, speed: 90, contact: 0 });
    const e = sim.spawnEnemy('t-a-rewind', 104, 56, { champion: false })!;
    let stoppedWinding = 0;
    const st = stepN(sim, makeInput(), 360, () => {
      if (e.teleT > 0 && Math.hypot(e.x - e.prevX, e.y - e.prevY) < 0.01) stoppedWinding++;
    });
    expect(st.events.enemyWindup ?? 0).toBeGreaterThanOrEqual(1);
    expect(stoppedWinding).toBeGreaterThan(20);
  });
});

describe('lurk (ambushers)', () => {
  const LURKER = 't-a-lurk';
  function lurkSim(seed: string): { sim: ReturnType<typeof makeSim>; e: Enemy } {
    const sim = makeSim(seed, { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(20, 56);
    testEnemy(LURKER, {
      move: { kind: 'lurk', params: { wake: 50, rouse: 0.5 } },
      speed: 50,
      hp: 500,
      attacks: [
        { kind: 'ringN', cooldown: 0.5, params: { on: 3, windup: 0, count: 6 } },
        { kind: 'aimedShot', cooldown: 0.4, params: { windup: 0.1 } },
      ],
    });
    const e = sim.spawnEnemy(LURKER, 180, 56, { champion: false })!;
    return { sim, e };
  }

  it('plays dead (no moves, no timer attacks) until you come close, then rouses, bursts and chases', () => {
    const { sim, e } = lurkSim('lurk-near');
    const input = makeInput();
    stepN(sim, input, 180, checkEnemyInvariants);
    expect(e.x).toBeCloseTo(180, 5);
    expect(sim.world.counters.enemyShots).toBe(0);
    const p = sim.world.player;
    input.moveX = 1;
    let t = 0;
    let woke = -1;
    let firstShot = -1;
    stepN(sim, input, 240, (s) => {
      t++;
      if (p.x > 138) input.moveX = 0;
      if (woke < 0 && e.teleT > 0) woke = t;
      if (firstShot < 0 && s.world.counters.enemyShots > 0) firstShot = t;
      checkEnemyInvariants(s);
    });
    expect(woke).toBeGreaterThan(0);
    // The rouse telegraph (0.5 s) comes before anything is fired; then the wake-up ring.
    expect(firstShot - woke).toBeGreaterThanOrEqual(28);
    expect(sim.world.counters.enemyShots).toBeGreaterThanOrEqual(6);
    expect(e.x).toBeLessThan(168);
  });

  it('wakes up when shot from afar', () => {
    const { sim, e } = lurkSim('lurk-shot');
    const input = makeInput({ aimX: 1, fireHeld: true });
    let t = 0;
    let woke = -1;
    stepN(sim, input, 300, () => {
      t++;
      if (woke < 0 && e.teleT > 0) woke = t;
    });
    expect(e.hp).toBeLessThan(500);
    expect(woke).toBeGreaterThan(0);
    expect(Math.hypot(e.x - 180, e.y - 56)).toBeGreaterThan(8);
  });
});

describe('spiral (rotating / sweeping streams)', () => {
  function firedAngles(seed: string, params: Record<string, number>): { angles: number[]; aim: number } {
    const sim = makeSim(seed, { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(24, 56);
    const id = `t-a-spiral-${seed}`;
    testEnemy(id, {
      move: { kind: 'turret' },
      contact: 0,
      attacks: [{ kind: 'spiral', cooldown: 30, params: { first: 0.1, windup: 0.2, speed: 20, life: 8, ...params } }],
    });
    const e = sim.spawnEnemy(id, 150, 56, { champion: false })!;
    stepN(sim, makeInput(), 110, checkEnemyInvariants);
    const shots = sim.world.enemyShots;
    const angles: number[] = [];
    for (let i = 0; i < shots.count; i++) angles.push(Math.atan2(shots.items[i]!.vy, shots.items[i]!.vx));
    return { angles, aim: Math.atan2(56 - e.y, 24 - e.x) };
  }
  const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

  it('a sprinkler fires count × arms shots, arms evenly spaced, turning by ≈ spin × interval each shot', () => {
    const { angles } = firedAngles('sprinkler', { count: 6, interval: 0.1, arms: 2, spin: 120 });
    expect(angles).toHaveLength(12);
    const step = (120 * 0.1 * Math.PI) / 180;
    for (let i = 0; i < 12; i += 2) expect(Math.abs(wrap(angles[i + 1]! - angles[i]!))).toBeCloseTo(Math.PI, 6);
    for (let i = 2; i < 12; i += 2) {
      const d = wrap(angles[i]! - angles[i - 2]!);
      expect(d).toBeGreaterThan(step * 0.8);
      expect(d).toBeLessThan(step * 1.4);
    }
  });

  it('a negative spin turns the other way', () => {
    const { angles } = firedAngles('widdershins', { count: 5, interval: 0.1, arms: 1, spin: -200 });
    expect(angles).toHaveLength(5);
    for (let i = 1; i < 5; i++) expect(wrap(angles[i]! - angles[i - 1]!)).toBeLessThan(0);
  });

  it('aim 1 sweeps the stream across the target, centred on it', () => {
    const { angles, aim } = firedAngles('hose', { count: 7, interval: 0.08, arms: 1, aim: 1, sweep: 90 });
    expect(angles).toHaveLength(7);
    const rel = angles.map((a) => wrap(a - aim));
    expect(rel[0]!).toBeCloseTo(-Math.PI / 4, 5);
    expect(rel[6]!).toBeCloseTo(Math.PI / 4, 5);
    expect(rel[3]!).toBeCloseTo(0, 5);
    for (let i = 1; i < 7; i++) expect(rel[i]!).toBeGreaterThan(rel[i - 1]!);
  });
});
