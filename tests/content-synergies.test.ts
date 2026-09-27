/**
 * Special synergies content (ARCHITECTURE §4.7, src/content/synergies, SYNERGIES.md):
 * - the catalogue: 44+ synergies, original unique names that fit the SYNERGY pill, real obtainable items,
 *   satisfiable tag requirements, registered hooks with sane params, a unique look each, timed temps;
 * - activation: every synergy switches on exactly when its last requirement is met, off when any one
 *   is lost (effects and style gone), back on without a second banner;
 * - effects + style: every persistent effect is really added (mods by source, stats / familiars /
 *   carriers / triggers by toggling the synergy) and the shots look different with it;
 * - the first activation: the 'synergy' event (the SYNERGY: NAME pill) and the debut ring;
 * - SYNERGIES.md lists every synergy with its requirements by item NAME.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOSSES, DROP_TABLES, ENEMIES, FAMILIARS, ITEMS, SETS, SYNERGIES, allSynergies, findItem, getItem } from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { sfxNames } from '../src/audio/sfx';
import { LIBRARY_SFX_NAMES } from '../src/audio/sfxLibrary';
import { measureText } from '../src/render/font';
import { recomputePlayer, requirementMet } from '../src/sim/effects';
import { hasHook } from '../src/sim/hooks';
import { setActive } from '../src/sim/inventory';
import type { Sim } from '../src/sim/sim';
import {
  ENEMY_SHOT_STYLES,
  PICKUP_NAMES,
  STATUS_KINDS,
  STAT_IDS,
  type Effect,
  type ItemDef,
  type Requirement,
  type StatId,
  type SynergyDef,
} from '../src/sim/types';
import { makeSim } from './helpers/sim';

const SYNS: readonly SynergyDef[] = [...SYNERGIES.values()];
const FONT = /^[A-Z0-9 .,!?:;'"\-+=/()[\]%*#<>&°·♥¤←→↑↓]*$/;
const SOUNDS = new Set<string>([...sfxNames(), ...LIBRARY_SFX_NAMES]);
const NOVA_LOOKS = new Set(['shock', 'ember', 'frost', 'spore', 'charm', 'ink', 'gold', 'water']);

/** Every effect, triggers flattened. */
function flat(list: readonly Effect[], out: Effect[] = []): Effect[] {
  for (const e of list) {
    out.push(e);
    if (e.type === 'trigger') flat(e.effects, out);
  }
  return out;
}

/** Distinct held-able items carrying a tag, passives first, stable order. */
function tagged(tag: string, exclude: ReadonlySet<string>): ItemDef[] {
  const rank = (d: ItemDef): number => (d.kind === 'passive' ? 0 : d.kind === 'trinket' ? 1 : 2);
  return [...ITEMS.values()]
    .filter((d) => d.tags.includes(tag) && d.kind !== 'consumable' && d.kind !== 'active' && !d.tags.includes('test') && !exclude.has(d.id))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
}

/** Puts one held copy of an item in its slot (passives / the active / trinkets), no pickup ceremony. */
function hold(sim: Sim, id: string): void {
  const p = sim.world.player;
  const d = getItem(id);
  if (d.kind === 'active') setActive(p.inv, d);
  else if (d.kind === 'trinket') p.inv.trinkets.push(id);
  else p.inv.passives.push(id);
  p.inv.version++;
}

function drop(sim: Sim, id: string): void {
  const inv = sim.world.player.inv;
  for (let i = inv.passives.length - 1; i >= 0; i--) if (inv.passives[i] === id) inv.passives.splice(i, 1);
  for (let i = inv.trinkets.length - 1; i >= 0; i--) if (inv.trinkets[i] === id) inv.trinkets.splice(i, 1);
  if (inv.active?.id === id) inv.active = null;
  inv.version++;
}

/**
 * The items that satisfy one requirement after `held` (the ids already given): an item requirement is
 * that item; a tag requirement tops the distinct count up to exactly `count`.
 */
function itemsFor(req: Requirement, held: string[]): string[] {
  if (typeof req === 'string') return held.includes(req) ? [] : [req];
  const have = new Set(held);
  const already = held.filter((id, i) => held.indexOf(id) === i && getItem(id).tags.includes(req.tag)).length;
  const need = Math.max(0, (req.count ?? 1) - already);
  return tagged(req.tag, have)
    .slice(0, need)
    .map((d) => d.id);
}

interface Build {
  sim: Sim;
  /** Item ids given per requirement. */
  per: string[][];
}

/** A sim holding exactly what the synergy needs (requirements `upTo` excluded). */
function build(syn: SynergyDef, upTo = syn.requires.length, seed = `syn-${syn.id}`): Build {
  const sim = makeSim(seed);
  const held: string[] = [];
  const per: string[][] = [];
  syn.requires.forEach((req, i) => {
    const ids = itemsFor(req, held);
    per.push(ids);
    if (i >= upTo) return;
    for (const id of ids) {
      held.push(id);
      hold(sim, id);
    }
  });
  recomputePlayer(sim.world);
  return { sim, per };
}

const mutableSynergies = (): SynergyDef[] => allSynergies() as SynergyDef[];

/** Recomputes with the synergy taken out of the registry list, calls `fn`, puts it back. */
function without<T>(sim: Sim, syn: SynergyDef, fn: () => T): T {
  const list = mutableSynergies();
  const at = list.indexOf(syn);
  list.splice(at, 1);
  try {
    recomputePlayer(sim.world);
    return fn();
  } finally {
    list.splice(at, 0, syn);
    recomputePlayer(sim.world);
  }
}

function events(sim: Sim, type: string, id?: string): { a: number; id: string }[] {
  const out: { a: number; id: string }[] = [];
  for (let i = 0; i < sim.events.count; i++) {
    const e = sim.events.at(i);
    if (e.type === type && (id === undefined || e.id === id)) out.push({ a: e.a, id: e.id });
  }
  return out;
}

// ── The catalogue ──────────────────────────────────────────────────────────────

describe('special synergies: the catalogue', () => {
  it('has at least 44 hand-crafted synergies and the content validates', () => {
    expect(SYNS.length).toBeGreaterThanOrEqual(44);
    expect(validateContent()).toEqual([]);
  });

  it('names are original, unique (also against items, enemies, bosses and sets) and fit the SYNERGY pill', () => {
    const names = new Set<string>();
    const taken = new Set<string>(
      [...ITEMS.values(), ...ENEMIES.values(), ...BOSSES.values(), ...SETS.values(), ...FAMILIARS.values()].map((d) => d.name.toUpperCase()),
    );
    for (const s of SYNS) {
      const up = s.name.toUpperCase();
      expect(names.has(up), `duplicate synergy name ${s.name}`).toBe(false);
      names.add(up);
      expect(taken.has(up), `${s.name} is already an item / enemy / boss / set name`).toBe(false);
      expect(up, s.name).toMatch(FONT);
      expect(s.id, s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      // The pill: 'SYNERGY: NAME' + 12 px of panel, in the top band over the room (240 px).
      expect(measureText(`SYNERGY: ${up}`) + 12, s.name).toBeLessThanOrEqual(220);
    }
  });

  it('requirements are real, obtainable items and satisfiable tag counts; 2-3 of them, never two trinkets', () => {
    const used = new Set<string>();
    for (const s of SYNS) {
      expect(s.requires.length, s.id).toBeGreaterThanOrEqual(2);
      expect(s.requires.length, s.id).toBeLessThanOrEqual(3);
      let trinkets = 0;
      for (const r of s.requires) {
        if (typeof r === 'string') {
          const d = findItem(r);
          expect(d, `${s.id}: ${r}`).toBeDefined();
          expect(d!.kind, `${s.id}: ${r}`).not.toBe('consumable');
          expect(d!.pools.length, `${s.id}: ${r} is in no pool`).toBeGreaterThan(0);
          if (d!.kind === 'trinket') trinkets++;
          used.add(r);
        } else {
          expect(r.count ?? 1, `${s.id}: tag ${r.tag}`).toBeGreaterThanOrEqual(1);
          expect(tagged(r.tag, new Set()).length, `${s.id}: not enough items tagged ${r.tag}`).toBeGreaterThanOrEqual(r.count ?? 1);
        }
      }
      expect(trinkets, `${s.id} needs two trinkets`).toBeLessThanOrEqual(1);
      // No two synergies ask for exactly the same thing.
      const key = JSON.stringify([...s.requires].map((r) => (typeof r === 'string' ? r : `${r.tag}x${r.count ?? 1}`)).sort());
      expect(SYNS.filter((o) => JSON.stringify([...o.requires].map((r) => (typeof r === 'string' ? r : `${r.tag}x${r.count ?? 1}`)).sort()) === key).length, s.id).toBe(1);
    }
    // Many different items take part (not just the lance), actives and trinkets included.
    expect(used.size).toBeGreaterThanOrEqual(70);
    const kinds = new Set([...used].map((id) => getItem(id).kind));
    expect(kinds).toEqual(new Set(['passive', 'active', 'trinket']));
    // Set-flavoured ones: tag requirements on the DESIGN.md set tags.
    const setTags = new Set(SYNS.flatMap((s) => s.requires.filter((r): r is { tag: string; count?: number } => typeof r !== 'string').map((r) => r.tag)));
    expect([...setTags].filter((t) => SETS.has(t)).length).toBeGreaterThanOrEqual(6);
  });

  it('every hook is registered and its params make sense (sounds, looks, styles, statuses, pickups)', () => {
    for (const s of SYNS) {
      expect(s.hook, s.id).toBe('syn.debut');
      expect(hasHook(s.hook!)).toBe(true);
      for (const e of flat(s.effects)) {
        if (e.type !== 'hook') continue;
        expect(hasHook(e.hook), `${s.id}: ${e.hook}`).toBe(true);
        const p = e.params ?? {};
        for (const [k, v] of Object.entries(p)) {
          if (typeof v === 'number') expect(Number.isFinite(v), `${s.id}.${k}`).toBe(true);
          if (k === 'sfx') expect(SOUNDS.has(String(v)), `${s.id}: sound ${v}`).toBe(true);
          // A nova flavour or colour ('splash': syn.waves' water splash instead of a nova).
          if (k === 'look') expect(NOVA_LOOKS.has(String(v)) || /^#[0-9a-f]{6}$/i.test(String(v)) || (v === 'splash' && e.hook === 'syn.waves'), `${s.id}: look ${v}`).toBe(true);
          if (k === 'style' || k === 'crater') expect((ENEMY_SHOT_STYLES as readonly string[]).includes(String(v)), `${s.id}: ${k} ${v}`).toBe(true);
          if (k === 'status' || k === 'needs') expect((STATUS_KINDS as readonly string[]).includes(String(v)), `${s.id}: ${k} ${v}`).toBe(true);
          if (k === 'kind') expect((PICKUP_NAMES as readonly string[]).includes(String(v)), `${s.id}: pickup ${v}`).toBe(true);
          if (k === 'color' || k === 'tether') expect(String(v), `${s.id}.${k}`).toMatch(/^#[0-9a-f]{6}$/i);
          if (k === 'hook') expect(hasHook(String(v)), `${s.id}: sub-hook ${v}`).toBe(true);
          if (k === 'at') expect(v).toBe('player');
        }
      }
      for (const e of flat(s.effects)) {
        if (e.type === 'familiar') expect(FAMILIARS.has(e.familiar), `${s.id}: ${e.familiar}`).toBe(true);
        if (e.type === 'pickups' && e.table) expect(DROP_TABLES.has(e.table), `${s.id}: ${e.table}`).toBe(true);
      }
    }
  });

  it('each has a unique look: a colour of its own and a distinct colour / shape / trail signature', () => {
    const colors = new Set<string>();
    const sigs = new Set<string>();
    for (const s of SYNS) {
      expect(s.style, s.id).toBeDefined();
      const st = s.style!;
      expect(st.color, s.id).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.has(st.color!.toLowerCase()), `${s.id}: colour ${st.color} is taken`).toBe(false);
      colors.add(st.color!.toLowerCase());
      const sig = `${st.color}|${st.shape ?? ''}|${st.trail ?? ''}|${st.tether ?? ''}`;
      expect(sigs.has(sig), s.id).toBe(false);
      sigs.add(sig);
      // Something besides a colour: a shape, a trail, a glow, a tether or a hook doing something new.
      const hooks = flat(s.effects).filter((e) => e.type === 'hook').length;
      expect(!!st.shape || !!st.trail || !!st.glow || !!st.tether || hooks > 0, s.id).toBe(true);
    }
  });

  it('timed boosts from triggers always have a duration and a cooldown or a small chance (no pile-ups)', () => {
    for (const s of SYNS) {
      for (const e of s.effects) {
        if (e.type !== 'trigger') continue;
        const temps = e.effects.filter((x) => x.type === 'stat' || x.type === 'mod' || x.type === 'flag' || x.type === 'carrier' || x.type === 'familiar');
        for (const t of temps) {
          const d = (t as { duration?: number }).duration;
          expect(d !== undefined && d > 0 && d <= 10, `${s.id}: temp without a duration`).toBe(true);
        }
        if (temps.length > 0) expect((e.cooldown ?? 0) > 0, `${s.id}: temps without a cooldown`).toBe(true);
        // Frequent triggers stay cheap: kill / fire / pickup hooks are cooled down or chance-based unless they are light.
        expect(e.effects.length, s.id).toBeLessThanOrEqual(4);
      }
    }
  });
});

// ── Activation ─────────────────────────────────────────────────────────────────

describe('special synergies: activation', () => {
  for (const syn of SYNS) {
    it(`${syn.name}: on exactly when every requirement holds, off when one is lost, back on silently`, () => {
      // All but the last requirement: off.
      const part = build(syn, syn.requires.length - 1);
      const pp = part.sim.world.player;
      expect(pp.synergies, 'switched on early').not.toContain(syn.id);
      expect(requirementMet(pp, syn.requires[syn.requires.length - 1]!)).toBe(false);
      expect(pp.loadout.styles).not.toContain(syn.style);

      const { sim, per } = build(syn);
      const w = sim.world;
      const p = w.player;
      expect(p.synergies).toContain(syn.id);
      expect(events(sim, 'synergy', syn.id).length).toBe(1);
      expect(p.loadout.styles).toContain(syn.style);

      // Losing any one requirement switches it off: effects (by source) and style gone.
      for (let r = 0; r < syn.requires.length; r++) {
        const gone = per[r]!.slice(-1);
        if (gone.length === 0) continue;
        for (const id of gone) drop(sim, id);
        recomputePlayer(w);
        expect(p.synergies, `still on without requirement ${r}`).not.toContain(syn.id);
        expect(p.loadout.styles).not.toContain(syn.style);
        for (const rec of p.loadout.mods.values()) expect(rec.sources).not.toContain(syn.id);
        for (const on of Object.values(p.triggers)) for (const t of on) expect(t.source).not.toBe(syn.id);
        for (const id of gone) hold(sim, id);
        recomputePlayer(w);
        expect(p.synergies, `not back on after requirement ${r} returned`).toContain(syn.id);
      }
      // One banner per run, however often it switches.
      expect(events(sim, 'synergy', syn.id).length).toBe(1);
      expect(p.synergiesSeen.filter((x) => x === syn.id).length).toBe(1);
    });
  }
});

// ── Effects and style ──────────────────────────────────────────────────────────

describe('special synergies: effects and style apply', () => {
  for (const syn of SYNS) {
    it(`${syn.name}: its effects join the loadout and its shots look different`, () => {
      const { sim } = build(syn);
      const w = sim.world;
      const p = w.player;
      expect(p.synergies).toContain(syn.id);
      const on = {
        style: p.attack.style,
        stats: { ...p.stats },
        fam: new Map(p.loadout.familiars),
        carriers: new Map(p.loadout.carrierStacks),
      };
      const off = without(sim, syn, () => ({
        style: p.attack.style,
        stats: { ...p.stats },
        fam: new Map(p.loadout.familiars),
        carriers: new Map(p.loadout.carrierStacks),
      }));
      // The look changes (colour first; the override's colour leads the accents).
      expect(on.style.body).not.toBe(off.style.body);
      expect(on.style.accents).toContain(syn.style!.color);
      if (syn.style!.trail) expect(on.style.trails).toContain(syn.style!.trail);
      if (syn.style!.tether) expect(on.style.tether).toBe(syn.style!.tether);
      if (syn.style!.glow) expect(on.style.glowR).toBeGreaterThanOrEqual(off.style.glowR);
      for (const e of syn.effects) {
        switch (e.type) {
          case 'mod':
            expect(p.loadout.mods.get(e.mod)?.sources ?? [], `${e.mod}`).toContain(syn.id);
            break;
          case 'stat':
            expect(on.stats[e.stat as StatId], e.stat).not.toBeCloseTo(off.stats[e.stat as StatId], 6);
            break;
          case 'familiar':
            expect((on.fam.get(e.familiar) ?? 0) - (off.fam.get(e.familiar) ?? 0)).toBe(e.count ?? 1);
            break;
          case 'carrier':
            expect((on.carriers.get(e.carrier) ?? 0) - (off.carriers.get(e.carrier) ?? 0)).toBe(1);
            break;
          case 'trigger':
            expect(p.triggers[e.on].some((t) => t.source === syn.id && t.eff === e), `trigger ${e.on}`).toBe(true);
            break;
          case 'flag':
            expect(p.flags[e.flag]).toBe(true);
            break;
          default:
            break;
        }
      }
      expect(STAT_IDS.every((k) => Number.isFinite(p.stats[k]))).toBe(true);
    });
  }

  it('the first activation shows the SYNERGY pill and a debut ring in the new shot colour', () => {
    for (const syn of SYNS.slice(0, 12)) {
      const { sim } = build(syn, syn.requires.length, `debut-${syn.id}`);
      const p = sim.world.player;
      expect(events(sim, 'synergy', syn.id).length).toBe(1);
      const rings = events(sim, 'nova').filter((e) => e.id === p.attack.style.body);
      expect(rings.length, syn.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('synergies that need an active count it only while it sits in the active slot', () => {
    const syn = SYNERGIES.get('mirror-lid')!;
    const { sim } = build(syn);
    const p = sim.world.player;
    expect(p.inv.active?.id).toBe('pot-lid');
    expect(p.synergies).toContain('mirror-lid');
    setActive(p.inv, getItem('crank-radio'));
    recomputePlayer(sim.world);
    expect(p.synergies).not.toContain('mirror-lid');
  });
});

// ── SYNERGIES.md ───────────────────────────────────────────────────────────────

describe('SYNERGIES.md', () => {
  const doc = readFileSync(new URL('../SYNERGIES.md', import.meta.url), 'utf8');
  it('lists every synergy with its requirements by item name', () => {
    for (const s of SYNS) {
      const row = doc.split('\n').find((l) => l.startsWith('|') && l.includes(`**${s.name}**`));
      expect(row, `${s.name} missing from SYNERGIES.md`).toBeDefined();
      for (const r of s.requires) {
        if (typeof r === 'string') expect(row!, `${s.name}: ${getItem(r).name}`).toContain(getItem(r).name);
        else expect(row!.toLowerCase(), `${s.name}: tag ${r.tag}`).toContain(r.tag.toLowerCase());
      }
    }
    const rows = doc.split('\n').filter((l) => /^\| \*\*/.test(l));
    expect(rows.length).toBe(SYNS.length);
  });
});
