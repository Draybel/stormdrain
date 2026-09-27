/**
 * Phase 3B: the boss framework (sim/bosses) — data, phases at their thresholds, the pattern library,
 * split parts, shields, the death sequence, selection per chapter, and headless god-mode fights for
 * every boss, miniboss and final boss.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, CHAPTERS, bossesInChapter, registerBoss } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { BOSS_PATTERN_KINDS, type BossDef } from '../src/sim/types';
import { compileBoss } from '../src/sim/bosses/compile';
import { getBossHook, registerBossHook } from '../src/sim/bosses/hooks';
import { bossHpFor, bossPool, finalBossDef, pickBoss } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { PATTERNS } from '../src/sim/bosses/patterns';
import { BOSS_TUNING } from '../src/sim/tuning';
import { ST_SLOW } from '../src/sim/enemies/status';
import { SRC_PLAYER } from '../src/sim/hittable';
import { Sim } from '../src/sim/sim';
import * as bossSprites from '../src/content/sprites/bosses';
import * as roomSprites from '../src/content/sprites/specialRooms';
import { validateSpriteDef } from '../src/content/sprites/validate';
import type { SpriteDef } from '../src/sim/types';

const { SODDEN_SNARL_SPRITE } = bossSprites;
import { fightBoss } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];

/** A fresh open room with the player on the left and `id` fighting on the right (no intro). */
function arena(id: string, seed: number | string = 7, intro = false): Sim {
  const sim = new Sim({ seed, room: OPEN });
  sim.world.player.placeAt(30, 56);
  const e = sim.startBossFight(id, 160, 56, { intro, minPhase: 0 });
  expect(e).not.toBeNull();
  return sim;
}

/** Past the spawn poof (the brain starts once the boss has fully appeared). */
function settle(sim: Sim): void {
  stepN(sim, makeInput(), 30);
}

function boss(sim: Sim) {
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) return pool.items[i]!;
  throw new Error('no boss');
}

function events(sim: Sim, type: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === type) n++;
  return n;
}

describe('boss content', () => {
  it('validates (≥ 2 phases, known patterns and params, big multi-frame sprites)', () => {
    expect(validateContent()).toEqual([]);
    expect(BOSSES.size).toBeGreaterThanOrEqual(6);
    for (const b of BOSSES.values()) {
      expect(b.phases.length, b.id).toBeGreaterThanOrEqual(2);
      expect(validateBossDef(b, () => true), b.id).toEqual([]);
      const s = b.sprite as unknown as { w: number; h: number; frames: unknown[] };
      expect(Math.max(s.w, s.h)).toBeGreaterThanOrEqual(b.kind === 'miniboss' ? 24 : 32);
      expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(56);
      expect(s.frames.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('the Gutterways have two bosses and a miniboss; every final key has its boss', () => {
    expect(bossesInChapter('gutterways', 'boss').map((b) => b.id)).toEqual(expect.arrayContaining(['brimwell', 'sodden-snarl']));
    expect(bossesInChapter('gutterways', 'miniboss').map((b) => b.id)).toContain('pipewhip');
    expect(finalBossDef('thunderhead')?.ending).toBe(1);
    expect(finalBossDef('nestmother')?.ending).toBe(2);
    expect(finalBossDef('undertow')?.ending).toBe(3);
  });

  it('every phase uses several patterns, and the library covers every pattern kind', () => {
    const used = new Set<string>();
    for (const b of BOSSES.values()) {
      for (const ph of b.phases) {
        expect((ph.patterns ?? []).length, `${b.id} ${ph.name ?? ''}`).toBeGreaterThanOrEqual(2);
        for (const p of ph.patterns ?? []) used.add(p.kind);
        if (ph.enter) used.add(ph.enter.kind);
      }
    }
    for (const k of BOSS_PATTERN_KINDS) expect(PATTERNS[k], k).toBeDefined();
    // Everything but the per-boss 'hook' kind is used by real content.
    for (const k of BOSS_PATTERN_KINDS) if (k !== 'hook') expect(used.has(k), k).toBe(true);
  });

  it('boss, NPC and prop sprites are well-formed', () => {
    // Every boss's sprite and the phase looks its hook swaps in (BossHook.looks), plus the room props / NPCs.
    const bossArt = [...BOSSES.values()].flatMap((b) => [b.sprite, ...((b.hook && getBossHook(b.hook)?.looks) || [])]);
    const all = [...Object.values(bossSprites), ...Object.values(roomSprites), ...bossArt].filter((s): s is SpriteDef => typeof s !== 'string');
    expect(all.length).toBeGreaterThanOrEqual(60);
    for (const s of all) expect(validateSpriteDef(s), s.id).toEqual([]);
  });

  it('validation catches broken defs', () => {
    const bad: BossDef = {
      id: 'Bad Boss',
      name: 'Bad',
      kind: 'boss',
      chapters: ['gutterways'],
      hp: 5,
      size: 40,
      sprite: SODDEN_SNARL_SPRITE,
      phases: [
        { at: 0.9, move: { kind: 'burrow' }, attacks: [], patterns: [{ kind: 'ring', params: { count: 99 } }] },
        { at: 0.95, move: { kind: 'chase' }, attacks: [], patterns: [{ kind: 'summon' }, { kind: 'hook', hook: 'nope' }] },
      ],
    };
    const errs = validateBossDef(bad, () => false).join('\n');
    for (const bit of ['kebab-case', 'hp', 'size', 'starts at 1', 'must fall', 'baseline movement', 'count=99', "needs an 'enemy'", 'unregistered boss hook']) {
      expect(errs).toContain(bit);
    }
  });
});

describe('phases', () => {
  it('a phase begins exactly at its threshold (roar, invulnerability, the new phase data)', () => {
    const sim = arena('brimwell');
    settle(sim);
    const e = boss(sim);
    const f = sim.world.boss;
    expect(f.active).toBe(true);
    expect(f.marks).toEqual([1, 0.5]);
    // Down to just above half: still phase 0.
    e.hurt(e.maxHp * 0.49, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), 2);
    expect(f.phase).toBe(0);
    expect(e.boss!.phase).toBe(0);
    // Past half: the next tick roars into phase 1.
    e.hurt(e.maxHp * 0.02, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(f.phase).toBe(1);
    expect(e.boss!.phase).toBe(1);
    expect(events(sim, 'bossPhase')).toBe(1);
    expect(e.boss!.invulnT).toBeGreaterThan(0);
    expect(e.cfg).toBe(compileBoss(BOSSES.get('brimwell')!).phases[1]!.cfg);
    // Hits during the roar bounce off.
    const hp = e.hp;
    e.hurt(50, SRC_PLAYER, 0, 0);
    expect(e.hp).toBe(hp);
    // After the roar it takes damage again.
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 2);
    e.hurt(10, SRC_PLAYER, 0, 0);
    expect(e.hp).toBe(hp - 10);
  });

  it('one huge blow can never skip a phase', () => {
    const sim = arena('old-thunderhead');
    settle(sim);
    const e = boss(sim);
    const f = sim.world.boss;
    expect(f.marks).toEqual([1, 0.55, 0.2]);
    e.hurt(1e6, SRC_PLAYER, 0, 0);
    expect(e.dead).toBe(false);
    expect(f.hp / f.maxHp).toBeLessThanOrEqual(0.55);
    expect(f.hp / f.maxHp).toBeGreaterThan(0.54);
    sim.step(makeInput());
    expect(f.phase).toBe(1);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 2);
    e.hurt(1e6, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(f.phase).toBe(2);
    expect(e.dead).toBe(false);
  });

  it('phases speed up (pace) and bring their colour shift', () => {
    const def = compileBoss(BOSSES.get('sodden-snarl')!);
    expect(def.phases[1]!.pace).toBeGreaterThan(def.phases[0]!.pace);
    expect(def.phases[1]!.tint).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('patterns', () => {
  it('the Sodden Snarl splits into two parts sharing the fight; the last part plays the death sequence', () => {
    const sim = arena('sodden-snarl');
    settle(sim);
    const e = boss(sim);
    const f = sim.world.boss;
    const max = f.maxHp;
    e.hurt(max * 0.51, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 4);
    const parts = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => o.boss && !o.dead);
    expect(parts.length).toBe(2);
    expect(Math.abs(f.hp - (parts[0]!.hp + parts[1]!.hp))).toBeLessThan(0.5);
    expect(parts[0]!.scale).toBeLessThan(1);
    // One part down: the fight goes on.
    parts[0]!.hurt(1e6, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(f.active).toBe(true);
    expect(f.dying).toBe(false);
    // The last one dies slowly: untouchable, adds and shots cleared, blasts, then the kill.
    parts[1]!.hurt(1e6, SRC_PLAYER, 0, 0);
    expect(parts[1]!.dying).toBe(true);
    expect(parts[1]!.hittable).toBe(false);
    expect(f.dying).toBe(true);
    let booms = 0;
    let defeated = 0;
    let killed = 0;
    for (let t = 0; t < Math.ceil(BOSS_TUNING.deathTime * 60) + 10; t++) {
      sim.step(makeInput());
      booms += events(sim, 'bossBoom');
      defeated += events(sim, 'bossDefeated');
      killed += events(sim, 'enemyKilled');
    }
    expect(booms).toBeGreaterThan(5);
    expect(defeated).toBe(1);
    expect(killed).toBeGreaterThanOrEqual(1);
    expect(f.active).toBe(false);
    expect(f.done).toBe(true);
    expect(sim.world.enemyShots.count).toBe(0);
    expect(sim.world.arena.active).toBe(false);
    expect(sim.world.counters.bossKills).toBe(1);
  });

  it('The Undertow raises orbiting shields that soak up shots and fall with it', () => {
    const sim = arena('undertow');
    stepN(sim, makeInput(), 60);
    const shields = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => o.anchor !== 0 && !o.dead);
    expect(shields.length).toBe(4);
    const e = boss(sim);
    for (const s of shields) {
      expect(s.def.id).toBe('bubble-ward');
      expect(Math.hypot(s.x - e.x, s.y - e.y)).toBeGreaterThan(e.r);
      expect(s.hittable).toBe(true);
    }
    // They orbit.
    const before = shields.map((s) => [s.x, s.y]);
    stepN(sim, makeInput(), 10);
    expect(shields.some((s, i) => Math.abs(s.x - before[i]![0]!) + Math.abs(s.y - before[i]![1]!) > 1)).toBe(true);
    sim.killEnemies();
    stepN(sim, makeInput(), 3);
    expect(sim.world.enemies.count).toBe(0);
  });

  it('a beam sweep telegraphs first, then hurts along its line (rocks are cover)', () => {
    const def: BossDef = {
      id: 't-beamer',
      name: 'Beamer',
      kind: 'boss',
      chapters: ['frostbitten_vault'],
      hp: 500,
      size: 12,
      speed: 0,
      sprite: SODDEN_SNARL_SPRITE,
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.1, 0.1], patterns: [{ kind: 'beamSweep', params: { windup: 0.5, arc: 10, time: 1, width: 8 } }] },
        { at: 0.5, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
      ],
    };
    registerBoss(def);
    const sim = new Sim({ seed: 3, room: OPEN });
    sim.world.player.placeAt(40, 56);
    sim.startBossFight('t-beamer', 160, 56, { intro: false });
    const b = boss(sim).boss!;
    let tele = 0;
    let fire = 0;
    const red = sim.world.player.red;
    for (let t = 0; t < 120; t++) {
      sim.world.player.placeAt(40, 56);
      sim.step(makeInput());
      if (b.beams[0]!.on && b.beams[0]!.tele) tele++;
      if (b.beams[0]!.on && !b.beams[0]!.tele) fire++;
    }
    expect(tele).toBeGreaterThan(20);
    expect(fire).toBeGreaterThan(20);
    expect(sim.world.player.red).toBeLessThan(red);
  });

  it('per-boss hooks run (tick, phase start, hook patterns)', () => {
    const calls = { tick: 0, phase: 0, pattern: 0 };
    const phases: number[] = [];
    registerBossHook('t-hook', {
      tick: () => void calls.tick++,
      phase: (_ctx, i) => {
        calls.phase++;
        phases.push(i);
      },
      pattern: (ctx) => {
        calls.pattern++;
        if (calls.pattern === 1) ctx.api.ring(6, 60);
        return ctx.t > 0.3;
      },
    });
    registerBoss({
      id: 't-hooked',
      name: 'Hooked',
      kind: 'boss',
      chapters: ['frostbitten_vault'],
      hp: 300,
      size: 12,
      hook: 't-hook',
      sprite: SODDEN_SNARL_SPRITE,
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.2, 0.2], patterns: [{ kind: 'hook', hook: 't-hook', params: { windup: 0.1 } }] },
        { at: 0.5, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'hook', hook: 't-hook' }] },
      ],
    });
    const sim = arena('t-hooked', 1, true);
    stepN(sim, makeInput(), 200);
    boss(sim).hurt(1e6, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), 3);
    expect(calls.tick).toBeGreaterThan(50);
    // Phase 0 begins when the intro ends, phase 1 at half health.
    expect(phases).toEqual([0, 1]);
    expect(calls.pattern).toBeGreaterThan(5);
    expect(sim.world.counters.enemyShots).toBeGreaterThan(0);
  });

  it('bosses resist statuses: shorter, and freeze only slows', () => {
    const sim = arena('brimwell');
    const e = boss(sim);
    e.applyStatus('freeze', 4, 0, SRC_PLAYER);
    expect(e.status.t[ST_SLOW]).toBeGreaterThan(0);
    expect(e.status.t[ST_SLOW]).toBeLessThan(4);
    e.applyStatus('poison', 4, 0, SRC_PLAYER);
    expect(e.status.t[0]).toBeCloseTo(4 * (BOSSES.get('brimwell')!.resist ?? 0.5), 5);
  });

  it('the intro holds the boss still and harmless-looking for a moment', () => {
    const sim = arena('brimwell', 2, true);
    const e = boss(sim);
    expect(events(sim, 'bossIntro')).toBe(1);
    const x = e.x;
    stepN(sim, makeInput(), Math.floor(BOSS_TUNING.intro * 60) - 5);
    expect(e.x).toBeCloseTo(x, 3);
    expect(sim.world.enemyShots.count).toBe(0);
    expect(sim.world.boss.introT).toBeLessThan(0.2);
  });
});

describe('headless god-mode fights', () => {
  for (const def of [...BOSSES.values()].filter((b) => !b.id.startsWith('t-'))) {
    const limit = def.kind === 'final' ? 300 : 150;
    it(`${def.name} (${def.kind}) falls within ${limit} s with every phase seen`, () => {
      const sim = arena(def.id, 11, true);
      const res = fightBoss(sim, limit * 60);
      expect(res.won).toBe(true);
      expect(res.phase).toBe(def.phases.length - 1);
      expect(res.events.bossDefeated).toBe(1);
      expect(res.patterns.size).toBeGreaterThanOrEqual(3);
      expect(sim.world.enemies.count).toBe(0);
    });
  }

  it('a fight is deterministic (same seed, same inputs → same fight)', () => {
    const a = fightBoss(arena('brimwell', 'same'), 150 * 60);
    const b = fightBoss(arena('brimwell', 'same'), 150 * 60);
    expect(a.ticks).toBe(b.ticks);
    expect(a.events).toEqual(b.events);
  });
});

describe('selection per chapter', () => {
  it('pools are the union of the chapter list and bosses naming the chapter; empty chapters borrow every boss', () => {
    expect(bossPool('rootcellar', 'boss').length).toBeGreaterThanOrEqual(2);
    registerBoss({
      id: 't-root-boss',
      name: 'Root Boss',
      kind: 'boss',
      chapters: ['rootcellar'],
      hp: 300,
      size: 12,
      sprite: SODDEN_SNARL_SPRITE,
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
        { at: 0.5, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
      ],
    });
    // (Boss pack A gave the Rootcellar and the Crypt bosses of their own, so these check membership.)
    expect(bossPool('rootcellar', 'boss').map((b) => b.id)).toContain('t-root-boss');
    // A chapter without bosses of its own borrows every boss of the kind.
    expect(bossPool('no_such_chapter', 'boss').length).toBe([...BOSSES.values()].filter((b) => b.kind === 'boss').length);
    // Explicit chapter lists count too.
    const ch = CHAPTERS.get('candlewick_crypt')!;
    (ch.bossPool as string[]).push('sodden-snarl');
    try {
      expect(bossesInChapter('candlewick_crypt', 'boss').map((b) => b.id)).toContain('sodden-snarl');
      const picks = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) picks.add(pickBoss(seed, 3, 'alt', 'candlewick_crypt', 'boss')!.id);
      expect(picks.has('sodden-snarl')).toBe(true);
    } finally {
      (ch.bossPool as string[]).pop();
    }
  });

  it('picks are seeded, and a chapter shows two different bosses on its two floors', () => {
    let differ = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s1 = Sim.newRun(seed, { curse: null });
      const a = pickBoss(s1.seed, 1, 'main', 'gutterways', 'boss')!.id;
      expect(pickBoss(s1.seed, 1, 'main', 'gutterways', 'boss')!.id).toBe(a);
      expect(s1.run!.data.rooms[s1.run!.data.layout.boss]!.boss).toBe(a);
      s1.run!.skipFloor();
      const b = s1.run!.data.rooms[s1.run!.data.layout.boss]!.boss;
      if (b !== a) differ++;
    }
    expect(differ).toBe(20);
  });

  it('every boss gets tougher with depth (polish batch 4: not only borrowed ones)', () => {
    const snarl = BOSSES.get('sodden-snarl')!;
    expect(bossHpFor(snarl, 1)).toBe(snarl.hp);
    expect(bossHpFor(snarl, 2)).toBe(Math.round(snarl.hp * (1 + BOSS_TUNING.hpPerFloor)));
    expect(bossHpFor(snarl, 7)).toBeGreaterThan(snarl.hp * 1.5);
    for (const d of BOSSES.values()) {
      for (let f = 1; f <= 12; f++) expect(bossHpFor(d, f), `${d.id} floor ${f}`).toBe(Math.round(d.hp * (1 + BOSS_TUNING.hpPerFloor * (f - 1))));
    }
  });
});

describe('boss rooms in a run', () => {
  it('intro card event, HP bar state, then trapdoor + reward pedestal + a heart', () => {
    const sim = Sim.newRun(55, { curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.boss);
    const f = sim.world.boss;
    expect(f.active).toBe(true);
    expect(f.name.length).toBeGreaterThan(0);
    expect(f.chapter).toBe('The Gutterways');
    let intro = 0;
    for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'bossIntro') intro++;
    expect(intro).toBe(1);
    const res = fightBoss(sim, 150 * 60);
    expect(res.won).toBe(true);
    stepN(sim, makeInput(), 3);
    expect(sim.world.trapdoor.active).toBe(true);
    expect(sim.summary().pedestals.some((p) => p.item !== '')).toBe(true);
    expect(sim.summary().pickups.some((p) => p.kind === 'heart')).toBe(true);
    expect(run.data.stats.bossesBeaten).toBe(1);
  });

  it('minibosses have their own intro and reward', () => {
    // (Floor 2: floor 1 never has a miniboss.)
    for (let seed = 1; seed < 60; seed++) {
      const sim = Sim.newRun(seed, { floor: 2, curse: null });
      const run = sim.run!;
      const room = run.data.layout.rooms.find((r) => r.type === 'miniboss');
      if (!room) continue;
      sim.world.godMode = true;
      run.teleport(room.index);
      expect(sim.world.boss.active).toBe(true);
      expect(sim.world.boss.kind).toBe(1);
      expect(BOSSES.get(run.state.boss)?.kind).toBe('miniboss');
      const res = fightBoss(sim, 150 * 60);
      expect(res.won).toBe(true);
      stepN(sim, makeInput(), 3);
      // A heart plus the miniboss drop table (2-3 things).
      expect(sim.world.pickups.count).toBeGreaterThanOrEqual(3);
      expect(sim.world.trapdoor.active).toBe(false);
      return;
    }
    throw new Error('no miniboss room in 60 seeds');
  });

  it('a snapshot taken in a boss room replays the fight identically', () => {
    const a = Sim.newRun('boss-snap', { curse: null });
    a.world.godMode = true;
    a.run!.teleport(a.run!.data.layout.boss);
    const b = Sim.fromSnapshot(a.snapshot());
    const ra = fightBoss(a, 60 * 30);
    const rb = fightBoss(b, 60 * 30);
    expect(rb.ticks).toBe(ra.ticks);
    expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
  });
});
