import { test, expect } from '@playwright/test';

test('homepage loads correctly', async ({ page }) => {
  // NOT in any sequence — runs in the "ordertest:unordered" project
  // with standard Playwright parallelization
  expect(true).toBe(true);
});

test('navigation menu works', async ({ page }) => {
  expect(true).toBe(true);
});
