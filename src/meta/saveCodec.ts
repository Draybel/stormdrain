/**
 * Save codec (ARCHITECTURE §7): the versioned envelope `{ v, data, sum }`, its FNV-1a checksum,
 * base64url + UTF-8 helpers for export codes, and a JSON-safety checker.
 *
 * Pure: no DOM, no storage, no clocks. Everything here is safe to call from node tests.
 */

/** A decoded save envelope. `sum` covers the version and the JSON text of `data`. */
export interface Envelope<T = unknown> {
  v: number;
  data: T;
  sum: string;
}

// ── Checksum ────────────────────────────────────────────────────────────────

/**
 * 32-bit FNV-1a over the string's UTF-16 code units. Not cryptographic: it detects accidental
 * corruption and casual edits, which is all a local game save needs.
 */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 8 lowercase hex digits. */
export function checksum(text: string): string {
  return fnv1a32(text).toString(16).padStart(8, '0');
}

/** The checksum binds the version too, so editing `v` alone is detected. */
function envelopeSum(v: number, json: string): string {
  return checksum(`${v}:${json}`);
}

// ── Envelope ────────────────────────────────────────────────────────────────

export type DecodeError = 'empty' | 'json' | 'shape' | 'checksum';

export type DecodeResult<T = unknown> =
  | { ok: true; v: number; data: T }
  | { ok: false; error: DecodeError; message: string };

/**
 * Serialize `data` into an envelope string. Throws a TypeError when `data` cannot be serialized
 * (cycles, BigInt, or a top-level value JSON drops such as `undefined`); callers that accept
 * foreign data should run {@link checkJsonSafe} first.
 */
export function encodeEnvelope(v: number, data: unknown): string {
  const json = JSON.stringify(data);
  if (json === undefined) throw new TypeError('save data is not JSON-serializable');
  return encodeEnvelopeJson(v, json);
}

/** Same as {@link encodeEnvelope} for data that is already `JSON.stringify`-ed. */
export function encodeEnvelopeJson(v: number, json: string): string {
  if (!Number.isInteger(v) || v < 0) throw new TypeError(`bad save version ${String(v)}`);
  return `{"v":${v},"sum":"${envelopeSum(v, json)}","data":${json}}`;
}

/**
 * Parse and verify an envelope string. The checksum is recomputed over `JSON.stringify(data)`;
 * this is stable because the stored text was itself produced by `JSON.stringify` (key order and
 * number formatting survive a parse/stringify round trip).
 */
export function decodeEnvelope<T = unknown>(text: string | null | undefined): DecodeResult<T> {
  if (text === null || text === undefined || text.length === 0) {
    return { ok: false, error: 'empty', message: 'no save data' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'json', message: 'save data is not valid JSON (truncated or damaged)' };
  }
  if (!isRecord(parsed) || !('data' in parsed)) {
    return { ok: false, error: 'shape', message: 'save data is not a Stormdrain save envelope' };
  }
  const { v, sum } = parsed;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || typeof sum !== 'string') {
    return { ok: false, error: 'shape', message: 'save envelope has no valid version/checksum' };
  }
  const json = JSON.stringify(parsed.data);
  if (json === undefined || envelopeSum(v, json) !== sum.toLowerCase()) {
    return { ok: false, error: 'checksum', message: 'save checksum does not match (damaged or edited)' };
  }
  return { ok: true, v, data: parsed.data as T };
}

// ── UTF-8 + base64url ───────────────────────────────────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** char code → 6-bit value, accepting both the url-safe and the standard alphabet; -1 = invalid. */
const B64_LOOKUP: Int8Array = (() => {
  const t = new Int8Array(128).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  t['+'.charCodeAt(0)] = 62;
  t['/'.charCodeAt(0)] = 63;
  return t;
})();

/** RFC 4648 §5 base64url without padding. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  const n = bytes.length;
  let i = 0;
  for (; i + 2 < n; i += 3) {
    const x = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    chunk += B64[(x >>> 18) & 63]! + B64[(x >>> 12) & 63]! + B64[(x >>> 6) & 63]! + B64[x & 63]!;
    if (chunk.length >= 8192) {
      parts.push(chunk);
      chunk = '';
    }
  }
  const rest = n - i;
  if (rest === 1) {
    const x = bytes[i]! << 16;
    chunk += B64[(x >>> 18) & 63]! + B64[(x >>> 12) & 63]!;
  } else if (rest === 2) {
    const x = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    chunk += B64[(x >>> 18) & 63]! + B64[(x >>> 12) & 63]! + B64[(x >>> 6) & 63]!;
  }
  parts.push(chunk);
  return parts.join('');
}

/**
 * Decode base64url (or standard base64, with or without `=` padding). Returns null on any
 * invalid character or impossible length.
 */
export function base64UrlToBytes(text: string): Uint8Array | null {
  let end = text.length;
  while (end > 0 && text.charCodeAt(end - 1) === 61 /* = */) end--;
  if (text.length - end > 2) return null;
  if (end % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < end; i++) {
    const c = text.charCodeAt(i);
    const v = c < 128 ? B64_LOOKUP[c]! : -1;
    if (v < 0) return null;
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >>> bits) & 0xff;
    }
    acc &= 0xffff; // keep only the bits still pending (never more than 14)
  }
  return o === out.length ? out : out.subarray(0, o);
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Strict UTF-8 decode; null when the bytes are not valid UTF-8. */
export function utf8Decode(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

// ── JSON safety ─────────────────────────────────────────────────────────────

export type JsonProblem = 'nan' | 'infinity' | 'cycle' | 'type' | 'class' | 'depth';

export interface JsonIssue {
  problem: JsonProblem;
  /** Where the problem is, e.g. `$.player.pos[1]`. */
  path: string;
  message: string;
}

/**
 * Check that `value` survives `JSON.stringify` → `JSON.parse` unchanged:
 * - numbers must be finite (NaN/±Infinity silently become `null`);
 * - no cycles (shared, acyclic references are allowed; they load back as copies);
 * - only plain objects and arrays (Map/Set/Date/class instances/typed arrays lose data);
 * - no functions, symbols or BigInt; no `undefined` inside arrays (object properties that are
 *   `undefined` are fine: they are simply omitted, like optional fields);
 * - nesting deeper than `maxDepth` is rejected (guards against runaway structures).
 * Returns the first issue found, or null when the value is safe.
 */
export function checkJsonSafe(value: unknown, maxDepth = 64): JsonIssue | null {
  const path: (string | number)[] = [];
  const ancestors = new Set<object>();

  const issue = (problem: JsonProblem, message: string): JsonIssue => ({
    problem,
    path: formatPath(path),
    message: `${message} at ${formatPath(path)}`,
  });

  const visit = (v: unknown, depth: number, inArray: boolean): JsonIssue | null => {
    switch (typeof v) {
      case 'string':
      case 'boolean':
        return null;
      case 'number':
        if (Number.isNaN(v)) return issue('nan', 'NaN');
        if (!Number.isFinite(v)) return issue('infinity', 'Infinity');
        return null;
      case 'undefined':
        return inArray || depth === 0 ? issue('type', 'undefined value') : null;
      case 'bigint':
        return issue('type', 'BigInt value');
      case 'function':
        return issue('type', 'function value');
      case 'symbol':
        return issue('type', 'symbol value');
    }
    if (v === null) return null;
    const obj = v as object;
    if (depth >= maxDepth) return issue('depth', `nesting deeper than ${maxDepth}`);
    if (ancestors.has(obj)) return issue('cycle', 'circular reference');
    const isArr = Array.isArray(obj);
    if (!isArr) {
      const proto = Object.getPrototypeOf(obj) as object | null;
      if (proto !== Object.prototype && proto !== null) {
        const name = (proto as { constructor?: { name?: string } }).constructor?.name ?? 'object';
        return issue('class', `${name} instance (store a plain object/array instead)`);
      }
    }
    ancestors.add(obj);
    let found: JsonIssue | null = null;
    if (isArr) {
      const arr = obj as unknown[];
      for (let i = 0; i < arr.length && !found; i++) {
        path.push(i);
        found = visit(arr[i], depth + 1, true);
        if (!found) path.pop();
      }
    } else {
      const rec = obj as Record<string, unknown>;
      for (const k of Object.keys(rec)) {
        path.push(k);
        found = visit(rec[k], depth + 1, false);
        if (found) break;
        path.pop();
      }
    }
    ancestors.delete(obj);
    return found;
  };

  return visit(value, 0, false);
}

function formatPath(path: readonly (string | number)[]): string {
  let s = '$';
  for (const p of path) s += typeof p === 'number' ? `[${p}]` : /^[A-Za-z_$][\w$]*$/.test(p) ? `.${p}` : `[${JSON.stringify(p)}]`;
  return s;
}

// ── Small shared helpers ───────────────────────────────────────────────────

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
