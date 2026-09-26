import { describe, expect, it } from 'vitest';
import { META_MIGRATIONS, migrate, oldestSupported, type MigrationSet } from '../src/meta/migrations';
import { encodeEnvelope } from '../src/meta/saveCodec';
import {
  MemoryStorage,
  SaveSlot,
  WebStorage,
  createStorage,
  requestPersistentStorage,
  type StorageLike,
} from '../src/meta/storage';

/** A three-step chain used to test the loader generically. */
const CHAIN: MigrationSet = {
  name: 'test',
  current: 3,
  steps: {
    // v0 stored a bare number of coins
    0: (old: number) => ({ coins: old }),
    // v1 → v2: rename coins → wallet.copper, keep everything else
    1: ({ coins, ...rest }: { coins: number }) => ({ ...rest, wallet: { copper: coins } }),
    // v2 → v3: add a list (keeps unknown fields)
    2: (old: Record<string, unknown>) => ({ ...old, badges: [] }),
  },
};

describe('migrate()', () => {
  it('upgrades step by step from every older version', () => {
    expect(migrate(CHAIN, 0, 7)).toEqual({ ok: true, data: { wallet: { copper: 7 }, badges: [] }, from: 0, to: 3 });
    expect(migrate(CHAIN, 1, { coins: 2 })).toMatchObject({ ok: true, data: { wallet: { copper: 2 }, badges: [] } });
    expect(migrate(CHAIN, 3, { wallet: { copper: 1 }, badges: ['x'] })).toMatchObject({
      ok: true,
      data: { wallet: { copper: 1 }, badges: ['x'] },
      from: 3,
    });
  });

  it('keeps unknown fields through the chain', () => {
    const r = migrate(CHAIN, 1, { coins: 5, futureThing: { deep: [1, 2] }, note: 'hi' });
    expect(r).toMatchObject({ ok: true, data: { futureThing: { deep: [1, 2] }, note: 'hi', wallet: { copper: 5 } } });
  });

  it('reports future, missing, failing and invalid versions', () => {
    expect(migrate(CHAIN, 4, {})).toMatchObject({ ok: false, error: 'future' });
    expect(migrate({ name: 'gap', current: 2, steps: { 0: (x: unknown) => x } }, 0, {})).toMatchObject({
      ok: false,
      error: 'missing',
    });
    const boom: MigrationSet = {
      name: 'boom',
      current: 1,
      steps: {
        0: () => {
          throw new Error('nope');
        },
      },
    };
    expect(migrate(boom, 0, {})).toMatchObject({ ok: false, error: 'failed' });
    expect(migrate(CHAIN, -1, {})).toMatchObject({ ok: false, error: 'version' });
    expect(migrate(CHAIN, 1.5, {})).toMatchObject({ ok: false, error: 'version' });
  });

  it('the meta chain is complete from v0', () => {
    expect(oldestSupported(META_MIGRATIONS)).toBe(0);
    expect(oldestSupported(CHAIN)).toBe(0);
  });
});

describe('storage backends', () => {
  it('WebStorage turns exceptions into false/null', () => {
    const quota: StorageLike = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem: () => {
        throw new Error('nope');
      },
    };
    const s = new WebStorage(quota);
    expect(s.set('k', 'v')).toBe(false);
    expect(s.lastError).toContain('QuotaExceededError');
    expect(s.get('k')).toBeNull();
    expect(() => s.remove('k')).not.toThrow();
  });

  it('createStorage falls back to memory when localStorage is unusable', () => {
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const fallback = createStorage(blocked);
    expect(fallback.kind).toBe('memory');
    expect(fallback.persistent).toBe(false);
    expect(createStorage(null).kind).toBe('memory');
    // In node there is no window: the default probe also falls back.
    expect(createStorage().kind).toBe('memory');

    const map = new Map<string, string>();
    const working: StorageLike = {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => void map.set(k, v),
      removeItem: (k) => void map.delete(k),
    };
    const s = createStorage(working);
    expect(s.kind).toBe('local');
    expect(s.persistent).toBe(true);
    expect(map.size).toBe(0); // the probe cleaned up after itself
    expect(s.set('a', '1')).toBe(true);
    expect(s.get('a')).toBe('1');
  });

  it('requestPersistentStorage resolves false where unsupported (node)', async () => {
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('MemoryStorage enforces its quota', () => {
    const s = new MemoryStorage({ quotaChars: 10 });
    expect(s.set('a', '12345')).toBe(true);
    expect(s.set('b', '123456')).toBe(false);
    expect(s.set('a', '123456789')).toBe(true); // replacing a key frees its old size
    expect(s.lastError).toBeNull();
  });
});

describe('SaveSlot', () => {
  const KEY = 'stormdrain.test';

  it('writes and loads the current version', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    expect(slot.load()).toMatchObject({ status: 'empty', data: null });
    expect(slot.write({ wallet: { copper: 3 }, badges: [] })).toMatchObject({ ok: true, skipped: false });
    const again = new SaveSlot(storage, KEY, CHAIN).load();
    expect(again).toMatchObject({ status: 'ok', data: { wallet: { copper: 3 } }, migratedFrom: 3 });
  });

  it('skips a write when nothing changed', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ a: 1 });
    const writes = storage.writes;
    expect(slot.write({ a: 1 })).toMatchObject({ ok: true, skipped: true });
    expect(storage.writes).toBe(writes);
  });

  it('migrates an old save on load', () => {
    const storage = new MemoryStorage();
    storage.set(KEY, encodeEnvelope(0, 42));
    const r = new SaveSlot(storage, KEY, CHAIN).load();
    expect(r).toMatchObject({ status: 'ok', migratedFrom: 0, data: { wallet: { copper: 42 }, badges: [] } });
  });

  it('keeps the previous good save as .bak', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ n: 1 });
    expect(storage.get(`${KEY}.bak`)).toBeNull();
    slot.write({ n: 2 });
    slot.write({ n: 3 });
    const bak = new SaveSlot(storage, `${KEY}.bak`, CHAIN).load();
    expect(bak).toMatchObject({ status: 'ok', data: { n: 2 } });
  });

  it('backs up an existing save even when written without a load()', () => {
    const storage = new MemoryStorage();
    new SaveSlot(storage, KEY, CHAIN).write({ n: 1 });
    new SaveSlot(storage, KEY, CHAIN).write({ n: 2 }); // fresh instance, no load()
    expect(new SaveSlot(storage, `${KEY}.bak`, CHAIN).load()).toMatchObject({ status: 'ok', data: { n: 1 } });
  });

  it('refuses to overwrite a newer save even when written without a load()', () => {
    const storage = new MemoryStorage();
    const newer = encodeEnvelope(9, { fromTheFuture: true });
    storage.set(KEY, newer);
    expect(new SaveSlot(storage, KEY, CHAIN).write({ n: 1 })).toMatchObject({ ok: false, error: 'readonly' });
    expect(storage.get(KEY)).toBe(newer);
  });

  it('falls back to the backup when the primary is corrupt, and repairs it', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    const good = storage.get(KEY)!;
    const damaged = good.replace('"n":2', '"n":7');
    storage.set(KEY, damaged);

    const fresh = new SaveSlot(storage, KEY, CHAIN);
    const r = fresh.load();
    expect(r.status).toBe('restored');
    expect(r.data).toEqual({ n: 1 });
    expect(r.error).toMatch(/checksum/);
    expect(storage.get(`${KEY}.corrupt`)).toBe(damaged); // kept for manual recovery
    expect(new SaveSlot(storage, KEY, CHAIN).load()).toMatchObject({ status: 'ok', data: { n: 1 } });

    // The next write keeps the restored save as the backup.
    fresh.write({ n: 3 });
    expect(new SaveSlot(storage, `${KEY}.bak`, CHAIN).load()).toMatchObject({ data: { n: 1 } });
  });

  it.each([
    ['garbage', 'not json at all'],
    ['truncated', null],
    ['foreign JSON', '{"hello":"world"}'],
  ])('recovers from a %s primary', (_label, text) => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    storage.set(KEY, text ?? storage.get(KEY)!.slice(0, 20));
    expect(new SaveSlot(storage, KEY, CHAIN).load()).toMatchObject({ status: 'restored', data: { n: 1 } });
  });

  it('restores from the backup when the primary is missing', () => {
    const storage = new MemoryStorage();
    storage.set(`${KEY}.bak`, encodeEnvelope(3, { n: 9 }));
    expect(new SaveSlot(storage, KEY, CHAIN).load()).toMatchObject({ status: 'restored', data: { n: 9 } });
  });

  it('reports corrupt when primary and backup are both unusable', () => {
    const storage = new MemoryStorage();
    storage.set(KEY, '{"v":1,"sum":"bad","data":{}}');
    storage.set(`${KEY}.bak`, 'garbage');
    expect(new SaveSlot(storage, KEY, CHAIN).load()).toMatchObject({ status: 'corrupt', data: null });
  });

  it('never overwrites a save from a newer build', () => {
    const storage = new MemoryStorage();
    const newer = encodeEnvelope(9, { fromTheFuture: true });
    storage.set(KEY, newer);
    const slot = new SaveSlot(storage, KEY, CHAIN);
    expect(slot.load()).toMatchObject({ status: 'future', data: null });
    expect(slot.readOnly).toBe(true);
    expect(slot.write({ n: 1 })).toMatchObject({ ok: false, error: 'readonly' });
    expect(storage.get(KEY)).toBe(newer);
  });

  it('drops the backup and retries when storage is full', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ pad: 'x'.repeat(100) });
    slot.write({ pad: 'y'.repeat(100) });
    expect(storage.get(`${KEY}.bak`)).not.toBeNull();
    // Now only room for about one save.
    const tight = new MemoryStorage({ quotaChars: 400 });
    for (const [k, v] of storage.map) tight.map.set(k, v);
    const s2 = new SaveSlot(tight, KEY, CHAIN);
    s2.load();
    const r = s2.write({ pad: 'z'.repeat(200) });
    expect(r).toMatchObject({ ok: true });
    expect(new SaveSlot(tight, KEY, CHAIN).load()).toMatchObject({ status: 'ok', data: { pad: 'z'.repeat(200) } });
  });

  it('reports a storage failure without throwing', () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;
    const slot = new SaveSlot(storage, KEY, CHAIN);
    expect(slot.write({ n: 1 })).toMatchObject({ ok: false, error: 'storage' });
  });

  it('clear() removes the save and the backup', () => {
    const storage = new MemoryStorage();
    const slot = new SaveSlot(storage, KEY, CHAIN);
    slot.write({ n: 1 });
    slot.write({ n: 2 });
    expect(slot.exists()).toBe(true);
    slot.clear();
    expect(slot.exists()).toBe(false);
    expect(slot.load().status).toBe('empty');
  });
});
