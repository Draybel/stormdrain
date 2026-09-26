import { defineConfig, devices } from '@playwright/test';

// Two WebKit projects: Safari-in-browser (Playwright's iPhone 15 landscape profile, 734x343)
// and the full-screen home-screen app viewport (852x393, touch).
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'iphone15-safari',
      use: { ...devices['iPhone 15 landscape'], browserName: 'webkit' },
    },
    {
      name: 'iphone15-homescreen',
      use: {
        browserName: 'webkit',
        viewport: { width: 852, height: 393 },
        screen: { width: 852, height: 393 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 15 landscape'].userAgent,
      },
    },
  ],
});
