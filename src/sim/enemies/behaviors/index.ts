/**
 * The behaviour library's registries and the def compiler. `compileEnemy(def)` resolves every
 * behaviour and param (defaults filled in, values clamped to each param's declared range) once per
 * EnemyDef and caches the result, so enemies never look anything up per tick.
 */

import { findEnemy } from '../../../content/registry';
import { ENEMY_SHOT_STYLES, type EnemyDef, type EnemyShotStyle } from '../../types';
import { ATTACKS } from './attacks';
import type { CompiledAttack, CompiledDeath, CompiledEnemy, ParamSpec, Params } from './common';
import { DEATHS } from './death';
import { MOVES } from './movement';

export { ATTACKS, DEATHS, MOVES };

/** Defaults from `spec`, overridden by `params` (clamped to each param's range; unknown names ignored). */
export function resolveParams(spec: ParamSpec, params: Params | undefined): Params {
  const out: Record<string, number> = {};
  for (const k of Object.keys(spec)) out[k] = spec[k]![0];
  if (params) {
    for (const k of Object.keys(params)) {
      const s = spec[k];
      const v = params[k]!;
      if (!s || !Number.isFinite(v)) continue;
      out[k] = v < s[1] ? s[1] : v > s[2] ? s[2] : v;
    }
  }
  return out;
}

export function shotStyleIndex(style: EnemyShotStyle | undefined, fallback: EnemyShotStyle | undefined): number {
  const i = ENEMY_SHOT_STYLES.indexOf(style ?? fallback ?? 'muck');
  return i < 0 ? 0 : i;
}

const cache = new WeakMap<EnemyDef, CompiledEnemy>();

/** Compiles (once) the behaviours of a def. Throws on unknown kinds (content validation catches them first). */
export function compileEnemy(def: EnemyDef): CompiledEnemy {
  const hit = cache.get(def);
  if (hit) return hit;
  const mb = MOVES[def.move.kind];
  if (!mb) throw new Error(`enemy ${def.id}: unknown movement "${def.move.kind}"`);
  const attacks: CompiledAttack[] = def.attacks.map((a) => {
    const beh = ATTACKS[a.kind];
    if (!beh) throw new Error(`enemy ${def.id}: unknown attack "${a.kind}"`);
    return {
      kind: a.kind,
      beh,
      cooldown: Math.max(0.05, a.cooldown),
      p: resolveParams(beh.params, a.params),
      minion: a.enemy ? (findEnemy(a.enemy) ?? null) : null,
      style: shotStyleIndex(a.shot, def.shot),
    };
  });
  const deaths: CompiledDeath[] = (def.onDeath ?? []).map((d) => {
    const beh = DEATHS[d.kind];
    if (!beh) throw new Error(`enemy ${def.id}: unknown death effect "${d.kind}"`);
    return {
      kind: d.kind,
      beh,
      p: resolveParams(beh.params, d.params),
      minion: d.enemy ? (findEnemy(d.enemy) ?? null) : null,
      style: shotStyleIndex(d.shot, def.shot),
    };
  });
  const out: CompiledEnemy = { move: { kind: def.move.kind, beh: mb, p: resolveParams(mb.params, def.move.params) }, attacks, deaths };
  cache.set(def, out);
  return out;
}
