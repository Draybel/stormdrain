/**
 * Source of the generated `dist/sw.js` (pure string builder; scripts/sw-plugin.ts writes it at
 * build time, tests evaluate it against a fake worker environment).
 *
 * Behaviour:
 * - install: fetch every precache URL with `cache: 'reload'` (bypasses a stale HTTP cache, e.g.
 *   GitHub Pages' 10-minute max-age) into `stormdrain:<scope>:<version>`. It does NOT skip waiting
 *   by itself; the page asks it to (see src/pwa/register.ts) so updates stay quiet.
 * - activate: delete older Stormdrain caches of the SAME scope (another deployment on the same
 *   origin keeps its own), then claim open pages so the very first visit works offline.
 * - fetch (same-origin GET inside the scope): navigations to the app (`./`, `*.html`, extensionless
 *   paths) get the cached `index.html` (offline start, query strings like `?seed=` still work);
 *   everything else is cache-first, falling back to the network and caching what it fetched.
 *   Matching ignores `Vary` (the `crossorigin` module script request carries an `Origin` header
 *   that the precache request did not; with `Vary: Origin` it would otherwise miss offline).
 * - message `SKIP_WAITING` (string or `{ type }`) → `skipWaiting()`; `GET_VERSION` answers on the
 *   given MessagePort with `{ type: 'VERSION', version }`.
 */

export interface ServiceWorkerSourceOptions {
  /** Build hash; changes whenever any precached file changes. */
  version: string;
  /** Relative URLs (`./assets/x.js`), resolved against the worker's own URL. */
  precache: readonly string[];
  /** Cache-name prefix (default `stormdrain`). */
  cachePrefix?: string;
}

export function renderServiceWorker(opts: ServiceWorkerSourceOptions): string {
  const prefix = opts.cachePrefix ?? 'stormdrain';
  return `/* Stormdrain service worker. Generated at build time by scripts/sw-plugin.ts: do not edit. */
'use strict';
const VERSION = ${JSON.stringify(opts.version)};
const PRECACHE = ${JSON.stringify(opts.precache, null, 1)};
const SCOPE = self.registration && self.registration.scope ? self.registration.scope : new URL('./', self.location.href).href;
const PREFIX = ${JSON.stringify(prefix)} + ':' + SCOPE + ':';
const CACHE = PREFIX + VERSION;
const INDEX_URL = new URL('./index.html', self.location.href).href;
// Entries are keyed by URL. Servers send "Vary: Origin" (Vite) or other Vary headers, and the page's
// crossorigin module request carries an Origin header the precache request did not: ignore Vary.
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll());
});

async function precacheAll() {
  const cache = await caches.open(CACHE);
  await Promise.all(
    PRECACHE.map(async (path) => {
      const url = new URL(path, self.location.href).href;
      let res = await fetch(new Request(url, { cache: 'reload', credentials: 'same-origin' }));
      if (!res || !res.ok) throw new Error('precache failed: ' + path + ' (HTTP ' + (res ? res.status : '?') + ')');
      // WebKit refuses redirected responses for navigations: store a clean copy.
      if (res.redirected) res = new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: res.headers });
      await cache.put(url, res);
    }),
  );
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(PREFIX) && n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data;
  const type = typeof data === 'string' ? data : data && data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'GET_VERSION' && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ type: 'VERSION', version: VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (req.mode === 'navigate' && isAppShell(url)) {
    event.respondWith(appShell(req));
    return;
  }
  event.respondWith(cacheFirst(event, req));
});

function isAppShell(url) {
  const last = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
  return last === '' || last.endsWith('.html') || last.indexOf('.') < 0;
}

async function appShell(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(INDEX_URL, MATCH);
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (err) {
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
        '<title>Stormdrain</title><body style="margin:0;height:100vh;display:grid;place-items:center;' +
        'background:#000;color:#ccc;font:16px system-ui,sans-serif;text-align:center">' +
        'Stormdrain is offline and not installed yet.<br>Open it once with a connection.',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheFirst(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, MATCH);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && (res.type === 'basic' || res.type === 'default') && !req.headers.has('range')) {
    const put = cache.put(req, res.clone()).catch(() => {});
    try {
      event.waitUntil(put);
    } catch (err) {
      // the pending respondWith already keeps the worker alive
    }
  }
  return res;
}
`;
}
