import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/rng';
import { getDropTable } from '../src/content/registry';
import { explode, spawnBomb } from '../src/sim/bombs';
import { TILE } from '../src/sim/constants';
import { rollDrops } from '../src/sim/drops';
import { BONUS_EMBER, BONUS_TIN, addBonus, describeHealth } from '../src/sim/health';
import { PK, pickupName } from '../src/sim/pickupKinds';
import { spawnPickup, type Pickup } from '../src/sim/pickups';
import { Deco, Tile } from '../src/sim/tiles';
import { BOMB_TUNING } from '../src/sim/tuning';
import type { World } from '../src/sim/world';
import { makeInput, makeSim, stepN } from './helpers/sim';

const EMPTY = ['.............', '.............', '.............', '......@......', '.............', '.............', '.............'];

function emptySim(seed: number | string = 1, room: readonly string[] = EMPTY) {
  return makeSim(seed, { room });
}

function pickups(w: World): Pickup[] {
  return w.pickups.items.slice(0, w.pickups.count);
}

/** Drops a pickup right on the player (no pop) and steps once. */
function touch(sim: ReturnType<typeof emptySim>, kind: number): Pickup {
  const p = sim.world.player;
  const pk = spawnPickup(sim.world, kind as never, p.x, p.y, false)!;
  stepN(sim, makeInput(), 1);
  return pk;
}

describe('pickup collection rules', () => {
  it('coins, bombs, keys add up and stop at 99', () => {
    const sim = emptySim();
    const inv = sim.world.player.inv;
    touch(sim, PK.Coin);
    touch(sim, PK.SilverCoin);
    touch(sim, PK.GoldCoin);
    expect(inv.coins).toBe(16);
    touch(sim, PK.Bomb);
    touch(sim, PK.DoubleBomb);
    expect(inv.bombs).toBe(1 + 3);
    touch(sim, PK.Key);
    touch(sim, PK.KeyRing);
    expect(inv.keys).toBe(3);
    inv.coins = 99;
    const c = touch(sim, PK.Coin);
    expect(c.alive).toBe(true); // refused at the cap (and shoved aside)
    expect(inv.coins).toBe(99);
  });

  it('the Lucky Coin gives a coin and a little luck', () => {
    const sim = emptySim();
    const p = sim.world.player;
    touch(sim, PK.LuckyCoin);
    expect(p.inv.coins).toBe(1);
    expect(p.stats.luck).toBeGreaterThan(0);
  });

  it('red hearts are left alone at full health (and get pushed), taken when hurt', () => {
    const sim = emptySim();
    const p = sim.world.player;
    const h = touch(sim, PK.Heart);
    expect(h.alive).toBe(true);
    h.x = p.x + 12;
    h.y = p.y;
    h.vx = h.vy = 0;
    stepN(sim, makeInput({ moveX: 1 }), 20); // walk into it: it slides ahead
    expect(h.alive).toBe(true);
    expect(h.x).toBeGreaterThan(p.x);
    sim.hurtPlayer(3);
    expect(p.red).toBe(3);
    touch(sim, PK.Heart);
    expect(p.red).toBe(5);
    touch(sim, PK.HalfHeart);
    expect(p.red).toBe(6);
  });

  it('bonus hearts are taken at full health', () => {
    const sim = emptySim();
    const p = sim.world.player;
    touch(sim, PK.TinHeart);
    touch(sim, PK.EmberHeart);
    expect(describeHealth(p.health)).toBe('R6/6 T2 E2');
  });

  it('spark cells need a chargeable active', () => {
    const sim = emptySim();
    const p = sim.world.player;
    const s = touch(sim, PK.SparkSmall);
    expect(s.alive).toBe(true); // no active: refused
    sim.giveItem('jar-of-lightning');
    p.inv.active!.charge = 0;
    stepN(sim, makeInput({ moveX: 0.3 }), 40);
    // Walk back over the cell.
    const cell = touch(sim, PK.SparkSmall);
    expect(cell.alive).toBe(false);
    expect(p.inv.active!.charge).toBe(1);
    touch(sim, PK.SparkFull);
    expect(p.inv.active!.charge).toBe(2);
    const extra = touch(sim, PK.SparkSmall);
    expect(extra.alive).toBe(true); // full: refused
  });

  it('popped loot must land before it can be picked up, and collect events fire', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    const pk = spawnPickup(w, PK.Coin, p.x, p.y, true)!;
    stepN(sim, makeInput(), 2);
    expect(pk.alive).toBe(true);
    pk.x = p.x;
    pk.y = p.y;
    pk.vx = pk.vy = 0;
    const st = stepN(sim, makeInput(), 40, () => {
      if (pk.alive) {
        pk.x = p.x;
        pk.y = p.y;
      }
    });
    expect(pk.alive).toBe(false);
    expect(st.events.pickup).toBe(1);
    expect(p.inv.coins).toBe(1);
  });

  it('pickups slide with friction and bounce off walls', () => {
    const sim = emptySim();
    const w = sim.world;
    const pk = spawnPickup(w, PK.Key, 12, 40, false)!;
    pk.vx = -200;
    stepN(sim, makeInput(), 5);
    expect(pk.vx).toBeGreaterThan(0); // bounced off the left wall
    stepN(sim, makeInput(), 90);
    expect(pk.vx).toBe(0); // friction settled it
    expect(pk.x).toBeGreaterThan(pk.r);
  });

  it('the magnet flag pulls collectible pickups in', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    sim.giveItem('fridge-magnet');
    const pk = spawnPickup(w, PK.Coin, p.x + 40, p.y, false)!;
    stepN(sim, makeInput(), 60);
    expect(pk.alive).toBe(false);
    expect(p.inv.coins).toBe(1);
  });
});

describe('chests', () => {
  it('a satchel opens on touch and bursts into seeded loot', () => {
    const loot = (seed: string): string[] => {
      const sim = emptySim(seed);
      const w = sim.world;
      const chest = touch(sim, PK.Satchel);
      expect(chest.opened).toBe(true);
      expect(w.counters.chestsOpened).toBe(1);
      return pickups(w)
        .filter((k) => k !== chest)
        .map((k) => pickupName(k.kind))
        .sort();
    };
    const a = loot('chest-a');
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(loot('chest-a')).toEqual(a);
  });

  it('a lockbox needs a key (and uses it up)', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    const box = touch(sim, PK.Lockbox);
    expect(box.opened).toBe(false);
    p.inv.keys = 2;
    box.x = p.x;
    box.y = p.y;
    stepN(sim, makeInput(), 1);
    expect(box.opened).toBe(true);
    expect(p.inv.keys).toBe(1);
    expect(pickups(w).length).toBeGreaterThanOrEqual(4); // box + 3..4 rolls
    // Opened chests stay as props and never open twice.
    box.x = p.x;
    box.y = p.y;
    stepN(sim, makeInput(), 1);
    expect(p.inv.keys).toBe(1);
  });
});

describe('drop tables', () => {
  it('are deterministic by seed and vary between seeds', () => {
    const names = (seed: number): string => {
      const rng = new Rng(seed);
      const out: string[] = [];
      for (let i = 0; i < 20; i++) out.push(rollDrops(getDropTable('crate'), rng).map((r) => pickupName(r.kind)).join('+') || '-');
      return out.join(',');
    };
    expect(names(42)).toBe(names(42));
    expect(names(42)).not.toBe(names(43));
  });

  it('luck shrinks the chance of nothing', () => {
    const drops = (luck: number): number => {
      const rng = new Rng(7);
      let n = 0;
      for (let i = 0; i < 2000; i++) n += rollDrops(getDropTable('urn'), rng, luck).length;
      return n;
    };
    expect(drops(8)).toBeGreaterThan(drops(0) * 1.2);
  });

  it('a lockbox can hold a trinket or consumable from the chest pool', () => {
    const sim = emptySim('lockbox-items');
    const w = sim.world;
    let items = 0;
    for (let i = 0; i < 40; i++) {
      w.player.inv.keys = 1;
      const box = touch(sim, PK.Lockbox);
      for (const k of pickups(w)) if (k.itemId) items++;
      for (const k of pickups(w)) if (k !== box || box.opened) w.pickups.release(k);
    }
    expect(items).toBeGreaterThan(0);
  });
});

describe('bombs', () => {
  it('placing needs a bomb; the fuse blinks for ~1.4 s then it explodes', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    expect(p.inv.bombs).toBe(1);
    let st = stepN(sim, makeInput({ bomb: true }), 1);
    expect(st.events.bombPlaced).toBe(1);
    expect(p.inv.bombs).toBe(0);
    expect(w.bombs.count).toBe(1);
    st = stepN(sim, makeInput({ bomb: true }), 1);
    expect(st.events.denied).toBe(1);
    // Walk away so the blast misses.
    st = stepN(sim, makeInput({ moveX: 1 }), Math.round(BOMB_TUNING.fuse * 60) - 4);
    expect(st.events.explosion).toBeUndefined();
    st = stepN(sim, makeInput(), 6);
    expect(st.events.explosion).toBe(1);
    expect(w.bombs.count).toBe(0);
    expect(p.red).toBe(6);
  });

  it('the blast hurts the player one full heart, bonus hearts first', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    addBonus(p.health, BONUS_TIN, 1);
    addBonus(p.health, BONUS_EMBER, 1);
    explode(w, p.x + 5, p.y);
    expect(describeHealth(p.health)).toBe('R6/6'); // ember half, then tin half, red untouched
    p.invuln = 0;
    explode(w, p.x, p.y);
    expect(p.red).toBe(4);
  });

  it('destroys rocks, crates, urns and tinted rocks (which drop loot); metal survives; fire goes out', () => {
    const room = ['.............', '.....#x#.....', '.....$.u.....', '.....fMM.....', '.............', '.............', '@............'];
    const sim = emptySim('boom', room);
    const w = sim.world;
    const cx = 6 * TILE + 8;
    const cy = 2 * TILE + 8;
    explode(w, cx, cy);
    const t = (c: number, r: number) => w.room.get(c, r);
    expect(t(5, 1)).toBe(Tile.Floor);
    expect(t(6, 1)).toBe(Tile.Floor);
    expect(t(7, 1)).toBe(Tile.Floor);
    expect(t(5, 2)).toBe(Tile.Floor);
    expect(t(7, 2)).toBe(Tile.Floor);
    expect(t(5, 3)).toBe(Tile.Floor);
    expect(t(6, 3)).toBe(Tile.Metal);
    expect(t(7, 3)).toBe(Tile.Metal);
    expect(w.room.deco[1 * 13 + 5]).toBe(Deco.Rubble);
    expect(w.room.deco[3 * 13 + 5]).toBe(Deco.Ash);
    expect(w.counters.tilesBroken).toBe(6);
    expect(w.pickups.count).toBeGreaterThanOrEqual(1); // tinted rock always pays out
    // The player far away is unhurt.
    expect(w.player.red).toBe(6);
  });

  it('chain-detonates nearby bombs and pushes pickups', () => {
    const sim = emptySim();
    const w = sim.world;
    const b1 = spawnBomb(w, 40, 40, 5)!;
    const b2 = spawnBomb(w, 70, 40, 5)!;
    const coin = spawnPickup(w, PK.Coin, 60, 60, false)!;
    b1.fuse = 0.01;
    const st = stepN(sim, makeInput(), 30);
    expect(st.events.explosion).toBe(2);
    expect(b2.alive).toBe(false);
    expect(coin.x !== 60 || coin.y !== 60).toBe(true);
  });

  it('reports secret walls to the floor code', () => {
    const sim = emptySim();
    const w = sim.world;
    const hits: [number, number][] = [];
    w.onSecretWallBombed = (x, y) => hits.push([x, y]);
    explode(w, 104, 6); // under the top door slot
    expect(hits).toEqual([[104, 0]]);
    hits.length = 0;
    w.room.set(3, 3, Tile.SecretWall);
    explode(w, 3 * TILE + 8, 3 * TILE + 8);
    expect(hits).toEqual([[3 * TILE + 8, 3 * TILE + 8]]);
    expect(w.room.get(3, 3)).toBe(Tile.Floor);
  });

  it('walking into a placed bomb nudges it (after stepping off it)', () => {
    const sim = emptySim();
    const w = sim.world;
    const p = w.player;
    const b = spawnBomb(w, p.x + 20, p.y, 9)!;
    b.clear = true;
    const x0 = b.x;
    stepN(sim, makeInput({ moveX: 1 }), 20);
    expect(b.x).toBeGreaterThan(x0 + 5);
    expect(p.x).toBeLessThan(b.x);
  });
});

describe('room grid interactions', () => {
  function shootAt(sim: ReturnType<typeof emptySim>, ticks: number) {
    return stepN(sim, makeInput({ aimX: 1, aimY: 0, fireHeld: true }), ticks);
  }

  it('crates take two shots, urns one', () => {
    const sim = emptySim(1, ['.............', '.............', '.............', '@....x.......', '.............', '.............', '.............']);
    const w = sim.world;
    shootAt(sim, 25); // shots on ticks 1 and 21; the first lands on ~tick 23
    expect(w.room.get(5, 3)).toBe(Tile.Crate);
    expect(w.room.hp[3 * 13 + 5]).toBe(1);
    stepN(sim, makeInput(), 25);
    expect(w.room.get(5, 3)).toBe(Tile.Floor);
    expect(w.room.deco[3 * 13 + 5]).toBe(Deco.Planks);

    const urn = emptySim(1, ['.............', '.............', '.............', '@....u.......', '.............', '.............', '.............']);
    shootAt(urn, 25);
    expect(urn.world.room.get(5, 3)).toBe(Tile.Floor);
  });

  it('fires hurt on contact and go out after several shots', () => {
    const sim = emptySim(1, ['.............', '.............', '.............', '@....f.......', '.............', '.............', '.............']);
    const w = sim.world;
    const st = shootAt(sim, 90);
    expect(st.events.tileHit).toBeGreaterThanOrEqual(3);
    expect(w.room.get(5, 3)).toBe(Tile.Floor);
    const burn = emptySim(1, ['.............', '.............', '.............', '....@f.......', '.............', '.............', '.............']);
    stepN(burn, makeInput({ moveX: 1 }), 20);
    expect(burn.world.player.red).toBe(5);
    expect(burn.world.player.x).toBeLessThan(5 * TILE); // fire is solid
  });

  it('spikes hurt when stepped on, unless flying; pits block walking but not flying', () => {
    const room = ['.............', '.............', '.............', '@.^^OO.......', '.............', '.............', '.............'];
    const walk = emptySim(1, room);
    stepN(walk, makeInput({ moveX: 1 }), 60);
    expect(walk.world.player.red).toBeLessThan(6);
    expect(walk.world.player.x).toBeLessThan(4 * TILE);

    const fly = emptySim(1, room);
    fly.giveItem('leaky-umbrella');
    expect(fly.world.player.flags.flying).toBe(true);
    stepN(fly, makeInput({ moveX: 1 }), 60);
    expect(fly.world.player.red).toBe(6);
    expect(fly.world.player.x).toBeGreaterThan(6 * TILE);
  });

  it('metal and rocks stop shots; shots never break them', () => {
    const sim = emptySim(1, ['.............', '.............', '.............', '@....M#$.....', '.............', '.............', '.............']);
    shootAt(sim, 120);
    expect(sim.world.room.get(5, 3)).toBe(Tile.Metal);
    expect(sim.world.room.get(6, 3)).toBe(Tile.Rock);
    expect(sim.world.room.get(7, 3)).toBe(Tile.RockTinted);
  });
});

describe('training room', () => {
  it('holds pedestals, chests and every pickup family', () => {
    const s = makeSim('yard').summary();
    const kinds = new Set(s.pickups.map((k) => k.kind));
    for (const k of ['coin', 'silverCoin', 'goldCoin', 'luckyCoin', 'halfHeart', 'heart', 'tinHeart', 'emberHeart', 'bomb', 'key', 'sparkSmall', 'sparkFull', 'satchel', 'lockbox', 'trinket', 'consumable']) {
      expect(kinds.has(k), k).toBe(true);
    }
    expect(s.pedestals.filter((p) => p.item).length).toBe(6);
    for (const k of s.pickups.filter((x) => x.kind === 'trinket' || x.kind === 'consumable')) expect(k.item).not.toBe('');
  });

  it('popping every dummy at once counts as a room clear (recharges the active)', () => {
    const sim = makeSim('clear');
    const w = sim.world;
    sim.giveItem('jar-of-lightning');
    w.player.inv.active!.charge = 0;
    for (let i = 0; i < w.dummies.count; i++) {
      const d = w.dummies.items[i]!;
      d.popped = true;
      d.respawn = 2;
    }
    stepN(sim, makeInput(), 1);
    expect(w.counters.roomsCleared).toBe(1);
    expect(w.player.inv.active!.charge).toBe(1);
    stepN(sim, makeInput(), 1);
    expect(w.counters.roomsCleared).toBe(1); // once per wipe
  });
});

describe('stress', () => {
  it('a full pool of loot and a pile of bombs stays finite, in the room and within caps', () => {
    const sim = makeSim('stress');
    const w = sim.world;
    const kinds = [PK.Coin, PK.Heart, PK.Key, PK.Bomb, PK.SparkSmall, PK.TinHeart, PK.Satchel, PK.GoldCoin];
    for (let i = 0; i < 80; i++) spawnPickup(w, kinds[i % kinds.length] as never, 40 + (i % 10) * 14, 20 + ((i / 10) | 0) * 10, true);
    expect(w.pickups.count).toBe(64);
    for (let i = 0; i < 20; i++) spawnBomb(w, 30 + i * 8, 50 + (i % 3) * 20, 0.5 + (i % 5) * 0.3);
    expect(w.bombs.count).toBe(16);
    const t0 = performance.now();
    stepN(sim, makeInput({ moveX: 0.6, moveY: -0.4, aimX: 1, aimY: 0, fireHeld: true }), 600, (s) => {
      const ww = s.world;
      for (let i = 0; i < ww.pickups.count; i++) {
        const k = ww.pickups.items[i]!;
        expect(Number.isFinite(k.x) && Number.isFinite(k.y) && Number.isFinite(k.z)).toBe(true);
        expect(k.x).toBeGreaterThanOrEqual(-1);
        expect(k.x).toBeLessThanOrEqual(13 * TILE + 1);
        expect(k.y).toBeGreaterThanOrEqual(-1);
        expect(k.y).toBeLessThanOrEqual(7 * TILE + 1);
      }
      expect(ww.pickups.count).toBeLessThanOrEqual(64);
    });
    expect(w.counters.explosions).toBe(16);
    expect(w.bombs.count).toBe(0);
    // 10 simulated seconds of this should take a small fraction of real time, even in a test runner.
    expect(performance.now() - t0).toBeLessThan(5000);
  });
});
