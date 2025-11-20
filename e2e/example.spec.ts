import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect the correct project title to contain 'QuickSync'
  await expect(page).toHaveTitle(/QuickSync/);
});
