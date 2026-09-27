/**
 * BossDef → what the brain runs, resolved once per def and cached (like compileEnemy):
 * - one synthetic EnemyDef per phase (the boss IS an Enemy: hits, statuses, knockback, collisions and
 *   rendering all reuse the enemy code) carrying the phase's baseline movement, its enemy-library
 *   attacks (plus the phase `summon` as a spawnMinion attack), speed, contact damage, mass and resist;
 * - the phase's patterns with their params resolved (defaults filled, values clamped), the minion defs
 *   they call and the shot style;
 * - the phase thresholds (fractions of the fight's HP).
 */

import { findEnemy } from '../../content/registry';
import { compileEnemy, resolveParams, shotStyleIndex } from '../enemies/behaviors/index';
import type { CompiledEnemy, Params } from '../enemies/behaviors/common';
import { BOSS_PATTERN_KINDS, type AttackSpec, type BossDef, type BossPatternKind, type BossPatternSpec, type EnemyDef } from '../types';
import { PATTERNS, type PatternBehavior } from './patterns';

export interface CompiledPattern {
  readonly kind: BossPatternKind;
  /** Index in BOSS_PATTERN_KINDS (events). */
  readonly index: number;
  readonly beh: PatternBehavior;
  readonly p: Params;
  /** summon / shields: the enemy it calls. */
  readonly minion: EnemyDef | null;
  readonly style: number;
  readonly hook: string;
  readonly weight: number;
}

export interface CompiledPhase {
  readonly at: number;
  readonly name: string;
  readonly enemy: EnemyDef;
  readonly cfg: CompiledEnemy;
  readonly patterns: readonly CompiledPattern[];
  readonly enter: CompiledPattern | null;
  readonly random: boolean;
  readonly rest: readonly [number, number];
  readonly pace: number;
  /** Colour shift ('' = none). */
  readonly tint: string;
}

export interface CompiledBoss {
  readonly def: BossDef;
  readonly phases: readonly CompiledPhase[];
  /** Phase thresholds (fraction of the fight's HP), phase 0 first (1). */
  readonly marks: readonly number[];
}

/** Defaults by boss kind. */
export const BOSS_DEFAULTS = {
  speed: 30,
  mass: { boss: 6, miniboss: 3, final: 9 },
  resist: { boss: 0.5, miniboss: 0.65, final: 0.4 },
} as const;

/** Movement kinds a boss phase may use as its baseline (stateful ones belong in patterns). */
export const BOSS_MOVES = ['idle', 'wander', 'chase', 'chasePath', 'float', 'orbitPlayer', 'keepDistance', 'hop'] as const;

function compilePattern(def: BossDef, s: BossPatternSpec): CompiledPattern {
  const beh = PATTERNS[s.kind];
  if (!beh) throw new Error(`boss ${def.id}: unknown pattern "${s.kind}"`);
  const minionId = s.enemy ?? beh.enemy ?? '';
  return {
    kind: s.kind,
    index: BOSS_PATTERN_KINDS.indexOf(s.kind),
    beh,
    p: resolveParams(beh.params, s.params),
    minion: minionId ? (findEnemy(minionId) ?? null) : null,
    style: shotStyleIndex(s.shot, def.shot),
    hook: s.hook ?? '',
    weight: s.weight ?? 1,
  };
}

/** The synthetic EnemyDef of one phase (not registered: bosses live in the boss registry). */
export function phaseEnemyDef(def: BossDef, i: number): EnemyDef {
  const ph = def.phases[i]!;
  const attacks: AttackSpec[] = ph.attacks.slice(0, 4);
  if (ph.summon && attacks.length < 4) {
    attacks.push({
      kind: 'spawnMinion',
      cooldown: Math.max(0.5, ph.summon.cooldown),
      enemy: ph.summon.enemy,
      params: { count: 1, max: Math.max(1, Math.min(8, ph.summon.count)), windup: 0.5, dist: 20 },
    });
  }
  return {
    id: def.id,
    name: def.name,
    hp: def.hp,
    speed: (def.speed ?? BOSS_DEFAULTS.speed) * (ph.speedMul ?? 1),
    radius: def.size,
    contact: def.contact ?? 1,
    move: ph.move,
    attacks,
    sprite: def.sprite,
    flying: def.flying,
    chapters: def.chapters,
    weight: 0,
    championable: false,
    bestiary: def.bestiary ?? def.name,
    drops: def.drops,
    mass: def.mass ?? BOSS_DEFAULTS.mass[def.kind],
    goo: def.goo,
    shot: def.shot,
    resist: def.resist ?? BOSS_DEFAULTS.resist[def.kind],
    big: true,
  };
}

const cache = new WeakMap<BossDef, CompiledBoss>();

/** Compiles (once) a boss def. Throws on unknown pattern / movement kinds (validation catches them first). */
export function compileBoss(def: BossDef): CompiledBoss {
  const hit = cache.get(def);
  if (hit) return hit;
  const phases: CompiledPhase[] = def.phases.map((ph, i) => {
    const enemy = phaseEnemyDef(def, i);
    return {
      at: i === 0 ? 1 : ph.at,
      name: ph.name ?? '',
      enemy,
      cfg: compileEnemy(enemy),
      patterns: (ph.patterns ?? []).map((s) => compilePattern(def, s)),
      enter: ph.enter ? compilePattern(def, ph.enter) : null,
      random: ph.order === 'random',
      rest: ph.rest ?? [1, 1.6],
      pace: ph.pace ?? 1,
      tint: ph.tint ?? '',
    };
  });
  const out: CompiledBoss = { def, phases, marks: phases.map((p) => p.at) };
  cache.set(def, out);
  return out;
}
