// Part of inventory-flow (parallel mode) — runs before product-details.spec.ts
import { expect, test } from '@playwright/test';

test('sort products by price low to high', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="product-sort-container"]').selectOption('lohi');

  const prices = page.locator('.inventory_item_price');
  const firstPrice = await prices.first().textContent();
  const lastPrice = await prices.last().textContent();
  const first = Number.parseFloat((firstPrice ?? '$99').replace('$', ''));
  const last = Number.parseFloat((lastPrice ?? '$0').replace('$', ''));
  expect(first).toBeLessThanOrEqual(last);
});

test('sort products by price high to low', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="product-sort-container"]').selectOption('hilo');

  const prices = page.locator('.inventory_item_price');
  const firstPrice = await prices.first().textContent();
  const lastPrice = await prices.last().textContent();
  const first = Number.parseFloat((firstPrice ?? '$0').replace('$', ''));
  const last = Number.parseFloat((lastPrice ?? '$99').replace('$', ''));
  expect(first).toBeGreaterThanOrEqual(last);
});
