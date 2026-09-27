/**
 * Boss pack A: two bosses each for The Drowned Nursery, The Rootcellar and The Candlewick Crypt, two
 * minibosses for chapters 1-2 (both tracks), the pattern kinds lineStrike / orbitDash / clusterLob
 * (sim/bosses/patterns-a.ts) and the phase-look hooks (content/hooks/bosses-a.ts).
 *
 * Every boss: validates, sprites well-formed and boss-sized with a second look of the same size for
 * its later phases, falls to a headless god-mode fight through the real attack pipeline within a time
 * limit with every phase seen, never leaves the room or produces NaN, and stays under every pool cap
 * even when left alone in its angriest phase.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, CHAPTERS, ENEMIES, ITEMS, bossesInChapter, registerBoss } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { BOSS_A_LOOKS, bossALook } from '../src/content/hooks/bosses-a';
import * as nurserySprites from '../src/content/sprites/bossesANursery';
import * as rootSprites from '../src/content/sprites/bossesARoot';
import * as cryptSprites from '../src/content/sprites/bossesACrypt';
import * as miniSprites from '../src/content/sprites/bossesAMini';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { getTrack } from '../src/audio/music/registry';
import { compileBoss } from '../src/sim/bosses/compile';
import { PATTERNS } from '../src/sim/bosses/patterns';
import { PATTERN_A_PARAMS } from '../src/sim/bosses/patterns-a';
import { bossHpFor, pickBoss } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { CAP_CREEP, CAP_ENEMIES, CAP_ENEMY_SHOTS, CAP_WAVES, ROOM_H, ROOM_W } from '../src/sim/constants';
import type { Enemy } from '../src/sim/enemies/enemy';
import { SRC_PLAYER } from '../src/sim/hittable';
import { Sim } from '../src/sim/sim';
import { BOSS_TUNING } from '../src/sim/tuning';
import { BOSS_PATTERN_KINDS, type BossDef, type SpriteDef } from '../src/sim/types';
import { clearEdges } from '../src/engine/inputState';
import { fightBoss, nearestTarget } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];

const NURSERY = ['pirouetta', 'sir-sopsalot'];
const ROOT = ['grandmother-brine', 'old-knotroot'];
const CRYPT = ['vesperwing', 'wickwarden'];
const MINIS = ['bumbershoot', 'puddlestomp'];
const BOSS_IDS = [...NURSERY, ...ROOT, ...CRYPT];
const ALL = [...BOSS_IDS, ...MINIS];
const CH12 = ['gutterways', 'drowned_nursery', 'rootcellar', 'candlewick_crypt'];

const SPRITES = [...Object.values(nurserySprites), ...Object.values(rootSprites), ...Object.values(cryptSprites), ...Object.values(miniSprites)] as SpriteDef[];

function def(id: string): BossDef {
  const d = BOSSES.get(id);
  if (!d) throw new Error(`no boss ${id}`);
  return d;
}

function arena(id: string, seed: number | string = 7, intro = false): Sim {
  const sim = new Sim({ seed, room: OPEN });
  sim.world.player.placeAt(30, 56);
  expect(sim.startBossFight(id, 160, 56, { intro, minPhase: 0 })).not.toBeNull();
  return sim;
}

function parts(sim: Sim): Enemy[] {
  const out: Enemy[] = [];
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) out.push(pool.items[i]!);
  return out;
}

/** Every per-tick invariant: positions finite and inside the room, pools within their caps. */
function checkWorld(sim: Sim, problems: string[]): void {
  const w = sim.world;
  if (problems.length > 10) return;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.items[i]!;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp) || !Number.isFinite(e.vx) || !Number.isFinite(e.vy)) {
      problems.push(`tick ${w.tick}: ${e.def.id} NaN (${e.x}, ${e.y}) hp ${e.hp}`);
    } else if (e.x < -0.01 || e.y < -0.01 || e.x > ROOM_W + 0.01 || e.y > ROOM_H + 0.01) {
      problems.push(`tick ${w.tick}: ${e.def.id} left the room (${e.x.toFixed(1)}, ${e.y.toFixed(1)})`);
    }
  }
  for (let i = 0; i < w.enemyShots.count; i++) {
    const s = w.enemyShots.items[i]!;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) problems.push(`tick ${w.tick}: NaN shot`);
  }
  if (w.enemyShots.count > CAP_ENEMY_SHOTS) problems.push(`shots ${w.enemyShots.count}`);
  if (w.creep.count > CAP_CREEP) problems.push(`creep ${w.creep.count}`);
  if (w.waves.count > CAP_WAVES) problems.push(`waves ${w.waves.count}`);
  if (w.enemies.count > CAP_ENEMIES) problems.push(`enemies ${w.enemies.count}`);
  if (!Number.isFinite(w.boss.hp)) problems.push('fight hp NaN');
}

/** Knocks the fight down to its last phase (one blow per threshold, waiting out each roar). */
function toLastPhase(sim: Sim): void {
  const f = sim.world.boss;
  for (let guard = 0; guard < 8 && f.phase < f.phases - 1; guard++) {
    const p = parts(sim);
    p[0]!.hurt(1e6, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 4);
  }
}

describe('boss pack A content', () => {
  it('validates with the rest of the content', () => {
    expect(validateContent()).toEqual([]);
    for (const id of ALL) expect(validateBossDef(def(id), (e) => ENEMIES.has(e)), id).toEqual([]);
  });

  it('two bosses per chapter; the minibosses roam chapters 1-2 on both tracks', () => {
    const ids = (ch: string, kind: BossDef['kind']) => bossesInChapter(ch, kind).map((b) => b.id);
    expect(ids('drowned_nursery', 'boss')).toEqual(expect.arrayContaining(NURSERY));
    expect(ids('rootcellar', 'boss')).toEqual(expect.arrayContaining(ROOT));
    expect(ids('candlewick_crypt', 'boss')).toEqual(expect.arrayContaining(CRYPT));
    for (const id of BOSS_IDS) expect(def(id).kind).toBe('boss');
    for (const id of MINIS) {
      const d = def(id);
      expect(d.kind).toBe('miniboss');
      expect([...d.chapters]).toEqual(CH12);
    }
    for (const ch of CH12) {
      expect(CHAPTERS.get(ch)).toBeDefined();
      expect(ids(ch, 'miniboss')).toEqual(expect.arrayContaining(MINIS));
    }
  });

  it('names, intro lines, blurbs, music and loot', () => {
    const names = new Map<string, string>();
    for (const d of [...ITEMS.values(), ...ENEMIES.values()]) names.set(d.name.toLowerCase(), d.id);
    for (const d of BOSSES.values()) if (!ALL.includes(d.id)) names.set(d.name.toLowerCase(), d.id);
    for (const id of ALL) {
      const d = def(id);
      expect(names.get(d.name.toLowerCase()), `${d.name} clashes`).toBeUndefined();
      expect(d.title, id).toBeDefined();
      expect(d.title).toBe(d.title!.toUpperCase());
      expect(d.title!.length).toBeLessThanOrEqual(44);
      expect(d.bestiary!.length, id).toBeGreaterThanOrEqual(40);
      expect(d.bestiary!.length, id).toBeLessThanOrEqual(110);
      expect(getTrack(d.music!), `${id} music`).toBeDefined();
      expect(d.music).toBe(d.kind === 'miniboss' ? 'miniboss' : 'boss_floodgate');
      expect(d.drops, id).toBeDefined();
      expect(d.goo!.length).toBeGreaterThanOrEqual(3);
      for (const ph of d.phases.slice(1)) expect(ph.tint, `${id} ${ph.name}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('several patterns per phase, deeper chapters escalate (HP, phases, pace, adds)', () => {
    for (const id of ALL) {
      const d = def(id);
      for (const ph of d.phases) expect((ph.patterns ?? []).length, `${id} ${ph.name ?? ''}`).toBeGreaterThanOrEqual(3);
      // Sir Sopsalot's second phase keeps pace 1.0 (polish batch 4): it escalates by speed (×1.3), charges and slams.
      const flat = id === 'sir-sopsalot';
      for (let i = 1; i < d.phases.length; i++) {
        if (flat) expect(d.phases[i]!.pace ?? 1, id).toBeGreaterThanOrEqual(d.phases[i - 1]!.pace ?? 1);
        else expect(d.phases[i]!.pace ?? 1, id).toBeGreaterThan(d.phases[i - 1]!.pace ?? 1);
      }
    }
    const maxHp1 = Math.max(...NURSERY.map((id) => def(id).hp));
    for (const id of [...ROOT, ...CRYPT]) {
      const d = def(id);
      expect(d.hp).toBeGreaterThan(maxHp1 * 1.3);
      expect(d.phases.length).toBe(3);
      expect(d.phases[2]!.pace).toBeGreaterThanOrEqual(1.3);
    }
    for (const id of NURSERY) expect(def(id).phases.length).toBe(2);
    // Polish batch 4 (B4-1): the chapter-1 bosses at ×0.8 HP — the floor-1 fights were the run's deadliest.
    expect(NURSERY.map((id) => def(id).hp)).toEqual([225, 240]);
    expect(['sodden-snarl', 'brimwell'].map((id) => def(id).hp)).toEqual([210, 240]);
    const unstitched = def('sir-sopsalot').phases[1]!;
    expect(unstitched.pace).toBe(1);
    expect(unstitched.patterns!.find((p) => p.kind === 'charge')!.params!.count).toBe(2);
    for (const id of MINIS) expect(def(id).hp).toBeLessThan(Math.min(...NURSERY.map((n) => def(n).hp)));
  });

  it('uses the new pattern kinds, and their params are well-formed', () => {
    const used = new Set<string>();
    for (const id of ALL) for (const ph of def(id).phases) for (const p of [...(ph.patterns ?? []), ...(ph.enter ? [ph.enter] : [])]) used.add(p.kind);
    for (const k of ['lineStrike', 'orbitDash', 'clusterLob'] as const) {
      expect(used.has(k), k).toBe(true);
      expect(BOSS_PATTERN_KINDS).toContain(k);
      expect(PATTERNS[k]).toBeDefined();
      for (const [name, [d, lo, hi]] of Object.entries(PATTERN_A_PARAMS[k])) {
        expect(lo <= d && d <= hi, `${k}.${name}`).toBe(true);
      }
    }
    const bad: BossDef = {
      ...def('old-knotroot'),
      id: 't-bad-a',
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'lineStrike', params: { lines: 9 } }, { kind: 'orbitDash', params: { radius: 500 } }] },
        { at: 0.5, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'clusterLob', params: { nope: 1 } }, { kind: 'ring' }] },
      ],
    };
    const errs = validateBossDef(bad, () => true).join('\n');
    expect(errs).toContain('lines=9');
    expect(errs).toContain('radius=500');
    expect(errs).toContain('unknown param "nope"');
  });
});

describe('boss pack A sprites', () => {
  it('are well-formed, boss-sized, multi-frame and animated', () => {
    expect(SPRITES.length).toBe(16);
    for (const s of SPRITES) {
      expect(validateSpriteDef(s), s.id).toEqual([]);
      expect(Math.max(s.w, s.h), s.id).toBeLessThanOrEqual(56);
      expect(s.frames.length, s.id).toBeGreaterThanOrEqual(6);
      for (const a of ['idle', 'move', 'windup', 'roar', 'hurt']) expect(s.anims?.[a], `${s.id}.${a}`).toBeDefined();
      expect(s.anchorY! > s.h / 3 && s.anchorY! < s.h, s.id).toBe(true);
    }
    for (const id of ALL) {
      const d = def(id);
      const s = d.sprite as SpriteDef;
      const min = d.kind === 'miniboss' ? 24 : 32;
      expect(Math.max(s.w, s.h), id).toBeGreaterThanOrEqual(min);
      if (d.kind === 'miniboss') expect(Math.max(s.w, s.h), id).toBeLessThanOrEqual(34);
    }
  });

  it('every boss has a second look of the same size and anchor that really differs', () => {
    for (const id of ALL) {
      const d = def(id);
      expect(d.hook, id).toBeDefined();
      const looks = BOSS_A_LOOKS[d.hook!]!;
      expect(looks, id).toBeDefined();
      expect(looks[0]).toBe(d.sprite);
      const base = looks[0]!;
      const later = looks[1]!;
      expect(later).not.toBe(base);
      expect([later.w, later.h, later.anchorY]).toEqual([base.w, base.h, base.anchorY]);
      expect(Object.keys(later.anims!)).toEqual(Object.keys(base.anims!));
      // At least a twentieth of the idle frame's pixels change (new parts, cracks, holes).
      const a = base.frames[0]!.join('');
      const b = later.frames[0]!.join('');
      let diff = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
      expect(diff / a.length, id).toBeGreaterThan(0.05);
      // Later phases keep the last look.
      expect(bossALook(d.hook!, d.phases.length - 1)).toBe(later);
    }
  });
});

describe('boss pack A fights', () => {
  const density = new Map<string, number>();

  for (const id of ALL) {
    const d = BOSSES.get(id);
    const limit = d?.kind === 'miniboss' ? 60 : 120;
    it(`${d?.name ?? id} falls within ${limit} s, every phase seen, in bounds, no NaN, caps kept, the phase look worn`, () => {
      const d = def(id);
      const sim = arena(id, 11, true);
      const problems: string[] = [];
      let wornLate = false;
      let wornEarly = false;
      const res = fightBoss(sim, limit * 60, () => {
        checkWorld(sim, problems);
        for (const e of parts(sim)) {
          const b = e.boss!;
          if (e.dying) continue;
          if (e.sprite === bossALook(d.hook!, 1)) {
            if (b.phase === 0) wornEarly = true;
            else wornLate = true;
          }
        }
      });
      expect(problems).toEqual([]);
      expect(res.won).toBe(true);
      expect(res.phase).toBe(d.phases.length - 1);
      expect(res.events.bossPhase).toBe(d.phases.length - 1);
      expect(res.events.bossDefeated).toBe(1);
      expect(res.patterns.size).toBeGreaterThanOrEqual(d.kind === 'miniboss' ? 3 : 5);
      expect(sim.world.enemies.count).toBe(0);
      expect(wornLate).toBe(true);
      expect(wornEarly).toBe(false);
      density.set(id, sim.world.counters.enemyShots / (res.ticks / 60));
    });
  }

  it('deeper chapters throw more at you (shots per second of fight)', () => {
    const avg = (ids: string[]) => ids.reduce((s, id) => s + (density.get(id) ?? 0), 0) / ids.length;
    const ch1 = avg(NURSERY);
    const ch2 = avg([...ROOT, ...CRYPT]);
    expect(ch1).toBeGreaterThan(2);
    expect(ch2).toBeGreaterThan(ch1 * 1.3);
  });

  for (const id of ALL) {
    it(`${id}: left alone in its angriest phase for 40 s stays sane (caps, adds, bounds)`, () => {
      const sim = arena(id, 5);
      stepN(sim, makeInput(), 30);
      toLastPhase(sim);
      expect(sim.world.boss.phase).toBe(def(id).phases.length - 1);
      sim.world.godMode = true;
      const problems: string[] = [];
      let peakShots = 0;
      let peakAdds = 0;
      stepN(sim, makeInput(), 40 * 60, (s) => {
        checkWorld(s, problems);
        peakShots = Math.max(peakShots, s.world.enemyShots.count);
        let adds = 0;
        for (let i = 0; i < s.world.enemies.count; i++) if (!s.world.enemies.items[i]!.boss && s.world.enemies.items[i]!.anchor === 0) adds++;
        peakAdds = Math.max(peakAdds, adds);
      });
      expect(problems).toEqual([]);
      expect(sim.world.boss.active).toBe(true);
      expect(peakShots).toBeGreaterThan(0);
      expect(peakShots).toBeLessThan(CAP_ENEMY_SHOTS / 2);
      expect(peakAdds).toBeLessThanOrEqual(8);
    });
  }

  it('fights replay exactly (same seed, same inputs)', () => {
    for (const id of ['old-knotroot', 'pirouetta']) {
      const a = fightBoss(arena(id, 'same', true), 120 * 60);
      const b = fightBoss(arena(id, 'same', true), 120 * 60);
      expect(a.ticks).toBe(b.ticks);
      expect(a.events).toEqual(b.events);
    }
  });

  it('Puddlestomp splits into two odd boots sharing the fight', () => {
    const sim = arena('puddlestomp');
    stepN(sim, makeInput(), 30);
    const e = parts(sim)[0]!;
    e.hurt(e.maxHp * 0.51, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 6);
    const ps = parts(sim);
    expect(ps.length).toBe(2);
    for (const p of ps) {
      expect(p.scale).toBeLessThan(1);
      expect(p.sprite).toBe(miniSprites.PUDDLESTOMP_ODD_BOOT_SPRITE);
    }
    expect(Math.abs(sim.world.boss.hp - (ps[0]!.hp + ps[1]!.hp))).toBeLessThan(0.5);
  });
});

describe('boss pack A patterns', () => {
  function testBoss(id: string, pattern: BossDef['phases'][number]['patterns'], flying = false): Sim {
    registerBoss({
      id,
      name: id,
      kind: 'boss',
      chapters: ['frostbitten_vault'],
      hp: 900,
      size: 12,
      speed: 30,
      flying,
      sprite: rootSprites.KNOTROOT_SPRITE,
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.1, 0.1], patterns: pattern },
        { at: 0.1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
      ],
    });
    const sim = new Sim({ seed: 4, room: OPEN });
    sim.world.player.placeAt(40, 56);
    sim.startBossFight(id, 150, 56, { intro: false, minPhase: 0 });
    return sim;
  }

  it('lineStrike: a telegraph, then marks ripple out along the lines toward her', () => {
    const sim = testBoss('t-a-lines', [{ kind: 'lineStrike', params: { windup: 0.5, lines: 3, fan: 20, count: 6, step: 16, interval: 0.1, air: 0.8 } }]);
    const boss = parts(sim)[0]!;
    let tells = 0;
    let firstMarks = -1;
    const dist: number[] = [];
    for (let t = 0; t < 150; t++) {
      sim.world.player.placeAt(40, 56);
      sim.step(makeInput());
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'bossTell') tells++;
      const shots = sim.world.enemyShots;
      let marks = 0;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        if (!s.lob || s.fall !== 1) continue;
        marks++;
        if (t === 100) dist.push(Math.hypot(s.tx - boss.x, s.ty - boss.y));
        // Toward the player: every mark is left of the boss.
        expect(s.tx).toBeLessThan(boss.x);
      }
      if (marks > 0 && firstMarks < 0) firstMarks = t;
    }
    expect(tells).toBeGreaterThanOrEqual(1);
    // Nothing lands before the telegraph is over.
    expect(firstMarks).toBeGreaterThanOrEqual(Math.floor(0.5 * 60) - 1);
    expect(dist.length).toBeGreaterThanOrEqual(12);
    expect(Math.max(...dist) - Math.min(...dist)).toBeGreaterThan(40);
    // The strikes do hurt: the player stood on the middle line.
    expect(sim.world.player.red).toBeLessThan(sim.world.player.redMax);
  });

  it('orbitDash: she laps the room inside its walls, firing on the way', () => {
    const sim = testBoss('t-a-orbit', [{ kind: 'orbitDash', params: { windup: 0.3, radius: 80, spin: 150, time: 3, rate: 4, shots: 2, speed: 80 } }]);
    const boss = parts(sim)[0]!;
    sim.world.godMode = true;
    let turned = 0;
    let prevA: number | null = null;
    let shots = 0;
    for (let t = 0; t < 60 * 4; t++) {
      sim.step(makeInput());
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'enemyShoot') shots++;
      expect(boss.x).toBeGreaterThanOrEqual(boss.r - 0.01);
      expect(boss.x).toBeLessThanOrEqual(ROOM_W - boss.r + 0.01);
      expect(boss.y).toBeGreaterThanOrEqual(boss.r - 0.01);
      expect(boss.y).toBeLessThanOrEqual(ROOM_H - boss.r + 0.01);
      if (boss.boss!.pat?.kind === 'orbitDash' && boss.boss!.mode === 1) {
        const a = Math.atan2(boss.y - ROOM_H / 2, boss.x - ROOM_W / 2);
        if (prevA !== null) {
          let d = a - prevA;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          turned += d;
        }
        prevA = a;
      }
    }
    // Most of a lap (and more) around the middle of the room.
    expect(Math.abs(turned)).toBeGreaterThan(Math.PI * 1.5);
    expect(shots).toBeGreaterThan(4);
  });

  it('clusterLob: marked globs that burst into rings where they land', () => {
    const sim = testBoss('t-a-cluster', [{ kind: 'clusterLob', params: { windup: 0.3, count: 3, volleys: 2, split: 6, spread: 40, air: 0.8 } }]);
    sim.world.godMode = true;
    let lobs = 0;
    let lands = 0;
    let ringShots = 0;
    for (let t = 0; t < 160; t++) {
      sim.step(makeInput());
      for (let i = 0; i < sim.events.count; i++) {
        const ev = sim.events.at(i);
        if (ev.type === 'enemyLob') lobs += ev.a;
        if (ev.type === 'lobLand') lands++;
      }
      let n = 0;
      for (let i = 0; i < sim.world.enemyShots.count; i++) if (!sim.world.enemyShots.items[i]!.lob) n++;
      ringShots = Math.max(ringShots, n);
    }
    // Two volleys of three per run of the pattern (it may have started again).
    expect(lobs).toBeGreaterThanOrEqual(6);
    expect(lobs % 3).toBe(0);
    expect(lands).toBeGreaterThanOrEqual(5);
    expect(ringShots).toBeGreaterThanOrEqual(12);
  });

  it('compile: the new kinds resolve with defaults filled', () => {
    const c = compileBoss(def('old-knotroot'));
    const ls = c.phases[0]!.patterns.find((p) => p.kind === 'lineStrike')!;
    expect(ls.p.lines).toBe(3);
    expect(ls.p.repeats).toBe(1);
    expect(ls.index).toBe(BOSS_PATTERN_KINDS.indexOf('lineStrike'));
  });
});

/**
 * A fight that keeps to the middle of the room (the strafing bot can stand in a doorway and walk out
 * on the very tick the doors open). God mode, aims at the nearest foe, fires, circles the centre.
 */
function fightMidRoom(sim: Sim, maxTicks: number): boolean {
  const w = sim.world;
  w.godMode = true;
  const input = makeInput();
  for (let t = 0; t < maxTicks; t++) {
    const tg = nearestTarget(sim);
    input.fireHeld = !!tg;
    if (tg) {
      const d = Math.hypot(tg.x - w.player.x, tg.y - w.player.y) || 1;
      input.aimX = (tg.x - w.player.x) / d;
      input.aimY = (tg.y - w.player.y) / d;
    }
    const a = t / 70;
    const gx = ROOM_W / 2 + Math.cos(a) * 34 - w.player.x;
    const gy = ROOM_H / 2 + Math.sin(a) * 22 - w.player.y;
    const gd = Math.hypot(gx, gy);
    input.moveX = gd > 3 ? (gx / gd) * 0.7 : 0;
    input.moveY = gd > 3 ? (gy / gd) * 0.7 : 0;
    sim.step(input);
    clearEdges(input);
    if (w.boss.done && !w.arena.active) return true;
  }
  return false;
}

describe('boss pack A in real runs', () => {
  it('each chapter floor picks one of its own two bosses, both show up across seeds', () => {
    const cases: [number, 'main' | 'alt', string, string[]][] = [
      [1, 'alt', 'drowned_nursery', NURSERY],
      [2, 'alt', 'drowned_nursery', NURSERY],
      [3, 'main', 'rootcellar', ROOT],
      [4, 'main', 'rootcellar', ROOT],
      [3, 'alt', 'candlewick_crypt', CRYPT],
      [4, 'alt', 'candlewick_crypt', CRYPT],
    ];
    for (const [floor, track, ch, ids] of cases) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 30; seed++) seen.add(pickBoss(seed, floor, track, ch, 'boss')!.id);
      expect([...seen].sort(), `${ch} floor ${floor}`).toEqual([...ids].sort());
    }
    // Minibosses: both of ours turn up in every chapter 1-2 pool.
    for (const ch of CH12) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) seen.add(pickBoss(seed, 3, 'main', ch, 'miniboss')!.id);
      for (const id of MINIS) expect(seen.has(id), `${id} in ${ch}`).toBe(true);
    }
    // Every boss grows with depth (polish batch 4): floor 1 is its own HP, each floor after adds hpPerFloor.
    expect(bossHpFor(def('pirouetta'), 1)).toBe(def('pirouetta').hp);
    expect(bossHpFor(def('pirouetta'), 2)).toBe(Math.round(def('pirouetta').hp * (1 + BOSS_TUNING.hpPerFloor)));
    expect(bossHpFor(def('wickwarden'), 4)).toBe(Math.round(def('wickwarden').hp * (1 + 3 * BOSS_TUNING.hpPerFloor)));
    expect(bossHpFor(def('puddlestomp'), 4)).toBeGreaterThan(def('puddlestomp').hp);
  });

  for (const [floor, track] of [
    [1, 'alt'],
    [3, 'main'],
    [3, 'alt'],
  ] as const) {
    it(`floor ${floor} ${track}: the boss room fight ends with the trapdoor`, () => {
      const sim = Sim.newRun(`pack-a-${floor}${track}`, { floor, track, curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      run.teleport(run.data.layout.boss);
      const f = sim.world.boss;
      expect(f.active).toBe(true);
      const id = f.id;
      expect([...NURSERY, ...ROOT, ...CRYPT]).toContain(id);
      expect(f.maxHp).toBe(bossHpFor(def(id), floor));
      expect(fightMidRoom(sim, 150 * 60)).toBe(true);
      stepN(sim, makeInput(), 3);
      expect(sim.world.trapdoor.active).toBe(true);
    });
  }
});
