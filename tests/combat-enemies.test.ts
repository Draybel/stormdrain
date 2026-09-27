import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { allChampions } from '../src/content/registry';
import { KILL_CHAMPION, KILL_FROZEN } from '../src/sim/enemies/damage';
import type { Enemy } from '../src/sim/enemies/enemy';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { championChance, rollChampion } from '../src/sim/enemies/spawn';
import { ST_BURN, ST_CHARM, ST_FEAR, ST_FREEZE, ST_POISON, ST_SLOW, StatusSet, addStatus } from '../src/sim/enemies/status';
import { HIT_DUMMY, HIT_ENEMY, HIT_TILE, SRC_PLAYER, queryHittables, type Hittable } from '../src/sim/hittable';
import { Tile } from '../src/sim/tiles';
import { ENEMY_TUNING, PLAYER_TUNING, STATUS_TUNING } from '../src/sim/tuning';
import { makeInput, makeSim, stepN } from './helpers/sim';
import { OPEN_ROOM, godMode, testEnemy } from './helpers/enemies';
import type { Sim } from '../src/sim/sim';
import type { GameEventType } from '../src/engine/events';

/** Steps and collects every event of the given type (all fields). */
function collect(sim: Sim, n: number, type: GameEventType): { x: number; y: number; a: number; b: number; id: string }[] {
  const out: { x: number; y: number; a: number; b: number; id: string }[] = [];
  const input = makeInput();
  for (let i = 0; i < n; i++) {
    sim.step(input);
    const q = sim.events;
    for (let k = 0; k < q.count; k++) {
      const e = q.at(k);
      if (e.type === type) out.push({ x: e.x, y: e.y, a: e.a, b: e.b, id: e.id });
    }
  }
  return out;
}

/** A still enemy (idle, no attacks) with plenty of HP, out of spawn protection. */
function dummyEnemy(sim: Sim, x: number, y: number, over: Parameters<typeof testEnemy>[1] = {}, id = 't-still'): Enemy {
  testEnemy(id, { move: { kind: 'idle' }, hp: 100, contact: 1, ...over });
  const e = sim.spawnEnemy(id, x, y, { champion: false })!;
  e.spawnT = 0;
  return e;
}

describe('status effects', () => {
  it('poison and burn tick damage, then expire', () => {
    const sim = makeSim('dot', { room: OPEN_ROOM });
    godMode(sim);
    const a = dummyEnemy(sim, 60, 60);
    const b = dummyEnemy(sim, 150, 60);
    a.applyStatus('poison', 2, 0, SRC_PLAYER);
    b.applyStatus('burn', 2, 0, SRC_PLAYER);
    expect(a.status.t[ST_POISON]).toBeGreaterThan(0);
    stepN(sim, makeInput(), 60);
    // 1 s: poison ticks twice (every 0.5 s), burn three times (every 0.3 s).
    expect(a.hp).toBeCloseTo(100 - 2 * STATUS_TUNING.poisonDamage, 5);
    expect(b.hp).toBeCloseTo(100 - 3 * STATUS_TUNING.burnDamage, 5);
    stepN(sim, makeInput(), 70);
    expect(a.status.mask).toBe(0);
    expect(b.status.mask).toBe(0);
    const hpA = a.hp;
    stepN(sim, makeInput(), 60);
    expect(a.hp).toBe(hpA);
  });

  it('a DOT kill still counts as the player’s kill', () => {
    const sim = makeSim('dotkill', { room: OPEN_ROOM });
    const e = dummyEnemy(sim, 60, 60, { hp: 3 }, 't-frail');
    e.applyStatus('poison', 3, 5, SRC_PLAYER);
    const kills = collect(sim, 60, 'enemyKilled');
    expect(kills.length).toBe(1);
    expect(sim.world.counters.kills).toBe(1);
  });

  it('stacking: longer timer and stronger power win; burn thaws ice; charm and fear replace each other', () => {
    const s = new StatusSet();
    addStatus(s, ST_POISON, 2, 3, 0);
    addStatus(s, ST_POISON, 1, 5, 0);
    expect(s.t[ST_POISON]).toBeCloseTo(2);
    expect(s.power[ST_POISON]).toBe(5);
    addStatus(s, ST_POISON, 4, 1, 0);
    expect(s.t[ST_POISON]).toBeCloseTo(4);
    expect(s.power[ST_POISON]).toBe(5);
    addStatus(s, ST_FREEZE, 2, 0, 0);
    addStatus(s, ST_BURN, 2, 0, 0);
    expect(s.t[ST_FREEZE]).toBe(0);
    addStatus(s, ST_FREEZE, 2, 0, 0);
    expect(s.t[ST_BURN]).toBe(0);
    addStatus(s, ST_CHARM, 2, 0, 0);
    addStatus(s, ST_FEAR, 2, 0, 0);
    expect(s.t[ST_CHARM]).toBe(0);
    expect(s.t[ST_FEAR]).toBeGreaterThan(0);
    // Capped duration.
    addStatus(s, ST_SLOW, 999, 0, 0);
    expect(s.t[ST_SLOW]).toBe(STATUS_TUNING.maxDuration);
  });

  it('bosses resist: shorter durations and freeze only slows', () => {
    const s = new StatusSet();
    expect(addStatus(s, ST_FREEZE, 4, 0, 0, 0.5)).toBe(ST_SLOW);
    expect(s.t[ST_FREEZE]).toBe(0);
    expect(s.t[ST_SLOW]).toBeCloseTo(2);
    addStatus(s, ST_CHARM, 4, 0, 0, 0.5);
    expect(s.t[ST_CHARM]).toBeCloseTo(2);
  });

  it('freeze stops an enemy dead; a frozen kill shatters into allied ice shards', () => {
    const sim = makeSim('freeze', { room: OPEN_ROOM });
    godMode(sim);
    testEnemy('t-runner', { move: { kind: 'chase' }, speed: 60, hp: 30 });
    const e = sim.spawnEnemy('t-runner', 30, 30, { champion: false })!;
    e.spawnT = 0;
    sim.world.player.placeAt(180, 90);
    stepN(sim, makeInput(), 20);
    e.applyStatus('freeze', 2, 0, SRC_PLAYER);
    stepN(sim, makeInput(), 6); // let it slide to a stop
    const x = e.x;
    const y = e.y;
    stepN(sim, makeInput(), 60);
    expect(Math.hypot(e.x - x, e.y - y)).toBeLessThan(0.5);
    const kills: { b: number }[] = [];
    e.hurt(999, SRC_PLAYER, 0, 0);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) if (q.at(i).type === 'enemyKilled') kills.push({ b: q.at(i).b });
    expect(kills.length).toBe(1);
    expect(kills[0]!.b & KILL_FROZEN).toBe(KILL_FROZEN);
    let allied = 0;
    for (let i = 0; i < sim.world.enemyShots.count; i++) if (sim.world.enemyShots.items[i]!.allied) allied++;
    expect(allied).toBe(ENEMY_TUNING.shatterShards);
  });

  it('slow halves the speed', () => {
    const dist = (slow: boolean): number => {
      const sim = makeSim('slow', { room: OPEN_ROOM });
      godMode(sim);
      testEnemy('t-runner', { move: { kind: 'chase' }, speed: 60, hp: 30 });
      sim.world.player.placeAt(200, 56);
      const e = sim.spawnEnemy('t-runner', 20, 56, { champion: false })!;
      e.spawnT = 0;
      if (slow) e.applyStatus('slow', 5, 0, SRC_PLAYER);
      stepN(sim, makeInput(), 30); // reach top speed
      const x0 = e.x;
      stepN(sim, makeInput(), 60);
      return e.x - x0;
    };
    const normal = dist(false);
    const slowed = dist(true);
    expect(normal).toBeGreaterThan(50);
    expect(slowed / normal).toBeCloseTo(0.5, 1);
  });

  it('fear makes an enemy run away from the player', () => {
    const sim = makeSim('fear', { room: OPEN_ROOM });
    godMode(sim);
    testEnemy('t-runner', { move: { kind: 'chase' }, speed: 60, hp: 30 });
    sim.world.player.placeAt(104, 56);
    const e = sim.spawnEnemy('t-runner', 70, 56, { champion: false })!;
    e.spawnT = 0;
    e.applyStatus('fear', 2, 0, SRC_PLAYER);
    const d0 = Math.hypot(e.x - 104, e.y - 56);
    stepN(sim, makeInput(), 40);
    expect(Math.hypot(e.x - 104, e.y - 56)).toBeGreaterThan(d0 + 15);
    // …and comes back once it wears off.
    stepN(sim, makeInput(), 150);
    expect(e.status.t[ST_FEAR]).toBe(0);
    expect(Math.hypot(e.x - 104, e.y - 56)).toBeLessThan(d0);
  });

  it('charm: a charmed enemy attacks other enemies — its contact and shots hurt them, not the player', () => {
    const sim = makeSim('charm', { room: OPEN_ROOM });
    testEnemy('t-brawler', { move: { kind: 'chase' }, speed: 50, hp: 60, contact: 1 });
    testEnemy('t-shooter', {
      move: { kind: 'idle' },
      hp: 60,
      contact: 0,
      attacks: [{ kind: 'aimedShot', cooldown: 0.5, params: { windup: 0, first: 0 } }],
    });
    const p = sim.world.player;
    p.placeAt(104, 100);
    const brawler = sim.spawnEnemy('t-brawler', 100, 90, { champion: false })!;
    const shooter = sim.spawnEnemy('t-shooter', 30, 20, { champion: false })!;
    const victim = dummyEnemy(sim, 180, 20, { hp: 200, contact: 0 }, 't-victim');
    brawler.spawnT = shooter.spawnT = 0;
    brawler.applyStatus('charm', 8, 0, SRC_PLAYER);
    shooter.applyStatus('charm', 8, 0, SRC_PLAYER);
    expect(brawler.status.t[ST_CHARM]).toBeGreaterThan(0);
    const red = p.red;
    stepN(sim, makeInput(), 240);
    expect(p.red).toBe(red); // never hurt, though the brawler started right next to Wren
    expect(victim.hp).toBeLessThan(200 - 20);
    // Charmed shots are allied.
    let hostile = 0;
    for (let i = 0; i < sim.world.enemyShots.count; i++) if (!sim.world.enemyShots.items[i]!.allied) hostile++;
    expect(hostile).toBe(0);
  });

  it('knockback status pushes along the last hit, heavier enemies move less; turrets not at all', () => {
    const sim = makeSim('knock', { room: OPEN_ROOM });
    godMode(sim);
    const light = dummyEnemy(sim, 60, 30, {}, 't-light');
    const heavy = dummyEnemy(sim, 60, 80, { mass: 4 }, 't-heavy');
    testEnemy('t-turret', { move: { kind: 'turret' }, hp: 50 });
    const tur = sim.spawnEnemy('t-turret', 150, 56, { champion: false })!;
    tur.spawnT = 0;
    for (const e of [light, heavy, tur]) {
      e.hurt(1, SRC_PLAYER, 1, 0);
      e.applyStatus('knockback', 0.2, 200, SRC_PLAYER);
    }
    stepN(sim, makeInput(), 30);
    expect(light.x - 60).toBeGreaterThan(8);
    expect(heavy.x - 60).toBeLessThan((light.x - 60) / 2);
    expect(tur.x).toBeCloseTo(150, 5);
  });
});

describe('champions', () => {
  it('the list has the seven champions with distinct colours', () => {
    const list = allChampions();
    expect(list.map((c) => c.id)).toEqual(['swift', 'bulwark', 'splitter', 'vengeful', 'regrowing', 'phantom', 'golden']);
    expect(new Set(list.map((c) => c.color)).size).toBe(list.length);
    expect(list.find((c) => c.id === 'bulwark')!.hpMul).toBe(2);
  });

  it('the roll is deterministic with the seed, ~4 % at base luck, and luck raises it', () => {
    const seq = (seed: number, luck: number): string => {
      const rng = new Rng(seed);
      let s = '';
      for (let i = 0; i < 400; i++) s += `${rollChampion(rng, luck)?.id ?? '-'},`;
      return s;
    };
    expect(seq(7, 0)).toBe(seq(7, 0));
    expect(seq(7, 0)).not.toBe(seq(8, 0));
    const rate = (luck: number): number => {
      const rng = new Rng(`rate${luck}`);
      let n = 0;
      for (let i = 0; i < 20000; i++) if (rollChampion(rng, luck)) n++;
      return n / 20000;
    };
    expect(championChance(0)).toBeCloseTo(0.04);
    expect(rate(0)).toBeGreaterThan(0.032);
    expect(rate(0)).toBeLessThan(0.048);
    expect(rate(5)).toBeGreaterThan(0.075);
    expect(championChance(100)).toBe(ENEMY_TUNING.championMax);
  });

  it('same seed → same champions in a wave', () => {
    const wave = (seed: string): string => {
      const sim = makeSim(seed);
      sim.world.player.luckBonus = 0;
      sim.world.player.stats.luck = 30; // max champion odds so some appear
      sim.startWave({ count: 8 });
      return sim.summary().enemies.map((e) => `${e.id}:${e.champion}`).join(' ');
    };
    const a = wave('champ-seed');
    expect(a).toBe(wave('champ-seed'));
    expect(a).toMatch(/:[a-z]/);
  });

  it('champion effects: bulwark hp/size, splitter splits, vengeful ring, golden coins, regrowing heals, phantom fades', () => {
    const sim = makeSim('champ-fx', { room: OPEN_ROOM });
    godMode(sim);
    const base = sim.spawnEnemy('scurrier', 40, 30, { champion: false })!;
    const bul = sim.spawnEnemy('scurrier', 80, 30, { champion: 'bulwark' })!;
    expect(bul.maxHp).toBe(base.maxHp * 2);
    expect(bul.r).toBeGreaterThan(base.r);

    const count = (): number => sim.summary().enemies.length;
    const before = count();
    const split = sim.spawnEnemy('grate-gazer', 120, 30, { champion: 'splitter' })!;
    split.spawnT = 0;
    split.hurt(999, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(count()).toBe(before + 2);

    const shots0 = sim.world.counters.enemyShots;
    const ven = sim.spawnEnemy('grate-gazer', 160, 30, { champion: 'vengeful' })!;
    ven.spawnT = 0;
    ven.hurt(999, SRC_PLAYER, 0, 0);
    expect(sim.world.counters.enemyShots - shots0).toBe(8);

    const pk0 = sim.world.pickups.count;
    const gold = sim.spawnEnemy('grate-gazer', 180, 90, { champion: 'golden' })!;
    gold.spawnT = 0;
    gold.hurt(999, SRC_PLAYER, 0, 0);
    expect(sim.world.pickups.count - pk0).toBeGreaterThanOrEqual(3);

    const reg = sim.spawnEnemy('grate-gazer', 40, 90, { champion: 'regrowing' })!;
    reg.spawnT = 0;
    reg.hurt(10, SRC_PLAYER, 0, 0);
    const hurtHp = reg.hp;
    stepN(sim, makeInput(), 180);
    expect(reg.hp).toBeGreaterThan(hurtHp);

    const ph = sim.spawnEnemy('grate-gazer', 100, 90, { champion: 'phantom' })!;
    let faded = 0;
    stepN(sim, makeInput(), 240, () => {
      if (ph.faded) {
        faded++;
        expect(ph.hittable).toBe(false);
      }
    });
    expect(faded).toBeGreaterThan(30);
    expect(faded).toBeLessThan(200);
  });

  it('champion kills are flagged for the death burst', () => {
    const sim = makeSim('champ-flag', { room: OPEN_ROOM });
    const e = sim.spawnEnemy('scurrier', 40, 30, { champion: 'swift' })!;
    e.spawnT = 0;
    e.hurt(999, SRC_PLAYER, 0, 0);
    const q = sim.events;
    let flags = -1;
    for (let i = 0; i < q.count; i++) if (q.at(i).type === 'enemyKilled') flags = q.at(i).b;
    expect(flags & KILL_CHAMPION).toBe(KILL_CHAMPION);
  });
});

describe('enemy shots and contact', () => {
  it('enemy shots hurt the player (half a heart) and respect i-frames', () => {
    const sim = makeSim('eshot', { room: OPEN_ROOM });
    const p = sim.world.player;
    p.placeAt(150, 56);
    const fire = (): void => {
      spawnEnemyShot(sim.world, 100, 56, 120, 0, 1, 3, 0, false, 0);
    };
    const red = p.red;
    fire();
    const hurts = collect(sim, 40, 'hurt');
    expect(hurts.length).toBe(1);
    expect(hurts[0]!.a).toBe(1);
    expect(p.red).toBe(red - 1);
    expect(sim.world.enemyShots.count).toBe(0); // popped on contact
    // Inside the i-frames: no damage (the shot still pops).
    fire();
    stepN(sim, makeInput(), 30);
    expect(p.invuln).toBeGreaterThan(0);
    expect(p.red).toBe(red - 1);
    expect(sim.world.enemyShots.count).toBe(0);
    // After the i-frames: hurts again.
    stepN(sim, makeInput(), Math.ceil(PLAYER_TUNING.hurtInvuln * 60));
    fire();
    stepN(sim, makeInput(), 40);
    expect(p.red).toBe(red - 2);
  });

  it('rocks stop enemy shots unless they phase; pits do not', () => {
    const room = ['.............', '.............', '.............', '....#.O......', '.............', '.............', '.............'];
    const run = (phase: boolean, y: number): number => {
      const sim = makeSim('rock', { room });
      const p = sim.world.player;
      p.placeAt(150, y);
      const s = spawnEnemyShot(sim.world, 40, y, 150, 0, 1, 3, 0, false, 0)!;
      s.phase = phase;
      stepN(sim, makeInput(), 90);
      return p.red;
    };
    expect(run(false, 56)).toBe(6); // rock at (4, 3) blocks
    expect(run(true, 56)).toBe(5); // phasing shot passes
    // Over the pit row only (rock-free lane at row 3 beyond col 5): a shot from x=90 crosses the pit.
    const sim = makeSim('pit', { room });
    sim.world.player.placeAt(150, 56);
    spawnEnemyShot(sim.world, 90, 56, 150, 0, 1, 3, 0, false, 0);
    stepN(sim, makeInput(), 60);
    expect(sim.world.player.red).toBe(5);
  });

  it('lobs only hurt where they land', () => {
    const sim = makeSim('lob', { room: OPEN_ROOM });
    testEnemy('t-lobber', {
      move: { kind: 'turret' },
      attacks: [{ kind: 'lob', cooldown: 5, params: { windup: 0, first: 0, air: 0.8, scatter: 0, splash: 10 } }],
    });
    const p = sim.world.player;
    p.placeAt(150, 56);
    const e = sim.spawnEnemy('t-lobber', 40, 56, { champion: false })!;
    e.spawnT = 0;
    sim.step(makeInput());
    expect(sim.world.enemyShots.count).toBe(1);
    // Step aside while it's in the air: no damage.
    p.placeAt(150, 100);
    stepN(sim, makeInput(), 70);
    expect(p.red).toBe(6);
    expect(sim.world.enemyShots.count).toBe(0);
  });

  it('contact hurts and shoves the player; spawn protection keeps fresh enemies harmless', () => {
    const sim = makeSim('contact', { room: OPEN_ROOM });
    const p = sim.world.player;
    p.placeAt(100, 56);
    testEnemy('t-sitter', { move: { kind: 'idle' }, contact: 1, hp: 50 });
    sim.spawnEnemy('t-sitter', 104, 56, { champion: false });
    // Spawn protection (0.4 s): standing inside it doesn't hurt.
    stepN(sim, makeInput(), Math.floor(ENEMY_TUNING.spawnTime * 60) - 2);
    expect(p.red).toBe(6);
    stepN(sim, makeInput(), 6);
    expect(p.red).toBe(5);
    // The shove pushed Wren away from it (to the left).
    stepN(sim, makeInput(), 10);
    expect(p.x).toBeLessThan(96);
  });
});

describe('hittables', () => {
  it('enemies, dummies and breakable tiles answer the same interface', () => {
    const sim = makeSim('hit'); // training yard: dummies + urns
    const w = sim.world;
    const e = dummyEnemy(sim, 104, 40);
    const out: Hittable[] = [];
    let n = queryHittables(w, 104, 40, 4, out);
    expect(n).toBe(1);
    expect(out[0]!.hitKind).toBe(HIT_ENEMY);
    const d = w.dummies.items[0]!;
    n = queryHittables(w, d.x, d.y, 2, out);
    expect(out.slice(0, n).some((h) => h.hitKind === HIT_DUMMY)).toBe(true);
    // Urn at (7, 0) in the training yard.
    n = queryHittables(w, 7 * 16 + 8, 8, 2, out, true);
    const tile = out.slice(0, n).find((h) => h.hitKind === HIT_TILE)!;
    expect(tile).toBeDefined();
    expect(tile.hurt(1, SRC_PLAYER, 0, 0)).toBe(true);
    expect(w.room.get(7, 0)).toBe(Tile.Floor);
    // Statuses through the interface.
    e.applyStatus('burn', 1, 0, SRC_PLAYER);
    d.applyStatus('poison', 1, 0, SRC_PLAYER);
    expect(e.status.t[ST_BURN]).toBeGreaterThan(0);
    expect(d.status.t[ST_POISON]).toBeGreaterThan(0);
  });

  it('marbles and explosions hurt enemies; kills fire the kill trigger path (enemyKilled)', () => {
    const sim = makeSim('marble', { room: OPEN_ROOM });
    godMode(sim);
    sim.world.player.placeAt(30, 56);
    const e = dummyEnemy(sim, 120, 56, { hp: 10 }, 't-target');
    const input = makeInput({ aimX: 1, aimY: 0, fireHeld: true });
    stepN(sim, input, 40);
    expect(e.hp).toBeLessThan(10);
    const e2 = dummyEnemy(sim, 60, 100, { hp: 30 }, 't-target2');
    sim.explode(60, 100); // 50 damage > 30 hp
    expect(e2.dead).toBe(true);
    expect(sim.world.counters.kills).toBeGreaterThanOrEqual(1);
  });
});

describe('arena: room combat flow', () => {
  it('a wave shuts the doors; clearing it opens them, emits roomClear, charges the active and drops a reward', () => {
    const sim = makeSim('arena');
    godMode(sim);
    const w = sim.world;
    sim.giveItem('jar-of-lightning');
    w.player.inv.active!.charge = 0;
    const n = sim.startWave({ count: 5 });
    expect(n).toBe(5);
    expect(w.arena.active).toBe(true);
    const seen = new Set<string>();
    const q = sim.events;
    let doorsShut = 0;
    for (let i = 0; i < q.count; i++) {
      if (q.at(i).type === 'enemySeen') seen.add(q.at(i).id);
      if (q.at(i).type === 'doors' && q.at(i).a === 1) doorsShut++;
    }
    expect(doorsShut).toBe(1);
    expect(seen.size).toBeGreaterThan(0);
    // A second wave can't start while one runs.
    expect(sim.startWave()).toBe(0);
    stepN(sim, makeInput(), 30);
    expect(w.arena.doors).toBe(1);
    const cleared0 = w.counters.roomsCleared;

    // Kill them all with player damage (split children included) and let the room notice.
    let killed = 0;
    let roomClear = 0;
    let doorsOpen = 0;
    for (let round = 0; round < 20 && w.arena.active; round++) {
      for (let i = 0; i < w.enemies.count; i++) {
        const e = w.enemies.items[i]!;
        if (!e.dead) {
          e.burrowed = false;
          e.hidden = false;
          e.faded = false;
          e.hurt(9999, SRC_PLAYER, 0, 0);
        }
      }
      for (let t = 0; t < 5; t++) {
        sim.step(makeInput());
        for (let i = 0; i < q.count; i++) {
          const ev = q.at(i);
          if (ev.type === 'enemyKilled') killed++;
          if (ev.type === 'roomClear') roomClear++;
          if (ev.type === 'doors' && ev.a === 0) doorsOpen++;
        }
      }
    }
    expect(w.arena.active).toBe(false);
    expect(roomClear).toBe(1);
    expect(doorsOpen).toBe(1);
    expect(w.counters.roomsCleared).toBe(cleared0 + 1);
    expect(w.player.inv.active!.charge).toBe(1);
    expect(w.counters.kills).toBeGreaterThanOrEqual(5);
    stepN(sim, makeInput(), 30);
    expect(w.arena.doors).toBe(0);
    // A new wave can be called now.
    expect(sim.startWave({ count: 2 })).toBe(2);
    expect(w.arena.wave).toBe(2);
  });

  it("a room's 'e' / 'E' markers are its spawn points, one enemy each", () => {
    const room = ['.............', '.e.........e.', '.............', '......E......', '.............', '.e...........', '.............'];
    const sim = makeSim('markers', { room });
    sim.world.player.placeAt(200, 100);
    expect(sim.startWave()).toBe(4);
    const at = sim
      .summary()
      .enemies.map((e) => `${Math.round((e.x - 8) / 16)},${Math.round((e.y - 8) / 16)}`)
      .sort();
    expect(at).toEqual(['1,1', '1,5', '11,1', '6,3']);
  });

  it('enemies never spawn right next to the player', () => {
    for (let s = 0; s < 20; s++) {
      const sim = makeSim(`spawn-${s}`);
      sim.startWave({ count: 8 });
      const p = sim.world.player;
      for (const e of sim.summary().enemies) expect(Math.hypot(e.x - p.x, e.y - p.y)).toBeGreaterThanOrEqual(50);
    }
  });

  it('enemySeen fires once per kind; enemyKilled carries the kind', () => {
    const sim = makeSim('seen', { room: OPEN_ROOM });
    sim.spawnEnemy('scurrier', 40, 30, { champion: false });
    sim.spawnEnemy('scurrier', 80, 30, { champion: false });
    const q = sim.events;
    let seen = 0;
    for (let i = 0; i < q.count; i++) if (q.at(i).type === 'enemySeen') seen++;
    expect(seen).toBe(1);
    sim.killEnemies();
    let killed = 0;
    for (let i = 0; i < q.count; i++) if (q.at(i).type === 'enemyKilled' && q.at(i).id === 'scurrier') killed++;
    expect(killed).toBe(2);
  });
});
