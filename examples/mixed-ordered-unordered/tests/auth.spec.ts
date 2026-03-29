// Part of the ordered checkout-flow sequence
// This test runs first — cart.spec.ts depends on auth completing successfully.
import { expect, test } from '@playwright/test';

test('user logs in', async ({ page }) => {
  await page.goto('/');

  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await expect(page).toHaveURL(/inventory/);
  await expect(page.locator('.title')).toHaveText('Products');
});
