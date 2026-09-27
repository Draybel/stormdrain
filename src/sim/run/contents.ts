/**
 * Pre-rolled room contents: everything a floor offers is decided when the floor is generated, from the
 * floor stream only — floorRng(seed, floor, track).fork('contents') (one fork per room, so adding a roll
 * to one room type never shifts another) plus the run's meta snapshot (locked items) and the items it
 * has seen so far (never offered twice) — so two runs with the same seed and the same route see the
 * same enemies, bosses, items, chests, shop stock, gamblers and traders. Only drops (lootRng) and
 * in-room randomness (combatRng) depend on play inside the rooms.
 *
 * Marker order = the order parseRoomLayout returns markers in on the MIRRORED grid (row-major), so a
 * room's i-th 'i' marker always gets items[i].
 */

import { floorRng, type Rng } from '../../engine/rng';
import { allChampions, findEnemy, findItem } from '../../content/registry';
import { bossHpFor, finalBossDef, pickBoss } from '../bosses/select';
import { ROOM_TEMPLATES } from '../floor/library';
import { templateChar } from '../floor/templates';
import type { FloorLayout, RoomTemplate, RoomType } from '../floor/types';
import type { PickupName, PoolId } from '../types';
import { chapterEnemies, chapterFor } from './chapters';
import { itemPrice, rollItem } from './pools';
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
    bossHp: 0,
    reward: '',
    goods: [],
    alts: [],
    bonus: [],
    choice: false,
    slots: false,
    trader: '',
    visited: false,
    cleared: false,
    wave: 0,
    opened: 0,
    grid: null,
    pickups: null,
    pedestals: null,
    trapdoor: false,
    plate: 0,
    grate: 0,
    exits: 0,
  };
}

// ── Tables ──────────────────────────────────────────────────────────────────

type Weighted<T> = readonly (readonly [T, number])[];

/** 'p' markers (polish batch 4: coins 45 → 22, keys 14 → 5, bombs 15 → 7 — they piled up at 99 by the last floors). */
const LOOT_COMMON: Weighted<PickupName> = [
  ['coin', 22],
  ['silverCoin', 3],
  ['bomb', 7],
  ['key', 5],
  ['halfHeart', 12],
  ['heart', 6],
  ['sparkSmall', 4],
];
/** Secret rooms' 'p' markers and a Forgotten Pocket's pile (polish batch 4: coins 28 → 24, silver 14 → 10). */
const LOOT_SECRET: Weighted<PickupName> = [
  ['coin', 24],
  ['silverCoin', 10],
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
/** Magpie's Stall pickups for sale and their prices (coins). */
const SHOP_GOODS: Weighted<PickupName> = [
  ['heart', 30],
  ['key', 20],
  ['bomb', 20],
  ['tinHeart', 10],
  ['doubleBomb', 6],
  ['sparkFull', 6],
  ['emberHeart', 4],
];
export const GOODS_PRICE: Readonly<Partial<Record<PickupName, number>>> = {
  halfHeart: 2,
  heart: 3,
  key: 5,
  bomb: 5,
  tinHeart: 5,
  doubleBomb: 7,
  sparkFull: 6,
  emberHeart: 7,
  keyRing: 7,
};

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
const TRADER_POOLS: readonly PoolId[] = ['trader', 'treasure'];

/** Magpie's Stall uses at most this many 'S' slots. */
export const SHOP_SLOTS_MAX = 5;
/**
 * An 'E' (elite) marker holds a champion this often (polish batch 4: always, before — champions were 8 % of spawns on
 * floor 1 and 42 % on floor 12, though documented as rare). Pre-rolled with the room like everything else.
 */
export const ELITE_CHANCE = 0.4;
/** Chance per normal room of a Gumball Gambler; chance per floor of Old Pell. */
export const SLOTS_CHANCE = 0.12;
export const TRADER_CHANCE = 0.15;
/** Thorn Room: chance an 'i' holds a curse-pool item (else a lockbox). Forgotten Pocket: better item vs big loot. */
export const CURSED_ITEM_CHANCE = 0.55;
export const DEEP_ITEM_CHANCE = 0.5;

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

/** Movement kinds that make a dull placeholder boss (it would never come for you). */
const STATIC_MOVES = new Set(['idle', 'turret', 'wallCrawl']);

/**
 * The strongest enemy of a pool that actually moves — the placeholder boss used only when no BossDef
 * of the kind exists at all.
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

/** What the floor rolls need from the run. */
export interface ContentsCtx {
  /** Items that never roll (the run's meta snapshot). */
  locked: ReadonlySet<string>;
  /** Items seen earlier this run (left out of the pools). */
  seen: ReadonlySet<string>;
  /** Rain Barrel Arena waves. */
  challengeWaves: number;
}

/**
 * The boss of a floor's boss / miniboss room: a final boss by the layout's key, else a seeded pick of
 * the chapter's pool that avoids the previous floor's boss of the same chapter.
 */
export function bossFor(layout: FloorLayout, chapterId: string, type: 'boss' | 'miniboss'): { id: string; hp: number } | null {
  const floor = layout.floorIndex;
  if (type === 'boss' && layout.finalBoss) {
    const f = finalBossDef(layout.finalBoss);
    if (f) return { id: f.id, hp: f.hp };
  }
  const kind = type === 'boss' ? 'boss' : 'miniboss';
  let avoid = '';
  if (floor > 1) {
    const prev = chapterFor(floor - 1, layout.track);
    if (prev.id === chapterId) avoid = pickBoss(layout.seed, floor - 1, layout.track, chapterId, kind)?.id ?? '';
  }
  const def = pickBoss(layout.seed, floor, layout.track, chapterId, kind, avoid);
  return def ? { id: def.id, hp: bossHpFor(def, floor) } : null;
}

/**
 * Rolls every room of a floor (and the Broker's Nook reserve). Deterministic for (layout, chapter,
 * locked + seen items, content set).
 */
export function rollFloorContents(layout: FloorLayout, chapterId: string, ctx: ContentsCtx): { rooms: RoomState[]; nook: RoomState } {
  const base = floorRng(layout.seed, layout.floorIndex, layout.track).fork('contents');
  const pool = chapterEnemies(chapterId);
  const poolIds = pool.map((d) => d.id);
  const champs = allChampions();
  const used = new Set<string>(ctx.seen);
  const locked = ctx.locked;

  const rollRoom = (rng: Rng, type: RoomType, templateId: string | null, flip: number): RoomState => {
    const st = emptyRoomState();
    const plan = markerPlan(templateById(templateId), flip);
    // Enemies (one list per wave; E markers get a champion ELITE_CHANCE of the time).
    const waves = type === 'challenge' ? Math.max(1, ctx.challengeWaves) : 1;
    for (let wv = 0; wv < waves && plan.enemies > 0; wv++) {
      const ids: string[] = [];
      const ch: string[] = [];
      for (let i = 0; i < plan.enemies; i++) {
        ids.push(pool.length ? rng.weightedPick(pool, (d) => d.weight).id : '');
        let champ = '';
        if (plan.elite[i] === 1 && champs.length > 0) {
          // The champion is always picked (the room's other pre-rolls keep their place in the stream); whether the
          // marker gets it is a coin flip on a fork of its own.
          const pick = rng.weightedPick(champs, (c) => c.weight).id;
          if (rng.fork(`E${wv}.${i}`).next() < ELITE_CHANCE) champ = pick;
        }
        ch.push(champ);
      }
      st.waves.push(ids);
      st.champs.push(ch);
    }
    const rich = type === 'secret' || type === 'deepSecret';
    for (let i = 0; i < plan.loot; i++) st.loot.push(pickWeighted(rng, rich ? LOOT_SECRET : LOOT_COMMON));
    const richChest = rich || type === 'cursed' || type === 'challenge';
    for (let i = 0; i < plan.chests; i++) st.chests.push(pickWeighted(rng, richChest ? CHEST_RICH : CHEST_COMMON));

    // Pedestal items ('i').
    const pools = ITEM_POOLS[type] ?? ['treasure'];
    // Forgotten Pocket: a better item, or a big pile of loot instead.
    const deepLoot = type === 'deepSecret' && rng.next() >= DEEP_ITEM_CHANCE;
    const nItems = type === 'nook' ? Math.min(2, plan.items) : plan.items;
    for (let i = 0; i < plan.items; i++) {
      let id = '';
      let alt = '';
      if (i >= nItems) {
        // Extra nook markers stay empty (the Moth Broker offers two deals).
      } else if (deepLoot) {
        alt = 'lockbox';
      } else if (type === 'cursed' && rng.next() >= CURSED_ITEM_CHANCE) {
        alt = 'lockbox';
      } else {
        // The Moth Broker only deals in quality 3-4 (polish batch 4: 2 let ordinary items cost a heart container).
        const minQ = type === 'nook' || type === 'deepSecret' ? 3 : 0;
        id = rollItem(rng, pools, used, locked, false, minQ);
      }
      st.items.push(id);
      st.alts.push(alt);
      if (type === 'nook' && id) {
        const d = findItem(id);
        st.hearts.push(d && d.quality >= 4 ? 2 : 1);
      } else {
        st.hearts.push(0);
      }
    }
    st.choice = type === 'nook';
    if (deepLoot) {
      const n = 5 + rng.int(0, 3);
      for (let i = 0; i < n; i++) st.bonus.push(pickWeighted(rng, LOOT_SECRET));
    }

    // Magpie's Stall: 3-5 slots, a few items (priced by quality) and pickups for sale.
    const slots = Math.min(SHOP_SLOTS_MAX, plan.shop);
    const shopItems = slots >= 3 ? 2 + (rng.next() < 0.4 ? 1 : 0) : Math.max(1, slots - 1);
    let lastGoods = '';
    for (let i = 0; i < plan.shop; i++) {
      if (i >= slots) {
        st.shop.push('');
        st.goods.push('');
        st.prices.push(0);
      } else if (i < shopItems) {
        const id = rollItem(rng, SHOP_POOLS, used, locked, true);
        st.shop.push(id);
        st.goods.push('');
        st.prices.push(itemPrice(id));
      } else {
        let g = pickWeighted(rng, SHOP_GOODS);
        if (g === lastGoods) g = pickWeighted(rng, SHOP_GOODS);
        lastGoods = g;
        st.shop.push('');
        st.goods.push(g);
        st.prices.push(GOODS_PRICE[g] ?? 5);
      }
    }

    // Boss / miniboss ('B'): a BossDef (sim/bosses), else the old placeholder enemy.
    if (plan.boss > 0 && (type === 'boss' || type === 'miniboss')) {
      const b = bossFor(layout, chapterId, type);
      if (b) {
        st.boss = b.id;
        st.bossHp = b.hp;
      } else {
        st.boss = type === 'boss' ? strongest(poolIds) : pool.length ? rng.weightedPick(pool, (d) => d.weight).id : '';
      }
    }
    if (type === 'boss' && !layout.finalBoss) st.reward = rollItem(rng, BOSS_POOLS, used, locked, false);
    return st;
  };

  const rooms = layout.rooms.map((r) => rollRoom(base.fork(`r${r.index}`), r.type, r.templateId, r.flip));
  const nook = rollRoom(base.fork('nook'), 'nook', layout.nook.templateId, layout.nook.flip);

  // Floor-wide extras: Gumball Gamblers in some normal rooms, Old Pell on some floors.
  const extra = base.fork('extras');
  const normals: number[] = [];
  for (const r of layout.rooms) if (r.type === 'normal') normals.push(r.index);
  let pell = -1;
  if (normals.length > 0 && extra.next() < TRADER_CHANCE) {
    pell = normals[extra.int(0, normals.length - 1)]!;
    rooms[pell]!.trader = rollItem(extra, TRADER_POOLS, used, locked, false);
  }
  for (const i of normals) if (extra.next() < SLOTS_CHANCE && i !== pell) rooms[i]!.slots = true;
  // The hidden-route grate (a cracked drain in the secret room, or in the boss room after the boss).
  if (layout.hiddenRoute >= 0 && rooms[layout.hiddenRoute]) rooms[layout.hiddenRoute]!.grate = 1;
  return { rooms, nook };
}
