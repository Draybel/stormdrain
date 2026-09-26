import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { generateServiceWorker, listFiles } from '../scripts/sw-plugin.mjs';
import { buildPrecacheList, computeVersion, isPrecacheable } from '../src/pwa/precache';
import { SKIP_WAITING, registerServiceWorker, type RegistrationLike, type WorkerContainerLike } from '../src/pwa/register';
import { renderServiceWorker } from '../src/pwa/swSource';

const PAGES_SCOPE = 'https://owner.github.io/stormdrain/';

describe('precache list', () => {
  const emitted = [
    'assets/index-AbC123.js',
    'assets/index-AbC123.js.map',
    'assets/index-Zz9_x.css',
    './assets/font file.woff2',
    'icons\\icon-512.png',
    'icons/icon-192.png',
    '/manifest.webmanifest',
    'sw.js',
    '.vite/manifest.json',
    'Thumbs.db',
  ];

  it('includes every emitted asset (hashed names included) plus index.html, sorted and relative', () => {
    expect(buildPrecacheList(emitted)).toEqual([
      './assets/font%20file.woff2',
      './assets/index-AbC123.js',
      './assets/index-Zz9_x.css',
      './icons/icon-192.png',
      './icons/icon-512.png',
      './index.html',
      './manifest.webmanifest',
    ]);
  });

  it('never lists the worker itself, source maps or hidden files', () => {
    for (const f of ['sw.js', 'a/b.js.map', '.vite/manifest.json', 'assets/.DS_Store', 'Thumbs.db']) {
      expect(isPrecacheable(f), f).toBe(false);
    }
    expect(isPrecacheable('assets/sw.js')).toBe(true); // only the root worker is excluded
  });

  it('resolves inside a GitHub Pages sub-path', () => {
    for (const entry of buildPrecacheList(emitted)) {
      expect(entry.startsWith('./')).toBe(true);
      const url = new URL(entry, `${PAGES_SCOPE}sw.js`);
      expect(url.href.startsWith(PAGES_SCOPE), url.href).toBe(true);
    }
  });

  it('version changes with any content or name change, and ignores input order', () => {
    const files: [string, string][] = [
      ['index.html', '<html>'],
      ['assets/a.js', 'console.log(1)'],
    ];
    const v = computeVersion(files);
    expect(v).toMatch(/^[0-9a-f]{12}$/);
    expect(computeVersion([...files].reverse())).toBe(v);
    expect(computeVersion([files[0]!, ['assets/a.js', 'console.log(2)']])).not.toBe(v);
    expect(computeVersion([files[0]!, ['assets/b.js', 'console.log(1)']])).not.toBe(v);
    expect(computeVersion([['index.html', '<html'], ['assets/a.js', '>console.log(1)']])).not.toBe(v);
    expect(computeVersion([['x', new Uint8Array([1, 2, 3])]])).toBe(computeVersion([['x', new Uint8Array([1, 2, 3])]]));
  });
});

// ── The generated worker, run against a fake ServiceWorkerGlobalScope ──

type Listener = (e: Record<string, unknown>) => void;

interface FakeRequest {
  url: string;
  method: string;
  mode: string;
  headers: Headers;
}

function req(url: string, init: Partial<FakeRequest> = {}): FakeRequest {
  return { url, method: 'GET', mode: 'cors', headers: new Headers(), ...init };
}

function workerEnv(opts: { scope?: string; version?: string; files?: Record<string, string>; precache?: string[] } = {}) {
  const scope = opts.scope ?? PAGES_SCOPE;
  const base = new URL(scope);
  const files = opts.files ?? {
    'index.html': '<!doctype html><title>Stormdrain</title>',
    'assets/index-AbC123.js': 'boot()',
    'manifest.webmanifest': '{}',
    'icons/icon-192.png': 'PNG',
    'extra.txt': 'not precached',
  };
  const precache = opts.precache ?? buildPrecacheList(Object.keys(files).filter((f) => f !== 'extra.txt'));
  const version = opts.version ?? 'v1';
  const listeners: Record<string, Listener[]> = {};
  const self = {
    location: new URL('sw.js', scope),
    registration: { scope },
    clients: { claim: vi.fn(async () => {}) },
    skipWaiting: vi.fn(async () => {}),
    addEventListener: (type: string, fn: Listener) => (listeners[type] ??= []).push(fn),
  };
  const stores = new Map<string, Map<string, Response>>();
  const keyOf = (r: string | { url: string }) => (typeof r === 'string' ? r : r.url);
  const caches = {
    open: async (name: string) => {
      let m = stores.get(name);
      if (!m) stores.set(name, (m = new Map()));
      const store = m;
      return {
        put: async (r: string | { url: string }, res: Response) => void store.set(keyOf(r), res),
        // Like the real Cache API, a stored `Vary: Origin` response misses for a request whose Origin
        // differs from the precache request's (the crossorigin module script) unless ignoreVary is set.
        match: async (r: string | { url: string }, o?: { ignoreVary?: boolean }) => {
          const hit = store.get(keyOf(r));
          if (hit?.headers.has('vary') && !o?.ignoreVary) return undefined;
          return hit?.clone();
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
  };
  const state = { online: true };
  const fetched: { url: string; cache?: string }[] = [];
  const fetch = vi.fn(async (r: Request | FakeRequest) => {
    fetched.push({ url: r.url, cache: (r as Request).cache });
    if (!state.online) throw new TypeError('Failed to fetch');
    const u = new URL(r.url);
    const path = decodeURIComponent(u.pathname.slice(base.pathname.length));
    const body = u.origin === base.origin && u.pathname.startsWith(base.pathname) ? files[path === '' ? 'index.html' : path] : undefined;
    return body === undefined
      ? new Response('not found', { status: 404 })
      : new Response(body, { status: 200, headers: { Vary: 'Origin' } }); // what `vite preview` sends
  });
  const src = renderServiceWorker({ version, precache });
  new Function('self', 'caches', 'fetch', src)(self, caches, fetch);

  async function dispatch(type: string, extra: Record<string, unknown> = {}): Promise<Response | undefined> {
    const waits: Promise<unknown>[] = [];
    let responded: Promise<Response> | undefined;
    const e = {
      ...extra,
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
      respondWith: (p: Promise<Response>) => void (responded = p),
    };
    for (const fn of listeners[type] ?? []) fn(e);
    const res = responded ? await responded : undefined;
    await Promise.all(waits);
    return res;
  }

  const cacheName = `stormdrain:${scope}:${version}`;
  return { self, stores, fetch, fetched, state, dispatch, cacheName, precache, scope };
}

describe('service worker', () => {
  it('renders valid JavaScript with the version and list embedded', () => {
    const src = renderServiceWorker({ version: 'abc123', precache: ['./index.html', './assets/x.js'] });
    expect(() => new Function(src)).not.toThrow();
    expect(src).toContain('"abc123"');
    expect(src).toContain('"./assets/x.js"');
  });

  it('install precaches every entry, bypassing the HTTP cache, under a scoped cache name', async () => {
    const env = workerEnv();
    await env.dispatch('install');
    expect(env.fetched.map((f) => f.url).sort()).toEqual(env.precache.map((p) => new URL(p, env.scope).href).sort());
    expect(env.fetched.every((f) => f.cache === 'reload')).toBe(true);
    const store = env.stores.get(env.cacheName)!;
    expect(store.size).toBe(env.precache.length);
    expect(store.has(`${PAGES_SCOPE}index.html`)).toBe(true);
    expect(env.self.skipWaiting).not.toHaveBeenCalled(); // waits for the page's SKIP_WAITING
  });

  it('install fails (and nothing activates) if a file is missing', async () => {
    const env = workerEnv({ precache: ['./index.html', './assets/missing.js'] });
    await expect(env.dispatch('install')).rejects.toThrow(/missing\.js/);
  });

  it('activate removes old versions of this app only, then claims clients', async () => {
    const env = workerEnv({ version: 'v2' });
    const old = `stormdrain:${PAGES_SCOPE}:v1`;
    const otherDeployment = 'stormdrain:https://owner.github.io/stormdrain-beta/:v1';
    for (const n of [old, otherDeployment, 'someone-else']) env.stores.set(n, new Map());
    await env.dispatch('install');
    await env.dispatch('activate');
    expect([...env.stores.keys()].sort()).toEqual([env.cacheName, otherDeployment, 'someone-else'].sort());
    expect(env.self.clients.claim).toHaveBeenCalledTimes(1);
  });

  it('works offline: navigations get the cached index.html, assets come from the cache', async () => {
    const env = workerEnv();
    await env.dispatch('install');
    env.state.online = false;
    for (const url of [PAGES_SCOPE, `${PAGES_SCOPE}index.html`, `${PAGES_SCOPE}?seed=ABCD`, `${PAGES_SCOPE}daily`]) {
      const res = await env.dispatch('fetch', { request: req(url, { mode: 'navigate' }) });
      expect(res?.status, url).toBe(200);
      expect(await res!.text()).toContain('<title>Stormdrain</title>');
    }
    const js = await env.dispatch('fetch', { request: req(`${PAGES_SCOPE}assets/index-AbC123.js`) });
    expect(await js!.text()).toBe('boot()');
    await expect(env.dispatch('fetch', { request: req(`${PAGES_SCOPE}not-cached.js`) })).rejects.toThrow();
  });

  it('shows an offline page when opened offline before anything was cached', async () => {
    const env = workerEnv();
    env.state.online = false;
    const res = await env.dispatch('fetch', { request: req(PAGES_SCOPE, { mode: 'navigate' }) });
    expect(res?.status).toBe(503);
    expect(await res!.text()).toContain('offline');
  });

  it('caches same-origin files fetched at runtime (cache-first afterwards)', async () => {
    const env = workerEnv();
    await env.dispatch('install');
    const first = await env.dispatch('fetch', { request: req(`${PAGES_SCOPE}extra.txt`) });
    expect(await first!.text()).toBe('not precached');
    env.state.online = false;
    const second = await env.dispatch('fetch', { request: req(`${PAGES_SCOPE}extra.txt`) });
    expect(await second!.text()).toBe('not precached');
  });

  it('leaves cross-origin, out-of-scope and non-GET requests to the network', async () => {
    const env = workerEnv();
    for (const r of [
      req('https://cdn.example.com/x.js'),
      req('https://owner.github.io/another-app/x.js'),
      req(`${PAGES_SCOPE}api`, { method: 'POST' }),
    ]) {
      // undefined = the worker never called respondWith (the browser handles it normally)
      expect(await env.dispatch('fetch', { request: r }), r.url).toBeUndefined();
    }
    expect(env.fetch).not.toHaveBeenCalled();
  });

  it('skips waiting when the page asks, and reports its version', async () => {
    const env = workerEnv({ version: 'v42' });
    await env.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    await env.dispatch('message', { data: 'SKIP_WAITING' });
    expect(env.self.skipWaiting).toHaveBeenCalledTimes(2);
    const port = { postMessage: vi.fn() };
    await env.dispatch('message', { data: { type: 'GET_VERSION' }, ports: [port] });
    expect(port.postMessage).toHaveBeenCalledWith({ type: 'VERSION', version: 'v42' });
  });
});

describe('build step (sw-plugin)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stormdrain-sw-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  const put = (rel: string, body: string) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body);
  };

  it('writes sw.js listing the build output with a content version', () => {
    put('index.html', '<script src="./assets/index-Q1w2E3.js"></script>');
    put('assets/index-Q1w2E3.js', 'boot()');
    put('assets/index-Q1w2E3.js.map', '{}');
    put('manifest.webmanifest', '{}');
    put('icons/icon-192.png', 'png');
    put('.vite/manifest.json', '{}');

    expect(listFiles(dir).sort()).toContain('assets/index-Q1w2E3.js');
    const first = generateServiceWorker(dir);
    expect(first.precache).toEqual([
      './assets/index-Q1w2E3.js',
      './icons/icon-192.png',
      './index.html',
      './manifest.webmanifest',
    ]);
    const src = readFileSync(join(dir, 'sw.js'), 'utf8');
    expect(src).toContain(JSON.stringify(first.version));
    expect(src).toContain('"./assets/index-Q1w2E3.js"');

    // Rebuilding with the old sw.js present does not list it; unchanged content → same version.
    expect(generateServiceWorker(dir).version).toBe(first.version);
    // Any content change (even index.html alone) → new version → browsers install the update.
    put('index.html', '<script src="./assets/index-Q1w2E3.js"></script><!-- tweak -->');
    expect(generateServiceWorker(dir).version).not.toBe(first.version);
  });
});

// ── registration ──

class FakeWorker {
  state: string;
  messages: unknown[] = [];
  private fns: (() => void)[] = [];
  constructor(state = 'installing') {
    this.state = state;
  }
  postMessage(m: unknown) {
    this.messages.push(m);
  }
  addEventListener(_t: 'statechange', fn: () => void) {
    this.fns.push(fn);
  }
  set(state: string) {
    this.state = state;
    for (const f of this.fns) f();
  }
}

function fakeContainer(init: { controller?: unknown; installing?: FakeWorker; waiting?: FakeWorker; active?: FakeWorker } = {}) {
  const updatefound: (() => void)[] = [];
  const reg = {
    installing: init.installing ?? null,
    waiting: init.waiting ?? null,
    active: init.active ?? null,
    update: vi.fn(async () => undefined),
    addEventListener: (_t: 'updatefound', fn: () => void) => void updatefound.push(fn),
  } satisfies RegistrationLike;
  const container = {
    controller: init.controller ?? null,
    register: vi.fn(async () => reg),
  } satisfies WorkerContainerLike;
  return { reg, container, fireUpdateFound: () => updatefound.forEach((f) => f()) };
}

describe('registerServiceWorker', () => {
  it('does nothing outside production builds', async () => {
    const { container } = fakeContainer();
    expect(await registerServiceWorker({ container })).toBeNull();
    expect(container.register).not.toHaveBeenCalled();
  });

  it('registers ./sw.js relative to the page with HTTP caching of the worker disabled', async () => {
    const { container } = fakeContainer();
    await registerServiceWorker({ force: true, container });
    expect(container.register).toHaveBeenCalledWith('./sw.js', { scope: './', updateViaCache: 'none' });
  });

  it('first install: reports offline-ready, never skips waiting', async () => {
    const w = new FakeWorker('installing');
    const { container } = fakeContainer({ installing: w });
    const onOfflineReady = vi.fn();
    const onUpdate = vi.fn();
    await registerServiceWorker({ force: true, container, onOfflineReady, onUpdate });
    w.set('installed');
    w.set('activating');
    w.set('activated');
    expect(w.messages).toEqual([]);
    expect(onOfflineReady).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('update: tells the new worker to take over quietly and reports it', async () => {
    const old = new FakeWorker('activated');
    const { reg, container, fireUpdateFound } = fakeContainer({ controller: old, active: old });
    const onUpdate = vi.fn();
    const onOfflineReady = vi.fn();
    await registerServiceWorker({ force: true, container, onUpdate, onOfflineReady });
    const next = new FakeWorker('installing');
    reg.installing = next;
    fireUpdateFound();
    fireUpdateFound(); // duplicate events are harmless
    next.set('installed');
    expect(next.messages).toEqual([SKIP_WAITING]);
    next.set('activated');
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onOfflineReady).not.toHaveBeenCalled();
  });

  it('activates an update that was already waiting at startup', async () => {
    const old = new FakeWorker('activated');
    const waiting = new FakeWorker('installed');
    const { container } = fakeContainer({ controller: old, active: old, waiting });
    await registerServiceWorker({ force: true, container });
    expect(waiting.messages).toEqual([SKIP_WAITING]);
  });

  it('never throws when registration fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const container: WorkerContainerLike = {
      controller: null,
      register: async () => {
        throw new Error('SecurityError');
      },
    };
    await expect(registerServiceWorker({ force: true, container })).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
