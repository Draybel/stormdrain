/** Headless helpers: build a Sim and drive it with scripted input (ARCHITECTURE §9). */

import { clearEdges, createInputState, type InputState } from '../../src/engine/inputState';
import type { GameEventType } from '../../src/engine/events';
import { Sim, type SimOptions } from '../../src/sim/sim';

export function makeSim(seed: number | string = 1, opts: Omit<SimOptions, 'seed'> = {}): Sim {
  return new Sim({ seed, ...opts });
}

export function makeInput(init: Partial<InputState> = {}): InputState {
  return Object.assign(createInputState(), init);
}

export interface StepStats {
  events: Partial<Record<GameEventType, number>>;
}

/**
 * Steps `n` ticks with `input` (edges are cleared after each tick, like the real loop).
 * `each` runs after every tick, e.g. for invariant checks.
 */
export function stepN(sim: Sim, input: InputState, n: number, each?: (sim: Sim) => void): StepStats {
  const stats: StepStats = { events: {} };
  for (let i = 0; i < n; i++) {
    sim.step(input);
    clearEdges(input);
    const q = sim.events;
    for (let e = 0; e < q.count; e++) {
      const t = q.at(e).type;
      stats.events[t] = (stats.events[t] ?? 0) + 1;
    }
    each?.(sim);
  }
  return stats;
}
