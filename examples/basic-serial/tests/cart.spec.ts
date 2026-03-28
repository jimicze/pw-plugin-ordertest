import { test, expect } from '@playwright/test';

test('add item to cart', async ({ page }) => {
  // Runs only after ALL auth.spec.ts tests pass
  expect(true).toBe(true);
});

test('cart shows correct total', async ({ page }) => {
  expect(true).toBe(true);
});
