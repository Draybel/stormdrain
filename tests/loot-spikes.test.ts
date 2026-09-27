/**
 * Polish batch 4 (B4-7): loot never comes to rest on spikes. On floors 5-6 spikes were the balance harness's biggest
 * damage source, nearly all of it taken after the room was clear, picking up loot that had settled on spike tiles. A
 * grounded pickup on a spike cell now slides on to the nearest spike-free floor (sim/pickups.ts keepOffSpikes), and
 * the room-clear reward already drops on the plain floor nearest the middle.
 */

import { describe, expect, it } from 'vitest';
import { findEnemy } from '../src/content/registry';
import { startWave } from '../src/sim/arena';
import { TILE } from '../src/sim/constants';
import { spawnEnemy } from '../src/sim/enemies/spawn';
import { templateById } from '../src/sim/run/contents';
import { PK } from '../src/sim/pickupKinds';
import { spawnPickup, spikeExitStep } from '../src/sim/pickups';
import { Tile } from '../src/sim/tiles';
import type { World } from '../src/sim/world';
import { makeInput, makeSim, stepN } from './helpers/sim';

const ROOM = [
  '.............',
  '.^^^.........',
  '.^^^.........',
  '.^^^...@.....',
  '.............',
  '.......^^^^^#',
  '.......^^^^^#',
];

function onSpikes(w: World, x: number, y: number): boolean {
  return w.room.get(Math.floor(x / TILE), Math.floor(y / TILE)) === Tile.Spikes;
}

describe('loot slides off spikes', () => {
  it('a coin and a key dropped on a spike tile end up on spike-free floor within a second', () => {
    for (const [col, row] of [
      [2, 2],
      [1, 1],
      [9, 6],
      [11, 5],
    ] as const) {
      const sim = makeSim(3, { room: ROOM });
      const w = sim.world;
      const x = col * TILE + TILE / 2;
      const y = row * TILE + TILE / 2;
      const coin = spawnPickup(w, PK.Coin, x, y, false)!;
      const key = spawnPickup(w, PK.Key, x + 2, y - 1, false)!;
      expect(onSpikes(w, coin.x, coin.y)).toBe(true);
      stepN(sim, makeInput(), 60);
      for (const pk of [coin, key]) {
        expect(pk.alive).toBe(true);
        expect(onSpikes(w, pk.x, pk.y), `${pk.kind} from (${col}, ${row}) is at ${pk.x.toFixed(1)}, ${pk.y.toFixed(1)} after 1 s`).toBe(false);
      }
      // …and comes to rest there.
      stepN(sim, makeInput(), 60);
      for (const pk of [coin, key]) {
        expect(onSpikes(w, pk.x, pk.y)).toBe(false);
        expect(Math.hypot(pk.vx, pk.vy)).toBeLessThan(1);
      }
    }
  });

  it('popped loot and heavy chests too, and plain floor loot stays put', () => {
    const sim = makeSim(9, { room: ROOM });
    const w = sim.world;
    const chest = spawnPickup(w, PK.Satchel, 2 * TILE + 8, 2 * TILE + 8, false)!;
    const popped: ReturnType<typeof spawnPickup>[] = [];
    for (let i = 0; i < 12; i++) popped.push(spawnPickup(w, PK.Coin, 9 * TILE + 8, 5 * TILE + 8, true));
    const still = spawnPickup(w, PK.Bomb, 10 * TILE + 8, 2 * TILE + 8, false)!;
    stepN(sim, makeInput(), 90);
    expect(onSpikes(w, chest.x, chest.y)).toBe(false);
    for (const pk of popped) expect(onSpikes(w, pk!.x, pk!.y)).toBe(false);
    expect(still.x).toBe(10 * TILE + 8);
    expect(still.y).toBe(2 * TILE + 8);
  });

  it('the way out only crosses floor and spikes (never a block or a pit), nearest floor first', () => {
    const sim = makeSim(1, {
      room: ['.............', '.#^^.........', '.O^^.........', '.............', '.............', '.............', '......@......'],
    });
    const w = sim.world;
    // From (2, 1): west is a rock, so north (row 0 is floor) is the way.
    expect(spikeExitStep(w, 1 * 13 + 2)).toBe(0 * 13 + 2);
    // From (2, 2): west is a pit, south (row 3) is floor.
    expect(spikeExitStep(w, 2 * 13 + 2)).toBe(3 * 13 + 2);
  });

  it('room-clear rewards in gen.normal.spikelanes never drop onto spikes (100 seeds)', () => {
    const t = templateById('gen.normal.spikelanes')!;
    const grid = t.grid.map((row, r) => (r === 3 ? `${row.slice(0, 6)}@${row.slice(7)}` : row));
    const rat = findEnemy('scurrier')!;
    let rewards = 0;
    let resting = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const sim = makeSim(seed, { room: grid });
      const w = sim.world;
      w.godMode = true;
      startWave(w, {});
      // Champions everywhere (they always drop something), killed where they stand: on and next to the spikes.
      for (const [c, r] of [
        [2, 1],
        [9, 5],
        [3, 5],
      ] as const) {
        const e = spawnEnemy(w, rat, c * TILE + 8, r * TILE + 8, { champion: 'golden' });
        e?.hurt(9999, 1, 0, 0);
      }
      for (let i = 0; i < w.enemies.count; i++) w.enemies.items[i]!.hurt(9999, 1, 0, 0);
      let clearAt: [number, number] | null = null;
      stepN(sim, makeInput(), 90, (s) => {
        const q = s.events;
        for (let i = 0; i < q.count; i++) {
          const ev = q.at(i);
          if (ev.type === 'roomClear') clearAt = [ev.x, ev.y];
        }
      });
      expect(clearAt, `seed ${seed}: no room clear`).not.toBeNull();
      expect(onSpikes(w, clearAt![0], clearAt![1]), `seed ${seed}: reward spot on spikes`).toBe(false);
      rewards++;
      for (let i = 0; i < w.pickups.count; i++) {
        const pk = w.pickups.items[i]!;
        resting++;
        expect(onSpikes(w, pk.x, pk.y), `seed ${seed}: pickup ${pk.kind} rests on spikes at ${pk.x.toFixed(1)}, ${pk.y.toFixed(1)}`).toBe(false);
      }
    }
    expect(rewards).toBe(100);
    expect(resting).toBeGreaterThan(100);
  });
});
