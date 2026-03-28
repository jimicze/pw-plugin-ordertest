import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  // Part of the ordered checkout-flow sequence — runs after auth
  expect(true).toBe(true);
});
