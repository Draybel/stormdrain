/**
 * Content registries (ARCHITECTURE §1). Every content type lives in its own folder and is
 * auto-discovered with `import.meta.glob(..., { eager: true })` — adding content = adding a file.
 * Each module's `export default` is an array of defs. Duplicate ids THROW at load time.
 *
 * DOM-free: the headless sim imports this module.
 */

import type {
  AchievementDef,
  BossDef,
  ChampionDef,
  ChapterDef,
  CharacterDef,
  DropTableDef,
  EnemyDef,
  FamiliarDef,
  ItemDef,
  ItemKind,
  ItemSetDef,
  PoolId,
  SynergyDef,
} from '../sim/types';

interface DefModule<T> {
  default: readonly T[];
}

/**
 * Builds an id → def map from glob-imported modules (sorted by path, so order is deterministic).
 * Throws on a missing default export or a duplicate id.
 */
export function collectDefs<T extends { id: string }>(
  kind: string,
  modules: Readonly<Record<string, DefModule<T>>>,
): Map<string, T> {
  const map = new Map<string, T>();
  const where = new Map<string, string>();
  for (const file of Object.keys(modules).sort()) {
    const list = modules[file]!.default;
    if (!Array.isArray(list)) throw new Error(`${file}: expected "export default ${kind}Def[]"`);
    for (const def of list as readonly T[]) {
      if (!def || typeof def.id !== 'string' || def.id === '') throw new Error(`${file}: ${kind} without an id`);
      const prev = where.get(def.id);
      if (prev !== undefined) throw new Error(`duplicate ${kind} id "${def.id}" in ${file} (already defined in ${prev})`);
      map.set(def.id, def);
      where.set(def.id, file);
    }
  }
  return map;
}

// Hooks are side-effect modules (they call registerHook); load them before anything uses them.
import.meta.glob('./hooks/*.ts', { eager: true });

export const ITEMS = collectDefs<ItemDef>('item', import.meta.glob<DefModule<ItemDef>>('./items/*.ts', { eager: true }));
export const ENEMIES = collectDefs<EnemyDef>('enemy', import.meta.glob<DefModule<EnemyDef>>('./enemies/*.ts', { eager: true }));
export const BOSSES = collectDefs<BossDef>('boss', import.meta.glob<DefModule<BossDef>>('./bosses/*.ts', { eager: true }));
export const CHARACTERS = collectDefs<CharacterDef>(
  'character',
  import.meta.glob<DefModule<CharacterDef>>('./characters/*.ts', { eager: true }),
);
export const CHAPTERS = collectDefs<ChapterDef>('chapter', import.meta.glob<DefModule<ChapterDef>>('./chapters/*.ts', { eager: true }));
export const SYNERGIES = collectDefs<SynergyDef>(
  'synergy',
  import.meta.glob<DefModule<SynergyDef>>('./synergies/*.ts', { eager: true }),
);
export const SETS = collectDefs<ItemSetDef>('set', import.meta.glob<DefModule<ItemSetDef>>('./sets/*.ts', { eager: true }));
export const ACHIEVEMENTS = collectDefs<AchievementDef>(
  'achievement',
  import.meta.glob<DefModule<AchievementDef>>('./achievements/*.ts', { eager: true }),
);
export const FAMILIARS = collectDefs<FamiliarDef>(
  'familiar',
  import.meta.glob<DefModule<FamiliarDef>>('./familiars/*.ts', { eager: true }),
);
export const DROP_TABLES = collectDefs<DropTableDef>(
  'drop table',
  import.meta.glob<DefModule<DropTableDef>>('./drops/*.ts', { eager: true }),
);
export const CHAMPIONS = collectDefs<ChampionDef>(
  'champion',
  import.meta.glob<DefModule<ChampionDef>>('./champions/*.ts', { eager: true }),
);

// Rooms and music have their own registries, owned by their modules (no Map here):
// - ROOMS: src/content/rooms/*.ts → `ROOM_TEMPLATES` in src/sim/floor/library.ts, checked by
//   `validateTemplates` (duplicate ids, legend, reachability) in tests/floorgen.test.ts.
// - MUSIC: src/content/music/*.ts → src/audio/music/registry.ts (`getTrack`, throws on duplicate ids).
//   It stays out of this file so the sim (which imports the registry) never pulls in audio code.

// ── Lookups ──────────────────────────────────────────────────────────────────

function must<T>(map: Map<string, T>, kind: string, id: string): T {
  const d = map.get(id);
  if (!d) throw new Error(`unknown ${kind} "${id}"`);
  return d;
}

export const getItem = (id: string): ItemDef => must(ITEMS, 'item', id);
export const findItem = (id: string): ItemDef | undefined => ITEMS.get(id);
export const getEnemy = (id: string): EnemyDef => must(ENEMIES, 'enemy', id);
export const findEnemy = (id: string): EnemyDef | undefined => ENEMIES.get(id);
export const getBoss = (id: string): BossDef => must(BOSSES, 'boss', id);
export const getCharacter = (id: string): CharacterDef => must(CHARACTERS, 'character', id);
export const getChapter = (id: string): ChapterDef => must(CHAPTERS, 'chapter', id);
export const getSynergy = (id: string): SynergyDef => must(SYNERGIES, 'synergy', id);
export const getSet = (id: string): ItemSetDef => must(SETS, 'set', id);
export const findSet = (id: string): ItemSetDef | undefined => SETS.get(id);
export const getAchievement = (id: string): AchievementDef => must(ACHIEVEMENTS, 'achievement', id);
export const getFamiliar = (id: string): FamiliarDef => must(FAMILIARS, 'familiar', id);
export const findFamiliar = (id: string): FamiliarDef | undefined => FAMILIARS.get(id);
export const getDropTable = (id: string): DropTableDef => must(DROP_TABLES, 'drop table', id);
export const findDropTable = (id: string): DropTableDef | undefined => DROP_TABLES.get(id);

const ALL_ITEMS: ItemDef[] = [...ITEMS.values()];

/**
 * Runtime registration for tests and tools (game content belongs in src/content/items/*.ts).
 * Throws on a duplicate id, like the file registry.
 */
export function registerItem(def: ItemDef): void {
  if (ITEMS.has(def.id)) throw new Error(`duplicate item id "${def.id}"`);
  ITEMS.set(def.id, def);
  ALL_ITEMS.push(def);
}
/**
 * Runtime registration of an enemy for tests and tools (game content belongs in
 * src/content/enemies/*.ts). Throws on a duplicate id.
 */
export function registerEnemy(def: EnemyDef): void {
  if (ENEMIES.has(def.id)) throw new Error(`duplicate enemy id "${def.id}"`);
  ENEMIES.set(def.id, def);
}

const ALL_CHAMPIONS: readonly ChampionDef[] = [...CHAMPIONS.values()];

/** Champion variants in registry order (champion rolls index into this list). */
export function allChampions(): readonly ChampionDef[] {
  return ALL_CHAMPIONS;
}

/**
 * Enemies that can be rolled in a chapter (weight > 0): the union of the chapter's explicit
 * `enemyPool` and every enemy whose `chapters` lists the chapter, so enemy content can be added
 * without editing chapter files. Registry order (deterministic).
 */
export function enemiesInChapter(chapter: string): EnemyDef[] {
  const ch = CHAPTERS.get(chapter);
  const ids = ch ? ch.enemyPool : [];
  const out: EnemyDef[] = [];
  for (const d of ENEMIES.values()) {
    if (d.weight <= 0) continue;
    if (ids.includes(d.id) || d.chapters.includes(chapter)) out.push(d);
  }
  return out;
}

/**
 * Bosses of a kind that can appear in a chapter: the union of the chapter's explicit `bossPool`
 * (kind 'boss' / 'final') or `minibossPool` (kind 'miniboss') and every boss of that kind whose
 * `chapters` lists the chapter — the same union rule as enemiesInChapter. Registry order.
 */
export function bossesInChapter(chapter: string, kind: BossDef['kind']): BossDef[] {
  const ch = CHAPTERS.get(chapter);
  const ids = ch ? (kind === 'miniboss' ? ch.minibossPool : ch.bossPool) : [];
  const out: BossDef[] = [];
  for (const d of BOSSES.values()) {
    if (d.kind !== kind) continue;
    if (ids.includes(d.id) || d.chapters.includes(chapter)) out.push(d);
  }
  return out;
}

const ALL_SYNERGIES: readonly SynergyDef[] = [...SYNERGIES.values()];
const ALL_SETS: readonly ItemSetDef[] = [...SETS.values()];

export function allItems(): readonly ItemDef[] {
  return ALL_ITEMS;
}

export function allSynergies(): readonly SynergyDef[] {
  return ALL_SYNERGIES;
}

export function allSets(): readonly ItemSetDef[] {
  return ALL_SETS;
}

/** Items carrying a tag (in registry order). */
export function itemsWithTag(tag: string): ItemDef[] {
  return ALL_ITEMS.filter((d) => d.tags.includes(tag));
}

/** Items of a kind that can roll from a pool (in registry order). */
export function itemsInPool(pool: PoolId, kind?: ItemKind): ItemDef[] {
  return ALL_ITEMS.filter((d) => d.pools.includes(pool) && (kind === undefined || d.kind === kind));
}
