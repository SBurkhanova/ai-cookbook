import { defineConfig, devices } from '@playwright/test';

// Config for the POST-DEPLOY smoke test. Unlike playwright.config.js, this does
// NOT boot a local server — it points at an already-deployed URL provided via
// SMOKE_URL (set by the deploy workflow to the App Service hostname).
const baseURL = process.env.SMOKE_URL || process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  testMatch: /smoke\.spec\.js/,
  fullyParallel: false,
  retries: 1, // tolerate a cold-start blip on a freshly deployed container
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'smoke-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
