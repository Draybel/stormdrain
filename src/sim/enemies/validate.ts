/**
 * Sanity checks for EnemyDefs and ChampionDefs (run by content validation and the unit tests):
 * known behaviours, known param names inside their declared ranges, sane numbers, and sprites that
 * are real pixel maps of enemy size with `idle` + `move` animations.
 */

import { validateSpriteDef } from '../../content/sprites/validate';
import { ENEMY_SHOT_STYLES, type ChampionDef, type EnemyDef } from '../types';
import { ATTACK_COMMON, type ParamSpec, type Params } from './behaviors/common';
import { ATTACKS, DEATHS, MOVES } from './behaviors/index';
import { MAX_ATTACKS } from './enemy';

function checkParams(spec: ParamSpec, params: Params | undefined, at: string, errs: string[]): void {
  if (!params) return;
  for (const k of Object.keys(params)) {
    const s = spec[k];
    const v = params[k]!;
    if (!s) errs.push(`${at}: unknown param "${k}"`);
    else if (!Number.isFinite(v) || v < s[1] || v > s[2]) errs.push(`${at}: param ${k}=${v} outside [${s[1]}, ${s[2]}]`);
  }
}

function range(v: number | undefined, lo: number, hi: number, name: string, at: string, errs: string[]): void {
  if (v === undefined) return;
  if (!Number.isFinite(v) || v < lo || v > hi) errs.push(`${at}: ${name}=${v} outside [${lo}, ${hi}]`);
}

/**
 * Problems with one enemy def (empty = valid). `known(id)` tells whether an enemy id exists
 * (for spawnMinion / split references).
 */
export function validateEnemyDef(d: EnemyDef, known: (id: string) => boolean): string[] {
  const errs: string[] = [];
  const at = `enemy ${d.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) errs.push(`${at}: id must be kebab-case`);
  if (!d.name) errs.push(`${at}: needs a name`);
  if (d.bestiary.length < 20 || d.bestiary.length > 140) errs.push(`${at}: bestiary blurb should be 20-140 chars`);
  range(d.hp, 1, 500, 'hp', at, errs);
  range(d.speed, 0, 180, 'speed', at, errs);
  range(d.radius, 3, 14, 'radius', at, errs);
  range(d.contact, 0, 4, 'contact', at, errs);
  range(d.weight, 0, 100, 'weight', at, errs);
  range(d.mass, 0.2, 100, 'mass', at, errs);
  range(d.resist, 0.1, 1, 'resist', at, errs);
  if (d.chapters.length === 0) errs.push(`${at}: needs at least one chapter`);
  if (d.shot && !ENEMY_SHOT_STYLES.includes(d.shot)) errs.push(`${at}: unknown shot style "${d.shot}"`);

  const mb = MOVES[d.move.kind];
  if (!mb) errs.push(`${at}: unknown movement "${d.move.kind}"`);
  else checkParams(mb.params, d.move.params, `${at} move ${d.move.kind}`, errs);
  if (mb && (mb.flying ?? false) && d.flying === false) errs.push(`${at}: '${d.move.kind}' flies but flying is false`);

  if (d.attacks.length > MAX_ATTACKS) errs.push(`${at}: at most ${MAX_ATTACKS} attacks`);
  d.attacks.forEach((a, i) => {
    const where = `${at} attack ${i} (${a.kind})`;
    const ab = ATTACKS[a.kind];
    if (!ab) {
      errs.push(`${where}: unknown attack`);
      return;
    }
    range(a.cooldown, 0.1, 30, 'cooldown', where, errs);
    checkParams(ab.params, a.params, where, errs);
    if (a.kind === 'spawnMinion' && (!a.enemy || !known(a.enemy))) errs.push(`${where}: needs a known 'enemy'`);
    if (a.enemy && !known(a.enemy)) errs.push(`${where}: unknown enemy "${a.enemy}"`);
    if (a.shot && !ENEMY_SHOT_STYLES.includes(a.shot)) errs.push(`${where}: unknown shot style "${a.shot}"`);
  });
  for (const [i, dth] of (d.onDeath ?? []).entries()) {
    const where = `${at} onDeath ${i} (${dth.kind})`;
    const db = DEATHS[dth.kind];
    if (!db) {
      errs.push(`${where}: unknown death effect`);
      continue;
    }
    checkParams(db.params, dth.params, where, errs);
    if (dth.enemy && !known(dth.enemy)) errs.push(`${where}: unknown enemy "${dth.enemy}"`);
  }

  if (typeof d.sprite === 'string') {
    errs.push(`${at}: needs real pixel art (sprite is a placeholder string)`);
  } else {
    const s = d.sprite;
    for (const e of validateSpriteDef(s)) errs.push(`${at}: ${e}`);
    if (s.w < 8 || s.w > 24 || s.h < 8 || s.h > 24) errs.push(`${at}: sprite ${s.w}×${s.h} is not enemy-sized (8-24 px)`);
    if (!s.anims?.idle || !s.anims.move) errs.push(`${at}: sprite needs 'idle' and 'move' animations`);
    if (s.w < d.radius * 2 - 2) errs.push(`${at}: sprite narrower than its collision circle`);
  }
  return errs;
}

export function validateChampionDef(c: ChampionDef): string[] {
  const errs: string[] = [];
  const at = `champion ${c.id}`;
  if (!/^#[0-9a-f]{6}$/i.test(c.color)) errs.push(`${at}: color must be #rrggbb`);
  range(c.weight, 0.01, 1000, 'weight', at, errs);
  range(c.hpMul, 0.2, 5, 'hpMul', at, errs);
  range(c.speedMul, 0.2, 3, 'speedMul', at, errs);
  range(c.sizeMul, 0.5, 2, 'sizeMul', at, errs);
  range(c.cooldownMul, 0.2, 3, 'cooldownMul', at, errs);
  range(c.split, 1, 6, 'split', at, errs);
  range(c.deathRing, 3, 24, 'deathRing', at, errs);
  range(c.regen, 0.001, 1, 'regen', at, errs);
  if (c.coins && (c.coins[0] < 0 || c.coins[1] < c.coins[0])) errs.push(`${at}: bad coins range`);
  return errs;
}

/** Every param name any attack accepts in common (for docs/tools). */
export const COMMON_ATTACK_PARAMS = Object.keys(ATTACK_COMMON);
