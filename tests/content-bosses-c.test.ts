/**
 * Boss pack C (docs/content-bosses-c.md): the chapter 5-6 bosses and minibosses, their later-phase
 * sprites (boss hooks), the three new pattern kinds (dropLine, halo, ricochet), selection per chapter,
 * depth scaling, and headless god-mode fights through the real attack pipeline for every one of them.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, ENEMIES, bossesInChapter, registerBoss } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { BOSS_LOOKS_C, depthPace } from '../src/content/hooks/bosses-c';
import { validateSpriteDef } from '../src/content/sprites/validate';
import * as orchardSprites from '../src/content/sprites/bossesCOrchard';
import * as vaultSprites from '../src/content/sprites/bossesCVault';
import * as stormSprites from '../src/content/sprites/bossesCStorm';
import * as nestSprites from '../src/content/sprites/bossesCNest';
import { compileBoss } from '../src/sim/bosses/compile';
import { PATTERNS } from '../src/sim/bosses/patterns';
import { bossHpFor, bossPool, pickBoss } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { CAP_ENEMY_SHOTS, ROOM_H, ROOM_W } from '../src/sim/constants';
import type { Enemy } from '../src/sim/enemies/enemy';
import { SRC_PLAYER } from '../src/sim/hittable';
import { Sim } from '../src/sim/sim';
import { BOSS_TUNING } from '../src/sim/tuning';
import { BOSS_PATTERN_KINDS, type BossDef, type SpriteDef } from '../src/sim/types';
import { fightBoss } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];

const PACK_BOSSES = ['marrowbough', 'gloamkeeper', 'hoarquill', 'vaultwarden', 'squallvane', 'ambergut'] as const;
const PACK_MINIS = ['tatterjack', 'shiverwing', 'slagjacket'] as const;
const PACK = [...PACK_BOSSES, ...PACK_MINIS];
const NEW_KINDS = ['dropLine', 'halo', 'ricochet'] as const;

function def(id: string): BossDef {
  const d = BOSSES.get(id);
  if (!d) throw new Error(`no boss ${id}`);
  return d;
}

/** An open room, the player on the left, `id` on the right (optionally with its intro). */
function arena(id: string, seed: number | string = 7, intro = false, chapter?: string): Sim {
  const sim = new Sim({ seed, room: OPEN });
  if (chapter) sim.world.chapter = chapter;
  sim.world.player.placeAt(30, 56);
  expect(sim.startBossFight(id, 160, 56, { intro, minPhase: 0 })).not.toBeNull();
  return sim;
}

function bossParts(sim: Sim): Enemy[] {
  const out: Enemy[] = [];
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) out.push(pool.items[i]!);
  return out;
}

function events(sim: Sim, type: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === type) n++;
  return n;
}

/** A single-pattern test boss using one of the new kinds (registered once per id). */
function probeBoss(id: string, kind: (typeof NEW_KINDS)[number], params: Record<string, number>, extra: Partial<BossDef> = {}): string {
  if (!BOSSES.has(id)) {
    const d: BossDef = {
      id,
      name: id,
      kind: 'boss',
      chapters: ['gutterways'],
      hp: 2000,
      size: 12,
      speed: 0,
      sprite: vaultSprites.HOARQUILL_SPRITE,
      phases: [
        { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.2, 0.2], patterns: [{ kind, params }, { kind, params }] },
        { at: 0.1, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }, { kind: 'spiral' }] },
      ],
      ...extra,
    };
    registerBoss(d);
  }
  return id;
}

const ALL_SPRITES = [orchardSprites, vaultSprites, stormSprites, nestSprites].flatMap((m) => Object.values(m) as SpriteDef[]);

describe('pack C content', () => {
  it('validates: every boss / miniboss, ≥ 2 phases with several patterns, big multi-frame sprites', () => {
    expect(validateContent()).toEqual([]);
    for (const id of PACK) {
      const d = def(id);
      expect(validateBossDef(d, (e) => ENEMIES.has(e)), id).toEqual([]);
      expect(d.phases.length, id).toBeGreaterThanOrEqual(2);
      for (const ph of d.phases) expect((ph.patterns ?? []).length, `${id} ${ph.name ?? ''}`).toBeGreaterThanOrEqual(3);
      // The intro card's flavour line and the bestiary blurb fit their panels.
      expect(d.title!.length, id).toBeGreaterThan(10);
      expect(d.title!.length, id).toBeLessThanOrEqual(44);
      expect(d.title, id).toBe(d.title!.toUpperCase());
      expect(d.bestiary!.length, id).toBeGreaterThanOrEqual(40);
      expect(d.bestiary!.length, id).toBeLessThanOrEqual(110);
      expect(d.music, id).toBe(d.kind === 'miniboss' ? 'miniboss' : 'boss_undercurrent');
      if (d.kind === 'boss') expect(d.drops, id).toBe('bossSpill');
      const s = d.sprite as SpriteDef;
      expect(Math.max(s.w, s.h), id).toBeGreaterThanOrEqual(d.kind === 'miniboss' ? 24 : 32);
      expect(Math.max(s.w, s.h), id).toBeLessThanOrEqual(56);
    }
    expect(PACK_BOSSES.every((id) => def(id).kind === 'boss')).toBe(true);
    expect(PACK_MINIS.every((id) => def(id).kind === 'miniboss')).toBe(true);
  });

  it('every sprite (incl. the later-phase ones) is well-formed, boss-sized and animated', () => {
    expect(ALL_SPRITES.length).toBe(20);
    for (const s of ALL_SPRITES) {
      expect(validateSpriteDef(s), s.id).toEqual([]);
      expect(Math.max(s.w, s.h), s.id).toBeGreaterThanOrEqual(24);
      expect(Math.max(s.w, s.h), s.id).toBeLessThanOrEqual(56);
      expect(s.frames.length, s.id).toBeGreaterThanOrEqual(5);
      for (const a of ['idle', 'move', 'windup', 'roar', 'slam', 'air', 'charge', 'hurt']) expect(s.anims?.[a], `${s.id}.${a}`).toBeDefined();
      expect(s.anchorY!, s.id).toBeGreaterThan(s.h / 2);
      expect(s.anchorY!, s.id).toBeLessThan(s.h);
    }
    // Sprite ids are unique.
    expect(new Set(ALL_SPRITES.map((s) => s.id)).size).toBe(ALL_SPRITES.length);
  });

  it('each boss wears a visibly different sprite in its later phases', () => {
    for (const id of PACK) {
      const d = def(id);
      const look = BOSS_LOOKS_C.get(d.hook!);
      expect(look, id).toBeDefined();
      expect(look!.sprites[0], id).toBe(d.sprite);
      expect(look!.sprites.length, id).toBe(d.phases.length === 3 ? 3 : 2);
      expect(look!.home, id).toBe(d.chapters[0]);
      for (let i = 1; i < look!.sprites.length; i++) {
        const a = look!.sprites[i - 1]!;
        const b = look!.sprites[i]!;
        expect(b.id, id).not.toBe(a.id);
        // Different art (not just a recolour of the same rows) or a different palette.
        const differs = JSON.stringify(b.frames) !== JSON.stringify(a.frames) || JSON.stringify(b.palette) !== JSON.stringify(a.palette);
        expect(differs, `${id} phase ${i}`).toBe(true);
      }
      // Every later phase also brings a colour shift and a speed-up.
      for (let i = 1; i < d.phases.length; i++) {
        expect(d.phases[i]!.tint, `${id} phase ${i}`).toMatch(/^#[0-9a-f]{6}$/i);
        expect(d.phases[i]!.pace ?? 1, `${id} phase ${i}`).toBeGreaterThan(d.phases[i - 1]!.pace ?? 1);
      }
    }
  });

  it('display names are original and unique', () => {
    const names = new Map<string, string>();
    for (const d of BOSSES.values()) names.set(d.name.toLowerCase(), d.id);
    for (const e of ENEMIES.values()) {
      for (const id of PACK) expect(e.name.toLowerCase(), id).not.toBe(def(id).name.toLowerCase());
    }
    for (const id of PACK) expect(names.get(def(id).name.toLowerCase())).toBe(id);
  });

  it('the new pattern kinds are registered and used; later phases escalate', () => {
    for (const k of NEW_KINDS) {
      expect(BOSS_PATTERN_KINDS).toContain(k);
      expect(PATTERNS[k], k).toBeDefined();
    }
    const used = new Set<string>();
    for (const id of PACK) for (const ph of def(id).phases) for (const p of [...(ph.patterns ?? []), ...(ph.enter ? [ph.enter] : [])]) used.add(p.kind);
    for (const k of NEW_KINDS) expect(used.has(k), k).toBe(true);
    // Deeper chapters: denser and faster than the Gutterways bosses.
    const shots = (id: string): number =>
      Math.max(...def(id).phases.flatMap((ph) => (ph.patterns ?? []).filter((p) => p.kind === 'ring').map((p) => p.params?.count ?? 12)), 0);
    expect(Math.max(...PACK_BOSSES.map(shots))).toBeGreaterThan(shots('brimwell'));
    const maxPace = (id: string): number => Math.max(...def(id).phases.map((ph) => ph.pace ?? 1));
    expect(maxPace('squallvane')).toBeGreaterThan(maxPace('brimwell'));
    expect(maxPace('ambergut')).toBeGreaterThan(maxPace('sodden-snarl'));
  });
});

describe('selection', () => {
  it('chapters 5-6 have their own bosses and minibosses; the Rust Foundry and the Glimmer Grotto get a miniboss', () => {
    const ids = (ch: string, kind: BossDef['kind']): string[] => bossPool(ch, kind).map((d) => d.id);
    expect(ids('bone_orchard', 'boss')).toEqual(expect.arrayContaining(['marrowbough', 'gloamkeeper']));
    expect(ids('frostbitten_vault', 'boss')).toEqual(expect.arrayContaining(['hoarquill', 'vaultwarden']));
    expect(ids('eye_of_storm', 'boss')).toContain('squallvane');
    expect(ids('hollow_nest', 'boss')).toContain('ambergut');
    // The finals never enter the regular pools.
    expect(ids('eye_of_storm', 'boss')).not.toContain('old-thunderhead');
    expect(ids('hollow_nest', 'boss')).not.toContain('nestmother');
    expect(bossesInChapter('bone_orchard', 'miniboss').map((d) => d.id)).toContain('tatterjack');
    expect(bossesInChapter('eye_of_storm', 'miniboss').map((d) => d.id)).toContain('tatterjack');
    expect(bossesInChapter('frostbitten_vault', 'miniboss').map((d) => d.id)).toContain('shiverwing');
    expect(bossesInChapter('glimmer_grotto', 'miniboss').map((d) => d.id)).toContain('shiverwing');
    expect(bossesInChapter('hollow_nest', 'miniboss').map((d) => d.id)).toContain('slagjacket');
    expect(bossesInChapter('rust_foundry', 'miniboss').map((d) => d.id)).toContain('slagjacket');
  });

  it('a chapter-5 run shows two different pack-C bosses on its two floors; floor 11 gets its own boss', () => {
    for (const [track, pair] of [
      ['main', ['marrowbough', 'gloamkeeper']],
      ['alt', ['hoarquill', 'vaultwarden']],
    ] as const) {
      for (let seed = 1; seed <= 6; seed++) {
        const s9 = Sim.newRun(seed, { floor: 9, track, curse: null });
        const a = s9.run!.data.rooms[s9.run!.data.layout.boss]!.boss;
        expect(pair as readonly string[]).toContain(a);
        expect(pickBoss(s9.seed, 9, track, track === 'main' ? 'bone_orchard' : 'frostbitten_vault', 'boss')!.id).toBe(a);
        s9.run!.skipFloor();
        const b = s9.run!.data.rooms[s9.run!.data.layout.boss]!.boss;
        expect(pair as readonly string[]).toContain(b);
        expect(b).not.toBe(a);
      }
    }
    expect(Sim.newRun(3, { floor: 11, track: 'main', curse: null }).run!.data.rooms.find((r) => r.boss !== '' && BOSSES.get(r.boss)?.kind === 'boss')!.boss).toBe(
      'squallvane',
    );
    expect(Sim.newRun(3, { floor: 11, track: 'alt', curse: null }).run!.data.rooms.find((r) => r.boss !== '' && BOSSES.get(r.boss)?.kind === 'boss')!.boss).toBe(
      'ambergut',
    );
  });

  it('HP follows depth: every boss grows per floor (polish batch 4), deeper means more', () => {
    const at = (id: string, f: number) => Math.round(def(id).hp * (1 + BOSS_TUNING.hpPerFloor * (f - 1)));
    expect(bossHpFor(def('marrowbough'), 9)).toBe(at('marrowbough', 9));
    expect(bossHpFor(def('ambergut'), 11)).toBe(at('ambergut', 11));
    expect(bossHpFor(def('slagjacket'), 5)).toBe(at('slagjacket', 5));
    expect(bossHpFor(def('slagjacket'), 11)).toBeGreaterThan(bossHpFor(def('slagjacket'), 5) * 1.3);
    expect(bossHpFor(def('shiverwing'), 9)).toBeGreaterThan(def('shiverwing').hp);
    expect(bossHpFor(def('tatterjack'), 11)).toBeGreaterThan(def('tatterjack').hp);
  });

  it('depth pace: a miniboss met deeper than its home chapter runs faster; bosses at home are unchanged', () => {
    expect(depthPace('rust_foundry', 'rust_foundry')).toBe(1);
    expect(depthPace('rust_foundry', 'hollow_nest')).toBeCloseTo(1.18, 5);
    expect(depthPace('glimmer_grotto', 'frostbitten_vault')).toBeCloseTo(1.06, 5);
    expect(depthPace('eye_of_storm', 'gutterways')).toBe(0.85);
    expect(depthPace('bone_orchard', 'nowhere')).toBe(1);
    const home = arena('slagjacket', 5, false, 'rust_foundry');
    const deep = arena('slagjacket', 5, false, 'hollow_nest');
    stepN(home, makeInput(), 40);
    stepN(deep, makeInput(), 40);
    const ph = compileBoss(def('slagjacket')).phases[0]!.pace;
    expect(bossParts(home)[0]!.boss!.pace).toBeCloseTo(ph, 6);
    expect(bossParts(deep)[0]!.boss!.pace).toBeCloseTo(ph * 1.18, 6);
  });
});

describe('the new pattern kinds', () => {
  it('dropLine (aimed): marked drops march in fanned lines from the boss toward the target', () => {
    const id = probeBoss('t-c-dropline', 'dropLine', { windup: 0.3, lines: 3, fan: 30, count: 5, spacing: 18, step: 0.1, air: 0.8, look: 0 });
    const sim = arena(id, 3);
    stepN(sim, makeInput(), 30);
    const lobs = new Set<string>();
    let bossTell = 0;
    for (let t = 0; t < 60; t++) {
      sim.world.player.placeAt(30, 56);
      sim.step(makeInput());
      bossTell += events(sim, 'bossTell');
      const shots = sim.world.enemyShots;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        if (s.lob) lobs.add(`${Math.round(s.tx)},${Math.round(s.ty)}`);
      }
    }
    expect(bossTell).toBeGreaterThanOrEqual(1);
    expect(lobs.size).toBe(15);
    // The middle line points at the player (left of the boss, same height).
    const pts = [...lobs].map((k) => k.split(',').map(Number) as [number, number]);
    expect(pts.filter(([, y]) => Math.abs(y - 56) < 3).length).toBeGreaterThanOrEqual(5);
    expect(pts.every(([x]) => x < 160)).toBe(true);
  });

  it('dropLine (cross / X, lightning): strikes spread out from where the target stood', () => {
    const id = probeBoss('t-c-cross', 'dropLine', { windup: 0.3, layout: 1, count: 4, spacing: 16, step: 0.08, air: 0.7, look: 2 });
    const sim = arena(id, 4);
    stepN(sim, makeInput(), 30);
    const spots = new Set<string>();
    let bolts = 0;
    for (let t = 0; t < 70; t++) {
      sim.world.player.placeAt(80, 56);
      sim.step(makeInput());
      const shots = sim.world.enemyShots;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        if (s.lob && s.fall === 2) {
          spots.add(`${Math.round(s.tx)},${Math.round(s.ty)}`);
          bolts++;
        }
      }
    }
    expect(bolts).toBeGreaterThan(0);
    // 1 centre + 4 arms × 3 steps, all on the row or the column through (80, 56).
    expect(spots.size).toBe(13);
    for (const k of spots) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      expect(Math.abs(x - 80) < 1 || Math.abs(y - 56) < 1, k).toBe(true);
    }
  });

  it('halo: shots circle the boss, then let go outward / converging / as one formation', () => {
    for (const aim of [0, 1, 2]) {
      const id = probeBoss(`t-c-halo${aim}`, 'halo', { windup: 0.2, count: 8, radius: 24, spin: 2.5, hold: 1, speed: 90, aim });
      const sim = arena(id, 5);
      const e = bossParts(sim)[0]!;
      stepN(sim, makeInput(), 30);
      // Orbit: after the telegraph, 8 shots at ≈ 24 px from where the boss stands.
      let orbit = 0;
      for (let t = 0; t < 40 && orbit === 0; t++) {
        sim.world.player.placeAt(30, 56);
        sim.step(makeInput());
        if (sim.world.enemyShots.count >= 8) orbit = t;
      }
      expect(orbit).toBeGreaterThan(0);
      stepN(sim, makeInput(), 20);
      const shots = sim.world.enemyShots;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        expect(Math.hypot(s.x - e.x, s.y - e.y), `aim ${aim}`).toBeGreaterThan(18);
        expect(Math.hypot(s.x - e.x, s.y - e.y), `aim ${aim}`).toBeLessThan(30);
        expect(s.curve).not.toBe(0);
      }
      // Released after `hold`.
      stepN(sim, makeInput(), 50);
      let n = 0;
      let parallel = 0;
      let inward = 0;
      for (let i = 0; i < shots.count; i++) {
        const s = shots.items[i]!;
        if (s.lob) continue;
        n++;
        expect(s.curve).toBe(0);
        const vx = s.vx / Math.hypot(s.vx, s.vy);
        const vy = s.vy / Math.hypot(s.vx, s.vy);
        const rx = (s.x - e.x) / Math.hypot(s.x - e.x, s.y - e.y);
        const ry = (s.y - e.y) / Math.hypot(s.x - e.x, s.y - e.y);
        if (vx * rx + vy * ry < 0.5) inward++;
        if (vx < -0.99) parallel++;
      }
      expect(n, `aim ${aim}`).toBeGreaterThanOrEqual(6);
      if (aim === 0) expect(inward, 'outward').toBe(0);
      if (aim === 2) expect(parallel, 'formation').toBe(n);
      if (aim === 1) expect(inward, 'converging').toBeGreaterThan(0);
    }
  });

  it('ricochet: a telegraphed roll that bounces off the walls, bursts shots, then bonks to a stop', () => {
    const id = probeBoss('t-c-ricochet', 'ricochet', { windup: 0.4, speed: 200, bounces: 3, ring: 6, ringSpeed: 70, stun: 0.5 });
    const sim = arena(id, 6);
    const e = bossParts(sim)[0]!;
    stepN(sim, makeInput(), 30);
    let tell = 0;
    let bonks = 0;
    let slams = 0;
    let shotsFired = 0;
    let lineSeen = false;
    for (let t = 0; t < 360; t++) {
      sim.world.player.placeAt(30, 56);
      sim.step(makeInput());
      tell += events(sim, 'bossTell');
      bonks += events(sim, 'bonk');
      slams += events(sim, 'bossSlam');
      shotsFired += events(sim, 'enemyShoot');
      if (e.boss!.tellLine) lineSeen = true;
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.x).toBeLessThanOrEqual(ROOM_W);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeLessThanOrEqual(ROOM_H);
    }
    expect(tell).toBeGreaterThanOrEqual(1);
    expect(lineSeen).toBe(true);
    expect(bonks).toBeGreaterThanOrEqual(3);
    expect(slams).toBeGreaterThanOrEqual(1);
    expect(shotsFired).toBeGreaterThanOrEqual(4);
  });
});

describe('phases and looks in a fight', () => {
  it('the later-phase sprite goes on with the roar; the Ambergut takes wing when it hatches', () => {
    for (const id of PACK) {
      const d = def(id);
      const look = BOSS_LOOKS_C.get(d.hook!)!;
      const sim = arena(id, 9, true);
      // Past the spawn poof and the intro card.
      stepN(sim, makeInput(), Math.ceil((BOSS_TUNING.intro + 0.4) * 60) + 10);
      let e = bossParts(sim)[0]!;
      expect(e.sprite, id).toBe(look.sprites[0]);
      for (let ph = 1; ph < d.phases.length; ph++) {
        e = bossParts(sim)[0]!;
        e.hurt(1e6, SRC_PLAYER, 0, 0);
        sim.step(makeInput());
        expect(sim.world.boss.phase, id).toBe(ph);
        expect(bossParts(sim).every((p) => p.sprite === look.sprites[Math.min(ph, look.sprites.length - 1)]), `${id} phase ${ph}`).toBe(true);
        stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 4);
      }
      if (id === 'ambergut') expect(bossParts(sim)[0]!.flying).toBe(true);
    }
  });
});

describe('headless god-mode fights (the real attack pipeline)', () => {
  for (const id of PACK) {
    const d = BOSSES.get(id)!;
    const limit = d.kind === 'miniboss' ? 90 : 150;
    it(`${d.name} falls within ${limit} s: every phase, several patterns, in bounds, no NaN, shots under the cap`, () => {
      const sim = arena(id, 11, true, d.chapters[0]);
      let peak = 0;
      let bad = '';
      const res = fightBoss(sim, limit * 60, () => {
        const w = sim.world;
        peak = Math.max(peak, w.enemyShots.count);
        for (let i = 0; i < w.enemies.count; i++) {
          const o = w.enemies.items[i]!;
          if (o.dead) continue;
          if (!Number.isFinite(o.x) || !Number.isFinite(o.y) || !Number.isFinite(o.hp)) bad ||= `NaN enemy ${o.def.id}`;
          if (o.x < 0 || o.y < 0 || o.x > ROOM_W || o.y > ROOM_H) bad ||= `${o.def.id} out of bounds (${o.x.toFixed(1)}, ${o.y.toFixed(1)})`;
        }
        for (let i = 0; i < w.enemyShots.count; i++) {
          const s = w.enemyShots.items[i]!;
          if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) bad ||= 'NaN shot';
        }
        if (!Number.isFinite(w.boss.hp)) bad ||= 'NaN fight hp';
      });
      expect(bad).toBe('');
      expect(res.won).toBe(true);
      expect(res.phase).toBe(d.phases.length - 1);
      expect(res.events.bossDefeated).toBe(1);
      expect(res.events.bossPhase).toBe(d.phases.length - 1);
      expect(res.patterns.size).toBeGreaterThanOrEqual(3);
      expect(peak).toBeLessThan(CAP_ENEMY_SHOTS * 0.6);
      expect(sim.world.enemies.count).toBe(0);
      expect(sim.world.enemyShots.count).toBe(0);
    });
  }

  it('a fight with the new patterns is deterministic (same seed, same inputs → same fight)', () => {
    const a = fightBoss(arena('squallvane', 'same-c'), 150 * 60);
    const b = fightBoss(arena('squallvane', 'same-c'), 150 * 60);
    expect(a.ticks).toBe(b.ticks);
    expect(a.events).toEqual(b.events);
  });

  it('in a real run: a floor-9 boss room fights, drops the reward and opens the trapdoor', () => {
    const sim = Sim.newRun(21, { floor: 9, track: 'main', curse: null });
    const run = sim.run!;
    sim.world.godMode = true;
    run.teleport(run.data.layout.boss);
    expect(['marrowbough', 'gloamkeeper']).toContain(sim.world.boss.id);
    expect(sim.world.boss.chapter).toBe('The Bone Orchard');
    // A floor-9 boss has floor-9 HP (polish batch 4: ×2.1): Wren gets a floor-9 sort of build for it.
    for (const id of ['brick-chip', 'brick-chip', 'brick-chip', 'wind-up-crank', 'wind-up-crank', 'kite-string']) sim.giveItem(id);
    const res = fightBoss(sim, 150 * 60);
    expect(res.won).toBe(true);
    stepN(sim, makeInput(), 3);
    expect(sim.world.trapdoor.active).toBe(true);
    expect(run.data.stats.bossesBeaten).toBe(1);
  });
});
