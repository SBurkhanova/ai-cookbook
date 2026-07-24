import { defineConfig, devices } from '@playwright/test';

const PORT = 4100; // dedicated E2E port, so it never collides with a dev server on 4000

// End-to-end tests drive the REAL app in a REAL browser. Playwright boots the
// server itself (demo mode, no API key, no browser auto-open) and tears it down.
export default defineConfig({
  testDir: './e2e',
  // The smoke suite targets a live deployed URL and is run separately in CD via
  // playwright.smoke.config.js — keep it out of the local/CI e2e run.
  testIgnore: /smoke\.spec\.js/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node src/index.js',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      NO_OPEN: '1', // never spawn a real browser window from the server
    },
  },
});
