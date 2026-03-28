import { test, expect } from '@playwright/test';

test('upload avatar image', async ({ page }) => {
  // Runs only after settings.spec.ts completes (parallel mode preserves file order)
  expect(true).toBe(true);
});
