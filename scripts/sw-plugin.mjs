/**
 * Vite plugin: after a production build has been written, generate `dist/sw.js` with a precache
 * list of every emitted file (hashed assets, index.html, manifest, icons...) and a version hash
 * of their contents. Dev server: inactive (no service worker in development).
 *
 * The list uses relative URLs, so the build keeps working from a GitHub Pages sub-path.
 * The list/version/worker source live in src/pwa (pure, unit-tested); this file only does I/O.
 * Types: sw-plugin.d.mts.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPrecacheList, computeVersion, isPrecacheable } from '../src/pwa/precache.ts';
import { renderServiceWorker } from '../src/pwa/swSource.ts';

export const SW_FILE = 'sw.js';

/** Every file under `dir`, as posix paths relative to it. */
export function listFiles(dir, prefix = '') {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(join(dir, e.name), rel));
    else if (e.isFile()) out.push(rel);
  }
  return out;
}

/** Scan a finished build directory and write `sw.js` into it. */
export function generateServiceWorker(outDir) {
  const files = listFiles(outDir).filter(isPrecacheable);
  const precache = buildPrecacheList(files);
  // The worker's own logic is part of the version too: a new worker gets a fresh cache.
  const entries = files.map((f) => [f, readFileSync(join(outDir, f))]);
  entries.push([`\0${SW_FILE}`, renderServiceWorker({ version: '', precache })]);
  const version = computeVersion(entries);
  const file = join(outDir, SW_FILE);
  writeFileSync(file, renderServiceWorker({ version, precache }));
  return { version, precache, file };
}

/** @returns {import('vite').Plugin} */
export function serviceWorkerPlugin() {
  let outDir = resolve('dist');
  let log = (msg) => console.log(msg);
  return {
    name: 'stormdrain:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      log = (msg) => config.logger.info(msg);
    },
    // After every file (bundle + public/) is on disk.
    closeBundle() {
      const sw = generateServiceWorker(outDir);
      log(`sw.js: ${sw.precache.length} files precached, version ${sw.version}`);
    },
  };
}
