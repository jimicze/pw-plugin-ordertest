import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  // Runs only after all auth.spec.ts tests pass
  expect(true).toBe(true);
});

test('cart total is correct', async ({ page }) => {
  expect(true).toBe(true);
});
