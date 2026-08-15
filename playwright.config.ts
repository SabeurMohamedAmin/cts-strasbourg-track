import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration — Phase 0 safety net.
 *
 * The webServer block boots the Nuxt dev server automatically, so running
 * `pnpm test:e2e` locally needs no manual setup. In CI the server is always
 * started fresh; locally an already-running `pnpm dev` is reused.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Map tiles + SSE streams can be slow on first load — be generous.
  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
