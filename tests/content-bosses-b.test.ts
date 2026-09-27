/**
 * Boss pack B (chapters 3-4; docs/content-bosses-b.md): Old Governor, Gnawgear (the Grinding Works),
 * Bellowbelly (the Rust Foundry), Grandmother Gill, Bramblehorn (the Mushroom Hollow), Hushwing (the
 * Glimmer Grotto) and the minibosses Canshell and Glowtail (chapters 3-4, both tracks). Validation,
 * art (a sprite per phase look), the three new pattern kinds, chapter pools and runs, and headless
 * god-mode fights with the real attack pipeline: every phase seen, the look swapped, the boss inside
 * the room, no NaN, the enemy-shot cap respected.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, CHAPTERS, ENEMIES, allItems, bossesInChapter, registerBoss } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { BOSS_B_LOOKS, bossLookHook } from '../src/content/hooks/bosses-b';
import * as worksArt from '../src/content/sprites/bossesBWorks';
import * as foundryArt from '../src/content/sprites/bossesBFoundry';
import * as hollowArt from '../src/content/sprites/bossesBHollow';
import * as grottoArt from '../src/content/sprites/bossesBGrotto';
import * as miniArt from '../src/content/sprites/bossesBMini';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { getTrack } from '../src/audio/music/registry';
import { compileBoss } from '../src/sim/bosses/compile';
import { PATTERNS } from '../src/sim/bosses/patterns';
import { PATTERNS_B } from '../src/sim/bosses/patterns-b';
import { bossHpFor, bossPool, pickBoss } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { CAP_ENEMY_SHOTS, ROOM_H, ROOM_W } from '../src/sim/constants';
import type { Enemy } from '../src/sim/enemies/enemy';
import { SRC_PLAYER } from '../src/sim/hittable';
import { Sim } from '../src/sim/sim';
import { BOSS_TUNING } from '../src/sim/tuning';
import { BOSS_PATTERN_KINDS, type BossDef, type BossPatternKind, type SpriteDef } from '../src/sim/types';
import { fightBoss } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];
/** A boss room like the real ones: cover blocks round a free centre. */
const COVER = ['.............', '..#.......#..', '.............', '.............', '.............', '..#.......#..', '.............'];

// (Hammerjaw and Facetta: polish batch 4, the alt chapters' second bosses.)
const BOSS_IDS = ['old-governor', 'gnawgear', 'bellowbelly', 'grandmother-gill', 'bramblehorn', 'hushwing', 'hammerjaw', 'facetta'] as const;
const MINI_IDS = ['canshell', 'glowtail'] as const;
const ALL_IDS = [...BOSS_IDS, ...MINI_IDS] as const;
const HOME: Record<string, string> = {
  'old-governor': 'grinding_works',
  gnawgear: 'grinding_works',
  bellowbelly: 'rust_foundry',
  'grandmother-gill': 'mushroom_hollow',
  bramblehorn: 'mushroom_hollow',
  hushwing: 'glimmer_grotto',
  hammerjaw: 'rust_foundry',
  facetta: 'glimmer_grotto',
};
const CH34 = ['grinding_works', 'rust_foundry', 'mushroom_hollow', 'glimmer_grotto'];
const NEW_KINDS = Object.keys(PATTERNS_B);

function def(id: string): BossDef {
  const d = BOSSES.get(id);
  if (!d) throw new Error(`missing boss ${id}`);
  return d;
}

function arena(id: string, seed: number | string = 7, intro = false, room = OPEN): Sim {
  const sim = new Sim({ seed, room });
  sim.world.player.placeAt(30, 56);
  const e = sim.startBossFight(id, 150, 56, { intro, minPhase: 0 });
  expect(e).not.toBeNull();
  return sim;
}

function bossOf(sim: Sim): Enemy {
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) return pool.items[i]!;
  throw new Error('no boss');
}

function eventCount(sim: Sim, type: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === type) n++;
  return n;
}

function artSprites(): SpriteDef[] {
  const out: SpriteDef[] = [];
  for (const mod of [worksArt, foundryArt, hollowArt, grottoArt, miniArt]) {
    for (const v of Object.values(mod)) {
      const s = v as SpriteDef;
      if (s && typeof s === 'object' && Array.isArray(s.frames)) out.push(s);
    }
  }
  return out;
}

describe('boss pack B: content', () => {
  it('validates, and every boss / miniboss is registered with its chapters, music and look hook', () => {
    expect(validateContent()).toEqual([]);
    for (const id of ALL_IDS) {
      const d = def(id);
      expect(validateBossDef(d, (e) => ENEMIES.has(e)), id).toEqual([]);
      expect(d.kind).toBe(MINI_IDS.includes(id as (typeof MINI_IDS)[number]) ? 'miniboss' : 'boss');
      expect(d.hook).toBe(bossLookHook(id));
      expect(d.music, id).toBeDefined();
      expect(getTrack(d.music!), `${id} music`).toBeDefined();
      expect(d.title!.length, id).toBeLessThanOrEqual(44);
      expect(d.bestiary!.length, id).toBeLessThanOrEqual(110);
      expect(d.goo!.length).toBeGreaterThanOrEqual(3);
      for (const ch of d.chapters) expect(CHAPTERS.has(ch), `${id} ${ch}`).toBe(true);
    }
    for (const id of BOSS_IDS) expect(def(id).chapters).toEqual([HOME[id]]);
    for (const id of MINI_IDS) expect([...def(id).chapters].sort()).toEqual([...CH34].sort());
  });

  it('names are original and unique across items, enemies and bosses', () => {
    const names = new Set<string>();
    for (const item of allItems()) names.add(item.name.toUpperCase());
    for (const e of ENEMIES.values()) names.add(e.name.toUpperCase());
    for (const b of BOSSES.values()) if (!ALL_IDS.includes(b.id as (typeof ALL_IDS)[number])) names.add(b.name.toUpperCase());
    for (const id of ALL_IDS) {
      const n = def(id).name.toUpperCase();
      expect(names.has(n), n).toBe(false);
      names.add(n);
    }
  });

  it('several patterns per phase, bosses of chapter 4 have three phases, adds exist, HP rises with depth', () => {
    for (const id of ALL_IDS) {
      const d = def(id);
      expect(d.phases.length).toBeGreaterThanOrEqual(2);
      for (const ph of d.phases) {
        expect((ph.patterns ?? []).length, `${id} ${ph.name}`).toBeGreaterThanOrEqual(3);
        expect(ph.name, id).toBeTruthy();
      }
      // Later phases speed up and shift colour.
      for (let i = 1; i < d.phases.length; i++) {
        expect(d.phases[i]!.pace ?? 1).toBeGreaterThan(d.phases[i - 1]!.pace ?? 1);
        expect(d.phases[i]!.tint).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
    for (const id of ['bellowbelly', 'grandmother-gill', 'hushwing', 'hammerjaw', 'facetta']) expect(def(id).phases.length).toBe(3);
    // Chapter 3 (floors 5-6) < chapter 4 (floors 7-8); both above the Gutterways' bosses.
    const ch1 = Math.max(def('sodden-snarl').hp, def('brimwell').hp);
    for (const id of ['old-governor', 'gnawgear', 'bellowbelly', 'hammerjaw']) expect(def(id).hp).toBeGreaterThan(ch1 * 1.5);
    for (const id of ['grandmother-gill', 'bramblehorn', 'hushwing', 'facetta']) expect(def(id).hp).toBeGreaterThan(def('old-governor').hp);
    // A chapter's second boss is in line with its first.
    expect(Math.abs(def('hammerjaw').hp - def('bellowbelly').hp)).toBeLessThanOrEqual(60);
    expect(Math.abs(def('facetta').hp - def('hushwing').hp)).toBeLessThanOrEqual(60);
    for (const id of MINI_IDS) expect(def(id).hp).toBeGreaterThan(def('pipewhip').hp * 1.5);
  });

  it('the three new pattern kinds are registered, validated and used by the pack', () => {
    const used = new Set<string>();
    for (const id of ALL_IDS) for (const ph of def(id).phases) for (const p of [...(ph.patterns ?? []), ...(ph.enter ? [ph.enter] : [])]) used.add(p.kind);
    for (const k of NEW_KINDS) {
      expect(BOSS_PATTERN_KINDS as readonly string[]).toContain(k);
      expect(PATTERNS[k as keyof typeof PATTERNS]).toBe(PATTERNS_B[k as keyof typeof PATTERNS_B]);
      expect(used.has(k), k).toBe(true);
      // Every param default sits inside its own range.
      for (const [name, [d, lo, hi]] of Object.entries(PATTERNS_B[k as keyof typeof PATTERNS_B].params)) {
        expect(d >= lo && d <= hi, `${k}.${name}`).toBe(true);
      }
    }
    // The pre-existing kinds keep their indices (events carry them).
    expect(BOSS_PATTERN_KINDS.indexOf('hook')).toBe(14);
    // Out-of-range params are caught.
    const bad: BossDef = { ...def('gnawgear'), id: 't-bad-b', phases: [{ at: 1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'gearSpokes', params: { arms: 40 } }, { kind: 'podBurst', params: { where: 7 } }] }, { at: 0.5, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'closingRing', params: { nope: 1 } }] }] };
    const errs = validateBossDef(bad, () => true).join('\n');
    expect(errs).toContain('arms=40');
    expect(errs).toContain('where=7');
    expect(errs).toContain('unknown param "nope"');
  });

  it('art: a sprite per phase look, same size and anchor, boss-sized, outlined, all frames distinct per look', () => {
    const all = artSprites();
    expect(all.length).toBe(25);
    for (const s of all) {
      expect(validateSpriteDef(s), s.id).toEqual([]);
      expect(s.frames.length, s.id).toBe(8);
      for (const a of ['idle', 'move', 'windup', 'roar', 'slam', 'air', 'hurt', 'charge']) expect(s.anims?.[a], `${s.id}.${a}`).toBeDefined();
      for (const f of s.frames) expect(f.join(''), s.id).toContain('o');
    }
    for (const id of ALL_IDS) {
      const d = def(id);
      const looks = BOSS_B_LOOKS[id]!;
      expect(looks.length, id).toBe(d.phases.length);
      expect(looks[0]).toBe(d.sprite);
      const min = d.kind === 'miniboss' ? 24 : 32;
      for (const s of looks) {
        expect(Math.max(s.w, s.h), s.id).toBeGreaterThanOrEqual(min);
        expect(Math.max(s.w, s.h), s.id).toBeLessThanOrEqual(d.kind === 'miniboss' ? 40 : 56);
        expect([s.w, s.h, s.anchorY]).toEqual([looks[0]!.w, looks[0]!.h, looks[0]!.anchorY]);
        expect(s.anchorY!).toBeGreaterThan(s.h * 0.5);
      }
      // Each phase looks different (not just a palette over the same pixels), and ids are unique.
      for (let i = 1; i < looks.length; i++) {
        expect(looks[i]!.id).not.toBe(looks[i - 1]!.id);
        expect(looks[i]!.frames[0]!.join('')).not.toBe(looks[i - 1]!.frames[0]!.join(''));
      }
    }
  });
});

describe('boss pack B: new pattern kinds', () => {
  function tester(kind: string, params: Record<string, number>, extra: Partial<BossDef> = {}): Sim {
    const id = `t-b-${kind}-${Object.values(params).join('-').replace(/\./g, 'p')}`;
    if (!BOSSES.has(id)) {
      registerBoss({
        id,
        name: id,
        kind: 'boss',
        chapters: ['frostbitten_vault'],
        hp: 900,
        size: 12,
        speed: 0,
        sprite: worksArt.GNAWGEAR_SPRITE,
        phases: [
          { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.05, 0.05], patterns: [{ kind: kind as BossPatternKind, params }] },
          { at: 0.1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
        ],
        ...extra,
      });
    }
    const sim = new Sim({ seed: 5, room: OPEN });
    sim.world.player.placeAt(52, 56);
    sim.startBossFight(id, 150, 56, { intro: false, minPhase: 0 });
    sim.world.godMode = true;
    return sim;
  }

  it('podBurst: marked pods land and burst into rings of shots, leaving puddles', () => {
    const sim = tester('podBurst', { windup: 0.3, count: 3, split: 6, air: 0.8, spread: 30, creep: 1, radius: 10, life: 4, stagger: 0.1 });
    let lobs = 0;
    let lands = 0;
    let maxCreep = 0;
    let straight = 0;
    for (let t = 0; t < 150; t++) {
      sim.world.player.placeAt(52, 56);
      sim.step(makeInput());
      const w = sim.world;
      let l = 0;
      let s = 0;
      for (let i = 0; i < w.enemyShots.count; i++) {
        if (w.enemyShots.items[i]!.lob) l++;
        else s++;
      }
      lobs = Math.max(lobs, l);
      straight = Math.max(straight, s);
      lands += eventCount(sim, 'lobLand');
      maxCreep = Math.max(maxCreep, w.creep.count);
    }
    expect(lobs).toBe(3);
    expect(lands).toBeGreaterThanOrEqual(3);
    expect(straight).toBeGreaterThanOrEqual(8);
    expect(maxCreep).toBeGreaterThanOrEqual(3);
  });

  it('closingRing: a ring forms round the target with a gap and closes in; with `edge` it starts at the walls', () => {
    const sim = tester('closingRing', { windup: 0.3, count: 16, radius: 50, hole: 3, speed: 14, accel: 110 });
    const w = sim.world;
    const px = 52;
    const py = 56;
    let first = -1;
    for (let t = 0; t < 60 && first < 0; t++) {
      w.player.placeAt(px, py);
      sim.step(makeInput());
      if (w.enemyShots.count > 0) first = t;
    }
    expect(first).toBeGreaterThan(0);
    // 16 - 3 = 13 shots on the circle (a few may fall outside the room), all heading inward.
    const n = w.enemyShots.count;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThanOrEqual(13);
    let inward = 0;
    for (let i = 0; i < n; i++) {
      const s = w.enemyShots.items[i]!;
      const d = Math.hypot(s.x - px, s.y - py);
      expect(d).toBeGreaterThan(40);
      expect(d).toBeLessThan(56);
      if ((px - s.x) * s.vx + (py - s.y) * s.vy > 0) inward++;
    }
    expect(inward).toBe(n);
    // They speed up as they close.
    const v0 = Math.hypot(w.enemyShots.items[0]!.vx, w.enemyShots.items[0]!.vy);
    stepN(sim, makeInput(), 12);
    if (w.enemyShots.count > 0) expect(Math.hypot(w.enemyShots.items[0]!.vx, w.enemyShots.items[0]!.vy)).toBeGreaterThan(v0 * 1.5);

    // Edge + an outward call first: shots fly out, then the echo appears near the walls.
    const echo = tester('closingRing', { windup: 0.3, center: 1, edge: 1, count: 20, hole: 3, out: 10, outSpeed: 90, delay: 0.5, speed: 14, accel: 90 });
    const ew = echo.world;
    let sawOut = false;
    let sawEcho = false;
    for (let t = 0; t < 120 && !sawEcho; t++) {
      echo.step(makeInput());
      if (!sawOut && ew.enemyShots.count >= 10) sawOut = true;
      if (sawOut && ew.enemyShots.count >= 18) {
        // The newest shots sit at the room's edge.
        let nearWall = 0;
        for (let i = 0; i < ew.enemyShots.count; i++) {
          const s = ew.enemyShots.items[i]!;
          if (s.x < 8 || s.y < 8 || s.x > ROOM_W - 8 || s.y > ROOM_H - 8) nearWall++;
        }
        if (nearWall >= 12) sawEcho = true;
      }
    }
    expect(sawOut).toBe(true);
    expect(sawEcho).toBe(true);
  });

  it('gearSpokes: each volley is arms × len shots along straight spokes at rising speeds', () => {
    const sim = tester('gearSpokes', { windup: 0.3, arms: 4, len: 3, step: 20, speed: 50, volleys: 2, gap: 0.5, turn: 15 });
    const w = sim.world;
    let t = 0;
    while (w.enemyShots.count === 0 && t++ < 80) sim.step(makeInput());
    expect(w.enemyShots.count).toBe(12);
    const speeds = new Set<number>();
    const angles = new Set<number>();
    for (let i = 0; i < w.enemyShots.count; i++) {
      const s = w.enemyShots.items[i]!;
      speeds.add(Math.round(Math.hypot(s.vx, s.vy)));
      angles.add(Math.round(Math.atan2(s.vy, s.vx) * 100));
    }
    expect([...speeds].sort((a, b) => a - b)).toEqual([50, 70, 90]);
    expect(angles.size).toBe(4);
    stepN(sim, makeInput(), 40);
    expect(w.counters.enemyShots).toBe(24);
  });
});

describe('boss pack B: pools and runs', () => {
  it('each chapter has its own bosses and both minibosses (union rule)', () => {
    expect(bossesInChapter('grinding_works', 'boss').map((b) => b.id).sort()).toEqual(['gnawgear', 'old-governor']);
    expect(bossesInChapter('rust_foundry', 'boss').map((b) => b.id).sort()).toEqual(['bellowbelly', 'hammerjaw']);
    expect(bossesInChapter('mushroom_hollow', 'boss').map((b) => b.id).sort()).toEqual(['bramblehorn', 'grandmother-gill']);
    expect(bossesInChapter('glimmer_grotto', 'boss').map((b) => b.id).sort()).toEqual(['facetta', 'hushwing']);
    for (const ch of CH34) {
      const minis = bossPool(ch, 'miniboss').map((b) => b.id);
      expect(minis, ch).toEqual(expect.arrayContaining([...MINI_IDS]));
    }
    // The Works' two floors show two different bosses.
    for (let seed = 1; seed <= 10; seed++) {
      const a = pickBoss(seed, 5, 'main', 'grinding_works', 'boss')!.id;
      const b = pickBoss(seed, 6, 'main', 'grinding_works', 'boss', a)!.id;
      expect(a).not.toBe(b);
    }
    // Minibosses scale on chapter 4's floors.
    // Every boss grows with depth (polish batch 4), home or borrowed.
    expect(bossHpFor(def('canshell'), 5)).toBe(Math.round(def('canshell').hp * (1 + 4 * BOSS_TUNING.hpPerFloor)));
    expect(bossHpFor(def('canshell'), 8)).toBeGreaterThan(bossHpFor(def('canshell'), 5));
  });

  it('a real run meets them in the boss room of each chapter', () => {
    const cases: [number, 'main' | 'alt', readonly string[]][] = [
      [5, 'main', ['old-governor', 'gnawgear']],
      [6, 'alt', ['bellowbelly', 'hammerjaw']],
      [7, 'main', ['grandmother-gill', 'bramblehorn']],
      [8, 'alt', ['hushwing', 'facetta']],
    ];
    for (const [floor, track, ids] of cases) {
      const sim = Sim.newRun(`b-run-${floor}`, { floor, track, curse: null });
      const run = sim.run!;
      sim.world.godMode = true;
      run.teleport(run.data.layout.boss);
      expect(sim.world.boss.active).toBe(true);
      expect(ids).toContain(sim.world.boss.id);
      expect(sim.world.boss.maxHp).toBe(bossHpFor(def(sim.world.boss.id), floor));
    }
  });
});

describe('boss pack B: headless god-mode fights', () => {
  for (const id of ALL_IDS) {
    const d = BOSSES.get(id)!;
    const limit = d.kind === 'miniboss' ? 90 : 150;
    it(`${d.name} falls within ${limit} s: every phase, its looks, in bounds, no NaN, shot cap respected`, () => {
      const sim = arena(id, 11, true);
      const w = sim.world;
      const looks = BOSS_B_LOOKS[id]!;
      const seenLooks = new Set<SpriteDef>();
      let maxShots = 0;
      let bad = '';
      const res = fightBoss(sim, limit * 60, () => {
        maxShots = Math.max(maxShots, w.enemyShots.count);
        const p = w.player;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'player NaN';
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (e.dead) continue;
          if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) bad = `${e.def.id} NaN`;
          if (e.x < -1 || e.y < -1 || e.x > ROOM_W + 1 || e.y > ROOM_H + 1) bad = `${e.def.id} out of the room at ${e.x.toFixed(1)},${e.y.toFixed(1)}`;
          if (e.boss && e.sprite) {
            seenLooks.add(e.sprite);
            // The look always matches the phase once the roar began.
            if (e.boss.introT <= 0 && e.sprite !== looks[Math.min(e.boss.phase, looks.length - 1)]) bad = `${id}: phase ${e.boss.phase} wears ${e.sprite.id}`;
          }
        }
        for (let i = 0; i < w.enemyShots.count; i++) {
          const s = w.enemyShots.items[i]!;
          if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) bad = 'shot NaN';
        }
      });
      expect(bad).toBe('');
      expect(res.won, `${id} after ${res.ticks} ticks`).toBe(true);
      expect(res.phase).toBe(d.phases.length - 1);
      expect(res.events.bossPhase).toBe(d.phases.length - 1);
      expect(res.events.bossDefeated).toBe(1);
      expect(res.patterns.size).toBeGreaterThanOrEqual(4);
      expect(seenLooks.size).toBe(looks.length);
      expect(maxShots).toBeGreaterThan(d.kind === 'miniboss' ? 12 : 20);
      expect(maxShots).toBeLessThanOrEqual(CAP_ENEMY_SHOTS);
      expect(w.enemies.count).toBe(0);
    });
  }

  it('with cover blocks in the room, walkers never end up inside a rock and nobody leaves the room', () => {
    for (const id of ALL_IDS) {
      const sim = arena(id, 23, false, COVER);
      const w = sim.world;
      let bad = '';
      fightBoss(sim, 45 * 60, () => {
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (e.dead || !e.boss) continue;
          if (e.x < 0 || e.y < 0 || e.x > ROOM_W || e.y > ROOM_H) bad = `${id} left the room`;
          if (!e.flying && !e.burrowed && e.z <= 0 && w.room.blocksShotsAt(Math.floor(e.x / 16), Math.floor(e.y / 16))) bad = `${id} inside a rock`;
        }
      });
      expect(bad).toBe('');
    }
  });

  it('fights are deterministic (same seed, same inputs → the same fight)', () => {
    const a = fightBoss(arena('hushwing', 'same'), 150 * 60);
    const b = fightBoss(arena('hushwing', 'same'), 150 * 60);
    expect(a.ticks).toBe(b.ticks);
    expect(a.events).toEqual(b.events);
  });

  it('a phase change swaps the look at once (during the roar) and damage never skips a phase', () => {
    const sim = arena('bellowbelly');
    stepN(sim, makeInput(), 30);
    const e = bossOf(sim);
    expect(e.sprite).toBe(foundryArt.BELLOWBELLY_SPRITE);
    e.hurt(1e6, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(sim.world.boss.phase).toBe(1);
    expect(e.boss!.invulnT).toBeGreaterThan(0);
    expect(e.sprite).toBe(foundryArt.BELLOWBELLY_RED_SPRITE);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 2);
    e.hurt(1e6, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(sim.world.boss.phase).toBe(2);
    expect(e.sprite).toBe(foundryArt.BELLOWBELLY_MELT_SPRITE);
    expect(e.dead).toBe(false);
  });

  it('shields and adds come from the chapter rosters; tethered Puffcaps burst into spores when popped', () => {
    const sim = arena('grandmother-gill');
    stepN(sim, makeInput(), 30);
    const e = bossOf(sim);
    e.hurt(e.maxHp * 0.36, SRC_PLAYER, 0, 0);
    stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 40);
    const shields = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => o.anchor === e.uid && !o.dead);
    expect(shields.length).toBe(4);
    for (const s of shields) expect(s.def.id).toBe('puffcap');
    const before = sim.world.counters.enemyShots;
    shields[0]!.hurt(1e3, SRC_PLAYER, 0, 0);
    sim.step(makeInput());
    expect(sim.world.counters.enemyShots).toBeGreaterThanOrEqual(before + 5);
    // Compiled once, cached.
    expect(compileBoss(def('grandmother-gill'))).toBe(compileBoss(def('grandmother-gill')));
  });
});
