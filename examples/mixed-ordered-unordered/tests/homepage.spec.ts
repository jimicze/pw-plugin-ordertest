// NOT in any sequence — runs in the "ordertest:unordered" project
// with standard Playwright parallelization alongside search.spec.ts.
import { expect, test } from '@playwright/test';

test('inventory page loads after login', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await expect(page).toHaveURL(/inventory/);
  await expect(page.locator('.title')).toHaveText('Products');
  await expect(page.locator('.inventory_item')).toHaveCount(6);
});

test('navigation bar is visible on inventory page', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await expect(page.locator('#react-burger-menu-btn')).toBeVisible();
  await expect(page.locator('.shopping_cart_link')).toBeVisible();
});
