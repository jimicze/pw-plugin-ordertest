import { test, expect } from '@playwright/test';

test('enter shipping address', async ({ page }) => {
  // Runs only after ALL cart.spec.ts tests pass
  expect(true).toBe(true);
});

test('complete purchase', async ({ page }) => {
  expect(true).toBe(true);
});
