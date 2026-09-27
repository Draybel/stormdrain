/**
 * Pre-rolled room contents: everything a floor offers is decided when the floor is generated, from the
 * floor stream only — floorRng(seed, floor, track).fork('contents') plus the meta snapshot (locked
 * items) — so two runs with the same seed see the same enemies, items, chests and shop stock whatever
 * they do (ARCHITECTURE §3). Only drops (lootRng) and in-room randomness (combatRng) depend on play.
 *
 * Marker order = the order parseRoomLayout returns markers in on the MIRRORED grid (row-major), so a
 * room's i-th 'i' marker always gets items[i].
 */

import { floorRng, type Rng } from '../../engine/rng';
import { allChampions, allItems, findEnemy } from '../../content/registry';
import { ROOM_TEMPLATES } from '../floor/library';
import { templateChar } from '../floor/templates';
import type { FloorLayout, RoomTemplate, RoomType } from '../floor/types';
import type { ItemDef, PickupName, PoolId } from '../types';
import { chapterEnemies } from './chapters';
import type { RoomState } from './types';

const TEMPLATE_BY_ID = new Map<string, RoomTemplate>();
for (const t of ROOM_TEMPLATES) TEMPLATE_BY_ID.set(t.id, t);

/** A room template by id (null for unknown ids / rooms without a template). */
export function templateById(id: string | null): RoomTemplate | null {
  return id === null ? null : (TEMPLATE_BY_ID.get(id) ?? null);
}

/** An empty 13×7 room (a room type without any template: never happens with the generic set). */
export const EMPTY_ROOM: readonly string[] = [
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
  '.............',
];

/** Marker counts of a template seen through a mirroring, and which enemy markers are elites. */
export interface MarkerPlan {
  enemies: number;
  /** Per enemy marker (in order): 1 for an 'E'. */
  elite: number[];
  loot: number;
  chests: number;
  items: number;
  shop: number;
  boss: number;
}

export function markerPlan(t: RoomTemplate | null, flip: number): MarkerPlan {
  const plan: MarkerPlan = { enemies: 0, elite: [], loot: 0, chests: 0, items: 0, shop: 0, boss: 0 };
  if (!t) return plan;
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 13; col++) {
      switch (templateChar(t, flip, col, row)) {
        case 'e':
          plan.enemies++;
          plan.elite.push(0);
          break;
        case 'E':
          plan.enemies++;
          plan.elite.push(1);
          break;
        case 'p':
          plan.loot++;
          break;
        case 'c':
          plan.chests++;
          break;
        case 'i':
          plan.items++;
          break;
        case 'S':
          plan.shop++;
          break;
        case 'B':
          plan.boss++;
          break;
        default:
          break;
      }
    }
  }
  return plan;
}

/** Fresh runtime state around a set of pre-rolls. */
export function emptyRoomState(): RoomState {
  return {
    waves: [],
    champs: [],
    loot: [],
    chests: [],
    items: [],
    shop: [],
    prices: [],
    hearts: [],
    boss: '',
    reward: '',
    visited: false,
    cleared: false,
    wave: 0,
    opened: 0,
    grid: null,
    pickups: null,
    pedestals: null,
    trapdoor: false,
  };
}

// ── Tables ──────────────────────────────────────────────────────────────────

type Weighted<T> = readonly (readonly [T, number])[];

const LOOT_COMMON: Weighted<PickupName> = [
  ['coin', 45],
  ['silverCoin', 3],
  ['bomb', 15],
  ['key', 14],
  ['halfHeart', 12],
  ['heart', 6],
  ['sparkSmall', 4],
];
const LOOT_SECRET: Weighted<PickupName> = [
  ['coin', 28],
  ['silverCoin', 14],
  ['goldCoin', 2],
  ['bomb', 18],
  ['doubleBomb', 4],
  ['key', 14],
  ['heart', 10],
  ['tinHeart', 8],
  ['sparkFull', 2],
];
const CHEST_COMMON: Weighted<PickupName> = [
  ['satchel', 80],
  ['lockbox', 20],
];
const CHEST_RICH: Weighted<PickupName> = [
  ['satchel', 40],
  ['lockbox', 60],
];

/** Where each room type's pedestal items come from, most specific pool first. */
const ITEM_POOLS: Partial<Record<RoomType, readonly PoolId[]>> = {
  treasure: ['treasure'],
  secret: ['secret', 'treasure'],
  deepSecret: ['deepSecret', 'secret', 'treasure'],
  challenge: ['challenge', 'treasure'],
  cursed: ['cursed', 'treasure'],
  nook: ['broker', 'treasure'],
};
const BOSS_POOLS: readonly PoolId[] = ['boss', 'treasure'];
const SHOP_POOLS: readonly PoolId[] = ['shop', 'treasure'];

/** Treasure-style rolls make the best items rarer (quality 0-4). */
const QUALITY_WEIGHT = [1, 1, 1, 0.7, 0.35] as const;
/** Shop prices (coins) by quality for passives / actives; trinkets and consumables are cheap. */
const ITEM_PRICE = [10, 12, 15, 20, 25] as const;

function pickWeighted<T>(rng: Rng, table: Weighted<T>): T {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng.next() * total;
  for (const [v, w] of table) {
    if (r < w) return v;
    r -= w;
  }
  return table[table.length - 1]![0];
}

function isPedestalKind(d: ItemDef): boolean {
  return d.kind === 'passive' || d.kind === 'active';
}

/**
 * One item from the first pool that still has candidates (not used on this floor, not locked);
 * `anyKind` also allows trinkets / consumables (shops). Falls back to repeats before giving up ('').
 */
function rollItem(
  rng: Rng,
  pools: readonly PoolId[],
  used: Set<string>,
  locked: ReadonlySet<string>,
  anyKind: boolean,
  minQuality = 0,
): string {
  const roll = rng.next();
  const items = allItems();
  for (let pass = 0; pass < 2; pass++) {
    for (const pool of pools) {
      let total = 0;
      const list: ItemDef[] = [];
      for (const d of items) {
        if (!d.pools.includes(pool) || d.tags.includes('test') || locked.has(d.id)) continue;
        if (!anyKind && !isPedestalKind(d)) continue;
        if (pass === 0 && (used.has(d.id) || d.quality < minQuality)) continue;
        list.push(d);
        total += QUALITY_WEIGHT[d.quality] ?? 1;
      }
      if (list.length === 0) continue;
      let r = roll * total;
      let chosen = list[list.length - 1]!;
      for (const d of list) {
        const w = QUALITY_WEIGHT[d.quality] ?? 1;
        if (r < w) {
          chosen = d;
          break;
        }
        r -= w;
      }
      used.add(chosen.id);
      return chosen.id;
    }
  }
  return '';
}

function priceOf(id: string): number {
  const d = allItems().find((x) => x.id === id);
  if (!d) return 15;
  if (d.kind === 'trinket') return 8;
  if (d.kind === 'consumable') return 5 + d.quality;
  return ITEM_PRICE[d.quality] ?? 15;
}

/** Movement kinds that make a dull placeholder boss (it would never come for you). */
const STATIC_MOVES = new Set(['idle', 'turret', 'wallCrawl']);

/**
 * The strongest enemy of a pool that actually moves (placeholder bosses until the boss framework
 * exists); the strongest of all when none moves.
 */
function strongest(ids: readonly string[]): string {
  let best = '';
  let hp = -1;
  for (let pass = 0; pass < 2 && !best; pass++) {
    for (const id of ids) {
      const d = findEnemy(id);
      if (!d || (pass === 0 && STATIC_MOVES.has(d.move.kind))) continue;
      if (d.hp > hp) {
        hp = d.hp;
        best = id;
      }
    }
  }
  return best;
}

/**
 * Rolls every room of a floor (and the Broker's Nook reserve). Deterministic for (layout, chapter,
 * locked items, content set).
 */
export function rollFloorContents(
  layout: FloorLayout,
  chapterId: string,
  locked: ReadonlySet<string>,
  challengeWaves: number,
): { rooms: RoomState[]; nook: RoomState } {
  const rng = floorRng(layout.seed, layout.floorIndex, layout.track).fork('contents');
  const pool = chapterEnemies(chapterId);
  const poolIds = pool.map((d) => d.id);
  const champs = allChampions();
  const used = new Set<string>();

  const rollRoom = (type: RoomType, templateId: string | null, flip: number): RoomState => {
    const st = emptyRoomState();
    const plan = markerPlan(templateById(templateId), flip);
    // Enemies (one list per wave; E markers get a forced champion).
    const waves = type === 'challenge' ? Math.max(1, challengeWaves) : 1;
    for (let wv = 0; wv < waves && plan.enemies > 0; wv++) {
      const ids: string[] = [];
      const ch: string[] = [];
      for (let i = 0; i < plan.enemies; i++) {
        ids.push(pool.length ? rng.weightedPick(pool, (d) => d.weight).id : '');
        const elite = plan.elite[i] === 1 && champs.length > 0;
        ch.push(elite ? rng.weightedPick(champs, (c) => c.weight).id : '');
      }
      st.waves.push(ids);
      st.champs.push(ch);
    }
    const rich = type === 'secret' || type === 'deepSecret';
    for (let i = 0; i < plan.loot; i++) st.loot.push(pickWeighted(rng, rich ? LOOT_SECRET : LOOT_COMMON));
    const richChest = rich || type === 'cursed' || type === 'challenge';
    for (let i = 0; i < plan.chests; i++) st.chests.push(pickWeighted(rng, richChest ? CHEST_RICH : CHEST_COMMON));
    const pools = ITEM_POOLS[type] ?? ['treasure'];
    for (let i = 0; i < plan.items; i++) {
      const id = rollItem(rng, pools, used, locked, false, type === 'nook' ? 2 : 0);
      st.items.push(id);
      if (type === 'nook') {
        const d = allItems().find((x) => x.id === id);
        st.hearts.push(d && d.quality >= 4 ? 2 : 1);
      } else {
        st.hearts.push(0);
      }
    }
    for (let i = 0; i < plan.shop; i++) {
      const id = rollItem(rng, SHOP_POOLS, used, locked, true);
      st.shop.push(id);
      st.prices.push(priceOf(id));
    }
    if (plan.boss > 0) {
      if (type === 'boss') st.boss = strongest(poolIds);
      else st.boss = pool.length ? rng.weightedPick(pool, (d) => d.weight).id : '';
    }
    if (type === 'boss') st.reward = rollItem(rng, BOSS_POOLS, used, locked, false);
    return st;
  };

  const rooms = layout.rooms.map((r) => rollRoom(r.type, r.templateId, r.flip));
  const nook = rollRoom('nook', layout.nook.templateId, layout.nook.flip);
  return { rooms, nook };
}
