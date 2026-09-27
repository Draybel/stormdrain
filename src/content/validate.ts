/**
 * Cross-reference checks for all registered content (run by the unit tests): every id a def refers
 * to must exist (items, sets, achievements, familiars, drop tables, hooks, chapters, enemies, bosses),
 * sprites must be well-formed, and kinds must carry their required fields.
 */

import { validateBossDef } from '../sim/bosses/validate';
import { validateChampionDef, validateEnemyDef } from '../sim/enemies/validate';
import { hasHook } from '../sim/hooks';
import { ACHIEVEMENT_EVENTS, CHAPTER_PALETTE_KEYS, costumeList, type Effect, type SpriteDef } from '../sim/types';
import {
  ACHIEVEMENTS,
  BOSSES,
  CHAMPIONS,
  CHAPTERS,
  CHARACTERS,
  DROP_TABLES,
  ENEMIES,
  FAMILIARS,
  ITEMS,
  SETS,
  SYNERGIES,
} from './registry';
import { FLOOR_PATTERNS, WALL_PATTERNS } from './sprites/tilesets';
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
    for (const c of costumeList(d.costume)) sprite(c.sprite, `${at} costume ${c.id}`);
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
    for (const err of validateEnemyDef(e, (id) => ENEMIES.has(id))) errs.push(err);
  }

  for (const c of CHAMPIONS.values()) {
    for (const err of validateChampionDef(c)) errs.push(err);
    if (c.drops) need(DROP_TABLES.has(c.drops), `champion ${c.id}: unknown drop table "${c.drops}"`);
  }

  for (const b of BOSSES.values()) {
    const at = `boss ${b.id}`;
    for (const ch of b.chapters) need(CHAPTERS.has(ch), `${at}: unknown chapter "${ch}"`);
    if (b.drops) need(DROP_TABLES.has(b.drops), `${at}: unknown drop table "${b.drops}"`);
    for (const err of validateBossDef(b, (id) => ENEMIES.has(id))) errs.push(err);
  }
  // Every final boss key has a boss (the endings need them).
  for (const key of ['thunderhead', 'nestmother', 'undertow']) {
    need([...BOSSES.values()].some((b) => b.kind === 'final' && b.final === key), `no final boss for "${key}"`);
  }

  for (const c of CHAPTERS.values()) {
    const at = `chapter ${c.id}`;
    for (const id of c.enemyPool) need(ENEMIES.has(id), `${at}: unknown enemy "${id}"`);
    for (const id of c.bossPool) need(BOSSES.has(id), `${at}: unknown boss "${id}"`);
    for (const id of c.minibossPool) need(BOSSES.has(id), `${at}: unknown miniboss "${id}"`);
    for (const k of CHAPTER_PALETTE_KEYS) need(/^#[0-9a-f]{6}$/i.test(c.palette[k] ?? ''), `${at}: palette.${k} must be a #rrggbb colour`);
    const [floor = '', wall = ''] = c.tileset.split('/');
    need(!!FLOOR_PATTERNS[floor] && !!WALL_PATTERNS[wall], `${at}: unknown tileset "${c.tileset}" (floor/wall patterns in sprites/tilesets.ts)`);
    for (const d of c.decor?.floor ?? []) sprite(d, `${at} decor`);
    for (const d of c.decor?.wall ?? []) {
      sprite(d, `${at} wall decor`);
      need(d.w <= 16 && d.h <= 16, `${at}: wall decor ${d.id} is larger than 16×16`);
    }
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
    for (const c of costumeList(s.costume)) sprite(c.sprite, `${at} costume ${c.id}`);
    effects(s.effects, at);
  }

  for (const a of ACHIEVEMENTS.values()) {
    const at = `achievement ${a.id}`;
    need(a.name.length > 0 && a.desc.length > 0, `${at}: needs a name and a description`);
    const c = a.condition;
    if (c.kind === 'event') {
      need((ACHIEVEMENT_EVENTS as readonly string[]).includes(c.event), `${at}: unknown event "${c.event}"`);
      if (c.event === 'bossKilled' && c.id) need(BOSSES.has(c.id), `${at}: unknown boss "${c.id}"`);
      if (c.event === 'characterWin' && c.id) need(CHARACTERS.has(c.id), `${at}: unknown character "${c.id}"`);
      if (c.event === 'itemCollected' && c.id) need(ITEMS.has(c.id), `${at}: unknown item "${c.id}"`);
      if (c.event === 'transformation' && c.id) need(SETS.has(c.id), `${at}: unknown set "${c.id}"`);
    } else {
      need(typeof c.counter === 'string' && c.counter.length > 0, `${at}: counter condition without a counter`);
      need(Number.isFinite(c.atLeast) && c.atLeast > 0, `${at}: atLeast must be > 0`);
    }
    for (const u of a.unlocks) {
      if (u.kind === 'item') need(ITEMS.has(u.id), `${at}: unlocks unknown item "${u.id}"`);
      if (u.kind === 'character') need(CHARACTERS.has(u.id), `${at}: unlocks unknown character "${u.id}"`);
      if (u.kind === 'chapter') need(CHAPTERS.has(u.id), `${at}: unlocks unknown chapter "${u.id}"`);
    }
  }

  for (const f of FAMILIARS.values()) {
    const at = `familiar ${f.id}`;
    sprite(f.sprite, at);
    need(f.radius > 0 && f.radius <= 12, `${at}: radius out of range`);
    need(f.attackScale >= 0 && f.attackScale <= 1, `${at}: attackScale must be 0..1`);
    need((f.fireRateMul ?? 1) > 0, `${at}: fireRateMul must be > 0`);
  }

  for (const t of DROP_TABLES.values()) {
    const at = `drop table ${t.id}`;
    need(t.rolls[0] >= 0 && t.rolls[1] >= t.rolls[0], `${at}: bad rolls range`);
    need(t.entries.length > 0, `${at}: no entries`);
    for (const e of t.entries) need(e.weight >= 0, `${at}: negative weight`);
  }

  return errs;
}
