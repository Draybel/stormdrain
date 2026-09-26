/**
 * Numeric pickup kinds (hot loops compare numbers, content uses names — see PICKUP_NAMES in types.ts)
 * and their static properties.
 */

import { PICKUP_NAMES, type PickupName } from './types';

/** Indices match PICKUP_NAMES order. */
export const PK = {
  Coin: 0,
  SilverCoin: 1,
  GoldCoin: 2,
  LuckyCoin: 3,
  Bomb: 4,
  DoubleBomb: 5,
  Key: 6,
  KeyRing: 7,
  HalfHeart: 8,
  Heart: 9,
  TinHeart: 10,
  EmberHeart: 11,
  SparkSmall: 12,
  SparkFull: 13,
  Satchel: 14,
  Lockbox: 15,
  Trinket: 16,
  Consumable: 17,
} as const;

export type PickupKind = (typeof PK)[keyof typeof PK];

export const PICKUP_KIND_COUNT = PICKUP_NAMES.length;

const BY_NAME = new Map<string, PickupKind>();
PICKUP_NAMES.forEach((n, i) => BY_NAME.set(n, i as PickupKind));

export function pickupKindOf(name: PickupName | string): PickupKind {
  const k = BY_NAME.get(name);
  if (k === undefined) throw new Error(`unknown pickup kind "${name}"`);
  return k;
}

export function pickupName(kind: PickupKind): PickupName {
  return PICKUP_NAMES[kind]!;
}

/** Collision radius (px). */
export const PICKUP_RADIUS: readonly number[] = [
  3.5, // coin
  3.5, // silverCoin
  3.5, // goldCoin
  3.5, // luckyCoin
  4.5, // bomb
  5.5, // doubleBomb
  4, // key
  4.5, // keyRing
  4, // halfHeart
  4.5, // heart
  4.5, // tinHeart
  4.5, // emberHeart
  4, // sparkSmall
  4.5, // sparkFull
  6, // satchel
  6, // lockbox
  5, // trinket
  5, // consumable
];

/** How easily the player / explosions shove it (1 = light; chests are heavy). */
export const PICKUP_PUSH: readonly number[] = [1, 1, 1, 1, 0.9, 0.8, 1, 1, 1, 1, 1, 1, 1, 1, 0.35, 0.3, 1, 1];

export function isChest(kind: number): boolean {
  return kind === PK.Satchel || kind === PK.Lockbox;
}

export function isCoin(kind: number): boolean {
  return kind <= PK.LuckyCoin;
}

export function isHeart(kind: number): boolean {
  return kind >= PK.HalfHeart && kind <= PK.EmberHeart;
}

/** Carries an item id (trinket / consumable lying on the floor). */
export function isItemPickup(kind: number): boolean {
  return kind === PK.Trinket || kind === PK.Consumable;
}
