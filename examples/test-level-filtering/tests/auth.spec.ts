import { test, expect } from '@playwright/test';

test('login with valid credentials', async ({ page }) => {
  // Included — matches the tests[] filter
  expect(true).toBe(true);
});

test('session cookie is set', async ({ page }) => {
  // Included — matches the tests[] filter
  expect(true).toBe(true);
});

test('login with invalid credentials shows error', async ({ page }) => {
  // EXCLUDED — not in the tests[] array
  expect(true).toBe(true);
});

test('forgot password link works', async ({ page }) => {
  // EXCLUDED — not in the tests[] array
  expect(true).toBe(true);
});
