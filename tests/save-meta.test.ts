import { describe, expect, it } from 'vitest';
import {
  COUNTER_IDS,
  DAILY_KEEP,
  META_KEY,
  MetaStore,
  STAT_KEYS,
  UNLOCK_KINDS,
  cloneMeta,
  defaultMeta,
  fromRuntimeSettings,
  normalizeMeta,
  serializeMeta,
  toRuntimeSettings,
  utcDateKey,
  type MetaChange,
} from '../src/meta/metaState';
import { META_VERSION } from '../src/meta/migrations';
import { decodeEnvelope, encodeEnvelope } from '../src/meta/saveCodec';
import { MemoryStorage } from '../src/meta/storage';

function clock(start = 1_700_000_000_000) {
  const c = { t: start, now: () => c.t };
  return c;
}

function stored(storage: MemoryStorage, key = META_KEY): Record<string, unknown> {
  const r = decodeEnvelope<Record<string, unknown>>(storage.get(key));
  if (!r.ok) throw new Error(`no valid save: ${r.message}`);
  return r.data;
}

describe('MetaState schema', () => {
  it('defaults are complete and self-consistent', () => {
    const m = defaultMeta();
    for (const k of UNLOCK_KINDS) expect(m.unlocks[k]).toBeInstanceOf(Set);
    expect(m.unlocks.characters.has('wren')).toBe(true);
    for (const k of STAT_KEYS) expect(m.stats[k]).toBe(0);
    for (const c of COUNTER_IDS) expect(m.stats.counters[c]).toBe(0);
    expect(m.settings).toEqual({
      masterVol: 0.8,
      musicVol: 0.7,
      sfxVol: 0.9,
      aim360: false,
      screenShake: 1,
      buttonScale: 1,
      showFps: false,
      leftHanded: false,
      reduceFlashing: false,
    });
  });

  it('normalizeMeta never throws and repairs junk', () => {
    for (const junk of [null, undefined, 42, 'x', [], { settings: 'loud', unlocks: [1], stats: { kills: 'many' } }]) {
      const m = normalizeMeta(junk);
      expect(m.settings.masterVol).toBe(0.8);
      expect(m.stats.kills).toBe(0);
      expect(m.unlocks.items.size).toBe(0);
    }
    const m = normalizeMeta({
      settings: { masterVol: 5, musicVol: -1, sfxVol: Number.NaN, buttonScale: 9, aim360: 'yes' },
      unlocks: { items: ['lance', 7, '', 'lance', 'orbit'] },
      achievements: { first: 123, old: true, bad: 'no', neg: -5 },
      collection: { lance: { seen: 1, collected: 3 }, junk: 5 },
      bestiary: { slug: { seen: 2.7, killed: -1 } },
      stats: { kills: 12.9, runs: -3, playTimeSec: 12.5, winStreak: 4, bestWinStreak: 1 },
    });
    expect(m.settings).toMatchObject({ masterVol: 1, musicVol: 0, sfxVol: 0.9, buttonScale: 2, aim360: false });
    expect([...m.unlocks.items].sort()).toEqual(['lance', 'orbit']);
    expect(m.achievements).toEqual({ first: 123, old: 0 });
    expect(m.collection.lance).toEqual({ seen: 3, collected: 3 });
    expect(m.collection.junk).toBeUndefined();
    expect(m.bestiary.slug).toEqual({ seen: 2, killed: 0 });
    expect(m.stats).toMatchObject({ kills: 12, runs: 0, playTimeSec: 12.5, winStreak: 4, bestWinStreak: 4 });
  });

  it('serialize → normalize round-trips, with sets stored as sorted arrays', () => {
    const m = defaultMeta();
    m.unlocks.items.add('zeta').add('alpha');
    m.achievements.first = 5;
    m.collection.alpha = { seen: 2, collected: 1 };
    m.stats.daily['2026-09-26'] = {
      seed: 'ABCD',
      character: 'wren',
      won: true,
      floor: 12,
      kills: 300,
      timeSec: 1800,
      score: 9001,
      at: 1,
    };
    const data = serializeMeta(m);
    expect(data.unlocks.items).toEqual(['alpha', 'zeta']);
    const back = normalizeMeta(JSON.parse(JSON.stringify(data)));
    expect(serializeMeta(back)).toEqual(JSON.parse(JSON.stringify(data)));
    expect(cloneMeta(m).unlocks.items.has('zeta')).toBe(true);
  });

  it('ids that look like prototype keys are plain data', () => {
    const m = normalizeMeta(
      JSON.parse(
        '{"unlocks":{"__proto__":["x"],"items":["constructor"]},"achievements":{"__proto__":1,"toString":2},' +
          '"collection":{"__proto__":{"seen":1,"collected":0}},"stats":{"__proto__":{"polluted":true},"counters":{"__proto__":3}}}',
      ),
    );
    expect(m.unlocks.items.has('constructor')).toBe(true);
    expect(m.achievements.toString).toBe(2);
    expect(Object.keys(m.achievements)).toContain('__proto__');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(() => JSON.stringify(serializeMeta(m))).not.toThrow();
  });

  it('settings adapters map to the Phase-1 runtime Settings shape', () => {
    const m = defaultMeta();
    m.settings.screenShake = 0.5;
    m.settings.masterVol = 0.3;
    expect(toRuntimeSettings(m.settings)).toEqual({
      aim360: false,
      buttonScale: 1,
      shake: 0.5,
      masterVolume: 0.3,
      musicVolume: 0.7,
      sfxVolume: 0.9,
      leftHanded: false,
      showFps: false,
      reduceFlashing: false,
    });
    expect(fromRuntimeSettings({ shake: 0, aim360: true })).toEqual({ screenShake: 0, aim360: true });
    // Phase 4B: the left-handed layout and the FPS readout persist too.
    expect(fromRuntimeSettings({ leftHanded: true, showFps: true })).toEqual({ leftHanded: true, showFps: true });
    // Polish batch 2: REDUCE FLASHING persists; a save from before it (no field) loads with it off.
    expect(fromRuntimeSettings({ reduceFlashing: true })).toEqual({ reduceFlashing: true });
    expect(normalizeMeta({ settings: { masterVol: 0.5 } }).settings.reduceFlashing).toBe(false);
    expect(normalizeMeta({ settings: { reduceFlashing: true } }).settings.reduceFlashing).toBe(true);
    expect(normalizeMeta({ settings: { reduceFlashing: 'yes' } }).settings.reduceFlashing).toBe(false);
  });

  it('utcDateKey uses the UTC calendar date', () => {
    expect(utcDateKey(Date.UTC(2026, 8, 26, 23, 59))).toBe('2026-09-26');
    expect(utcDateKey(Date.UTC(2026, 8, 27, 0, 1))).toBe('2026-09-27');
  });
});

describe('migration fixtures', () => {
  /** v0: the Phase-1 prototype layout (flat settings + flat lists). */
  const V0 = {
    masterVolume: 0.5,
    musicVolume: 0.25,
    sfxVolume: 1,
    aim360: true,
    shake: 0.5,
    buttonScale: 1.25,
    unlockedCharacters: ['wren', 'pip'],
    unlockedItems: ['storm_lance'],
    achievements: ['first_blood', 'drain_diver'],
    stats: { runs: 3, deaths: 2, kills: 40 },
    cloudSyncToken: 'keep-me', // unknown field
  };

  it('upgrades a v0 save to v1 and keeps unknown fields', () => {
    const storage = new MemoryStorage();
    storage.set(META_KEY, encodeEnvelope(0, V0));
    const store = new MetaStore({ storage });
    expect(store.loaded).toMatchObject({ status: 'ok', migratedFrom: 0 });
    const m = store.state;
    expect(m.settings).toMatchObject({ masterVol: 0.5, musicVol: 0.25, sfxVol: 1, aim360: true, screenShake: 0.5, buttonScale: 1.25 });
    expect([...m.unlocks.characters].sort()).toEqual(['pip', 'wren']);
    expect(m.unlocks.items.has('storm_lance')).toBe(true);
    expect(m.achievements).toEqual({ first_blood: 0, drain_diver: 0 });
    expect(m.stats).toMatchObject({ runs: 3, deaths: 2, kills: 40 });
    expect(m.extra.cloudSyncToken).toBe('keep-me');

    // Saving writes v1 and still carries the unknown field.
    store.markDirty(true);
    expect(store.flush()).toBe(true);
    const env = JSON.parse(storage.get(META_KEY)!) as { v: number };
    expect(env.v).toBe(META_VERSION);
    expect(stored(storage).cloudSyncToken).toBe('keep-me');
    // The pre-migration save is kept as the backup.
    expect((JSON.parse(storage.get(`${META_KEY}.bak`)!) as { v: number }).v).toBe(0);
  });

  it('keeps unknown fields of a v1 save written by a newer/parallel build', () => {
    const v1 = {
      settings: { masterVol: 0.6, hapticStrength: 0.4 },
      unlocks: { characters: ['wren'], costumes: ['frog_hat'] },
      achievements: {},
      collection: { lance: { seen: 1, collected: 1, firstFloor: 3 } },
      bestiary: {},
      stats: { runs: 1, fastestWinSec: 1234, counters: { lanternsLit: 4 } },
      seasonPass: { tier: 2 },
    };
    const storage = new MemoryStorage();
    storage.set(META_KEY, encodeEnvelope(1, v1));
    const store = new MetaStore({ storage });
    store.updateSettings({ musicVol: 0.1 });
    store.unlock('items', 'orbit');
    store.endTick();
    const out = stored(storage) as {
      settings: Record<string, unknown>;
      unlocks: Record<string, string[]>;
      collection: Record<string, Record<string, unknown>>;
      stats: Record<string, unknown> & { counters: Record<string, number> };
      seasonPass: unknown;
    };
    expect(out.settings).toMatchObject({ masterVol: 0.6, musicVol: 0.1, hapticStrength: 0.4 });
    expect(out.unlocks.costumes).toEqual(['frog_hat']);
    expect(out.unlocks.items).toEqual(['orbit']);
    expect(out.collection.lance).toEqual({ seen: 1, collected: 1, firstFloor: 3 });
    expect(out.stats.fastestWinSec).toBe(1234);
    expect(out.stats.counters.lanternsLit).toBe(4);
    expect(out.seasonPass).toEqual({ tier: 2 });
  });
});

describe('MetaStore saving', () => {
  it('starts from defaults on an empty storage', () => {
    const storage = new MemoryStorage();
    const store = new MetaStore({ storage });
    expect(store.loaded.status).toBe('empty');
    expect(store.state.unlocks.characters.has('wren')).toBe(true);
    expect(storage.writes).toBe(0); // nothing written until something changes
    store.endTick();
    expect(storage.writes).toBe(0);
  });

  it('debounces urgent changes to one write at the end of the tick', () => {
    const storage = new MemoryStorage();
    const c = clock();
    const store = new MetaStore({ storage, now: c.now });
    store.unlock('characters', 'pip');
    store.unlockAchievement('first_blood');
    store.updateSettings({ aim360: true });
    expect(store.saves).toBe(0);
    expect(store.dirty).toBe(true);
    store.endTick();
    expect(store.saves).toBe(1);
    expect(store.dirty).toBe(false);
    store.endTick();
    expect(store.saves).toBe(1);
    const reloaded = new MetaStore({ storage });
    expect(reloaded.isUnlocked('characters', 'pip')).toBe(true);
    expect(reloaded.state.achievements.first_blood).toBe(c.t);
    expect(reloaded.settings.aim360).toBe(true);
  });

  it('throttles soft changes to softSaveMs, and flush() writes immediately', () => {
    const storage = new MemoryStorage();
    const c = clock();
    const store = new MetaStore({ storage, now: c.now, softSaveMs: 5000 });
    store.killEnemy('slug');
    store.endTick(); // first soft change after idle: written right away
    expect(store.saves).toBe(1);

    for (let i = 0; i < 50; i++) {
      c.t += 16;
      store.killEnemy('slug');
      store.addPlayTime(1 / 60);
      store.endTick();
    }
    expect(store.saves).toBe(1); // 0.8 s of kills: nothing new written yet
    c.t += 5000;
    store.endTick();
    expect(store.saves).toBe(2);

    store.bump('bombsUsed');
    store.endTick();
    expect(store.saves).toBe(2);
    expect(store.flush()).toBe(true); // room transition / pause / background
    expect(store.saves).toBe(3);
    expect(store.flush()).toBe(true); // nothing pending: no write
    expect(store.saves).toBe(3);

    const reloaded = new MetaStore({ storage });
    expect(reloaded.state.bestiary.slug).toEqual({ seen: 51, killed: 51 });
    expect(reloaded.state.stats.kills).toBe(51);
    expect(reloaded.counter('bombsUsed')).toBe(1);
  });

  it('an urgent change during the soft window is saved at the end of its tick', () => {
    const storage = new MemoryStorage();
    const c = clock();
    const store = new MetaStore({ storage, now: c.now });
    store.killEnemy('slug');
    store.endTick();
    c.t += 100;
    store.killEnemy('slug');
    store.endTick();
    expect(store.saves).toBe(1);
    store.unlockAchievement('slug_slayer');
    store.endTick();
    expect(store.saves).toBe(2);
  });

  it('retries a failed write after retryMs without spamming storage', () => {
    const storage = new MemoryStorage();
    const c = clock();
    const store = new MetaStore({ storage, now: c.now, retryMs: 1000 });
    storage.failWrites = true;
    store.unlock('items', 'lance');
    store.endTick();
    expect(store.lastError).toBe('storage disabled');
    expect(store.dirty).toBe(true);
    storage.failWrites = false;
    c.t += 500;
    store.endTick();
    expect(store.saves).toBe(0);
    c.t += 600;
    store.endTick();
    expect(store.saves).toBe(1);
    expect(store.lastError).toBeNull();
  });

  it('does not overwrite a save from a newer build', () => {
    const storage = new MemoryStorage();
    const newer = encodeEnvelope(META_VERSION + 1, { whatever: true });
    storage.set(META_KEY, newer);
    const store = new MetaStore({ storage });
    expect(store.loaded.status).toBe('future');
    expect(store.persistent).toBe(false);
    store.unlock('items', 'lance');
    store.endTick();
    expect(store.flush()).toBe(false);
    expect(storage.get(META_KEY)).toBe(newer);
  });

  it('restores from the backup when the main meta save is damaged', () => {
    const storage = new MemoryStorage();
    const c = clock();
    const store = new MetaStore({ storage, now: c.now });
    store.unlock('items', 'a');
    store.endTick();
    store.unlock('items', 'b');
    store.endTick();
    storage.set(META_KEY, storage.get(META_KEY)!.slice(0, 30));
    const reloaded = new MetaStore({ storage });
    expect(reloaded.loaded.status).toBe('restored');
    expect(reloaded.isUnlocked('items', 'a')).toBe(true);
    expect(reloaded.isUnlocked('items', 'b')).toBe(false); // one step behind, but safe
  });
});

describe('MetaStore mutators & notifications', () => {
  it('notifies subscribers once per tick with a change summary', () => {
    const store = new MetaStore({ storage: new MemoryStorage(), now: () => 1 });
    const seen: MetaChange[] = [];
    const off = store.subscribe((_s, ch) => seen.push({ ...ch, unlocked: [...ch.unlocked], achievements: [...ch.achievements] }));
    store.unlock('characters', 'pip');
    store.unlock('characters', 'pip'); // no-op
    store.unlockAchievement('a1');
    store.updateSettings({ sfxVol: 0.2 });
    store.updateSettings({ sfxVol: 0.2 }); // unchanged
    store.endTick();
    store.endTick(); // nothing new
    store.killEnemy('slug');
    store.endTick();
    off();
    store.unlock('items', 'x');
    store.endTick();
    expect(seen).toEqual([
      { settings: true, unlocked: ['characters:pip'], achievements: ['a1'], other: false },
      { settings: false, unlocked: [], achievements: [], other: true },
    ]);
  });

  it('returns whether unlocks/achievements are new', () => {
    const store = new MetaStore({ storage: new MemoryStorage(), now: () => 77 });
    expect(store.unlock('routes', 'alt_ch2')).toBe(true);
    expect(store.unlock('routes', 'alt_ch2')).toBe(false);
    expect(store.unlock('routes', '')).toBe(false);
    expect(store.unlockAchievement('x')).toBe(true);
    expect(store.unlockAchievement('x')).toBe(false);
    expect(store.hasAchievement('x')).toBe(true);
    expect(store.state.achievements.x).toBe(77);
  });

  it('tracks collection, bestiary, stats and counters', () => {
    const store = new MetaStore({ storage: new MemoryStorage() });
    store.seeItem('lance');
    store.seeItem('lance');
    store.collectItem('lance');
    store.collectItem('orbit'); // collected without a recorded sighting
    expect(store.state.collection.lance).toEqual({ seen: 2, collected: 1 });
    expect(store.state.collection.orbit).toEqual({ seen: 1, collected: 1 });
    expect(store.isDiscovered('orbit')).toBe(true);
    expect(store.isDiscovered('nope')).toBe(false);
    expect(store.state.stats.itemsCollected).toBe(2);

    store.seeEnemy('slug');
    store.killEnemy('slug');
    store.killEnemy('thunderhead', true);
    expect(store.state.bestiary.thunderhead).toEqual({ seen: 1, killed: 1 });
    expect(store.state.stats).toMatchObject({ kills: 2, bossKills: 1 });

    store.addStat('floorsCleared', 3);
    store.maxStat('bestFloor', 4);
    store.maxStat('bestFloor', 2);
    store.bump('activesUsed', 2);
    store.bump('customCounter');
    store.maxCounter('maxCoinsHeld', 60);
    store.maxCounter('maxCoinsHeld', 10);
    store.addPlayTime(1.5);
    store.addPlayTime(Number.NaN);
    store.addPlayTime(-4);
    expect(store.state.stats).toMatchObject({ floorsCleared: 3, bestFloor: 4, playTimeSec: 1.5 });
    expect(store.counter('activesUsed')).toBe(2);
    expect(store.counter('customCounter')).toBe(1);
    expect(store.counter('maxCoinsHeld')).toBe(60);
    expect(store.counter('neverTouched')).toBe(0);
  });

  it('records runs, streaks and per-character wins', () => {
    const store = new MetaStore({ storage: new MemoryStorage() });
    store.recordRunStart('wren');
    store.recordRunEnd({ character: 'wren', outcome: 'win', floor: 12 });
    store.recordRunStart('wren');
    store.recordRunEnd({ character: 'wren', outcome: 'win', floor: 12 });
    store.recordRunStart('pip');
    store.recordRunEnd({ character: 'pip', outcome: 'death', floor: 5 });
    store.recordRunStart('pip');
    store.recordRunEnd({ character: 'pip', outcome: 'quit', floor: 1 });
    const s = store.state.stats;
    expect(s).toMatchObject({ runs: 4, wins: 2, deaths: 1, winStreak: 0, bestWinStreak: 2, bestFloor: 12 });
    expect(s.charWins).toEqual({ wren: 2 });
    expect(s.charRuns).toEqual({ wren: 2, pip: 2 });
  });

  it('allows one daily result per UTC date and prunes old ones', () => {
    const store = new MetaStore({ storage: new MemoryStorage(), now: () => 123 });
    const result = { seed: 'D-2026-09-26', character: 'wren', won: false, floor: 4, kills: 50, timeSec: 600, score: 1200 };
    expect(store.recordDaily('2026-09-26', result)).toBe(true);
    expect(store.recordDaily('2026-09-26', { ...result, won: true })).toBe(false);
    expect(store.state.stats.daily['2026-09-26']).toMatchObject({ won: false, at: 123 });
    expect(store.recordDaily('26-09-2026', result)).toBe(false);

    const base = Date.UTC(2020, 0, 1);
    for (let i = 0; i < DAILY_KEEP + 10; i++) store.recordDaily(utcDateKey(base + i * 86_400_000), result);
    const dates = Object.keys(store.state.stats.daily).sort();
    expect(dates.length).toBe(DAILY_KEEP);
    expect(dates[dates.length - 1]).toBe('2026-09-26');
  });

  it('resetProgress keeps settings; replaceState swaps everything', () => {
    const storage = new MemoryStorage();
    const store = new MetaStore({ storage });
    store.updateSettings({ leftHanded: true, buttonScale: 1.5 });
    store.unlock('items', 'lance');
    store.recordRunStart('wren');
    store.resetProgress();
    expect(store.settings).toMatchObject({ leftHanded: true, buttonScale: 1.5 });
    expect(store.isUnlocked('items', 'lance')).toBe(false);
    expect(store.state.stats.runs).toBe(0);

    const other = defaultMeta();
    other.unlocks.endings.add('clear_skies');
    store.replaceState(other);
    expect(store.flush()).toBe(true);
    expect(new MetaStore({ storage }).isUnlocked('endings', 'clear_skies')).toBe(true);
  });

  it('updateSettings clamps and ignores undefined values', () => {
    const store = new MetaStore({ storage: new MemoryStorage() });
    expect(store.updateSettings({ masterVol: 3 })).toBe(true);
    expect(store.settings.masterVol).toBe(1);
    expect(store.updateSettings({ masterVol: undefined, musicVol: undefined })).toBe(false);
    expect(store.settings.musicVol).toBe(0.7);
  });
});
