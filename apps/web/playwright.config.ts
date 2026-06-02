import { defineConfig, devices } from '@playwright/test';

/**
 * E2E smoke tests run against a deployed URL (prod by default, override with
 * PLAYWRIGHT_BASE_URL). They exercise the public storefront end-to-end — no test
 * database needed — and run on a schedule / manual dispatch as a prod monitor.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://weedtip-web.vercel.app';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
