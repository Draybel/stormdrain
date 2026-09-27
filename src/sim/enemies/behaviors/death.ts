/**
 * On-death effects (DEATH_KINDS): explode, split into smaller copies (or another enemy), ring of shots.
 * A frozen enemy shatters into ice instead of splitting.
 */

import { explode } from '../../bombs';
import type { DeathKind } from '../../types';
import type { World } from '../../world';
import type { Enemy } from '../enemy';
import { spawnEnemyShot } from '../shots';
import { spawnEnemy } from '../spawn';
import { ST_CHARM, hasStatus } from '../status';
import type { DeathBehavior } from './common';

const TAU = Math.PI * 2;

const explodeOnDeath: DeathBehavior = {
  params: {
    /** Blast radius, px (a bomb is 40). */
    radius: [28, 8, 80],
    /** Damage to other hittables in the blast. */
    damage: [20, 0, 200],
  },
  run(w, e, d) {
    explode(w, e.x, e.y, d.p.radius!, d.p.damage!);
  },
};

const split: DeathBehavior = {
  params: {
    count: [2, 1, 6],
    /** Size of each copy relative to the parent. */
    scale: [0.6, 0.3, 1],
    /** HP of each copy relative to the parent's max HP. */
    hp: [0.4, 0.05, 1],
    /** Generations allowed (1 = copies don't split again). */
    gen: [1, 1, 3],
  },
  run(w, e, d, frozen) {
    if (frozen || e.gen >= d.p.gen!) return;
    const def = d.minion ?? e.def;
    const n = d.p.count!;
    splitInto(w, e, def === e.def ? e.scale * d.p.scale! : 1, e.maxHp * d.p.hp!, n, def);
  },
};

/** Spawns `n` children of `e` around its position, flung outward. Shared with the Splitter champion. */
export function splitInto(w: World, e: Enemy, scale: number, hp: number, n: number, def = e.def): void {
  const off = w.combatRng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    const c = spawnEnemy(w, def, e.x + Math.cos(a) * 3, e.y + Math.sin(a) * 3, {
      champion: false,
      scale,
      hp: Math.max(1, hp),
      gen: e.gen + 1,
      spawnT: 0.15,
      seen: false,
    });
    if (c) {
      c.kx = Math.cos(a) * 110;
      c.ky = Math.sin(a) * 110;
    }
  }
}

const ringOnDeath: DeathBehavior = {
  params: {
    count: [8, 3, 24],
    speed: [80, 20, 320],
    dmg: [1, 1, 4],
    size: [3, 1.5, 8],
  },
  run(w, e, d) {
    deathRing(w, e, d.p.count!, d.p.speed!, d.p.dmg!, d.p.size!, d.style);
  },
};

/** A ring of `n` shots from where `e` died. Shared with the Vengeful champion. */
export function deathRing(w: World, e: Enemy, n: number, speed: number, dmg: number, size: number, style: number): void {
  const off = w.combatRng.next() * TAU;
  const ally = hasStatus(e.status, ST_CHARM);
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * TAU;
    spawnEnemyShot(w, e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg, size, style, ally, e.uid);
  }
  w.events.emit('enemyShoot', e.x, e.y, n, style, e.def.id);
}

export const DEATHS: Readonly<Record<DeathKind, DeathBehavior>> = {
  explode: explodeOnDeath,
  split,
  ringN: ringOnDeath,
};
