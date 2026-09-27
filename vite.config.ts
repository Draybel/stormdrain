/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './scripts/sw-plugin.mjs';

// base './' makes the build work from any GitHub Pages sub-path (e.g. /<repo-name>/)
export default defineConfig({
  base: './',
  // Production builds get dist/sw.js (offline precache of every emitted file).
  plugins: [serviceWorkerPlugin()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  server: { host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 180000,
    hookTimeout: 60000,
  },
});
