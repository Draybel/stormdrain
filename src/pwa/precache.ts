/**
 * Service-worker precache list + build version (pure; used by scripts/sw-plugin.ts at build time
 * and by tests). URLs are RELATIVE (`./assets/index-abc.js`): the service worker resolves them
 * against its own URL, so the app works from any sub-path (GitHub Pages `/<repo>/`).
 */

/** Never precached: the worker itself, source maps, hidden files/dirs (e.g. `.vite/manifest.json`), OS junk. */
const EXCLUDE: readonly RegExp[] = [/^sw\.js$/, /\.map$/, /(^|\/)\./, /(^|\/)Thumbs\.db$/i, /(^|\/)desktop\.ini$/i];

/** Always precached: the app shell (navigations fall back to it offline). */
export const APP_SHELL = 'index.html';

/** Normalize a build-output path (`\` or `/`, optional `./` or leading `/`) to `a/b.js`. */
export function normalizeOutputPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

/** Is this output file something the service worker should cache? */
export function isPrecacheable(path: string): boolean {
  const f = normalizeOutputPath(path);
  return f.length > 0 && !EXCLUDE.some((r) => r.test(f));
}

/**
 * Sorted, de-duplicated, URL-encoded relative URLs for every precacheable output file, always
 * including `./index.html`.
 */
export function buildPrecacheList(files: Iterable<string>): string[] {
  const set = new Set<string>([APP_SHELL]);
  for (const raw of files) {
    const f = normalizeOutputPath(raw);
    if (isPrecacheable(f)) set.add(f);
  }
  return [...set]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((f) => `./${f.split('/').map(encodeURIComponent).join('/')}`);
}

/**
 * Incremental 53-bit hash (cyrb53 mixing) of names + contents → cache version. Any change to any
 * precached file (including index.html, the manifest and icons) yields a new version, which is
 * what makes browsers install the updated worker.
 */
export class VersionHasher {
  private h1 = 0xdeadbeef;
  private h2 = 0x41c6ce57;

  update(data: Uint8Array | string): this {
    let h1 = this.h1;
    let h2 = this.h2;
    if (typeof data === 'string') {
      for (let i = 0; i < data.length; i++) {
        const c = data.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
      }
    } else {
      for (let i = 0; i < data.length; i++) {
        const c = data[i]!;
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
      }
    }
    // separator so ("ab","c") and ("a","bc") differ
    h1 = Math.imul(h1 ^ 0x1f, 2654435761);
    h2 = Math.imul(h2 ^ 0x1f, 1597334677);
    this.h1 = h1;
    this.h2 = h2;
    return this;
  }

  /** 12 hex digits. */
  digest(): string {
    let h1 = this.h1;
    let h2 = this.h2;
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
    return n.toString(16).padStart(14, '0').slice(-12);
  }
}

/** Version of a set of files: hash of every (path, content) pair in path order. */
export function computeVersion(files: Iterable<readonly [path: string, content: Uint8Array | string]>): string {
  const sorted = [...files].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const h = new VersionHasher();
  for (const [path, content] of sorted) h.update(normalizeOutputPath(path)).update(content);
  return h.digest();
}
