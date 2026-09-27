/**
 * The training yard (13×7): try everything in one room. Uses the room legend from ARCHITECTURE §5
 * plus two test-room-only markers:  `@` player start,  `D` training dummy.
 * Intentionally NOT in content/rooms/ so floor generation never picks it up.
 *
 * Zones: start + open floor on the left; a row of crates, urns, a tinted rock and a metal block
 * along the top wall; a pit in the middle (fly over it!); a column of dummies on the right
 * (pop all three at once = "room cleared" → active charge); a hazard corner (fire, spikes)
 * guarding a satchel and a lockbox; item pedestals in rows 1 and 5 (their floating items use the
 * cells above them, so those stay free): three ROTATING pedestals from the treasure pool, both
 * actives, and a rotating attack carrier; and a bell near the start (1,5) that calls a wave.
 *
 * Unit tests rely on: rock at (1,0) and (0,1); row 2 open end to end; columns 0 and 2 open top to
 * bottom; row 3 open from the start to the pit at (6-7,3) with a dummy behind it at (10,3).
 */

import type { RoomSpawn } from '../sim/roomSpawns';

export const TEST_ROOM: readonly string[] = [
  '##..xx.u.u$.M',
  '#.........D.u',
  '.............',
  '..@...OO..D.f',
  '.......O.....',
  '..........D^^',
  '...........##',
];

export const TEST_ROOM_SPAWNS: readonly RoomSpawn[] = [
  // Three rotating pedestals from the treasure pool (every passive: modifiers, weird items,
  // familiars, stat ups…): a new item every few seconds, refilled soon after you take one.
  { kind: 'pedestal', col: 4, row: 5, pool: 'treasure', itemKind: 'passive', rotate: true },
  { kind: 'pedestal', col: 6, row: 5, pool: 'treasure', itemKind: 'passive', rotate: true },
  { kind: 'pedestal', col: 8, row: 5, pool: 'treasure', itemKind: 'passive', rotate: true },
  // Both actives to swap between.
  { kind: 'pedestal', col: 6, row: 1, item: 'jar-of-lightning' },
  { kind: 'pedestal', col: 8, row: 1, item: 'picnic-basket' },
  // A rotating attack type (Storm Lance, lasers, boomerang, melee, bombs, charge, orbit blades).
  { kind: 'pedestal', col: 3, row: 1, tag: 'starter-attack', rotate: true },
  // The bell by the start (column 0 stays open): bump into it to call a wave.
  { kind: 'bell', col: 1, row: 5 },
  // Coins right by the start.
  { kind: 'pickup', pickup: 'coin', col: 3, row: 3 },
  { kind: 'pickup', pickup: 'silverCoin', col: 4, row: 3 },
  { kind: 'pickup', pickup: 'goldCoin', col: 5, row: 3 },
  { kind: 'pickup', pickup: 'luckyCoin', col: 1, row: 6 },
  // Hearts along the bottom (red ones only heal once you're hurt).
  { kind: 'pickup', pickup: 'halfHeart', col: 3, row: 6 },
  { kind: 'pickup', pickup: 'heart', col: 4, row: 6 },
  { kind: 'pickup', pickup: 'tinHeart', col: 5, row: 6 },
  { kind: 'pickup', pickup: 'emberHeart', col: 6, row: 6 },
  // Bombs, keys and spark cells.
  { kind: 'pickup', pickup: 'bomb', col: 8, row: 3 },
  { kind: 'pickup', pickup: 'doubleBomb', col: 9, row: 3 },
  { kind: 'pickup', pickup: 'key', col: 4, row: 2 },
  { kind: 'pickup', pickup: 'keyRing', col: 9, row: 2 },
  { kind: 'pickup', pickup: 'sparkSmall', col: 9, row: 6 },
  { kind: 'pickup', pickup: 'sparkFull', col: 10, row: 6 },
  // Chests in the hazard corner.
  { kind: 'pickup', pickup: 'satchel', col: 11, row: 4 },
  { kind: 'pickup', pickup: 'lockbox', col: 12, row: 4 },
  // A random trinket and consumable.
  { kind: 'pickup', pickup: 'trinket', col: 1, row: 2 },
  { kind: 'pickup', pickup: 'consumable', col: 1, row: 4 },
];
