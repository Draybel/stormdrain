import { describe, expect, it } from 'vitest';
import {
  EXPORT_PREFIX,
  IMPORT_MESSAGES,
  exportCode,
  importCode,
  summarizeMeta,
  type ImportErrorCode,
} from '../src/meta/exportCode';
import { MetaStore, defaultMeta, serializeMeta, type MetaState } from '../src/meta/metaState';
import { RUN_MIGRATIONS, type MigrationSet } from '../src/meta/migrations';
import { RunSaveStore } from '../src/meta/runSave';
import { bytesToBase64Url, encodeEnvelope, utf8Encode } from '../src/meta/saveCodec';
import { MemoryStorage } from '../src/meta/storage';

function richMeta(): MetaState {
  const m = defaultMeta();
  m.settings.aim360 = true;
  m.settings.leftHanded = true;
  m.unlocks.characters.add('pip');
  m.unlocks.items.add('storm_lance').add('orbit_blades');
  m.unlocks.endings.add('clear_skies');
  m.achievements.first_blood = 1_700_000_000_000;
  m.collection.storm_lance = { seen: 3, collected: 2 };
  m.bestiary.gutter_slug = { seen: 40, killed: 38 };
  m.stats.runs = 12;
  m.stats.wins = 2;
  m.stats.playTimeSec = 7200.5;
  m.stats.counters.bombsUsed = 30;
  m.stats.charWins.wren = 2;
  m.stats.daily['2026-09-26'] = { seed: 'X', character: 'wren', won: true, floor: 12, kills: 99, timeSec: 1500, score: 5000, at: 9 };
  m.extra.fromAParallelBuild = { keep: true };
  return m;
}

/** Build an SD1 code around an arbitrary body (for crafted fixtures). */
function craft(body: unknown, format = 1): string {
  return EXPORT_PREFIX + bytesToBase64Url(utf8Encode(encodeEnvelope(format, body)));
}

function expectError(code: string, error: ImportErrorCode): void {
  const r = importCode(code);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error).toBe(error);
  expect(r.message).toBe(IMPORT_MESSAGES[error]);
}

describe('export codes', () => {
  it('look like SD1: + url-safe base64', () => {
    const code = exportCode(richMeta(), { now: 5 });
    expect(code.startsWith('SD1:')).toBe(true);
    expect(code.slice(4)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('round-trip meta exactly (including unknown fields)', () => {
    const m = richMeta();
    const r = importCode(exportCode(m, { now: 1234 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(serializeMeta(r.meta)).toEqual(JSON.parse(JSON.stringify(serializeMeta(m))));
    expect(r.meta.unlocks.items).toEqual(new Set(['storm_lance', 'orbit_blades']));
    expect(r.metaVersion).toBe(1);
    expect(r.exportedAt).toBe(1234);
    expect(r.run).toBeNull();
    expect(r.warnings).toEqual([]);
  });

  it('carry the run in progress', () => {
    const runs = new RunSaveStore({ storage: new MemoryStorage() });
    runs.save({ floor: 3, room: 7, items: ['orbit_blades'] });
    const code = exportCode(richMeta(), { run: runs.peek() });
    const r = importCode(code, { runMigrations: RUN_MIGRATIONS });
    expect(r).toMatchObject({ ok: true, run: { v: 1, data: { floor: 3, room: 7, items: ['orbit_blades'] } } });

    // Applying the import on another device.
    if (!r.ok) return;
    const storage = new MemoryStorage();
    const meta = new MetaStore({ storage });
    meta.replaceState(r.meta);
    expect(meta.flush()).toBe(true);
    const runs2 = new RunSaveStore({ storage });
    expect(runs2.restore(r.run!)).toMatchObject({ ok: true });
    expect(new MetaStore({ storage }).isUnlocked('endings', 'clear_skies')).toBe(true);
    expect(runs2.hasRun()).toBe(true);
  });

  it('tolerate whitespace, line breaks and a lowercase prefix', () => {
    const code = exportCode(richMeta());
    const wrapped = `  ${code.slice(0, 20)}\n${code.slice(20, 60)}\r\n ${code.slice(60)}  \n`;
    expect(importCode(wrapped).ok).toBe(true);
    expect(importCode(`sd1:${code.slice(4)}`).ok).toBe(true);
  });

  it('reject every single-character tamper', () => {
    const code = exportCode(richMeta(), { now: 1 });
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let seed = 99;
    // The last character may carry unused padding bits, so tamper everywhere before it.
    for (let n = 0; n < 300; n++) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const pos = 4 + (seed % (code.length - 5));
      const old = code[pos]!;
      const rep = alphabet[(alphabet.indexOf(old) + 1 + (seed >>> 8) % 63) % 64]!;
      expect(rep).not.toBe(old);
      const bad = code.slice(0, pos) + rep + code.slice(pos + 1);
      const r = importCode(bad);
      expect(r.ok, `tamper at ${pos}`).toBe(false);
      if (!r.ok) expect(['damaged', 'encoding', 'shape']).toContain(r.error);
    }
  });

  it('reject truncated codes', () => {
    const code = exportCode(richMeta());
    for (const cut of [5, 40, Math.floor(code.length / 2), code.length - 3]) {
      expect(importCode(code.slice(0, cut)).ok).toBe(false);
    }
  });

  it('explain what is wrong in plain words', () => {
    expectError('', 'empty');
    expectError('   \n ', 'empty');
    expectError('hello there', 'prefix');
    expectError('SD0:abcd', 'prefix');
    expectError('SD2:abcd', 'version');
    expectError('SD1:$$$$', 'encoding');
    expectError('SD1:', 'encoding');
    expectError(EXPORT_PREFIX + bytesToBase64Url(new Uint8Array([0xff, 0xfe, 0xfd])), 'encoding');
    expectError(EXPORT_PREFIX + bytesToBase64Url(utf8Encode('not json')), 'damaged');
    expectError(EXPORT_PREFIX + bytesToBase64Url(utf8Encode('{"some":"json"}')), 'shape');
    expectError(craft({ app: 'another-game', meta: { v: 1, data: {} } }), 'shape');
    expectError(craft({ app: 'stormdrain' }), 'shape');
    expectError(craft({ app: 'stormdrain', meta: { v: 99, data: {} } }), 'version');
    expectError(craft({ app: 'stormdrain', meta: { v: 1, data: {} } }, 2), 'version');
    for (const msg of Object.values(IMPORT_MESSAGES)) {
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toMatch(/undefined|null|NaN|\{|\}/);
    }
  });

  it('migrate an old (v0) meta inside a code', () => {
    const code = craft({
      app: 'stormdrain',
      at: 1,
      meta: { v: 0, data: { masterVolume: 0.2, aim360: true, unlockedItems: ['orbit_blades'], achievements: ['old_one'] } },
    });
    const r = importCode(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metaVersion).toBe(0);
    expect(r.meta.settings).toMatchObject({ masterVol: 0.2, aim360: true });
    expect(r.meta.unlocks.items.has('orbit_blades')).toBe(true);
    expect(r.meta.achievements).toEqual({ old_one: 0 });
  });

  it('migrate the run when possible and otherwise drop it with a warning', () => {
    const body = { app: 'stormdrain', at: 1, meta: { v: 1, data: {} }, run: { v: 1, data: { hearts: 2 } } };
    const v2: MigrationSet = { name: 'run', current: 2, steps: { 1: (o: { hearts: number }) => ({ red: o.hearts * 2 }) } };
    expect(importCode(craft(body), { runMigrations: v2 })).toMatchObject({ ok: true, run: { v: 2, data: { red: 4 } }, warnings: [] });

    const v3NoPath: MigrationSet = { name: 'run', current: 3, steps: {} };
    const r = importCode(craft(body), { runMigrations: v3NoPath });
    expect(r).toMatchObject({ ok: true, run: null });
    if (r.ok) expect(r.warnings[0]).toMatch(/older version/);

    const damagedRun = importCode(craft({ ...body, run: 'nope' }));
    expect(damagedRun).toMatchObject({ ok: true, run: null });
    if (damagedRun.ok) expect(damagedRun.warnings).toHaveLength(1);
  });

  it('summarize progress for the confirmation dialog', () => {
    expect(summarizeMeta(richMeta())).toEqual({
      achievements: 1,
      itemsDiscovered: 1,
      enemiesSeen: 1,
      charactersUnlocked: 2,
      runs: 12,
      wins: 2,
      playTimeSec: 7200.5,
    });
  });
});
