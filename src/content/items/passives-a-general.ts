/**
 * Items pack A — general passives (no set).
 * - Stat items that MULTIPLY (duplicates compound): Lead Marble (damage ×1.3), Cold Brew Can,
 *   Magnifying Glass, Slingshot Band, Gold Star Badge (×1.1 to everything), Spyglass.
 * - Luck engines (every chance in the game grows with luck): Wishing Penny, Weighted Die (lucky coins feed
 *   more luck), Ladybug Brooch, Tracing Paper.
 * - "Useless alone, amazing in combos": Carousel Horse (a lap around you, then shots bolt off
 *   accelerating), Snail Mail Stamp (huge slow shots — homing / orbit / explode / grow turn them into
 *   mines and wrecking balls), Rearview Mirror (shots both ways, swinging back — with pierce they
 *   sweep the room twice), Tracing Paper (a luck-scaled chance to double a volley; overlapping copies
 *   stack), Greasy Gloves (short range, but every shot pops where it lands).
 */

import type { ItemDef } from '../../sim/types';
import { COSTUME_GOLD_STAR } from '../sprites/itemsA-costumes';
import {
  ICON_SPYGLASS,
  ICON_TRACING_PAPER,
  ICON_CAROUSEL_HORSE,
  ICON_COLD_BREW_CAN,
  ICON_GOLD_STAR_BADGE,
  ICON_GREASY_GLOVES,
  ICON_LADYBUG_BROOCH,
  ICON_LEAD_MARBLE,
  ICON_MAGNIFYING_GLASS,
  ICON_REARVIEW_MIRROR,
  ICON_SLINGSHOT_BAND,
  ICON_SNAIL_MAIL_STAMP,
  ICON_WEIGHTED_DIE,
  ICON_WISHING_PENNY,
} from '../sprites/itemsA-icons';

/** How long a Tracing Paper copy lasts (s): long enough to double the next volley or two. */
const COPY = 0.6;

const items: ItemDef[] = [
  // ── Stat multipliers ──
  {
    id: 'lead-marble',
    name: 'Lead Marble',
    desc: 'HEAVY AND MEAN · DAMAGE X1.3',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss', 'challenge'],
    tags: ['stat-up'],
    effects: [
      { type: 'stat', stat: 'damage', mul: 1.3 },
      { type: 'stat', stat: 'knockback', mul: 1.3 },
      { type: 'stat', stat: 'shotSpeed', mul: 0.92 },
    ],
    sprite: ICON_LEAD_MARBLE,
  },
  {
    id: 'cold-brew-can',
    name: 'Cold Brew Can',
    desc: 'BUZZING · FIRE RATE +0.5, THEN X1.1',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['stat-up', 'food'],
    effects: [
      { type: 'stat', stat: 'fireRate', add: 0.5 },
      { type: 'stat', stat: 'fireRate', mul: 1.1 },
    ],
    sprite: ICON_COLD_BREW_CAN,
  },
  {
    id: 'magnifying-glass',
    name: 'Magnifying Glass',
    desc: 'BIGGER SHOTS THAT HIT HARDER · DAMAGE X1.15',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['stat-up', 'glimmer'],
    effects: [
      { type: 'stat', stat: 'shotSize', mul: 1.35 },
      { type: 'stat', stat: 'damage', mul: 1.15 },
    ],
    sprite: ICON_MAGNIFYING_GLASS,
  },
  {
    id: 'slingshot-band',
    name: 'Slingshot Band',
    desc: 'SNAPPY SHOTS FLY FASTER AND FARTHER',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['stat-up', 'toybox'],
    effects: [
      { type: 'stat', stat: 'shotSpeed', mul: 1.25 },
      { type: 'stat', stat: 'range', mul: 1.25 },
      { type: 'stat', stat: 'knockback', mul: 1.2 },
    ],
    sprite: ICON_SLINGSHOT_BAND,
  },
  {
    id: 'gold-star-badge',
    unlock: 'big-game',
    name: 'Gold Star Badge',
    desc: 'A LITTLE BETTER AT EVERYTHING (X1.1)',
    kind: 'passive',
    quality: 3,
    pools: ['treasure', 'boss', 'broker'],
    tags: ['stat-up', 'toybox'],
    effects: [
      { type: 'stat', stat: 'damage', mul: 1.1 },
      { type: 'stat', stat: 'fireRate', mul: 1.1 },
      { type: 'stat', stat: 'shotSpeed', mul: 1.1 },
      { type: 'stat', stat: 'range', mul: 1.1 },
      { type: 'stat', stat: 'moveSpeed', mul: 1.05 },
      { type: 'stat', stat: 'luck', add: 0.5 },
    ],
    sprite: ICON_GOLD_STAR_BADGE,
    costume: { id: 'gold-star-badge', layer: 'body', sprite: COSTUME_GOLD_STAR, frames: 'dir' },
  },
  {
    id: 'spyglass',
    name: 'Spyglass',
    desc: 'SHOTS FLY FAR AND STRAIGHT THROUGH FOES',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['modifier', 'stat-up'],
    effects: [
      { type: 'mod', mod: 'pierce' },
      { type: 'stat', stat: 'range', mul: 1.25 },
      { type: 'stat', stat: 'shotSpeed', mul: 1.15 },
    ],
    sprite: ICON_SPYGLASS,
  },
  // ── Luck ──
  {
    id: 'wishing-penny',
    name: 'Wishing Penny',
    desc: '+1 LUCK · LUCKY ROOMS DROP EXTRA LOOT',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'secret'],
    tags: ['luck'],
    effects: [
      { type: 'stat', stat: 'luck', add: 1 },
      { type: 'trigger', on: 'roomClear', chance: 0.12, luck: 0.06, maxChance: 0.7, effects: [{ type: 'pickups', table: 'roomClear' }] },
    ],
    sprite: ICON_WISHING_PENNY,
  },
  {
    id: 'weighted-die',
    name: 'Weighted Die',
    desc: '+2 LUCK · FOES MAY DROP LUCKY COINS',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'secret', 'trader'],
    tags: ['luck', 'weird', 'toybox'],
    effects: [
      { type: 'stat', stat: 'luck', add: 2 },
      {
        type: 'trigger',
        on: 'kill',
        chance: 0.01,
        luck: 0.01,
        maxChance: 0.12,
        effects: [{ type: 'pickups', spawn: [{ kind: 'luckyCoin' }] }],
      },
    ],
    sprite: ICON_WEIGHTED_DIE,
  },
  {
    id: 'ladybug-brooch',
    name: 'Ladybug Brooch',
    desc: '+1 LUCK · WHEN HURT, LUCK MAY GROW A TIN HEART',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'shop'],
    tags: ['luck'],
    effects: [
      { type: 'stat', stat: 'luck', add: 1 },
      { type: 'trigger', on: 'hurt', chance: 0.1, luck: 0.06, maxChance: 0.6, effects: [{ type: 'hearts', tin: 2 }] },
    ],
    sprite: ICON_LADYBUG_BROOCH,
  },
  {
    id: 'tracing-paper',
    unlock: 'down-the-drain',
    name: 'Tracing Paper',
    desc: 'NOW AND THEN, YOUR SHOTS COME OUT DOUBLED',
    kind: 'passive',
    quality: 2,
    pools: ['treasure', 'secret'],
    tags: ['weird', 'luck'],
    effects: [
      {
        type: 'trigger',
        on: 'fire',
        chance: 0.05,
        luck: 0.02,
        maxChance: 0.35,
        effects: [{ type: 'mod', mod: 'extraShots', duration: COPY }],
      },
    ],
    sprite: ICON_TRACING_PAPER,
  },
  // ── Weird ──
  {
    id: 'carousel-horse',
    name: 'Carousel Horse',
    desc: 'SHOTS RIDE ONE LAP AROUND YOU, THEN BOLT',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'toybox'],
    effects: [
      { type: 'mod', mod: 'circleFirst' },
      { type: 'mod', mod: 'accelerate' },
      { type: 'stat', stat: 'damage', add: 0.3 },
    ],
    sprite: ICON_CAROUSEL_HORSE,
  },
  {
    id: 'snail-mail-stamp',
    name: 'Snail Mail Stamp',
    desc: 'SHOTS ARRIVE LATE... BUT THEY ARRIVE BIG',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'secret', 'deepSecret'],
    tags: ['weird'],
    effects: [
      { type: 'stat', stat: 'shotSpeed', mul: 0.5 },
      { type: 'stat', stat: 'shotSize', mul: 1.5 },
      { type: 'stat', stat: 'damage', mul: 1.6 },
      { type: 'stat', stat: 'range', mul: 1.35 },
      { type: 'stat', stat: 'fireRate', mul: 0.85 },
    ],
    sprite: ICON_SNAIL_MAIL_STAMP,
  },
  {
    id: 'rearview-mirror',
    name: 'Rearview Mirror',
    desc: 'SHOTS GO BOTH WAYS, THEN SWING BACK TO YOU',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'shop'],
    tags: ['weird', 'glimmer'],
    effects: [
      { type: 'mod', mod: 'backShot' },
      { type: 'mod', mod: 'boomerang' },
      { type: 'stat', stat: 'range', add: 20 },
    ],
    sprite: ICON_REARVIEW_MIRROR,
  },
  {
    id: 'greasy-gloves',
    unlock: 'gumball-wizard',
    name: 'Greasy Gloves',
    desc: 'SHOTS SLIP OUT EARLY... AND GO POP',
    kind: 'passive',
    quality: 1,
    pools: ['treasure', 'cursed'],
    tags: ['weird', 'explosive'],
    effects: [
      { type: 'stat', stat: 'range', mul: 0.55 },
      { type: 'mod', mod: 'explode' },
      { type: 'mod', mod: 'inaccuracy' },
      { type: 'stat', stat: 'damage', add: 0.5 },
    ],
    sprite: ICON_GREASY_GLOVES,
  },
];

export default items;
