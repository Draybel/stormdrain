/**
 * Core drop tables (rolled with the run's seeded lootRng, see sim/drops.ts).
 * Weights are relative within a table; `nothing` competes with the entries on every roll and
 * shrinks with luck (`luck` = fraction per luck point, floored at 20 %).
 */

import type { DropTableDef } from '../../sim/types';

const tables: DropTableDef[] = [
  {
    // Clay urns: small change, now and then something useful.
    id: 'urn',
    rolls: [1, 1],
    nothing: 45,
    luck: 0.08,
    entries: [
      { kind: 'coin', weight: 50 },
      { kind: 'halfHeart', weight: 14 },
      { kind: 'bomb', weight: 7 },
      { kind: 'key', weight: 7 },
      { kind: 'sparkSmall', weight: 3 },
    ],
  },
  {
    // Wooden crates.
    id: 'crate',
    rolls: [1, 1],
    nothing: 55,
    luck: 0.06,
    entries: [
      { kind: 'coin', weight: 38 },
      { kind: 'silverCoin', weight: 4 },
      { kind: 'bomb', weight: 12 },
      { kind: 'key', weight: 10 },
      { kind: 'halfHeart', weight: 12 },
      { kind: 'heart', weight: 5 },
      { kind: 'sparkSmall', weight: 5 },
    ],
  },
  {
    // Put-out fires: a warm coin or, rarely, an ember heart.
    id: 'fire',
    rolls: [1, 1],
    nothing: 70,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 40 },
      { kind: 'halfHeart', weight: 20 },
      { kind: 'emberHeart', weight: 6 },
      { kind: 'bomb', weight: 10 },
    ],
  },
  {
    // Tinted rocks (bomb them!): always pay out.
    id: 'tintedRock',
    rolls: [1, 2],
    nothing: 0,
    entries: [
      { kind: 'bomb', weight: 24 },
      { kind: 'doubleBomb', weight: 6 },
      { kind: 'key', weight: 20 },
      { kind: 'coin', weight: 18 },
      { kind: 'silverCoin', weight: 6 },
      { kind: 'tinHeart', weight: 12 },
      { kind: 'heart', weight: 10 },
    ],
  },
  {
    // Satchel (brown, free).
    id: 'satchel',
    rolls: [2, 3],
    nothing: 8,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 40 },
      { kind: 'silverCoin', weight: 6 },
      { kind: 'bomb', weight: 14 },
      { kind: 'key', weight: 12 },
      { kind: 'halfHeart', weight: 10 },
      { kind: 'heart', weight: 8 },
      { kind: 'tinHeart', weight: 4 },
      { kind: 'sparkSmall', weight: 4 },
    ],
  },
  {
    // Lockbox (gold, needs a key): better loot, sometimes a trinket or a consumable.
    id: 'lockbox',
    rolls: [3, 4],
    nothing: 0,
    entries: [
      { kind: 'coin', weight: 16, count: 2 },
      { kind: 'silverCoin', weight: 12 },
      { kind: 'goldCoin', weight: 4 },
      { kind: 'bomb', weight: 11 },
      { kind: 'doubleBomb', weight: 4 },
      { kind: 'key', weight: 9 },
      { kind: 'keyRing', weight: 3 },
      { kind: 'heart', weight: 10 },
      { kind: 'tinHeart', weight: 8 },
      { kind: 'emberHeart', weight: 4 },
      { kind: 'sparkFull', weight: 4 },
      { kind: 'trinket', weight: 6, pool: 'chest' },
      { kind: 'consumable', weight: 8, pool: 'chest' },
    ],
  },
  {
    // Picnic Basket active item.
    id: 'basket',
    rolls: [2, 2],
    nothing: 0,
    entries: [
      { kind: 'halfHeart', weight: 20 },
      { kind: 'heart', weight: 10 },
      { kind: 'coin', weight: 30 },
      { kind: 'bomb', weight: 12 },
      { kind: 'key', weight: 12 },
      { kind: 'tinHeart', weight: 5 },
    ],
  },
  {
    // Room-clear reward (used by the room/floor code).
    id: 'roomClear',
    rolls: [1, 1],
    nothing: 35,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 35 },
      { kind: 'silverCoin', weight: 4 },
      { kind: 'halfHeart', weight: 14 },
      { kind: 'heart', weight: 8 },
      { kind: 'bomb', weight: 12 },
      { kind: 'key', weight: 12 },
      { kind: 'sparkSmall', weight: 6 },
      { kind: 'tinHeart', weight: 4 },
      { kind: 'satchel', weight: 5 },
      { kind: 'lockbox', weight: 2 },
    ],
  },
];

export default tables;
