/**
 * Sanity checks for BossDefs (run by content validation and the unit tests): ≥ 2 phases with falling
 * thresholds, known baseline movements / attacks / patterns with params inside their declared ranges,
 * adds that exist, registered hooks, finals with their key and ending, and big multi-frame sprites (the
 * phase looks a hook swaps in too).
 */

import { validateSpriteDef } from '../../content/sprites/validate';
import { ATTACKS, MOVES } from '../enemies/behaviors/index';
import type { ParamSpec, Params } from '../enemies/behaviors/common';
import { ENEMY_SHOT_STYLES, type BossDef, type BossPatternSpec, type SpriteDef } from '../types';
import { BOSS_MOVES } from './compile';
import { getBossHook, hasBossHook } from './hooks';
import { PATTERNS } from './patterns';

function checkParams(spec: ParamSpec, params: Params | undefined, at: string, errs: string[]): void {
  if (!params) return;
  for (const k of Object.keys(params)) {
    const s = spec[k];
    const v = params[k]!;
    if (!s) errs.push(`${at}: unknown param "${k}"`);
    else if (!Number.isFinite(v) || v < s[1] || v > s[2]) errs.push(`${at}: param ${k}=${v} outside [${s[1]}, ${s[2]}]`);
  }
}

function checkPattern(s: BossPatternSpec, at: string, known: (id: string) => boolean, errs: string[]): void {
  const beh = PATTERNS[s.kind];
  if (!beh) {
    errs.push(`${at}: unknown pattern "${s.kind}"`);
    return;
  }
  checkParams(beh.params, s.params, `${at} (${s.kind})`, errs);
  if (s.kind === 'summon' && !s.enemy) errs.push(`${at}: summon needs an 'enemy'`);
  if (s.enemy && !known(s.enemy)) errs.push(`${at}: unknown enemy "${s.enemy}"`);
  if (s.kind === 'shields' && !s.enemy && !known(beh.enemy ?? '')) errs.push(`${at}: shields need an enemy (default ${beh.enemy} missing)`);
  if (s.kind === 'hook' && (!s.hook || !hasBossHook(s.hook))) errs.push(`${at}: unregistered boss hook "${s.hook ?? ''}"`);
  if (s.shot && !ENEMY_SHOT_STYLES.includes(s.shot)) errs.push(`${at}: unknown shot style "${s.shot}"`);
  if (s.weight !== undefined && !(s.weight > 0)) errs.push(`${at}: weight must be > 0`);
}

/** Problems with one boss def (empty = valid). `known(id)` tells whether an enemy id exists. */
export function validateBossDef(d: BossDef, known: (id: string) => boolean): string[] {
  const errs: string[] = [];
  const at = `boss ${d.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) errs.push(`${at}: id must be kebab-case`);
  if (!d.name) errs.push(`${at}: needs a name`);
  if (!(d.hp >= 10 && d.hp <= 5000)) errs.push(`${at}: hp ${d.hp} outside [10, 5000]`);
  if (!(d.size >= 5 && d.size <= 28)) errs.push(`${at}: size ${d.size} outside [5, 28]`);
  if (d.speed !== undefined && !(d.speed >= 0 && d.speed <= 180)) errs.push(`${at}: speed outside [0, 180]`);
  if (d.contact !== undefined && !(d.contact >= 0 && d.contact <= 4)) errs.push(`${at}: contact outside [0, 4]`);
  if (d.resist !== undefined && !(d.resist >= 0.1 && d.resist < 0.75)) errs.push(`${at}: resist must be in [0.1, 0.75) (bosses resist statuses)`);
  if (d.mass !== undefined && !(d.mass >= 1 && d.mass <= 100)) errs.push(`${at}: mass outside [1, 100]`);
  if (d.chapters.length === 0 && d.kind !== 'final') errs.push(`${at}: needs at least one chapter`);
  if (d.shot && !ENEMY_SHOT_STYLES.includes(d.shot)) errs.push(`${at}: unknown shot style "${d.shot}"`);
  if (d.hook && !hasBossHook(d.hook)) errs.push(`${at}: unregistered boss hook "${d.hook}"`);
  if (d.kind === 'final') {
    if (!d.final) errs.push(`${at}: a final boss needs its 'final' key`);
    if (!(d.ending !== undefined && d.ending >= 1 && d.ending <= 3)) errs.push(`${at}: a final boss needs an ending 1-3`);
  } else if (d.final || d.ending) {
    errs.push(`${at}: only final bosses have 'final' / 'ending'`);
  }

  if (d.phases.length < 2) errs.push(`${at}: needs at least 2 phases`);
  let prev = 1.01;
  d.phases.forEach((ph, i) => {
    const where = `${at} phase ${i}`;
    if (i === 0 && ph.at !== 1) errs.push(`${where}: the first phase starts at 1`);
    if (!(ph.at > 0 && ph.at <= 1 && ph.at < prev)) errs.push(`${where}: thresholds must fall (0, 1] phase by phase`);
    prev = ph.at;
    const mb = MOVES[ph.move.kind];
    if (!mb) errs.push(`${where}: unknown movement "${ph.move.kind}"`);
    else {
      if (!(BOSS_MOVES as readonly string[]).includes(ph.move.kind)) errs.push(`${where}: '${ph.move.kind}' is not a boss baseline movement (${BOSS_MOVES.join(', ')})`);
      checkParams(mb.params, ph.move.params, `${where} move`, errs);
    }
    if (ph.attacks.length > 4) errs.push(`${where}: at most 4 attacks`);
    ph.attacks.forEach((a, k) => {
      const ab = ATTACKS[a.kind];
      if (!ab) errs.push(`${where} attack ${k}: unknown attack "${a.kind}"`);
      else checkParams(ab.params, a.params, `${where} attack ${k} (${a.kind})`, errs);
      if (a.enemy && !known(a.enemy)) errs.push(`${where} attack ${k}: unknown enemy "${a.enemy}"`);
    });
    if (ph.summon && !known(ph.summon.enemy)) errs.push(`${where}: unknown summon "${ph.summon.enemy}"`);
    if ((ph.patterns?.length ?? 0) === 0 && ph.attacks.length === 0 && !ph.summon) errs.push(`${where}: does nothing (no patterns or attacks)`);
    (ph.patterns ?? []).forEach((s, k) => checkPattern(s, `${where} pattern ${k}`, known, errs));
    if (ph.enter) checkPattern(ph.enter, `${where} enter`, known, errs);
    if (ph.rest && !(ph.rest[0] >= 0 && ph.rest[1] >= ph.rest[0] && ph.rest[1] <= 10)) errs.push(`${where}: bad rest range`);
    if (ph.pace !== undefined && !(ph.pace >= 0.5 && ph.pace <= 3)) errs.push(`${where}: pace outside [0.5, 3]`);
    if (ph.tint !== undefined && !/^#[0-9a-f]{6}$/i.test(ph.tint)) errs.push(`${where}: tint must be #rrggbb`);
  });

  if (typeof d.sprite === 'string') {
    errs.push(`${at}: needs real pixel art (sprite is a placeholder string)`);
  } else {
    const s = d.sprite;
    for (const e of validateSpriteDef(s)) errs.push(`${at}: ${e}`);
    const min = d.kind === 'miniboss' ? 24 : 32;
    if (Math.max(s.w, s.h) < min || s.w > 56 || s.h > 56) errs.push(`${at}: sprite ${s.w}×${s.h} is not boss-sized (${min}-56 px)`);
    if (s.frames.length < 2) errs.push(`${at}: sprite needs several frames`);
    if (!s.anims?.idle || !s.anims.move) errs.push(`${at}: sprite needs 'idle' and 'move' animations`);
    // Phase looks its hook swaps in: real boss-sized art, anchored in the lower body like the boss sprite
    // (a look may change shape — the Ambergut's cocoon — but its feet stay where the boss stands).
    const looks = d.hook ? getBossHook(d.hook)?.looks : undefined;
    if (looks) {
      looks.forEach((l: SpriteDef, k) => {
        const where = `${at} look ${k} (${l.id})`;
        for (const e of validateSpriteDef(l)) errs.push(`${where}: ${e}`);
        if (Math.max(l.w, l.h) < min || l.w > 56 || l.h > 56) errs.push(`${where}: ${l.w}×${l.h} is not boss-sized (${min}-56 px)`);
        if ((l.anchorY ?? l.h) < l.h / 2) errs.push(`${where}: anchor above the lower body`);
        if (l.frames.length < 2 || !l.anims?.idle || !l.anims.move) errs.push(`${where}: needs several frames and 'idle' + 'move'`);
      });
    }
  }
  return errs;
}
