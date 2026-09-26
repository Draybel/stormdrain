import { describe, expect, it } from 'vitest';
import { RUN_KEY, RunSaveStore, checkRunSnapshot } from '../src/meta/runSave';
import { encodeEnvelope } from '../src/meta/saveCodec';
import { MemoryStorage } from '../src/meta/storage';

/** Stand-in for the main track's run snapshot. */
function snapshot(room = 0) {
  return {
    seed: 'ABCD-1234',
    character: 'wren',
    floor: 2,
    room,
    player: { x: 104.5, y: 56, red: 6, redMax: 6, tin: 2, items: ['storm_lance', 'orbit'] },
    rng: { loot: [1, 2, 3, 4], combat: [5, 6, 7, 8] },
    map: { visited: [true, false, true], cleared: [0, 2] },
  };
}

describe('RunSaveStore', () => {
  it('save → hasRun → load → clear', () => {
    const storage = new MemoryStorage();
    const runs = new RunSaveStore({ storage });
    expect(runs.hasRun()).toBe(false);
    expect(runs.load()).toMatchObject({ ok: false, reason: 'empty' });

    const r = runs.save(snapshot(3));
    expect(r).toMatchObject({ ok: true });
    expect(storage.get(RUN_KEY)).not.toBeNull();
    expect(runs.hasRun()).toBe(true);

    const loaded = new RunSaveStore({ storage }).load<ReturnType<typeof snapshot>>();
    expect(loaded).toEqual({ ok: true, data: snapshot(3), migratedFrom: 1, restored: false });

    runs.clear();
    expect(runs.hasRun()).toBe(false);
    expect(storage.get(`${RUN_KEY}.bak`)).toBeNull();
    expect(runs.load()).toMatchObject({ ok: false, reason: 'empty' });
  });

  it('uses its own key, separate from meta', () => {
    const storage = new MemoryStorage();
    new RunSaveStore({ storage }).save(snapshot());
    expect([...storage.map.keys()]).toEqual(['stormdrain.run']);
  });

  it.each([
    ['NaN', { hp: Number.NaN }, 'unsafe', '$.hp'],
    ['Infinity', { stats: { range: Infinity } }, 'unsafe', '$.stats.range'],
    ['a Map', { seen: new Map() }, 'unsafe', '$.seen'],
    ['a Set', { items: new Set(['x']) }, 'unsafe', '$.items'],
    ['a function', { onHit: () => 0 }, 'unsafe', '$.onHit'],
    ['a primitive', 42, 'unsafe', '$'],
    ['null', null, 'unsafe', '$'],
  ])('rejects a snapshot containing %s', (_label, value, error, path) => {
    const storage = new MemoryStorage();
    const runs = new RunSaveStore({ storage });
    const r = runs.save(value);
    expect(r).toMatchObject({ ok: false, error, path });
    expect(storage.map.size).toBe(0);
  });

  it('rejects cycles with a readable message', () => {
    const a: Record<string, unknown> = { floor: 1 };
    a.self = a;
    const r = new RunSaveStore({ storage: new MemoryStorage() }).save({ state: a });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe('unsafe');
    expect(r.message).toMatch(/circular reference at \$\.state\.self/);
  });

  it('enforces the size limit', () => {
    const runs = new RunSaveStore({ storage: new MemoryStorage(), maxChars: 1000 });
    expect(runs.save({ pad: 'x'.repeat(500) })).toMatchObject({ ok: true });
    expect(runs.save({ pad: 'x'.repeat(2000) })).toMatchObject({ ok: false, error: 'size' });
    expect(checkRunSnapshot({ pad: 'x'.repeat(2000) }, 1000)).toMatchObject({ error: 'size' });
    expect(checkRunSnapshot(snapshot())).toBeNull();
  });

  it('reports a full storage as a storage error', () => {
    const storage = new MemoryStorage({ quotaChars: 200 });
    const r = new RunSaveStore({ storage }).save(snapshot());
    expect(r).toMatchObject({ ok: false, error: 'storage' });
  });

  it('falls back to the previous room when the latest save is damaged', () => {
    const storage = new MemoryStorage();
    const runs = new RunSaveStore({ storage });
    runs.save(snapshot(1));
    runs.save(snapshot(2));
    storage.set(RUN_KEY, storage.get(RUN_KEY)!.replace('"room":2', '"room":9'));
    expect(runs.hasRun()).toBe(true); // the backup is still readable
    const r = new RunSaveStore({ storage }).load<ReturnType<typeof snapshot>>();
    expect(r).toMatchObject({ ok: true, restored: true });
    if (r.ok) expect(r.data.room).toBe(1);
  });

  it('reports corrupt when nothing is readable', () => {
    const storage = new MemoryStorage();
    storage.set(RUN_KEY, 'garbage');
    const runs = new RunSaveStore({ storage });
    expect(runs.hasRun()).toBe(false);
    expect(runs.load()).toMatchObject({ ok: false, reason: 'corrupt' });
  });

  it('migrates older snapshots with the main track migrations', () => {
    const storage = new MemoryStorage();
    storage.set(RUN_KEY, encodeEnvelope(1, { hearts: 3 }));
    const runs = new RunSaveStore({
      storage,
      version: 2,
      migrations: { 1: ({ hearts, ...rest }: { hearts: number }) => ({ ...rest, red: hearts * 2 }) },
    });
    expect(runs.load()).toEqual({ ok: true, data: { red: 6 }, migratedFrom: 1, restored: false });
  });

  it('treats a snapshot it cannot migrate as corrupt', () => {
    const storage = new MemoryStorage();
    storage.set(RUN_KEY, encodeEnvelope(1, { hearts: 3 }));
    const runs = new RunSaveStore({ storage, version: 2 }); // bumped without a migration
    expect(runs.load()).toMatchObject({ ok: false, reason: 'corrupt' });
  });

  it('leaves a run saved by a newer build alone', () => {
    const storage = new MemoryStorage();
    const newer = encodeEnvelope(5, { future: true });
    storage.set(RUN_KEY, newer);
    const runs = new RunSaveStore({ storage });
    expect(runs.load()).toMatchObject({ ok: false, reason: 'future' });
    expect(runs.save(snapshot())).toMatchObject({ ok: false, error: 'readonly' });
    expect(storage.get(RUN_KEY)).toBe(newer);
  });

  it('peek() and restore() carry a run through export/import', () => {
    const a = new RunSaveStore({ storage: new MemoryStorage() });
    expect(a.peek()).toBeNull();
    a.save(snapshot(4));
    const payload = a.peek();
    expect(payload).toEqual({ v: 1, data: snapshot(4) });

    const b = new RunSaveStore({ storage: new MemoryStorage() });
    expect(b.restore(payload!)).toMatchObject({ ok: true });
    expect(b.load()).toMatchObject({ ok: true, data: snapshot(4) });
    expect(b.restore({ v: 99, data: {} })).toMatchObject({ ok: false });
  });
});
