import { test, expect } from '@playwright/test';

// These run against the real server (demo mode) in a real Chromium browser.
// Demo mode makes generation deterministic: the recipe title ends in "Skillet".

test('generate → save → appears in Community, end to end', async ({ page }) => {
  await page.goto('/');

  // The form is visible on load.
  await expect(page.locator('#form-panel')).toBeVisible();

  // Add two ingredients via the type-and-Enter interaction.
  await page.fill('#ingredient-input', 'chicken');
  await page.press('#ingredient-input', 'Enter');
  await page.fill('#ingredient-input', 'garlic');
  await page.press('#ingredient-input', 'Enter');
  await expect(page.locator('#chips .chip')).toHaveCount(2);

  // Pick a meal type and a dietary filter.
  await page.selectOption('#meal-type', 'dinner');
  await page.click('.diet-pill[data-diet="vegetarian"]');

  // Generate.
  await page.click('#generate-btn');

  // The recipe panel renders with a title, ingredients, steps, and the diet tag.
  await expect(page.locator('#recipe-panel')).toBeVisible();
  await expect(page.locator('#r-title')).toContainText('Skillet');
  await expect(page.locator('#r-ingredients li').first()).toBeVisible();
  await expect(page.locator('#r-steps li').first()).toBeVisible();
  await expect(page.locator('#r-diet .diet-tag')).toContainText('Vegetarian');

  // Save it, and confirm it lands in the Community list.
  await page.click('#save-btn');
  await expect(page.locator('#save-msg')).toContainText('Saved to Community');
  await expect(page.locator('#community-list .recipe-card')).not.toHaveCount(0);
  await expect(page.locator('#community-list')).toContainText('Skillet');
});

test('shows an inline error when generating with no ingredients', async ({ page }) => {
  await page.goto('/');
  await page.click('#generate-btn');
  await expect(page.locator('#error')).toBeVisible();
  await expect(page.locator('#error')).toContainText('at least one ingredient');
  // The recipe panel must NOT appear.
  await expect(page.locator('#recipe-panel')).toBeHidden();
});
