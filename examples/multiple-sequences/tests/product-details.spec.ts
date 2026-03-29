// Part of inventory-flow (parallel mode) — runs after sort-products.spec.ts
import { expect, test } from '@playwright/test';

test('product detail page loads correctly', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  // Click into the Sauce Labs Backpack detail page
  await page.locator('[data-test="item-4-title-link"]').click();

  await expect(page).toHaveURL(/inventory-item/);
  await expect(page.locator('[data-test="inventory-item-name"]')).toHaveText('Sauce Labs Backpack');
  await expect(page.locator('[data-test="inventory-item-desc"]')).toBeVisible();
  await expect(page.locator('[data-test="inventory-item-price"]')).toBeVisible();
});

test('can add product to cart from detail page', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="item-4-title-link"]').click();
  await page.locator('[data-test="add-to-cart"]').click();

  await expect(page.locator('.shopping_cart_badge')).toHaveText('1');
});
