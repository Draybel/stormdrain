/**
 * Content merge 2 — boss packs A / B / C, the full final bosses and the special synergies merged into main
 * (on top of the characters / achievements pass and the Phase 5 tooling):
 * - the Phase 6 targets: 20+ bosses, 8+ minibosses, the three finals (each ≥ 2 phases), 40+ synergies;
 * - every chapter has a boss and a miniboss of its OWN (floor-12 finals aside), so nothing is borrowed any
 *   more; real runs pick them (seeded, every one of a pool turns up over seeds) at their home HP; the finals
 *   keep their keys, ids and endings on floors 12 / 12 alt / 13;
 * - phase looks (BossHook.looks): validated like boss sprites, a broken one is reported;
 * - UNDER THE ROOTS fires on a chapter-2 boss of the chapter's own pool in a real run;
 * - synergies in a real run: a brand-new player's items can make most of them; walking onto the pedestals
 *   switches one on (the SYNERGY pill), the meta tracker counts it and IT CLICKS unlocks the Dizzy Top.
 */

import { describe, expect, it } from 'vitest';
import { BOSSES, CHAPTERS, allItems, allSynergies, bossesInChapter, getCharacter, getItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { GameSave } from '../src/meta/save';
import { MemoryStorage } from '../src/meta/storage';
import { MetaStore } from '../src/meta/metaState';
import { characterUnlocked, itemUnlocked, lockedItems, runUnlocks } from '../src/meta/unlocks';
import { getBossHook, registerBossHook } from '../src/sim/bosses/hooks';
import { bossHpFor, bossPool, finalBossDef, homeFloor, pickBoss } from '../src/sim/bosses/select';
import { validateBossDef } from '../src/sim/bosses/validate';
import { chapterFor } from '../src/sim/run/chapters';
import { bossFor } from '../src/sim/run/contents';
import { generateFloor } from '../src/sim/floor/generate';
import { BOSS_TUNING } from '../src/sim/tuning';
import { Sim } from '../src/sim/sim';
import type { BossDef, Requirement, SynergyDef } from '../src/sim/types';
import { fightBoss } from './helpers/bossBot';
import { makeInput } from './helpers/sim';

const REAL = [...BOSSES.values()].filter((b) => !b.id.startsWith('t-'));
const ofKind = (k: BossDef['kind']): BossDef[] => REAL.filter((b) => b.kind === k);

/** The floors of a chapter that have an ordinary boss room (floor 12 holds a final). */
function bossFloors(ch: { floors: readonly [number, number] }): number[] {
  return ch.floors.filter((f) => f < 12);
}

describe('bosses: totals, own pools, finals', () => {
  it('meets the Phase 6 targets: 22 bosses (polish batch 4: +2), 8+ minibosses, three finals, all with 2+ phases', () => {
    expect(validateContent()).toEqual([]);
    expect(ofKind('boss').length).toBeGreaterThanOrEqual(22);
    expect(ofKind('miniboss').length).toBeGreaterThanOrEqual(8);
    expect(ofKind('final').length).toBe(3);
    for (const b of REAL) expect(b.phases.length, b.id).toBeGreaterThanOrEqual(2);
    // Every boss has an intro line and a bestiary blurb (music is optional: the chapter's boss theme).
    for (const b of REAL) {
      expect(b.title, b.id).toBeTruthy();
      expect(b.bestiary, b.id).toBeTruthy();
    }
  });

  it('every chapter has a boss and a miniboss of its own; nothing is borrowed', () => {
    for (const ch of CHAPTERS.values()) {
      const own = bossesInChapter(ch.id, 'boss');
      expect(own.length, `${ch.id} bosses`).toBeGreaterThanOrEqual(1);
      expect(bossesInChapter(ch.id, 'miniboss').length, `${ch.id} minibosses`).toBeGreaterThanOrEqual(1);
      // bossPool only falls back to "every boss of the kind" for a chapter with none of its own.
      expect(bossPool(ch.id, 'boss').map((b) => b.id).sort()).toEqual(own.map((b) => b.id).sort());
      expect(bossPool(ch.id, 'miniboss').length).toBeLessThan(ofKind('miniboss').length);
      // A chapter that spans two floors has two bosses of its own (polish batch 4: the Rust Foundry and the Glimmer
      // Grotto had one, so the hidden route fought it twice).
      if (ch.floors[0] !== ch.floors[1] && ch.floors[1] < 12) expect(own.length, `${ch.id} bosses`).toBeGreaterThanOrEqual(2);
    }
    // Each boss is at home in the chapter it lists first; its HP grows with the floor there like anywhere (polish batch 4).
    for (const b of [...ofKind('boss'), ...ofKind('miniboss')]) {
      const home = CHAPTERS.get(b.chapters[0]!)!;
      expect(home, b.id).toBeDefined();
      expect(homeFloor(b)).toBe(home.floors[0]);
      expect(bossHpFor(b, home.floors[1])).toBe(Math.round(b.hp * (1 + BOSS_TUNING.hpPerFloor * (home.floors[1] - 1))));
    }
  });

  it('no two-floor chapter ever shows the same boss on both of its floors (200 seeds each)', () => {
    for (const ch of CHAPTERS.values()) {
      const [f1, f2] = ch.floors;
      if (f1 === f2 || f2 >= 12) continue;
      for (let seed = 1; seed <= 200; seed++) {
        const a = pickBoss(seed, f1, ch.track, ch.id, 'boss')!;
        const b = pickBoss(seed, f2, ch.track, ch.id, 'boss', a.id)!;
        expect(b.id, `${ch.id} seed ${seed}`).not.toBe(a.id);
        // The run's own rule (sim/run/contents.ts bossFor) avoids the previous floor's pick the same way.
        const layout = generateFloor(seed, f2, ch.track, {});
        expect(bossFor(layout, ch.id, 'boss')!.id, `${ch.id} seed ${seed} (bossFor)`).not.toBe(a.id);
      }
    }
  });

  it('real runs put the chapter\'s own bosses in their boss rooms, every one of them over seeds, at their floor\'s HP', () => {
    for (const ch of CHAPTERS.values()) {
      const own = new Set(bossesInChapter(ch.id, 'boss').map((b) => b.id));
      const seen = new Set<string>();
      for (const floor of bossFloors(ch)) {
        for (let seed = 1; seed <= 16; seed++) {
          const sim = Sim.newRun(seed * 7919 + floor, { floor, track: ch.track, curse: null });
          const run = sim.run!;
          expect(run.data.chapter).toBe(ch.id);
          const st = run.data.rooms[run.data.layout.boss]!;
          expect(own.has(st.boss), `${ch.id} floor ${floor}: ${st.boss}`).toBe(true);
          const def = BOSSES.get(st.boss)!;
          expect(st.bossHp, st.boss).toBe(bossHpFor(def, floor));
          expect(st.bossHp, st.boss).toBeGreaterThanOrEqual(def.hp);
          seen.add(st.boss);
          // A miniboss room (when the floor has one) holds one of the chapter's minibosses.
          const mini = run.data.layout.rooms.find((r) => r.type === 'miniboss');
          if (mini) {
            const id = run.data.rooms[mini.index]!.boss;
            expect(BOSSES.get(id)?.kind, id).toBe('miniboss');
            expect(BOSSES.get(id)!.chapters, id).toContain(ch.id);
          }
        }
      }
      expect([...seen].sort(), ch.id).toEqual([...own].sort());
      // Minibosses: every one of the chapter's turns up over seeds.
      const minis = new Set(bossesInChapter(ch.id, 'miniboss').map((b) => b.id));
      const picked = new Set<string>();
      for (let seed = 1; seed <= 60; seed++) picked.add(pickBoss(seed, ch.floors[0], ch.track, ch.id, 'miniboss')!.id);
      expect([...picked].sort(), ch.id).toEqual([...minis].sort());
    }
  });

  it('the finals keep their ids, keys and endings on floors 12, 12 alt and 13', () => {
    const cases: [number, 'main' | 'alt', string, string, number][] = [
      [12, 'main', 'thunderhead', 'old-thunderhead', 1],
      [12, 'alt', 'nestmother', 'nestmother', 2],
      [13, 'main', 'undertow', 'undertow', 3],
    ];
    for (const [floor, track, key, id, ending] of cases) {
      const def = finalBossDef(key)!;
      expect(def.id).toBe(id);
      expect(def.ending).toBe(ending);
      const sim = Sim.newRun(`final-${key}`, { floor, track, curse: null, unlocked: ['ending1', 'ending2'] });
      const run = sim.run!;
      expect(run.data.layout.finalBoss).toBe(key);
      const st = run.data.rooms[run.data.layout.boss]!;
      expect(st.boss).toBe(id);
      expect(st.bossHp).toBe(def.hp);
      run.teleport(run.data.layout.boss);
      expect(sim.world.boss.active).toBe(true);
      expect(sim.world.boss.kind).toBe(2);
      expect(sim.world.boss.id).toBe(id);
    }
    // Floor 13 borrows the Eye of the Storm's look.
    expect(chapterFor(13, 'main').id).toBe('eye_of_storm');
  });
});

describe('bosses: phase looks', () => {
  it('every pack boss and final changes its look with its phase; the looks are validated', () => {
    const gutter = new Set(['sodden-snarl', 'brimwell', 'pipewhip']);
    for (const b of REAL) {
      if (gutter.has(b.id)) continue;
      const looks = b.hook ? getBossHook(b.hook)?.looks : undefined;
      expect(looks?.length ?? 0, b.id).toBeGreaterThanOrEqual(2);
      expect(looks!.length, b.id).toBeLessThanOrEqual(b.phases.length);
      expect(new Set(looks!.map((l) => l.id)).size, b.id).toBe(looks!.length);
    }
  });

  it('a broken look is reported by validation', () => {
    const snarl = BOSSES.get('sodden-snarl')!;
    const tiny = { id: 't.tiny', w: 8, h: 8, palette: { a: '#ffffff' }, frames: [Array(8).fill('aaaaaaaa')] };
    registerBossHook('t-broken-look', { looks: [snarl.sprite as never, tiny] });
    const errs = validateBossDef({ ...snarl, id: 't-broken', hook: 't-broken-look' }, () => true);
    expect(errs.some((e) => e.includes('look 1') && e.includes('boss-sized'))).toBe(true);
    expect(errs.some((e) => e.includes('look 1') && e.includes("'idle' + 'move'"))).toBe(true);
    expect(errs.some((e) => e.includes('look 0'))).toBe(false);
  });
});

describe("bosses: achievements", () => {
  it("UNDER THE ROOTS fires on the Candlewick Crypt's own boss (chapter 2, alt track) and unlocks Pip", () => {
    const save = new GameSave(new MemoryStorage());
    const sim = Sim.newRun('CRYPTBOS', { curse: null, floor: 3, track: 'alt' });
    save.tracker.startRun(sim);
    const run = sim.run!;
    run.teleport(run.data.layout.boss);
    const id = sim.world.boss.id;
    expect(bossesInChapter('candlewick_crypt', 'boss').map((b) => b.id)).toContain(id);
    const res = fightBoss(sim, 60 * 150, () => save.tracker.afterStep());
    expect(res.won).toBe(true);
    expect(res.phase).toBe(BOSSES.get(id)!.phases.length - 1);
    save.endTick();
    expect(save.meta.hasAchievement('under-the-roots')).toBe(true);
    expect(characterUnlocked(save.meta.state, getCharacter('pip'))).toBe(true);
    // The bestiary / lifetime stats count the kill once.
    expect(save.meta.state.stats.bossKills).toBe(1);
  });
});

// ── Synergies in real runs ─────────────────────────────────────────────────────

/** Can a player with these items locked meet the requirement from the item pools? */
function obtainable(req: Requirement, locked: ReadonlySet<string>): boolean {
  const open = (id: string): boolean => {
    const d = getItem(id);
    return !locked.has(id) && d.pools.length > 0;
  };
  if (typeof req === 'string') return open(req);
  return allItems().filter((d) => d.tags.includes(req.tag) && open(d.id)).length >= (req.count ?? 1);
}

/** Walks the player onto (x, y) with the move stick until `done()` or the time runs out; `each` after every step. */
function walkTo(sim: Sim, x: number, y: number, done: () => boolean, each: () => void, maxTicks = 240): boolean {
  const input = makeInput();
  for (let t = 0; t < maxTicks && !done(); t++) {
    const p = sim.world.player;
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    input.moveX = dx / d;
    input.moveY = dy / d;
    sim.step(input);
    each();
  }
  return done();
}

describe('synergies: in real runs', () => {
  it('40+ synergies; a brand-new player can make half of them from unlocked items in the pools', () => {
    const syns = allSynergies();
    expect(syns.length).toBeGreaterThanOrEqual(40);
    const locked = new Set(lockedItems(new MetaStore({ storage: new MemoryStorage() }).state));
    const makeable = syns.filter((s) => s.requires.every((r) => obtainable(r, locked)));
    // (The rest wait on items the achievements unlock — the pool grows as you play.)
    expect(makeable.length).toBeGreaterThanOrEqual(Math.floor(syns.length / 2));
    // Every one is makeable once everything is unlocked (no requirement on a pool-less item).
    for (const s of syns) expect(s.requires.every((r) => obtainable(r, new Set())), s.id).toBe(true);
  });

  it('walking onto the pedestals switches a synergy on in a run: the pill, the tracker, IT CLICKS → the Dizzy Top', () => {
    const save = new GameSave(new MemoryStorage());
    const locked = new Set(lockedItems(save.meta.state));
    // A synergy of passive items only, all unlocked for a brand-new player.
    const pick = allSynergies().find(
      (s: SynergyDef) =>
        s.requires.length >= 2 &&
        s.requires.every((r) => typeof r === 'string' && getItem(r).kind === 'passive' && obtainable(r, locked)),
    );
    expect(pick, 'a synergy a new player can make').toBeDefined();
    expect(itemUnlocked(save.meta.state, getItem('dizzy-top'))).toBe(false);

    const sim = Sim.newRun('SYNERGY1', { curse: null, unlocked: runUnlocks(save.meta.state) });
    sim.world.godMode = true;
    save.tracker.startRun(sim);
    let pill = 0;
    // Like the run scene: the tracker reads every tick's events.
    const each = (): void => {
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'synergy' && sim.events.at(i).id === pick!.id) pill++;
      save.tracker.afterStep();
      save.endTick();
    };
    for (const id of pick!.requires as string[]) {
      const ped = sim.spawnItemPedestal(id)!;
      expect(ped).not.toBeNull();
      expect(walkTo(sim, ped.x, ped.y, () => sim.world.player.inv.passives.includes(id), each), `took ${id}`).toBe(true);
      // Let the pickup hold finish before the next one.
      for (let k = 0; k < 60; k++) {
        sim.step(makeInput());
        each();
      }
    }
    expect(sim.world.player.synergies).toContain(pick!.id);
    expect(pill).toBe(1);
    expect(save.meta.counter('synergiesFound')).toBe(1);
    expect(save.meta.hasAchievement('it-clicks')).toBe(true);
    expect(itemUnlocked(save.meta.state, getItem('dizzy-top'))).toBe(true);
    // The Dizzy Top now rolls in this player's next runs (Twin Straws always did: polish batch 4).
    expect(runUnlocks(save.meta.state)).toContain('dizzy-top');
  });
});
