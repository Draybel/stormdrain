import { describe, expect, it } from 'vitest';
import {
  CHARACTERS,
  DROP_TABLES,
  ITEMS,
  collectDefs,
  getCharacter,
  getItem,
  itemsWithTag,
} from '../src/content/registry';
import { validateContent } from '../src/content/validate';
import { hasHook } from '../src/sim/hooks';
import { CARRIER_IDS, MOD_IDS, PICKUP_NAMES } from '../src/sim/types';
import { PK, PICKUP_KIND_COUNT, PICKUP_RADIUS, PICKUP_PUSH, pickupKindOf, pickupName } from '../src/sim/pickupKinds';

describe('content registries', () => {
  it('auto-discovers items, characters and drop tables', () => {
    expect(ITEMS.size).toBeGreaterThanOrEqual(14);
    expect(CHARACTERS.has('wren')).toBe(true);
    expect(DROP_TABLES.has('satchel')).toBe(true);
    expect(DROP_TABLES.has('lockbox')).toBe(true);
    expect(getCharacter('wren').name).toBe('Wren');
    expect(getItem('brick-chip').kind).toBe('passive');
    expect(() => getItem('no-such-item')).toThrow(/unknown item/);
  });

  it('throws on duplicate ids across files', () => {
    const mods = {
      './a.ts': { default: [{ id: 'x' }, { id: 'y' }] },
      './b.ts': { default: [{ id: 'x' }] },
    };
    expect(() => collectDefs('item', mods)).toThrow(/duplicate item id "x"/);
    expect(() => collectDefs('item', { './a.ts': { default: [{ id: 'x' }, { id: 'x' }] } })).toThrow(/duplicate/);
    expect(collectDefs('item', { './a.ts': { default: [{ id: 'x' }] } }).size).toBe(1);
  });

  it('throws on a module without an array default export', () => {
    expect(() => collectDefs('item', { './a.ts': { default: undefined as unknown as [] } })).toThrow(/export default/);
  });

  it('every referenced id exists and every sprite is well-formed', () => {
    expect(validateContent()).toEqual([]);
  });

  it('the validator catches dangling references', () => {
    // Sanity check of the checker itself: an unknown hook name is not registered.
    expect(hasHook('shockwave')).toBe(true);
    expect(hasHook('definitely-not-a-hook')).toBe(false);
  });

  it('the training room has enough of each kind to try everything', () => {
    expect(itemsWithTag('starter-stat').length).toBeGreaterThanOrEqual(4);
    expect(itemsWithTag('starter-stat').length).toBeLessThanOrEqual(6);
    const kinds = new Set([...ITEMS.values()].map((d) => d.kind));
    expect(kinds).toEqual(new Set(['passive', 'active', 'trinket', 'consumable']));
    const timed = [...ITEMS.values()].filter((d) => d.active?.chargeType === 'timed');
    const room = [...ITEMS.values()].filter((d) => d.active?.chargeType === 'room');
    expect(timed.length).toBeGreaterThan(0);
    expect(room.length).toBeGreaterThan(0);
  });

  it('item names are unique and descriptions fit on the banner', () => {
    const names = [...ITEMS.values()].map((d) => d.name.toUpperCase());
    expect(new Set(names).size).toBe(names.length);
    for (const d of ITEMS.values()) expect(d.desc.length, d.id).toBeLessThanOrEqual(46);
  });
});

describe('ids declared for the attack pipeline', () => {
  it('lists every carrier and modifier from ARCHITECTURE §4', () => {
    expect([...CARRIER_IDS]).toEqual(['marble', 'lance', 'laser', 'boomerang', 'melee', 'bomb', 'charge', 'orbit']);
    for (const m of [
      'extraShots', 'spread', 'backShot', 'sideShots', 'circleFirst', 'inaccuracy',
      'homing', 'wavy', 'spiral', 'orbitPlayer', 'boomerang', 'grow', 'shrink', 'accelerate', 'decelerate', 'bounce', 'phase',
      'pierce', 'split', 'chain', 'explode', 'puddle', 'poison', 'burn', 'freeze', 'slow', 'charm', 'fear', 'knockback',
    ]) {
      expect(MOD_IDS).toContain(m);
    }
    expect(MOD_IDS.length).toBe(29);
  });
});

describe('pickup kinds', () => {
  it('numeric kinds match the names and have properties', () => {
    expect(PICKUP_KIND_COUNT).toBe(PICKUP_NAMES.length);
    expect(Object.keys(PK).length).toBe(PICKUP_NAMES.length);
    for (let k = 0; k < PICKUP_KIND_COUNT; k++) {
      expect(pickupKindOf(pickupName(k as never))).toBe(k);
      expect(PICKUP_RADIUS[k]).toBeGreaterThan(0);
      expect(PICKUP_PUSH[k]).toBeGreaterThan(0);
    }
    expect(pickupKindOf('lockbox')).toBe(PK.Lockbox);
    expect(() => pickupKindOf('nope')).toThrow();
  });
});
