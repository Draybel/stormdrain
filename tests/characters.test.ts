/**
 * The seven characters (DESIGN.md "Characters"): every CharacterDef validates and follows the sprite contract,
 * each one's single mechanic keeps its core rule (sim/mechanics.ts), and every character completes a god-mode
 * floor with the explorer while actually using its mechanic.
 */

import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/engine/events';
import { allCharacters, getCharacter, getItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { validateSpriteDef } from '../src/content/sprites/validate';
import { WREN_FRAME } from '../src/content/sprites/wren';
import { CM_CHARGE } from '../src/sim/attack/profile';
import { spawnPlayerPuddle } from '../src/sim/attack/impacts';
import { damageEnemy } from '../src/sim/enemies/damage';
import { spawnEnemyShot } from '../src/sim/enemies/shots';
import { ST_SLOW } from '../src/sim/enemies/status';
import { BONUS_TIN, bonusHalvesOf } from '../src/sim/health';
import { SRC_BOMB, SRC_PLAYER } from '../src/sim/hittable';
import { ME_FIREFLY_FLEE, ME_FIREFLY_JOIN, ME_PICKPOCKET, ME_SOAK, ME_WOUND, MK_BURROW, characterDashes } from '../src/sim/mechanics';
import { haggled } from '../src/sim/pedestals';
import { spawnPickup } from '../src/sim/pickups';
import { PK } from '../src/sim/pickupKinds';
import { Sim } from '../src/sim/sim';
import { MECHANIC_TUNING } from '../src/sim/tuning';
import { measureText } from '../src/render/font';
import type { CharacterDef } from '../src/sim/types';
import type { World } from '../src/sim/world';
import { Explorer } from './helpers/explorer';
import { testEnemy } from './helpers/enemies';
import { makeInput, stepN } from './helpers/sim';

const IDS = ['wren', 'pip', 'marrow', 'juniper', 'bolt', 'sable', 'mosswick', 'drizzle'];

/** An empty 13×7 room with the player in the middle. */
const OPEN = ['.............', '.............', '.............', '......@......', '.............', '.............', '.............'];

function yard(c: CharacterDef | string): Sim {
  return new Sim({ seed: 7, character: typeof c === 'string' ? getCharacter(c) : c, room: OPEN });
}

function familiars(w: World, id = 'firefly'): number {
  return w.atk.familiars.list.filter((f) => f.alive && f.def?.id === id).length;
}

/** A foe that never moves, attacks or touches anyone (keeps a fight on). */
function harmless(): string {
  return testEnemy('t-harmless-foe', { hp: 1e6, radius: 6, speed: 0, contact: 0, move: { kind: 'idle' }, attacks: [] }).id;
}

function tin(w: World): number {
  return bonusHalvesOf(w.player.health, BONUS_TIN);
}

/** Steps and collects every event of the given types. */
function stepCollect(sim: Sim, input = makeInput(), n = 1, types: string[] = []): GameEvent[] {
  const out: GameEvent[] = [];
  stepN(sim, input, n, (s) => {
    const q = s.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      if (types.includes(e.type)) out.push({ ...e });
    }
  });
  return out;
}

describe('the roster', () => {
  it('eight characters (the last a secret), Wren first, all valid, in the character-select order', () => {
    expect(validateContent()).toEqual([]);
    const ids = allCharacters().map((c) => c.id).filter((id) => !id.startsWith('demo-'));
    expect(ids).toEqual(IDS);
  });

  it.each(IDS)('%s: sprite contract, stats, hearts, unlock and mechanic text', (id) => {
    const c = getCharacter(id);
    expect(validateSpriteDef(c.sprite)).toEqual([]);
    expect(c.sprite.w).toBe(14);
    expect(c.sprite.h).toBe(16);
    expect(c.sprite.frames.length).toBe(12);
    // The frames the renderer indexes into exist and differ where they should (walk, blink, hurt, death).
    const f = (i: number): string => c.sprite.frames[i]!.join('');
    expect(f(WREN_FRAME.downStepL)).not.toBe(f(WREN_FRAME.downStand));
    expect(f(WREN_FRAME.downBlink)).not.toBe(f(WREN_FRAME.downStand));
    expect(f(WREN_FRAME.hurt)).not.toBe(f(WREN_FRAME.downStand));
    expect(f(WREN_FRAME.upStand)).not.toBe(f(WREN_FRAME.downStand));
    expect(f(WREN_FRAME.sideTogether)).not.toBe(f(WREN_FRAME.downStand));
    expect(f(WREN_FRAME.deathHeap)).not.toBe(f(WREN_FRAME.deathSlump));
    expect(c.mechanicDesc?.length ?? 0).toBeGreaterThan(20);
    expect(c.desc.length).toBeGreaterThan(10);
    if (id === 'wren') expect(c.unlock).toBeUndefined();
    else expect(c.unlock).toBeTruthy();
    // Every character starts with something to lose.
    expect(c.hearts.redMax + (c.hearts.tin ?? 0)).toBeGreaterThanOrEqual(6);
  });

  it('distinct looks: every character has its own palette and silhouette', () => {
    const cs = IDS.map(getCharacter);
    const looks = new Set(cs.map((c) => JSON.stringify(c.sprite.palette)));
    const shapes = new Set(cs.map((c) => c.sprite.frames[0]!.map((r) => r.replace(/[^.]/g, '#')).join('/')));
    expect(looks.size).toBe(cs.length);
    expect(shapes.size).toBe(cs.length);
    const shots = new Set(cs.map((c) => c.shotColor ?? 'gold'));
    expect(shots.size).toBe(cs.length);
  });

  it('the select card shows every description in full, and Mosswick\'s card names her real soak cap', () => {
    // The details panel wraps the description in 2 lines and the mechanic in 3, 224 px wide (ui/characterSelect.ts).
    const lines = (text: string): number => {
      let n = 1;
      let line = '';
      for (const word of text.toUpperCase().split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && measureText(next) > 224) {
          n++;
          line = word;
        } else line = next;
      }
      return n;
    };
    for (const c of IDS.map(getCharacter)) {
      expect(lines(c.desc), c.id).toBeLessThanOrEqual(2);
      expect(lines(c.mechanicDesc ?? ''), c.id).toBeLessThanOrEqual(3);
    }
    const cap = MECHANIC_TUNING.soak.cap / 2;
    expect(getCharacter('mosswick').mechanicDesc).toContain(`(UP TO ${cap})`);
  });

  it('each plays differently: carriers, flags and familiars from the character itself', () => {
    const got: Record<string, string> = {};
    for (const id of IDS) {
      const sim = Sim.newRun('ROSTER23', {}, getCharacter(id));
      stepN(sim, makeInput(), 2);
      const s = sim.summary();
      got[id] = `${s.attack.primary}|${s.attack.riders.join(',')}|${s.attack.mods.join(',')}|${s.attack.familiars.join(',')}|${s.health}|${s.inv.active?.id ?? ''}`;
    }
    expect(got.wren).toBe('marble||||R6/6|');
    expect(got.pip).toBe('marble||||R8/8|rusty-trowel');
    // (The boomerang carrier brings its implicit boomerang motion stack.)
    expect(got.marrow).toBe('boomerang||boomerangx1||R0/0 T2 T2 T2|');
    expect(got.juniper).toBe('marble|||firefly,firefly|R6/6|');
    // Polish batch 4: Bolt got a third red heart (he died on floor 1 in a third of the harness's runs).
    expect(got.bolt).toBe('marble|charge|||R6/6 T2|jar-of-lightning');
    expect(got.sable).toBe('melee||||R6/6|');
    expect(got.mosswick).toBe('marble||puddlex1||R4/4 T2|');
    expect(got.drizzle).toBe('marble||||R4/4 T2|');
  });
});

describe('Pip: burrow', () => {
  it('the dash ducks underground: fast, straight, untouchable, no firing; cooldown; a grace on surfacing', () => {
    const sim = yard('pip');
    const w = sim.world;
    const p = w.player;
    const B = MECHANIC_TUNING.burrow;
    expect(characterDashes(p.character)).toBe(true);
    expect(p.mech.kind).toBe(MK_BURROW);
    const inp = makeInput({ moveX: 1, aimX: 1, fireHeld: true });
    stepN(sim, inp, 10);
    const shotsBefore = w.counters.shots;
    const x0 = p.x;
    inp.dash = true;
    const dig = stepCollect(sim, inp, 1, ['burrow']);
    expect(dig.some((e) => e.a === 0 && e.id === 'pip')).toBe(true);
    expect(p.underground).toBe(true);
    // Nothing touches Pip down there: direct hurts, a shot through her, spikes / creep (damagePlayer refuses).
    const before = p.health.red;
    sim.hurtPlayer(4);
    const shot = spawnEnemyShot(w, p.x + 12, p.y, -200, 0, 2, 3, 0, false, 0)!;
    const events = stepCollect(sim, inp, 8, ['hurt', 'eshotPop', 'shoot']);
    expect(p.health.red).toBe(before);
    expect(events.filter((e) => e.type === 'hurt')).toEqual([]);
    expect(events.filter((e) => e.type === 'eshotPop' && e.a === 1)).toEqual([]);
    expect(shot.alive).toBe(true);
    // …and doesn't fire.
    expect(w.counters.shots).toBe(shotsBefore);
    // It covers ground fast: 2.1 × her walking speed for the whole 0.4 s, then Pip surfaces.
    let up = 9;
    let surfaced = false;
    for (; up < 40 && !surfaced; up++) surfaced = stepCollect(sim, inp, 1, ['burrow']).some((e) => e.a === 2);
    expect(surfaced).toBe(true);
    expect(up).toBeGreaterThanOrEqual(Math.floor(B.time * 60));
    expect(up).toBeLessThanOrEqual(Math.ceil(B.time * 60) + 2);
    expect(p.underground).toBe(false);
    const dist = p.x - x0;
    expect(dist).toBeGreaterThan(p.stats.moveSpeed * B.speed * B.time * 0.85);
    expect(p.invuln).toBeGreaterThan(0);
    // Cooldown: a second dig right away does nothing; after 1.5 s from the first it works.
    inp.dash = true;
    stepN(sim, inp, 1);
    expect(p.underground).toBe(false);
    stepN(sim, makeInput({ moveX: -1 }), Math.round((B.cooldown - B.time) * 60) + 2);
    inp.dash = true;
    stepN(sim, inp, 1);
    expect(p.underground).toBe(true);
    // A room load brings Pip up.
    sim.loadRoom(OPEN);
    expect(p.underground).toBe(false);
  });

  it('with no stick the dash goes the way Pip faces; other characters ignore the dash input', () => {
    const sim = yard('pip');
    const p = sim.world.player;
    stepN(sim, makeInput({ moveY: -1 }), 6);
    const y0 = p.y;
    stepN(sim, makeInput({ dash: true }), 1);
    stepN(sim, makeInput(), 20);
    expect(p.y).toBeLessThan(y0 - 30);
    const wren = yard('wren');
    stepN(wren, makeInput({ dash: true }), 1);
    expect(wren.world.player.underground).toBe(false);
  });

  it('a burrowed Pip tunnels under the open trapdoor instead of dropping through', () => {
    const sim = Sim.newRun('PIPTRAP2', {}, getCharacter('pip'));
    const run = sim.run!;
    const w = sim.world;
    run.teleport(run.data.layout.boss);
    stepN(sim, makeInput(), 2);
    sim.clearRoom();
    stepN(sim, makeInput(), 80);
    expect(w.trapdoor.active).toBe(true);
    const p = w.player;
    // Stand beside the hatch, then burrow straight across it.
    p.placeAt(w.trapdoor.x - 40, w.trapdoor.y);
    stepN(sim, makeInput(), 2);
    const floor = run.data.floor;
    stepN(sim, makeInput({ moveX: 1, dash: true }), 1);
    stepN(sim, makeInput({ moveX: 1 }), 12);
    expect(run.data.floor).toBe(floor);
  });
});

describe('Marrow: bone toss, no red hearts', () => {
  it('boomerang primary; red pickups, heals and heart containers all turn into Tin', () => {
    const sim = yard('marrow');
    const w = sim.world;
    const p = w.player;
    expect(p.attack.primary).toBe('boomerang');
    expect(p.flags.noRedHearts).toBe(true);
    expect(p.health.redMax).toBe(0);
    expect(tin(w)).toBe(6);
    sim.hurtPlayer(3);
    expect(tin(w)).toBe(3);
    // A red heart pickup becomes Tin.
    spawnPickup(w, PK.Heart, p.x, p.y, false);
    stepN(sim, makeInput(), 5);
    expect(tin(w)).toBe(5);
    // A heal becomes Tin (a whole heart at most).
    sim.fullHeal();
    expect(tin(w)).toBe(7);
    // A heart container item: +1 Tin heart, never a red container.
    sim.giveItem('thermos-of-soup');
    expect(p.health.redMax).toBe(0);
    expect(tin(w)).toBe(11);
  });
});

describe('Juniper: firefly jar', () => {
  it('two fireflies; each clear frees one more up to six; a hit scares one off; a new floor settles the jar', () => {
    const sim = yard('juniper');
    const w = sim.world;
    stepN(sim, makeInput(), 2);
    expect(familiars(w)).toBe(2);
    const joined: GameEvent[] = [];
    for (let i = 0; i < 6; i++) {
      sim.roomCleared();
      joined.push(...stepCollect(sim, makeInput(), 1, ['mechanic']));
    }
    expect(joined.filter((e) => e.a === ME_FIREFLY_JOIN)).toHaveLength(4);
    expect(familiars(w)).toBe(MECHANIC_TUNING.fireflies.max);
    // Fireflies fire with her (they are shooters).
    const fired = stepCollect(sim, makeInput({ aimX: 1, fireHeld: true }), 30, ['shoot']);
    expect(fired.filter((e) => e.id === 'mini').length).toBeGreaterThan(0);
    // A hit scares one of the extras away (never the two of the jar).
    sim.hurtPlayer(1);
    const fled = stepCollect(sim, makeInput(), 1, ['mechanic']);
    expect(fled.some((e) => e.a === ME_FIREFLY_FLEE)).toBe(true);
    expect(familiars(w)).toBe(5);
    for (let i = 0; i < 4; i++) {
      w.player.invuln = 0;
      sim.hurtPlayer(1);
      stepN(sim, makeInput(), 1);
    }
    expect(familiars(w)).toBe(2);
    sim.fullHeal();
    // A new floor empties the jar back to two.
    sim.roomCleared();
    sim.roomCleared();
    stepN(sim, makeInput(), 1);
    expect(familiars(w)).toBe(4);
    sim.floorStarted();
    stepN(sim, makeInput(), 1);
    expect(familiars(w)).toBe(2);
  });

  it('the extra fireflies are kept by the run save', () => {
    const sim = Sim.newRun('JUNIPER2', {}, getCharacter('juniper'));
    stepN(sim, makeInput(), 2);
    sim.roomCleared();
    sim.roomCleared();
    stepN(sim, makeInput(), 2);
    expect(familiars(sim.world)).toBe(4);
    // The snapshot is the room-entry checkpoint: go through a door to take one.
    const run = sim.run!;
    const side = run.data.layout.rooms[run.data.current]!.doors;
    const d = [0, 1, 2, 3].find((s) => (side & (1 << s)) !== 0)!;
    run.goThroughDoor(d);
    stepN(sim, makeInput(), 2);
    const back = Sim.fromSnapshot(sim.snapshot());
    stepN(back, makeInput(), 2);
    expect(back.world.player.mech.flies).toBe(2);
    expect(familiars(back.world)).toBe(4);
  });
});

describe('Bolt: wind-up', () => {
  it('charge rider innate; a spent room active winds itself back up over time (not just per room)', () => {
    const sim = yard('bolt');
    const p = sim.world.player;
    expect(p.attack.chargeMode).toBe(CM_CHARGE);
    expect(p.inv.active?.id).toBe('jar-of-lightning');
    stepN(sim, makeInput({ active: true }), 1);
    expect(p.inv.active!.charge).toBe(0);
    const every = MECHANIC_TUNING.windUp.every;
    const wound = stepCollect(sim, makeInput(), Math.round(every * 60) + 2, ['mechanic', 'charged']);
    expect(wound.some((e) => e.type === 'mechanic' && e.a === ME_WOUND)).toBe(true);
    expect(p.inv.active!.charge).toBeGreaterThanOrEqual(1);
    expect(p.inv.active!.charge).toBeLessThan(1.1);
    const full = stepCollect(sim, makeInput(), Math.round(every * 60) + 2, ['charged']);
    expect(full.length).toBe(1);
    expect(p.inv.active!.charge).toBe(p.inv.active!.max);
    // Wren's actives don't wind up on their own.
    const wren = yard('wren');
    wren.giveItem('jar-of-lightning');
    stepN(wren, makeInput({ active: true }), 1);
    stepN(wren, makeInput(), Math.round(every * 60) + 2);
    expect(wren.world.player.inv.active!.charge).toBe(0);
  });

  it('timed actives charge faster', () => {
    const sim = yard('bolt');
    const p = sim.world.player;
    sim.giveItem('picnic-basket');
    stepN(sim, makeInput({ active: true }), 1);
    stepN(sim, makeInput(), 600);
    expect(p.inv.active!.charge).toBeCloseTo(10 * MECHANIC_TUNING.windUp.timedMul, 0);
  });
});

describe('Sable: pickpocket', () => {
  it('melee primary, 25 % off prices, and her hits knock coins loose (capped per enemy)', () => {
    const sure: CharacterDef = { ...getCharacter('sable'), mechanicParams: { chance: 1, maxChance: 1 } };
    const sim = yard(sure);
    const w = sim.world;
    const p = w.player;
    expect(p.attack.primary).toBe('melee');
    expect(p.flags.haggler).toBe(true);
    expect(haggled(w, 20)).toBe(15);
    const e = sim.spawnEnemy('grate-crab', 60, 56)!;
    stepN(sim, makeInput(), 30);
    const coins = (): number => {
      let n = 0;
      for (let i = 0; i < w.pickups.count; i++) if (w.pickups.items[i]!.kind === PK.Coin || w.pickups.items[i]!.kind === PK.SilverCoin) n++;
      return n;
    };
    // Hits made between two steps: their events are still in the queue.
    const picked = (): number => {
      let n = 0;
      for (let i = 0; i < sim.events.count; i++) if (sim.events.at(i).type === 'mechanic' && sim.events.at(i).a === ME_PICKPOCKET) n++;
      return n;
    };
    // Bombs don't pickpocket.
    damageEnemy(w, e, 0.5, SRC_BOMB, 0, 0);
    expect(picked()).toBe(0);
    expect(coins()).toBe(0);
    for (let i = 0; i < 5; i++) damageEnemy(w, e, 0.5, SRC_PLAYER, 0, 0);
    expect(picked()).toBe(MECHANIC_TUNING.pickpocket.perEnemy);
    expect(coins()).toBe(MECHANIC_TUNING.pickpocket.perEnemy);
    // A boss gives up to three.
    sim.clearRoom();
    stepN(sim, makeInput(), 5);
    const boss = sim.startBossFight('sodden-snarl', 150, 56, { intro: false })!;
    stepN(sim, makeInput(), 150);
    for (let i = 0; i < 8; i++) damageEnemy(w, boss, 0.5, SRC_PLAYER, 0, 0);
    expect(picked()).toBe(MECHANIC_TUNING.pickpocket.bigMax);
  });

  it('with the real odds, a fight with her swipes knocks some coins loose', () => {
    const sim = yard('sable');
    const w = sim.world;
    let picked = 0;
    for (let k = 0; k < 6; k++) sim.spawnEnemy('drizzle-blob', 70 + k * 10, 30 + (k % 3) * 25);
    stepN(sim, makeInput(), 30);
    for (let t = 0; t < 900 && w.enemies.count > 0; t++) {
      let best = w.enemies.items[0]!;
      for (let i = 1; i < w.enemies.count; i++) if (w.enemies.items[i]!.x < best.x) best = w.enemies.items[i]!;
      const dx = best.x - w.player.x;
      const dy = best.y - w.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const ev = stepCollect(sim, makeInput({ aimX: dx / d, aimY: dy / d, fireHeld: true, moveX: d > 20 ? dx / d : 0, moveY: d > 20 ? dy / d : 0 }), 1, ['mechanic']);
      picked += ev.filter((e) => e.a === ME_PICKPOCKET).length;
      w.player.invuln = 1;
    }
    expect(picked).toBeGreaterThan(0);
  });

  it('Wren never pickpockets', () => {
    const sim = yard('wren');
    const w = sim.world;
    const e = sim.spawnEnemy('grate-crab', 60, 56)!;
    stepN(sim, makeInput(), 30);
    for (let i = 0; i < 30; i++) damageEnemy(w, e, 0.1, SRC_PLAYER, 0, 0);
    expect(w.pickups.count).toBe(0);
  });
});

describe('Mosswick: bog blood', () => {
  it('shots leave puddles; in a fight, standing in them soaks up half a Tin heart every 2.5 s, up to two Tin hearts', () => {
    const sim = yard('mosswick');
    const w = sim.world;
    const p = w.player;
    // A fight is on (polish batch 4: no soaking in a cleared room) — a harmless foe far away.
    const foe = sim.spawnEnemy(harmless(), 190, 20, { champion: false })!;
    foe.pinned = true;
    expect(p.attack.held.map((m) => m.id)).toContain('puddle');
    expect(tin(w)).toBe(2);
    // Her own shots leave puddles where they land.
    stepN(sim, makeInput({ aimX: 1, fireHeld: true }), 90);
    let allied = 0;
    for (let i = 0; i < w.creep.count; i++) if (w.creep.items[i]!.allied) allied++;
    expect(allied).toBeGreaterThan(0);
    // Dry ground: nothing.
    w.creep.clear();
    stepN(sim, makeInput(), 200);
    expect(tin(w)).toBe(2);
    // In a puddle: +1 half every 2.5 s.
    const S = MECHANIC_TUNING.soak;
    spawnPlayerPuddle(w, p.x, p.y, 12, 60, 0);
    const soaked = stepCollect(sim, makeInput(), Math.round(S.every * 60) + 2, ['mechanic']);
    expect(soaked.some((e) => e.a === ME_SOAK)).toBe(true);
    expect(tin(w)).toBe(3);
    stepN(sim, makeInput(), Math.round(S.every * 60 * 6));
    expect(tin(w)).toBe(S.cap);
  });

  it('in a cleared room (no fight on) her puddles soak nothing (polish batch 4)', () => {
    const sim = yard('mosswick');
    const w = sim.world;
    expect(w.arena.active).toBe(false);
    expect(w.enemies.count).toBe(0);
    // Shoot the floor and stand in it: the old refill after every room.
    spawnPlayerPuddle(w, w.player.x, w.player.y, 12, 60, 0);
    stepN(sim, makeInput(), Math.round(MECHANIC_TUNING.soak.every * 60 * 4));
    expect(tin(w)).toBe(2);
    // A foe shows up: now it soaks.
    sim.spawnEnemy(harmless(), 190, 20, { champion: false })!.pinned = true;
    spawnPlayerPuddle(w, w.player.x, w.player.y, 12, 60, 0);
    stepN(sim, makeInput(), Math.round(MECHANIC_TUNING.soak.every * 60) + 2);
    expect(tin(w)).toBe(3);
  });

  it('flying over a puddle soaks nothing, and other characters never soak', () => {
    const sim = yard('mosswick');
    const w = sim.world;
    sim.giveItem('leaky-umbrella');
    spawnPlayerPuddle(w, w.player.x, w.player.y, 12, 60, 0);
    stepN(sim, makeInput(), 400);
    expect(tin(w)).toBe(2);
    const wren = yard('wren');
    wren.giveItem('sardine-tin');
    const before = tin(wren.world);
    spawnPlayerPuddle(wren.world, wren.world.player.x, wren.world.player.y, 12, 60, 0);
    stepN(wren, makeInput(), 400);
    expect(tin(wren.world)).toBe(before);
  });
});

describe('Drizzle (secret): rainmaker', () => {
  it('floats, and every hit taken bursts a cloud that soaks every foe in the room', () => {
    const sim = yard('drizzle');
    const w = sim.world;
    expect(w.player.flags.flying).toBe(true);
    const far = sim.spawnEnemy('grate-crab', 16, 16)!;
    const near = sim.spawnEnemy('drizzle-blob', 190, 100)!;
    stepN(sim, makeInput(), 30);
    expect(far.status.t[ST_SLOW]).toBe(0);
    sim.hurtPlayer(1);
    const said = stepCollect(sim, makeInput(), 1, ['say']);
    expect(said.map((e) => e.id)).toContain('CLOUDBURST!');
    expect(far.status.t[ST_SLOW]).toBeGreaterThan(3);
    expect(near.status.t[ST_SLOW]).toBeGreaterThan(3);
    // Wren's hits don't rain.
    const wren = yard('wren');
    const foe = wren.spawnEnemy('grate-crab', 16, 16)!;
    stepN(wren, makeInput(), 30);
    wren.hurtPlayer(1);
    stepN(wren, makeInput(), 1);
    expect(foe.status.t[ST_SLOW]).toBe(0);
  });
});

describe('every character clears a god-mode floor using its mechanic', () => {
  it.each(IDS)('%s', (id) => {
    const sim = Sim.newRun(`FLOOR${id.length}X`, {}, getCharacter(id));
    const w = sim.world;
    // Bolt starts spent, so the wind-up has work to do.
    if (id === 'bolt') w.player.inv.active!.charge = 0;
    const seen = { dig: 0, join: 0, wound: 0, pick: 0, keeper: 0, maxFam: 0, maxPuddles: 0, soak: 0 };
    const step = sim.step.bind(sim);
    sim.step = (input) => {
      step(input);
      const q = sim.events;
      for (let i = 0; i < q.count; i++) {
        const e = q.at(i);
        if (e.type === 'burrow' && e.id === 'pip' && e.a === 0) seen.dig++;
        else if (e.type === 'keeper') seen.keeper++;
        else if (e.type === 'mechanic') {
          if (e.a === ME_FIREFLY_JOIN) seen.join++;
          else if (e.a === ME_WOUND) seen.wound++;
          else if (e.a === ME_PICKPOCKET) seen.pick++;
          else if (e.a === ME_SOAK) seen.soak++;
        }
      }
      seen.maxFam = Math.max(seen.maxFam, familiars(w));
      let puddles = 0;
      for (let i = 0; i < w.creep.count; i++) if (w.creep.items[i]!.allied) puddles++;
      seen.maxPuddles = Math.max(seen.maxPuddles, puddles);
    };
    const report = new Explorer(sim, { untilFloor: 2, collect: true, fightFor: 10, dashEvery: id === 'pip' ? 50 : 0 }).explore();
    expect(report.problems).toEqual([]);
    expect(report.floors[0]!.exit).toBe('trapdoor');
    expect(sim.run!.data.floor).toBe(2);
    switch (id) {
      case 'wren':
        expect(seen.keeper).toBeGreaterThan(0);
        break;
      case 'pip':
        expect(seen.dig).toBeGreaterThan(3);
        break;
      case 'marrow':
        expect(w.player.health.redMax).toBe(0);
        expect(w.player.attack.primary).toBe('boomerang');
        break;
      case 'juniper':
        expect(seen.join).toBeGreaterThan(0);
        expect(seen.maxFam).toBeGreaterThanOrEqual(3);
        break;
      case 'bolt':
        expect(seen.wound).toBeGreaterThan(0);
        break;
      case 'sable':
        expect(seen.pick).toBeGreaterThan(0);
        break;
      case 'mosswick':
        expect(seen.maxPuddles).toBeGreaterThan(0);
        break;
    }
    // The item the character starts with is still there (nothing about the mechanic ate it).
    for (const it of getCharacter(id).startItems) expect(getItem(it)).toBeTruthy();
  });
});
