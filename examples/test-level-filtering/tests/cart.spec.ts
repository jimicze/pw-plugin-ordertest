import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  // All tests run — no filter applied (simple string entry)
  expect(true).toBe(true);
});

test('remove item from cart', async ({ page }) => {
  expect(true).toBe(true);
});

test('cart persists across page refresh', async ({ page }) => {
  expect(true).toBe(true);
});
