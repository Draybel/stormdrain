/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base './' makes the build work from any GitHub Pages sub-path (e.g. /<repo-name>/)
export default defineConfig({
  base: './',
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
