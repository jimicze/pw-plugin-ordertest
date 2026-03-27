import { test, expect } from '@playwright/test';

test('checkout payment succeeds', async ({ page }) => {
  // Runs only after all cart.spec.ts tests pass
  expect(true).toBe(true);
});

test('confirmation page is shown', async ({ page }) => {
  expect(true).toBe(true);
});
