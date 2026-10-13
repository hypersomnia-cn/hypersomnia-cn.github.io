import { defineConfig, devices } from '@playwright/test';
const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: 2,
  timeout: 30000,
  globalTimeout: 180000,
  use: {
    baseURL: `http://127.0.0.1:4173${base}/`,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        defaultBrowserType: 'chromium',
        viewport: { width: 320, height: 740 },
      },
    },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://127.0.0.1:4173${base}/`,
    reuseExistingServer: false,
  },
  reporter: 'list',
});
