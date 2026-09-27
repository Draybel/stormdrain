/**
 * Phase 5 regressions: bugs the play-bot (tests/bot.test.ts) found in real play, each pinned by a small
 * headless reproduction.
 */

import { describe, expect, it } from 'vitest';
import { clearEdges } from '../src/engine/inputState';
import { WALK_MODE, circleOverlapsGrid } from '../src/sim/collision';
import { recomputePlayer } from '../src/sim/effects';
import { spawnPedestal } from '../src/sim/pedestals';
import { PK } from '../src/sim/pickupKinds';
import { spawnPickup } from '../src/sim/pickups';
import { PROP_SLOTS } from '../src/sim/shopProps';
import { Sim } from '../src/sim/sim';
import { DOOR_FRONT_X, DOOR_FRONT_Y } from '../src/sim/doors';
import { makeInput, makeSim } from './helpers/sim';

function step(sim: Sim, n: number, input = makeInput()): void {
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
  }
}

describe('the Dizzy Tonic and doors', () => {
  it('while dizzy (movement mirrored), walking into a doorway still takes her through it', () => {
    const sim = Sim.newRun('dizzy-door', {});
    const w = sim.world;
    w.godMode = true;
    const run = sim.run!;
    const side = w.doors.slots.findIndex((s) => s.kind !== 0 && s.state === 2);
    expect(side).toBeGreaterThanOrEqual(0);
    const before = run.data.current;
    // Dizzy: the flag the tonic sets for 6 s (a temporary persistent effect).
    w.player.temps.push({ effect: { type: 'flag', flag: 'confused' }, time: 6, source: 'test' } as never);
    recomputePlayer(w);
    expect(w.player.flags.confused).toBe(true);
    step(sim, 30); // the door cooldown after the room entry
    w.player.placeAt(DOOR_FRONT_X[side]!, DOOR_FRONT_Y[side]!);
    // Mirrored: pushing the stick AWAY from the door walks her INTO it.
    const input = makeInput({ moveX: -[0, 1, 0, -1][side]!, moveY: -[-1, 0, 1, 0][side]! });
    for (let i = 0; i < 60 && run.data.current === before; i++) step(sim, 1, input);
    expect(run.data.current).not.toBe(before);
  });
});

describe('loot never ends up where she can never reach it', () => {
  /** Two blocks touching at a corner with a prop beside the seam (the Gumball Gambler's pocket). */
  const SEAM = ['.............', '..........M..', '.........$...', '.............', '.............', '.............', '.............'];

  it('a prop no longer shoves loot into the seam between two corner-touching blocks', () => {
    const sim = makeSim('seam', { room: SEAM });
    const w = sim.world;
    w.player.placeAt(40, 90);
    const ped = spawnPedestal(w, 152, 24, '')!;
    ped.prop = PROP_SLOTS;
    // Coins spilling right into the pocket, as a payout does.
    const coins = [];
    for (let i = 0; i < 5; i++) {
      const pk = spawnPickup(w, PK.Coin, 158, 31.4, true)!;
      pk.vx = -35 + i * 12;
      pk.vy = 33 - i * 10;
      coins.push(pk);
    }
    step(sim, 120);
    for (const pk of coins) {
      if (!pk.alive) continue;
      expect(circleOverlapsGrid(w.room, pk.x, pk.y, pk.r - 0.25, WALK_MODE), `coin at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`).toBe(false);
      const d = Math.hypot(pk.x - ped.x, pk.y - ped.y);
      expect(d).toBeGreaterThan(pk.r + 6 - 0.6);
    }
  });

  it('loot spawned inside a crate pile or over a pit (a flyer shot down there) lands on open floor', () => {
    const room = ['.............', '...xxx.......', '...xxx.......', '...xxx..OOO..', '........OOO..', '........OOO..', '.............'];
    const sim = makeSim('inside', { room });
    const w = sim.world;
    w.player.placeAt(24, 100);
    const inCrates = spawnPickup(w, PK.Coin, 72, 40, true)!;
    const inPit = spawnPickup(w, PK.Key, 152, 72, true)!;
    step(sim, 90);
    for (const pk of [inCrates, inPit]) {
      expect(pk.alive).toBe(true);
      expect(circleOverlapsGrid(w.room, pk.x, pk.y, pk.r - 0.25, WALK_MODE), `kind ${pk.kind} at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`).toBe(false);
    }
  });

  it('two pits side by side are one pit: no seam between their lips for a coin to sit in', () => {
    const room = ['.............', '.............', '.............', '.OOOO...OOOO.', '.............', '.............', '.............'];
    const sim = makeSim('pitseam', { room });
    const w = sim.world;
    w.player.placeAt(200, 100);
    // A coin rolling down the line between two pit cells (x = 32), and one along a pit row (y = 56).
    const a = spawnPickup(w, PK.Coin, 32, 36, false)!;
    a.vy = 120;
    const b = spawnPickup(w, PK.Coin, 12, 56, false)!;
    b.vx = 150;
    step(sim, 90);
    for (const pk of [a, b]) {
      expect(circleOverlapsGrid(w.room, pk.x, pk.y, pk.r - 0.25, WALK_MODE), `coin at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`).toBe(false);
      // Not in the pits' rows at all (it was stopped at the lip).
      const inPitRow = pk.y > 48 && pk.y < 64 && pk.x > 16 && pk.x < 80;
      expect(inPitRow, `coin at ${pk.x.toFixed(1)},${pk.y.toFixed(1)}`).toBe(false);
    }
  });
});
