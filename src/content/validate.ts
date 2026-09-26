/**
 * Cross-reference checks for all registered content (run by the unit tests): every id a def refers
 * to must exist (items, sets, achievements, familiars, drop tables, hooks, chapters, enemies, bosses),
 * sprites must be well-formed, and kinds must carry their required fields.
 */

import { hasHook } from '../sim/hooks';
import type { Effect, SpriteDef } from '../sim/types';
import {
  ACHIEVEMENTS,
  BOSSES,
  CHAPTERS,
  CHARACTERS,
  DROP_TABLES,
  ENEMIES,
  FAMILIARS,
  ITEMS,
  SETS,
  SYNERGIES,
} from './registry';
import { validateSpriteDef } from './sprites/validate';

export function validateContent(): string[] {
  const errs: string[] = [];
  const need = (ok: boolean, msg: string): void => {
    if (!ok) errs.push(msg);
  };
  const sprite = (s: SpriteDef | string, where: string): void => {
    if (typeof s !== 'string') for (const e of validateSpriteDef(s)) errs.push(`${where}: ${e}`);
  };
  const effects = (list: readonly Effect[], where: string): void => {
    for (const e of list) {
      switch (e.type) {
        case 'familiar':
          need(FAMILIARS.has(e.familiar), `${where}: unknown familiar "${e.familiar}"`);
          break;
        case 'hook':
          need(hasHook(e.hook), `${where}: unregistered hook "${e.hook}"`);
          break;
        case 'pickups':
          if (e.table) need(DROP_TABLES.has(e.table), `${where}: unknown drop table "${e.table}"`);
          break;
        case 'trigger':
          need((e.chance ?? 1) >= 0 && (e.chance ?? 1) <= 1, `${where}: trigger chance out of range`);
          effects(e.effects, `${where} (trigger ${e.on})`);
          break;
        case 'stat':
          need(e.add !== undefined || e.mul !== undefined, `${where}: stat effect without add/mul`);
          break;
        default:
          break;
      }
    }
  };

  for (const d of ITEMS.values()) {
    const at = `item ${d.id}`;
    need(d.name.length > 0 && d.desc.length > 0, `${at}: needs a name and a description`);
    need(d.quality >= 0 && d.quality <= 4, `${at}: quality out of range`);
    if (d.set) need(SETS.has(d.set), `${at}: unknown set "${d.set}"`);
    if (d.unlock) need(ACHIEVEMENTS.has(d.unlock), `${at}: unknown achievement "${d.unlock}"`);
    if (d.kind === 'active') need(!!d.active, `${at}: active item without an 'active' spec`);
    if (d.kind === 'consumable') need(!!d.use && d.use.length > 0, `${at}: consumable without 'use' effects`);
    sprite(d.sprite, at);
    if (typeof d.sprite !== 'string') need(d.sprite.w === 14 && d.sprite.h === 14, `${at}: icons are 14×14`);
    if (d.costume) sprite(d.costume.sprite, `${at} costume`);
    effects(d.effects, at);
    if (d.active) effects(d.active.use, `${at} use`);
    if (d.use) effects(d.use, `${at} use`);
  }

  for (const c of CHARACTERS.values()) {
    const at = `character ${c.id}`;
    for (const id of c.startItems) need(ITEMS.has(id), `${at}: unknown start item "${id}"`);
    need(hasHook(c.mechanic), `${at}: unregistered mechanic hook "${c.mechanic}"`);
    if (c.unlock) need(ACHIEVEMENTS.has(c.unlock), `${at}: unknown achievement "${c.unlock}"`);
    need(c.hearts.redMax % 2 === 0, `${at}: redMax must be whole hearts (even)`);
    sprite(c.sprite, at);
  }

  for (const e of ENEMIES.values()) {
    const at = `enemy ${e.id}`;
    for (const ch of e.chapters) need(CHAPTERS.has(ch), `${at}: unknown chapter "${ch}"`);
    if (e.drops) need(DROP_TABLES.has(e.drops), `${at}: unknown drop table "${e.drops}"`);
    sprite(e.sprite, at);
  }

  for (const b of BOSSES.values()) {
    const at = `boss ${b.id}`;
    need(b.phases.length >= 2, `${at}: needs at least 2 phases`);
    for (const ch of b.chapters) need(CHAPTERS.has(ch), `${at}: unknown chapter "${ch}"`);
    for (const ph of b.phases) if (ph.summon) need(ENEMIES.has(ph.summon.enemy), `${at}: unknown summon "${ph.summon.enemy}"`);
    if (b.drops) need(DROP_TABLES.has(b.drops), `${at}: unknown drop table "${b.drops}"`);
    sprite(b.sprite, at);
  }

  for (const c of CHAPTERS.values()) {
    const at = `chapter ${c.id}`;
    for (const id of c.enemyPool) need(ENEMIES.has(id), `${at}: unknown enemy "${id}"`);
    for (const id of c.bossPool) need(BOSSES.has(id), `${at}: unknown boss "${id}"`);
    for (const id of c.minibossPool) need(BOSSES.has(id), `${at}: unknown miniboss "${id}"`);
  }

  for (const s of SYNERGIES.values()) {
    const at = `synergy ${s.id}`;
    need(s.requires.length > 0, `${at}: requires nothing`);
    for (const r of s.requires) if (typeof r === 'string') need(ITEMS.has(r), `${at}: unknown item "${r}"`);
    if (s.hook) need(hasHook(s.hook), `${at}: unregistered hook "${s.hook}"`);
    effects(s.effects, at);
  }

  for (const s of SETS.values()) {
    const at = `set ${s.id}`;
    const members = [...ITEMS.values()].filter((d) => d.set === s.id).length;
    need(s.need >= 1, `${at}: need must be >= 1`);
    need(members >= s.need, `${at}: only ${members} items belong to it (needs ${s.need})`);
    if (s.hook) need(hasHook(s.hook), `${at}: unregistered hook "${s.hook}"`);
    if (s.costume) sprite(s.costume.sprite, `${at} costume`);
    effects(s.effects, at);
  }

  for (const a of ACHIEVEMENTS.values()) {
    const at = `achievement ${a.id}`;
    for (const u of a.unlocks) {
      if (u.kind === 'item') need(ITEMS.has(u.id), `${at}: unlocks unknown item "${u.id}"`);
      if (u.kind === 'character') need(CHARACTERS.has(u.id), `${at}: unlocks unknown character "${u.id}"`);
      if (u.kind === 'chapter') need(CHAPTERS.has(u.id), `${at}: unlocks unknown chapter "${u.id}"`);
    }
  }

  for (const f of FAMILIARS.values()) sprite(f.sprite, `familiar ${f.id}`);

  for (const t of DROP_TABLES.values()) {
    const at = `drop table ${t.id}`;
    need(t.rolls[0] >= 0 && t.rolls[1] >= t.rolls[0], `${at}: bad rolls range`);
    need(t.entries.length > 0, `${at}: no entries`);
    for (const e of t.entries) need(e.weight >= 0, `${at}: negative weight`);
  }

  return errs;
}
