// Also unordered — runs independently, possibly in parallel with homepage.spec.ts.
// Under sharding, these tests distribute across shards normally.
import { expect, test } from '@playwright/test';

test('products can be sorted by price low to high', async ({ page }) => {
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

test('products can be sorted by name A to Z', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-test="username"]').fill('standard_user');
  await page.locator('[data-test="password"]').fill('secret_sauce');
  await page.locator('[data-test="login-button"]').click();

  await page.locator('[data-test="product-sort-container"]').selectOption('az');

  const names = page.locator('.inventory_item_name');
  const firstName = await names.first().textContent();
  const lastName = await names.last().textContent();
  expect((firstName ?? 'z').localeCompare(lastName ?? 'a')).toBeLessThanOrEqual(0);
});
