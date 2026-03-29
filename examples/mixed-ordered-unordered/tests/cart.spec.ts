// Part of the ordered checkout-flow sequence — runs after auth.spec.ts
// Playwright will not start this project until the auth project has passed.
import { expect, test } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');

  await page.locator('.shopping_cart_link').click();
  await expect(page).toHaveURL(/cart/);
  await expect(page.locator('.cart_item')).toHaveCount(1);
});
