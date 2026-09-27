/** Types for scripts/sw-plugin.mjs (vite.config.ts and tests/pwa-sw.test.ts). */

import type { Plugin } from 'vite';

export declare const SW_FILE: 'sw.js';

/** Every file under `dir`, as posix paths relative to it. */
export declare function listFiles(dir: string, prefix?: string): string[];

export interface GeneratedWorker {
  version: string;
  precache: string[];
  /** Absolute path of the written worker. */
  file: string;
}

/** Scan a finished build directory and write `sw.js` into it. */
export declare function generateServiceWorker(outDir: string): GeneratedWorker;

export declare function serviceWorkerPlugin(): Plugin;
