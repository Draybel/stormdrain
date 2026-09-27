import { describe, expect, it } from 'vitest';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  checkJsonSafe,
  checksum,
  decodeEnvelope,
  encodeEnvelope,
  fnv1a32,
  utf8Decode,
  utf8Encode,
} from '../src/meta/saveCodec';

describe('FNV-1a checksum', () => {
  it('matches the published 32-bit test vectors for ASCII', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('formats as 8 hex digits', () => {
    expect(checksum('')).toBe('811c9dc5');
    expect(checksum('x')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('envelope codec', () => {
  const data = {
    name: 'Wren ☂ 🌧',
    nums: [0, -1, 1.5, 1e21, -0.000001, 2 ** 53],
    nested: { a: [true, false, null], b: { '2': 'two', '1': 'one', z: 'last' } },
    empty: {},
    list: [],
  };

  it('round-trips data unchanged', () => {
    const text = encodeEnvelope(3, data);
    const r = decodeEnvelope<typeof data>(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.v).toBe(3);
    expect(r.data).toEqual(JSON.parse(JSON.stringify(data)));
  });

  it('writes { v, sum, data }', () => {
    const env = JSON.parse(encodeEnvelope(1, { a: 1 })) as Record<string, unknown>;
    expect(Object.keys(env).sort()).toEqual(['data', 'sum', 'v']);
    expect(env.v).toBe(1);
    expect(env.sum).toMatch(/^[0-9a-f]{8}$/);
  });

  it('detects a changed value (checksum mismatch)', () => {
    const text = encodeEnvelope(1, { coins: 12, items: ['lance'] });
    const tampered = text.replace('"coins":12', '"coins":99');
    expect(tampered).not.toBe(text);
    const r = decodeEnvelope(tampered);
    expect(r).toMatchObject({ ok: false, error: 'checksum' });
  });

  it('detects an edited version number', () => {
    const text = encodeEnvelope(1, { a: 1 });
    const r = decodeEnvelope(text.replace('"v":1', '"v":2'));
    expect(r).toMatchObject({ ok: false, error: 'checksum' });
  });

  it('detects a changed checksum', () => {
    const text = encodeEnvelope(1, { a: 1 });
    const env = JSON.parse(text) as { sum: string };
    const other = env.sum === '00000000' ? '00000001' : '00000000';
    expect(decodeEnvelope(text.replace(env.sum, other))).toMatchObject({ ok: false, error: 'checksum' });
  });

  it('classifies empty, truncated and foreign text', () => {
    expect(decodeEnvelope(null)).toMatchObject({ ok: false, error: 'empty' });
    expect(decodeEnvelope('')).toMatchObject({ ok: false, error: 'empty' });
    const text = encodeEnvelope(1, { a: [1, 2, 3] });
    expect(decodeEnvelope(text.slice(0, -5))).toMatchObject({ ok: false, error: 'json' });
    expect(decodeEnvelope('{"hello":1}')).toMatchObject({ ok: false, error: 'shape' });
    expect(decodeEnvelope('[1,2]')).toMatchObject({ ok: false, error: 'shape' });
    expect(decodeEnvelope('{"v":-1,"sum":"x","data":1}')).toMatchObject({ ok: false, error: 'shape' });
    expect(decodeEnvelope('{"v":1.5,"sum":"x","data":1}')).toMatchObject({ ok: false, error: 'shape' });
  });

  it('refuses unserializable data and bad versions', () => {
    expect(() => encodeEnvelope(1, undefined)).toThrow(TypeError);
    expect(() => encodeEnvelope(-1, {})).toThrow(TypeError);
    const cyc: Record<string, unknown> = {};
    cyc.self = cyc;
    expect(() => encodeEnvelope(1, cyc)).toThrow();
  });
});

describe('base64url + UTF-8', () => {
  it('matches node Buffer base64url for every length 0..300', () => {
    let seed = 7;
    for (let n = 0; n <= 300; n++) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        bytes[i] = seed >>> 24;
      }
      const enc = bytesToBase64Url(bytes);
      expect(enc).toBe(Buffer.from(bytes).toString('base64url'));
      expect(Array.from(base64UrlToBytes(enc)!)).toEqual(Array.from(bytes));
    }
  });

  it('also accepts standard base64 with padding', () => {
    const bytes = utf8Encode('Stormdrain? >>> yes!!');
    const std = Buffer.from(bytes).toString('base64');
    expect(std).toMatch(/[+/=]/);
    expect(Array.from(base64UrlToBytes(std)!)).toEqual(Array.from(bytes));
  });

  it('rejects invalid characters and impossible lengths', () => {
    expect(base64UrlToBytes('abc$')).toBeNull();
    expect(base64UrlToBytes('ab cd')).toBeNull();
    expect(base64UrlToBytes('abcde')).toBeNull(); // 5 chars = 1 dangling char
    expect(base64UrlToBytes('ab===')).toBeNull();
    expect(base64UrlToBytes('é')).toBeNull();
  });

  it('round-trips unicode text and rejects invalid UTF-8', () => {
    const s = 'Wren 🌧 — “marbles” ☂';
    expect(utf8Decode(utf8Encode(s))).toBe(s);
    expect(utf8Decode(new Uint8Array([0xff, 0xfe, 0x41]))).toBeNull();
  });
});

describe('checkJsonSafe', () => {
  class Vec {
    x = 1;
  }

  it('accepts plain JSON data, shared references, null-prototype objects and undefined props', () => {
    const shared = { hp: 3 };
    const bare = Object.create(null) as Record<string, number>;
    bare.a = 1;
    expect(checkJsonSafe({ a: shared, b: shared, c: [shared], bare, opt: undefined, s: 'x', n: null })).toBeNull();
    expect(checkJsonSafe([1, 'two', [3], { four: 4 }])).toBeNull();
  });

  it.each([
    ['NaN', { player: { pos: [1, Number.NaN] } }, 'nan', '$.player.pos[1]'],
    ['Infinity', { dmg: Infinity }, 'infinity', '$.dmg'],
    ['-Infinity', { list: [{ v: -Infinity }] }, 'infinity', '$.list[0].v'],
    ['Map', { m: new Map() }, 'class', '$.m'],
    ['Set', { s: new Set([1]) }, 'class', '$.s'],
    ['Date', { when: new Date(0) }, 'class', '$.when'],
    ['class instance', { v: new Vec() }, 'class', '$.v'],
    ['typed array', { buf: new Float32Array(2) }, 'class', '$.buf'],
    ['function', { fn: () => 1 }, 'type', '$.fn'],
    ['symbol', { s: Symbol('x') }, 'type', '$.s'],
    ['BigInt', { big: 10n }, 'type', '$.big'],
    ['undefined in array', { a: [1, undefined] }, 'type', '$.a[1]'],
    ['odd key', { 'weird key': Number.NaN }, 'nan', '$["weird key"]'],
  ])('rejects %s', (_label, value, problem, path) => {
    const issue = checkJsonSafe(value);
    expect(issue).not.toBeNull();
    expect(issue!.problem).toBe(problem);
    expect(issue!.path).toBe(path);
    expect(issue!.message).toContain(path);
  });

  it('rejects cycles', () => {
    const a: Record<string, unknown> = { name: 'a' };
    const b: Record<string, unknown> = { back: a };
    a.child = b;
    const issue = checkJsonSafe({ root: a });
    expect(issue).toMatchObject({ problem: 'cycle', path: '$.root.child.back' });
  });

  it('rejects runaway nesting', () => {
    let deep: unknown = 1;
    for (let i = 0; i < 100; i++) deep = [deep];
    expect(checkJsonSafe(deep, 64)).toMatchObject({ problem: 'depth' });
  });

  it('rejects a top-level undefined', () => {
    expect(checkJsonSafe(undefined)).toMatchObject({ problem: 'type', path: '$' });
  });
});
