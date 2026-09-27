/**
 * The three final bosses (content/bosses/finals.ts): their data and looks, headless god-mode fights with the
 * real attack pipeline (every phase, the send-off, bounds, NaN, shot caps, determinism), the finals' pattern
 * kinds (sim/bosses/patterns-finals.ts) one by one, and their per-boss code (content/hooks/bosses-finals.ts:
 * Thunderhead's looming drift and blackout, the Undertow's pull, the phase looks, the death sequences).
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { BOSSES, registerBoss } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { SRC_HAZARD as HOOK_SRC_HAZARD, UNDERTOW_PULL } from '../src/content/hooks/bosses-finals';
import { NESTMOTHER_PHASES } from '../src/content/sprites/finals-nestmother';
import { THUNDERHEAD_PHASES } from '../src/content/sprites/finals-thunderhead';
import { UNDERTOW_PHASES } from '../src/content/sprites/finals-undertow';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { recomputeAttack } from '../src/sim/attack/recomputeAttack';
import { hasBossHook } from '../src/sim/bosses/hooks';
import { PATTERNS } from '../src/sim/bosses/patterns';
import { FINALS_PATTERN_KINDS, crushCrates } from '../src/sim/bosses/patterns-finals';
import { finalBossDef } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { CAP_ENEMIES, CAP_ENEMY_SHOTS, ROOM_COLS, ROOM_H, ROOM_W, TILE } from '../src/sim/constants';
import type { Enemy } from '../src/sim/enemies/enemy';
import { SRC_HAZARD, SRC_PLAYER } from '../src/sim/hittable';
import { Sim } from '../src/sim/sim';
import { Tile } from '../src/sim/tiles';
import { BOSS_TUNING } from '../src/sim/tuning';
import { BOSS_PATTERN_KINDS, type BossDef, type BossPatternSpec, type SpriteDef } from '../src/sim/types';
import { fightBoss } from './helpers/bossBot';
import { makeInput, stepN } from './helpers/sim';

const OPEN = ['.............', '.............', '.............', '.............', '.............', '.............', '.............'];
const FINALS = ['old-thunderhead', 'nestmother', 'undertow'] as const;
const LOOKS: Record<string, readonly SpriteDef[]> = {
  'old-thunderhead': THUNDERHEAD_PHASES,
  nestmother: NESTMOTHER_PHASES,
  undertow: UNDERTOW_PHASES,
};

function arena(id: string, seed: number | string = 7, intro = false, px = 30, py = 56, bx = 160, by = 56): Sim {
  const sim = new Sim({ seed, room: OPEN });
  sim.world.player.placeAt(px, py);
  const e = sim.startBossFight(id, bx, by, { intro, minPhase: 0 });
  expect(e).not.toBeNull();
  return sim;
}

function boss(sim: Sim): Enemy {
  const pool = sim.world.enemies;
  for (let i = 0; i < pool.count; i++) if (pool.items[i]!.boss && !pool.items[i]!.dead) return pool.items[i]!;
  throw new Error('no boss');
}

function count(sim: Sim, type: string): number {
  let n = 0;
  for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === type) n++;
  return n;
}

/** Down to just past the next phase threshold (once the boss is up and not roaring), then through the roar. */
function nextPhase(sim: Sim): void {
  const f = sim.world.boss;
  const e = boss(sim);
  for (let t = 0; t < 300 && (e.spawnT > 0 || e.boss!.invulnT > 0); t++) sim.step(makeInput());
  const want = f.phase + 1;
  e.hurt(f.hp - f.marks[want]! * f.maxHp + 1, SRC_PLAYER, 0, 0);
  sim.step(makeInput());
  expect(f.phase).toBe(want);
  for (let t = 0; t < 300 && e.boss!.invulnT > 0; t++) sim.step(makeInput());
  sim.step(makeInput());
}

/** A one-pattern test boss (idle, never hurt by the clock) in an open room. */
let testBosses = 0;
function patternBoss(spec: BossPatternSpec, extra: Partial<BossDef> = {}): string {
  const id = `t-finals-${++testBosses}`;
  registerBoss({
    id,
    name: `Finals Test ${testBosses}`,
    kind: 'boss',
    chapters: ['eye_of_storm'],
    hp: 5000,
    size: 12,
    speed: 0,
    flying: true,
    sprite: THUNDERHEAD_PHASES[0]!,
    shot: 'water',
    phases: [
      { at: 1, move: { kind: 'idle' }, attacks: [], rest: [0.05, 0.05], patterns: [spec] },
      { at: 0.01, move: { kind: 'idle' }, attacks: [], patterns: [{ kind: 'ring' }] },
    ],
    ...extra,
  });
  return id;
}

/** Steps until the boss is running a pattern whose telegraph is over (or `max` ticks). */
function untilPattern(sim: Sim, max = 200): void {
  for (let t = 0; t < max; t++) {
    sim.step(makeInput());
    const b = boss(sim).boss!;
    if (b.pat && b.mode > 0) return;
  }
}

describe('final bosses: content', () => {
  it('validate, and keep their ids, final keys, endings, themes and loot', () => {
    expect(validateContent()).toEqual([]);
    const keys = { 'old-thunderhead': ['thunderhead', 1, 'final_thunderhead'], nestmother: ['nestmother', 2, 'final_nestmother'], undertow: ['undertow', 3, 'final_undertow'] } as const;
    for (const id of FINALS) {
      const d = BOSSES.get(id)!;
      expect(validateBossDef(d, () => true), id).toEqual([]);
      expect(d.kind).toBe('final');
      expect(d.final).toBe(keys[id][0]);
      expect(d.ending).toBe(keys[id][1]);
      expect(d.music).toBe(keys[id][2]);
      expect(finalBossDef(keys[id][0])?.id).toBe(id);
      expect(d.drops).toBe('bossSpill');
      expect(d.title!.length).toBeGreaterThan(8);
      expect(d.bestiary!.length).toBeGreaterThan(40);
      expect(hasBossHook(d.hook!)).toBe(true);
      // Tuned for the end of the game: the toughest bosses there are.
      expect(d.hp).toBeGreaterThanOrEqual(1400);
      for (const o of BOSSES.values()) if (o.kind !== 'final') expect(d.hp, `${id} vs ${o.id}`).toBeGreaterThan(o.hp);
    }
    expect(BOSSES.get('old-thunderhead')!.phases.length).toBe(3);
    expect(BOSSES.get('nestmother')!.phases.length).toBe(3);
    expect(BOSSES.get('undertow')!.phases.length).toBe(4);
  });

  it('every phase runs several patterns, and later phases are faster', () => {
    for (const id of FINALS) {
      const d = BOSSES.get(id)!;
      let pace = 0;
      d.phases.forEach((ph, i) => {
        expect((ph.patterns ?? []).length, `${id} phase ${i}`).toBeGreaterThanOrEqual(4);
        expect(ph.pace ?? 1).toBeGreaterThanOrEqual(pace);
        pace = ph.pace ?? 1;
        if (i > 0) expect(ph.enter, `${id} phase ${i} enter`).toBeDefined();
      });
    }
  });

  it('has a big look of its own for every phase (same anchor, several frames, all the poses)', () => {
    for (const id of FINALS) {
      const looks = LOOKS[id]!;
      const d = BOSSES.get(id)!;
      expect(looks.length).toBe(d.phases.length);
      expect(d.sprite).toBe(looks[0]);
      const seen = new Set<string>();
      for (const s of looks) {
        expect(validateSpriteDef(s), s.id).toEqual([]);
        expect(Math.max(s.w, s.h)).toBeGreaterThanOrEqual(48);
        expect(Math.max(s.w, s.h)).toBeLessThanOrEqual(56);
        expect(s.frames.length).toBeGreaterThanOrEqual(7);
        for (const a of ['idle', 'move', 'windup', 'roar', 'slam', 'air', 'hurt']) expect(s.anims?.[a], `${s.id}.${a}`).toBeDefined();
        expect(s.anchorY).toBe(looks[0]!.anchorY);
        // Each phase looks different (not just a recolour of the same pixels).
        const shape = s.frames[0]!.map((r) => r.replace(/[^.]/g, '#')).join('|');
        seen.add(`${shape}::${JSON.stringify(s.palette)}`);
      }
      expect(seen.size).toBe(looks.length);
      // The silhouettes of the first and last phases differ, not just the colours.
      const first = looks[0]!.frames[0]!.map((r) => r.replace(/[^.]/g, '#')).join('|');
      const last = looks[looks.length - 1]!.frames[0]!.map((r) => r.replace(/[^.]/g, '#')).join('|');
      expect(first).not.toBe(last);
    }
  });

  it('registers its pattern kinds, all of them used by the finals', () => {
    const used = new Set<string>();
    for (const id of FINALS) {
      for (const ph of BOSSES.get(id)!.phases) {
        for (const p of ph.patterns ?? []) used.add(p.kind);
        if (ph.enter) used.add(ph.enter.kind);
        for (const p of [...(ph.patterns ?? []), ...(ph.enter ? [ph.enter] : [])]) {
          if (p.kind === 'brood') expect(p.enemy, 'brood needs an enemy').toBeDefined();
        }
      }
    }
    for (const k of FINALS_PATTERN_KINDS) {
      expect(BOSS_PATTERN_KINDS as readonly string[]).toContain(k);
      expect(PATTERNS[k], k).toBeDefined();
      expect(used.has(k), k).toBe(true);
    }
  });

  it("hurts its own adds with the sim's hazard source (no kill credit)", () => {
    expect(HOOK_SRC_HAZARD).toBe(SRC_HAZARD);
  });
});

describe('final bosses: headless god-mode fights (real attack pipeline)', () => {
  for (const id of FINALS) {
    it(`${id}: every phase, a new look each time, the send-off; in bounds, no NaN, shots under the cap`, () => {
      const def = BOSSES.get(id)!;
      const sim = arena(id, 11, true);
      const w = sim.world;
      const e0 = boss(sim);
      let maxShots = 0;
      let maxEnemies = 0;
      let bad = '';
      let dyingAt = -1;
      let defeatedAt = -1;
      let tick = 0;
      const looks = new Set<SpriteDef>();
      const res = fightBoss(sim, 300 * 60, () => {
        tick++;
        maxShots = Math.max(maxShots, w.enemyShots.count);
        maxEnemies = Math.max(maxEnemies, w.enemies.count);
        const p = w.player;
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.y < 0 || p.x > ROOM_W || p.y > ROOM_H) bad ||= `player ${p.x},${p.y}`;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.items[i]!;
          if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp) || e.x < 0 || e.y < 0 || e.x > ROOM_W || e.y > ROOM_H) bad ||= `${e.def.id} ${e.x},${e.y} hp ${e.hp}`;
        }
        for (let i = 0; i < w.enemyShots.count; i++) {
          const s = w.enemyShots.items[i]!;
          if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.vx) || !Number.isFinite(s.vy)) bad ||= `shot ${s.x},${s.y}`;
        }
        if (e0.alive && e0.boss && !e0.dead && e0.boss.invulnT <= 0 && e0.sprite) looks.add(e0.sprite);
        if (count(sim, 'bossDying') > 0) dyingAt = tick;
        if (count(sim, 'bossDefeated') > 0) defeatedAt = tick;
      });
      expect(bad).toBe('');
      expect(res.won).toBe(true);
      expect(res.phase).toBe(def.phases.length - 1);
      expect(res.events.bossPhase).toBe(def.phases.length - 1);
      expect(res.events.bossDefeated).toBe(1);
      expect(res.patterns.size).toBeGreaterThanOrEqual(6);
      expect(looks.size).toBe(def.phases.length);
      expect(maxShots).toBeLessThanOrEqual(CAP_ENEMY_SHOTS);
      expect(maxShots).toBeLessThan(250);
      expect(maxEnemies).toBeLessThan(CAP_ENEMIES / 3);
      // The send-off lasts longer than an ordinary boss's.
      expect(defeatedAt - dyingAt).toBeGreaterThan(BOSS_TUNING.deathTime * 60 + 30);
      expect(w.enemies.count).toBe(0);
      expect(w.curse).toBe(null);
    });
  }

  it('a floor-12-ish build (4× damage) finishes each in about a minute or less', () => {
    for (const id of FINALS) {
      const sim = arena(id, 5, true);
      sim.world.player.stats.damage *= 4;
      recomputeAttack(sim.world.player);
      const res = fightBoss(sim, 150 * 60);
      expect(res.won, id).toBe(true);
      expect(res.ticks / 60, id).toBeGreaterThan(25);
      expect(res.ticks / 60, id).toBeLessThan(100);
    }
  });

  it('a fight is deterministic', () => {
    for (const id of FINALS) {
      const a = fightBoss(arena(id, 'same'), 300 * 60);
      const b = fightBoss(arena(id, 'same'), 300 * 60);
      expect(a.ticks).toBe(b.ticks);
      expect(a.events).toEqual(b.events);
    }
  });

  it('a snapshot taken in a final boss room replays the fight identically', () => {
    for (const [floor, track] of [
      [12, 'main'],
      [12, 'alt'],
      [13, 'main'],
    ] as const) {
      const a = Sim.newRun(`finals-snap-${floor}-${track}`, { floor, track, curse: null });
      a.world.godMode = true;
      a.run!.teleport(a.run!.data.layout.boss);
      expect(BOSSES.get(a.run!.state.boss)?.kind).toBe('final');
      const b = Sim.fromSnapshot(a.snapshot());
      const ra = fightBoss(a, 60 * 25);
      const rb = fightBoss(b, 60 * 25);
      expect(rb.ticks).toBe(ra.ticks);
      expect(JSON.stringify(b.summary())).toBe(JSON.stringify(a.summary()));
      expect(Array.from(b.world.room.tiles)).toEqual(Array.from(a.world.room.tiles));
    }
  });

  it('in a real run each still ends with its ending once the send-off is over', () => {
    for (const [floor, track, ending] of [
      [12, 'main', 1],
      [12, 'alt', 2],
      [13, 'main', 3],
    ] as const) {
      const sim = Sim.newRun(33, { floor, track, curse: null });
      sim.world.godMode = true;
      sim.run!.teleport(sim.run!.data.layout.boss);
      stepN(sim, makeInput(), 150);
      const f = sim.world.boss;
      // Each phase must be fought for BOSS_TUNING.minPhaseFinal s before a blow can end it (polish batch 4).
      const wait = Math.ceil((BOSS_TUNING.phaseInvuln + BOSS_TUNING.minPhaseFinal) * 60) + 3;
      for (let i = 0; i < 8 && !f.dying; i++) {
        boss(sim).hurt(1e6, SRC_PLAYER, 0, 0);
        for (let t = 0; t < wait && !f.dying; t++) sim.step(makeInput());
      }
      expect(f.dying).toBe(true);
      let end = -1;
      for (let t = 0; t < 60 * 8 && end < 0; t++) {
        sim.step(makeInput());
        for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'runEnd') end = sim.events.at(i).b;
      }
      expect(end).toBe(ending);
      expect(sim.run!.data.won).toBe(1);
    }
  });
});

describe('Old Thunderhead', () => {
  it('looms along the top of the room and never settles on top of her', () => {
    const sim = arena('old-thunderhead', 3, false, 104, 90, 104, 60);
    const e = boss(sim);
    let minD = Infinity;
    let high = 0;
    for (let t = 0; t < 60 * 12; t++) {
      sim.world.player.placeAt(40 + ((t >> 6) % 4) * 40, 90);
      sim.step(makeInput());
      if (t > 120) {
        minD = Math.min(minD, Math.hypot(e.x - sim.world.player.x, e.y - sim.world.player.y));
        if (e.y < 48) high++;
      }
    }
    expect(minD).toBeGreaterThan(36);
    expect(high / (60 * 12 - 121)).toBeGreaterThan(0.8);
  });

  it('its gust shoves her across the room while it blows', () => {
    const sim = arena('old-thunderhead', 4, false, 104, 90, 104, 30);
    const e = boss(sim);
    const b = e.boss!;
    b.cycle = 1; // the gust is next
    b.rest = 0;
    const x0 = sim.world.player.x;
    let pushedAt = -1;
    for (let t = 0; t < 60 * 5; t++) {
      sim.step(makeInput());
      if (pushedAt < 0 && b.pat?.kind === 'gust' && b.mode === 1) pushedAt = t;
    }
    expect(pushedAt).toBeGreaterThan(0);
    expect(Math.abs(sim.world.player.x - x0)).toBeGreaterThan(50);
    // Once it has passed, she stands still again.
    const x1 = sim.world.player.x;
    stepN(sim, makeInput(), 30);
    expect(Math.abs(sim.world.player.x - x1)).toBeLessThan(3);
  });

  it('the Last Downpour puts the lights out — and puts them back, keeping the floor curse', () => {
    for (const curse of [null, 'deluge'] as const) {
      const sim = arena('old-thunderhead', 5, false, 60, 80, 150, 30);
      const w = sim.world;
      w.godMode = true;
      w.curse = curse;
      const curseNow = (): string | null => w.curse;
      // A cloudlet from phase 2 is about.
      nextPhase(sim);
      stepN(sim, makeInput(), 60);
      const adds = () => w.enemies.items.slice(0, w.enemies.count).filter((o) => !o.dead && o.parent === boss(sim).uid && o.anchor === 0).length;
      nextPhase(sim);
      let dark = 0;
      let lit = 0;
      let strikes = 0;
      let addsInDark = -1;
      for (let t = 0; t < 60 * 7; t++) {
        sim.step(makeInput());
        const b = boss(sim).boss!;
        const running = b.pat?.hook === 'thunderhead-blackout' && b.mode === 1;
        if (running && curseNow() === 'darkness') {
          dark++;
          if (addsInDark < 0) addsInDark = adds();
        } else if (running) lit++;
        for (let i = 0; i < w.enemyShots.count; i++) {
          const s = w.enemyShots.items[i]!;
          if (s.lob && s.fall === 2 && s.age < 1 / 60 + 1e-6) {
            strikes++;
            // Every strike lands inside her own little light.
            expect(Math.hypot(s.tx - w.player.x, s.ty - w.player.y)).toBeLessThan(40);
          }
        }
      }
      expect(dark).toBeGreaterThan(120);
      expect(lit).toBeGreaterThan(8);
      expect(strikes).toBeGreaterThan(6);
      expect(addsInDark).toBe(0);
      // Lights back on (the floor's own curse).
      stepN(sim, makeInput(), 60 * 3);
      const b = boss(sim).boss!;
      if (b.pat?.hook !== 'thunderhead-blackout') expect(w.curse).toBe(curse);
      // Falling mid-blackout puts them back too.
      for (let t = 0; t < 60 * 10 && !(b.pat?.hook === 'thunderhead-blackout' && curseNow() === 'darkness'); t++) sim.step(makeInput());
      expect(curseNow()).toBe('darkness');
      boss(sim).hurt(1e6, SRC_PLAYER, 0, 0);
      sim.step(makeInput());
      expect(curseNow()).toBe(curse);
    }
  });

  it('shakes off little cloudlets with its own size and health', () => {
    const sim = arena('old-thunderhead', 6, false);
    nextPhase(sim);
    stepN(sim, makeInput(), 40);
    const e = boss(sim);
    const adds = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => !o.dead && o.parent === e.uid);
    expect(adds.length).toBe(3);
    for (const a of adds) {
      expect(a.def.id).toBe('grumblecloud');
      expect(a.scale).toBeCloseTo(0.6, 5);
      expect(a.maxHp).toBe(14);
    }
    expect(e.sprite).toBe(THUNDERHEAD_PHASES[1]);
  });
});

describe('The Nestmother', () => {
  it('wears a new look each phase and a guard of drones in the last', () => {
    const sim = arena('nestmother', 2, false);
    const e = boss(sim);
    expect(e.sprite).toBe(NESTMOTHER_PHASES[0]);
    nextPhase(sim);
    expect(e.sprite).toBe(NESTMOTHER_PHASES[1]);
    nextPhase(sim);
    expect(e.sprite).toBe(NESTMOTHER_PHASES[2]);
    stepN(sim, makeInput(), 30);
    const guards = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => !o.dead && o.anchor === e.uid);
    expect(guards.length).toBe(5);
    expect(guards.every((g) => g.def.id === 'nest-drone')).toBe(true);
  });

  it('her paper walls go up between her and Wren, never on Wren or a door front', () => {
    const id = patternBoss({ kind: 'barricade', shot: 'dust', params: { windup: 0.3, cells: 5, gaps: 1, walls: 2, air: 0.6, max: 16 } });
    const sim = arena(id, 8, false, 40, 56, 170, 56);
    untilPattern(sim);
    stepN(sim, makeInput(), 60);
    const room = sim.world.room;
    const cells: number[] = [];
    for (let i = 0; i < room.tiles.length; i++) if (room.tiles[i] === Tile.Crate) cells.push(i);
    expect(cells.length).toBeGreaterThanOrEqual(6);
    expect(cells.length).toBeLessThanOrEqual(10);
    const pc = Math.floor(40 / TILE);
    for (const c of cells) {
      const col = c % ROOM_COLS;
      expect(col).toBeGreaterThan(pc);
      expect(col).toBeLessThan(Math.floor(170 / TILE));
      expect([6, 3 * 13 + 12, 6 * 13 + 6, 3 * 13]).not.toContain(c);
    }
    // Room for no more than the cap.
    stepN(sim, makeInput(), 60 * 6);
    let n = 0;
    for (let i = 0; i < room.tiles.length; i++) if (room.tiles[i] === Tile.Crate) n++;
    expect(n).toBeLessThanOrEqual(16);
  });

  it('never walls her in: a wad landing where she now stands does not set', () => {
    const id = patternBoss({ kind: 'barricade', shot: 'dust', params: { windup: 0.3, cells: 7, gaps: 0, walls: 1, air: 0.6, max: 30 } });
    const sim = arena(id, 9, false, 40, 56, 170, 56);
    untilPattern(sim);
    // She steps right into the line the wads are headed for.
    sim.world.player.placeAt(4 * TILE + 8, 56);
    stepN(sim, makeInput(), 60);
    const room = sim.world.room;
    expect(room.get(4, 3)).not.toBe(Tile.Crate);
  });

  it('dives: out of reach, the shadow hunts her, locks, plunges — crushing walls where it lands', () => {
    const id = patternBoss({ kind: 'dive', params: { windup: 0.3, rise: 0.3, height: 70, track: 0.8, follow: 200, lock: 0.4, fall: 0.2, ring: 10, crush: 1, pause: 0.3 } });
    const sim = arena(id, 10, false, 60, 70, 160, 40);
    sim.world.godMode = true;
    const e = boss(sim);
    let highest = 0;
    let fired = 0;
    const before = sim.world.counters.enemyShots;
    for (let t = 0; t < 60 * 3; t++) {
      sim.step(makeInput());
      highest = Math.max(highest, e.z);
      if (count(sim, 'bossSlam') > 0) {
        fired = sim.world.counters.enemyShots - before;
        break;
      }
    }
    expect(highest).toBeGreaterThan(60);
    expect(e.z).toBe(0);
    // It came down where she stood, with a ring of stingers.
    expect(Math.hypot(e.x - 60, e.y - 70)).toBeLessThan(12);
    expect(fired).toBeGreaterThanOrEqual(10);
    // Crates under a landing are smashed (without loot).
    const room = sim.world.room;
    room.set(3, 2, Tile.Crate);
    room.set(9, 5, Tile.Crate);
    expect(crushCrates(sim.world, 3 * TILE + 8, 2 * TILE + 8, 10)).toBe(1);
    expect(room.get(3, 2)).toBe(Tile.Floor);
    expect(room.get(9, 5)).toBe(Tile.Crate);
    expect(sim.world.pickups.count).toBe(0);
  });

  it('her larvae hatch around Wren, never on top of her, up to the cap', () => {
    const id = patternBoss({ kind: 'brood', enemy: 'grubling', params: { windup: 0.2, count: 3, max: 4, place: 1, dist: 40, hatch: 0.8 } });
    const sim = arena(id, 12, false, 100, 56, 180, 56);
    const e = boss(sim);
    untilPattern(sim);
    stepN(sim, makeInput(), 30);
    let adds = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => !o.dead && o.parent === e.uid);
    expect(adds.length).toBe(3);
    for (const a of adds) expect(Math.hypot(a.x - 100, a.y - 56)).toBeGreaterThan(28);
    stepN(sim, makeInput(), 60 * 3);
    adds = sim.world.enemies.items.slice(0, sim.world.enemies.count).filter((o) => !o.dead && o.parent === e.uid);
    expect(adds.length).toBeLessThanOrEqual(4);
  });

  it('as she falls her walls crumble', () => {
    const sim = arena('nestmother', 13, false);
    const room = sim.world.room;
    room.set(2, 1, Tile.Crate);
    room.set(10, 5, Tile.Crate);
    boss(sim).hurt(1e6, SRC_PLAYER, 0, 0);
    for (let i = 0; i < 4 && !sim.world.boss.dying; i++) {
      stepN(sim, makeInput(), Math.ceil(BOSS_TUNING.phaseInvuln * 60) + 3);
      boss(sim).hurt(1e6, SRC_PLAYER, 0, 0);
    }
    stepN(sim, makeInput(), 60 * 5);
    expect(room.get(2, 1)).toBe(Tile.Floor);
    expect(room.get(10, 5)).toBe(Tile.Floor);
    expect(sim.world.boss.done).toBe(true);
  });
});

describe('The Undertow', () => {
  it('drags Wren toward it, harder each phase, half as hard when she flies', () => {
    const drift = (phase: number, flying: boolean): number => {
      const sim = arena('undertow', 14, false, 20, 56, 104, 56);
      sim.world.godMode = true;
      for (let i = 0; i < phase; i++) nextPhase(sim);
      const p = sim.world.player;
      p.flags.flying = flying;
      const e = boss(sim);
      // Nothing but the water's pull for a second.
      const b = e.boss!;
      b.pat = null;
      b.enterPending = false;
      b.rest = 99;
      p.placeAt(20, 56);
      p.pushX = p.pushY = 0;
      stepN(sim, makeInput(), 20);
      const x0 = p.x;
      stepN(sim, makeInput(), 60);
      return p.x - x0;
    };
    const d0 = drift(0, false);
    const d3 = drift(3, false);
    expect(d0).toBeGreaterThan(UNDERTOW_PULL[0] * 0.8);
    expect(d0).toBeLessThan(UNDERTOW_PULL[0] * 1.2);
    expect(d3).toBeGreaterThan(UNDERTOW_PULL[3] * 0.8);
    expect(d3).toBeGreaterThan(d0 * 1.8);
    expect(drift(0, true)).toBeLessThan(d0 * 0.6);
  });

  it('keeps to the middle of the room', () => {
    const sim = arena('undertow', 15, false, 30, 30, 170, 90);
    stepN(sim, makeInput(), 60 * 6);
    const e = boss(sim);
    expect(Math.abs(e.x - ROOM_W / 2)).toBeLessThan(4);
    expect(Math.abs(e.y - ROOM_H / 2)).toBeLessThan(4);
  });

  it('circles debris round itself, then flings every piece', () => {
    const id = patternBoss({ kind: 'vortex', shot: 'dust', params: { windup: 0.2, count: 8, radius: 30, spin: 2.4, hold: 1, fling: 0, interval: 0.06, speed: 120 } });
    const sim = arena(id, 16, false, 30, 56, 104, 56);
    sim.world.godMode = true;
    const e = boss(sim);
    untilPattern(sim);
    stepN(sim, makeInput(), 45);
    const shots = () => sim.world.enemyShots.items.slice(0, sim.world.enemyShots.count);
    const circling = shots().filter((s) => s.creepR > 0);
    expect(circling.length).toBe(8);
    for (const s of circling) {
      const r = Math.hypot(s.x - e.x, (s.y - e.y) / 0.8);
      expect(r).toBeGreaterThan(24);
      expect(r).toBeLessThan(52);
    }
    // Every piece is let go (flung at her), before the next batch rises.
    let emptied = false;
    let flungFast = 0;
    for (let t = 0; t < 90 && !emptied; t++) {
      sim.step(makeInput());
      const all = shots();
      if (all.every((s) => s.creepR === 0)) emptied = true;
      flungFast = Math.max(flungFast, all.filter((s) => s.creepR === 0 && Math.hypot(s.vx, s.vy) > 100).length);
    }
    expect(emptied).toBe(true);
    expect(flungFast).toBeGreaterThanOrEqual(3);
  });

  it('water tentacles snake toward Wren as a line of marked spouts', () => {
    const id = patternBoss({ kind: 'strikes', params: { windup: 0.2, shape: 3, count: 7, paths: 1, delay: 0.05, air: 0.7, bolt: 0, splash: 9, spray: 4 } });
    const sim = arena(id, 17, false, 30, 56, 170, 56);
    untilPattern(sim);
    stepN(sim, makeInput(), 30);
    const lobs = sim.world.enemyShots.items.slice(0, sim.world.enemyShots.count).filter((s) => s.lob);
    expect(lobs.length).toBe(7);
    for (const s of lobs) {
      expect(s.fall).toBe(0);
      expect(s.split).toBe(4);
      expect(s.tx).toBeGreaterThan(4);
      expect(s.tx).toBeLessThan(170);
    }
    // They lead from the boss to her.
    const xs = lobs.map((s) => s.tx).sort((a, b) => a - b);
    expect(xs[0]!).toBeLessThan(50);
    expect(xs[xs.length - 1]!).toBeGreaterThan(130);
  });
});

describe('the finals pattern kinds', () => {
  it('strikes: a lightning line walks from the boss at her; a ring closes round her', () => {
    const line = patternBoss({ kind: 'strikes', params: { windup: 0.2, shape: 0, count: 6, step: 20, delay: 0.05, air: 0.8, bolt: 1 } });
    const sim = arena(line, 18, false, 40, 56, 160, 56);
    untilPattern(sim);
    stepN(sim, makeInput(), 30);
    const bolts = sim.world.enemyShots.items.slice(0, sim.world.enemyShots.count).filter((s) => s.lob && s.fall === 2);
    expect(bolts.length).toBe(6);
    for (const s of bolts) expect(Math.abs(s.ty - 56)).toBeLessThan(3);
    const ring = patternBoss({ kind: 'strikes', params: { windup: 0.2, shape: 2, count: 8, radius: 36, delay: 0, air: 0.8, bolt: 1 } });
    const s2 = arena(ring, 19, false, 100, 56, 180, 56);
    untilPattern(s2);
    stepN(s2, makeInput(), 2);
    const marks = s2.world.enemyShots.items.slice(0, s2.world.enemyShots.count).filter((s) => s.lob);
    expect(marks.length).toBe(8);
    for (const s of marks) {
      const d = Math.hypot(s.tx - 100, (s.ty - 56) / 0.8);
      expect(Math.abs(d - 36)).toBeLessThan(3);
    }
  });

  it('curtain: rain falls from the ceiling with one gap near her', () => {
    const id = patternBoss({ kind: 'curtain', params: { windup: 0.2, sheets: 1, spacing: 13, hole: 3, speed: 60 } });
    const sim = arena(id, 20, false, 100, 90, 104, 30);
    untilPattern(sim);
    const drops = sim.world.enemyShots.items.slice(0, sim.world.enemyShots.count);
    expect(drops.length).toBeGreaterThanOrEqual(10);
    for (const s of drops) {
      expect(s.y).toBeLessThan(8);
      expect(s.vy).toBeGreaterThan(0);
    }
    // The widest gap between neighbouring drops is the hole, and it is near her.
    const xs = drops.map((s) => s.x).sort((a, b) => a - b);
    let gap = 0;
    let at = 0;
    for (let i = 1; i < xs.length; i++) {
      if (xs[i]! - xs[i - 1]! > gap) {
        gap = xs[i]! - xs[i - 1]!;
        at = (xs[i]! + xs[i - 1]!) / 2;
      }
    }
    expect(gap).toBeGreaterThanOrEqual(13 * 3);
    expect(Math.abs(at - 100)).toBeLessThan(30);
  });

  it('clap: a thunderclap sends a ring of shots and a shockwave', () => {
    const id = patternBoss({ kind: 'clap', params: { windup: 0.2, claps: 1, count: 12, waves: 1, waveRadius: 70 } });
    const sim = arena(id, 21, false, 30, 56, 120, 56);
    for (let t = 0; t < 120 && sim.world.waves.count === 0; t++) sim.step(makeInput());
    expect(sim.world.waves.count).toBe(1);
    expect(sim.world.enemyShots.count).toBe(12);
  });
});
