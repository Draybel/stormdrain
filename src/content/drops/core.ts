/**
 * Core drop tables (rolled with the run's seeded lootRng, see sim/drops.ts).
 * Weights are relative within a table; `nothing` competes with the entries on every roll and
 * shrinks with luck (`luck` = fraction per luck point, floored at 20 %).
 *
 * Polish batch 4 (the balance harness, DECISIONS "Polish batch 4"): a floor paid ~45-60 coins, ~7 keys and ~8 bombs,
 * so coins sat at 99 and keys / bombs by the dozen by the last floors, and locks, bomb walls and shops stopped being
 * choices. Props, chests, tinted rocks and the room-clear reward now pay a third to a half of the coins and keys they
 * did: ≈ 20-30 coins a floor on the early floors (more on the long late ones), ≈ 2-5 keys and ≈ 2 net bombs.
 */

import type { DropTableDef } from '../../sim/types';

const tables: DropTableDef[] = [
  {
    // Clay urns: small change, now and then something useful.
    id: 'urn',
    rolls: [1, 1],
    nothing: 62,
    luck: 0.08,
    entries: [
      { kind: 'coin', weight: 14 },
      { kind: 'halfHeart', weight: 14 },
      { kind: 'bomb', weight: 2 },
      { kind: 'key', weight: 1 },
      { kind: 'sparkSmall', weight: 3 },
    ],
  },
  {
    // Wooden crates.
    id: 'crate',
    rolls: [1, 1],
    nothing: 70,
    luck: 0.06,
    entries: [
      { kind: 'coin', weight: 10 },
      { kind: 'silverCoin', weight: 2 },
      { kind: 'bomb', weight: 4 },
      { kind: 'key', weight: 2 },
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
      { kind: 'coin', weight: 14 },
      { kind: 'halfHeart', weight: 20 },
      { kind: 'emberHeart', weight: 6 },
      { kind: 'bomb', weight: 5 },
    ],
  },
  {
    // Tinted rocks (bomb them!): always pay out (polish batch 4: bombs 24 → 14 — a rock shouldn't refund its bomb and
    // more — keys 20 → 3, coins 18 → 8).
    id: 'tintedRock',
    rolls: [1, 2],
    nothing: 0,
    entries: [
      { kind: 'bomb', weight: 14 },
      { kind: 'doubleBomb', weight: 4 },
      { kind: 'key', weight: 3 },
      { kind: 'coin', weight: 8 },
      { kind: 'silverCoin', weight: 3 },
      { kind: 'tinHeart', weight: 12 },
      { kind: 'heart', weight: 10 },
    ],
  },
  {
    // Satchel (brown, free). Polish batch 4: coins 40 → 17, bombs 14 → 6, keys 12 → 4, Tin 4 → 2.
    id: 'satchel',
    rolls: [2, 3],
    nothing: 8,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 17 },
      { kind: 'silverCoin', weight: 4 },
      { kind: 'bomb', weight: 6 },
      { kind: 'key', weight: 4 },
      { kind: 'halfHeart', weight: 10 },
      { kind: 'heart', weight: 8 },
      { kind: 'tinHeart', weight: 2 },
      { kind: 'sparkSmall', weight: 4 },
    ],
  },
  {
    // Lockbox (gold, needs a key): better loot, sometimes a trinket or a consumable.
    id: 'lockbox',
    rolls: [3, 4],
    nothing: 0,
    entries: [
      { kind: 'coin', weight: 4, count: 2 },
      { kind: 'silverCoin', weight: 4 },
      { kind: 'goldCoin', weight: 1 },
      { kind: 'bomb', weight: 5 },
      { kind: 'doubleBomb', weight: 1 },
      { kind: 'key', weight: 3 },
      { kind: 'keyRing', weight: 1 },
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
    // Room-clear reward (used by the room/floor code). Polish batch 4: nothing 35 → 55, coins 35 → 10, keys 12 → 2,
    // bombs 12 → 4, Tin 4 → 2 — a long late floor has ~16 clears, so this table sets the late economy.
    id: 'roomClear',
    rolls: [1, 1],
    nothing: 55,
    luck: 0.05,
    entries: [
      { kind: 'coin', weight: 10 },
      { kind: 'silverCoin', weight: 2 },
      { kind: 'halfHeart', weight: 14 },
      { kind: 'heart', weight: 8 },
      { kind: 'bomb', weight: 4 },
      { kind: 'key', weight: 2 },
      { kind: 'sparkSmall', weight: 6 },
      { kind: 'tinHeart', weight: 2 },
      { kind: 'satchel', weight: 4 },
      { kind: 'lockbox', weight: 2 },
    ],
  },
];

export default tables;
