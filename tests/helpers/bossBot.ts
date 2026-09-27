/**
 * A tiny headless boss-fight bot for tests: god mode, aims at the nearest hittable enemy, fires all
 * the time and strafes in a slow box so shots come from every side. Returns what happened.
 */

import { clearEdges } from '../../src/engine/inputState';
import type { GameEventType } from '../../src/engine/events';
import type { Enemy } from '../../src/sim/enemies/enemy';
import type { Sim } from '../../src/sim/sim';
import { makeInput } from './sim';

export interface FightResult {
  /** The fight ended (every part dead, the room clear). */
  won: boolean;
  ticks: number;
  /** Boss events seen, by type. */
  events: Partial<Record<GameEventType, number>>;
  /** Pattern kinds telegraphed (BOSS_PATTERN_KINDS indices). */
  patterns: Set<number>;
  /** Highest phase reached. */
  phase: number;
}

export function nearestTarget(sim: Sim): Enemy | null {
  const w = sim.world;
  let best: Enemy | null = null;
  let bd = Infinity;
  for (let i = 0; i < w.enemies.count; i++) {
    const o = w.enemies.items[i]!;
    if (o.dead || !o.hittable) continue;
    const d = Math.hypot(o.x - w.player.x, o.y - w.player.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** Plays a boss fight to its end (or `maxTicks`) in god mode. */
export function fightBoss(sim: Sim, maxTicks: number): FightResult {
  const w = sim.world;
  w.godMode = true;
  const input = makeInput();
  const res: FightResult = { won: false, ticks: 0, events: {}, patterns: new Set(), phase: 0 };
  for (let t = 0; t < maxTicks; t++) {
    const target = nearestTarget(sim);
    if (target) {
      const dx = target.x - w.player.x;
      const dy = target.y - w.player.y;
      const d = Math.hypot(dx, dy) || 1;
      input.aimX = dx / d;
      input.aimY = dy / d;
      input.fireHeld = true;
    } else {
      input.fireHeld = false;
    }
    const side = Math.floor(t / 90) % 4;
    input.moveX = [1, 0, -1, 0][side]! * 0.6;
    input.moveY = [0, 1, 0, -1][side]! * 0.6;
    sim.step(input);
    clearEdges(input);
    const q = sim.events;
    for (let i = 0; i < q.count; i++) {
      const e = q.at(i);
      if (e.type.startsWith('boss')) res.events[e.type] = (res.events[e.type] ?? 0) + 1;
      if (e.type === 'bossTell') res.patterns.add(e.a);
    }
    if (w.boss.active) res.phase = Math.max(res.phase, w.boss.phase);
    res.ticks = t + 1;
    if (w.boss.done && !w.arena.active) {
      res.won = true;
      break;
    }
  }
  return res;
}
