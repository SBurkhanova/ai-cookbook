import { test, expect } from '@playwright/test';

// POST-DEPLOY SMOKE TEST — runs against the LIVE deployed URL (baseURL comes
// from SMOKE_URL in playwright.smoke.config.js), NOT a locally booted server.
// Keep it small and fast: does the deployed app actually serve and work?

test('health endpoint reports ok', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('ok');
});

test('home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#form-panel')).toBeVisible();
});

test('generates a recipe end to end', async ({ page }) => {
  await page.goto('/');
  await page.fill('#ingredient-input', 'egg');
  await page.press('#ingredient-input', 'Enter');
  await page.click('#generate-btn');
  await expect(page.locator('#recipe-panel')).toBeVisible();
  await expect(page.locator('#r-title')).not.toBeEmpty();
});
