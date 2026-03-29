import { expect, test } from '@playwright/test';

test.describe('Authentication', () => {
  test('user logs in with valid credentials', async ({ page }) => {
    // The HTML report will show this under project "ordertest:checkout-flow:0"
    await page.goto('/');

    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    await expect(page).toHaveURL(/inventory/);
    await expect(page.locator('.title')).toHaveText('Products');
  });

  test('inventory page shows all products', async ({ page }) => {
    await page.goto('/');

    await page.locator('[data-test="username"]').fill('standard_user');
    await page.locator('[data-test="password"]').fill('secret_sauce');
    await page.locator('[data-test="login-button"]').click();

    await expect(page).toHaveURL(/inventory/);
    await expect(page.locator('.inventory_item')).toHaveCount(6);
  });
});
